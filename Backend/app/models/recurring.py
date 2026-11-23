from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
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
    """A planned income/expense/transfer that has not happened yet.

    Two sources: a one-off item the user planned for a future date
    (`recurring_rule_id` is null), or a due occurrence of a RecurringRule that
    isn't set to add itself automatically. Either way it stays out of every
    balance until the user confirms it, and then becomes a real Transaction.

    Fields are snapshotted from the rule at generation time so editing the
    rule later doesn't retroactively change an already-pending item.
    """

    __tablename__ = "pending_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # null for a one-off planned item
    recurring_rule_id: Mapped[int | None] = mapped_column(
        ForeignKey("recurring_rules.id"), nullable=True
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
    # carried over to the transaction when the item is confirmed
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # normalized tag names, comma-separated (tags only become Tag rows once real)
    tags: Mapped[str | None] = mapped_column(String, nullable=True)

    rule = relationship("RecurringRule", back_populates="pending_approvals")
    category = relationship("Category", back_populates="pending_approvals")
    account = relationship("Account", foreign_keys=[account_id], back_populates="pending_approvals")
    transfer_account = relationship("Account", foreign_keys=[transfer_account_id])
