import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { canonicalRecipeJson } from './helpers/canonical';
import { fullRecipeInput, emptyRecipeInput } from './helpers/fixtures';

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

async function createRecipe(body: ReturnType<typeof fullRecipeInput>) {
  const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: body });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

describe('create / read round-trip', () => {
  it('AC-21: POST then GET are canonically identical', async () => {
    const { status, body: created } = await createRecipe(fullRecipeInput());
    expect(status).toBe(201);

    const res = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    expect(res.statusCode).toBe(200);
    const fetched = JSON.parse(res.body);

    expect(canonicalRecipeJson(fetched)).toBe(canonicalRecipeJson(created));
  });
});

describe('line-item ordering (AC-25)', () => {
  it('preserves insertion order', async () => {
    const input = fullRecipeInput({
      fermentables: [
        { name: 'C', type: 'Grain', amountKg: 1, colorSrm: 1, potentialSg: 1.03 },
        { name: 'A', type: 'Grain', amountKg: 2, colorSrm: 2, potentialSg: 1.03 },
        { name: 'B', type: 'Grain', amountKg: 3, colorSrm: 3, potentialSg: 1.03 },
      ],
    });
    const { status, body: created } = await createRecipe(input);
    expect(status).toBe(201);
    expect(created.fermentables.map((f: { name: string }) => f.name)).toEqual(['C', 'A', 'B']);

    const res = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    const fetched = JSON.parse(res.body);
    expect(fetched.fermentables.map((f: { name: string }) => f.name)).toEqual(['C', 'A', 'B']);
  });
});

describe('float precision (AC-26)', () => {
  it('round-trips exactly, not approximately', async () => {
    const input = fullRecipeInput({
      fermentables: [{ name: 'Precise', type: 'Grain', amountKg: 5.005, colorSrm: 1, potentialSg: 1.0375 }],
      hops: [{ name: 'PreciseHop', amountG: 10, alphaAcidPct: 12.35, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' }],
    });
    const { body: created } = await createRecipe(input);
    expect(created.fermentables[0].amountKg).toBe(5.005);
    expect(created.fermentables[0].potentialSg).toBe(1.0375);
    expect(created.hops[0].alphaAcidPct).toBe(12.35);

    const res = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    const fetched = JSON.parse(res.body);
    expect(fetched.fermentables[0].amountKg).toBe(5.005);
    expect(fetched.fermentables[0].potentialSg).toBe(1.0375);
    expect(fetched.hops[0].alphaAcidPct).toBe(12.35);
  });
});

describe('update replaces, does not accumulate (AC-29, AC-30)', () => {
  it('reducing 3 fermentables to 1 leaves exactly 1 row', async () => {
    const input = fullRecipeInput({
      fermentables: [
        { name: 'F1', type: 'Grain', amountKg: 1, colorSrm: 1, potentialSg: 1.03 },
        { name: 'F2', type: 'Grain', amountKg: 2, colorSrm: 1, potentialSg: 1.03 },
        { name: 'F3', type: 'Grain', amountKg: 3, colorSrm: 1, potentialSg: 1.03 },
      ],
    });
    const { body: created } = await createRecipe(input);
    expect(created.fermentables.length).toBe(3);
    const keptId = created.fermentables[0].id;

    const updateBody = {
      ...input,
      fermentables: [{ id: keptId, name: 'F1', type: 'Grain', amountKg: 1.5, colorSrm: 1, potentialSg: 1.03 }],
    };
    const res = await app.inject({ method: 'PUT', url: `/api/recipes/${created.id}`, payload: updateBody });
    expect(res.statusCode).toBe(200);
    const updated = JSON.parse(res.body);

    expect(updated.fermentables.length).toBe(1);
    expect(updated.fermentables[0].id).toBe(keptId); // AC-30: retained id preserved
    expect(updated.fermentables[0].amountKg).toBe(1.5);
  });

  it('AC-30: a newly added item on update gets a fresh id distinct from any client value', async () => {
    const input = fullRecipeInput({ fermentables: [{ name: 'F1', type: 'Grain', amountKg: 1, colorSrm: 1, potentialSg: 1.03 }] });
    const { body: created } = await createRecipe(input);
    const keptId = created.fermentables[0].id;

    const clientInventedId = 'client-invented-id-123';
    const updateBody = {
      ...input,
      fermentables: [
        { id: keptId, name: 'F1', type: 'Grain', amountKg: 1, colorSrm: 1, potentialSg: 1.03 },
        { id: clientInventedId, name: 'F2', type: 'Grain', amountKg: 2, colorSrm: 1, potentialSg: 1.03 },
      ],
    };
    const res = await app.inject({ method: 'PUT', url: `/api/recipes/${created.id}`, payload: updateBody });
    const updated = JSON.parse(res.body);

    expect(updated.fermentables.length).toBe(2);
    const f2 = updated.fermentables.find((f: { name: string }) => f.name === 'F2');
    expect(f2.id).not.toBe(clientInventedId);
  });
});

describe('rename via PATCH (AC-31)', () => {
  it('renames without touching line items', async () => {
    const { body: created } = await createRecipe(fullRecipeInput());
    const res = await app.inject({ method: 'PATCH', url: `/api/recipes/${created.id}`, payload: { name: 'X' } });
    expect(res.statusCode).toBe(200);
    const renamed = JSON.parse(res.body);

    expect(renamed.name).toBe('X');
    expect(renamed.fermentables).toEqual(created.fermentables);
    expect(renamed.hops).toEqual(created.hops);
    expect(renamed.yeasts).toEqual(created.yeasts);
    expect(renamed.miscs).toEqual(created.miscs);
  });
});

describe('duplicate is a deep copy (AC-32)', () => {
  it('produces new ids and independent storage', async () => {
    const { body: created } = await createRecipe(fullRecipeInput());
    const res = await app.inject({ method: 'POST', url: `/api/recipes/${created.id}/duplicate` });
    expect(res.statusCode).toBe(201);
    const copy = JSON.parse(res.body);

    expect(copy.id).not.toBe(created.id);
    expect(copy.name).toBe(`${created.name} (copy)`);
    expect(copy.equipment.id).toBe(created.equipment.id);
    expect(copy.fermentables.map((f: { name: string }) => f.name)).toEqual(created.fermentables.map((f: { name: string }) => f.name));

    const allSourceIds = new Set([
      ...created.fermentables.map((f: { id: string }) => f.id),
      ...created.hops.map((h: { id: string }) => h.id),
      ...created.yeasts.map((y: { id: string }) => y.id),
      ...created.miscs.map((m: { id: string }) => m.id),
    ]);
    for (const item of [...copy.fermentables, ...copy.hops, ...copy.yeasts, ...copy.miscs]) {
      expect(allSourceIds.has(item.id)).toBe(false);
    }

    // Editing the copy leaves the original unchanged in the DB.
    const editBody = {
      name: copy.name,
      author: copy.author,
      styleName: copy.styleName,
      notes: copy.notes,
      equipmentId: copy.equipment.id,
      fermentables: copy.fermentables.map((f: Record<string, unknown>) => ({ ...f, amountKg: 999 })),
      hops: copy.hops,
      yeasts: copy.yeasts,
      miscs: copy.miscs,
      mashProfileId: copy.mashProfile?.id ?? null,
      fermentationProfileId: copy.fermentationProfile?.id ?? null,
      waterSourceId: copy.waterSourceId ?? null,
      waterTargetId: copy.waterTargetId ?? null,
    };
    const editRes = await app.inject({ method: 'PUT', url: `/api/recipes/${copy.id}`, payload: editBody });
    expect(editRes.statusCode).toBe(200);

    const originalRes = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    const original = JSON.parse(originalRes.body);
    expect(original.fermentables[0].amountKg).not.toBe(999);
  });
});

describe('search (AC-33)', () => {
  it('filters case-insensitively over name and styleName; no q returns all; no match returns 200 []', async () => {
    await createRecipe(fullRecipeInput({ name: 'Trucha West Coast IPA', styleName: '21A. American IPA' }));
    await createRecipe(fullRecipeInput({ name: 'Something Else', styleName: 'Not matching either' }));

    const byName = await app.inject({ method: 'GET', url: '/api/recipes?q=ipa' });
    const byNameBody = JSON.parse(byName.body);
    expect(byNameBody.some((r: { name: string }) => r.name === 'Trucha West Coast IPA')).toBe(true);

    const empty = await app.inject({ method: 'GET', url: '/api/recipes?q=' });
    const all = await app.inject({ method: 'GET', url: '/api/recipes' });
    expect(JSON.parse(empty.body).length).toBe(JSON.parse(all.body).length);

    const none = await app.inject({ method: 'GET', url: '/api/recipes?q=zzz-no-match' });
    expect(none.statusCode).toBe(200);
    expect(JSON.parse(none.body)).toEqual([]);
  });
});

describe('unknown recipe id (AC-34)', () => {
  it('GET/PUT/PATCH/DELETE on an unknown id all 404 with a well-formed ApiErrorBody', async () => {
    const unknownId = 'does-not-exist';
    const input = fullRecipeInput();

    for (const req of [
      { method: 'GET' as const, url: `/api/recipes/${unknownId}` },
      { method: 'PUT' as const, url: `/api/recipes/${unknownId}`, payload: input },
      { method: 'PATCH' as const, url: `/api/recipes/${unknownId}`, payload: { name: 'x' } },
      { method: 'DELETE' as const, url: `/api/recipes/${unknownId}` },
    ]) {
      const res = await app.inject(req);
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(typeof body.error.message).toBe('string');
    }
  });
});

describe('unknown equipment id writes nothing (AC-35)', () => {
  it('POST with an unknown equipmentId is 400 and does not create a row', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/recipes' });
    const beforeCount = JSON.parse(before.body).length;

    const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ equipmentId: 'nope' }) });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('EQUIPMENT_NOT_FOUND');

    const after = await app.inject({ method: 'GET', url: '/api/recipes' });
    expect(JSON.parse(after.body).length).toBe(beforeCount);
  });
});

describe('malformed body rejected atomically (AC-36)', () => {
  it('invalid hop use enum is rejected, nothing written', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/recipes' });
    const beforeCount = JSON.parse(before.body).length;

    const badEnum = fullRecipeInput();
    // @ts-expect-error intentionally invalid for the test
    badEnum.hops[0].use = 'Sprinkle';
    const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: badEnum });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');

    const after = await app.inject({ method: 'GET', url: '/api/recipes' });
    expect(JSON.parse(after.body).length).toBe(beforeCount);
  });

  it('missing name is rejected, nothing written', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/recipes' });
    const beforeCount = JSON.parse(before.body).length;

    const missingName = fullRecipeInput() as unknown as Record<string, unknown>;
    delete missingName.name;
    const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: missingName });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');

    const after = await app.inject({ method: 'GET', url: '/api/recipes' });
    expect(JSON.parse(after.body).length).toBe(beforeCount);
  });
});

describe('empty-array recipe is valid (AC-37)', () => {
  it('saves, returns 201, and round-trips through restart with canonical equality', async () => {
    const { status, body: created } = await createRecipe(emptyRecipeInput());
    expect(status).toBe(201);

    const reopened = handle.reopen();
    handle = reopened;
    const app2 = buildServer({ db: reopened.db });
    const res = await app2.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    expect(res.statusCode).toBe(200);
    const fetched = JSON.parse(res.body);
    expect(canonicalRecipeJson(fetched)).toBe(canonicalRecipeJson(created));
    await app2.close();
  });
});
