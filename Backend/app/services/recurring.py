from datetime import date

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.constants import MAX_CATCH_UP_OCCURRENCES
from app.models.recurring import PendingApproval, RecurringRule
from app.models.transaction import Transaction

_STEP = {
    "Daily": relativedelta(days=1),
    "Weekly": relativedelta(weeks=1),
    "Monthly": relativedelta(months=1),
    "Yearly": relativedelta(years=1),
}


def advance_date(d: date, frequency: str) -> date:
    step = _STEP.get(frequency)
    if step is None:
        raise ValueError(f"Unknown frequency: {frequency}")
    return d + step


def run_catch_up(
    db: Session, user_id: int, today: date | None = None
) -> tuple[list[PendingApproval], int]:
    """Handle every occurrence due up to `today`: auto-approve rules post a
    Transaction directly, the rest get a PendingApproval for the user to review.

    Returns (new pending items, number of transactions posted).

    Idempotent: a rule's `next_due_date` is advanced past `today` as part of
    this call, so calling it again immediately produces nothing new.
    """
    today = today or date.today()
    generated: list[PendingApproval] = []
    posted = 0

    rules = db.query(RecurringRule).filter(RecurringRule.user_id == user_id).all()
    for rule in rules:
        occurrences: list[date] = []
        cursor = rule.next_due_date
        count = 0
        while cursor <= today and count < MAX_CATCH_UP_OCCURRENCES:
            occurrences.append(cursor)
            cursor = advance_date(cursor, rule.frequency)
            count += 1

        for occ_date in occurrences:
            if rule.auto_approve:
                db.add(
                    Transaction(
                        user_id=rule.user_id,
                        type=rule.type,
                        amount=rule.amount,
                        description=rule.description,
                        category_id=rule.category_id,
                        account_id=rule.account_id,
                        transfer_account_id=rule.transfer_account_id,
                        date=occ_date,
                    )
                )
                posted += 1
                continue
            pending = PendingApproval(
                user_id=rule.user_id,
                recurring_rule_id=rule.id,
                description=rule.description,
                amount=rule.amount,
                category_id=rule.category_id,
                account_id=rule.account_id,
                transfer_account_id=rule.transfer_account_id,
                type=rule.type,
                due_date=occ_date,
            )
            db.add(pending)
            generated.append(pending)

        if occurrences:
            rule.next_due_date = cursor

    db.commit()
    for p in generated:
        db.refresh(p)
    return generated, posted


def approve_pending(db: Session, pending: PendingApproval) -> Transaction:
    from app.services.planned import confirm_planned

    return confirm_planned(db, pending)
