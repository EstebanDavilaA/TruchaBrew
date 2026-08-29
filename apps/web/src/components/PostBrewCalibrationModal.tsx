import { useState } from 'react';
import type { CalibrationEvaluationResult } from '@truchabrew/calculations';
import type { EquipmentProfile, Recipe } from '@truchabrew/shared-types';
import { Sliders, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { SUBPANEL_CLASS } from './designSystem';
import { Modal } from './Modal';
import { Button, Table, TableHeaderCell, TableCell } from './ui';

export interface PostBrewCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  evaluation: CalibrationEvaluationResult;
  equipmentProfile: EquipmentProfile | null;
  recipe: Recipe;
  onUpdateEquipmentProfile: (profileId: string, patch: Partial<EquipmentProfile>) => Promise<void>;
  onUpdateRecipe: (recipeId: string, patch: Partial<Recipe>) => Promise<void>;
}

export function PostBrewCalibrationModal({
  isOpen,
  onClose,
  evaluation,
  equipmentProfile,
  recipe,
  onUpdateEquipmentProfile,
  onUpdateRecipe,
}: PostBrewCalibrationModalProps) {
  const [eqBusy, setEqBusy] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  const [eqSuccess, setEqSuccess] = useState(false);
  const [recSuccess, setRecSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApplyEquipmentCalibration = async () => {
    if (!equipmentProfile) return;
    setEqBusy(true);
    setError(null);
    try {
      const patch: Partial<EquipmentProfile> = {};
      if (evaluation.achievedBrewhouseEfficiencyPct !== null) {
        patch.brewhouseEfficiencyPct = evaluation.achievedBrewhouseEfficiencyPct;
      }
      if (evaluation.achievedMashEfficiencyPct !== null) {
        patch.mashEfficiencyPct = evaluation.achievedMashEfficiencyPct;
      }
      if (evaluation.achievedBoilOffRateLPerHour !== null) {
        patch.boilOffRateLPerHour = evaluation.achievedBoilOffRateLPerHour;
      }
      if (evaluation.achievedTrubLossL !== null) {
        patch.trubChillerLossL = evaluation.achievedTrubLossL;
      }

      await onUpdateEquipmentProfile(equipmentProfile.id, patch);
      setEqSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update equipment profile');
    } finally {
      setEqBusy(false);
    }
  };

  const handleApplyRecipeCalibration = async () => {
    setRecBusy(true);
    setError(null);
    try {
      const patch: Partial<Recipe> = {};
      if (evaluation.achievedBrewhouseEfficiencyPct !== null) {
        patch.equipment = {
          ...recipe.equipment,
          brewhouseEfficiencyPct: evaluation.achievedBrewhouseEfficiencyPct,
          mashEfficiencyPct: evaluation.achievedMashEfficiencyPct ?? recipe.equipment.mashEfficiencyPct,
        };
      }

      await onUpdateRecipe(recipe.id, patch);
      setRecSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update recipe target efficiency');
    } finally {
      setRecBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      titleId="calibration-modal-title"
      backdropClassName="overflow-y-auto bg-slate-950/80 backdrop-blur-sm"
      maxWidthClass="max-w-xl"
      containerClassName="relative p-6 text-slate-100 space-y-5"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-600/80 text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 id="calibration-modal-title" className="text-lg font-bold text-slate-100">
                Post-Brew Equipment &amp; Recipe Calibration
              </h3>
              <p className="text-xs text-slate-400">
                Update equipment profile losses and recipe target efficiency from real brew day results.
              </p>
            </div>
          </div>
          <Button
            variant="icon"
            type="button"
            data-testid="close-calibration-modal-btn"
            onClick={onClose}
            aria-label="Close calibration modal"
            title="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Comparison Table */}
        <div className={`${SUBPANEL_CLASS} !p-0 overflow-hidden`}>
          <Table>
            <thead className="bg-slate-950/90 border-b border-slate-800">
              <tr>
                <TableHeaderCell>Metric</TableHeaderCell>
                <TableHeaderCell>Target Profile</TableHeaderCell>
                <TableHeaderCell>Achieved Real</TableHeaderCell>
                <TableHeaderCell>Variance</TableHeaderCell>
              </tr>
            </thead>
            <tbody className="bg-slate-950/40">
              {/* Mash Efficiency */}
              <tr data-testid="row-mash-eff">
                <TableCell size="sm" variant="text" className="font-medium">Mash Efficiency %</TableCell>
                <TableCell size="sm">{evaluation.estimatedMashEfficiencyPct.toFixed(1)}%</TableCell>
                <TableCell size="sm" className="font-semibold" data-testid="achieved-mash-eff">
                  {evaluation.achievedMashEfficiencyPct !== null ? `${evaluation.achievedMashEfficiencyPct.toFixed(1)}%` : '—'}
                </TableCell>
                <TableCell size="sm">
                  {evaluation.achievedMashEfficiencyPct !== null ? (
                    <span
                      className={
                        evaluation.achievedMashEfficiencyPct >= evaluation.estimatedMashEfficiencyPct
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }
                    >
                      {evaluation.achievedMashEfficiencyPct >= evaluation.estimatedMashEfficiencyPct ? '+' : ''}
                      {(evaluation.achievedMashEfficiencyPct - evaluation.estimatedMashEfficiencyPct).toFixed(1)}%
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </tr>

              {/* Brewhouse Efficiency */}
              <tr data-testid="row-brewhouse-eff">
                <TableCell size="sm" variant="text" className="font-medium">Brewhouse Efficiency %</TableCell>
                <TableCell size="sm">{evaluation.estimatedBrewhouseEfficiencyPct.toFixed(1)}%</TableCell>
                <TableCell size="sm" className="font-semibold" data-testid="achieved-brewhouse-eff">
                  {evaluation.achievedBrewhouseEfficiencyPct !== null ? `${evaluation.achievedBrewhouseEfficiencyPct.toFixed(1)}%` : '—'}
                </TableCell>
                <TableCell size="sm">
                  {evaluation.achievedBrewhouseEfficiencyPct !== null ? (
                    <span
                      className={
                        evaluation.achievedBrewhouseEfficiencyPct >= evaluation.estimatedBrewhouseEfficiencyPct
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }
                    >
                      {evaluation.achievedBrewhouseEfficiencyPct >= evaluation.estimatedBrewhouseEfficiencyPct ? '+' : ''}
                      {(evaluation.achievedBrewhouseEfficiencyPct - evaluation.estimatedBrewhouseEfficiencyPct).toFixed(1)}%
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </tr>

              {/* Boil-off Rate */}
              <tr data-testid="row-boil-off">
                <TableCell size="sm" variant="text" className="font-medium">Boil-off Rate (L/hr)</TableCell>
                <TableCell size="sm">{evaluation.currentBoilOffRateLPerHour.toFixed(2)} L/hr</TableCell>
                <TableCell size="sm" className="font-semibold" data-testid="achieved-boil-off">
                  {evaluation.achievedBoilOffRateLPerHour !== null ? `${evaluation.achievedBoilOffRateLPerHour.toFixed(2)} L/hr` : '—'}
                </TableCell>
                <TableCell size="sm">
                  {evaluation.achievedBoilOffRateLPerHour !== null ? (
                    <span
                      className={
                        evaluation.achievedBoilOffRateLPerHour >= evaluation.currentBoilOffRateLPerHour
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }
                    >
                      {evaluation.achievedBoilOffRateLPerHour >= evaluation.currentBoilOffRateLPerHour ? '+' : ''}
                      {(evaluation.achievedBoilOffRateLPerHour - evaluation.currentBoilOffRateLPerHour).toFixed(2)} L/hr
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </tr>

              {/* Trub / Chiller Loss */}
              <tr data-testid="row-trub-loss">
                <TableCell size="sm" variant="text" className="font-medium">Kettle Trub Loss (L)</TableCell>
                <TableCell size="sm">{evaluation.currentTrubLossL.toFixed(2)} L</TableCell>
                <TableCell size="sm" className="font-semibold" data-testid="achieved-trub-loss">
                  {evaluation.achievedTrubLossL !== null ? `${evaluation.achievedTrubLossL.toFixed(2)} L` : '—'}
                </TableCell>
                <TableCell size="sm">
                  {evaluation.achievedTrubLossL !== null ? (
                    <span
                      className={
                        evaluation.achievedTrubLossL >= evaluation.currentTrubLossL ? 'text-amber-400' : 'text-emerald-400'
                      }
                    >
                      {evaluation.achievedTrubLossL >= evaluation.currentTrubLossL ? '+' : ''}
                      {(evaluation.achievedTrubLossL - evaluation.currentTrubLossL).toFixed(2)} L
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </tr>
            </tbody>
          </Table>
        </div>

        {/* Action Controls */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {equipmentProfile
                ? `Parent Equipment: ${equipmentProfile.name}`
                : 'No linked equipment profile.'}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                data-testid="calibrate-recipe-btn"
                disabled={recBusy || !evaluation.canCalibrate}
                onClick={handleApplyRecipeCalibration}
                className="flex items-center gap-1.5"
              >
                {recSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Recipe Target Updated!
                  </>
                ) : recBusy ? (
                  'Updating Recipe…'
                ) : (
                  'Update Recipe Target'
                )}
              </Button>

              <Button
                variant="primary"
                size="sm"
                type="button"
                data-testid="calibrate-equipment-btn"
                disabled={eqBusy || !equipmentProfile || !evaluation.canCalibrate}
                onClick={handleApplyEquipmentCalibration}
                className="flex items-center gap-1.5"
              >
                {eqSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Equipment Profile Calibrated!
                  </>
                ) : eqBusy ? (
                  'Calibrating Profile…'
                ) : (
                  'Update Equipment Profile'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
