import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDatabase } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL_MIGRATIONS_FOLDER = path.resolve(here, '..', 'drizzle');

function tempDbFilePath(): string {
  return path.join(os.tmpdir(), `truchabrew-batches-migration-test-${randomUUID()}.db`);
}

function cleanupDbFile(filePath: string): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const p = filePath + suffix;
    if (fs.existsSync(p)) fs.rmSync(p);
  }
}

/**
 * A migrations folder containing only 0000-0005 (pre-0006) — reproduces "the
 * developer's existing database" state this migration must apply to without
 * a wipe (M4_P1 spec AC-12b).
 */
function pre0006MigrationsFolder(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truchabrew-migrations-pre0006-'));
  const metaDir = path.join(tempDir, 'meta');
  fs.mkdirSync(metaDir);

  const sqlFiles = [
    '0000_futuristic_quasimodo.sql',
    '0001_ambitious_phil_sheldon.sql',
    '0002_chunky_cyclops.sql',
    '0003_brave_hobgoblin.sql',
    '0004_jittery_ben_grimm.sql',
    '0005_true_norman_osborn.sql',
  ];
  for (const sqlFile of sqlFiles) {
    fs.copyFileSync(path.join(REAL_MIGRATIONS_FOLDER, sqlFile), path.join(tempDir, sqlFile));
  }
  const snapshots = ['0000_snapshot.json', '0001_snapshot.json', '0002_snapshot.json', '0003_snapshot.json', '0004_snapshot.json', '0005_snapshot.json'];
  for (const snapshot of snapshots) {
    fs.copyFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', snapshot), path.join(metaDir, snapshot));
  }

  const fullJournal = JSON.parse(fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as {
    entries: { idx: number }[];
  };
  const journalPre0006 = { ...fullJournal, entries: fullJournal.entries.filter((e) => e.idx <= 5) };
  fs.writeFileSync(path.join(metaDir, '_journal.json'), JSON.stringify(journalPre0006, null, 2));

  return tempDir;
}

const cleanupPaths: string[] = [];
afterEach(() => {
  for (const p of cleanupPaths) {
    if (p.endsWith('.db')) cleanupDbFile(p);
    else fs.rmSync(p, { recursive: true, force: true });
  }
  cleanupPaths.length = 0;
});

describe('AC-12(b): migration 0006 is additive and applies without a wipe', () => {
  it('adds a nullable stats_snapshot column to an existing database, leaving its one batch row intact with stats_snapshot NULL', () => {
    const dbPath = tempDbFilePath();
    cleanupPaths.push(dbPath);
    const { db: dbPre0006, close } = openDatabase(dbPath);
    const pre0006Dir = pre0006MigrationsFolder();
    cleanupPaths.push(pre0006Dir);

    // Bring the database up to "the developer's existing state" — 0000-0005.
    migrate(dbPre0006, { migrationsFolder: pre0006Dir });

    // Seed the minimum a batch row needs: an equipment profile and a recipe.
    const eqId = 'eq-123';
    dbPre0006.$client.prepare(
      `INSERT INTO equipment_profiles (id, name, batch_size_l, boil_time_min, brewhouse_efficiency_pct, mash_efficiency_pct, boil_off_rate_l_per_hour, trub_chiller_loss_l, hop_utilization_pct, mash_water_ratio_l_per_kg, grain_absorption_l_per_kg, hopstand_temperature_c, hopstand_utilization_factor, created_at, updated_at)
       VALUES (?, 'Test Eq', 20, 60, 75, 80, 3, 2, 85, 3.0, 1.0, 90, 0.1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
    ).run(eqId);

    const recipeId = 'recipe-123';
    dbPre0006.$client.prepare(
      `INSERT INTO recipes (id, name, equipment_id, created_at, updated_at)
       VALUES (?, 'Test Recipe', ?, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
    ).run(recipeId, eqId);

    // A batch row as it looked before 0006 — no stats_snapshot column exists
    // yet at the schema level, so this INSERT cannot and does not name it.
    const batchId = 'batch-pre-0006';
    const recipeSnapshotJson = JSON.stringify({ id: recipeId, name: 'Test Recipe' });
    dbPre0006.$client.prepare(
      `INSERT INTO batches (id, name, batch_no, status, recipe_id, recipe_snapshot, created_at, updated_at)
       VALUES (?, 'Batch #1 - Test Recipe', 1, 'Planning', ?, ?, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
    ).run(batchId, recipeId, recipeSnapshotJson);

    // Apply the rest of the real migration chain — the new, additive 0006.
    runMigrations(dbPre0006);

    // The row was not deleted, and no wipe occurred (still exactly 1 row).
    const rowCount = (dbPre0006.$client.prepare(`SELECT COUNT(*) as c FROM batches`).get() as { c: number }).c;
    expect(rowCount).toBe(1);

    const row = dbPre0006.$client.prepare(`SELECT * FROM batches WHERE id = ?`).get(batchId) as any;
    expect(row).toBeDefined();
    // SQL cannot backfill calculated stats — the column comes back NULL for
    // a row that predates it, not 0 or an invented value.
    expect(row.stats_snapshot).toBeNull();
    // recipe_snapshot itself is completely untouched by this migration.
    expect(JSON.parse(row.recipe_snapshot)).toEqual({ id: recipeId, name: 'Test Recipe' });

    // The column exists and is nullable; recipe_snapshot's NOT NULL constraint is undisturbed.
    const columns = dbPre0006.$client.prepare(`PRAGMA table_info('batches')`).all() as { name: string; notnull: number }[];
    const statsCol = columns.find((c) => c.name === 'stats_snapshot');
    const recipeCol = columns.find((c) => c.name === 'recipe_snapshot');
    expect(statsCol).toBeDefined();
    expect(statsCol!.notnull).toBe(0);
    expect(recipeCol).toBeDefined();
    expect(recipeCol!.notnull).toBe(1);

    close();
  });
});
