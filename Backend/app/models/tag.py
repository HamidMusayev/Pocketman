from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.transaction import transaction_tags


class Tag(Base):
    """A free-form label (e.g. "travel-baku") a user can put on many transactions."""

    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tags_user_id_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(40), nullable=False)

    transactions = relationship("Transaction", secondary=transaction_tags, back_populates="tags")
