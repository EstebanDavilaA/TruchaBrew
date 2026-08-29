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
  return path.join(os.tmpdir(), `truchabrew-hop-migration-test-${randomUUID()}.db`);
}

function cleanupDbFile(filePath: string): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const p = filePath + suffix;
    if (fs.existsSync(p)) fs.rmSync(p);
  }
}

function pre0004MigrationsFolder(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truchabrew-migrations-pre0004-'));
  const metaDir = path.join(tempDir, 'meta');
  fs.mkdirSync(metaDir);

  for (const sqlFile of ['0000_futuristic_quasimodo.sql', '0001_ambitious_phil_sheldon.sql', '0002_chunky_cyclops.sql', '0003_brave_hobgoblin.sql']) {
    fs.copyFileSync(path.join(REAL_MIGRATIONS_FOLDER, sqlFile), path.join(tempDir, sqlFile));
  }
  for (const snapshot of ['0000_snapshot.json', '0001_snapshot.json', '0002_snapshot.json', '0003_snapshot.json']) {
    fs.copyFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', snapshot), path.join(metaDir, snapshot));
  }

  const fullJournal = JSON.parse(fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as {
    entries: { idx: number }[];
  };
  const journalPre0004 = { ...fullJournal, entries: fullJournal.entries.filter((e) => e.idx <= 3) };
  fs.writeFileSync(path.join(metaDir, '_journal.json'), JSON.stringify(journalPre0004, null, 2));

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

describe('AC-4: Hop Migration', () => {
  it('Existing timeMinutes data maps correctly to boilMins or whirlpoolMins', () => {
    const dbPath = tempDbFilePath();
    cleanupPaths.push(dbPath);
    const { db: dbPre0004, close } = openDatabase(dbPath);
    const pre0004Dir = pre0004MigrationsFolder();
    cleanupPaths.push(pre0004Dir);

    // Run up to 0003
    migrate(dbPre0004, { migrationsFolder: pre0004Dir });

    // Insert dummy equipment and recipe
    const eqId = 'eq-123';
    dbPre0004.$client.prepare(
      `INSERT INTO equipment_profiles (id, name, batch_size_l, boil_time_min, brewhouse_efficiency_pct, mash_efficiency_pct, boil_off_rate_l_per_hour, trub_chiller_loss_l, hop_utilization_pct, mash_water_ratio_l_per_kg, grain_absorption_l_per_kg, hopstand_temperature_c, hopstand_utilization_factor, created_at, updated_at)
       VALUES (?, 'Test Eq', 20, 60, 75, 80, 3, 2, 85, 3.0, 1.0, 90, 0.1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`
    ).run(eqId);

    const recipeId = 'recipe-123';
    dbPre0004.$client.prepare(
      `INSERT INTO recipes (id, name, equipment_id, created_at, updated_at)
       VALUES (?, 'Test Recipe', ?, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')`
    ).run(recipeId, eqId);

    // Insert hops in pre-0004 schema (time_minutes)
    // Note: in 0004 schema, time_minutes is gone. But in pre-0004 it's there.
    // 1. Boil hop: time_minutes = 60
    dbPre0004.$client.prepare(
      `INSERT INTO recipe_hops (id, recipe_id, position, name, use, type, amount_g, alpha_acid_pct, time_minutes)
       VALUES ('h1', ?, 0, 'Cascade', 'Boil', 'Pellet', 50, 5.5, 60)`
    ).run(recipeId);

    // 2. Whirlpool hop: time_minutes = 20
    dbPre0004.$client.prepare(
      `INSERT INTO recipe_hops (id, recipe_id, position, name, use, type, amount_g, alpha_acid_pct, time_minutes)
       VALUES ('h2', ?, 1, 'Mosaic', 'Whirlpool', 'Pellet', 30, 12.0, 20)`
    ).run(recipeId);

    // 3. DryHop hop with a non-zero time_minutes (AC-10(c)) — the pre-fix
    // version of this test seeded only Boil and Whirlpool hops, which is
    // exactly why F-10/AC-10's DryHop data-destruction bug was invisible.
    dbPre0004.$client.prepare(
      `INSERT INTO recipe_hops (id, recipe_id, position, name, use, type, amount_g, alpha_acid_pct, time_minutes)
       VALUES ('h3', ?, 2, 'Simcoe', 'DryHop', 'Pellet', 50, 13.0, 4320)`
    ).run(recipeId);

    // Run the rest of the migrations (through 0004, then the new additive 0005).
    runMigrations(dbPre0004);

    // Assert the Boil/Whirlpool data mapped correctly (AC-4, unmodified).
    const boilHop = dbPre0004.$client.prepare(`SELECT * FROM recipe_hops WHERE id = 'h1'`).get() as any;
    expect(boilHop.boil_mins).toBe(60);
    expect(boilHop.whirlpool_mins).toBeNull();
    // 0004 drops time_minutes; 0005 re-adds it as an empty nullable column —
    // so it is no longer `undefined` (column absent) but a real `null`.
    expect(boilHop.time_minutes).toBeNull();

    const whirlpoolHop = dbPre0004.$client.prepare(`SELECT * FROM recipe_hops WHERE id = 'h2'`).get() as any;
    expect(whirlpoolHop.boil_mins).toBeNull();
    expect(whirlpoolHop.whirlpool_mins).toBe(20);
    expect(whirlpoolHop.whirlpool_temp_c).toBe(90); // Pulled from equipment_profile hopstand_temperature_c
    expect(whirlpoolHop.time_minutes).toBeNull();

    // AC-10(c): the DryHop row's timing was copied into neither Boil nor
    // Whirlpool field by 0004, and no new destination column exists to have
    // copied it into. This is the disclosed residual (Resolved Ambiguities):
    // 0004 already dropped time_minutes before 0005 could re-add it, so the
    // pre-0004 value (4320) is not recoverable — only forward round-tripping
    // from 0005 onward is claimed (see recipes.crud.test.ts for that half).
    const dryHop = dbPre0004.$client.prepare(`SELECT * FROM recipe_hops WHERE id = 'h3'`).get() as any;
    expect(dryHop.boil_mins).toBeNull();
    expect(dryHop.whirlpool_mins).toBeNull();
    expect(dryHop.whirlpool_temp_c).toBeNull();
    expect(dryHop.time_minutes).toBeNull();

    // AC-10(a): the full chain leaves time_minutes nullable, not NOT NULL.
    const columns = dbPre0004.$client.prepare(`PRAGMA table_info('recipe_hops')`).all() as { name: string; notnull: number }[];
    const timeMinutesColumn = columns.find((c) => c.name === 'time_minutes');
    expect(timeMinutesColumn).toBeDefined();
    expect(timeMinutesColumn!.notnull).toBe(0);

    close();
  });
});
