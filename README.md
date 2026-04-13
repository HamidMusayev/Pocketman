Download all 4 files into the same folder, then:



\*\*Setup (one time only):\*\*

```bash

\# Make sure Node.js is installed, then inside the project folder:

npm install

```



\*\*Run it every time:\*\*

```bash

node server.js

\# Then open http://localhost:3000 in your browser

```



\*\*Project structure:\*\*

```

finance-tracker/

├── server.js      ← Express backend + SQLite API

├── index.html     ← The full UI (served by the backend)

├── finance.db     ← Your SQLite database (auto-created if missing)

└── package.json   ← Dependencies

```



\*\*How it works under the hood:\*\*

\- `server.js` runs a local Express server on port 3000, exposes a REST API (`/api/transactions`, `/api/categories`, etc.), and reads/writes `finance.db` using `sql.js` (pure JavaScript SQLite — no native binaries needed, so no build issues)

\- `index.html` is a standard frontend that talks to the local API via `fetch()`

\- `finance.db` is a real SQLite file — you can open it with any SQLite viewer (DB Browser for SQLite, DBeaver, etc.) to inspect your data directly

\- All your data persists across restarts automatically

