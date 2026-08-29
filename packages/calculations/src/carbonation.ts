import type { CarbonationType } from '@truchabrew/shared-types';

// M5_P2 spec §2.2. Transcribed from
// .gsd/documents/brewfather_clone_build_spec.md:245-259. No function in this
// module performs I/O, reads the current wall-clock time, generates an id,
// or touches a random source. The coefficients below are module-local named
// constants, not exported (M5_P2 spec, Resolved Ambiguities / §4 deviation
// 5) — packages/calculations/test/units.test.ts asserts a closed list of
// exactly 15 exported constant names in constants.ts and is itself
// Untouched; these nine values are used by exactly one module and are not
// kit settings.

/** Order is the order the UI offers. The route enum derives from this array. */
export const CARBONATION_TYPES: readonly CarbonationType[] = ['Sugar', 'KegForce', 'KegForceQuick', 'KegSugar'];

const RESIDUAL_CO2_CONST = 3.0378;
const RESIDUAL_CO2_LINEAR = 0.050062;
const RESIDUAL_CO2_QUADRATIC = 0.00026555;

/** Residual CO2 (volumes) retained by beer that peaked at the given temperature. Total; never throws. */
export function residualCO2Volumes(peakFermentationTempC: number): number {
  return (
    RESIDUAL_CO2_CONST -
    RESIDUAL_CO2_LINEAR * peakFermentationTempC +
    RESIDUAL_CO2_QUADRATIC * peakFermentationTempC ** 2
  );
}

/** Grams of sucrose per liter per volume of CO2 the beer is short of its residual. */
const SUCROSE_G_PER_LITER_PER_VOLUME = 4;

export interface PrimingSugarInput {
  volumesCO2Target: number;
  peakFermentationTempC: number;
  beerVolumeL: number;
}

/** Grams of SUCROSE. Clamped at 0 per the source — a target below residual CO2 needs no sugar. */
export function primingSugarG(input: PrimingSugarInput): number {
  const co2Needed = input.volumesCO2Target - residualCO2Volumes(input.peakFermentationTempC);
  return Math.max(0, co2Needed * SUCROSE_G_PER_LITER_PER_VOLUME * input.beerVolumeL);
}

const FORCE_CARB_CONST = -16.6999;
const FORCE_CARB_TEMP_LINEAR = 0.0101059;
const FORCE_CARB_TEMP_QUADRATIC = 0.00116512;
const FORCE_CARB_TEMP_VOLUMES = 0.173354;
const FORCE_CARB_VOLUMES_LINEAR = 4.24267;
const FORCE_CARB_VOLUMES_QUADRATIC = 0.0684226;

export interface ForceCarbonationInput {
  volumesCO2: number;
  tempC: number;
}

/** Equilibrium PSI. UNCLAMPED — returns negative values for out-of-domain inputs, by design. */
export function forceCarbonationPsi(input: ForceCarbonationInput): number {
  const tempF = (input.tempC * 9) / 5 + 32;
  return (
    FORCE_CARB_CONST -
    FORCE_CARB_TEMP_LINEAR * tempF +
    FORCE_CARB_TEMP_QUADRATIC * tempF ** 2 +
    FORCE_CARB_TEMP_VOLUMES * tempF * input.volumesCO2 +
    FORCE_CARB_VOLUMES_LINEAR * input.volumesCO2 -
    FORCE_CARB_VOLUMES_QUADRATIC * input.volumesCO2 ** 2
  );
}

// ---------------------------------------------------------------------------
// M17_P1 Split Packaging & Extended Priming Sugar Types
// ---------------------------------------------------------------------------

export type PrimingSugarType = 'table_sugar' | 'corn_sugar' | 'dme' | 'honey';

export const PRIMING_SUGAR_MULTIPLIERS: Readonly<Record<PrimingSugarType, number>> = {
  table_sugar: 1.0, // Sucrose
  corn_sugar: 1.09, // Dextrose (Glucose Monohydrate)
  dme: 1.4, // Dry Malt Extract
  honey: 1.33, // Pure Honey
};

export interface PrimingSugarOptions {
  volumesCO2Target: number;
  peakFermentationTempC: number;
  beerVolumeL: number;
  sugarType?: PrimingSugarType;
}

export function calculatePrimingSugarCustom(input: PrimingSugarOptions): number {
  const sucrose = primingSugarG({
    volumesCO2Target: input.volumesCO2Target,
    peakFermentationTempC: input.peakFermentationTempC,
    beerVolumeL: input.beerVolumeL,
  });
  const sugarType = input.sugarType ?? 'table_sugar';
  const multiplier = PRIMING_SUGAR_MULTIPLIERS[sugarType] ?? 1.0;
  return sucrose * multiplier;
}

export type SplitPackageType = 'keg' | 'bottles';

export interface SplitPackageInput {
  id: string;
  type: SplitPackageType;
  volumeL: number;
  targetVolumesCO2: number;
  tempC?: number; // storage temp for force carbonation PSI
  sugarType?: PrimingSugarType;
  bottleSizeMl?: number;
}

export interface SplitPackageResult {
  id: string;
  type: SplitPackageType;
  volumeL: number;
  targetVolumesCO2: number;
  forceCarbonationPsi: number | null;
  primingSugarG: number | null;
  primingSugarEquivGPerL: number | null;
  bottleCount: number | null;
  sugarGramsPerBottle: number | null;
}

export interface SplitPackagingSummary {
  totalPackagedVolumeL: number;
  unassignedVolumeL: number;
  results: SplitPackageResult[];
}

export function calculateSplitPackaging(
  totalBeerVolumeL: number,
  peakFermentationTempC: number,
  packages: readonly SplitPackageInput[]
): SplitPackagingSummary {
  let totalPackaged = 0;

  const results: SplitPackageResult[] = packages.map((pkg) => {
    totalPackaged += pkg.volumeL;

    if (pkg.type === 'keg') {
      const psi = forceCarbonationPsi({
        volumesCO2: pkg.targetVolumesCO2,
        tempC: pkg.tempC ?? 4.0,
      });
      return {
        id: pkg.id,
        type: 'keg',
        volumeL: pkg.volumeL,
        targetVolumesCO2: pkg.targetVolumesCO2,
        forceCarbonationPsi: psi,
        primingSugarG: null,
        primingSugarEquivGPerL: null,
        bottleCount: null,
        sugarGramsPerBottle: null,
      };
    } else {
      const sugarG = calculatePrimingSugarCustom({
        volumesCO2Target: pkg.targetVolumesCO2,
        peakFermentationTempC,
        beerVolumeL: pkg.volumeL,
        sugarType: pkg.sugarType ?? 'table_sugar',
      });
      const sugarEquiv = pkg.volumeL > 0 ? sugarG / pkg.volumeL : 0;
      const bottleSize = pkg.bottleSizeMl && pkg.bottleSizeMl > 0 ? pkg.bottleSizeMl : 330;
      const bottleCount = pkg.volumeL > 0 ? Math.ceil((pkg.volumeL * 1000) / bottleSize) : 0;
      const sugarPerBottle = bottleCount > 0 ? sugarG / bottleCount : 0;

      return {
        id: pkg.id,
        type: 'bottles',
        volumeL: pkg.volumeL,
        targetVolumesCO2: pkg.targetVolumesCO2,
        forceCarbonationPsi: null,
        primingSugarG: sugarG,
        primingSugarEquivGPerL: sugarEquiv,
        bottleCount,
        sugarGramsPerBottle: sugarPerBottle,
      };
    }
  });

  const unassigned = Number((totalBeerVolumeL - totalPackaged).toFixed(2));

  return {
    totalPackagedVolumeL: Number(totalPackaged.toFixed(2)),
    unassignedVolumeL: unassigned,
    results,
  };
}

export interface PrimingSolutionOptions {
  /** Total sugar mass in grams to dissolve. */
  sugarG: number;
  /** Total bottle count. */
  bottleCount: number;
  /** Volume of water in mL to dissolve sugar in (Mode A). Defaults to 200 mL if targetDosePerBottleMl not provided. */
  waterVolumeMl?: number;
  /** Target syringe injection volume per bottle in mL (Mode B, e.g. 5.0 mL / bottle). */
  targetDosePerBottleMl?: number;
  /** Optional solution buffer percentage (e.g. 10 for +10% extra syrup to account for dead space / losses). Defaults to 0. */
  solutionBufferPct?: number;
}

export interface PrimingSolutionResult {
  /** Water volume in mL. */
  waterVolumeMl: number;
  /** Total solution volume in mL (water + sugar displacement volume). */
  totalSolutionMl: number;
  /** Total sugar to weigh out in g (including buffer if bufferPct > 0). */
  totalSugarToDissolveG: number;
  /** Volume displaced by sugar in mL. */
  sugarDisplacementMl: number;
  /** Syringe injection dose per bottle in mL. */
  syringeDosePerBottleMl: number;
  /** Sugar concentration in g of sugar per mL of final solution. */
  sugarConcentrationGPerMl: number;
  /** Solution buffer percentage applied (0-100). */
  solutionBufferPct: number;
  /** Human-readable instructions banner. */
  instructionText: string;
}

/** Sugar displacement constant: 1g sugar adds ~0.625 mL to aqueous solution. */
export const SUGAR_DISPLACEMENT_ML_PER_G = 0.625;

export function calculatePrimingSolution(options: PrimingSolutionOptions): PrimingSolutionResult {
  const baseSugarG = Math.max(0, options.sugarG);
  const bottleCount = Math.max(1, options.bottleCount);
  const bufferPct = Math.max(0, options.solutionBufferPct ?? 0);
  const bufferMultiplier = 1 + bufferPct / 100;

  // Sugar to dissolve scales by buffer multiplier so concentration per injection dose remains exact
  const totalSugarToDissolveG = Number((baseSugarG * bufferMultiplier).toFixed(1));
  const sugarDisplacementMl = Number((totalSugarToDissolveG * SUGAR_DISPLACEMENT_ML_PER_G).toFixed(2));

  let waterVolumeMl: number;
  let totalSolutionMl: number;
  let syringeDosePerBottleMl: number;

  if (options.targetDosePerBottleMl && options.targetDosePerBottleMl > 0) {
    // Mode B: Target dose per bottle specified
    syringeDosePerBottleMl = Number(options.targetDosePerBottleMl.toFixed(2));
    const neededSolutionForBottles = syringeDosePerBottleMl * bottleCount;
    totalSolutionMl = Number((neededSolutionForBottles * bufferMultiplier).toFixed(2));
    waterVolumeMl = Math.max(10, Number((totalSolutionMl - sugarDisplacementMl).toFixed(2)));
  } else {
    // Mode A: Dilution water volume specified
    const baseWater = options.waterVolumeMl !== undefined && options.waterVolumeMl > 0 ? options.waterVolumeMl : 200;
    waterVolumeMl = Number((baseWater * bufferMultiplier).toFixed(0));
    totalSolutionMl = Number((waterVolumeMl + sugarDisplacementMl).toFixed(2));
    // The syringe injection dose per bottle is totalSolutionMl / (bottleCount * bufferMultiplier)
    syringeDosePerBottleMl = Number((totalSolutionMl / (bottleCount * bufferMultiplier)).toFixed(2));
  }

  const sugarConcentrationGPerMl = totalSolutionMl > 0 ? Number((totalSugarToDissolveG / totalSolutionMl).toFixed(4)) : 0;
  const bufferNote = bufferPct > 0 ? ` (includes +${bufferPct}% buffer)` : '';
  const instructionText = `Dissolve ${totalSugarToDissolveG.toFixed(1)}g priming sugar in ${waterVolumeMl.toFixed(0)} mL boiling water (yielding ~${totalSolutionMl.toFixed(0)} mL total syrup${bufferNote}). Inject ${syringeDosePerBottleMl.toFixed(2)} mL into each bottle before capping.`;

  return {
    waterVolumeMl,
    totalSolutionMl,
    totalSugarToDissolveG,
    sugarDisplacementMl,
    syringeDosePerBottleMl,
    sugarConcentrationGPerMl,
    solutionBufferPct: bufferPct,
    instructionText,
  };
}

