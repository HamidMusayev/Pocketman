from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.money import Money


class Account(Base):
    __tablename__ = "accounts"
    # names are unique per user, not globally
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_accounts_user_id_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False, default="cash")
    icon: Mapped[str] = mapped_column(String, nullable=False, default="wallet")
    removable: Mapped[bool] = mapped_column(Boolean, default=True)
    # money already in the account when it was added to Pocketman; counts
    # toward the balance/net worth but not toward income or expenses
    opening_balance: Mapped[Decimal] = mapped_column(
        Money, nullable=False, default=Decimal("0"), server_default="0"
    )

    # No cascade delete: an account with transaction/recurring history cannot be
    # deleted (service layer enforces this with a 409) so financial history is
    # never silently destroyed by removing an account.
    # `foreign_keys` disambiguates from Transaction.transfer_account_id, which is
    # a second FK from transactions to accounts (transfer destination).
    transactions = relationship(
        "Transaction", foreign_keys="Transaction.account_id", back_populates="account"
    )
    recurring_rules = relationship(
        "RecurringRule", foreign_keys="RecurringRule.account_id", back_populates="account"
    )
    pending_approvals = relationship(
        "PendingApproval", foreign_keys="PendingApproval.account_id", back_populates="account"
    )
