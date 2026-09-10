import { Router } from 'express';
import { getHadith, getHadiths } from './hadiths.controller.js';

export const hadithsRoutes = Router();

hadithsRoutes.get('/', getHadiths);
hadithsRoutes.get('/:id', getHadith);
