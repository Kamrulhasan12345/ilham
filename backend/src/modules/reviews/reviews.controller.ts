import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import {
  createReviewSession,
  getReviewSessionById,
  listReviewItems,
  listReviewSessionsForStudent,
  listReviewSessionsForTeacher,
} from './reviews.model.js';

// PRD §5.9 body shape exactly:
// { student_id, circle_id, assignment_id, items: [{ hadith_id, result }] }
const createSchema = z.object({
  student_id: z.number().int(),
  circle_id: z.number().int().nullable().optional(),
  assignment_id: z.number().int().nullable().optional(), // absent/null = self-study
  items: z.array(
    z.object({
      hadith_id: z.number().int(),
      result: z.enum(['pass', 'partial', 'fail']),
    }),
  ),
});

export async function postReviewSession(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body);
    const { userId, role } = req.user!;

    // §12.4 open decision resolved as "yes, with restriction to self":
    // a student may only create a session for themselves; a teacher may
    // create one for any student in their circle (circle ownership isn't
    // re-verified at the SQL layer here since review_sessions.circle_id is
    // nullable and self-study needs no circle at all).
    if (role === 'student' && body.student_id !== userId) {
      throw new BadRequestError('a student may only submit a review session for themselves');
    }

    const session = await createReviewSession({
      studentId: body.student_id,
      reviewerId: role === 'teacher' ? userId : null,
      circleId: body.circle_id ?? null,
      assignmentId: body.assignment_id ?? null,
      items: body.items,
    });
    res.status(201).json({ data: session });
  } catch (e) {
    next(e);
  }
}

export async function getReviewSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const sessions =
      role === 'student' ? await listReviewSessionsForStudent(userId) : await listReviewSessionsForTeacher(userId);
    res.json({ data: sessions });
  } catch (e) {
    next(e);
  }
}

export async function getReviewSession(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid session id');
    const session = await getReviewSessionById(id);
    if (!session) throw new NotFoundError('review session not found');

    const { userId, role } = req.user!;
    const visible =
      role === 'admin' ||
      (role === 'student' && session.student_id === userId) ||
      (role === 'teacher' && session.reviewer_id === userId);
    if (!visible) throw new NotFoundError('review session not found');

    const items = await listReviewItems(id);
    res.json({ data: { ...session, items } });
  } catch (e) {
    next(e);
  }
}
