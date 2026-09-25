import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pool } from '../db/pool.js';

// Every write runs inside an explicit transaction: BEGIN, then COMMIT, or
// ROLLBACK on any error. A write of several statements passes them all to
// withTransaction, so they commit or fail together.
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** One write statement, inside its own explicit BEGIN ... COMMIT / ROLLBACK. */
export function txQuery<R extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<R>> {
  return withTransaction((client) => client.query<R>(text, values));
}
