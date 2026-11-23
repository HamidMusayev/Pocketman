from pydantic import BaseModel, Field, field_validator

from app.validation import validate_password, validate_username


class StatusResponse(BaseModel):
    registration_enabled: bool


class RegisterRequest(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=256)

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        return validate_username(v)

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password(v)


class LoginRequest(BaseModel):
    # Deliberately not checked against the sign-up rules: the migrated owner
    # account may still have an older, shorter password.
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    token: str
    username: str


class MeResponse(BaseModel):
    id: int
    username: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=256)
    new_password: str = Field(max_length=256)

    @field_validator("new_password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password(v)


class ChangeUsernameRequest(BaseModel):
    new_username: str = Field(max_length=64)
    password: str = Field(max_length=256)

    @field_validator("new_username")
    @classmethod
    def _username(cls, v: str) -> str:
        return validate_username(v)
