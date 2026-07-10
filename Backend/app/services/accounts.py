from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction


def compute_net(db: Session, account_id: int) -> tuple[float, int]:
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
    net = 0.0
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
    has_rule = db.query(RecurringRule).filter(RecurringRule.account_id == account_id).first()
    has_pending = (
        db.query(PendingApproval).filter(PendingApproval.account_id == account_id).first()
    )
    return bool(has_txn or has_rule or has_pending)


def to_response_dict(db: Session, account: Account) -> dict:
    net, count = compute_net(db, account.id)
    return {
        "id": account.id,
        "name": account.name,
        "type": account.type,
        "icon": account.icon,
        "removable": account.removable,
        "net": net,
        "transaction_count": count,
    }
