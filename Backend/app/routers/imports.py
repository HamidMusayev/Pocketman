from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.money import MoneyField
from app.ratelimit import limiter
from app.security import get_current_user, get_settings_row
from app.services import mmbak

router = APIRouter(prefix="/api/import", tags=["import"])

# parsing a backup is heavy; this is plenty for a person and stops hammering
IMPORT_LIMIT = 20
IMPORT_WINDOW_S = 600


class MmbakSampleRow(BaseModel):
    date: date
    type: str
    amount: MoneyField
    description: str
    account: str
    to_account: str | None
    category: str | None


class MmbakPreview(BaseModel):
    currency_iso: str | None
    currency_symbol: str | None
    date_from: date | None
    date_to: date | None
    income: int
    expense: int
    transfer: int
    adjustments: int
    duplicates: int
    skipped: int
    new_accounts: list[str]
    existing_accounts: list[str]
    new_categories: list[str]
    existing_categories: list[str]
    warnings: list[str]
    sample: list[MmbakSampleRow]


class MmbakResult(BaseModel):
    transactions: int
    adjustments: int
    accounts: int
    categories: int
    duplicates: int
    skipped: int
    currency_symbol: str | None = None


def _read_upload(file: UploadFile, user: User) -> mmbak.MmBackup:
    key = f"mmbak:{user.id}"
    limiter.check(key, IMPORT_LIMIT, IMPORT_WINDOW_S)
    limiter.hit(key)
    cap = settings.MMBAK_MAX_UPLOAD_BYTES
    raw = file.file.read(cap + 1)
    if len(raw) > cap:
        raise HTTPException(
            status_code=413,
            detail=f"File is larger than {cap // (1024 * 1024)} MB",
        )
    if not raw:
        raise HTTPException(status_code=422, detail="The file is empty.")
    try:
        return mmbak.read_backup(raw)
    except mmbak.MmbakError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None


# Plain `def`: FastAPI runs these in a worker thread, so parsing a big backup
# doesn't block the event loop.
@router.post("/mmbak/preview", response_model=MmbakPreview)
def preview_mmbak(
    file: UploadFile, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    """Read a Money Manager backup and report what importing it would do. Writes nothing."""
    backup = _read_upload(file, user)
    return mmbak.preview_dict(mmbak.build_plan(db, user.id, backup))


@router.post("/mmbak", response_model=MmbakResult)
def import_mmbak(
    file: UploadFile,
    use_currency: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    settings_row=Depends(get_settings_row),
) -> dict:
    """Import a Money Manager backup into the signed-in user's data. Rows
    imported before (same backup or an older one) are skipped."""
    backup = _read_upload(file, user)
    plan = mmbak.build_plan(db, user.id, backup)
    symbol = None
    if use_currency and plan.currency_symbol:
        symbol = plan.currency_symbol[:8]
        settings_row.currency_symbol = symbol
    try:
        result = mmbak.apply_plan(db, user.id, plan)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another import is running. Try again in a moment.",
        ) from None
    result["currency_symbol"] = symbol
    return result
