import type { NextFunction, Request, Response } from 'express';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { getNarratorById } from './narrators.model.js';

export async function getNarrator(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid narrator id');
    const narrator = await getNarratorById(id);
    if (!narrator) throw new NotFoundError('narrator not found');
    res.json({ data: narrator });
  } catch (e) {
    next(e);
  }
}
