import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { calculateRecipeStats } from '@truchabrew/calculations';
import type { EquipmentProfile, Recipe } from '@truchabrew/shared-types';
import { openDatabase, type Db } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { equipmentRowToDomain, listEquipmentProfiles } from '../src/repositories/equipmentRepository';
import { toStoredRecipe } from '../src/mappers/recipeMapper';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { equipmentProfiles, recipes, recipeFermentables, recipeHops } from '../src/db/schema';

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL_MIGRATIONS_FOLDER = path.resolve(here, '..', 'drizzle');
const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z'; // must match apps/api/src/db/seed.ts's SEED_TIMESTAMP

function tempDbFilePath(): string {
  return path.join(os.tmpdir(), `truchabrew-migration-test-${randomUUID()}.db`);
}

function cleanupDbFile(filePath: string): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const p = filePath + suffix;
    try {
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    } catch {}
  }
}

/**
 * Builds a migrations folder containing ONLY the 0000 migration, so a test
 * can create a database "as it looked before M3_P1's migration existed" —
 * simulating a real pre-M3 install (applied via drizzle's own migrator, so
 * the __drizzle_migrations bookkeeping table is populated exactly as it
 * would be in production), not a database that skipped 0000 entirely.
 */
function only0000MigrationsFolder(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truchabrew-migrations-0000-'));
  const metaDir = path.join(tempDir, 'meta');
  fs.mkdirSync(metaDir);

  fs.copyFileSync(
    path.join(REAL_MIGRATIONS_FOLDER, '0000_futuristic_quasimodo.sql'),
    path.join(tempDir, '0000_futuristic_quasimodo.sql'),
  );
  fs.copyFileSync(
    path.join(REAL_MIGRATIONS_FOLDER, 'meta', '0000_snapshot.json'),
    path.join(metaDir, '0000_snapshot.json'),
  );

  const fullJournal = JSON.parse(fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as {
    entries: { idx: number }[];
  };
  const journal0000Only = { ...fullJournal, entries: fullJournal.entries.filter((e) => e.idx === 0) };
  fs.writeFileSync(path.join(metaDir, '_journal.json'), JSON.stringify(journal0000Only, null, 2));

  return tempDir;
}

function countRows(db: Db, table: string): number {
  return (db.$client.prepare(`select count(*) as count from ${table}`).get() as { count: number }).count;
}

let filesToCleanup: string[] = [];
let handlesToCleanup: TestDbHandle[] = [];
afterEach(() => {
  for (const h of handlesToCleanup) h.cleanup();
  handlesToCleanup = [];
  for (const f of filesToCleanup) cleanupDbFile(f);
  filesToCleanup = [];
});

describe('AC-17: migration applies additively to a database created at 0000', () => {
  it('adds all 8 columns, leaves row counts unchanged, and calculateRecipeStats is deep-equal before and after', () => {
    const filePath = tempDbFilePath();
    filesToCleanup.push(filePath);

    // --- Phase 1: create the database at the pre-M3 (0000-only) shape and
    // populate it, exactly as a real pre-M3 install would look. ---
    const { db, close } = openDatabase(filePath);
    migrate(db, { migrationsFolder: only0000MigrationsFolder() });

    const now = '2026-02-01T00:00:00.000Z';
    db.$client
      .prepare(
        `INSERT INTO equipment_profiles
           (id, name, batch_size_l, boil_time_min, brewhouse_efficiency_pct, mash_efficiency_pct,
            boil_off_rate_l_per_hour, trub_chiller_loss_l, hop_utilization_pct, derived_from_equipment_id,
            is_seed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)`,
      )
      .run('pre-m3-eq', 'Pre-M3 Kit', 20, 60, 75, 80, 3.5, 2.0, 87, now, now);
    db.$client
      .prepare(
        `INSERT INTO recipes (id, name, author, style_name, equipment_id, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('pre-m3-recipe', 'Pre-M3 Recipe', 'Tester', '', 'pre-m3-eq', '', now, now);
    db.$client
      .prepare(
        `INSERT INTO recipe_fermentables (id, recipe_id, position, name, type, amount_kg, color_srm, potential_sg, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run('pre-m3-ferm', 'pre-m3-recipe', 0, 'Pale Ale Malt', 'Grain', 5, 3.5, 1.038);
    db.$client
      .prepare(
        `INSERT INTO recipe_hops (id, recipe_id, position, name, amount_g, alpha_acid_pct, use, time_minutes, type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('pre-m3-hop', 'pre-m3-recipe', 0, 'Magnum', 20, 14, 'Boil', 60, 'Pellet');

    const beforeCounts = {
      equipment_profiles: countRows(db, 'equipment_profiles'),
      recipes: countRows(db, 'recipes'),
      recipe_fermentables: countRows(db, 'recipe_fermentables'),
      recipe_hops: countRows(db, 'recipe_hops'),
    };

    // The "before" expectation — hand-built at the documented defaults. This
    // literally IS the pre-M3 hardcoded-constant behaviour, expressed as data:
    // proof the migration's chosen defaults reproduce the old numbers exactly.
    const expectedEquipment: EquipmentProfile = {
      id: 'pre-m3-eq',
      name: 'Pre-M3 Kit',
      batchSizeL: 20,
      boilTimeMin: 60,
      brewhouseEfficiencyPct: 75,
      mashEfficiencyPct: 80,
      boilOffRateLPerHour: 3.5,
      trubChillerLossL: 2.0,
      hopUtilizationPct: 87,
      derivedFromEquipmentId: null,
      mashWaterRatioLPerKg: 3.0,
      grainAbsorptionLPerKg: 0.96,
      hopstandUtilizationFactor: 0.26,
      hopstandTemperatureC: 79.0,
      spargeTemperatureC: 76.0,
      mashTunHeatCapacityL: 0.0,
      grainTemperatureC: 20.0,
      notes: '',
      altitudeMeters: 0.0,
      calcStrikeWithThermalMass: false,
      mashTunDeadSpaceL: 0.0,
      kettleLossL: 0.0,
      mashTunWeightKg: 0.0,
      mashTunHeatCapacity: 0.12,
    };
    const expectedRecipe: Recipe = {
      id: 'pre-m3-recipe',
      name: 'Pre-M3 Recipe',
      author: 'Tester',
      styleName: '',
      notes: '',
      equipment: expectedEquipment,
      fermentables: [{ id: 'pre-m3-ferm', name: 'Pale Ale Malt', type: 'Grain', amountKg: 5, colorSrm: 3.5, potentialSg: 1.038 }],
      hops: [{ id: 'pre-m3-hop', name: 'Magnum', amountG: 20, alphaAcidPct: 14, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' }],
      yeasts: [],
      miscs: [],
      // M3_P2: toStoredRecipe's arity grew by 2 (mashProfile/fermentationProfile).
      // This pre-M3 recipe genuinely has neither — null is the real value here,
      // not a placeholder (M3_P2 spec, "Known execution risks").
      mashProfile: null,
      fermentationProfile: null,
    };
    const statsExpected = calculateRecipeStats(expectedRecipe);

    close();

    // --- Phase 2: bring the SAME file up to date with the real, full
    // migration set (0000 already applied + 0001 newly applied). ---
    const { db: db2, close: close2 } = openDatabase(filePath);
    runMigrations(db2);

    const afterCounts = {
      equipment_profiles: countRows(db2, 'equipment_profiles'),
      recipes: countRows(db2, 'recipes'),
      recipe_fermentables: countRows(db2, 'recipe_fermentables'),
      recipe_hops: countRows(db2, 'recipe_hops'),
    };
    expect(afterCounts).toEqual(beforeCounts);

    const eqRow = db2.select().from(equipmentProfiles).where(eq(equipmentProfiles.id, 'pre-m3-eq')).get()!;
    const domainEquipment = equipmentRowToDomain(eqRow);
    expect(domainEquipment).toEqual(expectedEquipment); // the 8 new columns landed at the documented defaults

    const recipeRow = db2.select().from(recipes).where(eq(recipes.id, 'pre-m3-recipe')).get()!;
    const fermRows = db2.select().from(recipeFermentables).where(eq(recipeFermentables.recipeId, 'pre-m3-recipe')).all();
    const hopRows = db2.select().from(recipeHops).where(eq(recipeHops.recipeId, 'pre-m3-recipe')).all();
    const storedRecipe = toStoredRecipe(recipeRow, domainEquipment, fermRows, hopRows, [], [], null, null);
    const statsAfter = calculateRecipeStats(storedRecipe);

    expect(statsAfter).toEqual(statsExpected);
    close2();
  });
});

describe('AC-18: migration does not rebuild the table', () => {
  it('the generated 0001 migration is additive-only ALTER TABLE ADD statements against equipment_profiles', () => {
    const files = fs.readdirSync(REAL_MIGRATIONS_FOLDER).filter((f) => f.startsWith('0001_') && f.endsWith('.sql'));
    expect(files.length).toBe(1);
    const sqlText = fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, files[0]), 'utf8');

    expect(sqlText).not.toMatch(/CREATE TABLE/i);
    expect(sqlText).not.toMatch(/DROP TABLE/i);
    expect(sqlText).not.toMatch(/INSERT INTO[\s\S]*SELECT/i);

    const statements = sqlText
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    expect(statements.length).toBe(8); // exactly the 8 new columns from §1.2
    for (const statement of statements) {
      // drizzle-kit emits `ADD \`col\` ...` (no COLUMN keyword — SQLite accepts
      // both forms identically); either way it must be additive against
      // equipment_profiles specifically, never any other table.
      expect(statement).toMatch(/^ALTER TABLE `equipment_profiles` ADD/i);
    }
  });

  it('after migrating, the RESTRICT and SET NULL foreign-key edges from M2 still hold', () => {
    const filePath = tempDbFilePath();
    filesToCleanup.push(filePath);
    const { db, close } = openDatabase(filePath);
    runMigrations(db);

    const recipesFk = db.$client.pragma("foreign_key_list('recipes')") as Array<{
      table: string;
      from: string;
      to: string;
      on_delete: string;
    }>;
    // M3_P2 adds two more FK edges on `recipes` (mash_profile_id,
    // fermentation_profile_id, both ON DELETE SET NULL) — the M2 RESTRICT
    // edge on equipment_id must still hold alongside them (M3_P2 spec AC-13).
    expect(recipesFk.length).toBeGreaterThanOrEqual(3);
    const equipmentEdge = recipesFk.find((fk) => fk.from === 'equipment_id')!;
    expect(equipmentEdge).toMatchObject({ table: 'equipment_profiles', from: 'equipment_id', to: 'id', on_delete: 'RESTRICT' });

    const equipmentFk = db.$client.pragma("foreign_key_list('equipment_profiles')") as Array<{
      table: string;
      from: string;
      to: string;
      on_delete: string;
    }>;
    expect(equipmentFk).toHaveLength(1);
    expect(equipmentFk[0]).toMatchObject({
      table: 'equipment_profiles',
      from: 'derived_from_equipment_id',
      to: 'id',
      on_delete: 'SET NULL',
    });

    close();
  });
});

describe('AC-19: seeded and migrated profiles agree', () => {
  it('eq-1 from a freshly-seeded database is field-for-field === to eq-1 in a database migrated from 0000, across all 18 fields', () => {
    // Path A: fresh database, full migrations + seed.
    const seededHandle = createTestDb({ seed: true });
    handlesToCleanup.push(seededHandle);
    const seededEq1 = listEquipmentProfiles(seededHandle.db).find((e) => e.id === 'eq-1')!;
    expect(seededEq1).toBeDefined();

    // Path B: a database created at 0000, eq-1 inserted at the pre-M3 (13-column)
    // shape with the same values seed.ts writes, then migrated to 0001.
    const filePath = tempDbFilePath();
    filesToCleanup.push(filePath);
    const { db, close } = openDatabase(filePath);
    migrate(db, { migrationsFolder: only0000MigrationsFolder() });
    db.$client
      .prepare(
        `INSERT INTO equipment_profiles
           (id, name, batch_size_l, boil_time_min, brewhouse_efficiency_pct, mash_efficiency_pct,
            boil_off_rate_l_per_hour, trub_chiller_loss_l, hop_utilization_pct, derived_from_equipment_id,
            is_seed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
      )
      .run('eq-1', 'All-Grain 20L System', 20, 60, 75, 80, 3.5, 2.0, 87, SEED_TIMESTAMP, SEED_TIMESTAMP);
    close();

    const { db: db2, close: close2 } = openDatabase(filePath);
    runMigrations(db2);
    const migratedEq1 = listEquipmentProfiles(db2).find((e) => e.id === 'eq-1')!;
    close2();

    expect(migratedEq1).toBeDefined();
    expect(Object.keys(migratedEq1)).toHaveLength(24);
    for (const key of Object.keys(seededEq1) as (keyof EquipmentProfile)[]) {
      expect(migratedEq1[key]).toBe(seededEq1[key]);
    }
  });
});

describe('AC-20: seeding stays idempotent with the 8 new fields', () => {
  it('running seedDatabase twice yields exactly 2 profiles, defaults intact, nothing mutated on the second pass', () => {
    const handle = createTestDb();
    handlesToCleanup.push(handle);
    seedDatabase(handle.db);
    const firstPass = listEquipmentProfiles(handle.db);

    seedDatabase(handle.db);
    const secondPass = listEquipmentProfiles(handle.db);

    expect(secondPass.length).toBe(2);
    expect(secondPass).toEqual(firstPass);

    for (const profile of secondPass) {
      expect(profile.mashWaterRatioLPerKg).toBe(3.0);
      expect(profile.grainAbsorptionLPerKg).toBe(0.96);
      expect(profile.hopstandUtilizationFactor).toBe(0.26);
      expect(profile.hopstandTemperatureC).toBe(79.0);
      expect(profile.spargeTemperatureC).toBe(76.0);
      expect(profile.mashTunHeatCapacityL).toBe(0.0);
      expect(profile.grainTemperatureC).toBe(20.0);
      expect(profile.notes).toBe('');
    }
  });
});
