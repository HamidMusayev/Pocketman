from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, status

PERIODS = ("monthly", "all", "range")


def period_bounds(
    period: str,
    year: int | None,
    month: int | None,
    today: date | None = None,
) -> tuple[date | None, date | None]:
    """Return (start, end) inclusive date bounds for a period, or (None, None) for 'all'.

    Mirrors the prototype's `inPeriod()`: monthly = calendar month of (year, month);
    range = last 90 days ending today; all = no bound.
    """
    today = today or date.today()

    if period == "all":
        return None, None

    if period == "monthly":
        if year is None or month is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="year and month are required for period=monthly",
            )
        try:
            start = date(year, month, 1)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="invalid year or month",
            ) from None
        end = start + relativedelta(months=1) - timedelta(days=1)
        return start, end

    if period == "range":
        return today - timedelta(days=90), today

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"period must be one of {PERIODS}",
    )
