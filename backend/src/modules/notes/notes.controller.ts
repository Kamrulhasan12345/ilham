import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { createNote, deleteOwnNote, listNotesForHadith, updateOwnNote } from './notes.model.js';

const bodySchema = z.object({ body: z.string().min(1) });

// PRD §5.11: GET /hadiths/:id/notes -- "The caller's own notes on that hadith"
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

// PRD §5.11: POST /hadiths/:id/notes -- "user_id from the token"
export async function postNoteForHadith(req: Request, res: Response, next: NextFunction) {
  try {
    const hadithId = Number(req.params.id);
    if (!Number.isInteger(hadithId)) throw new BadRequestError('invalid hadith id');
    const body = bodySchema.parse(req.body);
    const note = await createNote({ userId: req.user!.userId, hadithId, body: body.body });
    res.status(201).json({ data: note });
  } catch (e) {
    next(e);
  }
}

// PRD §5.11: PATCH /notes/:id -- A + owner. 404 (not 403) for a non-owner,
// per §2.4's "never confirm the row exists" rule.
export async function patchNote(req: Request, res: Response, next: NextFunction) {
  try {
    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId)) throw new BadRequestError('invalid note id');
    const body = bodySchema.parse(req.body);
    const updated = await updateOwnNote(noteId, req.user!.userId, body.body);
    if (!updated) throw new NotFoundError('note not found');
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

// PRD §5.11: DELETE /notes/:id -- A + owner
export async function deleteNote(req: Request, res: Response, next: NextFunction) {
  try {
    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId)) throw new BadRequestError('invalid note id');
    const deleted = await deleteOwnNote(noteId, req.user!.userId);
    if (!deleted) throw new NotFoundError('note not found');
    res.json({ data: null });
  } catch (e) {
    next(e);
  }
}
