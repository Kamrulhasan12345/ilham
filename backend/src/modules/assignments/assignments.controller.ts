import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { getCircleById } from '../circles/circles.model.js';
import {
  assignStudySet,
  getAssignmentById,
  getAssignmentCompletion,
  listAssignmentsForStudent,
  listAssignmentsForTeacher,
} from './assignments.model.js';

// zod validates all three integers up front. PRD §5.8 rule 3: "validate the
// three integers with zod, then send the CALL as a simple query" if the
// extended query protocol ever refuses a procedure with transaction control.
const assignSchema = z.object({
  circle_id: z.number().int(),
  study_set_id: z.number().int(),
  due_date: z.string(), // ISO date string; DB column does the real validation
});

export async function getAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const assignments =
      role === 'student'
        ? await listAssignmentsForStudent(userId)
        : await listAssignmentsForTeacher(userId); // admin sees via teacher-shaped query is out of scope here; teachers/admins both use circle ownership joins
    res.json({ data: assignments });
  } catch (e) {
    next(e);
  }
}

export async function postAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const body = assignSchema.parse(req.body);

    // RULE 2 (PRD §5.8): check circle ownership BEFORE the CALL — the
    // procedure commits internally, so there is nothing to roll back after.
    const circle = await getCircleById(body.circle_id);
    if (!circle) throw new NotFoundError('circle not found');
    if (req.user!.role !== 'admin' && circle.teacher_id !== req.user!.userId) {
      throw new ForbiddenError('you do not own this circle');
    }

    // RULE 1: plain pool.query, no withTransaction — the procedure owns its
    // own COMMIT. RULE 3: no "already assigned" check; calling this twice
    // is correct and creates two assignments deliberately.
    await assignStudySet(body.circle_id, body.study_set_id, body.due_date);
    res.status(201).json({ data: { circle_id: body.circle_id, study_set_id: body.study_set_id, due_date: body.due_date } });
  } catch (e) {
    next(e);
  }
}

export async function getAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid assignment id');
    const assignment = await getAssignmentById(id);
    if (!assignment) throw new NotFoundError('assignment not found');

    const { userId, role } = req.user!;
    if (role === 'admin') return res.json({ data: assignment });
    if (role === 'teacher') {
      const circle = await getCircleById(assignment.circle_id);
      if (circle?.teacher_id === userId) return res.json({ data: assignment });
    }
    // A student's visibility is via their circle enrollment; simplest
    // correct check re-uses listAssignmentsForStudent's join semantics.
    if (role === 'student') {
      const mine = await listAssignmentsForStudent(userId);
      if (mine.some((a) => a.assignment_id === id)) return res.json({ data: assignment });
    }
    throw new NotFoundError('assignment not found');
  } catch (e) {
    next(e);
  }
}

// PRD §5.5 Q6 / §5.8: GET /assignments/:id/completion | T + owner
export async function getAssignmentCompletionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid assignment id');
    const assignment = await getAssignmentById(id);
    if (!assignment) throw new NotFoundError('assignment not found');

    const circle = await getCircleById(assignment.circle_id);
    if (!circle) throw new NotFoundError('assignment not found');
    if (req.user!.role !== 'admin' && circle.teacher_id !== req.user!.userId) {
      throw new ForbiddenError('you do not own this circle');
    }

    const completion = await getAssignmentCompletion(id);
    res.json({ data: completion });
  } catch (e) {
    next(e);
  }
}
