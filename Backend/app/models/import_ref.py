from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ImportRef(Base):
    """Remembers which rows of an outside backup were already imported, so
    importing the same (or a newer) backup again skips them instead of
    duplicating. `ref` is the source's own id for the row, e.g. "tx:<uid>"."""

    __tablename__ = "import_refs"
    __table_args__ = (
        UniqueConstraint("user_id", "source", "ref", name="uq_import_refs_user_id_source_ref"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    ref: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=_utcnow
    )
