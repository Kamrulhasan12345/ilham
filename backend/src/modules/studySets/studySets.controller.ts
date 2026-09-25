import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import {
  addStudySetItem,
  createStudySet,
  deleteStudySet,
  getStudySetById,
  isSetAssignedToStudent,
  listStudySetItems,
  listStudySetsForOwner,
  removeStudySetItem,
  renameStudySet,
} from './studySets.model.js';

const nameSchema = z.object({ name: z.string().min(1) });
const itemSchema = z.object({ hadith_id: z.number().int() });

export async function getStudySets(req: Request, res: Response, next: NextFunction) {
  try {
    const sets = await listStudySetsForOwner(req.user!.userId);
    res.json({ data: sets });
  } catch (e) {
    next(e);
  }
}

export async function postStudySet(req: Request, res: Response, next: NextFunction) {
  try {
    const body = nameSchema.parse(req.body);
    const created = await createStudySet({ ownerId: req.user!.userId, name: body.name });
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
}

async function requireOwnedStudySet(req: Request, studySetId: number) {
  const set = await getStudySetById(studySetId);
  if (!set || set.owner_id !== req.user!.userId) throw new NotFoundError('study set not found');
  return set;
}

export async function getStudySet(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid study set id');
    const set = await getStudySetById(id);
    if (!set) throw new NotFoundError('study set not found');
    // Owners read their sets. An enrolled student reads a set assigned to
    // their circle — otherwise assigned work is invisible to the assignee.
    // Hiding existence either way: strangers get 404, not 403. Writes keep
    // the strict owner check in requireOwnedStudySet below.
    const { userId, role } = req.user!;
    const readable =
      set.owner_id === userId ||
      (role === 'student' && (await isSetAssignedToStudent(id, userId)));
    if (!readable) throw new NotFoundError('study set not found');
    const items = await listStudySetItems(id);
    res.json({ data: { ...set, items } });
  } catch (e) {
    next(e);
  }
}

export async function patchStudySet(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid study set id');
    await requireOwnedStudySet(req, id);
    const body = nameSchema.parse(req.body);
    const updated = await renameStudySet(id, body.name);
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deleteStudySetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid study set id');
    await requireOwnedStudySet(req, id);
    await deleteStudySet(id);
    res.json({ data: null });
  } catch (e) {
    next(e);
  }
}

export async function postStudySetItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('invalid study set id');
    await requireOwnedStudySet(req, id);
    const body = itemSchema.parse(req.body);
    await addStudySetItem(id, body.hadith_id);
    res.status(201).json({ data: { study_set_id: id, hadith_id: body.hadith_id } });
  } catch (e) {
    next(e);
  }
}

export async function deleteStudySetItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const hadithId = Number(req.params.hid);
    if (!Number.isInteger(id) || !Number.isInteger(hadithId)) {
      throw new BadRequestError('invalid id');
    }
    await requireOwnedStudySet(req, id);
    const removed = await removeStudySetItem(id, hadithId);
    if (!removed) throw new NotFoundError('item not found');
    res.json({ data: null });
  } catch (e) {
    next(e);
  }
}
