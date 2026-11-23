from datetime import date as Date

from pydantic import BaseModel


class SummaryResponse(BaseModel):
    income: float
    expense: float
    balance: float
    savings_rate: int


class TrendPoint(BaseModel):
    label: str
    year: int
    month: int
    income: float
    expense: float


class CategoryBreakdownItem(BaseModel):
    category_id: int
    name: str
    amount: float
    pct: int


class CumulativePoint(BaseModel):
    date: Date
    balance: float

