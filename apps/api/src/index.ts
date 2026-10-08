import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { seedDatabase } from './db/seed';
import { buildServer } from './server';
import { resolveConfig, describeListenAddresses } from './config';

// The package root is one level above this file's directory, in both the
// source tree (`apps/api/src`) and the built artifact (`apps/api/dist`).
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');

// Load environment files if present. Local .env files are loaded first so they take
// precedence over committed defaults in .env.production.
for (const envFile of [
  path.join(repoRoot, '.env'),
  path.join(packageRoot, '.env'),
  path.join(repoRoot, '.env.production'),
  path.join(packageRoot, '.env.production'),
]) {
  if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envFile);
    } catch {
      // Ignore unreadable or invalid env files
    }
  }
}

const config = resolveConfig(process.env, packageRoot);

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const { db } = openDatabase(config.dbPath);
runMigrations(db, config.migrationsDir);
seedDatabase(db);

const app = buildServer({
  db,
  logger: true,
  staticRoot: config.staticRoot,
  feedbackWebhookUrl: config.feedbackWebhookUrl,
});

app
  .listen({ port: config.port, host: config.host })
  .then(() => {
    const interfaces = os.networkInterfaces() as Record<
      string,
      Array<{ address: string; family: string; internal: boolean }> | undefined
    >;
    for (const line of describeListenAddresses(config.host, config.port, interfaces)) {
      console.log(`TruchaBrew server: ${line}`);
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
