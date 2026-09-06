import { Router } from 'express';
import { getChapters } from './chapters.controller.js';

export const chaptersRoutes = Router();

chaptersRoutes.get('/', getChapters);
