import { Router } from 'express';
import { getMetaEtlMetrics } from './meta.controller.js';

export const metaRoutes = Router();

metaRoutes.get('/etl-metrics', getMetaEtlMetrics);
