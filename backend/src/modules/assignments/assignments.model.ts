import { pool } from '../../db/pool.js';
import { txQuery, withTransaction } from '../../lib/transaction.js';
import type { AssignmentRow } from './assignments.interface.js';

export async function listAssignmentsForStudent(studentId: number): Promise<AssignmentRow[]> {
  const { rows } = await pool.query<AssignmentRow>(
    `SELECT a.assignment_id, a.circle_id, a.set_id AS study_set_id, a.due_date, a.created_at
       FROM app.assignments a
       JOIN app.enrollments e ON e.circle_id = a.circle_id
      WHERE e.student_id = $1
      ORDER BY a.due_date`,
    [studentId],
  );
  return rows;
}

export async function listAssignmentsForTeacher(teacherId: number): Promise<AssignmentRow[]> {
  const { rows } = await pool.query<AssignmentRow>(
    `SELECT a.assignment_id, a.circle_id, a.set_id AS study_set_id, a.due_date, a.created_at
       FROM app.assignments a
       JOIN app.circles c ON c.circle_id = a.circle_id
      WHERE c.teacher_id = $1
      ORDER BY a.due_date`,
    [teacherId],
  );
  return rows;
}

export async function getAssignmentById(assignmentId: number): Promise<AssignmentRow | null> {
  const { rows } = await pool.query<AssignmentRow>(
    `SELECT assignment_id, circle_id, set_id AS study_set_id, due_date, created_at
       FROM app.assignments WHERE assignment_id = $1`,
    [assignmentId],
  );
  return rows[0] ?? null;
}

// Per enrolled student: total hadiths in the set, distinct hadiths reviewed,
// distinct hadiths mastered (mastery at 3 or above). No view
// exists for this in the DDL, so the query lives here instead of inventing
// schema. Progress is keyed by (student, hadith, assignment), so every count
// is count(DISTINCT hadith_id).
export async function getAssignmentCompletion(assignmentId: number): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT e.student_id,
       (SELECT count(DISTINCT si.hadith_id)
          FROM app.set_items si
          JOIN app.assignments a ON a.set_id = si.set_id
         WHERE a.assignment_id = $1) AS total,
       (SELECT count(DISTINCT p.hadith_id) FROM app.progress p
         WHERE p.assignment_id = $1 AND p.student_id = e.student_id) AS reviewed,
       (SELECT count(DISTINCT p.hadith_id) FROM app.progress p
         WHERE p.assignment_id = $1 AND p.student_id = e.student_id AND p.mastery >= 3) AS mastered
       FROM app.enrollments e
       JOIN app.assignments a ON a.circle_id = e.circle_id
      WHERE a.assignment_id = $1
      ORDER BY e.student_id`,
    [assignmentId],
  );
  return rows;
}

export async function assignStudySet(circleId: number, studySetId: number, dueDate: string): Promise<void> {
  await pool.query('CALL app.assign_study_set($1, $2, $3)', [circleId, studySetId, dueDate]);
}

export async function updateAssignmentDueDate(
  assignmentId: number,
  dueDate: string,
): Promise<AssignmentRow | null> {
  const { rows } = await txQuery<AssignmentRow>(
    `UPDATE app.assignments SET due_date = $2 WHERE assignment_id = $1
     RETURNING assignment_id, circle_id, set_id AS study_set_id, due_date, created_at`,
    [assignmentId, dueDate],
  );
  return rows[0] ?? null;
}

// Ordered deletes: every FK in this schema is plain (no cascades), so the
// progress rows go first and the assignment second, in one transaction.
// Review sessions carry no assignment reference and are untouched.
export async function deleteAssignment(assignmentId: number): Promise<boolean> {
  return withTransaction(async (client) => {
    await client.query('DELETE FROM app.progress WHERE assignment_id = $1', [assignmentId]);
    const { rowCount } = await client.query('DELETE FROM app.assignments WHERE assignment_id = $1', [
      assignmentId,
    ]);
    return (rowCount ?? 0) > 0;
  });
}
