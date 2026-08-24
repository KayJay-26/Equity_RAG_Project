import pdfplumber

with pdfplumber.open("TCS_Annual_report.pdf") as pdf:
    all_text = ""
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            all_text += text + "\n"

print(f"Extracted {len(all_text)} characters from {len(pdf.pages)} pages")
print("---- First 1000 characters ----")
print(all_text[:1000])