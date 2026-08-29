import type { ClosingSnapshot } from '@truchabrew/shared-types';
import { nutritionFromClosingSnapshot, NUTRITION_SERVING_ML } from '@truchabrew/calculations';
import { Flame } from 'lucide-react';

export interface BatchNutritionPanelProps {
  closingSnapshot: ClosingSnapshot | null;
}

/**
 * Completed-stage nutrition panel (M9_P2 spec §2.3). Mounted by BatchDetail
 * ONLY when `batch.status === 'Completed'`. Issues NO request — everything it
 * needs is already on the batch object BatchDetail has loaded. `abwPct`
 * renders with its sign preserved; nothing is clamped.
 */
export function BatchNutritionPanel({ closingSnapshot }: BatchNutritionPanelProps) {
  const nutrition = nutritionFromClosingSnapshot(closingSnapshot);

  return (
    <div className="mt-8 bg-slate-900 shadow overflow-hidden sm:rounded-lg border border-slate-800 px-4 py-5 sm:px-6" data-testid="batch-nutrition-panel">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-amber-500" />
        <h3 className="text-lg leading-6 font-medium text-slate-100">Nutrition</h3>
      </div>

      {nutrition === null ? (
        <div className="text-center py-6 text-sm text-slate-400" data-testid="batch-nutrition-unavailable">
          No closing snapshot recorded for this batch — nutrition is unavailable.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums" data-testid="batch-nutrition-calories">
                {nutrition.caloriesPerServing.toFixed(0)}
              </div>
              <div className="text-xs text-slate-400">kcal / {NUTRITION_SERVING_ML} mL</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100 font-mono tabular-nums" data-testid="batch-nutrition-carbs">
                {nutrition.carbsGPerServing.toFixed(1)} g
              </div>
              <div className="text-xs text-slate-400">carbs</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100 font-mono tabular-nums" data-testid="batch-nutrition-alcohol">
                {nutrition.alcoholGPerServing.toFixed(1)} g
              </div>
              <div className="text-xs text-slate-400">alcohol</div>
            </div>
          </div>
          <div className="text-xs text-slate-400 text-center font-mono tabular-nums" data-testid="batch-nutrition-per-100ml">
            {nutrition.caloriesPer100Ml.toFixed(0)} kcal / {nutrition.carbsGPer100Ml.toFixed(1)} g carbs per 100 mL
          </div>
          <div className="text-xs text-slate-400 text-center font-mono tabular-nums" data-testid="batch-nutrition-abw">
            ABW: {nutrition.abwPct.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}
