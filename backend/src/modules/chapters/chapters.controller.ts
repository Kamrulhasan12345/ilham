import type { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../../lib/errors.js';
import { parsePageParams } from '../../lib/pagination.js';
import { listChapters } from './chapters.model.js';

function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new BadRequestError('invalid query parameter');
  return parsed;
}

export async function getChapters(req: Request, res: Response, next: NextFunction) {
  try {
    const collectionId = Number(req.query.collection_id);
    if (!Number.isInteger(collectionId)) {
      throw new BadRequestError('collection_id is required and must be an integer');
    }
    const seq = parseOptionalInt(req.query.seq);
    const { limit, offset } = parsePageParams(req.query as Record<string, unknown>);
    const { rows, total } = await listChapters({ collectionId, seq, limit, offset });
    res.json({ data: rows, page: { limit, offset, total } });
  } catch (e) {
    next(e);
  }
}
