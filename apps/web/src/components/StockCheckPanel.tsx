import { useEffect, useState } from 'react';
import type { InventoryUnit, StockLine, StockCheckoffLine, BatchCheckoffState, UnitSystem } from '@truchabrew/shared-types';
import { formatMass, formatHopMass } from '@truchabrew/calculations';
import { getBatchCheckoff, checkoffInventoryItem, reverseInventoryCheckoff, ApiClientError } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import { PackageSearch, PackageCheck, AlertTriangle, CheckCircle2, Undo2 } from 'lucide-react';
import { Button, Table, TableHeaderCell, TableCell } from './ui';



export interface StockCheckPanelProps {
  batchId: string;
  /** Renders an "Adjust Batch Recipe" trigger in the panel header when provided (Planning-stage only). */
  onAdjustRecipe?: () => void;
}

/**
 * `unit`-appropriate M7 display helper (§2.3 point 6) — mass in kg via
 * formatMass, hop mass in g via formatHopMass. `pkg` and the Misc units have
 * no M7 helper and render as a plain number with the unit appended. Never
 * performs its own unit conversion.
 */
function formatAmount(amount: number, unit: InventoryUnit, unitSystem: UnitSystem): string {
  if (unit === 'kg') return formatMass(amount, unitSystem);
  if (unit === 'g') return formatHopMass(amount, unitSystem);
  return `${amount} ${unit}`;
}

/**
 * Branches in this exact order (§2.3 point 4, binding): !matched -> "Not
 * tracked"; unitMismatch -> "Unit mismatch — on hand in X, recipe calls for
 * Y"; shortfall > 0 -> "Short N unit"; else -> "In stock". A caller must
 * never read `shortfall`/`sufficient` before checking `matched`/`unitMismatch`
 * (Resolved Ambiguity 3's binding caller rule) — this function is that check.
 */
function statusTextFor(line: StockLine, unitSystem: UnitSystem): string {
  if (!line.matched) return 'Not tracked';
  if (line.unitMismatch) return `Unit mismatch — on hand in ${line.inventoryUnit}, recipe calls for ${line.unit}`;
  if ((line.shortfall as number) > 0) return `Short ${formatAmount(line.shortfall as number, line.unit, unitSystem)}`;
  return 'In stock';
}

/**
 * Read-write Planning-stage panel (M9_P2 spec §2.3). Mounted by BatchDetail
 * ONLY when `batch.status === 'Planning'` — that gate lives in BatchDetail,
 * not here. Issues exactly one GET per mount/batchId change, never polls.
 * Toggling a checkbox issues exactly one POST (checkoff or reverse), and the
 * response — a full BatchCheckoffState — replaces the panel's state wholesale
 * in a single setState. The panel never locally recomputes an on-hand, a
 * shortfall, or a checked flag (§2.3 point 4, the lockstep contract).
 */
export function StockCheckPanel({ batchId, onAdjustRecipe }: StockCheckPanelProps) {
  const { config } = useConfig();
  const [state, setState] = useState<BatchCheckoffState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  // NEW in M15_P1 — the "Deduct All from Inventory" bulk action (spec §2.1
  // point 1). Separate busy/error state from the per-item toggle above so a
  // bulk-in-flight run and a single toggle never race each other; both
  // disable the same checkboxes while either is in flight (`toggling ||
  // bulkBusy` below).
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setError(null);
    setToggleError(null);

    getBatchCheckoff(batchId)
      .then((next) => {
        if (cancelled) return;
        setState(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load the stock check.');
      });

    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const handleToggle = async (line: StockCheckoffLine) => {
    if (toggling || bulkBusy) return;
    setToggling(true);
    setToggleError(null);
    try {
      const next = line.checked
        ? await reverseInventoryCheckoff(batchId, { inventoryItemId: line.inventoryItemId as string })
        : await checkoffInventoryItem(batchId, { inventoryItemId: line.inventoryItemId as string });
      setState(next);
    } catch (err) {
      setToggleError(err instanceof ApiClientError ? err.message : 'Failed to update checkoff.');
    } finally {
      setToggling(false);
    }
  };

  /**
   * "Deduct All from Inventory" (spec §2.1 point 1 / AC-2). Issues one
   * `checkoffInventoryItem` POST per unchecked checkable line, SEQUENTIALLY —
   * each response is the authoritative `BatchCheckoffState` and replaces
   * local state wholesale (same lockstep contract as a single toggle above),
   * so a later item's request is always built against the freshest ledger.
   * Stops at the first failure, surfacing which item failed; items already
   * deducted before the failure remain deducted (no rollback — matches the
   * per-item toggle's own all-or-nothing-per-request semantics, just applied
   * across a batch of requests instead of one).
   */
  const handleDeductAll = async () => {
    if (toggling || bulkBusy || state === null) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      const pending = state.lines.filter((line) => line.checkable && !line.checked);
      for (const line of pending) {
        try {
          const next = await checkoffInventoryItem(batchId, { inventoryItemId: line.inventoryItemId as string });
          setState(next);
        } catch (err) {
          const message = err instanceof ApiClientError ? err.message : 'Failed to deduct from inventory.';
          setBulkError(`Stopped at "${line.displayName}": ${message}`);
          return;
        }
      }
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="mt-8 bg-slate-900 shadow overflow-hidden sm:rounded-lg border border-slate-800 px-4 py-5 sm:px-6" data-testid="stock-check-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <PackageSearch className="w-4 h-4 text-amber-500" />
          <h3 className="text-lg leading-6 font-medium text-slate-100">Stock Check</h3>
        </div>
        {onAdjustRecipe && (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            data-testid="batch-adjust-recipe-btn"
            onClick={onAdjustRecipe}
          >
            Adjust Batch Recipe
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-rose-200" data-testid="stock-check-error">
          {error}
        </div>
      )}

      {!error && state === null && (
        <div className="text-center py-6 text-sm text-slate-400" data-testid="stock-check-loading">
          Loading stock check…
        </div>
      )}

      {!error && state !== null && state.requirementCount === 0 && (
        <div className="text-center py-6 text-sm text-slate-400" data-testid="stock-check-empty">
          This batch's recipe has no trackable ingredients.
        </div>
      )}

      {!error && state !== null && state.requirementCount > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="text-sm text-slate-300" data-testid="stock-check-header">
              {state.shortfallCount} of {state.requirementCount} ingredients short
            </div>
            {state.editable && state.checkableCount > 0 && (
              <Button
                variant="primary"
                size="sm"
                type="button"
                data-testid="stock-check-deduct-all-btn"
                disabled={toggling || bulkBusy || state.checkedCount >= state.checkableCount}
                onClick={handleDeductAll}
              >
                <PackageCheck className="w-3.5 h-3.5" />
                {bulkBusy ? 'Deducting…' : 'Deduct All from Inventory'}
              </Button>
            )}
          </div>

          {bulkError && (
            <div className="mb-3 bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-rose-200" data-testid="stock-check-bulk-error">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              {bulkError}
            </div>
          )}
          {toggleError && (
            <div className="mb-3 bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-rose-200" data-testid="stock-check-toggle-error">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              {toggleError}
            </div>
          )}

          {/* M19_P1 spec §1.3/AC-10 — itemized checkoff table. Column headers:
              Item, Recipe, Stock Status, Action. Replaces the prior checkbox
              toggle with a right-aligned per-row Deduct/Undo button (AC-11,
              AC-12); an unmatched/mismatched row renders a disabled
              indicator carrying the same informative status text as before
              (§1.3 bullet 3). */}
          <Table data-testid="stock-check-table">
              <thead>
                <tr className="border-b border-slate-800">
                  <TableHeaderCell>Item</TableHeaderCell>
                  <TableHeaderCell>Recipe</TableHeaderCell>
                  <TableHeaderCell>Stock Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Action</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {state.lines.map((line) => {
                  const requiredText = formatAmount(line.requiredAmount, line.unit, config.unitSystem);
                  const onHandText =
                    line.matched && !line.unitMismatch && line.onHand !== null
                      ? formatAmount(line.onHand, line.inventoryUnit as InventoryUnit, config.unitSystem)
                      : null;
                  const rowDisabled = !state.editable || toggling || bulkBusy;
                  return (
                    <tr key={`${line.category}::${line.nameKey}`} data-testid={`stock-check-line-${line.nameKey}`}>
                      <TableCell variant="text" className="align-top">
                        <div className="font-semibold text-slate-100">{line.displayName}</div>
                      </TableCell>
                      <TableCell variant="text" className="align-top">{requiredText}</TableCell>
                      <TableCell variant="text" className="align-top">
                        <div>{statusTextFor(line, config.unitSystem)}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {onHandText !== null && <>On hand: {onHandText}</>}
                          {line.checked && line.checkedAmount !== null && (
                            <> · Deducted: {formatAmount(line.checkedAmount, line.unit, config.unitSystem)}</>
                          )}
                        </div>
                      </TableCell>
                      <TableCell variant="text" className="align-top text-right">
                        {line.checked ? (
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400"
                              data-testid={`stock-check-checked-badge-${line.nameKey}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Deducted
                            </span>
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              disabled={rowDisabled}
                              onClick={() => handleToggle(line)}
                              data-testid={`stock-check-undo-${line.nameKey}`}
                            >
                              <Undo2 className="w-3.5 h-3.5" /> Undo
                            </Button>
                          </div>
                        ) : line.checkable ? (
                          <Button
                            variant="primary"
                            size="sm"
                            type="button"
                            disabled={rowDisabled}
                            onClick={() => handleToggle(line)}
                            data-testid={`stock-check-deduct-${line.nameKey}`}
                          >
                            <PackageCheck className="w-3.5 h-3.5" /> Deduct
                          </Button>
                        ) : (
                          <span
                            className="inline-block text-xs text-slate-400 italic"
                            data-testid={`stock-check-disabled-${line.nameKey}`}
                            title={statusTextFor(line, config.unitSystem)}
                          >
                            Unavailable
                          </span>
                        )}
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
          </Table>
        </>
      )}
    </div>
  );
}
