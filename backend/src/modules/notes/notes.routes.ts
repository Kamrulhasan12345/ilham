import { Router } from 'express';
import { deleteNote, patchNote } from './notes.controller.js';

export const notesRoutes = Router();

notesRoutes.patch('/:id', patchNote);
notesRoutes.delete('/:id', deleteNote);
