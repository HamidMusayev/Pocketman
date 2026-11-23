"""multi-user: users table + user_id on every data table

Revision ID: c3a9d2e4f1b7
Revises: b2f1a3c4d5e6
Create Date: 2026-11-23 00:00:00.000000

Pocketman used to be single-user: one `settings` row (id=1) held the password
hash, and accounts/categories/transactions/... had no owner.

This migration:
- creates `users`
- if the old install was set up (or has any data), creates an owner account
  that keeps the old password, so the existing person can log in with
  username `OWNER_USERNAME` (env var, default "pocketman") and their old
  password; they can rename it from Settings afterwards
- adds a NOT NULL `user_id` to every data table and assigns all existing rows
  to that owner, so nothing is lost
- swaps the global UNIQUE(name) on accounts/categories for UNIQUE(user_id, name)
- turns `settings` into a per-user table (drops password_hash/setup_complete)

Batch mode is used throughout because SQLite can't ALTER constraints in place.
"""
import os
import re
from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3a9d2e4f1b7"
down_revision: Union[str, None] = "b2f1a3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DATA_TABLES = ["accounts", "categories", "transactions", "recurring_rules", "pending_approvals"]

# Lets batch mode find (and drop) the old unnamed UNIQUE(name) constraints.
NAMING = {"uq": "uq_%(table_name)s_%(column_0_name)s"}


def _owner_username() -> str:
    name = os.environ.get("OWNER_USERNAME", "pocketman").strip().lower()
    if not re.fullmatch(r"[a-z0-9_]{6,32}", name):
        name = "pocketman"
    return name


def upgrade() -> None:
    bind = op.get_bind()

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=32), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )

    # ---- decide whether there is an existing owner to migrate ----
    legacy = bind.execute(
        sa.text("SELECT password_hash, setup_complete FROM settings WHERE id = 1")
    ).first()
    has_data = any(
        bind.execute(sa.text(f"SELECT 1 FROM {t} LIMIT 1")).first() is not None
        for t in DATA_TABLES
    )

    owner_id = None
    if (legacy is not None and legacy.setup_complete) or has_data:
        # "!" is not a valid bcrypt hash, so an owner created without a legacy
        # password can't be logged into until a password is set by an admin.
        password_hash = legacy.password_hash if legacy is not None and legacy.password_hash else "!"
        bind.execute(
            sa.text(
                "INSERT INTO users (username, password_hash, token_version, created_at) "
                "VALUES (:u, :p, 0, :c)"
            ),
            {"u": _owner_username(), "p": password_hash, "c": datetime.now(timezone.utc)},
        )
        owner_id = bind.execute(sa.text("SELECT id FROM users WHERE username = :u"), {"u": _owner_username()}).scalar_one()

    # ---- user_id on every data table ----
    for table in DATA_TABLES:
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        if owner_id is not None:
            bind.execute(sa.text(f"UPDATE {table} SET user_id = :o"), {"o": owner_id})

    for table in ("accounts", "categories"):
        with op.batch_alter_table(table, naming_convention=NAMING) as batch:
            batch.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
            batch.create_foreign_key(f"fk_{table}_user_id_users", "users", ["user_id"], ["id"])
            batch.create_index(f"ix_{table}_user_id", ["user_id"])
            batch.drop_constraint(f"uq_{table}_name", type_="unique")
            batch.create_unique_constraint(f"uq_{table}_user_id_name", ["user_id", "name"])

    for table in ("transactions", "recurring_rules", "pending_approvals"):
        with op.batch_alter_table(table) as batch:
            batch.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
            batch.create_foreign_key(f"fk_{table}_user_id_users", "users", ["user_id"], ["id"])
            batch.create_index(f"ix_{table}_user_id", ["user_id"])

    # ---- settings becomes per-user ----
    with op.batch_alter_table("settings") as batch:
        batch.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
    if owner_id is not None:
        bind.execute(sa.text("UPDATE settings SET user_id = :o WHERE id = 1"), {"o": owner_id})
    bind.execute(sa.text("DELETE FROM settings WHERE user_id IS NULL"))
    with op.batch_alter_table("settings") as batch:
        batch.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
        batch.create_foreign_key("fk_settings_user_id_users", "users", ["user_id"], ["id"])
        batch.create_index("ix_settings_user_id", ["user_id"], unique=True)
        batch.drop_column("password_hash")
        batch.drop_column("setup_complete")


def downgrade() -> None:
    # Going back to single-user would mean merging or deleting other users'
    # data, which can't be done safely and automatically.
    raise NotImplementedError(
        "Downgrading from multi-user is not supported; restore a database backup instead."
    )
