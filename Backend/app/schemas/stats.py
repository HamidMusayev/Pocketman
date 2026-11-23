from datetime import date as Date

from pydantic import BaseModel

from app.money import MoneyField


class SummaryResponse(BaseModel):
    income: MoneyField
    expense: MoneyField
    balance: MoneyField
    savings_rate: int


class TrendPoint(BaseModel):
    label: str
    year: int
    month: int
    income: MoneyField
    expense: MoneyField


class CategoryBreakdownItem(BaseModel):
    category_id: int
    name: str
    amount: MoneyField
    pct: int


class CumulativePoint(BaseModel):
    date: Date
    balance: MoneyField



class ReportCategory(BaseModel):
    category_id: int
    name: str
    icon: str
    amount: MoneyField
    previous: MoneyField
    change_pct: int | None
    budget: MoneyField | None
    over_budget: bool


class ReportExpense(BaseModel):
    id: int
    description: str
    category_name: str | None
    amount: MoneyField
    date: Date


class ReportTag(BaseModel):
    name: str
    amount: MoneyField


class MonthlyReport(BaseModel):
    year: int
    month: int
    current: SummaryResponse
    previous: SummaryResponse
    income_change_pct: int | None
    expense_change_pct: int | None
    transaction_count: int
    avg_daily_expense: MoneyField
    categories: list[ReportCategory]
    top_expenses: list[ReportExpense]
    tags: list[ReportTag]
