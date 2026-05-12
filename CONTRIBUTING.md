# Contributing to Finance Tracker

Thanks for considering a contribution. This is a small project and the bar is mostly: keep it simple, keep it local-first.

## Development setup

```bash
git clone <your fork>
cd finance-tracker
npm install
npm run dev      # starts the server on http://localhost:3000
```

In a second terminal:

```bash
npm test         # run the API test suite
npm run lint     # lint
npm run format   # format with prettier
```

## Project shape

The project is intentionally small:

- `server.js` — Express + sql.js, all routes in one file
- `index.html` — full single-page UI, vanilla JS, Chart.js via CDN
- `test/` — API tests using Vitest + Supertest
- `finance.db` — SQLite database file (auto-created, gitignored)

Don't add a build step or a frontend framework without strong reason. Single-file UI is a feature, not a limitation.

## Pull requests

- Keep PRs focused. One feature or fix per PR.
- Add or update tests when changing API behavior.
- Update the README's feature list if you add a user-visible capability.
- New endpoints should validate their input and use the `txn()` helper for any multi-statement write.
- Frontend HTML output must go through `esc()` — never interpolate user data into `innerHTML` directly.

## Reporting bugs / requesting features

Please open an issue with reproduction steps and your environment (Node version, OS). For feature requests, describe the use case before the proposed solution.
