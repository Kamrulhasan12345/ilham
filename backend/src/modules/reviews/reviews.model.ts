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
