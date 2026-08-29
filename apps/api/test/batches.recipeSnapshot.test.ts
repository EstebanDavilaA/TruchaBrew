// M15_P1 spec §3.2 — PUT /api/batches/:id/recipe-snapshot. Added during the
// 2026-08-19 critic follow-up pass (Finding F-8: no api-workspace test
// existed at all for this route). Not itself named in the spec's §2.2 New
// Files table, but justified by F-8 the same way M2_P1/M3_P1/M3_P2/M4_P1's
// own after-the-fact test-file exceptions were — see the M15_P1 spec's §6
// Deviation Register for the established pattern this follows.
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

async function createRecipe(body: ReturnType<typeof fullRecipeInput>) {
  const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: body });
  return JSON.parse(res.body);
}

async function createBatch(recipeId: string) {
  const res = await app.inject({ method: 'POST', url: '/api/batches', payload: { recipeId } });
  return JSON.parse(res.body);
}

describe('PUT /api/batches/:id/recipe-snapshot', () => {
  it('syncToMasterRecipe: false — updates only the batch snapshot, leaves the master recipe untouched', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batch = await createBatch(recipe.id);

    const adjustedSnapshot = {
      ...batch.recipeSnapshot,
      fermentables: [{ ...batch.recipeSnapshot.fermentables[0], amountKg: 9.99 }, ...batch.recipeSnapshot.fermentables.slice(1)],
    };

    const res = await app.inject({
      method: 'PUT',
      url: `/api/batches/${batch.id}/recipe-snapshot`,
      payload: { recipeSnapshot: adjustedSnapshot, syncToMasterRecipe: false },
    });
    expect(res.statusCode).toBe(200);
    const updated = JSON.parse(res.body);
    expect(updated.recipeSnapshot.fermentables[0].amountKg).toBe(9.99);
    // statsSnapshot recomputed from the substituted grist.
    expect(updated.statsSnapshot).not.toBeNull();
    expect(updated.statsSnapshot.totalGrainKg).not.toBe(batch.statsSnapshot.totalGrainKg);

    // The master recipe library entry is untouched.
    const rereadRecipe = await app.inject({ method: 'GET', url: `/api/recipes/${recipe.id}` });
    const rereadRecipeBody = JSON.parse(rereadRecipe.body);
    expect(rereadRecipeBody.fermentables[0].amountKg).toBe(recipe.fermentables[0].amountKg);
    expect(rereadRecipeBody.fermentables[0].amountKg).not.toBe(9.99);
  });

  it('syncToMasterRecipe: true — also writes the adjusted recipe back to the master recipe row', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batch = await createBatch(recipe.id);

    const adjustedSnapshot = {
      ...batch.recipeSnapshot,
      fermentables: [{ ...batch.recipeSnapshot.fermentables[0], amountKg: 7.77 }, ...batch.recipeSnapshot.fermentables.slice(1)],
    };

    const res = await app.inject({
      method: 'PUT',
      url: `/api/batches/${batch.id}/recipe-snapshot`,
      payload: { recipeSnapshot: adjustedSnapshot, syncToMasterRecipe: true },
    });
    expect(res.statusCode).toBe(200);
    const updated = JSON.parse(res.body);
    expect(updated.recipeSnapshot.fermentables[0].amountKg).toBe(7.77);

    // The master recipe library entry now reflects the substitution too.
    const rereadRecipe = await app.inject({ method: 'GET', url: `/api/recipes/${recipe.id}` });
    const rereadRecipeBody = JSON.parse(rereadRecipe.body);
    expect(rereadRecipeBody.fermentables[0].amountKg).toBe(7.77);
  });

  it('unknown batch id is 404, not a 500', async () => {
    const recipe = await createRecipe(fullRecipeInput());
    const batch = await createBatch(recipe.id);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/batches/no-such-batch-id/recipe-snapshot`,
      payload: { recipeSnapshot: batch.recipeSnapshot, syncToMasterRecipe: false },
    });
    expect(res.statusCode).toBe(404);
  });

  // F-5 — the critic's live probe P3: syncToMasterRecipe: true with a
  // recipeSnapshot.id that resolves to no master recipe row used to 200
  // silently (the batch's own snapshot write commits, but the caller is
  // told the sync succeeded when nothing was written). Fixed to answer an
  // honest error instead, following recipes.ts's existing 404 NOT_FOUND
  // convention for a missing update target.
  describe('F-5: syncToMasterRecipe: true with a recipeSnapshot.id that does not resolve to any master recipe', () => {
    it('returns a 4xx error, not a silent 200 — and the batch snapshot write already committed is still visible', async () => {
      const recipe = await createRecipe(fullRecipeInput());
      const batch = await createBatch(recipe.id);

      const orphanSnapshot = {
        ...batch.recipeSnapshot,
        id: 'no-such-recipe-id',
        fermentables: [{ ...batch.recipeSnapshot.fermentables[0], amountKg: 3.33 }, ...batch.recipeSnapshot.fermentables.slice(1)],
      };

      const res = await app.inject({
        method: 'PUT',
        url: `/api/batches/${batch.id}/recipe-snapshot`,
        payload: { recipeSnapshot: orphanSnapshot, syncToMasterRecipe: true },
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.statusCode).toBeLessThan(500);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('NOT_FOUND');

      // The batch's own recipeSnapshot/statsSnapshot write happens before
      // the sync attempt and is not rolled back by the sync failure — this
      // is documented, deliberate M15_P1 §3.2 behavior (no shared
      // transaction across the two repositories), not something this test
      // is newly asserting.
      const reread = await app.inject({ method: 'GET', url: `/api/batches/${batch.id}` });
      const rereadBody = JSON.parse(reread.body);
      expect(rereadBody.recipeSnapshot.fermentables[0].amountKg).toBe(3.33);

      // And critically, no phantom recipe was created or altered under the
      // bogus id — nothing to read back at all.
      const phantom = await app.inject({ method: 'GET', url: `/api/recipes/no-such-recipe-id` });
      expect(phantom.statusCode).toBe(404);
    });
  });
});
