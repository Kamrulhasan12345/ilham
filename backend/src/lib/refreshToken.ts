import { createHash, randomBytes } from 'node:crypto';
import { pool } from '../db/pool.js';
import { REFRESH_TOKEN_TTL_DAYS } from '../config.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueRefreshToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO app.refresh_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [hashToken(token), userId, expiresAt],
  );
  return token;
}

export async function consumeRefreshToken(token: string): Promise<number | null> {
  const { rows } = await pool.query<{ user_id: number }>(
    'SELECT user_id FROM app.refresh_tokens WHERE token_hash = $1 AND expires_at > now()',
    [hashToken(token)],
  );
  return rows[0]?.user_id ?? null;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await pool.query('DELETE FROM app.refresh_tokens WHERE token_hash = $1', [hashToken(token)]);
}
