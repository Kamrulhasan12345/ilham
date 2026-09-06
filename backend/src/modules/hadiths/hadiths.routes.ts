import { Router } from 'express';
import { getNotesForHadith, postNoteForHadith } from '../notes/notes.controller.js';
import { getHadith, getHadiths } from './hadiths.controller.js';

export const hadithsRoutes = Router();

hadithsRoutes.get('/', getHadiths);
hadithsRoutes.get('/:id', getHadith);
hadithsRoutes.get('/:id/notes', getNotesForHadith);
hadithsRoutes.post('/:id/notes', postNoteForHadith);
