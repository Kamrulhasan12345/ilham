import { Hono } from 'hono';
import { getNarrator } from './narrators.controller.js';

export const narratorsRoutes = new Hono();

narratorsRoutes.get('/:id', getNarrator);
