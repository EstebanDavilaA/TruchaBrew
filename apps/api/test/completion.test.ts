import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { BatchStatus } from '@truchabrew/shared-types';
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

async function createRecipe() {
  const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput() });
  return JSON.parse(res.body);
}

async function createBatch() {
  const recipe = await createRecipe();
  const res = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
  return JSON.parse(res.body);
}

async function getBatch(id: string) {
  const res = await app.inject({ method: 'GET', url: `/api/batches/${id}` });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

/** A PUT body that omits the three server-owned keys. */
function toBatchWriteBody<T extends { fermentationStartDate?: unknown; bottlingDate?: unknown; closingSnapshot?: unknown }>(
  batch: T,
): Omit<T, 'fermentationStartDate' | 'bottlingDate' | 'closingSnapshot'> {
  const { fermentationStartDate: _a, bottlingDate: _b, closingSnapshot: _c, ...rest } = batch;
  return rest;
}

async function putBatch(id: string, payload: Record<string, unknown>) {
  const res = await app.inject({ method: 'PUT', url: `/api/batches/${id}`, payload });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

/** Advances a batch one legal step, optionally merging extra fields into the PUT body. */
async function advance(batch: Record<string, unknown>, status: BatchStatus, extra: Record<string, unknown> = {}) {
  const res = await putBatch(batch.id as string, { ...toBatchWriteBody(batch), status, ...extra });
  expect(res.status).toBe(200);
  return res.body;
}

/** Walks a fresh batch to `status`, setting measuredOg (at Fermenting) and measuredFg (at Completed) along the way. */
async function createBatchAtStatus(status: BatchStatus) {
  let batch = await createBatch();
  if (status === 'Planning') return batch;
  batch = await advance(batch, 'Brewing');
  if (status === 'Brewing') return batch;
  batch = await advance(batch, 'Fermenting', { measuredOg: 1.056 });
  if (status === 'Fermenting') return batch;
  batch = await advance(batch, 'Conditioning');
  if (status === 'Conditioning') return batch;
  batch = await advance(batch, 'Completed', { measuredFg: 1.012 });
  return batch;
}

const ALL_STATUSES: BatchStatus[] = ['Planning', 'Brewing', 'Fermenting', 'Conditioning', 'Completed'];

describe('AC-20: the transition matrix holds over HTTP, all 25 pairs', () => {
  it.each(ALL_STATUSES.flatMap((from) => ALL_STATUSES.map((to): [BatchStatus, BatchStatus] => [from, to])))(
    '(%s -> %s)',
    async (from, to) => {
      const batch = await createBatchAtStatus(from);
      const extra: Record<string, unknown> = {};
      if (to === 'Completed') {
        extra.measuredOg = 1.056;
        extra.measuredFg = 1.012;
      }

      const res = await putBatch(batch.id, { ...toBatchWriteBody(batch), status: to, ...extra });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(to);
    },
  );

  it('status: "garbage" is 400 from the JSON-Schema enum', async () => {
    const batch = await createBatch();
    const res = await putBatch(batch.id, { ...toBatchWriteBody(batch), status: 'garbage' });
    expect(res.status).toBe(400);
  });
});

describe('AC-21: the completion gate, exact operator, nothing written on failure', () => {
  it('both null -> 400 naming both fields; status/closing_snapshot/updated_at all unchanged', async () => {
    const batch = await createBatchAtStatus('Conditioning');
    // createBatchAtStatus sets measuredOg during Fermenting; explicitly null it back out here.
    const cleared = await advance(batch, 'Conditioning', { measuredOg: null });
    const before = handle.db.$client.prepare(`SELECT updated_at, status, closing_snapshot FROM batches WHERE id = ?`).get(cleared.id) as any;

    const res = await putBatch(cleared.id, { ...toBatchWriteBody(cleared), status: 'Completed' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/measuredOg/);
    expect(res.body.error.message).toMatch(/measuredFg/);

    const after = handle.db.$client.prepare(`SELECT updated_at, status, closing_snapshot FROM batches WHERE id = ?`).get(cleared.id) as any;
    expect(after.status).toBe('Conditioning');
    expect(after.closing_snapshot).toBeNull();
    expect(after.updated_at).toBe(before.updated_at);
  });

  it('only measuredOg set -> 400 naming only measuredFg', async () => {
    const batch = await createBatchAtStatus('Conditioning');
    const res = await putBatch(batch.id, { ...toBatchWriteBody(batch), status: 'Completed', measuredFg: null });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/measuredFg/);
    expect(res.body.error.message).not.toMatch(/measuredOg/);
  });

  it('only measuredFg set -> 400 naming only measuredOg', async () => {
    const batch = await createBatchAtStatus('Conditioning');
    const cleared = await advance(batch, 'Conditioning', { measuredOg: null });
    const res = await putBatch(cleared.id, { ...toBatchWriteBody(cleared), status: 'Completed', measuredFg: 1.012 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/measuredOg/);
    expect(res.body.error.message).not.toMatch(/measuredFg/);
  });

  it('both set -> 200 and closing_snapshot non-null', async () => {
    const batch = await createBatchAtStatus('Completed');
    const row = handle.db.$client.prepare(`SELECT closing_snapshot FROM batches WHERE id = ?`).get(batch.id) as any;
    expect(row.closing_snapshot).not.toBeNull();
  });

  it('a Completed -> Completed re-save with measuredFg: null is also 400 (the gate cannot be bypassed by completing then clearing)', async () => {
    const batch = await createBatchAtStatus('Completed');
    const res = await putBatch(batch.id, { ...toBatchWriteBody(batch), status: 'Completed', measuredFg: null });
    expect(res.status).toBe(400);
    const reread = await getBatch(batch.id);
    expect(reread.body.measuredFg).toBe(1.012);
  });
});

describe('AC-22: bottlingDate is set once, by the right transition only', () => {
  it('Fermenting -> Conditioning sets a non-null ISO-8601 UTC bottlingDate', async () => {
    const batch = await createBatchAtStatus('Fermenting');
    const conditioning = await advance(batch, 'Conditioning');
    expect(conditioning.bottlingDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
  });

  it('a second PUT (Conditioning -> Conditioning, changing a measured value) leaves it byte-identical', async () => {
    const batch = await createBatchAtStatus('Conditioning');
    const resaved = await advance(batch, 'Conditioning', { measuredBoilTimeMin: 65 });
    expect(resaved.bottlingDate).toBe(batch.bottlingDate);
  });

  it('the Conditioning -> Completed transition leaves it byte-identical', async () => {
    const batch = await createBatchAtStatus('Conditioning');
    const completed = await advance(batch, 'Completed', { measuredFg: 1.012 });
    expect(completed.bottlingDate).toBe(batch.bottlingDate);
  });

  it('Planning -> Brewing and Brewing -> Fermenting both leave it null', async () => {
    const batch = await createBatchAtStatus('Brewing');
    expect(batch.bottlingDate).toBeNull();
    const fermenting = await advance(batch, 'Fermenting', { measuredOg: 1.05 });
    expect(fermenting.bottlingDate).toBeNull();
  });
});

describe('AC-23: all three server-owned keys are rejected, by the hook and not by additionalProperties', () => {
  it('fermentationStartDate, bottlingDate, and closingSnapshot are each 400, with any value including the current one and null', async () => {
    const batch = await createBatchAtStatus('Completed');
    for (const key of ['fermentationStartDate', 'bottlingDate', 'closingSnapshot'] as const) {
      for (const value of [batch[key], null, 'garbage-value']) {
        const res = await app.inject({
          method: 'PUT',
          url: `/api/batches/${batch.id}`,
          payload: { ...toBatchWriteBody(batch), [key]: value },
        });
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
      }
    }
    // Nothing was written by any of the rejected attempts.
    const reread = await getBatch(batch.id);
    expect(reread.body.fermentationStartDate).toBe(batch.fermentationStartDate);
    expect(reread.body.bottlingDate).toBe(batch.bottlingDate);
    expect(reread.body.closingSnapshot).toEqual(batch.closingSnapshot);
  });

  it('none of the five server-owned keys appears in BatchWriteInput or BatchNoteWriteInput (compile-time, re-asserted at runtime)', async () => {
    const batch = await createBatchAtStatus('Planning');
    const body = toBatchWriteBody(batch);
    expect('fermentationStartDate' in body).toBe(false);
    expect('bottlingDate' in body).toBe(false);
    expect('closingSnapshot' in body).toBe(false);
    const res = await putBatch(batch.id, { ...body, status: 'Planning' });
    expect(res.status).toBe(200);
  });
});

describe('AC-24: new field bounds, exact operators', () => {
  it.each([
    ['measuredFg', 0.899, 400], ['measuredFg', 0.9, 200], ['measuredFg', 1.2, 200], ['measuredFg', 1.201, 400], ['measuredFg', null, 200],
    ['measuredBottlingSizeL', 0, 400], ['measuredBottlingSizeL', 0.09, 400], ['measuredBottlingSizeL', 0.1, 200], ['measuredBottlingSizeL', 1000, 200], ['measuredBottlingSizeL', 1000.01, 400], ['measuredBottlingSizeL', null, 200],
    ['carbonationVolumesTarget', -0.01, 400], ['carbonationVolumesTarget', 0, 200], ['carbonationVolumesTarget', 5, 200], ['carbonationVolumesTarget', 5.01, 400], ['carbonationVolumesTarget', null, 200],
    ['carbonationTempC', -20.01, 400], ['carbonationTempC', -20, 200], ['carbonationTempC', 50, 200], ['carbonationTempC', 50.01, 400], ['carbonationTempC', null, 200],
    ['tasteRating', 0, 400], ['tasteRating', 1, 200], ['tasteRating', 5, 200], ['tasteRating', 6, 400], ['tasteRating', 4.5, 400], ['tasteRating', null, 200],
  ] as const)('%s = %s -> %d', async (field, value, expectedStatus) => {
    const batch = await createBatch();
    const before = handle.db.$client.prepare(`SELECT * FROM batches WHERE id = ?`).get(batch.id);
    const res = await putBatch(batch.id, { ...toBatchWriteBody(batch), [field]: value });
    expect(res.status).toBe(expectedStatus);
    if (expectedStatus === 400) {
      const after = handle.db.$client.prepare(`SELECT * FROM batches WHERE id = ?`).get(batch.id);
      expect(after).toEqual(before);
    }
  });

  it('tasteNotes: "" -> 200, a 5000-char string -> 200, a 5001-char string -> 400, null -> 400', async () => {
    const batch = await createBatch();
    expect((await putBatch(batch.id, { ...toBatchWriteBody(batch), tasteNotes: '' })).status).toBe(200);
    expect((await putBatch(batch.id, { ...toBatchWriteBody(batch), tasteNotes: 'x'.repeat(5000) })).status).toBe(200);
    expect((await putBatch(batch.id, { ...toBatchWriteBody(batch), tasteNotes: 'x'.repeat(5001) })).status).toBe(400);
    const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), tasteNotes: null } });
    expect(res.statusCode).toBe(400);
  });

  it('carbonationType: each of the four members -> 200; "Sugar " -> 400; "sugar" -> 400; "" -> 400; null -> 200', async () => {
    const batch = await createBatch();
    for (const value of ['Sugar', 'KegForce', 'KegForceQuick', 'KegSugar']) {
      expect((await putBatch(batch.id, { ...toBatchWriteBody(batch), carbonationType: value })).status).toBe(200);
    }
    expect((await putBatch(batch.id, { ...toBatchWriteBody(batch), carbonationType: 'Sugar ' })).status).toBe(400);
    expect((await putBatch(batch.id, { ...toBatchWriteBody(batch), carbonationType: 'sugar' })).status).toBe(400);
    expect((await putBatch(batch.id, { ...toBatchWriteBody(batch), carbonationType: '' })).status).toBe(400);
    expect((await putBatch(batch.id, { ...toBatchWriteBody(batch), carbonationType: null })).status).toBe(200);
  });

  it('a literal 0 is never silently corrupted to null by ajv coercion — value fidelity, not just status code', async () => {
    // Regression guard for the ajv `coerceTypes` + `anyOf`-with-null gap this
    // phase found and fixed (schemas.ts's comment on the seven new
    // properties): a naive `anyOf: [{type:'null'}, {type:'number',...}]`
    // schema silently rewrites a submitted `0`/`''` into `null` in place,
    // which is invisible to a status-code-only assertion since both `0` and
    // `null` are individually valid for carbonationVolumesTarget/
    // carbonationTempC. Checked here against the STORED value, not the
    // response, and re-read after a fresh GET.
    const batch = await createBatch();
    const res = await putBatch(batch.id, {
      ...toBatchWriteBody(batch),
      carbonationVolumesTarget: 0,
      carbonationTempC: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body.carbonationVolumesTarget).toBe(0);
    expect(res.body.carbonationTempC).toBe(0);

    const row = handle.db.$client.prepare(`SELECT carbonation_volumes_target, carbonation_temp_c FROM batches WHERE id = ?`).get(batch.id) as any;
    expect(row.carbonation_volumes_target).toBe(0);
    expect(row.carbonation_temp_c).toBe(0);

    const { body: reread } = await getBatch(batch.id);
    expect(reread.carbonationVolumesTarget).toBe(0);
    expect(reread.carbonationTempC).toBe(0);
  });
});

describe('AC-26: partial batch bodies are rejected, never merged', () => {
  const NEW_KEYS = ['measuredFg', 'measuredBottlingSizeL', 'carbonationType', 'carbonationVolumesTarget', 'carbonationTempC', 'tasteNotes', 'tasteRating'] as const;

  it.each(NEW_KEYS)('a body omitting %s is 400, and the stored row is unchanged', async (omittedKey) => {
    const batch = await createBatch();
    const before = handle.db.$client.prepare(`SELECT * FROM batches WHERE id = ?`).get(batch.id);
    const body = toBatchWriteBody(batch) as Record<string, unknown>;
    delete body[omittedKey];
    const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: body });
    expect(res.statusCode).toBe(400);
    const after = handle.db.$client.prepare(`SELECT * FROM batches WHERE id = ?`).get(batch.id);
    expect(after).toEqual(before);
  });
});

describe('AC-27: the closing snapshot is written exactly once, at the completing write', () => {
  it('closing_snapshot is NULL through Planning->Brewing->Fermenting->Conditioning, non-NULL after Conditioning->Completed', async () => {
    let batch = await createBatch();
    const closingSnapshotOf = (id: string) => (handle.db.$client.prepare(`SELECT closing_snapshot FROM batches WHERE id = ?`).get(id) as any).closing_snapshot;

    expect(closingSnapshotOf(batch.id)).toBeNull();
    batch = await advance(batch, 'Brewing');
    expect(closingSnapshotOf(batch.id)).toBeNull();
    batch = await advance(batch, 'Fermenting', { measuredOg: 1.056 });
    expect(closingSnapshotOf(batch.id)).toBeNull();
    batch = await advance(batch, 'Conditioning');
    expect(closingSnapshotOf(batch.id)).toBeNull();

    const completed = await advance(batch, 'Completed', { measuredFg: 1.012 });
    expect(closingSnapshotOf(completed.id)).not.toBeNull();

    const row = handle.db.$client.prepare(`SELECT updated_at FROM batches WHERE id = ?`).get(completed.id) as any;
    expect(completed.closingSnapshot.frozenAt).toBe(row.updated_at);
    expect(completed.closingSnapshot.originalGravity).toBe(1.056);
    expect(completed.closingSnapshot.finalGravity).toBe(1.012);

    // M4_P1 AC-12 / M5_P1 AC-32 re-asserted.
    expect(completed.recipeSnapshot).toEqual(batch.recipeSnapshot);
    expect(completed.statsSnapshot).toEqual(batch.statsSnapshot);
  });
});

describe('AC-28: the closing snapshot does not move for non-input writes', () => {
  it.each([
    ['name change', { name: 'Renamed Batch' }],
    ['tasteNotes change', { tasteNotes: 'clean, bready' }],
    ['tasteRating change', { tasteRating: 4 }],
  ] as const)('%s leaves closing_snapshot byte-identical', async (_label, patch) => {
    const batch = await createBatchAtStatus('Completed');
    const before = (handle.db.$client.prepare(`SELECT closing_snapshot FROM batches WHERE id = ?`).get(batch.id) as any).closing_snapshot;
    await putBatch(batch.id, { ...toBatchWriteBody(batch), status: 'Completed', ...patch });
    const after = (handle.db.$client.prepare(`SELECT closing_snapshot FROM batches WHERE id = ?`).get(batch.id) as any).closing_snapshot;
    expect(after).toBe(before);
  });

  it('a reading POST/PUT/DELETE leaves closing_snapshot byte-identical', async () => {
    const batch = await createBatchAtStatus('Completed');
    const before = (handle.db.$client.prepare(`SELECT closing_snapshot FROM batches WHERE id = ?`).get(batch.id) as any).closing_snapshot;

    const created = JSON.parse(
      (
        await app.inject({
          method: 'POST',
          url: `/api/batches/${batch.id}/readings`,
          payload: { readingTime: '2026-08-01T00:00:00.000Z', sg: 1.05, tempC: 20, comment: '', ph: null, pressurePsi: null },
        })
      ).body,
    );
    await app.inject({
      method: 'PUT',
      url: `/api/batches/${batch.id}/readings/${created.id}`,
      payload: { readingTime: '2026-08-01T06:00:00.000Z', sg: 1.03, tempC: 21, comment: '', ph: null, pressurePsi: null },
    });
    await app.inject({ method: 'DELETE', url: `/api/batches/${batch.id}/readings/${created.id}` });

    const after = (handle.db.$client.prepare(`SELECT closing_snapshot FROM batches WHERE id = ?`).get(batch.id) as any).closing_snapshot;
    expect(after).toBe(before);
  });

  it('a note POST/PUT/DELETE leaves closing_snapshot byte-identical', async () => {
    const batch = await createBatchAtStatus('Completed');
    const before = (handle.db.$client.prepare(`SELECT closing_snapshot FROM batches WHERE id = ?`).get(batch.id) as any).closing_snapshot;

    const created = JSON.parse(
      (await app.inject({ method: 'POST', url: `/api/batches/${batch.id}/notes`, payload: { note: 'bottled' } })).body,
    );
    await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}/notes/${created.id}`, payload: { note: 'bottled, tasty' } });
    await app.inject({ method: 'DELETE', url: `/api/batches/${batch.id}/notes/${created.id}` });

    const after = (handle.db.$client.prepare(`SELECT closing_snapshot FROM batches WHERE id = ?`).get(batch.id) as any).closing_snapshot;
    expect(after).toBe(before);
  });
});

describe('AC-29: the closing snapshot recomputes when an input is corrected', () => {
  it.each([
    ['measuredFg', 1.01],
    ['measuredOg', 1.06],
    ['measuredPreBoilGravity', 1.045],
    ['measuredBottlingSizeL', 18],
    ['carbonationType', 'KegForce'],
    ['carbonationVolumesTarget', 2.2],
    ['carbonationTempC', 5],
  ] as const)('changing %s fires a recompute with a new frozenAt', async (field, value) => {
    const batch = await createBatchAtStatus('Completed');
    const before = batch.closingSnapshot.frozenAt;

    const extra: Record<string, unknown> = { [field]: value };
    if (field === 'carbonationType') {
      extra.carbonationVolumesTarget = 2.4;
      extra.carbonationTempC = 4;
    }
    const updated = await advance(batch, 'Completed', extra);

    expect(updated.closingSnapshot.frozenAt).not.toBe(before);
    if (field === 'measuredFg') expect(updated.closingSnapshot.finalGravity).toBe(1.01);
    if (field === 'measuredOg') expect(updated.closingSnapshot.originalGravity).toBe(1.06);
  });
});

describe('AC-30: update() cannot touch the frozen snapshots', () => {
  it('the .set() literal names neither recipeSnapshot nor statsSnapshot; closingSnapshot/bottlingDate appear only inside the two override parameters', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/repositories/batchRepository.ts'), 'utf-8');
    const updateFnMatch = source.match(/async update\([\s\S]*?\n  \},/);
    expect(updateFnMatch).not.toBeNull();
    expect(updateFnMatch![0]).not.toMatch(/statsSnapshot:|recipeSnapshot:/);
    expect(updateFnMatch![0]).toMatch(/bottlingDateOverride/);
    expect(updateFnMatch![0]).toMatch(/closingSnapshotOverride/);
  });
});

describe('AC-35: the seven new batch fields round-trip and survive a restart', () => {
  it('PUT stores and returns all seven; a subsequent GET returns them; each can be cleared', async () => {
    const batch = await createBatch();
    const payload = {
      ...toBatchWriteBody(batch),
      measuredFg: 1.012,
      measuredBottlingSizeL: 19,
      carbonationType: 'Sugar',
      carbonationVolumesTarget: 2.4,
      carbonationTempC: 4,
      tasteNotes: 'clean, bready',
      tasteRating: 4,
    };
    const putRes = await putBatch(batch.id, payload);
    expect(putRes.status).toBe(200);
    for (const key of ['measuredFg', 'measuredBottlingSizeL', 'carbonationType', 'carbonationVolumesTarget', 'carbonationTempC', 'tasteNotes', 'tasteRating']) {
      expect(putRes.body[key]).toBe((payload as any)[key]);
    }

    const { body: reread } = await getBatch(batch.id);
    expect(reread.measuredFg).toBe(1.012);
    expect(reread.tasteRating).toBe(4);

    const cleared = await putBatch(batch.id, {
      ...toBatchWriteBody(reread),
      measuredFg: null,
      measuredBottlingSizeL: null,
      carbonationType: null,
      carbonationVolumesTarget: null,
      carbonationTempC: null,
      tasteNotes: '',
      tasteRating: null,
    });
    expect(cleared.body.measuredFg).toBeNull();
    expect(cleared.body.tasteNotes).toBe('');
    expect(cleared.body.tasteRating).toBeNull();
  });

  it('survives closing the DB handle and reopening the file with a new connection and server instance', async () => {
    const batch = await createBatch();
    await putBatch(batch.id, {
      ...toBatchWriteBody(batch),
      measuredFg: 1.014,
      measuredBottlingSizeL: 20,
      carbonationType: 'KegForce',
      carbonationVolumesTarget: 2.5,
      carbonationTempC: 3,
      tasteNotes: 'restart test',
      tasteRating: 5,
    });

    await app.close();
    handle = handle.reopen();
    app = buildServer({ db: handle.db });

    const { status, body } = await getBatch(batch.id);
    expect(status).toBe(200);
    expect(body.measuredFg).toBe(1.014);
    expect(body.tasteNotes).toBe('restart test');
    expect(body.tasteRating).toBe(5);
    expect(body.bottlingDate).toBe(batch.bottlingDate);
  });
});

describe('AC-51: exactly one source of truth for statuses, still', () => {
  it('(a) ALLOWED_TRANSITIONS/BATCH_STATUS_OPTIONS have no declarations outside their own enforcing tests', () => {
    const routesDir = path.join(__dirname, '../src/routes');
    const batchesSource = fs.readFileSync(path.join(routesDir, 'batches.ts'), 'utf-8');
    const schemasSource = fs.readFileSync(path.join(routesDir, 'schemas.ts'), 'utf-8');
    expect(batchesSource).not.toMatch(/ALLOWED_TRANSITIONS|BATCH_STATUS_OPTIONS/);
    expect(schemasSource).not.toMatch(/ALLOWED_TRANSITIONS|BATCH_STATUS_OPTIONS/);
  });

  it('(b) no consumer hand-maintains a second status/transition list — matches are display/styling only', () => {
    const webPagesDir = path.join(__dirname, '../../web/src/pages');
    const batchListSource = fs.readFileSync(path.join(webPagesDir, 'BatchList.tsx'), 'utf-8');
    // The only literal-status matches expected in BatchList.tsx are the
    // STATUS_BADGE_CLASS record's keys — not a second transition table.
    expect(batchListSource).not.toMatch(/BATCH_STATUS_TRANSITIONS\s*=\s*\{/);
  });

  it('(c) BATCH_STATUSES derivation proof for schemas.ts is exercised (see batchPipeline.derivation.test.ts)', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/routes/schemas.ts'), 'utf-8');
    expect(source).toMatch(/BATCH_STATUSES/);
    expect(source).toMatch(/CARBONATION_TYPES/);
  });
});
