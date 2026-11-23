from datetime import date as Date

from pydantic import BaseModel

from app.money import MoneyField
from app.schemas.transaction import TransactionCreate, TransactionUpdate


class PlannedCreate(TransactionCreate):
    """Same shape as a new transaction; `date` is when it is expected to happen."""


class PlannedUpdate(TransactionUpdate):
    pass


class PlannedConfirm(BaseModel):
    """"Yes, it happened" — optionally with the real amount and date."""

    amount: MoneyField | None = None
    date: Date | None = None


class PlannedPostpone(BaseModel):
    date: Date


class PlannedResponse(BaseModel):
    id: int
    recurring_rule_id: int | None
    # the rule's frequency, so the UI can say "Monthly" next to recurring items
    frequency: str | None
    description: str
    amount: MoneyField
    note: str | None
    tags: list[str]
    category_id: int | None
    category_name: str | None
    account_id: int
    account_name: str
    transfer_account_id: int | None
    transfer_account_name: str | None
    type: str
    due_date: Date


class ForecastResponse(BaseModel):
    today: Date
    end_date: Date
    # all accounts right now (opening balances + every transaction)
    balance: MoneyField
    planned_income: MoneyField
    planned_expense: MoneyField
    expected_balance: MoneyField
    # how many planned items / recurring occurrences the forecast counts
    item_count: int
