import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { WaterProfile, WaterProfileInput } from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import { waterProfiles, recipes } from '../db/schema';

// ---------------------------------------------------------------------------
// Domain mapping
// ---------------------------------------------------------------------------

type WaterProfileRow = typeof waterProfiles.$inferSelect;

export function waterProfileRowToDomain(row: WaterProfileRow): WaterProfile {
  return {
    id: row.id,
    name: row.name,
    type: row.type as WaterProfile['type'],
    calcium: row.calcium,
    magnesium: row.magnesium,
    sodium: row.sodium,
    chloride: row.chloride,
    sulfate: row.sulfate,
    bicarbonate: row.bicarbonate,
    ph: row.ph,
    description: row.description,
  };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export function listWaterProfiles(db: Db): WaterProfile[] {
  const rows = db.select().from(waterProfiles).orderBy(sql`${waterProfiles.name} ASC`).all();
  return rows.map(waterProfileRowToDomain);
}

export function getWaterProfileById(db: Db, id: string): WaterProfile | null {
  const row = db.select().from(waterProfiles).where(eq(waterProfiles.id, id)).get();
  return row ? waterProfileRowToDomain(row) : null;
}

export function createWaterProfile(db: Db, input: WaterProfileInput): WaterProfile {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.insert(waterProfiles)
    .values({
      id,
      name: input.name,
      type: input.type,
      calcium: input.calcium,
      magnesium: input.magnesium,
      sodium: input.sodium,
      chloride: input.chloride,
      sulfate: input.sulfate,
      bicarbonate: input.bicarbonate,
      ph: input.ph ?? null,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getWaterProfileById(db, id)!;
}

export function updateWaterProfile(db: Db, id: string, input: WaterProfileInput): WaterProfile | null {
  const existing = db.select().from(waterProfiles).where(eq(waterProfiles.id, id)).get();
  if (!existing) return null;
  db.update(waterProfiles)
    .set({
      name: input.name,
      type: input.type,
      calcium: input.calcium,
      magnesium: input.magnesium,
      sodium: input.sodium,
      chloride: input.chloride,
      sulfate: input.sulfate,
      bicarbonate: input.bicarbonate,
      ph: input.ph ?? null,
      description: input.description ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(waterProfiles.id, id))
    .run();
  return getWaterProfileById(db, id);
}

export function deleteWaterProfile(db: Db, id: string): boolean {
  const existing = db.select().from(waterProfiles).where(eq(waterProfiles.id, id)).get();
  if (!existing) return false;
  db.delete(waterProfiles).where(eq(waterProfiles.id, id)).run();
  return true;
}

export function waterProfileExists(db: Db, id: string): boolean {
  const row = db.select({ id: waterProfiles.id }).from(waterProfiles).where(eq(waterProfiles.id, id)).get();
  return !!row;
}

// ---------------------------------------------------------------------------
// In-use check (AC-12: DELETE safety guardrail)
// ---------------------------------------------------------------------------

export interface RecipeUsingWaterProfile {
  id: string;
  name: string;
  updatedAt: string;
}

export function findRecipesUsingWaterProfile(db: Db, waterProfileId: string): RecipeUsingWaterProfile[] {
  // A water profile is "in use" if ANY recipe references it as either source or target.
  const rows = db
    .select({ id: recipes.id, name: recipes.name, updatedAt: recipes.updatedAt })
    .from(recipes)
    .where(
      sql`${recipes.waterSourceId} = ${waterProfileId} OR ${recipes.waterTargetId} = ${waterProfileId}`,
    )
    .orderBy(sql`${recipes.updatedAt} DESC`)
    .all();
  return rows;
}
