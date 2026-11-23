from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Settings(Base):
    """Per-user display preferences (one row per user)."""

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), unique=True, nullable=False, index=True
    )
    accent_color: Mapped[str] = mapped_column(String, default="#FCD535")
    currency_symbol: Mapped[str] = mapped_column(String, default="$")
    show_cents: Mapped[bool] = mapped_column(Boolean, default=True)
