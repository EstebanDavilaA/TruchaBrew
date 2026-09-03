import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Db } from '../../src/db/client';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';

export interface TestDbHandle {
  db: Db;
  filePath: string;
  close: () => void;
  /** Closes and reopens a NEW connection against the same file — for restart tests. */
  reopen: () => TestDbHandle;
  cleanup: () => void;
}

/**
 * Opens a real temp-file SQLite database (never `:memory:` — an in-memory
 * database cannot exercise the close-and-reopen path the restart criterion
 * depends on), runs migrations, and optionally seeds it.
 */
export function createTestDb(options: { seed?: boolean } = {}): TestDbHandle {
  const filePath = path.join(os.tmpdir(), `truchabrew-test-${randomUUID()}.db`);
  return openTestDbFile(filePath, options);
}

function openTestDbFile(filePath: string, options: { seed?: boolean } = {}): TestDbHandle {
  const { db, close } = openDatabase(filePath);
  runMigrations(db);
  if (options.seed) {
    seedDatabase(db);
  }

  return {
    db,
    filePath,
    close,
    reopen: () => {
      close();
      return openTestDbFile(filePath, { seed: false });
    },
    cleanup: () => {
      try {
        close();
      } catch {
        // already closed
      }
      for (const suffix of ['', '-journal', '-wal', '-shm']) {
        const p = filePath + suffix;
        if (fs.existsSync(p)) fs.rmSync(p);
      }
    },
  };
}
