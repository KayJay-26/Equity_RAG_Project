from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import shutil
import pdfplumber
from sentence_transformers import SentenceTransformer
import chromadb
from google import genai
from fastapi.security import OAuth2PasswordRequestForm
from auth import (
    User, UserCredentials, TokenResponse, get_db, get_current_user,
    hash_password, verify_password, create_access_token,
)

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


def index_document(filename, text, owner, batch_size=64):
    chunks = chunk_text(text)
    for start in range(0, len(chunks), batch_size):
        batch = chunks[start:start + batch_size]
        embeddings = embed_model.encode(batch, batch_size=batch_size).tolist()
        collection.add(
            ids=[f"{owner}::{filename}::chunk_{start + i}" for i in range(len(batch))],
            embeddings=embeddings,
            documents=batch,
            metadatas=[
                {"source_file": filename, "chunk_index": start + i, "owner": owner}
                for i in range(len(batch))
            ],
        )
    return len(chunks)


def retrieve(query, owner, n_results=5):
    """Search only chunks belonging to this user — enforced at the DB query level."""
    results = collection.query(
        query_embeddings=[embed_model.encode(query).tolist()],
        n_results=n_results,
        where={"owner": owner},
    )
    return results['documents'][0], results['metadatas'][0]


def generate_answer(query, owner):
    chunks, metadatas = retrieve(query, owner)
    if not chunks:
        return "No documents indexed yet. Upload a PDF first.", []
    

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

@app.post("/register", response_model=TokenResponse)
def register(creds: UserCredentials, db=Depends(get_db)):
    if db.query(User).filter(User.email == creds.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if len(creds.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = User(email=creds.email, hashed_password=hash_password(creds.password))
    db.add(user)
    db.commit()
    return TokenResponse(access_token=create_access_token(user.email), email=user.email)


@app.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db=Depends(get_db)):
    # OAuth2PasswordRequestForm sends 'username' — we treat it as the email.
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return TokenResponse(access_token=create_access_token(user.email), email=user.email)


@app.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"email": user.email}


@app.get("/")
def home():
    return {"status": "Equity RAG Assistant is running"}


@app.get("/documents")
def list_documents(user: User = Depends(get_current_user)):
    items = collection.get(where={"owner": user.email}, include=["metadatas"])
    counts = {}
    for meta in items["metadatas"]:
        counts[meta["source_file"]] = counts.get(meta["source_file"], 0) + 1
    return {"documents": [{"filename": f, "chunks": c} for f, c in counts.items()]}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    existing = collection.get(
        where={"$and": [{"owner": user.email}, {"source_file": file.filename}]}, include=[]
    )
    if existing["ids"]:
        raise HTTPException(status_code=409, detail=f"'{file.filename}' is already indexed.")

    user_dir = os.path.join(UPLOAD_DIR, user.email.replace("@", "_at_"))
    os.makedirs(user_dir, exist_ok=True)
    path = os.path.join(user_dir, file.filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    text = extract_text(path)
    if not text.strip():
        os.remove(path)
        raise HTTPException(status_code=422, detail="No extractable text found in this PDF.")

    chunk_count = index_document(file.filename, text, user.email)
    return {"filename": file.filename, "chunks_indexed": chunk_count, "characters": len(text)}


@app.delete("/documents/{filename}")
def delete_document(filename: str, user: User = Depends(get_current_user)):
    existing = collection.get(
        where={"$and": [{"owner": user.email}, {"source_file": filename}]}, include=[]
    )
    if not existing["ids"]:
        raise HTTPException(status_code=404, detail="Document not found.")
    collection.delete(ids=existing["ids"])

    path = os.path.join(UPLOAD_DIR, user.email.replace("@", "_at_"), filename)
    if os.path.exists(path):
        os.remove(path)
    return {"deleted": filename, "chunks_removed": len(existing["ids"])}


@app.post("/ask")
def ask_question(request: QuestionRequest, user: User = Depends(get_current_user)):
    answer, sources = generate_answer(request.query, user.email)
    return {"question": request.query, "answer": answer, "sources": sources}