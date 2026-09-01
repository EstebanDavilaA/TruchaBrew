import React, { useState, useMemo, useEffect } from 'react';
import type { WaterProfile, FermentableItem, MiscItem } from '@truchabrew/shared-types';
import {
  calculateResidualAlkalinity,
  calculateFinishedIons,
  predictMashPh,
  suggestSaltAdditions,
  optimizeWaterProfile,
  calculateAcidAdditions,
  calculatePostAcidMashPh,
  calculateSulfateToChlorideRatio,
  calculateSpargeAcid,
  type IonConcentrations,
} from '@truchabrew/calculations';
import { X, Droplets, Sparkles, FlaskConical, RotateCcw, Check, Target } from 'lucide-react';
import { SUBPANEL_CLASS } from './designSystem';
import { Modal } from './Modal';
import { Button, Select, NumberInput, FormField, Table, TableHeaderCell, TableCell, Badge } from './ui';

export interface WaterCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  waterProfiles: WaterProfile[];
  waterSourceId: string | null;
  waterTargetId: string | null;
  waterVolumeL: number;
  mashWaterL?: number;
  spargeWaterL?: number;
  fermentables: FermentableItem[];
  miscs: MiscItem[];
  initialTargetPh?: number;
  onSaveAdjustments: (params: {
    waterSourceId: string | null;
    waterTargetId: string | null;
    miscs: MiscItem[];
  }) => void;
}

const SALT_NAMES = ['Gypsum', 'Calcium Chloride', 'Epsom Salt', 'Table Salt', 'Baking Soda'] as const;
type SaltName = typeof SALT_NAMES[number];

const ACID_TYPES = ['Lactic Acid 88%', 'Phosphoric Acid 75%', 'Acidulated Malt'] as const;
type AcidType = typeof ACID_TYPES[number];

// M37_P2 — balance strategy presets for the Auto-Optimize action. Each preset
// scales the ion weights passed to optimizeWaterProfile to bias the solver
// toward a flavor profile (RA-3): balanced keeps the default weights, crisp
// favors sulfate (bitter/hop-forward), malty favors chloride (full/soft).
const BALANCE_STRATEGIES = ['Balanced', 'Crisp Hop-Forward', 'Malty/Full'] as const;
type BalanceStrategy = typeof BALANCE_STRATEGIES[number];

interface IonWeights {
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
}

const DEFAULT_ION_WEIGHTS: IonWeights = {
  sulfate: 1.0,
  chloride: 1.0,
  calcium: 0.8,
  magnesium: 0.5,
  sodium: 0.4,
  bicarbonate: 0.3,
};

const STRATEGY_WEIGHTS: Record<BalanceStrategy, IonWeights> = {
  Balanced: { ...DEFAULT_ION_WEIGHTS },
  'Crisp Hop-Forward': { ...DEFAULT_ION_WEIGHTS, sulfate: 1.6, chloride: 0.7 },
  'Malty/Full': { ...DEFAULT_ION_WEIGHTS, chloride: 1.6, sulfate: 0.7 },
};

// Ion keys in the canonical order used by the minerals table + delta badges.
const ION_KEYS: (keyof IonConcentrations)[] = [
  'calcium',
  'magnesium',
  'sodium',
  'chloride',
  'sulfate',
  'bicarbonate',
];

const ION_LABELS: Record<keyof IonConcentrations, string> = {
  calcium: 'Ca²⁺',
  magnesium: 'Mg²⁺',
  sodium: 'Na⁺',
  chloride: 'Cl⁻',
  sulfate: 'SO₄²⁻',
  bicarbonate: 'HCO₃⁻',
};

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function mineralTotalGrams(
  name: SaltName,
  mashSalts: Record<SaltName, number>,
  spargeSalts: Record<SaltName, number>,
  treatSpargeWater: boolean,
): number {
  return treatSpargeWater ? mashSalts[name] + spargeSalts[name] : mashSalts[name];
}

export const WaterCalculatorModal: React.FC<WaterCalculatorModalProps> = ({
  isOpen,
  onClose,
  waterProfiles,
  waterSourceId,
  waterTargetId,
  waterVolumeL,
  mashWaterL,
  spargeWaterL,
  fermentables,
  miscs,
  initialTargetPh = 5.3,
  onSaveAdjustments,
}) => {
  const sourceProfiles = useMemo(() => waterProfiles.filter((p) => p.type === 'source'), [waterProfiles]);
  const targetProfiles = useMemo(() => waterProfiles.filter((p) => p.type === 'target'), [waterProfiles]);

  const effectiveMashL = mashWaterL ?? waterVolumeL * 0.6;
  const effectiveSpargeL = spargeWaterL ?? Math.max(0, waterVolumeL - effectiveMashL);
  const totalVolumeL = waterVolumeL > 0 ? waterVolumeL : effectiveMashL + effectiveSpargeL;
  const totalGrainKg = useMemo(() => fermentables.reduce((sum, f) => sum + f.amountKg, 0), [fermentables]);

  // Local state initialized from props
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(waterSourceId);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(waterTargetId);
  const [targetMashPh, setTargetMashPh] = useState<number>(initialTargetPh);
  const [targetSpargePh, setTargetSpargePh] = useState<number>(5.5);
  const [treatSpargeWater, setTreatSpargeWater] = useState<boolean>(true);
  const [addSpargeAcid, setAddSpargeAcid] = useState<boolean>(true);

  // Salts: grams allocated to Mash and Sparge
  const [mashSalts, setMashSalts] = useState<Record<SaltName, number>>({
    Gypsum: 0,
    'Calcium Chloride': 0,
    'Epsom Salt': 0,
    'Table Salt': 0,
    'Baking Soda': 0,
  });

  const [spargeSalts, setSpargeSalts] = useState<Record<SaltName, number>>({
    Gypsum: 0,
    'Calcium Chloride': 0,
    'Epsom Salt': 0,
    'Table Salt': 0,
    'Baking Soda': 0,
  });

  // Acids — one shared type for both mash and sparge dosing
  const [addMashAcid, setAddMashAcid] = useState<boolean>(true);
  const [acidType, setAcidType] = useState<AcidType>('Lactic Acid 88%');
  const [mashAcidAmount, setMashAcidAmount] = useState<number>(0);
  const [spargeAcidAmount, setSpargeAcidAmount] = useState<number>(0);

  // M37_P2 — balance strategy for the Auto-Optimize solver (RA-3)
  const [balanceStrategy, setBalanceStrategy] = useState<BalanceStrategy>('Balanced');

  // Sync state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSelectedSourceId(waterSourceId);
    setSelectedTargetId(waterTargetId);
    setTargetMashPh(initialTargetPh);
    setTreatSpargeWater(true);
    setAddMashAcid(true);
    setAddSpargeAcid(true);

    const initialMashSalts: Record<SaltName, number> = {
      Gypsum: 0,
      'Calcium Chloride': 0,
      'Epsom Salt': 0,
      'Table Salt': 0,
      'Baking Soda': 0,
    };
    const initialSpargeSalts: Record<SaltName, number> = {
      Gypsum: 0,
      'Calcium Chloride': 0,
      'Epsom Salt': 0,
      'Table Salt': 0,
      'Baking Soda': 0,
    };

    let initialMashAcid = 0;
    let initialSpargeAcid = 0;
    let initialAcidType: AcidType = 'Lactic Acid 88%';

    for (const m of miscs) {
      if (m.type === 'WaterAgent') {
        const isSparge = m.name.includes('(Sparge)');
        const baseName = m.name.replace(' (Sparge)', '') as SaltName | AcidType;

        if (SALT_NAMES.includes(baseName as SaltName)) {
          if (isSparge) {
            initialSpargeSalts[baseName as SaltName] += m.amount;
          } else {
            initialMashSalts[baseName as SaltName] += m.amount;
          }
        } else if (ACID_TYPES.includes(baseName as AcidType)) {
          initialAcidType = baseName as AcidType;
          if (isSparge) {
            initialSpargeAcid += m.amount;
          } else {
            initialMashAcid += m.amount;
          }
        }
      }
    }

    setMashSalts(initialMashSalts);
    setSpargeSalts(initialSpargeSalts);
    setMashAcidAmount(initialMashAcid);
    setSpargeAcidAmount(initialSpargeAcid);
    setAcidType(initialAcidType);
  }, [isOpen, waterSourceId, waterTargetId, initialTargetPh, miscs]);

  // Profiles
  const source = useMemo(() => waterProfiles.find((p) => p.id === selectedSourceId) ?? null, [waterProfiles, selectedSourceId]);
  const target = useMemo(() => waterProfiles.find((p) => p.id === selectedTargetId) ?? null, [waterProfiles, selectedTargetId]);

  // Generate virtual miscs for calculations
  const currentMiscs = useMemo(() => {
    const list: MiscItem[] = [];
    SALT_NAMES.forEach((name) => {
      const mashG = mashSalts[name];
      const spargeG = spargeSalts[name];
      if (mashG > 0) {
        list.push({ id: `m-salt-${name}`, name, type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: mashG, unit: 'g' });
      }
      if (spargeG > 0) {
        list.push({ id: `s-salt-${name}`, name, type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: spargeG, unit: 'g' });
      }
    });
    return list;
  }, [mashSalts, spargeSalts]);

  // Finished Ions
  const finishedIons = useMemo(() => calculateFinishedIons(source, totalVolumeL, currentMiscs), [source, totalVolumeL, currentMiscs]);
  const ra = useMemo(() => calculateResidualAlkalinity(finishedIons.bicarbonate, finishedIons.calcium, finishedIons.magnesium), [finishedIons]);
  const preAcidPredictedPh = useMemo(() => predictMashPh(fermentables, totalVolumeL, ra), [fermentables, totalVolumeL, ra]);

  // Acid inputs and post-acid pH
  const liveMashPh = useMemo(() => {
    const effectiveMashAmount = addMashAcid ? mashAcidAmount : 0;
    const acidInput = {
      lacticAcid88Ml: acidType === 'Lactic Acid 88%' ? effectiveMashAmount : 0,
      phosphoricAcid75Ml: acidType === 'Phosphoric Acid 75%' ? effectiveMashAmount : 0,
      acidulatedMaltGrams: acidType === 'Acidulated Malt' ? effectiveMashAmount : 0,
    };
    return calculatePostAcidMashPh(preAcidPredictedPh, totalGrainKg, effectiveMashL, acidInput);
  }, [preAcidPredictedPh, totalGrainKg, effectiveMashL, acidType, mashAcidAmount, addMashAcid]);

  // Sulfate to Chloride ratio
  const so4ClRatio = useMemo(() => calculateSulfateToChlorideRatio(finishedIons.sulfate, finishedIons.chloride), [finishedIons]);

  // M37_P2 — the Auto-Optimize action (handleAutoAdjustAll) calls
  // optimizeWaterProfile directly with the selected balance strategy weights.
  // The *displayed* fit score (AC-8) is computed from the current finished
  // water so typing a salt input updates it live.

  // Per-ion target vs adjusted (source + additions) vs delta. The adjusted
  // value is the live finished water; the delta is (finished − target).
  // In-range (±5 ppm) shows an emerald "Target" badge; otherwise a signed
  // ppm delta badge (AC-7).
  const targetIons: IonConcentrations | null = useMemo(() => {
    if (!target) return null;
    return {
      calcium: target.calcium,
      magnesium: target.magnesium,
      sodium: target.sodium,
      chloride: target.chloride,
      sulfate: target.sulfate,
      bicarbonate: target.bicarbonate,
    };
  }, [target]);

  const ionDeltas: IonConcentrations | null = useMemo(() => {
    if (!targetIons) return null;
    return {
      calcium: finishedIons.calcium - targetIons.calcium,
      magnesium: finishedIons.magnesium - targetIons.magnesium,
      sodium: finishedIons.sodium - targetIons.sodium,
      chloride: finishedIons.chloride - targetIons.chloride,
      sulfate: finishedIons.sulfate - targetIons.sulfate,
      bicarbonate: finishedIons.bicarbonate - targetIons.bicarbonate,
    };
  }, [finishedIons, targetIons]);

  // Live fit score from the actual finished water (current salt inputs).
  // Closeness per ion = max(0, 1 − |delta| / max(target, 1)); weighted by the
  // same default weights the solver uses so the number reads consistently.
  const fitScorePct = useMemo(() => {
    if (!targetIons) return 0;
    const totalWeight = Object.values(DEFAULT_ION_WEIGHTS).reduce((a, b) => a + b, 0);
    let weighted = 0;
    for (const key of ION_KEYS) {
      const w = DEFAULT_ION_WEIGHTS[key];
      const t = targetIons[key];
      const denom = Math.max(1, Math.abs(t));
      const closeness = Math.max(0, 1 - Math.abs(finishedIons[key] - t) / denom);
      weighted += w * closeness;
    }
    return Math.round((totalWeight > 0 ? (weighted / totalWeight) * 100 : 100) * 10) / 10;
  }, [finishedIons, targetIons]);

  const fitScoreLabel =
    fitScorePct >= 90 ? 'Optimal' : fitScorePct >= 75 ? 'Good' : 'Approx';

  // Suggested salts for the batch (Needed reference column)
  const suggestedSaltsMap = useMemo(() => {
    const map: Record<SaltName, number> = {
      Gypsum: 0,
      'Calcium Chloride': 0,
      'Epsom Salt': 0,
      'Table Salt': 0,
      'Baking Soda': 0,
    };
    if (!target) return map;
    const suggested = suggestSaltAdditions(source, target, totalVolumeL);
    suggested.forEach((s) => {
      const salt = s.saltName as SaltName;
      if (SALT_NAMES.includes(salt)) {
        map[salt] = s.amountGrams;
      }
    });
    return map;
  }, [source, target, totalVolumeL]);

  // Grist Distilled pH breakdown
  const gristBreakdown = useMemo(() => {
    return fermentables.filter((f) => f.type === 'Grain').map((f) => {
      const ebc = f.colorSrm * 1.97;
      let baseline = 5.60;
      if (f.colorSrm > 40.64) baseline = 4.70;
      else if (f.colorSrm > 5.08) baseline = 5.20;
      return { id: f.id, name: f.name, amountKg: f.amountKg, colorSrm: f.colorSrm, ebc, baseline };
    });
  }, [fermentables]);

  const handleReset = () => {
    setMashSalts({ Gypsum: 0, 'Calcium Chloride': 0, 'Epsom Salt': 0, 'Table Salt': 0, 'Baking Soda': 0 });
    setSpargeSalts({ Gypsum: 0, 'Calcium Chloride': 0, 'Epsom Salt': 0, 'Table Salt': 0, 'Baking Soda': 0 });
    setMashAcidAmount(0);
    setSpargeAcidAmount(0);
  };

  const handleToggleTreatSparge = (next: boolean) => {
    setTreatSpargeWater(next);
    if (!next) {
      setSpargeSalts({ Gypsum: 0, 'Calcium Chloride': 0, 'Epsom Salt': 0, 'Table Salt': 0, 'Baking Soda': 0 });
    }
  };

  const handleToggleMashAcid = (next: boolean) => {
    setAddMashAcid(next);
    if (!next) setMashAcidAmount(0);
  };

  const handleToggleSpargeAcid = (next: boolean) => {
    setAddSpargeAcid(next);
    if (!next) setSpargeAcidAmount(0);
  };

  // Unified global AUTO (Amendment 2, FEAT-028 & Enhanced Idempotency):
  // computes both optimal salt additions and mash/sparge acid additions cleanly,
  // respecting the treatSpargeWater / addMashAcid / addSpargeAcid toggles.
  // M37_P2: salt allocations now come from optimizeWaterProfile (the bounded
  // multi-ion solver) with the selected balance strategy's ion weights.
  const handleAutoAdjustAll = () => {
    // 1. Mineral salt allocations (respecting treatSpargeWater)
    let calcMashSalts = { ...mashSalts };
    let calcSpargeSalts = { ...spargeSalts };

    if (target) {
      const optimized = optimizeWaterProfile(source, target, totalVolumeL, {
        weights: STRATEGY_WEIGHTS[balanceStrategy],
      });
      const suggested = optimized.salts;
      const newMash: Record<SaltName, number> = { Gypsum: 0, 'Calcium Chloride': 0, 'Epsom Salt': 0, 'Table Salt': 0, 'Baking Soda': 0 };
      const newSparge: Record<SaltName, number> = { Gypsum: 0, 'Calcium Chloride': 0, 'Epsom Salt': 0, 'Table Salt': 0, 'Baking Soda': 0 };

      const mashRatio = treatSpargeWater
        ? (totalVolumeL > 0 ? effectiveMashL / totalVolumeL : 0.6)
        : 1;
      const spargeRatio = 1 - mashRatio;

      suggested.forEach((s) => {
        const salt = s.saltName as SaltName;
        if (SALT_NAMES.includes(salt)) {
          newMash[salt] = parseFloat((s.amountGrams * mashRatio).toFixed(2));
          newSparge[salt] = parseFloat((s.amountGrams * spargeRatio).toFixed(2));
        }
      });

      calcMashSalts = newMash;
      calcSpargeSalts = newSparge;
      setMashSalts(newMash);
      setSpargeSalts(newSparge);
    }

    // Build virtual miscs for the suggested salts to compute exact pure target pH
    const simMiscs: MiscItem[] = [];
    SALT_NAMES.forEach((name) => {
      if (calcMashSalts[name] > 0) {
        simMiscs.push({ id: `m-salt-${name}`, name, type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: calcMashSalts[name], unit: 'g' });
      }
      if (calcSpargeSalts[name] > 0) {
        simMiscs.push({ id: `s-salt-${name}`, name, type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: calcSpargeSalts[name], unit: 'g' });
      }
    });

    const simFinishedIons = calculateFinishedIons(source, totalVolumeL, simMiscs);
    const simRa = calculateResidualAlkalinity(simFinishedIons.bicarbonate, simFinishedIons.calcium, simFinishedIons.magnesium);
    const simPreAcidPh = predictMashPh(fermentables, totalVolumeL, simRa);
    const cleanMashAcid = calculateAcidAdditions(totalGrainKg, simPreAcidPh, targetMashPh, effectiveMashL, 0);
    const cleanSpargeAcid = calculateSpargeAcid(effectiveSpargeL, source?.bicarbonate ?? 0, targetSpargePh);

    // 2. Mash acid dosage (gated on addMashAcid)
    if (addMashAcid) {
      if (acidType === 'Lactic Acid 88%') setMashAcidAmount(cleanMashAcid.lacticAcid88Ml);
      else if (acidType === 'Phosphoric Acid 75%') setMashAcidAmount(cleanMashAcid.phosphoricAcid75Ml);
      else if (acidType === 'Acidulated Malt') setMashAcidAmount(cleanMashAcid.acidulatedMaltGrams);
    }

    // 3. Sparge acid dosage (gated on addSpargeAcid)
    if (addSpargeAcid) {
      if (acidType === 'Lactic Acid 88%') setSpargeAcidAmount(cleanSpargeAcid.lacticAcid88Ml);
      else if (acidType === 'Phosphoric Acid 75%') setSpargeAcidAmount(cleanSpargeAcid.phosphoricAcid75Ml);
    }
  };

  const handleSave = () => {
    const nonWaterMiscs = miscs.filter((m) => m.type !== 'WaterAgent');
    const newMiscs: MiscItem[] = [...nonWaterMiscs];

    SALT_NAMES.forEach((name) => {
      const mGrams = mashSalts[name];
      if (mGrams > 0) {
        newMiscs.push({
          id: `misc-mash-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          name,
          type: 'WaterAgent',
          use: 'Mash',
          timeMinutes: 0,
          amount: mGrams,
          unit: 'g',
        });
      }
      const sGrams = spargeSalts[name];
      if (treatSpargeWater && sGrams > 0) {
        newMiscs.push({
          id: `misc-sparge-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          name: `${name} (Sparge)`,
          type: 'WaterAgent',
          use: 'Mash',
          timeMinutes: 0,
          amount: sGrams,
          unit: 'g',
        });
      }
    });

    if (addMashAcid && mashAcidAmount > 0) {
      newMiscs.push({
        id: `misc-mash-acid-${Date.now()}`,
        name: acidType,
        type: 'WaterAgent',
        use: 'Mash',
        timeMinutes: 0,
        amount: mashAcidAmount,
        unit: acidType === 'Acidulated Malt' ? 'g' : 'ml',
      });
    }

    if (addSpargeAcid && spargeAcidAmount > 0) {
      newMiscs.push({
        id: `misc-sparge-acid-${Date.now()}`,
        name: `${acidType} (Sparge)`,
        type: 'WaterAgent',
        use: 'Mash',
        timeMinutes: 0,
        amount: spargeAcidAmount,
        unit: 'ml',
      });
    }

    onSaveAdjustments({
      waterSourceId: selectedSourceId,
      waterTargetId: selectedTargetId,
      miscs: newMiscs,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      titleId="water-calculator-modal-title"
      backdropClassName="bg-black/70"
      maxWidthClass="max-w-4xl"
      containerClassName="rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
    >
      <div data-testid="water-calc-modal" className="contents">
        {/* Header */}
        <div className="p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h3 id="water-calculator-modal-title" className="text-lg font-bold text-white">
                Water Chemistry &amp; Acid Adjustments
              </h3>
              <p className="text-xs text-slate-400">
                Optimize source water mineral salts and calculate target mash &amp; sparge acidification.
              </p>
            </div>
          </div>

          <Button variant="icon" type="button" onClick={onClose} aria-label="Close" title="Close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Global Toolbar Strip: pH Summary, Fit Score & Operational Actions */}
        <div className="px-5 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="neutral"
              size="sm"
              data-testid="modal-initial-mash-ph"
              className="rounded-md"
            >
              Initial Mash pH: <span className="font-bold text-slate-100 font-mono tabular-nums">{preAcidPredictedPh.toFixed(2)}</span>
            </Badge>
            <Badge
              variant="warning"
              size="sm"
              data-testid="modal-predicted-mash-ph"
              className="rounded-md"
            >
              Adjusted Mash pH: <span className="font-bold font-mono tabular-nums">{liveMashPh.toFixed(2)}</span>
            </Badge>
            {/* M37_P2 — live Profile Fit Score badge (AC-4/AC-5, RA-2) */}
            {target && (
              <Badge
                variant={fitScorePct >= 90 ? 'emerald' : fitScorePct >= 75 ? 'amber' : 'slate'}
                size="sm"
                data-testid="water-calc-fit-score"
                className="rounded-md"
              >
                <Target className="w-3 h-3" />
                Fit: {fitScorePct.toFixed(0)}% ({fitScoreLabel})
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              data-testid="water-calc-reset-btn"
              onClick={handleReset}
              className="flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              data-testid="water-calc-auto-dose-btn"
              onClick={handleAutoAdjustAll}
              className="flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Optimize</span>
            </Button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 py-4 space-y-4 text-sm overflow-y-auto flex-1">
          {/* Section 1: Profiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="waterSourceSelect" className="block text-xs font-semibold text-slate-300 mb-1">Source Water Profile</label>
              <Select
                size="sm"
                id="waterSourceSelect"
                aria-label="Source Profile"
                value={selectedSourceId ?? ''}
                onChange={(e) => setSelectedSourceId(e.target.value || null)}
              >
                <option value="">-- None (0 ppm RO) --</option>
                {sourceProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <label htmlFor="waterTargetSelect" className="block text-xs font-semibold text-slate-300 mb-1">Target Water Profile</label>
              <Select
                size="sm"
                id="waterTargetSelect"
                aria-label="Target Profile"
                value={selectedTargetId ?? ''}
                onChange={(e) => setSelectedTargetId(e.target.value || null)}
              >
                <option value="">-- Select Target Profile --</option>
                {targetProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Section 2: Minerals Needed — unified input + total table */}
          <div className={SUBPANEL_CLASS} data-testid="minerals-needed">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <span>Minerals Needed</span>
                <span className="text-xs font-normal text-slate-400">Total batch volume: <span className="font-mono tabular-nums">{totalVolumeL.toFixed(1)} L</span></span>
              </h4>

              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-slate-400">Balance Strategy:</span>
                <Select
                  size="sm"
                  id="balanceStrategySelect"
                  aria-label="Balance Strategy"
                  value={balanceStrategy}
                  onChange={(e) => setBalanceStrategy(e.target.value as BalanceStrategy)}
                  className="min-w-[150px]"
                >
                  {BALANCE_STRATEGIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>

                {/* M37_P2 — live SO4:Cl ratio tag (AC-6) */}
                <Badge
                  variant={so4ClRatio.ratio !== null && so4ClRatio.ratio > 2 ? 'amber' : so4ClRatio.ratio !== null && so4ClRatio.ratio >= 0.8 ? 'neutral' : 'emerald'}
                  size="sm"
                  data-testid="water-calc-so4-cl-ratio"
                  className="rounded-md"
                >
                  SO₄²⁻ : Cl⁻ {so4ClRatio.ratio !== null ? `${so4ClRatio.ratio} · ${so4ClRatio.descriptor}` : '—'}
                </Badge>
              </div>
            </div>

            <Table>
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[14%]" />
                <col className="w-[27%]" />
                <col className="w-[27%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-700">
                  <TableHeaderCell>Mineral</TableHeaderCell>
                  <TableHeaderCell className="text-right">Needed</TableHeaderCell>
                  <TableHeaderCell className="text-right">Mash ({effectiveMashL.toFixed(1)} L)</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    <label className="flex items-center justify-end gap-1.5 cursor-pointer">
                      <span>Sparge ({effectiveSpargeL.toFixed(1)} L)</span>
                      <input
                        type="checkbox"
                        aria-label={`Sparge (${effectiveSpargeL.toFixed(1)} L)`}
                        data-testid="treat-sparge-water-toggle"
                        checked={treatSpargeWater}
                        onChange={(e) => handleToggleTreatSparge(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                    </label>
                  </TableHeaderCell>
                  <TableHeaderCell className="text-right">Total</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {SALT_NAMES.map((name) => {
                  const total = mineralTotalGrams(name, mashSalts, spargeSalts, treatSpargeWater);
                  const needed = suggestedSaltsMap[name];
                  return (
                    <tr key={name} data-testid={`mineral-needed-${slug(name)}`}>
                      <TableCell size="sm" variant="text" className="font-medium">{name}</TableCell>
                      <TableCell size="sm" className="text-right">
                        <span
                          data-testid={`mineral-needed-suggested-${slug(name)}`}
                          className={needed === 0 ? 'text-slate-400' : 'text-slate-300'}
                        >
                          {needed.toFixed(2)} g
                        </span>
                      </TableCell>
                      <TableCell size="sm">
                        <div className="flex items-center justify-end gap-1">
                          <NumberInput
                            type="number"
                            size="sm"
                            width="lg"
                            align="right"
                            id={`mash-salt-${name}`}
                            aria-label={`Mash ${name}`}
                            step="0.1"
                            min="0"
                            value={mashSalts[name] === 0 ? '' : mashSalts[name]}
                            placeholder="0.0"
                            onChange={(e) =>
                              setMashSalts({ ...mashSalts, [name]: Math.max(0, parseFloat(e.target.value) || 0) })
                            }
                            addonRight="g"
                          />
                        </div>
                      </TableCell>
                      <TableCell size="sm">
                        <div className="flex items-center justify-end gap-1">
                          <NumberInput
                            type="number"
                            size="sm"
                            width="lg"
                            align="right"
                            id={`sparge-salt-${name}`}
                            aria-label={`Sparge ${name}`}
                            step="0.1"
                            min="0"
                            disabled={!treatSpargeWater}
                            value={spargeSalts[name] === 0 ? '' : spargeSalts[name]}
                            placeholder="0.0"
                            onChange={(e) =>
                              setSpargeSalts({ ...spargeSalts, [name]: Math.max(0, parseFloat(e.target.value) || 0) })
                            }
                            className="disabled:opacity-40 disabled:cursor-not-allowed"
                            addonRight="g"
                          />
                        </div>
                      </TableCell>
                      <TableCell size="sm" className="text-right">
                        <span
                          data-testid={`mineral-needed-amount-${slug(name)}`}
                          className={total === 0 ? 'text-slate-400' : 'text-slate-100 font-bold'}
                        >
                          {total.toFixed(2)} g
                        </span>
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            {/* M37_P2 — per-ion target alignment deltas (AC-7). Shows each core
                ion's Target vs Adjusted (source + additions) vs Delta, with an
                emerald badge when in range (±5 ppm) and a signed delta badge
                otherwise. Recomputed live from finishedIons on every change. */}
            {targetIons && (
              <div className="mt-3 pt-3 border-t border-slate-800/60">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Ion Target Match
                  </h5>
                  <span className="text-[10px] text-slate-400">±5 ppm = in range</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {ION_KEYS.map((ion) => {
                    const delta = (ionDeltas ?? {})[ion];
                    const targetVal = targetIons[ion];
                    const adjustedVal = finishedIons[ion];
                    const inRange = delta !== undefined && Math.abs(delta) <= 5;
                    return (
                      <div
                        key={ion}
                        data-testid={`water-calc-ion-${ion}`}
                        className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/70 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400">{ION_LABELS[ion]}</span>
                          {inRange ? (
                            <Badge variant="emerald" size="sm" className="rounded text-[9px] px-1.5 py-0">
                              Target
                            </Badge>
                          ) : (
                            <Badge
                              variant={delta !== undefined && delta > 0 ? 'amber' : 'slate'}
                              size="sm"
                              className="rounded text-[9px] px-1.5 py-0"
                              data-testid={`water-calc-ion-delta-${ion}`}
                            >
                              {delta !== undefined && delta > 0 ? `+${delta.toFixed(0)}` : `${(delta ?? 0).toFixed(0)}`} ppm
                            </Badge>
                          )}
                        </div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-300">
                          {adjustedVal.toFixed(0)} <span className="text-slate-400">/ {targetVal.toFixed(0)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Acid Adjustments — structured FormField cards */}
          <div className={SUBPANEL_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-amber-400" />
                <span>Acid Adjustments</span>
              </h4>

              {/* Acid Selector in header line */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Acid Type:</span>
                <Select
                  size="sm"
                  id="acidTypeSelect"
                  aria-label="Acid Type"
                  value={acidType}
                  onChange={(e) => setAcidType(e.target.value as AcidType)}
                  className="min-w-[170px]"
                >
                  {ACID_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Mash Acidification Card */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="add-mash-acid" className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        id="add-mash-acid"
                        data-testid="add-mash-acid-toggle"
                        checked={addMashAcid}
                        onChange={(e) => handleToggleMashAcid(e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-200">Mash Acidification</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Enzymatic conversion &amp; extract efficiency (Target pH 5.20 – 5.50)
                  </p>

                  {/* Live Mash pH Readout Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 my-2.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      Initial: <span className="font-mono font-bold text-slate-100">{preAcidPredictedPh.toFixed(2)}</span>
                    </span>
                    <span className="text-slate-600">→</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      Target: <span className="font-mono font-bold text-slate-100">{targetMashPh.toFixed(2)}</span>
                    </span>
                    <span className="text-slate-600">→</span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300">
                      Adjusted: <span className="font-mono font-bold text-amber-400">{liveMashPh.toFixed(2)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-slate-800/60">
                  <FormField label="Target pH" htmlFor="targetMashPhInput" className="min-w-0 flex-1">
                    <NumberInput
                      type="number"
                      size="sm"
                      width="full"
                      align="right"
                      id="targetMashPhInput"
                      aria-label="Target Mash pH"
                      step="0.05"
                      min="4.5"
                      max="6.5"
                      disabled={!addMashAcid}
                      value={targetMashPh}
                      onChange={(e) => setTargetMashPh(parseFloat(e.target.value) || 5.3)}
                      className="disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </FormField>
                  <FormField label="Dosage" htmlFor="mashAcidDosageInput" className="min-w-0 flex-1">
                    <NumberInput
                      type="number"
                      size="sm"
                      width="full"
                      align="right"
                      id="mashAcidDosageInput"
                      aria-label="Mash Acid Dosage"
                      step="0.1"
                      min="0"
                      disabled={!addMashAcid}
                      value={mashAcidAmount === 0 ? '' : mashAcidAmount}
                      placeholder="0.0"
                      onChange={(e) => setMashAcidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="disabled:opacity-40 disabled:cursor-not-allowed"
                      addonRight={acidType === 'Acidulated Malt' ? 'g' : 'ml'}
                    />
                  </FormField>
                </div>
              </div>

              {/* Sparge Acidification Card */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="add-sparge-acid" className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        id="add-sparge-acid"
                        data-testid="add-sparge-acid-toggle"
                        checked={addSpargeAcid}
                        onChange={(e) => handleToggleSpargeAcid(e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-200">Sparge Acidification</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Neutralize alkalinity to prevent grain husk tannin extraction (Target pH 5.50)
                  </p>

                  {/* Live Sparge Info Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 my-2.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      Volume: <span className="font-mono font-bold text-slate-100">{effectiveSpargeL.toFixed(1)} L</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      Source HCO₃⁻: <span className="font-mono font-bold text-slate-100">{(source?.bicarbonate ?? 0).toFixed(0)} ppm</span>
                    </span>
                    {(source?.bicarbonate ?? 0) === 0 && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-[10px]">
                        0 ppm alkalinity (No acid needed)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-slate-800/60">
                  <FormField label="Target pH" htmlFor="targetSpargePhInput" className="min-w-0 flex-1">
                    <NumberInput
                      type="number"
                      size="sm"
                      width="full"
                      align="right"
                      id="targetSpargePhInput"
                      step="0.05"
                      min="5.0"
                      max="6.5"
                      disabled={!addSpargeAcid}
                      value={targetSpargePh}
                      onChange={(e) => setTargetSpargePh(parseFloat(e.target.value) || 5.5)}
                      className="disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </FormField>
                  <FormField label="Dosage" htmlFor="spargeAcidDosageInput" className="min-w-0 flex-1">
                    <NumberInput
                      type="number"
                      size="sm"
                      width="full"
                      align="right"
                      id="spargeAcidDosageInput"
                      aria-label="Sparge Acid Dosage"
                      step="0.1"
                      min="0"
                      disabled={!addSpargeAcid}
                      value={spargeAcidAmount === 0 ? '' : spargeAcidAmount}
                      placeholder="0.0"
                      onChange={(e) => setSpargeAcidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="disabled:opacity-40 disabled:cursor-not-allowed"
                      addonRight={acidType === 'Acidulated Malt' ? 'g' : 'ml'}
                    />
                  </FormField>
                </div>
              </div>

              {/* Total Acid Addition */}
              <div className="lg:col-span-2 flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-300 font-medium">Total Acid Addition:</span>
                <span className="font-mono tabular-nums font-bold text-amber-400 text-sm" data-testid="total-acid-addition">
                  {((addMashAcid ? mashAcidAmount : 0) + (addSpargeAcid ? spargeAcidAmount : 0)).toFixed(2)} {acidType === 'Acidulated Malt' ? 'g' : 'ml'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Grist Distilled pH Reference */}
          <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/60">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Grist Distilled Water pH Baseline
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {gristBreakdown.map((g) => (
                <div key={g.id} className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-slate-200 truncate max-w-[150px]">{g.name}</div>
                    <div className="text-slate-400 text-[11px]">{g.amountKg} kg · {g.ebc.toFixed(0)} EBC</div>
                  </div>
                  <div className="font-mono font-bold text-slate-300">pH {g.baseline.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={onClose}
            className="px-4"
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            type="button"
            data-testid="water-calc-save-btn"
            onClick={handleSave}
            className="px-5 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save to Recipe
          </Button>
        </div>
      </div>
    </Modal>
  );
};
