import { describe, it, expect } from 'vitest';
import { parseBrewfatherJson } from '../src/brewfatherImport';
import { calculateRecipeStats } from '../src/brewingMath';
import type { EquipmentProfile } from '@truchabrew/shared-types';
import montanoFixture from './fixtures/montano_brewing_recipes.json';

const baseEquipment: EquipmentProfile = {
  id: 'eq-test',
  name: 'Montano 28L',
  batchSizeL: 28,
  boilTimeMin: 60,
  brewhouseEfficiencyPct: 67.4,
  mashEfficiencyPct: 69.8,
  boilOffRateLPerHour: 4.51,
  trubChillerLossL: 2.2,
  hopUtilizationPct: 87,
  derivedFromEquipmentId: null,
  mashWaterRatioLPerKg: 3.0,
  grainAbsorptionLPerKg: 0.96,
  hopstandUtilizationFactor: 0.5,
  hopstandTemperatureC: 90,
  spargeTemperatureC: 77,
  mashTunHeatCapacityL: 0,
  grainTemperatureC: 20,
  notes: '',
};

describe('M10_P1: Brewfather JSON Ingestion', () => {
  describe('AC-1: Single Brewfather recipe JSON parse', () => {
    it('parses a single recipe object into RecipeWriteInput', () => {
      const singleRecipe = montanoFixture.recipes[0];
      const parsed = parseBrewfatherJson(singleRecipe, { defaultEquipmentId: 'eq-1' });

      expect(parsed).toHaveLength(1);
      const recipe = parsed[0];
      expect(recipe.name).toBe('Buho Weissbier');
      expect(recipe.author).toBe('Montano Brewing');
      expect(recipe.styleName).toBe('Weissbier');
      expect(recipe.equipmentId).toBe('eq-1');
      expect(recipe.fermentables.length).toBe(5);
      expect(recipe.hops.length).toBe(2);
      expect(recipe.yeasts.length).toBe(1);
      expect(recipe.miscs.length).toBe(7);
    });
  });

  describe('AC-2: Collection Brewfather JSON parse', () => {
    it('parses { recipes: [...] } into RecipeWriteInput[] matching array length', () => {
      const parsed = parseBrewfatherJson(montanoFixture, { defaultEquipmentId: 'eq-default' });
      expect(parsed).toHaveLength(6);
      expect(parsed.map((r) => r.name)).toEqual([
        'Buho Weissbier',
        'Frontino Porter',
        'IPL',
        'Mapanare IPA',
        'Navidad Red Ale',
        'Tangara APA',
      ]);
    });

    it('parses raw JSON string directly', () => {
      const jsonStr = JSON.stringify(montanoFixture.recipes[0]);
      const parsed = parseBrewfatherJson(jsonStr, { defaultEquipmentId: 'eq-default' });
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('Buho Weissbier');
    });

    it('parses raw array directly', () => {
      const rawArray = [montanoFixture.recipes[0], montanoFixture.recipes[1]];
      const parsed = parseBrewfatherJson(rawArray, { defaultEquipmentId: 'eq-default' });
      expect(parsed).toHaveLength(2);
    });
  });

  describe('AC-3: Montano Brewing fixture ingestion', () => {
    it('parses all 6 recipes in montano_brewing_recipes.json without throwing', () => {
      expect(() => {
        const recipes = parseBrewfatherJson(montanoFixture, { defaultEquipmentId: 'eq-montano' });
        expect(recipes).toHaveLength(6);
        for (const r of recipes) {
          expect(r.name).toBeTruthy();
          expect(r.equipmentId).toBe('eq-montano');
          expect(r.fermentables.length).toBeGreaterThan(0);
          expect(r.hops.length).toBeGreaterThan(0);
          expect(r.yeasts.length).toBeGreaterThan(0);
        }
      }).not.toThrow();
    });
  });

  describe('AC-4: Calculated stats parity on imported recipes', () => {
    it('calculating stats on imported Buho Weissbier yields expected parity', () => {
      const [buhoInput] = parseBrewfatherJson(montanoFixture.recipes[0], { defaultEquipmentId: 'eq-test' });

      // Create domain Recipe object for calculateRecipeStats
      const recipe = {
        id: 'r-buho',
        name: buhoInput.name,
        author: buhoInput.author,
        styleName: buhoInput.styleName,
        notes: buhoInput.notes,
        equipment: baseEquipment,
        fermentables: buhoInput.fermentables.map((f, i) => ({ ...f, id: `f-${i}`, potentialSg: f.potentialSg || 1.037 })),
        hops: buhoInput.hops.map((h, i) => ({ ...h, id: `h-${i}` })),
        yeasts: buhoInput.yeasts.map((y, i) => ({ ...y, id: `y-${i}` })),
        miscs: buhoInput.miscs.map((m, i) => ({ ...m, id: `m-${i}` })),
        mashProfile: null,
        fermentationProfile: null,
      };

      const stats = calculateRecipeStats(recipe);
      expect(stats.og).toBeGreaterThanOrEqual(1.049);
      expect(stats.og).toBeLessThanOrEqual(1.054);
      expect(stats.ibu).toBeGreaterThanOrEqual(11);
      expect(stats.ibu).toBeLessThanOrEqual(15);
      expect(stats.ebc).toBeGreaterThanOrEqual(6);
      expect(stats.ebc).toBeLessThanOrEqual(13);
    });
  });

  describe('AC-5: Fermentable type and color conversion', () => {
    it('converts colorEBC to SRM (colorEBC / 1.97) and maps types', () => {
      const raw = {
        name: 'Type Test',
        fermentables: [
          { name: 'Pale Malt', type: 'Grain', amountKg: 4, colorEBC: 6 },
          { name: 'Dextrose', type: 'Sugar', amountKg: 0.5, colorEBC: 0 },
          { name: 'Liquid Extract', type: 'Liquid Extract', amountKg: 1, colorEBC: 10 },
          { name: 'DME', type: 'Dry Extract', amountKg: 0.5, colorEBC: 8 },
          { name: 'Flaked Oats', type: 'Adjunct', amountKg: 0.4, colorEBC: 4 },
        ],
      };

      const [recipe] = parseBrewfatherJson(raw, { defaultEquipmentId: 'eq-1' });
      expect(recipe.fermentables[0].type).toBe('Grain');
      expect(recipe.fermentables[0].colorSrm).toBeCloseTo(6 / 1.97, 2);
      expect(recipe.fermentables[1].type).toBe('Sugar');
      expect(recipe.fermentables[2].type).toBe('LiquidExtract');
      expect(recipe.fermentables[3].type).toBe('DryExtract');
      expect(recipe.fermentables[4].type).toBe('Adjunct');
    });
  });

  describe('AC-6: Hop use and timing string parsing', () => {
    it('parses timing strings and hop uses accurately', () => {
      const raw = {
        name: 'Hop Test',
        hops: [
          { name: 'Cascade', alphaAcidPct: 6.5, amountG: 30, time: '60 min', use: 'Boil' },
          { name: 'Centennial', alphaAcidPct: 9.5, amountG: 20, time: '20 min', use: 'Hopstand @ 90C / Aroma' },
          { name: 'Citra', alphaAcidPct: 12.0, amountG: 50, time: '3 days', use: 'Dry Hop' },
          { name: 'Saaz', alphaAcidPct: 3.5, amountG: 25, time: 'First Wort', use: 'First Wort' },
        ],
      };

      const [recipe] = parseBrewfatherJson(raw, { defaultEquipmentId: 'eq-1' });
      expect(recipe.hops[0].use).toBe('Boil');
      expect(recipe.hops[0].boilMins).toBe(60);

      expect(recipe.hops[1].use).toBe('Whirlpool');
      expect(recipe.hops[1].whirlpoolMins).toBe(20);
      expect(recipe.hops[1].whirlpoolTempC).toBe(90);

      expect(recipe.hops[2].use).toBe('DryHop');
      expect(recipe.hops[2].timeMinutes).toBe(4320); // 3 days * 1440

      expect(recipe.hops[3].use).toBe('FirstWort');
      expect(recipe.hops[3].boilMins).toBe(60);
    });
  });

  describe('AC-7: Yeast strain attenuation and brand extraction', () => {
    it('extracts yeast laboratory and attenuationPct correctly', () => {
      const raw = {
        name: 'Yeast Test',
        yeast: [
          { name: 'WB-06 Safbrew Wheat', brand: 'Fermentis', attenuationPct: 86, amount: '2 packets' },
          { name: 'WLP001 California Ale', laboratory: 'White Labs', attenuation: 78, form: 'Liquid' },
        ],
      };

      const [recipe] = parseBrewfatherJson(raw, { defaultEquipmentId: 'eq-1' });
      expect(recipe.yeasts[0].name).toBe('WB-06 Safbrew Wheat');
      expect(recipe.yeasts[0].laboratory).toBe('Fermentis');
      expect(recipe.yeasts[0].attenuationPct).toBe(86);
      expect(recipe.yeasts[0].amountPkg).toBe(2);
      expect(recipe.yeasts[0].type).toBe('Wheat');
      expect(recipe.yeasts[0].form).toBe('Dry');

      expect(recipe.yeasts[1].laboratory).toBe('White Labs');
      expect(recipe.yeasts[1].attenuationPct).toBe(78);
      expect(recipe.yeasts[1].form).toBe('Liquid');
      expect(recipe.yeasts[1].type).toBe('Ale');
    });
  });

  describe('AC-8: Misc item parsing from composite strings', () => {
    it('parses composite amount and unit strings and maps misc types', () => {
      const raw = {
        name: 'Misc Test',
        misc: [
          { name: 'Calcium Chloride (CaCl2)', type: 'Water Agent', amount: '3.29 g', use: 'Mash' },
          { name: 'Whirlfloc', type: 'Fining', amount: '1 item', use: 'Boil 15 min' },
          { name: 'Coriander Seed', type: 'Flavor', amount: '15 g', use: 'Boil' },
        ],
      };

      const [recipe] = parseBrewfatherJson(raw, { defaultEquipmentId: 'eq-1' });
      expect(recipe.miscs[0].name).toBe('Calcium Chloride (CaCl2)');
      expect(recipe.miscs[0].type).toBe('WaterAgent');
      expect(recipe.miscs[0].use).toBe('Mash');
      expect(recipe.miscs[0].amount).toBe(3.29);
      expect(recipe.miscs[0].unit).toBe('g');

      expect(recipe.miscs[1].name).toBe('Whirlfloc');
      expect(recipe.miscs[1].type).toBe('Fining');
      expect(recipe.miscs[1].use).toBe('Boil');
      expect(recipe.miscs[1].timeMinutes).toBe(15);
      expect(recipe.miscs[1].amount).toBe(1);
      expect(recipe.miscs[1].unit).toBe('each');

      expect(recipe.miscs[2].type).toBe('Flavor');
      expect(recipe.miscs[2].amount).toBe(15);
      expect(recipe.miscs[2].unit).toBe('g');
    });
  });

  describe('AC-9: Purity and immutability', () => {
    it('does not mutate the input raw object', () => {
      const raw = {
        name: 'Immutable Test',
        fermentables: [{ name: 'Pilsner', amountKg: 5, colorEBC: 3.5 }],
      };
      const snapshot = JSON.stringify(raw);
      parseBrewfatherJson(raw, { defaultEquipmentId: 'eq-1' });
      expect(JSON.stringify(raw)).toBe(snapshot);
    });

    it('rejects invalid inputs cleanly', () => {
      expect(() => parseBrewfatherJson(null, { defaultEquipmentId: 'eq-1' })).toThrow(/Invalid JSON/);
      expect(() => parseBrewfatherJson('not-json', { defaultEquipmentId: 'eq-1' })).toThrow(/Invalid JSON/);
      expect(() => parseBrewfatherJson({}, { defaultEquipmentId: 'eq-1' })).toThrow(/No valid recipes/);
      expect(() => parseBrewfatherJson({ recipes: [] }, { defaultEquipmentId: 'eq-1' })).toThrow(/No valid recipes/);
    });
  });
});
