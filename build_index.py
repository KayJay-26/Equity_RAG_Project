import pdfplumber
from sentence_transformers import SentenceTransformer
import chromadb

# Step 1: Extract text
with pdfplumber.open("TCS_Annual_report.pdf") as pdf:
    all_text = ""
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            all_text += text + "\n"

# Step 2: Chunk the text
def chunk_text(text, chunk_size=1000, overlap=100):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += chunk_size - overlap
    return chunks

chunks = chunk_text(all_text)
print(f"Created {len(chunks)} chunks")

# Step 3: Load embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Step 4: Set up ChromaDB
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(name="tcs_report")

# Step 5: Embed and store each chunk
print("Embedding and storing chunks...")
for i, chunk in enumerate(chunks):
    embedding = model.encode(chunk).tolist()
    collection.add(
        ids=[f"chunk_{i}"],
        embeddings=[embedding],
        documents=[chunk]
    )
    if i % 100 == 0:
        print(f"Processed {i}/{len(chunks)} chunks")

print("Done! All chunks embedded and stored.")