from pydantic import BaseModel, Field, field_validator

from app.constants import CATEGORY_ICON_KEYS, CATEGORY_TYPES
from app.money import MoneyField


class CategoryBase(BaseModel):
    name: str = Field(max_length=100)
    type: str
    icon: str = "other"
    budget: MoneyField | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in CATEGORY_TYPES:
            raise ValueError(f"type must be one of {CATEGORY_TYPES}")
        return v

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, v: str) -> str:
        if v not in CATEGORY_ICON_KEYS:
            raise ValueError(f"icon must be one of {CATEGORY_ICON_KEYS}")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        return v

    @field_validator("budget")
    @classmethod
    def validate_budget(cls, v):
        if v is not None and v < 0:
            raise ValueError("budget cannot be negative")
        return v


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    icon: str | None = None
    budget: MoneyField | None = None

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, v: str | None) -> str | None:
        return None if v is None else CategoryBase.validate_icon(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        return None if v is None else CategoryBase.validate_name(v)


class CategoryResponse(BaseModel):
    id: int
    name: str
    type: str
    icon: str
    budget: MoneyField | None

    model_config = {"from_attributes": True}


class CategoryBudgetItem(BaseModel):
    category_id: int
    name: str
    icon: str
    spent: MoneyField
    budget: MoneyField | None
    pct_used: float | None  # null when no budget set


class CategoryBudgetSummary(BaseModel):
    categories: list[CategoryBudgetItem]
    spent_total: MoneyField
    budget_total: MoneyField
    pct: float
    budgeted_count: int
