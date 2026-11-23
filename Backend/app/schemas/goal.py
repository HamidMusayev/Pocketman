from datetime import date as Date
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.constants import GOAL_ICON_KEYS
from app.money import MoneyField


def _check_name(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("name cannot be empty")
    return v


def _check_icon(v: str) -> str:
    if v not in GOAL_ICON_KEYS:
        raise ValueError(f"icon must be one of {GOAL_ICON_KEYS}")
    return v


def _check_target(v: Decimal) -> Decimal:
    if v <= 0:
        raise ValueError("target must be greater than 0")
    return v


def _check_saved(v: Decimal) -> Decimal:
    if v < 0:
        raise ValueError("saved amount cannot be negative")
    return v


class GoalCreate(BaseModel):
    name: str = Field(max_length=100)
    target_amount: MoneyField
    saved_amount: MoneyField = Decimal("0.00")
    target_date: Date | None = None
    icon: str = "target"

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _check_name(v)

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, v: str) -> str:
        return _check_icon(v)

    @field_validator("target_amount")
    @classmethod
    def validate_target(cls, v: Decimal) -> Decimal:
        return _check_target(v)

    @field_validator("saved_amount")
    @classmethod
    def validate_saved(cls, v: Decimal) -> Decimal:
        return _check_saved(v)


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    target_amount: MoneyField | None = None
    saved_amount: MoneyField | None = None
    target_date: Date | None = None
    icon: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        return None if v is None else _check_name(v)

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, v: str | None) -> str | None:
        return None if v is None else _check_icon(v)

    @field_validator("target_amount")
    @classmethod
    def validate_target(cls, v: Decimal | None) -> Decimal | None:
        return None if v is None else _check_target(v)

    @field_validator("saved_amount")
    @classmethod
    def validate_saved(cls, v: Decimal | None) -> Decimal | None:
        return None if v is None else _check_saved(v)


class GoalContribution(BaseModel):
    """Positive adds money to the goal, negative takes it out."""

    amount: MoneyField

    @field_validator("amount")
    @classmethod
    def non_zero(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("amount cannot be 0")
        return v


class GoalResponse(BaseModel):
    id: int
    name: str
    icon: str
    target_amount: MoneyField
    saved_amount: MoneyField
    remaining: MoneyField
    pct: int
    target_date: Date | None
    months_left: int | None
    # how much to put aside each month to hit the target on time
    monthly_needed: MoneyField | None
    completed: bool
