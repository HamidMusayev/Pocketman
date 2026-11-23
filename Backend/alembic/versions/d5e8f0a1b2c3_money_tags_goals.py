"""exact money (integer cents), opening balances, notes + tags, goals,
recurring transfers and auto-approve

Revision ID: d5e8f0a1b2c3
Revises: c3a9d2e4f1b7
Create Date: 2026-11-23 18:00:00.000000

- every money column (transactions/recurring_rules/pending_approvals.amount,
  categories.budget) goes from FLOAT to INTEGER cents; existing values are
  converted with ROUND(x * 100), so 12.5 becomes 1250
- accounts.opening_balance (cents, default 0)
- transactions.note, plus `tags` and the `transaction_tags` link table
- `goals` (savings goals)
- recurring_rules / pending_approvals: category_id nullable and a
  transfer_account_id so a rule can be a transfer; recurring_rules.auto_approve
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d5e8f0a1b2c3"
down_revision: Union[str, None] = "c3a9d2e4f1b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MONEY_COLUMNS = [
    ("transactions", "amount", False),
    ("recurring_rules", "amount", False),
    ("pending_approvals", "amount", False),
    ("categories", "budget", True),
]


def upgrade() -> None:
    for table, column, nullable in MONEY_COLUMNS:
        op.execute(
            f"UPDATE {table} SET {column} = CAST(ROUND({column} * 100) AS INTEGER) "
            f"WHERE {column} IS NOT NULL"
        )
        with op.batch_alter_table(table) as batch:
            batch.alter_column(column, type_=sa.Integer(), existing_nullable=nullable)

    with op.batch_alter_table("accounts") as batch:
        batch.add_column(sa.Column("opening_balance", sa.Integer(), nullable=False, server_default="0"))

    with op.batch_alter_table("transactions") as batch:
        batch.add_column(sa.Column("note", sa.Text(), nullable=True))

    with op.batch_alter_table("recurring_rules") as batch:
        batch.alter_column("category_id", existing_type=sa.Integer(), nullable=True)
        batch.add_column(sa.Column("transfer_account_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("auto_approve", sa.Boolean(), nullable=False, server_default="0"))
        batch.create_foreign_key(
            "fk_recurring_rules_transfer_account_id_accounts", "accounts", ["transfer_account_id"], ["id"]
        )

    with op.batch_alter_table("pending_approvals") as batch:
        batch.alter_column("category_id", existing_type=sa.Integer(), nullable=True)
        batch.add_column(sa.Column("transfer_account_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_pending_approvals_transfer_account_id_accounts", "accounts", ["transfer_account_id"], ["id"]
        )

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(40), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_tags_user_id_name"),
    )
    op.create_index("ix_tags_user_id", "tags", ["user_id"])
    op.create_table(
        "transaction_tags",
        sa.Column("transaction_id", sa.Integer(), sa.ForeignKey("transactions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("target_amount", sa.Integer(), nullable=False),
        sa.Column("saved_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("icon", sa.String(), nullable=False, server_default="target"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_goals_user_id", "goals")
    op.drop_table("goals")
    op.drop_table("transaction_tags")
    op.drop_index("ix_tags_user_id", "tags")
    op.drop_table("tags")

    # recurring transfers can't exist before this revision
    op.execute("DELETE FROM pending_approvals WHERE type = 'transfer'")
    op.execute("DELETE FROM recurring_rules WHERE type = 'transfer'")
    with op.batch_alter_table("pending_approvals") as batch:
        batch.drop_constraint("fk_pending_approvals_transfer_account_id_accounts", type_="foreignkey")
        batch.drop_column("transfer_account_id")
        batch.alter_column("category_id", existing_type=sa.Integer(), nullable=False)
    with op.batch_alter_table("recurring_rules") as batch:
        batch.drop_constraint("fk_recurring_rules_transfer_account_id_accounts", type_="foreignkey")
        batch.drop_column("auto_approve")
        batch.drop_column("transfer_account_id")
        batch.alter_column("category_id", existing_type=sa.Integer(), nullable=False)
    with op.batch_alter_table("transactions") as batch:
        batch.drop_column("note")
    with op.batch_alter_table("accounts") as batch:
        batch.drop_column("opening_balance")

    for table, column, nullable in MONEY_COLUMNS:
        with op.batch_alter_table(table) as batch:
            batch.alter_column(column, type_=sa.Float(), existing_nullable=nullable)
        op.execute(f"UPDATE {table} SET {column} = {column} / 100.0 WHERE {column} IS NOT NULL")
