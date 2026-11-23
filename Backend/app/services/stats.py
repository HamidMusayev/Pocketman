from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction
from app.money import ZERO
from app.services.periods import period_bounds


def _user_transactions(db: Session, user_id: int):
    return db.query(Transaction).filter(Transaction.user_id == user_id)


def _period_transactions(
    db: Session, user_id: int, period: str, year: int | None, month: int | None
) -> list[Transaction]:
    start, end = period_bounds(period, year, month)
    query = _user_transactions(db, user_id)
    if start is not None:
        query = query.filter(Transaction.date >= start, Transaction.date <= end)
    return query.all()


def compute_summary(transactions: list[Transaction]) -> dict:
    income = sum((t.amount for t in transactions if t.type == "income"), ZERO)
    expense = sum((t.amount for t in transactions if t.type == "expense"), ZERO)
    balance = income - expense
    savings_rate = round((balance / income) * 100) if income > 0 else 0
    return {"income": income, "expense": expense, "balance": balance, "savings_rate": savings_rate}


def get_summary(db: Session, user_id: int, period: str, year: int | None, month: int | None) -> dict:
    return compute_summary(_period_transactions(db, user_id, period, year, month))


def get_trend(
    db: Session, user_id: int, months: int, anchor_year: int, anchor_month: int
) -> list[dict]:
    points = []
    for k in range(months - 1, -1, -1):
        anchor = date(anchor_year, anchor_month, 1) - relativedelta(months=k)
        y, m = anchor.year, anchor.month
        start = date(y, m, 1)
        end = start + relativedelta(months=1) - timedelta(days=1)
        rows = (
            _user_transactions(db, user_id)
            .filter(Transaction.date >= start, Transaction.date <= end)
            .all()
        )
        income = sum((t.amount for t in rows if t.type == "income"), ZERO)
        expense = sum((t.amount for t in rows if t.type == "expense"), ZERO)
        points.append(
            {"label": start.strftime("%b"), "year": y, "month": m, "income": income, "expense": expense}
        )
    return points


def get_category_breakdown(
    db: Session,
    user_id: int,
    period: str,
    year: int | None,
    month: int | None,
    type_: str = "expense",
) -> list[dict]:
    rows = [t for t in _period_transactions(db, user_id, period, year, month) if t.type == type_]
    totals: dict[int, Decimal] = {}
    for t in rows:
        totals[t.category_id] = totals.get(t.category_id, ZERO) + t.amount
    total_sum = sum(totals.values(), ZERO)
    categories = {
        c.id: c for c in db.query(Category).filter(Category.user_id == user_id).all()
    }
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


def get_cumulative_balance(db: Session, user_id: int) -> list[dict]:
    rows = _user_transactions(db, user_id).order_by(Transaction.date, Transaction.id).all()
    # opening balances are money that existed before the first transaction
    running = sum(
        (a.opening_balance or ZERO for a in db.query(Account).filter(Account.user_id == user_id)),
        ZERO,
    )
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


def _pct_change(current: Decimal, previous: Decimal) -> int | None:
    """Whole-percent change from previous to current; None when there's no base."""
    if previous == 0:
        return None
    return round((current - previous) * 100 / previous)


def _month_rows(db: Session, user_id: int, start: date, end: date) -> list[Transaction]:
    return (
        _user_transactions(db, user_id)
        .filter(Transaction.date >= start, Transaction.date <= end)
        .all()
    )


def get_monthly_report(db: Session, user_id: int, year: int, month: int, today: date | None = None) -> dict:
    """Everything the monthly report page shows, compared with the month before."""
    today = today or date.today()
    start = date(year, month, 1)
    end = start + relativedelta(months=1) - timedelta(days=1)
    prev_start = start - relativedelta(months=1)
    prev_end = start - timedelta(days=1)

    rows = _month_rows(db, user_id, start, end)
    prev_rows = _month_rows(db, user_id, prev_start, prev_end)
    current = compute_summary(rows)
    previous = compute_summary(prev_rows)

    # days elapsed so far for the running month, the whole month otherwise
    if start <= today <= end:
        days = today.day
    elif today < start:
        days = 0
    else:
        days = end.day
    avg_daily_expense = (current["expense"] / days).quantize(Decimal("0.01")) if days else ZERO

    def by_category(txns: list[Transaction]) -> dict[int, Decimal]:
        totals: dict[int, Decimal] = {}
        for t in txns:
            if t.type == "expense":
                totals[t.category_id] = totals.get(t.category_id, ZERO) + t.amount
        return totals

    cur_cat = by_category(rows)
    prev_cat = by_category(prev_rows)
    categories = {c.id: c for c in db.query(Category).filter(Category.user_id == user_id).all()}
    category_items = []
    for cid in sorted(set(cur_cat) | set(prev_cat), key=lambda c: (-cur_cat.get(c, ZERO), -prev_cat.get(c, ZERO))):
        cat = categories.get(cid)
        amount = cur_cat.get(cid, ZERO)
        prev_amount = prev_cat.get(cid, ZERO)
        budget = cat.budget if cat and cat.budget and cat.budget > 0 else None
        category_items.append(
            {
                "category_id": cid,
                "name": cat.name if cat else "Unknown",
                "icon": cat.icon if cat else "other",
                "amount": amount,
                "previous": prev_amount,
                "change_pct": _pct_change(amount, prev_amount),
                "budget": budget,
                "over_budget": budget is not None and amount > budget,
            }
        )

    expenses = sorted(
        (t for t in rows if t.type == "expense"), key=lambda t: (-t.amount, t.date, t.id)
    )
    top_expenses = [
        {
            "id": t.id,
            "description": t.description,
            "category_name": t.category.name if t.category else None,
            "amount": t.amount,
            "date": t.date,
        }
        for t in expenses[:5]
    ]

    tag_totals: dict[str, Decimal] = {}
    for t in rows:
        if t.type == "expense":
            for tag in t.tags:
                tag_totals[tag.name] = tag_totals.get(tag.name, ZERO) + t.amount
    tags = [
        {"name": name, "amount": amount}
        for name, amount in sorted(tag_totals.items(), key=lambda kv: (-kv[1], kv[0]))[:10]
    ]

    return {
        "year": year,
        "month": month,
        "current": current,
        "previous": previous,
        "income_change_pct": _pct_change(current["income"], previous["income"]),
        "expense_change_pct": _pct_change(current["expense"], previous["expense"]),
        "transaction_count": sum(1 for t in rows if t.type != "transfer"),
        "avg_daily_expense": avg_daily_expense,
        "categories": category_items,
        "top_expenses": top_expenses,
        "tags": tags,
    }
