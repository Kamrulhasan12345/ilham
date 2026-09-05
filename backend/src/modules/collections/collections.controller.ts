import type { Context } from 'hono';
import { listCollections } from './collections.model.js';

export async function getCollections(c: Context) {
  const collections = await listCollections();
  return c.json({ data: collections });
}
