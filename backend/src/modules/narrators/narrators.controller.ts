import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { NotFoundError } from '../../lib/errors.js';
import { getNarratorById } from './narrators.model.js';

export async function getNarrator(c: Context) {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    throw new HTTPException(400, { message: 'invalid narrator id' });
  }

  const narrator = await getNarratorById(id);
  if (!narrator) {
    throw new NotFoundError('narrator not found');
  }
  return c.json(narrator);
}
