import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import {
  createCircle,
  enrollStudent,
  getCircleById,
  getCircleOverview,
  isStudentInCircle,
  listAllCircles,
  listCirclesForStudent,
  listCirclesForTeacher,
  listStudentsInCircle,
  renameCircle,
  unenrollStudent,
} from './circles.model.js';

const createCircleSchema = z.object({ name: z.string().min(1) });
const enrollSchema = z.object({ student_id: z.number().int() });

export async function getCircles(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const circles =
      role === 'admin'
        ? await listAllCircles()
        : role === 'teacher'
          ? await listCirclesForTeacher(userId)
          : await listCirclesForStudent(userId);
    res.json({ data: circles });
  } catch (e) {
    next(e);
  }
}

export async function postCircle(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.user!;
    const body = createCircleSchema.parse(req.body);
    const circle = await createCircle({ teacherId: userId, name: body.name });
    res.status(201).json({ data: circle });
  } catch (e) {
    next(e);
  }
}

export async function getCircle(req: Request, res: Response, next: NextFunction) {
  try {
    const circleId = Number(req.params.id);
    if (!Number.isInteger(circleId)) throw new BadRequestError('invalid circle id');
    const circle = await getCircleById(circleId);
    if (!circle) throw new NotFoundError('circle not found');

    const { userId, role } = req.user!;
    if (role === 'admin') return res.json({ data: circle });
    if (role === 'teacher' && circle.teacher_id === userId) return res.json({ data: circle });
    if (role === 'student' && (await isStudentInCircle(circleId, userId))) {
      return res.json({ data: circle });
    }
    throw new NotFoundError('circle not found');
  } catch (e) {
    next(e);
  }
}

async function requireOwnedCircle(req: Request, circleId: number) {
  const circle = await getCircleById(circleId);
  if (!circle) throw new NotFoundError('circle not found');
  if (req.user!.role !== 'admin' && circle.teacher_id !== req.user!.userId) {
    throw new ForbiddenError('you do not own this circle');
  }
  return circle;
}

export async function patchCircle(req: Request, res: Response, next: NextFunction) {
  try {
    const circleId = Number(req.params.id);
    if (!Number.isInteger(circleId)) throw new BadRequestError('invalid circle id');
    await requireOwnedCircle(req, circleId);
    const body = createCircleSchema.parse(req.body);
    const updated = await renameCircle(circleId, body.name);
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function getCircleStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const circleId = Number(req.params.id);
    if (!Number.isInteger(circleId)) throw new BadRequestError('invalid circle id');
    await requireOwnedCircle(req, circleId);
    const students = await listStudentsInCircle(circleId);
    res.json({ data: students });
  } catch (e) {
    next(e);
  }
}

export async function postCircleStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const circleId = Number(req.params.id);
    if (!Number.isInteger(circleId)) throw new BadRequestError('invalid circle id');
    await requireOwnedCircle(req, circleId);
    const body = enrollSchema.parse(req.body);
    await enrollStudent(circleId, body.student_id);
    res.status(201).json({ data: { circle_id: circleId, student_id: body.student_id } });
  } catch (e) {
    next(e);
  }
}

export async function getCircleOverviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const circleId = Number(req.params.id);
    if (!Number.isInteger(circleId)) throw new BadRequestError('invalid circle id');
    await requireOwnedCircle(req, circleId);
    const overview = await getCircleOverview(circleId);
    res.json({ data: overview });
  } catch (e) {
    next(e);
  }
}

export async function deleteCircleStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const circleId = Number(req.params.id);
    const studentId = Number(req.params.sid);
    if (!Number.isInteger(circleId) || !Number.isInteger(studentId)) {
      throw new BadRequestError('invalid id');
    }
    await requireOwnedCircle(req, circleId);
    const removed = await unenrollStudent(circleId, studentId);
    if (!removed) throw new NotFoundError('enrollment not found');
    res.json({ data: null });
  } catch (e) {
    next(e);
  }
}
