import type { MiscItem } from './misc';
import type { MashProfile, FermentationProfile } from './schedules';

export type FermentableType = 'Grain' | 'Sugar' | 'LiquidExtract' | 'DryExtract' | 'Adjunct';
export type HopUse = 'Boil' | 'DryHop' | 'FirstWort' | 'Aroma' | 'Whirlpool';
export type HopType = 'Pellet' | 'Leaf' | 'Cryo';
export type YeastType = 'Ale' | 'Lager' | 'Hybrid' | 'Wheat';
export type YeastForm = 'Dry' | 'Liquid';

export interface FermentableItem {
  id: string;
  name: string;
  type: FermentableType;
  amountKg: number;
  colorSrm: number;
  potentialSg: number; // e.g. 1.037
  notes?: string;
}

export interface AcidAdditionResult {
  targetPh: number;
  deltaPh: number;
  mEqRequired: number;
  lacticAcid88Ml: number;
  phosphoricAcid75Ml: number;
  acidulatedMaltGrams: number;
}

export interface EquipmentPhysicsParams {
  altitudeMeters?: number;
  calcStrikeWithThermalMass?: boolean;
  mashTunWeightKg?: number;
  mashTunHeatCapacity?: number;
  mashTunDeadSpaceL?: number;
  kettleLossL?: number;
}

export interface HopItem {
  id: string;
  name: string;
  amountG: number;
  alphaAcidPct: number;
  use: HopUse;
  boilMins: number | null;
  whirlpoolMins: number | null;
  whirlpoolTempC: number | null;
  dryHopDayOffset?: number | null;
  dryHopDurationDays?: number | null;
  type: HopType;
  // DryHop-only (M4_P1 spec, Resolved Ambiguities). Meaningful iff
  // use === 'DryHop': carries the dry-hop duration in minutes, exactly as it
  // did before the Boil/Whirlpool split. null for Boil/FirstWort/Whirlpool/
  // Aroma — those four uses read boilMins/whirlpoolMins instead and never
  // this field. Optional so the ~8 hop object literals across the repo that
  // are meaningless for four of the five uses don't all require a value.
  // Inert: nothing reads it for IBU or any other calculation. M5 owns the
  // real day-offset/duration model and the migration that finally retires it.
  timeMinutes?: number | null;
}

export interface YeastItem {
  id: string;
  name: string;
  type: YeastType;
  form: YeastForm;
  laboratory: string;
  attenuationPct: number;
  amountPkg: number;
}

export interface EquipmentProfile {
  id: string;
  name: string;
  batchSizeL: number;
  boilTimeMin: number;
  brewhouseEfficiencyPct: number;
  mashEfficiencyPct: number;
  boilOffRateLPerHour: number;
  trubChillerLossL: number;
  hopUtilizationPct: number; // 100 = textbook Tinseth. Scales every hop addition.
  derivedFromEquipmentId: string | null; // null for user/seed profiles.

  // NEW in M3 — all required, all non-nullable.
  mashWaterRatioLPerKg: number;      // L of strike+sparge-basis water per kg grist. > 0.
  grainAbsorptionLPerKg: number;     // L retained by the spent grain per kg. >= 0.
  hopstandUtilizationFactor: number; // multiplier applied to 'Aroma'/'Whirlpool' additions. [0, 1].
  hopstandTemperatureC: number;      // stored + displayed; inert in M3. [0, 100].
  spargeTemperatureC: number;        // brewhouse default; resolved against a mash profile's override via resolveSpargeTemperatureC (mash.ts). [0, 100].
  mashTunHeatCapacityL: number;      // water-equivalent thermal mass; read by strikeTemperatureC (mash.ts). [0, 50].
  grainTemperatureC: number;         // grist starting temperature; read by strikeTemperatureC (mash.ts). [-20, 50].
  notes: string;                     // free text, '' when unset. Never null.

  // NEW in M11_P1 — Physics & loss modeling
  altitudeMeters?: number;
  calcStrikeWithThermalMass?: boolean;
  mashTunDeadSpaceL?: number;
  kettleLossL?: number;
  mashTunWeightKg?: number;
  mashTunHeatCapacity?: number;
}

export type WaterProfileType = 'source' | 'target';

export interface WaterProfile {
  id: string;
  name: string;
  type: WaterProfileType;
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
  ph: number | null;
  description: string | null;
}

export interface WaterProfileInput {
  name: string;
  type: WaterProfileType;
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
  ph?: number | null;
  description?: string | null;
}

export interface WaterAnalysisResult {
  sourceProfile: WaterProfile | null;
  targetProfile: WaterProfile | null;
  waterVolumeL: number;
  finishedIons: {
    calcium: number;
    magnesium: number;
    sodium: number;
    chloride: number;
    sulfate: number;
    bicarbonate: number;
  };
  residualAlkalinity: number;
  predictedMashPh: number;
}

export interface Recipe {
  id: string;
  name: string;
  author: string;
  styleName: string;
  equipment: EquipmentProfile;
  fermentables: FermentableItem[];
  hops: HopItem[];
  yeasts: YeastItem[];
  miscs: MiscItem[]; // Ignored by calculateRecipeStats in M2.
  notes: string;
  mashProfile: MashProfile | null;                 // NEW — read-side hydration of mash_profile_id
  fermentationProfile: FermentationProfile | null; // NEW
  waterSourceId?: string | null;                    // NEW in M6 — FK to water_profiles
  waterTargetId?: string | null;                    // NEW in M6 — FK to water_profiles
  // NEW in M38_P1 — folder category (null = unfiled) / tag list (default []).
  // Declared OPTIONAL here (the M38_P1 spec §1.1 shows these non-optional,
  // a deliberate deviation — see executor's report): dozens of pre-existing
  // `Recipe`-typed object literals outside this phase's Authorized Files
  // (e.g. RecipeImportModal.tsx's preview recipe, packages/calculations'
  // test fixtures) never set folder/tags, and none of those files are in
  // scope for this phase to touch. Every real read/write path this phase
  // DOES own (recipeRepository.ts, RecipeLibrary.tsx, useRecipeEditor.ts,
  // App.tsx) always populates both fields — optionality only widens the
  // type for callers this phase cannot reach, it never changes runtime
  // behavior for the recipe editor/library flows.
  folder?: string | null;
  tags?: string[];
  // NEW in M38_P3 — optional persisted structured BJCP 2021 style id
  // (e.g. '21A'), independent of the free-text `styleName` above: selecting a
  // BJCP style never writes styleName (RA-P3-1). Declared OPTIONAL here for
  // the same RA-8 reason as folder/tags above — pre-existing `Recipe`-typed
  // object literals outside this phase's Authorized Files never set it.
  // `null` / omitted = "no BJCP style".
  bjcpStyleId?: string | null;
}

export interface CalculatedStats {
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  srm: number;
  ebc: number;
  buGu: number;
  rbr: number;
  totalGrainKg: number;
  totalHopG: number;
  mashWaterL: number;
  spargeWaterL: number;
  totalWaterL: number;
  preBoilVolumeL: number;
  preBoilGravity: number;
  attenuationPct: number;   // apparent attenuation from og/fg, 1 decimal
  postBoilVolumeL: number;  // batchSizeL + trubChillerLossL, 1 decimal
}
