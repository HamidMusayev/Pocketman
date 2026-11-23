from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tag import Tag
from app.models.transaction import Transaction, transaction_tags
from app.models.user import User
from app.money import ZERO, MoneyField
from app.ownership import get_owned
from app.security import get_current_user

router = APIRouter(prefix="/api/tags", tags=["tags"])


class TagResponse(BaseModel):
    id: int
    name: str
    count: int
    income: MoneyField
    expense: MoneyField


@router.get("", response_model=list[TagResponse])
def list_tags(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    """Every tag with how many transactions carry it and their income/expense totals."""
    tags = db.query(Tag).filter(Tag.user_id == user.id).order_by(Tag.name).all()
    if not tags:
        return []
    amount = Transaction.amount  # Money type: sums come back as Decimal
    rows = (
        db.query(
            transaction_tags.c.tag_id,
            func.count(Transaction.id),
            func.sum(case((Transaction.type == "income", amount), else_=0)),
            func.sum(case((Transaction.type == "expense", amount), else_=0)),
        )
        .join(Transaction, Transaction.id == transaction_tags.c.transaction_id)
        .filter(Transaction.user_id == user.id)
        .group_by(transaction_tags.c.tag_id)
        .all()
    )
    stats = {tag_id: (count, inc, exp) for tag_id, count, inc, exp in rows}
    result = []
    for t in tags:
        count, inc, exp = stats.get(t.id, (0, None, None))
        result.append(
            {
                "id": t.id,
                "name": t.name,
                "count": count,
                "income": inc or ZERO,
                "expense": exp or ZERO,
            }
        )
    return result


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    """Removes the tag from every transaction (the transactions stay)."""
    tag = get_owned(db, Tag, tag_id, user.id, "Tag")
    tag.transactions = []
    db.delete(tag)
    db.commit()
