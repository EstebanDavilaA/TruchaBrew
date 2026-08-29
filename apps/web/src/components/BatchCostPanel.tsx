import { useEffect, useState } from 'react';
import type { InventoryUnit, BatchCostBreakdown } from '@truchabrew/shared-types';
import { formatMass, formatHopMass } from '@truchabrew/calculations';
import { getBatchCost, ApiClientError } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import { Receipt, AlertTriangle } from 'lucide-react';

export interface BatchCostPanelProps {
  batchId: string;
}

/** Same unit-appropriate M7 helper StockCheckPanel uses — never a second conversion path. */
function formatAmount(amount: number, unit: InventoryUnit, unitSystem: ReturnType<typeof useConfig>['config']['unitSystem']): string {
  if (unit === 'kg') return formatMass(amount, unitSystem);
  if (unit === 'g') return formatHopMass(amount, unitSystem);
  return `${amount} ${unit}`;
}

/**
 * Completed-stage cost breakdown (M9_P2 spec §2.3). Mounted by BatchDetail
 * ONLY when `batch.status === 'Completed'`. One GET per mount/batchId
 * change. Read-only; zero writes.
 */
export function BatchCostPanel({ batchId }: BatchCostPanelProps) {
  const { config } = useConfig();
  const [breakdown, setBreakdown] = useState<BatchCostBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBreakdown(null);
    setError(null);

    getBatchCost(batchId)
      .then((next) => {
        if (cancelled) return;
        setBreakdown(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load the cost breakdown.');
      });

    return () => {
      cancelled = true;
    };
  }, [batchId]);

  return (
    <div className="mt-8 bg-slate-900 shadow overflow-hidden sm:rounded-lg border border-slate-800 px-4 py-5 sm:px-6" data-testid="batch-cost-panel">
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="w-4 h-4 text-amber-500" />
        <h3 className="text-lg leading-6 font-medium text-slate-100">Cost</h3>
      </div>

      {error && (
        <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-rose-200" data-testid="batch-cost-error">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          {error}
        </div>
      )}

      {!error && breakdown === null && (
        <div className="text-center py-6 text-sm text-slate-400" data-testid="batch-cost-loading">
          Loading cost…
        </div>
      )}

      {!error && breakdown !== null && breakdown.lineCount === 0 && (
        <div className="text-center py-6 text-sm text-slate-400" data-testid="batch-cost-empty">
          No ingredients were checked off for this batch.
        </div>
      )}

      {!error && breakdown !== null && breakdown.lineCount > 0 && (
        <>
          <div className="divide-y divide-slate-800">
            {breakdown.lines.map((line) => (
              <div key={line.transactionId} data-testid={`batch-cost-line-${line.nameKey}`} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <div className="font-semibold text-slate-100">{line.displayName}</div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">{formatAmount(line.amount, line.unit, config.unitSystem)}</div>
                </div>
                <div className="text-slate-300 font-mono tabular-nums">{line.lineCost === null ? 'Not priced' : line.lineCost.toFixed(2)}</div>
              </div>
            ))}
          </div>

          {breakdown.hasUncostedLines && (
            <div className="mt-3 text-xs text-amber-400" data-testid="batch-cost-uncosted-note">
              {breakdown.uncostedLineCount} line{breakdown.uncostedLineCount === 1 ? '' : 's'} not priced.
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Total</span>
            <span className="text-lg font-bold text-slate-100 font-mono tabular-nums" data-testid="batch-cost-total">
              {breakdown.totalCost.toFixed(2)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
