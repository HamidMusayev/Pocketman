# Pocketman — Setup

Two ways to run the app: the packaged Docker stack (recommended) or a local
dev setup with hot reload.

## Run with Docker (recommended)

From the repository root:

```bash
docker compose -f Setup/docker-compose.yml up --build
```

Then open <http://localhost:3000>.

- **frontend** — nginx serving the built React app on port 3000, proxying
  `/api/*` to the backend on the internal docker network.
- **backend** — FastAPI/Uvicorn on port 8000 (internal only). On startup it
  runs `alembic upgrade head`, then serves.
- **data** — the SQLite file lives in the named volume `pocketman-data`, so it
  survives `docker compose down` + `up`. To wipe it: `docker compose -f
  Setup/docker-compose.yml down -v`.

First launch shows a one-time password setup screen; after that the app is
locked behind that password.

### Configuration

Copy `Setup/.env.example` to `Setup/.env` and edit it (at minimum set a real
`SECRET_KEY`). `docker compose` picks up `.env` automatically when run from the
`Setup/` folder, or pass `--env-file Setup/.env`.

| Variable | Purpose | Default |
|---|---|---|
| `SECRET_KEY` | Signs JWT auth tokens — **change in production** | `dev-secret-key-change-me` |
| `CORS_ORIGINS` | Allowed origins for the API (dev only; prod proxies same-origin) | `http://localhost:3000` |
| `FRONTEND_PORT` | Host port for the frontend | `3000` |

## Run locally (hot reload, no Docker)

Two terminals.

**Backend** (Python 3.12+):

```bash
cd Backend
python -m venv .venv
.venv/Scripts/activate      # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend** (Node 20+):

```bash
cd Front
npm install
npm run dev
```

The Vite dev server runs on <http://localhost:5173> and proxies `/api` to
`http://localhost:8000` (see `Front/vite.config.ts`), so no CORS or base-URL
config is needed for local development.

## Tests

```bash
# backend
cd Backend && .venv/Scripts/python -m pytest -q

# frontend
cd Front && npm test
```
