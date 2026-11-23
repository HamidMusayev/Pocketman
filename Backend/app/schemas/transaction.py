import re
from datetime import date as Date
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.constants import MAX_TAG_LEN, MAX_TAGS_PER_TRANSACTION, TRANSACTION_TYPES
from app.money import MoneyField

_TAG_RE = re.compile(r"^[\w-]+$", re.UNICODE)


def normalize_tags(tags: list[str]) -> list[str]:
    """'#Travel', ' travel ' and 'TRAVEL' are one tag: 'travel'. Spaces become '-'."""
    seen: list[str] = []
    for raw in tags:
        tag = re.sub(r"\s+", "-", raw.strip().lstrip("#").strip().lower())
        if not tag:
            continue
        if len(tag) > MAX_TAG_LEN:
            raise ValueError(f"tags can be at most {MAX_TAG_LEN} characters")
        if not _TAG_RE.match(tag):
            raise ValueError("tags can only contain letters, digits, '-' and '_'")
        if tag not in seen:
            seen.append(tag)
    if len(seen) > MAX_TAGS_PER_TRANSACTION:
        raise ValueError(f"at most {MAX_TAGS_PER_TRANSACTION} tags per transaction")
    return seen


def _clean_note(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class TransactionBase(BaseModel):
    type: str
    amount: MoneyField
    description: str = Field(max_length=500)
    note: str | None = Field(default=None, max_length=2000)
    tags: list[str] = Field(default_factory=list)
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
    def validate_amount(cls, v: Decimal) -> Decimal:
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

    @field_validator("note")
    @classmethod
    def validate_note(cls, v: str | None) -> str | None:
        return _clean_note(v)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        return normalize_tags(v)


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
    amount: MoneyField | None = None
    description: str | None = Field(default=None, max_length=500)
    note: str | None = Field(default=None, max_length=2000)
    tags: list[str] | None = None
    category_id: int | None = None
    account_id: int | None = None
    transfer_account_id: int | None = None
    date: Date | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        return None if v is None else TransactionBase.validate_type(v)

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        return None if v is None else TransactionBase.validate_description(v)

    @field_validator("note")
    @classmethod
    def validate_note(cls, v: str | None) -> str | None:
        return _clean_note(v)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str] | None) -> list[str] | None:
        return None if v is None else normalize_tags(v)


class TransactionResponse(BaseModel):
    id: int
    type: str
    amount: MoneyField
    description: str
    note: str | None
    tags: list[str]
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
