import type { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../../lib/errors.js';
import { parsePageParams } from '../../lib/pagination.js';
import {
  getContestedNarrators,
  getPositionTotal,
  getSharedNarrators,
  getTopNarrators,
  getUnscoredHadithCount,
  getWeakestChains,
} from './analytics.model.js';

export async function getTopNarratorsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit } = parsePageParams(req.query as Record<string, unknown>);
    const rows = await getTopNarrators(limit);
    const total = await getPositionTotal();
    const shown = rows.reduce((n, r) => n + Number((r as { positions: number }).positions), 0);
    res.json({ data: rows, summary: { total_positions: total, top_count: rows.length, top_share: total > 0 ? shown / total : 0 } });
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
    const unscored = await getUnscoredHadithCount();
    res.json({ data: rows, summary: { unscored } });
  } catch (e) {
    next(e);
  }
}
