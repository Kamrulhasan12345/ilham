import { pool } from '../../db/pool.js';
import type { UnverifiedTeacherRow } from './teachers.interface.js';

export async function listUnverifiedTeachers(
  limit: number,
  offset: number,
): Promise<UnverifiedTeacherRow[]> {
  const { rows } = await pool.query<UnverifiedTeacherRow>(
    `SELECT user_id, email, full_name, institution, specialization, created_at
       FROM app.teachers
      WHERE is_verified = false
      ORDER BY created_at
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows;
}

export async function verifyTeacher(userId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE app.teachers SET is_verified = true WHERE user_id = $1`,
    [userId],
  );
  return (rowCount ?? 0) > 0;
}
