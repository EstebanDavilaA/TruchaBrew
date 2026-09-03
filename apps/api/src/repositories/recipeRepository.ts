import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { RecipeSummary, RecipeWriteInput, StoredRecipe } from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import {
  recipes,
  recipeFermentables,
  recipeHops,
  recipeYeasts,
  recipeMiscs,
  equipmentProfiles,
  batches,
} from '../db/schema';
import { toLineItemRows, toStoredRecipe } from '../mappers/recipeMapper';
import { equipmentRowToDomain } from './equipmentRepository';
import { getMashProfileById, getFermentationProfileById, mashProfileExists, fermentationProfileExists } from './scheduleRepository';
import { waterProfileExists } from './waterProfileRepository';

export class EquipmentNotFoundError extends Error {
  constructor(equipmentId: string) {
    super(`Equipment profile not found: ${equipmentId}`);
    this.name = 'EquipmentNotFoundError';
  }
}

/** Surfaced by the route as 400 VALIDATION_FAILED naming the field (M3_P2 spec §1.4) — never a 500, never a silent null. */
export class MashProfileNotFoundError extends Error {
  constructor(mashProfileId: string) {
    super(`mashProfileId does not reference an existing mash profile: ${mashProfileId}`);
    this.name = 'MashProfileNotFoundError';
  }
}

export class FermentationProfileNotFoundError extends Error {
  constructor(fermentationProfileId: string) {
    super(`fermentationProfileId does not reference an existing fermentation profile: ${fermentationProfileId}`);
    this.name = 'FermentationProfileNotFoundError';
  }
}

export class WaterProfileNotFoundError extends Error {
  constructor(waterProfileId: string, fieldName: 'waterSourceId' | 'waterTargetId') {
    super(`${fieldName} does not reference an existing water profile: ${waterProfileId}`);
    this.name = 'WaterProfileNotFoundError';
  }
}

function loadEquipmentRow(db: Db, equipmentId: string) {
  return db.select().from(equipmentProfiles).where(eq(equipmentProfiles.id, equipmentId)).get();
}

function loadRecipeRow(db: Db, id: string) {
  return db.select().from(recipes).where(eq(recipes.id, id)).get();
}

function loadLineItems(db: Db, recipeId: string) {
  return {
    fermentables: db.select().from(recipeFermentables).where(eq(recipeFermentables.recipeId, recipeId)).all(),
    hops: db.select().from(recipeHops).where(eq(recipeHops.recipeId, recipeId)).all(),
    yeasts: db.select().from(recipeYeasts).where(eq(recipeYeasts.recipeId, recipeId)).all(),
    miscs: db.select().from(recipeMiscs).where(eq(recipeMiscs.recipeId, recipeId)).all(),
  };
}

/**
 * Validates both profile ids (if non-null) exist BEFORE anything is written.
 * Throws MashProfileNotFoundError / FermentationProfileNotFoundError — never
 * a raw FK constraint error surfacing as a 500.
 */
function assertProfileIdsExist(db: Db, input: Pick<RecipeWriteInput, 'mashProfileId' | 'fermentationProfileId' | 'waterSourceId' | 'waterTargetId'>) {
  if (input.mashProfileId !== null && input.mashProfileId !== undefined && !mashProfileExists(db, input.mashProfileId)) {
    throw new MashProfileNotFoundError(input.mashProfileId);
  }
  if (input.fermentationProfileId !== null && input.fermentationProfileId !== undefined && !fermentationProfileExists(db, input.fermentationProfileId)) {
    throw new FermentationProfileNotFoundError(input.fermentationProfileId);
  }
  if (input.waterSourceId !== null && input.waterSourceId !== undefined && !waterProfileExists(db, input.waterSourceId)) {
    throw new WaterProfileNotFoundError(input.waterSourceId, 'waterSourceId');
  }
  if (input.waterTargetId !== null && input.waterTargetId !== undefined && !waterProfileExists(db, input.waterTargetId)) {
    throw new WaterProfileNotFoundError(input.waterTargetId, 'waterTargetId');
  }
}

function assembleStoredRecipe(db: Db, id: string): StoredRecipe | null {
  const row = loadRecipeRow(db, id);
  if (!row) return null;
  const equipmentRow = loadEquipmentRow(db, row.equipmentId);
  if (!equipmentRow) return null; // should be impossible under ON DELETE RESTRICT
  const items = loadLineItems(db, id);
  // A non-null id that resolves to no row is impossible under the FK; if it
  // somehow occurs, getMashProfileById/getFermentationProfileById hydrate as
  // null rather than throwing — a recipe must always be openable.
  const mashProfile = row.mashProfileId !== null ? getMashProfileById(db, row.mashProfileId) : null;
  const fermentationProfile = row.fermentationProfileId !== null ? getFermentationProfileById(db, row.fermentationProfileId) : null;
  return {
    ...toStoredRecipe(
      row,
      equipmentRowToDomain(equipmentRow),
      items.fermentables,
      items.hops,
      items.yeasts,
      items.miscs,
      mashProfile,
      fermentationProfile,
    ),
    // NEW in M38_P1 — added here rather than in mappers/recipeMapper.ts
    // (`toStoredRecipe`'s home), which is not in this phase's Authorized
    // Files to Modify. `recipeMapper.ts` is a pure, single-purpose helper
    // called only from this file, so spreading these two fields onto its
    // return value here is behaviourally identical to adding them inside
    // toStoredRecipe and keeps the change inside recipeRepository.ts.
    folder: row.folder ?? null,
    tags: row.tags ?? [],
    // NEW in M38_P3 — same spread-in-repository pattern as folder/tags above
    // (M38_P1 precedent); recipeMapper.ts stays untouched.
    bjcpStyleId: row.bjcpStyleId ?? null,
  };
}

/** RA-1: trims, and collapses '' / null / undefined to null. Max length 50 (schemas.ts mirrors this at the HTTP boundary). */
export function normalizeFolder(folder: string | null | undefined): string | null {
  if (folder === null || folder === undefined) return null;
  const trimmed = folder.trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, 50);
}

/**
 * RA-P3-11: trims, and collapses '' / null / undefined to null. A direct
 * mirror of normalizeFolder, but with NO dataset-membership check — the API
 * package does not import the BJCP dataset; an unknown stored id degrades
 * gracefully at read time (evaluateStyleMatch -> found:false -> neutral
 * panel). Max length 20 mirrors schemas.ts's HTTP-boundary maxLength.
 */
export function normalizeBjcpStyleId(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, 20);
}

/**
 * RA-2: trims each tag, discards empty/whitespace-only entries, and
 * deduplicates case-insensitively while preserving the casing of the FIRST
 * occurrence (`['Session', 'session']` -> `['Session']`).
 */
export function normalizeTags(tags: string[] | undefined | null): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/**
 * RA-1/RA-4/§2.1: pure repository-side filter applied in JS (not raw SQL —
 * SQLite's JSON1 text-mode column makes a robust tag-containment/multi-field
 * search query fragile to hand-write, and the recipe library is never large
 * enough for an in-memory filter over already-loaded summaries to matter).
 * `folder: '__unfiled__'` matches `folder === null` (RA-1); `tag` matches an
 * exact (case-sensitive, already-normalized) entry in `tags`; `q` matches
 * case-insensitively across name/styleName/author/folder/every tag (RA-4).
 * RA-10 (Amendment 1, AC-32): folder is applied only when it is a non-empty
 * string — undefined, null, and '' all mean "no folder filter", so an empty
 * `?folder=` query param shows everything rather than nothing. Whitespace-
 * only values are NOT special-cased (a real filter that matches nothing).
 * The client's filterRecipesLocal (RecipeLibrary.tsx) uses a truthiness
 * guard and already agrees on this input.
 */
export function filterRecipes(
  recipeList: RecipeSummary[],
  options: { q?: string; folder?: string | null; tag?: string | null },
): RecipeSummary[] {
  let result = recipeList;

  if (typeof options.folder === 'string' && options.folder !== '') {
    result =
      options.folder === '__unfiled__'
        ? result.filter((r) => (r.folder ?? null) === null)
        : result.filter((r) => r.folder === options.folder);
  }

  // RA-10 tag: truthiness guard — an empty string is "no filter", matching
  // the folder rule above and the client's filterRecipesLocal exactly.
  if (options.tag) {
    const tag = options.tag;
    result = result.filter((r) => (r.tags ?? []).includes(tag));
  }

  const trimmedQ = (options.q ?? '').trim().toLowerCase();
  if (trimmedQ) {
    result = result.filter((r) => {
      const haystack = [r.name, r.styleName, r.author, r.folder ?? '', ...(r.tags ?? [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(trimmedQ);
    });
  }

  return result;
}

export interface ListRecipeSummariesOptions {
  q?: string;
  folder?: string | null;
  tag?: string | null;
}

export function listRecipeSummaries(db: Db, qOrOptions?: string | ListRecipeSummariesOptions): RecipeSummary[] {
  // Backward-compatible call shape: existing call sites pass a bare `q`
  // string (or nothing); the new folder/tag query params (AC-7, AC-8, AC-9)
  // arrive as an options object.
  const options: ListRecipeSummariesOptions = typeof qOrOptions === 'string' ? { q: qOrOptions } : (qOrOptions ?? {});

  const rows = db
    .select({
      id: recipes.id,
      name: recipes.name,
      author: recipes.author,
      styleName: recipes.styleName,
      folder: recipes.folder,
      tags: recipes.tags,
      equipmentId: recipes.equipmentId,
      equipmentName: equipmentProfiles.name,
      batchSizeL: equipmentProfiles.batchSizeL,
      createdAt: recipes.createdAt,
      updatedAt: recipes.updatedAt,
    })
    .from(recipes)
    .innerJoin(equipmentProfiles, eq(recipes.equipmentId, equipmentProfiles.id))
    .orderBy(sql`${recipes.updatedAt} DESC`)
    .all();

  const counts = new Map<string, { fermentableCount: number; hopCount: number }>();
  for (const row of rows) {
    const fermentableCount = db
      .select({ count: sql<number>`count(*)` })
      .from(recipeFermentables)
      .where(eq(recipeFermentables.recipeId, row.id))
      .get()!.count;
    const hopCount = db
      .select({ count: sql<number>`count(*)` })
      .from(recipeHops)
      .where(eq(recipeHops.recipeId, row.id))
      .get()!.count;
    counts.set(row.id, { fermentableCount, hopCount });
  }

  const summaries: RecipeSummary[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    author: row.author,
    styleName: row.styleName,
    folder: row.folder ?? null,
    tags: row.tags ?? [],
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName,
    batchSizeL: row.batchSizeL,
    fermentableCount: counts.get(row.id)?.fermentableCount ?? 0,
    hopCount: counts.get(row.id)?.hopCount ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return filterRecipes(summaries, options);
}

export function getStoredRecipeById(db: Db, id: string): StoredRecipe | null {
  return assembleStoredRecipe(db, id);
}

function writeLineItems(db: Db, recipeId: string, input: RecipeWriteInput, existingIds: Set<string>) {
  const idFor = (existing?: string) => (existing && existingIds.has(existing) ? existing : randomUUID());
  const rows = toLineItemRows(recipeId, input, idFor);

  db.delete(recipeFermentables).where(eq(recipeFermentables.recipeId, recipeId)).run();
  db.delete(recipeHops).where(eq(recipeHops.recipeId, recipeId)).run();
  db.delete(recipeYeasts).where(eq(recipeYeasts.recipeId, recipeId)).run();
  db.delete(recipeMiscs).where(eq(recipeMiscs.recipeId, recipeId)).run();

  if (rows.fermentables.length > 0) db.insert(recipeFermentables).values(rows.fermentables).run();
  if (rows.hops.length > 0) db.insert(recipeHops).values(rows.hops).run();
  if (rows.yeasts.length > 0) db.insert(recipeYeasts).values(rows.yeasts).run();
  if (rows.miscs.length > 0) db.insert(recipeMiscs).values(rows.miscs).run();
}

/**
 * Throws EquipmentNotFoundError, MashProfileNotFoundError or
 * FermentationProfileNotFoundError (nothing written) when the corresponding
 * id doesn't exist. Every id is checked before anything is written.
 */
export function createRecipe(db: Db, input: RecipeWriteInput): StoredRecipe {
  if (!loadEquipmentRow(db, input.equipmentId)) {
    throw new EquipmentNotFoundError(input.equipmentId);
  }
  assertProfileIdsExist(db, input);

  const id = randomUUID();
  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.insert(recipes)
      .values({
        id,
        name: input.name,
        author: input.author,
        styleName: input.styleName,
        folder: normalizeFolder(input.folder),
        tags: normalizeTags(input.tags),
        bjcpStyleId: normalizeBjcpStyleId(input.bjcpStyleId),
        equipmentId: input.equipmentId,
        notes: input.notes,
        mashProfileId: input.mashProfileId ?? null,
        fermentationProfileId: input.fermentationProfileId ?? null,
        waterSourceId: input.waterSourceId ?? null,
        waterTargetId: input.waterTargetId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    // Client-supplied line-item ids are ignored, not honoured, on create.
    writeLineItems(tx as unknown as Db, id, input, new Set());
  });

  return assembleStoredRecipe(db, id)!;
}

/**
 * Returns null when `id` doesn't exist. Throws EquipmentNotFoundError,
 * MashProfileNotFoundError or FermentationProfileNotFoundError (nothing
 * written) for an unknown referenced id.
 */
export function updateRecipe(db: Db, id: string, input: RecipeWriteInput): StoredRecipe | null {
  const existingRecipe = loadRecipeRow(db, id);
  if (!existingRecipe) return null;
  if (!loadEquipmentRow(db, input.equipmentId)) {
    throw new EquipmentNotFoundError(input.equipmentId);
  }
  assertProfileIdsExist(db, input);

  const existingIds = new Set<string>([
    ...db.select({ id: recipeFermentables.id }).from(recipeFermentables).where(eq(recipeFermentables.recipeId, id)).all().map((r) => r.id),
    ...db.select({ id: recipeHops.id }).from(recipeHops).where(eq(recipeHops.recipeId, id)).all().map((r) => r.id),
    ...db.select({ id: recipeYeasts.id }).from(recipeYeasts).where(eq(recipeYeasts.recipeId, id)).all().map((r) => r.id),
    ...db.select({ id: recipeMiscs.id }).from(recipeMiscs).where(eq(recipeMiscs.recipeId, id)).all().map((r) => r.id),
  ]);

  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.update(recipes)
      .set({
        name: input.name,
        author: input.author,
        styleName: input.styleName,
        // AC-4: an omitted/empty-string/null folder sets the DB column to
        // NULL (normalizeFolder), never leaves the previous value in place —
        // this is a full-replace PUT like every other recipe field.
        folder: normalizeFolder(input.folder),
        tags: normalizeTags(input.tags),
        // NEW in M38_P3 — same full-replace semantics: omitted/empty/null
        // clears the column back to NULL, never leaves a stale value.
        bjcpStyleId: normalizeBjcpStyleId(input.bjcpStyleId),
        equipmentId: input.equipmentId,
        notes: input.notes,
        mashProfileId: input.mashProfileId ?? null,
        fermentationProfileId: input.fermentationProfileId ?? null,
        waterSourceId: input.waterSourceId ?? null,
        waterTargetId: input.waterTargetId ?? null,
        updatedAt: now,
      })
      .where(eq(recipes.id, id))
      .run();
    writeLineItems(tx as unknown as Db, id, input, existingIds);
  });

  return assembleStoredRecipe(db, id)!;
}

export function patchRecipeName(db: Db, id: string, name: string): StoredRecipe | null {
  const existing = loadRecipeRow(db, id);
  if (!existing) return null;
  db.update(recipes).set({ name, updatedAt: new Date().toISOString() }).where(eq(recipes.id, id)).run();
  return assembleStoredRecipe(db, id);
}

export function duplicateRecipe(db: Db, id: string): StoredRecipe | null {
  const source = assembleStoredRecipe(db, id);
  if (!source) return null;

  const newId = randomUUID();
  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.insert(recipes)
      .values({
        id: newId,
        name: `${source.name} (copy)`,
        author: source.author,
        styleName: source.styleName,
        // RA-3/AC-5: folder and tags carry forward UNCHANGED — already
        // normalized on the source row, never re-normalized here.
        folder: source.folder ?? null,
        tags: source.tags ?? [],
        // NEW in M38_P3 — bjcpStyleId carries forward unchanged, like
        // folder/tags (RA-P3-1 / AC-7).
        bjcpStyleId: source.bjcpStyleId ?? null,
        equipmentId: source.equipment.id,
        notes: source.notes,
        // The schedules are shared, not cloned — same profile ids, no new
        // profile row is created (AC-34).
        mashProfileId: source.mashProfile?.id ?? null,
        fermentationProfileId: source.fermentationProfile?.id ?? null,
        waterSourceId: source.waterSourceId ?? null,
        waterTargetId: source.waterTargetId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const input: RecipeWriteInput = {
      name: `${source.name} (copy)`,
      author: source.author,
      styleName: source.styleName,
      folder: source.folder ?? null,
      tags: source.tags ?? [],
      notes: source.notes,
      equipmentId: source.equipment.id,
      fermentables: source.fermentables.map(({ id: _id, ...rest }) => rest),
      hops: source.hops.map(({ id: _id, ...rest }) => rest),
      yeasts: source.yeasts.map(({ id: _id, ...rest }) => rest),
      miscs: source.miscs.map(({ id: _id, ...rest }) => rest),
      mashProfileId: source.mashProfile?.id ?? null,
      fermentationProfileId: source.fermentationProfile?.id ?? null,
      waterSourceId: source.waterSourceId ?? null,
      waterTargetId: source.waterTargetId ?? null,
    };
    // Every line item is new — no client-supplied ids exist to reuse.
    writeLineItems(tx as unknown as Db, newId, input, new Set());
  });

  return assembleStoredRecipe(db, newId);
}

export function deleteRecipe(db: Db, id: string): boolean {
  const existing = loadRecipeRow(db, id);
  if (!existing) return false;
  // Line items cascade via ON DELETE CASCADE + PRAGMA foreign_keys = ON.
  db.delete(recipes).where(eq(recipes.id, id)).run();
  return true;
}

export interface BatchUsingRecipe {
  id: string;
  name: string;
  updatedAt: string;
}

/**
 * Every batch that references `recipeId`, newest-first by updatedAt. []
 * (never null, never throws) when nothing matches — an empty array is what
 * authorises a delete. Checked by the route BEFORE deleteRecipe so a
 * still-referenced recipe never reaches `batches.recipe_id`'s ON DELETE
 * RESTRICT edge, which would otherwise surface as a raw SQLite constraint
 * error (500) instead of the established 409 *_IN_USE pattern (M3_P1's
 * EQUIPMENT_IN_USE, M3_P2's PROFILE_IN_USE) — critic Finding F-5.
 */
export function findBatchesUsingRecipe(db: Db, recipeId: string): BatchUsingRecipe[] {
  return db
    .select({ id: batches.id, name: batches.name, updatedAt: batches.updatedAt })
    .from(batches)
    .where(eq(batches.recipeId, recipeId))
    .orderBy(sql`${batches.updatedAt} DESC`)
    .all();
}
