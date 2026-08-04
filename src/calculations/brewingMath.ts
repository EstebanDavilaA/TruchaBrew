import type { Recipe, CalculatedStats, HopItem } from '../types/brewing';

/**
 * Converts SG to Gravity Points (e.g. 1.037 -> 37 points)
 */
export function sgToPoints(sg: number): number {
  return Math.round((sg - 1.0) * 1000);
}

/**
 * Calculates pre-boil and post-boil gravity and water volumes
 */
export function calculateRecipeStats(recipe: Recipe): CalculatedStats {
  const batchSizeL = recipe.equipment.batchSizeL;
  const mashEfficiency = recipe.equipment.mashEfficiencyPct / 100;
  const boilTimeHours = recipe.equipment.boilTimeMin / 60;
  const boilOffL = recipe.equipment.boilOffRateLPerHour * boilTimeHours;
  const preBoilVolumeL = batchSizeL + boilOffL + recipe.equipment.trubChillerLossL;

  // 1. Fermentable & OG Calculation
  let totalGrainKg = 0;
  let totalGravityPoints = 0;
  let totalMcu = 0;

  recipe.fermentables.forEach((f) => {
    totalGrainKg += f.amountKg;
    const potentialPoints = sgToPoints(f.potentialSg);
    
    // Convert kg to lb and L to gal for standard PPG formula
    const weightLb = f.amountKg * 2.20462;
    const batchGal = batchSizeL * 0.264172;

    // Extracted gravity points
    const pointsExtracted = (weightLb * potentialPoints * mashEfficiency) / batchGal;
    totalGravityPoints += pointsExtracted;

    // Color MCU = (weightLb * Lovibond) / volumeGal
    const mcu = (weightLb * f.colorSrm) / batchGal;
    totalMcu += mcu;
  });

  const og = 1.0 + totalGravityPoints / 1000;
  const preBoilGravity = 1.0 + (totalGravityPoints * (batchSizeL / preBoilVolumeL)) / 1000;

  // 2. Yeast Attenuation & FG Calculation
  const avgAttenuation = recipe.yeasts.length > 0
    ? recipe.yeasts.reduce((sum, y) => sum + y.attenuationPct, 0) / recipe.yeasts.length
    : 75;

  const fg = 1.0 + ((og - 1.0) * (1.0 - avgAttenuation / 100));

  // 3. ABV Calculation (Balling-derived formula)
  const abv = (76.08 * (og - fg) / (1.775 - og)) * (fg / 0.794);

  // 4. IBU Calculation (Tinseth)
  let totalIbu = 0;
  let totalHopG = 0;

  recipe.hops.forEach((hop) => {
    totalHopG += hop.amountG;
    totalIbu += calculateSingleHopIbu(hop, preBoilGravity, batchSizeL);
  });

  // 5. Color SRM & EBC (Morey Equation)
  const srm = totalMcu > 0 ? 1.4922 * Math.pow(totalMcu, 0.6859) : 0;
  const ebc = srm * 1.97;

  // 6. BU:GU & RBR
  const gu = (og - 1.0) * 1000;
  const buGu = gu > 0 ? totalIbu / gu : 0;
  const apparentAttenuationFraction = (og - fg) / (og - 1.0 || 1);
  const rbr = buGu * (1 + (apparentAttenuationFraction - 0.7655));

  // 7. Water Volumes
  const mashWaterL = totalGrainKg * 3.0;
  const grainAbsorptionL = totalGrainKg * 0.96;
  const spargeWaterL = Math.max(0, preBoilVolumeL - (mashWaterL - grainAbsorptionL));
  const totalWaterL = mashWaterL + spargeWaterL;

  return {
    og: parseFloat(og.toFixed(3)),
    fg: parseFloat(fg.toFixed(3)),
    abv: parseFloat(Math.max(0, abv).toFixed(1)),
    ibu: Math.round(totalIbu),
    srm: parseFloat(srm.toFixed(1)),
    ebc: parseFloat(ebc.toFixed(1)),
    buGu: parseFloat(buGu.toFixed(2)),
    rbr: parseFloat(rbr.toFixed(2)),
    totalGrainKg: parseFloat(totalGrainKg.toFixed(2)),
    totalHopG: Math.round(totalHopG),
    mashWaterL: parseFloat(mashWaterL.toFixed(1)),
    spargeWaterL: parseFloat(spargeWaterL.toFixed(1)),
    totalWaterL: parseFloat(totalWaterL.toFixed(1)),
    preBoilVolumeL: parseFloat(preBoilVolumeL.toFixed(1)),
    preBoilGravity: parseFloat(preBoilGravity.toFixed(3))
  };
}

/**
 * Tinseth IBU formula for a single hop addition
 */
export function calculateSingleHopIbu(hop: HopItem, wortGravity: number, batchVolumeL: number): number {
  if (hop.timeMinutes <= 0 && hop.use !== 'Whirlpool') return 0;
  
  const boilTime = hop.use === 'Whirlpool' ? 15 : hop.timeMinutes;
  const bignessFactor = 1.65 * Math.pow(0.000125, wortGravity - 1.0);
  const boilTimeFactor = (1 - Math.exp(-0.04 * boilTime)) / 4.15;
  let utilization = bignessFactor * boilTimeFactor;

  if (hop.type === 'Pellet') utilization *= 1.1;
  if (hop.use === 'Whirlpool') utilization *= 0.5;

  const mgAlphaPerL = ((hop.alphaAcidPct / 100) * hop.amountG * 1000) / batchVolumeL;
  return mgAlphaPerL * utilization;
}
