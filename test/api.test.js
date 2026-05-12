import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';

let app;
let tmpDb;

beforeAll(async () => {
  // Use a fresh temp DB per test run
  tmpDb = path.join(os.tmpdir(), `finance-test-${Date.now()}.db`);
  process.env.DB_PATH = tmpDb;
  // Re-require server with the new DB_PATH
  const mod = await import('../server.js');
  app = mod.app;
  await mod.initDB();
});

afterAll(() => {
  try { fs.unlinkSync(tmpDb); } catch (_) {}
});

describe('Finance Tracker API', () => {
  it('GET /api/health works', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it('seeds a default account', async () => {
    const r = await request(app).get('/api/accounts');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.find(a => a.id === 'default')).toBeTruthy();
  });

  it('seeds initial categories', async () => {
    const r = await request(app).get('/api/categories');
    expect(r.body.length).toBeGreaterThan(0);
  });

  it('creates and reads a transaction', async () => {
    const cats = (await request(app).get('/api/categories')).body;
    const tx = {
      id: 't_create_' + Date.now(),
      description: 'Coffee',
      amount: 4.5,
      category_id: cats[0].id,
      type: 'expense',
      date: '2026-05-01',
    };
    const post = await request(app).post('/api/transactions').send(tx);
    expect(post.status).toBe(200);

    const list = await request(app).get('/api/transactions');
    expect(list.body.find(t => t.id === tx.id)).toBeTruthy();
  });

  it('rejects invalid transaction payload', async () => {
    const r = await request(app).post('/api/transactions').send({
      id: 'bad', description: '', amount: -1, type: 'expense',
      category_id: 'x', date: 'nope',
    });
    expect(r.status).toBe(400);
  });

  it('edits a transaction', async () => {
    const cats = (await request(app).get('/api/categories')).body;
    const tx = {
      id: 't_edit_' + Date.now(),
      description: 'Original',
      amount: 10,
      category_id: cats[0].id,
      type: 'expense',
      date: '2026-05-02',
    };
    await request(app).post('/api/transactions').send(tx);
    const upd = await request(app).put('/api/transactions/' + tx.id).send({
      ...tx, description: 'Updated', amount: 20,
    });
    expect(upd.status).toBe(200);
    const list = await request(app).get('/api/transactions');
    const found = list.body.find(t => t.id === tx.id);
    expect(found.description).toBe('Updated');
    expect(found.amount).toBe(20);
  });

  it('search via q query parameter works', async () => {
    const cats = (await request(app).get('/api/categories')).body;
    const tx = {
      id: 't_search_' + Date.now(),
      description: 'UniqueSearchKey42',
      amount: 1,
      category_id: cats[0].id,
      type: 'expense',
      date: '2026-05-03',
    };
    await request(app).post('/api/transactions').send(tx);
    const r = await request(app).get('/api/transactions?q=UniqueSearchKey42');
    expect(r.body.length).toBe(1);
    expect(r.body[0].id).toBe(tx.id);
  });

  it('recurring rule generates pending entries', async () => {
    const cats = (await request(app).get('/api/categories')).body;
    const r = await request(app).post('/api/recurring').send({
      id: 'r_test_' + Date.now(),
      description: 'Test sub',
      amount: 9.99,
      category_id: cats[0].id,
      type: 'expense',
      frequency: 'monthly',
      start_date: '2026-04-01',
    });
    expect(r.status).toBe(200);
    // Trigger another scheduler run for safety
    await request(app).post('/api/recurring/run');
    const pending = await request(app).get('/api/pending');
    const matches = pending.body.filter(p => p.description === 'Test sub');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('CSV export returns headers and rows', async () => {
    const r = await request(app).get('/api/export/csv');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('csv');
    expect(r.text.split('\n')[0]).toContain('date,type,description');
  });

  it('CSV import accepts well-formed rows', async () => {
    const cats = (await request(app).get('/api/categories')).body;
    const catName = cats[0].name;
    const csv = [
      'date,type,description,amount,category,account,notes',
      `2026-05-04,expense,Imported coffee,3.50,${catName},Main,test`,
      `2026-05-04,income,Bonus,200,${catName},Main,`,
    ].join('\n');
    const r = await request(app).post('/api/import/csv').send({ csv });
    expect(r.status).toBe(200);
    expect(r.body.imported).toBe(2);
  });

  it('CSV import rejects rows with unknown category', async () => {
    const csv = [
      'date,type,description,amount,category',
      '2026-05-05,expense,Mystery,10,DefinitelyNotACategory',
    ].join('\n');
    const r = await request(app).post('/api/import/csv').send({ csv });
    expect(r.body.skipped).toBe(1);
    expect(r.body.imported).toBe(0);
  });
});
