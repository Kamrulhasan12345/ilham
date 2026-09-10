import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../../lib/errors.js';
import {
  createCircle,
  listAllCircles,
  listCirclesForStudent,
  listCirclesForTeacher,
} from './circles.model.js';

const createCircleSchema = z.object({ name: z.string().min(1) });

export async function getCircles(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    if (role === 'admin') return res.json({ data: await listAllCircles() });
    if (role === 'teacher') return res.json({ data: await listCirclesForTeacher(userId) });
    res.json({ data: await listCirclesForStudent(userId) });
  } catch (e) {
    next(e);
  }
}

export async function postCircle(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = req.user!.userId;
    const parsed = createCircleSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError('invalid circle payload');
    const circle = await createCircle({ teacherId, name: parsed.data.name });
    res.status(201).json({ data: circle });
  } catch (e) {
    next(e);
  }
}
