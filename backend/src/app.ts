import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { collectionsRoutes } from './modules/collections/collections.routes.js';
import { hadithsRoutes } from './modules/hadiths/hadiths.routes.js';
import { narratorsRoutes } from './modules/narrators/narrators.routes.js';
import { chaptersRoutes } from './modules/chapters/chapters.routes.js';
import { NotFoundError } from './lib/errors.js';

export const app = new Hono();

app.use('*', logger());

app.route('/collections', collectionsRoutes);
app.route('/chapters', chaptersRoutes);
app.route('/hadiths', hadithsRoutes);
app.route('/narrators', narratorsRoutes);

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  if (err instanceof NotFoundError) {
    return c.json({ error: err.message }, 404);
  }
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error(err);
  return c.json({ error: 'internal_server_error' }, 500);
});
