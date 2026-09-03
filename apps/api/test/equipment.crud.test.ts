import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { EquipmentCreateInput, EquipmentUpdateInput } from '@truchabrew/shared-types';
import { calculateRecipeStats, calculateWaterVolumes, calculateVolumes } from '@truchabrew/calculations';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { fullRecipeInput, fullEquipmentInput } from './helpers/fixtures';

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

async function createEquipment(app: FastifyInstance, body: EquipmentCreateInput) {
  const res = await app.inject({ method: 'POST', url: '/api/equipment-profiles', payload: body });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

async function listEquipment(app: FastifyInstance) {
  const res = await app.inject({ method: 'GET', url: '/api/equipment-profiles' });
  return JSON.parse(res.body) as Array<Record<string, unknown> & { id: string }>;
}

/** EquipmentCreateInput -> EquipmentUpdateInput: drops derivedFromEquipmentId (server-owned). */
function toUpdateBody({ derivedFromEquipmentId: _drop, ...rest }: EquipmentCreateInput): EquipmentUpdateInput {
  return rest;
}

describe('AC-21: PUT replaces every mutable field', () => {
  it('changing every mutable field returns 200 with each one applied; id/createdAt unchanged, updatedAt advances', async () => {
    const { app } = await setupSeeded();
    const created = (await createEquipment(app, fullEquipmentInput({ name: 'Original' }))).body;

    await new Promise((r) => setTimeout(r, 10)); // guarantee updatedAt can move at ms resolution

    const updateBody = toUpdateBody(
      fullEquipmentInput({
        name: 'Updated Kit',
        batchSizeL: 25,
        boilTimeMin: 75,
        brewhouseEfficiencyPct: 72,
        mashEfficiencyPct: 78,
        boilOffRateLPerHour: 4.0,
        trubChillerLossL: 1.5,
        hopUtilizationPct: 92,
        mashWaterRatioLPerKg: 2.8,
        grainAbsorptionLPerKg: 1.1,
        hopstandUtilizationFactor: 0.4,
        hopstandTemperatureC: 82,
        spargeTemperatureC: 78,
        mashTunHeatCapacityL: 3,
        grainTemperatureC: 22,
        notes: 'Updated notes',
      }),
    );

    const putRes = await app.inject({ method: 'PUT', url: `/api/equipment-profiles/${created.id}`, payload: updateBody });
    expect(putRes.statusCode).toBe(200);
    const updated = JSON.parse(putRes.body);

    for (const [key, value] of Object.entries(updateBody)) {
      expect(updated[key]).toBe(value);
    }
    expect(updated.id).toBe(created.id);
    expect(updated.derivedFromEquipmentId).toBe(created.derivedFromEquipmentId);

    const getRes = await app.inject({ method: 'GET', url: '/api/equipment-profiles' });
    const reGot = JSON.parse(getRes.body).find((e: { id: string }) => e.id === created.id);
    expect(reGot).toEqual(updated);

    // id/createdAt/updatedAt live in the DB row but are not part of the wire
    // EquipmentProfile contract (unchanged from M2) — checked directly.
    const row = handle.db.$client.prepare('select id, created_at, updated_at from equipment_profiles where id = ?').get(created.id) as {
      id: string;
      created_at: string;
      updated_at: string;
    };
    expect(row.id).toBe(created.id);
    expect(new Date(row.updated_at).getTime()).toBeGreaterThan(new Date(row.created_at).getTime());

    await app.close();
  });
});

describe('AC-22: PUT preserves derivedFromEquipmentId', () => {
  it('a PUT on a derived profile leaves derivedFromEquipmentId at its stored value', async () => {
    const { app } = await setupSeeded();
    const source = (await createEquipment(app, fullEquipmentInput({ name: 'Source' }))).body;
    const derived = (
      await createEquipment(app, fullEquipmentInput({ name: 'Derived', batchSizeL: 40, derivedFromEquipmentId: source.id }))
    ).body;
    expect(derived.derivedFromEquipmentId).toBe(source.id);

    const updateBody = toUpdateBody(fullEquipmentInput({ name: 'Derived Renamed', batchSizeL: 40 }));
    const putRes = await app.inject({ method: 'PUT', url: `/api/equipment-profiles/${derived.id}`, payload: updateBody });
    expect(putRes.statusCode).toBe(200);
    expect(JSON.parse(putRes.body).derivedFromEquipmentId).toBe(source.id);

    await app.close();
  });

  it('a PUT body containing derivedFromEquipmentId returns 400 VALIDATION_FAILED and writes nothing', async () => {
    const { app } = await setupSeeded();
    const created = (await createEquipment(app, fullEquipmentInput({ name: 'Plain' }))).body;

    const bodyWithForbiddenField = { ...toUpdateBody(fullEquipmentInput({ name: 'Renamed' })), derivedFromEquipmentId: null };
    const putRes = await app.inject({ method: 'PUT', url: `/api/equipment-profiles/${created.id}`, payload: bodyWithForbiddenField });
    expect(putRes.statusCode).toBe(400);
    expect(JSON.parse(putRes.body).error.code).toBe('VALIDATION_FAILED');

    const list = await listEquipment(app);
    const stillOriginal = list.find((e) => e.id === created.id)!;
    expect(stillOriginal.name).toBe('Plain'); // the rejected PUT wrote nothing

    await app.close();
  });
});

describe('AC-23: PUT on an unknown id writes nothing', () => {
  it('returns 404 NOT_FOUND with a well-formed ApiErrorBody; row count unchanged; no upsert', async () => {
    const { app } = await setupSeeded();
    const before = await listEquipment(app);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/equipment-profiles/does-not-exist',
      payload: toUpdateBody(fullEquipmentInput()),
    });
    expect(putRes.statusCode).toBe(404);
    const body = JSON.parse(putRes.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(typeof body.error.message).toBe('string');

    const after = await listEquipment(app);
    expect(after.length).toBe(before.length);

    await app.close();
  });
});

describe('AC-24: partial PUT body is rejected', () => {
  it('a body missing mashWaterRatioLPerKg returns 400; the stored row is bit-identical to before the call', async () => {
    const { app } = await setupSeeded();
    const created = (await createEquipment(app, fullEquipmentInput({ name: 'Untouched' }))).body;

    const partialBody = toUpdateBody(fullEquipmentInput({ name: 'Should Not Apply' })) as Partial<EquipmentUpdateInput>;
    delete partialBody.mashWaterRatioLPerKg;

    const putRes = await app.inject({ method: 'PUT', url: `/api/equipment-profiles/${created.id}`, payload: partialBody });
    expect(putRes.statusCode).toBe(400);
    expect(JSON.parse(putRes.body).error.code).toBe('VALIDATION_FAILED');

    const list = await listEquipment(app);
    const stillOriginal = list.find((e) => e.id === created.id);
    expect(stillOriginal).toEqual(created);

    await app.close();
  });
});

interface NumericBoundaryCase {
  field: string;
  rejected: number[];
  admissible: number[];
}

// Every numeric row of the M3_P1 Resolved-Ambiguities bounds table.
const NUMERIC_BOUNDARY_CASES: NumericBoundaryCase[] = [
  { field: 'mashWaterRatioLPerKg', rejected: [0, -0.1, 10.01], admissible: [10, 0.01] },
  { field: 'grainAbsorptionLPerKg', rejected: [-0.01, 5.01], admissible: [0, 5] },
  { field: 'hopstandUtilizationFactor', rejected: [-0.01, 1.01], admissible: [0, 1] },
  { field: 'hopstandTemperatureC', rejected: [-0.01, 100.01], admissible: [0, 100] },
  { field: 'spargeTemperatureC', rejected: [-0.01, 100.01], admissible: [0, 100] },
  { field: 'mashTunHeatCapacityL', rejected: [-0.01, 50.01], admissible: [0, 50] },
  { field: 'grainTemperatureC', rejected: [-20.01, 50.01], admissible: [-20, 50] },
  { field: 'batchSizeL', rejected: [0, -1], admissible: [0.01] },
  { field: 'boilTimeMin', rejected: [-1, 600.01], admissible: [0, 600] },
  { field: 'brewhouseEfficiencyPct', rejected: [0, 100.01], admissible: [100, 0.01] },
  { field: 'mashEfficiencyPct', rejected: [0, 100.01], admissible: [100, 0.01] },
  { field: 'hopUtilizationPct', rejected: [-0.01, 200.01], admissible: [0, 200] },
];

describe('AC-25: boundary validation, exact operators — POST', () => {
  for (const { field, rejected, admissible } of NUMERIC_BOUNDARY_CASES) {
    it(`${field}: rejects [${rejected.join(', ')}], accepts [${admissible.join(', ')}]`, async () => {
      const { app } = await setupUnseeded();

      for (const value of rejected) {
        const overrides = { [field]: value } as Partial<EquipmentCreateInput>;
        const res = await app.inject({ method: 'POST', url: '/api/equipment-profiles', payload: fullEquipmentInput(overrides) });
        expect(res.statusCode, `POST ${field}=${value} should be rejected`).toBe(400);
        expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
      }
      for (const value of admissible) {
        const overrides = { [field]: value } as Partial<EquipmentCreateInput>;
        const res = await app.inject({ method: 'POST', url: '/api/equipment-profiles', payload: fullEquipmentInput(overrides) });
        expect(res.statusCode, `POST ${field}=${value} should be admissible`).toBe(201);
      }

      await app.close();
    });
  }
});

describe('AC-25: boundary validation, exact operators — PUT', () => {
  for (const { field, rejected, admissible } of NUMERIC_BOUNDARY_CASES) {
    it(`${field}: rejects [${rejected.join(', ')}], accepts [${admissible.join(', ')}]`, async () => {
      const { app } = await setupUnseeded();
      const created = (await createEquipment(app, fullEquipmentInput({ name: 'Boundary Target' }))).body;

      for (const value of rejected) {
        const overrides = { [field]: value } as Partial<EquipmentCreateInput>;
        const res = await app.inject({
          method: 'PUT',
          url: `/api/equipment-profiles/${created.id}`,
          payload: toUpdateBody(fullEquipmentInput(overrides)),
        });
        expect(res.statusCode, `PUT ${field}=${value} should be rejected`).toBe(400);
        expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
      }
      for (const value of admissible) {
        const overrides = { [field]: value } as Partial<EquipmentCreateInput>;
        const res = await app.inject({
          method: 'PUT',
          url: `/api/equipment-profiles/${created.id}`,
          payload: toUpdateBody(fullEquipmentInput(overrides)),
        });
        expect(res.statusCode, `PUT ${field}=${value} should be admissible`).toBe(200);
      }

      await app.close();
    });
  }
});

describe('AC-26: name whitespace rejection', () => {
  it('POST rejects name: "" and name: "   "', async () => {
    const { app } = await setupUnseeded();
    for (const badName of ['', '   ']) {
      const res = await app.inject({ method: 'POST', url: '/api/equipment-profiles', payload: fullEquipmentInput({ name: badName }) });
      expect(res.statusCode, `POST name=${JSON.stringify(badName)}`).toBe(400);
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    }
    await app.close();
  });

  it('PUT rejects name: "" and name: "   "', async () => {
    const { app } = await setupUnseeded();
    const created = (await createEquipment(app, fullEquipmentInput({ name: 'Valid Name' }))).body;
    for (const badName of ['', '   ']) {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/equipment-profiles/${created.id}`,
        payload: toUpdateBody(fullEquipmentInput({ name: badName })),
      });
      expect(res.statusCode, `PUT name=${JSON.stringify(badName)}`).toBe(400);
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    }
    await app.close();
  });
});

describe('AC-27: DELETE blocked by a referencing recipe', () => {
  it('returns 409 EQUIPMENT_IN_USE naming the recipe; nothing is deleted or modified', async () => {
    const { app } = await setupSeeded(); // seed attaches rec-sample-1 ("Trucha West Coast IPA") to eq-1

    const delRes = await app.inject({ method: 'DELETE', url: '/api/equipment-profiles/eq-1' });
    expect(delRes.statusCode).toBe(409);
    const body = JSON.parse(delRes.body);
    expect(body.error.code).toBe('EQUIPMENT_IN_USE');
    expect(body.error.details.recipeCount).toBe(1);
    expect(body.error.details.recipeNames).toContain('Trucha West Coast IPA');

    const list = await listEquipment(app);
    expect(list.find((e) => e.id === 'eq-1')).toBeDefined();
    const recipeRes = await app.inject({ method: 'GET', url: '/api/recipes/rec-sample-1' });
    expect(recipeRes.statusCode).toBe(200);

    await app.close();
  });
});

describe('AC-28: details.recipeNames is capped', () => {
  it('with 7 recipes on one profile, recipeCount === 7 and recipeNames.length === 5', async () => {
    const { app } = await setupUnseeded();
    const profile = (await createEquipment(app, fullEquipmentInput({ name: 'Popular Kit' }))).body;

    for (let i = 0; i < 7; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/recipes',
        payload: fullRecipeInput({ name: `Recipe ${i}`, equipmentId: profile.id }),
      });
      expect(res.statusCode).toBe(201);
    }

    const delRes = await app.inject({ method: 'DELETE', url: `/api/equipment-profiles/${profile.id}` });
    expect(delRes.statusCode).toBe(409);
    const body = JSON.parse(delRes.body);
    expect(body.error.details.recipeCount).toBe(7);
    expect(body.error.details.recipeNames.length).toBe(5);

    await app.close();
  });
});

describe('AC-29: DELETE succeeds when unreferenced', () => {
  it('returns 204 with an empty body; the list omits it; every other profile and recipe is untouched', async () => {
    const { app } = await setupSeeded();
    const created = (await createEquipment(app, fullEquipmentInput({ name: 'Deletable' }))).body;

    const beforeList = await listEquipment(app);
    const beforeRecipe = JSON.parse((await app.inject({ method: 'GET', url: '/api/recipes/rec-sample-1' })).body);

    const delRes = await app.inject({ method: 'DELETE', url: `/api/equipment-profiles/${created.id}` });
    expect(delRes.statusCode).toBe(204);
    expect(delRes.body).toBe('');

    const afterList = await listEquipment(app);
    expect(afterList.find((e) => e.id === created.id)).toBeUndefined();
    expect(afterList.length).toBe(beforeList.length - 1);

    for (const survivor of beforeList.filter((e) => e.id !== created.id)) {
      expect(afterList.find((e) => e.id === survivor.id)).toEqual(survivor);
    }

    const afterRecipe = JSON.parse((await app.inject({ method: 'GET', url: '/api/recipes/rec-sample-1' })).body);
    expect(afterRecipe).toEqual(beforeRecipe);

    await app.close();
  });
});

describe('AC-30: DELETE on an unknown id', () => {
  it('returns 404 NOT_FOUND with a well-formed ApiErrorBody, profile count unchanged', async () => {
    const { app } = await setupSeeded();
    const before = await listEquipment(app);

    const delRes = await app.inject({ method: 'DELETE', url: '/api/equipment-profiles/does-not-exist' });
    expect(delRes.statusCode).toBe(404);
    const body = JSON.parse(delRes.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(typeof body.error.message).toBe('string');

    const after = await listEquipment(app);
    expect(after.length).toBe(before.length);

    await app.close();
  });
});

describe('AC-31: deleting a derived profile\'s source nulls the link', () => {
  it('leaves the derived profile present with derivedFromEquipmentId === null — not deleted, not orphaned', async () => {
    const { app } = await setupSeeded();

    // Free up eq-1 first — the seed's sample recipe would otherwise block the delete (AC-27).
    const delSampleRecipe = await app.inject({ method: 'DELETE', url: '/api/recipes/rec-sample-1' });
    expect(delSampleRecipe.statusCode).toBe(204);

    const derived = (
      await createEquipment(app, fullEquipmentInput({ name: 'eq-1 (40 L)', batchSizeL: 40, derivedFromEquipmentId: 'eq-1' }))
    ).body;
    expect(derived.derivedFromEquipmentId).toBe('eq-1');

    const delRes = await app.inject({ method: 'DELETE', url: '/api/equipment-profiles/eq-1' });
    expect(delRes.statusCode).toBe(204);

    const list = await listEquipment(app);
    expect(list.find((e) => e.id === 'eq-1')).toBeUndefined();
    const stillPresent = list.find((e) => e.id === derived.id);
    expect(stillPresent).toBeDefined();
    expect(stillPresent!.derivedFromEquipmentId).toBeNull();

    await app.close();
  });
});

describe('AC-32: a seed profile is deletable when unused', () => {
  it('DELETE eq-2 succeeds; a subsequent seedDatabase restores it without altering any other profile', async () => {
    const { app } = await setupSeeded(); // eq-2 is not referenced by the seeded sample recipe

    const eq1Before = (await listEquipment(app)).find((e) => e.id === 'eq-1');

    const delRes = await app.inject({ method: 'DELETE', url: '/api/equipment-profiles/eq-2' });
    expect(delRes.statusCode).toBe(204);
    expect((await listEquipment(app)).find((e) => e.id === 'eq-2')).toBeUndefined();

    seedDatabase(handle.db); // re-seed, same as a fresh `npm run db:seed`

    const afterReseed = await listEquipment(app);
    const eq2Restored = afterReseed.find((e) => e.id === 'eq-2');
    expect(eq2Restored).toBeDefined();
    expect(eq2Restored!.mashWaterRatioLPerKg).toBe(3.0);
    expect(eq2Restored!.notes).toBe('');

    const eq1After = afterReseed.find((e) => e.id === 'eq-1');
    expect(eq1After).toEqual(eq1Before); // untouched by the re-seed

    await app.close();
  });
});

describe('AC-33: editing a profile moves every referencing recipe\'s numbers', () => {
  it('PUT changing mashWaterRatioLPerKg and hopUtilizationPct moves the reloaded recipe\'s water and IBU', async () => {
    const { app } = await setupUnseeded();
    const profile = (await createEquipment(app, fullEquipmentInput({ name: 'Profile P' }))).body;

    const createRecipeRes = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: fullRecipeInput({ name: 'Recipe R', equipmentId: profile.id }),
    });
    const recipeBefore = JSON.parse(createRecipeRes.body);
    const statsBefore = calculateRecipeStats(recipeBefore);

    await new Promise((r) => setTimeout(r, 10));

    const updateBody = toUpdateBody(fullEquipmentInput({ mashWaterRatioLPerKg: 2.5, hopUtilizationPct: 100 }));
    const putRes = await app.inject({ method: 'PUT', url: `/api/equipment-profiles/${profile.id}`, payload: updateBody });
    expect(putRes.statusCode).toBe(200);

    const reGetRes = await app.inject({ method: 'GET', url: `/api/recipes/${recipeBefore.id}` });
    const recipeAfter = JSON.parse(reGetRes.body);
    const statsAfter = calculateRecipeStats(recipeAfter);

    const totalGrainKg = recipeAfter.fermentables.reduce((s: number, f: { amountKg: number }) => s + f.amountKg, 0);
    const preBoilVolumeL = calculateVolumes(recipeAfter.equipment).preBoilVolumeL;
    const water = calculateWaterVolumes(recipeAfter.equipment, totalGrainKg, preBoilVolumeL);
    expect(Math.abs(water.mashWaterL - totalGrainKg * 2.5)).toBeLessThanOrEqual(1e-9);
    expect(statsAfter.ibu).toBeGreaterThan(statsBefore.ibu);

    expect(recipeAfter.name).toBe(recipeBefore.name);
    expect(recipeAfter.updatedAt).toBe(recipeBefore.updatedAt);

    await app.close();
  });
});

describe('AC-34: equipment edits survive restart', () => {
  it('PUT, close, reopen a new connection and server instance, GET — all fields === the PUT response', async () => {
    const { app: app1 } = await setupUnseeded(); // real temp file (createTestDb), never :memory:
    const created = (await createEquipment(app1, fullEquipmentInput({ name: 'Restart Test' }))).body;

    const updateBody = toUpdateBody(fullEquipmentInput({ name: 'Restart Test Updated', mashWaterRatioLPerKg: 2.7, notes: 'restart-check' }));
    const putRes = await app1.inject({ method: 'PUT', url: `/api/equipment-profiles/${created.id}`, payload: updateBody });
    const putBody = JSON.parse(putRes.body);
    await app1.close();

    handle = handle.reopen();
    const app2 = buildServer({ db: handle.db });
    const list = await listEquipment(app2);
    const reloaded = list.find((e) => e.id === created.id)!;

    for (const key of Object.keys(putBody)) {
      expect(reloaded[key]).toBe(putBody[key]);
    }

    await app2.close();
  });
});

describe('AC-35: float precision on the new columns', () => {
  it('round-trips exactly, not approximately', async () => {
    const { app } = await setupUnseeded();
    const created = (
      await createEquipment(
        app,
        fullEquipmentInput({
          mashWaterRatioLPerKg: 2.6875,
          grainAbsorptionLPerKg: 1.0125,
          hopstandUtilizationFactor: 0.2625,
        }),
      )
    ).body;
    expect(created.mashWaterRatioLPerKg).toBe(2.6875);
    expect(created.grainAbsorptionLPerKg).toBe(1.0125);
    expect(created.hopstandUtilizationFactor).toBe(0.2625);

    const reloaded = (await listEquipment(app)).find((e) => e.id === created.id)!;
    expect(reloaded.mashWaterRatioLPerKg).toBe(2.6875);
    expect(reloaded.grainAbsorptionLPerKg).toBe(1.0125);
    expect(reloaded.hopstandUtilizationFactor).toBe(0.2625);

    await app.close();
  });
});
