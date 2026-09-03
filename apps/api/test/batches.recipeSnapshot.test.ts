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

// ---------------------------------------------------------------------------
// M38_P1 Amendment 1 — AC-27/AC-28/AC-29 (F-1 regression). The pre-amendment
// toRecipeWriteInput omitted `folder`/`tags` from the full-replace
// RecipeWriteInput, so `syncToMasterRecipe: true` silently wiped the master
// recipe's folder and every tag on sync (200 response, no test coverage).
// RA-6 resolves both fields by KEY PRESENCE against the master recipe read
// from the DB: absent/undefined keys RETAIN, explicit null/[] CLEARS, and a
// non-empty tags array REPLACES (never merges). These tests assert on the
// MASTER recipe row (`GET /api/recipes/:id`), never on the batch snapshot.
// ---------------------------------------------------------------------------
describe('M38_P1 Amendment 1 — AC-27/AC-28/AC-29 (F-1): syncToMasterRecipe: true carries folder/tags to the master recipe', () => {
  it('AC-27: folder and tags survive the sync — asserted on the master recipe, not the batch snapshot', async () => {
    const recipe = await createRecipe(fullRecipeInput({ folder: 'IPAs', tags: ['Hazy', 'Citra'] }));
    expect(recipe.folder).toBe('IPAs');
    expect(recipe.tags).toEqual(['Hazy', 'Citra']);
    const batch = await createBatch(recipe.id);

    // The batch's frozen snapshot (taken from getStoredRecipeById at batch
    // creation) already carries folder/tags — send it through the sync
    // verbatim, i.e. a snapshot that DOES carry those same values.
    const res = await app.inject({
      method: 'PUT',
      url: `/api/batches/${batch.id}/recipe-snapshot`,
      payload: { recipeSnapshot: batch.recipeSnapshot, syncToMasterRecipe: true },
    });
    expect(res.statusCode).toBe(200);

    const reread = await app.inject({ method: 'GET', url: `/api/recipes/${recipe.id}` });
    expect(reread.statusCode).toBe(200);
    const master = JSON.parse(reread.body);
    // Asserted on the MASTER recipe — the exact fields the pre-amendment
    // toRecipeWriteInput silently wiped to null/[] on every sync.
    expect(master.folder).toBe('IPAs');
    expect(master.tags).toEqual(['Hazy', 'Citra']);
  });

  it('AC-28: a pre-M38 snapshot that omits the folder/tags keys retains the master\'s stored folder/tags', async () => {
    const recipe = await createRecipe(fullRecipeInput({ folder: 'IPAs', tags: ['Hazy', 'Citra'] }));
    const batch = await createBatch(recipe.id);

    // Strip the folder/tags keys ENTIRELY — structurally what a snapshot
    // frozen before M38_P1 (no folder/tags columns at all) would look like.
    const { folder: _folder, tags: _tags, ...legacySnapshot } = batch.recipeSnapshot;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/batches/${batch.id}/recipe-snapshot`,
      payload: { recipeSnapshot: legacySnapshot, syncToMasterRecipe: true },
    });
    expect(res.statusCode).toBe(200);

    const reread = await app.inject({ method: 'GET', url: `/api/recipes/${recipe.id}` });
    const master = JSON.parse(reread.body);
    // RA-6 retention: absent keys RETAIN the master's stored values, never
    // reset to null/[] by normalizeFolder/normalizeTags full-replace.
    expect(master.folder).toBe('IPAs');
    expect(master.tags).toEqual(['Hazy', 'Citra']);
  });

  it('AC-29: explicit folder:null / tags:[] clears the master, and a non-empty tags array replaces (never merges)', async () => {
    const recipe = await createRecipe(fullRecipeInput({ folder: 'IPAs', tags: ['Hazy', 'Citra'] }));
    const batch = await createBatch(recipe.id);

    // Explicit clear — both keys PRESENT, folder null / tags [].
    const clearSnapshot = { ...batch.recipeSnapshot, folder: null, tags: [] };
    const clearRes = await app.inject({
      method: 'PUT',
      url: `/api/batches/${batch.id}/recipe-snapshot`,
      payload: { recipeSnapshot: clearSnapshot, syncToMasterRecipe: true },
    });
    expect(clearRes.statusCode).toBe(200);

    let master = JSON.parse((await app.inject({ method: 'GET', url: `/api/recipes/${recipe.id}` })).body);
    expect(master.folder).toBeNull();
    expect(master.tags).toEqual([]);

    // Replace — a non-empty tags array must REPLACE the master's tags, never
    // merge/union with the existing set (even though the master's tags are
    // currently [] after the clear above, the pre-amendment bug would have
    // nulled them out again rather than write them through).
    const replaceSnapshot = { ...batch.recipeSnapshot, folder: 'Stouts', tags: ['DDH'] };
    const replaceRes = await app.inject({
      method: 'PUT',
      url: `/api/batches/${batch.id}/recipe-snapshot`,
      payload: { recipeSnapshot: replaceSnapshot, syncToMasterRecipe: true },
    });
    expect(replaceRes.statusCode).toBe(200);

    master = JSON.parse((await app.inject({ method: 'GET', url: `/api/recipes/${recipe.id}` })).body);
    expect(master.folder).toBe('Stouts');
    expect(master.tags).toEqual(['DDH']);
  });
});
