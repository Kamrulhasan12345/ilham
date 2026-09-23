import type { NextFunction, Request, Response } from 'express';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { parsePageParams } from '../../lib/pagination.js';
import { getNarratorById, listHadithsForNarrator, searchNarrators } from './narrators.model.js';

export async function getNarrators(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePageParams(req.query as Record<string, unknown>);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const narrators = await searchNarrators({ q, limit, offset });
    res.json({ data: narrators, page: { limit, offset, total: narrators.length } });
  } catch (e) {
    next(e);
  }
}

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

export async function getNarratorHadiths(req: Request, res: Response, next: NextFunction) {
  try {
    const narratorId = Number(req.params.id);
    if (!Number.isInteger(narratorId)) throw new BadRequestError('invalid narrator id');
    const { limit, offset } = parsePageParams(req.query as Record<string, unknown>);
    const hadiths = await listHadithsForNarrator({ narratorId, limit, offset });
    res.json({ data: hadiths, page: { limit, offset, total: hadiths.length } });
  } catch (e) {
    next(e);
  }
}
