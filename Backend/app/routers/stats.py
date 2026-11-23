from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.stats import (
    CategoryBreakdownItem,
    CumulativePoint,
    MonthlyReport,
    SummaryResponse,
    TrendPoint,
)
from app.security import get_current_user
from app.services.periods import PERIODS
from app.services.stats import (
    get_category_breakdown,
    get_cumulative_balance,
    get_monthly_report,
    get_summary,
    get_trend,
)

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _check_period(period: str) -> None:
    if period not in PERIODS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"period must be one of {PERIODS}")


@router.get("/summary", response_model=SummaryResponse)
def summary(
    period: str = Query("monthly"), year: int | None = None, month: int | None = None,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
) -> dict:
    _check_period(period)
    return get_summary(db, user.id, period, year, month)


@router.get("/trend", response_model=list[TrendPoint])
def trend(
    months: int = Query(6, ge=1, le=24),
    year: int | None = None,
    month: int | None = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    today = date.today()
    return get_trend(db, user.id, months, year or today.year, month or today.month)


@router.get("/category-breakdown", response_model=list[CategoryBreakdownItem])
def category_breakdown(
    period: str = Query("monthly"),
    year: int | None = None,
    month: int | None = None,
    type: str = Query("expense", pattern="^(income|expense)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    _check_period(period)
    return get_category_breakdown(db, user.id, period, year, month, type)


@router.get("/cumulative-balance", response_model=list[CumulativePoint])
def cumulative_balance(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    return get_cumulative_balance(db, user.id)


@router.get("/monthly-report", response_model=MonthlyReport)
def monthly_report(
    year: int | None = Query(None, ge=1900, le=2999),
    month: int | None = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    today = date.today()
    return get_monthly_report(db, user.id, year or today.year, month or today.month)
