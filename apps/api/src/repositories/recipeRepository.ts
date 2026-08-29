import { randomUUID } from 'node:crypto';
import { eq, sql, like, or } from 'drizzle-orm';
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
  return toStoredRecipe(
    row,
    equipmentRowToDomain(equipmentRow),
    items.fermentables,
    items.hops,
    items.yeasts,
    items.miscs,
    mashProfile,
    fermentationProfile,
  );
}

export function listRecipeSummaries(db: Db, q?: string): RecipeSummary[] {
  const query = db
    .select({
      id: recipes.id,
      name: recipes.name,
      author: recipes.author,
      styleName: recipes.styleName,
      equipmentId: recipes.equipmentId,
      equipmentName: equipmentProfiles.name,
      batchSizeL: equipmentProfiles.batchSizeL,
      createdAt: recipes.createdAt,
      updatedAt: recipes.updatedAt,
    })
    .from(recipes)
    .innerJoin(equipmentProfiles, eq(recipes.equipmentId, equipmentProfiles.id));

  const trimmed = (q ?? '').trim();
  const rows = (
    trimmed
      ? query.where(or(like(sql`lower(${recipes.name})`, `%${trimmed.toLowerCase()}%`), like(sql`lower(${recipes.styleName})`, `%${trimmed.toLowerCase()}%`)))
      : query
  )
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

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    author: row.author,
    styleName: row.styleName,
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName,
    batchSizeL: row.batchSizeL,
    fermentableCount: counts.get(row.id)?.fermentableCount ?? 0,
    hopCount: counts.get(row.id)?.hopCount ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
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
