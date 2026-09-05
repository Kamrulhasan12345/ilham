import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { parsePageParams } from '../../lib/pagination.js';
import { listChapters } from './chapters.model.js';

export async function getChapters(c: Context) {
  const collectionId = Number(c.req.query('collection_id'));
  if (!Number.isInteger(collectionId)) {
    throw new HTTPException(400, { message: 'collection_id is required and must be an integer' });
  }
  const { limit, offset } = parsePageParams(c.req.query());
  const chapters = await listChapters({ collectionId, limit, offset });
  return c.json(chapters);
}
