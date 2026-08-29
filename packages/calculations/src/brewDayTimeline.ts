// M18_P1 spec §1.2 — continuous brew-day timeline + milestone dots. Pure.
// Same purity constraints as brewSheet.ts.
import type { Recipe, CalculatedStats } from '@truchabrew/shared-types';

export const BREW_DAY_STAGE_KEYS = ['prep', 'mash', 'boil', 'hopstand'] as const;
export type BrewDayStageKey = (typeof BREW_DAY_STAGE_KEYS)[number];

export const MIN_SEGMENT_DISPLAY_SEC = 300 as const;
export const MASH_OUT_MIN_TEMP_C = 75 as const;

const STAGE_LABELS: Record<BrewDayStageKey, string> = {
  prep: 'Preparation',
  mash: 'Mash',
  boil: 'Boil',
  hopstand: 'Hop Stand',
};

export type BrewDayMilestoneKind =
  | 'strike-prep'
  | 'dough-in'
  | 'mash-step'
  | 'mash-out'
  | 'sparge'
  | 'boil-start'
  | 'addition'
  | 'hopstand-start';

export interface BrewDayMilestone {
  id: string;
  stage: BrewDayStageKey;
  kind: BrewDayMilestoneKind;
  label: string;
  offsetSec: number;
  position: number;
}

export interface BrewDaySegment {
  stage: BrewDayStageKey;
  label: string;
  durationSec: number;
  startOffsetSec: number;
  startPosition: number;
  widthFraction: number;
}

export interface BrewDayTimelineModel {
  segments: BrewDaySegment[];
  milestones: BrewDayMilestone[];
  totalDurationSec: number;
}

export interface BrewDayTimelineInput {
  recipe: Recipe;
  stats: CalculatedStats;
  strikeTempC: number | null;
}

interface RawMilestone {
  id: string;
  stage: BrewDayStageKey;
  kind: BrewDayMilestoneKind;
  label: string;
  localOffsetSec: number; // offset from the start of `stage`
}

/** Pure. See §1.2. */
export function buildBrewDayTimeline(input: BrewDayTimelineInput): BrewDayTimelineModel {
  const { recipe, stats } = input;
  const { equipment } = recipe;

  const mashSteps = recipe.mashProfile !== null ? recipe.mashProfile.steps : [];
  const mashRealSec = mashSteps.reduce((sum, s) => sum + s.stepTimeMin * 60, 0);
  const boilRealSec = equipment.boilTimeMin * 60;
  const hopstandHops = recipe.hops.filter(
    (h) => (h.use === 'Whirlpool' || h.use === 'Aroma') && h.whirlpoolMins !== null,
  );
  const hopstandRealSec =
    hopstandHops.length > 0 ? Math.max(...hopstandHops.map((h) => (h.whirlpoolMins as number) * 60)) : 0;

  const realDurationByStage: Record<BrewDayStageKey, number> = {
    prep: 0,
    mash: mashRealSec,
    boil: boilRealSec,
    hopstand: hopstandRealSec,
  };

  const displayDurationByStage: Record<BrewDayStageKey, number> = {
    prep: Math.max(realDurationByStage.prep, MIN_SEGMENT_DISPLAY_SEC),
    mash: Math.max(realDurationByStage.mash, MIN_SEGMENT_DISPLAY_SEC),
    boil: Math.max(realDurationByStage.boil, MIN_SEGMENT_DISPLAY_SEC),
    hopstand: Math.max(realDurationByStage.hopstand, MIN_SEGMENT_DISPLAY_SEC),
  };

  const totalDisplaySec = BREW_DAY_STAGE_KEYS.reduce((sum, key) => sum + displayDurationByStage[key], 0);

  const startOffsetByStage: Record<BrewDayStageKey, number> = { prep: 0, mash: 0, boil: 0, hopstand: 0 };
  const startPositionByStage: Record<BrewDayStageKey, number> = { prep: 0, mash: 0, boil: 0, hopstand: 0 };
  let runningOffset = 0;
  let runningPosition = 0;
  const segments: BrewDaySegment[] = BREW_DAY_STAGE_KEYS.map((key) => {
    const widthFraction = displayDurationByStage[key] / totalDisplaySec;
    startOffsetByStage[key] = runningOffset;
    startPositionByStage[key] = runningPosition;
    const segment: BrewDaySegment = {
      stage: key,
      label: STAGE_LABELS[key],
      durationSec: realDurationByStage[key],
      startOffsetSec: runningOffset,
      startPosition: runningPosition,
      widthFraction,
    };
    runningOffset += realDurationByStage[key];
    runningPosition += widthFraction;
    return segment;
  });

  const totalDurationSec = realDurationByStage.mash + realDurationByStage.boil + realDurationByStage.hopstand;

  function positionFor(stage: BrewDayStageKey, localOffsetSec: number): number {
    return startPositionByStage[stage] + (localOffsetSec / displayDurationByStage[stage]) * segments.find((s) => s.stage === stage)!.widthFraction;
  }

  const raw: RawMilestone[] = [];

  // mash-step: one per mash step, at that step's cumulative start offset.
  let mashCumSec = 0;
  for (const step of mashSteps) {
    raw.push({
      id: `mash-step-${step.id}`,
      stage: 'mash',
      kind: 'mash-step',
      label: step.name,
      localOffsetSec: mashCumSec,
    });
    mashCumSec += step.stepTimeMin * 60;
  }

  // mash-out (Ambiguity 15): last mash step's stepTempC >= MASH_OUT_MIN_TEMP_C.
  if (mashSteps.length > 0) {
    const lastStep = mashSteps[mashSteps.length - 1];
    if (lastStep.stepTempC >= MASH_OUT_MIN_TEMP_C) {
      raw.push({
        id: 'mash-out',
        stage: 'mash',
        kind: 'mash-out',
        label: 'Mash Out',
        localOffsetSec: mashRealSec,
      });
    }
  }

  // sparge (Ambiguity 16): stats.spargeWaterL > 0, strict.
  if (stats.spargeWaterL > 0) {
    raw.push({
      id: 'sparge',
      stage: 'mash',
      kind: 'sparge',
      label: 'Sparge',
      localOffsetSec: mashRealSec,
    });
  }

  // addition: one per qualifying boil hop/misc, same filter as the tracker.
  for (const h of recipe.hops) {
    if (h.use === 'Boil' && h.boilMins !== null) {
      raw.push({
        id: `addition-hop-${h.id}`,
        stage: 'boil',
        kind: 'addition',
        label: `Hop addition: ${h.amountG} g ${h.name} @ ${h.boilMins} min`,
        localOffsetSec: Math.max(0, boilRealSec - h.boilMins * 60),
      });
    }
  }
  for (const m of recipe.miscs) {
    if (m.use === 'Boil' && m.timeMinutes > 0) {
      raw.push({
        id: `addition-misc-${m.id}`,
        stage: 'boil',
        kind: 'addition',
        label: `Misc addition: ${m.amount} ${m.unit} ${m.name} @ ${m.timeMinutes} min`,
        localOffsetSec: Math.max(0, boilRealSec - m.timeMinutes * 60),
      });
    }
  }

  // hopstand-start (Ambiguity 14): exactly one, labelled with the profile temperature.
  raw.push({
    id: 'hopstand-start',
    stage: 'hopstand',
    kind: 'hopstand-start',
    label: `Cool to ${equipment.hopstandTemperatureC}°C`,
    localOffsetSec: 0,
  });

  const milestones: BrewDayMilestone[] = raw
    .map((m) => ({
      id: m.id,
      stage: m.stage,
      kind: m.kind,
      label: m.label,
      offsetSec: startOffsetByStage[m.stage] + m.localOffsetSec,
      position: positionFor(m.stage, m.localOffsetSec),
    }))
    .sort((a, b) => (a.offsetSec !== b.offsetSec ? a.offsetSec - b.offsetSec : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { segments, milestones, totalDurationSec };
}
