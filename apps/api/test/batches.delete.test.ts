import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { batchRepository } from '../src/repositories/batchRepository';
import { fullRecipeInput } from './helpers/fixtures';

let handle: TestDbHandle;
let app: FastifyInstance;

beforeEach(() => {
  handle = createTestDb();
  seedDatabase(handle.db);
  app = buildServer({ db: handle.db });
});

afterEach(async () => {
  await app.close();
  handle.cleanup();
});

/** Raw SQL helpers over the underlying better-sqlite3 client (repo precedent — inventoryLedger.test.ts). */
function dbAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return handle.db.$client.prepare(sql).all(...params) as T[];
}

async function createRecipe() {
  const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput() });
  return res.json();
}

async function createBatch(recipeId: string) {
  const res = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId } });
  expect(res.statusCode).toBe(201);
  return res.json();
}

async function addReading(batchId: string, sg: number) {
  const res = await app.inject({
    method: 'POST',
    url: `/api/batches/${batchId}/readings`,
    payload: { readingTime: '2026-01-01T00:00:00.000Z', sg, tempC: null, comment: '', ph: null, pressurePsi: null },
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

async function addNote(batchId: string, note: string) {
  const res = await app.inject({ method: 'POST', url: `/api/batches/${batchId}/notes`, payload: { note } });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('AC-30: DELETE /api/batches/:id deletes an existing batch', () => {
  it('returns 204 with an empty body; the batch is then 404 and absent from the list', async () => {
    const recipe = await createRecipe();
    const batch = await createBatch(recipe.id);

    const delRes = await app.inject({ method: 'DELETE', url: `/api/batches/${batch.id}` });
    expect(delRes.statusCode).toBe(204);
    expect(delRes.body).toBe('');

    const getRes = await app.inject({ method: 'GET', url: `/api/batches/${batch.id}` });
    expect(getRes.statusCode).toBe(404);

    const listRes = await app.inject({ method: 'GET', url: '/api/batches' });
    const ids = (listRes.json() as Array<{ id: string }>).map((b) => b.id);
    expect(ids).not.toContain(batch.id);
  });
});

describe('AC-31: missing batch id returns 404 in the established error shape', () => {
  it('a random unknown id returns the same NOT_FOUND shape as GET/PUT', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/batches/${randomUUID()}` });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Batch not found' } });
  });

  it('deleting the same real id twice yields 204 then 404 — a repeat delete is not treated as success', async () => {
    const recipe = await createRecipe();
    const batch = await createBatch(recipe.id);

    const first = await app.inject({ method: 'DELETE', url: `/api/batches/${batch.id}` });
    expect(first.statusCode).toBe(204);

    const second = await app.inject({ method: 'DELETE', url: `/api/batches/${batch.id}` });
    expect(second.statusCode).toBe(404);
    expect(second.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Batch not found' } });
  });
});

describe('AC-32: the deleted batch\'s own readings and notes are gone; a sibling batch is untouched', () => {
  it('cascades to batch_readings/batch_notes for the deleted batch only', async () => {
    const recipe = await createRecipe();
    const target = await createBatch(recipe.id);
    const sibling = await createBatch(recipe.id);

    await addReading(target.id, 1.05);
    await addReading(target.id, 1.02);
    await addNote(target.id, 'Note A');
    await addNote(target.id, 'Note B');

    await addReading(sibling.id, 1.06);
    await addNote(sibling.id, 'Sibling note');

    const delRes = await app.inject({ method: 'DELETE', url: `/api/batches/${target.id}` });
    expect(delRes.statusCode).toBe(204);

    const targetReadings = dbAll('SELECT * FROM batch_readings WHERE batch_id = ?', [target.id]);
    const targetNotes = dbAll('SELECT * FROM batch_notes WHERE batch_id = ?', [target.id]);
    expect(targetReadings).toHaveLength(0);
    expect(targetNotes).toHaveLength(0);

    const siblingReadings = dbAll('SELECT * FROM batch_readings WHERE batch_id = ?', [sibling.id]);
    const siblingNotes = dbAll('SELECT * FROM batch_notes WHERE batch_id = ?', [sibling.id]);
    expect(siblingReadings).toHaveLength(1);
    expect(siblingNotes).toHaveLength(1);
  });
});

describe('AC-33: the cascade is DB-driven, not hand-rolled — repository issues exactly one statement', () => {
  it('batchRepository.deleteBatch source contains no delete(batchReadings)/delete(batchNotes) and no transaction', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../src/repositories/batchRepository.ts', import.meta.url), 'utf-8'),
    );
    const deleteBatchBody = source.slice(source.indexOf('async deleteBatch'));
    expect(deleteBatchBody).not.toMatch(/delete\(batchReadings\)/);
    expect(deleteBatchBody).not.toMatch(/delete\(batchNotes\)/);
    expect(deleteBatchBody).not.toMatch(/\.transaction\(/);
  });

  it('batchRepository.deleteBatch resolves true/false and the row is actually gone from `batches`', async () => {
    const recipe = await createRecipe();
    const batch = await createBatch(recipe.id);

    const result = await batchRepository.deleteBatch(handle.db, batch.id);
    expect(result).toBe(true);

    const rows = dbAll('SELECT * FROM batches WHERE id = ?', [batch.id]);
    expect(rows).toHaveLength(0);
  });
});

describe('AC-34: inventory ledger rows and stock levels survive a batch delete', () => {
  it('inventory_transactions rows for the deleted batch remain, and stock is unchanged', async () => {
    const invRes = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      payload: { category: 'Fermentable', name: 'Pale Ale Malt (2-Row)', quantity: 5, unit: 'kg', costPerUnit: 3.2, purchaseDate: null, expiryDate: null, notes: '' },
    });
    expect(invRes.statusCode).toBe(201);
    const inventoryItemId = invRes.json().id;

    const recipe = await createRecipe();
    const batch = await createBatch(recipe.id);

    const checkoffRes = await app.inject({ method: 'POST', url: `/api/batches/${batch.id}/checkoff`, payload: { inventoryItemId } });
    expect(checkoffRes.statusCode).toBe(201);

    const preDeleteInventory = await app.inject({ method: 'GET', url: '/api/inventory' });
    const preDeleteQuantity = (preDeleteInventory.json() as Array<{ id: string; quantity: number }>).find((i) => i.id === inventoryItemId)?.quantity;

    const ledgerBefore = dbAll('SELECT * FROM inventory_transactions WHERE batch_id = ?', [batch.id]);
    expect(ledgerBefore).toHaveLength(1);

    const delRes = await app.inject({ method: 'DELETE', url: `/api/batches/${batch.id}` });
    expect(delRes.statusCode).toBe(204);

    const ledgerAfter = dbAll('SELECT * FROM inventory_transactions WHERE batch_id = ?', [batch.id]);
    expect(ledgerAfter).toHaveLength(1);
    expect(ledgerAfter).toEqual(ledgerBefore);

    const postDeleteInventory = await app.inject({ method: 'GET', url: '/api/inventory' });
    const postDeleteQuantity = (postDeleteInventory.json() as Array<{ id: string; quantity: number }>).find((i) => i.id === inventoryItemId)?.quantity;
    expect(postDeleteQuantity).toBe(preDeleteQuantity);
  });
});

describe('AC-35: deleteBatch follows the existing repository return convention', () => {
  it('resolves true for an existing id and false (never throws) for an unknown id', async () => {
    const recipe = await createRecipe();
    const batch = await createBatch(recipe.id);

    await expect(batchRepository.deleteBatch(handle.db, batch.id)).resolves.toBe(true);
    await expect(batchRepository.deleteBatch(handle.db, randomUUID())).resolves.toBe(false);
  });
});

describe('AC-30 (status): a batch is deletable in any lifecycle status, including Completed', () => {
  it('a Planning-status batch (no guard, no 409) deletes cleanly', async () => {
    const recipe = await createRecipe();
    const batch = await createBatch(recipe.id);
    expect(batch.status).toBe('Planning');

    const delRes = await app.inject({ method: 'DELETE', url: `/api/batches/${batch.id}` });
    expect(delRes.statusCode).toBe(204);
  });
});
