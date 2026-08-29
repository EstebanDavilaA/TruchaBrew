# FEATURE SPECIFICATION: M18_P1 - Brew Day Experience & Brew Sheet Viewer

**Milestone:** 18 — Brew Day Experience & Brew Sheet Viewer
**Phase:** 1 (of 1 estimated)
**Features formalized:** `FEAT-019`, `FEAT-020`
**Bugs absorbed:** `BUG-022` (Boil additions checklist control unification) and `BUG-023` (redundant accept button removal).

## Phase Summary

Deliver the two remaining halves of the Brewing stage tab experience:

1. **Brew Sheet Viewer (`FEAT-019` part 1)** — a toggleable, printable recipe reference sheet rendered above the brew day controls, carrying the full recipe specification (header, equipment, water volumes, vitals, mash schedule, malts, hops, miscs, yeast, fermentation schedule, carbonation).
2. **Continuous segmented timeline (`FEAT-019` part 2)** — replace the current four discrete pill buttons with one continuous horizontal progress bar carrying milestone event dots, add the two missing stepper controls (`|◀` Previous Step, `✎` Adjust Time) and a global power/reset, promote the timer into a large centered digital box, add a green stage header, and extend the live checklist from boil-only to all four stages.
3. **Target placeholders (`FEAT-020`)** — expected recipe targets surfaced as placeholder text in all five Brew Day Measurements fields. *(Post-approval correction, BUG-023, 2026-08-19: the "Use Expected Target" 1-click accept control originally specified below was removed at the user's explicit request after the build — the placeholder-only, non-destructive hint was already the wanted behavior, and the extra accept click was redundant. AC-37/AC-38/AC-39 below are superseded; see the addendum at the end of this document.)*

### Current-State Audit (binding — read before drafting any implementation)

A prior out-of-band assistant (`antigravity-gemini`) shipped a substantial part of `FEAT-019` part 2 under the rule-7 lightweight-task exception before this spec existed. The following was verified **by direct inspection of the working tree** on 2026-08-19 and is therefore **ALREADY BUILT — no acceptance criterion in §3 re-specifies it, and the executor must not rebuild, refactor, or "improve" it**:

| Already built | Evidence |
|---|---|
| Exactly 4 brewing sub-stages `prep → mash → boil → hopstand`; redundant `Fermenter` step removed | `BrewDayTracker.tsx:8` `STAGE_KEYS` |
| Wall-clock-anchored countdown (`targetEndByKey` vs `Date.now()`), immune to tab throttling | `BrewDayTracker.tsx:57-65,152-176` |
| `▶` Play / `⏸` Pause / `↺` Reset Step / `▶|` Skip controls | `BrewDayTracker.tsx:216-251,347-364` |
| Fast-Forward control | `BrewDayTracker.tsx:238-245,356-358` |
| Sound mute/unmute toggle + Web Audio alerts (`completion`, `warning`, `chime`) | `BrewDayTracker.tsx:67,193-214,291-299` |
| Per-mash-step independent timer progress and step picker | `BrewDayTracker.tsx:139-140,369-390` |
| Boil additions checklist with pulsing **ADD NOW** badge and per-item `Mark Added` toggle | `BrewDayTracker.tsx:392-452` |
| `👉 ADD NOW:` guidance escalation for a due, unchecked addition | `BrewDayTracker.tsx:270-273` |
| Full tracker state reset on `batch.id` change | `BrewDayTracker.tsx:75-83` |
| All five Brew Day Measurements **fields exist and persist** (`measuredPreBoilGravity`, `measuredMashPh`, `measuredBoilSizeL`, `measuredBoilTimeMin`, `measuredOg`) | `BatchDetail.tsx:858-919` |
| `Est: <preBoilGravity>` hint text in the Pre-boil Gravity **label** | `BatchDetail.tsx:864` |
| `predictedMashPh` already computed and rendered as a metric tile | `BatchDetail.tsx:226,850-855` |

The following is the **genuine gap** this phase builds:

| Gap | Owner |
|---|---|
| Brew Sheet Viewer — no such component, no print support, zero occurrences of `BrewSheet` / `window.print` / `@media print` anywhere under `apps/web/src/` | `FEAT-019` §1 |
| Continuous horizontal progress bar (current UI is a wrapped row of discrete pill buttons) | `FEAT-019` §2 |
| Milestone event dots | `FEAT-019` §2 |
| `|◀` Previous Step control | `FEAT-019` §2 |
| `✎` Adjust Time control | `FEAT-019` §2 |
| Global power/reset button | `FEAT-019` §2 |
| Large **centered digital timer box** (current timer is inline text, and `formatMmSs` does not zero-pad minutes) | `FEAT-019` §2 |
| Green highlight stage header (`Start Mash Tracker`, …) | `FEAT-019` §2 |
| Instruction checklists for `prep`, `mash`, `hopstand` (only `boil` has one) | `FEAT-019` §2 |
| Placeholder targets on all 5 measurement inputs | `FEAT-020` §1 |
| ~~1-click "Use Expected Target" accept controls~~ | ~~`FEAT-020` §2~~ — removed post-approval, BUG-023 |

### Key Behaviors

- The Brew Sheet is **collapsed by default** and toggles open/closed without touching batch form state.
- The timeline is one continuous bar whose four segments are width-proportional to real stage durations, with milestone dots positioned along it.
- The timer box shows zero-padded `MM:SS` with **uncapped minutes** (an 85-minute mash reads `85:00`).
- Every measurement input shows its expected target as a placeholder; **nothing is ever auto-written into the form** — the field is only ever set by what the brewer actually types (BUG-023: the one-click accept control was removed post-approval as redundant, not as a relaxation of this non-destructive guarantee).

## Resolved Ambiguities (Binding)

These resolutions are binding. Where they depart from `FEAT-019`/`FEAT-020`/`ROADMAP.md` literal text, they also appear in §5's deviation register.

1. **No auto pre-fill, anywhere.** `FEAT-020` says Boil Time is "Pre-filled with recipe boil duration". This is **rejected** for all five fields including Boil Time. No target value is ever written into `formData` on mount, on tab switch, or on re-render. Rationale: an auto-write marks the batch dirty without user action and records an unmeasured estimate as a *measured* value — and `measuredBoilSizeL` / `measuredOg` / `measuredPreBoilGravity` are read by M17's post-brew calibration (`PostBrewCalibrationModal`) and by `measuredMashEfficiencyPct`, so a silently-injected estimate would corrupt equipment-profile calibration with fabricated data. All five fields are uniformly placeholder-plus-accept.

2. **Accept-control mount condition.** The accept control for field *F* renders **iff** `target.value !== null` **AND** `formData[F] === null`. The check is `=== null`, never a falsy test — `measuredBoilTimeMin === 0` is a real user-entered value and must **not** re-show the accept control. Once a value is present the control unmounts; clearing the input back to `null` re-mounts it.

3. **Accept-control effect.** Clicking it sets `formData[F]` to `target.value` — the **rounded** number, byte-identical to what `Number(target.placeholder)` yields — and nothing else. It does not save, does not navigate, does not advance any stage.

4. **No placeholder when there is no target.** When `target.value === null` the input renders with the `placeholder` attribute **absent entirely** — not `placeholder=""`, and never a `0`, `—`, `NaN`, `null`, or `undefined` string. This is the no-match/fallback contract: `deriveMeasurementTargets` returns `{ value: null, placeholder: null, source: null }` and the caller **must branch on it** rather than interpolate.

5. **Mash pH target precedence.** `predictedMashPh` (source `'waterChemistry'`) when `!== null`; else `recipe.mashProfile.targetPh` (source `'mashProfile'`) when the profile is non-null; else `{ value: null, placeholder: null, source: null }`.

6. **Boil Size target source.** `FEAT-020` says "estimated pre-boil volume from equipment profile". The equipment profile carries no pre-boil volume field; the computed quantity is `stats.preBoilVolumeL`. That is the binding source (`source: 'stats'`).

7. **`stats === null` degenerate case.** `preBoilGravity`, `boilSizeL`, and `og` all return null targets. `boilTimeMin` still resolves from `equipment.boilTimeMin` — it does not depend on `stats`.

8. **Target rounding, exact.** `preBoilGravity` and `og`: 3 decimals. `mashPh`: 2 decimals. `boilSizeL`: 1 decimal. `boilTimeMin`: 0 decimals (integer). Placeholders are the `toFixed(n)` string of the rounded value: `'1.047'`, `'5.25'`, `'34.7'`, `'60'`. No unit suffix inside the placeholder — units live in the label.

9. **Brew Sheet default state.** Collapsed (`OFF`) on every mount. State is component-local and ephemeral: not persisted to the batch, not to `localStorage`, not to the URL. Toggling never sets `isDirty`.

10. **Print mechanism.** A `Print` button inside the brew sheet header calls `window.print()` exactly once per click. The sheet's outermost element carries `data-testid="brew-sheet"` and `data-brew-sheet-print-root=""`. Print fidelity itself is **not** assertable in jsdom; §3's print AC asserts only the `window.print` invocation and the presence of the print-root hook plus the `print:` utility classes in the rendered `class` attribute.

11. **Empty-collection rendering.** Zero fermentables, hops, miscs, yeasts, or fermentation steps each render an explicit single `None` row inside that section — never an empty `<tbody>`, never a hidden section, never a crash.

12. **Percent arithmetic guard.** `percentOfGrist` is `0` (not `NaN`, not `null`) when `totalKg <= 0`; `percentOfTotalHops` is `0` when `totalG <= 0`.

13. **Timer formatting.** `formatMmSs` is changed to zero-pad minutes to a **minimum** of 2 digits while leaving minutes **uncapped**: `formatMmSs(0) === '00:00'`, `formatMmSs(300) === '05:00'`, `formatMmSs(3600) === '60:00'`, `formatMmSs(5100) === '85:00'`. This changes existing rendered output (`5:00` → `05:00`); existing assertions in `apps/web/test/BrewDayTracker.test.tsx` that match the unpadded form must be updated, and that file is on §4's Modified allowlist for exactly that reason.

14. **Hopstand temperature is read from the profile, not hardcoded.** `BrewDayTracker.tsx:283` currently hardcodes `Cool to 80°C`. Both the hopstand guidance string and the hopstand milestone dot label must read `equipment.hopstandTemperatureC`. This is a genuine defect fix inside this phase's scope.

15. **Mash-out milestone derivation.** `MashStepType` is `'Infusion' | 'Decoction' | 'Temperature'` — there is **no** `MashOut` member. A mash-out dot is emitted **iff** the *last* mash step's `stepTempC >= MASH_OUT_MIN_TEMP_C` (exported constant, value `75`, comparison `>=` inclusive); otherwise no mash-out dot is emitted. `74.99` → no dot; `75.0` → dot.

16. **Sparge milestone derivation.** Emitted **iff** `stats.spargeWaterL > 0` (strict `>`, so a no-sparge BIAB recipe at exactly `0` gets no dot).

17. **Chilling-completion milestone omitted.** `FEAT-019` lists a "chilling completion" dot. There is no chill duration, chill timer, or chill-complete event anywhere in the data model or the tracker, so no position along the bar can be derived for it. It is deliberately not emitted. See deviation D-6.

18. **Degenerate timeline (zero durations).** `prep` always has `durationSec === 0`; a recipe with no boil and no hopstand can drive the real total to `0`. To keep the bar from collapsing or dividing by zero, `widthFraction` is computed from a **display** duration `max(durationSec, MIN_SEGMENT_DISPLAY_SEC)` (exported constant, `300` seconds). Consequences, all binding: `widthFraction` is never `0`, never `NaN`; the four `widthFraction` values sum to `1` within `1e-9`; when every real duration is `0` all four are exactly `0.25`. `totalDurationSec` separately reports the **real** sum (so it can legitimately be `0`) and is never substituted with the display sum.

19. **Milestone ordering and stability.** `milestones` is sorted ascending by `offsetSec`, ties broken by ascending `id` string comparison — deterministic across runs, so a snapshot-style assertion is stable.

20. **`Previous Step` (`|◀`) semantics.** Decrements `activeStageIndex`, floored at `0` (no wrap). Freezes the outgoing timer into `remainingByKey` exactly as `handlePause` does, sets `running` to `false`, and **does not** play the chime (unlike `Skip`) and **does not** reset the destination stage's stored progress.

21. **`Adjust Time` (`✎`) semantics.** Toggles an inline numeric minutes input (not a modal, no portal). Committing sets `remainingByKey[timerKey] = minutes * 60` and, when `running`, re-anchors `targetEndByKey[timerKey] = Date.now() + minutes * 1000 * 60`. Accepted range is `[0, 600]` minutes inclusive on both ends; a non-numeric or out-of-range entry is rejected with **no state change at all** (`601` → rejected, `600` → accepted, `0` → accepted, `-1` → rejected).

22. **Global power/reset semantics.** Restores every piece of tracker-local state to its mount default — identical in effect to the body of the existing `batch.id` effect (`BrewDayTracker.tsx:75-83`) plus the new checklist state. It requires no confirmation because it touches **only ephemeral local state**: it must not call `onMeasuredFieldChange`, must not mutate `formData`, and must not issue any request.

23. **Checklist state scope.** Per-stage instruction checklists are ephemeral component state keyed by a stable synthetic item id. They reset on batch change and on global reset. They are **not** persisted to the batch record and **not** sent to the API.

24. **Carbonation source.** `FEAT-019` lists "target Carbonation (CO2 volumes)" under recipe details, but no recipe-level carbonation field exists — the value lives on the batch (`batch.carbonationVolumesTarget`, nullable). `buildBrewSheetModel` takes it as an explicit input and the sheet renders `—` when it is `null`.

25. **Fast-Forward is retained.** `FEAT-019`'s control list (`|◀ ↺ ▶/⏸ ✎ ▶|`) omits Fast-Forward, but it already ships and is covered by M15_P1's verified AC-8. It stays, unchanged. Its removal is explicitly **not** in scope.

26. **Scope-guardrail method.** `git rev-list --count HEAD` is `1` in this repository — the sole commit `7d88e64` predates M1 through M17, so **`git diff --name-only` against any base commit cannot distinguish this phase's work from the entire project's**. This is the sixth recurrence of that unsatisfiable-criterion class (M1 AC-42, M2 AC-11, M3_P1 AC-46, M3_P2 AC-64, M4_P1 AC-7). AC-30 therefore mandates a **pre/post SHA-256 content manifest**: the executor runs `git ls-files -co --exclude-standard -z | xargs -0 sha256sum` **before its first edit** and again at the end of the build, and diffs the two. Paths under `.gsd/` are excluded from the comparison.

## 1. Data Schema & Contracts

**No database migration. No schema change. No API route change.** Every value the brew sheet and the measurement targets need is already present on `BatchWithReadings`, `Recipe`, `EquipmentProfile`, and `CalculatedStats`. `packages/shared-types` is **byte-unchanged** in this phase.

### 1.1 New module — `packages/calculations/src/brewSheet.ts`

Exported types:

```
export interface BrewSheetVitals {
  og: number; fg: number; abv: number; ibu: number;
  buGu: number; srm: number; ebc: number; platoOg: number;
}

export interface BrewSheetVolumes {
  mashWaterL: number; spargeWaterL: number; spargeTempC: number;
  totalWaterL: number; preBoilVolumeL: number; preBoilGravity: number;
  batchSizeL: number; postBoilVolumeL: number;
}

export interface BrewSheetMashRest {
  id: string; name: string; type: MashStepType;
  stepTempC: number; stepTimeMin: number; rampTimeMin: number;
}

export interface BrewSheetMash {
  profileName: string | null;   // null when recipe.mashProfile is null
  strikeTempC: number | null;   // null when no mash steps exist
  targetPh: number | null;
  spargeTempC: number;
  rests: BrewSheetMashRest[];   // [] when no profile / no steps
}

export interface BrewSheetFermentableRow {
  id: string; name: string; type: FermentableType;
  amountKg: number; percentOfGrist: number; colorSrm: number; colorEbc: number;
}

export interface BrewSheetHopRow {
  id: string; name: string; use: HopUse; amountG: number; alphaAcidPct: number;
  timingLabel: string;              // e.g. '60 min', '20 min @ 79.0 °C', 'Day 3 for 4 d', '—'
  timingMins: number | null;
  tempC: number | null;             // whirlpoolTempC for hopstand uses, else null
  ibuContribution: number;          // 1 decimal; 0 for non-IBU uses
  percentOfTotalHops: number;       // 1 decimal
}

export interface BrewSheetMiscRow {
  id: string; name: string; type: MiscType; use: MiscUse;
  amount: number; unit: MiscUnit; timeMinutes: number;
}

export interface BrewSheetYeastRow {
  id: string; name: string; laboratory: string;
  type: YeastType; form: YeastForm; attenuationPct: number; amountPkg: number;
}

export interface BrewSheetFermentationRow {
  id: string; name: string; type: FermentationStepType;
  stepTempC: number; stepTimeDays: number; rampDays: number; pressurePsi: number | null;
}

export interface BrewSheetModel {
  header: {
    batchName: string; recipeName: string; styleName: string;
    author: string; typeLabel: 'All Grain';
  };
  equipment: {
    profileName: string; brewhouseEfficiencyPct: number;
    mashEfficiencyPct: number; batchSizeL: number; boilTimeMin: number;
  };
  vitals: BrewSheetVitals;
  volumes: BrewSheetVolumes;
  mash: BrewSheetMash;
  fermentables: { totalKg: number; rows: BrewSheetFermentableRow[] };
  hops: { totalG: number; rows: BrewSheetHopRow[] };
  miscs: BrewSheetMiscRow[];
  yeasts: BrewSheetYeastRow[];
  fermentation: { profileName: string | null; steps: BrewSheetFermentationRow[] };
  carbonationVolumes: number | null;
}

export interface BrewSheetInput {
  recipe: Recipe;
  stats: CalculatedStats;
  batchName: string;
  carbonationVolumesTarget: number | null;
}
```

Exported function:

```
export function buildBrewSheetModel(input: BrewSheetInput): BrewSheetModel;
```

**Pure.** No `Date.now()`, no `Math.random()`, no I/O, no mutation of `input`. Deterministic: identical input yields a deeply-equal result.

Binding derivation rules:
- `vitals.platoOg` = `sgToPlato(stats.og)`, 1 decimal.
- `volumes.spargeTempC` = `resolveSpargeTemperatureC` against `recipe.mashProfile` and `recipe.equipment` — **not** a re-encoding of the precedence rule (M3_P2's critic flagged exactly that drift risk in `mash.ts`).
- `mash.strikeTempC` = `strikeTemperatureC(...)` using `recipe.mashProfile.steps[0].stepTempC`; `null` when there is no first step.
- `fermentables.totalKg` = sum of `amountKg`, 3 decimals. `percentOfGrist` = 1 decimal, guarded per Ambiguity 12.
- `hops.totalG` = sum of `amountG`, 1 decimal. `ibuContribution` = `calculateSingleHopIbu(hop, stats.og, equipment.batchSizeL, settings)` with `settings` built from the equipment profile, 1 decimal.
- `colorEbc` = `srmToEbc(colorSrm)`, 1 decimal.
- Row order preserves the source array order exactly; no re-sorting.

### 1.2 New module — `packages/calculations/src/brewDayTimeline.ts`

```
export const BREW_DAY_STAGE_KEYS: readonly ['prep', 'mash', 'boil', 'hopstand'];
export type BrewDayStageKey = (typeof BREW_DAY_STAGE_KEYS)[number];

export const MIN_SEGMENT_DISPLAY_SEC: 300;
export const MASH_OUT_MIN_TEMP_C: 75;

export type BrewDayMilestoneKind =
  | 'strike-prep' | 'dough-in' | 'mash-step' | 'mash-out'
  | 'sparge' | 'boil-start' | 'addition' | 'hopstand-start';

export interface BrewDayMilestone {
  id: string;
  stage: BrewDayStageKey;
  kind: BrewDayMilestoneKind;
  label: string;
  offsetSec: number;    // from the start of the whole brew day
  position: number;     // [0, 1] along the whole bar
}

export interface BrewDaySegment {
  stage: BrewDayStageKey;
  label: string;
  durationSec: number;      // real duration; prep is always 0
  startOffsetSec: number;   // real cumulative offset
  startPosition: number;    // [0, 1], display-weighted
  widthFraction: number;    // (0, 1], display-weighted, never 0/NaN
}

export interface BrewDayTimelineModel {
  segments: BrewDaySegment[];       // exactly 4, in BREW_DAY_STAGE_KEYS order
  milestones: BrewDayMilestone[];   // sorted per Ambiguity 19
  totalDurationSec: number;         // real sum; may be 0
}

export interface BrewDayTimelineInput {
  recipe: Recipe;
  stats: CalculatedStats;
  strikeTempC: number | null;
}

export function buildBrewDayTimeline(input: BrewDayTimelineInput): BrewDayTimelineModel;
```

**Pure**, same constraints as §1.1. Milestone emission is exactly the set enumerated in Ambiguities 15–17 plus one `mash-step` dot per mash step, one `addition` dot per boil hop/misc addition (same filter the tracker already uses at `BrewDayTracker.tsx:111-127`), and one `hopstand-start` dot labelled with `equipment.hopstandTemperatureC` (Ambiguity 14).

### 1.3 New module — `packages/calculations/src/measurementTargets.ts`

```
export type MeasurementFieldKey =
  'preBoilGravity' | 'mashPh' | 'boilSizeL' | 'boilTimeMin' | 'og';

export type MeasurementTargetSource =
  'stats' | 'equipment' | 'waterChemistry' | 'mashProfile' | null;

export interface MeasurementTarget {
  field: MeasurementFieldKey;
  value: number | null;         // rounded per Ambiguity 8
  placeholder: string | null;   // toFixed string; null iff value is null
  source: MeasurementTargetSource;
}

export interface MeasurementTargets {
  preBoilGravity: MeasurementTarget;
  mashPh: MeasurementTarget;
  boilSizeL: MeasurementTarget;
  boilTimeMin: MeasurementTarget;
  og: MeasurementTarget;
}

export interface MeasurementTargetsInput {
  stats: CalculatedStats | null;
  equipment: EquipmentProfile;
  predictedMashPh: number | null;
  mashProfileTargetPh: number | null;
}

export function deriveMeasurementTargets(
  input: MeasurementTargetsInput,
): MeasurementTargets;
```

**Pure.** Invariant, asserted in both directions: `value === null` **iff** `placeholder === null` **iff** `source === null`.

### 1.4 Symbol inventory

**Appended to `packages/calculations/src/index.ts`** — three new `export *` lines for `./brewSheet`, `./brewDayTimeline`, `./measurementTargets`. No existing line in that file is reordered, edited, or removed. The named-export block for `./config` is byte-unchanged.

**Modified in place:** `BrewDayTracker.tsx`'s local `formatMmSs` (Ambiguity 13) and its local `STAGE_KEYS` / `STAGE_LABELS` constants, which are **replaced** by imports of `BREW_DAY_STAGE_KEYS` from the calculations package. This is the legacy-cleanup requirement: after this phase there must be exactly **one** definition of the brewing sub-stage key list in the repository. `grep -rn "'prep', 'mash', 'boil', 'hopstand'" apps/web/src/` must return zero hits.

**Untouched symbol surface:** no export is renamed, removed, or has its signature changed in `packages/shared-types`, `brewingMath.ts`, `mash.ts`, `batchPipeline.ts`, `carbonation.ts`, `equipmentDriven.ts`, or `water.ts`.

## 2. Component Architecture & Integration Contracts

### 2.1 New files

| Path | Purpose |
|---|---|
| `packages/calculations/src/brewSheet.ts` | §1.1 |
| `packages/calculations/src/brewDayTimeline.ts` | §1.2 |
| `packages/calculations/src/measurementTargets.ts` | §1.3 |
| `packages/calculations/test/brewSheet.test.ts` | Unit tests for §1.1 |
| `packages/calculations/test/brewDayTimeline.test.ts` | Unit tests for §1.2 |
| `packages/calculations/test/measurementTargets.test.ts` | Unit tests for §1.3 |
| `apps/web/src/components/BrewSheet.tsx` | Brew Sheet Viewer presentation component |
| `apps/web/src/components/BrewDayTimelineBar.tsx` | Continuous segmented bar + milestone dots |
| `apps/web/test/BrewSheet.test.tsx` | Component tests |
| `apps/web/test/BrewDayTimelineBar.test.tsx` | Component tests |

### 2.2 Modified files

| Path | Permitted edits — exhaustive |
|---|---|
| `packages/calculations/src/index.ts` | Append exactly three `export *` lines (§1.4). Nothing else. |
| `apps/web/src/components/BrewDayTracker.tsx` | Replace local `STAGE_KEYS`/`STAGE_LABELS` with the imported constants; zero-pad `formatMmSs`; render `BrewDayTimelineBar` in place of the pill row; add `|◀` Previous Step, `✎` Adjust Time, and global power/reset controls; promote the timer into a centered box; add the green stage header; add `prep`/`mash`/`hopstand` checklists and unify the boil additions checklist control with circular radio-style check toggles (BUG-022); read `equipment.hopstandTemperatureC` instead of the hardcoded `80`. Existing timer mechanics, audio, mash-step picker, boil-alarm list, and Fast-Forward are **not** rewritten. |
| `apps/web/src/pages/BatchDetail.tsx` | Brewing tab only: mount `BrewSheet` with its toggle above `BrewDayTracker`; add `placeholder` + accept control to the five measurement inputs via `deriveMeasurementTargets`. No other tab, no other handler, no status/transition logic touched. |
| `apps/web/test/BrewDayTracker.test.tsx` | Update assertions broken by the `formatMmSs` padding change and by the pill-row → bar replacement; add blocks for the new controls and checklists. **No existing `describe`/`it` may be deleted, renamed, skipped, or weakened** — locator updates only, assertion subjects preserved. |
| `apps/web/test/BatchDetail.test.tsx` | Add blocks for the brew-sheet toggle and the placeholder/accept behavior. Same no-deletion/no-weakening bound as above. |

### 2.3 Untouched (binding)

`packages/shared-types/**` (all files), `apps/api/**` (all files), `packages/calculations/src/brewingMath.ts`, `mash.ts`, `batchPipeline.ts`, `carbonation.ts`, `equipmentDriven.ts`, `water.ts`, `fermentation.ts`, `packages/calculations/test/fixtures.test.ts`, `apps/web/src/components/designSystem.ts`, `StockCheckPanel.tsx`, `CellarActionFeed.tsx`, `SplitPackagingPanel.tsx`, `PostBrewCalibrationModal.tsx`, `SensoryEvaluationPanel.tsx`, `BatchStepper.tsx`, `BatchStageTabs.tsx`, `apps/web/src/index.css` **except** the single permitted addition of print-scoped rules if and only if Tailwind's `print:` variants prove insufficient (if used, it must be reported as a deviation at `/steer`).

### 2.4 Stateful integration contracts

**Pure-logic layer** (`buildBrewSheetModel`, `buildBrewDayTimeline`, `deriveMeasurementTargets`) returns plain data and **never** returns a rendered placeholder, a `'—'` string, or a formatted fallback for a missing value — it returns `null` and the caller branches. No pure function reads or writes React state, `formData`, or the network.

**Frame/render layer:**
- `BrewSheet` is a pure presentation component: props in, JSX out, no data fetching, no writes to `formData`.
- `BrewDayTimelineBar` receives the model plus `activeStageIndex` and an `onSelectStage(index)` callback; it owns no timer state. Clicking a segment calls `onSelectStage` — it must **not** mutate any timer directly.
- The measurement accept controls call the **existing** `setFormData` path in `BatchDetail.tsx` — they introduce no second source of truth for measured values, and they must not route through `handleMeasuredFieldChange` (which is the tracker's channel, scoped to three fields and not including `measuredMashPh` or `measuredBoilTimeMin`).
- The timeline model is recomputed via `useMemo` keyed on `[recipe, stats]`. It must be computed **before** any early return in the component, so no conditional-hook regression of the M4_P1 F-2 class is reintroduced.
- Lockstep: when a stage is selected, the bar's highlighted segment, the green stage header, the timer box, and the checklist must all reflect the **same** `activeStageIndex` within one render commit — no intermediate frame where the header names one stage and the timer another.

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| AC-1 | `buildBrewSheetModel` header & equipment block | Unit | Returns `batchName`, `recipeName`, `styleName`, `author` verbatim from input and `typeLabel === 'All Grain'`; equipment block mirrors `recipe.equipment`'s `name`/`brewhouseEfficiencyPct`/`mashEfficiencyPct`/`batchSizeL`/`boilTimeMin` exactly. |
| AC-2 | Brew sheet vitals | Unit | `og`/`fg`/`abv`/`ibu`/`buGu`/`srm`/`ebc` equal the corresponding `stats` fields; `platoOg` equals `sgToPlato(stats.og)` to 1 decimal. |
| AC-3 | Brew sheet volumes & sparge-temp precedence | Unit | Volumes mirror `stats`; `spargeTempC` is produced by `resolveSpargeTemperatureC`, proved by a case where `mashProfile.spargeTempC` overrides `equipment.spargeTemperatureC` and a second case where a `null` override inherits the equipment value. |
| AC-4 | Brew sheet mash block | Unit | `rests` preserves mash-step order with `stepTempC`/`stepTimeMin`/`rampTimeMin`; `strikeTempC` equals `strikeTemperatureC(...)` for the first step; with `recipe.mashProfile === null`, `profileName`/`strikeTempC`/`targetPh` are all `null` and `rests` is `[]`. |
| AC-5 | Grist percentages and total | Unit | `totalKg` is the 3-decimal sum; `percentOfGrist` values sum to `100` within `0.2`; a zero-fermentable recipe yields `totalKg === 0`, `rows === []`, and no `NaN` anywhere in the model (asserted by a recursive NaN sweep). |
| AC-6 | Hop rows, IBU contribution, timing labels | Unit | `ibuContribution` per row equals `calculateSingleHopIbu` with the equipment-derived settings to 1 decimal; a `DryHop` row has `ibuContribution === 0`; a `Whirlpool` row's `timingLabel` includes both its minutes and its `whirlpoolTempC`; `percentOfTotalHops` is `0` (not `NaN`) when `totalG === 0`. |
| AC-7 | Miscs, yeasts, fermentation rows | Unit | Each maps 1:1 in source order with all listed fields carried verbatim; `fermentation.profileName` is `null` and `steps` is `[]` when `recipe.fermentationProfile === null`. |
| AC-8 | Carbonation passthrough | Unit | `carbonationVolumes` equals the `carbonationVolumesTarget` input, including when that input is `null`. |
| AC-9 | `buildBrewSheetModel` purity & determinism | Unit | Two calls with the same input are deeply equal; the input object and its nested arrays are unmodified after the call (deep-equal against a pre-call structured clone). |
| AC-10 | Timeline segment count & order | Unit | `segments.length === 4` with `stage` values exactly `['prep','mash','boil','hopstand']`; `prep.durationSec === 0`. |
| AC-11 | Segment width weighting | Unit | For a 60-min mash / 60-min boil / 20-min hopstand recipe, `widthFraction` values are strictly proportional to `max(durationSec, 300)` and sum to `1` within `1e-9`; `startPosition[0] === 0` and each `startPosition[i] === startPosition[i-1] + widthFraction[i-1]` within `1e-9`. |
| AC-12 | Degenerate all-zero timeline | Unit | With no mash steps, `boilTimeMin === 0`, and no hopstand hops: `totalDurationSec === 0`, all four `widthFraction === 0.25` exactly, no `NaN`, no `Infinity`, and `position` for every milestone is within `[0, 1]`. |
| AC-13 | Mash-out dot boundary | Unit | Last mash step at `75.0 °C` emits exactly one `kind: 'mash-out'` milestone; at `74.99 °C` emits none. Both directions asserted. |
| AC-14 | Sparge dot boundary | Unit | `stats.spargeWaterL === 0.1` emits one `kind: 'sparge'` milestone; `stats.spargeWaterL === 0` emits none. |
| AC-15 | Addition dots match the tracker's own filter | Unit | One `kind: 'addition'` milestone per `use === 'Boil'` hop with non-null `boilMins`, plus one per `use === 'Boil'` misc with `timeMinutes > 0`; a `FirstWort` hop and a `timeMinutes === 0` misc produce none. |
| AC-16 | Hopstand dot reads the profile temperature | Unit | With `equipment.hopstandTemperatureC === 79`, the `hopstand-start` milestone label contains `79` and does **not** contain the substring `80`. |
| AC-17 | Milestone ordering determinism | Unit | `milestones` is non-decreasing in `offsetSec`; ties are ascending by `id`; two calls produce identically-ordered `id` arrays. |
| AC-18 | `deriveMeasurementTargets` happy path | Unit | All five targets return non-null `value`/`placeholder`/`source` with the exact rounding of Ambiguity 8 (`'1.047'`, `'5.25'`, `'34.7'`, `'60'` shapes) and the correct `source` tag per field. |
| AC-19 | Mash pH precedence, all three branches | Unit | `predictedMashPh = 5.31` → `value 5.31`, `source 'waterChemistry'`; `predictedMashPh = null`, `mashProfileTargetPh = 5.4` → `value 5.4`, `source 'mashProfile'`; both `null` → `{value: null, placeholder: null, source: null}`. |
| AC-20 | `stats === null` degenerate input | Unit | `preBoilGravity`, `boilSizeL`, `og` each return the all-null triple; `boilTimeMin` still returns `equipment.boilTimeMin`. No throw. |
| AC-21 | Null-triple invariant, both directions | Unit | Across a table of inputs, for every field: `value === null` iff `placeholder === null` iff `source === null`. No target ever has a null value with a non-null placeholder or vice versa. |
| AC-22 | Brew sheet toggle | Component | On mount of the Brewing tab the sheet body is absent from the DOM and the toggle reads `OFF`; one click renders `data-testid="brew-sheet"`; a second click removes it. |
| AC-23 | Brew sheet renders every section | Component | With a fully-populated recipe the open sheet contains all of: recipe name, style, `All Grain`, equipment profile name, brewhouse efficiency, mash water, sparge water, total water, pre-boil volume, pre-boil gravity, OG, FG, IBU, BU/GU, EBC, strike temperature, each mash rest, each malt with its percentage, each hop with its IBU contribution, each misc, each yeast, each fermentation step, and the carbonation figure. |
| AC-24 | Brew sheet empty collections | Component | A recipe with zero fermentables, zero hops, zero miscs, zero yeasts, and `fermentationProfile === null` renders the sheet without throwing, with an explicit `None` row present in each of those five sections and no empty table body. |
| AC-25 | Print action | Component | `window.print` (spied) is called exactly once per click of the sheet's Print button; the sheet root carries `data-brew-sheet-print-root` and at least one `print:`-prefixed utility class. |
| AC-26 | Continuous bar replaces the pill row | Component | The Brewing tab renders `data-testid="brew-day-timeline-bar"` with exactly 4 segment elements whose inline widths match `widthFraction`; the previous discrete-pill markup (four `brew-day-stage-*` buttons rendered as a wrapped pill row) is gone, and clicking a segment switches the active stage. |
| AC-27 | Milestone dots render | Component | The number of rendered dot elements equals `model.milestones.length`, each positioned by its `position`, each carrying its `label` as accessible text (`title` or `aria-label`). |
| AC-28 | Previous Step control | Component | From the `boil` stage, clicking `|◀` moves to `mash`; from `prep` it is a no-op (stage stays `prep`, no throw); it stops a running timer, freezes the displayed remaining time, and — asserted against a `playStepAlert` spy — plays **no** chime. |
| AC-29 | Adjust Time control, with boundaries | Component | Committing `12` sets the timer display to `12:00`; committing `600` is accepted; committing `601`, `-1`, and `abc` each leave the displayed time **and** the running state completely unchanged. |
| AC-30 | Global power/reset | Component | After advancing stages, running a timer, and checking off items, one click returns the stage to `prep`, the timer to its nominal duration, and every checklist item to unchecked — while `setFormData`/`onMeasuredFieldChange` spies record zero calls. |
| AC-31 | Timer box formatting | Component & Unit | `formatMmSs` returns `'00:00'`, `'05:00'`, `'60:00'`, `'85:00'` for `0`, `300`, `3600`, `5100`; the rendered timer lives inside `data-testid="brew-day-timer-box"` and displays the zero-padded form. |
| AC-32 | Green stage header | Component | Each of the four stages renders `data-testid="brew-day-stage-header"` with its stage-specific text, and the element's class list includes an emerald/green token. |
| AC-33 | Checklists on all four stages | Component | `prep`, `mash`, and `hopstand` each render at least one checklist item derived from recipe data; toggling an item marks it done and does not alter the timer; the boil additions schedule uses the same circular check toggle (`w-3.5 h-3.5 rounded-full border border-slate-600` unchecked / `CheckCircle2 w-4 h-4 text-emerald-400` checked) as the other stages (BUG-022), eliminating the separate "Mark Added" pill button while retaining the pulsing "ADD NOW" alert badge for due additions. |
| AC-34 | Stage lockstep | Component | Selecting a stage updates the highlighted segment, the green header text, the timer box value, and the checklist contents consistently within a single `act()` — asserted together after one commit, with no intermediate mismatched state. |
| AC-35 | Placeholders on all five inputs | Component | Each of the five measurement inputs carries a `placeholder` attribute equal to its derived target string; the Pre-boil Gravity field's pre-existing `Est:` label hint is still present (not replaced by the placeholder). |
| AC-36 | No placeholder when no target | Component | With `stats === null` and both pH sources `null`, the Pre-boil Gravity, Boil Size, OG, and Mash pH inputs have **no** `placeholder` attribute at all (`hasAttribute('placeholder') === false`) — not `''`, not `'—'`, not `'NaN'`. |
| ~~AC-37~~ | ~~Accept control writes the target~~ | — | **SUPERSEDED (BUG-023, post-approval).** No accept control exists; see addendum. |
| AC-38 | No auto-fire, ever | Component | On mount of the Brewing tab with all five measured fields `null`, every input's `value` is `''` — no target is ever written into `formData` without the brewer typing it. (Retained; scope narrowed from "without a click" to "at all", since there is no longer a click path.) |
| ~~AC-39~~ | ~~Accept control zero-value guard~~ | — | **SUPERSEDED (BUG-023, post-approval).** No accept control exists; the zero-value guard concern no longer applies to any UI control. |
| AC-40 | Single stage-key definition | Static | `grep -rn "'prep', 'mash', 'boil', 'hopstand'" apps/web/src/` returns zero matches; `BrewDayTracker.tsx` imports `BREW_DAY_STAGE_KEYS` from `@truchabrew/calculations`. |
| AC-41 | Hopstand temperature is not hardcoded | Static & Component | `grep -n "80°C\|80 °C" apps/web/src/components/BrewDayTracker.tsx` returns zero matches; with `hopstandTemperatureC === 79`, the hopstand guidance text contains `79`. |
| AC-42 | No conditional hooks | Static & Component | Every `useMemo`/`useState`/`useEffect` in `BrewDayTracker.tsx`, `BrewSheet.tsx`, `BrewDayTimelineBar.tsx`, and `BatchDetail.tsx` precedes every early `return`; a render probe over loading / error / loaded states produces no React hook-order warning. |
| AC-43 | Shared-types and API untouched | Manifest | Every path under `packages/shared-types/` and `apps/api/` has an identical SHA-256 in the pre- and post-execution manifests. |
| AC-44 | Four gates clean | Gate | `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` each exit `0`. Test count is `>= 1664` passed with `0` failed and no newly-skipped test. |
| AC-45 | Scope guardrail | Manifest Diff | **`git diff --name-only` is NOT usable here — `git rev-list --count HEAD` is `1` (Ambiguity 26).** The executor captures `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum` **before its first edit** and again at the end; the diff of the two manifests, excluding `.gsd/`, contains **only** paths listed in §2.1 and §2.2. Every §2.3 path has an unchanged hash. |
| AC-46 | Manual verification evidence | Screenshot | Four PNGs in `.gsd/active/manual_verification/`: `M18_P1_brew_sheet_open.png` (populated sheet), `M18_P1_timeline_bar.png` (continuous bar with milestone dots and the centered timer box), `M18_P1_stage_checklist.png` (a non-boil stage checklist + green header), `M18_P1_measurement_targets.png` (five placeholders, no accept control — post-BUG-023). |

**46 acceptance criteria (AC-37 and AC-39 superseded post-approval, see addendum below; effectively 44 active).**

---

## Addendum 1 — BUG-023 post-approval correction (2026-08-19)

After `/execute` completed and Layer 1 passed, the user reviewed the shipped "Use Expected Target" accept control and asked for it to be removed, explicitly clarifying: the placeholder-only, non-destructive target hint (this spec's `Key Behaviors` non-auto-write guarantee) is exactly the wanted behavior and stays unchanged — measured fields must still only ever be written by the brewer's own typed input, never auto-filled, so Milestone 17's `PostBrewCalibrationModal`/`measuredMashEfficiencyPct` calibration feed continues to only ever see genuinely measured values. The ask is narrower than a reopening of that guarantee: delete the now-redundant explicit accept button and its handler only.

Applied directly per the user's explicit instruction ("delete silently") rather than through a full `/diagnose` → re-`/plan` → re-`SPEC_APPROVED` cycle, since the change is a pure UI-control removal with no data-flow or calibration-safety impact: `AC-37` and `AC-39` (which existed solely to test the accept button's behavior) are struck as superseded; `AC-38` is retained with its scope narrowed from "no write without a click" to "no write, period" — it now asserts the same non-destructive guarantee unconditionally, without depending on a click path that no longer exists. AC-35/AC-36 (placeholder presence/absence) are untouched and still hold. AC-46's `M18_P1_measurement_targets.png` description updated to reflect no accept control in the captured screenshot. No AC renumbering; 44 of the original 46 remain active. Logged as `BUG-023` in `.gsd/BUGS.md`.

## Addendum 2 — BUG-022 Refinement at Steering Checkpoint (2026-08-19)

At the State 4 Steering Checkpoint, Option A (Refine) was selected to address `BUG-022` (Boil stage additions checklist check control unification).
- **Refinement scope:** Update the Boil stage "Additions Schedule" rows in `BrewDayTracker.tsx` so that each row uses the standard circular radio check control (`w-3.5 h-3.5 rounded-full border border-slate-600` unchecked / `CheckCircle2 w-4 h-4 text-emerald-400` checked) with clickable row toggle behavior and line-through strikeout on checked items, matching the Preparation, Mash, and Hop Stand checklists.
- **Removed UI control:** Eliminate the disparate "Mark Added" / "Added ✓" pill button on the right edge of each boil addition row.
- **Retained behavior:** The pulsing "ADD NOW" alert badge for due unadded additions is retained unchanged.
- **Criteria coverage:** AC-33 is amended to require this unified control pattern. Follow-up execution will align `BrewDayTracker.tsx` and its component test assertions in `BrewDayTracker.test.tsx`.


## 4. Scope Guardrail Allowlist

Only these paths may be created or modified:

```
packages/calculations/src/brewSheet.ts                  (new)
packages/calculations/src/brewDayTimeline.ts            (new)
packages/calculations/src/measurementTargets.ts         (new)
packages/calculations/src/index.ts                      (append 3 export lines only)
packages/calculations/test/brewSheet.test.ts            (new)
packages/calculations/test/brewDayTimeline.test.ts      (new)
packages/calculations/test/measurementTargets.test.ts   (new)
apps/web/src/components/BrewSheet.tsx                   (new)
apps/web/src/components/BrewDayTimelineBar.tsx          (new)
apps/web/src/components/BrewDayTracker.tsx              (modified, §2.2 bounds)
apps/web/src/pages/BatchDetail.tsx                      (modified, Brewing tab only)
apps/web/test/BrewSheet.test.tsx                        (new)
apps/web/test/BrewDayTimelineBar.test.tsx               (new)
apps/web/test/BrewDayTracker.test.tsx                   (modified, no deletions)
apps/web/test/BatchDetail.test.tsx                      (modified, no deletions)
.gsd/active/manual_verification/M18_P1_*.png            (new evidence)
```

`apps/web/src/index.css` is conditionally permitted for print rules only (§2.3) and must be reported if touched.

## 5. Deviation Register

| # | Deviation from `FEAT-019` / `FEAT-020` / `ROADMAP.md` | Resolution & rationale |
|---|---|---|
| D-1 | `FEAT-019` enumerates five stepper controls (`|◀ ↺ ▶/⏸ ✎ ▶|`) and omits Fast-Forward | Fast-Forward is **retained** unchanged. It already ships and is covered by M15_P1's verified AC-8; removing a working, verified control to match a list that was written descriptively rather than exhaustively would be a regression. Alternative available at the halt gate: remove it and retire M15_P1's AC-8 coverage. |
| D-2 | `FEAT-019` asks for a sound mute toggle **and** a separate alert chime toggle | Collapsed into the **single existing** mute toggle. All three alert kinds (`completion`, `warning`, `chime`) already route through one `muted` flag; a second near-duplicate toggle adds a second source of truth over the same audio path for no user-visible benefit. Alternative: add a genuinely independent chime-only flag. |
| D-3 | `FEAT-019` lists "target Carbonation (CO2 volumes)" among *recipe* details | No recipe-level carbonation field exists; the value is `batch.carbonationVolumesTarget` and is nullable. Passed in as an explicit `BrewSheetInput` field; renders `—` when null (Ambiguity 24). |
| D-4 | `FEAT-020` says Boil Time is **"Pre-filled"** with the recipe boil duration | **Rejected for all five fields.** Nothing is auto-written into `formData`; all five are placeholder-plus-accept (Ambiguity 1). Auto-writing would dirty the batch without user action and record an unmeasured estimate as a measured value, which M17's `PostBrewCalibrationModal` and `measuredMashEfficiencyPct` both consume — silently corrupting equipment calibration. **This is the deviation most worth an explicit overrule decision.** |
| D-5 | `FEAT-020` sources Boil Size from "the equipment profile" | The equipment profile has no pre-boil volume field; `stats.preBoilVolumeL` is the computed quantity and is the binding source (Ambiguity 6). |
| D-6 | `FEAT-019` lists a "chilling completion" milestone dot | **Omitted.** No chill duration, chill timer, or chill-complete event exists in the data model or the tracker, so no position on the bar can be derived for it. Adding one would require inventing a duration. Recommend routing it to M20 alongside the packaging-stage work (Ambiguity 17). |
| D-7 | `FEAT-019` asks for a mash-out milestone dot | `MashStepType` has no `MashOut` member. Derived heuristically from the last mash step's temperature against an exported `MASH_OUT_MIN_TEMP_C = 75` threshold (Ambiguity 15). A structural `MashOut` step type would be a schema change and is out of scope for this phase. |
| D-8 | `ROADMAP.md` M18 hardening scope says "with redundant fermenter step removed" | **Already done** out-of-band before this spec existed (`STAGE_KEYS` is already the 4-stage list). No AC re-specifies it; AC-10 pins the 4-stage shape so it cannot silently regress. |
| D-9 | Scope guardrail method | `git diff --name-only` is **unusable** in this repo (`git rev-list --count HEAD` is `1`). AC-45 mandates a pre/post SHA-256 content manifest instead (Ambiguity 26). Sixth recurrence of this criterion class. |
| D-10 | Hopstand temperature currently hardcoded to `80` in the tracker's guidance string | Fixed in this phase to read `equipment.hopstandTemperatureC` (Ambiguity 14, AC-41). Strictly a defect fix, not new capability, but it changes existing rendered text and is disclosed here rather than slipped in. |

---

# ⛔ HALT GATE — SPEC APPROVAL REQUIRED

**No implementation code may be written until this specification is approved with the literal string `SPEC_APPROVED`** (hard rule 1).

**Ten deviations (D-1 … D-10) are flagged above for sign-off.** Approving without qualification accepts all ten as written. The three most consequential, in descending order:

- **D-4** — `FEAT-020`'s "pre-filled" Boil Time is rejected in favour of uniform placeholder-plus-accept across all five fields. Overrule this if you genuinely want values written into the form on mount.
- **D-6** — the "chilling completion" milestone dot is dropped for want of any derivable position; recommended for M20.
- **D-1 / D-2** — Fast-Forward kept despite not being in the feature's control list; the separate "alert chime toggle" collapsed into the existing mute toggle.

**Review this feature specification. Reply with SPEC_APPROVED to begin execution.**
