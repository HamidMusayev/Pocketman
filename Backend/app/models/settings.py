from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Settings(Base):
    """Singleton row (id always 1) holding the app password and user prefs."""

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    accent_color: Mapped[str] = mapped_column(String, default="#FCD535")
    currency_symbol: Mapped[str] = mapped_column(String, default="$")
    show_cents: Mapped[bool] = mapped_column(Boolean, default=True)
    setup_complete: Mapped[bool] = mapped_column(Boolean, default=False)
