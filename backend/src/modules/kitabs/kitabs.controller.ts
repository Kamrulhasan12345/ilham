import type { NextFunction, Request, Response } from 'express';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { getBab, getKitab, listKitabs } from './kitabs.model.js';

export async function getKitabs(req: Request, res: Response, next: NextFunction) {
  try {
    const collectionId = Number(req.query.collection_id);
    if (!Number.isInteger(collectionId)) {
      throw new BadRequestError('collection_id is required and must be an integer');
    }
    // At most 97 kitabs per book: the list is never paged.
    res.json({ data: await listKitabs(collectionId) });
  } catch (e) {
    next(e);
  }
}

export async function getKitabHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid kitab id');
    const kitab = await getKitab(id);
    if (!kitab) throw new NotFoundError('kitab not found');
    res.json({ data: kitab });
  } catch (e) {
    next(e);
  }
}

export async function getBabHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid bab id');
    const bab = await getBab(id);
    if (!bab) throw new NotFoundError('bab not found');
    res.json({ data: bab });
  } catch (e) {
    next(e);
  }
}
