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
