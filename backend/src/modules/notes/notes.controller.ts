import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import {
  createNote,
  deleteOwnNote,
  listNotesForHadith,
  listNotesForUser,
  updateOwnNote,
} from './notes.model.js';

const createNoteSchema = z.object({
  hadith_id: z.number().int(),
  body: z.string().min(1),
});
const updateNoteSchema = z.object({ body: z.string().min(1) });

export async function getNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const notes = await listNotesForUser(req.user!.userId);
    res.json({ data: notes });
  } catch (e) {
    next(e);
  }
}

// Wired under /hadiths/:id/notes (see docs/backend-prd.md §5.11) -- the
// :id here is a hadith id, not a note id.
export async function getNotesForHadith(req: Request, res: Response, next: NextFunction) {
  try {
    const hadithId = Number(req.params.id);
    if (!Number.isInteger(hadithId)) throw new BadRequestError('invalid hadith id');
    const notes = await listNotesForHadith(req.user!.userId, hadithId);
    res.json({ data: notes });
  } catch (e) {
    next(e);
  }
}

export async function postNote(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const parsed = createNoteSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError('invalid note payload');
    const note = await createNote({ userId, hadithId: parsed.data.hadith_id, body: parsed.data.body });
    res.status(201).json({ data: note });
  } catch (e) {
    next(e);
  }
}

// Wired under /hadiths/:id/notes (see docs/backend-prd.md §5.11) -- the
// hadith id comes from the path, the body carries only the text.
export async function postNoteForHadith(req: Request, res: Response, next: NextFunction) {
  try {
    const hadithId = Number(req.params.id);
    if (!Number.isInteger(hadithId)) throw new BadRequestError('invalid hadith id');
    const parsed = updateNoteSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError('invalid note payload');
    const note = await createNote({ userId: req.user!.userId, hadithId, body: parsed.data.body });
    res.status(201).json({ data: note });
  } catch (e) {
    next(e);
  }
}

export async function patchNote(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId)) throw new BadRequestError('invalid note id');
    const parsed = updateNoteSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError('invalid note payload');
    // A student who asks for another user's note gets 404, not 403 -- the
    // same convention as every other visibility rule in this API (see
    // docs/backend-prd.md §2.4): a 403 would confirm the row exists.
    const updated = await updateOwnNote(noteId, userId, parsed.data.body);
    if (!updated) throw new NotFoundError('note not found');
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deleteNote(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId)) throw new BadRequestError('invalid note id');
    const deleted = await deleteOwnNote(noteId, userId);
    if (!deleted) throw new NotFoundError('note not found');
    res.json({ data: null });
  } catch (e) {
    next(e);
  }
}
