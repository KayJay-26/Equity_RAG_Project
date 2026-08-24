# run_eval.py
# Runs every question in eval_set.py through the RAG pipeline and prints
# the result so you can manually tag each one:
#   [correct]   - answer is accurate and grounded in the right chunk
#   [partial]   - answer is roughly right or found relevant info but incomplete
#   [wrong]     - answer is wrong, irrelevant, or "not found in context"
#
# Usage: run this AFTER generate.py's functions are available, or with
# the FastAPI server running (edit CALL_VIA_API below to choose).

from eval_set import eval_questions

# --- Option A: call the pipeline functions directly (no server needed) ---
from generate import generate_answer


def normalize_numbers(text):
    """
    Strip commas from numbers so '267,021' and '2,67,021' (Indian numbering
    format) both normalize to '267021' and can be compared fairly.
    This only removes commas that sit between digits, so it won't touch
    normal sentence punctuation.
    """
    import re
    return re.sub(r'(?<=\d),(?=\d)', '', text)


def run():
    results = []
    for i, item in enumerate(eval_questions, start=1):
        question = item["question"]
        expected = item["expected_answer_contains"]

        answer = generate_answer(question)

        print(f"\n{'='*70}")
        print(f"Q{i}: {question}")
        print(f"{'-'*70}")
        print(f"Answer: {answer}")

        if expected:
            hit = normalize_numbers(expected) in normalize_numbers(answer)
            print(f"Expected to contain: '{expected}' -> {'FOUND' if hit else 'NOT FOUND'}")
            results.append({"question": question, "answer": answer, "expected": expected, "hit": hit})
        else:
            print("(No expected value set yet — eyeball this one and tag it manually)")
            results.append({"question": question, "answer": answer, "expected": expected, "hit": None})

    checked = [r for r in results if r["hit"] is not None]
    if checked:
        passed = sum(1 for r in checked if r["hit"])
        print(f"\n{'='*70}")
        print(f"Auto-checked: {passed}/{len(checked)} passed. "
              f"({len(results) - len(checked)} more need manual review above.)")
    return results


if __name__ == "__main__":
    run()