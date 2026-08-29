// M9_P2 — the append-only deduction ledger, checkoff and cost pure logic.
// New module; see .gsd/active/M9_P2_feature_spec.md §2.1. No I/O, no
// randomness, no wall-clock reads. Every function is total and never throws.
import type {
  InventoryItem,
  InventoryTransaction,
  InventoryTransactionKind,
  InventoryStockView,
  StockEvaluation,
  StockCheckoffLine,
  BatchCheckoffState,
  BatchCostLine,
  BatchCostBreakdown,
  BatchStatus,
} from '@truchabrew/shared-types';

// ---------------------------------------------------------------------------
// Constants (spec §1.1) — all frozen.
// ---------------------------------------------------------------------------

export const LEDGER_KINDS: readonly InventoryTransactionKind[] = Object.freeze(['deduction', 'reversal']);

export const EMPTY_COST_BREAKDOWN: BatchCostBreakdown = Object.freeze({
  lines: [],
  lineCount: 0,
  costedLineCount: 0,
  uncostedLineCount: 0,
  hasUncostedLines: false,
  totalCost: 0,
});

export const EMPTY_CHECKOFF_STATE: BatchCheckoffState = Object.freeze({
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

// ---------------------------------------------------------------------------
// Ledger order (Resolved Ambiguity 1, binding). createdAt ascending, then id
// ascending as the tie-break. Applied by every function below that reduces
// the ledger to a set/sum, so the order is defined in exactly one place.
// ---------------------------------------------------------------------------

function compareLedgerOrder(a: InventoryTransaction, b: InventoryTransaction): number {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** True iff some row has kind 'reversal' AND reversesTransactionId === transactionId. */
export function isReversed(transactionId: string, ledger: readonly InventoryTransaction[]): boolean {
  return ledger.some((row) => row.kind === 'reversal' && row.reversesTransactionId === transactionId);
}

/**
 * Rows with kind 'deduction' and !isReversed(row.id, ledger), in LEDGER
 * ORDER. Returns a new array; never mutates `ledger`. [] for an empty ledger
 * and for a ledger of reversals only.
 */
export function openDeductions(ledger: readonly InventoryTransaction[]): InventoryTransaction[] {
  return ledger
    .filter((row) => row.kind === 'deduction' && !isReversed(row.id, ledger))
    .slice()
    .sort(compareLedgerOrder);
}

/**
 * LEFT FOLD with `+` over openDeductions(ledger).map(r => r.amount), seed 0.
 * The order and the seed are BINDING — float addition is not associative.
 * Returns exactly 0 (not -0, not NaN) for an empty input.
 */
export function sumOpenDeductions(ledger: readonly InventoryTransaction[]): number {
  return openDeductions(ledger).reduce((sum, row) => sum + row.amount, 0);
}

/**
 * One O(n) index over `ledger` keyed by inventoryItemId, built ONCE. Per
 * item: baseQuantity = item.quantity; deductedQuantity = sumOpenDeductions
 * for that item; openDeductionCount = that row count; quantity =
 * baseQuantity - deductedQuantity. Item order is PRESERVED. Ledger rows
 * referencing an unknown inventoryItemId are IGNORED. Never mutates either
 * argument.
 */
export function projectInventoryStock(
  items: readonly InventoryItem[],
  ledger: readonly InventoryTransaction[],
): InventoryStockView[] {
  const byItem = new Map<string, InventoryTransaction[]>();
  for (const row of ledger) {
    const list = byItem.get(row.inventoryItemId);
    if (list) {
      list.push(row);
    } else {
      byItem.set(row.inventoryItemId, [row]);
    }
  }

  return items.map((item) => {
    const rowsForItem = byItem.get(item.id) ?? [];
    const open = openDeductions(rowsForItem);
    const deductedQuantity = open.reduce((sum, row) => sum + row.amount, 0);
    const openDeductionCount = open.length;
    const quantity = deductedQuantity === 0 ? item.quantity : item.quantity - deductedQuantity;
    return {
      ...item,
      baseQuantity: item.quantity,
      deductedQuantity,
      openDeductionCount,
      quantity,
    };
  });
}

/**
 * `evaluation` is the OUTPUT of M9_P1's evaluateStock, computed against
 * ALREADY-PROJECTED inventory. This function adds only the six checkoff keys
 * and the four checkoff counters; it never recomputes a shortfall. Never
 * mutates `evaluation` or `ledger`.
 */
export function evaluateCheckoff(
  evaluation: StockEvaluation,
  ledger: readonly InventoryTransaction[],
  stage: BatchStatus,
): BatchCheckoffState {
  const editable = stage === 'Planning';

  if (evaluation.lines.length === 0) {
    return {
      lines: [],
      requirementCount: evaluation.requirementCount,
      matchedCount: evaluation.matchedCount,
      comparableCount: evaluation.comparableCount,
      unmatchedCount: evaluation.unmatchedCount,
      unitMismatchCount: evaluation.unitMismatchCount,
      shortfallCount: evaluation.shortfallCount,
      hasShortfall: evaluation.hasShortfall,
      checkableCount: evaluation.comparableCount,
      checkedCount: 0,
      allCheckedOff: false,
      stage,
      editable,
    };
  }

  // One O(1)-amortized index over the open deductions, keyed by
  // inventoryItemId — at most one open deduction per item per batch (route
  // enforces CHECKOFF_ALREADY_OPEN), so no tie-break is needed here.
  const openByItem = new Map<string, InventoryTransaction>();
  for (const row of openDeductions(ledger)) {
    openByItem.set(row.inventoryItemId, row);
  }

  let checkedCount = 0;
  const lines: StockCheckoffLine[] = evaluation.lines.map((line) => {
    const checkable = line.matched && !line.unitMismatch;
    if (!checkable) {
      return {
        ...line,
        checkable: false,
        checked: false,
        openTransactionId: null,
        checkedAmount: null,
        checkedCostPerUnit: null,
        checkedAt: null,
      };
    }

    const open = line.inventoryItemId !== null ? openByItem.get(line.inventoryItemId) : undefined;
    if (!open) {
      return {
        ...line,
        checkable: true,
        checked: false,
        openTransactionId: null,
        checkedAmount: null,
        checkedCostPerUnit: null,
        checkedAt: null,
      };
    }

    checkedCount++;
    return {
      ...line,
      checkable: true,
      checked: true,
      openTransactionId: open.id,
      checkedAmount: open.amount,
      checkedCostPerUnit: open.costPerUnit,
      checkedAt: open.createdAt,
    };
  });

  const checkableCount = evaluation.comparableCount;

  return {
    lines,
    requirementCount: evaluation.requirementCount,
    matchedCount: evaluation.matchedCount,
    comparableCount: evaluation.comparableCount,
    unmatchedCount: evaluation.unmatchedCount,
    unitMismatchCount: evaluation.unitMismatchCount,
    shortfallCount: evaluation.shortfallCount,
    hasShortfall: evaluation.hasShortfall,
    checkableCount,
    checkedCount,
    allCheckedOff: checkableCount > 0 && checkedCount === checkableCount,
    stage,
    editable,
  };
}

/**
 * `ledger` is ALREADY filtered to one batch by the caller. Lines are
 * openDeductions(ledger) mapped 1:1, in LEDGER ORDER. Reversal rows and
 * reversed deductions never appear. totalCost = LEFT FOLD with `+` over the
 * non-null lineCosts in that same order, seed 0. Deep-equal to
 * EMPTY_COST_BREAKDOWN for an empty input. Never mutates.
 */
export function batchCostBreakdown(ledger: readonly InventoryTransaction[]): BatchCostBreakdown {
  const open = openDeductions(ledger);
  if (open.length === 0) {
    return {
      lines: [],
      lineCount: 0,
      costedLineCount: 0,
      uncostedLineCount: 0,
      hasUncostedLines: false,
      totalCost: 0,
    };
  }

  const lines: BatchCostLine[] = open.map((row) => ({
    transactionId: row.id,
    category: row.category,
    displayName: row.displayName,
    nameKey: row.nameKey,
    amount: row.amount,
    unit: row.unit,
    costPerUnit: row.costPerUnit,
    lineCost: row.costPerUnit === null ? null : row.amount * row.costPerUnit,
  }));

  let totalCost = 0;
  let costedLineCount = 0;
  let uncostedLineCount = 0;
  for (const line of lines) {
    if (line.lineCost === null) {
      uncostedLineCount++;
    } else {
      costedLineCount++;
      totalCost += line.lineCost;
    }
  }

  return {
    lines,
    lineCount: lines.length,
    costedLineCount,
    uncostedLineCount,
    hasUncostedLines: uncostedLineCount > 0,
    totalCost,
  };
}
