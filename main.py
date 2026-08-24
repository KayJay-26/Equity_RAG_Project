from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import shutil
import pdfplumber
from sentence_transformers import SentenceTransformer
import chromadb
from google import genai

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploaded_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

embed_model = SentenceTransformer('all-MiniLM-L6-v2')
chroma_client = chromadb.PersistentClient(path="./chroma_db")
# Single collection holding chunks from ALL uploaded documents.
# Each chunk carries metadata identifying which file it came from.
collection = chroma_client.get_or_create_collection(name="documents")
gemini_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))


def extract_text(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            page_text = page.extract_text()
            if page_text:
                text += f"[Page {page_num}]\n{page_text}\n"
    return text


def chunk_text(text, chunk_size=1000, overlap=100):
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start:start + chunk_size])
        start += chunk_size - overlap
    return chunks


def index_document(filename, text):
    """Embed and store every chunk of a document, tagged with its filename."""
    chunks = chunk_text(text)
    for i, chunk in enumerate(chunks):
        collection.add(
            ids=[f"{filename}::chunk_{i}"],
            embeddings=[embed_model.encode(chunk).tolist()],
            documents=[chunk],
            metadatas=[{"source_file": filename, "chunk_index": i}],
        )
    return len(chunks)


def retrieve(query, n_results=5):
    """Search across chunks from ALL indexed documents."""
    results = collection.query(
        query_embeddings=[embed_model.encode(query).tolist()],
        n_results=n_results,
    )
    return results['documents'][0], results['metadatas'][0]


def generate_answer(query):
    chunks, metadatas = retrieve(query)

    if not chunks:
        return "No documents have been indexed yet. Upload a PDF first.", []

    labeled_context = "\n\n".join(
        f"[Source: {metadatas[i]['source_file']}, chunk {metadatas[i]['chunk_index']}]\n{chunks[i]}"
        for i in range(len(chunks))
    )

    prompt = f"""You are a financial analyst assistant. Answer the question using ONLY the context below.
The context may come from MULTIPLE different documents — always state which document (by filename) each figure comes from, especially when comparing across companies or years.
Cite your sources inline. If the answer isn't in the context, say so clearly. Never invent numbers.

Context:
{labeled_context}

Question: {query}

Answer:"""

    response = gemini_client.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt,
    )

    sources = sorted({m['source_file'] for m in metadatas})
    return response.text, sources


class QuestionRequest(BaseModel):
    query: str


@app.get("/")
def home():
    return {"status": "Equity RAG Assistant is running"}


@app.get("/documents")
def list_documents():
    """Return every document currently indexed, with its chunk count."""
    all_items = collection.get(include=["metadatas"])
    counts = {}
    for meta in all_items["metadatas"]:
        counts[meta["source_file"]] = counts.get(meta["source_file"], 0) + 1
    return {"documents": [{"filename": f, "chunks": c} for f, c in counts.items()]}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    existing = collection.get(where={"source_file": file.filename}, include=[])
    if existing["ids"]:
        raise HTTPException(
            status_code=409,
            detail=f"'{file.filename}' is already indexed. Delete it first to re-upload.",
        )

    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    text = extract_text(path)
    if not text.strip():
        os.remove(path)
        raise HTTPException(status_code=422, detail="No extractable text found in this PDF.")

    chunk_count = index_document(file.filename, text)
    return {"filename": file.filename, "chunks_indexed": chunk_count, "characters": len(text)}


@app.delete("/documents/{filename}")
def delete_document(filename: str):
    existing = collection.get(where={"source_file": filename}, include=[])
    if not existing["ids"]:
        raise HTTPException(status_code=404, detail="Document not found.")
    collection.delete(ids=existing["ids"])

    path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(path):
        os.remove(path)
    return {"deleted": filename, "chunks_removed": len(existing["ids"])}


@app.post("/ask")
def ask_question(request: QuestionRequest):
    answer, sources = generate_answer(request.query)
    return {"question": request.query, "answer": answer, "sources": sources}