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


class TopCategoryItem(BaseModel):
    category_id: int
    name: str
    amount: float
    pct: int


class NetWorthAccount(BaseModel):
    id: int
    name: str
    net: float
    transaction_count: int


class NetWorthResponse(BaseModel):
    total: float
    accounts: list[NetWorthAccount]


class StatStripItem(BaseModel):
    label: str
    value: str
    sub: str


class ChartsBundle(BaseModel):
    """Everything the Charts tab needs in a single round trip."""

    summary: SummaryResponse
    trend: list[TrendPoint]
    category_breakdown: list[CategoryBreakdownItem]
    cumulative_balance: list[CumulativePoint]
    top_categories: list[TopCategoryItem]
