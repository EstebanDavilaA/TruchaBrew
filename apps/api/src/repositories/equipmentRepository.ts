import { asc, eq, sql } from 'drizzle-orm';
import type { EquipmentProfile, EquipmentUpdateInput } from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import { equipmentProfiles, recipes } from '../db/schema';
import type { InferSelectModel } from 'drizzle-orm';

export type EquipmentRow = InferSelectModel<typeof equipmentProfiles>;

/**
 * The single row -> domain projection. No route, repository or test may
 * hand-assemble an EquipmentProfile from a row (M3_P1 spec §2.6) — adding a
 * field in one place and not the other is how a profile ends up with
 * `undefined` where a `number` is declared.
 */
export function equipmentRowToDomain(row: EquipmentRow): EquipmentProfile {
  return {
    id: row.id,
    name: row.name,
    batchSizeL: row.batchSizeL,
    boilTimeMin: row.boilTimeMin,
    brewhouseEfficiencyPct: row.brewhouseEfficiencyPct,
    mashEfficiencyPct: row.mashEfficiencyPct,
    boilOffRateLPerHour: row.boilOffRateLPerHour,
    trubChillerLossL: row.trubChillerLossL,
    hopUtilizationPct: row.hopUtilizationPct,
    derivedFromEquipmentId: row.derivedFromEquipmentId,
    mashWaterRatioLPerKg: row.mashWaterRatioLPerKg,
    grainAbsorptionLPerKg: row.grainAbsorptionLPerKg,
    hopstandUtilizationFactor: row.hopstandUtilizationFactor,
    hopstandTemperatureC: row.hopstandTemperatureC,
    spargeTemperatureC: row.spargeTemperatureC,
    mashTunHeatCapacityL: row.mashTunHeatCapacityL,
    grainTemperatureC: row.grainTemperatureC,
    notes: row.notes,
    altitudeMeters: row.altitudeMeters ?? 0,
    calcStrikeWithThermalMass: Boolean(row.calcStrikeWithThermalMass),
    mashTunDeadSpaceL: row.mashTunDeadSpaceL ?? 0,
    kettleLossL: row.kettleLossL ?? 0,
    mashTunWeightKg: row.mashTunWeightKg ?? 0,
    mashTunHeatCapacity: row.mashTunHeatCapacity ?? 0.12,
  };
}

/** Seed profiles first, then alphabetically by name. */
export function listEquipmentProfiles(db: Db): EquipmentProfile[] {
  const rows = db
    .select()
    .from(equipmentProfiles)
    .orderBy(sql`${equipmentProfiles.isSeed} DESC`, asc(equipmentProfiles.name))
    .all();
  return rows.map(equipmentRowToDomain);
}

export function getEquipmentProfileById(db: Db, id: string): EquipmentProfile | null {
  const row = db.select().from(equipmentProfiles).where(eq(equipmentProfiles.id, id)).get();
  return row ? equipmentRowToDomain(row) : null;
}

export function equipmentProfileExists(db: Db, id: string): boolean {
  const row = db
    .select({ id: equipmentProfiles.id })
    .from(equipmentProfiles)
    .where(eq(equipmentProfiles.id, id))
    .get();
  return row !== undefined;
}

export interface CreateEquipmentInput {
  name: string;
  batchSizeL: number;
  boilTimeMin: number;
  brewhouseEfficiencyPct: number;
  mashEfficiencyPct: number;
  boilOffRateLPerHour: number;
  trubChillerLossL: number;
  hopUtilizationPct: number;
  derivedFromEquipmentId: string | null;
  mashWaterRatioLPerKg: number;
  grainAbsorptionLPerKg: number;
  hopstandUtilizationFactor: number;
  hopstandTemperatureC: number;
  spargeTemperatureC: number;
  mashTunHeatCapacityL: number;
  grainTemperatureC: number;
  notes: string;
  altitudeMeters?: number;
  calcStrikeWithThermalMass?: boolean;
  mashTunDeadSpaceL?: number;
  kettleLossL?: number;
  mashTunWeightKg?: number;
  mashTunHeatCapacity?: number;
}

export function createEquipmentProfile(db: Db, id: string, input: CreateEquipmentInput): EquipmentProfile {
  const now = new Date().toISOString();
  db.insert(equipmentProfiles)
    .values({
      id,
      name: input.name,
      batchSizeL: input.batchSizeL,
      boilTimeMin: input.boilTimeMin,
      brewhouseEfficiencyPct: input.brewhouseEfficiencyPct,
      mashEfficiencyPct: input.mashEfficiencyPct,
      boilOffRateLPerHour: input.boilOffRateLPerHour,
      trubChillerLossL: input.trubChillerLossL,
      hopUtilizationPct: input.hopUtilizationPct,
      derivedFromEquipmentId: input.derivedFromEquipmentId,
      mashWaterRatioLPerKg: input.mashWaterRatioLPerKg,
      grainAbsorptionLPerKg: input.grainAbsorptionLPerKg,
      hopstandUtilizationFactor: input.hopstandUtilizationFactor,
      hopstandTemperatureC: input.hopstandTemperatureC,
      spargeTemperatureC: input.spargeTemperatureC,
      mashTunHeatCapacityL: input.mashTunHeatCapacityL,
      grainTemperatureC: input.grainTemperatureC,
      notes: input.notes,
      altitudeMeters: input.altitudeMeters ?? 0.0,
      calcStrikeWithThermalMass: input.calcStrikeWithThermalMass ? 1 : 0,
      mashTunDeadSpaceL: input.mashTunDeadSpaceL ?? 0.0,
      kettleLossL: input.kettleLossL ?? 0.0,
      mashTunWeightKg: input.mashTunWeightKg ?? 0.0,
      mashTunHeatCapacity: input.mashTunHeatCapacity ?? 0.12,
      isSeed: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getEquipmentProfileById(db, id)!;
}

/**
 * Full replace of every mutable field in `EquipmentUpdateInput` (everything
 * on EquipmentProfile except `id`, the path parameter, and
 * `derivedFromEquipmentId`, which is server-owned and simply absent from the
 * input type — see M3_P1 spec, Resolved Ambiguities). `id`, `createdAt`,
 * `isSeed` and `derivedFromEquipmentId` are never touched; `updatedAt`
 * always advances. Returns null when `id` does not exist — nothing is
 * written, never an upsert-on-missing.
 */
export function updateEquipmentProfile(db: Db, id: string, input: EquipmentUpdateInput): EquipmentProfile | null {
  if (!equipmentProfileExists(db, id)) return null;

  const now = new Date().toISOString();
  db.update(equipmentProfiles)
    .set({
      name: input.name,
      batchSizeL: input.batchSizeL,
      boilTimeMin: input.boilTimeMin,
      brewhouseEfficiencyPct: input.brewhouseEfficiencyPct,
      mashEfficiencyPct: input.mashEfficiencyPct,
      boilOffRateLPerHour: input.boilOffRateLPerHour,
      trubChillerLossL: input.trubChillerLossL,
      hopUtilizationPct: input.hopUtilizationPct,
      mashWaterRatioLPerKg: input.mashWaterRatioLPerKg,
      grainAbsorptionLPerKg: input.grainAbsorptionLPerKg,
      hopstandUtilizationFactor: input.hopstandUtilizationFactor,
      hopstandTemperatureC: input.hopstandTemperatureC,
      spargeTemperatureC: input.spargeTemperatureC,
      mashTunHeatCapacityL: input.mashTunHeatCapacityL,
      grainTemperatureC: input.grainTemperatureC,
      notes: input.notes,
      ...(input.altitudeMeters !== undefined ? { altitudeMeters: input.altitudeMeters } : {}),
      ...(input.calcStrikeWithThermalMass !== undefined ? { calcStrikeWithThermalMass: input.calcStrikeWithThermalMass ? 1 : 0 } : {}),
      ...(input.mashTunDeadSpaceL !== undefined ? { mashTunDeadSpaceL: input.mashTunDeadSpaceL } : {}),
      ...(input.kettleLossL !== undefined ? { kettleLossL: input.kettleLossL } : {}),
      ...(input.mashTunWeightKg !== undefined ? { mashTunWeightKg: input.mashTunWeightKg } : {}),
      ...(input.mashTunHeatCapacity !== undefined ? { mashTunHeatCapacity: input.mashTunHeatCapacity } : {}),
      updatedAt: now,
    })
    .where(eq(equipmentProfiles.id, id))
    .run();

  return getEquipmentProfileById(db, id);
}

/**
 * Deletes the profile. Returns false (nothing written) when `id` does not
 * exist. Does NOT check whether any recipe references the profile — that
 * check is `findRecipesUsingEquipment`, called by the route BEFORE this
 * function so a still-referenced profile never reaches here (the
 * `recipes.equipment_id` ON DELETE RESTRICT edge would otherwise surface as
 * a raw SQLite constraint error rather than a clean 409 EQUIPMENT_IN_USE).
 */
export function deleteEquipmentProfile(db: Db, id: string): boolean {
  if (!equipmentProfileExists(db, id)) return false;
  db.delete(equipmentProfiles).where(eq(equipmentProfiles.id, id)).run();
  return true;
}

export interface RecipeUsingEquipment {
  id: string;
  name: string;
  updatedAt: string;
}

/**
 * Every recipe that references `equipmentId`, newest-first by updatedAt.
 * Returns [] (never null, never throws) when nothing matches — an empty
 * array is what authorises a delete. The route caps this to 5 names and a
 * count for the 409 EQUIPMENT_IN_USE body's `details`.
 */
export function findRecipesUsingEquipment(db: Db, equipmentId: string): RecipeUsingEquipment[] {
  return db
    .select({ id: recipes.id, name: recipes.name, updatedAt: recipes.updatedAt })
    .from(recipes)
    .where(eq(recipes.equipmentId, equipmentId))
    .orderBy(sql`${recipes.updatedAt} DESC`)
    .all();
}

/**
 * Finds an existing derived profile with the same `derivedFromEquipmentId`
 * and a `batchSizeL` equal within 1e-9, so scaling the same recipe to the
 * same target repeatedly reuses one row instead of accumulating duplicates.
 */
export function findExistingDerivedProfile(
  db: Db,
  derivedFromEquipmentId: string,
  targetBatchSizeL: number,
): EquipmentProfile | null {
  const candidates = db
    .select()
    .from(equipmentProfiles)
    .where(eq(equipmentProfiles.derivedFromEquipmentId, derivedFromEquipmentId))
    .all();
  const match = candidates.find((row) => Math.abs(row.batchSizeL - targetBatchSizeL) < 1e-9);
  return match ? equipmentRowToDomain(match) : null;
}
