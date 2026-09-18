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

circlesRoutes.get('/', getCircles);
circlesRoutes.post('/', requireRole('teacher'), postCircle);
circlesRoutes.get('/:id', getCircle);
circlesRoutes.patch('/:id', requireRole('teacher'), patchCircle);
circlesRoutes.get('/:id/students', requireRole('teacher'), getCircleStudents);
circlesRoutes.post('/:id/students', requireRole('teacher'), postCircleStudent);
circlesRoutes.delete('/:id/students/:sid', requireRole('teacher'), deleteCircleStudent);
circlesRoutes.get('/:id/overview', requireRole('teacher'), getCircleOverviewHandler);
