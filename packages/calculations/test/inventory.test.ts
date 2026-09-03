import { describe, it, expect } from 'vitest';
import type { InventoryItem, Recipe } from '@truchabrew/shared-types';
import {
  STOCK_EPSILON,
  INVENTORY_CATEGORIES,
  CANONICAL_INVENTORY_UNIT,
  MISC_INVENTORY_UNITS,
  EMPTY_STOCK_EVALUATION,
  normalizeInventoryName,
  isOutOfStock,
  isNegativeStock,
  isValidInventoryUnit,
  requirementsFromRecipe,
  evaluateStock,
} from '../src/inventory';

// ---------------------------------------------------------------------------
// Shared fixture (binding, spec §3) — used by AC-6 … AC-16.
// ---------------------------------------------------------------------------

function fixtureInventory(): InventoryItem[] {
  return [
    { id: 'inv-1', category: 'Fermentable', name: 'Pale Ale Malt', nameKey: 'pale ale malt', quantity: 4.0, unit: 'kg', costPerUnit: 3.2, purchaseDate: null, expiryDate: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'inv-2', category: 'Fermentable', name: 'Munich Malt', nameKey: 'munich malt', quantity: 0.0, unit: 'kg', costPerUnit: 4.1, purchaseDate: null, expiryDate: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'inv-3', category: 'Hop', name: 'Citra', nameKey: 'citra', quantity: 50, unit: 'g', costPerUnit: 0.09, purchaseDate: null, expiryDate: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'inv-4', category: 'Yeast', name: 'SafAle US-05', nameKey: 'safale us-05', quantity: 2, unit: 'pkg', costPerUnit: 4.5, purchaseDate: null, expiryDate: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'inv-5', category: 'Misc', name: 'Gypsum', nameKey: 'gypsum', quantity: -0.5, unit: 'g', costPerUnit: 0.02, purchaseDate: null, expiryDate: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'inv-6', category: 'Misc', name: 'Lactic Acid', nameKey: 'lactic acid', quantity: 100, unit: 'g', costPerUnit: 0.03, purchaseDate: null, expiryDate: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'inv-7', category: 'Fermentable', name: 'Flaked Oats', nameKey: 'flaked oats', quantity: 1.0, unit: 'kg', costPerUnit: null, purchaseDate: null, expiryDate: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ];
}

function fixtureRecipe(): Recipe {
  return {
    id: 'r-1',
    name: 'Fixture Recipe',
    author: 'Tester',
    styleName: 'IPA',
    equipment: {
      id: 'eq-1',
      name: 'Test Kit',
      batchSizeL: 20,
      boilTimeMin: 60,
      brewhouseEfficiencyPct: 75,
      mashEfficiencyPct: 80,
      boilOffRateLPerHour: 3.5,
      trubChillerLossL: 2,
      hopUtilizationPct: 87,
      derivedFromEquipmentId: null,
      mashWaterRatioLPerKg: 3.0,
      grainAbsorptionLPerKg: 0.96,
      hopstandUtilizationFactor: 0.26,
      hopstandTemperatureC: 79.0,
      spargeTemperatureC: 76.0,
      mashTunHeatCapacityL: 0.0,
      grainTemperatureC: 20.0,
      notes: '',
    },
    fermentables: [
      { id: 'f-1', name: 'Pale Ale Malt', type: 'Grain', amountKg: 3.0, colorSrm: 3.5, potentialSg: 1.037 },
      { id: 'f-2', name: 'PALE ALE  MALT', type: 'Grain', amountKg: 2.5, colorSrm: 3.5, potentialSg: 1.037 },
      { id: 'f-3', name: 'Munich Malt', type: 'Grain', amountKg: 0.5, colorSrm: 9, potentialSg: 1.037 },
    ],
    hops: [{ id: 'h-1', name: 'Citra', amountG: 50, alphaAcidPct: 12, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' }],
    yeasts: [{ id: 'y-1', name: 'SafAle US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 78, amountPkg: 3 }],
    miscs: [
      { id: 'm-1', name: 'Gypsum', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: 4, unit: 'g' },
      { id: 'm-2', name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 15, amount: 1, unit: 'each' },
      { id: 'm-3', name: 'Lactic Acid', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: 2, unit: 'ml' },
    ],
    notes: '',
    mashProfile: null,
    fermentationProfile: null,
  };
}

describe('AC-1: constant exports', () => {
  it('values and frozenness', () => {
    expect(STOCK_EPSILON).toBe(1e-6);
    expect(INVENTORY_CATEGORIES).toEqual(['Fermentable', 'Hop', 'Yeast', 'Misc']);
    expect(CANONICAL_INVENTORY_UNIT).toEqual({ Fermentable: 'kg', Hop: 'g', Yeast: 'pkg' });
    expect(MISC_INVENTORY_UNITS).toEqual(['g', 'ml', 'tsp', 'tbsp', 'each']);
    expect(Object.isFrozen(INVENTORY_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(CANONICAL_INVENTORY_UNIT)).toBe(true);
    expect(Object.isFrozen(MISC_INVENTORY_UNITS)).toBe(true);
    expect(Object.isFrozen(EMPTY_STOCK_EVALUATION)).toBe(true);
  });
});

describe('AC-2: normalizeInventoryName', () => {
  it('trims, collapses whitespace, lowercases', () => {
    expect(normalizeInventoryName('  Pale   Ale MALT ')).toBe('pale ale malt');
    expect(normalizeInventoryName('Citra')).toBe('citra');
    expect(normalizeInventoryName('A\t\nB')).toBe('a b');
    expect(normalizeInventoryName('')).toBe('');
    expect(normalizeInventoryName('   ')).toBe('');
  });
});

describe('AC-3: isOutOfStock boundary (inclusive)', () => {
  it.each([
    [0, true],
    [1e-9, true],
    [1e-6, true],
    [-0.5, true],
    [0.0001, false],
    [4, false],
  ])('%d -> %s', (q, expected) => {
    expect(isOutOfStock(q)).toBe(expected);
  });
});

describe('AC-4: isNegativeStock boundary (exclusive)', () => {
  it.each([
    [-0.5, true],
    [-1e-9, false],
    [-1e-6, false],
    [0, false],
    [4, false],
  ])('%d -> %s', (q, expected) => {
    expect(isNegativeStock(q)).toBe(expected);
  });
});

describe('AC-5: isValidInventoryUnit', () => {
  it('enforces category-canonical units', () => {
    expect(isValidInventoryUnit('Fermentable', 'kg')).toBe(true);
    expect(isValidInventoryUnit('Fermentable', 'g')).toBe(false);
    expect(isValidInventoryUnit('Hop', 'g')).toBe(true);
    expect(isValidInventoryUnit('Hop', 'kg')).toBe(false);
    expect(isValidInventoryUnit('Yeast', 'pkg')).toBe(true);
    expect(isValidInventoryUnit('Misc', 'ml')).toBe(true);
    expect(isValidInventoryUnit('Misc', 'kg')).toBe(false);
    expect(isValidInventoryUnit('Misc', 'pkg')).toBe(false);
  });
});

describe('AC-6: requirement aggregation, naming and order', () => {
  it('7 groups in the pinned order', () => {
    const reqs = requirementsFromRecipe(fixtureRecipe());
    expect(reqs).toHaveLength(7);
    expect(reqs.map((r) => r.nameKey)).toEqual([
      'pale ale malt',
      'munich malt',
      'citra',
      'safale us-05',
      'gypsum',
      'whirlfloc',
      'lactic acid',
    ]);
    expect(reqs[0].requiredAmount).toBe(5.5);
    expect(reqs[0].displayName).toBe('Pale Ale Malt');
    expect(reqs[0].unit).toBe('kg');
  });
});

describe('AC-7: non-positive groups omitted (degenerate)', () => {
  it('a single 0 kg fermentable, a cancelling +/-, and an empty recipe all -> []', () => {
    const base = fixtureRecipe();

    const zeroRecipe: Recipe = { ...base, fermentables: [{ id: 'f-1', name: 'X', type: 'Grain', amountKg: 0, colorSrm: 1, potentialSg: 1.037 }], hops: [], yeasts: [], miscs: [] };
    expect(requirementsFromRecipe(zeroRecipe)).toEqual([]);

    const cancellingRecipe: Recipe = {
      ...base,
      fermentables: [
        { id: 'f-1', name: 'X', type: 'Grain', amountKg: 1.0, colorSrm: 1, potentialSg: 1.037 },
        { id: 'f-2', name: 'X', type: 'Grain', amountKg: -1.0, colorSrm: 1, potentialSg: 1.037 },
      ],
      hops: [],
      yeasts: [],
      miscs: [],
    };
    expect(requirementsFromRecipe(cancellingRecipe)).toEqual([]);

    const emptyRecipe: Recipe = { ...base, fermentables: [], hops: [], yeasts: [], miscs: [] };
    expect(requirementsFromRecipe(emptyRecipe)).toEqual([]);
  });
});

function fixtureLines() {
  const reqs = requirementsFromRecipe(fixtureRecipe());
  const evalResult = evaluateStock(reqs, fixtureInventory());
  return { reqs, evalResult };
}

describe('AC-8: exactly-equal boundary is sufficient', () => {
  it('citra: required 50, onHand 50 -> shortfall 0, sufficient true', () => {
    const { evalResult } = fixtureLines();
    const citra = evalResult.lines.find((l) => l.nameKey === 'citra')!;
    expect(citra.requiredAmount).toBe(50);
    expect(citra.onHand).toBe(50);
    expect(citra.shortfall).toBe(0);
    expect(citra.sufficient).toBe(true);
    expect(citra.unitMismatch).toBe(false);
  });
});

describe('AC-9: shortfall values', () => {
  it('pale ale malt, munich malt, safale us-05, gypsum', () => {
    const { evalResult } = fixtureLines();
    const byKey = (k: string) => evalResult.lines.find((l) => l.nameKey === k)!;

    expect(byKey('pale ale malt').shortfall).toBeCloseTo(1.5, 9);
    expect(byKey('munich malt').shortfall).toBeCloseTo(0.5, 9);
    expect(byKey('safale us-05').shortfall).toBeCloseTo(1, 9);
    expect(byKey('gypsum').shortfall).toBeCloseTo(4.5, 9);

    for (const key of ['pale ale malt', 'munich malt', 'safale us-05', 'gypsum']) {
      expect(byKey(key).sufficient).toBe(false);
    }
  });
});

describe('AC-10: no-match contract', () => {
  it('whirlfloc — deep-equal to the fallback shape', () => {
    const { evalResult } = fixtureLines();
    const whirlfloc = evalResult.lines.find((l) => l.nameKey === 'whirlfloc')!;
    expect(whirlfloc).toEqual({
      category: 'Misc',
      displayName: 'Whirlfloc',
      nameKey: 'whirlfloc',
      unit: 'each',
      requiredAmount: 1,
      matched: false,
      inventoryItemId: null,
      inventoryUnit: null,
      onHand: null,
      unitMismatch: false,
      shortfall: null,
      sufficient: null,
    });
  });
});

describe('AC-11: unit-mismatch contract', () => {
  it('lactic acid — recorded in g, recipe asks for ml', () => {
    const { evalResult } = fixtureLines();
    const lacticAcid = evalResult.lines.find((l) => l.nameKey === 'lactic acid')!;
    expect(lacticAcid.matched).toBe(true);
    expect(lacticAcid.inventoryItemId).toBe('inv-6');
    expect(lacticAcid.inventoryUnit).toBe('g');
    expect(lacticAcid.onHand).toBe(100);
    expect(lacticAcid.unitMismatch).toBe(true);
    expect(lacticAcid.shortfall).toBeNull();
    expect(lacticAcid.sufficient).toBeNull();
  });
});

describe('AC-12: aggregate counters', () => {
  it('matches the fixture', () => {
    const { evalResult } = fixtureLines();
    expect(evalResult.requirementCount).toBe(7);
    expect(evalResult.matchedCount).toBe(6);
    expect(evalResult.comparableCount).toBe(5);
    expect(evalResult.unmatchedCount).toBe(1);
    expect(evalResult.unitMismatchCount).toBe(1);
    expect(evalResult.shortfallCount).toBe(4);
    expect(evalResult.hasShortfall).toBe(true);
  });
});

describe('AC-13: degenerate / empty inputs', () => {
  it('no requirements -> EMPTY_STOCK_EVALUATION; requirements against empty inventory -> all unmatched, no shortfall', () => {
    const { reqs } = fixtureLines();
    expect(evaluateStock([], fixtureInventory())).toEqual(EMPTY_STOCK_EVALUATION);

    const againstEmpty = evaluateStock(reqs, []);
    expect(againstEmpty.lines).toHaveLength(7);
    expect(againstEmpty.lines.every((l) => l.matched === false)).toBe(true);
    expect(againstEmpty.unmatchedCount).toBe(7);
    expect(againstEmpty.shortfallCount).toBe(0);
    expect(againstEmpty.hasShortfall).toBe(false);
  });
});

describe('AC-14: epsilon clamp, both sides', () => {
  it('float noise clamps to exactly 0; a real small shortfall survives', () => {
    const closeReqs = [{ category: 'Fermentable' as const, displayName: 'X', nameKey: 'x', unit: 'kg' as const, requiredAmount: 0.1 + 0.2 }];
    const closeInventory: InventoryItem[] = [
      { id: 'i1', category: 'Fermentable', name: 'X', nameKey: 'x', quantity: 0.3, unit: 'kg', costPerUnit: null, purchaseDate: null, expiryDate: null, notes: '', createdAt: '', updatedAt: '' },
    ];
    const closeResult = evaluateStock(closeReqs, closeInventory);
    expect(closeResult.lines[0].shortfall).toBe(0);
    expect(closeResult.lines[0].sufficient).toBe(true);

    const tinyReqs = [{ category: 'Fermentable' as const, displayName: 'X', nameKey: 'x', unit: 'kg' as const, requiredAmount: 1.000002 }];
    const tinyInventory: InventoryItem[] = [
      { id: 'i1', category: 'Fermentable', name: 'X', nameKey: 'x', quantity: 1.0, unit: 'kg', costPerUnit: null, purchaseDate: null, expiryDate: null, notes: '', createdAt: '', updatedAt: '' },
    ];
    const tinyResult = evaluateStock(tinyReqs, tinyInventory);
    expect(tinyResult.lines[0].shortfall).toBeCloseTo(0.000002, 9);
    expect(tinyResult.lines[0].sufficient).toBe(false);
  });
});

describe('AC-15: category isolation', () => {
  it('a Hop row named "citra" does not satisfy a Misc requirement named "Citra"', () => {
    const reqs = [{ category: 'Misc' as const, displayName: 'Citra', nameKey: 'citra', unit: 'g' as const, requiredAmount: 5 }];
    const inventory: InventoryItem[] = [
      { id: 'hop-citra', category: 'Hop', name: 'Citra', nameKey: 'citra', quantity: 100, unit: 'g', costPerUnit: null, purchaseDate: null, expiryDate: null, notes: '', createdAt: '', updatedAt: '' },
    ];
    const result = evaluateStock(reqs, inventory);
    expect(result.lines[0].matched).toBe(false);
  });
});

describe('AC-16: purity, key surface, and no cost math', () => {
  it('does not mutate arguments, the StockLine key surface is exactly 12 keys, and the module never mentions the cost field', async () => {
    const { reqs } = fixtureLines();
    const inventory = fixtureInventory();
    const reqsClone = structuredClone(reqs);
    const inventoryClone = structuredClone(inventory);

    const result = evaluateStock(reqs, inventory);

    expect(reqs).toEqual(reqsClone);
    expect(inventory).toEqual(inventoryClone);

    expect(Object.keys(result.lines[0]).sort()).toEqual(
      ['category', 'displayName', 'inventoryItemId', 'inventoryUnit', 'matched', 'nameKey', 'onHand', 'requiredAmount', 'shortfall', 'sufficient', 'unit', 'unitMismatch'].sort(),
    );

    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, '../src/inventory.ts'), 'utf8');
    expect((source.match(/costPerUnit/g) ?? []).length).toBe(0);
  });
});
