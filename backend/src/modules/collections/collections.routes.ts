import { Router } from 'express';
import { getCollections } from './collections.controller.js';

export const collectionsRoutes = Router();

collectionsRoutes.get('/', getCollections);
