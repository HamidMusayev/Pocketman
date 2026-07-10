from datetime import date

from pydantic import BaseModel, field_validator

from app.constants import FREQUENCIES, TRANSACTION_TYPES


class RecurringBase(BaseModel):
    description: str
    amount: float
    category_id: int
    account_id: int
    type: str
    frequency: str

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in TRANSACTION_TYPES:
            raise ValueError(f"type must be one of {TRANSACTION_TYPES}")
        return v

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        if v not in FREQUENCIES:
            raise ValueError(f"frequency must be one of {FREQUENCIES}")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be greater than 0")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("description cannot be empty")
        return v


class RecurringCreate(RecurringBase):
    start_date: date | None = None


class RecurringUpdate(BaseModel):
    description: str | None = None
    amount: float | None = None
    category_id: int | None = None
    account_id: int | None = None
    type: str | None = None
    frequency: str | None = None
    next_due_date: date | None = None


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
