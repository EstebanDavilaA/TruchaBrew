import type { EquipmentProfile, Recipe } from '../types/brewing';

export const SEED_EQUIPMENT_PROFILES: EquipmentProfile[] = [
  {
    id: 'eq-1',
    name: 'All-Grain 20L System',
    batchSizeL: 20,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 75,
    mashEfficiencyPct: 80,
    boilOffRateLPerHour: 3.5,
    trubChillerLossL: 2.0
  },
  {
    id: 'eq-2',
    name: 'BIAB 10L Mini System',
    batchSizeL: 10,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 70,
    mashEfficiencyPct: 72,
    boilOffRateLPerHour: 2.0,
    trubChillerLossL: 1.0
  }
];

export const INGREDIENT_CATALOG = {
  fermentables: [
    { id: 'f-1', name: 'Pilsner Malt', type: 'Grain' as const, colorSrm: 1.6, potentialSg: 1.037 },
    { id: 'f-2', name: 'Pale Ale Malt (2-Row)', type: 'Grain' as const, colorSrm: 3.5, potentialSg: 1.038 },
    { id: 'f-3', name: 'Maris Otter Malt', type: 'Grain' as const, colorSrm: 3.0, potentialSg: 1.038 },
    { id: 'f-4', name: 'Munich Malt (10 SRM)', type: 'Grain' as const, colorSrm: 10.0, potentialSg: 1.035 },
    { id: 'f-5', name: 'Caramalt / Crystal 40', type: 'Grain' as const, colorSrm: 40.0, potentialSg: 1.034 },
    { id: 'f-6', name: 'Flaked Oats', type: 'Grain' as const, colorSrm: 2.0, potentialSg: 1.033 },
    { id: 'f-7', name: 'Chocolate Malt', type: 'Grain' as const, colorSrm: 450.0, potentialSg: 1.028 },
    { id: 'f-8', name: 'Dextrose / Corn Sugar', type: 'Sugar' as const, colorSrm: 0.0, potentialSg: 1.046 }
  ],
  hops: [
    { id: 'h-1', name: 'Citra', alphaAcidPct: 12.5, type: 'Pellet' as const },
    { id: 'h-2', name: 'Mosaic', alphaAcidPct: 11.8, type: 'Pellet' as const },
    { id: 'h-3', name: 'Cascade', alphaAcidPct: 6.5, type: 'Pellet' as const },
    { id: 'h-4', name: 'Centennial', alphaAcidPct: 9.5, type: 'Pellet' as const },
    { id: 'h-5', name: 'Saaz', alphaAcidPct: 3.5, type: 'Pellet' as const },
    { id: 'h-6', name: 'Magnum', alphaAcidPct: 14.0, type: 'Pellet' as const },
    { id: 'h-7', name: 'Simcoe', alphaAcidPct: 13.0, type: 'Pellet' as const }
  ],
  yeasts: [
    { id: 'y-1', name: 'US-05 SafAle American', laboratory: 'Fermentis', type: 'Ale' as const, form: 'Dry' as const, attenuationPct: 78 },
    { id: 'y-2', name: 'WLP001 California Ale', laboratory: 'White Labs', type: 'Ale' as const, form: 'Liquid' as const, attenuationPct: 80 },
    { id: 'y-3', name: 'W-34/70 SafLager West European', laboratory: 'Fermentis', type: 'Lager' as const, form: 'Dry' as const, attenuationPct: 83 },
    { id: 'y-4', name: 'Verdant IPA Hazy Ale', laboratory: 'Lallemand', type: 'Ale' as const, form: 'Dry' as const, attenuationPct: 77 }
  ]
};

export const INITIAL_SAMPLE_RECIPE: Recipe = {
  id: 'rec-sample-1',
  name: 'Trucha West Coast IPA',
  author: 'Esteban',
  styleName: '21A. American IPA',
  equipment: SEED_EQUIPMENT_PROFILES[0],
  notes: 'Crisp, dank, citrus-forward West Coast IPA with clean bitterness.',
  fermentables: [
    { id: 'rf-1', name: 'Pale Ale Malt (2-Row)', type: 'Grain', amountKg: 5.0, colorSrm: 3.5, potentialSg: 1.038 },
    { id: 'rf-2', name: 'Munich Malt (10 SRM)', type: 'Grain', amountKg: 0.5, colorSrm: 10.0, potentialSg: 1.035 },
    { id: 'rf-3', name: 'Caramalt / Crystal 40', type: 'Grain', amountKg: 0.25, colorSrm: 40.0, potentialSg: 1.034 }
  ],
  hops: [
    { id: 'rh-1', name: 'Magnum', amountG: 20, alphaAcidPct: 14.0, use: 'Boil', timeMinutes: 60, type: 'Pellet' },
    { id: 'rh-2', name: 'Citra', amountG: 30, alphaAcidPct: 12.5, use: 'Boil', timeMinutes: 15, type: 'Pellet' },
    { id: 'rh-3', name: 'Mosaic', amountG: 50, alphaAcidPct: 11.8, use: 'Whirlpool', timeMinutes: 15, type: 'Pellet' },
    { id: 'rh-4', name: 'Simcoe', amountG: 50, alphaAcidPct: 13.0, use: 'DryHop', timeMinutes: 0, type: 'Pellet' }
  ],
  yeasts: [
    { id: 'ry-1', name: 'US-05 SafAle American', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 78, amountPkg: 1 }
  ]
};
