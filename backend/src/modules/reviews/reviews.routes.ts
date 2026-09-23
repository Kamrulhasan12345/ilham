import { Router } from 'express';
import { getReviewSession, getReviewSessions, postReviewSession } from './reviews.controller.js';

export const reviewsRoutes = Router();

reviewsRoutes.post('/', postReviewSession);
reviewsRoutes.get('/', getReviewSessions);
reviewsRoutes.get('/:id', getReviewSession);
