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

export const circlesRoutes = Router();

// PRD §5.6 table:
// GET  /circles                A     — role-based visibility (in controller)
// POST /circles                T     — 403 teacher_not_verified if unverified
// GET  /circles/:id            A+member
// PATCH /circles/:id           T+owner
// GET  /circles/:id/students   T+owner
// POST /circles/:id/students   T+owner
// DELETE /circles/:id/students/:sid  T+owner
// (GET /circles/:id/overview -> Q4, wired in the analytics/circles overlap; see progress/analytics modules)
circlesRoutes.get('/', getCircles);
circlesRoutes.post('/', requireRole('teacher'), postCircle);
circlesRoutes.get('/:id', getCircle);
circlesRoutes.patch('/:id', requireRole('teacher'), patchCircle);
circlesRoutes.get('/:id/students', requireRole('teacher'), getCircleStudents);
circlesRoutes.post('/:id/students', requireRole('teacher'), postCircleStudent);
circlesRoutes.delete('/:id/students/:sid', requireRole('teacher'), deleteCircleStudent);
circlesRoutes.get('/:id/overview', requireRole('teacher'), getCircleOverviewHandler);
