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
    return results['documents'][0]

def generate_answer(query):
    chunks = retrieve(query)
    context = "\n\n".join(chunks)
    
    prompt = f"""You are a financial analyst assistant. Answer the question using ONLY the context below. If the answer isn't in the context, say so clearly. Do not make up numbers.

Context:
{context}

Question: {query}

Answer:"""

    response = client_gemini.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt
    )
    
    return response.text

query = "What was TCS's revenue growth?"
answer = generate_answer(query)
print(f"Question: {query}\n")
print(f"Answer: {answer}")