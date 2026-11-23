# Pocketman — Structure Reference (for AI agents)

This file orients any agent (human or AI) picking up this repo cold. Read this before `PLAN.md` and `PROGRESS.md`.

## What this project is

**Pocketman** is a single-user personal finance tracker (transactions, recurring bills, budgets, accounts, charts) rebuilt from a Claude-generated HTML/JS UI prototype into a real product:

- **Backend**: Python FastAPI + SQLAlchemy + SQLite
- **Frontend**: React + TypeScript + Vite
- **Packaging**: Docker Compose (two containers: backend, nginx-served frontend)
- Single user, protected by a password lock (no multi-user accounts).

The original prototype lives in `UI Design/` — **do not edit it**. It's the visual/behavioral spec, not source code:
- `UI Design/Pocketman.dc.html` + `support.js` — a "design compiler" mock (custom `<x-dc>` templating, not real HTML/JS you can run as-is). Read it as pseudocode for exact layout, copy, and interaction logic.
- `UI Design/uploads/DESIGN-binance.md` — the extracted design-token system (colors, type scale, spacing, component specs) that the visual style is built on. This is the source of truth for CSS variables/tokens.
- `UI Design/uploads/*.png` — earlier-iteration screenshots of the same app (different accent color/name — "Finance Tracker" — but identical structure). Useful as a visual reference for layout when the `.dc.html` markup is ambiguous.

## Top-level layout

```
Pocketman/
├── UI Design/            # prototype + design spec — reference only, read-only
├── Front/                # React + TypeScript + Vite app
├── Backend/               # FastAPI + SQLAlchemy + SQLite app
├── Setup/                 # docker-compose.yml, Dockerfiles are referenced from here
└── AI Instructions/        # PLAN.md, PROGRESS.md, STRUCTURE.md (this file)
```

## Backend layout (`Backend/`)

```
Backend/
├── app/
│   ├── main.py              # FastAPI app factory, CORS, router mounting
│   ├── config.py            # pydantic-settings (SECRET_KEY, DATABASE_URL, CORS_ORIGINS, ...)
│   ├── database.py          # SQLAlchemy engine/session, get_db dependency
│   ├── security.py          # password hashing, JWT encode/decode, current-user dependency
│   ├── models/               # SQLAlchemy ORM models (one file per entity)
│   │   ├── settings.py       # Settings singleton (password_hash, accent, currency, showCents)
│   │   ├── account.py
│   │   ├── category.py
│   │   ├── transaction.py
│   │   └── recurring.py      # RecurringRule + PendingApproval
│   ├── schemas/               # Pydantic request/response models, mirrors models/
│   ├── routers/                # one router per module — see PLAN.md for endpoint contracts
│   │   ├── auth.py
│   │   ├── settings.py
│   │   ├── accounts.py
│   │   ├── categories.py
│   │   ├── transactions.py
│   │   ├── recurring.py
│   │   └── stats.py
│   ├── services/               # business logic kept out of routers (recurring engine, csv import/export, stats aggregation)
│   └── seed.py                 # first-run default Account("Main") + default Category set
├── alembic/                    # migrations (alembic init layout)
├── tests/                      # pytest, mirrors routers/services
├── requirements.txt
├── Dockerfile
└── pocketman.db                # sqlite file, gitignored, created at runtime (mounted volume in docker)
```

## Frontend layout (`Front/`)

```
Front/
├── src/
│   ├── main.tsx                  # QueryClientProvider > AuthProvider > BrowserRouter > App
│   ├── App.tsx                   # route table + auth gate (route guards from auth/guards.tsx)
│   ├── theme.css                 # CSS custom properties ported from DESIGN-binance.md (+ the fixed spacing scale)
│   ├── api/                      # axios client + one module per backend router (accounts.ts, transactions.ts, ...) + types.ts
│   ├── auth/                     # AuthContext, guards (RootRedirect/Setup/Login/Protected), Setup.tsx, Login.tsx
│   ├── context/PeriodContext.tsx # shared period state (monthly/all/range + month nav); usePeriod / usePeriodParams
│   ├── components/               # shared UI shell + widgets:
│   │   ├── TopBar (top bar + phone bottom nav) / PeriodPicker / PendingPanel / Layout / Logo
│   │   ├── CategoryIcon.tsx      # renders an icons.ts glyph by key
│   │   ├── Modal / AddTransactionModal / TransactionEditModal / CategoryFormModal / RecurringFormModal   # add/edit dialogs (bottom sheets on phones)
│   │   └── charts/               # TrendBars, CategoryDonut, CumulativeLineChart, MonthCalendar (hand-rolled SVG/grid)
│   ├── icons.ts                  # ported ICON path map (one SVG path array per icon key; keep in sync w/ constants.py)
│   ├── pages/                    # Overview, Charts, Budget (categories + recurring), Accounts, Settings (+ *.test.tsx)
│   ├── hooks/                    # TanStack Query hooks per resource + queryKeys.ts + useCategoryIcons.ts
│   └── lib/                      # pure helpers, unit-tested: money.ts, dates.ts, charts.ts, calendar.ts, colorRamp.ts, theme.ts, themeMode.ts, constants.ts
├── index.html
├── package.json
├── vite.config.ts                # dev server proxies /api -> localhost:8000; also holds the vitest config
├── Dockerfile                    # multi-stage: node build -> nginx serve (uses `npm install`, see PROGRESS decisions)
└── nginx.conf                    # serves dist/ with SPA fallback, proxies /api/* to the backend service
```

## Setup layout (`Setup/`)

```
Setup/
├── docker-compose.yml         # backend + frontend services, named volume for sqlite data
├── docker-compose.override.yml # dev convenience (hot reload) — optional, applied automatically by `docker compose` in dev
└── .env.example                # SECRET_KEY, CORS_ORIGINS, VITE_API_BASE_URL, etc.
```
Dockerfiles live next to the code they build (`Backend/Dockerfile`, `Front/Dockerfile`); `Setup/docker-compose.yml` references them via relative `build.context`.

## Conventions

- **Money**: stored/transported as floats (SQLite has no fixed-point type); rounding/display formatting happens in the frontend only (`lib/money.ts`), matching the prototype's `money()` helper.
- **Dates**: ISO `YYYY-MM-DD` strings over the wire, `date` columns in SQLite.
- **Auth**: JWT bearer token in `Authorization` header, issued by `/api/auth/setup` or `/api/auth/login`, stored in `localStorage` on the frontend. Every router except `/api/auth/*` requires it.
- **IDs**: integer autoincrement primary keys everywhere (prototype uses client-generated string ids like `t1`, `r1` — those are UI-only artifacts, not a schema requirement).
- **Category icon keys** and **account icon keys** are a closed set defined once in `Backend/app/models/category.py` / `icons.ts` (frontend) — keep both lists in sync. See the `ICON` map in `UI Design/Pocketman.dc.html` (search for `const ICON = {`) for the canonical path data.
- **Colors for charts** (donut segments) are assigned by sort order from a fixed ramp array (`RAMP` in the prototype), not stored per-category. Port the same ramp array into `Front/src/lib/colorRamp.ts`.
- **"Today"**: the prototype hardcodes `2026-07-04`. The real backend must use the actual server date (`date.today()` / `datetime.now()`), never a hardcoded date.

## Where the plan and progress live

- [`PLAN.md`](PLAN.md) — phased implementation plan, one phase per module, with data model + endpoint contracts + acceptance criteria.
- [`PROGRESS.md`](PROGRESS.md) — live status tracker. Update the relevant row/checklist immediately after finishing a phase, not in a batch at the end.

Any agent resuming this project should: read this file → read `PROGRESS.md` to see what's done → read the relevant phase in `PLAN.md` → continue from there.
