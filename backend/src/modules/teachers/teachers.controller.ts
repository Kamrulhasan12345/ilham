import type { NextFunction, Request, Response } from 'express';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { parsePageParams } from '../../lib/pagination.js';
import { listUnverifiedTeachers, unverifyTeacher, verifyTeacher } from './teachers.model.js';

export async function getUnverifiedTeachers(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePageParams(req.query as Record<string, unknown>);
    const { rows, total } = await listUnverifiedTeachers(limit, offset);
    res.json({ data: rows, page: { limit, offset, total } });
  } catch (e) {
    next(e);
  }
}

export async function postVerifyTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid teacher id');
    const verified = await verifyTeacher(id);
    if (!verified) throw new NotFoundError('teacher not found');
    res.json({ data: { user_id: id, is_verified: true } });
  } catch (e) {
    next(e);
  }
}

export async function deleteVerifyTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid teacher id');
    const unverified = await unverifyTeacher(id);
    if (!unverified) throw new NotFoundError('teacher not found');
    res.json({ data: { user_id: id, is_verified: false } });
  } catch (e) {
    next(e);
  }
}
