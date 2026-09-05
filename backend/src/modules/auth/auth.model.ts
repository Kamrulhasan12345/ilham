import { pool } from '../../db/pool.js';
import { hashPassword } from '../../lib/password.js';
import type { MeRow, RegisterInput, UserRow } from './auth.interface.js';

// app.users is the inheritance parent; a plain SELECT FROM it scans every
// child table by default (student/teacher/admin), so this finds a row
// regardless of which subtype it lives in.
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT user_id, email, password_hash, full_name, role FROM app.users WHERE email = $1',
    [email],
  );
  return rows[0] ?? null;
}

export async function findMeById(userId: number): Promise<MeRow | null> {
  const { rows } = await pool.query<MeRow>(
    `SELECT u.user_id, u.email, u.full_name, u.role, t.is_verified
       FROM app.users u
       LEFT JOIN app.teachers t ON t.user_id = u.user_id
      WHERE u.user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

// Inserts into the CHILD table (students/teachers), never the parent
// app.users directly — app.users has no rows of its own, per db/02_app.sql's
// comments. The child table's assert_email_unique trigger rejects a
// duplicate email across ALL three subtypes, not just this one.
//
// A new student starts at 'beginner'. The level is assigned here, never
// chosen at registration: it is the teacher's assessment to raise, not a
// self-declared badge. (db/02_app.sql carries no DEFAULT so the graded DDL
// stays untouched; the model is the one writer.)
export async function registerUser(input: RegisterInput): Promise<{ user_id: number }> {
  const passwordHash = await hashPassword(input.password);
  if (input.role === 'student') {
    const { rows } = await pool.query<{ user_id: number }>(
      `INSERT INTO app.students (email, password_hash, full_name, role, student_level)
       VALUES ($1, $2, $3, 'student', 'beginner')
       RETURNING user_id`,
      [input.email, passwordHash, input.full_name],
    );
    return rows[0];
  }
  const { rows } = await pool.query<{ user_id: number }>(
    `INSERT INTO app.teachers (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'teacher')
     RETURNING user_id`,
    [input.email, passwordHash, input.full_name],
  );
  return rows[0];
}
