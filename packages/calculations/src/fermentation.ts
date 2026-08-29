import { apparentAttenuationPct } from './brewingMath';
import { sortByInstantThenId } from './chronology';
import type { Recipe, FermentationProfile } from '@truchabrew/shared-types';

// M5_P1 spec §2.2-§2.4 / M5_P2 spec §2.1 / M16_P1 spec §1.1-§1.2. No function in this module performs
// I/O, reads the current wall-clock time, generates an id, or touches a
// random source. Date.parse on a caller-supplied string is not a clock read.

// ---------------------------------------------------------------------------
// Ordering and selection
// ---------------------------------------------------------------------------

export interface FermentationReadingPoint {
  id: string;
  readingTime: string;
  sg: number | null;
  tempC: number | null;
}

/**
 * A NEW array, ascending by Date.parse(readingTime), ties broken by `id`
 * lexicographic ascending. Never mutates the input. A readingTime that does
 * not parse sorts LAST (after every parseable one), ties among unparseable
 * ones broken by `id` — deterministic rather than NaN-dependent, even though
 * the route contract makes it unreachable. Signature, doc-comment contract
 * and observable behaviour UNCHANGED by the M5_P2 refactor — the body now
 * delegates to sortByInstantThenId, the ONE comparator in this repo
 * (chronology.ts), rather than reimplementing it (AC-4/AC-47).
 */
export function sortReadings<T extends { id: string; readingTime: string }>(readings: readonly T[]): T[] {
  return sortByInstantThenId(readings, (r) => r.readingTime);
}

/** Canonical note order: timestamp ascending, ties by id ascending (M5_P2 spec §2.1). */
export function sortBatchNotes<T extends { id: string; timestamp: string }>(notes: readonly T[]): T[] {
  return sortByInstantThenId(notes, (n) => n.timestamp);
}

/**
 * The maximum non-null tempC across `readings`. `null` when the array is
 * empty or every tempC is null — NEVER -Infinity, which is what an unguarded
 * Math.max(...[]) returns (M5_P2 spec §2.1).
 */
export function peakFermentationTempC(readings: readonly FermentationReadingPoint[]): number | null {
  let peak: number | null = null;
  for (const r of readings) {
    if (r.tempC === null) continue;
    if (peak === null || r.tempC > peak) peak = r.tempC;
  }
  return peak;
}

/**
 * The LAST element of sortReadings(readings) whose `sg !== null`. `null` when
 * the array is empty or every element has `sg === null`. Deliberately NOT
 * "the last reading" — a temperature-only reading logged after a gravity
 * reading must not blank the attenuation figure.
 */
export function latestGravityReading<T extends FermentationReadingPoint>(readings: readonly T[]): T | null {
  const sorted = sortReadings(readings);
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].sg !== null) return sorted[i];
  }
  return null;
}

export type OriginalGravitySource = 'measured' | 'estimated';
export interface ResolvedOriginalGravity {
  og: number;
  source: OriginalGravitySource;
}

/** measuredOg !== null wins. Never a falsy check — a stored 0 is not absence. */
export function resolveOriginalGravity(measuredOg: number | null, estimatedOg: number): ResolvedOriginalGravity {
  if (measuredOg !== null) {
    return { og: measuredOg, source: 'measured' };
  }
  return { og: estimatedOg, source: 'estimated' };
}

// ---------------------------------------------------------------------------
// Fermentation progress
// ---------------------------------------------------------------------------

export interface FermentationProgressInput {
  readings: readonly FermentationReadingPoint[];
  measuredOg: number | null;
  estimatedOg: number;
  fermentationStartDate: string | null;
}

export type FermentationProgress =
  | { hasGravityReading: false }
  | {
      hasGravityReading: true;
      originalGravity: number;
      originalGravitySource: OriginalGravitySource;
      latestSg: number;
      latestReadingId: string;
      latestReadingTime: string;
      apparentAttenuationPct: number; // UNROUNDED, unclamped; may be negative
      elapsedHours: number | null; // null iff no t0 can be established
    };

/**
 * `hasGravityReading` is `false` iff `latestGravityReading(readings) ===
 * null`. `apparentAttenuationPct` is imported from brewingMath.ts, not
 * reimplemented (AC-9) — reused unrounded and unclamped. `elapsedHours` is
 * measured from `t0` (fermentationStartDate precedence, same rule as
 * buildFermentationChartModel) to `latestReadingTime`; it is `null` only when
 * `readings` is empty, which is unreachable on the `hasGravityReading: true`
 * branch — the `null` arm exists so the type never forces a fabricated `0`.
 */
export function calculateFermentationProgress(input: FermentationProgressInput): FermentationProgress {
  const latest = latestGravityReading(input.readings);
  if (latest === null) {
    return { hasGravityReading: false };
  }

  const resolved = resolveOriginalGravity(input.measuredOg, input.estimatedOg);
  const latestSg = latest.sg as number; // non-null by latestGravityReading's contract

  let elapsedHours: number | null = null;
  if (input.readings.length > 0) {
    const t0 = input.fermentationStartDate !== null ? input.fermentationStartDate : sortReadings(input.readings)[0].readingTime;
    elapsedHours = (Date.parse(latest.readingTime) - Date.parse(t0)) / 3600000;
  }

  return {
    hasGravityReading: true,
    originalGravity: resolved.og,
    originalGravitySource: resolved.source,
    latestSg,
    latestReadingId: latest.id,
    latestReadingTime: latest.readingTime,
    apparentAttenuationPct: apparentAttenuationPct(resolved.og, latestSg),
    elapsedHours,
  };
}

// ---------------------------------------------------------------------------
// Chart model
// ---------------------------------------------------------------------------

export interface ChartPoint {
  readingId: string;
  elapsedHours: number; // may be negative
  sg: number | null;
  tempC: number | null;
}

export interface TargetTemperaturePoint {
  elapsedHours: number;
  targetTempC: number;
}

export interface ChartAxis {
  min: number;
  max: number;
  ticks: number[]; // exactly 5, ascending, ticks[0] === min, ticks[4] === max
}

export interface FermentationChartInput {
  readings: readonly FermentationReadingPoint[];
  fermentationStartDate: string | null;
  fermentationProfile?: FermentationProfile | null;
}

export type FermentationChartModel =
  | { hasPoints: false }
  | {
      hasPoints: true;
      t0: string; // the ISO instant elapsedHours is measured from
      points: ChartPoint[]; // sortReadings order; elapsedHours ascending
      targetTemperaturePoints: TargetTemperaturePoint[];
      timeAxis: ChartAxis;
      gravityAxis: ChartAxis | null; // null iff no point has sg !== null
      temperatureAxis: ChartAxis | null; // null iff no point has tempC !== null and targetTemperaturePoints is empty
    };

// Degenerate axis widening pads (Resolved Ambiguities): applied whenever an
// axis's computed min === max, so the renderer never divides by (max - min)
// === 0.
const TIME_AXIS_PAD_HOURS = 1;
const GRAVITY_AXIS_PAD = 0.005;
const TEMPERATURE_AXIS_PAD_C = 1;

/**
 * Ticks are exactly five, evenly spaced, endpoints inclusive — no
 * "nice number" rounding algorithm. ticks[0]/ticks[4] are set to exactly
 * min/max so the endpoints are exact rather than accumulated through the
 * step multiplication.
 */
function buildAxis(values: readonly number[], pad: number): ChartAxis {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= pad;
    max += pad;
  }
  const ticks = [0, 1, 2, 3, 4].map((i) => min + (i * (max - min)) / 4);
  ticks[0] = min;
  ticks[4] = max;
  return { min, max, ticks };
}

/**
 * Pure. Never throws. Never returns NaN or Infinity in any numeric field.
 *
 * `t0` precedence: `fermentationStartDate !== null` -> that value;
 * otherwise `sortReadings(readings)[0].readingTime`.
 * `elapsedHours = (Date.parse(t) - Date.parse(t0)) / 3600000`, unrounded,
 * not clamped at zero.
 */
export function buildFermentationChartModel(input: FermentationChartInput): FermentationChartModel {
  const sorted = sortReadings(input.readings);
  if (sorted.length === 0) {
    return { hasPoints: false };
  }

  const t0 = input.fermentationStartDate !== null ? input.fermentationStartDate : sorted[0].readingTime;
  const t0Time = Date.parse(t0);

  const points: ChartPoint[] = sorted.map((r) => ({
    readingId: r.id,
    elapsedHours: (Date.parse(r.readingTime) - t0Time) / 3600000,
    sg: r.sg,
    tempC: r.tempC,
  }));

  const targetTemperaturePoints: TargetTemperaturePoint[] = [];
  if (input.fermentationProfile && input.fermentationProfile.steps && input.fermentationProfile.steps.length > 0) {
    let cumulativeHours = 0;
    for (const step of input.fermentationProfile.steps) {
      const stepDurationHours = step.stepTimeDays * 24;
      targetTemperaturePoints.push({
        elapsedHours: cumulativeHours,
        targetTempC: step.stepTempC,
      });
      cumulativeHours += stepDurationHours;
      targetTemperaturePoints.push({
        elapsedHours: cumulativeHours,
        targetTempC: step.stepTempC,
      });
    }
  }

  const allTimeHours = [
    ...points.map((p) => p.elapsedHours),
    ...(targetTemperaturePoints.length > 0 ? [targetTemperaturePoints[0].elapsedHours, targetTemperaturePoints[targetTemperaturePoints.length - 1].elapsedHours] : []),
  ];

  const timeAxis = buildAxis(
    allTimeHours,
    TIME_AXIS_PAD_HOURS,
  );

  const gravityValues = points.filter((p) => p.sg !== null).map((p) => p.sg as number);
  const gravityAxis = gravityValues.length === 0 ? null : buildAxis(gravityValues, GRAVITY_AXIS_PAD);

  const temperatureValues = [
    ...points.filter((p) => p.tempC !== null).map((p) => p.tempC as number),
    ...targetTemperaturePoints.map((p) => p.targetTempC),
  ];
  const temperatureAxis = temperatureValues.length === 0 ? null : buildAxis(temperatureValues, TEMPERATURE_AXIS_PAD_C);

  return {
    hasPoints: true,
    t0,
    points,
    targetTemperaturePoints,
    timeAxis,
    gravityAxis,
    temperatureAxis,
  };
}

// ---------------------------------------------------------------------------
// Cellar Schedule & Proactive Actions (M16_P1 / FEAT-014)
// ---------------------------------------------------------------------------

export type CellarEventType = 'dry_hop_add' | 'dry_hop_remove' | 'temperature_step' | 'pressure_target' | 'misc_addition';

export interface CellarScheduleEvent {
  id: string;
  type: CellarEventType;
  title: string;
  description: string;
  dayOffset: number;
  durationDays?: number | null;
  targetTimestamp: string | null; // ISO-8601 UTC string if T0 established, else null
  targetTempC?: number | null;
  targetPressurePsi?: number | null;
  amount?: number | null;
  unit?: string | null;
  isCompleted: boolean;
  completedAt?: string | null;
}

export interface CellarScheduleInput {
  fermentationStartDate: string | null;
  recipe: Recipe;
  readings: readonly FermentationReadingPoint[];
  notes: readonly { id: string; timestamp: string; note: string }[];
}

export function calculateCellarSchedule(input: CellarScheduleInput): CellarScheduleEvent[] {
  const events: CellarScheduleEvent[] = [];

  const t0 = input.fermentationStartDate !== null
    ? input.fermentationStartDate
    : (input.readings.length > 0 ? sortReadings(input.readings)[0].readingTime : null);
  const t0Ms = t0 !== null ? Date.parse(t0) : null;

  function isNoteCompleted(eventId: string, title: string): { isCompleted: boolean; completedAt: string | null } {
    const matchingNote = input.notes.find(
      (n) => n.note.includes(`[Cellar: ${eventId}]`) || n.note.includes(title)
    );
    if (matchingNote) {
      return { isCompleted: true, completedAt: matchingNote.timestamp };
    }
    return { isCompleted: false, completedAt: null };
  }

  // 1. Dry Hops
  if (input.recipe.hops) {
    for (const hop of input.recipe.hops) {
      if (hop.use === 'DryHop' || (hop.dryHopDayOffset !== null && hop.dryHopDayOffset !== undefined)) {
        const dayOffset = hop.dryHopDayOffset ?? 0;
        const addEventId = `dry-hop-add-${hop.id}`;
        const addTitle = `Add ${hop.amountG}g ${hop.name} (Dry Hop)`;
        const addTimestamp = t0Ms !== null ? new Date(t0Ms + dayOffset * 86400000).toISOString() : null;
        const addCompletion = isNoteCompleted(addEventId, addTitle);

        events.push({
          id: addEventId,
          type: 'dry_hop_add',
          title: addTitle,
          description: `Dry hop addition (${hop.type}, ${hop.alphaAcidPct}% AA)`,
          dayOffset,
          durationDays: hop.dryHopDurationDays ?? null,
          targetTimestamp: addTimestamp,
          amount: hop.amountG,
          unit: 'g',
          isCompleted: addCompletion.isCompleted,
          completedAt: addCompletion.completedAt,
        });

        if (hop.dryHopDurationDays !== null && hop.dryHopDurationDays !== undefined && hop.dryHopDurationDays > 0) {
          const remOffset = dayOffset + hop.dryHopDurationDays;
          const remEventId = `dry-hop-remove-${hop.id}`;
          const remTitle = `Remove / rack ${hop.name} dry hops`;
          const remTimestamp = t0Ms !== null ? new Date(t0Ms + remOffset * 86400000).toISOString() : null;
          const remCompletion = isNoteCompleted(remEventId, remTitle);

          events.push({
            id: remEventId,
            type: 'dry_hop_remove',
            title: remTitle,
            description: `Dry hop exposure complete (${hop.dryHopDurationDays} days)`,
            dayOffset: remOffset,
            targetTimestamp: remTimestamp,
            isCompleted: remCompletion.isCompleted,
            completedAt: remCompletion.completedAt,
          });
        }
      }
    }
  }

  // 2. Fermentation Steps
  if (input.recipe.fermentationProfile && input.recipe.fermentationProfile.steps) {
    let cumulativeDays = 0;
    for (const step of input.recipe.fermentationProfile.steps) {
      const stepStartDay = cumulativeDays;
      const stepEndDay = cumulativeDays + step.stepTimeDays;
      const stepEventId = `ferm-step-${step.id}`;
      const stepTitle = `${step.name}: ${step.stepTempC.toFixed(1)}°C (${step.stepTimeDays} days)`;
      const stepTimestamp = t0Ms !== null ? new Date(t0Ms + stepEndDay * 86400000).toISOString() : null;
      const stepCompletion = isNoteCompleted(stepEventId, stepTitle);

      events.push({
        id: stepEventId,
        type: 'temperature_step',
        title: stepTitle,
        description: `Maintain ${step.stepTempC.toFixed(1)}°C for ${step.stepTimeDays} days (Stage: ${step.type})`,
        dayOffset: stepStartDay,
        durationDays: step.stepTimeDays,
        targetTempC: step.stepTempC,
        targetTimestamp: stepTimestamp,
        isCompleted: stepCompletion.isCompleted,
        completedAt: stepCompletion.completedAt,
      });

      if (step.pressurePsi !== null && step.pressurePsi !== undefined) {
        const pressureEventId = `pressure-target-${step.id}`;
        const pressureTitle = `Set Spunding Valve to ${step.pressurePsi.toFixed(1)} PSI`;
        const pressureCompletion = isNoteCompleted(pressureEventId, pressureTitle);

        events.push({
          id: pressureEventId,
          type: 'pressure_target',
          title: pressureTitle,
          description: `Carbonation & spunding pressure target for ${step.name}`,
          dayOffset: stepStartDay,
          targetPressurePsi: step.pressurePsi,
          targetTimestamp: stepTimestamp,
          isCompleted: pressureCompletion.isCompleted,
          completedAt: pressureCompletion.completedAt,
        });
      }

      cumulativeDays += step.stepTimeDays;
    }
  }

  // 3. Cellar Miscs
  if (input.recipe.miscs) {
    for (const misc of input.recipe.miscs) {
      if (misc.use === 'Primary' || misc.use === 'Secondary') {
        const dayOffset = misc.use === 'Primary' ? 0 : 4;
        const miscEventId = `cellar-misc-${misc.id}`;
        const miscTitle = `Add ${misc.amount} ${misc.unit} ${misc.name} (${misc.use})`;
        const miscTimestamp = t0Ms !== null ? new Date(t0Ms + dayOffset * 86400000).toISOString() : null;
        const miscCompletion = isNoteCompleted(miscEventId, miscTitle);

        events.push({
          id: miscEventId,
          type: 'misc_addition',
          title: miscTitle,
          description: `Cellar addition (${misc.type}, ${misc.use})`,
          dayOffset,
          amount: misc.amount,
          unit: misc.unit,
          targetTimestamp: miscTimestamp,
          isCompleted: miscCompletion.isCompleted,
          completedAt: miscCompletion.completedAt,
        });
      }
    }
  }

  return events.sort((a, b) => {
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
    return a.id.localeCompare(b.id);
  });
}

// ---------------------------------------------------------------------------
// FG Stability Detection (M16_P1 / FEAT-014)
// ---------------------------------------------------------------------------

export interface FgStabilityResult {
  isStable: boolean;
  readingCount: number;
  latestSg: number | null;
  priorSg: number | null;
  deltaSg: number | null;
  elapsedHours: number | null;
}

export function detectFgStability(
  readings: readonly FermentationReadingPoint[],
  minHours = 48,
  maxDeltaSg = 0.001
): FgStabilityResult {
  const sorted = sortReadings(readings).filter((r) => r.sg !== null);
  if (sorted.length < 2) {
    return {
      isStable: false,
      readingCount: sorted.length,
      latestSg: sorted[0]?.sg ?? null,
      priorSg: null,
      deltaSg: null,
      elapsedHours: null,
    };
  }

  const latest = sorted[sorted.length - 1];
  const latestTime = Date.parse(latest.readingTime);
  const latestSg = latest.sg as number;

  for (let i = sorted.length - 2; i >= 0; i--) {
    const prior = sorted[i];
    const priorTime = Date.parse(prior.readingTime);
    const elapsed = (latestTime - priorTime) / 3600000;

    if (elapsed >= minHours) {
      const rawDelta = Math.abs(latestSg - (prior.sg as number));
      const delta = Number(rawDelta.toFixed(4));
      return {
        isStable: delta <= maxDeltaSg,
        readingCount: sorted.length,
        latestSg,
        priorSg: prior.sg,
        deltaSg: delta,
        elapsedHours: Number(elapsed.toFixed(1)),
      };
    }
  }

  const earliest = sorted[0];
  const earliestTime = Date.parse(earliest.readingTime);
  const totalElapsed = (latestTime - earliestTime) / 3600000;
  const delta = Math.abs(latestSg - (earliest.sg as number));

  return {
    isStable: false,
    readingCount: sorted.length,
    latestSg,
    priorSg: earliest.sg,
    deltaSg: Number(delta.toFixed(4)),
    elapsedHours: Number(totalElapsed.toFixed(1)),
  };
}

