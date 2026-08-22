import { serve } from '@hono/node-server';
import { app } from './app.js';
import { pool } from './db/pool.js';
import { PORT } from './config.js';

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`ilham-backend listening on :${info.port}`);
});

async function shutdown() {
  console.log('shutting down');
  server.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
