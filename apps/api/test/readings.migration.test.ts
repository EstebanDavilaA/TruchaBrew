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
  return path.join(os.tmpdir(), `truchabrew-readings-migration-test-${randomUUID()}.db`);
}

function cleanupDbFile(filePath: string): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const p = filePath + suffix;
    if (fs.existsSync(p)) fs.rmSync(p);
  }
}

/**
 * A migrations folder containing only 0000-0006 (pre-0007) — reproduces "the
 * developer's existing database" state migration 0007 must apply to without
 * a wipe (M5_P1 spec AC-20), same pattern as batches.migration.test.ts's
 * pre0006MigrationsFolder.
 */
function pre0007MigrationsFolder(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truchabrew-migrations-pre0007-'));
  const metaDir = path.join(tempDir, 'meta');
  fs.mkdirSync(metaDir);

  const sqlFiles = [
    '0000_futuristic_quasimodo.sql',
    '0001_ambitious_phil_sheldon.sql',
    '0002_chunky_cyclops.sql',
    '0003_brave_hobgoblin.sql',
    '0004_jittery_ben_grimm.sql',
    '0005_true_norman_osborn.sql',
    '0006_goofy_zaladane.sql',
  ];
  for (const sqlFile of sqlFiles) {
    fs.copyFileSync(path.join(REAL_MIGRATIONS_FOLDER, sqlFile), path.join(tempDir, sqlFile));
  }
  const snapshots = [
    '0000_snapshot.json',
    '0001_snapshot.json',
    '0002_snapshot.json',
    '0003_snapshot.json',
    '0004_snapshot.json',
    '0005_snapshot.json',
    '0006_snapshot.json',
  ];
  for (const snapshot of snapshots) {
    fs.copyFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', snapshot), path.join(metaDir, snapshot));
  }

  const fullJournal = JSON.parse(fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as {
    entries: { idx: number }[];
  };
  const journalPre0007 = { ...fullJournal, entries: fullJournal.entries.filter((e) => e.idx <= 6) };
  fs.writeFileSync(path.join(metaDir, '_journal.json'), JSON.stringify(journalPre0007, null, 2));

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

describe('AC-17: migration 0007 is additive and does not rebuild batches', () => {
  it('the generated SQL contains exactly 1 CREATE TABLE, 2 CREATE INDEX and 2 ALTER TABLE ADD COLUMN — no rebuild statements', () => {
    const files = fs.readdirSync(REAL_MIGRATIONS_FOLDER).filter((f) => f.startsWith('0007_') && f.endsWith('.sql'));
    expect(files.length).toBe(1);
    const sqlText = fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, files[0]), 'utf8');

    expect(sqlText).not.toMatch(/CREATE TABLE `__new_batches`/i);
    expect(sqlText).not.toMatch(/DROP TABLE `batches`/i);
    expect(sqlText).not.toMatch(/INSERT INTO `batches`[\s\S]*SELECT/i);

    const statements = sqlText
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const createTables = statements.filter((s) => /^CREATE TABLE/i.test(s));
    const createIndexes = statements.filter((s) => /^CREATE INDEX/i.test(s));
    const alterBatches = statements.filter((s) => /^ALTER TABLE `batches` ADD/i.test(s));

    expect(createTables.length).toBe(1);
    expect(createTables[0]).toMatch(/CREATE TABLE `batch_readings`/i);
    expect(createIndexes.length).toBe(2);
    expect(alterBatches.length).toBe(2);
    // Every statement in the file is one of exactly these three kinds.
    expect(createTables.length + createIndexes.length + alterBatches.length).toBe(statements.length);
  });

  it('after the full 0000->0007 chain on a fresh DB, the recipe_id RESTRICT edge and every nullability pragma hold', () => {
    const filePath = tempDbFilePath();
    cleanupPaths.push(filePath);
    const { db, close } = openDatabase(filePath);
    runMigrations(db);

    const batchesFk = db.$client.pragma("foreign_key_list('batches')") as Array<{
      table: string;
      from: string;
      to: string;
      on_delete: string;
    }>;
    const recipeEdge = batchesFk.find((fk) => fk.from === 'recipe_id')!;
    expect(recipeEdge).toMatchObject({ table: 'recipes', to: 'id', on_delete: 'RESTRICT' });

    const columns = db.$client.prepare(`PRAGMA table_info('batches')`).all() as { name: string; notnull: number }[];
    const byName = (name: string) => columns.find((c) => c.name === name)!;
    expect(byName('recipe_snapshot').notnull).toBe(1);
    expect(byName('stats_snapshot').notnull).toBe(0);
    expect(byName('measured_og').notnull).toBe(0);
    expect(byName('fermentation_start_date').notnull).toBe(0);

    close();
  });
});

describe('AC-19: readings cascade with their batch, and the table shape is right', () => {
  function seedTwoBatchesWithReadings(db: ReturnType<typeof openDatabase>['db']) {
    const eqId = 'eq-123';
    db.$client
      .prepare(
        `INSERT INTO equipment_profiles (id, name, batch_size_l, boil_time_min, brewhouse_efficiency_pct, mash_efficiency_pct, boil_off_rate_l_per_hour, trub_chiller_loss_l, hop_utilization_pct, mash_water_ratio_l_per_kg, grain_absorption_l_per_kg, hopstand_temperature_c, hopstand_utilization_factor, created_at, updated_at)
         VALUES (?, 'Test Eq', 20, 60, 75, 80, 3, 2, 85, 3.0, 1.0, 90, 0.1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
      )
      .run(eqId);

    const recipeId = 'recipe-123';
    db.$client
      .prepare(
        `INSERT INTO recipes (id, name, equipment_id, created_at, updated_at)
         VALUES (?, 'Test Recipe', ?, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
      )
      .run(recipeId, eqId);

    for (const batchId of ['batch-a', 'batch-b']) {
      db.$client
        .prepare(
          `INSERT INTO batches (id, name, batch_no, status, recipe_id, recipe_snapshot, created_at, updated_at)
           VALUES (?, ?, 1, 'Planning', ?, '{}', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
        )
        .run(batchId, `Batch ${batchId}`, recipeId);
    }

    for (const [readingId, batchId] of [
      ['reading-a1', 'batch-a'],
      ['reading-a2', 'batch-a'],
      ['reading-b1', 'batch-b'],
    ]) {
      db.$client
        .prepare(
          `INSERT INTO batch_readings (id, batch_id, reading_time, sg, temp_c, comment, ph, pressure_psi)
           VALUES (?, ?, '2024-01-01T00:00:00.000Z', 1.05, 19, '', NULL, NULL)`,
        )
        .run(readingId, batchId);
    }
  }

  it('PRAGMA foreign_key_list(batch_readings) reports batch_id -> batches.id CASCADE', () => {
    const filePath = tempDbFilePath();
    cleanupPaths.push(filePath);
    const { db, close } = openDatabase(filePath);
    runMigrations(db);

    const fks = db.$client.pragma("foreign_key_list('batch_readings')") as Array<{
      table: string;
      from: string;
      to: string;
      on_delete: string;
    }>;
    expect(fks).toHaveLength(1);
    expect(fks[0]).toMatchObject({ table: 'batches', from: 'batch_id', to: 'id', on_delete: 'CASCADE' });

    close();
  });

  it('deleting a batch row directly removes exactly that batch\'s readings, leaves the other batch\'s readings intact', () => {
    const filePath = tempDbFilePath();
    cleanupPaths.push(filePath);
    const { db, close } = openDatabase(filePath);
    runMigrations(db);
    seedTwoBatchesWithReadings(db);

    const before = db.$client.prepare(`SELECT COUNT(*) as c FROM batch_readings`).get() as { c: number };
    expect(before.c).toBe(3);

    db.$client.prepare(`DELETE FROM batches WHERE id = 'batch-a'`).run();

    const remaining = db.$client.prepare(`SELECT id, batch_id FROM batch_readings ORDER BY id`).all() as { id: string; batch_id: string }[];
    expect(remaining).toEqual([{ id: 'reading-b1', batch_id: 'batch-b' }]);

    close();
  });

  it('PRAGMA table_info(batch_readings): comment NOT NULL default \'\', sg/temp_c/ph/pressure_psi all nullable, no position column', () => {
    const filePath = tempDbFilePath();
    cleanupPaths.push(filePath);
    const { db, close } = openDatabase(filePath);
    runMigrations(db);

    const columns = db.$client.prepare(`PRAGMA table_info('batch_readings')`).all() as {
      name: string;
      notnull: number;
      dflt_value: string | null;
    }[];
    const byName = (name: string) => columns.find((c) => c.name === name);

    const comment = byName('comment')!;
    expect(comment.notnull).toBe(1);
    expect(comment.dflt_value).toBe("''");

    for (const nullable of ['sg', 'temp_c', 'ph', 'pressure_psi']) {
      expect(byName(nullable)!.notnull).toBe(0);
    }

    expect(byName('position')).toBeUndefined();

    close();
  });
});

describe('AC-20: migration 0007 applies to real pre-existing data without a wipe', () => {
  it('a database populated through 0006 migrates cleanly to 0007: batch row, recipe_snapshot and stats_snapshot survive byte-identical', () => {
    const filePath = tempDbFilePath();
    cleanupPaths.push(filePath);
    const { db: dbPre0007, close } = openDatabase(filePath);
    const pre0007Dir = pre0007MigrationsFolder();
    cleanupPaths.push(pre0007Dir);

    migrate(dbPre0007, { migrationsFolder: pre0007Dir });

    const eqId = 'eq-123';
    dbPre0007.$client
      .prepare(
        `INSERT INTO equipment_profiles (id, name, batch_size_l, boil_time_min, brewhouse_efficiency_pct, mash_efficiency_pct, boil_off_rate_l_per_hour, trub_chiller_loss_l, hop_utilization_pct, mash_water_ratio_l_per_kg, grain_absorption_l_per_kg, hopstand_temperature_c, hopstand_utilization_factor, created_at, updated_at)
         VALUES (?, 'Test Eq', 20, 60, 75, 80, 3, 2, 85, 3.0, 1.0, 90, 0.1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
      )
      .run(eqId);

    const recipeId = 'recipe-123';
    dbPre0007.$client
      .prepare(
        `INSERT INTO recipes (id, name, equipment_id, created_at, updated_at)
         VALUES (?, 'Test Recipe With Line Items', ?, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
      )
      .run(recipeId, eqId);

    dbPre0007.$client
      .prepare(
        `INSERT INTO recipe_fermentables (id, recipe_id, position, name, type, amount_kg, color_srm, potential_sg)
         VALUES ('ferm-1', ?, 0, 'Pale Malt', 'Grain', 5, 3.5, 1.038)`,
      )
      .run(recipeId);

    const statsSnapshotJson = JSON.stringify({ og: 1.05, fg: 1.012, abv: 5.0 });
    const recipeSnapshotJson = JSON.stringify({ id: recipeId, name: 'Test Recipe With Line Items' });
    const batchId = 'batch-pre-0007';
    dbPre0007.$client
      .prepare(
        `INSERT INTO batches (id, name, batch_no, status, recipe_id, recipe_snapshot, stats_snapshot, created_at, updated_at)
         VALUES (?, 'Batch #1', 1, 'Brewing', ?, ?, ?, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`,
      )
      .run(batchId, recipeId, recipeSnapshotJson, statsSnapshotJson);

    const preTableCounts: Record<string, number> = {};
    for (const table of ['batches', 'recipes', 'recipe_fermentables', 'equipment_profiles']) {
      preTableCounts[table] = (dbPre0007.$client.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
    }

    // Apply the rest of the real migration chain — the new, additive 0007.
    runMigrations(dbPre0007);

    for (const table of ['batches', 'recipes', 'recipe_fermentables', 'equipment_profiles']) {
      const postCount = (dbPre0007.$client.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
      expect(postCount).toBe(preTableCounts[table]);
    }

    const row = dbPre0007.$client.prepare(`SELECT * FROM batches WHERE id = ?`).get(batchId) as any;
    expect(row).toBeDefined();
    expect(JSON.parse(row.recipe_snapshot)).toEqual(JSON.parse(recipeSnapshotJson));
    expect(JSON.parse(row.stats_snapshot)).toEqual(JSON.parse(statsSnapshotJson));
    expect(row.measured_og).toBeNull();
    expect(row.fermentation_start_date).toBeNull();

    close();
  });
});
