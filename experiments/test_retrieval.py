from sentence_transformers import SentenceTransformer
import chromadb

model = SentenceTransformer('all-MiniLM-L6-v2')
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(name="tcs_report")

query = "What was TCS's revenue growth?"
query_embedding = model.encode(query).tolist()

results = collection.query(
    query_embeddings=[query_embedding],
    n_results=3
)

print(f"Query: {query}\n")
for i, doc in enumerate(results['documents'][0]):
    print(f"--- Result {i+1} ---")
    print(doc)
    print()