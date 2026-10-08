# FEATURE SPECIFICATION: M16_P1 - Fermentation Stage Assistant: Live Vitals Tracking, Timeline Schedule & Proactive Cellar Alerts

## Phase Summary
Enhance the `Fermentation` stage tab of `BatchDetail.tsx` into an interactive cellar monitoring and management station (`FEAT-014`). This phase delivers:
1. **Proactive Cellar Action Feed & Timeline (`CellarActionFeed.tsx`)**: Derives scheduled cellar actions from the recipe snapshot (dry hop additions and removals from `recipeSnapshot.hops`, fermentation temperature ramp steps from `recipeSnapshot.fermentationProfile.steps`, spunding pressure targets, and cellar finings/adjuncts from `recipeSnapshot.miscs`) synchronized to `batch.fermentationStartDate`. Provides a 1-click **"Mark Done"** action that logs a structured, timestamped note to `batch.notes` (`POST /api/batches/:id/notes`).
2. **Live Fermentation Vitals Dashboard**: Metric cards displaying Current Specific Gravity, Current Temperature, Live Dynamic Apparent Attenuation %, Real-Time Estimated Live ABV %, and Vessel Pressure (PSI) from readings.
3. **Refractometer Fermentation Alcohol Correction Modal (`RefractometerFermentationModal.tsx`)**: In-place optical refractometer conversion during active fermentation using Sean Terrill's cubic formula (`refractometerFinalGravity`), populating corrected SG directly into reading inputs.
4. **Enhanced Multi-Series Fermentation Chart (`FermentationChart.tsx`)**: Renders the planned target temperature schedule profile line alongside measured gravity decay and temperature curves with zero external dependencies.
5. **FG Stability Detector & Conditioning Handoff**: Visual stability badge detecting when gravity has stabilized ($\Delta \text{SG} \le 0.001$ over $\ge 48\text{h}$) with a 1-click **"Advance to Conditioning"** lifecycle handoff button.

---

### Key Behaviors
1. **Cellar Schedule Calculation**:
   - Given `fermentationStartDate` (or falling back to the earliest reading timestamp, or `null` if no start date / readings exist), calculates relative day offsets and absolute target ISO timestamps for every dry hop addition, dry hop removal, fermentation temperature step change, spunding pressure setting, and cellar misc addition.
   - Matches existing `batch.notes` to mark actions completed if a note starting with `[Cellar: <eventId>]` or matching the event text is present.
   - Clicking "Mark Done" issues `POST /api/batches/:id/notes` with text `[Cellar: ${event.id}] ${event.title}` and marks the item completed immediately with an optimistic checkmark.
2. **Live Vitals & Attenuation Tracking**:
   - Displays dynamic apparent attenuation % and live ABV % from $(OG - SG_{\text{latest}})$. If `measuredOg` is null, falls back to estimated recipe OG.
   - Displays latest logged vessel pressure in PSI with ambient / carbonated status.
3. **Refractometer Alcohol Correction Tool**:
   - Opens a quick modal from `ReadingLog` with fields for `Initial Brix / OG`, `Current Reading (°Brix)`, and `Wort Correction Factor` (default `1.04`).
   - Computes corrected FG via `refractometerFinalGravity`.
   - Clicking "Use Corrected SG" passes the value into the reading form's SG input.
4. **Target Temperature Curve on Chart**:
   - `buildFermentationChartModel` accepts `fermentationProfile` and derives target temperature steps across the time domain (`targetTemperaturePoints`).
   - `FermentationChart` renders the target temperature step line (dashed emerald/teal polyline `#2dd4bf`) with its own legend entry.
5. **FG Stability Detection & Handoff**:
   - `detectFgStability` checks all gravity readings. If the last 2+ readings span $\ge 48.0$ hours with $|\Delta \text{SG}| \le 0.001$, surfaces a green "Gravity Stable" badge.
   - Clicking "Advance to Conditioning" auto-fills `measuredFg` with latest SG (if unset), updates batch status to `Conditioning`, and transitions the view.

---

### Resolved Ambiguities (Binding)
1. **Timestamp Anchoring for Cellar Schedule**:
   - Base timestamp $T_0$: `batch.fermentationStartDate !== null ? batch.fermentationStartDate : (batch.readings.length > 0 ? sortReadings(batch.readings)[0].readingTime : null)`.
   - If $T_0 === \text{null}$, relative days are displayed (e.g. "Day 3 (after fermentation start)"), but calendar dates and countdown statuses read "Pending start".
2. **Dry Hop Day Offsets & Durations**:
   - Addition event timestamp: $T_0 + (\text{dryHopDayOffset} \times 86400000)$. If `dryHopDayOffset` is null/undefined, defaults to day 0.
   - Removal event timestamp: $T_0 + ((\text{dryHopDayOffset} + \text{dryHopDurationDays}) \times 86400000)$. Removal event is created only if `dryHopDurationDays` is non-null and $> 0$.
3. **FG Stability Calculation Rule**:
   - Given sorted readings with non-null `sg`, finds `latest = readings[readings.length - 1]`.
   - Searches preceding readings in reverse for the first reading where `(latest.time - prior.time) >= 48 * 3600000`.
   - If found and `Math.abs(latest.sg - prior.sg) <= 0.001`, `detectFgStability` returns `isStable: true`.
4. **Note Completion Tagging**:
   - Note format: `[Cellar: ${event.id}] ${event.title}`.
   - Completion check: `batch.notes.some(n => n.note.includes('[Cellar: ' + event.id + ']') || n.note.includes(event.title))`.

---

## 1. Data Schema & Contracts

### 1.1 Exported Types & Interfaces (`packages/calculations/src/fermentation.ts`)

```typescript
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

export interface FgStabilityResult {
  isStable: boolean;
  readingCount: number;
  latestSg: number | null;
  priorSg: number | null;
  deltaSg: number | null;
  elapsedHours: number | null;
}
```

### 1.2 Pure Function Contracts (`packages/calculations/src/fermentation.ts`)

```typescript
export function calculateCellarSchedule(input: CellarScheduleInput): CellarScheduleEvent[];

export function detectFgStability(
  readings: readonly FermentationReadingPoint[],
  minHours?: number, // default 48
  maxDeltaSg?: number // default 0.001
): FgStabilityResult;
```

---

## 2. Component Architecture & Integration Contracts

### 2.1 Component Structure
- `apps/web/src/components/CellarActionFeed.tsx` (New Component):
  - Renders event cards sorted by scheduled day/time.
  - Displays relative countdown badges ("Today", "In 2 days", "Overdue", "Completed").
  - "Mark Done" action button invoking `onMarkDone(event)`.
- `apps/web/src/components/RefractometerFermentationModal.tsx` (New Component):
  - Modal with Brix inputs and WCF adjustment.
  - Computes `refractometerFinalGravity` live.
  - "Use Corrected SG" action populating the reading form.
- `apps/web/src/components/FermentationChart.tsx` (Enhanced):
  - Accepts optional `targetTemperaturePoints` from `FermentationChartModel`.
  - Renders target temperature stepped/ramped line with emerald `#2dd4bf` stroke and dashed style.
- `apps/web/src/pages/BatchDetail.tsx` (Integrated):
  - Mounts `CellarActionFeed` above `FermentationChart` in `activeTab === 'fermentation'`.
  - Displays enhanced live vitals tiles (Live Attenuation, Live ABV, SG, Temp, Pressure).
  - Displays FG Stability alert badge and 1-click "Advance to Conditioning" handoff.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| AC-1 | Cellar Schedule Dry Hop Events | Unit Test | Derives addition and removal events with correct day offsets and descriptions from recipe hops. |
| AC-2 | Cellar Schedule Fermentation Step Events | Unit Test | Derives sequential temperature ramp steps with cumulative start days from fermentation profile. |
| AC-3 | Cellar Schedule Misc & Pressure Events | Unit Test | Derives cellar misc additions and pressure targets when present. |
| AC-4 | Cellar Action Note Completion Matching | Unit Test | Marks `isCompleted: true` when note contains `[Cellar: <id>]` tag or title. |
| AC-5 | FG Stability Detection Positive Case | Unit Test | Returns `isStable: true` when 2 readings separated by $\ge 48\text{h}$ have $|\Delta \text{SG}| \le 0.001$. |
| AC-6 | FG Stability Detection Negative Cases | Unit Test | Returns `isStable: false` when time $< 48\text{h}$, $\Delta \text{SG} > 0.001$, or $< 2$ readings. |
| AC-7 | Refractometer Fermentation Math Integration | Unit Test | `refractometerFinalGravity` accurately calculates alcohol-corrected SG with Terrill's cubic. |
| AC-8 | CellarActionFeed Component Rendering | Component Test | Renders action cards, relative badges, and "Mark Done" buttons. |
| AC-9 | CellarActionFeed "Mark Done" Action | Integration Test | Clicking "Mark Done" invokes note creation callback with structured cellar note. |
| AC-10 | Refractometer Modal Conversion & Insertion | Component Test | Calculates corrected SG and populates reading input via callback. |
| AC-11 | FermentationChart Target Temp Line | Component Test | SVG renders target temperature line and legend entry when profile steps are present. |
| AC-12 | Live Fermentation Vitals Display | Component Test | Vitals tiles display current SG, live attenuation %, live estimated ABV %, temp, and pressure. |
| AC-13 | FG Stability Alert Badge | Component Test | Surfaces "Gravity Stable" badge when `detectFgStability` is true. |
| AC-14 | Advance to Conditioning 1-Click Handoff | Integration Test | Advances batch status to `Conditioning`, sets `measuredFg`, and transitions stage tab. |
| AC-15 | Four Gates Clean | Gate | `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` all exit 0. |
| AC-16 | Scope Guardrail | Manifest Diff | Only files in §4 allowlist are modified/created. Protected files `fixtures.test.ts` and `designSystem.ts` are byte-unchanged. |

---

## 4. Scope Guardrail Allowlist
Permitted files for Milestone 16 Phase 1:
- `packages/calculations/src/fermentation.ts`
- `packages/calculations/src/index.ts`
- `packages/calculations/test/cellarSchedule.test.ts`
- `apps/web/src/components/CellarActionFeed.tsx`
- `apps/web/src/components/RefractometerFermentationModal.tsx`
- `apps/web/src/components/FermentationChart.tsx`
- `apps/web/src/pages/BatchDetail.tsx`
- `apps/web/test/CellarActionFeed.test.tsx`
- `apps/web/test/RefractometerFermentationModal.test.tsx`
- `apps/web/test/FermentationChart.test.tsx`
- `apps/web/test/BatchDetail.test.tsx`
- `.gsd/FEATURES.md`
- `.gsd/ROADMAP.md`
- `.gsd/STATE.json`

Protected files (must remain byte-unchanged):
- `packages/calculations/test/fixtures.test.ts`
- `apps/web/src/components/designSystem.ts`

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
