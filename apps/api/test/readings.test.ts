import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ReadingWriteInput } from '@truchabrew/shared-types';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { fullRecipeInput } from './helpers/fixtures';

function readingInput(overrides: Partial<ReadingWriteInput> = {}): ReadingWriteInput {
  return {
    readingTime: '2026-08-01T12:00:00.000Z',
    sg: 1.048,
    tempC: 20,
    comment: '',
    ph: null,
    pressurePsi: null,
    ...overrides,
  };
}

/** A PUT body that omits the three server-owned keys — none present on BatchWriteInput. */
function toBatchWriteBody<T extends { fermentationStartDate?: unknown; bottlingDate?: unknown; closingSnapshot?: unknown }>(
  batch: T,
): Omit<T, 'fermentationStartDate' | 'bottlingDate' | 'closingSnapshot'> {
  const { fermentationStartDate: _drop1, bottlingDate: _drop2, closingSnapshot: _drop3, ...rest } = batch;
  return rest;
}

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

async function createRecipe() {
  const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput() });
  return JSON.parse(res.body);
}

async function createBatch() {
  const recipe = await createRecipe();
  const res = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
  return JSON.parse(res.body);
}

async function postReading(batchId: string, body: ReadingWriteInput) {
  const res = await app.inject({ method: 'POST', url: `/api/batches/${batchId}/readings`, payload: body });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

async function putReading(batchId: string, readingId: string, body: ReadingWriteInput) {
  const res = await app.inject({ method: 'PUT', url: `/api/batches/${batchId}/readings/${readingId}`, payload: body });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

async function deleteReading(batchId: string, readingId: string) {
  return app.inject({ method: 'DELETE', url: `/api/batches/${batchId}/readings/${readingId}` });
}

async function getBatch(id: string) {
  const res = await app.inject({ method: 'GET', url: `/api/batches/${id}` });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

async function listBatches() {
  const res = await app.inject({ method: 'GET', url: '/api/batches' });
  return JSON.parse(res.body);
}

describe('AC-21: create a reading and read it back in canonical order', () => {
  it('POST returns 201 with a server-minted id, the submitted readingTime, and the path batchId', async () => {
    const batch = await createBatch();
    const { status, body } = await postReading(batch.id, readingInput({ readingTime: '2026-08-02T00:00:00.000Z' }));
    expect(status).toBe(201);
    expect(body.id).toEqual(expect.any(String));
    expect(body.id.length).toBeGreaterThan(0);
    expect(body.readingTime).toBe('2026-08-02T00:00:00.000Z');
    expect(body.batchId).toBe(batch.id);
  });

  it('three readings posted out of chronological order come back ascending by readingTime; a duplicate-time fourth lands adjacent to its twin ordered by id', async () => {
    const batch = await createBatch();
    const r3 = await postReading(batch.id, readingInput({ readingTime: '2026-08-03T00:00:00.000Z' }));
    const r1 = await postReading(batch.id, readingInput({ readingTime: '2026-08-01T00:00:00.000Z' }));
    const r2 = await postReading(batch.id, readingInput({ readingTime: '2026-08-02T00:00:00.000Z' }));
    // A duplicate-time twin of r2.
    const r2b = await postReading(batch.id, readingInput({ readingTime: '2026-08-02T00:00:00.000Z' }));

    const { body } = await getBatch(batch.id);
    expect(body.readings.map((r: { id: string }) => r.id)).toEqual(
      expect.arrayContaining([r1.body.id, r2.body.id, r2b.body.id, r3.body.id]),
    );
    const times = body.readings.map((r: { readingTime: string }) => r.readingTime);
    expect(times).toEqual([...times].sort());

    // The two same-time readings (r2/r2b) are adjacent and ordered by id.
    const idx2 = body.readings.findIndex((r: { id: string }) => r.id === r2.body.id);
    const idx2b = body.readings.findIndex((r: { id: string }) => r.id === r2b.body.id);
    expect(Math.abs(idx2 - idx2b)).toBe(1);
    const [first, second] = idx2 < idx2b ? [r2.body.id, r2b.body.id] : [r2b.body.id, r2.body.id];
    expect(first < second).toBe(true);
  });

  it('POST to an unknown batch id is 404 NOT_FOUND and writes nothing', async () => {
    const before = (handle.db.$client.prepare(`SELECT COUNT(*) as c FROM batch_readings`).get() as { c: number }).c;
    const { status, body } = await postReading('does-not-exist', readingInput());
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    const after = (handle.db.$client.prepare(`SELECT COUNT(*) as c FROM batch_readings`).get() as { c: number }).c;
    expect(after).toBe(before);
  });
});

describe('AC-22: edit, delete, and cross-batch isolation', () => {
  it('PUT replaces all six writable fields and returns 200; a field omitted from the body is 400, never retained', async () => {
    const batch = await createBatch();
    const created = (await postReading(batch.id, readingInput())).body;

    const fullReplace = readingInput({ readingTime: '2026-08-05T00:00:00.000Z', sg: 1.02, tempC: 18, comment: 'racked', ph: 4.5, pressurePsi: 10 });
    const { status, body } = await putReading(batch.id, created.id, fullReplace);
    expect(status).toBe(200);
    expect(body).toMatchObject({ id: created.id, batchId: batch.id, ...fullReplace });

    // Omitting a required key (comment) is 400, and the row is bit-identical to before this call.
    const { comment: _drop, ...partial } = fullReplace;
    const partialRes = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}/readings/${created.id}`, payload: partial });
    expect(partialRes.statusCode).toBe(400);

    const row = handle.db.$client.prepare(`SELECT * FROM batch_readings WHERE id = ?`).get(created.id) as any;
    expect(row.comment).toBe('racked');
    expect(row.sg).toBe(1.02);
  });

  it('DELETE returns 204 with an empty body and the row is gone', async () => {
    const batch = await createBatch();
    const created = (await postReading(batch.id, readingInput())).body;

    const res = await deleteReading(batch.id, created.id);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');

    const row = handle.db.$client.prepare(`SELECT * FROM batch_readings WHERE id = ?`).get(created.id);
    expect(row).toBeUndefined();
  });

  it('PUT and DELETE on an unknown readingId are 404', async () => {
    const batch = await createBatch();
    const putRes = await putReading(batch.id, 'does-not-exist', readingInput());
    expect(putRes.status).toBe(404);

    const delRes = await deleteReading(batch.id, 'does-not-exist');
    expect(delRes.statusCode).toBe(404);
  });

  it('PUT and DELETE on a readingId belonging to a DIFFERENT batch are 404, and that other batch\'s reading is unmodified', async () => {
    const batchA = await createBatch();
    const batchB = await createBatch();
    const readingOnB = (await postReading(batchB.id, readingInput({ comment: 'belongs to B' }))).body;

    const putRes = await putReading(batchA.id, readingOnB.id, readingInput({ comment: 'hijacked' }));
    expect(putRes.status).toBe(404);

    const delRes = await deleteReading(batchA.id, readingOnB.id);
    expect(delRes.statusCode).toBe(404);

    // Re-read and compare field-for-field — untouched by the refused cross-batch calls.
    const { body: refetchedBatchB } = await getBatch(batchB.id);
    expect(refetchedBatchB.readings).toHaveLength(1);
    expect(refetchedBatchB.readings[0]).toEqual(readingOnB);
  });
});

describe('AC-23: boundary validation, exact operators', () => {
  it.each([
    ['sg', 0.899, 400], ['sg', 0.9, 201], ['sg', 1.2, 201], ['sg', 1.201, 400],
    ['tempC', -20.01, 400], ['tempC', -20, 201], ['tempC', 50, 201], ['tempC', 50.01, 400],
    ['ph', 2.99, 400], ['ph', 3, 201], ['ph', 9, 201], ['ph', 9.01, 400],
    ['pressurePsi', -0.01, 400], ['pressurePsi', 0, 201], ['pressurePsi', 60, 201], ['pressurePsi', 60.01, 400],
  ] as const)('%s = %d -> %d', async (field, value, expectedStatus) => {
    const batch = await createBatch();
    const before = (handle.db.$client.prepare(`SELECT COUNT(*) as c FROM batch_readings`).get() as { c: number }).c;
    const { status } = await postReading(batch.id, readingInput({ [field]: value } as Partial<ReadingWriteInput>));
    expect(status).toBe(expectedStatus);
    if (expectedStatus === 400) {
      const after = (handle.db.$client.prepare(`SELECT COUNT(*) as c FROM batch_readings`).get() as { c: number }).c;
      expect(after).toBe(before);
    }
  });

  it('sg: null -> 201 (both-null guarded separately by AC-25, not this bound)', async () => {
    const batch = await createBatch();
    const { status } = await postReading(batch.id, readingInput({ sg: null, tempC: 19 }));
    expect(status).toBe(201);
  });

  it('comment: \'\' -> 201, a 2000-char string -> 201, a 2001-char string -> 400, null -> 400', async () => {
    const batch = await createBatch();
    expect((await postReading(batch.id, readingInput({ comment: '' }))).status).toBe(201);
    expect((await postReading(batch.id, readingInput({ comment: 'x'.repeat(2000) }))).status).toBe(201);
    expect((await postReading(batch.id, readingInput({ comment: 'x'.repeat(2001) }))).status).toBe(400);

    const res = await app.inject({
      method: 'POST',
      url: `/api/batches/${batch.id}/readings`,
      payload: { ...readingInput(), comment: null },
    });
    expect(res.statusCode).toBe(400);
  });

  it('measuredOg on the batch: 0.899 -> 400, 0.900 -> 200, 1.200 -> 200, 1.201 -> 400, null -> 200', async () => {
    const batch = await createBatch();
    const put = (measuredOg: number | null) =>
      app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), measuredOg } });

    expect((await put(0.899)).statusCode).toBe(400);
    expect((await put(0.9)).statusCode).toBe(200);
    expect((await put(1.2)).statusCode).toBe(200);
    expect((await put(1.201)).statusCode).toBe(400);
    expect((await put(null)).statusCode).toBe(200);
  });
});

describe('AC-24: readingTime is validated for both shape and reality', () => {
  it.each([
    ['2026-08-03T18:00:00Z', 201],
    ['2026-08-03T18:00:00.000Z', 201],
    ['2026-08-03T18:00:00+02:00', 400],
    ['2026-08-03 18:00:00Z', 400],
    ['2026-08-03', 400],
    ['', 400],
    ['2026-13-45T99:00:00Z', 400],
  ] as const)('readingTime = %s -> %d', async (readingTime, expectedStatus) => {
    const batch = await createBatch();
    const { status } = await postReading(batch.id, readingInput({ readingTime }));
    expect(status).toBe(expectedStatus);
  });

  it('the schema does not rely on the ajv-formats date-time keyword', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/routes/schemas.ts'), 'utf-8');
    expect(source).not.toMatch(/date-time/);
  });
});

describe('AC-25: a reading must carry at least one measurement', () => {
  it('sg: null AND tempC: null -> 400 naming both fields, even with comment/ph/pressurePsi present; reading count unchanged', async () => {
    const batch = await createBatch();
    const before = (handle.db.$client.prepare(`SELECT COUNT(*) as c FROM batch_readings`).get() as { c: number }).c;
    const { status, body } = await postReading(batch.id, readingInput({ sg: null, tempC: null, comment: 'notes', ph: 4, pressurePsi: 12 }));
    expect(status).toBe(400);
    expect(body.error.message).toMatch(/sg/);
    expect(body.error.message).toMatch(/tempC/);
    const after = (handle.db.$client.prepare(`SELECT COUNT(*) as c FROM batch_readings`).get() as { c: number }).c;
    expect(after).toBe(before);
  });

  it('sg alone -> 201; tempC alone -> 201; both -> 201', async () => {
    const batch = await createBatch();
    expect((await postReading(batch.id, readingInput({ sg: 1.04, tempC: null }))).status).toBe(201);
    expect((await postReading(batch.id, readingInput({ sg: null, tempC: 19 }))).status).toBe(201);
    expect((await postReading(batch.id, readingInput({ sg: 1.04, tempC: 19 }))).status).toBe(201);
  });

  it('a stored reading cannot be edited into the both-null state via PUT', async () => {
    const batch = await createBatch();
    const created = (await postReading(batch.id, readingInput())).body;
    const { status } = await putReading(batch.id, created.id, readingInput({ sg: null, tempC: null }));
    expect(status).toBe(400);

    const row = handle.db.$client.prepare(`SELECT sg, temp_c FROM batch_readings WHERE id = ?`).get(created.id) as any;
    expect(row.sg).not.toBeNull();
  });
});

describe('AC-28: list stays lean; detail carries readings', () => {
  it('GET /api/batches has no readings key at all for a batch with three readings', async () => {
    const batch = await createBatch();
    await postReading(batch.id, readingInput({ readingTime: '2026-08-01T00:00:00.000Z' }));
    await postReading(batch.id, readingInput({ readingTime: '2026-08-02T00:00:00.000Z' }));
    await postReading(batch.id, readingInput({ readingTime: '2026-08-03T00:00:00.000Z' }));

    const list = await listBatches();
    const found = list.find((b: { id: string }) => b.id === batch.id);
    expect(found).toBeDefined();
    expect('readings' in found).toBe(false);
  });

  it('GET /api/batches/:id returns readings.length === 3 in canonical order', async () => {
    const batch = await createBatch();
    await postReading(batch.id, readingInput({ readingTime: '2026-08-03T00:00:00.000Z' }));
    await postReading(batch.id, readingInput({ readingTime: '2026-08-01T00:00:00.000Z' }));
    await postReading(batch.id, readingInput({ readingTime: '2026-08-02T00:00:00.000Z' }));

    const { body } = await getBatch(batch.id);
    expect(body.readings).toHaveLength(3);
    expect(body.readings.map((r: { readingTime: string }) => r.readingTime)).toEqual([
      '2026-08-01T00:00:00.000Z',
      '2026-08-02T00:00:00.000Z',
      '2026-08-03T00:00:00.000Z',
    ]);
  });

  it('a batch with no readings returns readings: [] — never null, never an omitted key', async () => {
    const batch = await createBatch();
    const { body } = await getBatch(batch.id);
    expect(body.readings).toEqual([]);
  });
});

describe('AC-32: frozen figures stay frozen across every new write path', () => {
  it('statsSnapshot and recipeSnapshot are byte-identical after posting/editing/deleting readings, transitioning, and saving measuredOg', async () => {
    const batch = await createBatch();
    const atCreation = { statsSnapshot: batch.statsSnapshot, recipeSnapshot: batch.recipeSnapshot };

    const r1 = (await postReading(batch.id, readingInput({ readingTime: '2026-08-01T00:00:00.000Z' }))).body;
    await putReading(batch.id, r1.id, readingInput({ readingTime: '2026-08-01T06:00:00.000Z', sg: 1.03 }));
    const r2 = (await postReading(batch.id, readingInput({ readingTime: '2026-08-02T00:00:00.000Z' }))).body;
    await deleteReading(batch.id, r2.id);

    await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Brewing' } });
    await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Fermenting' } });
    await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Fermenting', measuredOg: 1.058 } });

    const { body: reread } = await getBatch(batch.id);
    expect(reread.statsSnapshot).toEqual(atCreation.statsSnapshot);
    expect(reread.recipeSnapshot).toEqual(atCreation.recipeSnapshot);
  });

  it('batchRepository.update()\'s .set() literal names neither snapshot column', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/repositories/batchRepository.ts'), 'utf-8');
    // Isolate the `update()` method body and confirm its `.set({...})` block
    // never names either snapshot column.
    const updateFnMatch = source.match(/async update\([\s\S]*?\n  \},/);
    expect(updateFnMatch).not.toBeNull();
    expect(updateFnMatch![0]).not.toMatch(/statsSnapshot:|recipeSnapshot:/);
  });
});

describe('AC-41: exactly one source of truth for statuses', () => {
  it('no second hand-maintained transition list or status-options array exists', () => {
    const routesDir = path.join(__dirname, '../src/routes');
    const batchesSource = fs.readFileSync(path.join(routesDir, 'batches.ts'), 'utf-8');
    const schemasSource = fs.readFileSync(path.join(routesDir, 'schemas.ts'), 'utf-8');
    expect(batchesSource).not.toMatch(/ALLOWED_TRANSITIONS/);
    expect(schemasSource).not.toMatch(/ALLOWED_TRANSITIONS/);
    expect(batchesSource).not.toMatch(/BATCH_STATUS_OPTIONS/);
    // The route's status-transition rejection is driven by canTransitionBatchStatus.
    expect(batchesSource).toMatch(/canTransitionBatchStatus/);
    // schemas.ts derives the enum from BATCH_STATUSES rather than a literal array.
    expect(schemasSource).toMatch(/BATCH_STATUSES/);
  });
});

describe('AC-42: the stale M4-era comment is corrected', () => {
  it('batches.ts no longer claims Fermenting/Conditioning/Completed are rejected', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/routes/batches.ts'), 'utf-8');
    expect(source).not.toMatch(/Fermenting\/Conditioning\/Completed/);
  });
});
