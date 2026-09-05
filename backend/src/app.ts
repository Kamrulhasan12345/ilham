import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
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
app.use(
  '*',
  bodyLimit({
    maxSize: 100 * 1024,
    onError: (c) => c.json({ error: { code: 'bad_request', message: 'request body too large' } }, 413),
  })
);

app.route('/auth', authRoutes);

app.use('/collections/*', requireAuth);
app.route('/collections', collectionsRoutes);
app.use('/chapters/*', requireAuth);
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
      status === 429 ? 'rate_limited' :
      status === 400 ? 'bad_request' : 'internal_error';
    return c.json({ error: { code, message: err.message } }, status);
  }
  // Raw PostgreSQL error codes that can reach here unwrapped (e.g. a trigger
  // firing during an insert). Mapped per docs/backend-prd.md §2.4.
  const pgErr = err as { code?: string; message?: string };
  if (pgErr.code === '23505') {
    // Returning 409 on a duplicate email is a deliberate scope decision: it
    // enables user enumeration on /auth/register, but for an institutional LMS
    // where enrollment already implies "has an account," the cost of hiding it
    // (a real email pipeline for ambiguous "someone tried to register" notices)
    // isn't worth building for this project. Reviewed and accepted as-is.
    return c.json({ error: { code: 'conflict', message: 'already exists' } }, 409);
  }
  if (pgErr.code === '23503') {
    return c.json({ error: { code: 'unprocessable', message: 'referenced row is missing' } }, 422);
  }
  if (pgErr.code === '23514' && pgErr.message?.includes('is not verified')) {
    return c.json({ error: { code: 'teacher_not_verified', message: pgErr.message } }, 403);
  }
  if (pgErr.code === '42501') {
    console.error('CORPUS LOCKDOWN HIT — a write reached corpus.* it should never touch', err);
    return c.json({ error: { code: 'internal_error', message: 'internal error' } }, 500);
  }
  console.error(err);
  return c.json({ error: { code: 'internal_error', message: 'internal error' } }, 500);
});
