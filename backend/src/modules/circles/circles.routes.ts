import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole.js';
import {
  deleteCircleStudent,
  getCircle,
  getCircleOverviewHandler,
  getCircleStudents,
  getCircles,
  patchCircle,
  postCircle,
  postCircleStudent,
} from './circles.controller.js';

// Only a verified teacher opens a circle (docs/backend-prd.md §5.6). The
// verified gate itself lives in the trg_circles_teacher_verified trigger;
// the role guard here keeps students and admins out with a 403 before the
// database is even reached. An admin verifies teachers, they do not run
// circles, so admins are excluded too.
export const circlesRoutes = Router();

circlesRoutes.get('/', getCircles);
circlesRoutes.post('/', requireRole('teacher'), postCircle);
circlesRoutes.get('/:id', getCircle);
circlesRoutes.patch('/:id', requireRole('teacher'), patchCircle);
circlesRoutes.get('/:id/students', requireRole('teacher'), getCircleStudents);
circlesRoutes.post('/:id/students', requireRole('teacher'), postCircleStudent);
circlesRoutes.delete('/:id/students/:sid', requireRole('teacher'), deleteCircleStudent);
circlesRoutes.get('/:id/overview', requireRole('teacher'), getCircleOverviewHandler);
