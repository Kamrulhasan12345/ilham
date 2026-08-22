import { Hono } from 'hono';
import { getHadith, getHadiths } from './hadiths.controller.js';

export const hadithsRoutes = new Hono();

hadithsRoutes.get('/', getHadiths);
hadithsRoutes.get('/:id', getHadith);
