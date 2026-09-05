import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { login, logout, me, refresh, register } from './auth.controller.js';

export const authRoutes = new Hono();

const loginLimiter = rateLimit(5);

authRoutes.post('/register', loginLimiter, register);
authRoutes.post('/login', loginLimiter, login);
authRoutes.post('/refresh', refresh);
authRoutes.post('/logout', logout);
authRoutes.get('/me', requireAuth, me);
