import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';

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

describe('foreign keys are enforced (AC-17)', () => {
  it('PRAGMA foreign_keys is 1 and /api/health reports it', async () => {
    const pragmaValue = handle.db.$client.pragma('foreign_keys', { simple: true });
    expect(pragmaValue).toBe(1);

    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.foreignKeys).toBe(1);
  });
});

describe('every non-2xx response is a well-formed ApiErrorBody', () => {
  it('404 on an unmatched route is JSON, not HTML or a bare string', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/totally-not-a-route' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(typeof body.error.code).toBe('string');
    expect(typeof body.error.message).toBe('string');
  });

  it('GET /api/recipes?q= matching nothing returns 200 [], never 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/recipes?q=definitely-not-a-match-xyz' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('POST /api/equipment-profiles with a malformed body returns 400 VALIDATION_FAILED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/equipment-profiles',
      payload: { name: 'Bad' }, // missing every other required field
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('empty recipe with zero line items round-trips', () => {
  it('saves and reads back successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: {
        name: 'Empty',
        author: '',
        styleName: '',
        notes: '',
        equipmentId: 'eq-1',
        fermentables: [],
        hops: [],
        yeasts: [],
        miscs: [],
        // M3_P2: mashProfileId/fermentationProfileId became required keys on
        // RecipeWriteInput (nullable values) — this literal predates that
        // change and would otherwise 400 for a reason unrelated to what this
        // test verifies. See the executor's handoff report ("Known execution
        // risks" — every API test that posts a recipe body needed the two
        // new keys).
        mashProfileId: null,
        fermentationProfileId: null,
        waterSourceId: null,
        waterTargetId: null,
      },
    });
    expect(res.statusCode).toBe(201);
    const created = JSON.parse(res.body);
    expect(created.fermentables).toEqual([]);
    expect(created.hops).toEqual([]);
    expect(created.yeasts).toEqual([]);
    expect(created.miscs).toEqual([]);
  });
});
