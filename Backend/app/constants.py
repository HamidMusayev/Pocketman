"""Closed vocabularies shared between models, schemas and services.

Keep in sync with `Front/src/icons.ts` and `Front/src/lib/colorRamp.ts` — see
AI Instructions/STRUCTURE.md for the "keep both lists in sync" convention.
"""

CATEGORY_ICON_KEYS = [
    "salary", "freelance", "car", "dining", "entertainment", "food", "fuel",
    "healthcare", "housing", "personal", "subscriptions", "transport",
    "travel", "utilities", "fitness", "other",
]

ACCOUNT_ICON_KEYS = ["wallet", "bank", "card"]

ACCOUNT_TYPES = ["cash", "savings", "card", "investment"]

CATEGORY_TYPES = ["income", "expense"]

# "transfer" moves money between accounts and is excluded from income/expense
# aggregation; only income/expense transactions carry a category.
TRANSACTION_TYPES = ["income", "expense", "transfer"]

FREQUENCIES = ["Daily", "Weekly", "Monthly", "Yearly"]

ACCENT_COLORS = ["#FCD535", "#2dbdb6", "#0ecb81", "#3b82f6"]

# Safety valve for the recurring catch-up loop (see services/recurring.py)
MAX_CATCH_UP_OCCURRENCES = 36

MAX_TAG_LEN = 40
MAX_TAGS_PER_TRANSACTION = 10

GOAL_ICON_KEYS = ["target", "car", "housing", "travel", "savings", "gift", "education", "healthcare"]

# Transactions list pagination
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 500
