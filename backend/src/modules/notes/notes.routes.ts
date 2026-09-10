import { Router } from 'express';
import { deleteNote, getNotes, patchNote, postNote } from './notes.controller.js';

export const notesRoutes = Router();

notesRoutes.get('/', getNotes);
notesRoutes.post('/', postNote);
notesRoutes.patch('/:id', patchNote);
notesRoutes.delete('/:id', deleteNote);
