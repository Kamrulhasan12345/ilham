import { pool } from '../../db/pool.js';
import { txQuery, withTransaction } from '../../lib/transaction.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
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

// Password hashes live on the CHILD tables (students/teachers/admins),
// never on the inheritance parent — so a hash read or write names the
// caller's table from their JWT role. The role comes from the signed token
// and the map below admits only these three literals, so the interpolation
// cannot carry user input.
const passwordTables = {
  student: 'app.students',
  teacher: 'app.teachers',
  admin: 'app.admins',
} as const;

export async function changePassword(
  userId: number,
  role: 'student' | 'teacher' | 'admin',
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const table = passwordTables[role];
  // Read, check, and write in one transaction. FOR UPDATE stops a second
  // change from slipping in between the check and the UPDATE.
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ password_hash: string }>(
      `SELECT password_hash FROM ${table} WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    if (!rows[0]) return false;
    if (!(await verifyPassword(currentPassword, rows[0].password_hash))) return false;
    await client.query(`UPDATE ${table} SET password_hash = $2 WHERE user_id = $1`, [
      userId,
      await hashPassword(newPassword),
    ]);
    return true;
  });
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
    const { rows } = await txQuery<{ user_id: number }>(
      `INSERT INTO app.students (email, password_hash, full_name, role, student_level)
       VALUES ($1, $2, $3, 'student', 'beginner')
       RETURNING user_id`,
      [input.email, passwordHash, input.full_name],
    );
    return rows[0];
  }
  const { rows } = await txQuery<{ user_id: number }>(
    `INSERT INTO app.teachers (email, password_hash, full_name, role, is_verified)
     VALUES ($1, $2, $3, 'teacher', false)
     RETURNING user_id`,
    [input.email, passwordHash, input.full_name],
  );
  return rows[0];
}
