# Finance Tracker

A lightweight self-hosted personal finance tracker. Runs entirely on your machine — no cloud, no accounts, just your data in a single SQLite file.

## About

Finance Tracker is a single-page web app for managing income and expenses. Categorize transactions, set budget caps, automate recurring entries, group activity by account, search, import and export CSV, and visualize your spending — all stored locally in `finance.db`.

## Features

- **Multi-account** — track cash, checking, savings, and credit cards separately
- **Transactions** — add, edit, delete, and search; pick any date (not just today)
- **Categories with budgets** — monthly budget caps with progress bars and over-budget warnings
- **Recurring rules** — daily, weekly, monthly, or yearly schedules with an automatic scheduler that generates pending entries you approve one by one
- **Custom date ranges** — view monthly, all-time, or any custom from/to range
- **CSV import & export** — back up or migrate your data
- **Charts** — income vs expenses, expenses by category (donut), cumulative balance over time
- **Dark mode** — follows your system preference
- **Local-first** — all data lives in one `finance.db` file; nothing leaves your machine

## Screenshots

<table>
  <tr>
    <td align="center">
      <img src="screens/Screenshot%202026-04-13%20204332.png" alt="Overview" width="400"/>
      <br/><b>Overview</b> — transactions, summary, search, filters
    </td>
    <td align="center">
      <img src="screens/Screenshot%202026-04-13%20204350.png" alt="Recurring" width="400"/>
      <br/><b>Recurring</b> — pending approvals and rules
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="screens/Screenshot%202026-04-13%20204407.png" alt="Charts" width="400"/>
      <br/><b>Charts</b> — analytics
    </td>
    <td align="center">
      <img src="screens/Screenshot%202026-04-13%20204438.png" alt="Categories" width="400"/>
      <br/><b>Categories</b> — budget limits
    </td>
  </tr>
</table>

## Tech stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | HTML5, vanilla JavaScript, Chart.js     |
| Backend  | Node.js 18+, Express 5                  |
| Database | SQLite via sql.js (pure JS, no binaries)|
| Tests    | Vitest + Supertest                      |

## Quick start

```bash
# One-time setup
npm install

# Run
npm start
# → http://localhost:3000
```

### Run with Docker

```bash
docker build -t finance-tracker .
docker run -p 3000:3000 -v $(pwd)/data:/data finance-tracker
# DB persists in ./data/finance.db
```

## Development

```bash
npm test         # run API tests
npm run lint     # ESLint
npm run format   # Prettier
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for project conventions.

## Project structure

```
finance-tracker/
├── server.js        ← Express backend + SQLite API
├── index.html       ← Single-page UI
├── test/            ← Vitest API tests
├── Dockerfile       ← Container build
├── finance.db       ← SQLite database (auto-created, gitignored)
└── package.json
```

## How it works

`server.js` runs an Express server on port 3000, exposes a REST API, and reads/writes `finance.db` via `sql.js` (pure JavaScript SQLite — no native binaries). `index.html` is a vanilla-JS frontend that talks to the API. The recurring scheduler runs on server start and every hour after, generating pending entries up to the current date for each rule. All HTML output from user data is HTML-escaped to prevent XSS.

## API surface

```
GET    /api/health                       # health check
GET    /api/accounts
POST   /api/accounts
PUT    /api/accounts/:id
DELETE /api/accounts/:id
GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id
GET    /api/transactions?month=&year=&from=&to=&q=&category=&account=&type=
POST   /api/transactions
PUT    /api/transactions/:id
DELETE /api/transactions/:id
GET    /api/recurring
POST   /api/recurring
DELETE /api/recurring/:id
POST   /api/recurring/run                # manually trigger the scheduler
GET    /api/pending
POST   /api/pending
POST   /api/pending/:id/approve
DELETE /api/pending/:id
GET    /api/export/csv
POST   /api/import/csv                   # body: { csv: "<text>" }
```

## Environment variables

- `PORT` — default `3000`
- `DB_PATH` — default `./finance.db`

## License

[ISC](LICENSE)
