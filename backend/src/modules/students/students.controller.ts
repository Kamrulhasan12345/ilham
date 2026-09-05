import type { Context } from 'hono';
import { listStudents } from './students.model.js';

export async function getStudents(c: Context) {
  const students = await listStudents();
  return c.json({ data: students });
}
