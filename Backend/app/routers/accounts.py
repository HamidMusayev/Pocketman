from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.user import User
from app.ownership import get_owned, owned_query
from app.schemas.account import AccountCreate, AccountResponse, AccountUpdate
from app.security import get_current_user
from app.services.accounts import account_in_use, to_response_dict

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


def _name_taken(db: Session, user_id: int, name: str, exclude_id: int | None = None) -> bool:
    q = owned_query(db, Account, user_id).filter(Account.name == name)
    if exclude_id is not None:
        q = q.filter(Account.id != exclude_id)
    return q.first() is not None


@router.get("", response_model=list[AccountResponse])
def list_accounts(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    accounts = owned_query(db, Account, user.id).order_by(Account.id).all()
    return [to_response_dict(db, a) for a in accounts]


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    body: AccountCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    if _name_taken(db, user.id, body.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account name already exists")
    account = Account(user_id=user.id, name=body.name, type=body.type, icon=body.icon, removable=True)
    db.add(account)
    db.commit()
    db.refresh(account)
    return to_response_dict(db, account)


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    body: AccountUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    account = get_owned(db, Account, account_id, user.id, "Account")
    if body.name is not None:
        if _name_taken(db, user.id, body.name, exclude_id=account_id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account name already exists")
        account.name = body.name
    if body.type is not None:
        account.type = body.type
    if body.icon is not None:
        account.icon = body.icon
    db.commit()
    db.refresh(account)
    return to_response_dict(db, account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    account = get_owned(db, Account, account_id, user.id, "Account")
    if not account.removable:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This account cannot be removed")
    if owned_query(db, Account, user.id).count() <= 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot remove the last account")
    if account_in_use(db, account_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account has transactions or recurring rules and cannot be removed",
        )
    db.delete(account)
    db.commit()
