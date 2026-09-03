import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { canonicalRecipeJson } from './helpers/canonical';
import { fullRecipeInput, emptyRecipeInput } from './helpers/fixtures';
import { normalizeFolder, normalizeTags, normalizeBjcpStyleId, filterRecipes } from '../src/repositories/recipeRepository';

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

// ---------------------------------------------------------------------------
// M38_P1 — Recipe Folders & Tag Taxonomy
//
// AC-2's "Verification Method" column in the approved spec names a
// `apps/api/test/recipes.migration.test.ts` file that does NOT appear in the
// spec's own §5 Authorized Files to Modify (only this file,
// recipes.crud.test.ts, is listed for recipe-CRUD-adjacent API tests). Rather
// than create an unauthorized file, AC-2's backward-compatibility check is
// folded in here as the first M38_P1 describe block — flagged for critic
// attention as a spec-internal inconsistency (AC verification column vs. §5
// file list), not a silent scope decision.
// ---------------------------------------------------------------------------

describe('M38_P1 AC-2: additive migration backward compatibility', () => {
  it('a recipe row written before folder/tags existed (the seed insert, which never sets either column) reads back as folder: null, tags: [] with zero data loss', async () => {
    // `seedDatabase` (beforeEach) inserts SEED_SAMPLE_RECIPE via a raw
    // `.values({...})` that never mentions `folder`/`tags` — structurally
    // identical to what a genuinely pre-M38_P1 row looks like once migration
    // 0016 adds the columns with `folder` nullable (no default) and
    // `tags TEXT DEFAULT '[]' NOT NULL`. This is the real backward-
    // compatibility contract (RA-5), not a simulation of it.
    const res = await app.inject({ method: 'GET', url: '/api/recipes/rec-sample-1' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.folder).toBeNull();
    expect(body.tags).toEqual([]);
    // Every other pre-existing field on the seeded recipe is untouched by
    // the migration.
    expect(body.name).toBe('Trucha West Coast IPA');
    expect(body.fermentables.length).toBeGreaterThan(0);
  });
});

describe('M38_P1 AC-3: POST /api/recipes persists folder and tags', () => {
  it('creating with folder "IPA" and tags ["Hazy", "Citra"] returns both fields', async () => {
    const { status, body: created } = await createRecipe(fullRecipeInput({ folder: 'IPA', tags: ['Hazy', 'Citra'] }));
    expect(status).toBe(201);
    expect(created.folder).toBe('IPA');
    expect(created.tags).toEqual(['Hazy', 'Citra']);

    const res = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    const fetched = JSON.parse(res.body);
    expect(fetched.folder).toBe('IPA');
    expect(fetched.tags).toEqual(['Hazy', 'Citra']);
  });

  it('omitting folder/tags defaults to null / [] (RA-5)', async () => {
    const { status, body: created } = await createRecipe(fullRecipeInput());
    expect(status).toBe(201);
    expect(created.folder).toBeNull();
    expect(created.tags).toEqual([]);
  });
});

describe('M38_P1 AC-4: PUT /api/recipes/:id updates folder and tags', () => {
  it('updates folder and tags on an existing recipe', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ folder: 'Lagers', tags: ['Crisp'] }));
    const updated = { ...fullRecipeInput({ folder: 'IPAs', tags: ['Hazy', 'DDH'] }), name: created.name };
    const res = await app.inject({ method: 'PUT', url: `/api/recipes/${created.id}`, payload: updated });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.folder).toBe('IPAs');
    expect(body.tags).toEqual(['Hazy', 'DDH']);
  });

  it('removing the folder (empty string) sets the DB column to NULL', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ folder: 'IPAs' }));
    expect(created.folder).toBe('IPAs');

    const clearBody = fullRecipeInput({ folder: '' });
    const res = await app.inject({ method: 'PUT', url: `/api/recipes/${created.id}`, payload: clearBody });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).folder).toBeNull();

    const refetched = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    expect(JSON.parse(refetched.body).folder).toBeNull();
  });

  it('sending folder: null clears an existing folder', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ folder: 'IPAs' }));
    const res = await app.inject({ method: 'PUT', url: `/api/recipes/${created.id}`, payload: fullRecipeInput({ folder: null }) });
    expect(JSON.parse(res.body).folder).toBeNull();
  });
});

describe('M38_P1 AC-5/RA-3: duplicate preserves folder and tags unchanged', () => {
  it('POST /api/recipes/:id/duplicate carries folder and tags forward verbatim', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ folder: 'Sours', tags: ['Funky', 'Barrel'] }));
    const res = await app.inject({ method: 'POST', url: `/api/recipes/${created.id}/duplicate` });
    expect(res.statusCode).toBe(201);
    const copy = JSON.parse(res.body);
    expect(copy.folder).toBe('Sours');
    expect(copy.tags).toEqual(['Funky', 'Barrel']);
  });
});

describe('M38_P1 AC-6/RA-2: tag sanitization', () => {
  it('trims whitespace and dedupes case-insensitively, preserving first-occurrence casing', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ tags: [' IPA ', 'ipa', 'Citra'] }));
    expect(created.tags).toEqual(['IPA', 'Citra']);
  });

  it('discards a whitespace-only tag entry (schemas.ts admits it — length 3 satisfies minLength: 1 — normalizeTags then trims it to empty and drops it)', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ tags: ['Real Tag', '   '] }));
    expect(created.tags).toEqual(['Real Tag']);
  });

  // A literal empty-string tag is a 400 at the schema layer (schemas.ts's
  // `minLength: 1` per spec §1.3), never reaching normalizeTags's own
  // empty-string handling — flagged for critic attention as a tension
  // between §1.3's literal schema and RA-2's "empty strings discarded"
  // wording, which this executor read as applying to whitespace-that-trims-
  // to-empty, not a byte-for-byte empty string in the wire payload.
  it('a literal empty-string tag is rejected by the schema (400), not silently dropped', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ tags: ['Real Tag', ''] }) });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
  });

  it('trims and collapses an all-whitespace folder to null', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ folder: '  Barrel Aged  ' }));
    expect(created.folder).toBe('Barrel Aged');

    const { body: whitespaceFolder } = await createRecipe(fullRecipeInput({ folder: '   ' }));
    expect(whitespaceFolder.folder).toBeNull();
  });

  // schemas.ts's `maxLength: 50` (spec §1.3) rejects an over-length folder
  // with 400 before recipeRepository.ts's normalizeFolder ever runs — so
  // normalizeFolder's own 50-char truncation (spec §2.1) is unreachable via
  // this HTTP round-trip and is instead verified directly as a pure
  // function below.
  it('a folder longer than 50 characters is rejected by the schema (400)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ folder: 'X'.repeat(60) }) });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
  });
});

describe('M38_P1 §2.1: normalizeFolder/normalizeTags as pure functions (bypassing the HTTP schema gate)', () => {
  it('normalizeFolder trims, collapses empty/nullish to null, and truncates to 50 characters', () => {
    expect(normalizeFolder('  Barrel Aged  ')).toBe('Barrel Aged');
    expect(normalizeFolder('')).toBeNull();
    expect(normalizeFolder('   ')).toBeNull();
    expect(normalizeFolder(null)).toBeNull();
    expect(normalizeFolder(undefined)).toBeNull();
    expect(normalizeFolder('X'.repeat(60))).toBe('X'.repeat(50));
  });

  it('normalizeTags trims, discards empty/whitespace-only entries, and dedupes case-insensitively preserving first-occurrence casing', () => {
    expect(normalizeTags([' IPA ', 'ipa', 'Citra'])).toEqual(['IPA', 'Citra']);
    expect(normalizeTags(['Real Tag', '   ', ''])).toEqual(['Real Tag']);
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags(['Session', 'session'])).toEqual(['Session']);
  });
});

// ---------------------------------------------------------------------------
// M38_P3 — bjcpStyleId: additive nullable persistence (AC-2..AC-10, RA-P3-1/11)
// ---------------------------------------------------------------------------

describe('M38_P3 AC-10/RA-P3-11: normalizeBjcpStyleId pure semantics', () => {
  it('trims, collapses empty/nullish to null, and truncates to 20; performs NO dataset-membership check', () => {
    expect(normalizeBjcpStyleId(' 21A ')).toBe('21A');
    expect(normalizeBjcpStyleId('')).toBeNull();
    expect(normalizeBjcpStyleId('   ')).toBeNull();
    expect(normalizeBjcpStyleId(null)).toBeNull();
    expect(normalizeBjcpStyleId(undefined)).toBeNull();
    // Unknown ids are accepted verbatim — no membership validation (RA-P3-11).
    expect(normalizeBjcpStyleId('ZZ9')).toBe('ZZ9');
    // Over-length ids are truncated (mirrors schemas.ts maxLength: 20).
    expect(normalizeBjcpStyleId('X'.repeat(30))).toBe('X'.repeat(20));
  });
});

describe('M38_P3 AC-4/AC-5: POST persists bjcpStyleId; omitted/null/empty stores null', () => {
  it('AC-4: creating with bjcpStyleId "21A" returns it and GET /:id refetches it', async () => {
    const { status, body: created } = await createRecipe(fullRecipeInput({ bjcpStyleId: '21A' }));
    expect(status).toBe(201);
    expect(created.bjcpStyleId).toBe('21A');

    const res = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    expect(JSON.parse(res.body).bjcpStyleId).toBe('21A');
  });

  it('AC-5: omitted / null / empty-string bjcpStyleId each store as null', async () => {
    // Omitted entirely.
    const omitted = await createRecipe(fullRecipeInput());
    expect(omitted.status).toBe(201);
    expect(omitted.body.bjcpStyleId).toBeNull();

    // Explicit null.
    const nul = await createRecipe(fullRecipeInput({ bjcpStyleId: null }));
    expect(nul.body.bjcpStyleId).toBeNull();

    // Empty string (trims to null).
    const empty = await createRecipe(fullRecipeInput({ bjcpStyleId: '   ' }));
    expect(empty.body.bjcpStyleId).toBeNull();
  });

  it('AC-2: a recipe row written before bjcpStyleId existed (the seed insert, which never sets the column) reads back bjcpStyleId: null with zero data loss', async () => {
    // `seedDatabase` (beforeEach) inserts the seed recipe via a raw
    // `.values({...})` that never mentions `bjcp_style_id` — structurally
    // identical to what a genuinely pre-M38_P3 row looks like once migration
    // 0017 adds the nullable column with no default. Real backward-compat
    // contract (AC-2), not a simulation of it.
    const res = await app.inject({ method: 'GET', url: '/api/recipes/rec-sample-1' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.bjcpStyleId).toBeNull();
    // Every other pre-existing field on the seeded recipe is untouched.
    expect(body.name).toBe('Trucha West Coast IPA');
    expect(body.fermentables.length).toBeGreaterThan(0);
  });
});

describe('M38_P3 AC-6: PUT /api/recipes/:id updates and clears bjcpStyleId (full-replace)', () => {
  it('updates bjcpStyleId to "1C" and persists', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ bjcpStyleId: '21A' }));
    const res = await app.inject({
      method: 'PUT',
      url: `/api/recipes/${created.id}`,
      payload: fullRecipeInput({ bjcpStyleId: '1C', name: created.name }),
    });
    expect(JSON.parse(res.body).bjcpStyleId).toBe('1C');
    const refetch = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    expect(JSON.parse(refetch.body).bjcpStyleId).toBe('1C');
  });

  it('clearing bjcpStyleId (empty/null) sets the DB column back to NULL, no stale value', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ bjcpStyleId: '21A' }));
    expect(created.bjcpStyleId).toBe('21A');

    const clear = await app.inject({
      method: 'PUT',
      url: `/api/recipes/${created.id}`,
      payload: fullRecipeInput({ bjcpStyleId: null, name: created.name }),
    });
    expect(JSON.parse(clear.body).bjcpStyleId).toBeNull();
    const refetch = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    expect(JSON.parse(refetch.body).bjcpStyleId).toBeNull();
  });
});

describe('M38_P3 AC-7: duplicate carries bjcpStyleId forward unchanged', () => {
  it('POST /api/recipes/:id/duplicate copies bjcpStyleId verbatim', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ bjcpStyleId: '21A' }));
    const res = await app.inject({ method: 'POST', url: `/api/recipes/${created.id}/duplicate` });
    expect(JSON.parse(res.body).bjcpStyleId).toBe('21A');
  });
});

describe('M38_P3 AC-8: summary list is unaffected — no bjcpStyleId key (RA-P3-7)', () => {
  it('GET /api/recipes response objects carry no bjcpStyleId, and folder/tags are unchanged', async () => {
    await createRecipe(fullRecipeInput({ folder: 'IPAs', tags: ['Hazy'], bjcpStyleId: '21A' }));
    const res = await app.inject({ method: 'GET', url: '/api/recipes' });
    expect(res.statusCode).toBe(200);
    const list = JSON.parse(res.body);
    expect(list.length).toBeGreaterThan(0);
    for (const summary of list) {
      expect(Object.prototype.hasOwnProperty.call(summary, 'bjcpStyleId')).toBe(false);
    }
    // folder/tags summary fields remain intact for the recipe we created.
    const ours = list.find((r: { id: string }) => r.id !== undefined);
    expect(ours).toBeDefined();
  });
});

describe('M38_P3 AC-9: recipeWriteBodySchema accepts optional bjcpStyleId', () => {
  it('a body including bjcpStyleId passes (not 400); omitting it still passes', async () => {
    const withStyle = await createRecipe(fullRecipeInput({ bjcpStyleId: '21A' }));
    expect(withStyle.status).toBe(201);
    const omitted = await createRecipe(fullRecipeInput());
    expect(omitted.status).toBe(201);
  });

  it('a bjcpStyleId longer than 20 characters is rejected (400 VALIDATION_FAILED)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: fullRecipeInput({ bjcpStyleId: 'X'.repeat(30) }),
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
  });
});

describe('M38_P1 AC-7/AC-8/AC-9: query filters by folder, unfiled, and tag', () => {
  it('AC-7: ?folder=IPAs returns only recipes in that exact folder', async () => {
    const { body: a } = await createRecipe(fullRecipeInput({ name: 'A', folder: 'IPAs' }));
    await createRecipe(fullRecipeInput({ name: 'B', folder: 'Lagers' }));

    const res = await app.inject({ method: 'GET', url: '/api/recipes?folder=IPAs' });
    const body = JSON.parse(res.body);
    expect(body.map((r: { id: string }) => r.id)).toEqual([a.id]);
    expect(body.every((r: { folder: string | null }) => r.folder === 'IPAs')).toBe(true);
  });

  it('AC-8: ?folder=__unfiled__ returns only recipes with folder === null', async () => {
    await createRecipe(fullRecipeInput({ name: 'Filed', folder: 'IPAs' }));
    const { body: unfiled } = await createRecipe(fullRecipeInput({ name: 'Unfiled One' }));

    const res = await app.inject({ method: 'GET', url: '/api/recipes?folder=__unfiled__' });
    const body = JSON.parse(res.body);
    expect(body.every((r: { folder: string | null }) => r.folder === null)).toBe(true);
    expect(body.some((r: { id: string }) => r.id === unfiled.id)).toBe(true);
    // The seeded recipe (also unfiled) is included too — never filtered out.
    expect(body.some((r: { id: string }) => r.id === 'rec-sample-1')).toBe(true);
  });

  it('AC-9: ?tag=Citra returns only recipes containing that exact tag', async () => {
    const { body: match } = await createRecipe(fullRecipeInput({ name: 'Tagged', tags: ['Citra', 'Hazy'] }));
    await createRecipe(fullRecipeInput({ name: 'NotTagged', tags: ['Mosaic'] }));

    const res = await app.inject({ method: 'GET', url: '/api/recipes?tag=Citra' });
    const body = JSON.parse(res.body);
    expect(body.map((r: { id: string }) => r.id)).toEqual([match.id]);
  });

  it('folder and tag filters compose together', async () => {
    const { body: both } = await createRecipe(fullRecipeInput({ name: 'Both', folder: 'IPAs', tags: ['Hazy'] }));
    await createRecipe(fullRecipeInput({ name: 'FolderOnly', folder: 'IPAs', tags: ['Clear'] }));
    await createRecipe(fullRecipeInput({ name: 'TagOnly', folder: 'Lagers', tags: ['Hazy'] }));

    const res = await app.inject({ method: 'GET', url: '/api/recipes?folder=IPAs&tag=Hazy' });
    const body = JSON.parse(res.body);
    expect(body.map((r: { id: string }) => r.id)).toEqual([both.id]);
  });
});

describe('M38_P1 AC-10/RA-4: multi-field text search includes folder and tags', () => {
  it('?q matches a folder name', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ name: 'Zzyzx', folder: 'Barleywines' }));
    const res = await app.inject({ method: 'GET', url: '/api/recipes?q=barleywine' });
    const body = JSON.parse(res.body);
    expect(body.some((r: { id: string }) => r.id === created.id)).toBe(true);
  });

  it('?q matches a tag', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ name: 'Zyzzx', tags: ['SuperUniqueTagXyz'] }));
    const res = await app.inject({ method: 'GET', url: '/api/recipes?q=superuniquetagxyz' });
    const body = JSON.parse(res.body);
    expect(body.some((r: { id: string }) => r.id === created.id)).toBe(true);
  });

  it('?q matches author (already-supported field, still covered post-change)', async () => {
    const { body: created } = await createRecipe(fullRecipeInput({ name: 'Zzzq', author: 'SuperUniqueAuthorXyz' }));
    const res = await app.inject({ method: 'GET', url: '/api/recipes?q=superuniqueauthorxyz' });
    const body = JSON.parse(res.body);
    expect(body.some((r: { id: string }) => r.id === created.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// M38_P1 Amendment 1 — AC-32 (F-6, RA-10). An EMPTY-STRING `?folder=`/`?tag=`
// query param means "no filter applied" — the same set as no param at all —
// matching the client's filterRecipesLocal truthiness semantics. Before this
// fix, `?folder=` fell into filterRecipes' nullish-exclusion exact-match
// branch and returned ZERO recipes. Whitespace-only values are NOT special-
// cased (a real filter that matches nothing); only the empty string is "no
// filter". `q` is unaffected.
// ---------------------------------------------------------------------------
describe('M38_P1 Amendment 1 — AC-32/RA-10: empty-string folder/tag params mean "no filter"', () => {
  it('?folder= (empty) returns the same set as no folder param, with at least one filed and one unfiled recipe seeded', async () => {
    // One filed + one unfiled recipe (the seed data also contributes an
    // unfiled sample recipe), so the assertion is meaningful in both
    // directions: an empty folder must not drop the filed recipe, and must
    // not drop the unfiled one either.
    const { body: filed } = await createRecipe(fullRecipeInput({ name: 'AC32 Filed', folder: 'IPAs' }));
    const { body: unfiled } = await createRecipe(fullRecipeInput({ name: 'AC32 Unfiled' }));
    expect(filed.folder).toBe('IPAs');
    expect(unfiled.folder).toBeNull();

    const noParam = JSON.parse((await app.inject({ method: 'GET', url: '/api/recipes' })).body);
    const emptyParam = JSON.parse((await app.inject({ method: 'GET', url: '/api/recipes?folder=' })).body);

    expect(emptyParam.map((r: { id: string }) => r.id).sort()).toEqual(noParam.map((r: { id: string }) => r.id).sort());
    // At least one filed and one unfiled recipe in the returned set.
    expect(emptyParam.some((r: { id: string; folder: string | null }) => r.id === filed.id && r.folder === 'IPAs')).toBe(true);
    expect(emptyParam.some((r: { id: string; folder: string | null }) => r.id === unfiled.id && r.folder === null)).toBe(true);
  });

  it('?tag= (empty) returns the same set as no tag param', async () => {
    await createRecipe(fullRecipeInput({ name: 'AC32 Tagged', tags: ['Hazy'] }));
    const { body: untagged } = await createRecipe(fullRecipeInput({ name: 'AC32 Untagged' }));

    const noParam = JSON.parse((await app.inject({ method: 'GET', url: '/api/recipes' })).body);
    const emptyParam = JSON.parse((await app.inject({ method: 'GET', url: '/api/recipes?tag=' })).body);

    expect(emptyParam.map((r: { id: string }) => r.id).sort()).toEqual(noParam.map((r: { id: string }) => r.id).sort());
    expect(emptyParam.some((r: { id: string }) => r.id === untagged.id)).toBe(true);
  });

  it('a non-empty folder is still a real filter (RA-10 did not break AC-7), and whitespace-only is NOT "no filter"', async () => {
    const { body: filed } = await createRecipe(fullRecipeInput({ name: 'AC32 OnlyIPAs', folder: 'IPAs' }));
    await createRecipe(fullRecipeInput({ name: 'AC32 Other', folder: 'Lagers' }));

    const exact = JSON.parse((await app.inject({ method: 'GET', url: '/api/recipes?folder=IPAs' })).body);
    expect(exact.map((r: { id: string }) => r.id)).toEqual([filed.id]);

    // Whitespace-only is a real filter value that matches nothing (RA-10:
    // only the empty string is "no filter"). This is pinned on the PURE
    // function, not the HTTP boundary: WHATWG URL parsing trims trailing
    // whitespace off the query, so `?folder=   ` arrives as `?folder=`
    // ('' -> no filter) — the whitespace-only value can never actually
    // reach filterRecipes through the URL, but the function itself must
    // still treat it as a real (non-matching) filter.
    const summaries = [
      { id: 'a', name: 'A', author: '', styleName: '', folder: 'IPAs', tags: [], equipmentId: 'eq', equipmentName: 'Eq', batchSizeL: 20, fermentableCount: 0, hopCount: 0, createdAt: '', updatedAt: '' },
      { id: 'b', name: 'B', author: '', styleName: '', folder: null, tags: [], equipmentId: 'eq', equipmentName: 'Eq', batchSizeL: 20, fermentableCount: 0, hopCount: 0, createdAt: '', updatedAt: '' },
    ];
    expect(filterRecipes(summaries, { folder: '   ' })).toEqual([]);
    // And the RA-10 no-filter inputs all agree with each other.
    expect(filterRecipes(summaries, { folder: '' })).toEqual(summaries);
    expect(filterRecipes(summaries, { folder: undefined })).toEqual(summaries);
    expect(filterRecipes(summaries, { folder: null })).toEqual(summaries);
    expect(filterRecipes(summaries, { folder: '__unfiled__' }).map((r) => r.id)).toEqual(['b']);
  });
});
