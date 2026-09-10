import { pool } from '../../db/pool.js';
import type { StudentRow } from './students.interface.js';

// The enrolment list: a teacher picks a student_id from here when enrolling
// into a circle (docs/backend-prd.md §5.6). No visibility filter — names and
// emails of students are directory information within the institution, and
// progress data never rides along (that stays behind the circle-owner check).
export async function listStudents(): Promise<StudentRow[]> {
  const { rows } = await pool.query<StudentRow>(
    `SELECT user_id, email, full_name, student_level, created_at
       FROM app.students ORDER BY created_at`,
  );
  return rows;
}
