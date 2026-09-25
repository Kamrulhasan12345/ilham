import { pool } from '../../db/pool.js';
import { txQuery } from '../../lib/transaction.js';
import type { UnverifiedTeacherRow } from './teachers.interface.js';

export async function listUnverifiedTeachers(
  limit: number,
  offset: number,
): Promise<{ rows: UnverifiedTeacherRow[]; total: number }> {
  const { rows } = await pool.query<UnverifiedTeacherRow & { total: number }>(
    `SELECT user_id, email, full_name, institution, specialization, created_at,
            count(*) OVER ()::int AS total
       FROM app.teachers
      WHERE is_verified = false
      ORDER BY created_at
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const total = rows[0]?.total ?? 0;
  return { rows: rows.map(({ total: _total, ...row }) => row), total };
}

export async function verifyTeacher(userId: number): Promise<boolean> {
  const { rowCount } = await txQuery(
    `UPDATE app.teachers SET is_verified = true WHERE user_id = $1`,
    [userId],
  );
  return (rowCount ?? 0) > 0;
}

export async function unverifyTeacher(userId: number): Promise<boolean> {
  const { rowCount } = await txQuery(
    `UPDATE app.teachers SET is_verified = false WHERE user_id = $1`,
    [userId],
  );
  return (rowCount ?? 0) > 0;
}
