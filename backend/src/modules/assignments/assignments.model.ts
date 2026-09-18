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

export async function getAssignmentCompletion(assignmentId: number): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT * FROM app.v_assignment_completion WHERE assignment_id = $1`,
    [assignmentId],
  );
  return rows;
}

export async function assignStudySet(circleId: number, studySetId: number, dueDate: string): Promise<void> {
  await pool.query('CALL app.assign_study_set($1, $2, $3)', [circleId, studySetId, dueDate]);
}
