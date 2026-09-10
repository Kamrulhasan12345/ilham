import type { NextFunction, Request, Response } from 'express';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { parsePageParams } from '../../lib/pagination.js';
import { countHadiths, getHadithDetail, listHadiths } from './hadiths.model.js';

function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new BadRequestError('invalid query parameter');
  return parsed;
}

export async function getHadiths(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePageParams(req.query as Record<string, unknown>);
    const collectionId = parseOptionalInt(req.query.collection_id);
    const chapterId = parseOptionalInt(req.query.chapter_id);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;

    const [hadiths, total] = await Promise.all([
      listHadiths({ collectionId, chapterId, q, limit, offset }),
      countHadiths({ collectionId, chapterId, q }),
    ]);
    res.json({ data: hadiths, page: { limit, offset, total } });
  } catch (e) {
    next(e);
  }
}

export async function getHadith(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid hadith id');

    // PRD §2.6: ?lang=en selects the translation; default is en. Arabic is
    // always present; missing translation -> translation: null (never
    // substitute Arabic into an English field).
    const lang = typeof req.query.lang === 'string' ? req.query.lang : 'en';
    const detail = await getHadithDetail(id, lang);
    if (!detail) throw new NotFoundError('hadith not found');
    res.json({ data: detail });
  } catch (e) {
    next(e);
  }
}
