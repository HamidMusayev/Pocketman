from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.ownership import find_owned, get_owned
from app.schemas.transaction import (
    ImportResult,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from app.security import get_current_user
from app.services.transactions import export_csv, import_csv, query_transactions, to_response_dict

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _validate_refs(
    db: Session,
    user_id: int,
    category_id: int | None = None,
    account_id: int | None = None,
    transfer_account_id: int | None = None,
    txn_type: str | None = None,
) -> None:
    """Every referenced id must exist AND belong to the caller — otherwise a
    user could attach their transaction to someone else's account/category."""
    if category_id is not None:
        category = find_owned(db, Category, category_id, user_id)
        if category is None:
            raise _unprocessable("category_id does not exist")
        if txn_type in ("income", "expense") and category.type != txn_type:
            raise _unprocessable(f"category is a {category.type} category")
    if account_id is not None and find_owned(db, Account, account_id, user_id) is None:
        raise _unprocessable("account_id does not exist")
    if transfer_account_id is not None and find_owned(db, Account, transfer_account_id, user_id) is None:
        raise _unprocessable("transfer_account_id does not exist")


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    period: str = Query("all", pattern="^(monthly|all|range)$"),
    year: int | None = None,
    month: int | None = None,
    search: str | None = Query(None, max_length=200),
    category_id: int | None = None,
    account_id: int | None = None,
    type: str | None = Query(None, pattern="^(income|expense|transfer)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    txns = query_transactions(
        db, user.id, period=period, year=year, month=month, search=search,
        category_id=category_id, account_id=account_id, type_=type,
    )
    return [to_response_dict(t) for t in txns]


@router.get("/export")
def export_transactions(
    period: str = Query("all", pattern="^(monthly|all|range)$"),
    year: int | None = None,
    month: int | None = None,
    search: str | None = Query(None, max_length=200),
    category_id: int | None = None,
    account_id: int | None = None,
    type: str | None = Query(None, pattern="^(income|expense|transfer)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    txns = query_transactions(
        db, user.id, period=period, year=year, month=month, search=search,
        category_id=category_id, account_id=account_id, type_=type,
    )
    csv_text = export_csv(txns)
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pocketman-transactions.csv"},
    )


@router.post("/import", response_model=ImportResult)
async def import_transactions(
    file: UploadFile, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    raw = await file.read(settings.MAX_IMPORT_BYTES + 1)
    if len(raw) > settings.MAX_IMPORT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File is larger than {settings.MAX_IMPORT_BYTES // (1024 * 1024)} MB",
        )
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be UTF-8 encoded CSV") from None
    return import_csv(db, user.id, content)


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    body: TransactionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    # cross-field rules (transfer needs a destination, income/expense need a
    # category) are enforced by the schema; here we check the refs are the caller's.
    _validate_refs(
        db,
        user.id,
        category_id=body.category_id,
        account_id=body.account_id,
        transfer_account_id=body.transfer_account_id,
        txn_type=body.type,
    )
    txn = Transaction(**body.model_dump(), user_id=user.id)
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return to_response_dict(txn)


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    body: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    txn = get_owned(db, Transaction, transaction_id, user.id, "Transaction")
    data = body.model_dump(exclude_unset=True)
    for required in ("type", "amount", "description", "account_id", "date"):
        if required in data and data[required] is None:
            raise _unprocessable(f"{required} cannot be null")
    if "amount" in data and data["amount"] <= 0:
        raise _unprocessable("amount must be greater than 0")
    for field, value in data.items():
        setattr(txn, field, value)

    # keep the row coherent for its (possibly changed) type
    if txn.type == "transfer":
        if txn.transfer_account_id is None:
            raise _unprocessable("transfer requires a transfer_account_id")
        if txn.transfer_account_id == txn.account_id:
            raise _unprocessable("transfer source and destination must differ")
        txn.category_id = None
    else:
        txn.transfer_account_id = None
        if txn.category_id is None:
            raise _unprocessable("income/expense requires a category_id")

    # validate the final state, so even refs that weren't changed are checked
    _validate_refs(
        db,
        user.id,
        category_id=txn.category_id,
        account_id=txn.account_id,
        transfer_account_id=txn.transfer_account_id,
        txn_type=txn.type,
    )

    db.commit()
    db.refresh(txn)
    return to_response_dict(txn)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    txn = get_owned(db, Transaction, transaction_id, user.id, "Transaction")
    db.delete(txn)
    db.commit()
