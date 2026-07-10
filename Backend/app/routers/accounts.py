from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountResponse, AccountUpdate
from app.security import require_auth
from app.services.accounts import account_in_use, to_response_dict

router = APIRouter(
    prefix="/api/accounts", tags=["accounts"], dependencies=[Depends(require_auth)]
)


@router.get("", response_model=list[AccountResponse])
def list_accounts(db: Session = Depends(get_db)) -> list[dict]:
    accounts = db.query(Account).order_by(Account.id).all()
    return [to_response_dict(db, a) for a in accounts]


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(body: AccountCreate, db: Session = Depends(get_db)) -> dict:
    if db.query(Account).filter(Account.name == body.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account name already exists")
    account = Account(name=body.name, type=body.type, icon=body.icon, removable=True)
    db.add(account)
    db.commit()
    db.refresh(account)
    return to_response_dict(db, account)


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int, body: AccountUpdate, db: Session = Depends(get_db)
) -> dict:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="name cannot be empty")
        existing = db.query(Account).filter(Account.name == name, Account.id != account_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account name already exists")
        account.name = name
    if body.type is not None:
        account.type = body.type
    if body.icon is not None:
        account.icon = body.icon
    db.commit()
    db.refresh(account)
    return to_response_dict(db, account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: int, db: Session = Depends(get_db)) -> None:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if not account.removable:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This account cannot be removed")
    total_accounts = db.query(Account).count()
    if total_accounts <= 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot remove the last account")
    if account_in_use(db, account_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account has transactions or recurring rules and cannot be removed",
        )
    db.delete(account)
    db.commit()
