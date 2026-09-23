import { Router } from 'express';
import { getHadith, getHadiths, getStrengthDistribution } from './hadiths.controller.js';

export const hadithsRoutes = Router();

hadithsRoutes.get('/', getHadiths);
hadithsRoutes.get('/strength-distribution', getStrengthDistribution);
hadithsRoutes.get('/:id', getHadith);
