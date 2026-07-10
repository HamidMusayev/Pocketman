from pydantic import BaseModel, Field


class StatusResponse(BaseModel):
    setup_complete: bool


class SetupRequest(BaseModel):
    # 72 bytes is bcrypt's hard limit
    password: str = Field(min_length=4, max_length=72)


class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=4, max_length=72)
