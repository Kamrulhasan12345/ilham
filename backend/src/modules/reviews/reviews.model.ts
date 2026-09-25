import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../lib/transaction.js';
import type { CreateReviewSessionInput, ReviewSessionRow } from './reviews.interface.js';

function masteryExpression(result: 'pass' | 'partial' | 'fail'): string {
  if (result === 'pass') return 'least(mastery + 1, 4)';
  if (result === 'fail') return 'greatest(mastery - 1, 0)';
  return 'mastery';
}

async function upsertProgressForItem(
  client: PoolClient,
  studentId: number,
  hadithId: number,
  assignmentId: number | null,
  result: 'pass' | 'partial' | 'fail',
): Promise<void> {
  const masteryExpr = masteryExpression(result);

  const { rowCount } = await client.query(
    `UPDATE app.progress
        SET mastery = ${masteryExpr},
            times_reviewed = times_reviewed + 1,
            last_reviewed = now()
      WHERE student_id = $1 AND hadith_id = $2
        AND assignment_id IS NOT DISTINCT FROM $3`,
    [studentId, hadithId, assignmentId],
  );

  if ((rowCount ?? 0) === 0) {
    const initialMastery = result === 'pass' ? 1 : 0;
    await client.query(
      `INSERT INTO app.progress (student_id, hadith_id, assignment_id, mastery, times_reviewed, last_reviewed)
       VALUES ($1, $2, $3, $4, 1, now())`,
      [studentId, hadithId, assignmentId, initialMastery],
    );
  }
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

    if (input.items.length > 0) {
      const values: unknown[] = [];
      const rowsSql = input.items
        .map((item, i) => {
          values.push(session.session_id, item.hadith_id, item.result);
          const base = i * 3;
          return `($${base + 1}, $${base + 2}, $${base + 3})`;
        })
        .join(', ');
      await client.query(
        `INSERT INTO app.review_items (session_id, hadith_id, result) VALUES ${rowsSql}`,
        values,
      );

      for (const item of input.items) {
        await upsertProgressForItem(client, input.studentId, item.hadith_id, input.assignmentId, item.result);
      }
    }

    return session;
  });
}

function foldResult(
  state: { mastery: number; times: number },
  result: 'pass' | 'partial' | 'fail',
  first: boolean,
): { mastery: number; times: number } {
  if (first) {
    return { mastery: result === 'pass' ? 1 : 0, times: 1 };
  }
  if (result === 'pass') return { mastery: Math.min(state.mastery + 1, 4), times: state.times + 1 };
  if (result === 'fail')
    return { mastery: Math.max(state.mastery - 1, 0), times: state.times + 1 };
  return { mastery: state.mastery, times: state.times + 1 };
}

// Delete a session and rebuild the progress it touched. Mastery folds are
// path-dependent (least/greatest clamps), so there is no inverse operation:
// the only exact undo replays the REMAINING items in time order through the
// same rules creation uses. Attribution needs the triple, and items carry no
// assignment link — so a hadith studied under several triples refuses with
// 'ambiguous' (the teacher override stays available for those).
//
// Zeroed rows are UPDATED, never deleted: trg_progress_stats fires on INSERT
// and UPDATE only, so a delete would leave student_stats stale. A zeroed
// self-study row is behaviourally identical to never-reviewed.
export async function deleteReviewSession(
  sessionId: number,
  actorUserId: number,
): Promise<'deleted' | 'missing' | 'ambiguous'> {
  return withTransaction(async (client) => {
    const { rows: found } = await client.query<ReviewSessionRow>(
      `SELECT session_id, student_id, reviewer_id, circle_id, created_at
         FROM app.review_sessions WHERE session_id = $1`,
      [sessionId],
    );
    const session = found[0];
    if (!session) return 'missing';

    const { rows: doomed } = await client.query<{ hadith_id: number }>(
      `SELECT hadith_id FROM app.review_items WHERE session_id = $1`,
      [sessionId],
    );
    const hadiths = [...new Set(doomed.map((r) => r.hadith_id))];

    // Checks first: no writes happen before every triple is attributable.
    const triples = new Map<number, { progress_id: number; assignment_id: number | null }>();
    for (const hadithId of hadiths) {
      const { rows } = await client.query<{
        progress_id: number;
        assignment_id: number | null;
      }>(
        `SELECT progress_id, assignment_id FROM app.progress
          WHERE student_id = $1 AND hadith_id = $2`,
        [session.student_id, hadithId],
      );
      if (rows.length !== 1) return 'ambiguous';
      triples.set(hadithId, rows[0]);
    }

    // Same actor attribution the teacher override uses.
    await client.query(`SELECT set_config('ilham.user_id', $1, true)`, [String(actorUserId)]);

    for (const hadithId of hadiths) {
      const triple = triples.get(hadithId)!;
      const { rows: rest } = await client.query<{
        result: 'pass' | 'partial' | 'fail';
        created_at: string;
      }>(
        `SELECT ri.result, rs.created_at
           FROM app.review_items ri
           JOIN app.review_sessions rs ON rs.session_id = ri.session_id
          WHERE rs.student_id = $1 AND ri.hadith_id = $2 AND rs.session_id <> $3
          ORDER BY rs.created_at, rs.session_id`,
        [session.student_id, hadithId, sessionId],
      );
      let state = { mastery: 0, times: 0 };
      let last: string | null = null;
      rest.forEach((item, i) => {
        state = foldResult(state, item.result, i === 0);
        last = item.created_at;
      });
      await client.query(
        `UPDATE app.progress SET mastery = $2, times_reviewed = $3, last_reviewed = $4
          WHERE progress_id = $1`,
        [triple.progress_id, state.mastery, state.times, last],
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
