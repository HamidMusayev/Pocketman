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


def seed_defaults(db: Session, user_id: int) -> None:
    """Seed a new user's default account and standard category set.

    Called from POST /api/auth/register. Deliberately seeds no demo transactions.
    """
    if not db.query(Account).filter(Account.user_id == user_id, Account.name == "Main").first():
        db.add(Account(user_id=user_id, name="Main", type="cash", icon="wallet", removable=False))

    existing_names = {
        name for (name,) in db.query(Category.name).filter(Category.user_id == user_id).all()
    }
    for name, type_, icon in DEFAULT_CATEGORIES:
        if name not in existing_names:
            db.add(Category(user_id=user_id, name=name, type=type_, icon=icon, budget=None))

    db.commit()
