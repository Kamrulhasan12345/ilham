import { Router } from 'express';
import {
  getContestedNarratorsHandler,
  getSharedNarratorsHandler,
  getTopNarratorsHandler,
  getWeakestChainsHandler,
} from './analytics.controller.js';

export const analyticsRoutes = Router();

// PRD §5.5 table:
// Q1 GET /analytics/top-narrators
// Q2 GET /analytics/contested-narrators
// Q3 GET /analytics/shared-narrators?a=&b=
// Q5 GET /analytics/weakest-chains
// (Q4 -> /circles/:id/overview, Q6 -> /assignments/:id/completion, mounted
//  in their own modules since they need circle-ownership checks.)
analyticsRoutes.get('/top-narrators', getTopNarratorsHandler);
analyticsRoutes.get('/contested-narrators', getContestedNarratorsHandler);
analyticsRoutes.get('/shared-narrators', getSharedNarratorsHandler);
analyticsRoutes.get('/weakest-chains', getWeakestChainsHandler);
