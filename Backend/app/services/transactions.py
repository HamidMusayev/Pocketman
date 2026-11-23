import csv
import io
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction
from app.services.periods import period_bounds

CSV_HEADER = ["Date", "Type", "Description", "Category", "Account", "Amount", "To Account"]

MAX_IMPORT_ROWS = 20_000
MAX_NAME_LEN = 100
MAX_DESCRIPTION_LEN = 500

# Cells starting with these are interpreted as formulas by Excel/Sheets
# ("CSV injection"); prefix them with ' on export so they stay plain text.
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def query_transactions(
    db: Session,
    user_id: int,
    period: str = "all",
    year: int | None = None,
    month: int | None = None,
    search: str | None = None,
    category_id: int | None = None,
    account_id: int | None = None,
    type_: str | None = None,
):
    start, end = period_bounds(period, year, month)
    query = db.query(Transaction).filter(Transaction.user_id == user_id)
    if start is not None:
        query = query.filter(Transaction.date >= start, Transaction.date <= end)
    if search:
        query = query.filter(
            Transaction.description.ilike(f"%{_escape_like(search)}%", escape="\\")
        )
    if category_id is not None:
        query = query.filter(Transaction.category_id == category_id)
    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)
    if type_ is not None:
        query = query.filter(Transaction.type == type_)
    return query.order_by(Transaction.date.desc(), Transaction.id.desc()).all()


def to_response_dict(txn: Transaction) -> dict:
    return {
        "id": txn.id,
        "type": txn.type,
        "amount": txn.amount,
        "description": txn.description,
        "category_id": txn.category_id,
        "category_name": txn.category.name if txn.category else None,
        "account_id": txn.account_id,
        "account_name": txn.account.name if txn.account else "",
        "transfer_account_id": txn.transfer_account_id,
        "transfer_account_name": txn.transfer_account.name if txn.transfer_account else None,
        "date": txn.date,
    }


def _csv_safe(value: str) -> str:
    return "'" + value if value.startswith(_FORMULA_PREFIXES) else value


def export_csv(transactions: list[Transaction]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_HEADER)
    for t in transactions:
        writer.writerow(
            [
                t.date.isoformat(),
                t.type,
                _csv_safe(t.description),
                _csv_safe(t.category.name) if t.category else "",
                _csv_safe(t.account.name) if t.account else "",
                f"{t.amount:.2f}",
                _csv_safe(t.transfer_account.name) if t.transfer_account else "",
            ]
        )
    return buffer.getvalue()


def _get_or_create_category(
    db: Session, user_id: int, name: str, type_: str, cache: dict
) -> Category:
    name = name.strip()[:MAX_NAME_LEN]
    key = (name.lower(), type_)
    if key in cache:
        return cache[key]
    candidates = (
        db.query(Category)
        .filter(Category.user_id == user_id, Category.name.ilike(_escape_like(name), escape="\\"))
        .all()
    )
    category = next((c for c in candidates if c.type == type_), None)
    if category is None:
        if candidates:
            # name is unique per user, so an income category can't share a
            # name with an expense one
            raise ValueError(f"Category '{name}' already exists as {candidates[0].type}")
        category = Category(user_id=user_id, name=name, type=type_, icon="other", budget=None)
        db.add(category)
        db.flush()
    cache[key] = category
    return category


def _get_or_create_account(db: Session, user_id: int, name: str, cache: dict) -> Account:
    name = name.strip()[:MAX_NAME_LEN]
    key = name.lower()
    if key in cache:
        return cache[key]
    account = (
        db.query(Account)
        .filter(Account.user_id == user_id, Account.name.ilike(_escape_like(name), escape="\\"))
        .first()
    )
    if account is None:
        account = Account(user_id=user_id, name=name, type="cash", icon="wallet", removable=True)
        db.add(account)
        db.flush()
    cache[key] = account
    return account


def import_csv(db: Session, user_id: int, content: str) -> dict:
    reader = csv.DictReader(io.StringIO(content))
    required = {"Date", "Type", "Description", "Category", "Account", "Amount"}
    if reader.fieldnames is None or not required.issubset(set(reader.fieldnames)):
        return {
            "created": 0,
            "skipped": 0,
            "errors": [{"row": 0, "reason": f"CSV must have columns: {', '.join(sorted(required))}"}],
        }

    category_cache: dict = {}
    account_cache: dict = {}
    created = 0
    skipped = 0
    errors: list[dict] = []

    for i, row in enumerate(reader, start=2):  # row 1 is the header
        if i - 1 > MAX_IMPORT_ROWS:
            errors.append({"row": i, "reason": f"Only the first {MAX_IMPORT_ROWS} rows are imported"})
            break
        try:
            type_ = (row.get("Type") or "").strip().lower()
            if type_ not in ("income", "expense", "transfer"):
                raise ValueError(
                    f"Type must be 'income', 'expense' or 'transfer', got '{row.get('Type')}'"
                )

            amount = float(row.get("Amount") or "")
            if not (0 < amount < 1e12):
                raise ValueError("Amount must be greater than 0")

            description = (row.get("Description") or "").strip()[:MAX_DESCRIPTION_LEN]
            if not description:
                raise ValueError("Description cannot be empty")

            raw_date = (row.get("Date") or "").strip()
            try:
                txn_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError(f"Date must be YYYY-MM-DD, got '{raw_date}'") from None

            account_name = (row.get("Account") or "Main").strip() or "Main"
            account = _get_or_create_account(db, user_id, account_name, account_cache)

            if type_ == "transfer":
                to_name = (row.get("To Account") or "").strip()
                if not to_name:
                    raise ValueError("Transfer requires a 'To Account'")
                to_account = _get_or_create_account(db, user_id, to_name, account_cache)
                if to_account.id == account.id:
                    raise ValueError("Transfer source and destination must differ")
                db.add(
                    Transaction(
                        user_id=user_id,
                        type="transfer",
                        amount=amount,
                        description=description,
                        category_id=None,
                        account_id=account.id,
                        transfer_account_id=to_account.id,
                        date=txn_date,
                    )
                )
            else:
                category_name = (row.get("Category") or "Other").strip() or "Other"
                category = _get_or_create_category(
                    db, user_id, category_name, type_, category_cache
                )
                db.add(
                    Transaction(
                        user_id=user_id,
                        type=type_,
                        amount=amount,
                        description=description,
                        category_id=category.id,
                        account_id=account.id,
                        date=txn_date,
                    )
                )
            created += 1
        except ValueError as exc:
            skipped += 1
            errors.append({"row": i, "reason": str(exc)})

    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors[:200]}
