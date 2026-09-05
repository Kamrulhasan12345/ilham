import { Hono } from 'hono';
import { deleteNote, getNotes, patchNote, postNote } from './notes.controller.js';

export const notesRoutes = new Hono();

notesRoutes.get('/', getNotes);
notesRoutes.post('/', postNote);
notesRoutes.patch('/:id', patchNote);
notesRoutes.delete('/:id', deleteNote);
