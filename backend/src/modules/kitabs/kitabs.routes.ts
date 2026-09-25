import { Router } from 'express';
import { getBabHandler, getKitabHandler, getKitabs } from './kitabs.controller.js';

export const kitabsRoutes = Router();
kitabsRoutes.get('/', getKitabs);
kitabsRoutes.get('/:id', getKitabHandler);

export const babsRoutes = Router();
babsRoutes.get('/:id', getBabHandler);
