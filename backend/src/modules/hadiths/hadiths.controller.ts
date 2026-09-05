import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { NotFoundError } from '../../lib/errors.js';
import { parsePageParams } from '../../lib/pagination.js';
import { getHadithDetail, listHadiths } from './hadiths.model.js';

function parseOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new HTTPException(400, { message: 'invalid query parameter' });
  }
  return parsed;
}

export async function getHadiths(c: Context) {
  const { limit, offset } = parsePageParams(c.req.query());
  const collectionId = parseOptionalInt(c.req.query('collection_id'));
  const chapterId = parseOptionalInt(c.req.query('chapter_id'));

  const hadiths = await listHadiths({ collectionId, chapterId, limit, offset });
  return c.json({ data: hadiths });
}

export async function getHadith(c: Context) {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    throw new HTTPException(400, { message: 'invalid hadith id' });
  }

  const lang = c.req.query('lang') ?? 'en';
  const detail = await getHadithDetail(id, lang);
  if (!detail) {
    throw new NotFoundError('hadith not found');
  }
  return c.json({ data: detail });
}
