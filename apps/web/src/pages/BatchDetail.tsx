import { useState, useEffect, useMemo } from 'react';
import type { BatchStatus, BatchWithReadings, BatchWriteInput, ReadingWriteInput, BatchNoteWriteInput, CarbonationType } from '@truchabrew/shared-types';
import {
  calculateRecipeStats,
  measuredMashEfficiencyPct,
  resolveBeerVolume,
  abvBalling,
  apparentAttenuationPct,
  primingSugarG,
  forceCarbonationPsi,
  peakFermentationTempC,
  calculateFermentationProgress,
  buildFermentationChartModel,
  calculateCellarSchedule,
  detectFgStability,
  latestGravityReading,
  type CellarScheduleEvent,
  calculateFinishedIons,
  calculateResidualAlkalinity,
  predictMashPh,
  evaluateBatchCalibration,
  buildBrewSheetModel,
  deriveMeasurementTargets,
  type SensoryScoreInput,
} from '@truchabrew/calculations';
import {
  getBatch,
  updateBatch,
  deleteBatch,
  createBatch,
  createReading,
  updateReading,
  deleteReading,
  createBatchNote,
  updateBatchNote,
  deleteBatchNote,
  updateEquipmentProfile,
  updateBatchRecipeSnapshot,
  ApiClientError,
} from '../api/client';
import { useConfig } from '../context/ConfigContext';
import { FermentationChart } from '../components/FermentationChart';
import { CellarActionFeed } from '../components/CellarActionFeed';
import { ReadingLog } from '../components/ReadingLog';
import { MeasuredComparison } from '../components/MeasuredComparison';
import { SplitPackagingPanel } from '../components/SplitPackagingPanel';
import { PostBrewCalibrationModal } from '../components/PostBrewCalibrationModal';
import { SensoryEvaluationPanel } from '../components/SensoryEvaluationPanel';
import { BatchNoteLog } from '../components/BatchNoteLog';
import { StockCheckPanel } from '../components/StockCheckPanel';
import { BatchCostPanel } from '../components/BatchCostPanel';
import { BatchNutritionPanel } from '../components/BatchNutritionPanel';
import { BatchRecipeAdjustModal } from '../components/BatchRecipeAdjustModal';
import { BrewDayTracker } from '../components/BrewDayTracker';
import { BrewSheet } from '../components/BrewSheet';
import { StatsHeader } from '../components/StatsHeader';
import { TopBar } from '../components/TopBar';
import { PageContainer } from '../components/PageContainer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BatchStageTabs, type BatchStageTab } from '../components/BatchStageTabs';
import { ArrowLeft, RefreshCw, CornerDownRight, CheckCircle2, Sliders } from 'lucide-react';
import { Button, Input, NumberInput, Badge } from '../components/ui';
import {
  CARD_CLASS,
  CARD_STACK_GAP_CLASS,
  SECTION_HEADING_CLASS,
  METADATA_TEXT_CLASS,
  METRIC_TILE_CLASS,
  METRIC_LABEL_CLASS,
  METRIC_VALUE_CLASS,
  EMPTY_STATE_CLASS,
  LOADING_STATE_CLASS,
  ERROR_STATE_CLASS,
} from '../components/designSystem';

import type { EquipmentProfile, Recipe, EquipmentUpdateInput } from '@truchabrew/shared-types';

const SUGAR_FAMILY: readonly CarbonationType[] = ['Sugar', 'KegSugar'];
const FORCE_FAMILY: readonly CarbonationType[] = ['KegForce', 'KegForceQuick'];

const TAB_TO_STATUS: Record<BatchStageTab, BatchStatus> = {
  planning: 'Planning',
  brewing: 'Brewing',
  fermentation: 'Fermenting',
  packaging: 'Conditioning',
  completed: 'Completed',
};

const STATUS_TO_TAB: Record<BatchStatus, BatchStageTab> = {
  Planning: 'planning',
  Brewing: 'brewing',
  Fermenting: 'fermentation',
  Conditioning: 'packaging',
  Completed: 'completed',
};

const STATUS_TO_TAB_LABEL: Record<BatchStatus, string> = {
  Planning: 'Planning',
  Brewing: 'Brewing',
  Fermenting: 'Fermentation',
  Conditioning: 'Packaging',
  Completed: 'Completed',
};

// M5.5_P5 §2.2 — the single 14-field formData projection. Used at exactly
// three call sites: the load .then, handleSave's success path, and
// handleCancel.
function projectFormData(b: BatchWithReadings): BatchWriteInput {
  return {
    name: b.name,
    batchNo: b.batchNo,
    brewer: b.brewer ?? null,
    brewDate: b.brewDate ?? null,
    status: b.status,
    measuredPreBoilGravity: b.measuredPreBoilGravity,
    measuredMashPh: b.measuredMashPh,
    measuredBoilSizeL: b.measuredBoilSizeL,
    measuredBoilTimeMin: b.measuredBoilTimeMin,
    measuredOg: b.measuredOg,
    measuredFg: b.measuredFg,
    measuredBottlingSizeL: b.measuredBottlingSizeL,
    carbonationType: b.carbonationType,
    carbonationVolumesTarget: b.carbonationVolumesTarget,
    carbonationTempC: b.carbonationTempC,
    tasteNotes: b.tasteNotes,
    tasteRating: b.tasteRating,
  };
}

export interface BatchDetailProps {
  batchId: string;
  onBack: () => void;
  /** Fired after a successful delete (§3.5.5) — the caller navigates away (goToBatches()). */
  onDeleted: () => void;
  /** Fired after a successful Rebrew (§1.4/AC-15) with the newly created batch's id — the caller navigates to it. */
  onRebrewed: (newBatchId: string) => void;
  /** Optional callback to open the mobile off-canvas navigation drawer (M26_P1 Amendment 1). */
  onOpenMobileNav?: () => void;
}

export function BatchDetail({ batchId, onBack, onDeleted, onRebrewed, onOpenMobileNav }: BatchDetailProps) {
  // §2.2.4, binding: statsSnapshot is a historical record and is rendered
  // as stored, never recomputed under a newly-selected strategy — config is
  // read here ONLY to feed the fallback recompute path below (statsSnapshot
  // === null), never to touch a present snapshot.
  const { config } = useConfig();
  const [activeTab, setActiveTab] = useState<BatchStageTab>('planning');
  // Inline identity-header editing (batch name/number/brewer/brew date) — replaces
  // the old separate "Batch Details" form card; clicking the name or batch number
  // toggles this on, still staging into the same formData the header Save Changes
  // button already commits.
  const [identityEditOpen, setIdentityEditOpen] = useState(false);
  const [batch, setBatch] = useState<BatchWithReadings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<BatchWriteInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Deliberately separate from `error`: `error` gates the early-return
  // full-page failure view below (initial load only). Reusing it for a
  // failed SAVE would blank out the whole page — including the form the
  // user was mid-edit on — on every rejected status transition.
  const [saveError, setSaveError] = useState<string | null>(null);
  // A THIRD error state, separate from both `error` and `saveError`. Gates
  // ONLY reading-mutation failures.
  const [readingError, setReadingError] = useState<string | null>(null);
  // A FOURTH error state, separate from `error`, `saveError` and
  // `readingError`. Gates ONLY note-mutation failures.
  const [noteError, setNoteError] = useState<string | null>(null);

  // NEW in M13_P1 — batch delete (§3.5.5, AC-37/AC-38).
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // NEW in M13_P1 — Rebrew (§1.4, AC-15).
  const [rebrewBusy, setRebrewBusy] = useState(false);
  const [rebrewError, setRebrewError] = useState<string | null>(null);

  // NEW in M15_P1 — in-batch recipe adjustment modal (spec §1.2).
  const [recipeAdjustOpen, setRecipeAdjustOpen] = useState(false);

  // F-7 fix (2026-08-19 critic follow-up) — StockCheckPanel fetches its
  // required-quantity data once per `batchId` and has no dependency on
  // `recipeSnapshot`, so after an in-batch adjustment saves it kept showing
  // pre-substitution required amounts until the user left and re-entered
  // the tab. Bumping this key on a successful adjustment save forces
  // StockCheckPanel to remount (and therefore refetch) with fresh data.
  // Server-side deduction math was already correct — this is purely a
  // client staleness fix.
  const [stockCheckRefreshKey, setStockCheckRefreshKey] = useState(0);

  // NEW in M15_P1 — "Start Fermentation" hand-off (spec §1.5 / AC-15).
  const [fermentationBusy, setFermentationBusy] = useState(false);
  const [fermentationError, setFermentationError] = useState<string | null>(null);

  // NEW in M16_P1 — "Advance to Conditioning" hand-off (spec §1.5 / AC-14).
  const [conditioningBusy, setConditioningBusy] = useState(false);
  const [conditioningError, setConditioningError] = useState<string | null>(null);

  // NEW in M17_P1 — Calibration Modal state.
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);

  // Persistent brew day checked additions and checklist items across tab navigation & screen navigation (FEAT-037).
  const BREW_DAY_STORAGE_KEY_PREFIX = 'truchabrew_brewday_';

  const loadSavedBrewDayState = (bId: string) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = localStorage.getItem(`${BREW_DAY_STORAGE_KEY_PREFIX}${bId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const saveBrewDayState = (bId: string, stateData: Record<string, unknown>) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.setItem(`${BREW_DAY_STORAGE_KEY_PREFIX}${bId}`, JSON.stringify(stateData));
    } catch {
      // ignore
    }
  };

  const clearSavedBrewDayState = (bId: string) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.removeItem(`${BREW_DAY_STORAGE_KEY_PREFIX}${bId}`);
    } catch {
      // ignore
    }
  };

  const [brewDayCheckedItemIds, setBrewDayCheckedItemIds] = useState<Set<string>>(new Set());
  const [brewDayUserAddedIds, setBrewDayUserAddedIds] = useState<Set<string>>(new Set());
  const [brewDayActiveStageIndex, setBrewDayActiveStageIndex] = useState<number>(0);
  const [brewDaySelectedMashStepIndex, setBrewDaySelectedMashStepIndex] = useState<number>(0);
  const [brewDayRemainingByKey, setBrewDayRemainingByKey] = useState<Record<string, number>>({});
  const [brewDayTargetEndByKey, setBrewDayTargetEndByKey] = useState<Record<string, number>>({});
  const [brewDayRunning, setBrewDayRunning] = useState<boolean>(false);
  const [brewDayFiredBoilAlarms, setBrewDayFiredBoilAlarms] = useState<Set<string>>(new Set());

  // String buffers for decimal inputs to support direct typing without premature numeric parsing (FEAT-038).
  const [preBoilGravityStr, setPreBoilGravityStr] = useState<string>('');
  const [mashPhStr, setMashPhStr] = useState<string>('');
  const [boilSizeLStr, setBoilSizeLStr] = useState<string>('');
  const [boilTimeMinStr, setBoilTimeMinStr] = useState<string>('');
  const [ogStr, setOgStr] = useState<string>('');
  const [fgStr, setFgStr] = useState<string>('');
  const [carbonationTempCStr, setCarbonationTempCStr] = useState<string>('');

  const syncInputStringsFromBatch = (b: BatchWithReadings) => {
    setPreBoilGravityStr(b.measuredPreBoilGravity !== null && b.measuredPreBoilGravity !== undefined ? String(b.measuredPreBoilGravity) : '');
    setMashPhStr(b.measuredMashPh !== null && b.measuredMashPh !== undefined ? String(b.measuredMashPh) : '');
    setBoilSizeLStr(b.measuredBoilSizeL !== null && b.measuredBoilSizeL !== undefined ? String(b.measuredBoilSizeL) : '');
    setBoilTimeMinStr(b.measuredBoilTimeMin !== null && b.measuredBoilTimeMin !== undefined ? String(b.measuredBoilTimeMin) : '');
    setOgStr(b.measuredOg !== null && b.measuredOg !== undefined ? String(b.measuredOg) : '');
    setFgStr(b.measuredFg !== null && b.measuredFg !== undefined ? String(b.measuredFg) : '');
    setCarbonationTempCStr(b.carbonationTempC !== null && b.carbonationTempC !== undefined ? String(b.carbonationTempC) : '');
  };

  const handleToggleBrewDayChecklist = (id: string) => {
    setBrewDayCheckedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleBrewDayAddition = (id: string) => {
    setBrewDayUserAddedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddBrewDayFiredBoilAlarm = (alarmId: string) => {
    setBrewDayFiredBoilAlarms((prev) => new Set(prev).add(alarmId));
  };

  const handleResetBrewDayTracker = () => {
    clearSavedBrewDayState(batchId);
    setBrewDayActiveStageIndex(0);
    setBrewDaySelectedMashStepIndex(0);
    setBrewDayRemainingByKey({});
    setBrewDayTargetEndByKey({});
    setBrewDayRunning(false);
    setBrewDayFiredBoilAlarms(new Set());
    setBrewDayUserAddedIds(new Set());
    setBrewDayCheckedItemIds(new Set());
  };

  useEffect(() => {
    // Reset every piece of local UI state that isn't itself re-derived by
    // the fetch below — otherwise a Rebrew navigation (same mounted
    // component instance, new batchId prop) would carry the PREVIOUS
    // batch's active tab / dialog / error state into the new batch's view.
    setActiveTab('planning');
    setError(null);
    setSaveError(null);
    setReadingError(null);
    setNoteError(null);
    setDeleteOpen(false);
    setDeleteError(null);
    setRebrewError(null);
    setRecipeAdjustOpen(false);
    setFermentationError(null);
    setConditioningError(null);
    setIsCalibrationModalOpen(false);

    // Restore saved brew day tracker state if available
    const saved = loadSavedBrewDayState(batchId);
    if (saved) {
      setBrewDayActiveStageIndex(typeof saved.activeStageIndex === 'number' ? saved.activeStageIndex : 0);
      setBrewDaySelectedMashStepIndex(typeof saved.selectedMashStepIndex === 'number' ? saved.selectedMashStepIndex : 0);
      setBrewDayRemainingByKey(saved.remainingByKey ?? {});
      setBrewDayTargetEndByKey(saved.targetEndByKey ?? {});
      setBrewDayRunning(Boolean(saved.running));
      setBrewDayCheckedItemIds(new Set(Array.isArray(saved.checkedItemIds) ? saved.checkedItemIds : []));
      setBrewDayUserAddedIds(new Set(Array.isArray(saved.userAddedIds) ? saved.userAddedIds : []));
      setBrewDayFiredBoilAlarms(new Set(Array.isArray(saved.firedBoilAlarms) ? saved.firedBoilAlarms : []));
    } else {
      setBrewDayActiveStageIndex(0);
      setBrewDaySelectedMashStepIndex(0);
      setBrewDayRemainingByKey({});
      setBrewDayTargetEndByKey({});
      setBrewDayRunning(false);
      setBrewDayFiredBoilAlarms(new Set());
      setBrewDayUserAddedIds(new Set());
      setBrewDayCheckedItemIds(new Set());
    }

    getBatch(batchId)
      .then((b) => {
        setBatch(b);
        setActiveTab(STATUS_TO_TAB[b.status] ?? 'planning');
        setActiveTab(saved?.activeTab ?? STATUS_TO_TAB[b.status] ?? 'planning');
        setFormData(projectFormData(b));
        syncInputStringsFromBatch(b);
      })
      .catch((err: unknown) => setError(err instanceof ApiClientError ? err.message : 'Failed to load batch.'));
  }, [batchId]);

  useEffect(() => {
    if (!batchId) return;
    const hasAnyProgress =
      brewDayActiveStageIndex > 0 ||
      brewDaySelectedMashStepIndex > 0 ||
      brewDayRunning ||
      Object.keys(brewDayRemainingByKey).length > 0 ||
      brewDayCheckedItemIds.size > 0 ||
      brewDayUserAddedIds.size > 0 ||
      brewDayFiredBoilAlarms.size > 0;

    if (hasAnyProgress) {
      saveBrewDayState(batchId, {
        activeStageIndex: brewDayActiveStageIndex,
        selectedMashStepIndex: brewDaySelectedMashStepIndex,
        remainingByKey: brewDayRemainingByKey,
        targetEndByKey: brewDayTargetEndByKey,
        running: brewDayRunning,
        checkedItemIds: Array.from(brewDayCheckedItemIds),
        userAddedIds: Array.from(brewDayUserAddedIds),
        firedBoilAlarms: Array.from(brewDayFiredBoilAlarms),
        savedAt: Date.now(),
      });
    }
    saveBrewDayState(batchId, {
      activeTab,
      activeStageIndex: brewDayActiveStageIndex,
      selectedMashStepIndex: brewDaySelectedMashStepIndex,
      remainingByKey: brewDayRemainingByKey,
      targetEndByKey: brewDayTargetEndByKey,
      running: brewDayRunning,
      checkedItemIds: Array.from(brewDayCheckedItemIds),
      userAddedIds: Array.from(brewDayUserAddedIds),
      firedBoilAlarms: Array.from(brewDayFiredBoilAlarms),
      savedAt: Date.now(),
    });
  }, [
    batchId,
    activeTab,
    brewDayActiveStageIndex,
    brewDaySelectedMashStepIndex,
    brewDayRemainingByKey,
    brewDayTargetEndByKey,
    brewDayRunning,
    brewDayCheckedItemIds,
    brewDayUserAddedIds,
    brewDayFiredBoilAlarms,
  ]);

  // M5.5_P5: formData is populated from the load path (not only while
  // editing) and stays non-null for the entire lifetime of a loaded batch.
  const currentData = formData ?? batch;

  const {
    stats,
    statsAreRecomputed,
    calculatedEfficiency,
    fermentationProgress,
    chartModel,
    cellarSchedule,
    fgStability,
    liveEstimatedAbv,
    measuredFigures,
    predictedMashPh,
    calibrationEvaluation,
  } = useMemo(() => {
    if (!batch) {
      return {
        stats: null,
        statsAreRecomputed: false,
        calculatedEfficiency: null,
        fermentationProgress: { hasGravityReading: false as const },
        chartModel: { hasPoints: false as const },
        cellarSchedule: [],
        fgStability: { isStable: false, readingCount: 0, latestSg: null, priorSg: null, deltaSg: null, elapsedHours: null },
        liveEstimatedAbv: null,
        predictedMashPh: null,
        calibrationEvaluation: null,
        measuredFigures: {
          isRecalculated: false,
          originalGravity: null,
          finalGravity: null,
          abv: null,
          attenuationPct: null,
          mashEfficiencyPct: null,
          peakFermentationTempC: null,
          beerVolumeL: null,
          primingSugarG: null,
          primingSugarEquivGPerL: null,
          carbonationForcePsi: null,
        },
      };
    }
    const isRecomputed = batch.statsSnapshot === null;
    const calculatedStats =
      batch.statsSnapshot ??
      calculateRecipeStats(batch.recipeSnapshot, { abvFormula: config.abvFormula, ibuFormula: config.ibuFormula });

    const progress = calculateFermentationProgress({
      readings: batch.readings,
      measuredOg: batch.measuredOg,
      estimatedOg: calculatedStats.og,
      fermentationStartDate: batch.fermentationStartDate,
    });
    const chart = buildFermentationChartModel({
      readings: batch.readings,
      fermentationStartDate: batch.fermentationStartDate,
      fermentationProfile: batch.recipeSnapshot.fermentationProfile,
    });
    const cellarSchedule = calculateCellarSchedule({
      fermentationStartDate: batch.fermentationStartDate,
      recipe: batch.recipeSnapshot,
      readings: batch.readings,
      notes: batch.notes,
    });
    const fgStability = detectFgStability(batch.readings);
    const liveEstimatedAbv =
      progress.hasGravityReading && progress.latestSg !== null
        ? abvBalling(progress.originalGravity, progress.latestSg)
        : null;

    let resolvedMeasuredFigures;
    if (batch.closingSnapshot !== null) {
      const cs = batch.closingSnapshot;
      resolvedMeasuredFigures = {
        isRecalculated: false,
        originalGravity: cs.originalGravity,
        finalGravity: cs.finalGravity,
        abv: cs.abv,
        attenuationPct: cs.apparentAttenuationPct,
        mashEfficiencyPct: cs.mashEfficiencyPct,
        peakFermentationTempC: cs.peakFermentationTempC,
        beerVolumeL: cs.beerVolumeL,
        primingSugarG: cs.primingSugarG,
        primingSugarEquivGPerL: cs.primingSugarEquivGPerL,
        carbonationForcePsi: cs.carbonationForcePsi,
      };
    } else {
      const og = batch.measuredOg;
      const fg = batch.measuredFg;
      const abv = og !== null && fg !== null ? abvBalling(og, fg) : null;
      const attenuationPct = og !== null && fg !== null ? apparentAttenuationPct(og, fg) : null;
      const liveMashEfficiencyPct = measuredMashEfficiencyPct(batch.recipeSnapshot, batch.measuredPreBoilGravity);
      const peakTemp = peakFermentationTempC(batch.readings);
      const { beerVolumeL } = resolveBeerVolume(batch.measuredBottlingSizeL, batch.recipeSnapshot.equipment.batchSizeL);

      let primingSugarGValue: number | null = null;
      let primingSugarEquivGPerLValue: number | null = null;
      if (
        batch.carbonationType !== null &&
        SUGAR_FAMILY.includes(batch.carbonationType) &&
        batch.carbonationVolumesTarget !== null &&
        peakTemp !== null &&
        beerVolumeL > 0
      ) {
        primingSugarGValue = primingSugarG({
          volumesCO2Target: batch.carbonationVolumesTarget,
          peakFermentationTempC: peakTemp,
          beerVolumeL,
        });
        primingSugarEquivGPerLValue = primingSugarGValue / beerVolumeL;
      }

      let carbonationForcePsiValue: number | null = null;
      if (
        batch.carbonationType !== null &&
        FORCE_FAMILY.includes(batch.carbonationType) &&
        batch.carbonationVolumesTarget !== null &&
        batch.carbonationTempC !== null
      ) {
        carbonationForcePsiValue = forceCarbonationPsi({ volumesCO2: batch.carbonationVolumesTarget, tempC: batch.carbonationTempC });
      }

      resolvedMeasuredFigures = {
        isRecalculated: batch.status === 'Completed',
        originalGravity: og,
        finalGravity: fg,
        abv,
        attenuationPct,
        mashEfficiencyPct: liveMashEfficiencyPct,
        peakFermentationTempC: peakTemp,
        beerVolumeL,
        primingSugarG: primingSugarGValue,
        primingSugarEquivGPerL: primingSugarEquivGPerLValue,
        carbonationForcePsi: carbonationForcePsiValue,
      };
    }

    const eff =
      batch.closingSnapshot !== null
        ? resolvedMeasuredFigures.mashEfficiencyPct
        : measuredMashEfficiencyPct(batch.recipeSnapshot, currentData?.measuredPreBoilGravity ?? null);

    const recipe = batch.recipeSnapshot;
    const calcStats = calculatedStats;
    const finishedIons = calculateFinishedIons(null, calcStats.totalWaterL, recipe.miscs);
    const ra = calculateResidualAlkalinity(finishedIons.bicarbonate, finishedIons.calcium, finishedIons.magnesium);
    const predictedPh = predictMashPh(recipe.fermentables, calcStats.totalWaterL, ra);

    const calibration = evaluateBatchCalibration({
      recipe: batch.recipeSnapshot,
      measuredPreBoilGravity: currentData?.measuredPreBoilGravity ?? batch.measuredPreBoilGravity,
      measuredOg: currentData?.measuredOg ?? batch.measuredOg,
      measuredFg: currentData?.measuredFg ?? batch.measuredFg,
      measuredPreBoilSizeL: currentData?.measuredBoilSizeL ?? batch.measuredBoilSizeL,
      measuredPostBoilSizeL: currentData?.measuredBottlingSizeL ?? batch.measuredBottlingSizeL,
      measuredBottlingSizeL: currentData?.measuredBottlingSizeL ?? batch.measuredBottlingSizeL,
      measuredBoilTimeMin: currentData?.measuredBoilTimeMin ?? batch.measuredBoilTimeMin,
    });

    return {
      stats: calculatedStats,
      statsAreRecomputed: isRecomputed,
      calculatedEfficiency: eff,
      fermentationProgress: progress,
      chartModel: chart,
      cellarSchedule,
      fgStability,
      liveEstimatedAbv,
      measuredFigures: resolvedMeasuredFigures,
      predictedMashPh: predictedPh,
      calibrationEvaluation: calibration,
    };
  }, [batch, currentData, config.abvFormula, config.ibuFormula]);

  // M18_P1 §1.1/§2.4 — Brew Sheet Viewer model. Declared as its own useMemo,
  // unconditionally, ahead of every early return below (no conditional-hook
  // regression). null only while the batch hasn't loaded yet; the Brewing
  // tab that reads it never renders before `batch` is non-null.
  const brewSheetModel = useMemo(() => {
    if (!batch || stats === null) return null;
    return buildBrewSheetModel({
      recipe: batch.recipeSnapshot,
      stats,
      batchName: batch.name,
      carbonationVolumesTarget: currentData?.carbonationVolumesTarget ?? batch.carbonationVolumesTarget,
    });
  }, [batch, stats, currentData]);

  // M18_P1 §1.3/§2.4 — expected-target placeholders for the five Brew Day
  // Measurements fields. Same null-until-loaded guard as brewSheetModel.
  const measurementTargets = useMemo(() => {
    if (!batch) return null;
    return deriveMeasurementTargets({
      stats,
      equipment: batch.recipeSnapshot.equipment,
      predictedMashPh,
      mashProfileTargetPh: batch.recipeSnapshot.mashProfile?.targetPh ?? null,
    });
  }, [batch, stats, predictedMashPh]);

  const backControl = (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      onClick={onBack}
      title="Back"
      aria-label="Back"
    >
      <ArrowLeft className="w-4 h-4" />
    </Button>
  );

  if (error) {
    return (
      <>
        <TopBar title="Batch" leading={backControl} onOpenMobileNav={onOpenMobileNav} />
        <PageContainer>
          <div className={ERROR_STATE_CLASS}>Failed to load batch. {error}</div>
        </PageContainer>
      </>
    );
  }

  if (!batch || !formData) {
    return (
      <>
        <TopBar title="Batch" leading={backControl} onOpenMobileNav={onOpenMobileNav} />
        <PageContainer>
          <div className={LOADING_STATE_CLASS}>Loading batch…</div>
        </PageContainer>
      </>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateBatch(batchId, formData);
      setBatch(updated);
      setFormData(projectFormData(updated));
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : 'Failed to update batch.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(projectFormData(batch));
    syncInputStringsFromBatch(batch);
  };

  const handleCreateReading = async (input: ReadingWriteInput) => {
    try {
      const created = await createReading(batchId, input);
      setBatch((prev) => (prev ? { ...prev, readings: [...prev.readings, created] } : prev));
      setReadingError(null);
    } catch (err) {
      setReadingError(err instanceof ApiClientError ? err.message : 'Failed to add reading.');
      throw err;
    }
  };

  const handleUpdateReading = async (readingId: string, input: ReadingWriteInput) => {
    try {
      const updated = await updateReading(batchId, readingId, input);
      setBatch((prev) => (prev ? { ...prev, readings: prev.readings.map((r) => (r.id === readingId ? updated : r)) } : prev));
      setReadingError(null);
    } catch (err) {
      setReadingError(err instanceof ApiClientError ? err.message : 'Failed to update reading.');
      throw err;
    }
  };

  const handleDeleteReading = async (readingId: string) => {
    try {
      await deleteReading(batchId, readingId);
      setBatch((prev) => (prev ? { ...prev, readings: prev.readings.filter((r) => r.id !== readingId) } : prev));
      setReadingError(null);
    } catch (err) {
      setReadingError(err instanceof ApiClientError ? err.message : 'Failed to delete reading.');
      throw err;
    }
  };

  const handleCreateNote = async (input: BatchNoteWriteInput) => {
    try {
      const created = await createBatchNote(batchId, input);
      setBatch((prev) => (prev ? { ...prev, notes: [...prev.notes, created] } : prev));
      setNoteError(null);
    } catch (err) {
      setNoteError(err instanceof ApiClientError ? err.message : 'Failed to add note.');
      throw err;
    }
  };

  const handleUpdateNote = async (noteId: string, input: BatchNoteWriteInput) => {
    try {
      const updated = await updateBatchNote(batchId, noteId, input);
      setBatch((prev) => (prev ? { ...prev, notes: prev.notes.map((n) => (n.id === noteId ? updated : n)) } : prev));
      setNoteError(null);
    } catch (err) {
      setNoteError(err instanceof ApiClientError ? err.message : 'Failed to update note.');
      throw err;
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteBatchNote(batchId, noteId);
      setBatch((prev) => (prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : prev));
      setNoteError(null);
    } catch (err) {
      setNoteError(err instanceof ApiClientError ? err.message : 'Failed to delete note.');
      throw err;
    }
  };

  // (AC-38). The busy flag clears in `finally` on both paths.
  const handleDeleteClick = () => {
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await deleteBatch(batchId);
      setDeleteOpen(false);
      onDeleted();
    } catch (err) {
      setDeleteOpen(false);
      setDeleteError(err instanceof ApiClientError ? err.message : 'Failed to delete batch.');
    } finally {
      setDeleteBusy(false);
    }
  };

  // Rebrew (§1.4/AC-15). Judgment call flagged for critic review: no
  // backend clone-from-frozen-snapshot endpoint exists (Amendment 2 scoped
  // the backend exception narrowly to Delete only), so Rebrew reuses the
  // existing "Brew This" contract — createBatch(recipeId) against the
  // batch's ORIGINAL recipe id, exactly as the recipe editor's "Brew This"
  // already does. If the source recipe has since changed, the new batch
  // reflects the recipe's CURRENT state, not this batch's frozen snapshot.
  const handleRebrew = async () => {
    setRebrewBusy(true);
    setRebrewError(null);
    try {
      const created = await createBatch(batch.recipeId);
      onRebrewed(created.id);
    } catch (err) {
      setRebrewError(err instanceof ApiClientError ? err.message : 'Failed to create batch.');
    } finally {
      setRebrewBusy(false);
    }
  };

  const handleStartFermentation = async () => {
    setFermentationBusy(true);
    setFermentationError(null);
    try {
      const updated = await updateBatch(batchId, { ...formData, status: 'Fermenting' });
      setBatch(updated);
      setFormData(projectFormData(updated));
      setActiveTab('fermentation');
    } catch (err) {
      setFermentationError(err instanceof ApiClientError ? err.message : 'Failed to start fermentation.');
    } finally {
      setFermentationBusy(false);
    }
  };

  // NEW in M16_P1 — "Advance to Conditioning" 1-click hand-off (spec §1.5 / AC-14).
  const handleAdvanceToConditioning = async () => {
    setConditioningBusy(true);
    setConditioningError(null);
    try {
      const latestSg = latestGravityReading(batch.readings)?.sg ?? null;
      const fgToSet = formData.measuredFg ?? latestSg;
      const updated = await updateBatch(batchId, {
        ...formData,
        status: 'Conditioning',
        measuredFg: fgToSet,
      });
      setBatch(updated);
      setFormData(projectFormData(updated));
      setActiveTab('packaging');
    } catch (err) {
      setConditioningError(err instanceof ApiClientError ? err.message : 'Failed to advance to conditioning.');
    } finally {
      setConditioningBusy(false);
    }
  };

  // NEW in M16_P1 — 1-click Mark Done for scheduled cellar actions.
  const handleMarkCellarActionDone = async (event: CellarScheduleEvent) => {
    const noteText = `[Cellar: ${event.id}] ${event.title}`;
    await handleCreateNote({ note: noteText });
  };

  // NEW in M17_P1 — Post-Brew Equipment & Recipe Calibration Handlers.
  const handleUpdateEquipmentProfile = async (profileId: string, patch: Partial<EquipmentProfile>) => {
    if (!batch) return;
    const base = batch.recipeSnapshot.equipment;
    const fullInput: EquipmentUpdateInput = {
      name: patch.name ?? base.name,
      batchSizeL: patch.batchSizeL ?? base.batchSizeL,
      boilTimeMin: patch.boilTimeMin ?? base.boilTimeMin,
      boilOffRateLPerHour: patch.boilOffRateLPerHour ?? base.boilOffRateLPerHour,
      trubChillerLossL: patch.trubChillerLossL ?? base.trubChillerLossL,
      mashEfficiencyPct: patch.mashEfficiencyPct ?? base.mashEfficiencyPct,
      brewhouseEfficiencyPct: patch.brewhouseEfficiencyPct ?? base.brewhouseEfficiencyPct,
      hopUtilizationPct: patch.hopUtilizationPct ?? base.hopUtilizationPct,
      mashWaterRatioLPerKg: patch.mashWaterRatioLPerKg ?? base.mashWaterRatioLPerKg,
      grainAbsorptionLPerKg: patch.grainAbsorptionLPerKg ?? base.grainAbsorptionLPerKg,
      hopstandUtilizationFactor: patch.hopstandUtilizationFactor ?? base.hopstandUtilizationFactor,
      hopstandTemperatureC: patch.hopstandTemperatureC ?? base.hopstandTemperatureC,
      spargeTemperatureC: patch.spargeTemperatureC ?? base.spargeTemperatureC,
      mashTunHeatCapacityL: patch.mashTunHeatCapacityL ?? base.mashTunHeatCapacityL,
      grainTemperatureC: patch.grainTemperatureC ?? base.grainTemperatureC,
      notes: patch.notes ?? base.notes,
      ...(patch.altitudeMeters !== undefined || base.altitudeMeters !== undefined
        ? { altitudeMeters: patch.altitudeMeters ?? base.altitudeMeters }
        : {}),
      ...(patch.calcStrikeWithThermalMass !== undefined || base.calcStrikeWithThermalMass !== undefined
        ? { calcStrikeWithThermalMass: patch.calcStrikeWithThermalMass ?? base.calcStrikeWithThermalMass }
        : {}),
      ...(patch.mashTunDeadSpaceL !== undefined || base.mashTunDeadSpaceL !== undefined
        ? { mashTunDeadSpaceL: patch.mashTunDeadSpaceL ?? base.mashTunDeadSpaceL }
        : {}),
      ...(patch.kettleLossL !== undefined || base.kettleLossL !== undefined
        ? { kettleLossL: patch.kettleLossL ?? base.kettleLossL }
        : {}),
      ...(patch.mashTunWeightKg !== undefined || base.mashTunWeightKg !== undefined
        ? { mashTunWeightKg: patch.mashTunWeightKg ?? base.mashTunWeightKg }
        : {}),
      ...(patch.mashTunHeatCapacity !== undefined || base.mashTunHeatCapacity !== undefined
        ? { mashTunHeatCapacity: patch.mashTunHeatCapacity ?? base.mashTunHeatCapacity }
        : {}),
    };
    await updateEquipmentProfile(profileId, fullInput);
  };

  const handleUpdateRecipeTarget = async (_recipeId: string, patch: Partial<Recipe>) => {
    if (batch) {
      const updated = await updateBatchRecipeSnapshot(batch.id, { ...batch.recipeSnapshot, ...patch }, true);
      setBatch(updated);
    }
  };

  // NEW in M17_P1 — Sensory Evaluation Handler.
  const handleSaveSensoryEvaluation = async (data: {
    totalScore: number;
    tier: string;
    starRating: number;
    notes: string;
    scoreBreakdown: SensoryScoreInput;
  }) => {
    if (!batch) return;
    const updated = await updateBatch(batch.id, {
      ...formData,
      tasteRating: data.starRating,
      tasteNotes: data.notes || formData.tasteNotes,
    });
    setBatch(updated);
    setFormData(projectFormData(updated));

    await createBatchNote(batch.id, {
      note: `[Sensory: ${data.tier}] Score: ${data.totalScore}/50 (Aroma: ${data.scoreBreakdown.aroma}/12, App: ${data.scoreBreakdown.appearance}/3, Flavor: ${data.scoreBreakdown.flavor}/20, Mouthfeel: ${data.scoreBreakdown.mouthfeel}/5, Overall: ${data.scoreBreakdown.overall}/10). ${data.notes}`,
    });
    const reloaded = await getBatch(batch.id);
    setBatch(reloaded);
  };

  // NEW in M15_P1 — feeds BrewDayTracker's refractometer/thermal-expansion
  // precision tools (spec §1.4) back into the SAME formData the Brewing
  // measurements form already edits, so a value applied from a tool and one
  // typed directly into the form stay in the one source of truth.
  const handleMeasuredFieldChange = (patch: Partial<Pick<BatchWriteInput, 'measuredPreBoilGravity' | 'measuredOg' | 'measuredBoilSizeL'>>) => {
    setFormData({ ...formData, ...patch });
    if (patch.measuredPreBoilGravity !== undefined) {
      setPreBoilGravityStr(patch.measuredPreBoilGravity !== null ? String(patch.measuredPreBoilGravity) : '');
    }
    if (patch.measuredOg !== undefined) {
      setOgStr(patch.measuredOg !== null ? String(patch.measuredOg) : '');
    }
    if (patch.measuredBoilSizeL !== undefined) {
      setBoilSizeLStr(patch.measuredBoilSizeL !== null ? String(patch.measuredBoilSizeL) : '');
    }
  };

  const statusBadge = (
    <Badge data-testid="batch-status-badge" variant={batch.status}>
      {batch.status}
    </Badge>
  );

  const latestReading = batch.readings.length > 0 ? batch.readings[batch.readings.length - 1] : null;

  return (
    <>
      <TopBar title={batch.name} leading={backControl} onOpenMobileNav={onOpenMobileNav}>
        {batch.status === 'Completed' && (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            data-testid="batch-rebrew-btn"
            disabled={rebrewBusy}
            onClick={handleRebrew}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rebrewBusy ? 'animate-spin' : ''}`} />
            {rebrewBusy ? 'Creating…' : 'Brew Again'}
          </Button>
        )}

        <Button
          variant="danger"
          size="sm"
          type="button"
          data-testid="batch-delete-btn"
          onClick={handleDeleteClick}
          disabled={deleteBusy}
        >
          Delete
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          data-testid="batch-discard-btn"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Discard Changes
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="button"
          data-testid="batch-save-btn"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </TopBar>



      <ConfirmDialog
        open={deleteOpen}
        busy={deleteBusy}
        title={`Delete "${batch.name}"?`}
        message="This cannot be undone. All readings and notes for this batch are deleted too."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />


      <BatchRecipeAdjustModal
        open={recipeAdjustOpen}
        batch={batch}
        onClose={() => setRecipeAdjustOpen(false)}
        onSaved={(updated) => {
          setBatch(updated);
          setFormData(projectFormData(updated));
          setStockCheckRefreshKey((k) => k + 1);
        }}
      />


      <PageContainer>
        <div className={CARD_STACK_GAP_CLASS}>
          {saveError && <div className={ERROR_STATE_CLASS}>Failed to save batch. {saveError}</div>}
          {deleteError && <div className={ERROR_STATE_CLASS}>Failed to delete batch. {deleteError}</div>}
          {rebrewError && <div className={ERROR_STATE_CLASS}>Failed to create batch. {rebrewError}</div>}

          {/* §3.4.4 point 1 — identity + status, isolated from measurements.
              Click the name or batch number to edit in place; changes stage into
              formData like any other field and go out with Save Changes. */}
          <div className={CARD_CLASS}>
            {/* TopBar already renders the page's sole level-1 heading (title={batch.name})
                — this repeats the name at the same visual weight without a second heading
                element, preserving the app-wide one-heading-per-route invariant. */}
            {identityEditOpen ? (
              <div data-testid="batch-identity-edit">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="batchName" className="block text-sm font-medium text-slate-300">
                      Batch Name
                    </label>
                    <Input
                      type="text"
                      id="batchName"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label htmlFor="batchNo" className="block text-sm font-medium text-slate-300">
                      Batch Number
                    </label>
                    <NumberInput
                      type="number"
                      step="1"
                      min="1"
                      id="batchNo"
                      value={formData.batchNo}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10);
                        setFormData({ ...formData, batchNo: Number.isNaN(parsed) ? formData.batchNo : parsed });
                      }}
                      className="mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label htmlFor="brewer" className="block text-sm font-medium text-slate-300">
                      Brewer
                    </label>
                    <Input
                      type="text"
                      id="brewer"
                      value={formData.brewer ?? ''}
                      onChange={(e) => setFormData({ ...formData, brewer: e.target.value })}
                      className="mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label htmlFor="brewDate" className="block text-sm font-medium text-slate-300">
                      Brew Date
                    </label>
                    <Input
                      type="date"
                      id="brewDate"
                      value={formData.brewDate ?? ''}
                      onChange={(e) => setFormData({ ...formData, brewDate: e.target.value || null })}
                      className="mt-1 w-full"
                    />
                  </div>
                </div>
                {/* CRIT-02 — no local "Done" pseudo-save. Every keystroke above
                    already writes straight into `formData`; this footer only
                    closes the editor view and makes explicit that persisting
                    requires the TopBar's Save Changes action. */}
                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <p className={METADATA_TEXT_CLASS}>
                    Edits are staged here — use <span className="text-slate-300 font-medium">Save Changes</span> above to persist them.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    data-testid="batch-identity-edit-close"
                    onClick={() => setIdentityEditOpen(false)}
                  >
                    Close Editor
                  </Button>
                </div>

              </div>
            ) : (
              <button
                type="button"
                data-testid="batch-identity-edit-trigger"
                data-ignore-raw-button
                onClick={() => setIdentityEditOpen(true)}
                className="w-full text-left cursor-pointer group"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-2xl font-bold text-white group-hover:text-amber-400 transition-colors min-w-0 break-words">{batch.name}</p>
                  {statusBadge}
                </div>
                <p className={`${METADATA_TEXT_CLASS} mt-2`}>
                  Batch #{batch.batchNo ?? '—'} &bull; Brewer: {batch.brewer ?? '—'} &bull; Brew Date: {batch.brewDate ?? '—'} &bull; Based on recipe:{' '}
                  <span className="text-amber-400 font-medium">{batch.recipeSnapshot.name}</span>
                </p>
              </button>
            )}
          </div>

          <BatchStageTabs activeTab={activeTab} currentStatus={batch.status} onSelectTab={setActiveTab} />


          {batch.status !== TAB_TO_STATUS[activeTab] && (
            <Button
              variant="primary"
              size="sm"
              type="button"
              data-testid="batch-advance-status-btn"
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  const targetStatus = TAB_TO_STATUS[activeTab];
                  const updated = await updateBatch(batch.id, {
                    ...formData,
                    status: targetStatus,
                  });
                  setBatch(updated);
                  setFormData(projectFormData(updated));
                  setSaveError(null);
                } catch (err) {
                  setSaveError(err instanceof ApiClientError ? err.message : 'Failed to update status.');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="w-full uppercase tracking-wider my-1 justify-center"
            >
              <CornerDownRight className="w-3.5 h-3.5" /> Change Status to {STATUS_TO_TAB_LABEL[TAB_TO_STATUS[activeTab]]}
            </Button>
          )}

          {activeTab === 'planning' && (
            <div className={CARD_STACK_GAP_CLASS} data-testid="batch-tab-panel-planning">
              <StatsHeader stats={stats!} equipment={batch.recipeSnapshot.equipment} config={config} />

              <StockCheckPanel
                key={stockCheckRefreshKey}
                batchId={batch.id}
                onAdjustRecipe={batch.status === 'Planning' ? () => setRecipeAdjustOpen(true) : undefined}
              />

              <BatchNoteLog notes={batch.notes} onCreate={handleCreateNote} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />
            </div>
          )}

          {activeTab === 'brewing' && (
            <div className={CARD_STACK_GAP_CLASS} data-testid="batch-tab-panel-brewing">
              {fermentationError && <div className={ERROR_STATE_CLASS}>Failed to start fermentation. {fermentationError}</div>}

              {/* 1. Vitals comparison / live metrics (FEAT-036) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="brewing-stats-summary">
                <div className={METRIC_TILE_CLASS}>
                  <div className={METRIC_LABEL_CLASS}>Mash Efficiency (live)</div>
                  <div className={`${METRIC_VALUE_CLASS} text-slate-100`}>
                    {calculatedEfficiency !== null ? `${calculatedEfficiency.toFixed(1)}%` : '—'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Est: {batch.recipeSnapshot.equipment.mashEfficiencyPct}%</div>
                </div>
                <div className={METRIC_TILE_CLASS}>
                  <div className={METRIC_LABEL_CLASS}>Brewhouse Efficiency (est.)</div>
                  <div className={`${METRIC_VALUE_CLASS} text-slate-100`}>{batch.recipeSnapshot.equipment.brewhouseEfficiencyPct}%</div>
                </div>
                <div className={METRIC_TILE_CLASS}>
                  <div className={METRIC_LABEL_CLASS}>Predicted Mash pH</div>
                  <div className={`${METRIC_VALUE_CLASS} text-slate-100`} data-testid="batch-predicted-mash-ph">
                    {predictedMashPh !== null ? predictedMashPh.toFixed(2) : '—'}
                  </div>
                </div>
              </div>

              {/* 2. Brew Sheet (FEAT-036) */}
              {brewSheetModel !== null && <BrewSheet model={brewSheetModel} />}

              {/* 3. Brew Day Assistant (FEAT-036 / FEAT-037) */}
              <BrewDayTracker
                batch={batch}
                stats={stats!}
                formData={formData}
                onMeasuredFieldChange={handleMeasuredFieldChange}
                onStartFermentation={handleStartFermentation}
                fermentationBusy={fermentationBusy}
                checkedItemIds={brewDayCheckedItemIds}
                userAddedIds={brewDayUserAddedIds}
                onToggleChecklistItem={handleToggleBrewDayChecklist}
                onToggleAddition={handleToggleBrewDayAddition}
                activeStageIndex={brewDayActiveStageIndex}
                onSelectStage={setBrewDayActiveStageIndex}
                selectedMashStepIndex={brewDaySelectedMashStepIndex}
                onSelectMashStep={setBrewDaySelectedMashStepIndex}
                remainingByKey={brewDayRemainingByKey}
                onUpdateRemainingByKey={setBrewDayRemainingByKey}
                targetEndByKey={brewDayTargetEndByKey}
                onUpdateTargetEndByKey={setBrewDayTargetEndByKey}
                running={brewDayRunning}
                onToggleRunning={setBrewDayRunning}
                firedBoilAlarms={brewDayFiredBoilAlarms}
                onAddFiredBoilAlarm={handleAddBrewDayFiredBoilAlarm}
                onResetTrackerState={handleResetBrewDayTracker}
              />

              {/* 4. Brew Day Measurements (FEAT-036) */}
              <div className={CARD_CLASS}>
                <h3 className={SECTION_HEADING_CLASS}>Brew Day Measurements</h3>
                <p className="mt-1 mb-4 text-sm text-slate-400">Record your actual measurements during the brew.</p>
                <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label htmlFor="measuredPreBoilGravity" className="block text-sm font-medium text-slate-300">
                      Pre-boil Gravity (SG) {stats && <span className="text-slate-400 font-normal">— Est: {stats.preBoilGravity.toFixed(3)}{statsAreRecomputed && ' (recalculated)'}</span>}
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <NumberInput
                        type="number"
                        step="0.001"
                        id="measuredPreBoilGravity"
                        value={preBoilGravityStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPreBoilGravityStr(val);
                          const parsed = parseFloat(val);
                          setFormData({ ...formData, measuredPreBoilGravity: !isNaN(parsed) && val.trim() !== '' ? parsed : null });
                        }}
                        placeholder={measurementTargets!.preBoilGravity.value !== null ? measurementTargets!.preBoilGravity.placeholder! : undefined}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="measuredMashPh" className="block text-sm font-medium text-slate-300">Mash pH</label>
                    <div className="mt-1 flex items-center gap-2">
                      <NumberInput
                        type="number"
                        step="0.01"
                        id="measuredMashPh"
                        value={mashPhStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMashPhStr(val);
                          const parsed = parseFloat(val);
                          setFormData({ ...formData, measuredMashPh: !isNaN(parsed) && val.trim() !== '' ? parsed : null });
                        }}
                        placeholder={measurementTargets!.mashPh.value !== null ? measurementTargets!.mashPh.placeholder! : undefined}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="measuredBoilSizeL" className="block text-sm font-medium text-slate-300">Boil Size (L)</label>
                    <div className="mt-1 flex items-center gap-2">
                      <NumberInput
                        type="number"
                        step="0.1"
                        id="measuredBoilSizeL"
                        value={boilSizeLStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBoilSizeLStr(val);
                          const parsed = parseFloat(val);
                          setFormData({ ...formData, measuredBoilSizeL: !isNaN(parsed) && val.trim() !== '' ? parsed : null });
                        }}
                        placeholder={measurementTargets!.boilSizeL.value !== null ? measurementTargets!.boilSizeL.placeholder! : undefined}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="measuredBoilTimeMin" className="block text-sm font-medium text-slate-300">Boil Time (min)</label>
                    <div className="mt-1 flex items-center gap-2">
                      <NumberInput
                        type="number"
                        step="1"
                        id="measuredBoilTimeMin"
                        value={boilTimeMinStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBoilTimeMinStr(val);
                          const parsed = parseFloat(val);
                          setFormData({ ...formData, measuredBoilTimeMin: !isNaN(parsed) && val.trim() !== '' ? parsed : null });
                        }}
                        placeholder={measurementTargets!.boilTimeMin.value !== null ? measurementTargets!.boilTimeMin.placeholder! : undefined}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="measuredOg" className="block text-sm font-medium text-slate-300">Measured OG (SG)</label>
                    <div className="mt-1 flex items-center gap-2">
                      <NumberInput
                        type="number"
                        step="0.001"
                        id="measuredOg"
                        value={ogStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOgStr(val);
                          const parsed = parseFloat(val);
                          setFormData({ ...formData, measuredOg: !isNaN(parsed) && val.trim() !== '' ? parsed : null });
                        }}
                        placeholder={measurementTargets!.og.value !== null ? measurementTargets!.og.placeholder! : undefined}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Notes (FEAT-036) */}
              <BatchNoteLog notes={batch.notes} onCreate={handleCreateNote} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />
            </div>
          )}

          {activeTab === 'fermentation' && (
            <div className={CARD_STACK_GAP_CLASS} data-testid="batch-tab-panel-fermentation">
              {conditioningError && (
                <div className={ERROR_STATE_CLASS} data-testid="conditioning-error">
                  Failed to advance to conditioning. {conditioningError}
                </div>
              )}
              {/* FG Stability Banner (AC-13 / AC-14) */}
              {fgStability.isStable && (
                <div
                  data-testid="fg-stability-banner"
                  className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-900/80 border border-emerald-600/80 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-emerald-200">
                          Specific Gravity is Stable (FG Ready)
                        </h4>
                        <Badge variant="success" size="sm" className="font-semibold">
                          ΔSG ≤ 0.001 ({fgStability.elapsedHours}h)
                        </Badge>
                      </div>
                      <p className="text-xs text-emerald-400/90 mt-0.5">
                        Latest reading {fgStability.latestSg?.toFixed(3)} matches prior reading {fgStability.priorSg?.toFixed(3)}. Ready for cold crash, packaging, or conditioning.
                      </p>
                    </div>
                  </div>

                  {batch.status === 'Fermenting' && (
                    <Button
                      variant="primary"
                      size="sm"
                      type="button"
                      data-testid="advance-conditioning-btn"
                      disabled={conditioningBusy}
                      onClick={handleAdvanceToConditioning}
                    >
                      {conditioningBusy ? 'Advancing…' : 'Advance to Conditioning →'}
                    </Button>
                  )}

                </div>
              )}

              {/* Live Fermentation Vitals Dashboard (AC-12) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`${METRIC_TILE_CLASS} min-w-0`} data-testid="attenuation-figure">
                  <div className={METRIC_LABEL_CLASS}>Apparent Attenuation</div>
                  <div className={`${METRIC_VALUE_CLASS} text-amber-400 font-mono tabular-nums`}>
                    {fermentationProgress.hasGravityReading ? `${fermentationProgress.apparentAttenuationPct.toFixed(1)}%` : '—'}
                  </div>
                  {fermentationProgress.hasGravityReading && fermentationProgress.originalGravitySource === 'estimated' && (
                    <div className="text-xs text-amber-500 mt-1" data-testid="attenuation-estimated-marker">
                      based on estimated OG{statsAreRecomputed ? ' (recalculated)' : ''}
                    </div>
                  )}
                </div>

                <div className={`${METRIC_TILE_CLASS} min-w-0`} data-testid="live-abv-figure">
                  <div className={METRIC_LABEL_CLASS}>Estimated Live ABV</div>
                  <div className={`${METRIC_VALUE_CLASS} text-amber-400 font-mono tabular-nums`}>
                    {liveEstimatedAbv !== null ? `${liveEstimatedAbv.toFixed(1)}%` : '—'}
                  </div>
                </div>

                <div className={`${METRIC_TILE_CLASS} min-w-0`} data-testid="live-gravity-figure">
                  <div className={METRIC_LABEL_CLASS}>Current Gravity</div>
                  <div className={`${METRIC_VALUE_CLASS} text-slate-100 font-mono tabular-nums`}>
                    {latestReading?.sg !== null && latestReading?.sg !== undefined ? latestReading.sg.toFixed(3) : '—'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">Target FG: {stats?.fg.toFixed(3)}</div>
                </div>

                <div className={`${METRIC_TILE_CLASS} min-w-0`} data-testid="live-temp-pressure-figure">
                  <div className={METRIC_LABEL_CLASS}>Current Temp / Pressure</div>
                  <div className={`${METRIC_VALUE_CLASS} text-slate-100 font-mono tabular-nums`}>
                    {latestReading?.tempC !== null && latestReading?.tempC !== undefined ? `${latestReading.tempC.toFixed(1)}°C` : '—'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                    {latestReading?.pressurePsi !== null && latestReading?.pressurePsi !== undefined ? `${latestReading.pressurePsi.toFixed(1)} psi` : 'Ambient (0 psi)'}
                  </div>
                </div>
              </div>


              {/* Cellar Schedule Action Feed (AC-8 / AC-9) */}
              <CellarActionFeed
                events={cellarSchedule}
                onMarkDone={handleMarkCellarActionDone}
                fermentationStartDate={batch.fermentationStartDate}
              />

              <div className={CARD_CLASS} data-testid="fermentation-fg-measurement">
                <h3 className={SECTION_HEADING_CLASS}>Final Gravity Measurement</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Record your measured Final Gravity (FG) to conclude fermentation and calculate final attenuation &amp; ABV.
                </p>
                <div className="mt-4 max-w-xs">
                  <label htmlFor="measuredFg" className="block text-sm font-medium text-slate-300">Measured FG (SG)</label>
                  <NumberInput
                    step="0.001"
                    id="measuredFg"
                    placeholder="e.g. 1.010"
                    value={fgStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFgStr(val);
                      const parsed = parseFloat(val);
                      setFormData({ ...formData, measuredFg: !isNaN(parsed) && val.trim() !== '' ? parsed : null });
                    }}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Fermentation Chart (AC-11) */}
              <div className={CARD_CLASS}>
                <h3 className={SECTION_HEADING_CLASS}>Fermentation Chart</h3>
                {batch.readings.length === 0 ? (
                  <div className={`${EMPTY_STATE_CLASS} mt-3`} data-testid="no-readings-yet">
                    No readings yet — log your first gravity or temperature reading below to start watching fermentation.
                  </div>
                ) : (
                  <div className="mt-3">
                    <FermentationChart model={chartModel} />
                  </div>
                )}
              </div>

              {readingError && (
                <div className={ERROR_STATE_CLASS} data-testid="reading-error">
                  Failed to save reading. {readingError}
                </div>
              )}

              <ReadingLog
                readings={batch.readings}
                initialOg={batch.measuredOg ?? stats?.og ?? null}
                onCreate={handleCreateReading}
                onUpdate={handleUpdateReading}
                onDelete={handleDeleteReading}
              />

              {noteError && (
                <div className={ERROR_STATE_CLASS} data-testid="note-error">
                  Failed to save note. {noteError}
                </div>
              )}

              <BatchNoteLog notes={batch.notes} onCreate={handleCreateNote} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />
            </div>
          )}

          {activeTab === 'packaging' && (
            <div className={CARD_STACK_GAP_CLASS} data-testid="batch-tab-panel-packaging">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3" data-testid="packaging-stats-summary">
                <div className={`${METRIC_TILE_CLASS} flex flex-col justify-between`}>
                  <div className={METRIC_LABEL_CLASS}>Final Gravity</div>
                  <div className={`${METRIC_VALUE_CLASS} text-slate-100 font-mono tabular-nums`}>
                    {measuredFigures.finalGravity !== null ? measuredFigures.finalGravity.toFixed(3) : '—'}
                  </div>
                </div>
                <div className={`${METRIC_TILE_CLASS} flex flex-col justify-between`}>
                  <div className={METRIC_LABEL_CLASS}>ABV</div>
                  <div className={`${METRIC_VALUE_CLASS} text-amber-400 font-mono tabular-nums`}>
                    {measuredFigures.abv !== null ? `${measuredFigures.abv.toFixed(1)}%` : '—'}
                  </div>
                </div>
                <div className={`${METRIC_TILE_CLASS} flex flex-col justify-between`}>
                  <div className={METRIC_LABEL_CLASS}>Packaging Volume (L)</div>
                  <div className={`${METRIC_VALUE_CLASS} text-slate-100 font-mono tabular-nums`}>
                    {measuredFigures.beerVolumeL !== null ? measuredFigures.beerVolumeL.toFixed(1) : '—'}
                  </div>
                </div>
                <div className={`${METRIC_TILE_CLASS} flex flex-col justify-between`}>
                  <label htmlFor="carbonationTempC" className={METRIC_LABEL_CLASS}>
                    Carbonation/Storage Temp (°C)
                  </label>
                  <NumberInput
                    type="number"
                    step="0.1"
                    id="carbonationTempC"
                    data-testid="packaging-carbonation-temp"
                    placeholder="e.g. 4.0"
                    value={carbonationTempCStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCarbonationTempCStr(val);
                      const parsed = parseFloat(val);
                      setFormData({
                        ...formData,
                        carbonationTempC: !isNaN(parsed) && val.trim() !== '' ? parsed : null,
                      });
                    }}
                    className="mt-1"
                  />
                </div>
              </div>

              <SplitPackagingPanel
                totalBeerVolumeL={measuredFigures.beerVolumeL}
                peakFermentationTempC={formData.carbonationTempC ?? measuredFigures.peakFermentationTempC}
              />

              <BatchNoteLog notes={batch.notes} onCreate={handleCreateNote} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />
            </div>
          )}

          {activeTab === 'completed' && (
            <div className={CARD_STACK_GAP_CLASS} data-testid="batch-tab-panel-completed">
              <div className="flex items-center justify-between">
                <h3 className={SECTION_HEADING_CLASS}>Measured vs. Estimated</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  data-testid="open-calibration-modal-btn"
                  onClick={() => setIsCalibrationModalOpen(true)}
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Calibrate Equipment &amp; Recipe Targets
                </Button>
              </div>

              <MeasuredComparison
                measuredOg={measuredFigures.originalGravity}
                measuredFg={measuredFigures.finalGravity}
                measuredAbv={measuredFigures.abv}
                measuredAttenuationPct={measuredFigures.attenuationPct}
                measuredEfficiencyPct={measuredFigures.mashEfficiencyPct}
                measuredMashPh={formData.measuredMashPh ?? batch.measuredMashPh ?? null}
                estimatedOg={stats?.og ?? 1.050}
                estimatedFg={stats?.fg ?? 1.010}
                estimatedAbv={stats?.abv ?? 5.0}
                estimatedAttenuationPct={stats?.attenuationPct ?? 75.0}
                estimatedEfficiencyPct={batch.recipeSnapshot.equipment.mashEfficiencyPct}
                predictedMashPh={predictedMashPh}
                isRecalculated={statsAreRecomputed}
              />

              <SensoryEvaluationPanel
                initialRating={batch.tasteRating}
                initialNotes={batch.tasteNotes}
                onSaveEvaluation={handleSaveSensoryEvaluation}
              />

              <BatchCostPanel batchId={batch.id} />
              <BatchNutritionPanel closingSnapshot={batch.closingSnapshot} />

              {calibrationEvaluation && (
                <PostBrewCalibrationModal
                  isOpen={isCalibrationModalOpen}
                  onClose={() => setIsCalibrationModalOpen(false)}
                  evaluation={calibrationEvaluation}
                  equipmentProfile={batch.recipeSnapshot.equipment}
                  recipe={batch.recipeSnapshot}
                  onUpdateEquipmentProfile={handleUpdateEquipmentProfile}
                  onUpdateRecipe={handleUpdateRecipeTarget}
                />
              )}

              <BatchNoteLog notes={batch.notes} onCreate={handleCreateNote} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />
            </div>
          )}

        </div>
      </PageContainer>
    </>
  );
}
