import type { EquipmentProfile, StoredRecipe, MashProfile, FermentationProfile, Batch, BatchWithReadings } from '@truchabrew/shared-types';
import { calculateRecipeStats } from '@truchabrew/calculations';

export function baseEquipment(overrides: Partial<EquipmentProfile> = {}): EquipmentProfile {
  return {
    id: 'eq-1',
    name: 'Test Equipment',
    batchSizeL: 20,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 75,
    mashEfficiencyPct: 80,
    boilOffRateLPerHour: 3.5,
    trubChillerLossL: 2,
    hopUtilizationPct: 87,
    derivedFromEquipmentId: null,
    // Retired-constant values (M3_P1 spec §1.5) — keeps every existing
    // numeric expectation in dependent tests bit-identical to its pre-M3 value.
    mashWaterRatioLPerKg: 3.0,
    grainAbsorptionLPerKg: 0.96,
    hopstandUtilizationFactor: 0.26,
    hopstandTemperatureC: 79.0,
    spargeTemperatureC: 76.0,
    mashTunHeatCapacityL: 0.0,
    grainTemperatureC: 20.0,
    notes: '',
    ...overrides,
  };
}

/** A stored recipe as it would come back from GET /api/recipes/:id. */
export function baseStoredRecipe(overrides: Partial<StoredRecipe> = {}): StoredRecipe {
  return {
    id: 'r-1',
    name: 'Original Recipe',
    author: 'Tester',
    styleName: '21A. American IPA',
    notes: '',
    equipment: baseEquipment(),
    fermentables: [
      { id: 'f-local-1', name: 'Pale Ale Malt (2-Row)', type: 'Grain', amountKg: 5, colorSrm: 3.5, potentialSg: 1.038 },
    ],
    hops: [],
    yeasts: [],
    miscs: [],
    mashProfile: null,
    fermentationProfile: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function baseMashProfile(overrides: Partial<MashProfile> = {}): MashProfile {
  return {
    id: 'mash-1',
    name: 'Test Mash Schedule',
    targetPh: 5.4,
    spargeTempC: null,
    steps: [
      { id: 'mash-1-step-0', name: 'Saccharification Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
    ],
    ...overrides,
  };
}

export function baseFermentationProfile(overrides: Partial<FermentationProfile> = {}): FermentationProfile {
  return {
    id: 'ferm-1',
    name: 'Test Fermentation Schedule',
    steps: [{ id: 'ferm-1-step-0', name: 'Primary', type: 'Primary', stepTempC: 19, stepTimeDays: 14, rampDays: 0, pressurePsi: null }],
    ...overrides,
  };
}

/**
 * A batch as it would come back from GET /api/batches/:id. `statsSnapshot`
 * defaults to the real `calculateRecipeStats` output for the default
 * recipeSnapshot — representative of every batch created after migration
 * 0006 (AC-12a). Pass `statsSnapshot: null` explicitly to simulate the one
 * legacy pre-0006 row (AC-12e).
 */
export function baseBatch(overrides: Partial<Batch> = {}): Batch {
  const recipeSnapshot = baseStoredRecipe();
  return {
    id: 'batch-1',
    name: 'Batch #1 - Original Recipe',
    batchNo: 1,
    status: 'Planning',
    recipeId: 'r-1',
    recipeSnapshot,
    statsSnapshot: calculateRecipeStats(recipeSnapshot),
    measuredPreBoilGravity: null,
    measuredMashPh: null,
    measuredBoilSizeL: null,
    measuredBoilTimeMin: null,
    // NEW in M5_P1 — Batch gains two required keys (§1.3). `null` for both,
    // never widened to optional (the M4_P1 AC-46/M3_P1 "Known execution
    // risks" precedent for this exact forced-fallout class).
    measuredOg: null,
    fermentationStartDate: null,
    // NEW in M5_P2 — Batch gains nine required keys (§1.3). `null` for eight
    // of them, `''` for tasteNotes, never widened to optional (same
    // forced-fallout class as above).
    measuredFg: null,
    measuredBottlingSizeL: null,
    carbonationType: null,
    carbonationVolumesTarget: null,
    carbonationTempC: null,
    tasteNotes: '',
    tasteRating: null,
    bottlingDate: null,
    closingSnapshot: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * A batch as it would come back from GET /api/batches/:id (M5_P1 spec §1.3 /
 * M5_P2 spec §1.3). Defaults `readings: []` and `notes: []` — the common
 * case for a freshly-created batch.
 */
export function baseBatchWithReadings(overrides: Partial<BatchWithReadings> = {}): BatchWithReadings {
  return {
    ...baseBatch(),
    readings: [],
    notes: [],
    ...overrides,
  };
}
