import type { Recipe, HopItem, HopUse, FermentableItem, YeastItem } from '@truchabrew/shared-types';
import { litersToGallons, pointsToSg, ebcToSrm, totalExtractPoints } from '@truchabrew/calculations';
import { lookupPotentialPpg } from './fermentablePotentials';
import fixtureData from './montano_brewing_recipes.json';

export interface FixtureWater {
  mashWaterL: number;
  spargeWaterL: number;
  totalWaterL: number;
}

export interface FixtureExpectations {
  name: string;
  abvPct: number;
  ibu: number;
  colorEBC: number;
  ogPoints: number;
  fgPoints: number;
  buGu: number;
  rbr: number;
  water?: FixtureWater;
}

interface FixtureRecipeEntry {
  recipe: Recipe;
  expected: FixtureExpectations;
}

const PRE_BOIL_VOLUME_L = 34.71;
const POST_BOIL_VOLUME_L = 30.2;
const BATCH_SIZE_L = 28;
const BOIL_OFF_RATE_L_PER_HOUR = 4.51;
const TRUB_CHILLER_LOSS_L = 2.2;
const HOP_UTILIZATION_PCT = 87;

function classifyFixtureHopUse(useStr: string): HopUse {
  if (useStr.includes('Dry Hop')) return 'DryHop';
  if (useStr.includes('Hopstand') || useStr.includes('Aroma')) return 'Aroma';
  if (useStr === 'Boil') return 'Boil';
  throw new Error(`Unrecognized fixture hop use string: "${useStr}"`);
}

function parseLeadingMinutes(timeStr: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*min/.exec(timeStr.trim());
  return match ? parseFloat(match[1]) : 0;
}

function parseLeadingNumber(amountStr: string): number {
  const match = /^(\d+(?:\.\d+)?)/.exec(amountStr.trim());
  return match ? parseFloat(match[1]) : 0;
}

interface FixtureFermentable {
  name: string;
  amountKg: number;
  colorEBC: number;
  type: string;
}

interface FixtureHop {
  name: string;
  alphaAcidPct: number;
  amountG: number;
  time: string;
  use: string;
}

interface FixtureYeast {
  name: string;
  laboratory?: string;
  brand?: string;
  attenuationPct: number;
  amount: string;
}

interface FixtureWaterBlock {
  mashWaterL: number;
  spargeWaterL: number;
  totalWaterL: number;
  [key: string]: unknown;
}

interface FixtureRecipeRaw {
  name: string;
  author: string;
  style: { name: string };
  stats: {
    abvPct: number;
    ibu: number;
    colorEBC: number;
    ogPoints: number;
    fgPoints: number;
    buGu: number;
    rbr: number;
  };
  fermentables: FixtureFermentable[];
  preBoilGravity: number;
  hops: FixtureHop[];
  yeast: FixtureYeast[];
  water?: FixtureWaterBlock;
}

function buildFermentables(raw: FixtureFermentable[]): FermentableItem[] {
  return raw.map((f, idx) => ({
    id: `fx-f-${idx}`,
    name: f.name,
    type: 'Grain',
    amountKg: f.amountKg,
    colorSrm: ebcToSrm(f.colorEBC),
    potentialSg: pointsToSg(lookupPotentialPpg(f.name)),
  }));
}

function buildHops(raw: FixtureHop[]): HopItem[] {
  return raw.map((h, idx) => {
    const parsedUse = classifyFixtureHopUse(h.use);
    return {
      id: `fx-h-${idx}`,
      name: h.name,
      amountG: h.amountG,
      alphaAcidPct: h.alphaAcidPct,
      use: parsedUse,
      boilMins: (parsedUse === 'Boil' || parsedUse === 'FirstWort') ? parseLeadingMinutes(h.time) : null,
      whirlpoolMins: (parsedUse === 'Whirlpool' || parsedUse === 'Aroma') ? parseLeadingMinutes(h.time) : null,
      whirlpoolTempC: (parsedUse === 'Whirlpool' || parsedUse === 'Aroma') ? 79.0 : null,
      type: 'Pellet',
    };
  });
}

function buildYeasts(raw: FixtureYeast[]): YeastItem[] {
  return raw.map((y, idx) => ({
    id: `fx-y-${idx}`,
    name: y.name,
    type: 'Ale',
    form: 'Dry',
    laboratory: y.brand ?? y.laboratory ?? '',
    attenuationPct: y.attenuationPct,
    amountPkg: parseLeadingNumber(y.amount),
  }));
}

function buildFixtureEntry(raw: FixtureRecipeRaw): FixtureRecipeEntry {
  const fermentables = buildFermentables(raw.fermentables);
  const extractPoints = totalExtractPoints(fermentables);
  const preBoilGravityPoints = raw.preBoilGravity - 1000;

  const mashEfficiencyPct = (preBoilGravityPoints * litersToGallons(PRE_BOIL_VOLUME_L) * 100) / extractPoints;
  const brewhouseEfficiencyPct = (mashEfficiencyPct * BATCH_SIZE_L) / POST_BOIL_VOLUME_L;

  const recipe: Recipe = {
    id: `fx-${raw.name}`,
    name: raw.name,
    author: raw.author,
    styleName: raw.style.name,
    notes: '',
    equipment: {
      id: `fx-eq-${raw.name}`,
      name: 'Montano Brewing #1',
      batchSizeL: BATCH_SIZE_L,
      boilTimeMin: 60,
      brewhouseEfficiencyPct,
      mashEfficiencyPct,
      boilOffRateLPerHour: BOIL_OFF_RATE_L_PER_HOUR,
      trubChillerLossL: TRUB_CHILLER_LOSS_L,
      hopUtilizationPct: HOP_UTILIZATION_PCT,
      derivedFromEquipmentId: null,
      // Retired-constant values (M3_P1 §1.5) — bit-identical to M1's hardcoded
      // brewhouse constants, so the fixture suite's expected numbers do not move.
      mashWaterRatioLPerKg: 3.0,
      grainAbsorptionLPerKg: 0.96,
      hopstandUtilizationFactor: 0.26,
      hopstandTemperatureC: 79.0,
      spargeTemperatureC: 76.0,
      mashTunHeatCapacityL: 0.0,
      grainTemperatureC: 20.0,
      notes: '',
    },
    fermentables,
    hops: buildHops(raw.hops),
    yeasts: buildYeasts(raw.yeast),
    miscs: [],
    mashProfile: null,
    fermentationProfile: null,
  };

  const expected: FixtureExpectations = {
    name: raw.name,
    abvPct: raw.stats.abvPct,
    ibu: raw.stats.ibu,
    colorEBC: raw.stats.colorEBC,
    ogPoints: raw.stats.ogPoints,
    fgPoints: raw.stats.fgPoints,
    buGu: raw.stats.buGu,
    rbr: raw.stats.rbr,
    water: raw.water
      ? {
          mashWaterL: raw.water.mashWaterL,
          spargeWaterL: raw.water.spargeWaterL,
          totalWaterL: raw.water.totalWaterL,
        }
      : undefined,
  };

  return { recipe, expected };
}

export function loadFixtureRecipes(): FixtureRecipeEntry[] {
  const raw = fixtureData as unknown as { recipes: FixtureRecipeRaw[] };
  return raw.recipes.map(buildFixtureEntry);
}
