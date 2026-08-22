import { Hono } from 'hono';
import { getCollections } from './collections.controller.js';

export const collectionsRoutes = new Hono();

collectionsRoutes.get('/', getCollections);
