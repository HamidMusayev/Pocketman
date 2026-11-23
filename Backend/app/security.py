import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import INSECURE_SECRET_KEYS, settings
from app.database import get_db
from app.models.settings import Settings as SettingsModel
from app.models.user import User

logger = logging.getLogger("pocketman.security")

bearer_scheme = HTTPBearer(auto_error=False)

BCRYPT_ROUNDS = 12
# Used to spend the same bcrypt time on unknown usernames as on real ones, so
# response timing doesn't reveal which usernames exist.
_DUMMY_HASH = bcrypt.hashpw(b"pocketman-dummy-password", bcrypt.gensalt(BCRYPT_ROUNDS))


def _secret_file_path() -> str:
    url = settings.DATABASE_URL
    if url.startswith("sqlite") and "///" in url:
        db_dir = os.path.dirname(url.split("///")[-1]) or "."
    else:
        db_dir = "./data"
    return os.path.join(db_dir, ".jwt_secret")


@lru_cache(maxsize=1)
def jwt_secret() -> str:
    """The configured SECRET_KEY, unless it is missing, a shipped placeholder or
    too short — then a random key generated once and stored beside the database
    (so it survives restarts on the data volume)."""
    configured = settings.SECRET_KEY.strip()
    if configured not in INSECURE_SECRET_KEYS and len(configured) >= 32:
        return configured

    path = _secret_file_path()
    try:
        with open(path, encoding="utf-8") as f:
            stored = f.read().strip()
        if len(stored) >= 32:
            return stored
    except FileNotFoundError:
        pass

    generated = secrets.token_urlsafe(48)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(generated)
    logger.warning(
        "SECRET_KEY is unset, a placeholder or shorter than 32 chars; "
        "generated a random signing key at %s", path,
    )
    return generated


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    plain = plain_password.encode("utf-8")
    if len(plain) > 72:
        return False
    try:
        return bcrypt.checkpw(plain, password_hash.encode("utf-8"))
    except ValueError:  # malformed / unusable hash
        return False


def burn_password_check(plain_password: str) -> None:
    """Spend one bcrypt check's worth of time without a real user."""
    plain = plain_password.encode("utf-8")[:72]
    bcrypt.checkpw(plain, _DUMMY_HASH)


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "ver": user.token_version,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "typ": "access",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=settings.JWT_ALGORITHM)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def decode_access_token(token: str) -> dict:
    try:
        # algorithms is pinned, so "alg: none" or algorithm-confusion tokens are rejected
        payload = jwt.decode(token, jwt_secret(), algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise _unauthorized("Invalid or expired token") from exc
    if payload.get("typ") != "access":
        raise _unauthorized("Invalid or expired token")
    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise _unauthorized("Not authenticated")
    payload = decode_access_token(credentials.credentials)
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise _unauthorized("Invalid or expired token") from None
    user = db.get(User, user_id)
    if user is None or payload.get("ver") != user.token_version:
        raise _unauthorized("Invalid or expired token")
    return user


def get_settings_row(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> SettingsModel:
    row = db.query(SettingsModel).filter(SettingsModel.user_id == user.id).first()
    if row is None:
        row = SettingsModel(user_id=user.id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
