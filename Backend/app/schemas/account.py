from pydantic import BaseModel, Field, field_validator

from app.constants import ACCOUNT_ICON_KEYS, ACCOUNT_TYPES


class AccountBase(BaseModel):
    name: str = Field(max_length=100)
    type: str = "cash"
    icon: str = "wallet"

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ACCOUNT_TYPES:
            raise ValueError(f"type must be one of {ACCOUNT_TYPES}")
        return v

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, v: str) -> str:
        if v not in ACCOUNT_ICON_KEYS:
            raise ValueError(f"icon must be one of {ACCOUNT_ICON_KEYS}")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        return v


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    type: str | None = None
    icon: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        return None if v is None else AccountBase.validate_type(v)

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, v: str | None) -> str | None:
        return None if v is None else AccountBase.validate_icon(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        return None if v is None else AccountBase.validate_name(v)


class AccountResponse(BaseModel):
    id: int
    name: str
    type: str
    icon: str
    removable: bool
    net: float
    transaction_count: int

    model_config = {"from_attributes": True}
