import { pool } from '../../db/pool.js';
import type { StudentRow } from './students.interface.js';

export async function listStudents(): Promise<StudentRow[]> {
  const { rows } = await pool.query<StudentRow>(
    `SELECT user_id, email, full_name, student_level, created_at
       FROM app.students ORDER BY created_at`,
  );
  return rows;
}
