import type { NextFunction, Request, Response } from 'express';
import { listStudents } from './students.model.js';

export async function getStudents(_req: Request, res: Response, next: NextFunction) {
  try {
    const students = await listStudents();
    res.json({ data: students });
  } catch (e) {
    next(e);
  }
}
