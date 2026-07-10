"""add transfers (transfer_account_id + nullable category_id)

Revision ID: b2f1a3c4d5e6
Revises: 0574c4050417
Create Date: 2026-07-09 00:00:00.000000

Adds support for "transfer" transactions that move money between accounts:
- a nullable `transfer_account_id` (the destination account)
- makes `category_id` nullable (transfers carry no category)

Uses batch mode because SQLite cannot ALTER a column's nullability in place.
Existing income/expense rows are preserved unchanged.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2f1a3c4d5e6'
down_revision: Union[str, None] = '0574c4050417'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('transfer_account_id', sa.Integer(), nullable=True))
        batch_op.alter_column('category_id', existing_type=sa.Integer(), nullable=True)
        batch_op.create_foreign_key(
            'fk_transactions_transfer_account_id_accounts',
            'accounts', ['transfer_account_id'], ['id'],
        )


def downgrade() -> None:
    # Transfers rely on nullable category_id, so drop them before re-tightening.
    op.execute("DELETE FROM transactions WHERE type = 'transfer'")
    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.drop_constraint(
            'fk_transactions_transfer_account_id_accounts', type_='foreignkey'
        )
        batch_op.alter_column('category_id', existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column('transfer_account_id')
