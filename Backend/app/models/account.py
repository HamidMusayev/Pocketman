from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


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

    # No cascade delete: an account with transaction/recurring history cannot be
    # deleted (service layer enforces this with a 409) so financial history is
    # never silently destroyed by removing an account.
    # `foreign_keys` disambiguates from Transaction.transfer_account_id, which is
    # a second FK from transactions to accounts (transfer destination).
    transactions = relationship(
        "Transaction", foreign_keys="Transaction.account_id", back_populates="account"
    )
    recurring_rules = relationship("RecurringRule", back_populates="account")
    pending_approvals = relationship("PendingApproval", back_populates="account")
