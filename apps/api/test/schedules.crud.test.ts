import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { MashProfileWriteInput, FermentationProfileWriteInput } from '@truchabrew/shared-types';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { fullRecipeInput } from './helpers/fixtures';

let handle: TestDbHandle;

afterEach(() => {
  handle?.cleanup();
});

async function setupSeeded(): Promise<{ app: FastifyInstance }> {
  handle = createTestDb();
  seedDatabase(handle.db);
  return { app: buildServer({ db: handle.db }) };
}

async function setupUnseeded(): Promise<{ app: FastifyInstance }> {
  handle = createTestDb();
  return { app: buildServer({ db: handle.db }) };
}

function fullMashProfileInput(overrides: Partial<MashProfileWriteInput> = {}): MashProfileWriteInput {
  return {
    name: 'Test Mash Profile',
    targetPh: 5.4,
    spargeTempC: null,
    steps: [
      { name: 'Saccharification Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
    ],
    ...overrides,
  };
}

function fullFermentationProfileInput(overrides: Partial<FermentationProfileWriteInput> = {}): FermentationProfileWriteInput {
  return {
    name: 'Test Fermentation Profile',
    steps: [{ name: 'Primary', type: 'Primary', stepTempC: 19, stepTimeDays: 14, rampDays: 0, pressurePsi: null }],
    ...overrides,
  };
}

async function createMashProfile(app: FastifyInstance, body: MashProfileWriteInput) {
  const res = await app.inject({ method: 'POST', url: '/api/mash-profiles', payload: body });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

async function createFermentationProfile(app: FastifyInstance, body: FermentationProfileWriteInput) {
  const res = await app.inject({ method: 'POST', url: '/api/fermentation-profiles', payload: body });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

async function listMashProfiles(app: FastifyInstance) {
  const res = await app.inject({ method: 'GET', url: '/api/mash-profiles' });
  return JSON.parse(res.body) as Array<Record<string, unknown> & { id: string }>;
}

// ---------------------------------------------------------------------------
// AC-16: seeding
// ---------------------------------------------------------------------------

describe('AC-16: seeding stays idempotent and adds the documented schedules', () => {
  it('seedDatabase run twice yields exactly 2 mash profiles (1-step, 3-step) and 1 fermentation profile (3 steps)', async () => {
    const { app } = await setupSeeded();
    seedDatabase(handle.db); // second pass

    const mashRes = await app.inject({ method: 'GET', url: '/api/mash-profiles' });
    const mashProfiles = JSON.parse(mashRes.body);
    expect(mashProfiles.length).toBe(2);
    const stepCounts = mashProfiles.map((p: { steps: unknown[] }) => p.steps.length).sort((a: number, b: number) => a - b);
    expect(stepCounts).toEqual([1, 3]);

    const fermRes = await app.inject({ method: 'GET', url: '/api/fermentation-profiles' });
    const fermentationProfiles = JSON.parse(fermRes.body);
    expect(fermentationProfiles.length).toBe(1);
    expect(fermentationProfiles[0].steps.length).toBe(3);

    const eqRes = await app.inject({ method: 'GET', url: '/api/equipment-profiles' });
    expect(JSON.parse(eqRes.body).length).toBe(2);

    const recipeRes = await app.inject({ method: 'GET', url: '/api/recipes/rec-sample-1' });
    const recipe = JSON.parse(recipeRes.body);
    expect(recipe.mashProfile).toBeNull();
    expect(recipe.fermentationProfile).toBeNull();

    await app.close();
  });

  it('GET /api/mash-profiles on an empty table returns 200 []', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'GET', url: '/api/mash-profiles' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-17 (roadmap threshold): order preserved through a real restart
// ---------------------------------------------------------------------------

describe('AC-17: a 3-step mash profile round-trips through the DB with step order preserved', () => {
  it('a deliberately non-alphabetical, non-temperature step order survives GET, and survives a real close/reopen', async () => {
    const { app } = await setupUnseeded();

    const input = fullMashProfileInput({
      steps: [
        { name: 'Zebra Step', type: 'Temperature', stepTempC: 72, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
        { name: 'Alpha Step', type: 'Infusion', stepTempC: 52, stepTimeMin: 20, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
        { name: 'Mid Step', type: 'Infusion', stepTempC: 63, stepTimeMin: 5, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
      ],
    });
    const { status, body: created } = await createMashProfile(app, input);
    expect(status).toBe(201);
    expect(created.steps.map((s: { name: string }) => s.name)).toEqual(['Zebra Step', 'Alpha Step', 'Mid Step']);

    const getRes = await app.inject({ method: 'GET', url: '/api/mash-profiles' });
    const fetched = JSON.parse(getRes.body).find((p: { id: string }) => p.id === created.id);
    expect(fetched.steps.map((s: { name: string }) => s.name)).toEqual(['Zebra Step', 'Alpha Step', 'Mid Step']);
    expect(fetched.steps.map((s: { stepTempC: number }) => s.stepTempC)).toEqual([72, 52, 63]);

    await app.close();

    // Close the DB handle and reopen the file with a new connection + server.
    handle = handle.reopen();
    const app2 = buildServer({ db: handle.db });
    const reGetRes = await app2.inject({ method: 'GET', url: '/api/mash-profiles' });
    const reFetched = JSON.parse(reGetRes.body).find((p: { id: string }) => p.id === created.id);
    expect(reFetched.steps.map((s: { name: string }) => s.name)).toEqual(['Zebra Step', 'Alpha Step', 'Mid Step']);
    expect(reFetched.steps.map((s: { stepTempC: number }) => s.stepTempC)).toEqual([72, 52, 63]);

    await app2.close();
  });
});

// ---------------------------------------------------------------------------
// AC-18: dense, 0-based, server-assigned positions
// ---------------------------------------------------------------------------

describe('AC-18: positions are dense, 0-based and server-assigned', () => {
  it('client-supplied position values (7, 3, 99) are ignored — array order wins', async () => {
    const { app } = await setupUnseeded();
    const created = (await createMashProfile(app, fullMashProfileInput({ steps: [] }))).body;

    const stepsWithFakePositions = [
      { position: 7, name: 'Step A', type: 'Infusion', stepTempC: 50, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
      { position: 3, name: 'Step B', type: 'Infusion', stepTempC: 60, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
      { position: 99, name: 'Step C', type: 'Infusion', stepTempC: 70, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
    ];
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/mash-profiles/${created.id}`,
      payload: fullMashProfileInput({ steps: stepsWithFakePositions as never }),
    });
    expect(putRes.statusCode).toBe(200);
    const updated = JSON.parse(putRes.body);
    expect(updated.steps.map((s: { name: string }) => s.name)).toEqual(['Step A', 'Step B', 'Step C']);

    const row = handle.db.$client
      .prepare('select name, position from mash_steps where mash_profile_id = ? order by position')
      .all(created.id) as Array<{ name: string; position: number }>;
    expect(row.map((r) => r.position)).toEqual([0, 1, 2]);

    await app.close();
  });

  it('a body with duplicate client positions is accepted and stored densely, not rejected by the UNIQUE index', async () => {
    const { app } = await setupUnseeded();
    const dupSteps = [
      { position: 0, name: 'Step A', type: 'Infusion', stepTempC: 50, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
      { position: 0, name: 'Step B', type: 'Infusion', stepTempC: 60, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
    ];
    const res = await createMashProfile(app, fullMashProfileInput({ steps: dupSteps as never }));
    expect(res.status).toBe(201);
    expect(res.body.steps.map((s: { name: string }) => s.name)).toEqual(['Step A', 'Step B']);
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-19: PUT fully replaces the step array
// ---------------------------------------------------------------------------

describe('AC-19: PUT fully replaces the step array', () => {
  it('PUTting 1 step over a 3-step profile leaves exactly 1 row; PUTting 4 over 1 leaves exactly 4', async () => {
    const { app } = await setupUnseeded();
    const threeSteps = [0, 1, 2].map((i) => ({
      name: `Step ${i}`,
      type: 'Infusion' as const,
      stepTempC: 50 + i,
      stepTimeMin: 10,
      rampTimeMin: 0,
      infuseAmountL: null,
      infuseWaterTempC: 100,
    }));
    const created = (await createMashProfile(app, fullMashProfileInput({ steps: threeSteps }))).body;

    const oneStep = [{ name: 'Only Step', type: 'Infusion' as const, stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }];
    const put1 = await app.inject({ method: 'PUT', url: `/api/mash-profiles/${created.id}`, payload: fullMashProfileInput({ steps: oneStep }) });
    expect(put1.statusCode).toBe(200);
    let count = handle.db.$client.prepare('select count(*) as c from mash_steps where mash_profile_id = ?').get(created.id) as { c: number };
    expect(count.c).toBe(1);

    const fourSteps = [0, 1, 2, 3].map((i) => ({
      name: `New Step ${i}`,
      type: 'Infusion' as const,
      stepTempC: 50 + i,
      stepTimeMin: 10,
      rampTimeMin: 0,
      infuseAmountL: null,
      infuseWaterTempC: 100,
    }));
    const put2 = await app.inject({ method: 'PUT', url: `/api/mash-profiles/${created.id}`, payload: fullMashProfileInput({ steps: fourSteps }) });
    expect(put2.statusCode).toBe(200);
    count = handle.db.$client.prepare('select count(*) as c from mash_steps where mash_profile_id = ?').get(created.id) as { c: number };
    expect(count.c).toBe(4);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-20: step id reuse policy
// ---------------------------------------------------------------------------

describe('AC-20: step id reuse policy', () => {
  it('re-supplying an existing step id keeps that row id; supplying a foreign id mints a fresh one; POST ignores all client ids', async () => {
    const { app } = await setupUnseeded();
    const created = (await createMashProfile(app, fullMashProfileInput())).body;
    const originalId = created.steps[0].id;

    // Create a second, unrelated profile to source a "foreign" step id from.
    const other = (await createMashProfile(app, fullMashProfileInput({ name: 'Other Profile' }))).body;
    const foreignStepId = other.steps[0].id;

    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/mash-profiles/${created.id}`,
      payload: fullMashProfileInput({
        steps: [
          { id: originalId, name: 'Kept', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
          { id: foreignStepId, name: 'Stolen?', type: 'Infusion', stepTempC: 70, stepTimeMin: 30, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
        ] as never,
      }),
    });
    expect(putRes.statusCode).toBe(200);
    const updated = JSON.parse(putRes.body);
    expect(updated.steps[0].id).toBe(originalId);
    expect(updated.steps[1].id).not.toBe(foreignStepId);

    // The other profile's own step is untouched.
    const otherReloaded = (await listMashProfiles(app)).find((p) => p.id === other.id)!;
    expect((otherReloaded.steps as { id: string }[])[0].id).toBe(foreignStepId);

    // On POST every client-supplied id is ignored.
    const postWithFakeId = await createMashProfile(
      app,
      fullMashProfileInput({
        steps: [{ id: originalId, name: 'Should Not Reuse', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }] as never,
      }),
    );
    expect(postWithFakeId.status).toBe(201);
    expect(postWithFakeId.body.steps[0].id).not.toBe(originalId);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-21: deleting a profile cascades its steps
// ---------------------------------------------------------------------------

describe('AC-21: deleting a profile cascades its steps', () => {
  it('deleting an unreferenced 3-step mash profile returns 204 and leaves zero step rows for it; other profiles untouched', async () => {
    const { app } = await setupUnseeded();
    const threeSteps = [0, 1, 2].map((i) => ({
      name: `Step ${i}`,
      type: 'Infusion' as const,
      stepTempC: 50 + i,
      stepTimeMin: 10,
      rampTimeMin: 0,
      infuseAmountL: null,
      infuseWaterTempC: 100,
    }));
    const toDelete = (await createMashProfile(app, fullMashProfileInput({ name: 'Delete Me', steps: threeSteps }))).body;
    const survivor = (await createMashProfile(app, fullMashProfileInput({ name: 'Survivor' }))).body;

    const delRes = await app.inject({ method: 'DELETE', url: `/api/mash-profiles/${toDelete.id}` });
    expect(delRes.statusCode).toBe(204);
    expect(delRes.body).toBe('');

    const remainingSteps = handle.db.$client
      .prepare('select count(*) as c from mash_steps where mash_profile_id = ?')
      .get(toDelete.id) as { c: number };
    expect(remainingSteps.c).toBe(0);

    const survivorSteps = handle.db.$client
      .prepare('select count(*) as c from mash_steps where mash_profile_id = ?')
      .get(survivor.id) as { c: number };
    expect(survivorSteps.c).toBe(survivor.steps.length);

    await app.close();
  });

  it('applies identically to fermentation profiles', async () => {
    const { app } = await setupUnseeded();
    const created = (await createFermentationProfile(app, fullFermentationProfileInput())).body;
    const delRes = await app.inject({ method: 'DELETE', url: `/api/fermentation-profiles/${created.id}` });
    expect(delRes.statusCode).toBe(204);
    const remaining = handle.db.$client
      .prepare('select count(*) as c from fermentation_steps where fermentation_profile_id = ?')
      .get(created.id) as { c: number };
    expect(remaining.c).toBe(0);
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-22: PUT on an unknown id writes nothing
// ---------------------------------------------------------------------------

describe('AC-22: PUT on an unknown id writes nothing', () => {
  it('mash: 404 NOT_FOUND, well-formed ApiErrorBody, no row upserted', async () => {
    const { app } = await setupUnseeded();
    const before = await listMashProfiles(app);
    const res = await app.inject({ method: 'PUT', url: '/api/mash-profiles/does-not-exist', payload: fullMashProfileInput() });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
    expect(await listMashProfiles(app)).toEqual(before);
    await app.close();
  });

  it('fermentation: 404 NOT_FOUND, well-formed ApiErrorBody, no row upserted', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'PUT', url: '/api/fermentation-profiles/does-not-exist', payload: fullFermentationProfileInput() });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe('NOT_FOUND');
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-23: partial PUT body is rejected
// ---------------------------------------------------------------------------

describe('AC-23: partial PUT body is rejected', () => {
  it('a mash body missing targetPh returns 400 VALIDATION_FAILED; stored row unchanged', async () => {
    const { app } = await setupUnseeded();
    const created = (await createMashProfile(app, fullMashProfileInput())).body;

    const partial = fullMashProfileInput() as Partial<MashProfileWriteInput>;
    delete partial.targetPh;
    const res = await app.inject({ method: 'PUT', url: `/api/mash-profiles/${created.id}`, payload: partial });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');

    const stillOriginal = (await listMashProfiles(app)).find((p) => p.id === created.id);
    expect(stillOriginal).toEqual(created);
    await app.close();
  });

  it('a fermentation body missing steps returns 400 VALIDATION_FAILED', async () => {
    const { app } = await setupUnseeded();
    const created = (await createFermentationProfile(app, fullFermentationProfileInput())).body;

    const partial = fullFermentationProfileInput() as Partial<FermentationProfileWriteInput>;
    delete partial.steps;
    const res = await app.inject({ method: 'PUT', url: `/api/fermentation-profiles/${created.id}`, payload: partial });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-24: boundary validation, exact operators
// ---------------------------------------------------------------------------

describe('AC-24: boundary validation, exact operators', () => {
  it('targetPh: 3 and 9 admissible; 2.99 and 9.01 rejected', async () => {
    const { app } = await setupUnseeded();
    for (const v of [3, 9]) {
      const res = await createMashProfile(app, fullMashProfileInput({ targetPh: v }));
      expect(res.status, `targetPh=${v}`).toBe(201);
    }
    for (const v of [2.99, 9.01]) {
      const res = await app.inject({ method: 'POST', url: '/api/mash-profiles', payload: fullMashProfileInput({ targetPh: v }) });
      expect(res.statusCode, `targetPh=${v}`).toBe(400);
    }
    await app.close();
  });

  it('spargeTempC: 0 and null admissible; -0.01 and 100.01 rejected', async () => {
    const { app } = await setupUnseeded();
    for (const v of [0, null]) {
      const res = await createMashProfile(app, fullMashProfileInput({ spargeTempC: v }));
      expect(res.status, `spargeTempC=${v}`).toBe(201);
    }
    for (const v of [-0.01, 100.01]) {
      const res = await app.inject({ method: 'POST', url: '/api/mash-profiles', payload: fullMashProfileInput({ spargeTempC: v }) });
      expect(res.statusCode, `spargeTempC=${v}`).toBe(400);
    }
    await app.close();
  });

  it('mash step stepTempC: 0 and 110 admissible; -0.01 and 110.01 rejected', async () => {
    const { app } = await setupUnseeded();
    const stepWith = (stepTempC: number) => [{ name: 'S', type: 'Infusion' as const, stepTempC, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }];
    for (const v of [0, 110]) {
      const res = await createMashProfile(app, fullMashProfileInput({ steps: stepWith(v) }));
      expect(res.status, `stepTempC=${v}`).toBe(201);
    }
    for (const v of [-0.01, 110.01]) {
      const res = await app.inject({ method: 'POST', url: '/api/mash-profiles', payload: fullMashProfileInput({ steps: stepWith(v) }) });
      expect(res.statusCode, `stepTempC=${v}`).toBe(400);
    }
    await app.close();
  });

  it('mash step stepTimeMin / rampTimeMin: 0 and 600 admissible; -0.01 and 600.01 rejected', async () => {
    const { app } = await setupUnseeded();
    const stepWith = (stepTimeMin: number) => [{ name: 'S', type: 'Infusion' as const, stepTempC: 67, stepTimeMin, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }];
    for (const v of [0, 600]) {
      expect((await createMashProfile(app, fullMashProfileInput({ steps: stepWith(v) }))).status, `stepTimeMin=${v}`).toBe(201);
    }
    for (const v of [-0.01, 600.01]) {
      const res = await app.inject({ method: 'POST', url: '/api/mash-profiles', payload: fullMashProfileInput({ steps: stepWith(v) }) });
      expect(res.statusCode, `stepTimeMin=${v}`).toBe(400);
    }
    await app.close();
  });

  it('infuseAmountL: 0 and null admissible; -0.01 and 1000.01 rejected', async () => {
    const { app } = await setupUnseeded();
    const stepWith = (infuseAmountL: number | null) => [{ name: 'S', type: 'Infusion' as const, stepTempC: 67, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL, infuseWaterTempC: 100 }];
    for (const v of [0, null]) {
      expect((await createMashProfile(app, fullMashProfileInput({ steps: stepWith(v) }))).status, `infuseAmountL=${v}`).toBe(201);
    }
    for (const v of [-0.01, 1000.01]) {
      const res = await app.inject({ method: 'POST', url: '/api/mash-profiles', payload: fullMashProfileInput({ steps: stepWith(v) }) });
      expect(res.statusCode, `infuseAmountL=${v}`).toBe(400);
    }
    await app.close();
  });

  it('fermentation stepTempC: -10 and 40 admissible; -10.01 and 40.01 rejected', async () => {
    const { app } = await setupUnseeded();
    const stepWith = (stepTempC: number) => [{ name: 'S', type: 'Primary' as const, stepTempC, stepTimeDays: 10, rampDays: 0, pressurePsi: null }];
    for (const v of [-10, 40]) {
      expect((await createFermentationProfile(app, fullFermentationProfileInput({ steps: stepWith(v) }))).status, `stepTempC=${v}`).toBe(201);
    }
    for (const v of [-10.01, 40.01]) {
      const res = await app.inject({ method: 'POST', url: '/api/fermentation-profiles', payload: fullFermentationProfileInput({ steps: stepWith(v) }) });
      expect(res.statusCode, `stepTempC=${v}`).toBe(400);
    }
    await app.close();
  });

  it('pressurePsi: 0 and null admissible; -0.01 and 60.01 rejected', async () => {
    const { app } = await setupUnseeded();
    const stepWith = (pressurePsi: number | null) => [{ name: 'S', type: 'Primary' as const, stepTempC: 19, stepTimeDays: 10, rampDays: 0, pressurePsi }];
    for (const v of [0, null]) {
      expect((await createFermentationProfile(app, fullFermentationProfileInput({ steps: stepWith(v) }))).status, `pressurePsi=${v}`).toBe(201);
    }
    for (const v of [-0.01, 60.01]) {
      const res = await app.inject({ method: 'POST', url: '/api/fermentation-profiles', payload: fullFermentationProfileInput({ steps: stepWith(v) }) });
      expect(res.statusCode, `pressurePsi=${v}`).toBe(400);
    }
    await app.close();
  });

  it('a 20-step array is accepted while 21 is rejected', async () => {
    const { app } = await setupUnseeded();
    const stepsOf = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        name: `Step ${i}`,
        type: 'Infusion' as const,
        stepTempC: 60,
        stepTimeMin: 10,
        rampTimeMin: 0,
        infuseAmountL: null,
        infuseWaterTempC: 100,
      }));
    const res20 = await createMashProfile(app, fullMashProfileInput({ steps: stepsOf(20) }));
    expect(res20.status).toBe(201);
    expect(res20.body.steps.length).toBe(20);

    const res21 = await app.inject({ method: 'POST', url: '/api/mash-profiles', payload: fullMashProfileInput({ steps: stepsOf(21) }) });
    expect(res21.statusCode).toBe(400);
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-25: empty step array is admissible
// ---------------------------------------------------------------------------

describe('AC-25: empty step array is admissible', () => {
  it('POST with steps: [] returns 201 with steps: []; GET returns the same; no default step is coerced', async () => {
    const { app } = await setupUnseeded();
    const res = await createMashProfile(app, fullMashProfileInput({ steps: [] }));
    expect(res.status).toBe(201);
    expect(res.body.steps).toEqual([]);

    const fetched = (await listMashProfiles(app)).find((p) => p.id === res.body.id);
    expect(fetched!.steps).toEqual([]);

    await app.close();
  });

  it('applies identically to fermentation profiles', async () => {
    const { app } = await setupUnseeded();
    const res = await createFermentationProfile(app, fullFermentationProfileInput({ steps: [] }));
    expect(res.status).toBe(201);
    expect(res.body.steps).toEqual([]);
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-26: name whitespace rejection
// ---------------------------------------------------------------------------

describe('AC-26: name whitespace rejection', () => {
  it('mash profile name "" and "   " rejected on POST and PUT', async () => {
    const { app } = await setupUnseeded();
    for (const badName of ['', '   ']) {
      const res = await app.inject({ method: 'POST', url: '/api/mash-profiles', payload: fullMashProfileInput({ name: badName }) });
      expect(res.statusCode, `name=${JSON.stringify(badName)}`).toBe(400);
    }
    const created = (await createMashProfile(app, fullMashProfileInput())).body;
    for (const badName of ['', '   ']) {
      const res = await app.inject({ method: 'PUT', url: `/api/mash-profiles/${created.id}`, payload: fullMashProfileInput({ name: badName }) });
      expect(res.statusCode, `PUT name=${JSON.stringify(badName)}`).toBe(400);
    }
    await app.close();
  });

  it('fermentation profile name and a step name are both rejected when blank/whitespace', async () => {
    const { app } = await setupUnseeded();
    for (const badName of ['', '   ']) {
      const res = await app.inject({ method: 'POST', url: '/api/fermentation-profiles', payload: fullFermentationProfileInput({ name: badName }) });
      expect(res.statusCode, `name=${JSON.stringify(badName)}`).toBe(400);
    }
    const badStepName = await app.inject({
      method: 'POST',
      url: '/api/mash-profiles',
      payload: fullMashProfileInput({
        steps: [{ name: '   ', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }],
      }),
    });
    expect(badStepName.statusCode).toBe(400);
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-27/AC-28: DELETE blocked by a referencing recipe
// ---------------------------------------------------------------------------

describe('AC-27: DELETE blocked by a referencing recipe', () => {
  it('mash: 409 PROFILE_IN_USE naming the recipe; nothing modified', async () => {
    const { app } = await setupSeeded();
    const mashProfile = (await createMashProfile(app, fullMashProfileInput())).body;
    const recipeRes = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: fullRecipeInput({ name: 'Blocked Recipe', mashProfileId: mashProfile.id }),
    });
    expect(recipeRes.statusCode).toBe(201);

    const delRes = await app.inject({ method: 'DELETE', url: `/api/mash-profiles/${mashProfile.id}` });
    expect(delRes.statusCode).toBe(409);
    const body = JSON.parse(delRes.body);
    expect(body.error.code).toBe('PROFILE_IN_USE');
    expect(body.error.details.profileKind).toBe('mash');
    expect(body.error.details.recipeCount).toBe(1);
    expect(body.error.details.recipeNames).toContain('Blocked Recipe');

    const stillThere = (await listMashProfiles(app)).find((p) => p.id === mashProfile.id);
    expect(stillThere).toBeDefined();
    const recipeStillThere = await app.inject({ method: 'GET', url: '/api/recipes/' + JSON.parse(recipeRes.body).id });
    expect(recipeStillThere.statusCode).toBe(200);

    await app.close();
  });

  it('fermentation: 409 PROFILE_IN_USE with profileKind "fermentation"', async () => {
    const { app } = await setupSeeded();
    const fermentationProfile = (await createFermentationProfile(app, fullFermentationProfileInput())).body;
    await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: fullRecipeInput({ name: 'Blocked Recipe 2', fermentationProfileId: fermentationProfile.id }),
    });

    const delRes = await app.inject({ method: 'DELETE', url: `/api/fermentation-profiles/${fermentationProfile.id}` });
    expect(delRes.statusCode).toBe(409);
    const body = JSON.parse(delRes.body);
    expect(body.error.code).toBe('PROFILE_IN_USE');
    expect(body.error.details.profileKind).toBe('fermentation');
    await app.close();
  });
});

describe('AC-28: details.recipeNames is capped', () => {
  it('with 7 recipes on one mash profile, recipeCount === 7 and recipeNames.length === 5', async () => {
    const { app } = await setupSeeded();
    const mashProfile = (await createMashProfile(app, fullMashProfileInput())).body;

    for (let i = 0; i < 7; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/recipes',
        payload: fullRecipeInput({ name: `Recipe ${i}`, mashProfileId: mashProfile.id }),
      });
      expect(res.statusCode).toBe(201);
    }

    const delRes = await app.inject({ method: 'DELETE', url: `/api/mash-profiles/${mashProfile.id}` });
    expect(delRes.statusCode).toBe(409);
    const body = JSON.parse(delRes.body);
    expect(body.error.details.recipeCount).toBe(7);
    expect(body.error.details.recipeNames.length).toBe(5);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-29: DELETE on an unknown id
// ---------------------------------------------------------------------------

describe('AC-29: DELETE on an unknown id', () => {
  it('mash and fermentation both 404 NOT_FOUND with a well-formed ApiErrorBody; profile count unchanged', async () => {
    const { app } = await setupUnseeded();
    const beforeMash = await listMashProfiles(app);

    const mashRes = await app.inject({ method: 'DELETE', url: '/api/mash-profiles/does-not-exist' });
    expect(mashRes.statusCode).toBe(404);
    expect(JSON.parse(mashRes.body).error.code).toBe('NOT_FOUND');
    expect(await listMashProfiles(app)).toEqual(beforeMash);

    const fermRes = await app.inject({ method: 'DELETE', url: '/api/fermentation-profiles/does-not-exist' });
    expect(fermRes.statusCode).toBe(404);
    expect(JSON.parse(fermRes.body).error.code).toBe('NOT_FOUND');

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-30/AC-31: recipe write validates both profile ids; required-but-nullable
// ---------------------------------------------------------------------------

describe('AC-30: recipe write validates both profile ids', () => {
  it('POST with an unknown mashProfileId returns 400 VALIDATION_FAILED and writes nothing', async () => {
    const { app } = await setupSeeded();
    const before = await app.inject({ method: 'GET', url: '/api/recipes' });
    const beforeCount = JSON.parse(before.body).length;

    const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ mashProfileId: 'nope' }) });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.message).toMatch(/mashProfileId/);

    const after = await app.inject({ method: 'GET', url: '/api/recipes' });
    expect(JSON.parse(after.body).length).toBe(beforeCount);
    await app.close();
  });

  it('POST with an unknown fermentationProfileId returns 400 VALIDATION_FAILED and writes nothing', async () => {
    const { app } = await setupSeeded();
    const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ fermentationProfileId: 'nope' }) });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.message).toMatch(/fermentationProfileId/);
    await app.close();
  });

  it('PUT with an unknown mashProfileId returns 400 VALIDATION_FAILED and writes nothing', async () => {
    const { app } = await setupSeeded();
    const created = (await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput() })).body;
    const createdParsed = JSON.parse(created);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/recipes/${createdParsed.id}`,
      payload: fullRecipeInput({ mashProfileId: 'nope' }),
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');

    const reGet = await app.inject({ method: 'GET', url: `/api/recipes/${createdParsed.id}` });
    expect(JSON.parse(reGet.body).mashProfile).toBeNull();
    await app.close();
  });
});

describe('AC-31: both keys are required, values nullable', () => {
  it('a recipe body omitting mashProfileId returns 400 VALIDATION_FAILED', async () => {
    const { app } = await setupUnseeded();
    const body = fullRecipeInput() as Partial<ReturnType<typeof fullRecipeInput>>;
    delete body.mashProfileId;
    const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: body });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    await app.close();
  });

  it('a body with mashProfileId: null returns 201 and stores NULL', async () => {
    const { app } = await setupSeeded();
    const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ mashProfileId: null }) });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).mashProfile).toBeNull();
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// AC-32/AC-34: recipe round-trip carries both schedules; duplicate shares them
// ---------------------------------------------------------------------------

describe('AC-32: recipe round-trip carries both schedules', () => {
  it('a recipe saved with a 3-step mash + 3-step fermentation profile reads back after a real restart, fully hydrated', async () => {
    const { app } = await setupSeeded();
    const threeMashSteps = [0, 1, 2].map((i) => ({
      name: `Mash Step ${i}`,
      type: 'Infusion' as const,
      stepTempC: 50 + i * 10,
      stepTimeMin: 10,
      rampTimeMin: 0,
      infuseAmountL: null,
      infuseWaterTempC: 100,
    }));
    const mashProfile = (await createMashProfile(app, fullMashProfileInput({ steps: threeMashSteps, spargeTempC: 74 }))).body;

    const threeFermSteps = [
      { name: 'Primary', type: 'Primary' as const, stepTempC: 19, stepTimeDays: 14, rampDays: 0, pressurePsi: null },
      { name: 'Cold Crash', type: 'ColdCrash' as const, stepTempC: 2, stepTimeDays: 2, rampDays: 1, pressurePsi: null },
      { name: 'Carbonation', type: 'Carbonation' as const, stepTempC: 4, stepTimeDays: 10, rampDays: 0, pressurePsi: 12 },
    ];
    const fermentationProfile = (await createFermentationProfile(app, fullFermentationProfileInput({ steps: threeFermSteps }))).body;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: fullRecipeInput({ mashProfileId: mashProfile.id, fermentationProfileId: fermentationProfile.id }),
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);

    await app.close();
    handle = handle.reopen();
    const app2 = buildServer({ db: handle.db });
    const getRes = await app2.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    const reloaded = JSON.parse(getRes.body);

    expect(reloaded.mashProfile.id).toBe(mashProfile.id);
    expect(reloaded.mashProfile.steps.map((s: { name: string }) => s.name)).toEqual(['Mash Step 0', 'Mash Step 1', 'Mash Step 2']);
    expect(reloaded.mashProfile.spargeTempC).toBe(74);

    expect(reloaded.fermentationProfile.id).toBe(fermentationProfile.id);
    expect(reloaded.fermentationProfile.steps.map((s: { name: string }) => s.name)).toEqual(['Primary', 'Cold Crash', 'Carbonation']);
    expect(reloaded.fermentationProfile.steps[0].pressurePsi).toBeNull();
    expect(reloaded.fermentationProfile.steps[2].pressurePsi).toBe(12);

    await app2.close();
  });
});

describe('AC-34: duplicate copies both references', () => {
  it('duplicating a recipe with both schedules points the copy at the SAME profile ids — no new profile row is created', async () => {
    const { app } = await setupSeeded();
    const mashProfile = (await createMashProfile(app, fullMashProfileInput())).body;
    const fermentationProfile = (await createFermentationProfile(app, fullFermentationProfileInput())).body;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: fullRecipeInput({ mashProfileId: mashProfile.id, fermentationProfileId: fermentationProfile.id }),
    });
    const created = JSON.parse(createRes.body);

    const mashCountBefore = (await listMashProfiles(app)).length;

    const dupRes = await app.inject({ method: 'POST', url: `/api/recipes/${created.id}/duplicate` });
    expect(dupRes.statusCode).toBe(201);
    const copy = JSON.parse(dupRes.body);

    expect(copy.mashProfile.id).toBe(mashProfile.id);
    expect(copy.fermentationProfile.id).toBe(fermentationProfile.id);
    expect((await listMashProfiles(app)).length).toBe(mashCountBefore); // no new profile row

    await app.close();
  });
});
