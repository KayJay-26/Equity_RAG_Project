from fastapi import FastAPI
from dotenv import load_dotenv
import os
from sentence_transformers import SentenceTransformer
import chromadb
from google import genai

load_dotenv()

app = FastAPI()

# Set up everything once, when the server starts (not on every request)
embed_model = SentenceTransformer('all-MiniLM-L6-v2')
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="tcs_report")
gemini_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

def retrieve(query, n_results=3):
    query_embedding = embed_model.encode(query).tolist()
    results = collection.query(query_embeddings=[query_embedding], n_results=n_results)
    return results['documents'][0], results['ids'][0]

def generate_answer(query):
    chunks, ids = retrieve(query)
    labeled_context = "\n\n".join(
        [f"[Source: {ids[i]}]\n{chunks[i]}" for i in range(len(chunks))]
    )
    prompt = f"""You are a financial analyst assistant. Answer the question using ONLY the context below. Cite which source(s) you used (e.g. "According to chunk_42..."). If the answer isn't in the context, say so clearly. Do not make up numbers.

Context:
{labeled_context}

Question: {query}

Answer:"""
    response = gemini_client.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt
    )
    return response.text

@app.get("/")
def home():
    return {"status": "Equity RAG Assistant is running"}

@app.post("/ask")
def ask_question(query: str):
    answer = generate_answer(query)
    return {"question": query, "answer": answer}