from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.category import Category

DEFAULT_CATEGORIES: list[tuple[str, str, str]] = [
    ("Salary", "income", "salary"),
    ("Freelance", "income", "freelance"),
    ("Car", "expense", "car"),
    ("Dining", "expense", "dining"),
    ("Entertainment", "expense", "entertainment"),
    ("Food", "expense", "food"),
    ("Fuel", "expense", "fuel"),
    ("Healthcare", "expense", "healthcare"),
    ("Housing", "expense", "housing"),
    ("Personal Care", "expense", "personal"),
    ("Subscriptions", "expense", "subscriptions"),
    ("Transport", "expense", "transport"),
    ("Travel", "expense", "travel"),
    ("Utilities", "expense", "utilities"),
    ("Fitness", "expense", "fitness"),
    ("Other", "expense", "other"),
]


def seed_defaults(db: Session) -> None:
    """Seed the one default account and the standard category set.

    Only ever called once, from POST /api/auth/setup on a fresh database.
    Deliberately does NOT seed any demo transactions.
    """
    if not db.query(Account).filter(Account.name == "Main").first():
        db.add(Account(name="Main", type="cash", icon="wallet", removable=False))

    existing_names = {c.name for c in db.query(Category.name).all()}
    for name, type_, icon in DEFAULT_CATEGORIES:
        if name not in existing_names:
            db.add(Category(name=name, type=type_, icon=icon, budget=None))

    db.commit()
