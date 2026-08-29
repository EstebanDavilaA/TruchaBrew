import React, { useState, useMemo } from 'react';
import type { WaterProfile, FermentableItem, MiscItem } from '@truchabrew/shared-types';
import {
  calculateResidualAlkalinity,
  calculateFinishedIons,
  predictMashPh,
  calculatePostAcidMashPh,
  calculateSulfateToChlorideRatio,
  type AcidAdditionInputs,
} from '@truchabrew/calculations';
import { Droplets } from 'lucide-react';
import { CARD_CLASS, METRIC_TILE_CLASS, METRIC_LABEL_CLASS, METRIC_VALUE_CLASS } from './designSystem';
import { WaterCalculatorModal } from './WaterCalculatorModal';

export interface WaterSectionProps {
  waterProfiles: WaterProfile[];
  waterSourceId: string | null;
  waterTargetId: string | null;
  waterVolumeL: number;
  mashWaterL?: number;
  spargeWaterL?: number;
  spargeTempC?: number;
  totalGrainKg?: number;
  fermentables: FermentableItem[];
  miscs: MiscItem[];
  initialTargetPh?: number;
  onSourceChange: (id: string | null) => void;
  onTargetChange: (id: string | null) => void;
  onMiscsUpdate: (miscs: MiscItem[]) => void;
}

const ACID_AGENT_NAMES = new Set(['Lactic Acid 88%', 'Phosphoric Acid 75%', 'Acidulated Malt']);

export const WaterSection: React.FC<WaterSectionProps> = ({
  waterProfiles,
  waterSourceId,
  waterTargetId,
  waterVolumeL,
  mashWaterL,
  spargeWaterL,
  spargeTempC = 76,
  totalGrainKg,
  fermentables,
  miscs,
  initialTargetPh = 5.3,
  onSourceChange,
  onTargetChange,
  onMiscsUpdate,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const effectiveGrainKg = totalGrainKg ?? fermentables.reduce((sum, f) => sum + f.amountKg, 0);
  const effectiveMashL = mashWaterL ?? (waterVolumeL > 0 ? waterVolumeL * 0.6 : 0);
  const effectiveSpargeL = spargeWaterL ?? Math.max(0, waterVolumeL - effectiveMashL);
  const totalWaterL = waterVolumeL > 0 ? waterVolumeL : effectiveMashL + effectiveSpargeL;
  const totalMashVolumeL = effectiveMashL + effectiveGrainKg * 0.65;

  const source = useMemo(() => waterProfiles.find((p) => p.id === waterSourceId) ?? null, [waterProfiles, waterSourceId]);
  const target = useMemo(() => waterProfiles.find((p) => p.id === waterTargetId) ?? null, [waterProfiles, waterTargetId]);

  const finishedIons = useMemo(() => calculateFinishedIons(source, totalWaterL, miscs), [source, totalWaterL, miscs]);
  const ra = useMemo(() => calculateResidualAlkalinity(finishedIons.bicarbonate, finishedIons.calcium, finishedIons.magnesium), [finishedIons]);
  const preAcidPredictedPh = useMemo(() => predictMashPh(fermentables, totalWaterL, ra), [fermentables, totalWaterL, ra]);

  // Extract acid additions from miscs for post-acid pH
  const liveMashPh = useMemo(() => {
    const existingAcids = miscs.filter((m) => m.type === 'WaterAgent' && ACID_AGENT_NAMES.has(m.name));
    const appliedAcids: AcidAdditionInputs = existingAcids.reduce<AcidAdditionInputs>((acc, m) => {
      if (m.name === 'Lactic Acid 88%') acc.lacticAcid88Ml = (acc.lacticAcid88Ml ?? 0) + m.amount;
      else if (m.name === 'Phosphoric Acid 75%') acc.phosphoricAcid75Ml = (acc.phosphoricAcid75Ml ?? 0) + m.amount;
      else if (m.name === 'Acidulated Malt') acc.acidulatedMaltGrams = (acc.acidulatedMaltGrams ?? 0) + m.amount;
      return acc;
    }, {});
    return calculatePostAcidMashPh(preAcidPredictedPh, effectiveGrainKg, effectiveMashL, appliedAcids);
  }, [miscs, preAcidPredictedPh, effectiveGrainKg, effectiveMashL]);

  const so4ClRatio = useMemo(() => calculateSulfateToChlorideRatio(finishedIons.sulfate, finishedIons.chloride), [finishedIons]);

  const handleSaveModalAdjustments = ({
    waterSourceId: newSourceId,
    waterTargetId: newTargetId,
    miscs: newMiscs,
  }: {
    waterSourceId: string | null;
    waterTargetId: string | null;
    miscs: MiscItem[];
  }) => {
    if (newSourceId !== waterSourceId) onSourceChange(newSourceId);
    if (newTargetId !== waterTargetId) onTargetChange(newTargetId);
    onMiscsUpdate(newMiscs);
  };

  return (
    <>
      <div className={CARD_CLASS} data-testid="water-summary-row">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Water &amp; Mash Volumes</h3>
              <p className="text-xs text-slate-400">
                Source: <span className="text-slate-300 font-medium">{source ? source.name : 'None / RO'}</span>
                {target && <> · Target: <span className="text-slate-300 font-medium">{target.name}</span></>}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="open-water-calc-modal-btn"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-1">
              <span className="text-slate-400 group-hover:text-slate-300">Mash:</span>
              <span
                className={`font-mono font-bold ${
                  liveMashPh >= 5.2 && liveMashPh <= 5.6 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                pH {liveMashPh.toFixed(2)}
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] uppercase font-bold tracking-wider">
              CALC
            </span>
          </button>
        </div>

        {/* Top 4 Volume Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
          <div className={METRIC_TILE_CLASS}>
            <div className={METRIC_LABEL_CLASS}>Mash Water</div>
            <div className={`${METRIC_VALUE_CLASS} text-slate-100`}>{effectiveMashL.toFixed(1)} L</div>
          </div>

          <div className={METRIC_TILE_CLASS}>
            <div className={METRIC_LABEL_CLASS}>Sparge Water</div>
            <div className={`${METRIC_VALUE_CLASS} text-slate-100`}>{effectiveSpargeL.toFixed(1)} L</div>
            <div className="text-[11px] text-slate-400 mt-0.5">@{spargeTempC}°C</div>
          </div>

          <div className={METRIC_TILE_CLASS}>
            <div className={METRIC_LABEL_CLASS}>Total Water</div>
            <div className={`${METRIC_VALUE_CLASS} text-slate-100`}>{totalWaterL.toFixed(1)} L</div>
          </div>

          <div className={METRIC_TILE_CLASS}>
            <div className={METRIC_LABEL_CLASS}>Total Mash Volume</div>
            <div className={`${METRIC_VALUE_CLASS} text-slate-100`}>{totalMashVolumeL.toFixed(1)} L</div>
          </div>
        </div>

        {/* Finished Ions Sub-Row */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-slate-400">
            <span>Ca²⁺: <strong className="text-slate-200">{finishedIons.calcium.toFixed(0)}</strong></span>
            <span>Mg²⁺: <strong className="text-slate-200">{finishedIons.magnesium.toFixed(0)}</strong></span>
            <span>Na⁺: <strong className="text-slate-200">{finishedIons.sodium.toFixed(0)}</strong></span>
            <span>Cl⁻: <strong className="text-slate-200">{finishedIons.chloride.toFixed(0)}</strong></span>
            <span>SO₄²⁻: <strong className="text-slate-200">{finishedIons.sulfate.toFixed(0)}</strong></span>
            <span>HCO₃⁻: <strong className="text-slate-200">{finishedIons.bicarbonate.toFixed(0)}</strong></span>
          </div>

          <div className="text-[11px] text-slate-400">
            SO₄²⁻:Cl⁻ <span className="font-semibold text-amber-400">{so4ClRatio.ratio !== null ? `${so4ClRatio.ratio} (${so4ClRatio.descriptor})` : '—'}</span>
          </div>
        </div>
      </div>

      <WaterCalculatorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        waterProfiles={waterProfiles}
        waterSourceId={waterSourceId}
        waterTargetId={waterTargetId}
        waterVolumeL={totalWaterL}
        mashWaterL={effectiveMashL}
        spargeWaterL={effectiveSpargeL}
        fermentables={fermentables}
        miscs={miscs}
        initialTargetPh={initialTargetPh}
        onSaveAdjustments={handleSaveModalAdjustments}
      />
    </>
  );
};
