import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DatabaseBackup, InventoryWriteInput } from '@truchabrew/shared-types';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';

let handle: TestDbHandle;
let app: FastifyInstance;

afterEach(async () => {
  await app?.close();
  handle?.cleanup();
});

function setupUnseeded(): void {
  handle = createTestDb();
  app = buildServer({ db: handle.db });
}

function setupSeeded(): void {
  handle = createTestDb();
  seedDatabase(handle.db);
  app = buildServer({ db: handle.db });
}

async function getExport() {
  return app.inject({ method: 'GET', url: '/api/backup/export' });
}

describe('M36_P1: GET /api/backup/export', () => {
  describe('AC-2: route registration & envelope shape', () => {
    it('responds 200 with Content-Type application/json and a filename-attached Content-Disposition header', async () => {
      setupSeeded();
      const res = await getExport();
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-disposition']).toMatch(/^attachment; filename="truchabrew_backup_\d{4}-\d{2}-\d{2}\.json"$/);
    });

    it('schemaVersion is the literal 1, exportedAt is a valid ISO 8601 UTC timestamp, appVersion is a non-empty string', async () => {
      setupSeeded();
      const body = (await getExport()).json() as DatabaseBackup;
      expect(body.schemaVersion).toBe(1);
      expect(new Date(body.exportedAt).toISOString()).toBe(body.exportedAt);
      expect(typeof body.appVersion).toBe('string');
      expect(body.appVersion.length).toBeGreaterThan(0);
    });

    it('the 8 entity families are nested under data, not top-level siblings of schemaVersion (RA-1)', async () => {
      setupSeeded();
      const body = (await getExport()).json() as Record<string, unknown>;
      expect(body.recipes).toBeUndefined();
      expect(body.batches).toBeUndefined();
      expect(body.config).toBeUndefined();
      const data = body.data as Record<string, unknown>;
      expect(Object.keys(data).sort()).toEqual(
        ['batches', 'config', 'equipmentProfiles', 'fermentationProfiles', 'inventoryItems', 'mashProfiles', 'recipes', 'waterProfiles'].sort(),
      );
    });
  });

  describe('AC-3: recipe integrity — full line items', () => {
    it('includes the seeded recipe with all fermentables, hops, and yeasts, and 0 miscs', async () => {
      setupSeeded();
      const body = (await getExport()).json() as DatabaseBackup;
      expect(body.data.recipes).toHaveLength(1);
      const recipe = body.data.recipes[0];
      expect(recipe.id).toBe('rec-sample-1');
      expect(recipe.name).toBe('Trucha West Coast IPA');
      expect(recipe.fermentables).toHaveLength(3);
      expect(recipe.hops).toHaveLength(4);
      expect(recipe.yeasts).toHaveLength(1);
      expect(recipe.miscs).toHaveLength(0);
      expect(recipe.fermentables.map((f) => f.name)).toEqual(
        expect.arrayContaining(['Pale Ale Malt (2-Row)', 'Munich Malt (10 SRM)', 'Caramalt / Crystal 40']),
      );
      expect(recipe.createdAt).toBeTruthy();
      expect(recipe.updatedAt).toBeTruthy();
    });
  });

  describe('AC-4: batch integrity — readings, notes, and snapshot', () => {
    it('includes a created batch with its reading and note attached', async () => {
      setupSeeded();

      const createRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: 'rec-sample-1' } });
      expect(createRes.statusCode).toBe(201);
      const batchId = createRes.json().id as string;

      const readingRes = await app.inject({
        method: 'POST',
        url: `/api/batches/${batchId}/readings`,
        payload: { readingTime: '2026-08-30T10:00:00.000Z', sg: 1.05, tempC: 20, comment: 'OG reading', ph: null, pressurePsi: null },
      });
      expect(readingRes.statusCode).toBe(201);

      const noteRes = await app.inject({
        method: 'POST',
        url: `/api/batches/${batchId}/notes`,
        payload: { note: 'Smells great' },
      });
      expect(noteRes.statusCode).toBe(201);

      const body = (await getExport()).json() as DatabaseBackup;
      expect(body.data.batches).toHaveLength(1);
      const batch = body.data.batches[0];
      expect(batch.id).toBe(batchId);
      expect(batch.recipeSnapshot).toBeTruthy();
      expect(batch.readings).toHaveLength(1);
      expect(batch.readings[0].comment).toBe('OG reading');
      expect(batch.notes).toHaveLength(1);
      expect(batch.notes[0].note).toBe('Smells great');
    });
  });

  describe('AC-5: equipment profile integrity — physical loss and physics fields', () => {
    it('includes both seeded equipment profiles with their physics and loss fields intact', async () => {
      setupSeeded();
      const body = (await getExport()).json() as DatabaseBackup;
      expect(body.data.equipmentProfiles).toHaveLength(2);
      const eq1 = body.data.equipmentProfiles.find((e) => e.id === 'eq-1')!;
      expect(eq1).toBeDefined();
      expect(eq1.boilOffRateLPerHour).toBe(3.5);
      expect(eq1.trubChillerLossL).toBe(2.0);
      expect(eq1.mashWaterRatioLPerKg).toBe(3.0);
      expect(eq1.grainAbsorptionLPerKg).toBe(0.96);
      expect(eq1.hopstandUtilizationFactor).toBe(0.26);
      expect(eq1.hopstandTemperatureC).toBe(79.0);
      expect(eq1.spargeTemperatureC).toBe(76.0);
      expect(eq1.grainTemperatureC).toBe(20.0);
    });
  });

  describe('AC-6: mash profile integrity — ordered steps', () => {
    it('includes both seeded mash profiles, with the 3-step profile in canonical order', async () => {
      setupSeeded();
      const body = (await getExport()).json() as DatabaseBackup;
      expect(body.data.mashProfiles).toHaveLength(2);
      const mash2 = body.data.mashProfiles.find((m) => m.id === 'mash-2')!;
      expect(mash2).toBeDefined();
      expect(mash2.steps.map((s) => s.name)).toEqual(['Acid Rest', 'Saccharification Rest', 'Mash Out']);
    });
  });

  describe('AC-7: fermentation profile integrity — ordered steps', () => {
    it('includes the seeded fermentation profile with steps in canonical order', async () => {
      setupSeeded();
      const body = (await getExport()).json() as DatabaseBackup;
      expect(body.data.fermentationProfiles).toHaveLength(1);
      const ferm1 = body.data.fermentationProfiles[0];
      expect(ferm1.id).toBe('ferm-1');
      expect(ferm1.steps.map((s) => s.name)).toEqual(['Primary', 'Cold Crash', 'Conditioning']);
    });
  });

  describe('AC-8: water profile integrity — ion concentrations', () => {
    it('includes all 5 seeded water profiles with cation/anion fields intact', async () => {
      setupSeeded();
      const body = (await getExport()).json() as DatabaseBackup;
      expect(body.data.waterProfiles).toHaveLength(5);
      const tap = body.data.waterProfiles.find((w) => w.id === 'wp-src-tap')!;
      expect(tap).toBeDefined();
      expect(tap.calcium).toBe(50);
      expect(tap.magnesium).toBe(10);
      expect(tap.sodium).toBe(20);
      expect(tap.chloride).toBe(30);
      expect(tap.sulfate).toBe(40);
      expect(tap.bicarbonate).toBe(120);
    });
  });

  describe('AC-9: inventory integrity — quantities, units, categories', () => {
    it('includes a created inventory item with its category, unit, and on-hand quantity', async () => {
      setupSeeded();
      const input: InventoryWriteInput = {
        category: 'Hop',
        name: 'Citra',
        quantity: 2,
        unit: 'g',
        costPerUnit: 0.5,
        purchaseDate: '2026-08-01',
        expiryDate: null,
        notes: '',
      };
      const createRes = await app.inject({ method: 'POST', url: '/api/inventory', payload: input });
      expect(createRes.statusCode).toBe(201);

      const body = (await getExport()).json() as DatabaseBackup;
      expect(body.data.inventoryItems).toHaveLength(1);
      const item = body.data.inventoryItems[0];
      expect(item.category).toBe('Hop');
      expect(item.unit).toBe('g');
      expect(item.quantity).toBe(2);
    });
  });

  describe('AC-10: config integrity', () => {
    it('exports the current UserConfig, including unit system, gravity/temperature display, and formulas', async () => {
      setupSeeded();
      const body = (await getExport()).json() as DatabaseBackup;
      expect(body.data.config).toEqual({
        id: 'default',
        unitSystem: 'metric',
        gravityUnit: 'sg',
        temperatureUnit: 'celsius',
        ibuFormula: 'tinseth',
        abvFormula: 'simple',
      });
    });

    it('reflects a config update made before the export, not a stale/cached value', async () => {
      setupSeeded();
      const putRes = await app.inject({ method: 'PUT', url: '/api/config', payload: { temperatureUnit: 'fahrenheit' } });
      expect(putRes.statusCode).toBe(200);

      const body = (await getExport()).json() as DatabaseBackup;
      expect(body.data.config.temperatureUnit).toBe('fahrenheit');
    });
  });

  describe('AC-11: empty database export', () => {
    it('an unseeded (empty) database returns 200 with empty arrays and the default config, not null or 500', async () => {
      setupUnseeded();
      const res = await getExport();
      expect(res.statusCode).toBe(200);

      const body = res.json() as DatabaseBackup;
      expect(body.data.recipes).toEqual([]);
      expect(body.data.batches).toEqual([]);
      expect(body.data.equipmentProfiles).toEqual([]);
      expect(body.data.mashProfiles).toEqual([]);
      expect(body.data.fermentationProfiles).toEqual([]);
      expect(body.data.waterProfiles).toEqual([]);
      expect(body.data.inventoryItems).toEqual([]);
      expect(body.data.config).toEqual({
        id: 'default',
        unitSystem: 'metric',
        gravityUnit: 'sg',
        temperatureUnit: 'celsius',
        ibuFormula: 'tinseth',
        abvFormula: 'simple',
      });
      expect(body.schemaVersion).toBe(1);
    });

    it('still returns 200 with a default config even if the user_config row itself is deleted out of band', async () => {
      setupUnseeded();
      handle.db.$client.prepare("DELETE FROM user_config WHERE id = 'default'").run();

      const res = await getExport();
      expect(res.statusCode).toBe(200);
      expect((res.json() as DatabaseBackup).data.config).toEqual({
        id: 'default',
        unitSystem: 'metric',
        gravityUnit: 'sg',
        temperatureUnit: 'celsius',
        ibuFormula: 'tinseth',
        abvFormula: 'simple',
      });

      // RA-2: falling back to the in-memory default must NOT self-heal by
      // inserting a row — unlike GET /api/config's own self-heal, this route
      // never mutates state.
      const row = handle.db.$client.prepare("SELECT * FROM user_config WHERE id = 'default'").get();
      expect(row).toBeUndefined();
    });
  });

  describe('RA-2: read-only export safety', () => {
    it('does not alter database state — row counts and timestamps are unchanged after export', async () => {
      setupSeeded();
      const before = handle.db.$client.prepare('SELECT COUNT(*) as n FROM recipes').get() as { n: number };
      const beforeRecipeUpdatedAt = handle.db.$client.prepare("SELECT updated_at FROM recipes WHERE id = 'rec-sample-1'").get() as {
        updated_at: string;
      };

      await getExport();
      await getExport();

      const after = handle.db.$client.prepare('SELECT COUNT(*) as n FROM recipes').get() as { n: number };
      const afterRecipeUpdatedAt = handle.db.$client.prepare("SELECT updated_at FROM recipes WHERE id = 'rec-sample-1'").get() as {
        updated_at: string;
      };
      expect(after.n).toBe(before.n);
      expect(afterRecipeUpdatedAt.updated_at).toBe(beforeRecipeUpdatedAt.updated_at);
    });
  });
});
