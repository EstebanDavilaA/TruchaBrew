import path from 'node:path';
import fs from 'node:fs';
import { openDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { seedDatabase } from './db/seed';
import { buildServer } from './server';

const dataDir = path.resolve(import.meta.dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'truchabrew.db');

const { db } = openDatabase(dbPath);
runMigrations(db);
seedDatabase(db);

const app = buildServer({ db, logger: true });

const port = Number(process.env.PORT ?? 5177);

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    console.log(`TruchaBrew API listening on http://localhost:${port}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
