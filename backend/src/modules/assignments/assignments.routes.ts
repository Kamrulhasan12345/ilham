import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole.js';
import {
  deleteAssignmentHandler,
  getAssignment,
  getAssignmentCompletionHandler,
  getAssignments,
  patchAssignment,
  postAssignment,
} from './assignments.controller.js';

export const assignmentsRoutes = Router();

assignmentsRoutes.get('/', getAssignments);
assignmentsRoutes.post('/', requireRole('teacher', 'admin'), postAssignment);
assignmentsRoutes.get('/:id/completion', requireRole('teacher', 'admin'), getAssignmentCompletionHandler);
assignmentsRoutes.get('/:id', getAssignment);
assignmentsRoutes.patch('/:id', requireRole('teacher', 'admin'), patchAssignment);
assignmentsRoutes.delete('/:id', requireRole('teacher', 'admin'), deleteAssignmentHandler);
