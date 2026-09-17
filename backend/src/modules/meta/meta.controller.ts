import type { NextFunction, Request, Response } from 'express';
import { getEtlMetrics } from './meta.model.js';

export async function getMetaEtlMetrics(_req: Request, res: Response, next: NextFunction) {
  try {
    const metrics = await getEtlMetrics();
    res.json({ data: metrics });
  } catch (e) {
    next(e);
  }
}
