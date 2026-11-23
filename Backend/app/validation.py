"""Username / password rules. Mirrored in Front/src/auth/validation.ts."""

import re

USERNAME_MIN = 6
USERNAME_MAX = 32
PASSWORD_MIN = 8
PASSWORD_MAX_BYTES = 72  # bcrypt's hard limit

_USERNAME_RE = re.compile(r"^[a-z0-9_]+$")


def validate_username(v: str) -> str:
    if len(v) < USERNAME_MIN:
        raise ValueError(f"Username must be at least {USERNAME_MIN} characters")
    if len(v) > USERNAME_MAX:
        raise ValueError(f"Username must be at most {USERNAME_MAX} characters")
    if not _USERNAME_RE.match(v):
        raise ValueError("Username may only contain lowercase letters, digits and _")
    return v


def validate_password(v: str) -> str:
    if len(v) < PASSWORD_MIN:
        raise ValueError(f"Password must be at least {PASSWORD_MIN} characters")
    if len(v.encode("utf-8")) > PASSWORD_MAX_BYTES:
        raise ValueError(f"Password must be at most {PASSWORD_MAX_BYTES} bytes")
    if not any(c.isalpha() for c in v):
        raise ValueError("Password must contain at least one letter")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one digit")
    return v
