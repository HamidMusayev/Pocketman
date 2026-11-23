from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.settings import Settings as SettingsModel
from app.models.user import User
from app.ratelimit import client_ip, limiter
from app.schemas.auth import (
    ChangePasswordRequest,
    ChangeUsernameRequest,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    StatusResponse,
    TokenResponse,
)
from app.security import (
    burn_password_check,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.seed import seed_defaults

router = APIRouter(prefix="/api/auth", tags=["auth"])

_BAD_LOGIN = "Incorrect username or password"
_TAKEN = "Username is already taken"


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(token=create_access_token(user), username=user.username)


@router.get("/status", response_model=StatusResponse)
def get_status() -> StatusResponse:
    return StatusResponse(registration_enabled=settings.ALLOW_REGISTRATION)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    if not settings.ALLOW_REGISTRATION:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration is disabled")

    ip_key = f"register:ip:{client_ip(request)}"
    limiter.check(ip_key, settings.REGISTER_IP_MAX, settings.REGISTER_WINDOW_SECONDS)
    limiter.hit(ip_key)

    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_TAKEN)

    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:  # lost a race with a concurrent sign-up
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_TAKEN) from None
    db.add(SettingsModel(user_id=user.id))
    seed_defaults(db, user.id)  # commits
    db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    username = body.username.strip().lower()
    user_key = f"login:user:{username}"
    ip_key = f"login:ip:{client_ip(request)}"
    limiter.check(user_key, settings.LOGIN_MAX_FAILURES, settings.LOGIN_WINDOW_SECONDS)
    limiter.check(ip_key, settings.LOGIN_IP_MAX_ATTEMPTS, settings.LOGIN_WINDOW_SECONDS)
    limiter.hit(ip_key)

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        burn_password_check(body.password)  # same timing as a real check
        ok = False
    else:
        ok = verify_password(body.password, user.password_hash)
    if not ok:
        limiter.hit(user_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_BAD_LOGIN)

    limiter.reset(user_key)
    return _token_response(user)


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(id=user.id, username=user.username)


def _check_current_password(user: User, password: str) -> None:
    key = f"reauth:user:{user.id}"
    limiter.check(key, settings.LOGIN_MAX_FAILURES, settings.LOGIN_WINDOW_SECONDS)
    if not verify_password(password, user.password_hash):
        limiter.hit(key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    limiter.reset(key)


@router.post("/change-password", response_model=TokenResponse)
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TokenResponse:
    _check_current_password(user, body.current_password)
    user.password_hash = hash_password(body.new_password)
    # invalidates every token issued before this change (other devices, a leaked token)
    user.token_version += 1
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/change-username", response_model=TokenResponse)
def change_username(
    body: ChangeUsernameRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TokenResponse:
    _check_current_password(user, body.password)
    if body.new_username != user.username:
        taken = db.query(User).filter(User.username == body.new_username, User.id != user.id).first()
        if taken:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_TAKEN)
        user.username = body.new_username
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_TAKEN) from None
        db.refresh(user)
    return _token_response(user)


@router.post("/logout-all", response_model=TokenResponse)
def logout_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TokenResponse:
    """Revoke every existing token for this user; returns a fresh one for this device."""
    user.token_version += 1
    db.commit()
    db.refresh(user)
    return _token_response(user)
