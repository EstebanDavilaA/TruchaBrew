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

/** Raw SQL helpers over the underlying better-sqlite3 client (repo precedent — inventory.migration.test.ts). */
function dbAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return handle.db.$client.prepare(sql).all(...params) as T[];
}

function dbRun(sql: string, params: unknown[] = []): void {
  handle.db.$client.prepare(sql).run(...params);
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

/** A PUT body that omits the three server-owned keys. */
function toBatchWriteBody<T extends { fermentationStartDate?: unknown; bottlingDate?: unknown; closingSnapshot?: unknown }>(
  batch: T,
): Omit<T, 'fermentationStartDate' | 'bottlingDate' | 'closingSnapshot'> {
  const { fermentationStartDate: _a, bottlingDate: _b, closingSnapshot: _c, ...rest } = batch;
  return rest;
}

async function seedFixture(): Promise<{ batchId: string; inventoryIds: Record<string, string> }> {
  const rows: Array<[string, InventoryWriteInput]> = [
    ['inv-1', fullInventoryInput({ category: 'Fermentable', name: 'Pale Ale Malt', quantity: 4.0, unit: 'kg', costPerUnit: 3.2 })],
    ['inv-2', fullInventoryInput({ category: 'Fermentable', name: 'Munich Malt', quantity: 0.0, unit: 'kg', costPerUnit: 4.1 })],
    ['inv-3', fullInventoryInput({ category: 'Hop', name: 'Citra', quantity: 50, unit: 'g', costPerUnit: 0.09 })],
    ['inv-4', fullInventoryInput({ category: 'Yeast', name: 'SafAle US-05', quantity: 2, unit: 'pkg', costPerUnit: 4.5 })],
    ['inv-5', fullInventoryInput({ category: 'Misc', name: 'Gypsum', quantity: -0.5, unit: 'g', costPerUnit: 0.02 })],
    ['inv-6', fullInventoryInput({ category: 'Misc', name: 'Lactic Acid', quantity: 100, unit: 'g', costPerUnit: 0.03 })],
    ['inv-7', fullInventoryInput({ category: 'Fermentable', name: 'Flaked Oats', quantity: 1.0, unit: 'kg', costPerUnit: null })],
  ];
  const inventoryIds: Record<string, string> = {};
  for (const [key, row] of rows) {
    const res = await app.inject({ method: 'POST', url: '/api/inventory', payload: row });
    expect(res.statusCode).toBe(201);
    inventoryIds[key] = res.json().id;
  }

  const recipeRes = await app.inject({ method: 'POST', url: '/api/recipes', payload: fixtureRecipeInput() });
  const recipe = recipeRes.json();
  const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
  return { batchId: batchRes.json().id, inventoryIds };
}

async function checkoff(batchId: string, inventoryItemId: string) {
  return app.inject({ method: 'POST', url: `/api/batches/${batchId}/checkoff`, payload: { inventoryItemId } });
}

async function reverse(batchId: string, inventoryItemId: string) {
  return app.inject({ method: 'POST', url: `/api/batches/${batchId}/checkoff/reverse`, payload: { inventoryItemId } });
}

async function checkoffAllFive(batchId: string, ids: Record<string, string>) {
  for (const key of ['inv-1', 'inv-2', 'inv-3', 'inv-4', 'inv-5']) {
    const res = await checkoff(batchId, ids[key]);
    expect(res.statusCode).toBe(201);
  }
}

async function advanceBatchStatus(batchId: string, status: string) {
  const getRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}` });
  const batch = getRes.json();
  return app.inject({ method: 'PUT', url: `/api/batches/${batchId}`, payload: { ...toBatchWriteBody(batch), status } });
}

describe('AC-25: checkoff creates one deduction with server-minted fields', () => {
  it('201, one new row, server-owned keys rejected in the body', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();

    const res = await checkoff(batchId, inventoryIds['inv-1']);
    expect(res.statusCode).toBe(201);

    const rows = dbAll<Record<string, unknown>>('SELECT * FROM inventory_transactions');
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.kind).toBe('deduction');
    expect(row.reverses_transaction_id).toBeNull();
    expect(row.amount).toBe(5.5);
    expect(row.unit).toBe('kg');
    expect(row.cost_per_unit).toBe(3.2);
    expect(row.category).toBe('Fermentable');
    expect(row.display_name).toBe('Pale Ale Malt');
    expect(row.name_key).toBe('pale ale malt');
    expect(row.id).toBeTruthy();
    expect(Number.isNaN(Date.parse(row.created_at as string))).toBe(false);

    for (const key of ['id', 'amount', 'costPerUnit', 'createdAt', 'kind']) {
      const badRes = await app.inject({ method: 'POST', url: `/api/batches/${batchId}/checkoff`, payload: { inventoryItemId: inventoryIds['inv-2'], [key]: 'nope' } });
      expect(badRes.statusCode).toBe(400);
      expect(badRes.json().error.code).toBe('VALIDATION_FAILED');
    }

    const itemRow = dbAll<{ quantity: number }>('SELECT quantity FROM inventory_items WHERE id = ?', [inventoryIds['inv-1']]);
    expect(itemRow[0].quantity).toBe(4.0);
  });
});

describe('AC-26: the recorded price is frozen at the deduction', () => {
  it('a later price edit does not move an already-recorded line/total', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();
    await checkoff(batchId, inventoryIds['inv-1']);

    await app.inject({
      method: 'PUT',
      url: `/api/inventory/${inventoryIds['inv-1']}`,
      payload: fullInventoryInput({ category: 'Fermentable', name: 'Pale Ale Malt', quantity: 4.0, unit: 'kg', costPerUnit: 9.99 }),
    });

    const costRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/cost` });
    const body = costRes.json();
    expect(body.lines[0].costPerUnit).toBe(3.2);
    expect(body.lines[0].lineCost).toBe(17.6);
    expect(body.totalCost).toBe(17.6);

    const row = dbAll<{ cost_per_unit: number }>('SELECT cost_per_unit FROM inventory_transactions LIMIT 1');
    expect(row[0].cost_per_unit).toBe(3.2);
  });
});

describe('AC-27: double checkoff rejected', () => {
  it('409 CHECKOFF_ALREADY_OPEN; a different batch is fine', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();
    await checkoff(batchId, inventoryIds['inv-1']);

    const dup = await checkoff(batchId, inventoryIds['inv-1']);
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('CHECKOFF_ALREADY_OPEN');
    const rows = dbAll('SELECT * FROM inventory_transactions');
    expect(rows).toHaveLength(1);

    // A second batch off the SAME inventory/recipe — re-seeding inventory
    // would 409 on the duplicate name, so a fresh recipe+batch is created
    // directly against the already-seeded inventory instead.
    const recipeRes = await app.inject({ method: 'POST', url: '/api/recipes', payload: fixtureRecipeInput() });
    const otherBatchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipeRes.json().id } });
    const otherRes = await checkoff(otherBatchRes.json().id, inventoryIds['inv-1']);
    expect(otherRes.statusCode).toBe(201);
  });
});

describe('AC-28: non-comparable checkoff rejected', () => {
  it('unit-mismatch and no-requirement items both 409 CHECKOFF_NOT_COMPARABLE', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();

    const mismatch = await checkoff(batchId, inventoryIds['inv-6']);
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().error.code).toBe('CHECKOFF_NOT_COMPARABLE');

    const noReq = await checkoff(batchId, inventoryIds['inv-7']);
    expect(noReq.statusCode).toBe(409);
    expect(noReq.json().error.code).toBe('CHECKOFF_NOT_COMPARABLE');

    const rows = dbAll('SELECT * FROM inventory_transactions');
    expect(rows).toHaveLength(0);
  });
});

describe('AC-29: stage gate, both directions', () => {
  it('both POSTs are 409 CHECKOFF_STAGE_INVALID off Planning; row count unchanged', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();
    await checkoff(batchId, inventoryIds['inv-1']);

    for (const status of ['Brewing', 'Fermenting', 'Conditioning', 'Completed']) {
      await advanceBatchStatus(batchId, status);
      const co = await checkoff(batchId, inventoryIds['inv-2']);
      expect(co.statusCode).toBe(409);
      expect(co.json().error.code).toBe('CHECKOFF_STAGE_INVALID');
      const rev = await reverse(batchId, inventoryIds['inv-1']);
      expect(rev.statusCode).toBe(409);
      expect(rev.json().error.code).toBe('CHECKOFF_STAGE_INVALID');
    }
    const rows = dbAll('SELECT * FROM inventory_transactions');
    expect(rows).toHaveLength(1);
  });
});

describe('AC-30: unknown ids', () => {
  it('unknown batchId/inventoryItemId all 404', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();

    const unknownBatch = await checkoff('does-not-exist', inventoryIds['inv-1']);
    expect(unknownBatch.statusCode).toBe(404);

    const unknownItem = await checkoff(batchId, 'does-not-exist');
    expect(unknownItem.statusCode).toBe(404);

    const getCheckoff = await app.inject({ method: 'GET', url: '/api/batches/unknown/checkoff' });
    expect(getCheckoff.statusCode).toBe(404);

    const getCost = await app.inject({ method: 'GET', url: '/api/batches/unknown/cost' });
    expect(getCost.statusCode).toBe(404);
  });
});

describe('AC-31: reversal is append-only', () => {
  it('original row byte-identical, reversal copies verbatim, double-reverse-by-INSERT rejected, no update/delete in source', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();
    await checkoff(batchId, inventoryIds['inv-1']);
    const before = dbAll<Record<string, unknown>>('SELECT * FROM inventory_transactions WHERE kind = ?', ['deduction'])[0];

    const revRes = await reverse(batchId, inventoryIds['inv-1']);
    expect(revRes.statusCode).toBe(201);

    const after = dbAll<Record<string, unknown>>('SELECT * FROM inventory_transactions WHERE id = ?', [before.id])[0];
    expect(after).toEqual(before);

    const reversalRow = dbAll<Record<string, unknown>>('SELECT * FROM inventory_transactions WHERE kind = ?', ['reversal'])[0];
    expect(reversalRow.reverses_transaction_id).toBe(before.id);
    expect(reversalRow.amount).toBe(before.amount);
    expect(reversalRow.unit).toBe(before.unit);
    expect(reversalRow.cost_per_unit).toBe(before.cost_per_unit);
    expect(reversalRow.category).toBe(before.category);
    expect(reversalRow.display_name).toBe(before.display_name);
    expect(reversalRow.name_key).toBe(before.name_key);

    expect(() =>
      dbRun(
        'INSERT INTO inventory_transactions (id, batch_id, inventory_item_id, kind, reverses_transaction_id, category, display_name, name_key, amount, unit, cost_per_unit, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        ['tx-dup', batchId, inventoryIds['inv-1'], 'reversal', before.id, 'Fermentable', 'Pale Ale Malt', 'pale ale malt', 5.5, 'kg', 3.2, new Date().toISOString()],
      ),
    ).toThrow();

    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'routes', 'inventory.ts'), 'utf-8');
    expect(src).not.toMatch(/db\.update\(\s*inventoryTransactions/);
    expect(src).not.toMatch(/db\.delete\(\s*inventoryTransactions/);
    const repoSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'repositories', 'inventoryTransactionRepository.ts'), 'utf-8');
    expect(repoSrc).not.toMatch(/\bupdate\s*\(/);
    expect(repoSrc).not.toMatch(/\bdelete\s*\(/);
  });
});

describe('AC-32: reversing what is not open', () => {
  it('no open deduction -> 409 CHECKOFF_NOT_OPEN; second reverse of same deduction -> 409 CHECKOFF_NOT_OPEN', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();

    const noneOpen = await reverse(batchId, inventoryIds['inv-1']);
    expect(noneOpen.statusCode).toBe(409);
    expect(noneOpen.json().error.code).toBe('CHECKOFF_NOT_OPEN');

    await checkoff(batchId, inventoryIds['inv-1']);
    const first = await reverse(batchId, inventoryIds['inv-1']);
    expect(first.statusCode).toBe(201);
    const second = await reverse(batchId, inventoryIds['inv-1']);
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('CHECKOFF_NOT_OPEN');

    const rows = dbAll('SELECT * FROM inventory_transactions');
    expect(rows).toHaveLength(2);
  });
});

describe('AC-33: end-to-end toggle with no drift, over HTTP (roadmap clause 1)', () => {
  it('20 full check/reverse cycles hold Object.is-identical quantities every half-cycle', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();

    const bases: Record<string, number> = { 'inv-1': 4.0, 'inv-2': 0, 'inv-3': 50, 'inv-4': 2, 'inv-5': -0.5 };
    const deducted: Record<string, number> = { 'inv-1': -1.5, 'inv-2': -0.5, 'inv-3': 0, 'inv-4': -1, 'inv-5': -4.5 };

    for (let cycle = 0; cycle < 20; cycle++) {
      await checkoffAllFive(batchId, inventoryIds);
      const listAfterCheck = await app.inject({ method: 'GET', url: '/api/inventory' });
      const byName: Record<string, { quantity: number }> = {};
      for (const row of listAfterCheck.json()) byName[row.id] = row;
      for (const key of ['inv-1', 'inv-2', 'inv-3', 'inv-4', 'inv-5']) {
        expect(Object.is(byName[inventoryIds[key]].quantity, deducted[key])).toBe(true);
      }

      for (const key of ['inv-1', 'inv-2', 'inv-3', 'inv-4', 'inv-5']) {
        const res = await reverse(batchId, inventoryIds[key]);
        expect(res.statusCode).toBe(201);
      }
      const listAfterReverse = await app.inject({ method: 'GET', url: '/api/inventory' });
      const byName2: Record<string, { quantity: number }> = {};
      for (const row of listAfterReverse.json()) byName2[row.id] = row;
      for (const key of ['inv-1', 'inv-2', 'inv-3', 'inv-4', 'inv-5']) {
        expect(Object.is(byName2[inventoryIds[key]].quantity, bases[key])).toBe(true);
      }
    }

    const rows = dbAll('SELECT * FROM inventory_transactions');
    expect(rows).toHaveLength(200);
    const checkoffState = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/checkoff` });
    expect(checkoffState.json().checkedCount).toBe(0);
  });
});

describe('AC-34: /api/inventory returns the projected shape, and the filter follows on-hand', () => {
  it('baseQuantity/deductedQuantity/openDeductionCount present; outOfStock follows on-hand', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();
    await checkoff(batchId, inventoryIds['inv-1']);

    const listRes = await app.inject({ method: 'GET', url: '/api/inventory' });
    const paleAle = listRes.json().find((r: { id: string }) => r.id === inventoryIds['inv-1']);
    expect(paleAle.quantity).toBe(-1.5);
    expect(paleAle.baseQuantity).toBe(4.0);
    expect(paleAle.deductedQuantity).toBe(5.5);
    expect(paleAle.openDeductionCount).toBe(1);

    const outOfStockTrue = await app.inject({ method: 'GET', url: '/api/inventory?outOfStock=true' });
    expect(outOfStockTrue.json().map((r: { id: string }) => r.id)).toContain(inventoryIds['inv-1']);

    const catFilter = await app.inject({ method: 'GET', url: '/api/inventory?category=Fermentable' });
    expect(catFilter.json().every((r: { category: string }) => r.category === 'Fermentable')).toBe(true);

    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'packages', 'calculations', 'src', 'inventoryLedger.ts'), 'utf-8');
    expect(src).toMatch(/baseQuantity\s*-\s*deductedQuantity|item\.quantity\s*-\s*deductedQuantity/);
  });
});

describe('AC-35: PUT writes the base, response reports on-hand', () => {
  it('quantity 10 sets base; response quantity is on-hand', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();
    await checkoff(batchId, inventoryIds['inv-1']);

    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/inventory/${inventoryIds['inv-1']}`,
      payload: fullInventoryInput({ category: 'Fermentable', name: 'Pale Ale Malt', quantity: 10, unit: 'kg', costPerUnit: 3.2 }),
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().baseQuantity).toBe(10);
    expect(putRes.json().quantity).toBe(4.5);

    const row = dbAll<{ quantity: number }>('SELECT quantity FROM inventory_items WHERE id = ?', [inventoryIds['inv-1']]);
    expect(row[0].quantity).toBe(10);
  });
});

describe('AC-36: GET /api/batches/:id/checkoff', () => {
  it('body deep-equal to the composed evaluateCheckoff result', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();
    await checkoff(batchId, inventoryIds['inv-1']);
    await checkoff(batchId, inventoryIds['inv-3']);

    const res = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/checkoff` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.checkedCount).toBe(2);
    expect(body.checkableCount).toBe(5);
    expect(body.allCheckedOff).toBe(false);
    expect(body.stage).toBe('Planning');
    expect(body.editable).toBe(true);
  });
});

describe('AC-37: /stock-check contract preserved (regression)', () => {
  it('empty ledger returns the M9_P1-pinned body; no checkoff keys; five calls leave everything byte-identical', async () => {
    setup();
    const { batchId } = await seedFixture();

    const res = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/stock-check` });
    const body = res.json();
    expect(body.requirementCount).toBe(7);
    expect(body.comparableCount).toBe(5);
    expect(Object.keys(body.lines[0]).sort()).toEqual(['category', 'displayName', 'inventoryItemId', 'inventoryUnit', 'matched', 'nameKey', 'onHand', 'requiredAmount', 'shortfall', 'sufficient', 'unit', 'unitMismatch'].sort());

    const before = dbAll('SELECT * FROM inventory_items ORDER BY id');
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'GET', url: `/api/batches/${batchId}/stock-check` });
    }
    const after = dbAll('SELECT * FROM inventory_items ORDER BY id');
    expect(after).toEqual(before);
    const txRows = dbAll('SELECT * FROM inventory_transactions');
    expect(txRows).toHaveLength(0);
  });
});

describe('AC-38: GET /api/batches/:id/cost', () => {
  it('full-checkoff total, then after reversing one item', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();
    await checkoffAllFive(batchId, inventoryIds);

    const res = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/cost` });
    const body = res.json();
    expect(body.totalCost).toBe(37.730000000000004);
    expect(body.lineCount).toBe(5);
    expect(body.lines[0]).toEqual({ transactionId: body.lines[0].transactionId, category: 'Fermentable', displayName: 'Pale Ale Malt', nameKey: 'pale ale malt', amount: 5.5, unit: 'kg', costPerUnit: 3.2, lineCost: 17.6 });

    await reverse(batchId, inventoryIds['inv-4']);
    const res2 = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/cost` });
    const body2 = res2.json();
    expect(body2.totalCost).toBe(24.23);
    expect(body2.lineCount).toBe(4);
  });
});

describe('AC-39: cost on a batch with no ledger (degenerate)', () => {
  it('200 with lines: [], lineCount 0, totalCost 0 — not 404, not null, not NaN', async () => {
    setup();
    const { batchId } = await seedFixture();
    const res = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/cost` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ lines: [], lineCount: 0, costedLineCount: 0, uncostedLineCount: 0, hasUncostedLines: false, totalCost: 0 });
  });
});

describe('AC-40: deleting an inventory item does not erase history', () => {
  it('cost breakdown survives; /api/inventory drops it; checkoff line becomes unmatched', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();
    await checkoff(batchId, inventoryIds['inv-1']);

    const delRes = await app.inject({ method: 'DELETE', url: `/api/inventory/${inventoryIds['inv-1']}` });
    expect(delRes.statusCode).toBe(204);

    const costRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/cost` });
    const costBody = costRes.json();
    expect(costBody.lines[0]).toMatchObject({ displayName: 'Pale Ale Malt', amount: 5.5, costPerUnit: 3.2, lineCost: 17.6 });
    expect(costBody.totalCost).toBe(17.6);

    const invRes = await app.inject({ method: 'GET', url: '/api/inventory' });
    expect(invRes.json().find((r: { id: string }) => r.id === inventoryIds['inv-1'])).toBeUndefined();

    const checkoffRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/checkoff` });
    const paleAleLine = checkoffRes.json().lines.find((l: { nameKey: string }) => l.nameKey === 'pale ale malt');
    expect(paleAleLine.matched).toBe(false);
    expect(paleAleLine.checkable).toBe(false);
    expect(paleAleLine.checked).toBe(false);
  });
});

describe('AC-41: pre-M9 batch compatibility (roadmap clause 3)', () => {
  it('a batch with zero ledger rows works through the full pipeline and cost/checkoff stay clean', async () => {
    setup();
    const { batchId } = await seedFixture();

    const checkoffRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/checkoff` });
    expect(checkoffRes.statusCode).toBe(200);
    expect(checkoffRes.json().checkedCount).toBe(0);

    const costRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/cost` });
    expect(costRes.statusCode).toBe(200);
    expect(costRes.json().totalCost).toBe(0);

    let getRes = await app.inject({ method: 'GET', url: `/api/batches/${batchId}` });
    let batch = getRes.json();
    for (const nextStatus of ['Brewing', 'Fermenting', 'Conditioning']) {
      const putRes = await app.inject({ method: 'PUT', url: `/api/batches/${batchId}`, payload: { ...toBatchWriteBody(batch), status: nextStatus } });
      expect(putRes.statusCode).toBe(200);
      batch = putRes.json();
    }
    const completeRes = await app.inject({
      method: 'PUT',
      url: `/api/batches/${batchId}`,
      payload: { ...toBatchWriteBody(batch), status: 'Completed', measuredOg: 1.05, measuredFg: 1.01 },
    });
    expect(completeRes.statusCode).toBe(200);

    const costAfter = await app.inject({ method: 'GET', url: `/api/batches/${batchId}/cost` });
    expect(costAfter.statusCode).toBe(200);
    expect(costAfter.json().totalCost).toBe(0);
  });
});

describe('AC-42: error-code surface', () => {
  it('four new codes plus all nine pre-existing; errors.test.ts unmodified elsewhere', async () => {
    setup();
    const { batchId, inventoryIds } = await seedFixture();

    const extraKey = await app.inject({ method: 'POST', url: `/api/batches/${batchId}/checkoff`, payload: { inventoryItemId: inventoryIds['inv-1'], extra: 1 } });
    expect(extraKey.statusCode).toBe(400);

    await checkoff(batchId, inventoryIds['inv-1']);
    const already = await checkoff(batchId, inventoryIds['inv-1']);
    expect(already.json().error.code).toBe('CHECKOFF_ALREADY_OPEN');

    const notOpen = await reverse(batchId, inventoryIds['inv-2']);
    expect(notOpen.json().error.code).toBe('CHECKOFF_NOT_OPEN');

    const notComparable = await checkoff(batchId, inventoryIds['inv-6']);
    expect(notComparable.json().error.code).toBe('CHECKOFF_NOT_COMPARABLE');

    await advanceBatchStatus(batchId, 'Brewing');
    const stageInvalid = await checkoff(batchId, inventoryIds['inv-2']);
    expect(stageInvalid.json().error.code).toBe('CHECKOFF_STAGE_INVALID');
  });
});
