// M18_P1 spec §1.1 — Brew Sheet Viewer data model. Pure. No Date.now(), no
// Math.random(), no I/O, no mutation of `input`. Deterministic.
import type {
  Recipe,
  CalculatedStats,
  MashStepType,
  FermentableType,
  HopUse,
  MiscType,
  MiscUse,
  MiscUnit,
  YeastType,
  YeastForm,
  FermentationStepType,
} from '@truchabrew/shared-types';
import { sgToPlato } from './config';
import { srmToEbc } from './units';
import { resolveSpargeTemperatureC, strikeTemperatureC } from './mash';
import { calculateSingleHopIbu, toHopUtilizationSettings } from './brewingMath';

export interface BrewSheetVitals {
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  buGu: number;
  srm: number;
  ebc: number;
  platoOg: number;
}

export interface BrewSheetVolumes {
  mashWaterL: number;
  spargeWaterL: number;
  spargeTempC: number;
  totalWaterL: number;
  preBoilVolumeL: number;
  preBoilGravity: number;
  batchSizeL: number;
  postBoilVolumeL: number;
}

export interface BrewSheetMashRest {
  id: string;
  name: string;
  type: MashStepType;
  stepTempC: number;
  stepTimeMin: number;
  rampTimeMin: number;
}

export interface BrewSheetMash {
  profileName: string | null;
  strikeTempC: number | null;
  targetPh: number | null;
  spargeTempC: number;
  rests: BrewSheetMashRest[];
}

export interface BrewSheetFermentableRow {
  id: string;
  name: string;
  type: FermentableType;
  amountKg: number;
  percentOfGrist: number;
  colorSrm: number;
  colorEbc: number;
}

export interface BrewSheetHopRow {
  id: string;
  name: string;
  use: HopUse;
  amountG: number;
  alphaAcidPct: number;
  timingLabel: string;
  timingMins: number | null;
  tempC: number | null;
  ibuContribution: number;
  percentOfTotalHops: number;
}

export interface BrewSheetMiscRow {
  id: string;
  name: string;
  type: MiscType;
  use: MiscUse;
  amount: number;
  unit: MiscUnit;
  timeMinutes: number;
}

export interface BrewSheetYeastRow {
  id: string;
  name: string;
  laboratory: string;
  type: YeastType;
  form: YeastForm;
  attenuationPct: number;
  amountPkg: number;
}

export interface BrewSheetFermentationRow {
  id: string;
  name: string;
  type: FermentationStepType;
  stepTempC: number;
  stepTimeDays: number;
  rampDays: number;
  pressurePsi: number | null;
}

export interface BrewSheetModel {
  header: {
    batchName: string;
    recipeName: string;
    styleName: string;
    author: string;
    typeLabel: 'All Grain';
  };
  equipment: {
    profileName: string;
    brewhouseEfficiencyPct: number;
    mashEfficiencyPct: number;
    batchSizeL: number;
    boilTimeMin: number;
  };
  vitals: BrewSheetVitals;
  volumes: BrewSheetVolumes;
  mash: BrewSheetMash;
  fermentables: { totalKg: number; rows: BrewSheetFermentableRow[] };
  hops: { totalG: number; rows: BrewSheetHopRow[] };
  miscs: BrewSheetMiscRow[];
  yeasts: BrewSheetYeastRow[];
  fermentation: { profileName: string | null; steps: BrewSheetFermentationRow[] };
  carbonationVolumes: number | null;
}

export interface BrewSheetInput {
  recipe: Recipe;
  stats: CalculatedStats;
  batchName: string;
  carbonationVolumesTarget: number | null;
}

function round(value: number, decimals: number): number {
  return parseFloat(value.toFixed(decimals));
}

/** Pure. See §1.1. */
export function buildBrewSheetModel(input: BrewSheetInput): BrewSheetModel {
  const { recipe, stats, batchName, carbonationVolumesTarget } = input;
  const { equipment } = recipe;

  const header = {
    batchName,
    recipeName: recipe.name,
    styleName: recipe.styleName,
    author: recipe.author,
    typeLabel: 'All Grain' as const,
  };

  const equipmentBlock = {
    profileName: equipment.name,
    brewhouseEfficiencyPct: equipment.brewhouseEfficiencyPct,
    mashEfficiencyPct: equipment.mashEfficiencyPct,
    batchSizeL: equipment.batchSizeL,
    boilTimeMin: equipment.boilTimeMin,
  };

  const vitals: BrewSheetVitals = {
    og: stats.og,
    fg: stats.fg,
    abv: stats.abv,
    ibu: stats.ibu,
    buGu: stats.buGu,
    srm: stats.srm,
    ebc: stats.ebc,
    platoOg: round(sgToPlato(stats.og), 1),
  };

  const spargeTempC = resolveSpargeTemperatureC(equipment, recipe.mashProfile);

  const volumes: BrewSheetVolumes = {
    mashWaterL: stats.mashWaterL,
    spargeWaterL: stats.spargeWaterL,
    spargeTempC,
    totalWaterL: stats.totalWaterL,
    preBoilVolumeL: stats.preBoilVolumeL,
    preBoilGravity: stats.preBoilGravity,
    batchSizeL: equipment.batchSizeL,
    postBoilVolumeL: stats.postBoilVolumeL,
  };

  const mashProfile = recipe.mashProfile;
  const mashSteps = mashProfile !== null ? mashProfile.steps : [];
  const strikeTemp: number | null =
    mashSteps.length === 0
      ? null
      : strikeTemperatureC({
          targetMashTempC: mashSteps[0].stepTempC,
          grainTemperatureC: equipment.grainTemperatureC,
          waterVolumeL: stats.mashWaterL,
          grainWeightKg: stats.totalGrainKg,
          mashTunHeatCapacityL: equipment.mashTunHeatCapacityL,
          calcStrikeWithThermalMass: equipment.calcStrikeWithThermalMass,
          mashTunWeightKg: equipment.mashTunWeightKg,
          mashTunHeatCapacity: equipment.mashTunHeatCapacity,
        });

  const mash: BrewSheetMash = {
    profileName: mashProfile !== null ? mashProfile.name : null,
    strikeTempC: strikeTemp,
    targetPh: mashProfile !== null ? mashProfile.targetPh : null,
    spargeTempC,
    rests: mashSteps.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      stepTempC: s.stepTempC,
      stepTimeMin: s.stepTimeMin,
      rampTimeMin: s.rampTimeMin,
    })),
  };

  const totalKg = round(
    recipe.fermentables.reduce((sum, f) => sum + f.amountKg, 0),
    3,
  );
  const fermentableRows: BrewSheetFermentableRow[] = recipe.fermentables.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    amountKg: f.amountKg,
    percentOfGrist: totalKg > 0 ? round((f.amountKg / totalKg) * 100, 1) : 0,
    colorSrm: f.colorSrm,
    colorEbc: round(srmToEbc(f.colorSrm), 1),
  }));

  const totalG = round(
    recipe.hops.reduce((sum, h) => sum + h.amountG, 0),
    1,
  );
  const hopSettings = toHopUtilizationSettings(equipment);
  const hopRows: BrewSheetHopRow[] = recipe.hops.map((h) => {
    const ibuContribution = round(calculateSingleHopIbu(h, stats.og, equipment.batchSizeL, hopSettings), 1);
    let timingLabel: string;
    let timingMins: number | null = null;
    let tempC: number | null = null;

    switch (h.use) {
      case 'Boil':
        timingMins = h.boilMins;
        timingLabel = h.boilMins !== null ? `${h.boilMins} min` : '—';
        break;
      case 'FirstWort':
        timingLabel = 'First Wort';
        break;
      case 'Whirlpool':
      case 'Aroma':
        timingMins = h.whirlpoolMins;
        tempC = h.whirlpoolTempC;
        if (h.whirlpoolMins !== null && h.whirlpoolTempC !== null) {
          timingLabel = `${h.whirlpoolMins} min @ ${h.whirlpoolTempC.toFixed(1)} °C`;
        } else if (h.whirlpoolMins !== null) {
          timingLabel = `${h.whirlpoolMins} min`;
        } else {
          timingLabel = '—';
        }
        break;
      case 'DryHop':
        if (
          h.dryHopDayOffset !== null &&
          h.dryHopDayOffset !== undefined &&
          h.dryHopDurationDays !== null &&
          h.dryHopDurationDays !== undefined
        ) {
          timingLabel = `Day ${h.dryHopDayOffset} for ${h.dryHopDurationDays} d`;
        } else {
          timingLabel = '—';
        }
        break;
    }

    return {
      id: h.id,
      name: h.name,
      use: h.use,
      amountG: h.amountG,
      alphaAcidPct: h.alphaAcidPct,
      timingLabel,
      timingMins,
      tempC,
      ibuContribution,
      percentOfTotalHops: totalG > 0 ? round((h.amountG / totalG) * 100, 1) : 0,
    };
  });

  const miscs: BrewSheetMiscRow[] = recipe.miscs.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    use: m.use,
    amount: m.amount,
    unit: m.unit,
    timeMinutes: m.timeMinutes,
  }));

  const yeasts: BrewSheetYeastRow[] = recipe.yeasts.map((y) => ({
    id: y.id,
    name: y.name,
    laboratory: y.laboratory,
    type: y.type,
    form: y.form,
    attenuationPct: y.attenuationPct,
    amountPkg: y.amountPkg,
  }));

  const fermentation = {
    profileName: recipe.fermentationProfile !== null ? recipe.fermentationProfile.name : null,
    steps: (recipe.fermentationProfile !== null ? recipe.fermentationProfile.steps : []).map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      stepTempC: s.stepTempC,
      stepTimeDays: s.stepTimeDays,
      rampDays: s.rampDays,
      pressurePsi: s.pressurePsi,
    })),
  };

  return {
    header,
    equipment: equipmentBlock,
    vitals,
    volumes,
    mash,
    fermentables: { totalKg, rows: fermentableRows },
    hops: { totalG, rows: hopRows },
    miscs,
    yeasts,
    fermentation,
    carbonationVolumes: carbonationVolumesTarget,
  };
}
