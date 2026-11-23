"""Import a backup from Realbyte's "Money Manager" app (.mmbak).

A .mmbak is an SQLite database, sometimes wrapped in a ZIP. The tables used:

- ASSETS       accounts: uid, NIC_NAME (name), ZDATA ('1' = deleted)
- ZCATEGORY    categories: uid, NAME, TYPE (0 income, 1 expense), pUid (parent)
- INOUTCOME    transactions: uid, DO_TYPE, ZMONEY (text, never negative),
               WDATE (local YYYY-MM-DD), ZDATE (epoch ms), assetUid,
               toAssetUid, ctgUid, txUidTrans, ZCONTENT (short note),
               ZDATA (long note), IS_DEL, currencyUid
- CURRENCY     uid, ISO, SYMBOL

DO_TYPE: 0 income, 1 expense, 3 transfer out, 4 transfer in (the other leg
of a 3, sharing txUidTrans), 7/8 balance raised/lowered without counting as
income/expense. Category "-4" is the built-in "balance modification".

How it lands in Pocketman:

- accounts and categories are matched by name (case-insensitive) and created
  when missing. Pocketman categories are flat, so a Money Manager
  subcategory maps to its parent category and becomes a tag on the row.
- a transfer is one row (from the type-3 leg); the type-4 leg is dropped,
  unless it has no partner, in which case it becomes the transfer itself.
- 7/8 adjustments are added to the account's opening balance, so balances
  match without the adjustment showing up as income or expense.
- every imported row's Money Manager uid is remembered in `import_refs`,
  so importing the same backup again adds only what is new.

The uploaded file is untrusted. It is size-limited (also once unzipped),
opened read-only and immutable, only real tables (not views) are read, and
an authorizer plus a time budget stop anything but plain reads.
"""

from __future__ import annotations

import io
import os
import re
import sqlite3
import tempfile
import time
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from app.config import settings
from app.models.account import Account
from app.models.category import Category
from app.models.import_ref import ImportRef
from app.models.tag import Tag
from app.models.transaction import Transaction
from app.money import CENT, MAX_AMOUNT
from app.schemas.transaction import normalize_tags

SOURCE = "mmbak"
SQLITE_MAGIC = b"SQLite format 3\x00"
MAX_ROWS = 200_000
MAX_NAME_LEN = 100
MAX_DESCRIPTION_LEN = 500
MAX_NOTE_LEN = 2000
QUERY_TIME_BUDGET_S = 30.0
ADJUSTMENT_CATEGORY = "-4"
ADJUSTMENT_NAME = "Balance adjustment"


class MmbakError(ValueError):
    """The upload is not a Money Manager backup we can read. Message is user-facing."""


# --------------------------------------------------------------------------
# Reading the file
# --------------------------------------------------------------------------


@dataclass
class MmRow:
    uid: str
    do_type: str
    amount: Decimal
    day: date
    asset_uid: str
    to_asset_uid: str
    category_uid: str
    trans_group: str
    content: str
    memo: str
    currency_uid: str


@dataclass
class MmBackup:
    accounts: dict[str, str]  # uid -> name
    categories: dict[str, tuple[str, str, str]]  # uid -> (name, type, parent uid)
    currencies: dict[str, tuple[str, str]]  # uid -> (iso, symbol)
    rows: list[MmRow]
    skipped: int = 0
    warnings: list[str] = field(default_factory=list)


def _extract_sqlite(raw: bytes) -> bytes:
    if raw.startswith(SQLITE_MAGIC):
        return raw
    if not raw.startswith(b"PK"):
        raise MmbakError("This is not a Money Manager backup (.mmbak).")
    limit = settings.MMBAK_MAX_DB_BYTES
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            infos = [i for i in zf.infolist() if not i.is_dir()]
            if len(infos) > 50:
                raise MmbakError("The backup archive has too many files.")
            for info in infos:
                if info.file_size > limit:
                    raise MmbakError("The backup is too large once unpacked.")
                with zf.open(info) as fh:
                    if fh.read(len(SQLITE_MAGIC)) != SQLITE_MAGIC:
                        continue
                    # file_size in the header can lie; cap what we actually read
                    data = SQLITE_MAGIC + fh.read(limit + 1 - len(SQLITE_MAGIC))
                if len(data) > limit:
                    raise MmbakError("The backup is too large once unpacked.")
                return data
    except (zipfile.BadZipFile, zipfile.LargeZipFile, NotImplementedError, RuntimeError, EOFError):
        raise MmbakError("The backup archive is damaged or encrypted.") from None
    raise MmbakError("No Money Manager database was found inside the archive.")


_ALLOWED_ACTIONS = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION}


def _authorizer(action, arg1, arg2, dbname, source):
    if action in _ALLOWED_ACTIONS:
        return sqlite3.SQLITE_OK
    if action == sqlite3.SQLITE_PRAGMA and arg1 in ("table_info", "trusted_schema"):
        return sqlite3.SQLITE_OK
    return sqlite3.SQLITE_DENY


def _s(v) -> str:
    if v is None:
        return ""
    if isinstance(v, bytes):
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def _amount(v) -> Decimal | None:
    text = _s(v).replace(",", "")
    if not text:
        return None
    try:
        d = Decimal(text)
    except InvalidOperation:
        return None
    if not d.is_finite():
        return None
    d = abs(d).quantize(CENT)
    if d <= 0 or d >= MAX_AMOUNT:
        return None
    return d


_DAY_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")


def _day(wdate, zdate) -> date | None:
    m = _DAY_RE.match(_s(wdate))
    if m:
        try:
            return date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            pass
    try:
        ms = int(Decimal(_s(zdate)))
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).date()
    except (InvalidOperation, ValueError, OverflowError, OSError):
        return None


def _truthy(v) -> bool:
    text = _s(v)
    return text not in ("", "0")


def read_backup(raw: bytes) -> MmBackup:
    data = _extract_sqlite(raw)
    fd, path = tempfile.mkstemp(suffix=".mmbak.sqlite")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        return _read_db(path)
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def _read_db(path: str) -> MmBackup:
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)
    except sqlite3.Error:
        raise MmbakError("The backup could not be opened.") from None
    deadline = time.monotonic() + QUERY_TIME_BUDGET_S
    try:
        conn.execute("PRAGMA trusted_schema = OFF")
        conn.set_authorizer(_authorizer)
        conn.set_progress_handler(lambda: 1 if time.monotonic() > deadline else 0, 10_000)
        try:
            return _read_tables(conn)
        except sqlite3.Error:
            raise MmbakError("The backup is damaged or not a Money Manager backup.") from None
    finally:
        conn.close()


def _tables(conn: sqlite3.Connection) -> dict[str, str]:
    """Upper-cased name -> real name, for real tables only (never views)."""
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return {str(name).upper(): str(name) for (name,) in rows}


def _columns(conn: sqlite3.Connection, table: str) -> dict[str, str]:
    rows = conn.execute(f'PRAGMA table_info("{table}")').fetchall()
    return {str(r[1]).upper(): str(r[1]) for r in rows}


def _select(conn, tables, table, wanted: list[str], limit: int | None = None) -> list[dict]:
    """SELECT the wanted columns that exist; missing ones read as None."""
    real = tables.get(table)
    if real is None:
        return []
    cols = _columns(conn, real)
    present = [c for c in wanted if c.upper() in cols]
    if not present:
        return []
    sql = "SELECT " + ", ".join(f'"{cols[c.upper()]}"' for c in present) + f' FROM "{real}"'
    if limit is not None:
        sql += f" LIMIT {int(limit)}"
    out = []
    for values in conn.execute(sql):
        row = dict.fromkeys(wanted)
        row.update(zip(present, values))
        out.append(row)
    return out


def _read_tables(conn: sqlite3.Connection) -> MmBackup:
    tables = _tables(conn)
    if "INOUTCOME" not in tables or "ASSETS" not in tables:
        raise MmbakError("This file does not look like a Money Manager backup.")
    in_cols = _columns(conn, tables["INOUTCOME"])
    for required in ("DO_TYPE", "ZMONEY", "ASSETUID"):
        if required not in in_cols:
            raise MmbakError("This Money Manager backup version is not supported.")

    accounts: dict[str, str] = {}
    for r in _select(conn, tables, "ASSETS", ["uid", "NIC_NAME", "ZDATA"]):
        uid = _s(r["uid"])
        if uid:
            accounts[uid] = _s(r["NIC_NAME"])[:MAX_NAME_LEN]

    categories: dict[str, tuple[str, str, str]] = {}
    for r in _select(conn, tables, "ZCATEGORY", ["uid", "NAME", "TYPE", "pUid"]):
        uid = _s(r["uid"])
        if not uid:
            continue
        type_ = "income" if _s(r["TYPE"]) == "0" else "expense"
        parent = _s(r["pUid"])
        if parent in ("0", uid):
            parent = ""
        categories[uid] = (_s(r["NAME"])[:MAX_NAME_LEN], type_, parent)

    currencies: dict[str, tuple[str, str]] = {}
    for r in _select(conn, tables, "CURRENCY", ["uid", "ISO", "SYMBOL"], limit=500):
        uid = _s(r["uid"])
        if uid:
            currencies[uid] = (_s(r["ISO"])[:8], _s(r["SYMBOL"])[:8])

    wanted = [
        "uid", "AID", "DO_TYPE", "ZMONEY", "IN_ZMONEY", "WDATE", "ZDATE", "assetUid",
        "toAssetUid", "ctgUid", "txUidTrans", "ZCONTENT", "ZDATA", "IS_DEL", "currencyUid",
    ]
    raw_rows = _select(conn, tables, "INOUTCOME", wanted, limit=MAX_ROWS + 1)
    backup = MmBackup(accounts=accounts, categories=categories, currencies=currencies, rows=[])
    if len(raw_rows) > MAX_ROWS:
        raise MmbakError(f"The backup has more than {MAX_ROWS:,} transactions.")

    for r in raw_rows:
        if _truthy(r["IS_DEL"]):
            continue  # deleted in the app; not data
        uid = _s(r["uid"]) or (f"aid:{_s(r['AID'])}" if _s(r["AID"]) else "")
        amount = _amount(r["ZMONEY"]) or _amount(r["IN_ZMONEY"])
        day = _day(r["WDATE"], r["ZDATE"])
        do_type = _s(r["DO_TYPE"])
        if not uid or amount is None or day is None or do_type not in ("0", "1", "3", "4", "7", "8"):
            backup.skipped += 1
            continue
        backup.rows.append(
            MmRow(
                uid=uid[:150],
                do_type=do_type,
                amount=amount,
                day=day,
                asset_uid=_s(r["assetUid"]),
                to_asset_uid=_s(r["toAssetUid"]),
                category_uid=_s(r["ctgUid"]),
                trans_group=_s(r["txUidTrans"]),
                content=_s(r["ZCONTENT"]),
                memo=_s(r["ZDATA"]),
                currency_uid=_s(r["currencyUid"]),
            )
        )
    return backup


# --------------------------------------------------------------------------
# Planning: what would be created, given the user's current data
# --------------------------------------------------------------------------


@dataclass
class PlannedTxn:
    ref: str
    type: str  # income | expense | transfer
    amount: Decimal
    day: date
    description: str
    note: str | None
    account: str  # Pocketman account name
    to_account: str | None = None
    category: str | None = None  # Pocketman category name
    tag: str | None = None


@dataclass
class PlannedAdjustment:
    ref: str
    account: str
    delta: Decimal  # signed


@dataclass
class Plan:
    transactions: list[PlannedTxn]
    adjustments: list[PlannedAdjustment]
    new_accounts: list[str]
    existing_accounts: list[str]
    new_categories: list[tuple[str, str]]  # (name, type)
    existing_categories: list[str]
    duplicates: int
    skipped: int
    currency_iso: str | None
    currency_symbol: str | None
    warnings: list[str]


def _main_currency(backup: MmBackup) -> tuple[str | None, str | None, int]:
    """Most used currency, and how many rows are in some other currency."""
    if not backup.currencies:
        return None, None, 0
    used = Counter(r.currency_uid for r in backup.rows if r.currency_uid in backup.currencies)
    if used:
        main_uid = used.most_common(1)[0][0]
        others = sum(n for uid, n in used.items() if uid != main_uid)
    else:
        main_uid, others = next(iter(backup.currencies)), 0
    iso, symbol = backup.currencies[main_uid]
    return iso or None, symbol or None, others


def build_plan(db: Session, user_id: int, backup: MmBackup) -> Plan:
    warnings = list(backup.warnings)
    skipped = backup.skipped

    done = {
        ref
        for (ref,) in db.query(ImportRef.ref)
        .filter(ImportRef.user_id == user_id, ImportRef.source == SOURCE)
        .all()
    }

    existing_accounts = {
        a.name.lower(): a.name for a in db.query(Account).filter(Account.user_id == user_id)
    }
    existing_categories = {
        c.name.lower(): (c.name, c.type)
        for c in db.query(Category).filter(Category.user_id == user_id)
    }

    used_accounts: dict[str, str] = {}  # lower -> display name
    used_categories: dict[str, tuple[str, str]] = {}  # lower -> (name, type)

    def account_name(uid: str) -> str | None:
        if not uid:
            return None
        name = backup.accounts.get(uid)
        if name is None:
            return None
        name = name or f"Account {uid[:8]}"
        key = name.lower()
        display = existing_accounts.get(key, name)
        used_accounts.setdefault(key, display)
        return display

    def category_name(name: str, type_: str) -> str:
        """Pocketman category for an MM category name + type. Names are unique
        per user across types, so a clash gets the type appended."""
        name = (name or "Other")[:MAX_NAME_LEN]
        candidate = name
        for attempt in range(2):
            key = candidate.lower()
            hit = existing_categories.get(key) or used_categories.get(key)
            if hit is None or hit[1] == type_:
                display = hit[0] if hit else candidate
                used_categories.setdefault(key, (display, type_))
                return display
            if attempt == 0:
                suffix = f" ({type_})"
                candidate = name[: MAX_NAME_LEN - len(suffix)] + suffix
        # both "X" and "X (type)" are taken by the other type: very unlikely
        candidate = f"Imported {type_}"
        used_categories.setdefault(candidate.lower(), (candidate, type_))
        return candidate

    def resolve_category(uid: str, type_: str) -> tuple[str, str | None]:
        if uid == ADJUSTMENT_CATEGORY:
            return category_name(ADJUSTMENT_NAME, type_), None
        cat = backup.categories.get(uid)
        if cat is None:
            return category_name("Other", type_), None
        name, _, parent_uid = cat
        parent = backup.categories.get(parent_uid) if parent_uid else None
        if parent is not None:
            tag = None
            try:
                tags = normalize_tags([name])
                tag = tags[0] if tags else None
            except ValueError:
                pass
            return category_name(parent[0], type_), tag
        return category_name(name, type_), None

    # type-3 legs by transfer group, so their type-4 partner can be dropped
    out_groups = {r.trans_group for r in backup.rows if r.do_type == "3" and r.trans_group}

    planned: list[PlannedTxn] = []
    adjustments: list[PlannedAdjustment] = []
    duplicates = 0
    missing_account = 0

    for r in backup.rows:
        if r.do_type == "4" and r.trans_group and r.trans_group in out_groups:
            continue  # the other leg of a transfer we import from its type-3 row
        ref = f"tx:{r.uid}"
        if ref in done:
            duplicates += 1
            continue

        if r.do_type in ("7", "8"):
            acc = account_name(r.asset_uid)
            if acc is None:
                missing_account += 1
                continue
            delta = r.amount if r.do_type == "7" else -r.amount
            adjustments.append(PlannedAdjustment(ref=ref, account=acc, delta=delta))
            continue

        if r.do_type in ("3", "4"):
            src_uid, dst_uid = (
                (r.asset_uid, r.to_asset_uid) if r.do_type == "3" else (r.to_asset_uid, r.asset_uid)
            )
            src, dst = account_name(src_uid), account_name(dst_uid)
            if src is None or dst is None:
                missing_account += 1
                continue
            if src.lower() == dst.lower():
                skipped += 1
                continue
            description = r.content or f"Transfer to {dst}"
            planned.append(
                PlannedTxn(
                    ref=ref,
                    type="transfer",
                    amount=r.amount,
                    day=r.day,
                    description=description[:MAX_DESCRIPTION_LEN],
                    note=r.memo[:MAX_NOTE_LEN] or None,
                    account=src,
                    to_account=dst,
                )
            )
            continue

        type_ = "income" if r.do_type == "0" else "expense"
        acc = account_name(r.asset_uid)
        if acc is None:
            missing_account += 1
            continue
        category, tag = resolve_category(r.category_uid, type_)
        description = r.content or (tag or category)
        planned.append(
            PlannedTxn(
                ref=ref,
                type=type_,
                amount=r.amount,
                day=r.day,
                description=description[:MAX_DESCRIPTION_LEN],
                note=r.memo[:MAX_NOTE_LEN] or None,
                account=acc,
                category=category,
                tag=tag,
            )
        )

    if missing_account:
        skipped += missing_account
        warnings.append(f"{missing_account} row(s) point to an account missing from the backup and were skipped.")

    iso, symbol, other_currency = _main_currency(backup)
    if other_currency:
        warnings.append(
            f"{other_currency} row(s) are in another currency; their amounts are imported as they are, without conversion."
        )

    planned.sort(key=lambda t: t.day)
    return Plan(
        transactions=planned,
        adjustments=adjustments,
        new_accounts=sorted(n for k, n in used_accounts.items() if k not in existing_accounts),
        existing_accounts=sorted(n for k, n in used_accounts.items() if k in existing_accounts),
        new_categories=sorted(v for k, v in used_categories.items() if k not in existing_categories),
        existing_categories=sorted(v[0] for k, v in used_categories.items() if k in existing_categories),
        duplicates=duplicates,
        skipped=skipped,
        currency_iso=iso,
        currency_symbol=symbol,
        warnings=warnings,
    )


def preview_dict(plan: Plan) -> dict:
    txns = plan.transactions
    counts = Counter(t.type for t in txns)
    return {
        "currency_iso": plan.currency_iso,
        "currency_symbol": plan.currency_symbol,
        "date_from": txns[0].day if txns else None,
        "date_to": txns[-1].day if txns else None,
        "income": counts.get("income", 0),
        "expense": counts.get("expense", 0),
        "transfer": counts.get("transfer", 0),
        "adjustments": len(plan.adjustments),
        "duplicates": plan.duplicates,
        "skipped": plan.skipped,
        "new_accounts": plan.new_accounts,
        "existing_accounts": plan.existing_accounts,
        "new_categories": [name for name, _ in plan.new_categories],
        "existing_categories": plan.existing_categories,
        "warnings": plan.warnings,
        "sample": [
            {
                "date": t.day,
                "type": t.type,
                "amount": t.amount,
                "description": t.description,
                "account": t.account,
                "to_account": t.to_account,
                "category": t.category,
            }
            for t in reversed(txns[-8:])
        ],
    }


# --------------------------------------------------------------------------
# Applying
# --------------------------------------------------------------------------


def apply_plan(db: Session, user_id: int, plan: Plan) -> dict:
    """Write the plan in one transaction. Commits."""
    accounts = {a.name.lower(): a for a in db.query(Account).filter(Account.user_id == user_id)}
    for name in plan.new_accounts:
        acc = Account(user_id=user_id, name=name, type="cash", icon="wallet", removable=True)
        db.add(acc)
        accounts[name.lower()] = acc

    categories = {c.name.lower(): c for c in db.query(Category).filter(Category.user_id == user_id)}
    for name, type_ in plan.new_categories:
        cat = Category(user_id=user_id, name=name, type=type_, icon="other", budget=None)
        db.add(cat)
        categories[name.lower()] = cat

    tags = {t.name: t for t in db.query(Tag).filter(Tag.user_id == user_id)}
    db.flush()

    for adj in plan.adjustments:
        acc = accounts[adj.account.lower()]
        acc.opening_balance = (acc.opening_balance or Decimal("0")) + adj.delta
        db.add(ImportRef(user_id=user_id, source=SOURCE, ref=adj.ref))

    for t in plan.transactions:
        txn = Transaction(
            user_id=user_id,
            type=t.type,
            amount=t.amount,
            description=t.description,
            note=t.note,
            category_id=categories[t.category.lower()].id if t.category else None,
            account_id=accounts[t.account.lower()].id,
            transfer_account_id=accounts[t.to_account.lower()].id if t.to_account else None,
            date=t.day,
        )
        if t.tag:
            tag = tags.get(t.tag)
            if tag is None:
                tag = Tag(user_id=user_id, name=t.tag)
                db.add(tag)
                tags[t.tag] = tag
            txn.tags = [tag]
        db.add(txn)
        db.add(ImportRef(user_id=user_id, source=SOURCE, ref=t.ref))

    db.commit()
    return {
        "transactions": len(plan.transactions),
        "adjustments": len(plan.adjustments),
        "accounts": len(plan.new_accounts),
        "categories": len(plan.new_categories),
        "duplicates": plan.duplicates,
        "skipped": plan.skipped,
    }
