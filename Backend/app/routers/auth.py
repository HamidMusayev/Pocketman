from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import Settings as SettingsModel
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    SetupRequest,
    StatusResponse,
    TokenResponse,
)
from app.security import create_access_token, hash_password, require_auth, verify_password
from app.seed import seed_defaults

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status", response_model=StatusResponse)
def get_status(db: Session = Depends(get_db)) -> StatusResponse:
    row = db.query(SettingsModel).filter(SettingsModel.id == 1).first()
    return StatusResponse(setup_complete=bool(row and row.setup_complete))


@router.post("/setup", response_model=TokenResponse)
def setup(body: SetupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    row = db.query(SettingsModel).filter(SettingsModel.id == 1).first()
    if row and row.setup_complete:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already set up")

    if row is None:
        row = SettingsModel(id=1, password_hash=hash_password(body.password), setup_complete=True)
        db.add(row)
    else:
        row.password_hash = hash_password(body.password)
        row.setup_complete = True

    db.commit()
    seed_defaults(db)
    return TokenResponse(token=create_access_token())


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    row = db.query(SettingsModel).filter(SettingsModel.id == 1).first()
    if row is None or not row.setup_complete:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="App not set up yet")
    if not verify_password(body.password, row.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")
    return TokenResponse(token=create_access_token())


@router.post("/change-password", dependencies=[Depends(require_auth)])
def change_password(body: ChangePasswordRequest, db: Session = Depends(get_db)) -> dict:
    row = db.query(SettingsModel).filter(SettingsModel.id == 1).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="App not set up yet")
    if not verify_password(body.current_password, row.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect"
        )
    row.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
