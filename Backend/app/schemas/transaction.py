from datetime import date as Date

from pydantic import BaseModel, field_validator, model_validator

from app.constants import TRANSACTION_TYPES


class TransactionBase(BaseModel):
    type: str
    amount: float
    description: str
    category_id: int | None = None
    account_id: int
    transfer_account_id: int | None = None
    date: Date

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in TRANSACTION_TYPES:
            raise ValueError(f"type must be one of {TRANSACTION_TYPES}")
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


class TransactionCreate(TransactionBase):
    @model_validator(mode="after")
    def validate_kind(self) -> "TransactionCreate":
        if self.type == "transfer":
            if self.transfer_account_id is None:
                raise ValueError("transfer requires a transfer_account_id")
            if self.transfer_account_id == self.account_id:
                raise ValueError("transfer source and destination must differ")
            self.category_id = None  # transfers never carry a category
        else:
            if self.category_id is None:
                raise ValueError("income/expense requires a category_id")
            self.transfer_account_id = None
        return self


class TransactionUpdate(BaseModel):
    type: str | None = None
    amount: float | None = None
    description: str | None = None
    category_id: int | None = None
    account_id: int | None = None
    transfer_account_id: int | None = None
    date: Date | None = None


class TransactionResponse(BaseModel):
    id: int
    type: str
    amount: float
    description: str
    category_id: int | None
    category_name: str | None
    account_id: int
    account_name: str
    transfer_account_id: int | None
    transfer_account_name: str | None
    date: Date

    model_config = {"from_attributes": True}


class ImportError_(BaseModel):
    row: int
    reason: str


class ImportResult(BaseModel):
    created: int
    skipped: int
    errors: list[ImportError_]
