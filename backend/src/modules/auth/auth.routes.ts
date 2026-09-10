import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/requireAuth.js';
import { resolveClientKey } from '../../middleware/rateLimit.js';
import { login, logout, me, refresh, register } from './auth.controller.js';

export const authRoutes = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientKey,
  message: { error: { code: 'rate_limited', message: 'too many attempts, try again shortly' } },
});

authRoutes.post('/register', loginLimiter, register);
authRoutes.post('/login', loginLimiter, login);
authRoutes.post('/refresh', refresh);
authRoutes.post('/logout', logout);
authRoutes.get('/me', requireAuth, me);
