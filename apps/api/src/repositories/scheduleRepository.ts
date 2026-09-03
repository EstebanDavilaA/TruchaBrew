import { randomUUID } from 'node:crypto';
import { asc, eq, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type {
  MashProfile,
  MashStep,
  MashStepType,
  FermentationProfile,
  FermentationStep,
  FermentationStepType,
  MashProfileWriteInput,
  FermentationProfileWriteInput,
} from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import { mashProfiles, mashSteps, fermentationProfiles, fermentationSteps, recipes } from '../db/schema';

export type MashProfileRow = InferSelectModel<typeof mashProfiles>;
export type MashStepRow = InferSelectModel<typeof mashSteps>;
export type FermentationProfileRow = InferSelectModel<typeof fermentationProfiles>;
export type FermentationStepRow = InferSelectModel<typeof fermentationSteps>;

function byPosition<T extends { position: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

/**
 * The single row -> domain projection for mash profiles (M3_P2 spec §2.6) —
 * the same rule `equipmentRowToDomain` and `recipeMapper.ts` carry. No route,
 * repository or test may hand-assemble a MashProfile from rows.
 */
export function mashProfileRowsToDomain(row: MashProfileRow, stepRows: MashStepRow[]): MashProfile {
  return {
    id: row.id,
    name: row.name,
    targetPh: row.targetPh,
    spargeTempC: row.spargeTempC,
    steps: byPosition(stepRows).map(
      (s): MashStep => ({
        id: s.id,
        name: s.name,
        type: s.type as MashStepType,
        stepTempC: s.stepTempC,
        stepTimeMin: s.stepTimeMin,
        rampTimeMin: s.rampTimeMin,
        infuseAmountL: s.infuseAmountL,
        infuseWaterTempC: s.infuseWaterTempC,
      }),
    ),
  };
}

/** The single row -> domain projection for fermentation profiles (M3_P2 spec §2.6). */
export function fermentationProfileRowsToDomain(row: FermentationProfileRow, stepRows: FermentationStepRow[]): FermentationProfile {
  return {
    id: row.id,
    name: row.name,
    steps: byPosition(stepRows).map(
      (s): FermentationStep => ({
        id: s.id,
        name: s.name,
        type: s.type as FermentationStepType,
        stepTempC: s.stepTempC,
        stepTimeDays: s.stepTimeDays,
        rampDays: s.rampDays,
        pressurePsi: s.pressurePsi,
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
// Mash profiles
// ---------------------------------------------------------------------------

function loadMashProfileRow(db: Db, id: string) {
  return db.select().from(mashProfiles).where(eq(mashProfiles.id, id)).get();
}

function loadMashStepRows(db: Db, mashProfileId: string) {
  return db.select().from(mashSteps).where(eq(mashSteps.mashProfileId, mashProfileId)).all();
}

/** Seed profiles first, then alphabetically by name — same rule as equipment profiles. */
export function listMashProfiles(db: Db): MashProfile[] {
  const rows = db
    .select()
    .from(mashProfiles)
    .orderBy(sql`${mashProfiles.isSeed} DESC`, asc(mashProfiles.name))
    .all();
  return rows.map((row) => mashProfileRowsToDomain(row, loadMashStepRows(db, row.id)));
}

export function getMashProfileById(db: Db, id: string): MashProfile | null {
  const row = loadMashProfileRow(db, id);
  if (!row) return null;
  return mashProfileRowsToDomain(row, loadMashStepRows(db, id));
}

export function mashProfileExists(db: Db, id: string): boolean {
  const row = db.select({ id: mashProfiles.id }).from(mashProfiles).where(eq(mashProfiles.id, id)).get();
  return row !== undefined;
}

/**
 * Position assignment is dense, 0-based and by array index — client-supplied
 * `position` is never honoured (M3_P2 spec §2.6). Step id reuse mirrors the
 * recipe line-item policy: a client-supplied id is reused iff it already
 * belongs to THIS profile; otherwise a fresh id is minted. Steps are
 * deleted-and-reinserted inside the same transaction as the profile update.
 */
function writeMashSteps(db: Db, mashProfileId: string, input: MashProfileWriteInput, existingIds: Set<string>) {
  const idFor = (existing?: string) => (existing && existingIds.has(existing) ? existing : randomUUID());
  const rows = input.steps.map((s, position) => ({
    id: idFor(s.id),
    mashProfileId,
    position,
    name: s.name,
    type: s.type,
    stepTempC: s.stepTempC,
    stepTimeMin: s.stepTimeMin,
    rampTimeMin: s.rampTimeMin,
    infuseAmountL: s.infuseAmountL ?? null,
    infuseWaterTempC: s.infuseWaterTempC,
  }));

  db.delete(mashSteps).where(eq(mashSteps.mashProfileId, mashProfileId)).run();
  if (rows.length > 0) db.insert(mashSteps).values(rows).run();
}

export function createMashProfile(db: Db, id: string, input: MashProfileWriteInput): MashProfile {
  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.insert(mashProfiles)
      .values({
        id,
        name: input.name,
        targetPh: input.targetPh,
        spargeTempC: input.spargeTempC,
        isSeed: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    // Client-supplied step ids are ignored, not honoured, on create.
    writeMashSteps(tx as unknown as Db, id, input, new Set());
  });
  return getMashProfileById(db, id)!;
}

/** Returns null when `id` doesn't exist — nothing written, never an upsert-on-missing. */
export function updateMashProfile(db: Db, id: string, input: MashProfileWriteInput): MashProfile | null {
  if (!mashProfileExists(db, id)) return null;

  const existingIds = new Set(loadMashStepRows(db, id).map((r) => r.id));
  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.update(mashProfiles)
      .set({ name: input.name, targetPh: input.targetPh, spargeTempC: input.spargeTempC, updatedAt: now })
      .where(eq(mashProfiles.id, id))
      .run();
    writeMashSteps(tx as unknown as Db, id, input, existingIds);
  });

  return getMashProfileById(db, id);
}

/**
 * Deletes the profile. Returns false (nothing written) when `id` does not
 * exist. Does NOT check whether any recipe references the profile — the
 * route calls findRecipesUsingMashProfile BEFORE this, so a still-referenced
 * profile never reaches here (same pattern as equipmentRepository.ts).
 */
export function deleteMashProfile(db: Db, id: string): boolean {
  if (!mashProfileExists(db, id)) return false;
  db.delete(mashProfiles).where(eq(mashProfiles.id, id)).run();
  return true;
}

export interface RecipeUsingProfile {
  id: string;
  name: string;
  updatedAt: string;
}

/** Every recipe referencing `mashProfileId`, newest-first. [] (never null) when nothing matches. */
export function findRecipesUsingMashProfile(db: Db, mashProfileId: string): RecipeUsingProfile[] {
  return db
    .select({ id: recipes.id, name: recipes.name, updatedAt: recipes.updatedAt })
    .from(recipes)
    .where(eq(recipes.mashProfileId, mashProfileId))
    .orderBy(sql`${recipes.updatedAt} DESC`)
    .all();
}

// ---------------------------------------------------------------------------
// Fermentation profiles
// ---------------------------------------------------------------------------

function loadFermentationProfileRow(db: Db, id: string) {
  return db.select().from(fermentationProfiles).where(eq(fermentationProfiles.id, id)).get();
}

function loadFermentationStepRows(db: Db, fermentationProfileId: string) {
  return db.select().from(fermentationSteps).where(eq(fermentationSteps.fermentationProfileId, fermentationProfileId)).all();
}

export function listFermentationProfiles(db: Db): FermentationProfile[] {
  const rows = db
    .select()
    .from(fermentationProfiles)
    .orderBy(sql`${fermentationProfiles.isSeed} DESC`, asc(fermentationProfiles.name))
    .all();
  return rows.map((row) => fermentationProfileRowsToDomain(row, loadFermentationStepRows(db, row.id)));
}

export function getFermentationProfileById(db: Db, id: string): FermentationProfile | null {
  const row = loadFermentationProfileRow(db, id);
  if (!row) return null;
  return fermentationProfileRowsToDomain(row, loadFermentationStepRows(db, id));
}

export function fermentationProfileExists(db: Db, id: string): boolean {
  const row = db.select({ id: fermentationProfiles.id }).from(fermentationProfiles).where(eq(fermentationProfiles.id, id)).get();
  return row !== undefined;
}

function writeFermentationSteps(db: Db, fermentationProfileId: string, input: FermentationProfileWriteInput, existingIds: Set<string>) {
  const idFor = (existing?: string) => (existing && existingIds.has(existing) ? existing : randomUUID());
  const rows = input.steps.map((s, position) => ({
    id: idFor(s.id),
    fermentationProfileId,
    position,
    name: s.name,
    type: s.type,
    stepTempC: s.stepTempC,
    stepTimeDays: s.stepTimeDays,
    rampDays: s.rampDays,
    pressurePsi: s.pressurePsi ?? null,
  }));

  db.delete(fermentationSteps).where(eq(fermentationSteps.fermentationProfileId, fermentationProfileId)).run();
  if (rows.length > 0) db.insert(fermentationSteps).values(rows).run();
}

export function createFermentationProfile(db: Db, id: string, input: FermentationProfileWriteInput): FermentationProfile {
  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.insert(fermentationProfiles)
      .values({ id, name: input.name, isSeed: 0, createdAt: now, updatedAt: now })
      .run();
    writeFermentationSteps(tx as unknown as Db, id, input, new Set());
  });
  return getFermentationProfileById(db, id)!;
}

export function updateFermentationProfile(db: Db, id: string, input: FermentationProfileWriteInput): FermentationProfile | null {
  if (!fermentationProfileExists(db, id)) return null;

  const existingIds = new Set(loadFermentationStepRows(db, id).map((r) => r.id));
  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.update(fermentationProfiles).set({ name: input.name, updatedAt: now }).where(eq(fermentationProfiles.id, id)).run();
    writeFermentationSteps(tx as unknown as Db, id, input, existingIds);
  });

  return getFermentationProfileById(db, id);
}

export function deleteFermentationProfile(db: Db, id: string): boolean {
  if (!fermentationProfileExists(db, id)) return false;
  db.delete(fermentationProfiles).where(eq(fermentationProfiles.id, id)).run();
  return true;
}

export function findRecipesUsingFermentationProfile(db: Db, fermentationProfileId: string): RecipeUsingProfile[] {
  return db
    .select({ id: recipes.id, name: recipes.name, updatedAt: recipes.updatedAt })
    .from(recipes)
    .where(eq(recipes.fermentationProfileId, fermentationProfileId))
    .orderBy(sql`${recipes.updatedAt} DESC`)
    .all();
}
