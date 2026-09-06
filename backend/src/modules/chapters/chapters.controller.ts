import type { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../../lib/errors.js';
import { parsePageParams } from '../../lib/pagination.js';
import { listChapters } from './chapters.model.js';

export async function getChapters(req: Request, res: Response, next: NextFunction) {
  try {
    const collectionId = Number(req.query.collection_id);
    if (!Number.isInteger(collectionId)) {
      throw new BadRequestError('collection_id is required and must be an integer');
    }
    const { limit, offset } = parsePageParams(req.query as Record<string, unknown>);
    const chapters = await listChapters({ collectionId, limit, offset });
    res.json({ data: chapters, page: { limit, offset, total: chapters.length } });
  } catch (e) {
    next(e);
  }
}
