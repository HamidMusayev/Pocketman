from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String, nullable=False)  # income | expense | transfer
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    # category is null for transfers (money moving between accounts has no category)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    # destination account for transfers; null for income/expense
    transfer_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id"), nullable=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)

    category = relationship("Category", back_populates="transactions")
    account = relationship(
        "Account", foreign_keys=[account_id], back_populates="transactions"
    )
    transfer_account = relationship("Account", foreign_keys=[transfer_account_id])
