# Equity Research RAG Assistant

An AI-powered Retrieval-Augmented Generation (RAG) system that answers financial questions over company annual reports (10-Ks, 10-Qs, investor presentations) with grounded, cited answers — built to reduce the manual effort of scanning long financial documents during equity research.

Users upload one or more annual reports through a web interface. The system retrieves only the specific chunks relevant to a question — from each indexed document, not just the closest overall match — and passes that exact context to an LLM, rather than relying on the model's own unverifiable knowledge. This significantly reduces hallucinated numbers, a critical requirement for financial use cases, and supports cross-document comparison (e.g. "compare revenue growth between Company A and Company B").

## How it works

```
PDF → Text Extraction → Chunking → Embeddings → Vector Store → Retrieval → LLM Generation (cited)
                                                        ↓
                                              Redis cache (repeat queries)
```

1. **Extraction** — `pdfplumber` pulls raw text from the uploaded PDF, page by page, tagging each chunk with its source page.
2. **Chunking** — text is split into ~1000-character overlapping chunks, so no sentence is lost at a chunk boundary.
3. **Embedding** — each chunk is converted into a 384-dimension vector using `sentence-transformers` (`all-MiniLM-L6-v2`), batched for faster indexing.
4. **Storage** — chunks and vectors are stored in ChromaDB, tagged with the owning user and source filename, enabling per-user document isolation and multi-document collections.
5. **Retrieval** — a query is embedded the same way; the top chunks are retrieved **per indexed document** (not globally), so comparison questions pull context from every relevant file rather than letting one document dominate.
6. **Caching** — before calling the LLM, the query (hashed per-user) is checked against Redis. A cache hit returns the stored answer in under a second with zero API cost; a miss runs the full pipeline and caches the result.
7. **Generation** — retrieved chunks are passed as labeled context to Gemini, with an explicit instruction to answer only from that context, cite the source document, and state clearly when information isn't available rather than inventing it.

## Tech stack

| Layer | Tool |
|---|---|
| PDF parsing | pdfplumber |
| Embeddings | sentence-transformers (`all-MiniLM-L6-v2`) |
| Vector store | ChromaDB |
| Caching | Redis (Upstash, hosted) |
| Auth | JWT (python-jose) + bcrypt password hashing, SQLite user store |
| LLM | Google Gemini API (`gemini-3.5-flash`) |
| Backend API | FastAPI |
| Frontend | React (Vite) |

## Features

- **Multi-document upload and querying** — index multiple reports and ask questions across all of them at once, with per-document retrieval ensuring comparison questions draw from each source.
- **Per-user authentication** — JWT-based register/login; documents and query history are isolated per account at the database query level, not just the UI.
- **Grounded, cited answers** — every answer states which document (and chunk) it drew from; the model is explicitly instructed to decline rather than guess when data isn't present in retrieved context.
- **Response caching** — Redis-backed caching reduced repeat-query latency from ~15–20s to ~880ms in testing (~20x improvement), while eliminating redundant LLM calls.
- **Chat-style interface** — conversation history, markdown-rendered answers, document sidebar with upload/delete.

## Setup

```bash
git clone <repo-url>
cd equity-research-rag
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create a `.env` file in the project root:
```
GOOGLE_API_KEY=your_gemini_api_key
JWT_SECRET=your_generated_secret
REDIS_URL=rediss://default:token@your-instance.upstash.io:6379
```

Run the backend:
```bash
python -m uvicorn main:app --reload
```

Run the frontend:
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, register an account, upload one or more PDFs, and start asking questions.

## Evaluation

A 30-question evaluation set (`eval_set.py`) was built covering the standard categories an equity analyst checks in an annual report: revenue & growth, profitability, per-share metrics, balance sheet, cash flow, returns, leadership, workforce, and segment mix. An automated runner (`run_eval.py`) executes the set against the pipeline and checks answers against known values where available, with number-format normalization (Indian vs. international comma conventions) so formatting differences don't register as false failures.

A full 30-question run is pending due to Gemini's free-tier daily request limit (20 requests/day at time of writing), which spreads a complete evaluation across multiple sessions. Spot-testing across both indexed documents (TCS, Infosys) showed correct, cited answers on revenue, margin, and cash-flow questions, and correct refusal to answer when data wasn't present in retrieved context (verified on an EBIT-margin question where the system reported the specific figure wasn't disclosed in the retrieved chunks, rather than estimating one).

### Observations & limitations

- **Cross-document retrieval required a fix.** An initial implementation retrieved the top 5 chunks globally, which caused comparison questions to be dominated by whichever document matched more closely, silently excluding the other. Fixed by retrieving top-k chunks per document rather than globally.
- **PDF extraction has known limitations on complex layouts.** Pages with heavy graphic or multi-column formatting (table-of-contents pages, embedded QR codes) occasionally produce garbled text; standard narrative and financial-statement pages, the majority of each document, extract cleanly.
- **Number formatting varies by LLM response** (Indian numbering vs. international), which doesn't affect answer correctness but requires normalization in any automated grading.
- **Free-tier API rate limits** shaped both development pace and the scope of evaluation runs; noted for transparency.

## Project structure

```
├── main.py              # FastAPI app: auth, upload, retrieval, generation, caching
├── auth.py               # JWT auth, password hashing, user model
├── build_index.py         # Standalone script: PDF → chunks → embeddings → ChromaDB
├── eval_set.py             # 30-question evaluation set
├── run_eval.py              # Evaluation runner
├── requirements.txt
├── experiments/              # Early standalone scripts used during development
└── frontend/
    └── src/
        ├── App.jsx           # Main chat interface
        └── Login.jsx          # Auth screen
```

## Future improvements

- **Hybrid search** (vector + BM25 keyword search) to catch exact-term queries like ticker symbols that pure semantic search can miss.
- **Re-ranking** with a cross-encoder to improve precision on retrieved chunks.
- **Cap per-document retrieval** for users with many indexed documents, to keep prompt context bounded as document count scales.
- **System design for scale** — at higher request volume, this architecture would benefit from a message queue for indexing large PDFs asynchronously (rather than blocking the upload request), horizontal scaling of the FastAPI layer behind a load balancer, and a managed vector store rather than local ChromaDB.
