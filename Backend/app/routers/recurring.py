from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.recurring import PendingApproval, RecurringRule
from app.schemas.recurring import (
    CatchUpResult,
    PendingResponse,
    RecurringCreate,
    RecurringResponse,
    RecurringUpdate,
)
from app.security import require_auth
from app.services.recurring import approve_pending, run_catch_up

router = APIRouter(
    prefix="/api/recurring", tags=["recurring"], dependencies=[Depends(require_auth)]
)


def _validate_refs(db: Session, category_id: int, account_id: int) -> None:
    if not db.get(Category, category_id):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="category_id does not exist")
    if not db.get(Account, account_id):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="account_id does not exist")


def _rule_response(rule: RecurringRule) -> dict:
    return {
        "id": rule.id,
        "description": rule.description,
        "amount": rule.amount,
        "category_id": rule.category_id,
        "category_name": rule.category.name if rule.category else "",
        "account_id": rule.account_id,
        "account_name": rule.account.name if rule.account else "",
        "type": rule.type,
        "frequency": rule.frequency,
        "next_due_date": rule.next_due_date,
    }


def _pending_response(p: PendingApproval) -> dict:
    return {
        "id": p.id,
        "recurring_rule_id": p.recurring_rule_id,
        "description": p.description,
        "amount": p.amount,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else "",
        "account_id": p.account_id,
        "account_name": p.account.name if p.account else "",
        "type": p.type,
        "due_date": p.due_date,
    }


@router.get("", response_model=list[RecurringResponse])
def list_recurring(db: Session = Depends(get_db)) -> list[dict]:
    rules = db.query(RecurringRule).order_by(RecurringRule.id).all()
    return [_rule_response(r) for r in rules]


@router.post("", response_model=RecurringResponse, status_code=status.HTTP_201_CREATED)
def create_recurring(body: RecurringCreate, db: Session = Depends(get_db)) -> dict:
    _validate_refs(db, body.category_id, body.account_id)
    rule = RecurringRule(
        description=body.description,
        amount=body.amount,
        category_id=body.category_id,
        account_id=body.account_id,
        type=body.type,
        frequency=body.frequency,
        next_due_date=body.start_date or date.today(),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_response(rule)


@router.put("/{rule_id}", response_model=RecurringResponse)
def update_recurring(rule_id: int, body: RecurringUpdate, db: Session = Depends(get_db)) -> dict:
    rule = db.get(RecurringRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring rule not found")
    data = body.model_dump(exclude_unset=True)
    if "category_id" in data or "account_id" in data:
        _validate_refs(db, data.get("category_id", rule.category_id), data.get("account_id", rule.account_id))
    for field, value in data.items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return _rule_response(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring(rule_id: int, db: Session = Depends(get_db)) -> None:
    rule = db.get(RecurringRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring rule not found")
    db.delete(rule)
    db.commit()


@router.post("/catch-up", response_model=CatchUpResult)
def catch_up(db: Session = Depends(get_db)) -> dict:
    generated = run_catch_up(db)
    all_pending = db.query(PendingApproval).order_by(PendingApproval.due_date).all()
    return {"generated": len(generated), "pending": [_pending_response(p) for p in all_pending]}


@router.get("/pending", response_model=list[PendingResponse])
def list_pending(db: Session = Depends(get_db)) -> list[dict]:
    pending = db.query(PendingApproval).order_by(PendingApproval.due_date).all()
    return [_pending_response(p) for p in pending]


@router.post("/pending/{pending_id}/approve", status_code=status.HTTP_201_CREATED)
def approve(pending_id: int, db: Session = Depends(get_db)) -> dict:
    pending = db.get(PendingApproval, pending_id)
    if pending is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending item not found")
    txn = approve_pending(db, pending)
    return {"id": txn.id}


@router.delete("/pending/{pending_id}", status_code=status.HTTP_204_NO_CONTENT)
def dismiss(pending_id: int, db: Session = Depends(get_db)) -> None:
    pending = db.get(PendingApproval, pending_id)
    if pending is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending item not found")
    db.delete(pending)
    db.commit()
