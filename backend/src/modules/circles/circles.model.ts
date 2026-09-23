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

// The teacher dashboard (PRD Q4): per enrolled student, assigned / mastered /
// overdue. Mastery of 3 or more counts as mastered (frontend PRD §9.2; the
// schema names no levels). (see the mastery
// rule in reviews.model.ts). No view exists for this in the DDL, so the query
// lives here, with the rest of the SQL, instead of inventing schema.
export async function getCircleOverview(circleId: number): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT e.student_id,
       (SELECT count(DISTINCT si.hadith_id)
          FROM app.assignments a
          JOIN app.set_items si ON si.set_id = a.set_id
         WHERE a.circle_id = $1) AS assigned,
       (SELECT count(DISTINCT p.hadith_id)
          FROM app.progress p
          JOIN app.assignments a ON a.assignment_id = p.assignment_id
         WHERE p.student_id = e.student_id AND a.circle_id = $1 AND p.mastery >= 3) AS mastered,
       (SELECT count(*)
          FROM app.assignments a
         WHERE a.circle_id = $1 AND a.due_date < CURRENT_DATE
           AND (SELECT count(DISTINCT si.hadith_id) FROM app.set_items si WHERE si.set_id = a.set_id)
             > (SELECT count(DISTINCT p.hadith_id) FROM app.progress p
                 WHERE p.assignment_id = a.assignment_id AND p.student_id = e.student_id AND p.mastery >= 3)) AS overdue
       FROM app.enrollments e
      WHERE e.circle_id = $1
      ORDER BY e.student_id`,
    [circleId],
  );
  return rows;
}
