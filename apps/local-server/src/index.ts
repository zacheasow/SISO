import { createServer } from './server.js';
import path from 'node:path';
import fs from 'node:fs';

async function start() {
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  // When launched as a Tauri sidecar, DATABASE_DIR points to the app's
  // persistent data directory (e.g. %APPDATA%/com.kumon-siso.desktop/).
  // Otherwise, fall back to the default ./data/ relative path in dev mode.
  const databaseDir = process.env.DATABASE_DIR || './data';

  // Ensure the target directory exists before SQLite tries to open the file.
  fs.mkdirSync(databaseDir, { recursive: true });

  const dbPath = path.join(databaseDir, 'sqlite.db');

  console.log(`[Kumon SISO] Database path: ${dbPath}`);
  console.log(`[Kumon SISO] Sidecar mode: ${process.env.DATABASE_DIR ? 'YES' : 'NO'}`);

  const { fastify } = await createServer(dbPath);

  try {
    const address = await fastify.listen({ port: PORT, host: HOST });
    console.log(`[Kumon SISO Local Server] Running on ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
