import type { Db } from './client';
import {
  equipmentProfiles,
  recipes,
  recipeFermentables,
  recipeHops,
  recipeYeasts,
  catalogFermentables,
  catalogHops,
  catalogYeasts,
  catalogMiscs,
  mashProfiles,
  mashSteps,
  fermentationProfiles,
  fermentationSteps,
  waterProfiles,
  userConfig,
} from './schema';

// Fixed timestamp for seed data so re-seeding never mutates existing rows'
// updatedAt (idempotent by construction, not just by onConflictDoNothing).
const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

// The 8 M3 fields are written explicitly at their documented defaults (M3_P1
// spec, Resolved Ambiguities) so a freshly-seeded database and a database
// migrated from 0000 are field-for-field identical (AC-19).
const SEED_EQUIPMENT_PROFILES = [
  {
    id: 'eq-1',
    name: 'All-Grain 20L System',
    batchSizeL: 20,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 75,
    mashEfficiencyPct: 80,
    boilOffRateLPerHour: 3.5,
    trubChillerLossL: 2.0,
    hopUtilizationPct: 87,
    derivedFromEquipmentId: null as string | null,
    isSeed: 1,
    mashWaterRatioLPerKg: 3.0,
    grainAbsorptionLPerKg: 0.96,
    hopstandUtilizationFactor: 0.26,
    hopstandTemperatureC: 79.0,
    spargeTemperatureC: 76.0,
    mashTunHeatCapacityL: 0.0,
    grainTemperatureC: 20.0,
    notes: '',
  },
  {
    id: 'eq-2',
    name: 'BIAB 10L Mini System',
    batchSizeL: 10,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 70,
    mashEfficiencyPct: 72,
    boilOffRateLPerHour: 2.0,
    trubChillerLossL: 1.0,
    hopUtilizationPct: 87,
    derivedFromEquipmentId: null as string | null,
    isSeed: 1,
    mashWaterRatioLPerKg: 3.0,
    grainAbsorptionLPerKg: 0.96,
    hopstandUtilizationFactor: 0.26,
    hopstandTemperatureC: 79.0,
    spargeTemperatureC: 76.0,
    mashTunHeatCapacityL: 0.0,
    grainTemperatureC: 20.0,
    notes: '',
  },
];

const SEED_CATALOG_FERMENTABLES = [
  { id: 'f-1', name: 'Pilsner Malt', type: 'Grain', colorSrm: 1.6, potentialSg: 1.037 },
  { id: 'f-2', name: 'Pale Ale Malt (2-Row)', type: 'Grain', colorSrm: 3.5, potentialSg: 1.038 },
  { id: 'f-3', name: 'Maris Otter Malt', type: 'Grain', colorSrm: 3.0, potentialSg: 1.038 },
  { id: 'f-4', name: 'Munich Malt (10 SRM)', type: 'Grain', colorSrm: 10.0, potentialSg: 1.035 },
  { id: 'f-5', name: 'Caramalt / Crystal 40', type: 'Grain', colorSrm: 40.0, potentialSg: 1.034 },
  { id: 'f-6', name: 'Flaked Oats', type: 'Grain', colorSrm: 2.0, potentialSg: 1.033 },
  { id: 'f-7', name: 'Chocolate Malt', type: 'Grain', colorSrm: 450.0, potentialSg: 1.028 },
  { id: 'f-8', name: 'Dextrose / Corn Sugar', type: 'Sugar', colorSrm: 0.0, potentialSg: 1.046 },
  // M12_P1 catalog expansion (FEAT-011) — f-9..f-17, spec §3.1.
  { id: 'f-9', name: 'Vienna Malt', type: 'Grain', colorSrm: 3.5, potentialSg: 1.037 },
  { id: 'f-10', name: 'Caramunich I', type: 'Grain', colorSrm: 35.0, potentialSg: 1.035 },
  { id: 'f-11', name: 'Wheat Malt (Pale)', type: 'Grain', colorSrm: 2.0, potentialSg: 1.038 },
  { id: 'f-12', name: 'Rye Malt', type: 'Grain', colorSrm: 3.5, potentialSg: 1.036 },
  { id: 'f-13', name: 'Acidulated Malt', type: 'Grain', colorSrm: 3.0, potentialSg: 1.033 },
  { id: 'f-14', name: 'Roasted Barley', type: 'Grain', colorSrm: 500.0, potentialSg: 1.025 },
  { id: 'f-15', name: 'Black Malt / Patent', type: 'Grain', colorSrm: 550.0, potentialSg: 1.025 },
  { id: 'f-16', name: 'Flaked Barley', type: 'Grain', colorSrm: 1.5, potentialSg: 1.032 },
  { id: 'f-17', name: 'Dry Malt Extract (Light)', type: 'DryExtract', colorSrm: 3.0, potentialSg: 1.044 },
];

const SEED_CATALOG_HOPS = [
  { id: 'h-1', name: 'Citra', alphaAcidPct: 12.5, type: 'Pellet' },
  { id: 'h-2', name: 'Mosaic', alphaAcidPct: 11.8, type: 'Pellet' },
  { id: 'h-3', name: 'Cascade', alphaAcidPct: 6.5, type: 'Pellet' },
  { id: 'h-4', name: 'Centennial', alphaAcidPct: 9.5, type: 'Pellet' },
  { id: 'h-5', name: 'Saaz', alphaAcidPct: 3.5, type: 'Pellet' },
  { id: 'h-6', name: 'Magnum', alphaAcidPct: 14.0, type: 'Pellet' },
  { id: 'h-7', name: 'Simcoe', alphaAcidPct: 13.0, type: 'Pellet' },
  // M12_P1 catalog expansion (FEAT-011) — h-8..h-16, spec §3.1.
  { id: 'h-8', name: 'Amarillo', alphaAcidPct: 9.2, type: 'Pellet' },
  { id: 'h-9', name: 'Centennial', alphaAcidPct: 9.5, type: 'Pellet' },
  { id: 'h-10', name: 'Fuggle', alphaAcidPct: 4.5, type: 'Pellet' },
  { id: 'h-11', name: 'East Kent Goldings (EKG)', alphaAcidPct: 5.0, type: 'Pellet' },
  { id: 'h-12', name: 'Hallertau Mittelfrüh', alphaAcidPct: 4.0, type: 'Pellet' },
  { id: 'h-13', name: 'Galaxy', alphaAcidPct: 14.5, type: 'Pellet' },
  { id: 'h-14', name: 'Sabro', alphaAcidPct: 13.5, type: 'Pellet' },
  { id: 'h-15', name: 'Columbus / CTZ', alphaAcidPct: 15.0, type: 'Pellet' },
  { id: 'h-16', name: 'El Dorado', alphaAcidPct: 15.0, type: 'Pellet' },
];

const SEED_CATALOG_YEASTS = [
  { id: 'y-1', name: 'US-05 SafAle American', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 78 },
  { id: 'y-2', name: 'WLP001 California Ale', laboratory: 'White Labs', type: 'Ale', form: 'Liquid', attenuationPct: 80 },
  { id: 'y-3', name: 'W-34/70 SafLager West European', laboratory: 'Fermentis', type: 'Lager', form: 'Dry', attenuationPct: 83 },
  { id: 'y-4', name: 'Verdant IPA Hazy Ale', laboratory: 'Lallemand', type: 'Ale', form: 'Dry', attenuationPct: 77 },
  // M12_P1 catalog expansion (FEAT-011) — y-5..y-10, spec §3.1.
  { id: 'y-5', name: 'S-04 SafAle English Ale', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 75 },
  { id: 'y-6', name: 'Nottingham Ale Yeast', laboratory: 'Lallemand', type: 'Ale', form: 'Dry', attenuationPct: 77 },
  { id: 'y-7', name: 'Belle Saison Yeast', laboratory: 'Lallemand', type: 'Ale', form: 'Dry', attenuationPct: 88 },
  { id: 'y-8', name: 'WY1056 American Ale', laboratory: 'Wyeast', type: 'Ale', form: 'Liquid', attenuationPct: 75 },
  { id: 'y-9', name: 'WLP002 English Ale', laboratory: 'White Labs', type: 'Ale', form: 'Liquid', attenuationPct: 70 },
  { id: 'y-10', name: 'WLP830 German Lager', laboratory: 'White Labs', type: 'Lager', form: 'Liquid', attenuationPct: 77 },
];

const SEED_CATALOG_MISCS = [
  { id: 'm-1', name: 'Gypsum', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'g' },
  { id: 'm-2', name: 'Calcium Chloride', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'g' },
  { id: 'm-3', name: 'Irish Moss', type: 'Fining', defaultUse: 'Boil', defaultUnit: 'tsp' },
  { id: 'm-4', name: 'Whirlfloc Tablet', type: 'Fining', defaultUse: 'Boil', defaultUnit: 'each' },
  { id: 'm-5', name: 'Coriander Seed', type: 'Spice', defaultUse: 'Whirlpool', defaultUnit: 'g' },
  { id: 'm-6', name: 'Vanilla Bean', type: 'Flavor', defaultUse: 'Secondary', defaultUnit: 'each' },
  // M12_P1 catalog expansion (FEAT-011) — m-7..m-13, spec §3.1.
  { id: 'm-7', name: 'Epsom Salt', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'g' },
  { id: 'm-8', name: 'Table Salt (NaCl)', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'g' },
  { id: 'm-9', name: 'Baking Soda', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'g' },
  { id: 'm-10', name: 'Lactic Acid 88%', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'ml' },
  { id: 'm-11', name: 'Phosphoric Acid 75%', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'ml' },
  { id: 'm-12', name: 'Gelatin Finings', type: 'Fining', defaultUse: 'Secondary', defaultUnit: 'g' },
  { id: 'm-13', name: 'Sweet Orange Peel', type: 'Spice', defaultUse: 'Boil', defaultUnit: 'g' },
];

const SEED_WATER_PROFILES = [
  {
    id: 'wp-src-tap',
    name: 'Balanced Tap Water',
    type: 'source',
    calcium: 50,
    magnesium: 10,
    sodium: 20,
    chloride: 30,
    sulfate: 40,
    bicarbonate: 120,
    ph: 7.4,
    description: 'Standard municipal tap water profile',
    isSeed: 1,
  },
  {
    id: 'wp-src-ro',
    name: 'RO / Distilled Water',
    type: 'source',
    calcium: 0,
    magnesium: 0,
    sodium: 0,
    chloride: 0,
    sulfate: 0,
    bicarbonate: 0,
    ph: 6.0,
    description: 'Reverse osmosis or distilled baseline',
    isSeed: 1,
  },
  {
    id: 'wp-tgt-balanced',
    name: 'Balanced Profile',
    type: 'target',
    calcium: 80,
    magnesium: 15,
    sodium: 25,
    chloride: 75,
    sulfate: 80,
    bicarbonate: 100,
    ph: 7.0,
    description: 'Versatile profile for pale ales and lagers',
    isSeed: 1,
  },
  {
    id: 'wp-tgt-hoppy',
    name: 'Light & Hoppy Profile',
    type: 'target',
    calcium: 100,
    magnesium: 15,
    sodium: 20,
    chloride: 50,
    sulfate: 200,
    bicarbonate: 50,
    ph: 6.5,
    description: 'Sulfate-forward profile accentuating hop bitterness and aroma',
    isSeed: 1,
  },
  {
    id: 'wp-tgt-malty',
    name: 'Clarty & Malty Profile',
    type: 'target',
    calcium: 60,
    magnesium: 10,
    sodium: 25,
    chloride: 120,
    sulfate: 60,
    bicarbonate: 150,
    ph: 7.2,
    description: 'Chloride-forward profile enhancing malt sweetness and body',
    isSeed: 1,
  },
];

// M3_P2 — one 1-step and one 3-step mash profile, and one 3-step fermentation
// profile, written explicitly at the documented defaults, at SEED_TIMESTAMP,
// onConflictDoNothing (AC-16).
const SEED_MASH_PROFILES = [
  {
    id: 'mash-1',
    name: 'Single Infusion Mash',
    targetPh: 5.4,
    spargeTempC: null as number | null,
    isSeed: 1,
    steps: [
      {
        id: 'mash-1-step-0',
        name: 'Saccharification Rest',
        type: 'Infusion',
        stepTempC: 67,
        stepTimeMin: 60,
        rampTimeMin: 0,
        infuseAmountL: null as number | null,
        infuseWaterTempC: 100,
      },
    ],
  },
  {
    id: 'mash-2',
    name: '3-Step Mash',
    targetPh: 5.4,
    spargeTempC: null as number | null,
    isSeed: 1,
    steps: [
      {
        id: 'mash-2-step-0',
        name: 'Acid Rest',
        type: 'Temperature',
        stepTempC: 52,
        stepTimeMin: 15,
        rampTimeMin: 0,
        infuseAmountL: null as number | null,
        infuseWaterTempC: 100,
      },
      {
        id: 'mash-2-step-1',
        name: 'Saccharification Rest',
        type: 'Infusion',
        stepTempC: 67,
        stepTimeMin: 45,
        rampTimeMin: 5,
        infuseAmountL: null as number | null,
        infuseWaterTempC: 100,
      },
      {
        id: 'mash-2-step-2',
        name: 'Mash Out',
        type: 'Infusion',
        stepTempC: 76,
        stepTimeMin: 10,
        rampTimeMin: 5,
        infuseAmountL: null as number | null,
        infuseWaterTempC: 100,
      },
    ],
  },
];

const SEED_FERMENTATION_PROFILES = [
  {
    id: 'ferm-1',
    name: 'Standard Ale Fermentation',
    isSeed: 1,
    steps: [
      {
        id: 'ferm-1-step-0',
        name: 'Primary',
        type: 'Primary',
        stepTempC: 19,
        stepTimeDays: 14,
        rampDays: 0,
        pressurePsi: null as number | null,
      },
      {
        id: 'ferm-1-step-1',
        name: 'Cold Crash',
        type: 'ColdCrash',
        stepTempC: 2,
        stepTimeDays: 2,
        rampDays: 1,
        pressurePsi: null as number | null,
      },
      {
        id: 'ferm-1-step-2',
        name: 'Conditioning',
        type: 'Conditioning',
        stepTempC: 12,
        stepTimeDays: 14,
        rampDays: 0,
        pressurePsi: null as number | null,
      },
    ],
  },
];

const SEED_SAMPLE_RECIPE = {
  id: 'rec-sample-1',
  name: 'Trucha West Coast IPA',
  author: 'Esteban',
  styleName: '21A. American IPA',
  equipmentId: 'eq-1',
  // Existing recipes migrate to NULL on both — no fabricated schedule is
  // ever attached to a pre-existing recipe (M3_P2 spec §1.2, AC-16).
  mashProfileId: null as string | null,
  fermentationProfileId: null as string | null,
  notes: 'Crisp, dank, citrus-forward West Coast IPA with clean bitterness.',
  fermentables: [
    { id: 'rf-1', name: 'Pale Ale Malt (2-Row)', type: 'Grain', amountKg: 5.0, colorSrm: 3.5, potentialSg: 1.038 },
    { id: 'rf-2', name: 'Munich Malt (10 SRM)', type: 'Grain', amountKg: 0.5, colorSrm: 10.0, potentialSg: 1.035 },
    { id: 'rf-3', name: 'Caramalt / Crystal 40', type: 'Grain', amountKg: 0.25, colorSrm: 40.0, potentialSg: 1.034 },
  ],
  hops: [
    { id: 'rh-1', name: 'Magnum', amountG: 20, alphaAcidPct: 14.0, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet', timeMinutes: null as number | null },
    { id: 'rh-2', name: 'Citra', amountG: 30, alphaAcidPct: 12.5, use: 'Boil', boilMins: 15, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet', timeMinutes: null as number | null },
    { id: 'rh-3', name: 'Mosaic', amountG: 50, alphaAcidPct: 11.8, use: 'Whirlpool', boilMins: null, whirlpoolMins: 15, whirlpoolTempC: 79.0, type: 'Pellet', timeMinutes: null as number | null },
    // DryHop — timeMinutes is the DryHop-only field (M4_P1 spec AC-10); 0 is
    // this seed corpus's only DryHop row, per the spec's disclosed residual.
    { id: 'rh-4', name: 'Simcoe', amountG: 50, alphaAcidPct: 13.0, use: 'DryHop', boilMins: null, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet', timeMinutes: 0 as number | null },
  ],
  yeasts: [
    {
      id: 'ry-1',
      name: 'US-05 SafAle American',
      laboratory: 'Fermentis',
      type: 'Ale',
      form: 'Dry',
      attenuationPct: 78,
      amountPkg: 1,
    },
  ],
};

/** Idempotent — re-running never creates duplicates or mutates existing rows. */
export function seedDatabase(db: Db): void {
  db.transaction((tx) => {
    for (const eq of SEED_EQUIPMENT_PROFILES) {
      tx.insert(equipmentProfiles)
        .values({ ...eq, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP })
        .onConflictDoNothing({ target: equipmentProfiles.id })
        .run();
    }

    for (const f of SEED_CATALOG_FERMENTABLES) {
      tx.insert(catalogFermentables).values(f).onConflictDoNothing({ target: catalogFermentables.id }).run();
    }
    for (const h of SEED_CATALOG_HOPS) {
      tx.insert(catalogHops).values(h).onConflictDoNothing({ target: catalogHops.id }).run();
    }
    for (const y of SEED_CATALOG_YEASTS) {
      tx.insert(catalogYeasts).values(y).onConflictDoNothing({ target: catalogYeasts.id }).run();
    }
    for (const m of SEED_CATALOG_MISCS) {
      tx.insert(catalogMiscs).values(m).onConflictDoNothing({ target: catalogMiscs.id }).run();
    }

    for (const mp of SEED_MASH_PROFILES) {
      tx.insert(mashProfiles)
        .values({
          id: mp.id,
          name: mp.name,
          targetPh: mp.targetPh,
          spargeTempC: mp.spargeTempC,
          isSeed: mp.isSeed,
          createdAt: SEED_TIMESTAMP,
          updatedAt: SEED_TIMESTAMP,
        })
        .onConflictDoNothing({ target: mashProfiles.id })
        .run();
      mp.steps.forEach((s, position) => {
        tx.insert(mashSteps)
          .values({ ...s, mashProfileId: mp.id, position })
          .onConflictDoNothing({ target: mashSteps.id })
          .run();
      });
    }

    for (const fp of SEED_FERMENTATION_PROFILES) {
      tx.insert(fermentationProfiles)
        .values({ id: fp.id, name: fp.name, isSeed: fp.isSeed, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP })
        .onConflictDoNothing({ target: fermentationProfiles.id })
        .run();
      fp.steps.forEach((s, position) => {
        tx.insert(fermentationSteps)
          .values({ ...s, fermentationProfileId: fp.id, position })
          .onConflictDoNothing({ target: fermentationSteps.id })
          .run();
      });
    }

    for (const wp of SEED_WATER_PROFILES) {
      tx.insert(waterProfiles)
        .values({ ...wp, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP })
        .onConflictDoNothing({ target: waterProfiles.id })
        .run();
    }

    // M7_P1 — single 'default' row, same defaults as migration 0010's own
    // INSERT OR IGNORE. Both are idempotent and agree byte-for-byte; this
    // insert only matters for a database that was migrated from an older
    // 0010 (or seeded programmatically without ever running migrate.ts).
    tx.insert(userConfig)
      .values({
        id: 'default',
        unitSystem: 'metric',
        gravityUnit: 'sg',
        temperatureUnit: 'celsius',
        ibuFormula: 'tinseth',
        abvFormula: 'simple',
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
      })
      .onConflictDoNothing({ target: userConfig.id })
      .run();

    tx.insert(recipes)
      .values({
        id: SEED_SAMPLE_RECIPE.id,
        name: SEED_SAMPLE_RECIPE.name,
        author: SEED_SAMPLE_RECIPE.author,
        styleName: SEED_SAMPLE_RECIPE.styleName,
        equipmentId: SEED_SAMPLE_RECIPE.equipmentId,
        notes: SEED_SAMPLE_RECIPE.notes,
        mashProfileId: SEED_SAMPLE_RECIPE.mashProfileId,
        fermentationProfileId: SEED_SAMPLE_RECIPE.fermentationProfileId,
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
      })
      .onConflictDoNothing({ target: recipes.id })
      .run();

    SEED_SAMPLE_RECIPE.fermentables.forEach((f, position) => {
      tx.insert(recipeFermentables)
        .values({ ...f, recipeId: SEED_SAMPLE_RECIPE.id, position, notes: null })
        .onConflictDoNothing({ target: recipeFermentables.id })
        .run();
    });
    SEED_SAMPLE_RECIPE.hops.forEach((h, position) => {
      tx.insert(recipeHops)
        .values({ ...h, recipeId: SEED_SAMPLE_RECIPE.id, position })
        .onConflictDoNothing({ target: recipeHops.id })
        .run();
    });
    SEED_SAMPLE_RECIPE.yeasts.forEach((y, position) => {
      tx.insert(recipeYeasts)
        .values({ ...y, recipeId: SEED_SAMPLE_RECIPE.id, position })
        .onConflictDoNothing({ target: recipeYeasts.id })
        .run();
    });
  });
}
