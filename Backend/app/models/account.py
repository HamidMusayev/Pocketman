from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
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
