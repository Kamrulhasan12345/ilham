import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { NotFoundError } from '../../lib/errors.js';
import {
  createNote,
  deleteOwnNote,
  findOwnNote,
  listNotesForUser,
  updateOwnNote,
} from './notes.model.js';

const createNoteSchema = z.object({
  hadith_id: z.number().int(),
  body: z.string().min(1),
});
const updateNoteSchema = z.object({ body: z.string().min(1) });

export async function getNotes(c: Context) {
  const userId = c.get('userId') as number;
  const notes = await listNotesForUser(userId);
  return c.json({ data: notes });
}

export async function postNote(c: Context) {
  const userId = c.get('userId') as number;
  const body = await c.req.json().catch(() => null);
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: 'invalid note payload' });
  }
  const note = await createNote({ userId, hadithId: parsed.data.hadith_id, body: parsed.data.body });
  return c.json({ data: note }, 201);
}

export async function patchNote(c: Context) {
  const userId = c.get('userId') as number;
  const noteId = Number(c.req.param('id'));
  if (!Number.isInteger(noteId)) {
    throw new HTTPException(400, { message: 'invalid note id' });
  }
  const body = await c.req.json().catch(() => null);
  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: 'invalid note payload' });
  }
  // A student who asks for another user's note gets 404, not 403 -- the
  // same convention as every other visibility rule in this API (see
  // docs/backend-prd.md §2.4): a 403 would confirm the row exists.
  const updated = await updateOwnNote(noteId, userId, parsed.data.body);
  if (!updated) {
    throw new NotFoundError('note not found');
  }
  return c.json({ data: updated });
}

export async function deleteNote(c: Context) {
  const userId = c.get('userId') as number;
  const noteId = Number(c.req.param('id'));
  if (!Number.isInteger(noteId)) {
    throw new HTTPException(400, { message: 'invalid note id' });
  }
  const deleted = await deleteOwnNote(noteId, userId);
  if (!deleted) {
    throw new NotFoundError('note not found');
  }
  return c.json({ data: null });
}
