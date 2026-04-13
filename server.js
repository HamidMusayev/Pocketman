const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'finance.db');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('Loaded existing database:', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('Created new database:', DB_PATH);
  }

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
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    date TEXT NOT NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recurring_rules (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','monthly','yearly'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pending_transactions (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    recurring_rule_id TEXT,
    due_date TEXT NOT NULL
  )`);

  const cats = db.exec('SELECT COUNT(*) as cnt FROM categories');
  if (cats[0].values[0][0] === 0) {
    seedData();
  }

  saveDB();
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function query(sql, params = []) {
  try {
    const res = db.exec(sql, params);
    if (!res.length) return [];
    const { columns, values } = res[0];
    return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
  } catch (e) {
    console.error('Query error:', e.message, sql);
    throw e;
  }
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
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
    db.run('INSERT INTO categories VALUES (?,?,?,?)', [id, name, icon, budget]);
  });

  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  const txs = [
    ['tx1', 'Monthly rent', 1200, 'c1', 'expense', `${y}-${m}-01`],
    ['tx2', 'Salary', 3500, 'c6', 'income', `${y}-${m}-01`],
    ['tx3', 'Groceries', 85, 'c2', 'expense', `${y}-${m}-03`],
    ['tx4', 'Netflix', 15, 'c5', 'expense', `${y}-${m}-04`],
    ['tx5', 'Bus pass', 40, 'c3', 'expense', `${y}-${m}-05`],
    ['tx6', 'Freelance project', 800, 'c7', 'income', `${y}-${m}-08`],
    ['tx7', 'Restaurant', 55, 'c2', 'expense', `${y}-${m}-10`],
  ];
  txs.forEach(([id, desc, amt, catId, type, date]) => {
    db.run('INSERT INTO transactions VALUES (?,?,?,?,?,?)', [id, desc, amt, catId, type, date]);
  });

  db.run('INSERT INTO recurring_rules VALUES (?,?,?,?,?,?)', ['r1', 'Netflix subscription', 15, 'c5', 'expense', 'monthly']);
  db.run('INSERT INTO pending_transactions VALUES (?,?,?,?,?,?,?)', ['p1', 'Netflix subscription', 15, 'c5', 'expense', 'r1', new Date().toISOString().split('T')[0]]);

  saveDB();
  console.log('Database seeded with sample data.');
}

// ── Categories ──────────────────────────────────────────
app.get('/api/categories', (req, res) => {
  res.json(query('SELECT * FROM categories ORDER BY name'));
});

app.post('/api/categories', (req, res) => {
  const { id, name, icon, budget } = req.body;
  run('INSERT INTO categories VALUES (?,?,?,?)', [id, name, icon, budget ?? null]);
  res.json({ ok: true });
});

app.put('/api/categories/:id', (req, res) => {
  const { name, icon, budget } = req.body;
  run('UPDATE categories SET name=?, icon=?, budget=? WHERE id=?', [name, icon, budget ?? null, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/categories/:id', (req, res) => {
  run('DELETE FROM categories WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Transactions ─────────────────────────────────────────
app.get('/api/transactions', (req, res) => {
  const { month, year } = req.query;
  let sql = 'SELECT * FROM transactions';
  const params = [];
  if (month && year) {
    sql += ` WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?`;
    params.push(String(year), String(month).padStart(2, '0'));
  }
  sql += ' ORDER BY date DESC';
  res.json(query(sql, params));
});

app.post('/api/transactions', (req, res) => {
  const { id, description, amount, category_id, type, date } = req.body;
  run('INSERT INTO transactions VALUES (?,?,?,?,?,?)', [id, description, amount, category_id, type, date]);
  res.json({ ok: true });
});

app.delete('/api/transactions/:id', (req, res) => {
  run('DELETE FROM transactions WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Recurring rules ───────────────────────────────────────
app.get('/api/recurring', (req, res) => {
  res.json(query('SELECT * FROM recurring_rules'));
});

app.post('/api/recurring', (req, res) => {
  const { id, description, amount, category_id, type, frequency } = req.body;
  run('INSERT INTO recurring_rules VALUES (?,?,?,?,?,?)', [id, description, amount, category_id, type, frequency]);
  res.json({ ok: true });
});

app.delete('/api/recurring/:id', (req, res) => {
  run('DELETE FROM recurring_rules WHERE id=?', [req.params.id]);
  run('DELETE FROM pending_transactions WHERE recurring_rule_id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Pending transactions ──────────────────────────────────
app.get('/api/pending', (req, res) => {
  res.json(query('SELECT * FROM pending_transactions ORDER BY due_date'));
});

app.post('/api/pending', (req, res) => {
  const { id, description, amount, category_id, type, recurring_rule_id, due_date } = req.body;
  run('INSERT INTO pending_transactions VALUES (?,?,?,?,?,?,?)', [id, description, amount, category_id, type, recurring_rule_id ?? null, due_date]);
  res.json({ ok: true });
});

app.post('/api/pending/:id/approve', (req, res) => {
  const pending = query('SELECT * FROM pending_transactions WHERE id=?', [req.params.id]);
  if (!pending.length) return res.status(404).json({ error: 'Not found' });
  const p = pending[0];
  const txId = 'tx' + Date.now();
  run('INSERT INTO transactions VALUES (?,?,?,?,?,?)', [txId, p.description, p.amount, p.category_id, p.type, new Date().toISOString().split('T')[0]]);
  run('DELETE FROM pending_transactions WHERE id=?', [req.params.id]);
  res.json({ ok: true, transaction_id: txId });
});

app.delete('/api/pending/:id', (req, res) => {
  run('DELETE FROM pending_transactions WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅ Finance Tracker running at http://localhost:${PORT}`);
    console.log(`📁 Database file: ${DB_PATH}\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
