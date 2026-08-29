import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { calculateRecipeStats } from '@truchabrew/calculations';
import { openDatabase, type Db } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { recipes, recipeFermentables, mashProfiles, mashSteps, fermentationProfiles, fermentationSteps } from '../src/db/schema';
import { toStoredRecipe } from '../src/mappers/recipeMapper';
import { equipmentRowToDomain } from '../src/repositories/equipmentRepository';
import { createTestDb, type TestDbHandle } from './helpers/testDb';

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL_MIGRATIONS_FOLDER = path.resolve(here, '..', 'drizzle');

function tempDbFilePath(): string {
  return path.join(os.tmpdir(), `truchabrew-schedule-migration-test-${randomUUID()}.db`);
}

function cleanupDbFile(filePath: string): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const p = filePath + suffix;
    if (fs.existsSync(p)) fs.rmSync(p);
  }
}

function countRows(db: Db, table: string): number {
  return (db.$client.prepare(`select count(*) as count from ${table}`).get() as { count: number }).count;
}

/**
 * Builds a migrations folder containing only 0000 + 0001 (pre-M3_P2), so a
 * test can create a database "as it looked before M3_P2's migration
 * existed" — the exact P1-complete shape this phase migrates forward from.
 */
function pre0002MigrationsFolder(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truchabrew-migrations-pre0002-'));
  const metaDir = path.join(tempDir, 'meta');
  fs.mkdirSync(metaDir);

  for (const sqlFile of ['0000_futuristic_quasimodo.sql', '0001_ambitious_phil_sheldon.sql']) {
    fs.copyFileSync(path.join(REAL_MIGRATIONS_FOLDER, sqlFile), path.join(tempDir, sqlFile));
  }
  for (const snapshot of ['0000_snapshot.json', '0001_snapshot.json']) {
    fs.copyFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', snapshot), path.join(metaDir, snapshot));
  }

  const fullJournal = JSON.parse(fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as {
    entries: { idx: number }[];
  };
  const journalPre0002 = { ...fullJournal, entries: fullJournal.entries.filter((e) => e.idx <= 1) };
  fs.writeFileSync(path.join(metaDir, '_journal.json'), JSON.stringify(journalPre0002, null, 2));

  return tempDir;
}

let filesToCleanup: string[] = [];
let handlesToCleanup: TestDbHandle[] = [];
afterEach(() => {
  for (const h of handlesToCleanup) h.cleanup();
  handlesToCleanup = [];
  for (const f of filesToCleanup) cleanupDbFile(f);
  filesToCleanup = [];
});

describe('AC-13: migration does not rebuild recipes', () => {
  it('the generated 0002 migration touches recipes only via ALTER TABLE ADD COLUMN — no CREATE/DROP/INSERT..SELECT', () => {
    const files = fs.readdirSync(REAL_MIGRATIONS_FOLDER).filter((f) => f.startsWith('0002_') && f.endsWith('.sql'));
    expect(files.length).toBe(1);
    const sqlText = fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, files[0]), 'utf8');

    expect(sqlText).not.toMatch(/CREATE TABLE `recipes`/i);
    expect(sqlText).not.toMatch(/DROP TABLE `recipes`/i);
    expect(sqlText).not.toMatch(/INSERT INTO `recipes`[\s\S]*SELECT/i);

    const recipesStatements = sqlText
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /`recipes`/.test(s));
    expect(recipesStatements.length).toBe(2); // exactly the 2 new columns from §1.2
    for (const statement of recipesStatements) {
      expect(statement).toMatch(/^ALTER TABLE `recipes` ADD/i);
    }

    // CREATE TABLE statements for the 4 genuinely-new tables are expected
    // and are not a rebuild.
    for (const newTable of ['mash_profiles', 'mash_steps', 'fermentation_profiles', 'fermentation_steps']) {
      expect(sqlText).toMatch(new RegExp(`CREATE TABLE \`${newTable}\``, 'i'));
    }
  });

  it('after migrating, PRAGMA foreign_key_list(recipes) reports the RESTRICT edge plus both new SET NULL edges', () => {
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
    expect(recipesFk.length).toBeGreaterThanOrEqual(3);

    const equipmentEdge = recipesFk.find((fk) => fk.from === 'equipment_id')!;
    expect(equipmentEdge).toMatchObject({ table: 'equipment_profiles', to: 'id', on_delete: 'RESTRICT' });

    const mashEdge = recipesFk.find((fk) => fk.from === 'mash_profile_id')!;
    expect(mashEdge).toMatchObject({ table: 'mash_profiles', to: 'id', on_delete: 'SET NULL' });

    const fermentationEdge = recipesFk.find((fk) => fk.from === 'fermentation_profile_id')!;
    expect(fermentationEdge).toMatchObject({ table: 'fermentation_profiles', to: 'id', on_delete: 'SET NULL' });

    close();
  });
});

describe('AC-14: migration applies additively to real data', () => {
  it('migrating a database created at 0001 adds both columns as NULL, creates all four tables, and leaves calculateRecipeStats deep-equal', () => {
    const filePath = tempDbFilePath();
    filesToCleanup.push(filePath);

    // --- Phase 1: create the database at the pre-M3_P2 (0001) shape and
    // populate a recipe, exactly as a real post-P1 install would look. ---
    const { db, close } = openDatabase(filePath);
    migrate(db, { migrationsFolder: pre0002MigrationsFolder() });

    const now = '2026-02-01T00:00:00.000Z';
    db.$client
      .prepare(
        `INSERT INTO equipment_profiles
           (id, name, batch_size_l, boil_time_min, brewhouse_efficiency_pct, mash_efficiency_pct,
            boil_off_rate_l_per_hour, trub_chiller_loss_l, hop_utilization_pct, derived_from_equipment_id,
            is_seed, mash_water_ratio_l_per_kg, grain_absorption_l_per_kg, hopstand_utilization_factor,
            hopstand_temperature_c, sparge_temperature_c, mash_tun_heat_capacity_l, grain_temperature_c,
            notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
      )
      .run('pre-p2-eq', 'Pre-P2 Kit', 20, 60, 75, 80, 3.5, 2.0, 87, 3.0, 0.96, 0.26, 79.0, 76.0, 0.0, 20.0, now, now);
    db.$client
      .prepare(
        `INSERT INTO recipes (id, name, author, style_name, equipment_id, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('pre-p2-recipe', 'Pre-P2 Recipe', 'Tester', '', 'pre-p2-eq', '', now, now);
    db.$client
      .prepare(
        `INSERT INTO recipe_fermentables (id, recipe_id, position, name, type, amount_kg, color_srm, potential_sg, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run('pre-p2-ferm', 'pre-p2-recipe', 0, 'Pale Ale Malt', 'Grain', 5, 3.5, 1.038);

    const beforeCounts = {
      equipment_profiles: countRows(db, 'equipment_profiles'),
      recipes: countRows(db, 'recipes'),
      recipe_fermentables: countRows(db, 'recipe_fermentables'),
    };

    const equipmentRow = db.$client.prepare('select * from equipment_profiles where id = ?').get('pre-p2-eq');
    const statsExpected = calculateRecipeStats({
      id: 'pre-p2-recipe',
      name: 'Pre-P2 Recipe',
      author: 'Tester',
      styleName: '',
      notes: '',
      equipment: equipmentRowToDomain(equipmentRow as never),
      fermentables: [{ id: 'pre-p2-ferm', name: 'Pale Ale Malt', type: 'Grain', amountKg: 5, colorSrm: 3.5, potentialSg: 1.038 }],
      hops: [],
      yeasts: [],
      miscs: [],
      mashProfile: null,
      fermentationProfile: null,
    });

    close();

    // --- Phase 2: bring the SAME file up to date with the full migration
    // set (0000+0001 already applied + 0002 newly applied). ---
    const { db: db2, close: close2 } = openDatabase(filePath);
    runMigrations(db2);

    const afterCounts = {
      equipment_profiles: countRows(db2, 'equipment_profiles'),
      recipes: countRows(db2, 'recipes'),
      recipe_fermentables: countRows(db2, 'recipe_fermentables'),
    };
    expect(afterCounts).toEqual(beforeCounts);

    for (const newTable of ['mash_profiles', 'mash_steps', 'fermentation_profiles', 'fermentation_steps']) {
      expect(countRows(db2, newTable)).toBe(0);
    }

    const recipeRow = db2.select().from(recipes).where(eq(recipes.id, 'pre-p2-recipe')).get()!;
    expect(recipeRow.mashProfileId).toBeNull();
    expect(recipeRow.fermentationProfileId).toBeNull();

    const fermRows = db2.select().from(recipeFermentables).where(eq(recipeFermentables.recipeId, 'pre-p2-recipe')).all();
    const equipmentRow2 = db2.$client.prepare('select * from equipment_profiles where id = ?').get('pre-p2-eq');
    const storedRecipe = toStoredRecipe(recipeRow, equipmentRowToDomain(equipmentRow2 as never), fermRows, [], [], [], null, null);
    const statsAfter = calculateRecipeStats(storedRecipe);

    expect(statsAfter).toEqual(statsExpected);
    close2();
  });
});

describe('AC-15: equipment_profiles is untouched by this phase', () => {
  it('0002_*.sql contains no statement naming equipment_profiles', () => {
    const files = fs.readdirSync(REAL_MIGRATIONS_FOLDER).filter((f) => f.startsWith('0002_') && f.endsWith('.sql'));
    const sqlText = fs.readFileSync(path.join(REAL_MIGRATIONS_FOLDER, files[0]), 'utf8');
    expect(sqlText).not.toMatch(/equipment_profiles/i);
  });
});

describe('cross-check: seeding populates the four new tables and the sample recipe stays unattached', () => {
  it('a freshly seeded + migrated database has both mash profiles, the fermentation profile, and rec-sample-1 with null FKs', () => {
    const handle = createTestDb({ seed: true });
    handlesToCleanup.push(handle);

    expect(countRows(handle.db, 'mash_profiles')).toBe(2);
    expect(countRows(handle.db, 'fermentation_profiles')).toBe(1);

    const sampleRow = handle.db.select().from(recipes).where(eq(recipes.id, 'rec-sample-1')).get()!;
    expect(sampleRow.mashProfileId).toBeNull();
    expect(sampleRow.fermentationProfileId).toBeNull();

    const mashStepRows = handle.db.select().from(mashSteps).all();
    const oneStepProfileSteps = mashStepRows.filter((s) => s.mashProfileId === 'mash-1');
    const threeStepProfileSteps = mashStepRows.filter((s) => s.mashProfileId === 'mash-2');
    expect(oneStepProfileSteps.length).toBe(1);
    expect(threeStepProfileSteps.length).toBe(3);

    const fermentationStepRows = handle.db.select().from(fermentationSteps).all();
    expect(fermentationStepRows.length).toBe(3);

    const mashProfileRows = handle.db.select().from(mashProfiles).all();
    expect(mashProfileRows.every((p) => p.isSeed === 1)).toBe(true);
    const fermentationProfileRows = handle.db.select().from(fermentationProfiles).all();
    expect(fermentationProfileRows.every((p) => p.isSeed === 1)).toBe(true);
  });
});
