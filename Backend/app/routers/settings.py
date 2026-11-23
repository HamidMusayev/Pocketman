from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.constants import ACCENT_COLORS
from app.database import get_db
from app.schemas.settings import SettingsResponse, SettingsUpdate
from app.security import get_settings_row

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
def get_settings(row=Depends(get_settings_row)) -> SettingsResponse:
    return SettingsResponse.model_validate(row)


@router.put("", response_model=SettingsResponse)
def update_settings(
    body: SettingsUpdate, db: Session = Depends(get_db), row=Depends(get_settings_row)
) -> SettingsResponse:
    if body.accent_color is not None:
        if body.accent_color not in ACCENT_COLORS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"accent_color must be one of {ACCENT_COLORS}",
            )
        row.accent_color = body.accent_color
    if body.currency_symbol is not None:
        row.currency_symbol = body.currency_symbol
    if body.show_cents is not None:
        row.show_cents = body.show_cents
    db.commit()
    db.refresh(row)
    return SettingsResponse.model_validate(row)
