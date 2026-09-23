import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';
import { bearer, registerAndGetToken, uniqueEmail } from '../../testUtils/helpers.js';

async function authToken(): Promise<string> {
  const { accessToken } = await registerAndGetToken(app, uniqueEmail('narradj'), 'student');
  return accessToken;
}

async function linkedNarratorId(): Promise<number> {
  const { rows } = await pool.query<{ narrator_id: number }>(
    `SELECT DISTINCT l.narrator_id FROM corpus.isnad_links l
      JOIN corpus.isnad_edges e ON e.from_narrator = l.narrator_id OR e.to_narrator = l.narrator_id
     WHERE l.narrator_id IS NOT NULL ORDER BY l.narrator_id LIMIT 1`,
  );
  return rows[0].narrator_id;
}

describe('GET /narrators/:id/adjacent', () => {
  test('returns both directions with names for a linked narrator', async () => {
    const token = await authToken();
    const id = await linkedNarratorId();
    const res = await request(app).get(`/narrators/${id}/adjacent`).set(bearer(token));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    const directions = new Set(res.body.data.map((r: { direction: string }) => r.direction));
    assert.ok(directions.has('taught') || directions.has('learned_from'));
    for (const row of res.body.data) {
      assert.ok('display_name' in row && 'transmission_word' in row);
    }
  });

  test('rules: bad id 400, missing narrator 404, anonymous 401', async () => {
    const token = await authToken();
    const bad = await request(app).get('/narrators/abc/adjacent').set(bearer(token));
    assert.equal(bad.status, 400);
    const missing = await request(app).get('/narrators/999999999/adjacent').set(bearer(token));
    assert.equal(missing.status, 404);
    const anon = await request(app).get('/narrators/1/adjacent');
    assert.equal(anon.status, 401);
  });
});
