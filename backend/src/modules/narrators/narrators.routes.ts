import { Router } from 'express';
import { getNarrator } from './narrators.controller.js';

export const narratorsRoutes = Router();

narratorsRoutes.get('/:id', getNarrator);
