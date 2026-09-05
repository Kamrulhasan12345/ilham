import { Hono } from 'hono';
import { requireRole } from '../../middleware/requireRole.js';
import { getCircles, postCircle } from './circles.controller.js';

// Only a verified teacher opens a circle (docs/backend-prd.md §5.6). The
// verified gate itself lives in the trg_circles_teacher_verified trigger;
// the role guard here keeps students and admins out with a 403 before the
// database is even reached. An admin verifies teachers, they do not run
// circles, so admins are excluded too.
export const circlesRoutes = new Hono();

circlesRoutes.get('/', getCircles);
circlesRoutes.post('/', requireRole('teacher'), postCircle);
