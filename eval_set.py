# eval_set.py
# Standard equity-research questions used to evaluate the RAG pipeline's
# retrieval and generation quality against the TCS annual report.
#
# HOW TO USE:
# 1. Run each question through the pipeline (via generate.py or the /ask endpoint).
# 2. Manually check the report to confirm the correct answer.
# 3. Fill in "expected_answer_contains" with a short, distinctive substring
#    (a number, a name) that should appear in a correct answer.
# 4. Leave it as None for questions you haven't verified yet — the eval
#    runner should skip scoring those and just print the answer for review.

eval_questions = [
    # --- Revenue & Growth ---
    {"question": "What was the total revenue for the fiscal year?", "expected_answer_contains": "267,021"},
    {"question": "What was the year-over-year revenue growth rate?", "expected_answer_contains": "4.6"},
    {"question": "What was the 5-year revenue CAGR?", "expected_answer_contains": None},
    {"question": "What was revenue growth in constant currency terms?", "expected_answer_contains": None},

    # --- Profitability & Margins ---
    {"question": "What was the operating margin (EBIT margin)?", "expected_answer_contains": "25.0"},
    {"question": "What was the net profit margin?", "expected_answer_contains": None},
    {"question": "What was the profit after tax (PAT)?", "expected_answer_contains": "52,820"},
    {"question": "What was the EBITDA margin?", "expected_answer_contains": None},

    # --- Per-Share & Shareholder Returns ---
    {"question": "What was the basic/diluted EPS?", "expected_answer_contains": "145.99"},
    {"question": "What was the dividend per share declared?", "expected_answer_contains": None},
    {"question": "What was the total shareholder payout (dividends + buybacks)?", "expected_answer_contains": None},
    {"question": "What was the dividend payout ratio?", "expected_answer_contains": None},

    # --- Balance Sheet & Cash ---
    {"question": "What was the total cash and cash equivalents?", "expected_answer_contains": None},
    {"question": "What was the total debt on the balance sheet?", "expected_answer_contains": None},
    {"question": "What was the total assets?", "expected_answer_contains": None},
    {"question": "What was the net worth/shareholders' equity?", "expected_answer_contains": None},

    # --- Cash Flow ---
    {"question": "What was the operating cash flow?", "expected_answer_contains": None},
    {"question": "What was the free cash flow?", "expected_answer_contains": None},
    {"question": "What was the cash conversion ratio?", "expected_answer_contains": None},

    # --- Returns & Efficiency ---
    {"question": "What was the Return on Equity (RoE)?", "expected_answer_contains": None},
    {"question": "What was the Return on Capital Employed (RoCE)?", "expected_answer_contains": None},
    {"question": "What was the current ratio/liquidity position?", "expected_answer_contains": None},

    # --- Leadership & Governance ---
    {"question": "Who is the CEO of the company?", "expected_answer_contains": None},
    {"question": "Who is the Chairman of the Board?", "expected_answer_contains": None},
    {"question": "How many independent directors are on the board?", "expected_answer_contains": None},

    # --- Workforce ---
    {"question": "What was the total headcount/employee count?", "expected_answer_contains": None},
    {"question": "What was the employee attrition rate?", "expected_answer_contains": None},
    {"question": "What was the gender diversity ratio in the workforce?", "expected_answer_contains": None},

    # --- Segments & Business Mix ---
    {"question": "What was the revenue contribution by industry vertical/segment?", "expected_answer_contains": None},
    {"question": "What was the revenue contribution by geography?", "expected_answer_contains": None},
]