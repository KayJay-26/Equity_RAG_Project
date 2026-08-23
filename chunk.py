import pdfplumber

# Step 1: Extract text (same as before)
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
        start += chunk_size - overlap  # move forward, but overlap a bit
    return chunks

chunks = chunk_text(all_text)

print(f"Created {len(chunks)} chunks")
print("---- First chunk ----")
print(chunks[0])
print("---- Second chunk ----")
print(chunks[1])
print("---- Chunk from the middle (financial content) ----")
print(chunks[300])