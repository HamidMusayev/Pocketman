from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # income | expense
    icon: Mapped[str] = mapped_column(String, nullable=False, default="other")
    budget: Mapped[float | None] = mapped_column(Float, nullable=True)

    transactions = relationship("Transaction", back_populates="category")
    recurring_rules = relationship("RecurringRule", back_populates="category")
    pending_approvals = relationship("PendingApproval", back_populates="category")
