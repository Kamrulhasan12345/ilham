import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';
import { bearer, registerAndGetToken, uniqueEmail } from '../../testUtils/helpers.js';

async function authToken(): Promise<string> {
  const { accessToken } = await registerAndGetToken(app, uniqueEmail('analytics'), 'student');
  return accessToken;
}

async function twoHadithIds(): Promise<[number, number]> {
  const { rows } = await pool.query<{ hadith_id: number }>(
    'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 2',
  );
  assert.ok(rows.length >= 2, 'expected at least two rows in corpus.hadiths');
  return [rows[0].hadith_id, rows[1].hadith_id];
}

describe('GET /analytics -- auth', () => {
  test('401 without a token: top-narrators', async () => {
    const res = await request(app).get('/analytics/top-narrators');
    assert.equal(res.status, 401);
  });

  test('401 without a token: contested-narrators', async () => {
    const res = await request(app).get('/analytics/contested-narrators');
    assert.equal(res.status, 401);
  });

  test('401 without a token: weakest-chains', async () => {
    const res = await request(app).get('/analytics/weakest-chains');
    assert.equal(res.status, 401);
  });

  test('401 without a token: shared-narrators', async () => {
    const res = await request(app).get('/analytics/shared-narrators?a=1&b=2');
    assert.equal(res.status, 401);
  });
});

describe('GET /analytics/top-narrators -- Q1', () => {
  test('200 with limit param and an array of narrator rows', async () => {
    const token = await authToken();
    const res = await request(app).get('/analytics/top-narrators?limit=2').set(bearer(token));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data), 'expected { data: [] }');
    if (res.body.data.length > 0) {
      const first = res.body.data[0];
      assert.equal(typeof first, 'object');
      assert.ok(first !== null);
    }
  });
});

describe('GET /analytics/contested-narrators -- Q2', () => {
  test('200 with limit param and an array of contested narrator rows', async () => {
    const token = await authToken();
    const res = await request(app).get('/analytics/contested-narrators?limit=2').set(bearer(token));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data), 'expected { data: [] }');
    if (res.body.data.length > 0) {
      const first = res.body.data[0];
      assert.equal(typeof first, 'object');
      assert.ok(first !== null);
    }
  });
});

describe('GET /analytics/weakest-chains -- Q5', () => {
  test('200 with limit param and an array of chain rows', async () => {
    const token = await authToken();
    const res = await request(app).get('/analytics/weakest-chains?limit=2').set(bearer(token));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data), 'expected { data: [] }');
    if (res.body.data.length > 0) {
      const first = res.body.data[0];
      assert.equal(typeof first, 'object');
      assert.ok(first !== null);
    }
  });
});

describe('GET /analytics/shared-narrators -- Q3', () => {
  test('200 with two real hadith ids and an array of shared narrator rows', async () => {
    const token = await authToken();
    const [a, b] = await twoHadithIds();
    const res = await request(app).get(`/analytics/shared-narrators?a=${a}&b=${b}`).set(bearer(token));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data), 'expected { data: [] }');
    if (res.body.data.length > 0) {
      const first = res.body.data[0];
      assert.equal(typeof first, 'object');
      assert.ok(first !== null);
    }
  });

  test('400 when a or b is missing', async () => {
    const token = await authToken();
    const [a] = await twoHadithIds();
    const missing = await request(app).get(`/analytics/shared-narrators?a=${a}`).set(bearer(token));
    assert.equal(missing.status, 400);
  });
});

describe('analytics display values (frontend PRD 7.12/7.13/7.15)', () => {
  test('top-narrators carries a summary matching a direct count', async () => {
    const token = await authToken();
    const res = await request(app)
      .get('/analytics/top-narrators?limit=5')
      .set(bearer(token));
    assert.equal(res.status, 200);
    const total = await pool.query<{ count: string }>(
      'SELECT count(*) FROM corpus.isnad_links WHERE NOT is_compiler AND narrator_id IS NOT NULL',
    );
    assert.equal(res.body.summary.total_positions, Number(total.rows[0].count));
    assert.equal(res.body.summary.top_count, res.body.data.length);
    const shown = res.body.data.reduce((n: number, r: { positions: number }) => n + Number(r.positions), 0);
    assert.ok(Math.abs(res.body.summary.top_share - shown / Number(total.rows[0].count)) < 1e-9);
  });

  test('contested rows carry both Arabic grade glosses', async () => {
    const token = await authToken();
    const res = await request(app)
      .get('/analytics/contested-narrators?limit=3')
      .set(bearer(token));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    for (const row of res.body.data) {
      assert.equal(typeof row.label_ibn_hajar, 'string');
      assert.equal(typeof row.label_dhahabi, 'string');
    }
  });

  test('weakest-chains carries the unscored count matching a direct count', async () => {
    const token = await authToken();
    const res = await request(app)
      .get('/analytics/weakest-chains?limit=3')
      .set(bearer(token));
    assert.equal(res.status, 200);
    const direct = await pool.query<{ count: string }>(
      `SELECT count(*) FROM corpus.hadiths h
        WHERE NOT EXISTS (SELECT 1 FROM corpus.isnad_links l
                          WHERE l.hadith_id = h.hadith_id AND NOT l.is_compiler)`,
    );
    assert.equal(res.body.summary.unscored, Number(direct.rows[0].count));
  });
});
