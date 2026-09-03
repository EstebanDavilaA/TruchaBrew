/**
 * Water chemistry calculations (M6_P1 spec §2.1).
 *
 * Pure functions — no side effects, no database access, no UI.
 */
import type { FermentableItem, WaterProfile, AcidAdditionResult } from '@truchabrew/shared-types';
import type { MiscItem } from '@truchabrew/shared-types';
import { optimizeWaterProfile } from './waterOptimization';

// ---------------------------------------------------------------------------
// Ion contribution constants (per gram per litre of water)
// M6_P1 spec, Resolved Ambiguities §1
// ---------------------------------------------------------------------------

export interface SaltContribution {
  readonly name: string;
  readonly calcium: number;
  readonly magnesium: number;
  readonly sodium: number;
  readonly chloride: number;
  readonly sulfate: number;
  readonly bicarbonate: number;
}

// oxlint-disable-next-line react/only-export-components
export const SALT_CONTRIBUTIONS: readonly SaltContribution[] = [
  { name: 'Gypsum',           calcium: 61.5, magnesium: 0,    sodium: 0,     chloride: 0,     sulfate: 147.4, bicarbonate: 0 },
  { name: 'Calcium Chloride', calcium: 72.0, magnesium: 0,    sodium: 0,     chloride: 127.0, sulfate: 0,     bicarbonate: 0 },
  { name: 'Epsom Salt',       calcium: 0,    magnesium: 26.0, sodium: 0,     chloride: 0,     sulfate: 103.0, bicarbonate: 0 },
  { name: 'Table Salt',       calcium: 0,    magnesium: 0,    sodium: 104.0, chloride: 161.0, sulfate: 0,     bicarbonate: 0 },
  { name: 'Baking Soda',      calcium: 0,    magnesium: 0,    sodium: 80.0,  chloride: 0,     sulfate: 0,     bicarbonate: 191.0 },
] as const;

/**
 * Map from salt name (as it appears in a MiscItem.name) to its contribution record.
 * Case-insensitive lookup is done at query time.
 */
function findSaltContribution(miscName: string): SaltContribution | undefined {
  const lower = miscName.toLowerCase();
  return SALT_CONTRIBUTIONS.find((s) => s.name.toLowerCase() === lower);
}

// ---------------------------------------------------------------------------
// Core calculations
// ---------------------------------------------------------------------------

export type IonConcentrations = {
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
};

/**
 * Residual Alkalinity in mEq/L (Kolbach equation).
 * RA = (HCO₃ / 61.0) - ((Ca / 70.14) + (Mg / 85.05))
 */
export function calculateResidualAlkalinity(hco3: number, ca: number, mg: number): number {
  return (hco3 / 61.0) - ((ca / 70.14) + (mg / 85.05));
}

/**
 * Finished ion concentrations after adding mineral salts to source water.
 *
 * Scans the recipe's Misc items for type 'WaterAgent' entries whose name
 * matches a known salt, and adds their ion contributions at the given
 * water volume.
 */
export function calculateFinishedIons(
  source: WaterProfile | null,
  waterVolumeL: number,
  miscs: MiscItem[],
): IonConcentrations {
  const result: IonConcentrations = {
    calcium: source?.calcium ?? 0,
    magnesium: source?.magnesium ?? 0,
    sodium: source?.sodium ?? 0,
    chloride: source?.chloride ?? 0,
    sulfate: source?.sulfate ?? 0,
    bicarbonate: source?.bicarbonate ?? 0,
  };

  if (waterVolumeL <= 0) return result;

  for (const misc of miscs) {
    if (misc.type !== 'WaterAgent') continue;
    const salt = findSaltContribution(misc.name);
    if (!salt) continue;

    // misc.amount is in grams, salt contributions are per g/L
    const gramsPerL = misc.amount / waterVolumeL;
    result.calcium += salt.calcium * gramsPerL;
    result.magnesium += salt.magnesium * gramsPerL;
    result.sodium += salt.sodium * gramsPerL;
    result.chloride += salt.chloride * gramsPerL;
    result.sulfate += salt.sulfate * gramsPerL;
    result.bicarbonate += salt.bicarbonate * gramsPerL;
  }

  return result;
}

/**
 * Predicted mash pH from grist composition and Residual Alkalinity.
 *
 * Simplified model:
 * - Base malt (≤ 10 EBC ≈ ≤ 5.08 SRM): baseline pH 5.60
 * - Crystal/specialty (10–80 EBC ≈ 5.08–40.64 SRM): baseline pH 5.20
 * - Roasted (> 80 EBC ≈ > 40.64 SRM): baseline pH 4.70
 *
 * Weighted average by mass, then ΔpH = RA × 0.044.
 * Result clamped to [4.50, 6.50].
 */
export function predictMashPh(
  grist: FermentableItem[],
  _waterVolumeL: number,
  residualAlkalinity: number,
): number {
  if (grist.length === 0) return 5.60;

  // Only grain-type fermentables contribute to mash pH prediction
  const grainItems = grist.filter((f) => f.type === 'Grain');
  if (grainItems.length === 0) return 5.60;

  let totalKg = 0;
  let weightedPh = 0;

  for (const grain of grainItems) {
    // EBC = SRM × 1.97 (Morey). Use SRM thresholds directly:
    // ≤ 5.08 SRM (≈ 10 EBC) → base malt → 5.60
    // ≤ 40.64 SRM (≈ 80 EBC) → crystal/specialty → 5.20
    // > 40.64 SRM → roasted → 4.70
    let grainPh: number;
    if (grain.colorSrm <= 5.08) {
      grainPh = 5.60;
    } else if (grain.colorSrm <= 40.64) {
      grainPh = 5.20;
    } else {
      grainPh = 4.70;
    }

    totalKg += grain.amountKg;
    weightedPh += grainPh * grain.amountKg;
  }

  if (totalKg === 0) return 5.60;

  const basePh = weightedPh / totalKg;
  const deltaPh = residualAlkalinity * 0.044;
  const predicted = basePh + deltaPh;

  return Math.max(4.50, Math.min(6.50, predicted));
}

/**
 * Auto-suggest salt additions to bridge source-to-target ion deltas.
 *
 * M37_P1: delegates to the bounded multi-ion least-squares solver
 * (`waterOptimization.ts`), which simultaneously balances all six ions and
 * replaces the old sequential greedy fixed-order heuristic that overshot
 * ions later in the priority chain (BUG-024). Signature and return shape are
 * unchanged (AC-15) — an array of `{ saltName, amountGrams }` in canonical
 * salt order, all amounts non-negative and rounded to 2 decimal places.
 */
export function suggestSaltAdditions(
  source: WaterProfile | null,
  target: WaterProfile | null,
  waterVolumeL: number,
): { saltName: string; amountGrams: number }[] {
  return optimizeWaterProfile(source, target, waterVolumeL).salts;
}

// ---------------------------------------------------------------------------
// Acid additions & mash pH adjustment (M11_P1 §2.1)
// ---------------------------------------------------------------------------

/**
 * Acid addition calculations for mash pH adjustment (M11_P1 §2.1).
 *
 * Target pH difference: ΔpH = predictedMashPh - targetMashPh.
 * If ΔpH <= 0, zero acid required.
 * Mash Buffer Capacity: β_mash = 30 mEq/(kg·ΔpH).
 * E_req (mEq) = totalMaltKg * β_mash * ΔpH + mashWaterL * alkalinityMeqL.
 * Lactic Acid 88%: Vol (mL) = E_req / 11.8.
 * Phosphoric Acid 75%: Vol (mL) = E_req / 14.9.
 * Acidulated Malt (g): totalMaltKg * 100 * ΔpH.
 */
export function calculateAcidAdditions(
  totalMaltKg: number,
  predictedMashPh: number,
  targetMashPh: number,
  mashWaterL = 0,
  alkalinityMeqL = 0,
): AcidAdditionResult {
  const deltaPh = Math.max(0, predictedMashPh - targetMashPh);
  if (deltaPh <= 0 || totalMaltKg <= 0) {
    return {
      targetPh: targetMashPh,
      deltaPh: 0,
      mEqRequired: 0,
      lacticAcid88Ml: 0,
      phosphoricAcid75Ml: 0,
      acidulatedMaltGrams: 0,
    };
  }

  const mEqRequired = totalMaltKg * 30 * deltaPh + Math.max(0, mashWaterL) * Math.max(0, alkalinityMeqL);
  const lacticAcid88Ml = mEqRequired / 11.8;
  const phosphoricAcid75Ml = mEqRequired / 14.9;
  const acidulatedMaltGrams = totalMaltKg * 100 * deltaPh;

  return {
    targetPh: targetMashPh,
    deltaPh: parseFloat(deltaPh.toFixed(2)),
    mEqRequired: parseFloat(mEqRequired.toFixed(2)),
    lacticAcid88Ml: parseFloat(lacticAcid88Ml.toFixed(2)),
    phosphoricAcid75Ml: parseFloat(phosphoricAcid75Ml.toFixed(2)),
    acidulatedMaltGrams: parseFloat(acidulatedMaltGrams.toFixed(1)),
  };
}

export interface AcidAdditionInputs {
  lacticAcid88Ml?: number;
  phosphoricAcid75Ml?: number;
  acidulatedMaltGrams?: number;
  alkalinityMeqL?: number;
}

/**
 * Predicts the resulting mash pH after applying acid additions or acidulated malt.
 */
export function calculatePostAcidMashPh(
  predictedMashPh: number,
  totalMaltKg: number,
  _mashWaterL = 0,
  additions: AcidAdditionInputs = {},
): number {
  if (totalMaltKg <= 0) return predictedMashPh;

  const lacticMeq = (additions.lacticAcid88Ml ?? 0) * 11.8;
  const phosphoricMeq = (additions.phosphoricAcid75Ml ?? 0) * 14.9;
  const acidMaltMeq = ((additions.acidulatedMaltGrams ?? 0) / (totalMaltKg * 100)) * (totalMaltKg * 30);
  const totalAcidMeq = Math.max(0, lacticMeq) + Math.max(0, phosphoricMeq) + Math.max(0, acidMaltMeq);

  const deltaPh = totalAcidMeq / (totalMaltKg * 30);
  const postPh = predictedMashPh - deltaPh;

  return parseFloat(Math.max(4.0, Math.min(6.5, postPh)).toFixed(2));
}

/**
 * Scales source water profile ions by dilution percentage with RO/distilled water.
 * dilutionPct: 0 to 100 (% of RO / distilled water).
 */
export function calculateDilutedWaterProfile(
  source: WaterProfile | null,
  dilutionPct: number,
): WaterProfile | null {
  if (!source) return null;
  const factor = Math.max(0, Math.min(1, 1 - (dilutionPct / 100)));
  return {
    ...source,
    calcium: parseFloat((source.calcium * factor).toFixed(1)),
    magnesium: parseFloat((source.magnesium * factor).toFixed(1)),
    sodium: parseFloat((source.sodium * factor).toFixed(1)),
    chloride: parseFloat((source.chloride * factor).toFixed(1)),
    sulfate: parseFloat((source.sulfate * factor).toFixed(1)),
    bicarbonate: parseFloat((source.bicarbonate * factor).toFixed(1)),
  };
}

/**
 * SO₄²⁻:Cl⁻ flavor-balance descriptor (M37_P2 Amendment 1, §1.2). The 4-band
 * table below replaced the previous 5-band table — the three legacy
 * descriptor strings it used are retired and must not reappear (AC-29).
 */
export type SulfateChlorideDescriptor =
  | 'Very Bitter / Dry'
  | 'Crisp / Hop-Forward'
  | 'Balanced'
  | 'Full / Malty / Soft'
  | 'None';

export interface SulfateToChlorideRatio {
  ratio: number | null;
  descriptor: SulfateChlorideDescriptor;
}

/**
 * Calculates Sulfate to Chloride ratio and descriptive profile balance.
 *
 * Binding 4-band table (M37_P2 Amendment 1 §1.2): `ratio` is
 * `parseFloat((sulfate/chloride).toFixed(2))`, so banding is applied to the
 * same 2-decimal value that is displayed.
 *   ratio > 2.0             -> 'Very Bitter / Dry'
 *   1.3 <= ratio <= 2.0     -> 'Crisp / Hop-Forward'
 *   0.8 <= ratio < 1.3      -> 'Balanced'
 *   ratio < 0.8             -> 'Full / Malty / Soft'
 * Degenerate: chloride <= 0 && sulfate <= 0 -> { ratio: null, descriptor: 'None' }.
 * chloride <= 0 && sulfate > 0 -> { ratio: 99.9, descriptor: 'Very Bitter / Dry' }.
 */
export function calculateSulfateToChlorideRatio(
  sulfate: number,
  chloride: number,
): SulfateToChlorideRatio {
  if (chloride <= 0 && sulfate <= 0) {
    return { ratio: null, descriptor: 'None' };
  }
  if (chloride <= 0) {
    return { ratio: 99.9, descriptor: 'Very Bitter / Dry' };
  }
  const ratio = parseFloat((sulfate / chloride).toFixed(2));
  let descriptor: SulfateChlorideDescriptor;
  if (ratio > 2.0) {
    descriptor = 'Very Bitter / Dry';
  } else if (ratio >= 1.3) {
    descriptor = 'Crisp / Hop-Forward';
  } else if (ratio >= 0.8) {
    descriptor = 'Balanced';
  } else {
    descriptor = 'Full / Malty / Soft';
  }

  return { ratio, descriptor };
}

/**
 * Balance-strategy flavor presets (M37_P2 Amendment 2, FEAT-044). Each preset
 * describes a target Sulfate:Chloride ratio the brewer wants a water profile
 * to hit: Balanced ≈ 1:1, Crisp Hop-Forward ≈ 2:1 (sulfate-dominant, dry/bitter),
 * Malty/Full ≈ 1:2 (chloride-dominant, full/soft).
 */
export type BalanceStrategy = 'Balanced' | 'Crisp Hop-Forward' | 'Malty/Full';

/** Target SO4:Cl ratio per balance strategy (RA-15/RA-17). */
export const BALANCE_STRATEGY_RATIO: Record<BalanceStrategy, number> = {
  Balanced: 1.0,
  'Crisp Hop-Forward': 2.0,
  'Malty/Full': 0.5,
};

/**
 * Compute a target-ion preset from a balance strategy (M37_P2 Amendment 2,
 * FEAT-044). Adjusts ONLY chloride and sulfate to the strategy's target
 * SO4:Cl ratio; calcium/magnesium/sodium/bicarbonate are returned unchanged.
 *
 * Anchor rule (RA-15), total and deterministic — never throws, never returns
 * NaN/Infinity (negative inputs clamped to 0):
 *   - chloride <= 0 && sulfate <= 0 -> seed chloride 50, sulfate = 50 * ratio
 *   - chloride <= 0                  -> derive chloride = sulfate / ratio
 *   - otherwise                       -> derive sulfate = chloride * ratio
 * Returns a new object; the input is never mutated.
 */
export function applyBalanceStrategy(
  ions: IonConcentrations,
  strategy: BalanceStrategy,
): IonConcentrations {
  const ratio = BALANCE_STRATEGY_RATIO[strategy];
  const chloride = Math.max(0, ions.chloride);
  const sulfate = Math.max(0, ions.sulfate);

  let outChloride: number;
  let outSulfate: number;

  if (chloride <= 0 && sulfate <= 0) {
    outChloride = 50;
    outSulfate = 50 * ratio;
  } else if (chloride <= 0) {
    outChloride = sulfate / ratio;
    outSulfate = sulfate;
  } else {
    outChloride = chloride;
    outSulfate = chloride * ratio;
  }

  return {
    calcium: ions.calcium,
    magnesium: ions.magnesium,
    sodium: ions.sodium,
    chloride: parseFloat(outChloride.toFixed(2)),
    sulfate: parseFloat(outSulfate.toFixed(2)),
    bicarbonate: ions.bicarbonate,
  };
}

/**
 * Acid addition calculations to neutralize sparge water alkalinity to target sparge pH (e.g. 5.50).
 */
export function calculateSpargeAcid(
  spargeWaterL: number,
  spargeBicarbonatePpm: number,
  targetSpargePh = 5.5,
): AcidAdditionResult {
  if (spargeWaterL <= 0 || spargeBicarbonatePpm <= 0) {
    return {
      targetPh: targetSpargePh,
      deltaPh: 0,
      mEqRequired: 0,
      lacticAcid88Ml: 0,
      phosphoricAcid75Ml: 0,
      acidulatedMaltGrams: 0,
    };
  }

  // Alkalinity in mEq/L from bicarbonate: HCO3 / 61.0
  const alkalinityMeqL = spargeBicarbonatePpm / 61.0;
  // Neutralize ~85% of bicarbonate alkalinity to reach pH ~5.5
  const mEqRequired = spargeWaterL * alkalinityMeqL * 0.85;
  const lacticAcid88Ml = mEqRequired / 11.8;
  const phosphoricAcid75Ml = mEqRequired / 14.9;

  return {
    targetPh: targetSpargePh,
    deltaPh: 0,
    mEqRequired: parseFloat(mEqRequired.toFixed(2)),
    lacticAcid88Ml: parseFloat(lacticAcid88Ml.toFixed(2)),
    phosphoricAcid75Ml: parseFloat(phosphoricAcid75Ml.toFixed(2)),
    acidulatedMaltGrams: 0,
  };
}


