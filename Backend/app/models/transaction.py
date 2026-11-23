from datetime import date
from decimal import Decimal

from sqlalchemy import Column, Date, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.money import Money

transaction_tags = Table(
    "transaction_tags",
    Base.metadata,
    Column("transaction_id", ForeignKey("transactions.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String, nullable=False)  # income | expense | transfer
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    # free-text note, longer than the one-line description
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    tags = relationship("Tag", secondary=transaction_tags, back_populates="transactions", order_by="Tag.name")
