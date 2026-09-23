import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole.js';
import {
  getAssignment,
  getAssignmentCompletionHandler,
  getAssignments,
  postAssignment,
} from './assignments.controller.js';

export const assignmentsRoutes = Router();

assignmentsRoutes.get('/', getAssignments);
assignmentsRoutes.post('/', requireRole('teacher', 'admin'), postAssignment);
assignmentsRoutes.get('/:id/completion', requireRole('teacher', 'admin'), getAssignmentCompletionHandler);
assignmentsRoutes.get('/:id', getAssignment);
