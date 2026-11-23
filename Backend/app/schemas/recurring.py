from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.constants import CATEGORY_TYPES, FREQUENCIES


def _check_type(v: str) -> str:
    # recurring rules always carry a category, so only income/expense make sense
    if v not in CATEGORY_TYPES:
        raise ValueError(f"type must be one of {CATEGORY_TYPES}")
    return v


def _check_frequency(v: str) -> str:
    if v not in FREQUENCIES:
        raise ValueError(f"frequency must be one of {FREQUENCIES}")
    return v


def _check_amount(v: float) -> float:
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
    amount: float
    category_id: int
    account_id: int
    type: str
    frequency: str

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
    def validate_amount(cls, v: float) -> float:
        return _check_amount(v)

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        return _check_description(v)


class RecurringCreate(RecurringBase):
    start_date: date | None = None


class RecurringUpdate(BaseModel):
    description: str | None = Field(default=None, max_length=500)
    amount: float | None = None
    category_id: int | None = None
    account_id: int | None = None
    type: str | None = None
    frequency: str | None = None
    next_due_date: date | None = None

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
    def validate_amount(cls, v: float | None) -> float | None:
        return None if v is None else _check_amount(v)

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        return None if v is None else _check_description(v)


class RecurringResponse(BaseModel):
    id: int
    description: str
    amount: float
    category_id: int
    category_name: str
    account_id: int
    account_name: str
    type: str
    frequency: str
    next_due_date: date

    model_config = {"from_attributes": True}


class PendingResponse(BaseModel):
    id: int
    recurring_rule_id: int
    description: str
    amount: float
    category_id: int
    category_name: str
    account_id: int
    account_name: str
    type: str
    due_date: date

    model_config = {"from_attributes": True}


class CatchUpResult(BaseModel):
    generated: int
    pending: list[PendingResponse]
