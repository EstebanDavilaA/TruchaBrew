import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DatabaseBackup, RestoreRequest, RestoreSummary, EquipmentProfile, StoredRecipe, BatchWithReadings, WaterProfile, MashProfile, FermentationProfile, InventoryItem } from '@truchabrew/shared-types';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';

let handle: TestDbHandle;
let app: FastifyInstance;

afterEach(async () => {
  await app?.close();
  handle?.cleanup();
});

function setupSeeded(): void {
  handle = createTestDb();
  seedDatabase(handle.db);
  app = buildServer({ db: handle.db });
}

function setupUnseeded(): void {
  handle = createTestDb();
  app = buildServer({ db: handle.db });
}

async function restore(req: object) {
  return app.inject({ method: 'POST', url: '/api/backup/restore', payload: req });
}

function count(table: string): number {
  return (handle.db.$client.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;
}

function row<T>(sql: string, ...params: unknown[]): T | undefined {
  return handle.db.$client.prepare(sql).get(...params) as T | undefined;
}

function rows<T>(sql: string, ...params: unknown[]): T[] {
  return handle.db.$client.prepare(sql).all(...params) as T[];
}

// A single complete, internally-consistent DatabaseBackup: one equipment
// profile, one mash profile (2 steps), one fermentation profile (2 steps),
// one water profile, one recipe (embedding the equipment/mash/fermentation
// profiles above, per StoredRecipe/Recipe's actual shape — see
// packages/shared-types/src/brewing.ts) with 1 fermentable/hop/yeast/misc,
// one batch (with 1 reading + 1 note) brewed from that recipe, one inventory
// item, and a non-default config — so a single restore call exercises every
// entity family (AC-6 through AC-10) in one shot.
function equipmentFixture(id: string, name: string): EquipmentProfile {
  return {
    id,
    name,
    batchSizeL: 20,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 75,
    mashEfficiencyPct: 80,
    boilOffRateLPerHour: 3.5,
    trubChillerLossL: 2,
    hopUtilizationPct: 87,
    derivedFromEquipmentId: null,
    mashWaterRatioLPerKg: 3,
    grainAbsorptionLPerKg: 0.96,
    hopstandUtilizationFactor: 0.26,
    hopstandTemperatureC: 79,
    spargeTemperatureC: 76,
    mashTunHeatCapacityL: 0,
    grainTemperatureC: 20,
    notes: '',
  };
}

function mashProfileFixture(id: string): MashProfile {
  return {
    id,
    name: 'Restored Mash',
    targetPh: 5.4,
    spargeTempC: null,
    steps: [
      { id: `${id}-s0`, name: 'Acid Rest', type: 'Temperature', stepTempC: 52, stepTimeMin: 15, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
      { id: `${id}-s1`, name: 'Sacc Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 45, rampTimeMin: 5, infuseAmountL: null, infuseWaterTempC: 100 },
    ],
  };
}

function fermentationProfileFixture(id: string): FermentationProfile {
  return {
    id,
    name: 'Restored Fermentation',
    steps: [
      { id: `${id}-s0`, name: 'Primary', type: 'Primary', stepTempC: 19, stepTimeDays: 14, rampDays: 0, pressurePsi: null },
      { id: `${id}-s1`, name: 'Cold Crash', type: 'ColdCrash', stepTempC: 2, stepTimeDays: 2, rampDays: 1, pressurePsi: null },
    ],
  };
}

function waterProfileFixture(id: string): WaterProfile {
  return { id, name: 'Restored Water', type: 'source', calcium: 50, magnesium: 10, sodium: 20, chloride: 30, sulfate: 40, bicarbonate: 120, ph: 7.4, description: null };
}

function recipeFixture(id: string, equipment: EquipmentProfile, mash: MashProfile, ferm: FermentationProfile, water: WaterProfile): StoredRecipe {
  return {
    id,
    name: 'Restored IPA',
    author: 'Tester',
    styleName: 'American IPA',
    equipment,
    mashProfile: mash,
    fermentationProfile: ferm,
    waterSourceId: water.id,
    waterTargetId: null,
    notes: '',
    fermentables: [{ id: `${id}-f1`, name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 3.5, potentialSg: 1.038 }],
    hops: [{ id: `${id}-h1`, name: 'Citra', amountG: 30, alphaAcidPct: 12.5, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet', timeMinutes: null }],
    yeasts: [{ id: `${id}-y1`, name: 'US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 78, amountPkg: 1 }],
    miscs: [{ id: `${id}-m1`, name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 10, amount: 1, unit: 'each' }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

function batchFixture(id: string, recipeId: string, recipeSnapshot: StoredRecipe): BatchWithReadings {
  return {
    id,
    name: 'Restored Batch',
    batchNo: 1,
    brewer: 'Tester',
    brewDate: '2026-01-03',
    status: 'Fermenting',
    recipeId,
    recipeSnapshot,
    statsSnapshot: null,
    measuredPreBoilGravity: null,
    measuredMashPh: null,
    measuredBoilSizeL: null,
    measuredBoilTimeMin: null,
    measuredOg: 1.06,
    fermentationStartDate: '2026-01-04T00:00:00.000Z',
    measuredFg: null,
    measuredBottlingSizeL: null,
    carbonationType: null,
    carbonationVolumesTarget: null,
    carbonationTempC: null,
    tasteNotes: '',
    tasteRating: null,
    bottlingDate: null,
    closingSnapshot: null,
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-04T00:00:00.000Z',
    readings: [{ id: `${id}-r1`, batchId: id, readingTime: '2026-01-04T12:00:00.000Z', sg: 1.02, tempC: 19, comment: 'Ticking along', ph: null, pressurePsi: null }],
    notes: [{ id: `${id}-n1`, batchId: id, timestamp: '2026-01-04T12:05:00.000Z', status: 'Fermenting', note: 'Smells great' }],
  };
}

function inventoryItemFixture(id: string): InventoryItem {
  return {
    id,
    category: 'Hop',
    name: 'Restored Citra',
    nameKey: 'citra',
    quantity: 250,
    unit: 'g',
    costPerUnit: 0.5,
    purchaseDate: '2026-01-01',
    expiryDate: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function fullBackupFixture(suffix: string): DatabaseBackup {
  const equipment = equipmentFixture(`eq-${suffix}`, `Rig ${suffix}`);
  const mash = mashProfileFixture(`mash-${suffix}`);
  const ferm = fermentationProfileFixture(`ferm-${suffix}`);
  const water = waterProfileFixture(`wp-${suffix}`);
  const recipe = recipeFixture(`rec-${suffix}`, equipment, mash, ferm, water);
  const batch = batchFixture(`batch-${suffix}`, recipe.id, recipe);
  const inventoryItem = inventoryItemFixture(`inv-${suffix}`);

  return {
    schemaVersion: 1,
    exportedAt: '2026-08-30T00:00:00.000Z',
    appVersion: '1.2.3',
    data: {
      recipes: [recipe],
      batches: [batch],
      equipmentProfiles: [equipment],
      mashProfiles: [mash],
      fermentationProfiles: [ferm],
      waterProfiles: [water],
      inventoryItems: [inventoryItem],
      config: { id: 'default', unitSystem: 'us', gravityUnit: 'plato', temperatureUnit: 'fahrenheit', ibuFormula: 'rager', abvFormula: 'balling' },
    },
  };
}

function emptyBackup(): DatabaseBackup {
  return {
    schemaVersion: 1,
    exportedAt: '2026-08-30T00:00:00.000Z',
    appVersion: '1.0.0',
    data: {
      recipes: [],
      batches: [],
      equipmentProfiles: [],
      mashProfiles: [],
      fermentationProfiles: [],
      waterProfiles: [],
      inventoryItems: [],
      config: { id: 'default', unitSystem: 'metric', gravityUnit: 'sg', temperatureUnit: 'celsius', ibuFormula: 'tinseth', abvFormula: 'simple' },
    },
  };
}

describe('M36_P2: POST /api/backup/restore', () => {
  describe('AC-2: route registration', () => {
    it('the route exists and returns something other than 404 for a well-formed request', async () => {
      setupUnseeded();
      const res = await restore({ backup: emptyBackup(), mode: 'replace' } satisfies RestoreRequest);
      expect(res.statusCode).not.toBe(404);
    });
  });

  describe('AC-3: replace mode wipes existing data and inserts backup entities verbatim', () => {
    it('after a replace restore, only the backup entities exist, with their original ids', async () => {
      setupSeeded();
      const backup = fullBackupFixture('a');

      const res = await restore({ backup, mode: 'replace' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);
      const summary = res.json() as RestoreSummary;
      expect(summary.mode).toBe('replace');
      expect(summary.counts).toEqual({
        recipes: 1,
        batches: 1,
        equipmentProfiles: 1,
        mashProfiles: 1,
        fermentationProfiles: 1,
        waterProfiles: 1,
        inventoryItems: 1,
      });

      // Every seeded row is gone.
      expect(count('recipes')).toBe(1);
      expect(count('equipment_profiles')).toBe(1);
      expect(row('SELECT id FROM equipment_profiles')).toEqual({ id: 'eq-a' });
      expect(row("SELECT id FROM recipes WHERE id = 'rec-sample-1'")).toBeUndefined();
    });
  });

  describe('AC-4: merge mode preserves existing rows and remaps colliding incoming ids', () => {
    it('an incoming equipment profile colliding by id with an existing row is inserted under a fresh id; the original is untouched', async () => {
      setupSeeded();
      const backup = fullBackupFixture('b');
      backup.data.equipmentProfiles[0] = { ...backup.data.equipmentProfiles[0], id: 'eq-1', name: 'Incoming Duplicate Rig' };
      // Keep the recipe's embedded equipment reference in sync with the collision above.
      backup.data.recipes[0] = { ...backup.data.recipes[0], equipment: backup.data.equipmentProfiles[0] };

      const res = await restore({ backup, mode: 'merge' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);

      const equipmentRows = rows<{ id: string; name: string }>('SELECT id, name FROM equipment_profiles ORDER BY name');
      // 2 seeded + 1 incoming (remapped) = 3.
      expect(equipmentRows).toHaveLength(3);

      const original = equipmentRows.find((r) => r.id === 'eq-1')!;
      expect(original.name).toBe('All-Grain 20L System');

      const incoming = equipmentRows.find((r) => r.name === 'Incoming Duplicate Rig')!;
      expect(incoming).toBeDefined();
      expect(incoming.id).not.toBe('eq-1');

      // The restored recipe's FK follows the remapped equipment id, not the collided original.
      const recipeRow = row<{ equipment_id: string }>("SELECT equipment_id FROM recipes WHERE id = 'rec-b'")!;
      expect(recipeRow.equipment_id).toBe(incoming.id);
    });

    it('a non-colliding merge is purely additive: existing seeded rows are untouched and counted alongside the new ones', async () => {
      setupSeeded();
      const backup = fullBackupFixture('c');

      const beforeRecipeCount = count('recipes');
      const beforeEquipmentCount = count('equipment_profiles');

      const res = await restore({ backup, mode: 'merge' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);

      expect(count('recipes')).toBe(beforeRecipeCount + 1);
      expect(count('equipment_profiles')).toBe(beforeEquipmentCount + 1);
      expect(row('SELECT id FROM recipes WHERE id = ?', 'rec-sample-1')).toBeDefined();
      expect(row('SELECT id FROM equipment_profiles WHERE id = ?', 'eq-c')).toBeDefined();
    });
  });

  describe('AC-5: atomic rollback on a genuine DB constraint failure', () => {
    it('a batch referencing a non-existent recipeId fails the FK constraint mid-transaction and rolls back everything, including a replace-mode wipe', async () => {
      setupSeeded();

      const beforeRecipeCount = count('recipes');
      const beforeEquipmentCount = count('equipment_profiles');
      const beforeRecipeName = row<{ name: string }>("SELECT name FROM recipes WHERE id = 'rec-sample-1'")?.name;
      expect(beforeRecipeCount).toBeGreaterThan(0);
      expect(beforeRecipeName).toBeDefined();

      const broken = emptyBackup();
      broken.data.batches = [
        {
          ...batchFixture('batch-broken', 'recipe-does-not-exist', recipeFixture('rec-broken', equipmentFixture('eq-broken', 'x'), mashProfileFixture('mash-broken'), fermentationProfileFixture('ferm-broken'), waterProfileFixture('wp-broken'))),
        },
      ];
      // No recipes are included in this backup at all — batches[0].recipeId dangles.

      const res = await restore({ backup: broken, mode: 'replace' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(500);
      expect(res.json().error.code).toBe('INTERNAL');

      // Rollback proof: the replace-mode wipe (which runs BEFORE the failing
      // batch insert, in the SAME transaction) never persisted either —
      // every seeded row is still there, not just "some rows survived".
      expect(count('recipes')).toBe(beforeRecipeCount);
      expect(count('equipment_profiles')).toBe(beforeEquipmentCount);
      expect(row<{ name: string }>("SELECT name FROM recipes WHERE id = 'rec-sample-1'")?.name).toBe(beforeRecipeName);

      // And no broken batch row leaked through.
      expect(row("SELECT id FROM batches WHERE id = 'batch-broken'")).toBeUndefined();
    });

    it('the same induced failure in merge mode leaves the pre-existing data untouched too', async () => {
      setupSeeded();
      const beforeRecipeCount = count('recipes');

      const broken = emptyBackup();
      broken.data.batches = [
        {
          ...batchFixture('batch-broken-2', 'recipe-does-not-exist-either', recipeFixture('rec-broken-2', equipmentFixture('eq-broken-2', 'x'), mashProfileFixture('mash-broken-2'), fermentationProfileFixture('ferm-broken-2'), waterProfileFixture('wp-broken-2'))),
        },
      ];

      const res = await restore({ backup: broken, mode: 'merge' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(500);
      expect(count('recipes')).toBe(beforeRecipeCount);
      expect(row("SELECT id FROM batches WHERE id = 'batch-broken-2'")).toBeUndefined();
    });
  });

  describe('AC-6: recipe line items keep intact FK references after restore', () => {
    it('replace-restores a recipe with its fermentables, hops, yeasts, and miscs all linked to the new recipe row', async () => {
      setupUnseeded();
      const backup = fullBackupFixture('d');

      const res = await restore({ backup, mode: 'replace' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);

      expect(rows("SELECT * FROM recipe_fermentables WHERE recipe_id = 'rec-d'")).toHaveLength(1);
      expect(rows("SELECT * FROM recipe_hops WHERE recipe_id = 'rec-d'")).toHaveLength(1);
      expect(rows("SELECT * FROM recipe_yeasts WHERE recipe_id = 'rec-d'")).toHaveLength(1);
      expect(rows("SELECT * FROM recipe_miscs WHERE recipe_id = 'rec-d'")).toHaveLength(1);

      const fermRow = row<{ name: string; amount_kg: number }>("SELECT name, amount_kg FROM recipe_fermentables WHERE recipe_id = 'rec-d'")!;
      expect(fermRow.name).toBe('Pale Malt');
      expect(fermRow.amount_kg).toBe(5);
    });
  });

  describe('AC-7: batch readings/notes and recipe snapshot survive restore', () => {
    it('replace-restores a batch with its reading, note, and frozen recipe snapshot intact', async () => {
      setupUnseeded();
      const backup = fullBackupFixture('e');

      const res = await restore({ backup, mode: 'replace' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);

      expect(rows("SELECT * FROM batch_readings WHERE batch_id = 'batch-e'")).toHaveLength(1);
      expect(rows("SELECT * FROM batch_notes WHERE batch_id = 'batch-e'")).toHaveLength(1);

      const readingRow = row<{ comment: string }>("SELECT comment FROM batch_readings WHERE batch_id = 'batch-e'")!;
      expect(readingRow.comment).toBe('Ticking along');

      const batchRow = row<{ recipe_snapshot: string; recipe_id: string }>("SELECT recipe_snapshot, recipe_id FROM batches WHERE id = 'batch-e'")!;
      expect(batchRow.recipe_id).toBe('rec-e');
      const snapshot = JSON.parse(batchRow.recipe_snapshot);
      expect(snapshot.name).toBe('Restored IPA');
    });
  });

  describe('AC-8: mash/fermentation profiles keep ordered steps after restore', () => {
    it('restored steps keep canonical position order (0, 1, ...) and retain their timing fields', async () => {
      setupUnseeded();
      const backup = fullBackupFixture('f');

      const res = await restore({ backup, mode: 'replace' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);

      const mashStepRows = rows<{ name: string; position: number }>("SELECT name, position FROM mash_steps WHERE mash_profile_id = 'mash-f' ORDER BY position");
      expect(mashStepRows.map((s) => s.name)).toEqual(['Acid Rest', 'Sacc Rest']);
      expect(mashStepRows.map((s) => s.position)).toEqual([0, 1]);

      const fermStepRows = rows<{ name: string; position: number }>("SELECT name, position FROM fermentation_steps WHERE fermentation_profile_id = 'ferm-f' ORDER BY position");
      expect(fermStepRows.map((s) => s.name)).toEqual(['Primary', 'Cold Crash']);
    });
  });

  describe('AC-9: inventory and water profile restore keeps quantities and ion concentrations', () => {
    it('restores the inventory item quantity/unit and the water profile ion concentrations verbatim', async () => {
      setupUnseeded();
      const backup = fullBackupFixture('g');

      const res = await restore({ backup, mode: 'replace' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);

      const invRow = row<{ quantity: number; unit: string }>("SELECT quantity, unit FROM inventory_items WHERE id = 'inv-g'")!;
      expect(invRow.quantity).toBe(250);
      expect(invRow.unit).toBe('g');

      const waterRow = row<{ calcium: number; sulfate: number }>("SELECT calcium, sulfate FROM water_profiles WHERE id = 'wp-g'")!;
      expect(waterRow.calcium).toBe(50);
      expect(waterRow.sulfate).toBe(40);
    });
  });

  describe('AC-10: user config is updated from the backup', () => {
    it('replace mode writes the backup config over the seeded default', async () => {
      setupSeeded();
      const backup = fullBackupFixture('h');

      const res = await restore({ backup, mode: 'replace' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);

      const configRow = row<{ unit_system: string; gravity_unit: string; ibu_formula: string }>("SELECT unit_system, gravity_unit, ibu_formula FROM user_config WHERE id = 'default'")!;
      expect(configRow.unit_system).toBe('us');
      expect(configRow.gravity_unit).toBe('plato');
      expect(configRow.ibu_formula).toBe('rager');
    });

    it('merge mode also updates the singleton config row rather than leaving the pre-existing default in place', async () => {
      setupSeeded();
      const backup = fullBackupFixture('i');

      const res = await restore({ backup, mode: 'merge' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);
      expect(count('user_config')).toBe(1);

      const configRow = row<{ abv_formula: string }>("SELECT abv_formula FROM user_config WHERE id = 'default'")!;
      expect(configRow.abv_formula).toBe('balling');
    });

    it('restoring into a completely empty database still upserts the config row (no pre-existing row to update)', async () => {
      setupUnseeded();
      const backup = fullBackupFixture('j');

      const res = await restore({ backup, mode: 'merge' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);
      expect(count('user_config')).toBe(1);
    });
  });

  describe('AC-11: invalid schemaVersion / malformed payload rejection', () => {
    it('rejects a backup with schemaVersion !== 1 with 400 VALIDATION_FAILED', async () => {
      setupUnseeded();
      const res = await restore({ backup: { ...emptyBackup(), schemaVersion: 2 }, mode: 'replace' });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects a payload missing the data envelope entirely with 400', async () => {
      setupUnseeded();
      const res = await restore({ backup: { schemaVersion: 1, exportedAt: 'x', appVersion: '1.0.0' }, mode: 'replace' });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a payload whose data is missing one of the 8 required entity-family keys with 400', async () => {
      setupUnseeded();
      const incomplete = emptyBackup();
      delete (incomplete.data as Record<string, unknown>).inventoryItems;
      const res = await restore({ backup: incomplete, mode: 'replace' });
      expect(res.statusCode).toBe(400);
    });

    it('rejects an unrecognized mode value with 400', async () => {
      setupUnseeded();
      const res = await restore({ backup: emptyBackup(), mode: 'wipe' });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a body missing the mode key entirely with 400', async () => {
      setupUnseeded();
      const res = await restore({ backup: emptyBackup() });
      expect(res.statusCode).toBe(400);
    });

    it('leaves existing data completely untouched when the payload is rejected', async () => {
      setupSeeded();
      const before = count('recipes');
      await restore({ backup: { ...emptyBackup(), schemaVersion: 2 }, mode: 'replace' });
      expect(count('recipes')).toBe(before);
    });
  });

  describe('RestoreSummary shape', () => {
    it('returns restoredAt as a valid ISO 8601 UTC timestamp alongside mode and counts', async () => {
      setupUnseeded();
      const res = await restore({ backup: emptyBackup(), mode: 'merge' } satisfies RestoreRequest);
      expect(res.statusCode).toBe(200);
      const summary = res.json() as RestoreSummary;
      expect(new Date(summary.restoredAt).toISOString()).toBe(summary.restoredAt);
      expect(summary.mode).toBe('merge');
      expect(summary.counts).toEqual({
        recipes: 0,
        batches: 0,
        equipmentProfiles: 0,
        mashProfiles: 0,
        fermentationProfiles: 0,
        waterProfiles: 0,
        inventoryItems: 0,
      });
    });
  });
});

describe('M38_P1 AC-19/RA-5: folder and tags survive restore', () => {
  it('restoring a pre-M38_P1 backup (recipeFixture never sets folder/tags) leaves the restored row as folder: null, tags: [] — restore never fails on an old backup', async () => {
    setupUnseeded();
    // `fullBackupFixture` above (M36_P2's own fixture, unmodified by this
    // phase) builds a `StoredRecipe` literal that never sets folder/tags —
    // exactly what a real backup exported before M38_P1 existed looks like.
    const backup = fullBackupFixture('legacy');

    const res = await restore({ backup, mode: 'replace' } satisfies RestoreRequest);
    expect(res.statusCode).toBe(200);

    const recipeRow = row<{ folder: string | null; tags: string }>("SELECT folder, tags FROM recipes WHERE id = 'rec-legacy'")!;
    expect(recipeRow.folder).toBeNull();
    expect(JSON.parse(recipeRow.tags)).toEqual([]);
  });

  it('restoring a backup whose recipe DOES carry folder/tags preserves them exactly', async () => {
    setupUnseeded();
    const backup = fullBackupFixture('tagged');
    backup.data.recipes[0] = { ...backup.data.recipes[0], folder: 'Barrel Aged', tags: ['Funky', 'Sour'] };

    const res = await restore({ backup, mode: 'replace' } satisfies RestoreRequest);
    expect(res.statusCode).toBe(200);

    const recipeRow = row<{ folder: string | null; tags: string }>("SELECT folder, tags FROM recipes WHERE id = 'rec-tagged'")!;
    expect(recipeRow.folder).toBe('Barrel Aged');
    expect(JSON.parse(recipeRow.tags)).toEqual(['Funky', 'Sour']);
  });

  it('a subsequent GET /api/recipes/:id after restore returns the preserved folder/tags through the normal read path', async () => {
    setupUnseeded();
    const backup = fullBackupFixture('readback');
    backup.data.recipes[0] = { ...backup.data.recipes[0], folder: 'IPAs', tags: ['Hazy'] };

    await restore({ backup, mode: 'replace' } satisfies RestoreRequest);

    const res = await app.inject({ method: 'GET', url: '/api/recipes/rec-readback' });
    expect(res.statusCode).toBe(200);
    const fetched = res.json() as StoredRecipe;
    expect(fetched.folder).toBe('IPAs');
    expect(fetched.tags).toEqual(['Hazy']);
  });
});
