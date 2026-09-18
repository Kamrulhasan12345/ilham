import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { createNote, deleteOwnNote, listNotesForHadith, updateOwnNote } from './notes.model.js';

const bodySchema = z.object({ body: z.string().min(1) });

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
