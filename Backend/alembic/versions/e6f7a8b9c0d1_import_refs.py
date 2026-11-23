"""import_refs: remember rows imported from outside backups (Money Manager)

Revision ID: e6f7a8b9c0d1
Revises: d5e8f0a1b2c3
Create Date: 2026-11-23 19:30:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e8f0a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "import_refs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("ref", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "source", "ref", name="uq_import_refs_user_id_source_ref"),
    )
    op.create_index("ix_import_refs_user_id", "import_refs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_import_refs_user_id", table_name="import_refs")
    op.drop_table("import_refs")
