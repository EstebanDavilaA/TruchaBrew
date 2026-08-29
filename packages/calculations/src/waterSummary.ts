/**
 * Water & mash volume summary for the Batch Planning workbench
 * (M19_P1 spec §1.4, §1.5).
 *
 * Pure. Performs NO water-chemistry computation of its own — `predictedMashPh`
 * is a pre-computed input, passed through verbatim. This module imports
 * nothing from the water-chemistry module and calls none of its pH/ion
 * derivation functions (AC-1b).
 */
import type { CalculatedStats, EquipmentProfile, Recipe } from '@truchabrew/shared-types';

export interface WaterSummaryInput {
  recipe: Recipe;
  stats: CalculatedStats | null;
  equipment: EquipmentProfile;
  predictedMashPh: number | null; // pre-computed by the caller — see spec §1.5
}

export interface WaterSummary {
  mashWaterL: number;
  spargeWaterL: number;
  spargeTempC: number;
  totalWaterL: number;
  totalMashVolumeL: number;
  predictedMashPh: number | null;
}

/** Pure. See spec §1.4/§1.5. Never throws on `stats: null`. */
export function calculateWaterSummary(input: WaterSummaryInput): WaterSummary {
  const { recipe, stats, equipment, predictedMashPh } = input;

  const spargeTempC = recipe.mashProfile?.spargeTempC ?? equipment.spargeTemperatureC ?? 76;

  if (stats === null) {
    return {
      mashWaterL: 0,
      spargeWaterL: 0,
      spargeTempC,
      totalWaterL: 0,
      totalMashVolumeL: 0,
      predictedMashPh,
    };
  }

  return {
    mashWaterL: stats.mashWaterL,
    spargeWaterL: stats.spargeWaterL,
    spargeTempC,
    totalWaterL: stats.totalWaterL,
    totalMashVolumeL: stats.mashWaterL + stats.totalGrainKg * 0.65,
    predictedMashPh,
  };
}
