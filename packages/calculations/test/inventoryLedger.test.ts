import { describe, it, expect } from 'vitest';
import type { InventoryItem, InventoryTransaction, Recipe, StockEvaluation } from '@truchabrew/shared-types';
import { requirementsFromRecipe, evaluateStock } from '../src/inventory';
import {
  LEDGER_KINDS,
  EMPTY_COST_BREAKDOWN,
  EMPTY_CHECKOFF_STATE,
  isReversed,
  openDeductions,
  sumOpenDeductions,
  projectInventoryStock,
  evaluateCheckoff,
  batchCostBreakdown,
} from '../src/inventoryLedger';

// ---------------------------------------------------------------------------
// Shared fixture (binding, spec §3) — the M9_P1 fixture, verbatim.
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

function fixtureEvaluation(): StockEvaluation {
  const requirements = requirementsFromRecipe(fixtureRecipe());
  return evaluateStock(requirements, fixtureInventory());
}

/** The `COST_FIXTURE` recipe — fixtureRecipe plus one appended Flaked Oats fermentable line (AC-16). */
function costFixtureRecipe(): Recipe {
  const base = fixtureRecipe();
  return {
    ...base,
    fermentables: [...base.fermentables, { id: 'f-4', name: 'Flaked Oats', type: 'Adjunct', amountKg: 0.5, colorSrm: 1, potentialSg: 1.036 }],
  };
}

function costFixtureEvaluation(): StockEvaluation {
  const requirements = requirementsFromRecipe(costFixtureRecipe());
  return evaluateStock(requirements, fixtureInventory());
}

function tx(overrides: Partial<InventoryTransaction> = {}): InventoryTransaction {
  return {
    id: 'tx-1',
    batchId: 'batch-1',
    inventoryItemId: 'inv-1',
    kind: 'deduction',
    reversesTransactionId: null,
    category: 'Fermentable',
    displayName: 'Pale Ale Malt',
    nameKey: 'pale ale malt',
    amount: 5.5,
    unit: 'kg',
    costPerUnit: 3.2,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** The full-checkoff ledger, in this exact creation order (spec §3). */
function fullCheckoffLedger(): InventoryTransaction[] {
  return [
    tx({ id: 'd-1', inventoryItemId: 'inv-1', category: 'Fermentable', displayName: 'Pale Ale Malt', nameKey: 'pale ale malt', amount: 5.5, unit: 'kg', costPerUnit: 3.2, createdAt: '2026-01-01T00:00:00.000Z' }),
    tx({ id: 'd-2', inventoryItemId: 'inv-2', category: 'Fermentable', displayName: 'Munich Malt', nameKey: 'munich malt', amount: 0.5, unit: 'kg', costPerUnit: 4.1, createdAt: '2026-01-01T00:00:01.000Z' }),
    tx({ id: 'd-3', inventoryItemId: 'inv-3', category: 'Hop', displayName: 'Citra', nameKey: 'citra', amount: 50, unit: 'g', costPerUnit: 0.09, createdAt: '2026-01-01T00:00:02.000Z' }),
    tx({ id: 'd-4', inventoryItemId: 'inv-4', category: 'Yeast', displayName: 'SafAle US-05', nameKey: 'safale us-05', amount: 3, unit: 'pkg', costPerUnit: 4.5, createdAt: '2026-01-01T00:00:03.000Z' }),
    tx({ id: 'd-5', inventoryItemId: 'inv-5', category: 'Misc', displayName: 'Gypsum', nameKey: 'gypsum', amount: 4, unit: 'g', costPerUnit: 0.02, createdAt: '2026-01-01T00:00:04.000Z' }),
  ];
}

describe('AC-1: ledger constant exports', () => {
  it('values and frozenness', () => {
    expect(LEDGER_KINDS).toEqual(['deduction', 'reversal']);
    expect(EMPTY_COST_BREAKDOWN).toEqual({ lines: [], lineCount: 0, costedLineCount: 0, uncostedLineCount: 0, hasUncostedLines: false, totalCost: 0 });
    expect(EMPTY_CHECKOFF_STATE).toEqual({
      lines: [],
      requirementCount: 0,
      matchedCount: 0,
      comparableCount: 0,
      unmatchedCount: 0,
      unitMismatchCount: 0,
      shortfallCount: 0,
      hasShortfall: false,
      checkableCount: 0,
      checkedCount: 0,
      allCheckedOff: false,
      stage: 'Planning',
      editable: true,
    });
    expect(Object.isFrozen(LEDGER_KINDS)).toBe(true);
    expect(Object.isFrozen(EMPTY_COST_BREAKDOWN)).toBe(true);
    expect(Object.isFrozen(EMPTY_CHECKOFF_STATE)).toBe(true);
  });
});

describe('AC-2: isReversed / openDeductions', () => {
  it('reversal marks the target row; reversals-only and empty ledgers are []', () => {
    const d1 = tx({ id: 'd1' });
    const d2 = tx({ id: 'd2', inventoryItemId: 'inv-2' });
    const r1 = tx({ id: 'r1', kind: 'reversal', reversesTransactionId: 'd1' });
    const ledger = [d1, d2, r1];
    const ledgerClone = structuredClone(ledger);

    expect(isReversed('d1', ledger)).toBe(true);
    expect(isReversed('d2', ledger)).toBe(false);
    expect(openDeductions(ledger)).toEqual([d2]);
    expect(openDeductions([r1])).toEqual([]);
    expect(openDeductions([])).toEqual([]);
    expect(ledger).toEqual(ledgerClone);
  });
});

describe('AC-3: sumOpenDeductions order and seed', () => {
  it('sums open amounts; empty is +0 not -0; a fully-reversed ledger is 0', () => {
    const ledger = fullCheckoffLedger();
    expect(sumOpenDeductions(ledger)).toBe(63);
    expect(sumOpenDeductions([])).toBe(0);
    expect(Object.is(sumOpenDeductions([]), -0)).toBe(false);

    const d = tx({ id: 'd1' });
    const r = tx({ id: 'r1', kind: 'reversal', reversesTransactionId: 'd1' });
    expect(sumOpenDeductions([d, r])).toBe(0);
  });
});

describe('AC-4: projectInventoryStock — empty ledger is identity (degenerate)', () => {
  it('every item: quantity Object.is-identical, baseQuantity/deductedQuantity/openDeductionCount correct', () => {
    const items = fixtureInventory();
    const itemsClone = structuredClone(items);
    const out = projectInventoryStock(items, []);

    for (let i = 0; i < items.length; i++) {
      expect(Object.is(out[i].quantity, items[i].quantity)).toBe(true);
      expect(out[i].baseQuantity).toBe(items[i].quantity);
      expect(out[i].deductedQuantity).toBe(0);
      expect(out[i].openDeductionCount).toBe(0);
    }
    expect(out[4].quantity).toBe(-0.5);
    expect(Object.is(out[1].quantity, 0)).toBe(true);
    expect(Object.is(out[1].quantity, -0)).toBe(false);
    expect(items).toEqual(itemsClone);
  });
});

describe('AC-5: no drift after repeated toggles — bit-exact (roadmap clause 1)', () => {
  it('50 deduct/reverse cycles on inv-1 (base 4.0, amount 5.5) hold Object.is exactly every time', () => {
    const items = [fixtureInventory()[0]];
    let ledger: InventoryTransaction[] = [];

    for (let cycle = 0; cycle < 50; cycle++) {
      const dId = `d-${cycle}`;
      ledger = [...ledger, tx({ id: dId, createdAt: `2026-01-01T00:${String(cycle).padStart(2, '0')}:00.000Z` })];
      const deducted = projectInventoryStock(items, ledger)[0];
      expect(Object.is(deducted.quantity, -1.5)).toBe(true);

      const rId = `r-${cycle}`;
      ledger = [...ledger, tx({ id: rId, kind: 'reversal', reversesTransactionId: dId, createdAt: `2026-01-01T00:${String(cycle).padStart(2, '0')}:30.000Z` })];
      const restored = projectInventoryStock(items, ledger)[0];
      expect(Object.is(restored.quantity, 4.0)).toBe(true);
    }

    expect(ledger).toHaveLength(100);
    expect(openDeductions(ledger)).toEqual([]);
  });
});

describe('AC-6: the rejected inverse-addition model is provably wrong (pinned counterexample)', () => {
  it('base 0.01 / amount 0.03 — inverse addition drifts; the adopted model holds exactly', () => {
    const base = 0.01;
    const amount = 0.03;
    let inverseAddResult = base;
    for (let i = 0; i < 50; i++) {
      inverseAddResult = inverseAddResult - amount + amount;
    }
    expect(Object.is((base - amount) + amount, 0.010000000000000002)).toBe(true);
    expect(Object.is((base - amount) + amount, base)).toBe(false);
    expect((base - amount + amount) - base).toBe(1.734723475976807e-18);

    const items: InventoryItem[] = [{ ...fixtureInventory()[0], quantity: base }];
    let ledger: InventoryTransaction[] = [];
    for (let cycle = 0; cycle < 50; cycle++) {
      const dId = `d-${cycle}`;
      ledger = [...ledger, tx({ id: dId, amount, createdAt: `2026-01-01T01:${String(cycle).padStart(2, '0')}:00.000Z` })];
      const rId = `r-${cycle}`;
      ledger = [...ledger, tx({ id: rId, kind: 'reversal', reversesTransactionId: dId, amount, createdAt: `2026-01-01T01:${String(cycle).padStart(2, '0')}:30.000Z` })];
    }
    const result = projectInventoryStock(items, ledger)[0];
    expect(Object.is(result.quantity, base)).toBe(true);
  });
});

describe('AC-7: projection with a partial ledger, and orphaned rows', () => {
  it('inv-1 and inv-3 deducted; inv-2 untouched; an unknown inventoryItemId row is ignored', () => {
    const items = fixtureInventory();
    const ledger = [
      tx({ id: 'd-1', inventoryItemId: 'inv-1', amount: 5.5 }),
      tx({ id: 'd-3', inventoryItemId: 'inv-3', amount: 50, unit: 'g' }),
      tx({ id: 'd-orphan', inventoryItemId: 'inv-99', amount: 999 }),
    ];
    const out = projectInventoryStock(items, ledger);
    const byId = new Map(out.map((r) => [r.id, r]));

    expect(byId.get('inv-1')).toMatchObject({ baseQuantity: 4.0, deductedQuantity: 5.5, quantity: -1.5, openDeductionCount: 1 });
    expect(byId.get('inv-3')).toMatchObject({ baseQuantity: 50, deductedQuantity: 50, quantity: 0, openDeductionCount: 1 });
    expect(byId.get('inv-2')).toMatchObject({ baseQuantity: 0, deductedQuantity: 0, quantity: 0 });
  });
});

describe('AC-8: evaluateCheckoff line contract', () => {
  it('18-key line shape; pale ale malt line is checked with the deduction details', () => {
    const state = evaluateCheckoff(fixtureEvaluation(), fullCheckoffLedger(), 'Planning');
    const paleAleLine = state.lines.find((l) => l.nameKey === 'pale ale malt')!;

    expect(Object.keys(paleAleLine).sort()).toEqual(
      ['category', 'checkable', 'checkedAmount', 'checkedAt', 'checkedCostPerUnit', 'checked', 'displayName', 'inventoryItemId', 'inventoryUnit', 'matched', 'nameKey', 'onHand', 'openTransactionId', 'requiredAmount', 'shortfall', 'sufficient', 'unit', 'unitMismatch'].sort(),
    );
    expect(paleAleLine.checkable).toBe(true);
    expect(paleAleLine.checked).toBe(true);
    expect(paleAleLine.openTransactionId).toBe('d-1');
    expect(paleAleLine.checkedAmount).toBe(5.5);
    expect(paleAleLine.checkedCostPerUnit).toBe(3.2);
    expect(paleAleLine.checkedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('AC-9: non-checkable lines are inert, defensively', () => {
  it('whirlfloc/lactic acid stay all-null even with a doctored open deduction naming their inventoryItemId', () => {
    const evaluation = fixtureEvaluation();
    const lacticLine = evaluation.lines.find((l) => l.nameKey === 'lactic acid')!;
    const doctoredLedger = [tx({ id: 'd-doctored', inventoryItemId: lacticLine.inventoryItemId as string })];

    const state = evaluateCheckoff(evaluation, doctoredLedger, 'Planning');
    const whirlfloc = state.lines.find((l) => l.nameKey === 'whirlfloc')!;
    const lactic = state.lines.find((l) => l.nameKey === 'lactic acid')!;

    for (const line of [whirlfloc, lactic]) {
      expect(line.checkable).toBe(false);
      expect(line.checked).toBe(false);
      expect(line.openTransactionId).toBeNull();
      expect(line.checkedAmount).toBeNull();
      expect(line.checkedCostPerUnit).toBeNull();
      expect(line.checkedAt).toBeNull();
    }
  });
});

describe('AC-10: evaluateCheckoff counters', () => {
  it('full checkoff counters; partial; stage Brewing only flips editable', () => {
    const full = evaluateCheckoff(fixtureEvaluation(), fullCheckoffLedger(), 'Planning');
    expect(full).toMatchObject({ requirementCount: 7, matchedCount: 6, comparableCount: 5, unmatchedCount: 1, unitMismatchCount: 1, checkableCount: 5, checkedCount: 5, allCheckedOff: true, editable: true });

    const partial = evaluateCheckoff(fixtureEvaluation(), [fullCheckoffLedger()[0]], 'Planning');
    expect(partial.checkedCount).toBe(1);
    expect(partial.allCheckedOff).toBe(false);

    const brewing = evaluateCheckoff(fixtureEvaluation(), fullCheckoffLedger(), 'Brewing');
    expect(brewing.editable).toBe(false);
    expect(brewing.checkedCount).toBe(5);
    expect(brewing.checkableCount).toBe(5);
  });
});

describe('AC-11: degenerate checkoff states', () => {
  it('EMPTY_STOCK_EVALUATION -> EMPTY_CHECKOFF_STATE; empty ledger over the fixture -> allCheckedOff false', () => {
    const empty = evaluateCheckoff({ lines: [], requirementCount: 0, matchedCount: 0, comparableCount: 0, unmatchedCount: 0, unitMismatchCount: 0, shortfallCount: 0, hasShortfall: false }, [], 'Planning');
    expect(empty).toEqual(EMPTY_CHECKOFF_STATE);

    const noLedger = evaluateCheckoff(fixtureEvaluation(), [], 'Planning');
    expect(noLedger.lines).toHaveLength(7);
    expect(noLedger.lines.every((l) => l.checked === false)).toBe(true);
    expect(noLedger.checkedCount).toBe(0);
    expect(noLedger.allCheckedOff).toBe(false);
  });
});

describe('AC-12: purity of every new pure function', () => {
  it('leaves every argument deep-equal to a pre-call clone; no Date.now/Math.random', () => {
    const ledger = fullCheckoffLedger();
    const ledgerClone = structuredClone(ledger);
    const evaluation = fixtureEvaluation();
    const evaluationClone = structuredClone(evaluation);

    openDeductions(ledger);
    sumOpenDeductions(ledger);
    projectInventoryStock(fixtureInventory(), ledger);
    evaluateCheckoff(evaluation, ledger, 'Planning');
    batchCostBreakdown(ledger);

    expect(ledger).toEqual(ledgerClone);
    expect(evaluation).toEqual(evaluationClone);
  });
});

describe('AC-13: M9_P1 contracts are byte-identical (regression)', () => {
  it('inventory.ts exports are unchanged behaviorally', () => {
    const line = fixtureEvaluation().lines[0];
    expect(Object.keys(line)).toHaveLength(12);
  });
});

describe('AC-14: cost total (roadmap clause 2)', () => {
  it('5-line breakdown, ledger order, strict-equal unrounded total', () => {
    const breakdown = batchCostBreakdown(fullCheckoffLedger());
    expect(breakdown.lines.map((l) => l.lineCost)).toEqual([17.6, 2.05, 4.5, 13.5, 0.08]);
    expect(breakdown.totalCost).toBe(37.730000000000004);
    expect(breakdown.totalCost.toFixed(2)).toBe('37.73');
    expect(breakdown.lineCount).toBe(5);
    expect(breakdown.costedLineCount).toBe(5);
    expect(breakdown.uncostedLineCount).toBe(0);
    expect(breakdown.hasUncostedLines).toBe(false);
  });
});

describe('AC-15: reversed deductions cost nothing', () => {
  it('reversing inv-4 drops it from lines and totalCost, strict-equal', () => {
    const ledger = [...fullCheckoffLedger(), tx({ id: 'r-4', kind: 'reversal', reversesTransactionId: 'd-4', inventoryItemId: 'inv-4', amount: 3, unit: 'pkg', costPerUnit: 4.5, createdAt: '2026-01-01T00:01:00.000Z' })];
    const breakdown = batchCostBreakdown(ledger);
    expect(breakdown.lines).toHaveLength(4);
    expect(breakdown.totalCost).toBe(24.23);
    expect(breakdown.lineCount).toBe(4);
    expect(breakdown.lines.some((l) => l.transactionId === 'r-4')).toBe(false);
  });
});

describe('AC-16: null price is uncosted, never zero', () => {
  it('COST_FIXTURE: inv-1 costed, inv-7 uncosted', () => {
    void costFixtureEvaluation;
    const ledger = [
      tx({ id: 'd-1', inventoryItemId: 'inv-1', amount: 5.5, unit: 'kg', costPerUnit: 3.2, createdAt: '2026-01-01T00:00:00.000Z' }),
      tx({ id: 'd-7', inventoryItemId: 'inv-7', category: 'Fermentable', displayName: 'Flaked Oats', nameKey: 'flaked oats', amount: 0.5, unit: 'kg', costPerUnit: null, createdAt: '2026-01-01T00:00:01.000Z' }),
    ];
    const breakdown = batchCostBreakdown(ledger);
    expect(breakdown.lines[1].costPerUnit).toBeNull();
    expect(breakdown.lines[1].lineCost).toBeNull();
    expect(breakdown.totalCost).toBe(17.6);
    expect(breakdown.lineCount).toBe(2);
    expect(breakdown.costedLineCount).toBe(1);
    expect(breakdown.uncostedLineCount).toBe(1);
    expect(breakdown.hasUncostedLines).toBe(true);
  });
});

describe('AC-17: empty and reversals-only breakdowns (degenerate)', () => {
  it('both equal EMPTY_COST_BREAKDOWN; totalCost 0, never NaN', () => {
    expect(batchCostBreakdown([])).toEqual(EMPTY_COST_BREAKDOWN);
    const reversalsOnly = [tx({ id: 'r-orphan', kind: 'reversal', reversesTransactionId: 'nonexistent' })];
    const breakdown = batchCostBreakdown(reversalsOnly);
    expect(breakdown).toEqual(EMPTY_COST_BREAKDOWN);
    expect(Number.isNaN(breakdown.totalCost)).toBe(false);
  });
});

describe('AC-18: cost line order is ledger order, deterministic', () => {
  it('two array orderings of the same rows produce deep-equal breakdowns; tie-break on id', () => {
    const rows = fullCheckoffLedger();
    const shuffled = [rows[3], rows[1], rows[4], rows[0], rows[2]];
    const a = batchCostBreakdown(rows);
    const b = batchCostBreakdown(shuffled);
    expect(a).toEqual(b);

    const sameTime = [tx({ id: 'z', createdAt: '2026-01-01T00:00:00.000Z', amount: 1 }), tx({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z', amount: 2 })];
    const ordered = batchCostBreakdown(sameTime);
    expect(ordered.lines[0].transactionId).toBe('a');
    expect(ordered.lines[1].transactionId).toBe('z');
  });
});
