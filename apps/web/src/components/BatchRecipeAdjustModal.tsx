import { useEffect, useMemo, useState } from 'react';
import type { BatchWithReadings, Recipe } from '@truchabrew/shared-types';
import { calculateRecipeStats, scaleRecipe, deriveScaledEquipment, canScale } from '@truchabrew/calculations';
import { useConfig } from '../context/ConfigContext';
import { updateBatchRecipeSnapshot, ApiClientError } from '../api/client';
import { FermentableSection } from './FermentableSection';
import { HopSection } from './HopSection';
import { YeastSection } from './YeastSection';
import { X, Loader2, Sliders, Scale } from 'lucide-react';
import { Modal } from './Modal';
import {
  METRIC_TILE_CLASS,
  METRIC_LABEL_CLASS,
  METRIC_VALUE_CLASS,
  MONO_VALUE_CLASS,
  SUBPANEL_CLASS,
} from './designSystem';
import { Button, NumberInput } from './ui';

export interface BatchRecipeAdjustModalProps {
  open: boolean;
  batch: BatchWithReadings;
  onClose: () => void;
  /** Fired after a successful save with the server's authoritative BatchWithReadings. */
  onSaved: (updated: BatchWithReadings) => void;
}

/**
 * "Adjust Batch Recipe" modal (M15_P1 spec §1.2 / AC-4/AC-5/AC-6). Edits a
 * LOCAL working copy of `batch.recipeSnapshot`, recalculates target vitals
 * live from that local copy via `calculateRecipeStats` (the same function
 * BatchDetail already uses), and on Save PUTs the whole snapshot via
 * `updateBatchRecipeSnapshot`. Reuses FermentableSection/HopSection/
 * YeastSection — the same substitution UI already used to edit a master
 * recipe — for "substitute ingredients directly on the batch" (spec §1.2)
 * rather than a second bespoke editor.
 */
export function BatchRecipeAdjustModal({ open, batch, onClose, onSaved }: BatchRecipeAdjustModalProps) {
  const { config } = useConfig();
  const [localRecipe, setLocalRecipe] = useState<Recipe>(batch.recipeSnapshot);
  const [syncToMasterRecipe, setSyncToMasterRecipe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scaling state
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [targetScaleL, setTargetScaleL] = useState(batch.recipeSnapshot.equipment.batchSizeL);
  const [scaleError, setScaleError] = useState<string | null>(null);

  // Re-seed the working copy from the batch's CURRENT recipeSnapshot every
  // time the modal opens — never carries a previous open's edits forward,
  // and never mutates batch.recipeSnapshot itself until Save succeeds.
  useEffect(() => {
    if (open) {
      setLocalRecipe(batch.recipeSnapshot);
      setSyncToMasterRecipe(false);
      setError(null);
      setShowScaleModal(false);
      setTargetScaleL(batch.recipeSnapshot.equipment.batchSizeL);
      setScaleError(null);
    }
  }, [open, batch.recipeSnapshot]);

  const liveStats = useMemo(
    () => calculateRecipeStats(localRecipe, { abvFormula: config.abvFormula, ibuFormula: config.ibuFormula }),
    [localRecipe, config.abvFormula, config.ibuFormula],
  );

  const openScaleModal = () => {
    setTargetScaleL(localRecipe.equipment.batchSizeL);
    setScaleError(null);
    setShowScaleModal(true);
  };

  const handleApplyScale = () => {
    const currentBatchSizeL = localRecipe.equipment.batchSizeL;
    if (!canScale(currentBatchSizeL, targetScaleL)) {
      setShowScaleModal(false);
      return;
    }

    try {
      const derivedEquipment = deriveScaledEquipment(localRecipe.equipment, targetScaleL, localRecipe.equipment.id);
      const scaled = scaleRecipe(localRecipe, targetScaleL, derivedEquipment);
      setLocalRecipe(scaled);
      setShowScaleModal(false);
    } catch (err) {
      setScaleError(err instanceof Error ? err.message : 'Failed to scale recipe.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBatchRecipeSnapshot(batch.id, localRecipe, syncToMasterRecipe);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to save the adjusted recipe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        busy={saving}
        backdropClassName="px-4 py-8"
        maxWidthClass="max-w-5xl"
        containerClassName="bg-slate-950 max-h-[90vh] flex flex-col overflow-hidden rounded-2xl"
      >
        <div data-testid="batch-recipe-adjust-modal" className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 id="batch-recipe-adjust-modal-title" className="text-lg font-bold text-white">
                  Adjust Batch Recipe
                </h2>
                <p className="text-xs text-slate-400">
                  Substitute ingredients for this batch only — the master recipe in your library is untouched unless you opt in below.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                data-testid="batch-recipe-scale-btn"
                onClick={openScaleModal}
                disabled={saving}
                className="flex items-center gap-1.5"
              >
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span>Scale Recipe</span>
              </Button>

              <Button
                variant="icon"
                type="button"
                data-testid="batch-recipe-adjust-close-btn"
                onClick={onClose}
                disabled={saving}
                aria-label="Close"
                title="Close"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {error && (
              <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 text-sm text-rose-200" data-testid="batch-recipe-adjust-error">
                {error}
              </div>
            )}

            {/* Live vitals — recalculated from localRecipe on every edit (AC-5). */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="batch-recipe-adjust-live-vitals">
              <div className={METRIC_TILE_CLASS}>
                <div className={METRIC_LABEL_CLASS}>OG</div>
                <div className={`${METRIC_VALUE_CLASS} ${MONO_VALUE_CLASS} text-slate-100`} data-testid="live-vitals-og">{liveStats.og.toFixed(3)}</div>
              </div>
              <div className={METRIC_TILE_CLASS}>
                <div className={METRIC_LABEL_CLASS}>FG</div>
                <div className={`${METRIC_VALUE_CLASS} ${MONO_VALUE_CLASS} text-slate-100`} data-testid="live-vitals-fg">{liveStats.fg.toFixed(3)}</div>
              </div>
              <div className={METRIC_TILE_CLASS}>
                <div className={METRIC_LABEL_CLASS}>ABV</div>
                <div className={`${METRIC_VALUE_CLASS} ${MONO_VALUE_CLASS} text-amber-400`} data-testid="live-vitals-abv">{liveStats.abv.toFixed(1)}%</div>
              </div>
              <div className={METRIC_TILE_CLASS}>
                <div className={METRIC_LABEL_CLASS}>IBU</div>
                <div className={`${METRIC_VALUE_CLASS} ${MONO_VALUE_CLASS} text-slate-100`} data-testid="live-vitals-ibu">{liveStats.ibu}</div>
              </div>
              <div className={METRIC_TILE_CLASS}>
                <div className={METRIC_LABEL_CLASS}>SRM</div>
                <div className={`${METRIC_VALUE_CLASS} ${MONO_VALUE_CLASS} text-slate-100`} data-testid="live-vitals-srm">{liveStats.srm.toFixed(1)}</div>
              </div>
              <div className={METRIC_TILE_CLASS}>
                <div className={METRIC_LABEL_CLASS}>Strike Water</div>
                <div className={`${METRIC_VALUE_CLASS} ${MONO_VALUE_CLASS} text-slate-100`} data-testid="live-vitals-mash-water">{liveStats.mashWaterL.toFixed(1)} L</div>
              </div>
              <div className={METRIC_TILE_CLASS}>
                <div className={METRIC_LABEL_CLASS}>Sparge Water</div>
                <div className={`${METRIC_VALUE_CLASS} ${MONO_VALUE_CLASS} text-slate-100`} data-testid="live-vitals-sparge-water">{liveStats.spargeWaterL.toFixed(1)} L</div>
              </div>
              <div className={METRIC_TILE_CLASS}>
                <div className={METRIC_LABEL_CLASS}>Total Water</div>
                <div className={`${METRIC_VALUE_CLASS} ${MONO_VALUE_CLASS} text-slate-100`} data-testid="live-vitals-total-water">{liveStats.totalWaterL.toFixed(1)} L</div>
              </div>
            </div>

            <FermentableSection
              fermentables={localRecipe.fermentables}
              totalGrainKg={liveStats.totalGrainKg}
              onUpdate={(fermentables) => setLocalRecipe({ ...localRecipe, fermentables })}
            />

            <HopSection
              hops={localRecipe.hops}
              wortGravity={liveStats.og}
              batchSizeL={localRecipe.equipment.batchSizeL}
              hopUtilizationPct={localRecipe.equipment.hopUtilizationPct}
              hopstandUtilizationFactor={localRecipe.equipment.hopstandUtilizationFactor}
              hopstandTemperatureC={localRecipe.equipment.hopstandTemperatureC}
              altitudeMeters={localRecipe.equipment.altitudeMeters}
              totalHopG={liveStats.totalHopG}
              totalIbu={liveStats.ibu}
              onUpdate={(hops) => setLocalRecipe({ ...localRecipe, hops })}
            />

            <YeastSection yeasts={localRecipe.yeasts} onUpdate={(yeasts) => setLocalRecipe({ ...localRecipe, yeasts })} />

            <div className={`${SUBPANEL_CLASS} flex items-center gap-2`}>
              <input
                type="checkbox"
                id="sync-to-master-recipe"
                data-testid="batch-recipe-adjust-sync-checkbox"
                checked={syncToMasterRecipe}
                onChange={(e) => setSyncToMasterRecipe(e.target.checked)}
                disabled={saving}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
              <label htmlFor="sync-to-master-recipe" className="text-sm text-slate-300 cursor-pointer">
                Also update the master recipe (&ldquo;{localRecipe.name}&rdquo;) in the recipe library with these changes.
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 pt-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              data-testid="batch-recipe-adjust-cancel-btn"
              onClick={onClose}
              disabled={saving}
              className="px-4"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              data-testid="batch-recipe-adjust-save-btn"
              onClick={handleSave}
              disabled={saving}
              className="px-5 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Adjustments
            </Button>
          </div>
        </div>
      </Modal>

      {/* In-Batch Scale Modal */}
      <Modal
        isOpen={showScaleModal}
        onClose={() => setShowScaleModal(false)}
        maxWidthClass="max-w-md"
        containerClassName="p-6"
      >
        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-500" /> Scale Batch Recipe Volume
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Enter a new target batch size for this batch. All ingredient amounts are rescaled proportionally to preserve gravity, IBU, and color targets.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Current Batch Size: <strong className={`text-amber-400 ${MONO_VALUE_CLASS}`}>{localRecipe.equipment.batchSizeL} L</strong>
          </label>
          <label className="block text-xs font-medium text-slate-300 mt-2 mb-1">
            Target Batch Size (L)
          </label>
          <NumberInput
            type="number"
            aria-label="Target batch size in liters"
            step="1"
            min="1"
            value={targetScaleL}
            onChange={(e) => setTargetScaleL(parseFloat(e.target.value) || 1)}
            width="full"
            addonRight="Liters"
          />
        </div>

        {scaleError && <div className="text-xs text-rose-400 mb-3">{scaleError}</div>}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            data-testid="batch-scale-cancel-btn"
            onClick={() => setShowScaleModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            data-testid="batch-scale-apply-btn"
            onClick={handleApplyScale}
          >
            Scale Batch
          </Button>
        </div>
      </Modal>
    </>
  );
}


