import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { login, logout, me, refresh, register } from './auth.controller.js';

export const authRoutes = Router();

function rateLimitKey(req: Request): string {
  const forwarded = req.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || req.ip || 'unknown';
}

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: { code: 'rate_limited', message: 'too many attempts, try again shortly' } },
});

authRoutes.post('/register', loginLimiter, register);
authRoutes.post('/login', loginLimiter, login);
authRoutes.post('/refresh', refresh);
authRoutes.post('/logout', logout);
authRoutes.get('/me', requireAuth, me);
