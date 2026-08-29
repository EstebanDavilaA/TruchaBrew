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
  return path.join(os.tmpdir(), `truchabrew-completion-migration-test-${randomUUID()}.db`);
}

function cleanupDbFile(filePath: string): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const p = filePath + suffix;
    if (fs.existsSync(p)) fs.rmSync(p);
  }
}

/**
 * A migrations folder containing only 0000-0007 (pre-0008) — reproduces "the
 * developer's existing database" state migration 0008 must apply to without
 * a wipe (M5_P2 spec AC-19).
 */
function pre0008MigrationsFolder(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truchabrew-migrations-pre0008-'));
  const metaDir = path.join(tempDir, 'meta');
  fs.mkdirSync(metaDir);

  const journal = JSON.parse(fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as {
    entries: { idx: number; tag: string }[];
  };
  const pre0008Entries = journal.entries.filter((e) => e.idx <= 7);
  for (const entry of pre0008Entries) {
    fs.copyFileSync(path.join(REAL_MIGRATIONS_FOLDER, `${entry.tag}.sql`), path.join(tempDir, `${entry.tag}.sql`));
    fs.copyFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', `${String(entry.idx).padStart(4, '0')}_snapshot.json`), path.join(metaDir, `${String(entry.idx).padStart(4, '0')}_snapshot.json`));
  }
  const journalPre0008 = { ...journal, entries: pre0008Entries };
  fs.writeFileSync(path.join(metaDir, '_journal.json'), JSON.stringify(journalPre0008, null, 2));

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

describe('AC-16: migration 0008 is additive and does not rebuild batches', () => {
  it('contains exactly 1 CREATE TABLE batch_notes, 2 CREATE INDEX, and 9 ALTER TABLE ... batches ADD COLUMN statements, no rebuild', () => {
    const files = fs.readdirSync(REAL_MIGRATIONS_FOLDER).filter((f) => f.startsWith('0008_') && f.endsWith('.sql'));
    expect(files).toHaveLength(1);
    const sql = fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, files[0]), 'utf-8');

    const createTableMatches = sql.match(/CREATE TABLE `batch_notes`/g) ?? [];
    const createIndexMatches = sql.match(/CREATE INDEX/g) ?? [];
    const addColumnMatches = sql.match(/ALTER TABLE `batches` ADD/g) ?? [];
    expect(createTableMatches).toHaveLength(1);
    expect(createIndexMatches).toHaveLength(2);
    expect(addColumnMatches).toHaveLength(9);

    expect(sql).not.toMatch(/CREATE TABLE `__new_batches`/);
    expect(sql).not.toMatch(/DROP TABLE `batches`/);
    expect(sql).not.toMatch(/INSERT INTO `batches`.*SELECT/s);

    // Statement count equals the sum of the three groups (nothing else present).
    const totalStatements = sql.split('--> statement-breakpoint').filter((s) => s.trim().length > 0).length;
    expect(totalStatements).toBe(1 + 2 + 9);
  });

  it('after the full 0000->0008 chain: batches keeps its recipe_id FK with ON DELETE RESTRICT, and every column notnull flag is as specified', () => {
    const dbPath = tempDbFilePath();
    cleanupPaths.push(dbPath);
    const { db, close } = openDatabase(dbPath);
    runMigrations(db);

    const fks = db.$client.prepare(`PRAGMA foreign_key_list('batches')`).all() as { table: string; from: string; to: string; on_delete: string }[];
    const recipeFk = fks.find((f) => f.from === 'recipe_id');
    expect(recipeFk).toBeDefined();
    expect(recipeFk!.table).toBe('recipes');
    expect(recipeFk!.on_delete).toBe('RESTRICT');

    const columns = db.$client.prepare(`PRAGMA table_info('batches')`).all() as { name: string; notnull: number; dflt_value: string | null }[];
    const byName = (n: string) => columns.find((c) => c.name === n)!;
    expect(byName('recipe_snapshot').notnull).toBe(1);
    expect(byName('stats_snapshot').notnull).toBe(0);
    expect(byName('measured_og').notnull).toBe(0);
    expect(byName('fermentation_start_date').notnull).toBe(0);
    expect(byName('taste_notes').notnull).toBe(1);
    expect(byName('taste_notes').dflt_value).toBe("''");
    for (const col of ['measured_fg', 'measured_bottling_size_l', 'carbonation_type', 'carbonation_volumes_target', 'carbonation_temp_c', 'taste_rating', 'bottling_date', 'closing_snapshot']) {
      expect(byName(col).notnull).toBe(0);
    }

    close();
  });
});

describe('AC-17: batch_notes shape and cascade', () => {
  it('has a batch_id -> batches.id ON DELETE CASCADE FK, no position column, and cascades correctly', () => {
    const dbPath = tempDbFilePath();
    cleanupPaths.push(dbPath);
    const { db, close } = openDatabase(dbPath);
    runMigrations(db);

    const fks = db.$client.prepare(`PRAGMA foreign_key_list('batch_notes')`).all() as { from: string; table: string; on_delete: string }[];
    const batchFk = fks.find((f) => f.from === 'batch_id');
    expect(batchFk).toBeDefined();
    expect(batchFk!.table).toBe('batches');
    expect(batchFk!.on_delete).toBe('CASCADE');

    const columns = db.$client.prepare(`PRAGMA table_info('batch_notes')`).all() as { name: string; notnull: number }[];
    const byName = (n: string) => columns.find((c) => c.name === n)!;
    expect(byName('timestamp').notnull).toBe(1);
    expect(byName('status').notnull).toBe(1);
    expect(byName('note').notnull).toBe(1);
    expect(columns.find((c) => c.name === 'position')).toBeUndefined();

    // Seed two batches, each with a note and a reading, then delete one batch
    // directly at the DB level and confirm cascade scoping.
    const eqId = 'eq-x';
    db.$client
      .prepare(
        `INSERT INTO equipment_profiles (id, name, batch_size_l, boil_time_min, brewhouse_efficiency_pct, mash_efficiency_pct, boil_off_rate_l_per_hour, trub_chiller_loss_l, hop_utilization_pct, mash_water_ratio_l_per_kg, grain_absorption_l_per_kg, hopstand_temperature_c, hopstand_utilization_factor, created_at, updated_at)
         VALUES (?, 'Test Eq', 20, 60, 75, 80, 3, 2, 85, 3.0, 1.0, 90, 0.1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
      )
      .run(eqId);
    const recipeId = 'recipe-x';
    db.$client
      .prepare(`INSERT INTO recipes (id, name, equipment_id, created_at, updated_at) VALUES (?, 'Test Recipe', ?, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`)
      .run(recipeId, eqId);

    for (const batchId of ['batch-a', 'batch-b']) {
      db.$client
        .prepare(
          `INSERT INTO batches (id, name, batch_no, status, recipe_id, recipe_snapshot, taste_notes, created_at, updated_at)
           VALUES (?, 'Batch', 1, 'Planning', ?, '{}', '', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
        )
        .run(batchId, recipeId);
      db.$client
        .prepare(`INSERT INTO batch_notes (id, batch_id, timestamp, status, note) VALUES (?, ?, '2024-01-01T00:00:00.000Z', 'Planning', 'note')`)
        .run(`note-${batchId}`, batchId);
      db.$client
        .prepare(`INSERT INTO batch_readings (id, batch_id, reading_time, comment) VALUES (?, ?, '2024-01-01T00:00:00.000Z', '')`)
        .run(`reading-${batchId}`, batchId);
    }

    db.$client.prepare(`DELETE FROM batches WHERE id = ?`).run('batch-a');

    const notesA = db.$client.prepare(`SELECT * FROM batch_notes WHERE batch_id = ?`).all('batch-a');
    const readingsA = db.$client.prepare(`SELECT * FROM batch_readings WHERE batch_id = ?`).all('batch-a');
    const notesB = db.$client.prepare(`SELECT * FROM batch_notes WHERE batch_id = ?`).all('batch-b');
    const readingsB = db.$client.prepare(`SELECT * FROM batch_readings WHERE batch_id = ?`).all('batch-b');
    expect(notesA).toHaveLength(0);
    expect(readingsA).toHaveLength(0);
    expect(notesB).toHaveLength(1);
    expect(readingsB).toHaveLength(1);

    close();
  });
});

describe('AC-18: nothing earlier moves', () => {
  it('meta/_journal.json differs by exactly one appended idx: 8 entry', () => {
    const journal = JSON.parse(fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as {
      entries: { idx: number; tag: string }[];
    };
    expect(journal.entries.length).toBeGreaterThanOrEqual(9); // idx 0..8+
    expect(journal.entries[8].idx).toBe(8);
    expect(journal.entries[8].tag).toMatch(/^0008_/);
    for (let i = 0; i <= 7; i++) {
      expect(journal.entries[i].idx).toBe(i);
    }
  });
});

describe('AC-19: migration applies to real data without a wipe', () => {
  it('a database populated through 0007 migrates to 0008 with every row intact and all nine new columns at their defaults', () => {
    const dbPath = tempDbFilePath();
    cleanupPaths.push(dbPath);
    const { db: dbPre0008, close } = openDatabase(dbPath);
    const pre0008Dir = pre0008MigrationsFolder();
    cleanupPaths.push(pre0008Dir);

    migrate(dbPre0008, { migrationsFolder: pre0008Dir });

    const eqId = 'eq-123';
    dbPre0008.$client
      .prepare(
        `INSERT INTO equipment_profiles (id, name, batch_size_l, boil_time_min, brewhouse_efficiency_pct, mash_efficiency_pct, boil_off_rate_l_per_hour, trub_chiller_loss_l, hop_utilization_pct, mash_water_ratio_l_per_kg, grain_absorption_l_per_kg, hopstand_temperature_c, hopstand_utilization_factor, created_at, updated_at)
         VALUES (?, 'Test Eq', 20, 60, 75, 80, 3, 2, 85, 3.0, 1.0, 90, 0.1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
      )
      .run(eqId);
    const recipeId = 'recipe-123';
    dbPre0008.$client
      .prepare(`INSERT INTO recipes (id, name, equipment_id, created_at, updated_at) VALUES (?, 'Test Recipe', ?, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`)
      .run(recipeId, eqId);

    // A batch row with a real statsSnapshot, a fermentationStartDate, and a
    // legacy row with stats_snapshot NULL — both must survive untouched.
    const statsSnapshotJson = JSON.stringify({ og: 1.05 });
    const recipeSnapshotJson = JSON.stringify({ id: recipeId, name: 'Test Recipe' });
    dbPre0008.$client
      .prepare(
        `INSERT INTO batches (id, name, batch_no, status, recipe_id, recipe_snapshot, stats_snapshot, measured_og, fermentation_start_date, created_at, updated_at)
         VALUES (?, 'Batch #1', 1, 'Fermenting', ?, ?, ?, 1.056, '2024-06-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
      )
      .run('batch-normal', recipeId, recipeSnapshotJson, statsSnapshotJson);
    dbPre0008.$client
      .prepare(
        `INSERT INTO batches (id, name, batch_no, status, recipe_id, recipe_snapshot, created_at, updated_at)
         VALUES (?, 'Batch #2 (legacy)', 2, 'Planning', ?, ?, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
      )
      .run('batch-legacy', recipeId, recipeSnapshotJson);
    dbPre0008.$client
      .prepare(`INSERT INTO batch_readings (id, batch_id, reading_time, sg, comment) VALUES (?, ?, '2024-06-02T00:00:00.000Z', 1.02, '')`)
      .run('reading-1', 'batch-normal');

    // Apply the rest of the real migration chain — the new, additive 0008.
    runMigrations(dbPre0008);

    const rowCount = (dbPre0008.$client.prepare(`SELECT COUNT(*) as c FROM batches`).get() as { c: number }).c;
    expect(rowCount).toBe(2);
    const readingCount = (dbPre0008.$client.prepare(`SELECT COUNT(*) as c FROM batch_readings`).get() as { c: number }).c;
    expect(readingCount).toBe(1);

    const normalRow = dbPre0008.$client.prepare(`SELECT * FROM batches WHERE id = ?`).get('batch-normal') as any;
    expect(JSON.parse(normalRow.recipe_snapshot)).toEqual({ id: recipeId, name: 'Test Recipe' });
    expect(JSON.parse(normalRow.stats_snapshot)).toEqual({ og: 1.05 });
    expect(normalRow.measured_og).toBe(1.056);
    expect(normalRow.fermentation_start_date).toBe('2024-06-01T00:00:00.000Z');
    // All nine new columns NULL except taste_notes which is ''.
    expect(normalRow.measured_fg).toBeNull();
    expect(normalRow.measured_bottling_size_l).toBeNull();
    expect(normalRow.carbonation_type).toBeNull();
    expect(normalRow.carbonation_volumes_target).toBeNull();
    expect(normalRow.carbonation_temp_c).toBeNull();
    expect(normalRow.taste_notes).toBe('');
    expect(normalRow.taste_rating).toBeNull();
    expect(normalRow.bottling_date).toBeNull();
    expect(normalRow.closing_snapshot).toBeNull();

    const legacyRow = dbPre0008.$client.prepare(`SELECT * FROM batches WHERE id = ?`).get('batch-legacy') as any;
    expect(legacyRow.stats_snapshot).toBeNull();
    expect(legacyRow.taste_notes).toBe('');

    close();
  });
});
