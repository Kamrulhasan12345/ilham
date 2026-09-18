import { Router } from 'express';
import {
  getContestedNarratorsHandler,
  getSharedNarratorsHandler,
  getTopNarratorsHandler,
  getWeakestChainsHandler,
} from './analytics.controller.js';

export const analyticsRoutes = Router();

analyticsRoutes.get('/top-narrators', getTopNarratorsHandler);
analyticsRoutes.get('/contested-narrators', getContestedNarratorsHandler);
analyticsRoutes.get('/shared-narrators', getSharedNarratorsHandler);
analyticsRoutes.get('/weakest-chains', getWeakestChainsHandler);
