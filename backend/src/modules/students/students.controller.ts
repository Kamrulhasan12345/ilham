import type { NextFunction, Request, Response } from 'express';
import { listStudents } from './students.model.js';

export async function getStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const students = await listStudents(q);
    res.json({ data: students });
  } catch (e) {
    next(e);
  }
}
