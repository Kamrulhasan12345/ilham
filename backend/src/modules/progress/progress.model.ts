import { pool } from '../../db/pool.js';
import { withTransaction } from '../../lib/transaction.js';
import type { AuditLogRow, ProgressRow } from './progress.interface.js';

export interface ProgressFilter {
  studentId?: number;
  assignmentId?: number;
}

export async function listProgress(filter: ProgressFilter): Promise<ProgressRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filter.studentId !== undefined) {
    values.push(filter.studentId);
    conditions.push(`student_id = $${values.length}`);
  }
  if (filter.assignmentId !== undefined) {
    values.push(filter.assignmentId);
    conditions.push(`assignment_id = $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query<ProgressRow>(
    `SELECT progress_id, student_id, hadith_id, assignment_id, mastery, times_reviewed, last_reviewed
       FROM app.progress ${where} ORDER BY progress_id`,
    values,
  );
  return rows;
}

export async function getProgressById(progressId: number): Promise<ProgressRow | null> {
  const { rows } = await pool.query<ProgressRow>(
    `SELECT progress_id, student_id, hadith_id, assignment_id, mastery, times_reviewed, last_reviewed
       FROM app.progress WHERE progress_id = $1`,
    [progressId],
  );
  return rows[0] ?? null;
}

export async function getStudentStats(studentId: number): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(`SELECT * FROM app.student_stats WHERE student_id = $1`, [
    studentId,
  ]);
  return rows[0] ?? null;
}

export async function overrideMastery(
  progressId: number,
  newMastery: number,
  changedByUserId: number,
): Promise<ProgressRow | null> {
  return withTransaction(async (client) => {
    await client.query(`SELECT set_config('ilham.user_id', $1, true)`, [String(changedByUserId)]);
    const { rows } = await client.query<ProgressRow>(
      `UPDATE app.progress SET mastery = $2 WHERE progress_id = $1
       RETURNING progress_id, student_id, hadith_id, assignment_id, mastery, times_reviewed, last_reviewed`,
      [progressId, newMastery],
    );
    return rows[0] ?? null;
  });
}

export async function listAuditLog(limit: number, offset: number): Promise<AuditLogRow[]> {
  const { rows } = await pool.query<AuditLogRow>(
    `SELECT audit_id, progress_id, changed_by, old_mastery, new_mastery, changed_at
       FROM app.progress_audit
      ORDER BY changed_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows;
}
