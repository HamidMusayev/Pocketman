from sqlalchemy import Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Category(Base):
    __tablename__ = "categories"
    # names are unique per user, not globally
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_categories_user_id_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # income | expense
    icon: Mapped[str] = mapped_column(String, nullable=False, default="other")
    budget: Mapped[float | None] = mapped_column(Float, nullable=True)

    transactions = relationship("Transaction", back_populates="category")
    recurring_rules = relationship("RecurringRule", back_populates="category")
    pending_approvals = relationship("PendingApproval", back_populates="category")
