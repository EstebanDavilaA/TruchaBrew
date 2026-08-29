# FEATURE SPECIFICATION: M8_P2 — Plan the pitch, package the beer

- **Milestone:** M8 (Standalone calculators)
- **Phase:** P2 of the two-phase split approved at M8_P1's halt gate (§4 Deviation 1 there). **This phase closes Milestone 8.**
- **Depends on:** M8_P1 (`.gsd/archive/specs/M8_P1_feature_spec.md`, verification-clean 2026-08-14 at 35/35 ACs). This phase consumes, unchanged, the `Calculators` page/route/sidebar destination, the `CalculatorCard` / `NumericField` / `ResultRow` presentational shell, the M7 `format*` helper family via `useConfig()`, and P1's `apps/web/test/calculatorImportGraph.test.ts` static-analysis guardrail — which it **extends**, per M8_P1 §5's binding statement that P2 "will also extend P1's `calculatorImportGraph.test.ts` allowlists rather than adding a second static-analysis file."
- **Also depends on:** M5_P2's `packages/calculations/src/carbonation.ts` (`residualCO2Volumes`, `primingSugarG`, `forceCarbonationPsi`, `CARBONATION_TYPES`) and M1's `packages/calculations/src/units.ts` / `brewingMath.ts` extract-points primitives (`sgToPointsExact`, `litersToGallons`).
- **Layer:** Three new pure-function modules in `packages/calculations` + five new cards on the page P1 built. **No database, no API endpoint, no migration, no `shared-types` change, no new route, no sidebar change.**

---

## Phase Summary

M8_P1 shipped the *measurement* half of the Calculators page: strike water, infusion volume, hydrometer correction, refractometer, and six unit-converter families. This phase ships the *planning and packaging* half — the calculators a brewer reaches for the day **before** a brew and the day they package:

| Calculator | Backing function(s) | Status of the math |
|---|---|---|
| Yeast pitch rate | `targetCellsBillions`, `viabilityAfterMonths`, `viableCellsBillions` (**new** `yeast.ts`) | New. Formula given verbatim in build-spec §3.6. |
| Yeast starter growth (Braukaiser) | `starterExtractGrams`, `starterGrowthRateBPerG`, `starterEndCellsBillions` (**new** `yeast.ts`) | New. The source explicitly **provides no table** — the model is pinned here from published secondary sources with a stated citation duty (Ambiguity 3). |
| Hop alpha-acid decay | `hopDecayRateConstant`, `hopTemperatureFactor`, `alphaAcidAfterStorage` (**new** `hops.ts`) | New. The source gives **no** hop-decay formula — Garetz's published relation is pinned here, with one component cross-checked against a published table value (Ambiguity 4). |
| Gravity correction (dilute / DME / boil longer) | `dilutionWaterL`, `dmeToAddKg`, `additionalBoilMinutes` (**new** `gravityCorrection.ts`) | New shape, **no new physics** — all three are one conservation-of-extract-points identity, evaluated through M1's existing `sgToPointsExact` / `litersToGallons` (Ambiguity 5). |
| Priming sugar & force carbonation | `residualCO2Volumes`, `primingSugarG`, `forceCarbonationPsi` (`carbonation.ts`) | **Already exists** (M5_P2). Thin UI wrapper only — the math is not re-implemented, re-derived, or copied. `carbonation.ts` is on §1.5's Untouched list. |

The milestone's verification threshold — *"every calculator's output is produced by a function that is also reachable from the recipe/batch path, asserted by import graph, not convention"*, with *"a duplicated formula in a calculator is a milestone failure"* — is extended, not re-invented: AC-28 … AC-32 grow P1's existing AC-23 … AC-27 blocks in place, and **AC-32 closes the one limitation P1's third critic pass disclosed** (its `calculateMashPlan`-anchored regex verifies token *adjacency*, not call-site *containment*) by resolving call sites through the TypeScript AST.

Deliberately **not** in this phase: converted (non-metric) **input** fields — still M8_P3 per M8_P1 Deviation 2; `BUG-016`'s `brewingMath.ts:289` inline-EBC cleanup; and any recipe/batch-path behaviour change of any kind.

---

## Key Behaviors

1. **Five more cards on the page P1 built.** No new route, no new sidebar entry, no `App.tsx` change, no `Sidebar.tsx` change. `Calculators.tsx` gains five explicit JSX children and their imports — still no registry array (M8_P1 §2.5, held).
2. **Nothing on this page reads or writes stored data.** Unchanged from P1: zero `POST`/`PUT`/`PATCH`/`DELETE`, no `GET` beyond `ConfigProvider`'s one app-mount `GET /api/config`, no `localStorage`.
3. **Outputs honour the user's unit and formula settings.** Every result that has an M7 `format*` helper goes through it (`formatVolume` for dilution water, `formatMass` for DME, `formatHopMass` for priming sugar and starter extract, `formatGravity` where a gravity is echoed). Results with no M7 helper — cell counts in billions, alpha-acid %, psi, minutes, CO₂ volumes, inoculation rate — render through `ResultRow`'s existing raw-number path with an explicit unit suffix.
4. **Inputs stay canonical-metric and are explicitly labelled as such.** M8_P1 Deviation 2's boundary, held unchanged. Every `<input>` label carries an explicit unit token.
5. **One formula, one home.** The carbonation card contains no arithmetic at all — it calls the same three functions `batchClosing.ts` calls. The gravity-correction module contains no gravity-points arithmetic of its own — it calls `sgToPointsExact` and `litersToGallons`, the same functions `brewingMath.ts`'s `totalExtractPoints` / `gravityAtVolume` call.
6. **Degenerate input never renders garbage.** Blank/unparseable → `"—"`, never `NaN`, never `0`, never a stale prior result. Unchanged from P1, and extended to this phase's new degenerate cases (zero-volume starter, zero boil-off rate).

---

## Resolved Ambiguities (Binding)

### 1. What a "thin wrapper" is — restated, because this phase has the purest example of one

M8_P1 Ambiguity 1's definition is carried forward verbatim and is binding here: a wrapper may collect field values, `Number.parseFloat` them, call the imported function once, format through an M7 helper, and render. It may **not** re-derive a value the function already returns, apply a correction/offset/clamp to the return, pre-transform an argument by anything other than parsing, or branch on unit system before the call.

The carbonation card is the strictest instance: `residualCO2Volumes`, `primingSugarG` and `forceCarbonationPsi` have been shipped and under test since **M5_P2**, and `batchClosing.ts:98`/`:113` and `BatchDetail.tsx:218`/`:233` already call them on the batch path. This phase adds **zero** carbonation math. AC-15 asserts that as a source-level fact, not as a convention.

### 2. Pitch rate — build-spec §3.6 is adopted literally, and the preset values are exported, not inlined

Build-spec §3.6 (`.gsd/documents/brewfather_clone_build_spec.md:234-243`) gives:

```js
const targetCellsBillions = (ogPlato, volumeL, pitchRateMillionCellsPerMlPerP) =>
  pitchRateMillionCellsPerMlPerP * ogPlato * volumeL;
// Recommended rates (million cells/ml/°P): ale 0.75, lager 1.5, high-gravity ale 1.0-1.25
const viabilityAfterMonths = (months, monthlyDecayPct = 21) => Math.pow(1 - monthlyDecayPct/100, months);
```

Both are adopted **as written** — the unit algebra checks out exactly (million cells/mL × °P × L = 10⁶ cells/mL × 10³ mL = 10⁹ cells = billions, so no scale factor is missing), and unlike build-spec §3.5 (defective twice: M3_P2's strike formula, M8_P1's hydrometer domain) §3.6 has no internal contradiction to resolve.

**Binding decisions on top of the source:**

- `ogPlato` is **not** an input field. The card takes **SG** and converts via the existing `sgToPlato`. A user reads SG off a hydrometer; asking for °P here would mean the pitch card disagrees with every other gravity input on the page. `sgToPlato` is already on P1's recipe-path-caller list — no new classification.
- The three recommended rates are exported as a named readonly record `PITCH_RATE_PRESETS` from `yeast.ts`, so the UI's dropdown values come from the calc package rather than three literals in a component (the `DEFAULT_WORT_CORRECTION_FACTOR` precedent, M8_P1 §1.2). **`highGravityAle` is pinned at `1.25`, the top of the source's `1.0`–`1.25` range** — see §4 Deviation 3.
- `monthlyDecayPct` has **no default parameter**, contrary to the source's `= 21`. The default lives in the exported constant `DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH = 21` and the caller passes it explicitly. This is M8_P1 Ambiguity 3(d)'s rule (`calibrationTempC` / `wortCorrectionFactor` both take no default) applied consistently — a defaulted parameter is a second, invisible place a physical constant lives.

### 3. The Braukaiser starter-growth model — the source provides **no** table, and neither does any primary source I could reach

M8_P1 §5 flagged this as P2's largest risk and required "the table must be transcribed from the published chart into a pinned, spec-side data structure with its interpolation rule … resolved explicitly, not left to the executor." That is done here, but **the citation situation must be stated plainly rather than dressed up**:

**What I could verify, and how.** `braukaiser.com` and `woodlandbrew.com` were both unreachable from this environment (DNS failure), so Kai Troester's original article and Woodland Brewing's replication could **not** be read directly. The model below is reconstructed from *converging secondary summaries* of those two sources, plus two internal-consistency checks that the reconstruction passes and that a wrong reconstruction would be unlikely to pass. Citations and the exact checks are in §4 Deviation 2.

**The model, binding.** Growth is expressed as *billions of new cells produced per gram of extract*, as a function of the **inoculation rate** (billions of cells pitched per gram of extract), per starter type:

| `StarterType` | Growth rate `g(ir)`, B/g |
|---|---|
| `'stirPlate'` | `ir < 1.4` → `1.4`; otherwise `max(0, 2.33 − 0.67 × ir)` |
| `'shaken'` | `ir < 3.5` → `0.62`; otherwise `0` |
| `'simple'` (non-agitated) | `ir < 3.5` → `0.4`; otherwise `0` |

**Extract mass, binding:** `starterExtractGrams = starterVolumeL × 1000 × starterGravitySg × (sgToPlato(starterGravitySg) / 100)` — i.e. litres → grams of wort via SG, then × °P/100 to get grams of *extract*. `sgToPlato` is the existing `config.ts` export; no second Plato path is created (M8_P1 Ambiguity 4, held).

**Two disclosed properties of this model, neither of which is an implementation defect:**

- **The stir-plate curve is discontinuous at `ir = 1.4` by `0.008 B/g`.** `2.33 − 0.67 × 1.4 = 1.392`, not `1.4`. This is a property of the published two-piece fit (a flat plateau plus a separately-fitted declining line), not of this transcription. No code compensates. AC-6 pins **both** sides of the breakpoint (`g(1.39999) = 1.4`, `g(1.4) = 1.392`) precisely so a "tidying" change that smooths the step fails loudly.
- **`max(0, …)` is the only clamp in this phase**, and it is on the published curve's own zero crossing (`2.33 / 0.67 = 3.4776…`), not a defensive guard. Without it, `g(3.5) = −0.015`.

**Non-finite handling is an explicit leading guard here, unusually.** For `'shaken'`/`'simple'` the branch structure `ir < 3.5 ? RATE : 0` would return a *finite* number for `ir = NaN` — silently fabricating a growth rate from an unparseable input, exactly the failure M8_P1 Ambiguity 7 forbids. `starterGrowthRateBPerG` therefore begins with `if (!Number.isFinite(inoculationRateBPerG)) return NaN;`. This is permitted — M8_P1 §2.3 bans guards *except* non-finite passthroughs, which is precisely what this is — and it is required, not optional (AC-16).

**Executor's citation duty — binding, and it overrides "make the test pass":** before implementing, attempt to reach Braukaiser's *Estimating yeast growth* (2012-11-03) and Woodland Brewing's *Starter Cell Growth* (2013-01). If either becomes reachable and **any** number in the table above differs from the published figure, **stop and route to `/plan` per hard rule 4** — do not silently substitute the published value, and do not adjust the AC-6/AC-7 pins to match your implementation.

### 4. Hop alpha-acid decay — Garetz's relation, with the rate constant **derived and cross-checked against a published table value**

Build-spec §3 gives no hop-decay formula at all. Pinned here:

```
AA(t) = AA₀ × e^(−k · TF · SF · days)
```

- **`k` (rate constant), binding:** `k = −ln(1 − percentLostSixMonths) / 180`, where `percentLostSixMonths` is the variety's fraction of alpha acids lost in six months at room temperature, unprotected — a **fraction in [0, 1)**, not a percentage.
- **`TF` (temperature factor), binding:** `TF = 2^((storageTempC − 20) / 15)` — degradation rate doubles per 15 °C, normalised to `TF = 1` at the 20 °C reference the `percentLost` table is defined at.
- **`SF` (storage factor), binding:** caller-supplied, with presets exported as `HOP_STORAGE_FACTORS` = `{ nitrogenFlushedOxygenBarrier: 0.5, sealedNotEvacuated: 0.75, looseInAir: 1.0 }`.
- **`days`**: age in days. No clamping (`days = 0` returns `AA₀` exactly).

**Why `k` is written as a derivation rather than a transcribed table.** Garetz publishes `k` as a lookup table keyed by `percentLost`. The formula above *reproduces* that table: for Cascade at 50 % lost, Garetz's published `k` is **`0.00385`**, and `−ln(0.5)/180 = 0.003850817669777474`, which rounds to exactly that. A transcribed 20-row table would be 20 opportunities for a transcription error and 20 independently-driftable numbers; the closed form is one line that provably reproduces the published anchor. **AC-8 asserts that reproduction explicitly**, so the derivation is verified rather than asserted.

**Disclosed imprecision in `TF`, quantified.** Garetz's published temperature-factor table gives `TF ≈ 0.228` at a storage temperature of approximately 10 °F (−12.22 °C). The doubling-per-15 °C form gives `2^((−12.2222 − 20)/15) = 0.22560201395017815` — **1.06 % below** the published figure. The closed form is chosen anyway, because a table of temperature buckets would step discontinuously across bucket edges (a 1 °C change flipping the answer by several percent) while being no more accurate in between, and because 1 % on a hop-freshness estimate is far inside the uncertainty of `percentLost` itself. **AC-9 pins the exact computed value AND asserts it lands within `0.01` of the published `0.228`**, so a future change that drifts away from the published anchor fails.

**Executor's citation duty — binding, same shape as M8_P1 Ambiguity 3:** verify `k(0.50) ≈ 0.00385` and the `SF` preset values against Garetz, *Hop Storage: How to Get — and Keep — Your Hops' Optimum Value*, **Brewing Techniques**, Jan/Feb 1994 (as cited by AlchemyOverlord's Hop Freshness calculator). **Only `SF = 0.5` for nitrogen-flushed oxygen-barrier packaging was independently corroborated while drafting** (see §4 Deviation 2); `0.75` and `1.0` are reconstructed. If any published value differs, **stop and route to `/plan`** — do not adjust the AC pins to match the code.

### 5. Gravity correction is **one** identity evaluated three ways — and it must not re-encode extract points

Build-spec §1.5 requires "Gravity correction (add DME/water, or adjust boil time, to hit a target gravity)" and §3 gives no formula. All three cases follow from one conserved quantity — total extract points, `points × volume`:

- **Dilute (gravity too high):** `V_target = V × P_current / P_target`, so `dilutionWaterL = V × (P_current / P_target − 1)`.
- **Boil longer (gravity too low):** the same identity read the other way — `additionalBoilMinutes = (V − V × P_current / P_target) / boilOffRateLPerHour × 60`.
- **Add DME (gravity too low):** the extra points must come from extract. Using M1's own gravity basis (`gravityAtVolume`: points are `lb × points-per-lb-per-gal / gal`), `dmeToAddKg = (P_target − P_current) × litersToGallons(V) / sgToPointsExact(dmePotentialSg) / POUNDS_PER_KG`.

**Binding:** `P` is always `sgToPointsExact` (never `sgToPoints`, which rounds — `units.ts:3`'s own comment binds internal extract math to the exact form), volume→gallons is always `litersToGallons`, and lb→kg divides by `POUNDS_PER_KG` **imported from `constants.ts`**. No literal `2.20462`, `0.264172` or `1000` appears in `gravityCorrection.ts`.

*Why divide by `POUNDS_PER_KG` rather than call `lbToKg`:* `config.ts:91`'s `lbToKg` has **no recipe/batch-path caller anywhere in the repository** (verified while drafting). Calling it from `gravityCorrection.ts` would force it into AC-31's partition as a name whose only non-defining-module caller is a standalone calculator — i.e. it would fail AC-31(a)'s no-caller sweep while not qualifying for (b). Dividing by the shared constant keeps exactly one encoding of the physical fact and leaves the partition clean. *(Noted in passing, not fixed here: `config.ts:85` declares its own module-private `LB_PER_KG = 2.20462`, duplicating `constants.ts:1`'s `POUNDS_PER_KG`. That is pre-existing, on §1.5's Untouched list, and out of scope — recorded in §4 Deviation 6, not logged as a bug, since it is the same no-drift-risk shape as `BUG-016`.)*

**No clamping, and the sign is meaningful.** A target *below* the current gravity returns a **negative** `dmeToAddKg` and a **negative** `additionalBoilMinutes`; a target *above* returns a negative `dilutionWaterL`. This matches `forceCarbonationPsi`'s established unclamped-converter precedent (M5_P2) and M8_P1 §2.1's "no clamping anywhere". The **UI** does not hide or reinterpret the sign; the card renders all three outputs always, and the negative one is the honest signal that that lever is the wrong one. AC-14 pins the negative values explicitly so a "helpful" `Math.max(0, …)` fails.

**`boilOffRateLPerHour === 0`** returns `±Infinity` (or `NaN` at `P_current === P_target`), rendered as `"—"`. No guard, no substitution.

### 6. Where the new pure functions live, and what stays shut

Three new files: `packages/calculations/src/yeast.ts`, `hops.ts`, `gravityCorrection.ts`. **All numeric coefficients are module-private** except the three preset records/constants §1.2 names as exported. `constants.ts` gains nothing — `packages/calculations/test/units.test.ts`'s M3_P2 assertion that `constants.ts` exports **exactly 15** names still holds, and both `constants.ts` and `units.test.ts` are on §1.5's Untouched list. (M8_P1 Ambiguity 6, held unchanged.)

`carbonation.ts` gains nothing either. This phase is the first to consume it from outside the batch path, and it consumes it **as-is**.

### 7. Degenerate input handling, and the no-leak rule — unchanged from M8_P1, extended to this phase's cases

M8_P1 Ambiguity 7 is carried forward verbatim and is binding: blank/whitespace/unparseable parses to `NaN`, passes **through** to the pure function, and renders as `"—"`; no calculator suppresses, substitutes or defaults a missing input; no calculator holds result state, so a stale result is structurally unrepresentable. New cases this phase introduces, all resolved the same way:

| Case | Result | Rendered |
|---|---|---|
| `starterVolumeL = 0` | `starterExtractGrams = 0` → inoculation rate `Infinity` (or `NaN` at zero initial cells) → growth `NaN` → end cells `NaN` | `—` |
| `initialCellsBillions = 0`, volume > 0 | `ir = 0` → growth is the type's full plateau rate; end cells = new cells | a real number |
| `boilOffRateLPerHour = 0` | `±Infinity` | `—` |
| `percentLostSixMonths = 1` | `k = Infinity` → `AA = 0` | `0.00 %` |
| `percentLostSixMonths > 1` | `ln` of a negative → `NaN` | `—` |
| `days = 0` | `AA₀` exactly | the input, echoed |

A **zero** typed by the user is a legitimate value and formats normally; only blank is `"—"`.

### 8. Rounding and precision on this page

M8_P1 Ambiguity 8, held. New raw-number outputs (no M7 helper exists for any of them) render through `ResultRow`'s existing `fractionDigits`/`unit` path at: cell counts **1 dp** with suffix `B`, inoculation rate **3 dp** with suffix `B/g`, growth rate **2 dp** with suffix `B/g`, alpha acid **2 dp** with suffix `%`, viability **1 dp** with suffix `%`, pressure **2 dp** with suffix `psi`, CO₂ **2 dp** with suffix `vols`, boil time **0 dp** with suffix `min`. **No new `format*` helper is added to `config.ts`** — it is on the Untouched list, and none of these quantities is a `UserConfig`-configurable unit.

---

## 1. Data Schema & Contracts

### 1.1 Database, API, shared types — no change

No migration, no endpoint, no type. `apps/api/**` and `packages/shared-types/**` are wholly on the Untouched guardrail list (§1.5, AC-35, AC-40).

### 1.2 New constants

| File | Symbol | Value | Exported? |
|---|---|---|---|
| `yeast.ts` | `PITCH_RATE_PRESETS` | `{ ale: 0.75, highGravityAle: 1.25, lager: 1.5 }` (readonly) | **Yes** |
| `yeast.ts` | `DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH` | `21` | **Yes** |
| `yeast.ts` | `STARTER_TYPES` | `['stirPlate', 'shaken', 'simple']` (readonly) | **Yes** |
| `yeast.ts` | `STIR_PLATE_PLATEAU_RATE`, `STIR_PLATE_BREAKPOINT_IR`, `STIR_PLATE_DECLINE_INTERCEPT`, `STIR_PLATE_DECLINE_SLOPE` | `1.4`, `1.4`, `2.33`, `0.67` | No |
| `yeast.ts` | `SHAKEN_RATE`, `SIMPLE_RATE`, `NON_STIRRED_MAX_IR` | `0.62`, `0.4`, `3.5` | No |
| `hops.ts` | `HOP_STORAGE_FACTORS` | `{ nitrogenFlushedOxygenBarrier: 0.5, sealedNotEvacuated: 0.75, looseInAir: 1.0 }` (readonly) | **Yes** |
| `hops.ts` | `HOP_DECAY_REFERENCE_DAYS`, `HOP_DECAY_REFERENCE_TEMP_C`, `HOP_DECAY_DOUBLING_INTERVAL_C` | `180`, `20`, `15` | No |

`constants.ts` gains nothing (Ambiguity 6). `gravityCorrection.ts` declares **no** constants of its own — it imports `POUNDS_PER_KG` from `constants.ts`.

### 1.3 Exported TypeScript types

```typescript
export type PitchRatePreset = 'ale' | 'highGravityAle' | 'lager';
export type StarterType = 'stirPlate' | 'shaken' | 'simple';
export type HopStorageMethod = 'nitrogenFlushedOxygenBarrier' | 'sealedNotEvacuated' | 'looseInAir';
```

All three live in `packages/calculations` (not `shared-types` — nothing is persisted, and `packages/shared-types/**` is Untouched).

### 1.4 Symbol Inventory

**New files — `packages/calculations`:**

| Path | Charge |
|---|---|
| `packages/calculations/src/yeast.ts` | `targetCellsBillions`, `viabilityAfterMonths`, `viableCellsBillions`, `starterExtractGrams`, `starterGrowthRateBPerG`, `starterEndCellsBillions`, `PITCH_RATE_PRESETS`, `DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH`, `STARTER_TYPES`, `PitchRatePreset`, `StarterType` (§2.1) |
| `packages/calculations/src/hops.ts` | `hopDecayRateConstant`, `hopTemperatureFactor`, `alphaAcidAfterStorage`, `HOP_STORAGE_FACTORS`, `HopStorageMethod` (§2.1) |
| `packages/calculations/src/gravityCorrection.ts` | `dilutionWaterL`, `dmeToAddKg`, `additionalBoilMinutes` (§2.1) |
| `packages/calculations/test/yeast.test.ts` | AC-2 … AC-7, AC-16, AC-17 |
| `packages/calculations/test/hops.test.ts` | AC-8 … AC-10, AC-16 |
| `packages/calculations/test/gravityCorrection.test.ts` | AC-11 … AC-14, AC-16 |

**New files — `apps/web`:**

| Path | Charge |
|---|---|
| `apps/web/src/components/calculators/PitchRateCalculator.tsx` | Wraps `targetCellsBillions` + `viabilityAfterMonths` + `viableCellsBillions` + `sgToPlato` |
| `apps/web/src/components/calculators/StarterGrowthCalculator.tsx` | Wraps `starterExtractGrams` + `starterGrowthRateBPerG` + `starterEndCellsBillions` |
| `apps/web/src/components/calculators/HopDecayCalculator.tsx` | Wraps `alphaAcidAfterStorage` (+ `hopTemperatureFactor` for the shown factor) |
| `apps/web/src/components/calculators/GravityCorrectionCalculator.tsx` | Wraps `dilutionWaterL` + `dmeToAddKg` + `additionalBoilMinutes` |
| `apps/web/src/components/calculators/CarbonationCalculator.tsx` | Wraps `residualCO2Volumes` + `primingSugarG` + `forceCarbonationPsi`. **Contains no arithmetic whatsoever** |

**Modified files — permitted edits are exhaustive:**

| Path | Permitted edits — exhaustive |
|---|---|
| `packages/calculations/src/index.ts` | Add `export * from './yeast';`, `export * from './hops';`, `export * from './gravityCorrection';`. **No existing line changes** — the explicit `./config` block and its `kgToLb` collision note stay byte-identical, and the `./hydrometry` / `./pressure` lines are untouched. |
| `apps/web/src/pages/Calculators.tsx` | Exactly two edits: five new imports, and five new JSX children appended to the existing grid **after** `<UnitConverterCalculator />`. No registry array, no props, no state, no wrapper `<div>` change (M8_P1 §2.5, held). |
| `apps/web/src/components/calculators/CalculatorCard.tsx` | **Additive only:** add one exported `SelectField` component and its `SelectFieldProps` interface (`label`, `value`, `options: readonly {value: string; label: string}[]`, `onChange`), styled to match `NumericField`. `CalculatorCard`, `NumericField`, `ResultRow` and `EM_DASH` are **byte-unchanged**. No arithmetic, no `format*` call. |
| `apps/web/test/Calculators.test.tsx` | Add AC-18 … AC-27 describe blocks. **No existing assertion may be deleted, weakened, or reordered**, and no existing pinned value may change. |
| `apps/web/test/calculatorImportGraph.test.ts` | Extend in place per AC-28 … AC-32 (details in each AC). Specifically: AC-24's `bannedLiterals` array gains this phase's coefficients; AC-25's `names` array grows from 14 to **26**; AC-26's `standaloneOnly` grows from 11 to **23**, `recipePathCaller` from 7 to **12**, `DEFINING_MODULE` gains 12 rows, and the closure test's universe grows from 18 to **35**; the two `calculateMashPlan`-anchored regex assertions are **replaced** by the AC-32 AST containment helper, and the `config.ts` hop-1 assertions likewise. AC-23's and AC-27's blocks are otherwise byte-unchanged. |

**Untouched (guardrail — AC-40).** No file below may have a changed content hash:

- `apps/api/**` and `packages/shared-types/**` in their entirety.
- `packages/calculations/src/**` **except** `index.ts` and the three new modules. Named explicitly because this phase reads them: `constants.ts`, `units.ts`, `config.ts`, `brewingMath.ts`, `carbonation.ts`, `batchClosing.ts`, `mash.ts`, `hydrometry.ts`, `pressure.ts`, `scaling.ts`, `water.ts`, `batchPipeline.ts`, `fermentation.ts`, `chronology.ts`.
- `packages/calculations/test/**` **except** the three new test files. `units.test.ts` in particular (the closed-15 assertion) and `carbonation.test.ts`.
- `apps/web/src/**` **except** `pages/Calculators.tsx`, `components/calculators/CalculatorCard.tsx`, and the five new calculator components. Specifically including: `App.tsx`, `components/Sidebar.tsx`, `components/StatsHeader.tsx`, `components/MashSection.tsx`, `components/CarbonationPanel.tsx`, `pages/BatchDetail.tsx`, `context/ConfigContext.tsx`, `api/client.ts`, and **all five M8_P1 calculator components** (`StrikeWaterCalculator.tsx`, `InfusionVolumeCalculator.tsx`, `HydrometerCalculator.tsx`, `RefractometerCalculator.tsx`, `UnitConverterCalculator.tsx`).
- `apps/web/test/**` **except** `Calculators.test.tsx` and `calculatorImportGraph.test.ts`. `App.test.tsx` and `Sidebar.test.tsx` in particular — **this phase adds no route and no nav item**, so neither needs to change; a change to either is a scope violation.
- `.gsd/BUGS.md` and `.gsd/FEATURES.md` — **no item's status changes in this phase** (§4 Deviation 6). `BUG-016` stays `LOGGED`; `BUG-012`/`013`/`014`/`015` stay `OPEN`.

---

## 2. Transformations & Pure Logic

### 2.1 Pure function contracts

```typescript
// packages/calculations/src/yeast.ts
export type PitchRatePreset = 'ale' | 'highGravityAle' | 'lager';
export type StarterType = 'stirPlate' | 'shaken' | 'simple';

export const PITCH_RATE_PRESETS: Readonly<Record<PitchRatePreset, number>>;
export const DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH = 21;
export const STARTER_TYPES: readonly StarterType[];

export interface TargetCellsInput {
  ogPlato: number;
  volumeL: number;
  pitchRateMillionCellsPerMlPerP: number;
}
export function targetCellsBillions(input: TargetCellsInput): number;

export function viabilityAfterMonths(months: number, monthlyDecayPct: number): number;

export interface ViableCellsInput {
  packCellsBillions: number;
  months: number;
  monthlyDecayPct: number;   // no default — caller passes the exported constant
}
export function viableCellsBillions(input: ViableCellsInput): number;

export interface StarterInput {
  starterVolumeL: number;
  starterGravitySg: number;
}
export function starterExtractGrams(input: StarterInput): number;

export function starterGrowthRateBPerG(inoculationRateBPerG: number, starterType: StarterType): number;

export interface StarterGrowthInput extends StarterInput {
  initialCellsBillions: number;
  starterType: StarterType;
}
export function starterEndCellsBillions(input: StarterGrowthInput): number;

// packages/calculations/src/hops.ts
export type HopStorageMethod = 'nitrogenFlushedOxygenBarrier' | 'sealedNotEvacuated' | 'looseInAir';
export const HOP_STORAGE_FACTORS: Readonly<Record<HopStorageMethod, number>>;

export function hopDecayRateConstant(percentLostSixMonths: number): number;   // fraction in [0,1)
export function hopTemperatureFactor(storageTempC: number): number;

export interface AlphaAcidStorageInput {
  initialAlphaAcidPct: number;
  percentLostSixMonths: number;
  storageTempC: number;
  storageFactor: number;
  days: number;
}
export function alphaAcidAfterStorage(input: AlphaAcidStorageInput): number;

// packages/calculations/src/gravityCorrection.ts
export interface GravityCorrectionInput {
  volumeL: number;
  currentSg: number;
  targetSg: number;
}
export function dilutionWaterL(input: GravityCorrectionInput): number;

export interface DmeCorrectionInput extends GravityCorrectionInput {
  dmePotentialSg: number;
}
export function dmeToAddKg(input: DmeCorrectionInput): number;

export interface BoilCorrectionInput extends GravityCorrectionInput {
  boilOffRateLPerHour: number;
}
export function additionalBoilMinutes(input: BoilCorrectionInput): number;
```

**Binding behaviour — no latitude.** (`P(x)` denotes the imported `sgToPointsExact(x)`; `G(v)` the imported `litersToGallons(v)`.)

| Function | Returns |
|---|---|
| `targetCellsBillions` | `pitchRateMillionCellsPerMlPerP × ogPlato × volumeL` |
| `viabilityAfterMonths(m, d)` | `(1 − d / 100) ** m` |
| `viableCellsBillions` | `packCellsBillions × viabilityAfterMonths(months, monthlyDecayPct)` — delegates, no second decay path |
| `starterExtractGrams` | `starterVolumeL × 1000 × starterGravitySg × sgToPlato(starterGravitySg) / 100` — `sgToPlato` **imported**, never re-derived |
| `starterGrowthRateBPerG(ir, t)` | `NaN` if `ir` is non-finite (leading guard, Ambiguity 3). Else `t === 'stirPlate'` → `ir < 1.4 ? 1.4 : max(0, 2.33 − 0.67 × ir)`; `t === 'shaken'` → `ir < 3.5 ? 0.62 : 0`; `t === 'simple'` → `ir < 3.5 ? 0.4 : 0` |
| `starterEndCellsBillions` | `initialCellsBillions + starterGrowthRateBPerG(initialCellsBillions / starterExtractGrams({…}), starterType) × starterExtractGrams({…})` — both helpers **delegated to**, not inlined |
| `hopDecayRateConstant(L)` | `−ln(1 − L) / 180` |
| `hopTemperatureFactor(t)` | `2 ** ((t − 20) / 15)` |
| `alphaAcidAfterStorage` | `initialAlphaAcidPct × e^(−hopDecayRateConstant(percentLostSixMonths) × hopTemperatureFactor(storageTempC) × storageFactor × days)` — both helpers **delegated to** |
| `dilutionWaterL` | `volumeL × (P(currentSg) / P(targetSg) − 1)` |
| `dmeToAddKg` | `(P(targetSg) − P(currentSg)) × G(volumeL) / P(dmePotentialSg) / POUNDS_PER_KG` |
| `additionalBoilMinutes` | `(volumeL − volumeL × P(currentSg) / P(targetSg)) / boilOffRateLPerHour × 60` |

**No clamping anywhere except `starterGrowthRateBPerG`'s `max(0, …)`**, which is the published curve's own zero floor (Ambiguity 3), not a defensive guard. The only other guard permitted in this phase is `starterGrowthRateBPerG`'s leading non-finite passthrough.

### 2.2 The five new cards' input/output map

One card each; every input is a canonical-metric/SG string in `useState<string>`; every output is derived during render.

| Card | Inputs (labels carry the unit token) | Outputs |
|---|---|---|
| Yeast pitch rate | Target gravity (SG), Batch volume (L), Pitch rate preset (`SelectField`, from `PITCH_RATE_PRESETS`), Cells per pack (B), Pack age (months) | Gravity (°P); Target cells (B); Viable cells (B); Viability (%); Cell shortfall (B) |
| Yeast starter growth | Starter volume (L), Starter gravity (SG), Cells pitched (B), Starter type (`SelectField`, from `STARTER_TYPES`) | Extract (g); Inoculation rate (B/g); Growth rate (B/g); New cells (B); End cells (B) |
| Hop alpha-acid decay | Alpha acid at purchase (%), Six-month loss (ratio), Storage temperature (°C), Storage method (`SelectField`, from `HOP_STORAGE_FACTORS`), Days stored (days) | Temperature factor (raw, 3 dp); Alpha acid now (%) |
| Gravity correction | Volume (L), Current gravity (SG), Target gravity (SG), DME potential (SG), Boil-off rate (L) | Dilution water (`formatVolume`); DME to add (`formatMass`); Extra boil time (min) |
| Priming & force carbonation | Beer volume (L), Target CO₂ (vols), Peak fermentation temperature (°C), Serving temperature (°C) | Residual CO₂ (vols); Priming sugar (`formatHopMass`); Force-carb pressure (psi) |

**Binding:** the **only** arithmetic permitted in any component in this phase is the pitch card's `targetCells − viableCells` shortfall subtraction and the starter card's `endCells − initialCells` new-cells subtraction — both plain differences of two already-computed function outputs, not formulas. Everything else is a function call. AC-29's banned-literal sweep and bare-numeric-literal restriction enforce the rest.

### 2.3 No-match / fallback contracts

| Input to any §2.1 function | Return |
|---|---|
| `NaN` in any structurally observable numeric argument | `NaN` (passthrough) — including `starterGrowthRateBPerG`, via its explicit leading guard |
| `±Infinity` | the formula's own result, or `NaN`; **never** a thrown error, never a fabricated `0` |
| A finite typed `0` | the formula's own finite result (e.g. `alphaAcidAfterStorage` with `days: 0` returns `initialAlphaAcidPct` exactly) |
| `boilOffRateLPerHour === 0` | `±Infinity` (or `NaN` when current === target). No guard |
| `starterVolumeL === 0` | extract `0` → inoculation rate non-finite → growth `NaN` → end cells `NaN` |
| An unknown `StarterType` at runtime | Structurally unrepresentable — the union type is exhaustive and the implementation must be an exhaustive switch/branch with no `default` fallback returning a number |

**Caller branching rules, binding** (M8_P1 §2.3, carried forward verbatim and extended):

- A calculator component **must not** pre-check `Number.isFinite` before calling, and **must not** branch on the `"—"` sentinel afterwards.
- A calculator component **must not** early-return a placeholder card body when a field is blank. The card renders in full with `"—"` in the affected result slots — and **only** the affected ones: a blank storage-temperature field must not blank the alpha-acid-at-purchase echo.
- The one shared non-finite check for helper-less outputs stays in `ResultRow` (M8_P1 §2.3). **No second non-finite check is added anywhere**, in any component or in `SelectField`.

### 2.4 Stateful integration contract

1. `Calculators.tsx` renders ten cards. It still holds **no** state, has **no** props, and performs **no** arithmetic.
2. Each new card holds its own field state as `useState<string>` for numeric fields and `useState<PitchRatePreset | StarterType | HopStorageMethod>` for the three `SelectField`s. **Select state is a union-typed value, never a numeric factor** — the factor is looked up from the exported preset record at call time, so a preset's value cannot be stale relative to the calc package.
3. **There is no result state.** No `useEffect`, no `useMemo` holding a computed result, no `setResult`. Results are derived during render (AC-26).
4. **Lockstep:** one `unitSystem`/`temperatureUnit`/`gravityUnit` change updates **all ten** cards in the same React commit from the same context value — no remount, no refetch, no per-card config copy (AC-24).
5. **Zero writes.** Unchanged from P1 and re-asserted over the enlarged page (AC-27).
6. Navigating away and back **resets** every field on every card to its initial value. No `localStorage`, no lifted state.

### 2.5 Refactoring & legacy cleanup

- **The two `calculateMashPlan`-anchored regex assertions in `calculatorImportGraph.test.ts` are removed, not kept alongside the AST check.** M8_P1's third critic pass disclosed that `toMatch(/calculateMashPlan[\s\S]*strikeTemperatureC\(/)` verifies token **adjacency**, not call-site **containment** — it stays green if the real call is deleted but the identifier survives in a trailing comment, a string literal, or a relocated function. AC-32 replaces both with a TypeScript-AST containment helper. Keeping the superseded regexes "for belt and braces" is **forbidden**: a redundant weaker assertion beside a stronger one is exactly the pattern that made the vacuous version survive two review passes.
- **The same replacement applies to the five `config.ts` hop-1 assertions** (`/function formatVolume[\s\S]*?convertVolume\(/` and its four siblings) — same adjacency-vs-containment weakness, same fix, one shared helper.
- **No obsolete registration loop to purge, and none to create.** Ten cards, ten explicit JSX children (M8_P1 §2.5, held). A `CALCULATORS` array is forbidden — with ten cards the temptation is stronger and the answer is unchanged.
- **No inline unit math.** `starterExtractGrams` imports `sgToPlato`; `gravityCorrection.ts` imports `sgToPointsExact`, `litersToGallons` and `POUNDS_PER_KG`; `viableCellsBillions` delegates to `viabilityAfterMonths`; `starterEndCellsBillions` delegates to both starter helpers; `alphaAcidAfterStorage` delegates to both hop helpers.
- **No new `format*` helper** (Ambiguity 8). `config.ts` stays Untouched.
- **`CalculatorCard.tsx`'s `SelectField` is added, not a per-card `<select>`.** Five inline `<select>` elements across three cards would be five independently-driftable styling and accessibility decisions.

---

## 3. Acceptance Criteria & Test Matrix

Every pinned value below was computed from the §2.1 formulas while drafting this spec, in a standalone evaluation independent of any implementation, and re-verified before writing. Where a full-precision literal is given the tolerance is `1e-9` unless stated; **no pin below is asserted with `===` on a value produced by floating-point division** (e.g. AC-11's `4 L` is really `4.0000000000000036`).

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | **New exports exist and are root-exported** | Unit | `targetCellsBillions`, `viabilityAfterMonths`, `viableCellsBillions`, `starterExtractGrams`, `starterGrowthRateBPerG`, `starterEndCellsBillions`, `hopDecayRateConstant`, `hopTemperatureFactor`, `alphaAcidAfterStorage`, `dilutionWaterL`, `dmeToAddKg`, `additionalBoilMinutes`, `PITCH_RATE_PRESETS`, `DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH`, `STARTER_TYPES`, `HOP_STORAGE_FACTORS` are all importable from **`@truchabrew/calculations`'s package root** in one statement, type-check, and none is `undefined`. `PITCH_RATE_PRESETS` deep-equals `{ale: 0.75, highGravityAle: 1.25, lager: 1.5}`; `HOP_STORAGE_FACTORS` deep-equals `{nitrogenFlushedOxygenBarrier: 0.5, sealedNotEvacuated: 0.75, looseInAir: 1.0}`; `STARTER_TYPES` deep-equals `['stirPlate','shaken','simple']`; `DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH === 21` |
| **AC-2** | **`targetCellsBillions` pinned, and °P comes from `sgToPlato`** | Unit | `sgToPlato(1.050)` = `12.374342499999955`. `targetCellsBillions({ogPlato: sgToPlato(1.050), volumeL: 20, pitchRateMillionCellsPerMlPerP: PITCH_RATE_PRESETS.ale})` = `185.61513749999932`; with `PITCH_RATE_PRESETS.lager` = `371.23027499999864` (**exactly 2× the ale figure**, asserted as a ratio, since the function is homogeneous in the rate); with `volumeL: 0` returns `0` exactly. The test computes its expected °P by **calling the imported `sgToPlato`**, never by a hand-copied literal |
| **AC-3** | **`viabilityAfterMonths` pinned** | Unit | With `monthlyDecayPct = DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH`: `viabilityAfterMonths(0, 21) === 1` exactly; `(1, 21)` = `0.79`; `(3, 21)` = `0.49303900000000006`; `(6, 21)` = `0.24308745552100006`; `(12, 21)` = `0.05909151103167418`. **Monotonicity:** strictly decreasing across `months = 0…12`, asserted as inequalities. `viabilityAfterMonths(6, 0) === 1` exactly (zero decay) |
| **AC-4** | **`viableCellsBillions` delegates** | Unit | `viableCellsBillions({packCellsBillions: 100, months: 3, monthlyDecayPct: 21})` = `49.303900000000006`, and **equals** `100 * viabilityAfterMonths(3, 21)` computed from the imported function (asserted as an identity, not a second literal). `packCellsBillions: 0` returns `0` exactly |
| **AC-5** | **`starterExtractGrams` pinned, and `sgToPlato` is not duplicated** | Unit + grep | `starterExtractGrams({starterVolumeL: 2, starterGravitySg: 1.037})` = `192.0283077900688`; `{1, 1.037}` = `96.0141538950344` (**exactly half**, asserted as a ratio); `{0, 1.037}` = `0` exactly. A grep over `packages/calculations/src` for `1262.45` and `-668.96` still matches **`config.ts` only** — `yeast.ts` contains no Plato coefficient |
| **AC-6** | **`starterGrowthRateBPerG`: the piecewise model, both sides of every breakpoint** | Unit | **stirPlate:** `(0, 'stirPlate')` = `1.4`; `(1.39999, 'stirPlate')` = `1.4`; `(1.4, 'stirPlate')` = `1.392` (±`1e-9`) — the **documented 0.008 discontinuity** (Ambiguity 3), asserted on both sides so a smoothing "fix" fails; `(2, 'stirPlate')` = `0.99` (±`1e-9`); `(3.5, 'stirPlate')` = `0` exactly (the `max(0, …)` floor, since `2.33 − 0.67 × 3.5 = −0.015`); `(10, 'stirPlate')` = `0` exactly. **shaken:** `(0, 'shaken')` = `0.62`; `(3.49999, 'shaken')` = `0.62`; `(3.5, 'shaken')` = `0`. **simple:** `(0, 'simple')` = `0.4`; `(3.49999, 'simple')` = `0.4`; `(3.5, 'simple')` = `0`. **Ordering:** at `ir = 1`, `stirPlate > shaken > simple`, asserted as inequalities |
| **AC-7** | **`starterEndCellsBillions` worked example, delegating to both helpers** | Unit | `starterEndCellsBillions({initialCellsBillions: 100, starterVolumeL: 2, starterGravitySg: 1.037, starterType: 'stirPlate'})` = `368.8396309060963`. Decomposed and asserted piecewise from the **imported** helpers: extract `192.0283077900688`, inoculation rate `0.5207565548581673`, growth rate `1.4`, new cells `268.8396309060963`. The same fixture with `'shaken'` returns `100 + 0.62 × 192.0283077900688` = `219.05755082984265` (±`1e-9`) and with `'simple'` returns `176.81132311602752` (±`1e-9`). `initialCellsBillions: 0` with the same volume/gravity returns exactly the new-cells figure (`268.8396309060963`), **not** `NaN` — zero pitched cells is a legitimate input, `ir = 0` |
| **AC-8** | **`hopDecayRateConstant` pinned AND cross-checked against Garetz's published table value** | Unit | `hopDecayRateConstant(0.5)` = `0.003850817669777474`; `(0.3)` = `0.0019815274663262912`; `(0.2)` = `0.001239686396190054`; `(0)` = `0` exactly. **Published-anchor check, binding:** `hopDecayRateConstant(0.5)` rounded to 5 decimal places equals **`0.00385`**, the value Garetz's published `k` table gives for a variety with 50 % six-month loss (Ambiguity 4). Asserted as its own explicit assertion with a comment citing the source, so the derivation is *verified* against the literature rather than merely asserted. `hopDecayRateConstant(1)` returns `Infinity`; `(1.5)` returns `NaN` |
| **AC-9** | **`hopTemperatureFactor` pinned, normalised at the reference, and within 1.1 % of the published table** | Unit | `hopTemperatureFactor(20) === 1` **exactly** (the reference temperature the `percentLost` table is defined at); `(5)` = `0.5` (±`1e-9`) and `(35)` = `2` (±`1e-9`) — the doubling-per-15 °C property, asserted at both ends; `(4)` = `0.4774208019552083`; `(−18)` = `0.17273910999597203`. **Published-anchor check:** `hopTemperatureFactor(fahrenheitToCelsius(10))` = `0.22560201395017815`, which is within **`0.01`** of Garetz's tabulated `0.228` at ≈10 °F (Ambiguity 4's disclosed 1.06 % gap). `fahrenheitToCelsius` is **imported**, not inlined |
| **AC-10** | **`alphaAcidAfterStorage` pinned, plus two self-consistency identities** | Unit | `alphaAcidAfterStorage({initialAlphaAcidPct: 10, percentLostSixMonths: 0.3, storageTempC: 4, storageFactor: HOP_STORAGE_FACTORS.nitrogenFlushedOxygenBarrier, days: 180})` = `9.183818475722585`. **Identity 1 (the definition of `percentLost`):** with `percentLostSixMonths: 0.5, storageTempC: 20, storageFactor: 1.0, days: 180` the result is **exactly half** the input — `5` for an input of `10`, within `1e-9`. This is what makes `k`'s closed form provably the published table's own definition, and it fails if the `180`, the `20 °C` reference, or the `−ln` are changed. **Identity 2:** `days: 0` returns `initialAlphaAcidPct` **exactly** (`10 === 10`), for every combination of the other arguments. **Monotonicity:** result strictly decreases as `days` increases, and strictly increases as `storageTempC` decreases, asserted as inequalities. **No clamp:** `percentLostSixMonths: 1` returns `0`, not `NaN` |
| **AC-11** | **`dilutionWaterL` pinned** | Unit | `dilutionWaterL({volumeL: 20, currentSg: 1.060, targetSg: 1.050})` = `4` within `1e-9` (**the true value is `4.0000000000000036`; asserting `toBe(4)` is a defect this criterion forbids**); `{23, 1.055, 1.048}` = `3.3541666666666137` (±`1e-9`); `{20, 1.050, 1.050}` = `0` within `1e-9`. **Identity:** the diluted result checks out — `(volumeL + dilutionWaterL) × P(targetSg)` equals `volumeL × P(currentSg)` within `1e-9`, computed with the **imported** `sgToPointsExact` |
| **AC-12** | **`dmeToAddKg` pinned, using the engine's own gravity basis** | Unit | `dmeToAddKg({volumeL: 20, currentSg: 1.045, targetSg: 1.050, dmePotentialSg: 1.045})` = `0.26628121349207723` (±`1e-9`). `{20, 1.045, 1.045, 1.045}` = `0` within `1e-9`. **Basis identity, binding:** adding that DME mass to the batch, evaluated through the **imported** `gravityAtVolume(kgToLb(dmeKg) × sgToPointsExact(1.045), 100, 20)`, raises the gravity by `0.005` within `1e-9` — i.e. the correction agrees with M1's own OG engine rather than with a private re-derivation. A grep over `packages/calculations/src/gravityCorrection.ts` finds **no** occurrence of `2.20462`, `0.264172`, or `1000` |
| **AC-13** | **`additionalBoilMinutes` pinned** | Unit | `additionalBoilMinutes({volumeL: 25, currentSg: 1.040, targetSg: 1.050, boilOffRateLPerHour: 3})` = `100` within `1e-9`; `{25, 1.040, 1.040, 3}` = `0` within `1e-9`; `boilOffRateLPerHour: 0` with unequal gravities returns `Infinity` (`Number.isFinite` false, `Number.isNaN` false), and with **equal** gravities returns `NaN` |
| **AC-14** | **Signs are meaningful and nothing is clamped** | Unit | `dmeToAddKg({20, currentSg: 1.050, targetSg: 1.045, dmePotentialSg: 1.045})` = `−0.26628121349207723` (±`1e-9`) — **exactly the negation** of AC-12's value, asserted as an identity. `additionalBoilMinutes({25, currentSg: 1.050, targetSg: 1.040, boilOffRateLPerHour: 3})` = `−125` within `1e-9`. `dilutionWaterL({20, currentSg: 1.050, targetSg: 1.060})` is **negative** (`−3.333…`, ±`1e-9`). All three assertions fail if a `Math.max(0, …)` or `Math.abs` is introduced |
| **AC-15** | **The carbonation card adds no math — it calls M5_P2's functions** | Static + Unit | `apps/web/src/components/calculators/CarbonationCalculator.tsx` contains **zero** arithmetic operators outside JSX/`className` strings: the tokens `*`, `/`, `+`, `-`, `**`, `Math.` appear **zero** times in its comment/string-stripped source (the AC-29 stripper is reused). It imports `residualCO2Volumes`, `primingSugarG`, `forceCarbonationPsi` from `@truchabrew/calculations` and calls each exactly once. `packages/calculations/src/carbonation.ts`'s content hash is **unchanged**. Numeric agreement, asserted directly: `residualCO2Volumes(20)` = `2.1427799999999997`, `primingSugarG({volumesCO2Target: 2.4, peakFermentationTempC: 20, beerVolumeL: 19})` = `19.548720000000017`, `forceCarbonationPsi({volumesCO2: 2.4, tempC: 4})` = `10.791756860800001` — all three unchanged from M5_P2 |
| **AC-16** | **Non-finite passthrough across every new pure function, over each function's structurally observable numeric arguments** | Unit | **(a) Observable-argument derivation rule, binding** — identical in form to M8_P1's amended AC-11(a): an argument is *structurally observable* when §2.1's binding-behaviour row for that function names it on the right-hand side. Non-numeric arguments (`starterType`) are out of scope. Derived mechanically: `targetCellsBillions` → 3; `viabilityAfterMonths` → 2; `viableCellsBillions` → 3; `starterExtractGrams` → 2; `starterGrowthRateBPerG` → 1; `starterEndCellsBillions` → 3; `hopDecayRateConstant` → 1; `hopTemperatureFactor` → 1; `alphaAcidAfterStorage` → 5; `dilutionWaterL` → 3; `dmeToAddKg` → 4; `additionalBoilMinutes` → 4. **32 pairs in total** (3+2+3+2+1+3+1+1+5+3+4+4 = 32; the running total was re-added digit by digit while drafting — see §4 Deviation 5). <br><br>**(b) Passthrough requirement.** For **every** pair: passing `NaN` as that argument, with every other argument finite and in-domain, returns `NaN` (`Number.isNaN` true), does not throw, and returns neither `0` nor `undefined`. Table-driven, one row per pair, with `expect(cases).toHaveLength(32)` asserted so a later function added without passthrough rows fails. <br><br>**(c) Fixture constraint, binding.** `viabilityAfterMonths`'s `monthlyDecayPct` row must use a **non-zero** `months` — `(NaN) ** 0` is `1`, not `NaN`, so a fixture of `months: 0` would make that row vacuous. Use `months: 6`. <br><br>**(d) The excluded-pair table is empty this phase, and that emptiness is asserted.** Every numeric argument of every §2.1 function is structurally observable; unlike M8_P1's `refractometerOriginalGravity`/`finalBrix`, no delegation contract makes any argument unreadable. The test carries an explicit comment stating this and the count assertion in (b) enforces it |
| **AC-17** | **Degenerate and zero cases, per §2.3's table** | Unit | `starterEndCellsBillions({initialCellsBillions: 100, starterVolumeL: 0, starterGravitySg: 1.037, starterType: 'stirPlate'})` returns `NaN` (extract `0` → `ir = Infinity` → the leading non-finite guard) — **not** `100`, **not** `0`. `starterGrowthRateBPerG(Infinity, 'shaken')` returns `NaN` (**not** `0` — this is the case a naive `ir < 3.5 ? 0.62 : 0` gets wrong, and it is asserted for all three starter types). `starterGrowthRateBPerG(NaN, 'simple')` returns `NaN` (**not** `0.4`). `alphaAcidAfterStorage` with `days: 0` and every other argument `NaN` still returns… **`NaN`**, not the initial value — asserted to prove the `days: 0` identity is not implemented as an early return |
| **AC-18** | **Pitch-rate card** | Component | Entering target gravity `1.050`, batch volume `20`, cells per pack `100`, pack age `3`, preset `ale` renders: gravity `12.4 °P`, target cells `185.6 B`, viable cells `49.3 B`, viability `49.3 %`, shortfall `136.3 B`. Switching the preset to `lager` changes target cells to `371.2 B`. The preset `SelectField` has exactly three options and its values come from `PITCH_RATE_PRESETS`' keys (asserted by AC-29's finding no `0.75`/`1.25`/`1.5` literal in the component) |
| **AC-19** | **Starter-growth card** | Component | Entering starter volume `2`, starter gravity `1.037`, cells pitched `100`, type `stirPlate` renders: extract `192.0 g`, inoculation rate `0.521 B/g`, growth rate `1.40 B/g`, new cells `268.8 B`, end cells `368.8 B`. Switching type to `simple` changes end cells to `176.8 B`. Under `unitSystem: 'us'` the extract row renders `6.77 oz` (via `formatHopMass`) while the starter-volume **input** still holds `2` |
| **AC-20** | **Hop-decay card** | Component | Entering alpha acid `10`, six-month loss `0.3`, storage temperature `4`, days `180`, method `nitrogenFlushedOxygenBarrier` renders temperature factor `0.477` and alpha acid now `9.18 %`. Changing the method to `looseInAir` **lowers** the rendered alpha acid (asserted as an inequality on the parsed values, not a second pin). Setting days to `0` renders `10.00 %` |
| **AC-21** | **Gravity-correction card** | Component | Entering volume `20`, current `1.060`, target `1.050`, DME potential `1.045`, boil-off rate `3` renders dilution water `4.0 L` under `metric` and `1.06 gal` under `us`. Entering volume `20`, current `1.045`, target `1.050` renders DME `0.27 kg` under `metric` and `0.59 lb` under `us`. Entering volume `25`, current `1.040`, target `1.050`, rate `3` renders extra boil time `100 min`. **All three output rows are rendered simultaneously in every case**, including when two of them are negative — no row is hidden, relabelled, or sign-flipped |
| **AC-22** | **Carbonation card** | Component | Entering beer volume `19`, target CO₂ `2.4`, peak fermentation temperature `20`, serving temperature `4` renders residual CO₂ `2.14 vols`, priming sugar `19.5 g` under `metric` / `0.69 oz` under `us`, and force-carb pressure `10.79 psi`. Setting target CO₂ to `1.0` (below residual) renders priming sugar `0.0 g` — `primingSugarG`'s **own** documented `Math.max(0, …)`, surfaced unmodified, not a UI-level branch |
| **AC-23** | **The page renders ten cards, still with no registry and no state** | Component | The Calculators page renders exactly **10** `<section>` calculator cards, whose titles include all five M8_P1 titles and all five new ones. `apps/web/src/pages/Calculators.tsx` contains no `useState`, no `.map(`, no array literal of components, and no props on any of the ten children (asserted by source scan). `TopBar` title is still `Calculators`; no new route and no new nav item exists — `NAV_ITEMS` still has **8** entries |
| **AC-24** | **Lockstep across all ten cards** | Integration (`Calculators.test.tsx`) | With `GET /api/config` resolved to `metric`/`celsius`/`sg`, the strike card shows `78.1 °C` (P1's pin, unchanged) and the gravity-correction card shows `4.0 L`. After `applyConfig` sets `us`/`fahrenheit` (no remount, no navigation, no reload), **both** update in the same pass (`172.6 °F`, `1.06 gal`), the carbonation card's priming-sugar row updates to `0.69 oz` in the same commit, and `GET /api/config` has still been called exactly **once** in total |
| **AC-25** | **New inputs stay canonical-metric and say so** | Component | Under `unitSystem: 'us'`: the gravity-correction card's volume `<input>` still holds `20` (not `5.28`) and its label contains `(L)`; the starter card's volume input holds `2` with label containing `(L)`; the hop card's storage-temperature label contains `(°C)`. Every `<input>` added by this phase has a label containing an explicit unit token from `{(L), (kg), (°C), (SG), (%), (B), (months), (days), (vols), (B/g), (ratio), (g), (L/h)}`. Typing into any input never converts the typed value |
| **AC-26** | **Degenerate/empty inputs render the em-dash, never `NaN` or `0`, and only the affected rows** | Component | Clearing the hop card's storage-temperature field renders `—` in **both** the temperature-factor and alpha-acid rows — not `NaN`, not `0.00 %`, and not the previously computed `9.18 %`. Clearing the gravity-correction card's boil-off-rate field renders `—` in the extra-boil-time row **while the dilution-water and DME rows still show their real values** (the no-early-return rule, §2.3). Whitespace-only and alphabetic entries behave identically. Typing a literal `0` into the starter card's cells-pitched field renders the real zero-pitch answer (`268.8 B`), proving blank and zero are distinguished. No component under `components/calculators/` contains a `useState` holding a computed result, a `setResult`, or a `useEffect` (source scan) |
| **AC-27** | **No writes, no persistence, no leaked placeholder — over the enlarged page** | Component/Integration | Mounting the Calculators page, filling every field on all ten cards, changing all three `SelectField`s, and navigating away issues **zero** `fetch` calls with method `POST`/`PUT`/`PATCH`/`DELETE`, and no `GET` other than the app-mount `/api/config`. `localStorage.setItem` is never called. Navigating away and back renders every field at its initial value and every `SelectField` at its initial option |
| **AC-28** | **Import graph: the AC-23 allowlist still holds over the five new components** | Static (`calculatorImportGraph.test.ts`) | P1's AC-23 block passes **unmodified** over the enlarged `components/calculators/` directory (the block reads the directory, so it picks the new files up with no edit). Every import specifier in the five new components resolves inside the closed allowlist; **no** relative import escapes to `../../utils`, `../../api`, `../../hooks`, or reaches into `packages/`; every name imported from `@truchabrew/calculations` resolves to a defined package-root export. **If this block needed editing to pass, that is itself a finding** — record it rather than editing silently |
| **AC-29** | **Import graph: banned-literal sweep extended** | Static (`calculatorImportGraph.test.ts`) | The `bannedLiterals` array gains, exactly: `'2.33'`, `'0.67'`, `'0.62'`, `'0.21'`, `'3.0378'`, `'0.050062'`, `'0.00026555'`, `'16.6999'`, `'0.0101059'`, `'0.00116512'`, `'0.173354'`, `'4.24267'`, `'0.0684226'`, `'0.75'`, `'1.25'`. **No existing banned literal is removed.** The concatenated source of all ten components plus `Calculators.tsx` plus `CalculatorCard.tsx` contains none of the enlarged list. The permitted bare-numeric-literal set stays **exactly** `{0, 1, 2, 3, 100, 1000}` — unchanged and not widened; every other bare numeric literal token is absent. `Math.pow`, `Math.exp`, and `**` appear **zero** times |
| **AC-30** | **Import graph: one definition per formula, repo-wide — extended to 26 names** | Static (`calculatorImportGraph.test.ts`) | AC-25's `names` array grows from 14 to **26** by adding, exactly: `targetCellsBillions`, `viabilityAfterMonths`, `viableCellsBillions`, `starterExtractGrams`, `starterGrowthRateBPerG`, `starterEndCellsBillions`, `hopDecayRateConstant`, `hopTemperatureFactor`, `alphaAcidAfterStorage`, `dilutionWaterL`, `dmeToAddKg`, `additionalBoilMinutes` (12 new; 14 + 12 = 26). For each of the 26, the count of `export function <name>` across all of `packages/calculations/src/**` and `apps/web/src/**` is **exactly 1**, and that one is under `packages/calculations/src/`. **No name is removed from the existing 14** |
| **AC-31** | **Import graph: the partition stays closed, total and disjoint — extended to 35 names** | Static (`calculatorImportGraph.test.ts`) | **(a) Standalone-only set — exactly 23.** P1's eleven plus this phase's twelve new functions (the AC-30 list). For each, its name appears as a call site **nowhere** in `packages/calculations/src/*.ts` outside its own `DEFINING_MODULE` entry and `index.ts`, and nowhere in `apps/web/src/**` outside `components/calculators/`. `DEFINING_MODULE` gains twelve rows (`yeast.ts` ×6, `hops.ts` ×3, `gravityCorrection.ts` ×3); the per-name `{index.ts, ownModule}` exclusion shape from P1's amendment is **preserved unchanged** — a wholesale `yeast.ts`/`hops.ts`/`gravityCorrection.ts` exclusion is forbidden (it is exactly the over-broad filter P1's second critic pass rejected). <br><br>**(b) Recipe-path-caller set — exactly 12, each positively asserted, each failing if its single call site is removed.** P1's seven, plus: `primingSugarG` and `forceCarbonationPsi` (called inside `packages/calculations/src/batchClosing.ts`'s `computeBatchClosingFigures` path); `residualCO2Volumes` (called inside `carbonation.ts`'s `primingSugarG`, which is itself in this set — a two-hop chain asserted at **both** hops, exactly like P1's `format*` chain); `sgToPointsExact` and `litersToGallons` (called inside `packages/calculations/src/brewingMath.ts`'s `totalExtractPoints` / `gravityAtVolume`). Every assertion in (b) uses AC-32's AST containment helper, **not** a regex. <br><br>**(c) Closure — total and disjoint.** The union of (a) and (b) equals **exactly 35** names: AC-30's 26 plus the nine AC-30 does not enumerate (`refractometerOriginalGravity`, `kpaToPsi`, `psiToBar`, `barToPsi`, `primingSugarG`, `forceCarbonationPsi`, `residualCO2Volumes`, `sgToPointsExact`, `litersToGallons`). `23 + 12 = 35`, and `26 + 9 = 35` — both arithmetic paths asserted in the test, so a miscount fails rather than passing quietly. The intersection is **empty**. <br><br>**(d) No negation tests.** Unchanged from P1's AC-26(d) and binding here: no assertion may take the form of asserting the *absence* of a caller for a function in (b), nor `expect(<callsX>).toBe(false)` as a stand-in for a requirement in (b) |
| **AC-32** | **The adjacency-vs-containment limitation P1 disclosed is closed by an AST containment check** | Static (`calculatorImportGraph.test.ts`) | A helper `callsWithin(filePath, enclosingFunctionName, calleeName): boolean` is implemented using the **TypeScript compiler API** (`typescript` is already a root devDependency, v6.0.3 — no new dependency): parse with `ts.createSourceFile`, locate the `FunctionDeclaration`/`VariableStatement` whose name is `enclosingFunctionName`, and walk **only that node's subtree** for a `CallExpression` whose callee identifier text is `calleeName`. Every AC-31(b) assertion and the two `mash.ts` assertions route through it. **Four mutation properties, each asserted by the critic at `/verify` (and each stated here so the executor builds for them):** (i) deleting the real call makes it `false`; (ii) leaving the identifier only in a **comment** inside the enclosing function makes it `false`; (iii) leaving it only in a **string literal** makes it `false`; (iv) **relocating** the call to another function in the same file makes it `false`. The two superseded regex assertions (`/calculateMashPlan[\s\S]*strikeTemperatureC\(/` and its `infusionVolumeL` sibling) and the five `config.ts` `/function format[A-Za-z]*[\s\S]*?convert…\(/` assertions are **deleted, not kept alongside** (§2.5) |
| **AC-33** | **Runtime identity: the carbonation calculator's numbers are the batch path's numbers** | Unit/Integration | For `volumesCO2Target: 2.4`, `peakFermentationTempC: 20`, `beerVolumeL: 19`, `carbonationTempC: 4`: the values the `CarbonationCalculator` renders equal, to full precision before formatting, the values `packages/calculations/src/batchClosing.ts` produces for a batch with the same four figures — asserted by calling the batch-closing entry point and the three imported functions in the same test and comparing with **exact `===`**, no tolerance. This is M8_P1 AC-27's runtime-identity pattern extended to the second recipe/batch-path function family, closing the milestone's threshold by execution as well as by static analysis |
| **AC-34** | **`constants.ts` closed-15 assertion still holds** | Unit (existing) | `packages/calculations/test/units.test.ts`'s M3_P2 assertion still passes **unmodified**: `constants.ts` exports exactly 15 names. All three new modules' coefficients are module-private except §1.2's four exported presets/constants, none of which is in `constants.ts`. `units.test.ts`'s content hash is unchanged |
| **AC-35** | **No API, schema, shared-types, route or navigation change** | Verification | `apps/api/**` and `packages/shared-types/**` have zero changed content hashes. No new migration file exists. `apps/web/src/App.tsx`, `apps/web/src/components/Sidebar.tsx`, `apps/web/test/App.test.tsx` and `apps/web/test/Sidebar.test.tsx` all have **unchanged** content hashes. `GravityUnit` remains `'sg' \| 'plato'` |
| **AC-36** | **Test gate** | Command | `npm test` exits **0** across all four workspaces, with **0** failures and **no reduction** in the passing count relative to the M8_P1 close baseline (**1216 passed / 2 skipped**) |
| **AC-37** | **Typecheck gate** | Command | `npm run typecheck` exits **0**, and the run demonstrably **reaches all four projects** (not short-circuited by an early failure) |
| **AC-38** | **Build gate** | Command | `npm run build` exits **0** |
| **AC-39** | **Lint gate** | Command | `npm run lint` exits **0**, introducing **no new warning** beyond the three pre-existing `react(only-export-components)` warnings: `apps/web/src/context/ConfigContext.tsx` ×2 (lines 112 and 120) and `apps/web/src/context/CatalogContext.tsx` ×1 (line 47). Note `CalculatorCard.tsx` gains a second exported component (`SelectField`) — it already exports four symbols and emits no warning today; if adding `SelectField` introduces one, that is a **new** warning and fails this gate |
| **AC-40** | **Scope guardrail** | Manifest Diff | §1.4's New + Modified tables are the complete set of files that may change. Verified by a SHA-256 content manifest captured **before the executor's first edit** and again at the end — `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum` — written to `.gsd/active/M8_P2_pre_exec_manifest.txt` and `.gsd/active/M8_P2_post_exec_manifest.txt` and diffed. **`git diff --name-only` against a base commit is NOT usable in this repository and must not be substituted:** `git rev-list --count HEAD` is **1**, the sole commit (`7d88e64`) predates M1–M8, and no commit represents this phase's starting state — re-confirmed while drafting this spec, and the same finding M4_P1's AC-7, M7_P1's AC-28, M7_P2's AC-24 and M8_P1's AC-34 each recorded. Every path whose hash changed must appear in §1.4's tables; every §1.4 "Modified" path must actually have changed; **no path on §1.5's Untouched list may have changed**. Any deviation is disclosed in §4 before verification, not after |
| **AC-41** | **No backlog item's status changes, and none is silently absorbed** | Verification | `.gsd/BUGS.md` and `.gsd/FEATURES.md` have **unchanged** content hashes. `BUG-016` is still `LOGGED`; `BUG-012`, `BUG-013`, `BUG-014`, `BUG-015` are still `OPEN`; `FEAT-001` … `FEAT-008` are still `LOGGED`. No item was set to `IN_PLANNING`, because none is in this phase's scope (§4 Deviation 6) — and in particular **`BUG-016` is not fixed here**: `packages/calculations/src/brewingMath.ts` stays on the Untouched list and `srmToEbc`/`srmToLovibond` stay in AC-31(a)'s standalone set |

**AC count: 41.**

---

## 4. Deviation Register

### Deviation 1 — Five cards, not the four M8_P1 §5 previewed

**Status: disclosed, minor, no sign-off strictly needed — stated because §5 said "four more cards".**

M8_P1 §5 enumerated four P2 items: pitch rate + starter size (as one), hop decay, gravity correction, and carbonation. This spec ships **five** cards by splitting pitch rate and starter growth apart. They have disjoint inputs (a pitch card needs batch volume and pack age; a starter card needs starter volume, starter gravity and starter type) and disjoint outputs, and merging them would either produce a nine-field card or force a shared props shape — the exact "just pass the values object" leak M8_P1 §2.5 forbids. No scope is added: the same six `yeast.ts` functions back both cards either way.

### Deviation 2 — Two published models are pinned from **secondary** sources because the primary sources were unreachable

**Status: needs sign-off. This is the phase's largest correctness risk, and it is the one M8_P1 §5 predicted.**

M8_P1's Ambiguity 3 set the standard: pin the formula in the spec, numerically, before any code exists, and require the executor to **stop rather than adjust** on any mismatch. That standard is met here in form, but the citation quality is **weaker than M8_P1's Terrill case**, and pretending otherwise would be the failure this register exists to prevent.

**What was actually reachable from this environment.** Most brewing-domain hosts failed DNS outright (`braukaiser.com`, `woodlandbrew.com`, `morebeer.com`, `dieseldrafts.com`); `jphosom.github.io` and `raw.githubusercontent.com` resolved. So neither Kai Troester's original *Estimating yeast growth* article nor Garetz's *Brewing Techniques* piece could be read directly. What follows is what was corroborated, and how.

**(a) Braukaiser starter growth — corroborated in part, reconstructed in part.**
- *Corroborated by two independent secondary summaries:* the stir-plate plateau of **1.4 B/g** below an inoculation rate of 1.4 B/g, and the existence of a **decline above 1.4**; the **shaken** rate of **0.62 B/g** and the **simple/non-agitated** rate of **0.4 B/g**, each "up to an inoculation rate of 3.5 B/g". Sources: Homebrew Dad's / BrewUnited's yeast calculator documentation and Woodland Brewing Research's *Starter Cell Growth*, both explicitly attributing the model to Kai Troester.
- *Reconstructed, then checked:* the declining branch's coefficients `2.33 − 0.67 × ir`. These come from memory of the published fit, **not** from a source read during drafting — so two independent consistency checks were run before pinning them, and **both pass**: (i) at the breakpoint, `2.33 − 0.67 × 1.4 = 1.392`, i.e. it meets the corroborated 1.4 plateau to within 0.6 %; (ii) its zero crossing is `2.33 / 0.67 = 3.4776…`, i.e. it hits zero growth at essentially the corroborated 3.5 B/g ceiling that the shaken/simple branches independently use. Two unrelated corroborated anchors reproduced by one two-parameter line is not proof, but a wrong pair of coefficients would be unlikely to hit both.
- **The alternative, if you'd rather not carry this risk:** ship P2 with pitch rate, viability, hop decay, gravity correction and carbonation **only**, and defer the starter-growth card to a later phase gated on reading the primary source. That drops AC-5, AC-6, AC-7, AC-19, three `yeast.ts` functions and one card — roughly 6 of 41 ACs — and leaves the pitch card able to say "you are short 136 B cells" without saying what starter would fix it, which is a genuinely less useful calculator. **Recommendation: ship it as specced**, with the executor's citation duty (Ambiguity 3) as the backstop.

**(b) Garetz hop decay — the formula shape and one numeric anchor are corroborated; `TF`'s form and two `SF` values are not.**
- *Corroborated:* the relation `AA_future = AA₀ × 1/e^(k · TF · SF · days)`; the attribution to Garetz, *Hop Storage: How to Get — and Keep — Your Hops' Optimum Value*, Brewing Techniques, Jan/Feb 1994; a worked published example giving `k = 0.00385` for a 50 % six-month loss, `TF ≈ 0.228` at ≈10 °F, and `SF = 0.5` for nitrogen-flushed oxygen-barrier packaging. Source: AlchemyOverlord's Hop Freshness calculator (jphosom.github.io), which cites the Garetz article directly.
- *Derived and then verified against that anchor:* `k = −ln(1 − L)/180` reproduces the published `0.00385` to five decimal places — a genuine cross-check, since the closed form was written first and the published value found second, and a wrong reference period (183 days, 182.5 days, 6×30) would miss it.
- *Reconstructed, with the gap quantified:* `TF = 2^((T − 20)/15)` gives `0.2256` where the published table gives `0.228` — **1.06 % low**, disclosed in Ambiguity 4 and bounded by AC-9's `±0.01` published-anchor assertion. And `SF = 0.75` (sealed, not evacuated) and `1.0` (loose in air) are reconstructed; only `0.5` was corroborated.
- *If overruled:* transcribe Garetz's `TF` and `SF` tables verbatim as lookup tables once a primary source is in hand, accepting bucket-edge discontinuities in `TF`. AC-9's published-anchor assertion is written so that this substitution would still pass, which is deliberate.

### Deviation 3 — `PITCH_RATE_PRESETS.highGravityAle` is pinned at `1.25`, the **top** of the source's range

**Status: disclosed, one-line overrule if you disagree.**

Build-spec §3.6 gives "high-gravity ale 1.0-1.25" — a range, not a value, and a `Record<PitchRatePreset, number>` needs one number. `1.25` is chosen because the failure modes are asymmetric: under-pitching a high-gravity wort produces stress esters, fusels and stalled fermentation, while over-pitching costs yeast. A calculator that quietly recommends the *low* end of a range for the *highest-risk* case is the wrong default. *If overruled:* change the value to `1.0`, or expose the range as two presets (`highGravityAleLow` / `highGravityAleHigh`) — the latter needs `PitchRatePreset`, `PITCH_RATE_PRESETS`, AC-1 and AC-18 updated and nothing else.

### Deviation 4 — AC-32 replaces working assertions in a file belonging to a **closed, verification-clean** phase

**Status: needs sign-off. It edits M8_P1's guardrail rather than only extending it.**

M8_P1 §5 committed P2 to *extending* `calculatorImportGraph.test.ts`'s allowlists. AC-32 goes further: it **deletes and replaces** seven assertions in the AC-26 block of a file that passed a three-pass critic audit — the two `calculateMashPlan`-anchored regexes and the five `config.ts` `format*` hop-1 regexes.

The justification is that M8_P1's own third critic pass disclosed the limitation and recommended exactly this: *"the `calculateMashPlan`-anchored regex verifies token ADJACENCY, not call-site containment … recommended (not required) that M8_P2 resolve calls via the TypeScript AST instead of regex."* That block has now been wrong **three times running** (build pass: negation assertion; amendment pass: vacuous definition-matching regex plus an over-broad module exclusion; third pass: adjacency-not-containment). A fourth iteration of the same mechanism is the wrong bet, and `typescript@6.0.3` is already a root devDependency, so the AST route costs no new dependency.

*Risks, stated:* it touches a closed phase's verified artifact, and a buggy AST helper could be *weaker* than the regex it replaces while looking stronger. AC-32's four mutation properties (delete / comment-only / string-literal-only / relocated) are specified precisely so `/verify`'s critic proves the helper goes **red** under each rather than trusting a green suite — the practice that caught all three prior failures.

*If overruled:* keep the seven regexes as-is, extend AC-31(b)'s five new assertions in the same regex style, and carry the disclosed adjacency limitation forward into M9. Nothing else in this spec changes.

### Deviation 5 — Arithmetic in this spec was re-derived digit by digit, and the count that has failed six times is stated with its itemization

**Status: disclosed, no sign-off needed. Process note, recorded because the pattern is now six incidents long.**

This project has caught **six** spec-arithmetic slips, four of them on an AC numbered 11 (M2_P1's rounding ratio, M3_P2 twice, M7_P2's `0.5 L`→`2.0 L`, M8_P1's `21`→`14`). The lesson M8_P1 Deviation 7 recorded — *"a count stated alongside its own itemization is exactly where a drafting slip hides, because the itemization reads as authoritative and the total reads as decorative"* — is applied here:

- **AC-16's 32** is written with its full 12-term addition inline and was re-added term by term (3+2+3+2+1+3+1+1+5+3+4+4).
- **AC-31's 35** is asserted **twice by two different decompositions** in the test itself (`23 + 12` and `26 + 9`), so a miscount fails the suite rather than surviving in prose.
- **Every numeric pin in §3 was computed in a standalone evaluation** of §2.1's formulas, not copied from any source document and not read back from an implementation (there is none). Three pins are deliberately *awkward* numbers that a plausible-looking implementation would miss: AC-11's `4.0000000000000036` (which forbids `toBe(4)`), AC-6's `1.392`-not-`1.4` discontinuity, and AC-17's `NaN`-not-`0` for `starterGrowthRateBPerG(Infinity, 'shaken')`.

### Deviation 6 — No open `BUGS.md` / `FEATURES.md` item is folded in, and none is set to `IN_PLANNING`

**Status: disclosed, no status changes made.**

Reviewed at drafting: `.gsd/BUGS.md` holds sixteen items — `BUG-001` … `BUG-011` `VERIFIED_RESOLVED`, `BUG-012` … `BUG-015` `OPEN`, `BUG-016` `LOGGED`. `.gsd/FEATURES.md` holds eight, all `LOGGED`. **None is in this phase's scope:**

- **`BUG-012`** (strike-temperature thermal-mass over-compensation) needs `mash.ts`, which is Untouched here — and was explicitly ruled out of this phase's scope at planning.
- **`BUG-013`/`014`/`015`** are recipe-editor, hop-scheduling and batch-detail defects; all touch files on the Untouched list.
- **`BUG-016`** (`brewingMath.ts:289`'s inline `srm * SRM_TO_EBC`) needs `brewingMath.ts`, which this phase reads (AC-31(b)) but does not edit. Folding it in would put the core calculation engine — covered by M1's fixture-parity suite — inside a phase that otherwise touches no recipe-path source, for a defect M8_P1 Deviation 8 established has **no drift risk** (one shared `SRM_TO_EBC` constant, one encoding). It stays `LOGGED` for a phase whose Untouched list permits the edit.
- **`FEAT-001`** (mash-pH calculator modal) is a recipe-editor water-chemistry surface, not a standalone calculator; **`FEAT-002`/`003`/`006`/`007`/`008`** are batch/equipment/hop-schedule work; **`FEAT-004`/`005`** are app-wide form-design overhauls that would collide head-on with this phase's Untouched list. `FEAT-005` stays adjacent-and-noted: the new cards follow `CalculatorCard`'s sectioned-container direction so a later FEAT-005 phase inherits rather than rewrites them.

**AC-41 asserts this positively** (both files' content hashes unchanged, every item's status re-checked), so "no item was pulled in" is a verified fact rather than an omission.

*Noted, deliberately not logged:* `config.ts:85`'s module-private `LB_PER_KG = 2.20462` duplicates `constants.ts:1`'s `POUNDS_PER_KG`, and `config.ts:91`'s `lbToKg` has no recipe-path caller. Same no-drift-risk shape as `BUG-016` and same required fix location (a phase permitted to edit `config.ts`). Recorded here rather than as `BUG-017` to avoid inflating the backlog with a second entry that says what `BUG-016` already says; raise it at `/steer` if you would rather have the ID.

### Deviation 7 — M8_P1 Deviation 2's metric-only input boundary is held, and this is the last phase before it becomes M8_P3's problem

**Status: disclosed, no new decision requested — restated because this phase adds fifteen more metric-labelled inputs.**

Ten cards now ask a US-configured brewer to type litres, kilograms and °C while reading answers in gallons, pounds and °F. The recommendation from M8_P1 stands unchanged: hold the boundary, label every input, and schedule **M8_P3 "type in your own units"** covering the calculators *and* the recipe/equipment forms together. Nothing here forecloses that — every input is already a `string` state parsed at call time, which is the shape a converted-input layer needs.

---

## 5. What closing this phase means

M8_P2 is the closing phase of Milestone 8. On a clean `/verify`, the roadmap's Milestone 8 verification threshold is met in full:

- **"Reach the brewing calculators directly … without having to build a recipe first"** — ten cards, one route, no recipe, batch, equipment profile or schedule required for any of them.
- **"Every calculator's output is produced by a function that is also reachable from the recipe/batch path (asserted by import graph, not convention)"** — AC-31's total, disjoint 35-name partition, with AC-32's AST containment replacing the last regex-shaped weakness, plus AC-27 and AC-33's two runtime-identity proofs.
- **"Each has unit tests against published reference values"** — AC-2 … AC-15, including two *published-anchor* assertions (Garetz's `k = 0.00385`, `TF ≈ 0.228`) and two self-consistency identities (the 50 %-at-180-days decay identity, the extract-points dilution identity).
- **"A duplicated formula in a calculator is a milestone failure"** — AC-29's banned-literal sweep, AC-30's 26-name one-definition check, AC-15's zero-arithmetic assertion on the carbonation card, and AC-12's basis identity tying gravity correction to M1's own `gravityAtVolume`.

**Not closed by this milestone, and carried forward:** M8_P3 "type in your own units" (Deviation 7), `BUG-016` and the `LB_PER_KG` note (Deviation 6), and — if Deviation 2's alternative is taken — the starter-growth card.

---

> **HALT GATE (STATE 2).** This spec adds **three pure-function modules, five calculator cards and 41 acceptance criteria**, and closes Milestone 8. No application code exists yet and none may be written until approval.
>
> **What `/execute` WILL touch — exhaustively, per §1.4:** three new `packages/calculations/src` modules + their three test files; five new `apps/web/src/components/calculators/*.tsx`; and five modified files — `packages/calculations/src/index.ts` (three added export lines), `apps/web/src/pages/Calculators.tsx` (five imports, five JSX children), `apps/web/src/components/calculators/CalculatorCard.tsx` (**additive only** — one new `SelectField`), `apps/web/test/Calculators.test.tsx`, `apps/web/test/calculatorImportGraph.test.ts`. Plus the `M8_P2_pre/post_exec_manifest.txt` pair.
>
> **What it will NOT touch:** `App.tsx`, `Sidebar.tsx`, `App.test.tsx`, `Sidebar.test.tsx` (**no new route, no new nav item**), any of P1's five calculator components, `carbonation.ts`, `brewingMath.ts`, `mash.ts`, `units.ts`, `config.ts`, `constants.ts`, `apps/api/**`, `packages/shared-types/**`, `.gsd/BUGS.md`, `.gsd/FEATURES.md`.
>
> ---
>
> **(A) §4 Deviation 2 — two published models are pinned from *secondary* sources. ← the one that most wants your judgment.** The primary sources (`braukaiser.com`, `morebeer.com`, Garetz's 1994 article) were **unreachable by DNS** from this environment. For **Garetz hop decay** the situation is good: the formula shape and a published worked example were corroborated, and the rate constant's closed form `k = −ln(1−L)/180` *reproduces* the published `k = 0.00385` for a 50 % loss — a real cross-check, since the form was written before the published value was found. The temperature factor is 1.06 % below the published `0.228` at 10 °F, quantified and bounded by AC-9. For **Braukaiser starter growth** the plateau (1.4 B/g), the shaken (0.62) and simple (0.4) rates and the 3.5 B/g ceiling were each corroborated by two independent secondary summaries — but the declining branch's `2.33 − 0.67·ir` is **reconstructed from memory**, checked against two corroborated anchors that it does reproduce (`→1.392` at the 1.4 breakpoint, zero crossing at 3.4776 ≈ 3.5). **Recommendation: ship as specced**, with the executor's binding stop-and-route-to-`/plan` citation duty. **The alternative:** drop the starter card and its three functions (≈6 of 41 ACs) to a later phase gated on reading the primary source, leaving the pitch card able to say "you are 136 B cells short" but not what starter fixes it.
>
> **(B) §4 Deviation 4 — AC-32 replaces seven working assertions inside M8_P1's closed, verification-clean guardrail file.** P1's own third critic pass disclosed that its `calculateMashPlan`-anchored regexes verify token *adjacency*, not call-site *containment* (a deleted call whose name survives in a comment leaves the suite green) and recommended the TypeScript AST. That block has been wrong three times running, `typescript@6.0.3` is already a root devDependency, and AC-32 specifies four mutation properties the critic must prove go **red**. **The alternative:** keep the regexes, add this phase's five new assertions in the same style, and carry the disclosed limitation into M9.
>
> **(C) §4 Deviation 3 — `highGravityAle` pitch rate pinned at `1.25`, the top of the source's `1.0`–`1.25` range**, because under-pitching a big wort is the costlier error. One-line overrule to `1.0`, or split into two presets.
>
> **(D) §4 Deviation 1 — five cards, not the four M8_P1 §5 previewed** (pitch rate and starter growth split apart; disjoint inputs and outputs, same six backing functions either way). No scope added.
>
> Also worth a glance: **§1.5's Untouched list** is deliberately broad — this phase adds three modules and five cards and modifies five files, nothing else. **§4 Deviation 6** confirms no `BUGS.md`/`FEATURES.md` item is in scope and **none was set to `IN_PLANNING`**; `BUG-012` and `BUG-016` in particular stay where they are, and AC-41 asserts that positively. And **§4 Deviation 5** records that every pinned number here was computed standalone and re-added digit by digit — including three deliberately awkward pins (`4.0000000000000036`, the `1.392` discontinuity, `NaN`-not-`0`) that a plausible-looking implementation would get wrong.
>
> ---
>
> **Review this feature specification. Reply with SPEC_APPROVED to begin execution.** DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
