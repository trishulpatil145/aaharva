import app from './app.js';
import { getConfig } from './config/env.js';
import { connectDatabase, closeDatabase, databaseStatus } from './config/database.js';

const config = getConfig();
let server;
let shuttingDown = false;

async function start() {
  try {
    await connectDatabase();
    console.info(`[aaharva] MongoDB connected (${databaseStatus().database}).`);
  } catch {
    console.error('[aaharva] MongoDB is unavailable. API server will start, but data-backed requests will fail and /api/health will return 503.');
  }
  server = app.listen(config.port, '0.0.0.0', () => {
    console.info(`[aaharva] API listening on http://localhost:${config.port} (${config.nodeEnv}).`);
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[aaharva] ${signal} received; shutting down.`);
  if (server) await new Promise(resolve => server.close(resolve));
  await closeDatabase().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
start().catch(err => {
  console.error(`[aaharva] Startup failed: ${err.message}`);
  process.exitCode = 1;
});
