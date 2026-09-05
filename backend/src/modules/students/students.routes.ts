import { Hono } from 'hono';
import { requireRole } from '../../middleware/requireRole.js';
import { getStudents } from './students.controller.js';

// Students never list each other (visibility rules, docs/backend-prd.md §4).
// Teachers and admins do: enrolment needs a student_id from somewhere.
export const studentsRoutes = new Hono();

studentsRoutes.get('/', requireRole('teacher', 'admin'), getStudents);
