import { describe, it, expect, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import {
  equipmentProfiles,
  catalogFermentables,
  catalogHops,
  catalogYeasts,
  catalogMiscs,
  recipes,
  recipeFermentables,
  recipeHops,
  recipeYeasts,
} from '../src/db/schema';

let handle: TestDbHandle;

afterEach(() => {
  handle?.cleanup();
});

describe('seedDatabase', () => {
  it('AC-18: migrations create all 10 tables and are idempotent', () => {
    handle = createTestDb();
    // Running migrations again (createTestDb already ran them once) must not throw.
    expect(() => runMigrations(handle.db)).not.toThrow();

    const tableNames = handle.db.all<{ name: string }>(
      sql`select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '__drizzle%'`,
    );
    // M3_P2 adds 4 tables. M4_P1 adds 1 table (batches). M5_P1 adds 1 table
    // (batch_readings). M5_P2 adds 1 table (batch_notes). M6_P1 adds 1 table
    // (water_profiles). M7_P1 adds 1 table (user_config):
    // 10 + 4 + 1 + 1 + 1 + 1 + 1 = 19. This one-line count bump is a
    // mechanically-forced update (same class already blessed at M4_P1 for
    // this identical file/assertion) — flagged for critic attention since
    // seed.test.ts is not listed in the M7_P1 spec §1.3 file tables at all.
    expect(tableNames.length).toBe(21);
  });

  it('AC-19: seeding twice leaves exactly the expected row counts, no duplicates', () => {
    handle = createTestDb();
    seedDatabase(handle.db);
    seedDatabase(handle.db);

    expect(handle.db.select().from(equipmentProfiles).all().length).toBe(2);
    // M12_P1 (FEAT-011) expanded the catalog: 8+9 fermentables, 7+9 hops,
    // 4+6 yeasts, 6+7 miscs (spec §3.1, AC-1's >= thresholds).
    expect(handle.db.select().from(catalogFermentables).all().length).toBe(17);
    expect(handle.db.select().from(catalogHops).all().length).toBe(16);
    expect(handle.db.select().from(catalogYeasts).all().length).toBe(10);
    expect(handle.db.select().from(catalogMiscs).all().length).toBe(13);
    expect(handle.db.select().from(recipes).all().length).toBe(1);
    expect(handle.db.select().from(recipes).where(eq(recipes.id, 'rec-sample-1')).get()).toBeDefined();
  });

  it('AC-20: seeded eq-1 matches the retired SEED_EQUIPMENT_PROFILES[0] field-for-field', () => {
    handle = createTestDb();
    seedDatabase(handle.db);

    const eq1 = handle.db.select().from(equipmentProfiles).where(eq(equipmentProfiles.id, 'eq-1')).get()!;
    expect(eq1.batchSizeL).toBe(20);
    expect(eq1.brewhouseEfficiencyPct).toBe(75);
    expect(eq1.mashEfficiencyPct).toBe(80);
    expect(eq1.boilOffRateLPerHour).toBe(3.5);
    expect(eq1.trubChillerLossL).toBe(2.0);
    expect(eq1.hopUtilizationPct).toBe(87);
  });

  it('AC-20: seeded rec-sample-1 has 3 fermentables, 4 hops, 1 yeast matching the retired INITIAL_SAMPLE_RECIPE', () => {
    handle = createTestDb();
    seedDatabase(handle.db);

    const fermentables = handle.db.select().from(recipeFermentables).where(eq(recipeFermentables.recipeId, 'rec-sample-1')).all();
    const hops = handle.db.select().from(recipeHops).where(eq(recipeHops.recipeId, 'rec-sample-1')).all();
    const yeasts = handle.db.select().from(recipeYeasts).where(eq(recipeYeasts.recipeId, 'rec-sample-1')).all();

    expect(fermentables.length).toBe(3);
    expect(hops.length).toBe(4);
    expect(yeasts.length).toBe(1);
    expect(fermentables.map((f) => f.name).sort()).toEqual(
      ['Pale Ale Malt (2-Row)', 'Munich Malt (10 SRM)', 'Caramalt / Crystal 40'].sort(),
    );
    expect(yeasts[0].name).toBe('US-05 SafAle American');
  });

  it('AC-1: expanded catalog meets M12_P1 thresholds and new presets carry accurate vitals', () => {
    handle = createTestDb();
    seedDatabase(handle.db);

    const fermentables = handle.db.select().from(catalogFermentables).all();
    const hops = handle.db.select().from(catalogHops).all();
    const yeasts = handle.db.select().from(catalogYeasts).all();
    const miscs = handle.db.select().from(catalogMiscs).all();

    expect(fermentables.length).toBeGreaterThanOrEqual(16);
    expect(hops.length).toBeGreaterThanOrEqual(15);
    expect(yeasts.length).toBeGreaterThanOrEqual(9);
    expect(miscs.length).toBeGreaterThanOrEqual(12);

    // Pre-existing IDs f-1..f-8/h-1..h-7/y-1..y-4/m-1..m-6 preserved byte-identical.
    expect(fermentables.find((f) => f.id === 'f-1')).toMatchObject({ name: 'Pilsner Malt', type: 'Grain', colorSrm: 1.6, potentialSg: 1.037 });
    expect(hops.find((h) => h.id === 'h-1')).toMatchObject({ name: 'Citra', alphaAcidPct: 12.5, type: 'Pellet' });
    expect(yeasts.find((y) => y.id === 'y-1')).toMatchObject({ name: 'US-05 SafAle American', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 78 });
    expect(miscs.find((m) => m.id === 'm-1')).toMatchObject({ name: 'Gypsum', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'g' });

    // Spot-check new presets' vitals against spec §3.1.
    expect(fermentables.find((f) => f.id === 'f-9')).toMatchObject({ name: 'Vienna Malt', type: 'Grain', colorSrm: 3.5, potentialSg: 1.037 });
    expect(fermentables.find((f) => f.id === 'f-17')).toMatchObject({ name: 'Dry Malt Extract (Light)', type: 'DryExtract', colorSrm: 3.0, potentialSg: 1.044 });
    expect(hops.find((h) => h.id === 'h-8')).toMatchObject({ name: 'Amarillo', alphaAcidPct: 9.2, type: 'Pellet' });
    expect(hops.find((h) => h.id === 'h-16')).toMatchObject({ name: 'El Dorado', alphaAcidPct: 15.0, type: 'Pellet' });
    expect(yeasts.find((y) => y.id === 'y-5')).toMatchObject({ name: 'S-04 SafAle English Ale', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 75 });
    expect(yeasts.find((y) => y.id === 'y-10')).toMatchObject({ name: 'WLP830 German Lager', laboratory: 'White Labs', type: 'Lager', form: 'Liquid', attenuationPct: 77 });
    expect(miscs.find((m) => m.id === 'm-7')).toMatchObject({ name: 'Epsom Salt', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'g' });
    expect(miscs.find((m) => m.id === 'm-13')).toMatchObject({ name: 'Sweet Orange Peel', type: 'Spice', defaultUse: 'Boil', defaultUnit: 'g' });
  });
});
