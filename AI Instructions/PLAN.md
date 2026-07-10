# Pocketman — Implementation Plan

Read [`STRUCTURE.md`](STRUCTURE.md) first for repo layout and conventions. This document is the phased build plan. Check off items as they land and mirror status into [`PROGRESS.md`](PROGRESS.md).

## Decisions locked in (from stakeholder Q&A, 2026-07-04)

1. **Auth**: single-user, password/PIN lock (not multi-user, not open). One password protects the whole app.
2. **Recurring engine**: manual "Catch up" button, but backend tracks real per-rule `next_due_date` and only generates occurrences actually due — not the prototype's naive "list every rule" mock.
3. **Docker topology**: two containers — FastAPI backend, nginx-served React build (frontend nginx proxies `/api/*` to backend so the browser only talks to one origin; CORS also configured in FastAPI as a dev-mode fallback when running `vite dev` directly against the backend).
4. **Scope**: full CRUD parity with real persistence everywhere the UI implies an edit/delete — including things the prototype only stubbed (account "edit", CSV "Import"). No features invented beyond what the UI/design doc imply.

## Tech stack

- **Backend**: Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2.0, Alembic, Pydantic v2, passlib[bcrypt], python-jose[cryptography], python-dateutil, pytest + httpx.
- **Frontend**: React 19, TypeScript, Vite, React Router v7, TanStack Query v5, Axios, plain CSS with custom properties (no UI framework — the design is bespoke), Vitest + React Testing Library. (The pre-scaffolded `Front/` shipped React 19 / Router v7; APIs used are compatible with the v18/v6 originally planned.)
- **DB**: SQLite (file-backed, mounted as a Docker volume for persistence).

## Data model

| Table | Columns |
|---|---|
| `settings` | id=1 singleton · password_hash · accent_color (default `#FCD535`) · currency_symbol (default `$`) · show_cents (bool, default true) · setup_complete (bool) — **note:** the `density` column was removed post-build (terminal mode dropped; see 2026-07-04 decision), app is always editorial |
| `accounts` | id · name (unique) · type (`cash`\|`savings`\|`card`\|`investment`) · icon (`wallet`\|`bank`\|`card`) · removable (bool, default true) |
| `categories` | id · name (unique) · type (`income`\|`expense`) · icon (one of the 18 icon keys) · budget (nullable float) |
| `transactions` | id · type (`income`\|`expense`\|`transfer`) · amount (float > 0) · description · category_id FK (**nullable** — null for transfers) · account_id FK (source) · transfer_account_id FK (**nullable** — destination, set only for transfers) · date |
| `recurring_rules` | id · description · amount · category_id FK · account_id FK · type · frequency (`Daily`\|`Weekly`\|`Monthly`\|`Yearly`) · next_due_date |
| `pending_approvals` | id · recurring_rule_id FK · description · amount · category_id FK · account_id FK · type · due_date (snapshotted from the rule at generation time so later rule edits don't retroactively change a pending item) |

Default seed on first setup (`/api/auth/setup`): one Account `Main` (cash/wallet, `removable=false`), and the 16 categories from the prototype (`Salary`, `Freelance` as income; `Car`, `Dining`, `Entertainment`, `Food`, `Fuel`, `Healthcare`, `Housing`, `Personal Care`, `Subscriptions`, `Transport`, `Travel`, `Utilities`, `Fitness`, `Other` as expense), all with `budget = null` (no presumed budgets — user sets their own). **No demo transactions are seeded** — a real product starts empty.

## Phase 0 — Scaffolding (repo, docs)
- [x] Create `Front/`, `Backend/`, `Setup/`, `AI Instructions/`.
- [x] Write `STRUCTURE.md`, `PLAN.md`, `PROGRESS.md`.

## Phase 1 — Backend skeleton ✅
- [x] `Backend/requirements.txt`, `app/config.py` (pydantic-settings: `SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `ACCESS_TOKEN_EXPIRE_MINUTES`).
- [x] `app/database.py` (engine, `SessionLocal`, `Base`, `get_db` dependency).
- [x] `app/main.py` (FastAPI app, CORS middleware, router mounting, `/api/health`).
- [x] Alembic initialized, `alembic.ini` pointed at `DATABASE_URL`, first migration = full schema.
- [x] `Backend/Dockerfile` (python:3.12-slim, installs deps, runs `alembic upgrade head` then `uvicorn`).
- [x] `Backend/tests/conftest.py` with a per-test throwaway SQLite DB + `TestClient`.

Note: dropped `passlib` (unmaintained, incompatible with bcrypt>=4.1) in favor of calling the `bcrypt` package directly in `app/security.py`. Password length capped at 72 bytes (bcrypt's hard limit).

**Acceptance**: `uvicorn app.main:app` boots, `GET /api/health` returns 200, `alembic upgrade head` creates all tables in a fresh sqlite file.

## Phase 2 — Auth + Settings module ✅
- Endpoints:
  - `GET /api/auth/status` → `{setup_complete: bool}` (public)
  - `POST /api/auth/setup {password}` → `{token}` — only if `!setup_complete`; hashes password, seeds default account+categories, returns JWT (public)
  - `POST /api/auth/login {password}` → `{token}` (public)
  - `POST /api/auth/change-password {current_password, new_password}` (auth required)
  - `GET /api/settings` / `PUT /api/settings {accentColor?, currencySymbol?, showCents?}` (auth required — `density` field removed post-build)
- JWT: HS256, 7-day expiry, `Authorization: Bearer <token>`. `get_current_user` dependency guards every router below.
- [x] Models + schemas + router + service (hash/verify, JWT encode/decode).
- [x] Wire seed logic into `/auth/setup`.

**Acceptance**: fresh DB → `/auth/status` false → `/auth/setup` creates password + seed data + returns usable token → protected route rejects missing/invalid token with 401 → `/auth/login` works with correct password, 401 on wrong password.

## Phase 3 — Accounts module ✅
- `GET /api/accounts` → each item includes computed `net` (sum of signed transactions) and `transactionCount`.
- `POST /api/accounts {name, type, icon}`
- `PUT /api/accounts/{id} {name?, type?, icon?}`
- `DELETE /api/accounts/{id}` → 409 if `removable=false`, if it's the last remaining account, or if any transaction/recurring rule references it (financial history is never silently cascade-deleted).
- [x] Model, schema, router, service.

**Acceptance**: cannot delete `Main`, the last account, or an account with transactions/recurring rules pointing at it; net worth math matches sum of signed transactions per account.

## Phase 4 — Categories module ✅
- `GET /api/categories`
- `POST /api/categories {name, type, icon, budget?}`
- `PUT /api/categories/{id} {name?, icon?, budget?}`
- `DELETE /api/categories/{id}` → 409 if referenced by any transaction or recurring rule (real persistence needs referential safety the prototype didn't need).
- `GET /api/categories/budget-summary?period=&year=&month=` → per-category `{spent, budget, pctUsed}` + overall ring `{spentTotal, budgetTotal, pct}`.
- [x] Model, schema, router, service.

**Acceptance**: budget-summary math matches prototype's ring logic (`pct >= 100` → red, `>= 80` → yellow, else green); delete blocked with a clear error message when in use.

## Phase 5 — Transactions module ✅
- `GET /api/transactions?period=monthly|all|range&year=&month=&search=&category_id=&account_id=&type=` → sorted newest-first.
- `POST /api/transactions {type, amount, description, category_id, account_id, date}`
- `PUT /api/transactions/{id}` (full edit — prototype had no edit UI at all for transactions; add it for real CRUD parity)
- `DELETE /api/transactions/{id}`
- `GET /api/transactions/export?<same filters>` → streamed CSV, columns `Date,Type,Description,Category,Account,Amount` (matches prototype's `exportCSV()` exactly).
- `POST /api/transactions/import` (multipart CSV, same columns) → `{created, skipped, errors: [{row, reason}]}`; unknown category/account names are auto-created (category defaults to the row's type + `other` icon; account defaults to `cash`/`wallet`).
- `period=monthly` filters by `(year, month)`; `period=range` = last 90 days from **real server `date.today()`** (not a hardcoded date); `period=all` = no date filter.
- [x] Model, schema, router, service (CSV read/write via Python `csv` module + `io.StringIO`).
- [x] **Transfers** (added post-plan, 2026-07-09) — `type: "transfer"` moves money between accounts: `account_id` is the source, `transfer_account_id` the destination, `category_id` is null. Excluded from all income/expense aggregation (summary, trend, breakdown, budgets) and contributes 0 to cumulative net worth; per-account `net` reflects −source/+destination so the total is unchanged. CSV gains a trailing optional `To Account` column (6-column income/expense CSVs still import). Migration `b2f1a3c4d5e6` adds the column + makes `category_id` nullable (batch mode; existing rows preserved). Tests in `tests/test_transfers.py`.

**Acceptance**: export → import round-trip reproduces the same transactions; period filters match prototype's `inPeriod()` semantics; malformed CSV rows are reported per-row, not fatal to the whole import; a transfer never changes income/expense/total-net-worth, only the two accounts' balances.

## Phase 6 — Recurring rules + pending approvals ✅
- `GET /api/recurring` / `POST /api/recurring {description, amount, category_id, account_id, type, frequency, start_date?}` (`start_date` defaults to today; becomes `next_due_date`) / `PUT /api/recurring/{id}` / `DELETE /api/recurring/{id}`
- `POST /api/recurring/catch-up` → for every rule with `next_due_date <= today`, generate one `PendingApproval` per missed occurrence (looping `next_due_date = advance(next_due_date, frequency)` until `> today`, capped at 36 iterations as a safety valve), snapshotting rule fields onto each pending row, then persist the rule's advanced `next_due_date`. Idempotent: calling twice in a row produces no duplicates.
- `GET /api/recurring/pending`
- `POST /api/recurring/pending/{id}/approve` → creates a real `Transaction` dated the pending item's `due_date`, deletes the pending row.
- `DELETE /api/recurring/pending/{id}` → dismiss without posting (rule cursor already advanced, so it's gone for good — matches the prototype's "Skip").
- Frequency advance uses `dateutil.relativedelta` (`Daily`→+1d, `Weekly`→+7d, `Monthly`→+1mo, `Yearly`→+1y) so month/year-end edge cases (e.g. Jan 31 → Feb 28) clamp correctly.
- [x] Models, schema, router, service (`services/recurring.py` holds the due-date loop, unit-test this in isolation).

**Acceptance**: creating a rule with `start_date` in the past and calling catch-up produces exactly the right number of pending occurrences (test with a rule 3 months overdue); approving posts a transaction dated the *occurrence* date, not today; calling catch-up twice back-to-back is a no-op the second time.

## Phase 7 — Stats/Charts aggregation ✅
- `GET /api/stats/summary?period=&year=&month=` → `{income, expense, balance, savingsRate}`
- `GET /api/stats/trend?months=6&year=&month=` → last N months ending at the given month, `[{label, year, month, income, expense}]`
- `GET /api/stats/category-breakdown?period=&year=&month=&type=expense` → `[{categoryId, name, amount, pct}]` sorted descending by amount (frontend assigns ramp colors by this sort order, matching the prototype)
- `GET /api/stats/cumulative-balance` → all-time running balance series `[{date, balance}]`, ignores period filter (matches prototype: built from *all* transactions, not the viewed period)
- `GET /api/stats/top-categories?period=&year=&month=&limit=7`
- `GET /api/stats/net-worth` → `{total, accounts: [{id, name, net, transactionCount}]}`
- [x] `services/stats.py` — pure functions over a list of transactions, unit-tested against hand-computed fixtures; routers just call the service.

**Acceptance**: numbers match a hand-computed fixture set (build one small fixture with known income/expense/category splits and assert every endpoint against it).

## Phase 8 — Backend test suite ✅
- [x] `tests/test_auth.py`, `test_accounts.py`, `test_categories.py`, `test_transactions.py`, `test_recurring.py`, `test_stats.py`.
- [x] Recurring engine edge cases: multi-period-overdue catch-up, idempotent re-run, month-end date advancing.
- [x] CSV import edge cases: bad type/amount/date rows reported per-row, unknown category/account auto-create.

**Acceptance**: `pytest` green (46/46), coverage over `services/` meaningfully exercises branches (not just happy path). Verified: `cd Backend && ./.venv/Scripts/python -m pytest -q` → `46 passed`.

## Phase 9 — Frontend skeleton ✅
- [x] Vite + React + TS scaffold, `theme.css` with CSS custom properties transcribed from `DESIGN-binance.md` §Colors/Typography/Spacing/Rounded (`--canvas`, `--card`, `--elev`, `--yellow`, `--up`, `--down`, `--muted`, `--line`, `--sans` (Inter), `--mono` (JetBrains Mono), plus spacing/radius scale).
- [x] `api/client.ts` (axios instance, base URL from `VITE_API_BASE_URL`, bearer token interceptor, 401 → redirect to login).
- [x] React Router routes: `/setup`, `/login`, and protected `/overview`, `/recurring`, `/charts`, `/categories`, `/accounts`, `/settings`.
- [x] `icons.ts` — port the full `ICON` path map verbatim from the prototype.
- [x] `lib/colorRamp.ts` — port the `RAMP` array verbatim.
- [x] `lib/money.ts` — currency formatting matching prototype's `money()`.
- [x] `Front/Dockerfile` (multi-stage) + `nginx.conf` (serve `dist/`, proxy `/api/` → `http://backend:8000/api/`).

**Acceptance**: `npm run dev` renders a themed shell; `npm run build` + nginx container serves it and proxies API calls without CORS errors.

## Phase 10 — Auth + Settings pages ✅
- [x] `Setup.tsx` (first-run password creation, only reachable when `/auth/status` says not set up).
- [x] `Login.tsx`.
- [x] `AuthContext` (token in `localStorage`, `useAuth()` hook), `ProtectedRoute`.
- [x] `Settings.tsx` — accent color picker (from the prototype's option list: yellow/turquoise/green/blue), currency symbol input, show-cents toggle, change-password form. (Density toggle was built then removed — see the 2026-07-04 "terminal density removed" decision; app is always editorial.)

**Acceptance**: cold start forces `/setup`; after setup, reload lands on `/login`; wrong password shows inline error; changing accent updates the whole app live.

## Phase 11 — Shared shell: TopBar + period controls ✅
- [x] `TopBar` — logo, "Connected · pocketman.db" status dot, 5 tabs, settings gear + Lock. (The density toggle that lived here was removed — see the 2026-07-04 decision.)
- [x] `PeriodControls` — Monthly / All time / Date range pills + month `‹ Jul 2026 ›` nav (only shown for Monthly).
- [x] `SummaryCards` — single hero band with net balance + inline income/expenses/savings-rate (the prototype's editorial `d.hero` branch; the terminal 3-up branch was removed with terminal density).
- [x] A shared "current period" state (query params) that every page's data hooks read from, so switching Monthly month or All-time/Date-range instantly refetches every tab's data.

**Acceptance**: switching tabs preserves the selected period; changing period refetches every tab's data.

## Phase 12 — Accounts tab ✅
- [x] Net worth header card, account list (icon, name, type + txn count, net, **working** edit — inline rename/type/icon change — and remove for `removable` accounts), add-account form.

**Acceptance**: editing an account persists and reflects immediately in every other tab that shows account names (transaction filters, forms).

## Phase 13 — Categories tab ✅
- [x] Budget ring header (spent/total/remaining across budgeted categories), category cards grid (icon, name, progress bar colored by ring-color rule, spent text, editable budget input + Save), add-category and edit/remove category (real CRUD, prototype only had remove).

**Acceptance**: budget bar colors match the `>=100 red / >=80 yellow / else green` rule; removing a category in use is blocked with a visible error instead of silently failing.

## Phase 14 — Overview tab (transactions) ✅
- [x] Add-transaction card: Expense/Income toggle, amount input (currency-prefixed), description, category chips (filtered to the selected type, ported icons), account select, Add button.
- [x] Search bar, Export CSV (downloads via browser), **working** Import CSV (file picker → multipart upload → shows the `{created, skipped, errors}` summary — prototype's Import button was a dead stub).
- [x] Transaction list: category icon, description, `category · account · date` meta, signed colored amount, delete, **and edit** (prototype had none — click a row to edit in place or via a modal).
- [x] Filter selects: category / account / type, wired to the backend query params.

**Acceptance**: adding, editing, deleting a transaction all refetch stats/charts elsewhere; CSV export/import round-trips.

## Phase 15 — Recurring tab ✅
- [x] Add-recurring form (description, amount, category, account, type toggle, frequency, optional start date).
- [x] Pending-approval list with Approve/Skip.
- [x] Recurring rules list with remove.
- [x] "Catch up now" button.

**Acceptance**: catch-up against a rule whose `next_due_date` is in the past produces the right pending items; approving posts a transaction visible immediately in Overview/Charts.

## Phase 16 — Charts tab ✅
- [x] Stat strip (savings rate, top category, avg/day, largest expense) — 4-up cards.
- [x] Income vs Expenses bar chart (6 months ending at viewed month).
- [x] Expenses-by-category donut + legend (SVG `stroke-dasharray` ring segments, ported math).
- [x] Cumulative balance line/area chart (all-time, SVG path + gradient fill + y-axis labels + end-point dot).
- [x] Top spending categories horizontal bar ranking.
- [x] **Monthly calendar heat-grid** (added post-plan, 2026-07-04) — Sun-first month grid; each day shows income/expense (compact) with a net-based tint and a today ring; follows the shared period month with its own `‹ › ` nav. Math in `lib/calendar.ts` (unit-tested).
- All four core visualizations are hand-rolled SVG (no charting library), porting the exact math from `Pocketman.dc.html`'s `renderVals()`.

**Acceptance**: chart pure-math functions have unit tests asserting against the fixture set from Phase 7; charts render correctly with 0, 1, and many data points (empty-state text when no expenses in period).

## Phase 17 — Frontend test suite ✅
- [x] Vitest unit tests for `lib/money.ts`, `lib/colorRamp.ts`, and all chart-math helpers.
- [x] React Testing Library tests for the add-transaction form, recurring catch-up flow, and auth gate redirect behavior.

## Phase 18 — Docker Compose / Setup ✅
- [x] `Setup/docker-compose.yml`: `backend` (build `../Backend`, env from `.env`, named volume `pocketman-data:/app/data` for the sqlite file), `frontend` (build `../Front`, depends_on backend, port `3000:80`).
- [x] `Setup/.env.example` (`SECRET_KEY`, `CORS_ORIGINS`, `VITE_API_BASE_URL`).
- [x] `Setup/docker-compose.override.yml` for local dev (bind-mount source, `uvicorn --reload`, `vite dev` with proxy) — optional convenience, documented in README.

**Acceptance**: `docker compose -f Setup/docker-compose.yml up --build` brings up a working app at `http://localhost:3000` end to end, data survives `docker compose down` + `up` (volume persistence).

## Phase 19 — End-to-end verification ✅
- [x] Manually exercise the golden path in a browser: setup password → add accounts/categories → add transactions → add a recurring rule and catch it up → check charts and budgets update → export/import CSV → change settings.
- [x] Fix anything broken, then mark `PROGRESS.md` complete.

## Explicit non-goals (out of scope unless asked)
- Multi-user accounts / registration.
- Multi-currency conversion (currency is a single display symbol, no FX).
- Push notifications / email alerts for budgets or bills.
- Bank sync / Plaid-style integrations.
- Light theme (prototype and design doc treat this surface as dark-only; light mode was documented for *marketing* pages, not this dashboard).
