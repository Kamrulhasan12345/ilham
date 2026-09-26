import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../lib/transaction.js';
import type { CreateReviewSessionInput, ReviewSessionRow } from './reviews.interface.js';

type Result = 'pass' | 'partial' | 'fail';

interface ProgressState {
  mastery: number;
  times_reviewed: number;
  last_reviewed: string | null;
}

// The one review rule. The create path applies it, and the delete path uses it
// to check that a progress row still holds what the session left there.
function applyResult(mastery: number, result: Result): number {
  if (result === 'pass') return Math.min(mastery + 1, 4);
  if (result === 'fail') return Math.max(mastery - 1, 0);
  return mastery;
}

// Apply one result to its progress row and return the row id and its state
// before the change. A missing row counts as 0 / 0 / never, the same as a
// fresh assignment row.
async function applyToProgress(
  client: PoolClient,
  studentId: number,
  hadithId: number,
  assignmentId: number | null,
  result: Result,
): Promise<{ progressId: number; prev: ProgressState }> {
  const { rows } = await client.query<ProgressState & { progress_id: number }>(
    `SELECT progress_id, mastery, times_reviewed, last_reviewed FROM app.progress
      WHERE student_id = $1 AND hadith_id = $2
        AND assignment_id IS NOT DISTINCT FROM $3
      FOR UPDATE`,
    [studentId, hadithId, assignmentId],
  );
  const found = rows[0];
  const prev: ProgressState = found ?? { mastery: 0, times_reviewed: 0, last_reviewed: null };
  const mastery = applyResult(prev.mastery, result);

  if (found) {
    await client.query(
      `UPDATE app.progress
          SET mastery = $2, times_reviewed = times_reviewed + 1, last_reviewed = now()
        WHERE progress_id = $1`,
      [found.progress_id, mastery],
    );
    return { progressId: found.progress_id, prev };
  }
  const { rows: inserted } = await client.query<{ progress_id: number }>(
    `INSERT INTO app.progress (student_id, hadith_id, assignment_id, mastery, times_reviewed, last_reviewed)
     VALUES ($1, $2, $3, $4, 1, now())
     RETURNING progress_id`,
    [studentId, hadithId, assignmentId, mastery],
  );
  return { progressId: inserted[0].progress_id, prev };
}

export async function createReviewSession(input: CreateReviewSessionInput): Promise<ReviewSessionRow> {
  return withTransaction(async (client) => {
    const { rows: sessionRows } = await client.query<ReviewSessionRow>(
      `INSERT INTO app.review_sessions (student_id, reviewer_id, circle_id)
       VALUES ($1, $2, $3)
       RETURNING session_id, student_id, reviewer_id, circle_id, created_at`,
      [input.studentId, input.reviewerId, input.circleId],
    );
    const session = sessionRows[0];

    for (const item of input.items) {
      const { progressId, prev } = await applyToProgress(
        client,
        input.studentId,
        item.hadith_id,
        input.assignmentId,
        item.result,
      );
      await client.query(
        `INSERT INTO app.review_items
           (session_id, hadith_id, result, progress_id, prev_mastery, prev_times_reviewed, prev_last_reviewed)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          session.session_id,
          item.hadith_id,
          item.result,
          progressId,
          prev.mastery,
          prev.times_reviewed,
          prev.last_reviewed,
        ],
      );
    }

    return session;
  });
}

// Delete a session and put each progress row it changed back to its state
// before the session (db/11_review_undo.sql). The restore is exact, so a
// teacher override made before the session survives.
//
// The delete is refused when a row no longer holds what this session left in
// it: a later review or an override changed it, and a restore would erase that
// change. It is also refused for a session recorded before 11 ran, because
// those items hold no snapshot.
//
// Zeroed rows are UPDATED, never deleted: trg_progress_stats fires on INSERT
// and UPDATE only, so a delete would leave student_stats stale. A zeroed
// self-study row is behaviourally identical to never-reviewed.
export async function deleteReviewSession(
  sessionId: number,
  actorUserId: number,
): Promise<'deleted' | 'missing' | 'legacy' | 'changed'> {
  return withTransaction(async (client) => {
    const { rows: found } = await client.query(
      'SELECT 1 FROM app.review_sessions WHERE session_id = $1 FOR UPDATE',
      [sessionId],
    );
    if (found.length === 0) return 'missing';

    const { rows: items } = await client.query<{
      result: Result;
      progress_id: number | null;
      prev_mastery: number | null;
      prev_times_reviewed: number | null;
      prev_last_reviewed: string | null;
      mastery: number | null;
      times_reviewed: number | null;
    }>(
      `SELECT ri.result, ri.progress_id, ri.prev_mastery, ri.prev_times_reviewed,
              ri.prev_last_reviewed, p.mastery, p.times_reviewed
         FROM app.review_items ri
         LEFT JOIN app.progress p ON p.progress_id = ri.progress_id
        WHERE ri.session_id = $1
          FOR UPDATE OF ri`,
      [sessionId],
    );

    // Checks first: no write happens before every item can be restored.
    // An item whose progress row is gone (its assignment was deleted) has
    // nothing to restore.
    const restorable = items.filter((item) => item.progress_id !== null);
    for (const item of items) {
      if (item.prev_mastery === null || item.prev_times_reviewed === null) return 'legacy';
    }
    for (const item of restorable) {
      const expectedMastery = applyResult(item.prev_mastery!, item.result);
      const expectedTimes = item.prev_times_reviewed! + 1;
      if (item.mastery !== expectedMastery || item.times_reviewed !== expectedTimes) return 'changed';
    }

    // Same actor attribution the teacher override uses.
    await client.query(`SELECT set_config('ilham.user_id', $1, true)`, [String(actorUserId)]);

    for (const item of restorable) {
      await client.query(
        `UPDATE app.progress SET mastery = $2, times_reviewed = $3, last_reviewed = $4
          WHERE progress_id = $1`,
        [item.progress_id, item.prev_mastery, item.prev_times_reviewed, item.prev_last_reviewed],
      );
    }

    await client.query('DELETE FROM app.review_items WHERE session_id = $1', [sessionId]);
    await client.query('DELETE FROM app.review_sessions WHERE session_id = $1', [sessionId]);
    return 'deleted';
  });
}

export async function listReviewSessionsForStudent(studentId: number): Promise<ReviewSessionRow[]> {
  const { rows } = await pool.query<ReviewSessionRow>(
    `SELECT session_id, student_id, reviewer_id, circle_id, created_at
       FROM app.review_sessions WHERE student_id = $1 ORDER BY created_at DESC`,
    [studentId],
  );
  return rows;
}

export async function listReviewSessionsForTeacher(teacherId: number): Promise<ReviewSessionRow[]> {
  const { rows } = await pool.query<ReviewSessionRow>(
    `SELECT rs.session_id, rs.student_id, rs.reviewer_id, rs.circle_id, rs.created_at
       FROM app.review_sessions rs
       JOIN app.circles c ON c.circle_id = rs.circle_id
      WHERE c.teacher_id = $1
      ORDER BY rs.created_at DESC`,
    [teacherId],
  );
  return rows;
}

export async function getReviewSessionById(sessionId: number): Promise<ReviewSessionRow | null> {
  const { rows } = await pool.query<ReviewSessionRow>(
    `SELECT session_id, student_id, reviewer_id, circle_id, created_at
       FROM app.review_sessions WHERE session_id = $1`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function listReviewItems(
  sessionId: number,
): Promise<{ hadith_id: number; result: string }[]> {
  const { rows } = await pool.query<{ hadith_id: number; result: string }>(
    `SELECT hadith_id, result FROM app.review_items WHERE session_id = $1 ORDER BY hadith_id`,
    [sessionId],
  );
  return rows;
}
