from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.transaction import (
    ImportResult,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from app.security import require_auth
from app.services.transactions import export_csv, import_csv, query_transactions, to_response_dict

router = APIRouter(
    prefix="/api/transactions", tags=["transactions"], dependencies=[Depends(require_auth)]
)


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _validate_refs(
    db: Session,
    category_id: int | None = None,
    account_id: int | None = None,
    transfer_account_id: int | None = None,
) -> None:
    if category_id is not None and not db.get(Category, category_id):
        raise _unprocessable("category_id does not exist")
    if account_id is not None and not db.get(Account, account_id):
        raise _unprocessable("account_id does not exist")
    if transfer_account_id is not None and not db.get(Account, transfer_account_id):
        raise _unprocessable("transfer_account_id does not exist")


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    period: str = Query("all", pattern="^(monthly|all|range)$"),
    year: int | None = None,
    month: int | None = None,
    search: str | None = None,
    category_id: int | None = None,
    account_id: int | None = None,
    type: str | None = Query(None, pattern="^(income|expense|transfer)$"),
    db: Session = Depends(get_db),
) -> list[dict]:
    txns = query_transactions(
        db, period=period, year=year, month=month, search=search,
        category_id=category_id, account_id=account_id, type_=type,
    )
    return [to_response_dict(t) for t in txns]


@router.get("/export")
def export_transactions(
    period: str = Query("all", pattern="^(monthly|all|range)$"),
    year: int | None = None,
    month: int | None = None,
    search: str | None = None,
    category_id: int | None = None,
    account_id: int | None = None,
    type: str | None = Query(None, pattern="^(income|expense|transfer)$"),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    txns = query_transactions(
        db, period=period, year=year, month=month, search=search,
        category_id=category_id, account_id=account_id, type_=type,
    )
    csv_text = export_csv(txns)
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pocketman-transactions.csv"},
    )


@router.post("/import", response_model=ImportResult)
async def import_transactions(file: UploadFile, db: Session = Depends(get_db)) -> dict:
    raw = await file.read()
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be UTF-8 encoded CSV") from None
    return import_csv(db, content)


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db)) -> dict:
    # cross-field rules (transfer needs a destination, income/expense need a
    # category) are enforced by the schema; here we only check the refs exist.
    _validate_refs(
        db,
        category_id=body.category_id,
        account_id=body.account_id,
        transfer_account_id=body.transfer_account_id,
    )
    txn = Transaction(**body.model_dump())
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return to_response_dict(txn)


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int, body: TransactionUpdate, db: Session = Depends(get_db)
) -> dict:
    txn = db.get(Transaction, transaction_id)
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    data = body.model_dump(exclude_unset=True)
    _validate_refs(
        db,
        category_id=data.get("category_id"),
        account_id=data.get("account_id"),
        transfer_account_id=data.get("transfer_account_id"),
    )
    if "amount" in data and data["amount"] is not None and data["amount"] <= 0:
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

    db.commit()
    db.refresh(txn)
    return to_response_dict(txn)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)) -> None:
    txn = db.get(Transaction, transaction_id)
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    db.delete(txn)
    db.commit()
