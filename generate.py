from dotenv import load_dotenv
import os
from sentence_transformers import SentenceTransformer
import chromadb
from google import genai

# Load API key from .env
load_dotenv()
client_gemini = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# Set up retrieval (same as before)
model = SentenceTransformer('all-MiniLM-L6-v2')
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(name="tcs_report")

def retrieve(query, n_results=3):
    query_embedding = model.encode(query).tolist()
    results = collection.query(query_embeddings=[query_embedding], n_results=n_results)
    docs = results['documents'][0]
    ids = results['ids'][0]  # chunk IDs like "chunk_42"
    return docs, ids

def generate_answer(query):
    chunks, ids = retrieve(query)
    
    # Build context WITH labels so the model can cite them
    labeled_context = "\n\n".join(
        [f"[Source: {ids[i]}]\n{chunks[i]}" for i in range(len(chunks))]
    )
    
    prompt = f"""You are a financial analyst assistant. Answer the question using ONLY the context below. Cite which source(s) you used in your answer using their labels (e.g. "According to chunk_42..."). If the answer isn't in the context, say so clearly. Do not make up numbers.

Context:
{labeled_context}

Question: {query}

Answer:"""

    response = client_gemini.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt
    )
    
    return response.text

test_questions = [
    "What was TCS's revenue growth?",
    "Who is the CEO of TCS?",
    "What are TCS's main business segments?",
    "What was the operating margin?",
]

for q in test_questions:
    answer = generate_answer(q)
    print(f"Q: {q}")
    print(f"A: {answer}\n")
    print("-" * 50)