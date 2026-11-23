from decimal import Decimal

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction


def compute_net(db: Session, account_id: int) -> tuple[Decimal, int]:
    """Signed balance of an account. Income adds, expense subtracts, an outgoing
    transfer (this account is the source) subtracts, and an incoming transfer
    (this account is the destination) adds. transaction_count includes both
    outgoing rows and incoming transfers so the account reflects all activity."""
    outgoing = (
        db.query(Transaction.type, Transaction.amount)
        .filter(Transaction.account_id == account_id)
        .all()
    )
    incoming = (
        db.query(Transaction.amount)
        .filter(Transaction.type == "transfer", Transaction.transfer_account_id == account_id)
        .all()
    )
    net = Decimal("0.00")
    for type_, amount in outgoing:
        if type_ == "income":
            net += amount
        else:  # expense or outgoing transfer
            net -= amount
    for (amount,) in incoming:
        net += amount
    return net, len(outgoing) + len(incoming)


def account_in_use(db: Session, account_id: int) -> bool:
    from app.models.recurring import PendingApproval, RecurringRule

    has_txn = (
        db.query(Transaction)
        .filter(
            or_(
                Transaction.account_id == account_id,
                Transaction.transfer_account_id == account_id,
            )
        )
        .first()
    )
    has_rule = (
        db.query(RecurringRule)
        .filter(
            or_(
                RecurringRule.account_id == account_id,
                RecurringRule.transfer_account_id == account_id,
            )
        )
        .first()
    )
    has_pending = (
        db.query(PendingApproval)
        .filter(
            or_(
                PendingApproval.account_id == account_id,
                PendingApproval.transfer_account_id == account_id,
            )
        )
        .first()
    )
    return bool(has_txn or has_rule or has_pending)


def to_response_dict(db: Session, account: Account) -> dict:
    net, count = compute_net(db, account.id)
    opening = account.opening_balance or Decimal("0.00")
    return {
        "id": account.id,
        "name": account.name,
        "type": account.type,
        "icon": account.icon,
        "removable": account.removable,
        "opening_balance": opening,
        # `net` is the current balance: opening balance + all activity
        "net": opening + net,
        "transaction_count": count,
    }


def move_account_history(db: Session, source: Account, target: Account) -> None:
    """Hand everything recorded on `source` over to `target`: transactions,
    recurring rules, pending approvals and the starting balance. Transfers
    between the two would become transfers from an account to itself, which
    mean nothing, so those are dropped. Does not commit."""
    from app.models.recurring import PendingApproval, RecurringRule

    for model in (Transaction, RecurringRule, PendingApproval):
        rows = (
            db.query(model)
            .filter(or_(model.account_id == source.id, model.transfer_account_id == source.id))
            .all()
        )
        for row in rows:
            if row.account_id == source.id:
                row.account_id = target.id
            if row.transfer_account_id == source.id:
                row.transfer_account_id = target.id
            if row.transfer_account_id is not None and row.transfer_account_id == row.account_id:
                db.delete(row)
        db.flush()

    target.opening_balance = (target.opening_balance or 0) + (source.opening_balance or 0)
    db.flush()
