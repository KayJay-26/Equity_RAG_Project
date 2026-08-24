# Equity Research RAG Assistant

An AI-powered Retrieval-Augmented Generation (RAG) system that answers financial questions over company annual reports (10-Ks, 10-Qs, investor presentations) with grounded, cited answers — built to reduce the manual effort of scanning long financial documents during equity research.

Given a 360-page annual report, the system retrieves only the specific pages/paragraphs relevant to a question and passes that exact context to an LLM, rather than relying on the LLM's own unverifiable knowledge — reducing hallucinated numbers, a critical requirement for financial use cases.

# How it works
PDF → Text Extraction → Chunking → Embeddings → Vector Store → Retrieval → LLM Generation (with citation)
Extraction — pdfplumber pulls raw text from the source PDF, page by page.
Chunking — text is split into ~1000-character overlapping chunks, so no sentence is lost at a chunk boundary.
Embedding — each chunk is converted into a 384-dimension vector using sentence-transformers (all-MiniLM-L6-v2), capturing semantic meaning, not just keywords.
Storage — chunks and their vectors are stored in ChromaDB, a local vector database.
Retrieval — a user's question is embedded the same way, and the top-k most semantically similar chunks are retrieved via cosine similarity.
Generation — retrieved chunks are passed as labeled context to Gemini, with an explicit instruction to answer only from that context and cite the source chunk — the core defense against hallucination.


# Tech stack
Layer	Tool
PDF parsing	pdfplumber
Embeddings	sentence-transformers (all-MiniLM-L6-v2)
Vector store	ChromaDB
LLM	Google Gemini API (gemini-3.5-flash)
Backend API	FastAPI
Frontend	React
Setup
bash
git clone <repo-url>
cd equity-research-rag
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

Create a .env file in the project root:

GOOGLE_API_KEY=your_gemini_api_key_here

Build the vector index (run once per new PDF):

bash
python build_index.py

Run the API server:

bash
uvicorn main:app --reload

Test interactively at http://127.0.0.1:8000/docs, or send a question directly:

bash
POST /ask
{ "query": "What was the company's revenue growth?" }
Evaluation

The system was tested against a 30-question set covering the standard categories an equity analyst checks in an annual report: revenue & growth, profitability, per-share metrics, balance sheet, cash flow, returns, leadership, workforce, and segment mix (see eval_set.py).

For questions with a known, verifiable expected value, the system correctly retrieved and cited the right figure — for example, correctly distinguishing Standalone revenue (₹2,20,938 crore) from Consolidated revenue (₹2,67,021 crore) for the same fiscal year, without being asked to make that distinction explicitly.

# Observations & limitations
Number formatting varies. The LLM sometimes uses Indian numbering conventions (2,67,021) and sometimes international (267,021) for the same figure. Doesn't affect correctness, but automated grading needs to normalize number formatting before comparing.
The system correctly declines to answer when data isn't in the retrieved context, rather than guessing. When asked for the exact EBIT margin percentage, it reported that retrieved chunks only described margins as "expanded" without a specific figure, instead of inventing a plausible number — the grounding prompt's intended behavior, holding up under testing.
PDF extraction has known limitations on complex layouts. Pages with heavy graphic/table-of-contents formatting (multi-column layouts, embedded QR codes) occasionally produce garbled text. Did not affect extraction quality on standard narrative or financial-statement pages, which make up the majority of the document.
Free-tier API rate limits (20 requests/day on Gemini's free tier at time of testing) mean full 30-question evaluation runs may need to be split across sessions. Noted for transparency, not treated as a system flaw.

# Project structure

# ├── build_index.py 
PDF → chunks → embeddings → ChromaDB (run once per document)

# ├── generate.py        
Core retrieval + generation pipeline

# ├── main.py             
FastAPI server exposing the pipeline as an API

# ├── eval_set.py         
30-question evaluation set

# ├── run_eval.py          
Evaluation runner with pass/fail checking

# ├── experiments/         
Standalone scripts used during development/testing

# └── requirements.txt


# Future improvements
Hybrid search (vector + BM25 keyword search) to catch exact-term queries like ticker symbols that pure semantic search can miss.
Re-ranking with a cross-encoder to improve precision on top retrieved chunks.
Multi-document support — currently indexed for a single report; extending to compare across companies/years.
Caching (Redis) for repeated queries, relevant at higher request volume than this project currently handles.
Authentication layer, if deployed as a multi-user product rather than a single-report demo.

Two things to do before this is fully accurate: run pip freeze > requirements.txt for the real dependency list, and swap in your actual GitHub URL once pushed.


