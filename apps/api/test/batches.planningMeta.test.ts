// M19_P1 spec §3 — AC-3, AC-4, AC-5: batch planning metadata (batchNo,
// brewer, brewDate) persistence via migration 0015 and PUT /api/batches/:id.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
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

/** Raw SQL helper over the underlying better-sqlite3 client (repo precedent — batches.delete.test.ts). */
function dbAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return handle.db.$client.prepare(sql).all(...params) as T[];
}

/** A PUT body that omits the three server-owned keys (repo-wide toBatchWriteBody precedent). */
function toBatchWriteBody<T extends { fermentationStartDate?: unknown; bottlingDate?: unknown; closingSnapshot?: unknown }>(
  batch: T,
): Omit<T, 'fermentationStartDate' | 'bottlingDate' | 'closingSnapshot'> {
  const { fermentationStartDate: _a, bottlingDate: _b, closingSnapshot: _c, ...rest } = batch;
  return rest;
}

async function createRecipe() {
  const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput() });
  return res.json();
}

async function createBatch() {
  const recipe = await createRecipe();
  const res = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
  expect(res.statusCode).toBe(201);
  return res.json();
}

async function getBatch(id: string) {
  const res = await app.inject({ method: 'GET', url: `/api/batches/${id}` });
  return { status: res.statusCode, body: res.json() };
}

async function putBatch(id: string, payload: Record<string, unknown>) {
  const res = await app.inject({ method: 'PUT', url: `/api/batches/${id}`, payload });
  return { status: res.statusCode, body: res.body ? res.json() : undefined };
}

describe('AC-3: migration 0015 applies cleanly with NULL-default columns', () => {
  it('brewer and brew_date columns exist on batches, default NULL', async () => {
    const batch = await createBatch();
    const rows = dbAll<{ brewer: string | null; brew_date: string | null }>('SELECT brewer, brew_date FROM batches WHERE id = ?', [batch.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].brewer).toBeNull();
    expect(rows[0].brew_date).toBeNull();
  });

  it('a freshly-created batch also reads back brewer/brewDate as null via the API', async () => {
    const batch = await createBatch();
    expect(batch.brewer).toBeNull();
    expect(batch.brewDate).toBeNull();
    expect(batch.batchNo).toEqual(expect.any(Number));
  });
});

describe('AC-4: PUT /api/batches/:id updates name/batchNo/brewer/brewDate; GET reads back identically', () => {
  it('round-trips all four fields', async () => {
    const batch = await createBatch();

    const putRes = await putBatch(batch.id, {
      ...toBatchWriteBody(batch),
      name: 'Renamed Batch',
      batchNo: 42,
      brewer: 'Jane Brewer',
      brewDate: '2026-08-19',
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.name).toBe('Renamed Batch');
    expect(putRes.body.batchNo).toBe(42);
    expect(putRes.body.brewer).toBe('Jane Brewer');
    expect(putRes.body.brewDate).toBe('2026-08-19');

    const { status, body } = await getBatch(batch.id);
    expect(status).toBe(200);
    expect(body.name).toBe('Renamed Batch');
    expect(body.batchNo).toBe(42);
    expect(body.brewer).toBe('Jane Brewer');
    expect(body.brewDate).toBe('2026-08-19');
  });

  it('brewer/brewDate can be written null (unset) and read back null', async () => {
    const batch = await createBatch();
    await putBatch(batch.id, { ...toBatchWriteBody(batch), brewer: 'Someone', brewDate: '2026-01-01' });

    const putRes = await putBatch(batch.id, { ...toBatchWriteBody(batch), brewer: null, brewDate: null });
    expect(putRes.status).toBe(200);
    expect(putRes.body.brewer).toBeNull();
    expect(putRes.body.brewDate).toBeNull();
  });

  it('a full ISO instant is accepted for brewDate, not just a calendar date', async () => {
    const batch = await createBatch();
    const putRes = await putBatch(batch.id, { ...toBatchWriteBody(batch), brewDate: '2026-08-19T14:30:00.000Z' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.brewDate).toBe('2026-08-19T14:30:00.000Z');
  });
});

describe('AC-5: batchNo bounds validation', () => {
  it('batchNo <= 0 returns 400 VALIDATION_FAILED', async () => {
    const batch = await createBatch();
    const res = await putBatch(batch.id, { ...toBatchWriteBody(batch), batchNo: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('a negative batchNo returns 400 VALIDATION_FAILED', async () => {
    const batch = await createBatch();
    const res = await putBatch(batch.id, { ...toBatchWriteBody(batch), batchNo: -3 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('a non-integer batchNo returns 400 VALIDATION_FAILED', async () => {
    const batch = await createBatch();
    const res = await putBatch(batch.id, { ...toBatchWriteBody(batch), batchNo: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('a string batchNo returns 400 VALIDATION_FAILED', async () => {
    const batch = await createBatch();
    const res = await putBatch(batch.id, { ...toBatchWriteBody(batch), batchNo: 'seven' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('batchNo === 1 (the boundary) is accepted', async () => {
    const batch = await createBatch();
    const res = await putBatch(batch.id, { ...toBatchWriteBody(batch), batchNo: 1 });
    expect(res.status).toBe(200);
    expect(res.body.batchNo).toBe(1);
  });
});
