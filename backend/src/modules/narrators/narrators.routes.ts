import { Router } from 'express';
import { getNarrator, getNarratorHadiths, getNarrators } from './narrators.controller.js';

export const narratorsRoutes = Router();

narratorsRoutes.get('/', getNarrators);
narratorsRoutes.get('/:id/hadiths', getNarratorHadiths);
narratorsRoutes.get('/:id', getNarrator);
