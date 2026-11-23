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

Pocketman is multi-user: each person creates an account (username + password)
and only ever sees their own data. Usernames are 6-32 characters of lowercase
letters, digits and `_`; passwords need 8+ characters with letters and digits.
Login is rate limited (5 failed attempts per username per 15 minutes).

**Upgrading from the single-user version:** the first start runs a migration
that moves all existing data into an owner account named `OWNER_USERNAME`
(default `pocketman`) with the old password. Sign in with that, then rename it
and set a stronger password under Settings → Account.

### Configuration

Copy `Setup/.env.example` to `Setup/.env` and edit it (at minimum set a real
`SECRET_KEY`). `docker compose` picks up `.env` automatically when run from the
`Setup/` folder, or pass `--env-file Setup/.env`.

| Variable | Purpose | Default |
|---|---|---|
| `SECRET_KEY` | Signs JWT auth tokens. If unset, a placeholder, or under 32 chars, a random key is generated and kept in the data volume | generated |
| `ALLOW_REGISTRATION` | Let new people sign up (`false` closes sign-ups) | `true` |
| `OWNER_USERNAME` | Username given to pre-existing single-user data on upgrade | `pocketman` |
| `CORS_ORIGINS` | Allowed origins for the API (dev only; prod proxies same-origin) | `http://localhost:3000` |
| `FRONTEND_PORT` | Host port for the frontend | `3000` |

### Access from other devices on your network

`docker-compose.yml` publishes the frontend as `${FRONTEND_PORT:-3000}:80` with no
host IP, so Docker binds it on **all** interfaces (`0.0.0.0:3000`), not just
loopback. Any device on the same network — phone, tablet, another laptop — can
reach it at `http://<host-ip>:3000`. The `/api` calls are proxied by nginx on that
same origin, so there is no CORS or extra configuration to do.

Find the host's LAN address:

```bash
ipconfig                      # Windows — the IPv4 address of your active adapter
ip -4 addr show scope global  # Linux / macOS
```

Then browse to e.g. <http://192.168.0.179:3000> and log in as usual.

If the page times out from another device but works locally, the host firewall is
dropping the inbound connection:

- **Windows** — Docker Desktop's own rule may be scoped to the Public profile
  while your Wi-Fi is Private. Add a rule for the port, in an **Administrator**
  PowerShell:

  ```powershell
  New-NetFirewallRule -DisplayName "Pocketman 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Profile Private -Action Allow
  ```

- **Linux** — Docker's iptables `DNAT` rules land in `PREROUTING`, ahead of the
  `INPUT` chain, so published container ports usually bypass `ufw`/`firewalld` and
  are already reachable without opening anything.

Two caveats. A DHCP-assigned host IP can change after a reboot — reserve it in your
router if you want a stable bookmark. And publishing on `0.0.0.0` means everyone on
the network can reach the login screen, so set a real password and a real
`SECRET_KEY`. To restrict it back to the host only, bind the published port
explicitly in `docker-compose.yml`:

```yaml
    ports:
      - "127.0.0.1:${FRONTEND_PORT:-3000}:80"
```

### Updating a running stack

After pulling changes (or editing the code yourself), rebuild and restart in one
step from the repository root:

```bash
docker compose -f Setup/docker-compose.yml up --build -d
```

**`--build` is not optional.** Both images bake the code in at build time — the
frontend compiles to static files that nginx then serves, and the backend copies
`app/` into the image — so without it Compose reuses the existing images and
nothing you changed appears. `-d` runs detached; Compose recreates only the
containers whose image actually changed, so a backend-only change leaves the
frontend container running untouched.

Two things take care of themselves:

- **Migrations.** The backend's entrypoint runs `alembic upgrade head` before
  uvicorn on every start, so a schema change is applied as the container comes up.
- **Your data.** The SQLite file lives in the `pocketman-data` named volume, not
  in the image. Rebuilding, recreating and `down` all leave it alone.

| Task | Command (from the repo root) |
|---|---|
| Rebuild everything | `docker compose -f Setup/docker-compose.yml up --build -d` |
| Rebuild one service | `docker compose -f Setup/docker-compose.yml up --build -d frontend` |
| Watch it come up | `docker compose -f Setup/docker-compose.yml logs -f` |
| Check what's running | `docker compose -f Setup/docker-compose.yml ps` |
| Stop, keeping data | `docker compose -f Setup/docker-compose.yml down` |
| Reclaim old image layers | `docker image prune` |

> **`down -v` erases everything.** The `-v` flag deletes the `pocketman-data`
> volume — every transaction, account and your password. It is the reset button,
> not part of an update.

If the app still looks unchanged after a rebuild, check in this order: that the
build actually ran (`--build` present, and the log shows the `npm run build`
step rather than `CACHED`), then hard-reload the browser (Ctrl+Shift+R) to drop a
cached `index.html`. As a last resort force a clean image with
`docker compose -f Setup/docker-compose.yml build --no-cache`.

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
