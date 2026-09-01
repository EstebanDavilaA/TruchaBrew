import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type {
  DatabaseBackup,
  UserConfig,
  RestoreMode,
  RestoreRequest,
  RestoreSummary,
  EntityCounts,
  StoredRecipe,
  BatchWithReadings,
  EquipmentProfile,
  WaterProfile,
  MashProfile,
  FermentationProfile,
  InventoryItem,
} from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import {
  userConfig,
  equipmentProfiles,
  waterProfiles,
  mashProfiles,
  mashSteps,
  fermentationProfiles,
  fermentationSteps,
  recipes,
  recipeFermentables,
  recipeHops,
  recipeYeasts,
  recipeMiscs,
  batches,
  batchReadings,
  batchNotes,
  inventoryItems,
  inventoryTransactions,
} from '../db/schema';
import { listRecipeSummaries, getStoredRecipeById } from '../repositories/recipeRepository';
import { batchRepository } from '../repositories/batchRepository';
import { listEquipmentProfiles } from '../repositories/equipmentRepository';
import { listMashProfiles, listFermentationProfiles } from '../repositories/scheduleRepository';
import { listWaterProfiles } from '../repositories/waterProfileRepository';
import { listInventory } from '../repositories/inventoryRepository';
import { sendApiError } from '../errors';
import pkg from '../../package.json';

type UserConfigRow = typeof userConfig.$inferSelect;

/**
 * `routes/config.ts`'s own default-config shape (M7_P1), kept here as a
 * plain read-only mirror. This route deliberately does NOT import or call
 * that file's `getOrCreateDefaultConfig` — it is unexported (private to
 * config.ts) AND it INSERTs a seed row when the 'default' row is missing,
 * which would violate RA-2 (GET /api/backup/export must never mutate
 * database state). `readConfig` below performs a pure SELECT and falls back
 * to this literal default in memory only, on an empty/uninitialized table
 * (AC-11) — nothing is ever written back to the database from this route.
 */
const DEFAULT_CONFIG: UserConfig = {
  id: 'default',
  unitSystem: 'metric',
  gravityUnit: 'sg',
  temperatureUnit: 'celsius',
  ibuFormula: 'tinseth',
  abvFormula: 'simple',
};

function rowToConfigDomain(row: UserConfigRow): UserConfig {
  return {
    id: row.id,
    unitSystem: row.unitSystem as UserConfig['unitSystem'],
    gravityUnit: row.gravityUnit as UserConfig['gravityUnit'],
    temperatureUnit: row.temperatureUnit as UserConfig['temperatureUnit'],
    ibuFormula: row.ibuFormula as UserConfig['ibuFormula'],
    abvFormula: row.abvFormula as UserConfig['abvFormula'],
  };
}

/** Read-only — see the DEFAULT_CONFIG comment above for why this never self-heals via INSERT. */
function readConfig(db: Db): UserConfig {
  const row = db.select().from(userConfig).where(eq(userConfig.id, 'default')).get();
  return row ? rowToConfigDomain(row) : DEFAULT_CONFIG;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `truchabrew_backup_YYYY-MM-DD.json`, UTC-dated (RA-1 / AC-15). */
function backupFilename(now: Date): string {
  return `truchabrew_backup_${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}.json`;
}

/**
 * Assembles the full-database backup payload from every entity family's
 * existing repository read functions — this route composes them read-only
 * (RA-2: no repository write function is ever called here) rather than
 * hand-assembling rows, the same "one projection, reused everywhere" rule
 * `mashProfileRowsToDomain`/`equipmentRowToDomain` already enforce.
 */
async function buildBackup(db: Db): Promise<DatabaseBackup> {
  const recipes = listRecipeSummaries(db).map((summary) => getStoredRecipeById(db, summary.id)!);

  const batchList = await batchRepository.findAll(db);
  const batchesWithReadings = await Promise.all(
    batchList.map((batch) => batchRepository.findByIdWithReadings(db, batch.id)),
  );

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: pkg.version,
    data: {
      recipes,
      batches: batchesWithReadings.filter((b): b is NonNullable<typeof b> => b !== null),
      equipmentProfiles: listEquipmentProfiles(db),
      mashProfiles: listMashProfiles(db),
      fermentationProfiles: listFermentationProfiles(db),
      waterProfiles: listWaterProfiles(db),
      inventoryItems: listInventory(db),
      config: readConfig(db),
    },
  };
}

// ---------------------------------------------------------------------------
// M36_P2 — POST /api/backup/restore. Not exported from routes/schemas.ts
// (out of this phase's Authorized Files to Modify) — the request-body schema
// lives locally, on the same "loose on nested JSON-mode-shaped payloads"
// precedent `batchRecipeSnapshotWriteBodySchema`/`inventoryWriteBodySchema`'s
// `customDetails` already establish repo-wide: the 8 entity-family arrays
// are checked for TYPE (array/object) but never deep-item-validated — an
// item that violates a real DB constraint (a batch referencing an unknown
// recipeId, a duplicate primary key, ...) is instead caught as a genuine
// SQLite error inside the transaction (AC-5), exactly like every other route
// in this codebase defers cross-row referential integrity to the database
// rather than re-deriving it in a JSON schema.
// ---------------------------------------------------------------------------

const restoreRequestBodySchema = {
  type: 'object',
  required: ['backup', 'mode'],
  additionalProperties: false,
  properties: {
    mode: { type: 'string', enum: ['replace', 'merge'] },
    backup: {
      type: 'object',
      required: ['schemaVersion', 'data'],
      properties: {
        // A literal-1 mismatch (missing entirely, or any other value) is
        // what AC-11's "invalid schemaVersion" rejection is — ajv's `const`
        // keyword rejects both in one declarative check, and the resulting
        // `error.validation` is what server.ts's global error handler turns
        // into 400 VALIDATION_FAILED (the same path every other route's
        // malformed-body case already goes through).
        schemaVersion: { const: 1 },
        exportedAt: { type: 'string' },
        appVersion: { type: 'string' },
        data: {
          type: 'object',
          required: [
            'recipes',
            'batches',
            'equipmentProfiles',
            'mashProfiles',
            'fermentationProfiles',
            'waterProfiles',
            'inventoryItems',
            'config',
          ],
          properties: {
            recipes: { type: 'array' },
            batches: { type: 'array' },
            equipmentProfiles: { type: 'array' },
            mashProfiles: { type: 'array' },
            fermentationProfiles: { type: 'array' },
            waterProfiles: { type: 'array' },
            inventoryItems: { type: 'array' },
            config: { type: 'object' },
          },
        },
      },
    },
  },
};

/** `merge` mints a fresh id only for a table-scoped id collision; `replace` always keeps the backup's own id verbatim (RA-2). */
function idFor(mode: RestoreMode, originalId: string, existingIds: Set<string>): string {
  return mode === 'merge' && existingIds.has(originalId) ? randomUUID() : originalId;
}

/**
 * Every id currently in each FK-referenced table, read BEFORE any restore
 * write happens. `replace` never consults this (its own clearAllTables wipes
 * every row first, so no collision can ever occur) — computed unconditionally
 * anyway so the call site stays one shape for both modes.
 */
function loadExistingIdSets(db: Db) {
  return {
    equipment: new Set(db.select({ id: equipmentProfiles.id }).from(equipmentProfiles).all().map((r) => r.id)),
    water: new Set(db.select({ id: waterProfiles.id }).from(waterProfiles).all().map((r) => r.id)),
    mash: new Set(db.select({ id: mashProfiles.id }).from(mashProfiles).all().map((r) => r.id)),
    fermentation: new Set(db.select({ id: fermentationProfiles.id }).from(fermentationProfiles).all().map((r) => r.id)),
    recipes: new Set(db.select({ id: recipes.id }).from(recipes).all().map((r) => r.id)),
    batches: new Set(db.select({ id: batches.id }).from(batches).all().map((r) => r.id)),
    inventory: new Set(db.select({ id: inventoryItems.id }).from(inventoryItems).all().map((r) => r.id)),
  };
}

function computeCounts(backup: DatabaseBackup): EntityCounts {
  return {
    recipes: backup.data.recipes.length,
    batches: backup.data.batches.length,
    equipmentProfiles: backup.data.equipmentProfiles.length,
    mashProfiles: backup.data.mashProfiles.length,
    fermentationProfiles: backup.data.fermentationProfiles.length,
    waterProfiles: backup.data.waterProfiles.length,
    inventoryItems: backup.data.inventoryItems.length,
  };
}

/**
 * RA-1's exact reverse-dependency clear order. `inventory_transactions` is
 * RA-1's plain-English "inventory_deductions" — the real table name
 * (db/schema.ts) is `inventory_transactions`; DatabaseBackup carries no
 * ledger entity family at all (M36_P1 scope), so this table is cleared but
 * never repopulated by a restore — consistent with `inventoryItems` already
 * carrying ledger-PROJECTED on-hand quantities (inventoryRepository.ts's
 * `listInventory`), so an empty ledger post-restore reprojects to the exact
 * same on-hand figures the backup captured.
 */
function clearAllTables(tx: Db): void {
  tx.delete(batchReadings).run();
  tx.delete(batchNotes).run();
  tx.delete(inventoryTransactions).run();
  tx.delete(batches).run();
  tx.delete(recipeFermentables).run();
  tx.delete(recipeHops).run();
  tx.delete(recipeYeasts).run();
  tx.delete(recipeMiscs).run();
  tx.delete(recipes).run();
  tx.delete(mashSteps).run();
  tx.delete(mashProfiles).run();
  tx.delete(fermentationSteps).run();
  tx.delete(fermentationProfiles).run();
  tx.delete(equipmentProfiles).run();
  tx.delete(waterProfiles).run();
  tx.delete(inventoryItems).run();
  tx.delete(userConfig).run();
}

/**
 * Inserts every equipment profile in two passes so a `derivedFromEquipmentId`
 * self-reference never depends on array order: pass 1 inserts every row with
 * `derivedFromEquipmentId` temporarily null (every id in this family — final,
 * possibly-remapped — is decided up front, before any row exists), pass 2
 * resolves the real value once the full id map is known. `EquipmentProfile`
 * carries no `isSeed`/timestamps of its own (equipmentRowToDomain never
 * projects them out) — every restored profile is written as isSeed:0 at the
 * restore's own `now`, the same structural limitation `buildBackup` already
 * has on export.
 */
function restoreEquipmentProfiles(tx: Db, items: EquipmentProfile[], mode: RestoreMode, existingIds: Set<string>, now: string): Map<string, string> {
  const idMap = new Map<string, string>();
  for (const item of items) idMap.set(item.id, idFor(mode, item.id, existingIds));

  for (const item of items) {
    tx.insert(equipmentProfiles)
      .values({
        id: idMap.get(item.id)!,
        name: item.name,
        batchSizeL: item.batchSizeL,
        boilTimeMin: item.boilTimeMin,
        brewhouseEfficiencyPct: item.brewhouseEfficiencyPct,
        mashEfficiencyPct: item.mashEfficiencyPct,
        boilOffRateLPerHour: item.boilOffRateLPerHour,
        trubChillerLossL: item.trubChillerLossL,
        hopUtilizationPct: item.hopUtilizationPct,
        derivedFromEquipmentId: null,
        isSeed: 0,
        mashWaterRatioLPerKg: item.mashWaterRatioLPerKg,
        grainAbsorptionLPerKg: item.grainAbsorptionLPerKg,
        hopstandUtilizationFactor: item.hopstandUtilizationFactor,
        hopstandTemperatureC: item.hopstandTemperatureC,
        spargeTemperatureC: item.spargeTemperatureC,
        mashTunHeatCapacityL: item.mashTunHeatCapacityL,
        grainTemperatureC: item.grainTemperatureC,
        notes: item.notes,
        altitudeMeters: item.altitudeMeters ?? 0,
        calcStrikeWithThermalMass: item.calcStrikeWithThermalMass ? 1 : 0,
        mashTunDeadSpaceL: item.mashTunDeadSpaceL ?? 0,
        kettleLossL: item.kettleLossL ?? 0,
        mashTunWeightKg: item.mashTunWeightKg ?? 0,
        mashTunHeatCapacity: item.mashTunHeatCapacity ?? 0.12,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  for (const item of items) {
    if (!item.derivedFromEquipmentId) continue;
    const mappedParent = idMap.get(item.derivedFromEquipmentId);
    if (!mappedParent) continue;
    tx.update(equipmentProfiles)
      .set({ derivedFromEquipmentId: mappedParent })
      .where(eq(equipmentProfiles.id, idMap.get(item.id)!))
      .run();
  }

  return idMap;
}

function restoreWaterProfiles(tx: Db, items: WaterProfile[], mode: RestoreMode, existingIds: Set<string>, now: string): Map<string, string> {
  const idMap = new Map<string, string>();
  for (const item of items) {
    const finalId = idFor(mode, item.id, existingIds);
    idMap.set(item.id, finalId);
    tx.insert(waterProfiles)
      .values({
        id: finalId,
        name: item.name,
        type: item.type,
        calcium: item.calcium,
        magnesium: item.magnesium,
        sodium: item.sodium,
        chloride: item.chloride,
        sulfate: item.sulfate,
        bicarbonate: item.bicarbonate,
        ph: item.ph,
        description: item.description,
        isSeed: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
  return idMap;
}

/** Steps are leaf rows with no FK dependents of their own — always a fresh id in merge mode, dense 0-based position recomputed by array index (mirrors scheduleRepository.ts's writeMashSteps). */
function restoreMashProfiles(tx: Db, items: MashProfile[], mode: RestoreMode, existingIds: Set<string>, now: string): Map<string, string> {
  const idMap = new Map<string, string>();
  for (const profile of items) {
    const finalId = idFor(mode, profile.id, existingIds);
    idMap.set(profile.id, finalId);
    tx.insert(mashProfiles)
      .values({ id: finalId, name: profile.name, targetPh: profile.targetPh, spargeTempC: profile.spargeTempC, isSeed: 0, createdAt: now, updatedAt: now })
      .run();
    profile.steps.forEach((step, position) => {
      tx.insert(mashSteps)
        .values({
          id: mode === 'merge' ? randomUUID() : step.id,
          mashProfileId: finalId,
          position,
          name: step.name,
          type: step.type,
          stepTempC: step.stepTempC,
          stepTimeMin: step.stepTimeMin,
          rampTimeMin: step.rampTimeMin,
          infuseAmountL: step.infuseAmountL,
          infuseWaterTempC: step.infuseWaterTempC,
        })
        .run();
    });
  }
  return idMap;
}

function restoreFermentationProfiles(tx: Db, items: FermentationProfile[], mode: RestoreMode, existingIds: Set<string>, now: string): Map<string, string> {
  const idMap = new Map<string, string>();
  for (const profile of items) {
    const finalId = idFor(mode, profile.id, existingIds);
    idMap.set(profile.id, finalId);
    tx.insert(fermentationProfiles).values({ id: finalId, name: profile.name, isSeed: 0, createdAt: now, updatedAt: now }).run();
    profile.steps.forEach((step, position) => {
      tx.insert(fermentationSteps)
        .values({
          id: mode === 'merge' ? randomUUID() : step.id,
          fermentationProfileId: finalId,
          position,
          name: step.name,
          type: step.type,
          stepTempC: step.stepTempC,
          stepTimeDays: step.stepTimeDays,
          rampDays: step.rampDays,
          pressurePsi: step.pressurePsi,
        })
        .run();
    });
  }
  return idMap;
}

/**
 * `recipe.equipment`/`recipe.mashProfile`/`recipe.fermentationProfile` are
 * FULLY EMBEDDED objects (StoredRecipe extends Recipe) — this never
 * re-inserts from them, only reads their `.id` to resolve the already-
 * restored parent row's final (possibly remapped) id via the family's own
 * idMap built earlier in this same restore. `waterSourceId`/`waterTargetId`
 * are plain id references (Recipe never embeds a WaterProfile), resolved the
 * same way against waterIdMap.
 */
function restoreRecipes(
  tx: Db,
  items: StoredRecipe[],
  mode: RestoreMode,
  existingIds: Set<string>,
  equipmentIdMap: Map<string, string>,
  mashIdMap: Map<string, string>,
  fermentationIdMap: Map<string, string>,
  waterIdMap: Map<string, string>,
): Map<string, string> {
  const idMap = new Map<string, string>();

  for (const recipe of items) {
    const finalId = idFor(mode, recipe.id, existingIds);
    idMap.set(recipe.id, finalId);

    const equipmentId = equipmentIdMap.get(recipe.equipment.id) ?? recipe.equipment.id;
    const mashProfileId = recipe.mashProfile ? (mashIdMap.get(recipe.mashProfile.id) ?? recipe.mashProfile.id) : null;
    const fermentationProfileId = recipe.fermentationProfile ? (fermentationIdMap.get(recipe.fermentationProfile.id) ?? recipe.fermentationProfile.id) : null;
    const waterSourceId = recipe.waterSourceId ? (waterIdMap.get(recipe.waterSourceId) ?? recipe.waterSourceId) : null;
    const waterTargetId = recipe.waterTargetId ? (waterIdMap.get(recipe.waterTargetId) ?? recipe.waterTargetId) : null;

    tx.insert(recipes)
      .values({
        id: finalId,
        name: recipe.name,
        author: recipe.author,
        styleName: recipe.styleName,
        equipmentId,
        notes: recipe.notes,
        mashProfileId,
        fermentationProfileId,
        waterSourceId,
        waterTargetId,
        createdAt: recipe.createdAt,
        updatedAt: recipe.updatedAt,
      })
      .run();

    recipe.fermentables.forEach((f, position) => {
      tx.insert(recipeFermentables)
        .values({
          id: mode === 'merge' ? randomUUID() : f.id,
          recipeId: finalId,
          position,
          name: f.name,
          type: f.type,
          amountKg: f.amountKg,
          colorSrm: f.colorSrm,
          potentialSg: f.potentialSg,
          notes: f.notes ?? null,
        })
        .run();
    });

    recipe.hops.forEach((h, position) => {
      tx.insert(recipeHops)
        .values({
          id: mode === 'merge' ? randomUUID() : h.id,
          recipeId: finalId,
          position,
          name: h.name,
          amountG: h.amountG,
          alphaAcidPct: h.alphaAcidPct,
          use: h.use,
          boilMins: h.boilMins,
          whirlpoolMins: h.whirlpoolMins,
          whirlpoolTempC: h.whirlpoolTempC,
          type: h.type,
          timeMinutes: h.timeMinutes ?? null,
          dryHopDayOffset: h.dryHopDayOffset ?? null,
          dryHopDurationDays: h.dryHopDurationDays ?? null,
        })
        .run();
    });

    recipe.yeasts.forEach((y, position) => {
      tx.insert(recipeYeasts)
        .values({
          id: mode === 'merge' ? randomUUID() : y.id,
          recipeId: finalId,
          position,
          name: y.name,
          type: y.type,
          form: y.form,
          laboratory: y.laboratory,
          attenuationPct: y.attenuationPct,
          amountPkg: y.amountPkg,
        })
        .run();
    });

    recipe.miscs.forEach((m, position) => {
      tx.insert(recipeMiscs)
        .values({
          id: mode === 'merge' ? randomUUID() : m.id,
          recipeId: finalId,
          position,
          name: m.name,
          type: m.type,
          use: m.use,
          timeMinutes: m.timeMinutes,
          amount: m.amount,
          unit: m.unit,
          notes: m.notes ?? null,
        })
        .run();
    });
  }

  return idMap;
}

/** `recipeSnapshot`/`statsSnapshot`/`closingSnapshot` are frozen historical JSON blobs — restored verbatim, never re-derived or re-linked (they carry no live FK of their own). */
function restoreBatches(tx: Db, items: BatchWithReadings[], mode: RestoreMode, existingIds: Set<string>, recipeIdMap: Map<string, string>): void {
  for (const batch of items) {
    const finalId = idFor(mode, batch.id, existingIds);
    const recipeId = recipeIdMap.get(batch.recipeId) ?? batch.recipeId;

    tx.insert(batches)
      .values({
        id: finalId,
        name: batch.name,
        batchNo: batch.batchNo,
        brewer: batch.brewer ?? null,
        brewDate: batch.brewDate ?? null,
        status: batch.status,
        recipeId,
        recipeSnapshot: batch.recipeSnapshot,
        statsSnapshot: batch.statsSnapshot,
        measuredPreBoilGravity: batch.measuredPreBoilGravity,
        measuredMashPh: batch.measuredMashPh,
        measuredBoilSizeL: batch.measuredBoilSizeL,
        measuredBoilTimeMin: batch.measuredBoilTimeMin,
        measuredOg: batch.measuredOg,
        fermentationStartDate: batch.fermentationStartDate,
        measuredFg: batch.measuredFg,
        measuredBottlingSizeL: batch.measuredBottlingSizeL,
        carbonationType: batch.carbonationType,
        carbonationVolumesTarget: batch.carbonationVolumesTarget,
        carbonationTempC: batch.carbonationTempC,
        tasteNotes: batch.tasteNotes,
        tasteRating: batch.tasteRating,
        bottlingDate: batch.bottlingDate,
        closingSnapshot: batch.closingSnapshot,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      })
      .run();

    for (const reading of batch.readings) {
      tx.insert(batchReadings)
        .values({
          id: mode === 'merge' ? randomUUID() : reading.id,
          batchId: finalId,
          readingTime: reading.readingTime,
          sg: reading.sg,
          tempC: reading.tempC,
          comment: reading.comment,
          ph: reading.ph,
          pressurePsi: reading.pressurePsi,
        })
        .run();
    }

    for (const note of batch.notes) {
      tx.insert(batchNotes)
        .values({
          id: mode === 'merge' ? randomUUID() : note.id,
          batchId: finalId,
          timestamp: note.timestamp,
          status: note.status,
          note: note.note,
        })
        .run();
    }
  }
}

function restoreInventoryItems(tx: Db, items: InventoryItem[], mode: RestoreMode, existingIds: Set<string>): void {
  for (const item of items) {
    tx.insert(inventoryItems)
      .values({
        id: idFor(mode, item.id, existingIds),
        category: item.category,
        name: item.name,
        nameKey: item.nameKey,
        quantity: item.quantity,
        unit: item.unit,
        costPerUnit: item.costPerUnit,
        purchaseDate: item.purchaseDate,
        expiryDate: item.expiryDate,
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        customDetails: item.customDetails ?? null,
      })
      .run();
  }
}

/**
 * The one singleton exception to "every restored entity is always a fresh
 * INSERT": `user_config`'s primary key is fixed to `'default'` (schema.ts),
 * so both modes converge on the same incoming config row rather than ever
 * producing a second config row under a remapped id.
 */
function upsertUserConfig(tx: Db, config: UserConfig, now: string): void {
  const id = config.id || 'default';
  const existing = tx.select({ id: userConfig.id }).from(userConfig).where(eq(userConfig.id, id)).get();
  const row = {
    id,
    unitSystem: config.unitSystem,
    gravityUnit: config.gravityUnit,
    temperatureUnit: config.temperatureUnit,
    ibuFormula: config.ibuFormula,
    abvFormula: config.abvFormula,
    updatedAt: now,
  };
  if (existing) {
    tx.update(userConfig).set(row).where(eq(userConfig.id, id)).run();
  } else {
    tx.insert(userConfig).values({ ...row, createdAt: now }).run();
  }
}

/**
 * The whole restore runs inside ONE `db.transaction()` (AC-5): if any insert
 * fails a DB constraint (a dangling FK, a duplicate primary key, a UNIQUE
 * violation), the callback throws, drizzle/better-sqlite3 rolls back
 * everything written so far in this call — including a `replace` mode's own
 * table wipe — and the caller's try/catch turns that into a 500 with nothing
 * left partially applied. Existing-id sets for merge-mode collision
 * resolution are read BEFORE the transaction opens (pure reads, no atomicity
 * requirement of their own).
 */
function performRestore(db: Db, backup: DatabaseBackup, mode: RestoreMode): EntityCounts {
  const now = new Date().toISOString();
  const existing = mode === 'merge' ? loadExistingIdSets(db) : null;
  const emptySet = new Set<string>();

  db.transaction((tx) => {
    const txDb = tx as unknown as Db;

    if (mode === 'replace') {
      clearAllTables(txDb);
    }

    const equipmentIdMap = restoreEquipmentProfiles(txDb, backup.data.equipmentProfiles, mode, existing?.equipment ?? emptySet, now);
    const waterIdMap = restoreWaterProfiles(txDb, backup.data.waterProfiles, mode, existing?.water ?? emptySet, now);
    const mashIdMap = restoreMashProfiles(txDb, backup.data.mashProfiles, mode, existing?.mash ?? emptySet, now);
    const fermentationIdMap = restoreFermentationProfiles(txDb, backup.data.fermentationProfiles, mode, existing?.fermentation ?? emptySet, now);
    const recipeIdMap = restoreRecipes(txDb, backup.data.recipes, mode, existing?.recipes ?? emptySet, equipmentIdMap, mashIdMap, fermentationIdMap, waterIdMap);
    restoreBatches(txDb, backup.data.batches, mode, existing?.batches ?? emptySet, recipeIdMap);
    restoreInventoryItems(txDb, backup.data.inventoryItems, mode, existing?.inventory ?? emptySet);
    upsertUserConfig(txDb, backup.data.config, now);
  });

  return computeCounts(backup);
}

export function registerBackupRoutes(app: FastifyInstance, db: Db): void {
  // AC-2 through AC-11: read-only full-database export (RA-2). Headers are
  // set explicitly so the browser always treats the response as a
  // file-download attachment rather than inline JSON (AC-15's filename
  // format is produced by backupFilename above).
  app.get('/api/backup/export', async (_request, reply) => {
    const backup = await buildBackup(db);
    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${backupFilename(new Date())}"`)
      .status(200)
      .send(backup);
  });

  // M36_P2 — transactional restore (AC-3 through AC-11). Schema validation
  // (malformed shape / wrong schemaVersion) happens BEFORE the transaction
  // ever opens, via Fastify's ajv `schema.body` — a validation failure never
  // reaches performRestore, so nothing is ever cleared or written for a
  // rejected payload.
  app.post<{ Body: RestoreRequest }>(
    '/api/backup/restore',
    { schema: { body: restoreRequestBodySchema } },
    async (request, reply) => {
      const { backup, mode } = request.body;

      try {
        const counts = performRestore(db, backup, mode);
        const summary: RestoreSummary = {
          restoredAt: new Date().toISOString(),
          mode,
          counts,
        };
        reply.status(200).send(summary);
      } catch (err) {
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        sendApiError(reply, 500, 'INTERNAL', `Restore failed and was rolled back: ${message}`);
      }
    },
  );
}
