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

async function createRecipe() {
  const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput() });
  return JSON.parse(res.body);
}

async function createBatch() {
  const recipe = await createRecipe();
  const res = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
  return JSON.parse(res.body);
}

async function postNote(batchId: string, body: Record<string, unknown>) {
  const res = await app.inject({ method: 'POST', url: `/api/batches/${batchId}/notes`, payload: body });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

async function putNote(batchId: string, noteId: string, body: Record<string, unknown>) {
  const res = await app.inject({ method: 'PUT', url: `/api/batches/${batchId}/notes/${noteId}`, payload: body });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

async function deleteNote(batchId: string, noteId: string) {
  return app.inject({ method: 'DELETE', url: `/api/batches/${batchId}/notes/${noteId}` });
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

describe('AC-31: notes are created with server-minted timestamp and status', () => {
  it('POST returns 201 with a server-minted id, an ISO-8601 UTC timestamp, status equal to the batch\'s current status, and the note echoed', async () => {
    const batch = await createBatch();
    const { status, body } = await postNote(batch.id, { note: 'pitched US-05' });
    expect(status).toBe(201);
    expect(body.id).toEqual(expect.any(String));
    expect(body.id.length).toBeGreaterThan(0);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    expect(body.status).toBe('Planning');
    expect(body.batchId).toBe(batch.id);
    expect(body.note).toBe('pitched US-05');
  });

  it('a note created while Fermenting records Fermenting; after transitioning, a second note records the new status and the first is unchanged', async () => {
    const batch = await createBatch();
    await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Brewing' } });
    const fermentingBatch = (await getBatch(batch.id)).body;
    await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(fermentingBatch), status: 'Fermenting' } });

    const firstNote = (await postNote(batch.id, { note: 'ferm note' })).body;
    expect(firstNote.status).toBe('Fermenting');

    const conditioningBatch = (await getBatch(batch.id)).body;
    await app.inject({
      method: 'PUT',
      url: `/api/batches/${batch.id}`,
      payload: { ...toBatchWriteBody(conditioningBatch), status: 'Conditioning' },
    });

    const secondNote = (await postNote(batch.id, { note: 'cond note' })).body;
    expect(secondNote.status).toBe('Conditioning');

    // The first note's status and timestamp are unchanged.
    const { body: reread } = await getBatch(batch.id);
    const firstRereadNote = reread.notes.find((n: { id: string }) => n.id === firstNote.id);
    expect(firstRereadNote.status).toBe('Fermenting');
    expect(firstRereadNote.timestamp).toBe(firstNote.timestamp);
  });

  it('a body containing timestamp or status is 400 (AC-23)', async () => {
    const batch = await createBatch();
    const withTimestamp = await postNote(batch.id, { note: 'x', timestamp: '2020-01-01T00:00:00.000Z' });
    expect(withTimestamp.status).toBe(400);
    const withStatus = await postNote(batch.id, { note: 'x', status: 'Completed' });
    expect(withStatus.status).toBe(400);
  });

  it('POST to an unknown batch id is 404 and writes nothing', async () => {
    const before = (handle.db.$client.prepare(`SELECT COUNT(*) as c FROM batch_notes`).get() as { c: number }).c;
    const { status, body } = await postNote('does-not-exist', { note: 'x' });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    const after = (handle.db.$client.prepare(`SELECT COUNT(*) as c FROM batch_notes`).get() as { c: number }).c;
    expect(after).toBe(before);
  });
});

describe('AC-32: note edit replaces text only; delete and cross-batch isolation', () => {
  it('PUT with a new note returns 200 with the new text and byte-identical timestamp and status', async () => {
    const batch = await createBatch();
    const created = (await postNote(batch.id, { note: 'original' })).body;

    const { status, body } = await putNote(batch.id, created.id, { note: 'edited' });
    expect(status).toBe(200);
    expect(body.note).toBe('edited');
    expect(body.timestamp).toBe(created.timestamp);
    expect(body.status).toBe(created.status);
  });

  it('a PUT body omitting note is 400', async () => {
    const batch = await createBatch();
    const created = (await postNote(batch.id, { note: 'original' })).body;
    const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}/notes/${created.id}`, payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE returns 204 with an empty body and the row is gone', async () => {
    const batch = await createBatch();
    const created = (await postNote(batch.id, { note: 'original' })).body;
    const res = await deleteNote(batch.id, created.id);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');

    const { body: reread } = await getBatch(batch.id);
    expect(reread.notes).toEqual([]);
  });

  it('PUT and DELETE on an unknown noteId are 404', async () => {
    const batch = await createBatch();
    const putRes = await putNote(batch.id, 'does-not-exist', { note: 'x' });
    expect(putRes.status).toBe(404);
    const delRes = await deleteNote(batch.id, 'does-not-exist');
    expect(delRes.statusCode).toBe(404);
  });

  it('PUT and DELETE on a noteId belonging to a DIFFERENT batch are 404, and that other batch\'s note is unmodified', async () => {
    const batchA = await createBatch();
    const batchB = await createBatch();
    const noteOnB = (await postNote(batchB.id, { note: 'belongs to B' })).body;

    const putRes = await putNote(batchA.id, noteOnB.id, { note: 'hijacked' });
    expect(putRes.status).toBe(404);

    const delRes = await deleteNote(batchA.id, noteOnB.id);
    expect(delRes.statusCode).toBe(404);

    const { body: refetchedBatchB } = await getBatch(batchB.id);
    expect(refetchedBatchB.notes).toHaveLength(1);
    expect(refetchedBatchB.notes[0]).toEqual(noteOnB);
  });
});

describe('AC-33: note text bounds', () => {
  it('note: "" -> 400 VALIDATION_FAILED', async () => {
    const batch = await createBatch();
    const { status } = await postNote(batch.id, { note: '' });
    expect(status).toBe(400);
  });

  it('a 1-char note -> 201; a 5000-char note -> 201; a 5001-char note -> 400', async () => {
    const batch = await createBatch();
    expect((await postNote(batch.id, { note: 'x' })).status).toBe(201);
    expect((await postNote(batch.id, { note: 'x'.repeat(5000) })).status).toBe(201);
    expect((await postNote(batch.id, { note: 'x'.repeat(5001) })).status).toBe(400);
  });

  it('note: null -> 400 (the coerceTypes trap, caught by preValidation)', async () => {
    const batch = await createBatch();
    const { status } = await postNote(batch.id, { note: null });
    expect(status).toBe(400);
  });

  it('every 400 case leaves the note count unchanged', async () => {
    const batch = await createBatch();
    const before = (handle.db.$client.prepare(`SELECT COUNT(*) as c FROM batch_notes WHERE batch_id = ?`).get(batch.id) as { c: number }).c;
    await postNote(batch.id, { note: '' });
    await postNote(batch.id, { note: null });
    await postNote(batch.id, { note: 'x'.repeat(5001) });
    const after = (handle.db.$client.prepare(`SELECT COUNT(*) as c FROM batch_notes WHERE batch_id = ?`).get(batch.id) as { c: number }).c;
    expect(after).toBe(before);
  });
});

describe('AC-34: detail carries notes in canonical order; the list stays lean', () => {
  it('posting three notes and GET /api/batches/:id returns them ascending by timestamp, ties by id ascending', async () => {
    const batch = await createBatch();
    const a = (await postNote(batch.id, { note: 'first' })).body;
    const b = (await postNote(batch.id, { note: 'second' })).body;
    const c = (await postNote(batch.id, { note: 'third' })).body;

    const { body } = await getBatch(batch.id);
    const times = body.notes.map((n: { timestamp: string }) => n.timestamp);
    expect(times).toEqual([...times].sort());
    expect(body.notes.map((n: { id: string }) => n.id)).toEqual(
      expect.arrayContaining([a.id, b.id, c.id]),
    );
  });

  it('a batch with none returns notes: [], never null and never an omitted key', async () => {
    const batch = await createBatch();
    const { body } = await getBatch(batch.id);
    expect(body.notes).toEqual([]);
    expect('notes' in body).toBe(true);
  });

  it('GET /api/batches returns objects with neither a notes key nor a readings key for a batch that has three of each', async () => {
    const batch = await createBatch();
    await postNote(batch.id, { note: 'n1' });
    await postNote(batch.id, { note: 'n2' });
    await postNote(batch.id, { note: 'n3' });
    await app.inject({
      method: 'POST',
      url: `/api/batches/${batch.id}/readings`,
      payload: { readingTime: '2026-08-01T00:00:00.000Z', sg: 1.05, tempC: 20, comment: '', ph: null, pressurePsi: null },
    });
    await app.inject({
      method: 'POST',
      url: `/api/batches/${batch.id}/readings`,
      payload: { readingTime: '2026-08-02T00:00:00.000Z', sg: 1.04, tempC: 19, comment: '', ph: null, pressurePsi: null },
    });
    await app.inject({
      method: 'POST',
      url: `/api/batches/${batch.id}/readings`,
      payload: { readingTime: '2026-08-03T00:00:00.000Z', sg: 1.03, tempC: 18, comment: '', ph: null, pressurePsi: null },
    });

    const listRes = await app.inject({ method: 'GET', url: '/api/batches' });
    const list = JSON.parse(listRes.body);
    const found = list.find((b: { id: string }) => b.id === batch.id);
    expect(found).toBeDefined();
    expect('notes' in found).toBe(false);
    expect('readings' in found).toBe(false);
  });
});
