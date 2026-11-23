"""Money Manager (.mmbak) import: preview, import, re-import and safety."""

import io
import os
import sqlite3
import tempfile
import zipfile

import pytest

from app.config import settings

SCHEMA = """
CREATE TABLE ASSETS (uid TEXT, NIC_NAME TEXT, ZDATA TEXT, groupUid TEXT, currencyUid TEXT);
CREATE TABLE ZCATEGORY (uid TEXT, NAME TEXT, TYPE TEXT, pUid TEXT, C_IS_DEL INTEGER);
CREATE TABLE CURRENCY (uid TEXT, ISO TEXT, SYMBOL TEXT);
CREATE TABLE INOUTCOME (
    AID INTEGER PRIMARY KEY, uid TEXT, DO_TYPE TEXT, ZMONEY TEXT, IN_ZMONEY TEXT,
    AMOUNT_ACCOUNT REAL, ZDATE TEXT, WDATE TEXT, assetUid TEXT, toAssetUid TEXT,
    ctgUid TEXT, txUidTrans TEXT, ZCONTENT TEXT, ZDATA TEXT, IS_DEL INTEGER,
    currencyUid TEXT
);
"""

ROWS = [
    # uid, DO_TYPE, ZMONEY, WDATE, asset, toAsset, ctg, trans, content, memo, is_del
    ("t1", "1", "12.50", "2026-10-01", "a1", "", "c-food", "", "Lunch", "with team", 0),
    ("t2", "0", "1500", "2026-10-02", "a2", "", "c-salary", "", "", "", None),
    ("t3", "1", "4.2", "2026-10-03", "a1", "", "c-coffee", "", "Latte", "", 0),  # subcategory
    ("t4", "3", "200", "2026-10-04", "a2", "a1", "", "g1", "", "", 0),  # transfer out leg
    ("t5", "4", "200", "2026-10-04", "a1", "a2", "", "g1", "", "", 0),  # its in leg
    ("t6", "7", "50", "2026-09-01", "a1", "", "-4", "", "", "", 0),  # silent balance +50
    ("t7", "1", "99", "2026-10-05", "a1", "", "c-food", "", "deleted", "", 1),  # deleted
    ("t8", "1", "abc", "2026-10-06", "a1", "", "c-food", "", "bad amount", "", 0),
    ("t9", "0", "10", "2026-10-07", "a1", "", "c-other-inc", "", "Refund", "", 0),
]


def make_backup(rows=ROWS) -> bytes:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        conn = sqlite3.connect(path)
        conn.executescript(SCHEMA)
        conn.executemany(
            "INSERT INTO ASSETS VALUES (?, ?, ?, '1', 'cur1')",
            [("a1", "Cash", "0"), ("a2", "Kapital Bank", "0")],
        )
        conn.executemany(
            "INSERT INTO ZCATEGORY VALUES (?, ?, ?, ?, 0)",
            [
                ("c-food", "Food", "1", "0"),
                ("c-coffee", "Coffee shops", "1", "c-food"),
                ("c-salary", "Salary", "0", ""),
                ("c-other-inc", "Other", "0", ""),
            ],
        )
        conn.execute("INSERT INTO CURRENCY VALUES ('cur1', 'AZN', '₼')")
        conn.executemany(
            "INSERT INTO INOUTCOME (uid, DO_TYPE, ZMONEY, WDATE, assetUid, toAssetUid, ctgUid, "
            "txUidTrans, ZCONTENT, ZDATA, IS_DEL, currencyUid, ZDATE) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cur1', '1759300000000')",
            rows,
        )
        conn.commit()
        conn.close()
        with open(path, "rb") as fh:
            return fh.read()
    finally:
        os.remove(path)


def zipped(data: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("meta.txt", "hello")
        zf.writestr("backup.db", data)
    return buf.getvalue()


def upload(client, path, data, **form):
    return client.post(
        f"/api/import/{path}",
        files={"file": ("money.mmbak", data, "application/octet-stream")},
        data={k: str(v).lower() for k, v in form.items()},
    )


def test_preview_writes_nothing(auth_client):
    before = auth_client.get("/api/transactions").json()
    resp = upload(auth_client, "mmbak/preview", make_backup())
    assert resp.status_code == 200, resp.text
    p = resp.json()
    assert p["currency_iso"] == "AZN" and p["currency_symbol"] == "₼"
    assert (p["income"], p["expense"], p["transfer"], p["adjustments"]) == (2, 2, 1, 1)
    assert p["duplicates"] == 0
    assert p["skipped"] == 1  # bad amount; the deleted row is not counted at all
    assert p["new_accounts"] == ["Cash", "Kapital Bank"]
    # "Food" and "Salary" exist from the default set; "Other" exists as expense
    assert "Other (income)" in p["new_categories"]
    assert set(p["existing_categories"]) >= {"Food", "Salary"}
    assert p["date_from"] == "2026-10-01" and p["date_to"] == "2026-10-07"
    assert auth_client.get("/api/transactions").json() == before


def test_import_maps_rows_and_reimport_skips_them(auth_client):
    resp = upload(auth_client, "mmbak", make_backup(), use_currency=True)
    assert resp.status_code == 200, resp.text
    r = resp.json()
    assert r == {
        "transactions": 5, "adjustments": 1, "accounts": 2, "categories": 1,
        "duplicates": 0, "skipped": 1, "currency_symbol": "₼",
    }
    assert auth_client.get("/api/settings").json()["currency_symbol"] == "₼"

    txns = auth_client.get("/api/transactions", params={"period": "all"}).json()
    by_desc = {t["description"]: t for t in txns}
    assert by_desc["Lunch"]["amount"] == 12.5 and by_desc["Lunch"]["note"] == "with team"
    assert by_desc["Salary"]["type"] == "income"  # empty content falls back to category
    latte = by_desc["Latte"]
    assert latte["tags"] == ["coffee-shops"]  # subcategory -> parent category + tag
    transfer = [t for t in txns if t["type"] == "transfer"]
    assert len(transfer) == 1 and transfer[0]["amount"] == 200

    accounts = {a["name"]: a for a in auth_client.get("/api/accounts").json()}
    # Cash: opening +50 (silent adjustment), -12.5 -4.2 +200 transfer in +10 refund
    assert accounts["Cash"]["opening_balance"] == 50
    assert accounts["Cash"]["net"] == pytest.approx(50 - 12.5 - 4.2 + 200 + 10)
    assert accounts["Kapital Bank"]["net"] == pytest.approx(1500 - 200)

    again = upload(auth_client, "mmbak", make_backup()).json()
    assert again["transactions"] == 0 and again["adjustments"] == 0
    assert again["duplicates"] == 6
    assert len(auth_client.get("/api/transactions", params={"period": "all"}).json()) == len(txns)
    accounts = {a["name"]: a for a in auth_client.get("/api/accounts").json()}
    assert accounts["Cash"]["opening_balance"] == 50


def test_newer_backup_adds_only_new_rows(auth_client):
    upload(auth_client, "mmbak", make_backup())
    newer = ROWS + [("t10", "1", "3", "2026-11-01", "a1", "", "c-food", "", "Bread", "", 0)]
    p = upload(auth_client, "mmbak/preview", make_backup(newer)).json()
    assert (p["expense"], p["duplicates"], p["new_accounts"]) == (1, 6, [])
    assert upload(auth_client, "mmbak", make_backup(newer)).json()["transactions"] == 1


def test_zipped_backup(auth_client):
    resp = upload(auth_client, "mmbak/preview", zipped(make_backup()))
    assert resp.status_code == 200, resp.text
    assert resp.json()["expense"] == 2


def test_orphan_transfer_in_leg_becomes_transfer(auth_client):
    rows = [("x1", "4", "30", "2026-10-04", "a1", "a2", "", "g9", "Top up", "", 0)]
    upload(auth_client, "mmbak", make_backup(rows))
    t = auth_client.get("/api/transactions", params={"period": "all"}).json()[0]
    accounts = {a["id"]: a["name"] for a in auth_client.get("/api/accounts").json()}
    assert accounts[t["account_id"]] == "Kapital Bank"
    assert accounts[t["transfer_account_id"]] == "Cash"


def test_import_is_per_user(client, register):
    alice, bob = register("alice_01"), register("bob_0001")
    client.headers.update(alice["headers"])
    upload(client, "mmbak", make_backup())
    client.headers.update(bob["headers"])
    assert client.get("/api/transactions", params={"period": "all"}).json() == []
    # bob has not imported anything, so nothing counts as a duplicate for him
    assert upload(client, "mmbak/preview", make_backup()).json()["duplicates"] == 0


@pytest.mark.parametrize(
    "data",
    [b"hello world", b"PK\x03\x04garbage", zipped(b"not sqlite"), b"SQLite format 3\x00" + b"\x00" * 50],
    ids=["text", "bad-zip", "zip-without-db", "broken-sqlite"],
)
def test_rejects_non_backups(auth_client, data):
    resp = upload(auth_client, "mmbak/preview", data)
    assert resp.status_code == 422


def test_rejects_other_sqlite_and_views(auth_client):
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        conn = sqlite3.connect(path)
        # INOUTCOME as a view must not be read
        conn.executescript(
            "CREATE TABLE ASSETS (uid TEXT, NIC_NAME TEXT);"
            "CREATE TABLE t (DO_TYPE TEXT, ZMONEY TEXT, assetUid TEXT);"
            "CREATE VIEW INOUTCOME AS SELECT * FROM t;"
        )
        conn.close()
        with open(path, "rb") as fh:
            data = fh.read()
    finally:
        os.remove(path)
    resp = upload(auth_client, "mmbak/preview", data)
    assert resp.status_code == 422
    assert "Money Manager" in resp.json()["detail"]


def test_rejects_too_large(auth_client, monkeypatch):
    monkeypatch.setattr(settings, "MMBAK_MAX_UPLOAD_BYTES", 1000)
    resp = upload(auth_client, "mmbak/preview", make_backup())
    assert resp.status_code == 413


def test_rejects_zip_too_large_unpacked(auth_client, monkeypatch):
    monkeypatch.setattr(settings, "MMBAK_MAX_DB_BYTES", 1000)
    resp = upload(auth_client, "mmbak/preview", zipped(make_backup()))
    assert resp.status_code == 422


def test_requires_login(client):
    assert upload(client, "mmbak/preview", make_backup()).status_code == 401
