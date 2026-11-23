from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction
from app.money import ZERO
from app.services.periods import period_bounds


def category_in_use(db: Session, category_id: int) -> bool:
    from app.models.recurring import PendingApproval, RecurringRule

    has_txn = db.query(Transaction).filter(Transaction.category_id == category_id).first()
    has_rule = db.query(RecurringRule).filter(RecurringRule.category_id == category_id).first()
    has_pending = (
        db.query(PendingApproval).filter(PendingApproval.category_id == category_id).first()
    )
    return bool(has_txn or has_rule or has_pending)


def spent_by_category(
    db: Session,
    user_id: int,
    period: str,
    year: int | None,
    month: int | None,
    type_: str = "expense",
) -> dict[int, Decimal]:
    start, end = period_bounds(period, year, month)
    query = db.query(Transaction).filter(
        Transaction.user_id == user_id, Transaction.type == type_
    )
    if start is not None:
        query = query.filter(Transaction.date >= start, Transaction.date <= end)
    totals: dict[int, Decimal] = {}
    for txn in query.all():
        totals[txn.category_id] = totals.get(txn.category_id, ZERO) + txn.amount
    return totals


def budget_summary(
    db: Session, user_id: int, period: str, year: int | None, month: int | None
) -> dict:
    spent = spent_by_category(db, user_id, period, year, month, "expense")
    categories = (
        db.query(Category)
        .filter(Category.user_id == user_id, Category.type == "expense")
        .order_by(Category.id)
        .all()
    )

    items = []
    spent_total = ZERO
    budget_total = ZERO
    budgeted_count = 0
    for c in categories:
        c_spent = spent.get(c.id, ZERO)
        pct_used = None
        if c.budget and c.budget > 0:
            pct_used = round((c_spent / c.budget) * 100)
            budget_total += c.budget
            budgeted_count += 1
        spent_total += c_spent
        items.append(
            {
                "category_id": c.id,
                "name": c.name,
                "icon": c.icon,
                "spent": c_spent,
                "budget": c.budget,
                "pct_used": pct_used,
            }
        )

    # "spent_total" for the ring only counts spend within budgeted categories,
    # matching the prototype's ring (budgetSpent sums only categories with budget>0)
    budgeted_ids = {c.id for c in categories if c.budget and c.budget > 0}
    ring_spent = sum((spent.get(cid, ZERO) for cid in budgeted_ids), ZERO)
    pct = round((ring_spent / budget_total) * 100) if budget_total > 0 else 0

    return {
        "categories": items,
        "spent_total": ring_spent,
        "budget_total": budget_total,
        "pct": pct,
        "budgeted_count": budgeted_count,
    }
