from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.recurring import PendingApproval
from app.models.user import User
from app.ownership import get_owned, owned_query
from app.routers.transactions import _validate_refs
from app.schemas.planned import (
    ForecastResponse,
    PlannedConfirm,
    PlannedCreate,
    PlannedPostpone,
    PlannedResponse,
    PlannedUpdate,
)
from app.security import get_current_user
from app.services.planned import confirm_planned, forecast, join_tags, split_tags
from app.services.recurring import run_catch_up

router = APIRouter(prefix="/api/planned", tags=["planned"])


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def to_response(p: PendingApproval) -> dict:
    return {
        "id": p.id,
        "recurring_rule_id": p.recurring_rule_id,
        "frequency": p.rule.frequency if p.rule else None,
        "description": p.description,
        "amount": p.amount,
        "note": p.note,
        "tags": split_tags(p.tags),
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else None,
        "account_id": p.account_id,
        "account_name": p.account.name if p.account else "",
        "transfer_account_id": p.transfer_account_id,
        "transfer_account_name": p.transfer_account.name if p.transfer_account else None,
        "type": p.type,
        "due_date": p.due_date,
    }


@router.get("", response_model=list[PlannedResponse])
def list_planned(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    """Every planned item, soonest first. Items due today or earlier are the
    ones the app asks about; later ones are just upcoming. Recurring rules are
    caught up first so their due occurrences are in the list."""
    run_catch_up(db, user.id)
    items = (
        owned_query(db, PendingApproval, user.id)
        .order_by(PendingApproval.due_date, PendingApproval.id)
        .all()
    )
    return [to_response(p) for p in items]


@router.get("/forecast", response_model=ForecastResponse)
def get_forecast(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    run_catch_up(db, user.id)
    return forecast(db, user.id)


@router.post("", response_model=PlannedResponse, status_code=status.HTTP_201_CREATED)
def create_planned(
    body: PlannedCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    _validate_refs(
        db, user.id,
        category_id=body.category_id,
        account_id=body.account_id,
        transfer_account_id=body.transfer_account_id,
        txn_type=body.type,
    )
    item = PendingApproval(
        user_id=user.id,
        recurring_rule_id=None,
        type=body.type,
        amount=body.amount,
        description=body.description,
        note=body.note,
        tags=join_tags(body.tags),
        category_id=body.category_id,
        account_id=body.account_id,
        transfer_account_id=body.transfer_account_id,
        due_date=body.date,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return to_response(item)


@router.put("/{item_id}", response_model=PlannedResponse)
def update_planned(
    item_id: int,
    body: PlannedUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    item = get_owned(db, PendingApproval, item_id, user.id, "Planned item")
    data = body.model_dump(exclude_unset=True)
    for required in ("type", "amount", "description", "account_id", "date", "tags"):
        if required in data and data[required] is None:
            raise _unprocessable(f"{required} cannot be null")
    if "amount" in data and data["amount"] <= 0:
        raise _unprocessable("amount must be greater than 0")
    if "tags" in data:
        item.tags = join_tags(data.pop("tags"))
    if "date" in data:
        item.due_date = data.pop("date")
    for field, value in data.items():
        setattr(item, field, value)

    if item.type == "transfer":
        if item.transfer_account_id is None:
            raise _unprocessable("transfer requires a transfer_account_id")
        if item.transfer_account_id == item.account_id:
            raise _unprocessable("transfer source and destination must differ")
        item.category_id = None
    else:
        item.transfer_account_id = None
        if item.category_id is None:
            raise _unprocessable("income/expense requires a category_id")
    _validate_refs(
        db, user.id,
        category_id=item.category_id,
        account_id=item.account_id,
        transfer_account_id=item.transfer_account_id,
        txn_type=item.type,
    )
    db.commit()
    db.refresh(item)
    return to_response(item)


@router.post("/{item_id}/confirm", status_code=status.HTTP_201_CREATED)
def confirm(
    item_id: int,
    body: PlannedConfirm | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """It happened: post it as a real transaction."""
    item = get_owned(db, PendingApproval, item_id, user.id, "Planned item")
    body = body or PlannedConfirm()
    if body.amount is not None and body.amount <= 0:
        raise _unprocessable("amount must be greater than 0")
    txn = confirm_planned(db, item, body.amount, body.date)
    return {"id": txn.id}


@router.post("/{item_id}/postpone", response_model=PlannedResponse)
def postpone(
    item_id: int,
    body: PlannedPostpone,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """It didn't happen yet: ask again on `date`."""
    item = get_owned(db, PendingApproval, item_id, user.id, "Planned item")
    if body.date < date.today():
        raise _unprocessable("pick today or a later date")
    item.due_date = body.date
    db.commit()
    db.refresh(item)
    return to_response(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_planned(
    item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    item = get_owned(db, PendingApproval, item_id, user.id, "Planned item")
    db.delete(item)
    db.commit()
