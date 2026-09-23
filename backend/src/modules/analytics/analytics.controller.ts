import type { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../../lib/errors.js';
import { parsePageParams } from '../../lib/pagination.js';
import {
  getContestedNarrators,
  getSharedNarrators,
  getTopNarrators,
  getWeakestChains,
} from './analytics.model.js';

export async function getTopNarratorsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit } = parsePageParams(req.query as Record<string, unknown>);
    const rows = await getTopNarrators(limit);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
}

export async function getContestedNarratorsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit } = parsePageParams(req.query as Record<string, unknown>);
    const rows = await getContestedNarrators(limit);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
}

export async function getSharedNarratorsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const a = Number(req.query.a);
    const b = Number(req.query.b);
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new BadRequestError('a and b query params are required hadith ids');
    }
    const rows = await getSharedNarrators(a, b);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
}

export async function getWeakestChainsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit } = parsePageParams(req.query as Record<string, unknown>);
    const rows = await getWeakestChains(limit);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
}
