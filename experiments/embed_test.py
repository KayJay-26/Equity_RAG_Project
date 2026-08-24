from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

# Test with one chunk of text
test_text = "TCS reported strong revenue growth driven by AI and cloud services."
vector = model.encode(test_text)

print(f"Vector length: {len(vector)}")
print(f"First 10 numbers: {vector[:10]}")