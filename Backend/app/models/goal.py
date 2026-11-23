from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.money import Money


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Goal(Base):
    """A savings goal: "10 000 for a car by December"."""

    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    saved_amount: Mapped[Decimal] = mapped_column(
        Money, nullable=False, default=Decimal("0"), server_default="0"
    )
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    icon: Mapped[str] = mapped_column(String, nullable=False, default="target", server_default="target")
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=_utcnow
    )
