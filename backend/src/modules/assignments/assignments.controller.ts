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

const assignSchema = z.object({
  circle_id: z.number().int(),
  study_set_id: z.number().int(),
  due_date: z.string(),
});

export async function getAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const assignments =
      role === 'student'
        ? await listAssignmentsForStudent(userId)
        : await listAssignmentsForTeacher(userId);
    res.json({ data: assignments });
  } catch (e) {
    next(e);
  }
}

export async function postAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const body = assignSchema.parse(req.body);

    const circle = await getCircleById(body.circle_id);
    if (!circle) throw new NotFoundError('circle not found');
    if (req.user!.role !== 'admin' && circle.teacher_id !== req.user!.userId) {
      throw new ForbiddenError('you do not own this circle');
    }

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
    if (role === 'student') {
      const mine = await listAssignmentsForStudent(userId);
      if (mine.some((a) => a.assignment_id === id)) return res.json({ data: assignment });
    }
    throw new NotFoundError('assignment not found');
  } catch (e) {
    next(e);
  }
}

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
