import type { NextFunction, Request, Response } from 'express';
import { listCollections } from './collections.model.js';

export async function getCollections(_req: Request, res: Response, next: NextFunction) {
  try {
    const collections = await listCollections();
    res.json({ data: collections });
  } catch (e) {
    next(e);
  }
}
