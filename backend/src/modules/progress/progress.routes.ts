import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole.js';
import { getAuditLog, getProgress, getStudentStatsHandler, patchProgress } from './progress.controller.js';

export const progressRoutes = Router();

progressRoutes.get('/', getProgress);
progressRoutes.get('/audit-log', requireRole('admin'), getAuditLog);
progressRoutes.patch('/:progressId', requireRole('teacher', 'admin'), patchProgress);

export { getStudentStatsHandler };
