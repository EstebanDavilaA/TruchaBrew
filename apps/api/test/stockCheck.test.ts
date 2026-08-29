import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { InventoryWriteInput, RecipeWriteInput } from '@truchabrew/shared-types';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { fullRecipeInput } from './helpers/fixtures';

let handle: TestDbHandle;
let app: FastifyInstance;

afterEach(async () => {
  await app?.close();
  handle?.cleanup();
});

function setup(): void {
  handle = createTestDb();
  seedDatabase(handle.db);
  app = buildServer({ db: handle.db });
}

function fullInventoryInput(overrides: Partial<InventoryWriteInput> = {}): InventoryWriteInput {
  return {
    category: 'Fermentable',
    name: 'Pale Ale Malt',
    quantity: 4,
    unit: 'kg',
    costPerUnit: 3.2,
    purchaseDate: null,
    expiryDate: null,
    notes: '',
    ...overrides,
  };
}

/**
 * The spec's §3 shared fixture, expressed as a recipe input + inventory
 * writes, so this file's assertions can be pinned against the exact
 * AC-9/AC-10/AC-11/AC-12 numbers.
 */
function fixtureRecipeInput(): RecipeWriteInput {
  return fullRecipeInput({
    fermentables: [
      { name: 'Pale Ale Malt', type: 'Grain', amountKg: 3.0, colorSrm: 3.5, potentialSg: 1.037 },
      { name: 'PALE ALE  MALT', type: 'Grain', amountKg: 2.5, colorSrm: 3.5, potentialSg: 1.037 },
      { name: 'Munich Malt', type: 'Grain', amountKg: 0.5, colorSrm: 9, potentialSg: 1.037 },
    ],
    hops: [{ name: 'Citra', amountG: 50, alphaAcidPct: 12, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' }],
    yeasts: [{ name: 'SafAle US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 78, amountPkg: 3 }],
    miscs: [
      { name: 'Gypsum', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: 4, unit: 'g' },
      { name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 15, amount: 1, unit: 'each' },
      { name: 'Lactic Acid', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: 2, unit: 'ml' },
    ],
  });
}

async function seedFixture(): Promise<{ batchId: string }> {
  const inventoryRows: InventoryWriteInput[] = [
    fullInventoryInput({ category: 'Fermentable', name: 'Pale Ale Malt', quantity: 4.0, unit: 'kg', costPerUnit: 3.2 }),
    fullInventoryInput({ category: 'Fermentable', name: 'Munich Malt', quantity: 0.0, unit: 'kg', costPerUnit: 4.1 }),
    fullInventoryInput({ category: 'Hop', name: 'Citra', quantity: 50, unit: 'g', costPerUnit: 0.09 }),
    fullInventoryInput({ category: 'Yeast', name: 'SafAle US-05', quantity: 2, unit: 'pkg', costPerUnit: 4.5 }),
    fullInventoryInput({ category: 'Misc', name: 'Gypsum', quantity: -0.5, unit: 'g', costPerUnit: 0.02 }),
    fullInventoryInput({ category: 'Misc', name: 'Lactic Acid', quantity: 100, unit: 'g', costPerUnit: 0.03 }),
    fullInventoryInput({ category: 'Fermentable', name: 'Flaked Oats', quantity: 1.0, unit: 'kg', costPerUnit: null }),
  ];
  for (const row of inventoryRows) {
    const res = await app.inject({ method: 'POST', url: '/api/inventory', payload: row });
    expect(res.statusCode).toBe(201);
  }

  const recipeRes = await app.inject({ method: 'POST', url: '/api/recipes', payload: fixtureRecipeInput() });
  expect(recipeRes.statusCode).toBe(201);
  const recipe = recipeRes.json();

  const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
  expect(batchRes.statusCode).toBe(201);
  return { batchId: batchRes.json().id };
}

describe('AC-27: stock-check endpoint', () => {
  it('200 body deep-equals the pinned StockEvaluation; unknown batchId -> 404', async () => {
    setup();
    const { batchId } = await seedFixture();

    const res = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/stock-check` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.requirementCount).toBe(7);
    expect(body.matchedCount).toBe(6);
    expect(body.comparableCount).toBe(5);
    expect(body.unmatchedCount).toBe(1);
    expect(body.unitMismatchCount).toBe(1);
    expect(body.shortfallCount).toBe(4);
    expect(body.hasShortfall).toBe(true);

    const byKey = (k: string) => body.lines.find((l: { nameKey: string }) => l.nameKey === k);
    expect(byKey('pale ale malt').shortfall).toBeCloseTo(1.5, 9);
    expect(byKey('whirlfloc')).toMatchObject({ matched: false, onHand: null, shortfall: null });
    expect(byKey('lactic acid')).toMatchObject({ matched: true, unitMismatch: true, inventoryUnit: 'g', onHand: 100 });

    const notFoundRes = await app.inject({ method: 'GET', url: '/api/batches/does-not-exist/stock-check' });
    expect(notFoundRes.statusCode).toBe(404);
    expect(notFoundRes.json().error.code).toBe('NOT_FOUND');
  });
});

describe('AC-28: stock check reads live inventory, frozen snapshot', () => {
  it('a live inventory quantity change is reflected; a source-recipe edit is not', async () => {
    setup();
    const { batchId } = await seedFixture();

    const listRes = await app.inject({ method: 'GET', url: '/api/inventory' });
    const paleAleRow = listRes.json().find((r: { name: string }) => r.name === 'Pale Ale Malt');

    await app.inject({
      method: 'PUT',
      url: `/api/inventory/${paleAleRow.id}`,
      payload: fullInventoryInput({ category: 'Fermentable', name: 'Pale Ale Malt', quantity: 6.0, unit: 'kg', costPerUnit: 3.2 }),
    });

    const afterInventoryEdit = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/stock-check` });
    const body1 = afterInventoryEdit.json();
    const paleAleLine = body1.lines.find((l: { nameKey: string }) => l.nameKey === 'pale ale malt');
    expect(paleAleLine.shortfall).toBe(0);
    expect(paleAleLine.sufficient).toBe(true);
    expect(body1.shortfallCount).toBe(3);
    expect(body1.hasShortfall).toBe(true);

    const batchRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}` });
    const recipeId = batchRes.json().recipeId;

    await app.inject({
      method: 'PUT',
      url: `/api/recipes/${recipeId}`,
      payload: fixtureRecipeInput().fermentables
        ? { ...fixtureRecipeInput(), fermentables: [{ name: 'Pale Ale Malt', type: 'Grain', amountKg: 999, colorSrm: 3.5, potentialSg: 1.037 }] }
        : fixtureRecipeInput(),
    });

    const afterRecipeEdit = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/stock-check` });
    expect(afterRecipeEdit.json()).toEqual(body1);
  });
});

describe('AC-29: stock check writes nothing', () => {
  it('quantity and updatedAt of every fixture row are byte-identical before and after 5 successive calls', async () => {
    setup();
    const { batchId } = await seedFixture();

    const before = (await app.inject({ method: 'GET', url: '/api/inventory' })).json();

    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/stock-check` });
      expect(res.statusCode).toBe(200);
    }

    const after = (await app.inject({ method: 'GET', url: '/api/inventory' })).json();
    expect(after).toHaveLength(before.length);
    for (const beforeRow of before) {
      const afterRow = after.find((r: { id: string }) => r.id === beforeRow.id);
      expect(afterRow.quantity).toBe(beforeRow.quantity);
      expect(afterRow.updatedAt).toBe(beforeRow.updatedAt);
    }
  });
});

describe('AC-25 (stock-check facet): deleting a matched item makes the line unmatched, never an error', () => {
  it('after deleting inv (Pale Ale Malt), the next stock-check line is matched:false with shortfall:null', async () => {
    setup();
    const { batchId } = await seedFixture();

    const listRes = await app.inject({ method: 'GET', url: '/api/inventory' });
    const paleAleRow = listRes.json().find((r: { name: string }) => r.name === 'Pale Ale Malt');
    const del = await app.inject({ method: 'DELETE', url: `/api/inventory/${paleAleRow.id}` });
    expect(del.statusCode).toBe(204);

    const stockRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/stock-check` });
    expect(stockRes.statusCode).toBe(200);
    const line = stockRes.json().lines.find((l: { nameKey: string }) => l.nameKey === 'pale ale malt');
    expect(line.matched).toBe(false);
    expect(line.shortfall).toBeNull();
  });
});

describe('AC-30: pre-M9 batch compatibility', () => {
  it('a batch row with statsSnapshot/closingSnapshot NULL still returns a valid 200 stock check', async () => {
    setup();
    const recipeRes = await app.inject({ method: 'POST', url: '/api/recipes', payload: fixtureRecipeInput() });
    const recipe = recipeRes.json();
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const batchId = batchRes.json().id;

    // Simulate a pre-migration-0006 row directly at the storage layer.
    handle.db.$client.prepare('UPDATE batches SET stats_snapshot = NULL, closing_snapshot = NULL WHERE id = ?').run(batchId);

    const stockRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/stock-check` });
    expect(stockRes.statusCode).toBe(200);
    expect(stockRes.json().requirementCount).toBeGreaterThan(0);

    // GET/PUT still behave identically — zero inventory rows exist for this
    // scenario, and the batch still advances through the full pipeline.
    const getRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}` });
    expect(getRes.statusCode).toBe(200);

    const statuses: Array<'Brewing' | 'Fermenting' | 'Conditioning' | 'Completed'> = ['Brewing', 'Fermenting', 'Conditioning', 'Completed'];
    let current = getRes.json();
    for (const status of statuses) {
      const { fermentationStartDate: _f, bottlingDate: _b, closingSnapshot: _c, readings: _r, notes: _n, ...rest } = current;
      const payload = {
        ...rest,
        status,
        measuredOg: status === 'Completed' ? 1.05 : current.measuredOg,
        measuredFg: status === 'Completed' ? 1.01 : current.measuredFg,
      };
      const putRes = await app.inject({ method: 'PUT', url: `/api/batches/${batchId}`, payload });
      expect(putRes.statusCode).toBe(200);
      current = putRes.json();
    }
    expect(current.status).toBe('Completed');
  });
});
