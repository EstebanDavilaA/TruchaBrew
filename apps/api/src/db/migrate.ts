import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// apps/api/drizzle — committed generated SQL migrations.
const MIGRATIONS_FOLDER = path.resolve(__dirname, '..', '..', 'drizzle');

/** Applies all pending migrations. Idempotent — running twice is a no-op.
 *  `migrationsFolder` defaults to today's resolved `apps/api/drizzle`; pass it
 *  explicitly when running from a bundled artifact whose `__dirname` is no
 *  longer `src/db/`. */
export function runMigrations(db: Db, migrationsFolder?: string): void {
  migrate(db, { migrationsFolder: migrationsFolder ?? MIGRATIONS_FOLDER });
}
