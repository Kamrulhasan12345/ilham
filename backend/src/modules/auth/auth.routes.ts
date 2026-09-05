import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import { login, logout, me, refresh, register } from './auth.controller.js';

export const authRoutes = new Hono();

authRoutes.post('/register', register);
authRoutes.post('/login', login);
authRoutes.post('/refresh', refresh);
authRoutes.post('/logout', logout);
authRoutes.get('/me', requireAuth, me);
