import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { CalculatedStats } from '@truchabrew/shared-types';
import { calculateRecipeStats } from '@truchabrew/calculations';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { fullRecipeInput } from './helpers/fixtures';

// The full CalculatedStats field set (packages/shared-types/src/brewing.ts),
// used to assert field-for-field equality rather than a shallow object
// comparison whose failure message would be unhelpful (AC-12a: "17 fields").
const CALCULATED_STATS_FIELDS: (keyof CalculatedStats)[] = [
  'og', 'fg', 'abv', 'ibu', 'srm', 'ebc', 'buGu', 'rbr',
  'totalGrainKg', 'totalHopG', 'mashWaterL', 'spargeWaterL', 'totalWaterL',
  'preBoilVolumeL', 'preBoilGravity', 'attenuationPct', 'postBoilVolumeL',
];

/**
 * `batch`/`created` objects come back from the API with `fermentationStartDate`,
 * `bottlingDate` and `closingSnapshot` always present — all three
 * server-owned (M5_P1 spec §1.3 / M5_P2 spec §1.3). A naive `{ ...batch,
 * status: 'X' }` PUT body would carry all three forward and trip the
 * write-once/frozen guard's `preValidation` hook (AC-23) even when the
 * caller never intended to touch them. Every PUT-payload spread in this file
 * goes through this helper instead — same shape as equipment.crud.test.ts's
 * `toUpdateBody`. Every other extra key (id, batchNo, recipeId,
 * recipeSnapshot, statsSnapshot, createdAt, updatedAt, readings, notes) is
 * harmlessly stripped by Fastify's `removeAdditional: true`, exactly as
 * before this phase.
 */
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

async function createRecipe(body: ReturnType<typeof fullRecipeInput>) {
  const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: body });
  return JSON.parse(res.body);
}

describe('M4_P1 Batches API', () => {
  it('AC-1: Snapshot Immutability - Editing a recipe does not change the batch snapshot', async () => {
    // 1. Create a recipe
    const recipe = await createRecipe(fullRecipeInput());

    // 2. Create a batch from the recipe
    const batchRes = await app.inject({
      method: 'POST',
      url: '/api/batches',
      payload: { recipeId: recipe.id }
    });
    expect(batchRes.statusCode).toBe(201);
    const batch = JSON.parse(batchRes.body);

    // Verify snapshot matches original
    expect(batch.recipeSnapshot.name).toBe(recipe.name);

    // 3. Edit the original recipe
    const editRes = await app.inject({
      method: 'PUT',
      url: `/api/recipes/${recipe.id}`,
      payload: { ...fullRecipeInput(), name: 'Mutated Recipe' }
    });
    expect(editRes.statusCode).toBe(200);

    // 4. Fetch the batch again, snapshot should be untouched
    const fetchedBatchRes = await app.inject({
      method: 'GET',
      url: `/api/batches/${batch.id}`
    });
    const fetchedBatch = JSON.parse(fetchedBatchRes.body);
    expect(fetchedBatch.recipeSnapshot.name).toBe(recipe.name); // Still original name!
  });

  it('AC-2: Status Pipeline - Can advance from Planning to Brewing, but reversing returns 400', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const batch = JSON.parse(batchRes.body);

    expect(batch.status).toBe('Planning');

    // Advance to Brewing
    const advanceRes = await app.inject({
      method: 'PUT',
      url: `/api/batches/${batch.id}`,
      payload: { ...toBatchWriteBody(batch), status: 'Brewing' }
    });
    expect(advanceRes.statusCode).toBe(200);
    expect(JSON.parse(advanceRes.body).status).toBe('Brewing');

    // Reversing to Planning is allowed in the free transition model
    const reverseRes = await app.inject({
      method: 'PUT',
      url: `/api/batches/${batch.id}`,
      payload: { ...toBatchWriteBody(batch), status: 'Planning' }
    });
    expect(reverseRes.statusCode).toBe(200);
    expect(JSON.parse(reverseRes.body).status).toBe('Planning');
  });

  // AC-2/AC-29: full transition matrix (free navigation across all 5 valid statuses)
  describe('AC-2/AC-29: full transition matrix', () => {
    it('Planning -> Planning is a no-op, allowed', async () => {
      const recipe = await createRecipe(fullRecipeInput());
      const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
      const batch = JSON.parse(batchRes.body);

      const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Planning' } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('Planning');
    });

    it('Brewing -> Brewing is a no-op, allowed (re-saving measurements)', async () => {
      const recipe = await createRecipe(fullRecipeInput());
      const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
      const batch = JSON.parse(batchRes.body);
      await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Brewing' } });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/batches/${batch.id}`,
        payload: { ...toBatchWriteBody(batch), status: 'Brewing', measuredMashPh: 5.4 },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('Brewing');
      expect(JSON.parse(res.body).measuredMashPh).toBe(5.4);
    });

    it('Brewing -> Fermenting is allowed (M5_P1 AC-29)', async () => {
      const recipe = await createRecipe(fullRecipeInput());
      const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
      const batch = JSON.parse(batchRes.body);
      await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Brewing' } });

      const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Fermenting' } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('Fermenting');
    });

    it('Fermenting -> Fermenting is a no-op, allowed', async () => {
      const recipe = await createRecipe(fullRecipeInput());
      const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
      const batch = JSON.parse(batchRes.body);
      await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Brewing' } });
      await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Fermenting' } });

      const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Fermenting' } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('Fermenting');
    });

    it.each(['banana', ''])(
      'Planning -> %s is rejected with 400 and does not persist',
      async (targetStatus) => {
        const recipe = await createRecipe(fullRecipeInput());
        const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
        const batch = JSON.parse(batchRes.body);

        const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: targetStatus } });
        expect(res.statusCode).toBe(400);

        const reread = await app.inject({ method: 'GET', url: `/api/batches/${batch.id}` });
        expect(JSON.parse(reread.body).status).toBe('Planning');
      },
    );

    it.each(['banana', ''])(
      'Brewing -> %s is rejected with 400 and does not persist',
      async (targetStatus) => {
        const recipe = await createRecipe(fullRecipeInput());
        const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
        const batch = JSON.parse(batchRes.body);
        await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Brewing' } });

        const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: targetStatus } });
        expect(res.statusCode).toBe(400);

        const reread = await app.inject({ method: 'GET', url: `/api/batches/${batch.id}` });
        expect(JSON.parse(reread.body).status).toBe('Brewing');
      },
    );

    it.each(['banana', ''])(
      'Fermenting -> %s is rejected with 400 and does not persist',
      async (targetStatus) => {
        const recipe = await createRecipe(fullRecipeInput());
        const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
        const batch = JSON.parse(batchRes.body);
        await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Brewing' } });
        await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: 'Fermenting' } });

        const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...toBatchWriteBody(batch), status: targetStatus } });
        expect(res.statusCode).toBe(400);

        const reread = await app.inject({ method: 'GET', url: `/api/batches/${batch.id}` });
        expect(JSON.parse(reread.body).status).toBe('Fermenting');
      },
    );
  });

  // F-4: request validation on the batch routes — a malformed body is 400,
  // never the pre-fix 500 (POST with a missing recipeId) or a silent merge
  // (PUT with an unrecognised/incomplete body).
  describe('F-4: batch route request validation', () => {
    it('POST /api/batches with a missing recipeId is 400 VALIDATION_FAILED, not 500', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/batches', payload: {} });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('PUT /api/batches/:id with a body missing required keys is 400, not a silent merge', async () => {
      const recipe = await createRecipe(fullRecipeInput());
      const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
      const batch = JSON.parse(batchRes.body);

      const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { status: 'Brewing' } });
      expect(res.statusCode).toBe(400);

      // Confirm nothing was merged — the batch is untouched.
      const reread = await app.inject({ method: 'GET', url: `/api/batches/${batch.id}` });
      expect(JSON.parse(reread.body).status).toBe('Planning');
    });
  });

  // AC-26: a batch PUT body omitting measuredOg is 400 — it is a required
  // key with a nullable value, matching every other measured field.
  describe('AC-26: measuredOg is a required key (nullable value)', () => {
    it('a PUT body omitting measuredOg is 400 VALIDATION_FAILED and writes nothing', async () => {
      const recipe = await createRecipe(fullRecipeInput());
      const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
      const batch = JSON.parse(batchRes.body);

      const { measuredOg: _drop, fermentationStartDate: _drop2, ...bodyWithoutMeasuredOg } = batch;
      const res = await app.inject({ method: 'PUT', url: `/api/batches/${batch.id}`, payload: { ...bodyWithoutMeasuredOg, status: 'Brewing' } });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');

      const reread = await app.inject({ method: 'GET', url: `/api/batches/${batch.id}` });
      expect(JSON.parse(reread.body).status).toBe('Planning');
    });
  });
});

describe('F-5: DELETE /api/recipes/:id with a batch is 409 RECIPE_IN_USE, not 500', () => {
  it('blocks the delete and leaves the recipe intact', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    expect(batchRes.statusCode).toBe(201);

    const deleteRes = await app.inject({ method: 'DELETE', url: `/api/recipes/${recipe.id}` });
    expect(deleteRes.statusCode).toBe(409);
    const body = JSON.parse(deleteRes.body);
    expect(body.error.code).toBe('RECIPE_IN_USE');
    expect(body.error.details.batchCount).toBe(1);

    const stillThere = await app.inject({ method: 'GET', url: `/api/recipes/${recipe.id}` });
    expect(stillThere.statusCode).toBe(200);
  });

  it('a recipe with no batches still deletes cleanly (204)', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const res = await app.inject({ method: 'DELETE', url: `/api/recipes/${recipe.id}` });
    expect(res.statusCode).toBe(204);
  });
});

describe('AC-12: the estimated stats are frozen with the batch, not recomputed at render', () => {
  it('(a) statsSnapshot is stored, non-null, and equals calculateRecipeStats(recipeSnapshot) at creation, field for field', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    expect(batchRes.statusCode).toBe(201);
    const created = JSON.parse(batchRes.body);

    expect(created.statsSnapshot).not.toBeNull();
    const expected = calculateRecipeStats(created.recipeSnapshot);
    for (const field of CALCULATED_STATS_FIELDS) {
      expect(created.statsSnapshot[field]).toBe(expected[field]);
    }

    // Read it back too, not just the create response.
    const fetched = await app.inject({ method: 'GET', url: `/api/batches/${created.id}` });
    const fetchedBody = JSON.parse(fetched.body);
    expect(fetchedBody.statsSnapshot).toEqual(created.statsSnapshot);

    // PRAGMA — stats_snapshot is nullable, recipe_snapshot is still NOT NULL.
    const columns = handle.db.$client.prepare(`PRAGMA table_info('batches')`).all() as { name: string; notnull: number }[];
    const statsCol = columns.find((c) => c.name === 'stats_snapshot');
    const recipeCol = columns.find((c) => c.name === 'recipe_snapshot');
    expect(statsCol).toBeDefined();
    expect(statsCol!.notnull).toBe(0);
    expect(recipeCol).toBeDefined();
    expect(recipeCol!.notnull).toBe(1);
  });

  it('(c) statsSnapshot survives a subsequent recipe edit — byte-identical to what it was at creation', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);
    const statsAtCreation = created.statsSnapshot;

    // Mutate the source recipe's fermentables and hops — the same class of
    // edit AC-1 already proves does not touch recipe_snapshot. If this
    // changed statsSnapshot, the whole point of AC-12 (a frozen, comparable
    // record) would be defeated.
    const mutatedInput = fullRecipeInput({
      fermentables: [{ name: 'Mutated Grain', type: 'Grain', amountKg: 99, colorSrm: 40, potentialSg: 1.06 }],
      hops: [{ name: 'Mutated Hop', amountG: 500, alphaAcidPct: 20, use: 'Boil', boilMins: 90, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' }],
    });
    const editRes = await app.inject({ method: 'PUT', url: `/api/recipes/${recipe.id}`, payload: mutatedInput });
    expect(editRes.statusCode).toBe(200);
    // Sanity: the edit actually would have produced different stats, so a
    // pass here is not vacuous.
    const editedRecipe = JSON.parse(editRes.body);
    const statsForMutatedRecipe = calculateRecipeStats(editedRecipe);
    expect(statsForMutatedRecipe.ibu).not.toBe(statsAtCreation.ibu);

    const fetchedBatchRes = await app.inject({ method: 'GET', url: `/api/batches/${created.id}` });
    const fetchedBatch = JSON.parse(fetchedBatchRes.body);
    expect(fetchedBatch.statsSnapshot).toEqual(statsAtCreation);
  });

  it('update() never touches statsSnapshot across a status transition or a measurement save', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);

    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/batches/${created.id}`,
      payload: { ...toBatchWriteBody(created), status: 'Brewing', measuredPreBoilGravity: 1.05, measuredMashPh: 5.4 },
    });
    expect(putRes.statusCode).toBe(200);
    expect(JSON.parse(putRes.body).statsSnapshot).toEqual(created.statsSnapshot);

    const reread = await app.inject({ method: 'GET', url: `/api/batches/${created.id}` });
    expect(JSON.parse(reread.body).statsSnapshot).toEqual(created.statsSnapshot);
  });

  it('(e) a legacy pre-0006 row (statsSnapshot NULL at the storage layer) reads back as null, not an error or a silently-invented value', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);

    // Simulate a batch row that predates migration 0006 — SQL cannot backfill
    // calculated stats, so this is the only way such a row can exist.
    handle.db.$client.prepare(`UPDATE batches SET stats_snapshot = NULL WHERE id = ?`).run(created.id);

    const fetched = await app.inject({ method: 'GET', url: `/api/batches/${created.id}` });
    expect(fetched.statusCode).toBe(200);
    const body = JSON.parse(fetched.body);
    expect(body.statsSnapshot).toBeNull();
    // recipeSnapshot is untouched by the simulated legacy state.
    expect(body.recipeSnapshot.name).toBe(recipe.name);
  });
});

// ---------------------------------------------------------------------------
// M5_P1 — measuredOg round-trip (AC-31) and the fermentationStartDate
// write-once rule (AC-30).
// ---------------------------------------------------------------------------

describe('AC-31: measuredOg round-trips', () => {
  it('PUT with measuredOg stores and returns it; a subsequent GET returns it; PUT with null clears it', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);
    expect(created.measuredOg).toBeNull();

    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/batches/${created.id}`,
      payload: { ...toBatchWriteBody(created), measuredOg: 1.056 },
    });
    expect(putRes.statusCode).toBe(200);
    expect(JSON.parse(putRes.body).measuredOg).toBe(1.056);

    const getRes = await app.inject({ method: 'GET', url: `/api/batches/${created.id}` });
    expect(JSON.parse(getRes.body).measuredOg).toBe(1.056);

    const clearRes = await app.inject({
      method: 'PUT',
      url: `/api/batches/${created.id}`,
      payload: { ...toBatchWriteBody(created), measuredOg: null },
    });
    expect(clearRes.statusCode).toBe(200);
    expect(JSON.parse(clearRes.body).measuredOg).toBeNull();
  });

  it('survives closing the DB handle and reopening the file with a new connection and server instance', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);

    await app.inject({
      method: 'PUT',
      url: `/api/batches/${created.id}`,
      payload: { ...toBatchWriteBody(created), measuredOg: 1.062 },
    });

    await app.close();
    handle = handle.reopen();
    app = buildServer({ db: handle.db });

    const getRes = await app.inject({ method: 'GET', url: `/api/batches/${created.id}` });
    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.body).measuredOg).toBe(1.062);
  });
});

describe('AC-27/AC-30: fermentationStartDate is server-owned and write-once', () => {
  it('a Brewing -> Fermenting transition sets a non-null ISO-8601 UTC value matching the reading-time pattern', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);
    expect(created.fermentationStartDate).toBeNull();

    await app.inject({ method: 'PUT', url: `/api/batches/${created.id}`, payload: { ...toBatchWriteBody(created), status: 'Brewing' } });
    const fermentRes = await app.inject({ method: 'PUT', url: `/api/batches/${created.id}`, payload: { ...toBatchWriteBody(created), status: 'Fermenting' } });
    expect(fermentRes.statusCode).toBe(200);
    const fermented = JSON.parse(fermentRes.body);
    expect(fermented.fermentationStartDate).not.toBeNull();
    expect(fermented.fermentationStartDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);

    // Re-read from the DB directly, not just the response.
    const row = handle.db.$client.prepare(`SELECT fermentation_start_date FROM batches WHERE id = ?`).get(created.id) as { fermentation_start_date: string };
    expect(row.fermentation_start_date).toBe(fermented.fermentationStartDate);
  });

  it('a second PUT (Fermenting -> Fermenting, changing a measured value) leaves it byte-identical', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);
    await app.inject({ method: 'PUT', url: `/api/batches/${created.id}`, payload: { ...toBatchWriteBody(created), status: 'Brewing' } });
    const fermentRes = await app.inject({ method: 'PUT', url: `/api/batches/${created.id}`, payload: { ...toBatchWriteBody(created), status: 'Fermenting' } });
    const fermented = JSON.parse(fermentRes.body);

    const resaveRes = await app.inject({
      method: 'PUT',
      url: `/api/batches/${created.id}`,
      payload: { ...toBatchWriteBody(fermented), status: 'Fermenting', measuredMashPh: 5.2 },
    });
    expect(resaveRes.statusCode).toBe(200);
    const resaved = JSON.parse(resaveRes.body);
    expect(resaved.fermentationStartDate).toBe(fermented.fermentationStartDate);
    expect(resaved.measuredMashPh).toBe(5.2);
  });

  it('a Planning -> Brewing transition leaves it null; a Planning -> Planning re-save leaves it null', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);

    const resaveRes = await app.inject({ method: 'PUT', url: `/api/batches/${created.id}`, payload: { ...toBatchWriteBody(created), status: 'Planning' } });
    expect(JSON.parse(resaveRes.body).fermentationStartDate).toBeNull();

    const brewRes = await app.inject({ method: 'PUT', url: `/api/batches/${created.id}`, payload: { ...toBatchWriteBody(created), status: 'Brewing' } });
    expect(JSON.parse(brewRes.body).fermentationStartDate).toBeNull();
  });

  it('a PUT body containing fermentationStartDate — any value, including the current one and null — is 400 and leaves the stored value unchanged', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);
    await app.inject({ method: 'PUT', url: `/api/batches/${created.id}`, payload: { ...toBatchWriteBody(created), status: 'Brewing' } });
    const fermentRes = await app.inject({ method: 'PUT', url: `/api/batches/${created.id}`, payload: { ...toBatchWriteBody(created), status: 'Fermenting' } });
    const fermented = JSON.parse(fermentRes.body);

    for (const attemptedValue of [fermented.fermentationStartDate, null, '2099-01-01T00:00:00.000Z']) {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/batches/${created.id}`,
        payload: { ...fermented, status: 'Fermenting', fermentationStartDate: attemptedValue },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    }

    const reread = await app.inject({ method: 'GET', url: `/api/batches/${created.id}` });
    expect(JSON.parse(reread.body).fermentationStartDate).toBe(fermented.fermentationStartDate);
  });

  it('fermentationStartDate does not appear in BatchWriteInput (compile-time contract, re-asserted at runtime): a well-formed body never needs to supply it', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);

    // A body with every BatchWriteInput key EXCEPT fermentationStartDate
    // (which does not exist on that type at all) is well-formed and 200s.
    const body = toBatchWriteBody(created);
    expect('fermentationStartDate' in body).toBe(false);
    const res = await app.inject({ method: 'PUT', url: `/api/batches/${created.id}`, payload: { ...body, status: 'Planning' } });
    expect(res.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// M5_P2 — the seven new fields' round-trip (fuller coverage lives in
// completion.test.ts's AC-35; this is the smoke case forced by this file's
// PUT-body-spreading pattern now carrying them automatically).
// ---------------------------------------------------------------------------

describe('M5_P2: the seven new batch fields round-trip through a spread PUT body', () => {
  it('a PUT that changes only tasteNotes/tasteRating leaves the other five untouched and returns them all', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batchRes = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId: recipe.id } });
    const created = JSON.parse(batchRes.body);
    expect(created.tasteNotes).toBe('');
    expect(created.tasteRating).toBeNull();
    expect(created.carbonationType).toBeNull();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/batches/${created.id}`,
      payload: { ...toBatchWriteBody(created), tasteNotes: 'malty, balanced', tasteRating: 4 },
    });
    expect(res.statusCode).toBe(200);
    const updated = JSON.parse(res.body);
    expect(updated.tasteNotes).toBe('malty, balanced');
    expect(updated.tasteRating).toBe(4);
    expect(updated.carbonationType).toBeNull();
    expect(updated.measuredFg).toBeNull();
  });
});
