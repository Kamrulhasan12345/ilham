import { app } from './app.js';
import { pool } from './db/pool.js';
import { PORT } from './config.js';

const server = app.listen(PORT, () => {
  console.log(`ilham-backend listening on :${PORT}`);
});

async function shutdown() {
  console.log('shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
