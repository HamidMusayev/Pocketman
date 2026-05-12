const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'finance.db');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

let db;

// ── DB lifecycle ─────────────────────────────────────────────
async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('Loaded existing database:', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('Created new database:', DB_PATH);
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '💰',
    type TEXT NOT NULL DEFAULT 'cash'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    budget REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT NOT NULL,
    account_id TEXT,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    date TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(account_id) REFERENCES accounts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recurring_rules (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT NOT NULL,
    account_id TEXT,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','monthly','yearly')),
    start_date TEXT NOT NULL DEFAULT (date('now')),
    last_generated TEXT,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(account_id) REFERENCES accounts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pending_transactions (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT NOT NULL,
    account_id TEXT,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    recurring_rule_id TEXT,
    due_date TEXT NOT NULL,
    FOREIGN KEY(recurring_rule_id) REFERENCES recurring_rules(id) ON DELETE CASCADE
  )`);

  // Backwards-compatible column additions for users upgrading
  tryAlter(`ALTER TABLE transactions ADD COLUMN account_id TEXT`);
  tryAlter(`ALTER TABLE transactions ADD COLUMN notes TEXT`);
  tryAlter(`ALTER TABLE recurring_rules ADD COLUMN account_id TEXT`);
  tryAlter(`ALTER TABLE recurring_rules ADD COLUMN start_date TEXT NOT NULL DEFAULT (date('now'))`);
  tryAlter(`ALTER TABLE recurring_rules ADD COLUMN last_generated TEXT`);
  tryAlter(`ALTER TABLE pending_transactions ADD COLUMN account_id TEXT`);

  // Default account so older transactions have somewhere to live
  const accCount = db.exec('SELECT COUNT(*) FROM accounts')[0].values[0][0];
  if (accCount === 0) {
    db.run(`INSERT INTO accounts (id, name, icon, type) VALUES ('default','Main','💰','cash')`);
    db.run(`UPDATE transactions SET account_id='default' WHERE account_id IS NULL`);
    db.run(`UPDATE recurring_rules SET account_id='default' WHERE account_id IS NULL`);
    db.run(`UPDATE pending_transactions SET account_id='default' WHERE account_id IS NULL`);
  }

  const cats = db.exec('SELECT COUNT(*) FROM categories')[0].values[0][0];
  if (cats === 0) seedData();

  saveDB();
  generatePending(); // catch up any missed recurring entries on boot
}

function tryAlter(sql) {
  try { db.run(sql); } catch (_) { /* column already exists */ }
}

function saveDB() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function query(sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

// Atomic multi-statement transaction
function txn(fn) {
  db.run('BEGIN');
  try {
    const out = fn();
    db.run('COMMIT');
    saveDB();
    return out;
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

function seedData() {
  const cats = [
    ['c1', 'Housing', '🏠', 1500],
    ['c2', 'Food', '🍔', 400],
    ['c3', 'Transport', '🚌', 150],
    ['c4', 'Healthcare', '💊', null],
    ['c5', 'Entertainment', '🎮', 100],
    ['c6', 'Salary', '💼', null],
    ['c7', 'Freelance', '💻', null],
    ['c8', 'Other', '📦', null],
  ];
  cats.forEach(([id, name, icon, budget]) => {
    db.run('INSERT INTO categories (id, name, icon, budget) VALUES (?,?,?,?)',
      [id, name, icon, budget]);
  });

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const txs = [
    ['tx1', 'Monthly rent', 1200, 'c1', 'default', 'expense', `${y}-${m}-01`],
    ['tx2', 'Salary', 3500, 'c6', 'default', 'income', `${y}-${m}-01`],
    ['tx3', 'Groceries', 85, 'c2', 'default', 'expense', `${y}-${m}-03`],
    ['tx4', 'Netflix', 15, 'c5', 'default', 'expense', `${y}-${m}-04`],
    ['tx5', 'Bus pass', 40, 'c3', 'default', 'expense', `${y}-${m}-05`],
    ['tx6', 'Freelance project', 800, 'c7', 'default', 'income', `${y}-${m}-08`],
    ['tx7', 'Restaurant', 55, 'c2', 'default', 'expense', `${y}-${m}-10`],
  ];
  txs.forEach(([id, desc, amt, catId, accId, type, date]) => {
    db.run(
      `INSERT INTO transactions
        (id, description, amount, category_id, account_id, type, date, notes)
        VALUES (?,?,?,?,?,?,?,?)`,
      [id, desc, amt, catId, accId, type, date, null]);
  });

  db.run(
    `INSERT INTO recurring_rules
      (id, description, amount, category_id, account_id, type, frequency, start_date, last_generated)
      VALUES (?,?,?,?,?,?,?,?,?)`,
    ['r1', 'Netflix subscription', 15, 'c5', 'default', 'expense', 'monthly', `${y}-${m}-04`, null]);
  console.log('Database seeded with sample data.');
}

// ── Validation helpers ───────────────────────────────────────
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const T = (v, ...types) => types.includes(typeof v);
const fail = (res, msg) => res.status(400).json({ error: msg });

function validTx(b) {
  if (!T(b.id, 'string') || !b.id) return 'invalid id';
  if (!T(b.description, 'string') || !b.description.trim()) return 'invalid description';
  if (!T(b.amount, 'number') || !isFinite(b.amount) || b.amount <= 0) return 'invalid amount';
  if (!T(b.category_id, 'string') || !b.category_id) return 'invalid category_id';
  if (!['income','expense'].includes(b.type)) return 'invalid type';
  if (!T(b.date, 'string') || !ISO_DATE.test(b.date)) return 'invalid date (YYYY-MM-DD)';
  return null;
}

// ── Recurring scheduler ──────────────────────────────────────
function addPeriod(dateStr, freq, n = 1) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (freq === 'daily')   d.setUTCDate(d.getUTCDate() + n);
  if (freq === 'weekly')  d.setUTCDate(d.getUTCDate() + 7 * n);
  if (freq === 'monthly') d.setUTCMonth(d.getUTCMonth() + n);
  if (freq === 'yearly')  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().split('T')[0];
}

function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Generate pending entries for any rules whose next occurrence is due.
function generatePending() {
  const today = new Date().toISOString().split('T')[0];
  const rules = query('SELECT * FROM recurring_rules');
  let created = 0;
  for (const r of rules) {
    let nextDate = r.last_generated
      ? addPeriod(r.last_generated, r.frequency, 1)
      : (r.start_date || today);

    // Cap to 24 generations per rule per call to avoid runaway loops
    let safety = 24;
    while (nextDate <= today && safety-- > 0) {
      // skip if a pending entry already exists for this rule on that date
      const existing = query(
        'SELECT id FROM pending_transactions WHERE recurring_rule_id=? AND due_date=?',
        [r.id, nextDate],
      );
      if (!existing.length) {
        db.run(
          `INSERT INTO pending_transactions
            (id, description, amount, category_id, account_id, type, recurring_rule_id, due_date)
            VALUES (?,?,?,?,?,?,?,?)`,
          [uid('p'), r.description, r.amount, r.category_id, r.account_id || 'default',
            r.type, r.id, nextDate],
        );
        created++;
      }
      db.run('UPDATE recurring_rules SET last_generated=? WHERE id=?', [nextDate, r.id]);
      nextDate = addPeriod(nextDate, r.frequency, 1);
    }
  }
  if (created) {
    saveDB();
    console.log(`Scheduler: created ${created} pending transaction(s).`);
  }
}

// Run hourly so long-running servers stay current.
setInterval(generatePending, 60 * 60 * 1000);

// ── Accounts ─────────────────────────────────────────────────
app.get('/api/accounts', (_req, res) => {
  res.json(query('SELECT * FROM accounts ORDER BY name'));
});

app.post('/api/accounts', (req, res) => {
  const { id, name, icon, type } = req.body || {};
  if (!T(id, 'string') || !id) return fail(res, 'invalid id');
  if (!T(name, 'string') || !name.trim()) return fail(res, 'invalid name');
  run('INSERT INTO accounts (id, name, icon, type) VALUES (?,?,?,?)',
    [id, name.trim(), icon || '💰', type || 'cash']);
  res.json({ ok: true });
});

app.put('/api/accounts/:id', (req, res) => {
  const { name, icon, type } = req.body || {};
  if (!T(name, 'string') || !name.trim()) return fail(res, 'invalid name');
  run('UPDATE accounts SET name=?, icon=?, type=? WHERE id=?',
    [name.trim(), icon || '💰', type || 'cash', req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/accounts/:id', (req, res) => {
  if (req.params.id === 'default') return fail(res, 'cannot delete default account');
  const used = query('SELECT COUNT(*) AS n FROM transactions WHERE account_id=?', [req.params.id]);
  if (used[0].n > 0) return fail(res, 'account has transactions; reassign or delete them first');
  run('DELETE FROM accounts WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Categories ───────────────────────────────────────────────
app.get('/api/categories', (_req, res) => {
  res.json(query('SELECT * FROM categories ORDER BY name'));
});

app.post('/api/categories', (req, res) => {
  const { id, name, icon, budget } = req.body || {};
  if (!T(id, 'string') || !id) return fail(res, 'invalid id');
  if (!T(name, 'string') || !name.trim()) return fail(res, 'invalid name');
  run('INSERT INTO categories (id, name, icon, budget) VALUES (?,?,?,?)',
    [id, name.trim(), icon || '📁', budget ?? null]);
  res.json({ ok: true });
});

app.put('/api/categories/:id', (req, res) => {
  const { name, icon, budget } = req.body || {};
  if (!T(name, 'string') || !name.trim()) return fail(res, 'invalid name');
  run('UPDATE categories SET name=?, icon=?, budget=? WHERE id=?',
    [name.trim(), icon || '📁', budget ?? null, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/categories/:id', (req, res) => {
  const used = query('SELECT COUNT(*) AS n FROM transactions WHERE category_id=?', [req.params.id]);
  if (used[0].n > 0) return fail(res, 'category has transactions; reassign or delete them first');
  run('DELETE FROM categories WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Transactions ─────────────────────────────────────────────
app.get('/api/transactions', (req, res) => {
  const { month, year, from, to, q, category, account, type } = req.query;
  let sql = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];

  if (from) { sql += ' AND date >= ?'; params.push(String(from)); }
  if (to)   { sql += ' AND date <= ?'; params.push(String(to)); }

  if (month && year) {
    sql += ` AND strftime('%Y', date) = ? AND strftime('%m', date) = ?`;
    params.push(String(year), String(month).padStart(2, '0'));
  }
  if (category && category !== 'all') {
    sql += ' AND category_id = ?';
    params.push(String(category));
  }
  if (account && account !== 'all') {
    sql += ' AND account_id = ?';
    params.push(String(account));
  }
  if (type && (type === 'income' || type === 'expense')) {
    sql += ' AND type = ?';
    params.push(String(type));
  }
  if (q) {
    sql += ' AND (LOWER(description) LIKE ? OR LOWER(notes) LIKE ?)';
    const needle = `%${String(q).toLowerCase()}%`;
    params.push(needle, needle);
  }

  sql += ' ORDER BY date DESC, id DESC';
  res.json(query(sql, params));
});

app.post('/api/transactions', (req, res) => {
  const err = validTx(req.body);
  if (err) return fail(res, err);
  const { id, description, amount, category_id, account_id, type, date, notes } = req.body;
  run(
    `INSERT INTO transactions
      (id, description, amount, category_id, account_id, type, date, notes)
      VALUES (?,?,?,?,?,?,?,?)`,
    [id, description.trim(), amount, category_id, account_id || 'default', type, date, notes || null]);
  res.json({ ok: true });
});

app.put('/api/transactions/:id', (req, res) => {
  const err = validTx({ ...req.body, id: req.params.id });
  if (err) return fail(res, err);
  const { description, amount, category_id, account_id, type, date, notes } = req.body;
  run('UPDATE transactions SET description=?, amount=?, category_id=?, account_id=?, type=?, date=?, notes=? WHERE id=?',
    [description.trim(), amount, category_id, account_id || 'default', type, date, notes || null, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/transactions/:id', (req, res) => {
  run('DELETE FROM transactions WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Recurring rules ──────────────────────────────────────────
app.get('/api/recurring', (_req, res) => {
  res.json(query('SELECT * FROM recurring_rules ORDER BY description'));
});

app.post('/api/recurring', (req, res) => {
  const { id, description, amount, category_id, account_id, type, frequency, start_date } = req.body || {};
  if (!T(id, 'string') || !id) return fail(res, 'invalid id');
  if (!T(description, 'string') || !description.trim()) return fail(res, 'invalid description');
  if (!T(amount, 'number') || amount <= 0) return fail(res, 'invalid amount');
  if (!['income','expense'].includes(type)) return fail(res, 'invalid type');
  if (!['daily','weekly','monthly','yearly'].includes(frequency)) return fail(res, 'invalid frequency');
  const sd = start_date && ISO_DATE.test(start_date)
    ? start_date
    : new Date().toISOString().split('T')[0];

  txn(() => {
    db.run(
      `INSERT INTO recurring_rules
        (id, description, amount, category_id, account_id, type, frequency, start_date, last_generated)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, description.trim(), amount, category_id, account_id || 'default',
        type, frequency, sd, null]);
  });
  generatePending();
  res.json({ ok: true });
});

app.delete('/api/recurring/:id', (req, res) => {
  txn(() => {
    db.run('DELETE FROM pending_transactions WHERE recurring_rule_id=?', [req.params.id]);
    db.run('DELETE FROM recurring_rules WHERE id=?', [req.params.id]);
  });
  res.json({ ok: true });
});

// Manual trigger for the scheduler (useful for testing or "catch up now")
app.post('/api/recurring/run', (_req, res) => {
  generatePending();
  res.json({ ok: true });
});

// ── Pending transactions ─────────────────────────────────────
app.get('/api/pending', (_req, res) => {
  res.json(query('SELECT * FROM pending_transactions ORDER BY due_date'));
});

app.post('/api/pending', (req, res) => {
  const { id, description, amount, category_id, account_id, type, recurring_rule_id, due_date } = req.body || {};
  if (!T(id, 'string') || !id) return fail(res, 'invalid id');
  if (!T(description, 'string') || !description.trim()) return fail(res, 'invalid description');
  if (!T(amount, 'number') || amount <= 0) return fail(res, 'invalid amount');
  if (!['income','expense'].includes(type)) return fail(res, 'invalid type');
  if (!ISO_DATE.test(due_date || '')) return fail(res, 'invalid due_date');
  run(
    `INSERT INTO pending_transactions
      (id, description, amount, category_id, account_id, type, recurring_rule_id, due_date)
      VALUES (?,?,?,?,?,?,?,?)`,
    [id, description.trim(), amount, category_id, account_id || 'default',
      type, recurring_rule_id || null, due_date]);
  res.json({ ok: true });
});

app.post('/api/pending/:id/approve', (req, res) => {
  const pending = query('SELECT * FROM pending_transactions WHERE id=?', [req.params.id]);
  if (!pending.length) return res.status(404).json({ error: 'Not found' });
  const p = pending[0];
  const txId = uid('tx');
  txn(() => {
    db.run(
      `INSERT INTO transactions
        (id, description, amount, category_id, account_id, type, date, notes)
        VALUES (?,?,?,?,?,?,?,?)`,
      [txId, p.description, p.amount, p.category_id, p.account_id || 'default',
        p.type, p.due_date, null]);
    db.run('DELETE FROM pending_transactions WHERE id=?', [req.params.id]);
  });
  res.json({ ok: true, transaction_id: txId });
});

app.delete('/api/pending/:id', (req, res) => {
  run('DELETE FROM pending_transactions WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── CSV import / export ──────────────────────────────────────
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') q = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

app.get('/api/export/csv', (_req, res) => {
  const rows = query(`
    SELECT t.date, t.type, t.description, t.amount, c.name AS category,
           a.name AS account, t.notes
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN accounts a   ON a.id = t.account_id
    ORDER BY t.date
  `);
  const header = 'date,type,description,amount,category,account,notes';
  const body = rows.map(r =>
    [r.date, r.type, r.description, r.amount, r.category, r.account, r.notes]
      .map(csvEscape).join(',')).join('\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="transactions-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(header + '\n' + body + '\n');
});

app.post('/api/import/csv', (req, res) => {
  const { csv } = req.body || {};
  if (typeof csv !== 'string' || !csv.trim()) return fail(res, 'csv field required');

  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return fail(res, 'csv has no rows');

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const need = ['date', 'type', 'description', 'amount', 'category'];
  for (const k of need) {
    if (!headers.includes(k)) return fail(res, `csv missing column: ${k}`);
  }

  const cats = query('SELECT id, name FROM categories');
  const accs = query('SELECT id, name FROM accounts');
  const catByName = new Map(cats.map(c => [c.name.toLowerCase(), c.id]));
  const accByName = new Map(accs.map(a => [a.name.toLowerCase(), a.id]));

  let imported = 0, skipped = 0;
  const errors = [];

  txn(() => {
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const row = Object.fromEntries(headers.map((h, idx) => [h, cols[idx]]));
      const date = (row.date || '').trim();
      const type = (row.type || '').trim().toLowerCase();
      const desc = (row.description || '').trim();
      const amount = parseFloat(row.amount);
      const catName = (row.category || '').trim().toLowerCase();
      const accName = (row.account || '').trim().toLowerCase();

      if (!ISO_DATE.test(date) || !desc || !isFinite(amount) || amount <= 0
          || !['income','expense'].includes(type) || !catByName.has(catName)) {
        skipped++;
        if (errors.length < 5) errors.push(`row ${i + 1}: invalid or unknown category`);
        continue;
      }
      const accId = accByName.get(accName) || 'default';
      db.run(
        `INSERT INTO transactions
          (id, description, amount, category_id, account_id, type, date, notes)
          VALUES (?,?,?,?,?,?,?,?)`,
        [uid('tx'), desc, amount, catByName.get(catName), accId, type, date, row.notes || null]);
      imported++;
    }
  });
  res.json({ ok: true, imported, skipped, errors });
});

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }));

// ── Error handler (last) ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled:', err);
  res.status(500).json({ error: 'internal error' });
});

// ── Start ─────────────────────────────────────────────────────
if (require.main === module) {
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`\nFinance Tracker running at http://localhost:${PORT}`);
      console.log(`Database file: ${DB_PATH}\n`);
    });
  }).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}

module.exports = { app, initDB };
