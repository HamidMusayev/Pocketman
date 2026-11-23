from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.money import Money


class RecurringRule(Base):
    __tablename__ = "recurring_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    # destination account when type == "transfer" (category is then null)
    transfer_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id"), nullable=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)  # income | expense | transfer
    frequency: Mapped[str] = mapped_column(String, nullable=False)  # Daily|Weekly|Monthly|Yearly
    next_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    # post due occurrences straight to transactions instead of asking first
    auto_approve: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )

    category = relationship("Category", back_populates="recurring_rules")
    account = relationship("Account", foreign_keys=[account_id], back_populates="recurring_rules")
    transfer_account = relationship("Account", foreign_keys=[transfer_account_id])
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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    recurring_rule_id: Mapped[int] = mapped_column(
        ForeignKey("recurring_rules.id"), nullable=False
    )
    description: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    transfer_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id"), nullable=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)

    rule = relationship("RecurringRule", back_populates="pending_approvals")
    category = relationship("Category", back_populates="pending_approvals")
    account = relationship("Account", foreign_keys=[account_id], back_populates="pending_approvals")
    transfer_account = relationship("Account", foreign_keys=[transfer_account_id])
