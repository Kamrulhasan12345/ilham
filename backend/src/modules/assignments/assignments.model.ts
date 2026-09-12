import { pool } from '../../db/pool.js';
import type { AssignmentRow } from './assignments.interface.js';

export async function listAssignmentsForStudent(studentId: number): Promise<AssignmentRow[]> {
  const { rows } = await pool.query<AssignmentRow>(
    `SELECT a.assignment_id, a.circle_id, a.study_set_id, a.due_date, a.created_at
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
    `SELECT a.assignment_id, a.circle_id, a.study_set_id, a.due_date, a.created_at
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
    `SELECT assignment_id, circle_id, study_set_id, due_date, created_at
       FROM app.assignments WHERE assignment_id = $1`,
    [assignmentId],
  );
  return rows[0] ?? null;
}

// PRD §5.5 Q6: app.v_assignment_completion -- "Per student: due, done,
// percentage." Filtered by the caller's assignment (ownership checked in
// the controller before this runs).
export async function getAssignmentCompletion(assignmentId: number): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT * FROM app.v_assignment_completion WHERE assignment_id = $1`,
    [assignmentId],
  );
  return rows;
}

// PRD §5.8 — THREE RULES, each a real failure mode if broken:
// 1. Do NOT open a transaction around the CALL. The procedure's own COMMIT
//    fails with "invalid transaction termination" inside a BEGIN block.
//    Use pool.query, never withTransaction.
// 2. Ownership of the circle must be checked by the CALLER (controller)
//    BEFORE this runs — the procedure commits, so there is nothing to roll
//    back if it turns out the teacher didn't own the circle.
// 3. Calling this twice with the same args is correct and creates TWO
//    assignments. Never add an "already assigned" guard here.
export async function assignStudySet(circleId: number, studySetId: number, dueDate: string): Promise<void> {
  await pool.query('CALL app.assign_study_set($1, $2, $3)', [circleId, studySetId, dueDate]);
}
