from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction
from app.services.periods import period_bounds


def _period_transactions(
    db: Session, period: str, year: int | None, month: int | None
) -> list[Transaction]:
    start, end = period_bounds(period, year, month)
    query = db.query(Transaction)
    if start is not None:
        query = query.filter(Transaction.date >= start, Transaction.date <= end)
    return query.all()


def compute_summary(transactions: list[Transaction]) -> dict:
    income = sum(t.amount for t in transactions if t.type == "income")
    expense = sum(t.amount for t in transactions if t.type == "expense")
    balance = income - expense
    savings_rate = round((balance / income) * 100) if income > 0 else 0
    return {"income": income, "expense": expense, "balance": balance, "savings_rate": savings_rate}


def get_summary(db: Session, period: str, year: int | None, month: int | None) -> dict:
    return compute_summary(_period_transactions(db, period, year, month))


def get_trend(db: Session, months: int, anchor_year: int, anchor_month: int) -> list[dict]:
    points = []
    for k in range(months - 1, -1, -1):
        anchor = date(anchor_year, anchor_month, 1) - relativedelta(months=k)
        y, m = anchor.year, anchor.month
        start = date(y, m, 1)
        end = start + relativedelta(months=1) - timedelta(days=1)
        rows = (
            db.query(Transaction)
            .filter(Transaction.date >= start, Transaction.date <= end)
            .all()
        )
        income = sum(t.amount for t in rows if t.type == "income")
        expense = sum(t.amount for t in rows if t.type == "expense")
        points.append(
            {"label": start.strftime("%b"), "year": y, "month": m, "income": income, "expense": expense}
        )
    return points


def get_category_breakdown(
    db: Session, period: str, year: int | None, month: int | None, type_: str = "expense"
) -> list[dict]:
    rows = [t for t in _period_transactions(db, period, year, month) if t.type == type_]
    totals: dict[int, float] = {}
    for t in rows:
        totals[t.category_id] = totals.get(t.category_id, 0.0) + t.amount
    total_sum = sum(totals.values())
    categories = {c.id: c for c in db.query(Category).all()}
    sorted_ids = sorted(totals.keys(), key=lambda cid: -totals[cid])
    result = []
    for cid in sorted_ids:
        amount = totals[cid]
        pct = round((amount / total_sum) * 100) if total_sum > 0 else 0
        result.append(
            {
                "category_id": cid,
                "name": categories[cid].name if cid in categories else "Unknown",
                "amount": amount,
                "pct": pct,
            }
        )
    return result


def get_cumulative_balance(db: Session) -> list[dict]:
    rows = db.query(Transaction).order_by(Transaction.date, Transaction.id).all()
    running = 0.0
    result = []
    for t in rows:
        # Transfers move money between accounts; total net worth is unchanged,
        # so they contribute 0 to the cumulative (all-accounts) balance.
        if t.type == "income":
            running += t.amount
        elif t.type == "expense":
            running -= t.amount
        result.append({"date": t.date, "balance": running})
    return result

