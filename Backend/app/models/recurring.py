from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RecurringRule(Base):
    __tablename__ = "recurring_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    description: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # income | expense
    frequency: Mapped[str] = mapped_column(String, nullable=False)  # Daily|Weekly|Monthly|Yearly
    next_due_date: Mapped[date] = mapped_column(Date, nullable=False)

    category = relationship("Category", back_populates="recurring_rules")
    account = relationship("Account", back_populates="recurring_rules")
    pending_approvals = relationship(
        "PendingApproval", back_populates="rule", cascade="all, delete-orphan"
    )


class PendingApproval(Base):
    """A due-but-not-yet-approved occurrence of a RecurringRule.

    Fields are snapshotted from the rule at generation time so editing the
    rule later doesn't retroactively change an already-pending item.
    """

    __tablename__ = "pending_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    recurring_rule_id: Mapped[int] = mapped_column(
        ForeignKey("recurring_rules.id"), nullable=False
    )
    description: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)

    rule = relationship("RecurringRule", back_populates="pending_approvals")
    category = relationship("Category", back_populates="pending_approvals")
    account = relationship("Account", back_populates="pending_approvals")
