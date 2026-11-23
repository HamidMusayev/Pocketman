"""planned_items: one-off planned income/expenses share the pending table

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-11-23 22:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("pending_approvals") as batch:
        batch.alter_column("recurring_rule_id", existing_type=sa.Integer(), nullable=True)
        batch.add_column(sa.Column("note", sa.Text(), nullable=True))
        batch.add_column(sa.Column("tags", sa.String(), nullable=True))


def downgrade() -> None:
    op.execute("DELETE FROM pending_approvals WHERE recurring_rule_id IS NULL")
    with op.batch_alter_table("pending_approvals") as batch:
        batch.drop_column("tags")
        batch.drop_column("note")
        batch.alter_column("recurring_rule_id", existing_type=sa.Integer(), nullable=False)
