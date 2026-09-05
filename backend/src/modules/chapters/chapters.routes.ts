import { Hono } from 'hono';
import { getChapters } from './chapters.controller.js';

export const chaptersRoutes = new Hono();

chaptersRoutes.get('/', getChapters);
