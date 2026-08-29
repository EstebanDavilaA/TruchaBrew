// NOTE on the driver: `better-sqlite3` (drizzle's first-class SQLite
// driver, per the spec's Resolved Ambiguities) is a native module with no
// prebuilt binary for this Node ABI/OS/arch and no local MSVC toolchain to
// compile it from source in this environment — see M2_P1 spec, "Known
// execution risks". The documented fallback is `node:sqlite`. Rather than
// switching to drizzle-orm's pre-release `node-sqlite` driver (which ships
// a redesigned, incompatible query API), `packages/better-sqlite3-shim` is
// a local workspace package published under the name `better-sqlite3` that
// implements the same client surface on top of `node:sqlite`, so this file
// — and every other file in this codebase — imports the driver exactly as
// it would with the real native module.
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface OpenDatabaseResult {
  db: Db;
  sqlite: Database;
  close: () => void;
}

/**
 * Opens a SQLite database at `filePath` (or `:memory:`) and asserts
 * `PRAGMA foreign_keys = ON`. SQLite disables foreign-key enforcement by
 * default on every new connection — without this pragma, every
 * `ON DELETE CASCADE` in the schema is inert. Every code path that opens a
 * connection (server, migration runner, test helper, CLI script) MUST go
 * through this function.
 */
export function openDatabase(filePath: string): OpenDatabaseResult {
  const sqlite = new Database(filePath);
  sqlite.pragma('foreign_keys = ON');

  const actual = sqlite.pragma('foreign_keys', { simple: true });
  if (actual !== 1) {
    throw new Error(`Failed to enable foreign key enforcement on ${filePath} (PRAGMA foreign_keys = ${actual})`);
  }

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}
