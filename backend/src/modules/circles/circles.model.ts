import { pool } from '../../db/pool.js';
import type { CircleRow, StudentInCircleRow } from './circles.interface.js';

// Visibility per docs/backend-prd.md §4: a teacher sees the circles they own,
// a student sees the circles they are enrolled in, an admin sees everything.
export async function listCirclesForTeacher(teacherId: number): Promise<CircleRow[]> {
  const { rows } = await pool.query<CircleRow>(
    `SELECT circle_id, teacher_id, name, created_at
       FROM app.circles WHERE teacher_id = $1 ORDER BY created_at DESC`,
    [teacherId],
  );
  return rows;
}

export async function listCirclesForStudent(studentId: number): Promise<CircleRow[]> {
  const { rows } = await pool.query<CircleRow>(
    `SELECT c.circle_id, c.teacher_id, c.name, c.created_at
       FROM app.circles c
       JOIN app.enrollments e ON e.circle_id = c.circle_id
      WHERE e.student_id = $1 ORDER BY c.created_at DESC`,
    [studentId],
  );
  return rows;
}

export async function listAllCircles(): Promise<CircleRow[]> {
  const { rows } = await pool.query<CircleRow>(
    `SELECT circle_id, teacher_id, name, created_at
       FROM app.circles ORDER BY created_at DESC`,
  );
  return rows;
}

export async function getCircleById(circleId: number): Promise<CircleRow | null> {
  const { rows } = await pool.query<CircleRow>(
    `SELECT circle_id, teacher_id, name, created_at FROM app.circles WHERE circle_id = $1`,
    [circleId],
  );
  return rows[0] ?? null;
}

export async function isStudentInCircle(circleId: number, studentId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM app.enrollments WHERE circle_id = $1 AND student_id = $2`,
    [circleId, studentId],
  );
  return rows.length > 0;
}

// The teacher_id always comes from the verified JWT, never from the body.
// The trg_circles_teacher_verified trigger rejects an unverified teacher;
// app.ts maps that 23514 to 403 teacher_not_verified.
export async function createCircle(input: { teacherId: number; name: string }): Promise<CircleRow> {
  const { rows } = await pool.query<CircleRow>(
    `INSERT INTO app.circles (teacher_id, name)
     VALUES ($1, $2)
     RETURNING circle_id, teacher_id, name, created_at`,
    [input.teacherId, input.name],
  );
  return rows[0];
}

export async function renameCircle(circleId: number, name: string): Promise<CircleRow | null> {
  const { rows } = await pool.query<CircleRow>(
    `UPDATE app.circles SET name = $2 WHERE circle_id = $1
     RETURNING circle_id, teacher_id, name, created_at`,
    [circleId, name],
  );
  return rows[0] ?? null;
}

export async function listStudentsInCircle(circleId: number): Promise<StudentInCircleRow[]> {
  const { rows } = await pool.query<StudentInCircleRow>(
    `SELECT s.user_id AS student_id, s.full_name, s.email
       FROM app.enrollments e
       JOIN app.students s ON s.user_id = e.student_id
      WHERE e.circle_id = $1
      ORDER BY s.full_name`,
    [circleId],
  );
  return rows;
}

export async function enrollStudent(circleId: number, studentId: number): Promise<void> {
  await pool.query(
    `INSERT INTO app.enrollments (circle_id, student_id) VALUES ($1, $2)`,
    [circleId, studentId],
  );
}

export async function unenrollStudent(circleId: number, studentId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM app.enrollments WHERE circle_id = $1 AND student_id = $2`,
    [circleId, studentId],
  );
  return (rowCount ?? 0) > 0;
}

export async function getCircleOverview(circleId: number): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT * FROM app.v_circle_overview WHERE circle_id = $1`,
    [circleId],
  );
  return rows;
}
