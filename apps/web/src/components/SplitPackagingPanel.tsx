import { useState, useMemo } from 'react';
import type { PrimingSugarType, SplitPackageInput, SplitPackageType } from '@truchabrew/calculations';
import { calculateSplitPackaging, calculatePrimingSolution, PRIMING_SUGAR_MULTIPLIERS } from '@truchabrew/calculations';
import { CARD_CLASS, SECTION_HEADING_CLASS } from './designSystem';
import { Button, Select, NumberInput } from './ui';
import { Wine, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface SplitPackagingPanelProps {
  totalBeerVolumeL: number | null;
  peakFermentationTempC: number | null;
  onPackagingChange?: (packages: SplitPackageInput[]) => void;
}

const BOTTLE_SIZES = [
  { label: '330 mL (Standard)', value: 330 },
  { label: '355 mL (12 oz)', value: 355 },
  { label: '500 mL (Euro/Pint)', value: 500 },
  { label: '750 mL (Bomber/Belgian)', value: 750 },
];

const SUGAR_TYPES: { type: PrimingSugarType; label: string; ratio: number }[] = [
  { type: 'table_sugar', label: 'Table Sugar / Sucrose', ratio: PRIMING_SUGAR_MULTIPLIERS.table_sugar },
  { type: 'corn_sugar', label: 'Corn Sugar / Dextrose', ratio: PRIMING_SUGAR_MULTIPLIERS.corn_sugar },
  { type: 'dme', label: 'Dry Malt Extract (DME)', ratio: PRIMING_SUGAR_MULTIPLIERS.dme },
  { type: 'honey', label: 'Honey', ratio: PRIMING_SUGAR_MULTIPLIERS.honey },
];

export function SplitPackagingPanel({
  totalBeerVolumeL,
  peakFermentationTempC,
  onPackagingChange,
}: SplitPackagingPanelProps) {
  const effectiveTotalVolume = totalBeerVolumeL ?? 20.0;
  // If peak fermentation temp was not logged or is 0 (or null), default to standard room temperature 20°C
  const effectivePeakTemp = peakFermentationTempC !== null && peakFermentationTempC > 0 ? peakFermentationTempC : 20.0;

  const [packages, setPackages] = useState<SplitPackageInput[]>([
    {
      id: 'pkg-1',
      type: 'bottles',
      volumeL: effectiveTotalVolume,
      targetVolumesCO2: 2.4,
      sugarType: 'table_sugar',
      bottleSizeMl: 330,
    },
  ]);

  const summary = useMemo(() => {
    return calculateSplitPackaging(effectiveTotalVolume, effectivePeakTemp, packages);
  }, [effectiveTotalVolume, effectivePeakTemp, packages]);

  const updatePackage = (id: string, patch: Partial<SplitPackageInput>) => {
    const updated = packages.map((p) => (p.id === id ? { ...p, ...patch } : p));
    setPackages(updated);
    onPackagingChange?.(updated);
  };

  const addPackage = () => {
    const newId = `pkg-${Date.now()}`;
    const unassigned = Math.max(0, summary.unassignedVolumeL);
    const lastType = packages[packages.length - 1]?.type ?? 'bottles';
    const nextType: SplitPackageType = lastType === 'bottles' ? 'keg' : 'bottles';
    const newPkg: SplitPackageInput = {
      id: newId,
      type: nextType,
      volumeL: unassigned > 0 ? unassigned : 5.0,
      targetVolumesCO2: 2.4,
      ...(nextType === 'keg' ? { tempC: 4.0 } : { sugarType: 'table_sugar', bottleSizeMl: 330 }),
    };
    const updated = [...packages, newPkg];
    setPackages(updated);
    onPackagingChange?.(updated);
  };

  const removePackage = (id: string) => {
    const updated = packages.filter((p) => p.id !== id);
    setPackages(updated);
    onPackagingChange?.(updated);
  };

  return (
    <div className={CARD_CLASS} data-testid="split-packaging-panel">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Wine className="w-5 h-5 text-amber-400" />
            <h3 className={SECTION_HEADING_CLASS}>Packaging &amp; Carbonation</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure your batch packaging ({effectiveTotalVolume.toFixed(1)} L) across kegs, primed bottles, or split runs on the fly.
          </p>
        </div>

        {/* Balance Status Meter */}
        <div
          data-testid="packaging-volume-balance"
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
            summary.unassignedVolumeL === 0
              ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300'
              : summary.unassignedVolumeL > 0
              ? 'bg-amber-950/60 border-amber-700/80 text-amber-300'
              : 'bg-rose-950/60 border-rose-700/80 text-rose-300'
          }`}
        >
          {summary.unassignedVolumeL === 0 ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>All {effectiveTotalVolume.toFixed(1)} L Allocated</span>
            </>
          ) : summary.unassignedVolumeL > 0 ? (
            <>
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>{summary.unassignedVolumeL.toFixed(1)} L Unassigned</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Exceeds by {Math.abs(summary.unassignedVolumeL).toFixed(1)} L</span>
            </>
          )}
        </div>
      </div>

      {/* Package Header with + Add Package Action */}
      <div className="mb-3 flex items-center justify-between pt-1">
        <h4 className="text-sm font-semibold text-slate-200">
          Packages ({packages.length})
        </h4>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          data-testid="add-package-btn"
          onClick={addPackage}
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          Add Package
        </Button>
      </div>

      {/* Package List */}
      <div className="space-y-4">
        {summary.results.map((res, index) => {
          const pkg = packages.find((p) => p.id === res.id)!;
          return (
            <div
              key={res.id}
              data-testid={`package-row-${index}`}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 uppercase">
                    {res.type === 'keg' ? 'Keg / Force Carbonation' : 'Bottling / Priming Sugar'}
                  </span>
                  <span className="text-sm font-semibold text-slate-100">
                    Package #{index + 1} ({res.volumeL.toFixed(1)} L)
                  </span>
                </div>
                {packages.length > 1 && (
                  <Button
                    variant="icon"
                    type="button"
                    data-testid={`remove-package-btn-${index}`}
                    aria-label={`Remove package ${index + 1}`}
                    onClick={() => removePackage(res.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor={`pkg-type-${res.id}`} className="block text-xs font-medium text-slate-400 mb-1">
                    Destination
                  </label>
                  <Select
                    size="sm"
                    id={`pkg-type-${res.id}`}
                    value={pkg.type}
                    onChange={(e) => updatePackage(res.id, { type: e.target.value as SplitPackageType })}
                  >
                    <option value="keg">Keg</option>
                    <option value="bottles">Bottles</option>
                  </Select>
                </div>

                <div>
                  <label htmlFor={`pkg-vol-${res.id}`} className="block text-xs font-medium text-slate-400 mb-1">
                    Volume (L)
                  </label>
                  <NumberInput
                    size="sm"
                    align="right"
                    id={`pkg-vol-${res.id}`}
                    type="number"
                    step="0.1"
                    min="0"
                    value={pkg.volumeL}
                    onChange={(e) => updatePackage(res.id, { volumeL: parseFloat(e.target.value) || 0 })}
                    aria-label={`Package ${index + 1} volume in liters`}
                  />
                </div>

                <div>
                  <label htmlFor={`pkg-co2-${res.id}`} className="block text-xs font-medium text-slate-400 mb-1">
                    Target CO&#8322; (vols)
                  </label>
                  <NumberInput
                    size="sm"
                    align="right"
                    id={`pkg-co2-${res.id}`}
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="4.5"
                    value={pkg.targetVolumesCO2}
                    onChange={(e) => updatePackage(res.id, { targetVolumesCO2: parseFloat(e.target.value) || 2.4 })}
                    aria-label={`Package ${index + 1} target CO2 volumes`}
                  />
                </div>

                {res.type === 'keg' ? (
                  <div>
                    <label htmlFor={`pkg-temp-${res.id}`} className="block text-xs font-medium text-slate-400 mb-1">
                      Serving Temp (&deg;C)
                    </label>
                    <NumberInput
                      size="sm"
                      align="right"
                      id={`pkg-temp-${res.id}`}
                      type="number"
                      step="0.5"
                      value={pkg.tempC ?? 4.0}
                      onChange={(e) => updatePackage(res.id, { tempC: parseFloat(e.target.value) || 4.0 })}
                      aria-label={`Package ${index + 1} serving temperature in celsius`}
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor={`pkg-sugar-${res.id}`} className="block text-xs font-medium text-slate-400 mb-1">
                      Priming Sugar
                    </label>
                    <Select
                      size="sm"
                      id={`pkg-sugar-${res.id}`}
                      value={pkg.sugarType ?? 'table_sugar'}
                      onChange={(e) => updatePackage(res.id, { sugarType: e.target.value as PrimingSugarType })}
                    >
                      {SUGAR_TYPES.map((st) => (
                        <option key={st.type} value={st.type}>
                          {st.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              {/* Bottle specific size selector */}
              {res.type === 'bottles' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label htmlFor={`pkg-bottle-size-${res.id}`} className="block text-xs font-medium text-slate-400 mb-1">
                      Bottle Size
                    </label>
                    <Select
                      size="sm"
                      id={`pkg-bottle-size-${res.id}`}
                      value={pkg.bottleSizeMl ?? 330}
                      onChange={(e) => updatePackage(res.id, { bottleSizeMl: parseInt(e.target.value, 10) || 330 })}
                    >
                      {BOTTLE_SIZES.map((bs) => (
                        <option key={bs.value} value={bs.value}>
                          {bs.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              {/* Carbonation Output Cards */}
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                {res.type === 'keg' ? (
                  <div className="flex items-center justify-between" data-testid={`keg-results-${index}`}>
                    <div>
                      <div className="text-xs text-slate-400">Regulator Equilibrium Pressure</div>
                      <div className="text-xl font-bold text-amber-400">
                        {res.forceCarbonationPsi !== null ? `${res.forceCarbonationPsi.toFixed(1)} PSI` : '—'}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div>Set regulator @ {(pkg.tempC ?? 4.0).toFixed(1)}&deg;C</div>
                      <div>Target: {res.targetVolumesCO2.toFixed(1)} vols CO&#8322;</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid={`bottle-results-${index}`}>
                      <div>
                        <div className="text-xs text-slate-400">Total Priming Sugar</div>
                        <div className="text-lg font-bold text-amber-400" data-testid={`priming-sugar-total-${index}`}>
                          {res.primingSugarG !== null ? `${res.primingSugarG.toFixed(1)} g` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Sugar Rate</div>
                        <div className="text-lg font-bold text-slate-200">
                          {res.primingSugarEquivGPerL !== null ? `${res.primingSugarEquivGPerL.toFixed(2)} g/L` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Bottle Count</div>
                        <div className="text-lg font-bold text-slate-200" data-testid={`bottle-count-${index}`}>
                          {res.bottleCount !== null ? `${res.bottleCount} bottles` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Dry Sugar / Bottle</div>
                        <div className="text-lg font-bold text-slate-200">
                          {res.sugarGramsPerBottle !== null ? `${res.sugarGramsPerBottle.toFixed(2)} g` : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Priming Solution & Syringe Dosing Tool (AC-17) */}
                    {(() => {
                      const bufferPct = (pkg as any).solutionBufferPct ?? 0;
                      const sol = calculatePrimingSolution({
                        sugarG: res.primingSugarG ?? 0,
                        bottleCount: res.bottleCount ?? 1,
                        waterVolumeMl: (pkg as any).solutionWaterMl,
                        targetDosePerBottleMl: (pkg as any).targetSyringeDoseMl,
                        solutionBufferPct: bufferPct,
                      });

                      return (
                        <div
                          className="pt-3 border-t border-slate-800/90 text-xs space-y-2.5"
                          data-testid={`priming-solution-panel-${index}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="font-semibold text-slate-200">
                              Syringe Inoculation / Priming Solution Calculator
                            </span>
                            <span className="text-slate-400 font-mono">
                              Sugar displacement: +{sol.sugarDisplacementMl} mL
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            <div>
                              <label
                                htmlFor={`sol-water-${res.id}`}
                                className="block text-slate-400 text-[11px] mb-1 truncate"
                              >
                                Dilution Water (mL)
                              </label>
                              <NumberInput
                                size="sm"
                                id={`sol-water-${res.id}`}
                                type="number"
                                step="10"
                                value={(pkg as any).solutionWaterMl ?? 200}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 200;
                                  updatePackage(res.id, {
                                    solutionWaterMl: val,
                                    targetSyringeDoseMl: undefined,
                                  } as any);
                                }}
                                aria-label="Dilution water volume in mL"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`sol-dose-${res.id}`}
                                className="block text-slate-400 text-[11px] mb-1 truncate"
                              >
                                Target Dose (mL/btl)
                              </label>
                              <NumberInput
                                size="sm"
                                id={`sol-dose-${res.id}`}
                                type="number"
                                step="0.5"
                                placeholder={sol.syringeDosePerBottleMl.toFixed(2)}
                                value={(pkg as any).targetSyringeDoseMl ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                  updatePackage(res.id, {
                                    targetSyringeDoseMl: val,
                                    solutionWaterMl: undefined,
                                  } as any);
                                }}
                                aria-label="Target syringe dose in mL per bottle"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`sol-buffer-${res.id}`}
                                className="block text-slate-400 text-[11px] mb-1 truncate"
                              >
                                Extra Buffer (+%)
                              </label>
                              <NumberInput
                                size="sm"
                                id={`sol-buffer-${res.id}`}
                                type="number"
                                step="5"
                                min="0"
                                max="100"
                                placeholder="0%"
                                value={(pkg as any).solutionBufferPct ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value ? parseFloat(e.target.value) || 0 : undefined;
                                  updatePackage(res.id, {
                                    solutionBufferPct: val,
                                  } as any);
                                }}
                                aria-label="Solution extra buffer percentage"
                              />
                            </div>

                            <div>
                              <div className="text-slate-400 text-[11px] mb-1 truncate">Total Solution</div>
                              <div
                                className="font-bold text-amber-300 py-1"
                                data-testid={`total-solution-ml-${index}`}
                              >
                                {sol.totalSolutionMl} mL
                              </div>
                            </div>

                            <div>
                              <div className="text-slate-400 text-[11px] mb-1 truncate">Inject / Bottle</div>
                              <div
                                className="font-bold text-emerald-400 py-1 text-sm"
                                data-testid={`syringe-dose-ml-${index}`}
                              >
                                {sol.syringeDosePerBottleMl} mL / btl
                              </div>
                            </div>
                          </div>

                          <div className="p-2 rounded bg-slate-950/60 border border-slate-800 text-slate-300 text-[11px] leading-relaxed">
                            💡 <span className="font-medium text-slate-200">Syringe Instructions:</span>{' '}
                            {sol.instructionText}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
