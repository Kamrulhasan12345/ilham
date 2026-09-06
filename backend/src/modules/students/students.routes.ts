import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole.js';
import { getStudentStatsHandler } from '../progress/progress.routes.js';
import { getStudents } from './students.controller.js';

export const studentsRoutes = Router();

studentsRoutes.get('/', requireRole('teacher', 'admin'), getStudents);

studentsRoutes.get('/:id/stats', getStudentStatsHandler);
