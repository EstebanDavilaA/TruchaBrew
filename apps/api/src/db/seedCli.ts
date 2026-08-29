import path from 'node:path';
import fs from 'node:fs';
import { openDatabase } from './client';
import { runMigrations } from './migrate';
import { seedDatabase } from './seed';

const dataDir = path.resolve(import.meta.dirname, '..', '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'truchabrew.db');

const { db, close } = openDatabase(dbPath);
runMigrations(db);
seedDatabase(db);
close();

console.log(`Seeded ${dbPath}`);
