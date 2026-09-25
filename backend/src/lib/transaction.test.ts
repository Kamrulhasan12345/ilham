import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../db/pool.js';
import { txQuery, withTransaction } from './transaction.js';

async function anyUserId(): Promise<number> {
  const { rows } = await pool.query<{ user_id: number }>('SELECT user_id FROM app.users LIMIT 1');
  return rows[0].user_id;
}

describe('explicit transaction control', () => {
  test('withTransaction commits every statement when all succeed', async () => {
    const owner = await anyUserId();
    const name = `tx-commit-${Date.now()}`;
    await withTransaction(async (c) => {
      await c.query('INSERT INTO app.study_sets (owner_id, name) VALUES ($1, $2)', [owner, name]);
      await c.query('UPDATE app.study_sets SET name = $1 WHERE name = $1', [name]);
    });
    const { rowCount } = await pool.query('SELECT 1 FROM app.study_sets WHERE name = $1', [name]);
    assert.equal(rowCount, 1);
    await txQuery('DELETE FROM app.study_sets WHERE name = $1', [name]);
  });

  test('withTransaction rolls back the earlier statements when a later one fails', async () => {
    const owner = await anyUserId();
    const name = `tx-rollback-${Date.now()}`;
    await assert.rejects(
      withTransaction(async (c) => {
        await c.query('INSERT INTO app.study_sets (owner_id, name) VALUES ($1, $2)', [owner, name]);
        // Fails: no such hadith. The INSERT above must not survive.
        await c.query('INSERT INTO app.set_items (set_id, hadith_id) VALUES (-1, -1)');
      }),
    );
    const { rowCount } = await pool.query('SELECT 1 FROM app.study_sets WHERE name = $1', [name]);
    assert.equal(rowCount, 0);
  });

  test('txQuery rolls back its statement on error and releases the connection', async () => {
    await assert.rejects(txQuery('INSERT INTO app.set_items (set_id, hadith_id) VALUES (-1, -1)'));
    // The pool still serves queries: the failed client was rolled back and released.
    const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
    assert.equal(rows[0].ok, 1);
  });
});
