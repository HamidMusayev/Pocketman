from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.recurring import PendingApproval, RecurringRule
from app.models.user import User
from app.ownership import find_owned, get_owned, owned_query
from app.schemas.recurring import (
    CatchUpResult,
    check_rule_kind,
    PendingResponse,
    RecurringCreate,
    RecurringResponse,
    RecurringUpdate,
)
from app.security import get_current_user
from app.services.recurring import approve_pending, run_catch_up

router = APIRouter(prefix="/api/recurring", tags=["recurring"])


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _validate_refs(
    db: Session,
    user_id: int,
    category_id: int | None,
    account_id: int,
    transfer_account_id: int | None = None,
    rule_type: str | None = None,
) -> None:
    """Every ref must belong to the caller (prevents attaching a rule to another user's data)."""
    if category_id is not None:
        category = find_owned(db, Category, category_id, user_id)
        if category is None:
            raise _unprocessable("category_id does not exist")
        if rule_type in ("income", "expense") and category.type != rule_type:
            raise _unprocessable(f"category is a {category.type} category")
    if find_owned(db, Account, account_id, user_id) is None:
        raise _unprocessable("account_id does not exist")
    if transfer_account_id is not None and find_owned(db, Account, transfer_account_id, user_id) is None:
        raise _unprocessable("transfer_account_id does not exist")


def _rule_response(rule: RecurringRule) -> dict:
    return {
        "id": rule.id,
        "description": rule.description,
        "amount": rule.amount,
        "category_id": rule.category_id,
        "category_name": rule.category.name if rule.category else None,
        "account_id": rule.account_id,
        "account_name": rule.account.name if rule.account else "",
        "transfer_account_id": rule.transfer_account_id,
        "transfer_account_name": rule.transfer_account.name if rule.transfer_account else None,
        "type": rule.type,
        "frequency": rule.frequency,
        "next_due_date": rule.next_due_date,
        "auto_approve": rule.auto_approve,
    }


def _pending_response(p: PendingApproval) -> dict:
    return {
        "id": p.id,
        "recurring_rule_id": p.recurring_rule_id,
        "description": p.description,
        "amount": p.amount,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else None,
        "account_id": p.account_id,
        "account_name": p.account.name if p.account else "",
        "transfer_account_id": p.transfer_account_id,
        "transfer_account_name": p.transfer_account.name if p.transfer_account else None,
        "type": p.type,
        "due_date": p.due_date,
    }


def _user_pending(db: Session, user_id: int) -> list[PendingApproval]:
    return owned_query(db, PendingApproval, user_id).order_by(PendingApproval.due_date).all()


@router.get("", response_model=list[RecurringResponse])
def list_recurring(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    rules = owned_query(db, RecurringRule, user.id).order_by(RecurringRule.id).all()
    return [_rule_response(r) for r in rules]


@router.post("", response_model=RecurringResponse, status_code=status.HTTP_201_CREATED)
def create_recurring(
    body: RecurringCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    _validate_refs(
        db, user.id, body.category_id, body.account_id, body.transfer_account_id, body.type
    )
    rule = RecurringRule(
        user_id=user.id,
        description=body.description,
        amount=body.amount,
        category_id=body.category_id,
        account_id=body.account_id,
        transfer_account_id=body.transfer_account_id,
        type=body.type,
        frequency=body.frequency,
        next_due_date=body.start_date or date.today(),
        auto_approve=body.auto_approve,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_response(rule)


@router.put("/{rule_id}", response_model=RecurringResponse)
def update_recurring(
    rule_id: int,
    body: RecurringUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    rule = get_owned(db, RecurringRule, rule_id, user.id, "Recurring rule")
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is None and field not in ("category_id", "transfer_account_id"):
            raise _unprocessable(f"{field} cannot be null")
    for field, value in data.items():
        setattr(rule, field, value)
    # keep the rule coherent for its (possibly changed) type
    if rule.type == "transfer":
        rule.category_id = None
    else:
        rule.transfer_account_id = None
    try:
        check_rule_kind(rule.type, rule.category_id, rule.account_id, rule.transfer_account_id)
    except ValueError as exc:
        raise _unprocessable(str(exc)) from None
    _validate_refs(
        db, user.id, rule.category_id, rule.account_id, rule.transfer_account_id, rule.type
    )
    db.commit()
    db.refresh(rule)
    return _rule_response(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring(
    rule_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    rule = get_owned(db, RecurringRule, rule_id, user.id, "Recurring rule")
    db.delete(rule)
    db.commit()


@router.post("/catch-up", response_model=CatchUpResult)
def catch_up(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    generated, posted = run_catch_up(db, user.id)
    return {
        "generated": len(generated),
        "posted": posted,
        "pending": [_pending_response(p) for p in _user_pending(db, user.id)],
    }


@router.get("/pending", response_model=list[PendingResponse])
def list_pending(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    # Automatic catch-up: whatever came due since the last visit is generated
    # (or, for auto-approve rules, posted) before the list is returned, so the
    # user never has to remember to press "Catch up".
    run_catch_up(db, user.id)
    return [_pending_response(p) for p in _user_pending(db, user.id)]


@router.post("/pending/{pending_id}/approve", status_code=status.HTTP_201_CREATED)
def approve(
    pending_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    pending = get_owned(db, PendingApproval, pending_id, user.id, "Pending item")
    txn = approve_pending(db, pending)
    return {"id": txn.id}


@router.delete("/pending/{pending_id}", status_code=status.HTTP_204_NO_CONTENT)
def dismiss(
    pending_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    pending = get_owned(db, PendingApproval, pending_id, user.id, "Pending item")
    db.delete(pending)
    db.commit()
