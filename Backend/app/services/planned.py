"""Planned income/expenses: items that wait for "did it happen?" before they
touch any balance. Stored in the `pending_approvals` table (shared with due
recurring occurrences, which are planned items too)."""

import calendar
from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.recurring import PendingApproval, RecurringRule
from app.models.transaction import Transaction
from app.services.recurring import advance_date
from app.services.transactions import set_tags

ZERO = Decimal("0.00")


def split_tags(raw: str | None) -> list[str]:
    return [t for t in (raw or "").split(",") if t]


def join_tags(tags: list[str]) -> str | None:
    return ",".join(tags) or None


def confirm_planned(
    db: Session,
    item: PendingApproval,
    amount: Decimal | None = None,
    on: date | None = None,
) -> Transaction:
    """Turn a planned item into a real transaction (with the real amount/date
    if they differ from the plan) and remove it from the planned list."""
    txn = Transaction(
        user_id=item.user_id,
        type=item.type,
        amount=amount if amount is not None else item.amount,
        description=item.description,
        note=item.note,
        category_id=item.category_id,
        account_id=item.account_id,
        transfer_account_id=item.transfer_account_id,
        date=on or item.due_date,
    )
    db.add(txn)
    set_tags(db, item.user_id, txn, split_tags(item.tags))
    db.delete(item)
    db.commit()
    db.refresh(txn)
    return txn


def end_of_month(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def current_balance(db: Session, user_id: int) -> Decimal:
    opening = (
        db.query(func.coalesce(func.sum(Account.opening_balance), 0))
        .filter(Account.user_id == user_id)
        .scalar()
    )
    total = Decimal(opening or 0)
    rows = (
        db.query(Transaction.type, Transaction.amount)
        .filter(Transaction.user_id == user_id, Transaction.type.in_(("income", "expense")))
        .all()
    )
    for type_, amount in rows:
        total += amount if type_ == "income" else -amount
    return total


def forecast(db: Session, user_id: int, today: date | None = None) -> dict:
    """Balance now, plus everything planned up to the end of this month:
    planned items (overdue ones too — they are still expected) and upcoming
    occurrences of recurring rules. Transfers stay inside the user's own
    accounts, so they don't change the total."""
    today = today or date.today()
    end = end_of_month(today)
    income = ZERO
    expense = ZERO
    count = 0

    items = (
        db.query(PendingApproval)
        .filter(PendingApproval.user_id == user_id, PendingApproval.due_date <= end)
        .all()
    )
    for p in items:
        if p.type == "income":
            income += p.amount
        elif p.type == "expense":
            expense += p.amount
        else:
            continue
        count += 1

    rules = db.query(RecurringRule).filter(RecurringRule.user_id == user_id).all()
    for rule in rules:
        if rule.type not in ("income", "expense"):
            continue
        cursor = rule.next_due_date
        # occurrences up to today were already turned into transactions or
        # planned items by the catch-up; only count the ones still to come
        while cursor <= end:
            if cursor > today:
                if rule.type == "income":
                    income += rule.amount
                else:
                    expense += rule.amount
                count += 1
            cursor = advance_date(cursor, rule.frequency)

    balance = current_balance(db, user_id)
    return {
        "today": today,
        "end_date": end,
        "balance": balance,
        "planned_income": income,
        "planned_expense": expense,
        "expected_balance": balance + income - expense,
        "item_count": count,
    }
