import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole.js';
import { getAuditLog, getProgress, getStudentStatsHandler, patchProgress } from './progress.controller.js';

export const progressRoutes = Router();

// PRD §5.10 table:
// GET   /progress              A            -- filters student_id/assignment_id, §4 visibility
// GET   /students/:id/stats    A+self/teach -- mounted under /students in app.ts, not here
// PATCH /progress/:progressId  T+owner       -- fires trg_progress_audit
// GET   /audit-log             Ad            -- paged, newest first
//
// Note: GET /students/:id/stats is routed from the students module (see
// students.routes.ts) since its path prefix is /students, not /progress --
// the PRD lists it in the §5.10 table only because it reads progress-derived
// data, not because it shares this router's path.
progressRoutes.get('/', getProgress);
progressRoutes.get('/audit-log', requireRole('admin'), getAuditLog);
progressRoutes.patch('/:progressId', requireRole('teacher', 'admin'), patchProgress);

export { getStudentStatsHandler };
