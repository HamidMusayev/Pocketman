from pydantic import BaseModel


class SettingsResponse(BaseModel):
    accent_color: str
    currency_symbol: str
    show_cents: bool

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    accent_color: str | None = None
    currency_symbol: str | None = None
    show_cents: bool | None = None
