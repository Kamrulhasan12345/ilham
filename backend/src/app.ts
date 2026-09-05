import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { WEB_ORIGIN } from './config.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { chaptersRoutes } from './modules/chapters/chapters.routes.js';
import { collectionsRoutes } from './modules/collections/collections.routes.js';
import { hadithsRoutes } from './modules/hadiths/hadiths.routes.js';
import { narratorsRoutes } from './modules/narrators/narrators.routes.js';
import { requireAuth } from './middleware/requireAuth.js';
import { NotFoundError } from './lib/errors.js';
import type { Role } from './lib/jwt.js';

export const app = new Hono<{ Variables: { userId: number; role: Role } }>();

app.use('*', logger());
app.use('*', cors({ origin: WEB_ORIGIN, credentials: true }));

app.route('/auth', authRoutes);

app.use('/collections', requireAuth);
app.route('/collections', collectionsRoutes);
app.use('/chapters', requireAuth);
app.route('/chapters', chaptersRoutes);
app.use('/hadiths/*', requireAuth);
app.route('/hadiths', hadithsRoutes);
app.use('/narrators/*', requireAuth);
app.route('/narrators', narratorsRoutes);

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'not found' } }, 404));

app.onError((err, c) => {
  if (err instanceof NotFoundError) {
    return c.json({ error: { code: 'not_found', message: err.message } }, 404);
  }
  if (err instanceof HTTPException) {
    const status = err.status;
    const code =
      status === 401 ? 'unauthenticated' :
      status === 403 ? 'forbidden' :
      status === 409 ? 'conflict' :
      status === 400 ? 'bad_request' : 'internal_error';
    return c.json({ error: { code, message: err.message } }, status);
  }
  console.error(err);
  return c.json({ error: { code: 'internal_error', message: 'internal error' } }, 500);
});
