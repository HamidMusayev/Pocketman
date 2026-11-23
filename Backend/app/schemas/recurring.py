from datetime import date

from pydantic import BaseModel, Field, field_validator, model_validator

from app.constants import FREQUENCIES, TRANSACTION_TYPES
from app.money import MoneyField


def _check_type(v: str) -> str:
    # income/expense rules carry a category; transfer rules carry a destination
    if v not in TRANSACTION_TYPES:
        raise ValueError(f"type must be one of {TRANSACTION_TYPES}")
    return v


def _check_frequency(v: str) -> str:
    if v not in FREQUENCIES:
        raise ValueError(f"frequency must be one of {FREQUENCIES}")
    return v


def _check_amount(v):
    if v <= 0:
        raise ValueError("amount must be greater than 0")
    return v


def _check_description(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("description cannot be empty")
    return v


class RecurringBase(BaseModel):
    description: str = Field(max_length=500)
    amount: MoneyField
    category_id: int | None = None
    account_id: int
    transfer_account_id: int | None = None
    type: str
    frequency: str
    auto_approve: bool = False

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        return _check_type(v)

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        return _check_frequency(v)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        return _check_amount(v)

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        return _check_description(v)


class RecurringCreate(RecurringBase):
    start_date: date | None = None

    @model_validator(mode="after")
    def validate_kind(self) -> "RecurringCreate":
        check_rule_kind(self.type, self.category_id, self.account_id, self.transfer_account_id)
        if self.type == "transfer":
            self.category_id = None
        else:
            self.transfer_account_id = None
        return self


def check_rule_kind(
    type_: str, category_id: int | None, account_id: int | None, transfer_account_id: int | None
) -> None:
    if type_ == "transfer":
        if transfer_account_id is None:
            raise ValueError("transfer requires a transfer_account_id")
        if transfer_account_id == account_id:
            raise ValueError("transfer source and destination must differ")
    elif category_id is None:
        raise ValueError("income/expense requires a category_id")


class RecurringUpdate(BaseModel):
    description: str | None = Field(default=None, max_length=500)
    amount: MoneyField | None = None
    category_id: int | None = None
    account_id: int | None = None
    transfer_account_id: int | None = None
    type: str | None = None
    frequency: str | None = None
    next_due_date: date | None = None
    auto_approve: bool | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        return None if v is None else _check_type(v)

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, v: str | None) -> str | None:
        return None if v is None else _check_frequency(v)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        return None if v is None else _check_amount(v)

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        return None if v is None else _check_description(v)


class RecurringResponse(BaseModel):
    id: int
    description: str
    amount: MoneyField
    category_id: int | None
    category_name: str | None
    account_id: int
    account_name: str
    transfer_account_id: int | None
    transfer_account_name: str | None
    type: str
    frequency: str
    next_due_date: date
    auto_approve: bool

    model_config = {"from_attributes": True}


class PendingResponse(BaseModel):
    id: int
    recurring_rule_id: int
    description: str
    amount: MoneyField
    category_id: int | None
    category_name: str | None
    account_id: int
    account_name: str
    transfer_account_id: int | None
    transfer_account_name: str | None
    type: str
    due_date: date

    model_config = {"from_attributes": True}


class CatchUpResult(BaseModel):
    generated: int
    # occurrences of auto-approve rules that were posted straight to transactions
    posted: int = 0
    pending: list[PendingResponse]
