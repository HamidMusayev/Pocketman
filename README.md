# Finance Tracker

A lightweight personal finance tracker that runs entirely on your machine — no cloud, no accounts, just your data.

## About

Finance Tracker is a self-hosted web app for managing your income and expenses. It lets you categorize transactions, set budget limits per category, automate recurring payments, and visualize your spending through charts — all stored locally in a SQLite database.

## Features

- **Transaction tracking** — log income and expense transactions with categories and descriptions
- **Budget limits** — set monthly budget caps per category with visual progress indicators
- **Recurring transactions** — define daily, weekly, monthly, or yearly rules; approve pending entries one by one
- **Charts & analytics** — Income vs Expenses bar chart, Expenses by Category donut chart, and a Cumulative Balance line chart
- **Dark UI** — clean, minimal dark-themed interface
- **No dependencies on external services** — everything runs locally, data persists in a single `finance.db` file

## Screenshots

<table>
  <tr>
    <td align="center">
      <img src="screens/Screenshot%202026-04-13%20204332.png" alt="Overview" width="400"/>
      <br/><b>Overview</b> — transaction list with summary cards
    </td>
    <td align="center">
      <img src="screens/Screenshot%202026-04-13%20204350.png" alt="Recurring" width="400"/>
      <br/><b>Recurring</b> — pending approvals and recurring rules
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="screens/Screenshot%202026-04-13%20204407.png" alt="Charts" width="400"/>
      <br/><b>Charts</b> — spending analytics and cumulative balance
    </td>
    <td align="center">
      <img src="screens/Screenshot%202026-04-13%20204438.png" alt="Categories" width="400"/>
      <br/><b>Categories</b> — budget limits and spending progress
    </td>
  </tr>
</table>

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | HTML5, vanilla JavaScript, Chart.js     |
| Backend  | Node.js, Express.js                     |
| Database | SQLite via sql.js (pure JS, no binaries)|

## Getting Started

**Setup (one time only):**

```bash
# Make sure Node.js is installed, then inside the project folder:
npm install
```

**Run it every time:**

```bash
node server.js
# Then open http://localhost:3000 in your browser
```

## Project Structure

```
finance-tracker/
├── server.js      ← Express backend + SQLite API
├── index.html     ← The full UI (served by the backend)
├── finance.db     ← Your SQLite database (auto-created if missing)
└── package.json   ← Dependencies
```

## How It Works

- `server.js` runs a local Express server on port 3000, exposes a REST API (`/api/transactions`, `/api/categories`, etc.), and reads/writes `finance.db` using `sql.js` (pure JavaScript SQLite — no native binaries needed, so no build issues)
- `index.html` is a standard frontend that talks to the local API via `fetch()`
- `finance.db` is a real SQLite file — you can open it with any SQLite viewer (DB Browser for SQLite, DBeaver, etc.) to inspect your data directly
- All your data persists across restarts automatically
