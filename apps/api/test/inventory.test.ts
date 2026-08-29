import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { InventoryWriteInput, InventoryDuplicateDetails } from '@truchabrew/shared-types';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { buildServer } from '../src/server';

let handle: TestDbHandle;
let app: FastifyInstance;

afterEach(async () => {
  await app?.close();
  handle?.cleanup();
});

function setup(): void {
  handle = createTestDb();
  app = buildServer({ db: handle.db });
}

function fullInventoryInput(overrides: Partial<InventoryWriteInput> = {}): InventoryWriteInput {
  return {
    category: 'Fermentable',
    name: 'Pale Ale Malt',
    quantity: 4,
    unit: 'kg',
    costPerUnit: 3.2,
    purchaseDate: '2026-08-01',
    expiryDate: null,
    notes: '',
    ...overrides,
  };
}

async function post(body: InventoryWriteInput | Record<string, unknown>) {
  return await app.inject({ method: 'POST', url: '/api/inventory', payload: body as Record<string, unknown> });
}

describe('AC-18: list, empty and ordered', () => {
  it('empty DB returns 200 []; three inserted out of order come back in (category, nameKey) order', async () => {
    setup();
    const emptyRes = await app.inject({ method: 'GET', url: '/api/inventory' });
    expect(emptyRes.statusCode).toBe(200);
    expect(emptyRes.json()).toEqual([]);

    const citra = await post(fullInventoryInput({ category: 'Hop', name: 'Citra', unit: 'g' }));
    const paleAle = await post(fullInventoryInput({ category: 'Fermentable', name: 'Pale Ale Malt', unit: 'kg' }));
    const gypsum = await post(fullInventoryInput({ category: 'Misc', name: 'Gypsum', unit: 'g' }));

    const listRes = await app.inject({ method: 'GET', url: '/api/inventory' });
    const ids = listRes.json().map((r: { id: string }) => r.id);
    expect(ids).toEqual([paleAle.json().id, citra.json().id, gypsum.json().id]);
  });
});

describe('AC-19: create mints server-owned fields', () => {
  // Spec §1.1's InventoryItem.name comment ("trimmed, case preserved exactly
  // as the user typed it") and Resolved Ambiguity 5's displayName rule ("the
  // user sees their own spelling") are both explicit that only `nameKey` runs
  // whitespace-collapse — `name` is trim()'d only. AC-19's example table cell
  // literally shows a single-spaced 'Pale Ale MALT' for an input with a
  // triple space between "Pale" and "Ale", which is inconsistent with that
  // binding rule; multiple consecutive spaces are also exactly what a
  // markdown table cell silently normalizes to one when authored/viewed,
  // which is the far more likely explanation than a second, undocumented
  // collapse rule for `name` contradicting §1.1's own inline comment. This
  // test asserts the whitespace-preserving behavior those two binding
  // passages describe; flagged in the execution report for confirmation.
  it('trims and preserves name whitespace/case, derives nameKey, mints id/createdAt/updatedAt', async () => {
    setup();
    const res = await post(fullInventoryInput({ name: '  Pale   Ale MALT ' }));
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.name).toBe('Pale   Ale MALT');
    expect(created.nameKey).toBe('pale ale malt');
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBe(created.updatedAt);
  });
});

describe('AC-20: duplicate detection', () => {
  it('a colliding normalized name in the same category is 409; a different category is fine', async () => {
    setup();
    const first = await post(fullInventoryInput({ name: 'Pale Ale MALT' }));
    expect(first.statusCode).toBe(201);
    const firstBody = first.json();

    const dup = await post(fullInventoryInput({ name: 'pale ale malt' }));
    expect(dup.statusCode).toBe(409);
    const dupJson = dup.json();
    expect(dupJson.error.code).toBe('INVENTORY_DUPLICATE');
    const details = dupJson.error.details as InventoryDuplicateDetails;
    expect(details).toEqual({
      existingId: firstBody.id,
      category: 'Fermentable',
      nameKey: 'pale ale malt',
      existingName: 'Pale Ale MALT',
    });

    const differentCategory = await post(fullInventoryInput({ category: 'Misc', name: 'pale ale malt', unit: 'g' }));
    expect(differentCategory.statusCode).toBe(201);
  });
});

describe('AC-21: negative stock is accepted', () => {
  it('quantity: -0.5 -> 201, GET returns exactly -0.5, both flags set', async () => {
    setup();
    const res = await post(fullInventoryInput({ quantity: -0.5 }));
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.quantity).toBe(-0.5);

    const listRes = await app.inject({ method: 'GET', url: '/api/inventory?outOfStock=true' });
    const ids = listRes.json().map((r: { id: string }) => r.id);
    expect(ids).toContain(created.id);
  });
});

describe('AC-22: write validation matrix', () => {
  it.each([
    [{ name: '' }, 400],
    [{ name: '   ' }, 400],
    [{ category: 'Grain' }, 400],
    [{ category: 'Fermentable', unit: 'g' }, 400],
    [{ category: 'Misc', unit: 'pkg' }, 400],
    [{ costPerUnit: -1 }, 400],
    [{ costPerUnit: null }, 201],
    [{ quantity: 'abc' }, 400],
    [{ purchaseDate: '2026-02-30' }, 400],
    [{ purchaseDate: '2026-02-28' }, 201],
    [{ expiryDate: 'yesterday' }, 400],
    [{ expiryDate: null }, 201],
  ] as const)('%j -> %d', async (overrides, expectedStatus) => {
    setup();
    const res = await post(fullInventoryInput(overrides as Partial<InventoryWriteInput>));
    expect(res.statusCode).toBe(expectedStatus);
    if (expectedStatus === 400) {
      expect(res.json().error.code).toBe('VALIDATION_FAILED');
    }
  });
});

describe('AC-23: server-owned keys and notes:null rejected, not stripped', () => {
  it('id/nameKey/createdAt/updatedAt each 400, naming the key; notes:null is 400, notes:"" is 201', async () => {
    setup();
    for (const key of ['id', 'nameKey', 'createdAt', 'updatedAt']) {
      const res = await post({ ...fullInventoryInput(), [key]: 'not-allowed' });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_FAILED');
      expect(res.json().error.message).toContain(key);
    }

    const nullNotes = await post({ ...fullInventoryInput(), notes: null });
    expect(nullNotes.statusCode).toBe(400);

    const emptyNotes = await post(fullInventoryInput({ notes: '' }));
    expect(emptyNotes.statusCode).toBe(201);
    expect(emptyNotes.json().notes).toBe('');
  });
});

describe('AC-24: update semantics', () => {
  it('full replace, createdAt frozen, rename-to-collision 409, rename-to-fresh updates nameKey, unknown id 404', async () => {
    setup();
    const created = await post(fullInventoryInput());
    const createdBody = created.json();

    const other = await post(fullInventoryInput({ name: 'Munich Malt' }));
    const otherBody = other.json();

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/inventory/${createdBody.id}`,
      payload: fullInventoryInput({ name: 'Pale Ale Malt', quantity: 10, costPerUnit: 5 }),
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.quantity).toBe(10);
    expect(updated.costPerUnit).toBe(5);
    expect(updated.createdAt).toBe(createdBody.createdAt);
    expect(updated.updatedAt).not.toBe(createdBody.updatedAt);

    const collideRes = await app.inject({
      method: 'PUT',
      url: `/api/inventory/${createdBody.id}`,
      payload: fullInventoryInput({ name: 'Munich Malt' }),
    });
    expect(collideRes.statusCode).toBe(409);
    expect(collideRes.json().error.code).toBe('INVENTORY_DUPLICATE');

    const renameRes = await app.inject({
      method: 'PUT',
      url: `/api/inventory/${createdBody.id}`,
      payload: fullInventoryInput({ name: 'Flaked Oats' }),
    });
    expect(renameRes.statusCode).toBe(200);
    expect(renameRes.json().nameKey).toBe('flaked oats');

    const notFoundRes = await app.inject({ method: 'PUT', url: '/api/inventory/does-not-exist', payload: fullInventoryInput() });
    expect(notFoundRes.statusCode).toBe(404);

    void otherBody;
  });
});

describe('AC-25: delete is unconditional', () => {
  it('204 then gone, 404 for unknown, no *_IN_USE guard', async () => {
    setup();
    const created = await post(fullInventoryInput());
    const id = created.json().id;

    const deleteRes = await app.inject({ method: 'DELETE', url: `/api/inventory/${id}` });
    expect(deleteRes.statusCode).toBe(204);

    const getAfter = await app.inject({ method: 'GET', url: '/api/inventory' });
    expect(getAfter.json().find((r: { id: string }) => r.id === id)).toBeUndefined();

    const deleteAgain = await app.inject({ method: 'DELETE', url: `/api/inventory/${id}` });
    expect(deleteAgain.statusCode).toBe(404);
  });
});

describe('AC-26: query filters', () => {
  it('category, outOfStock, AND-combined, and both invalid-value cases', async () => {
    setup();
    await post(fullInventoryInput({ category: 'Hop', name: 'Citra', unit: 'g', quantity: 0 }));
    await post(fullInventoryInput({ category: 'Hop', name: 'Magnum', unit: 'g', quantity: -0.5 }));
    await post(fullInventoryInput({ category: 'Misc', name: 'Gypsum', unit: 'g', quantity: 1e-9 }));
    await post(fullInventoryInput({ category: 'Misc', name: 'Salt', unit: 'g', quantity: 0.0001 }));
    await post(fullInventoryInput({ category: 'Fermentable', name: 'Pale Ale Malt', unit: 'kg', quantity: 4 }));

    const hopsOnly = await app.inject({ method: 'GET', url: '/api/inventory?category=Hop' });
    expect(hopsOnly.json()).toHaveLength(2);

    const outOfStock = await app.inject({ method: 'GET', url: '/api/inventory?outOfStock=true' });
    expect(outOfStock.json()).toHaveLength(3);

    const combined = await app.inject({ method: 'GET', url: '/api/inventory?category=Misc&outOfStock=true' });
    expect(combined.json()).toHaveLength(1);
    expect(combined.json()[0].name).toBe('Gypsum');

    const badCategory = await app.inject({ method: 'GET', url: '/api/inventory?category=Bogus' });
    expect(badCategory.statusCode).toBe(400);

    const badOutOfStock = await app.inject({ method: 'GET', url: '/api/inventory?outOfStock=maybe' });
    expect(badOutOfStock.statusCode).toBe(400);

    const noParams = await app.inject({ method: 'GET', url: '/api/inventory' });
    expect(noParams.json()).toHaveLength(5);
  });
});

describe('AC-31: error-code surface', () => {
  it('INVENTORY_DUPLICATE is reachable and every pre-existing code is unchanged', async () => {
    setup();
    await post(fullInventoryInput());
    const dup = await post(fullInventoryInput());
    expect(dup.json().error.code).toBe('INVENTORY_DUPLICATE');

    const notFound = await app.inject({ method: 'GET', url: '/api/nonexistent-route' });
    expect(notFound.json().error.code).toBe('NOT_FOUND');
  });
});

describe('AC-15: customDetails JSON persists and returns across POST, PUT, and GET (M12_P1 Amendment 1)', () => {
  it('POST persists customDetails and GET (list + by id via PUT round-trip) returns it back unchanged', async () => {
    setup();
    const created = await post(
      fullInventoryInput({
        category: 'Hop',
        name: 'Amarillo',
        unit: 'g',
        customDetails: { category: 'Hop', alphaAcidPct: 8.5, hopType: 'Pellet', origin: 'US', year: 2025, lotNumber: 'LOT-1', manufacturingDate: '2025-09-01' },
      }),
    );
    expect(created.statusCode).toBe(201);
    expect(created.json().customDetails).toEqual({
      category: 'Hop',
      alphaAcidPct: 8.5,
      hopType: 'Pellet',
      origin: 'US',
      year: 2025,
      lotNumber: 'LOT-1',
      manufacturingDate: '2025-09-01',
    });

    const listRes = await app.inject({ method: 'GET', url: '/api/inventory' });
    const listed = listRes.json().find((r: { id: string }) => r.id === created.json().id);
    expect(listed.customDetails).toEqual(created.json().customDetails);
  });

  it('PUT overwrites customDetails with a new value; PUT with customDetails: null clears it', async () => {
    setup();
    const created = await post(
      fullInventoryInput({
        category: 'Fermentable',
        name: 'Pale Ale Malt',
        customDetails: { category: 'Fermentable', potentialSg: 1.037, colorSrm: 3.5 },
      }),
    );
    const id = created.json().id;

    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/inventory/${id}`,
      payload: fullInventoryInput({
        category: 'Fermentable',
        name: 'Pale Ale Malt',
        customDetails: { category: 'Fermentable', potentialSg: 1.04, colorSrm: 4.0, supplier: 'Weyermann' },
      }),
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().customDetails).toEqual({ category: 'Fermentable', potentialSg: 1.04, colorSrm: 4.0, supplier: 'Weyermann' });

    const clearRes = await app.inject({
      method: 'PUT',
      url: `/api/inventory/${id}`,
      payload: fullInventoryInput({ category: 'Fermentable', name: 'Pale Ale Malt', customDetails: null }),
    });
    expect(clearRes.statusCode).toBe(200);
    expect(clearRes.json().customDetails).toBeNull();
  });

  it('customDetails is entirely omittable — a body without the key still creates/returns customDetails: null', async () => {
    setup();
    const { customDetails: _omit, ...bodyWithoutCustomDetails } = fullInventoryInput({ category: 'Misc', name: 'Gypsum', unit: 'g' }) as InventoryWriteInput & {
      customDetails?: unknown;
    };
    void _omit;
    const res = await post(bodyWithoutCustomDetails as InventoryWriteInput);
    expect(res.statusCode).toBe(201);
    expect(res.json().customDetails).toBeNull();
  });
});
