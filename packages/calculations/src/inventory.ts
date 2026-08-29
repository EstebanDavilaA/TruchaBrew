// M9_P1 — Inventory: what's in stock, and what am I short of. New pure-logic
// module; see .gsd/active/M9_P1_feature_spec.md §2. No I/O, no randomness, no
// wall-clock reads. `Recipe` and `InventoryItem` are imported type-only from
// @truchabrew/shared-types (which imports nothing from @truchabrew/calculations,
// so no cycle is introduced).
import type {
  Recipe,
  InventoryItem,
  InventoryCategory,
  InventoryUnit,
  StockRequirement,
  StockLine,
  StockEvaluation,
} from '@truchabrew/shared-types';

// ---------------------------------------------------------------------------
// Constants (spec §1.1) — all frozen.
// ---------------------------------------------------------------------------

export const STOCK_EPSILON = 1e-6;

export const INVENTORY_CATEGORIES: readonly InventoryCategory[] = Object.freeze([
  'Fermentable',
  'Hop',
  'Yeast',
  'Misc',
]);

export const CANONICAL_INVENTORY_UNIT: Readonly<Record<'Fermentable' | 'Hop' | 'Yeast', InventoryUnit>> = Object.freeze({
  Fermentable: 'kg',
  Hop: 'g',
  Yeast: 'pkg',
});

export const MISC_INVENTORY_UNITS: readonly InventoryUnit[] = Object.freeze(['g', 'ml', 'tsp', 'tbsp', 'each']);

export const EMPTY_STOCK_EVALUATION: StockEvaluation = Object.freeze({
  lines: [],
  requirementCount: 0,
  matchedCount: 0,
  comparableCount: 0,
  unmatchedCount: 0,
  unitMismatchCount: 0,
  shortfallCount: 0,
  hasShortfall: false,
});

// ---------------------------------------------------------------------------
// Normalization (Resolved Ambiguity 1) — the ONE definition in the
// repository. Both the API (deriving the server-owned key on write) and the
// web layer must call this exact function; no parallel `.trim().toLowerCase()`
// anywhere else.
// ---------------------------------------------------------------------------

/**
 * trim leading/trailing whitespace -> collapse every run of one or more
 * Unicode whitespace characters to a single U+0020 space -> toLowerCase().
 * Nothing else — no punctuation stripping, no accent folding, no
 * parenthetical removal. Total; '' and '   ' both -> ''.
 */
export function normalizeInventoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ---------------------------------------------------------------------------
// Category-canonical unit enforcement (Resolved Ambiguity 4).
// ---------------------------------------------------------------------------

export function isValidInventoryUnit(category: InventoryCategory, unit: InventoryUnit): boolean {
  if (category === 'Fermentable') return unit === CANONICAL_INVENTORY_UNIT.Fermentable;
  if (category === 'Hop') return unit === CANONICAL_INVENTORY_UNIT.Hop;
  if (category === 'Yeast') return unit === CANONICAL_INVENTORY_UNIT.Yeast;
  return (MISC_INVENTORY_UNITS as readonly string[]).includes(unit);
}

// ---------------------------------------------------------------------------
// Stock thresholds (Resolved Ambiguity 2).
// ---------------------------------------------------------------------------

/** Inclusive: quantity <= STOCK_EPSILON. */
export function isOutOfStock(quantity: number): boolean {
  return quantity <= STOCK_EPSILON;
}

/** Exclusive: quantity < -STOCK_EPSILON. */
export function isNegativeStock(quantity: number): boolean {
  return quantity < -STOCK_EPSILON;
}

// ---------------------------------------------------------------------------
// Requirement aggregation (Resolved Ambiguity 5).
// ---------------------------------------------------------------------------

interface RequirementGroup {
  displayName: string;
  nameKey: string;
  unit: InventoryUnit;
  amount: number;
}

/**
 * Aggregates one category's line items by (nameKey[, unit for Misc only]) —
 * a Map preserves insertion order, which IS first-appearance order, so the
 * groups are emitted in that order with no explicit sort. Groups whose
 * summed amount is <= STOCK_EPSILON are omitted entirely (never emitted as a
 * zero/negative requirement).
 */
function buildGroups<T>(
  category: InventoryCategory,
  items: readonly T[],
  extract: (item: T) => { name: string; unit: InventoryUnit; amount: number },
): StockRequirement[] {
  const groups = new Map<string, RequirementGroup>();
  for (const item of items) {
    const { name, unit, amount } = extract(item);
    const nameKey = normalizeInventoryName(name);
    // Misc groups additionally key on unit — two Misc lines with the same
    // name but different units are NOT addable, so they are two groups.
    const key = category === 'Misc' ? `${nameKey}::${unit}` : nameKey;
    const existing = groups.get(key);
    if (existing) {
      existing.amount += amount;
    } else {
      groups.set(key, { displayName: name, nameKey, unit, amount });
    }
  }

  const result: StockRequirement[] = [];
  for (const group of groups.values()) {
    if (group.amount > STOCK_EPSILON) {
      result.push({
        category,
        displayName: group.displayName,
        nameKey: group.nameKey,
        unit: group.unit,
        requiredAmount: group.amount,
      });
    }
  }
  return result;
}

/**
 * Aggregates every requirement across all four categories, in category order
 * Fermentable -> Hop -> Yeast -> Misc, first-appearance order within each
 * category. Returns [] for a recipe with no line items. Never throws. Never
 * mutates `recipe`.
 */
export function requirementsFromRecipe(recipe: Recipe): StockRequirement[] {
  return [
    ...buildGroups('Fermentable', recipe.fermentables, (f) => ({ name: f.name, unit: CANONICAL_INVENTORY_UNIT.Fermentable, amount: f.amountKg })),
    ...buildGroups('Hop', recipe.hops, (h) => ({ name: h.name, unit: CANONICAL_INVENTORY_UNIT.Hop, amount: h.amountG })),
    ...buildGroups('Yeast', recipe.yeasts, (y) => ({ name: y.name, unit: CANONICAL_INVENTORY_UNIT.Yeast, amount: y.amountPkg })),
    ...buildGroups('Misc', recipe.miscs, (m) => ({ name: m.name, unit: m.unit, amount: m.amount })),
  ];
}

// ---------------------------------------------------------------------------
// Stock evaluation (Resolved Ambiguity 3).
// ---------------------------------------------------------------------------

function inventoryIndexKey(category: InventoryCategory, nameKey: string): string {
  return `${category}::${nameKey}`;
}

/**
 * One O(n) index over inventory keyed `${category}::${nameKey}` (the UNIQUE
 * index guarantees at most one row per key, so there is no tie-break branch).
 * Per requirement, applies the three-case table verbatim: no inventory row
 * (matched: false), a mismatched recorded unit (unitMismatch: true), or a
 * directly comparable row (a real shortfall/sufficient computation, epsilon-
 * clamped). Never mutates either argument.
 */
export function evaluateStock(
  requirements: readonly StockRequirement[],
  inventory: readonly InventoryItem[],
): StockEvaluation {
  if (requirements.length === 0) {
    return {
      lines: [],
      requirementCount: 0,
      matchedCount: 0,
      comparableCount: 0,
      unmatchedCount: 0,
      unitMismatchCount: 0,
      shortfallCount: 0,
      hasShortfall: false,
    };
  }

  const index = new Map<string, InventoryItem>();
  for (const item of inventory) {
    index.set(inventoryIndexKey(item.category, item.nameKey), item);
  }

  const lines: StockLine[] = requirements.map((req) => {
    const invItem = index.get(inventoryIndexKey(req.category, req.nameKey));

    if (!invItem) {
      return {
        ...req,
        matched: false,
        inventoryItemId: null,
        inventoryUnit: null,
        onHand: null,
        unitMismatch: false,
        shortfall: null,
        sufficient: null,
      };
    }

    if (invItem.unit !== req.unit) {
      return {
        ...req,
        matched: true,
        inventoryItemId: invItem.id,
        inventoryUnit: invItem.unit,
        onHand: invItem.quantity,
        unitMismatch: true,
        shortfall: null,
        sufficient: null,
      };
    }

    const rawShortfall = req.requiredAmount - invItem.quantity;
    // Epsilon clamp (Resolved Ambiguity 2): a shortfall (or surplus) smaller
    // in magnitude than STOCK_EPSILON is exactly 0, never a float-noise
    // residual and never a negative "surplus" value.
    const shortfall = rawShortfall <= STOCK_EPSILON ? 0 : rawShortfall;

    return {
      ...req,
      matched: true,
      inventoryItemId: invItem.id,
      inventoryUnit: invItem.unit,
      onHand: invItem.quantity,
      unitMismatch: false,
      shortfall,
      sufficient: shortfall === 0,
    };
  });

  let matchedCount = 0;
  let comparableCount = 0;
  let unmatchedCount = 0;
  let unitMismatchCount = 0;
  let shortfallCount = 0;

  for (const line of lines) {
    if (line.matched) {
      matchedCount++;
      if (line.unitMismatch) {
        unitMismatchCount++;
      } else {
        comparableCount++;
        if ((line.shortfall as number) > 0) shortfallCount++;
      }
    } else {
      unmatchedCount++;
    }
  }

  return {
    lines,
    requirementCount: requirements.length,
    matchedCount,
    comparableCount,
    unmatchedCount,
    unitMismatchCount,
    shortfallCount,
    hasShortfall: shortfallCount > 0,
  };
}
