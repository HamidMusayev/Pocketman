"""Helpers that make every lookup user-scoped.

Never use `db.get(Model, id)` on user data in a router: it returns other users'
rows. Use `get_owned` (404 for missing *or* foreign rows, so the ids of other
users' data are not even confirmed to exist) or `owned_query`.
"""

from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy.orm import Query, Session

T = TypeVar("T")


def owned_query(db: Session, model: type[T], user_id: int) -> Query:
    return db.query(model).filter(model.user_id == user_id)  # type: ignore[attr-defined]


def find_owned(db: Session, model: type[T], obj_id: int | None, user_id: int) -> T | None:
    if obj_id is None:
        return None
    return (
        db.query(model)
        .filter(model.id == obj_id, model.user_id == user_id)  # type: ignore[attr-defined]
        .first()
    )


def get_owned(db: Session, model: type[T], obj_id: int, user_id: int, label: str) -> T:
    obj = find_owned(db, model, obj_id, user_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")
    return obj
