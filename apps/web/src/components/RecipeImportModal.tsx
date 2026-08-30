import React, { useState, useMemo } from 'react';
import type { RecipeWriteInput, EquipmentProfile, Recipe } from '@truchabrew/shared-types';
import { calculateRecipeStats } from '@truchabrew/calculations';
import { X, FileDown, AlertCircle, CheckCircle2, Copy, RefreshCw } from 'lucide-react';
import { createRecipe, updateRecipe } from '../api/client';
import { Modal } from './Modal';
import { Button, Select, Badge } from './ui';

export interface RecipeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedRecipes: RecipeWriteInput[];
  existingRecipes: Array<{ id: string; name: string }>;
  equipmentProfiles: Array<{ id: string; name: string; batchSizeL: number }>;
  defaultEquipmentId: string;
  onImportComplete: (importedCount: number) => void;
}

type DuplicateStrategy = 'skip' | 'overwrite' | 'copy';

export const RecipeImportModal: React.FC<RecipeImportModalProps> = ({
  isOpen,
  onClose,
  parsedRecipes,
  existingRecipes,
  equipmentProfiles,
  defaultEquipmentId,
  onImportComplete,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set(parsedRecipes.map((_, i) => i)));
  const [targetEquipmentId, setTargetEquipmentId] = useState<string>(defaultEquipmentId);
  const [duplicateStrategies, setDuplicateStrategies] = useState<Record<number, DuplicateStrategy>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const safeEquipmentProfiles = useMemo(() => (Array.isArray(equipmentProfiles) ? equipmentProfiles : []), [equipmentProfiles]);
  const safeExistingRecipes = useMemo(() => (Array.isArray(existingRecipes) ? existingRecipes : []), [existingRecipes]);
  const safeParsedRecipes = useMemo(() => (Array.isArray(parsedRecipes) ? parsedRecipes : []), [parsedRecipes]);

  // Sync selection when recipes change
  React.useEffect(() => {
    setSelectedIndices(new Set(safeParsedRecipes.map((_, i) => i)));
    setDuplicateStrategies({});
    setSubmitError(null);
  }, [safeParsedRecipes]);

  const selectedEquipment = useMemo(() => {
    return safeEquipmentProfiles.find((e) => e.id === targetEquipmentId) ?? safeEquipmentProfiles[0];
  }, [safeEquipmentProfiles, targetEquipmentId]);

  const activeEquipmentProfile: EquipmentProfile = useMemo(() => {
    return {
      id: selectedEquipment?.id ?? 'default-eq',
      name: selectedEquipment?.name ?? 'Default Equipment',
      batchSizeL: selectedEquipment?.batchSizeL ?? 20.0,
      boilTimeMin: 60,
      brewhouseEfficiencyPct: 75.0,
      mashEfficiencyPct: 82.0,
      boilOffRateLPerHour: 3.0,
      trubChillerLossL: 2.0,
      hopUtilizationPct: 100,
      derivedFromEquipmentId: null,
      mashWaterRatioLPerKg: 3.0,
      grainAbsorptionLPerKg: 0.96,
      hopstandUtilizationFactor: 0.5,
      hopstandTemperatureC: 85,
      spargeTemperatureC: 76,
      mashTunHeatCapacityL: 0,
      grainTemperatureC: 20,
      notes: '',
    };
  }, [selectedEquipment]);

  // Recipe Vitals Preview Computation
  const previewData = useMemo(() => {
    return safeParsedRecipes.map((recipe, index) => {
      const virtualRecipe: Recipe = {
        id: `preview-recipe-${index}`,
        name: recipe.name,
        author: recipe.author,
        styleName: recipe.styleName,
        notes: recipe.notes ?? '',
        equipment: activeEquipmentProfile,
        mashProfile: null,
        fermentationProfile: null,
        waterSourceId: null,
        waterTargetId: null,
        fermentables: (recipe.fermentables ?? []).map((f, fi) => ({ ...f, id: `f-${fi}` })),
        hops: (recipe.hops ?? []).map((h, hi) => ({ ...h, id: `h-${hi}` })),
        yeasts: (recipe.yeasts ?? []).map((y, yi) => ({ ...y, id: `y-${yi}` })),
        miscs: (recipe.miscs ?? []).map((m, mi) => ({ ...m, id: `m-${mi}` })),
      };

      const stats = calculateRecipeStats(virtualRecipe);

      const existingMatch = safeExistingRecipes.find(
        (r) => r.name.trim().toLowerCase() === recipe.name.trim().toLowerCase()
      );

      const isDuplicate = !!existingMatch;
      const strategy = duplicateStrategies[index] ?? (isDuplicate ? 'copy' : 'copy');

      return {
        recipe,
        index,
        og: stats.og,
        fg: stats.fg,
        abv: stats.abv,
        ibu: stats.ibu,
        srm: stats.srm,
        existingMatch,
        isDuplicate,
        strategy,
      };
    });
  }, [safeParsedRecipes, activeEquipmentProfile, safeExistingRecipes, duplicateStrategies]);

  const handleToggleSelect = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const handleToggleAll = () => {
    if (selectedIndices.size === parsedRecipes.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(parsedRecipes.map((_, i) => i)));
    }
  };

  const handleStrategyChange = (index: number, strategy: DuplicateStrategy) => {
    setDuplicateStrategies((prev) => ({
      ...prev,
      [index]: strategy,
    }));
  };

  const handleImport = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let importedCount = 0;

      for (let i = 0; i < parsedRecipes.length; i++) {
        if (!selectedIndices.has(i)) continue;

        const item = previewData[i];
        const strategy = item.isDuplicate ? item.strategy : 'copy';

        if (strategy === 'skip') continue;

        const payload: RecipeWriteInput = {
          ...item.recipe,
          equipmentId: targetEquipmentId,
          name:
            strategy === 'copy' && item.isDuplicate
              ? `${item.recipe.name} (Imported Copy)`
              : item.recipe.name,
        };

        if (strategy === 'overwrite' && item.existingMatch) {
          await updateRecipe(item.existingMatch.id, payload);
          importedCount++;
        } else {
          await createRecipe(payload);
          importedCount++;
        }
      }

      onImportComplete(importedCount);
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to import recipes');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      titleId="recipe-import-modal-title"
      backdropClassName="bg-black/70"
      maxWidthClass="max-w-4xl"
      containerClassName="rounded-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden"
      busy={isSubmitting}
    >
      <div data-testid="recipe-import-modal">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 id="recipe-import-modal-title" className="text-lg font-bold text-white">Import External Recipes</h3>
              <p className="text-xs text-slate-400">
                {parsedRecipes.length} {parsedRecipes.length === 1 ? 'recipe' : 'recipes'} parsed from file
              </p>
            </div>
          </div>

          <Button variant="icon" type="button" onClick={onClose} aria-label="Close" title="Close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Global Controls & Equipment Mapping */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <label className="text-slate-300 font-medium">Assign Equipment Profile:</label>
            <Select
              size="sm"
              aria-label="Target Equipment Profile"
              value={targetEquipmentId}
              onChange={(e) => setTargetEquipmentId(e.target.value)}
              className="w-auto"
            >
              {equipmentProfiles.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.batchSizeL} L)
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={handleToggleAll}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline"
            >
              {selectedIndices.size === parsedRecipes.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div className="p-3 bg-rose-950/80 border-b border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {previewData.map((item) => (
            <div
              key={item.index}
              className={`p-3.5 rounded-xl border transition-colors ${
                selectedIndices.has(item.index)
                  ? 'bg-slate-900 border-amber-500/30'
                  : 'bg-slate-950/40 border-slate-800/80 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.recipe.name}`}
                  checked={selectedIndices.has(item.index)}
                  onChange={() => handleToggleSelect(item.index)}
                  className="mt-1 w-4 h-4 accent-amber-500 cursor-pointer rounded"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-100 truncate">{item.recipe.name}</h4>
                      <Badge variant="neutral" size="sm">
                        {item.recipe.styleName || 'Custom Style'}
                      </Badge>
                    </div>

                    {item.isDuplicate && (
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="warning" size="sm" className="font-semibold text-[10px]">
                          Duplicate Detected
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Vitals Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 text-xs font-mono tabular-nums mb-2.5">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-sans">OG / FG</span>
                      <span className="font-semibold text-slate-200">
                        {item.og.toFixed(3)} / {item.fg.toFixed(3)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-sans">ABV</span>
                      <span className="font-semibold text-amber-400">{item.abv.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-sans">Bitterness</span>
                      <span className="font-semibold text-slate-200">{item.ibu.toFixed(0)} IBU</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-sans">Color</span>
                      <span className="font-semibold text-amber-500">{item.srm.toFixed(1)} SRM</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-sans">Ingredients</span>
                      <span className="font-sans text-[11px] text-slate-300">
                        {item.recipe.fermentables.length}G · {item.recipe.hops.length}H · {item.recipe.yeasts.length}Y
                      </span>
                    </div>
                  </div>

                  {/* Duplicate Strategy Selection */}
                  {item.isDuplicate && (
                    <div className="flex flex-wrap items-center gap-4 text-xs pt-2 border-t border-slate-800/50">
                      <span className="text-slate-400 font-medium">Collision Action:</span>
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`dup-strategy-${item.index}`}
                          value="copy"
                          checked={item.strategy === 'copy'}
                          onChange={() => handleStrategyChange(item.index, 'copy')}
                          className="accent-amber-500 cursor-pointer"
                        />
                        <Copy className="w-3 h-3 text-amber-400" />
                        <span>Save as Copy</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`dup-strategy-${item.index}`}
                          value="overwrite"
                          checked={item.strategy === 'overwrite'}
                          onChange={() => handleStrategyChange(item.index, 'overwrite')}
                          className="accent-amber-500 cursor-pointer"
                        />
                        <RefreshCw className="w-3 h-3 text-cyan-400" />
                        <span>Overwrite Existing</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`dup-strategy-${item.index}`}
                          value="skip"
                          checked={item.strategy === 'skip'}
                          onChange={() => handleStrategyChange(item.index, 'skip')}
                          className="accent-amber-500 cursor-pointer"
                        />
                        <span>Skip</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <Button variant="secondary" size="sm" type="button" onClick={onClose} className="px-4">
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            type="button"
            data-testid="confirm-import-btn"
            disabled={selectedIndices.size === 0 || isSubmitting}
            onClick={handleImport}
            className="px-5 flex items-center gap-2"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Import Selected ({selectedIndices.size})</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
