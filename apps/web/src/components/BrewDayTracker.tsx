import { useEffect, useMemo, useState } from 'react';
import type { BatchWithReadings, BatchWriteInput, CalculatedStats } from '@truchabrew/shared-types';
import { strikeTemperatureC, buildBrewDayTimeline, BREW_DAY_STAGE_KEYS, type BrewDayStageKey } from '@truchabrew/calculations';
import { playStepAlert } from '../utils/audioAlerts';
import { BrewDayTimelineBar } from './BrewDayTimelineBar';
import { CARD_CLASS, SECTION_HEADING_CLASS, SUBPANEL_CLASS } from './designSystem';
import { Button, NumberInput } from './ui';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  FastForward,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  Pencil,
  Power,
} from 'lucide-react';


type StageKey = BrewDayStageKey;

// Green stage header copy (M18_P1 spec §2.2 — "green highlight stage header").
const STAGE_HEADER_LABELS: Record<StageKey, string> = {
  prep: 'Prepare to Brew',
  mash: 'Start Mash Tracker',
  boil: 'Start Boil Tracker',
  hopstand: 'Start Hop Stand Tracker',
};

const ADJUST_TIME_MIN_MINUTES = 0;
const ADJUST_TIME_MAX_MINUTES = 600;

interface MashStepView {
  id: string;
  name: string;
  stepTempC: number;
  stepTimeMin: number;
}

interface BoilAlarm {
  id: string;
  atSec: number; // seconds elapsed into the boil when this alarm fires
  label: string;
}

interface ChecklistItem {
  id: string;
  label: string;
}

/**
 * Zero-pads minutes to a minimum of 2 digits; minutes themselves are
 * uncapped (an 85-minute mash reads `85:00`) — M18_P1 Ambiguity 13.
 */
function formatMmSs(totalSec: number): string {
  const clamped = Math.max(0, Math.round(totalSec));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface BrewDayTrackerProps {
  batch: BatchWithReadings;
  stats: CalculatedStats;
  formData?: BatchWriteInput;
  onMeasuredFieldChange?: (patch: Partial<Pick<BatchWriteInput, 'measuredPreBoilGravity' | 'measuredOg' | 'measuredBoilSizeL'>>) => void;
  onStartFermentation?: () => void | Promise<void>;
  fermentationBusy?: boolean;
  checkedItemIds?: Set<string>;
  userAddedIds?: Set<string>;
  onToggleChecklistItem?: (id: string) => void;
  onToggleAddition?: (id: string) => void;
  activeStageIndex?: number;
  onSelectStage?: (index: number) => void;
  selectedMashStepIndex?: number;
  onSelectMashStep?: (index: number) => void;
  remainingByKey?: Record<string, number>;
  onUpdateRemainingByKey?: (patch: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  targetEndByKey?: Record<string, number>;
  onUpdateTargetEndByKey?: (patch: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  running?: boolean;
  onToggleRunning?: (running: boolean) => void;
  firedBoilAlarms?: Set<string>;
  onAddFiredBoilAlarm?: (alarmId: string) => void;
  onResetTrackerState?: () => void;
}

/**
 * Interactive Brew Day Assistant (M15_P1 spec §1.3/§1.4, extended by M18_P1
 * §1.2/§2.2 — continuous timeline bar, stepper controls, stage checklists).
 * Mounted by BatchDetail's Brewing stage tab only. All timer/checklist state
 * is local/ephemeral.
 */
export function BrewDayTracker({
  batch,
  stats,
  formData: _formData,
  onMeasuredFieldChange: _onMeasuredFieldChange,
  onStartFermentation: _onStartFermentation,
  fermentationBusy: _fermentationBusy,
  checkedItemIds: controlledCheckedItemIds,
  userAddedIds: controlledUserAddedIds,
  onToggleChecklistItem: controlledOnToggleChecklistItem,
  onToggleAddition: controlledOnToggleAddition,
  activeStageIndex: controlledActiveStageIndex,
  onSelectStage: controlledOnSelectStage,
  selectedMashStepIndex: controlledSelectedMashStepIndex,
  onSelectMashStep: controlledOnSelectMashStep,
  remainingByKey: controlledRemainingByKey,
  onUpdateRemainingByKey: controlledOnUpdateRemainingByKey,
  targetEndByKey: controlledTargetEndByKey,
  onUpdateTargetEndByKey: controlledOnUpdateTargetEndByKey,
  running: controlledRunning,
  onToggleRunning: controlledOnToggleRunning,
  firedBoilAlarms: controlledFiredBoilAlarms,
  onAddFiredBoilAlarm: controlledOnAddFiredBoilAlarm,
  onResetTrackerState: controlledOnResetTrackerState,
}: BrewDayTrackerProps) {
  const recipe = batch.recipeSnapshot;
  const equipment = recipe.equipment;

  const [localActiveStageIndex, setLocalActiveStageIndex] = useState(0);
  const [localSelectedMashStepIndex, setLocalSelectedMashStepIndex] = useState(0);
  // Frozen remaining-seconds snapshot for a key, taken whenever that key is
  // NOT the actively-running timer (paused/reset/fast-forwarded value).
  const [localRemainingByKey, setLocalRemainingByKey] = useState<Record<string, number>>({});
  // Wall-clock end timestamp (ms since epoch) for whichever key is actively
  // running. Anchoring to Date.now() (rather than decrementing a tick
  // counter) means the countdown is correct even if the interval itself is
  // throttled or frozen by the browser (backgrounded/sleeping tab) — the
  // remaining time is always re-derived from the target, never accumulated.
  const [localTargetEndByKey, setLocalTargetEndByKey] = useState<Record<string, number>>({});
  const [localRunning, setLocalRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [localFiredBoilAlarms, setLocalFiredBoilAlarms] = useState<Set<string>>(new Set());
  const [localUserAddedIds, setLocalUserAddedIds] = useState<Set<string>>(new Set());
  // Ephemeral per-stage checklist state (prep/mash/hopstand), keyed by a
  // stable synthetic item id (M18_P1 Ambiguity 23). Not persisted.
  const [localCheckedItemIds, setLocalCheckedItemIds] = useState<Set<string>>(new Set());

  const activeStageIndex = controlledActiveStageIndex ?? localActiveStageIndex;
  const setActiveStageIndex = (update: number | ((prev: number) => number)) => {
    if (controlledOnSelectStage) {
      const next = typeof update === 'function' ? update(activeStageIndex) : update;
      controlledOnSelectStage(next);
    } else {
      setLocalActiveStageIndex(update);
    }
  };

  const selectedMashStepIndex = controlledSelectedMashStepIndex ?? localSelectedMashStepIndex;
  const setSelectedMashStepIndex = (update: number | ((prev: number) => number)) => {
    if (controlledOnSelectMashStep) {
      const next = typeof update === 'function' ? update(selectedMashStepIndex) : update;
      controlledOnSelectMashStep(next);
    } else {
      setLocalSelectedMashStepIndex(update);
    }
  };

  const remainingByKey = controlledRemainingByKey ?? localRemainingByKey;
  const setRemainingByKey = (update: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    if (controlledOnUpdateRemainingByKey) {
      controlledOnUpdateRemainingByKey(update);
    } else {
      setLocalRemainingByKey(update);
    }
  };

  const targetEndByKey = controlledTargetEndByKey ?? localTargetEndByKey;
  const setTargetEndByKey = (update: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    if (controlledOnUpdateTargetEndByKey) {
      controlledOnUpdateTargetEndByKey(update);
    } else {
      setLocalTargetEndByKey(update);
    }
  };

  const running = controlledRunning ?? localRunning;
  const setRunning = (val: boolean) => {
    if (controlledOnToggleRunning) {
      controlledOnToggleRunning(val);
    } else {
      setLocalRunning(val);
    }
  };

  const firedBoilAlarms = controlledFiredBoilAlarms ?? localFiredBoilAlarms;
  const addFiredBoilAlarm = (alarmId: string) => {
    if (controlledOnAddFiredBoilAlarm) {
      controlledOnAddFiredBoilAlarm(alarmId);
    } else {
      setLocalFiredBoilAlarms((prev) => new Set(prev).add(alarmId));
    }
  };

  const userAddedIds = controlledUserAddedIds ?? localUserAddedIds;
  const checkedItemIds = controlledCheckedItemIds ?? localCheckedItemIds;
  const [adjustTimeOpen, setAdjustTimeOpen] = useState(false);
  const [adjustTimeValue, setAdjustTimeValue] = useState('');
  // Forces a repaint every second while running so the Date.now()-derived
  // remaining time is recomputed; carries no timing information itself.
  const [, forceRepaint] = useState(0);

  const mashSteps: MashStepView[] = useMemo(() => {
    if (recipe.mashProfile !== null && recipe.mashProfile.steps.length > 0) {
      return recipe.mashProfile.steps.map((s) => ({ id: s.id, name: s.name, stepTempC: s.stepTempC, stepTimeMin: s.stepTimeMin }));
    }
    return [{ id: 'default-mash-step', name: 'Single Infusion', stepTempC: 67, stepTimeMin: 60 }];
  }, [recipe.mashProfile]);

  const activeMashStep = mashSteps[Math.min(selectedMashStepIndex, mashSteps.length - 1)] ?? mashSteps[0]!;

  const strikeTempC = useMemo(
    () =>
      strikeTemperatureC({
        targetMashTempC: mashSteps[0].stepTempC,
        grainTemperatureC: equipment.grainTemperatureC,
        waterVolumeL: stats.mashWaterL,
        grainWeightKg: stats.totalGrainKg,
        mashTunHeatCapacityL: equipment.mashTunHeatCapacityL,
        calcStrikeWithThermalMass: equipment.calcStrikeWithThermalMass,
        mashTunWeightKg: equipment.mashTunWeightKg,
        mashTunHeatCapacity: equipment.mashTunHeatCapacity,
      }),
    [mashSteps, equipment, stats.mashWaterL, stats.totalGrainKg],
  );

  // Timeline model — computed unconditionally via useMemo, before any early
  // return, so no conditional-hook regression (M18_P1 spec §2.4) is
  // reintroduced. This component has no early return today, but the rule
  // is followed regardless.
  const timelineModel = useMemo(
    () => buildBrewDayTimeline({ recipe, stats, strikeTempC }),
    [recipe, stats, strikeTempC],
  );

  // Reset the whole tracker whenever a different batch mounts.
  useEffect(() => {
    setActiveStageIndex(0);
    setSelectedMashStepIndex(0);
    setRemainingByKey({});
    setTargetEndByKey({});
    setRunning(false);
    setLocalFiredBoilAlarms(new Set());
    setLocalUserAddedIds(new Set());
    setLocalCheckedItemIds(new Set());
    setAdjustTimeOpen(false);
    setAdjustTimeValue('');
    handleGlobalReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.id]);

  const boilDurationMin = equipment.boilTimeMin;

  const boilAlarms: BoilAlarm[] = useMemo(() => {
    const hopAlarms = recipe.hops
      .filter((h) => h.use === 'Boil' && h.boilMins !== null)
      .map((h) => ({
        id: `hop-${h.id}`,
        atSec: Math.max(0, (boilDurationMin - (h.boilMins as number)) * 60),
        label: `Hop addition: ${h.amountG} g ${h.name} @ ${h.boilMins} min`,
      }));
    const miscAlarms = recipe.miscs
      .filter((m) => m.use === 'Boil' && m.timeMinutes > 0)
      .map((m) => ({
        id: `misc-${m.id}`,
        atSec: Math.max(0, (boilDurationMin - m.timeMinutes) * 60),
        label: `Misc addition: ${m.amount} ${m.unit} ${m.name} @ ${m.timeMinutes} min`,
      }));
    return [...hopAlarms, ...miscAlarms].sort((a, b) => a.atSec - b.atSec);
  }, [recipe.hops, recipe.miscs, boilDurationMin]);

  const hopstandHops = useMemo(
    () => recipe.hops.filter((h) => (h.use === 'Whirlpool' || h.use === 'Aroma') && h.whirlpoolMins !== null),
    [recipe.hops],
  );
  const hopstandDurationMin = hopstandHops.length > 0 ? Math.max(...hopstandHops.map((h) => h.whirlpoolMins as number)) : 0;

  // Stage checklists (M18_P1 AC-33) — derived from recipe data, ephemeral,
  // keyed by a stable synthetic item id.
  const prepChecklist: ChecklistItem[] = useMemo(
    () => recipe.fermentables.map((f) => ({ id: `prep-${f.id}`, label: `Weigh out ${f.amountKg} kg ${f.name}` })),
    [recipe.fermentables],
  );
  const mashChecklist: ChecklistItem[] = useMemo(
    () => mashSteps.map((s) => ({ id: `mash-check-${s.id}`, label: `${s.name}: ${s.stepTempC.toFixed(1)}°C for ${s.stepTimeMin} min` })),
    [mashSteps],
  );
  const hopstandChecklist: ChecklistItem[] = useMemo(
    () => hopstandHops.map((h) => ({ id: `hopstand-check-${h.id}`, label: `Add ${h.amountG} g ${h.name}` })),
    [hopstandHops],
  );

  const toggleChecklistItem = (id: string) => {
    if (controlledOnToggleChecklistItem) {
      controlledOnToggleChecklistItem(id);
    } else {
      setLocalCheckedItemIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  // The single active timer's key — the generic Play/Pause/Skip/FF/Reset
  // controls always operate on whichever key is "current" (AC-8). Mash's own
  // key additionally depends on which mash step is selected, so each step
  // keeps independent progress (AC-10) even though only one is playing.
  const stageKey = BREW_DAY_STAGE_KEYS[activeStageIndex];
  const timerKey = stageKey === 'mash' ? `mash-${activeMashStep.id}` : `stage-${stageKey}`;

  function nominalDurationSec(key: string): number {
    if (key === 'stage-boil') return boilDurationMin * 60;
    if (key === 'stage-hopstand') return hopstandDurationMin * 60;
    if (key.startsWith('mash-')) {
      const step = mashSteps.find((s) => `mash-${s.id}` === key) ?? activeMashStep;
      return step.stepTimeMin * 60;
    }
    return 0; // prep / ferment have no countdown of their own
  }

  // Wall-clock-anchored remaining-seconds for an arbitrary key. While `key`
  // is the actively-running timer, remaining is derived from the target end
  // timestamp vs. Date.now() (immune to interval throttling/freezing);
  // otherwise it's the frozen snapshot (or the nominal duration if never
  // started).
  function remainingForKey(key: string): number {
    if (running && key === timerKey && targetEndByKey[key] !== undefined) {
      return Math.max(0, Math.round((targetEndByKey[key] - Date.now()) / 1000));
    }
    return remainingByKey[key] ?? nominalDurationSec(key);
  }

  const remainingSec = remainingForKey(timerKey);

  // Ensure the actively-running key always has a target end timestamp (e.g.
  // right after Play, or after switching mash steps while already running).
  useEffect(() => {
    if (!running) return;
    setTargetEndByKey((prev) => {
      if (prev[timerKey] !== undefined) return prev;
      const startFrom = remainingByKey[timerKey] ?? nominalDurationSec(timerKey);
      return { ...prev, [timerKey]: Date.now() + startFrom * 1000 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, timerKey]);

  // Repaint every second while running — purely a recompute trigger. The
  // actual remaining time always comes from Date.now() vs. the target end,
  // so a throttled/delayed interval fire just means a late repaint, not lost
  // or drifted time.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => forceRepaint((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Completion alert — fires once when the active timer reaches zero. Must
  // also freeze remainingByKey[timerKey] at 0 (same as Pause/Skip) — once
  // `running` flips false, display falls back to the snapshot map, and
  // without this write it would show the stale pre-completion value instead
  // of 0.
  useEffect(() => {
    if (running && remainingSec === 0) {
      setRemainingByKey((prev) => ({ ...prev, [timerKey]: 0 }));
      setRunning(false);
      playStepAlert('completion', { muted });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, running]);

  // Boil hop/misc alarms — fire a 'warning' tone the first time elapsed time
  // crosses each alarm's threshold, while the boil stage is active.
  useEffect(() => {
    if (stageKey !== 'boil') return;
    const elapsedSec = boilDurationMin * 60 - remainingSec;
    for (const alarm of boilAlarms) {
      if (elapsedSec >= alarm.atSec && !firedBoilAlarms.has(alarm.id)) {
        playStepAlert('warning', { muted });
        addFiredBoilAlarm(alarm.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, stageKey]);

  const handlePlay = () => {
    setRunning(true);
  };
  const handlePause = () => {
    // Freeze the current wall-clock-derived remaining time into the
    // snapshot map so it survives once `running` flips off.
    setRemainingByKey((prev) => ({ ...prev, [timerKey]: remainingForKey(timerKey) }));
    setRunning(false);
  };
  const handleReset = () => {
    setRemainingByKey((prev) => ({ ...prev, [timerKey]: nominalDurationSec(timerKey) }));
    setTargetEndByKey((prev) => {
      const next = { ...prev };
      delete next[timerKey];
      return next;
    });
    setRunning(false);
    if (stageKey === 'boil') {
      setLocalFiredBoilAlarms(new Set());
      setLocalUserAddedIds(new Set());
    }
  };
  const handleFastForward = () => {
    const current = remainingForKey(timerKey);
    const next = Math.max(0, Math.floor(current / 10));
    setRemainingByKey((prev) => ({ ...prev, [timerKey]: next }));
    if (running) {
      setTargetEndByKey((prev) => ({ ...prev, [timerKey]: Date.now() + next * 1000 }));
    }
  };
  const handleSkip = () => {
    setRemainingByKey((prev) => ({ ...prev, [timerKey]: remainingForKey(timerKey) }));
    setRunning(false);
    playStepAlert('chime', { muted });
    setActiveStageIndex((idx) => Math.min(idx + 1, BREW_DAY_STAGE_KEYS.length - 1));
  };

  // Previous Step (M18_P1 Ambiguity 20). A true no-op at the first stage:
  // freezes the outgoing timer exactly as handlePause does, does NOT play a
  // chime (unlike Skip), and does NOT reset the destination stage's stored
  // progress.
  const handlePreviousStep = () => {
    if (activeStageIndex === 0) return;
    setRemainingByKey((prev) => ({ ...prev, [timerKey]: remainingForKey(timerKey) }));
    setRunning(false);
    setActiveStageIndex((idx) => Math.max(idx - 1, 0));
  };

  // Adjust Time (M18_P1 Ambiguity 21). Accepted range [0, 600] minutes
  // inclusive; anything else — non-numeric, out of range — is rejected with
  // no state change at all.
  const handleAdjustTimeToggle = () => setAdjustTimeOpen((o) => !o);
  const handleAdjustTimeCommit = () => {
    const trimmed = adjustTimeValue.trim();
    if (trimmed === '') return;
    const minutes = Number(trimmed);
    if (!Number.isFinite(minutes) || minutes < ADJUST_TIME_MIN_MINUTES || minutes > ADJUST_TIME_MAX_MINUTES) return;
    const sec = minutes * 60;
    setRemainingByKey((prev) => ({ ...prev, [timerKey]: sec }));
    if (running) {
      setTargetEndByKey((prev) => ({ ...prev, [timerKey]: Date.now() + sec * 1000 }));
    }
    setAdjustTimeOpen(false);
    setAdjustTimeValue('');
  };

  // Global power/reset (M18_P1 Ambiguity 22). Restores every piece of
  // tracker-local state to its mount default. Touches ONLY ephemeral local
  // state — no onMeasuredFieldChange call, no formData mutation, no request.
  const handleGlobalReset = () => {
    setActiveStageIndex(0);
    setSelectedMashStepIndex(0);
    setRemainingByKey({});
    setTargetEndByKey({});
    setRunning(false);
    setLocalFiredBoilAlarms(new Set());
    setLocalUserAddedIds(new Set());
    setLocalCheckedItemIds(new Set());
    if (controlledOnResetTrackerState) {
      controlledOnResetTrackerState();
    } else {
      setLocalActiveStageIndex(0);
      setLocalSelectedMashStepIndex(0);
      setLocalRemainingByKey({});
      setLocalTargetEndByKey({});
      setLocalRunning(false);
      setLocalFiredBoilAlarms(new Set());
      setLocalUserAddedIds(new Set());
      setLocalCheckedItemIds(new Set());
    }
    setAdjustTimeOpen(false);
    setAdjustTimeValue('');
  };

  const toggleAddition = (id: string) => {
    if (controlledOnToggleAddition) {
      controlledOnToggleAddition(id);
    } else {
      setLocalUserAddedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const guidance: string = useMemo(() => {
    switch (stageKey) {
      case 'prep':
        return `Heat ${stats.mashWaterL.toFixed(1)} L of water to ${strikeTempC.toFixed(1)}°C`;
      case 'mash':
        return `Mash: ${activeMashStep.stepTimeMin} min @ ${activeMashStep.stepTempC.toFixed(1)}°C`;
      case 'boil': {
        const elapsedSec = boilDurationMin * 60 - remainingSec;
        const dueAlarm = boilAlarms.find((a) => elapsedSec >= a.atSec && !userAddedIds.has(a.id));
        if (dueAlarm) {
          return `👉 ADD NOW: ${dueAlarm.label}`;
        }
        const next = boilAlarms.find((a) => a.atSec > elapsedSec);
        if (next) {
          const inSec = next.atSec - elapsedSec;
          const atMinRemaining = Math.round((boilDurationMin * 60 - next.atSec) / 60);
          return `Next: ${next.label} in ${formatMmSs(inSec)} (at ${atMinRemaining} min remaining)`;
        }
        return `Boil for ${boilDurationMin} min (${formatMmSs(remainingSec)} remaining)`;
      }
      case 'hopstand':
        return `Cool to ${equipment.hopstandTemperatureC}°C and start ${hopstandDurationMin} min Hop Stand`;
    }
  }, [stageKey, stats.mashWaterL, strikeTempC, activeMashStep, boilAlarms, boilDurationMin, remainingSec, hopstandDurationMin, userAddedIds, equipment.hopstandTemperatureC]);

  function renderChecklist(items: ChecklistItem[], testIdPrefix: string) {
    if (items.length === 0) return null;
    return (
      <div className="mt-4 border-t border-slate-800 pt-3" data-testid={`${testIdPrefix}-checklist`}>
        <div className="text-xs text-slate-400 font-medium mb-2">Checklist</div>
        <ul className="text-xs text-slate-300 space-y-2">
          {items.map((item) => {
            const isChecked = checkedItemIds.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid={`checklist-item-${item.id}`}
                  onClick={() => toggleChecklistItem(item.id)}
                  className="flex items-center gap-2 cursor-pointer w-full text-left p-2.5 rounded-lg border border-slate-800/80 bg-slate-950/60 hover:bg-slate-950 hover:border-slate-700 transition-colors"
                >
                  {isChecked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full border border-slate-600" />
                  )}
                  <span className={isChecked ? 'line-through text-slate-400' : 'text-slate-200'}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className={CARD_CLASS} data-testid="brew-day-tracker">
      <div className="flex items-center justify-between mb-4">
        <h3 className={SECTION_HEADING_CLASS}>Brew Day Assistant</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="icon"
            type="button"
            data-testid="brew-day-mute-toggle"
            aria-label={muted ? 'Unmute alerts' : 'Mute alerts'}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Button
            variant="icon"
            type="button"
            data-testid="brew-day-global-reset-btn"
            onClick={handleGlobalReset}
            aria-label="Reset entire brew day tracker"
            title="Reset entire brew day tracker"
            className="hover:text-rose-300"
          >
            <Power className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Continuous segmented timeline + milestone dots (M18_P1 AC-26/AC-27) */}
      <BrewDayTimelineBar
        model={timelineModel}
        activeStageIndex={activeStageIndex}
        onSelectStage={(idx) => setActiveStageIndex(idx)}
      />



      {/* Contextual step card */}
      <div className={`${SUBPANEL_CLASS} mb-5`} data-testid="brew-day-step-card">
        <div
          data-testid="brew-day-stage-header"
          className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2"
        >
          {STAGE_HEADER_LABELS[stageKey]}
        </div>

        <div className="text-sm text-slate-200 font-medium mb-3" data-testid="brew-day-guidance">
          {guidance}
        </div>

        {stageKey !== 'prep' && (
          <div className="flex justify-center mb-3">
            <div
              data-testid="brew-day-timer-box"
              className="bg-slate-950 border border-slate-800/90 rounded-xl px-8 py-4 text-center shadow-inner"
            >
              <div className="text-4xl sm:text-5xl font-extrabold text-amber-400 font-mono tabular-nums" data-testid="brew-day-timer-display">
                {formatMmSs(remainingSec)}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {stageKey === 'prep' ? (
            <Button
              variant="primary"
              size="sm"
              type="button"
              data-testid="brew-day-skip-btn"
              onClick={handleSkip}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Strike Water Ready
            </Button>
          ) : (
            <>
              {activeStageIndex > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  data-testid="brew-day-previous-btn"
                  onClick={handlePreviousStep}
                >
                  <SkipBack className="w-3.5 h-3.5" /> Previous Step
                </Button>
              )}
              {!running ? (
                <Button
                  variant="primary"
                  size="sm"
                  type="button"
                  data-testid="brew-day-play-btn"
                  onClick={handlePlay}
                >
                  <Play className="w-3.5 h-3.5" /> Play
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  data-testid="brew-day-pause-btn"
                  onClick={handlePause}
                >
                  <Pause className="w-3.5 h-3.5" /> Pause
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                type="button"
                data-testid="brew-day-fastforward-btn"
                onClick={handleFastForward}
              >
                <FastForward className="w-3.5 h-3.5" /> Fast-Forward
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                data-testid="brew-day-adjusttime-btn"
                onClick={handleAdjustTimeToggle}
              >
                <Pencil className="w-3.5 h-3.5" /> Adjust Time
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                data-testid="brew-day-reset-btn"
                onClick={handleReset}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                data-testid="brew-day-skip-btn"
                onClick={handleSkip}
              >
                <SkipForward className="w-3.5 h-3.5" /> Skip
              </Button>
            </>
          )}
        </div>

        {adjustTimeOpen && (
          <div className="flex items-center gap-2 mt-3" data-testid="brew-day-adjusttime-panel">
            <NumberInput
              size="sm"
              type="number"
              value={adjustTimeValue}
              onChange={(e) => setAdjustTimeValue(e.target.value)}
              placeholder="Minutes"
              className="w-24"
              data-testid="brew-day-adjusttime-input"
            />
            <Button
              size="sm"
              type="button"
              data-testid="brew-day-adjusttime-commit-btn"
              onClick={handleAdjustTimeCommit}
            >
              Set
            </Button>
          </div>
        )}

        {stageKey === 'prep' && renderChecklist(prepChecklist, 'brew-day-prep')}

        {stageKey === 'mash' && mashSteps.length > 1 && (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <div className="text-xs text-slate-400 font-medium mb-2">Mash Schedule Steps</div>
            <div className="flex gap-2 flex-wrap">
              {mashSteps.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  data-testid={`mash-step-${idx}`}
                  onClick={() => setSelectedMashStepIndex(idx)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                    idx === selectedMashStepIndex ? 'bg-amber-900/40 border-amber-600 text-amber-200' : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {step.name} ({step.stepTempC}°C, {step.stepTimeMin}m)
                </button>
              ))}
            </div>
          </div>
        )}

        {stageKey === 'mash' && renderChecklist(mashChecklist, 'brew-day-mash')}

        {stageKey === 'boil' && boilAlarms.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-3" data-testid="brew-day-boil-alarms">
            <div className="text-xs text-slate-400 font-medium mb-2">Additions Schedule</div>
            <ul className="text-xs text-slate-300 space-y-2">
              {(() => {
                const boilElapsedSec = boilDurationMin * 60 - remainingSec;
                return boilAlarms.map((alarm) => {
                  const isDue = boilElapsedSec >= alarm.atSec;
                  const isAdded = userAddedIds.has(alarm.id);
                  const isDueNow = isDue && !isAdded;
                  return (
                    <li key={alarm.id}>
                      <button
                        type="button"
                        data-testid={`brew-day-boil-alarm-${alarm.id}`}
                        onClick={() => toggleAddition(alarm.id)}
                        className={`flex items-center justify-between gap-2 p-2 rounded-lg border cursor-pointer w-full text-left transition-all ${
                          isAdded
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-80'
                            : isDueNow
                            ? 'bg-amber-950/30 border-amber-500/50 shadow-sm'
                            : 'bg-slate-900/80 border-slate-800 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isAdded ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <span
                              className={`flex-shrink-0 w-3.5 h-3.5 rounded-full border ${
                                isDueNow ? 'border-amber-400 bg-amber-500/20 animate-pulse' : 'border-slate-600'
                              }`}
                            />
                          )}
                          <span className={`text-xs ${isAdded ? 'line-through text-slate-400' : 'text-slate-200 font-medium'}`}>
                            {alarm.label}
                          </span>
                        </div>

                        {isDueNow && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex-shrink-0">
                            Add Now
                          </span>
                        )}
                      </button>
                    </li>
                  );
                });
              })()}
            </ul>
          </div>
        )}


        {stageKey === 'hopstand' && renderChecklist(hopstandChecklist, 'brew-day-hopstand')}
      </div>
    </div>
  );
}

