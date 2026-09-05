import { pool } from '../../db/pool.js';
import type { CircleRow } from './circles.interface.js';

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
