from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.stats import (
    CategoryBreakdownItem,
    CumulativePoint,
    SummaryResponse,
    TrendPoint,
)
from app.security import require_auth
from app.services.periods import PERIODS
from app.services.stats import (
    get_category_breakdown,
    get_cumulative_balance,
    get_summary,
    get_trend,
)

router = APIRouter(prefix="/api/stats", tags=["stats"], dependencies=[Depends(require_auth)])


def _check_period(period: str) -> None:
    if period not in PERIODS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"period must be one of {PERIODS}")


@router.get("/summary", response_model=SummaryResponse)
def summary(
    period: str = Query("monthly"), year: int | None = None, month: int | None = None,
    db: Session = Depends(get_db),
) -> dict:
    _check_period(period)
    return get_summary(db, period, year, month)


@router.get("/trend", response_model=list[TrendPoint])
def trend(
    months: int = Query(6, ge=1, le=24),
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    today = date.today()
    return get_trend(db, months, year or today.year, month or today.month)


@router.get("/category-breakdown", response_model=list[CategoryBreakdownItem])
def category_breakdown(
    period: str = Query("monthly"),
    year: int | None = None,
    month: int | None = None,
    type: str = Query("expense", pattern="^(income|expense)$"),
    db: Session = Depends(get_db),
) -> list[dict]:
    _check_period(period)
    return get_category_breakdown(db, period, year, month, type)


@router.get("/cumulative-balance", response_model=list[CumulativePoint])
def cumulative_balance(db: Session = Depends(get_db)) -> list[dict]:
    return get_cumulative_balance(db)

