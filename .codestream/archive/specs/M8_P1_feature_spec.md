# FEATURE SPECIFICATION: M8_P1 — Standalone calculators (brew-day measurement & conversion)

- **Milestone:** M8 (Standalone calculators)
- **Phase:** P1 of a proposed **two-phase** split — "Measure and convert, without a recipe". See §5 for the M8_P2 preview and §4 Deviation 1 for the split itself, which needs sign-off.
- **Depends on:** M7_P1 + M7_P2 (`.gsd/archive/specs/M7_P1_feature_spec.md`, `M7_P2_feature_spec.md`, both verification-clean 2026-08-14). This phase consumes `ConfigContext`, `useConfig()`, and the `formatGravity` / `formatTemperature` / `formatMass` / `formatVolume` / `formatHopMass` helper family exactly as M7 left them, and M3_P2's `strikeTemperatureC` / `infusionVolumeL`.
- **Layer:** New pure functions in `packages/calculations` + a new routed page in `apps/web`. **No database, no API endpoint, no migration, no `shared-types` change.**
- **Amended in place 2026-08-14** following a `/verify` FAIL (critic: 32 YES / 1 PARTIAL / 1 NO) that `/diagnose` classified as **two spec errors (cause 2), no implementation bug**. Changed: **AC-11** (Deviation 7), **AC-26** (Deviation 8), **AC-33** (Deviation 9, attribution only), plus a new **AC-35** and a new §1.3 *Amendment-pass modified files* table. **35 ACs.** All other ACs are byte-identical to the approved text and no AC was renumbered. Per the M2_P1 / M3_P1 / M3_P2 precedent this amendment requires **re-`SPEC_APPROVED`** at the halt gate before the follow-up `/execute` pass.

---

## Phase Summary

Every calculation this app performs today is reachable only *through a recipe*. To find out what temperature to strike at, a brewer must create a recipe, attach an equipment profile, attach a mash schedule, and read the number off the mash view. To correct a hydrometer reading taken at 30 °C, there is nowhere to go at all.

This phase adds a **Calculators** destination to the sidebar — a routed page, built on the same `Sidebar` / `TopBar` / `PageContainer` shell M5.5 established — carrying five working calculators:

| Calculator | Backing function | Status of the math |
|---|---|---|
| Strike water temperature | `strikeTemperatureC` (`mash.ts`) | **Already exists** (M3_P2). Thin UI wrapper only — the math is not re-implemented, re-derived, or copied. |
| Infusion (step-mash) volume | `infusionVolumeL` (`mash.ts`) | **Already exists** (M3_P2). Thin UI wrapper only. |
| Hydrometer temperature correction | `hydrometerCorrectedSg` (**new** `hydrometry.ts`) | New. Formula given verbatim in build-spec §3.5 — but with a unit-domain defect in the source that this spec resolves (Ambiguity 2). |
| Refractometer Brix → SG, with alcohol correction | `brixToSg`, `sgToBrix`, `refractometerFinalGravity` (**new** `hydrometry.ts`) | New. **The source build-spec gives no refractometer formula at all** — see Ambiguity 3 for the chosen published formulas and the executor's citation-verification duty. |
| Unit converters (gravity, colour, volume, weight, temperature, pressure) | `sgToPlato` / `platoToSg` / `sgToBrix` / `brixToSg`, `srmToEbc` / `ebcToSrm` / `srmToLovibond` / `lovibondToSrm`, `convertVolume`, `convertMass`, `celsiusToFahrenheit` / `fahrenheitToCelsius`, `psiToKpa` / `kpaToPsi` / `psiToBar` / `barToPsi` (**new** `pressure.ts`) | Almost entirely **already exists** across `units.ts` and `config.ts`. Only the pressure family and Brix are new. |

The roadmap's verification threshold for this milestone is not "the calculators work" — it is that **every calculator's output is produced by a function that is also reachable from the recipe/batch path, asserted by import graph, not convention**, and that a duplicated formula in a calculator is a milestone failure. That threshold is made mechanically checkable here by a dedicated static-analysis test file (AC-23 … AC-27), not by prose.

Deliberately **not** in this phase: pitch rate, the Braukaiser starter-growth table, hop alpha-acid decay, gravity correction (DME/water), and priming/force carbonation — all four are M8_P2 (§5).

---

## Key Behaviors

1. **A Calculators page exists and is reachable in two clicks from anywhere.** New `calculators` sidebar destination, new `calculators` route, rendered through the existing `TopBar` + `PageContainer` shell. No recipe, batch, equipment profile, or mash schedule is required to use any calculator on it.
2. **Nothing on this page reads or writes stored data.** The page issues **zero** `GET`/`POST`/`PUT`/`PATCH`/`DELETE` requests of its own. Calculator state is local `useState` and is discarded on navigation. The only network traffic while it is mounted is `ConfigProvider`'s one pre-existing app-mount `GET /api/config`.
3. **Outputs honour the user's unit and formula settings.** Every rendered *result* goes through an M7 `format*` helper keyed off `useConfig().config`, so a temperature reads `78.1 °C` or `172.6 °F`, a volume `4.8 L` or `1.26 gal`, a gravity `1.048` or `12.0 °P`, exactly as everywhere else in the app.
4. **Inputs stay canonical-metric and are explicitly labelled as such.** Every `<input>` on this page accepts and holds a metric/SG value with its unit stated in the label (`Grain weight (kg)`, `Target mash temperature (°C)`). This is M7_P2 Resolved Ambiguity 1's boundary held unchanged repo-wide — and it is the one genuinely uncomfortable consequence of it, so it is raised for sign-off at the halt gate (§4 Deviation 2).
5. **One formula, one home.** No calculator component contains arithmetic. Each imports its function from `@truchabrew/calculations` and renders the result. `strikeTemperatureC` has exactly one definition in the repository and the Calculators page calls *that* one — the same function object `calculateMashPlan` calls (AC-25, AC-27).
6. **Degenerate input never renders garbage.** An empty or unparseable field yields the em-dash `"—"`, never `NaN`, never `0`, never a stale previous result presented as current.

---

## Resolved Ambiguities (Binding)

### 1. Which calculators are "already built" — and what a "thin wrapper" is allowed to do

Two of this phase's five calculators (strike water, infusion volume) and four of the six converter families are backed by **already-shipped, already-verified** functions. A "thin wrapper" for these means, exhaustively: collect field values, `Number.parseFloat` them, call the imported function once, format the returned number through an M7 helper, render it. A wrapper may **not**: re-derive a value the function already returns, apply a correction/offset/clamp to the function's return, pre-transform an argument by anything other than parsing, or branch on unit system before the call.

*Reasoning:* this is the roadmap's "a duplicated formula in a calculator is a milestone failure" restated as a yes/no test. It also forecloses the tempting shortcut of "just inline the strike formula, it is two lines" — which is precisely the failure mode.

### 2. `hydrometerCorrection`'s parameters are named in °C but the polynomial is Fahrenheit-domain — **binding resolution: convert to °F internally**

Build-spec §3.5 gives:

```js
function hydrometerCorrection(readingSG, sampleTempC, calibrationTempC) {
  const c = (t) => 1.00130346 - 0.000134722124*t + 0.00000204052596*t**2 - 0.00000000232820948*t**3;
  return readingSG * (c(sampleTempC) / c(calibrationTempC));
}
```

The parameter names say Celsius. The polynomial is the standard published (Lyons) correction whose domain is **degrees Fahrenheit**. Both cannot be true, and the source's own parenthetical — *"(calibration temp usually 20°C/60°F)"* — shows the author held both units in mind at once.

**Decision:** `hydrometerCorrectedSg` takes Celsius (matching this codebase's canonical storage and every other temperature argument in `packages/calculations`) and converts to Fahrenheit **internally**, via the existing `celsiusToFahrenheit` export, before evaluating the polynomial.

*Evidence this is the correct reading, all independently recomputed while drafting this spec:*

- `c(60)` = `1.0000631327683198` — i.e. the polynomial is normalised to ≈1 at 60 **°F**, the hydrometer calibration standard. `c(20)` = `0.9994066` — normalised to nothing in particular.
- Physically, a sample read **warmer** than calibration must correct **upward** (warm wort is less dense, so the hydrometer under-reads). Feeding Celsius directly: `1.050` read at 30 °C against a 20 °C calibration returns **`1.0496100146314251`** — a *decrease*. Feeding Fahrenheit: **`1.0526044557208447`** — an increase of ~0.0026, matching published correction tables (~+0.003 at 86 °F).
- The Celsius-direct result is therefore not merely less accurate, it has the wrong sign. AC-6 pins `1.0496100146314251` as an explicit **negative control** that must NOT be produced.

*Consequence, binding:* `hydrometry.ts` performs no inline `t*9/5+32`; it imports `celsiusToFahrenheit` (§2.4).

### 3. The source specifies **no** refractometer formula — chosen published formulas, and the executor's citation duty

Build-spec §1.5 lists "Refractometer Brix → SG, with alcohol correction" as a required tool, and §3 never gives a formula for it. Three separate pieces of math are required and none is in the source. All three are pinned here:

**(a) Brix → SG (unfermented wort), binding:**
```
SG = 1 + ( B / (258.6 − (B / 258.2) × 227.1) )
```
Chosen because it is the most widely reproduced Brix→SG relation in homebrewing tooling and because it independently reproduces the textbook anchor: `brixToSg(12)` = `1.0483782421572725`, and 12 °Bx ≈ 1.048 is a value a brewer can check against any refractometer's own dual scale.

**(b) SG → Brix (the inverse), binding:**
```
°Bx = ((182.4601 × SG − 775.6821) × SG + 1262.7794) × SG − 669.5622
```
Round-trips to `12.00160085716334` from `brixToSg(12)` — within 0.002 °Bx, well inside AC-3's 0.02 tolerance.

**(c) Alcohol-corrected final gravity — Sean Terrill's published cubic, binding:**
```
FG = 1.0 − 0.0044993·Bi′ + 0.011774·Bf′ + 0.00027581·Bi′² − 0.0012717·Bf′²
         − 0.00000728·Bi′³ + 0.000063293·Bf′³
```
where `Bi′` and `Bf′` are the initial and final refractometer readings **after** division by the wort correction factor.

**(d) Wort correction factor (WCF), binding:** default **`1.04`**, user-overridable in the UI, applied as `B′ = B / wcf` to **both** readings before either (a) or (c) is evaluated. A refractometer reads sucrose; wort's other sugars refract slightly differently, and 1.04 is the conventional default divisor.

**Executor's citation duty — binding, and it overrides "make the test pass":** before implementing (c), verify these seven coefficients against Sean Terrill's published cubic. If any coefficient differs from what is written above, **stop and route to `/plan` per hard rule 4** — do not silently substitute the published value, and do not adjust the AC-7 pins to match your implementation. A spec whose pinned numbers were quietly re-derived from the code is exactly the audit-trail failure this project has hit before.

*Known limitation, disclosed not hidden:* Terrill's cubic is an empirical fit over fermented samples and does not degenerate cleanly at zero attenuation — `refractometerFinalGravity(12, 12, 1.0)` returns `1.040678704`, not the `1.0483782` that `brixToSg(12)` gives for the same reading. This is a property of the published formula, not an implementation defect. No AC asserts agreement at `Bf === Bi`; AC-9 asserts only that the case returns a finite number and does not throw.

### 4. Brix and Plato are **different scales** and must not be collapsed into one function

`packages/calculations/src/config.ts` already exports `sgToPlato` (M7_P1's cubic, coefficients `-668.96 / 1262.45 / -776.43 / 182.94`). Brix and Plato are numerically close but not identical: for `SG = 1.0483782`, `sgToPlato` returns `11.989424508775016` while `sgToBrix` returns `12.00160085716334`.

**Binding:** `sgToBrix` / `brixToSg` are new functions in `hydrometry.ts`. `sgToPlato` / `platoToSg` are **not modified, not re-implemented, and not aliased**. The unit-converter card's gravity row shows SG, °P and °Bx as three distinct outputs from the three distinct functions. AC-4 asserts the two values differ and that M7_P1's Plato coefficients appear in `config.ts` and nowhere else.

*Reasoning:* the cheap move is `sgToBrix = sgToPlato` on the grounds that they agree to ~0.01. That would make the refractometer calculator's OG silently disagree with its own printed °Bx input, and would put a second meaning on an approved M7 function.

### 5. Pressure conversion needs exactly **one** new constant

`KPA_PER_PSI = 6.894757293168361` (exact by definition of the pound-force per square inch). `bar` is derived as `kPa / 100` — exact, no second constant. `psiToBar(14.5)` = `0.9997398075094124`; `kpaToPsi(100)` = `14.503773773020923`.

*Reasoning:* M7_P2's Ambiguity 4 lesson — one constant per unit, in one file — applied preemptively. A separate `PSI_PER_BAR` constant would be a second, independently-driftable encoding of the same physical fact.

### 6. Where the new pure functions live, and what stays shut

Two new files: `packages/calculations/src/hydrometry.ts` and `packages/calculations/src/pressure.ts`. All new coefficients are **module-private** — nothing is added to `constants.ts`.

*Reasoning:* `packages/calculations/test/units.test.ts` contains an M3_P2 assertion that `constants.ts` exports **exactly 15 names**. Adding a constant there breaks a test belonging to a closed milestone. `carbonation.ts` already established the module-private-coefficient precedent (M5_P2 §4 deviation 5) for exactly this reason. `constants.ts` and `units.test.ts` are both on §1.4's Untouched list.

### 7. Degenerate input handling, and the no-leak rule

- An empty string, whitespace, or an unparseable field parses to `NaN`. The calculator passes `NaN` **through** to the pure function and renders whatever the M7 `format*` helper returns for it — which is the em-dash `"—"` (M7_P2 Ambiguity 10, unchanged).
- **No calculator may suppress, substitute, or default a missing input.** A blank grain-weight field must not become `0`, must not fall back to a previous value, and must not retain the last successfully computed result while showing new inputs. Zero is a legitimate typed value and formats normally (`0.0 L`), distinct from blank.
- **No calculator writes a placeholder into state.** Results are computed during render from the current field values; there is no result `useState`, so a stale result is structurally unrepresentable.

*Reasoning:* "retain prior state rather than leak a default placeholder" is the wrong default here — a calculator that keeps showing `78.1 °C` after you clear the grain weight is actively dangerous on brew day. The em-dash is the honest output. AC-20 and AC-21 assert both halves.

### 8. Rounding and precision on this page

Results are formatted by the M7 helpers at their existing default precisions (temperature 1 dp, volume 1 dp metric / 2 dp US-Imperial, mass 2 dp, gravity 3 dp SG / 1 dp °P). Gravity results from `hydrometerCorrectedSg` and `refractometerFinalGravity` render through `formatGravity`, so under `gravityUnit: 'plato'` they display in °P — converting **after** the full-precision correction, never before (M7_P1's round-once rule). Brix outputs render at **2 dp** with an explicit `°Bx` suffix; there is no `formatBrix` helper and none is added — Brix is not a `GravityUnit` in `UserConfig` (`'sg' | 'plato'` only) and must not become one in this phase.

---

## 1. Data Schema & Contracts

### 1.1 Database, API, shared types — no change

No migration, no endpoint, no type. `apps/api/**` and `packages/shared-types/**` are wholly on the Untouched guardrail list (§1.4, AC-29, AC-34).

### 1.2 New module-private constants

| File | Symbol | Value | Exported? |
|---|---|---|---|
| `hydrometry.ts` | `HYDRO_C0 … HYDRO_C3` | `1.00130346`, `0.000134722124`, `0.00000204052596`, `0.00000000232820948` | No |
| `hydrometry.ts` | `BRIX_DENOM_A`, `BRIX_DENOM_B`, `BRIX_DENOM_C` | `258.6`, `258.2`, `227.1` | No |
| `hydrometry.ts` | `SG_TO_BRIX_C3 … C0` | `182.4601`, `-775.6821`, `1262.7794`, `-669.5622` | No |
| `hydrometry.ts` | `TERRILL_*` (7 coefficients) | per Ambiguity 3(c) | No |
| `hydrometry.ts` | `DEFAULT_WORT_CORRECTION_FACTOR` | `1.04` | **Yes** — the UI's default field value must come from the calc package, not a hardcoded `1.04` in a component |
| `pressure.ts` | `KPA_PER_PSI` | `6.894757293168361` | No |

`constants.ts` gains nothing (Ambiguity 6).

### 1.3 Symbol Inventory

**New files — `packages/calculations`:**

| Path | Charge |
|---|---|
| `packages/calculations/src/hydrometry.ts` | `brixToSg`, `sgToBrix`, `hydrometerCorrectedSg`, `refractometerFinalGravity`, `DEFAULT_WORT_CORRECTION_FACTOR` (§2.1) |
| `packages/calculations/src/pressure.ts` | `psiToKpa`, `kpaToPsi`, `psiToBar`, `barToPsi` (§2.1) |
| `packages/calculations/test/hydrometry.test.ts` | AC-2 … AC-9, AC-11 |
| `packages/calculations/test/pressure.test.ts` | AC-10, AC-11 |

**New files — `apps/web`:**

| Path | Charge |
|---|---|
| `apps/web/src/pages/Calculators.tsx` | The route page. Renders `TopBar` (title `Calculators`, no actions) + `PageContainer` + the five cards. Holds **no** calculator state of its own. |
| `apps/web/src/components/calculators/CalculatorCard.tsx` | Shared presentational shell: titled bordered section (`border border-slate-800 rounded-xl`), a labelled-numeric-input helper, and a result row. Presentation only — no arithmetic, no `format*` call of its own. |
| `apps/web/src/components/calculators/StrikeWaterCalculator.tsx` | Wraps `strikeTemperatureC` |
| `apps/web/src/components/calculators/InfusionVolumeCalculator.tsx` | Wraps `infusionVolumeL` |
| `apps/web/src/components/calculators/HydrometerCalculator.tsx` | Wraps `hydrometerCorrectedSg` |
| `apps/web/src/components/calculators/RefractometerCalculator.tsx` | Wraps `brixToSg` + `refractometerFinalGravity` |
| `apps/web/src/components/calculators/UnitConverterCalculator.tsx` | Wraps the six converter families (§2.2) |
| `apps/web/test/Calculators.test.tsx` | AC-12 … AC-16, AC-19 … AC-22 |
| `apps/web/test/calculatorImportGraph.test.ts` | AC-23 … AC-27. `fs`-based static analysis; renders nothing |

**Modified files — permitted edits are exhaustive:**

| Path | Permitted edits — exhaustive |
|---|---|
| `packages/calculations/src/index.ts` | Add `export * from './hydrometry';` and `export * from './pressure';`. No existing line changes; the `./config` explicit-list block and its `kgToLb` collision note stay byte-identical. |
| `apps/web/src/components/Sidebar.tsx` | Exactly four edits, mirroring M7_P1's `settings` addition: add `'calculators'` to `NavDestination`; add `{ destination: 'calculators', label: 'Calculators' }` to `NAV_ITEMS` as the **8th and last** entry; add one `NAV_ICONS` entry (`Calculator` from `lucide-react`); add `'calculators'` to the `ActiveView` union. `activeDestinationFor` needs **no** new branch (its trailing `return view` already covers it) — adding one anyway is a violation. |
| `apps/web/src/App.tsx` | Add `'calculators'` to the `View` union; one `handleNavigate` branch; one `handleShowCalculators`-equivalent setter; one `if (view === 'calculators')` route block rendering `<Sidebar …/>` + `<Calculators />` in the same shape as the existing `settings` block; one import. **No** change to `ConfigProvider`/`CatalogContext` placement, to any recipe/batch/equipment handler, or to the scale modal. |
| `apps/web/test/Sidebar.test.tsx` | Assertions for the 8th nav item and its active state. No existing assertion deleted or weakened. |
| `apps/web/test/App.test.tsx` | Navigation-to-Calculators assertions (AC-19) and the lockstep test (AC-22). No existing assertion deleted or weakened. |

**Amendment-pass modified files (added 2026-08-14; permitted edits are exhaustive).** These four rows apply **only** to the follow-up `/execute` pass that implements the AC-11 / AC-26 / AC-33 / AC-35 amendments. Every other file in this spec — including all six new `apps/web` source files, both new `packages/calculations/src` modules, `App.tsx`, `Sidebar.tsx`, and the two `apps/web/test` files modified in the build pass — is **frozen** for that pass and must show an unchanged content hash. **No application source file changes in the amendment pass at all.**

| Path | Permitted edits — exhaustive |
|---|---|
| `packages/calculations/test/hydrometry.test.ts` | **Only** inside the `AC-11` describe block: (1) add the two missing observable pairs to the `cases` table — `brixToSg`/`sgToBrix` already present, plus `refractometerOriginalGravity (wortCorrectionFactor)` and **not** the `psiToKpa`/`kpaToPsi`/`psiToBar`/`barToPsi` rows, which already exist in the frozen `pressure.test.ts` — so the table holds **exactly the 10 hydrometry pairs** of AC-11(a)'s 14 (count corrected 2026-08-14 under hard rule 7; the four pressure pairs stay where they are and are **not** duplicated here); (2) add **one** new `it(...)` implementing AC-11(c)'s explicit excluded-pair assertion, with its §2.1-citing comment; (3) update the describe-block title to match AC-11's amended name. **No assertion outside the AC-11 block may be added, deleted, weakened, or reordered**, and no pinned numeric value anywhere in the file may change. |
| `apps/web/test/calculatorImportGraph.test.ts` | **Only** inside the `AC-26` describe block: (1) extend the `standaloneOnly` array to AC-26(a)'s eleven names; (2) extend the `mash.ts` assertion and the `convertVolume`/`convertMass` chain test into AC-26(b)'s seven-function, two-hop form, adding `convertHopMass`, `sgToPlato` and `celsiusToFahrenheit` and the `MashSection.tsx` hop-2 anchor; (3) add **one** new `it(...)` implementing AC-26(c)'s union/disjointness set assertions; (4) **delete** the `it('documents that srmToEbc currently has no recipe-path caller …')` test and its preceding disclosure comment block (lines ~285-302) — it is superseded by (a) and forbidden by AC-26(d); (5) update the describe-block title. **The AC-23, AC-24, AC-25 and AC-27 describe blocks are byte-frozen** — the amendment does not touch them, and AC-25's fourteen-name list is unchanged. |
| `.gsd/BUGS.md` | Append **one** new item per AC-35 (next free ID, expected `BUG-016`), status `LOGGED`. Append-only: no existing item's text, ID, or status is modified. |
| `.gsd/active/M8_P1_feature_spec.md` | This amendment itself (already applied). Not edited again by the executor. |

**Untouched (guardrail — AC-34).** No file below may have a changed content hash:

- `apps/api/**` in its entirety, and `packages/shared-types/**` in its entirety.
- `packages/calculations/src/constants.ts`, `units.ts`, `config.ts`, `brewingMath.ts`, `mash.ts`, `scaling.ts`, `water.ts`, `carbonation.ts`, `batchPipeline.ts`, `batchClosing.ts`, `fermentation.ts`, `chronology.ts` — **every** `src/*.ts` except the two new files and `index.ts`.
- `packages/calculations/test/**` except the two new test files. `units.test.ts` in particular (its closed-15 assertion, Ambiguity 6) and `mash.test.ts`.
- `apps/web/src/**` except `App.tsx`, `Sidebar.tsx`, and the six new files. Specifically: `StatsHeader.tsx`, `MashSection.tsx`, `HopSection.tsx`, `FermentableSection.tsx`, every `*Form.tsx` / `*Manager.tsx`, `TopBar.tsx`, `PageContainer.tsx`, `ListRow.tsx`, `pages/BatchDetail.tsx`, `pages/BatchList.tsx`, `context/ConfigContext.tsx`, `context/CatalogContext.tsx`, `api/client.ts`, `hooks/useRecipeEditor.ts`, `utils/srmColor.ts`.
- Every `apps/web/test/*` except `Sidebar.test.tsx`, `App.test.tsx`, and the two new test files.

**Amendment reaffirmation (2026-08-14, Deviation 8):** `packages/calculations/src/brewingMath.ts` **remains on this Untouched list**, unchanged by the amendment. The rejected alternative — relaxing this list so `brewingMath.ts:289` could be changed to call `srmToEbc(srm)` — is stated in full in §4 Deviation 8 and is the thing to overrule at the halt gate if you disagree. `units.ts`, `constants.ts` and `config.ts` likewise remain untouched: AC-26(b)'s new hop-1 assertions **read** `config.ts` and **assert nothing about editing it**.

---

## 2. Transformations & Pure Logic

### 2.1 Pure function contracts

```typescript
// packages/calculations/src/hydrometry.ts
export const DEFAULT_WORT_CORRECTION_FACTOR = 1.04;

export function brixToSg(brix: number): number;
export function sgToBrix(sg: number): number;

export interface HydrometerCorrectionInput {
  readingSg: number;
  sampleTempC: number;
  calibrationTempC: number;   // no default — the caller states it explicitly
}
export function hydrometerCorrectedSg(input: HydrometerCorrectionInput): number;

export interface RefractometerInput {
  initialBrix: number;
  finalBrix: number;
  wortCorrectionFactor: number;   // no default — caller passes DEFAULT_WORT_CORRECTION_FACTOR
}
export function refractometerOriginalGravity(input: RefractometerInput): number;
export function refractometerFinalGravity(input: RefractometerInput): number;

// packages/calculations/src/pressure.ts
export function psiToKpa(psi: number): number;
export function kpaToPsi(kpa: number): number;
export function psiToBar(psi: number): number;
export function barToPsi(bar: number): number;
```

**Binding behaviour — no latitude:**

| Function | Returns |
|---|---|
| `brixToSg(b)` | `1 + b / (258.6 − (b / 258.2) × 227.1)` |
| `sgToBrix(sg)` | `((182.4601·sg − 775.6821)·sg + 1262.7794)·sg − 669.5622` |
| `hydrometerCorrectedSg` | `readingSg × c(F(sampleTempC)) / c(F(calibrationTempC))`, where `F` is the **imported** `celsiusToFahrenheit` and `c` is the §1.2 cubic |
| `refractometerOriginalGravity` | `brixToSg(initialBrix / wortCorrectionFactor)` — delegates, no second Brix→SG path |
| `refractometerFinalGravity` | Terrill's cubic (Ambiguity 3c) over `initialBrix / wcf` and `finalBrix / wcf` |
| `psiToKpa(p)` | `p × KPA_PER_PSI` |
| `kpaToPsi(k)` | `k / KPA_PER_PSI` |
| `psiToBar(p)` | `psiToKpa(p) / 100` — delegates, no second psi factor |
| `barToPsi(b)` | `kpaToPsi(b × 100)` — delegates |

**No clamping anywhere.** These are converters over a physically meaningful domain; an out-of-domain input returns the formula's own out-of-domain answer (possibly negative), exactly as `forceCarbonationPsi` already does. The only guards are the non-finite passthroughs below.

### 2.2 The unit-converter card's family map

One card, six rows. Each row: one metric/canonical `<input>`, N read-only converted outputs.

| Row | Input | Outputs | Functions (all pre-existing except Brix/pressure) |
|---|---|---|---|
| Gravity | SG | °P, °Bx | `sgToPlato`, `sgToBrix` |
| Colour | SRM | EBC, °L | `srmToEbc`, `srmToLovibond` |
| Volume | L | US gal, imp gal | `convertVolume(l,'us')`, `convertVolume(l,'imperial')` |
| Weight | kg | lb, oz | `convertMass(kg,'us')`, `convertHopMass(kg × 1000, 'us')` — see below |
| Temperature | °C | °F | `celsiusToFahrenheit` |
| Pressure | psi | kPa, bar | `psiToKpa`, `psiToBar` |

**Binding on the weight row:** the g→oz path goes through `convertHopMass`, and the `× 1000` kg→g step is the **only** arithmetic permitted anywhere in a calculator component. It is permitted because it is a scale-prefix change, not a formula, and because introducing a `convertMass(kg,'us','oz')` overload would reopen an approved M7 signature. It is called out explicitly here so the import-graph test's banned-literal list (AC-24) can allow `1000` and nothing else.

### 2.3 No-match / fallback contracts

| Input to any §2.1 function | Return |
|---|---|
| `NaN` in any numeric argument | `NaN` (passthrough — these are converters, not formatters; M7_P2 Ambiguity 10) |
| `±Infinity` | the formula's own result, or `NaN`; **never** a thrown error and never a fabricated `0` |
| `wortCorrectionFactor === 0` | `NaN` (division), rendered as `"—"`. No guard, no substitution of the default |
| `0` (a finite typed zero) | the formula's own finite result — `brixToSg(0) === 1`, `psiToKpa(0) === 0` |

**Caller branching rules, binding:**

- A calculator component **must not** pre-check `Number.isFinite` before calling, and **must not** branch on the `"—"` sentinel afterwards. It parses, calls, formats, renders.
- A calculator component **must not** early-return a placeholder card body when a field is blank. The card renders in full with `"—"` in its result slot.
- `formatGravity` / `formatTemperature` / `formatVolume` / `formatMass` own the non-finite→em-dash decision (M7 contract, unchanged). Brix and pressure outputs, which have no M7 helper, apply the identical rule locally in `CalculatorCard`'s result renderer: **one** shared non-finite check in `CalculatorCard`, not one per calculator.

### 2.4 Stateful integration contract

1. `App.tsx` gains a `'calculators'` view. Navigating to it mounts `<Calculators />` inside the existing `Sidebar` + `PageContainer` shell. `ConfigProvider` placement is unchanged; `Calculators` sits beneath it and consumes `useConfig()`.
2. Each calculator component holds its **own** field state as strings (`useState<string>`), never as numbers — so a partially-typed `"1."` or a cleared field is representable. Parsing happens at call time.
3. **There is no result state.** Results are derived during render. A config change re-renders and re-derives; there is no effect, no memo invalidation concern, and no path by which a displayed result can belong to different inputs than the ones on screen.
4. **Lockstep:** a `unitSystem` / `temperatureUnit` / `gravityUnit` change via Settings updates **every** calculator card on the page in the same React commit, from the same context value — no remount, no refetch, no per-card config copy (AC-22).
5. **Zero writes.** No calculator calls `fetch`, `client.ts`, or any mutation. Mounting, using, and leaving the page issues no request beyond the app-mount `GET /api/config` that already exists (AC-21).
6. Navigating away and back **resets** every field to its initial value. Calculator input is deliberately not persisted — no `localStorage`, no lifted state in `App.tsx`.

### 2.5 Refactoring & legacy cleanup

- **No obsolete registration loop to purge, and none to create.** The five cards are rendered as explicit JSX children of `Calculators.tsx`, **not** driven by a `CALCULATORS` registry array. A registry is the natural-looking choice and is forbidden here: it forces a shared props shape across five calculators with genuinely different inputs, which is how a "just pass the values object" leak starts. `Calculators.tsx` therefore has no map, no config array, and no dynamic component lookup.
- **`activeDestinationFor` gains no branch** (§1.3) — its existing `return view` fallthrough already handles `'calculators'`. A redundant `if (view === 'calculators') return 'calculators';` is dead code and an AC-19 violation.
- **No inline unit math.** `hydrometry.ts` imports `celsiusToFahrenheit` rather than writing `t*9/5+32` (Ambiguity 2). `psiToBar` delegates to `psiToKpa` (Ambiguity 5). `refractometerOriginalGravity` delegates to `brixToSg`.
- **No new `format*` helper.** Brix and pressure render via `toFixed` inside `CalculatorCard`'s result renderer with an explicit unit string. Adding `formatBrix`/`formatPressure` to `config.ts` would touch a file on the Untouched list and imply a `UserConfig` field that does not exist (Ambiguity 8).

---

## 3. Acceptance Criteria & Test Matrix

Every pinned value below was computed from the §2.1 formulas while drafting this spec and re-verified before writing. Tolerances are stated per criterion; where a full-precision literal is given, the tolerance is `1e-9` unless stated.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | **New exports exist and are root-exported** | Unit | `brixToSg`, `sgToBrix`, `hydrometerCorrectedSg`, `refractometerOriginalGravity`, `refractometerFinalGravity`, `DEFAULT_WORT_CORRECTION_FACTOR`, `psiToKpa`, `kpaToPsi`, `psiToBar`, `barToPsi` are all importable from **`@truchabrew/calculations`'s package root** in one statement, type-check, and none is `undefined`. `DEFAULT_WORT_CORRECTION_FACTOR === 1.04` |
| **AC-2** | **`brixToSg` pinned** | Unit | `brixToSg(12)` = `1.0483782421572725`; `brixToSg(10)` = `1.0400313056593289`; `brixToSg(20)` = `1.0829844579302224`; `brixToSg(6)` = `1.023685205094429`; `brixToSg(0) === 1` **exactly** |
| **AC-3** | **`sgToBrix` pinned + round-trip** | Unit | `sgToBrix(1.048)` = `11.911555280179186`; `sgToBrix(1.05)` = `12.387028012500082`; `sgToBrix(1.012)` = `3.068185831852702`. `sgToBrix(brixToSg(12))` = `12.00160085716334`, i.e. within `0.02` of `12` |
| **AC-4** | **Brix ≠ Plato, and `sgToPlato` is not duplicated** | Unit + grep | `sgToBrix(1.05)` (`12.387028…`) and `sgToPlato(1.05)` (`12.374342…`) are **not equal**, and differ by less than `0.05`. A grep over `packages/calculations/src` for `1262.45` and `-668.96` matches **`config.ts` only**; a grep for `1262.7794` and `182.4601` matches **`hydrometry.ts` only**. `sgToPlato`/`platoToSg` have exactly one definition each, in `config.ts` |
| **AC-5** | **`hydrometerCorrectedSg` pinned (Fahrenheit-domain)** | Unit | `hydrometerCorrectedSg({readingSg:1.050, sampleTempC:30, calibrationTempC:20})` = `1.0526044557208447`; `{1.040, 10, 20}` = `1.0384745268783007`; `{1.060, 35, 20}` = `1.0643198454796021`; `{1.045, 28, 20}` = `1.0469929861440606`. **Identity:** `{1.050, 20, 20}` returns `1.05` exactly (ratio is exactly 1). **Direction:** warmer-than-calibration corrects **up**, cooler corrects **down**, asserted as inequalities not just values |
| **AC-6** | **Negative control: the Celsius-domain reading is not produced** | Unit | `hydrometerCorrectedSg({readingSg:1.050, sampleTempC:30, calibrationTempC:20})` is **not** `1.0496100146314251` (±`1e-9`) — the value the source's literal Celsius parameters would give (Ambiguity 2). Asserted explicitly so a "fix" that drops the °F conversion fails loudly rather than shifting a tolerance |
| **AC-7** | **Refractometer pinned, WCF applied to both readings** | Unit | With `initialBrix:12.5, finalBrix:6.5, wortCorrectionFactor:1.04` (so `Bi′` = `12.019230769230768`, `Bf′` = `6.25`): `refractometerOriginalGravity` = `1.0484590758592531` and `refractometerFinalGravity` = `1.0124896082770896`. With `wortCorrectionFactor:1` and `12/6`: OG = `1.0483782421572725`, FG = `1.0116792879999998`. Changing **only** `wortCorrectionFactor` from `1.04` to `1` changes **both** outputs (proving WCF is applied to both readings, not just the initial one) |
| **AC-8** | **The alcohol correction actually corrects** | Unit | For the AC-7 fixture, `refractometerFinalGravity` (`1.01248…`) is **strictly less** than the naive uncorrected `brixToSg(6.5/1.04)` = `1.0246935229673482`, by more than `0.010`. Derived plausibility from the AC-7 pair: ABV via `calculateAbvWithStrategy(og, fg, 'simple')` = `4.7209926201589685` (±`1e-9`) and apparent attenuation `(og−fg)/(og−1)×100` = `74.22648274728768` — both inside a plausible ale band, asserted as `>3.5 && <6` and `>65 && <85` respectively so the pin cannot be satisfied by an arbitrary number that happens to match |
| **AC-9** | **Refractometer degenerate cases** | Unit | `refractometerFinalGravity({12,12,1})` returns a **finite** number (`1.040678704`) and does not throw — the published cubic does not degenerate to OG at zero attenuation, and no code compensates for that (Ambiguity 3). `{0,0,1}` returns finite `1`. `wortCorrectionFactor: 0` returns `NaN` for both OG and FG (no guard, no default substitution) |
| **AC-10** | **Pressure converters pinned, single constant** | Unit + grep | `psiToKpa(14.5)` = `99.97398075094124`; `psiToKpa(12)` = `82.73708751802033`; `psiToBar(14.5)` = `0.9997398075094124`; `kpaToPsi(100)` = `14.503773773020923`. Round-trips: `kpaToPsi(psiToKpa(14.5))` and `barToPsi(psiToBar(14.5))` each return `14.5` within `1e-9`. `psiToKpa(0) === 0` exactly. A grep over `packages/calculations/src` for `6.894757` matches **`pressure.ts` only, exactly once**; the literals `14.5037`, `0.0689`, and `6894` appear **nowhere** in `src` |
| **AC-11** | **Non-finite passthrough across every new pure function, over each function's structurally observable arguments** | Unit | **(Amended 2026-08-14 — Deviation 7. Supersedes the original wording, which ranged over every declared interface field and was therefore unsatisfiable for one function/argument pair; see §4 Deviation 7 for the full reasoning.)** <br><br>**(a) Observable-argument derivation rule, binding.** An argument is *structurally observable* by a function when §2.1's binding-behaviour row for that function names it on the right-hand side. Derived mechanically from §2.1, the observable sets are: `brixToSg` → `{brix}`; `sgToBrix` → `{sg}`; `hydrometerCorrectedSg` → `{readingSg, sampleTempC, calibrationTempC}` (all three); `refractometerOriginalGravity` → `{initialBrix, wortCorrectionFactor}` (**two of three** — §2.1 binds it to `brixToSg(initialBrix / wortCorrectionFactor)`, which never reads `finalBrix`); `refractometerFinalGravity` → `{initialBrix, finalBrix, wortCorrectionFactor}` (all three); `psiToKpa` → `{psi}`; `kpaToPsi` → `{kpa}`; `psiToBar` → `{psi}`; `barToPsi` → `{bar}`. **14 pairs in total** (1+1+3+2+3+1+1+1+1). *(Count corrected 2026-08-14 under hard rule 7 — the drafted text read "21", which no combination of §2.1's signatures can produce; the itemized derivation above is authoritative and is unchanged. Sixth AC-11-specific spec-arithmetic slip this project has caught — see the note at the end of Deviation 7.)* **Distribution across files, binding:** the four pressure pairs are **already** asserted in `packages/calculations/test/pressure.test.ts`'s own `AC-11` block, which is **frozen** and not on §1.3's Amendment-pass table; the remaining **10** pairs belong to `hydrometry.test.ts`'s table. AC-11 is satisfied by the two files **collectively** — do not duplicate the pressure rows into `hydrometry.test.ts` to reach a single-file count <br><br>**(b) Passthrough requirement.** For **every** (function, observable-argument) pair in (a): passing `NaN` as that argument, with every other argument finite and in-domain, returns `NaN` (`Number.isNaN` true), does not throw, and returns neither `0` nor `undefined`. Table-driven, one row per pair, so that (i) a tenth function added later without a passthrough fails, and (ii) **`refractometerFinalGravity` — which observes all three fields — still fails this criterion if it ever stops propagating a `NaN` from any one of them.** This is a *derivation*, not a relaxation: nothing is excluded except where §2.1's own delegation contract makes observation structurally impossible. <br><br>**(c) The excluded pair is enumerated as an excluded pair, not omitted.** The test table must contain an explicit, labelled entry for `refractometerOriginalGravity` / `finalBrix` asserting the **opposite** of (b): `refractometerOriginalGravity({initialBrix: 12, finalBrix: NaN, wortCorrectionFactor: 1.04})` returns a **finite** number, equal to `brixToSg(12 / 1.04)` = `1.046441535179445` (±`1e-9`), carrying an inline comment citing §2.1's delegation row as the reason. Silently dropping the row from the table (as the pre-amendment implementation did at `packages/calculations/test/hydrometry.test.ts:174-197`) does **not** satisfy this criterion — the exclusion must be visible and asserted, so that a future change making `refractometerOriginalGravity` observe `finalBrix` breaks this row loudly rather than passing unnoticed |
| **AC-12** | **Strike-water card computes via the recipe path's own function** | Component | On the Calculators page, entering target `67`, grain temp `20`, water `15`, grain `5`, tun heat capacity `1.5` renders `78.1 °C` under `temperatureUnit: 'celsius'` and `172.6 °F` under `'fahrenheit'` (`78.12333333333333` formatted at 1 dp; `172.62200000000001` → `172.6`). The rendered value equals `formatTemperature(strikeTemperatureC({…}), unit)` computed independently in the test from the imported function |
| **AC-13** | **Infusion-volume card** | Component | Entering grain `5`, current `67`, target `72`, infusion water `95`, current mash volume `20` renders `4.8 L` under `'metric'` (`4.782608695652174` at 1 dp) and `1.26 gal` under `'us'` (2 dp). Entering a target **below** the current temperature renders `0.0 L` — the function's own documented guard, surfaced unmodified, not a UI-level branch |
| **AC-14** | **Hydrometer card** | Component | Entering reading `1.050`, sample `30`, calibration `20` renders `1.053` under `gravityUnit: 'sg'` (`1.0526044557208447` at 3 dp) and `13.0 °P` under `'plato'` (`sgToPlato(1.05260445…)` = `13.0186…` at 1 dp). The calibration field defaults to `20` |
| **AC-15** | **Refractometer card** | Component | Entering initial `12.5`, final `6.5` with the WCF field at its default renders OG `1.048` and FG `1.012` under `'sg'`. The WCF field's initial value is `1.04` and comes from `DEFAULT_WORT_CORRECTION_FACTOR` (asserted by the import-graph test's banned-literal sweep finding no `1.04` in the component). Changing WCF to `1` changes both displayed gravities |
| **AC-16** | **Unit-converter card: all six rows** | Component | Entering SG `1.05` renders `12.4 °P` and `12.39 °Bx`; SRM `10` renders `19.70 EBC` and `7.94 °L`; volume `20 L` renders `5.28 gal` and `4.40 imp gal`; weight `5 kg` renders `11.02 lb` and `176.37 oz`; temperature `20 °C` renders `68.0 °F`; pressure `14.5 psi` renders `99.97 kPa` and `1.00 bar`. All six rows are present in one card |
| **AC-17** | **Outputs honour the config; a settings change is visible on this page** | Component | The full rendered text of the Calculators page under `unitSystem:'metric', temperatureUnit:'celsius'` versus `unitSystem:'us', temperatureUnit:'fahrenheit'` differs in at least the strike-temperature and infusion-volume results, with the metric render containing `78.1 °C` / `4.8 L` and the US render containing `172.6 °F` / `1.26 gal`. Neither render contains the string `NaN` |
| **AC-18** | **Inputs stay canonical-metric and say so** | Component | Under `unitSystem: 'us'`: the strike card's water-volume `<input>` still holds `15` (not `3.96`), and its label text contains `(L)`; the grain-weight input holds `5` and its label contains `(kg)`; the target-temperature input's label contains `(°C)`. Every `<input>` on the page has a label whose text contains an explicit unit token from the set `{(L), (kg), (°C), (SG), (°Bx), (SRM), (psi), (ratio)}`. Typing into any input never converts the typed value |
| **AC-19** | **Reachable via the sidebar, on every route** | Component (`Sidebar.test.tsx`, `App.test.tsx`) | `NAV_ITEMS` has **8** entries, the 8th being `{destination:'calculators', label:'Calculators'}`. Clicking it from the recipe list, from Batches, and from Settings each lands on the Calculators page (`TopBar` title `Calculators`), with the Calculators nav item carrying `aria-current="page"`. `activeDestinationFor('calculators')` returns `'calculators'` **without** a dedicated branch existing in the source (§2.5) |
| **AC-20** | **Degenerate/empty inputs render the em-dash, never `NaN` or `0`** | Component | Clearing the strike card's grain-weight field renders `—` in its result slot — **not** `NaN`, **not** `0.0 °C`, and **not** the previously computed `78.1 °C`. Same for a whitespace-only and an alphabetic entry. Typing a literal `0` into that field renders the function's real answer for zero grain (`67.0 °C`, the documented `grainWeightKg <= 0` guard), proving blank and zero are distinguished |
| **AC-21** | **No writes, no persistence, no leaked placeholder** | Component/Integration | Mounting the Calculators page, filling every field, and navigating away issues **zero** `fetch` calls with method `POST`/`PUT`/`PATCH`/`DELETE`, and no `GET` other than the app-mount `/api/config`. `localStorage.setItem` is never called. Navigating away and back renders every field at its initial value and every result slot at `—`. No component under `components/calculators/` contains a `useState` holding a computed result (asserted by AC-23's source scan for `setResult`/`useEffect`) |
| **AC-22** | **Lockstep: one config change updates every card in one commit** | Integration (`App.test.tsx`) | With the app mounted on the Calculators page and `GET /api/config` resolved to `metric`/`celsius`, the strike card shows `78.1 °C` and the volume converter row shows `20.0 L`. After `applyConfig` sets `us`/`fahrenheit` (no remount, no navigation, no reload), **both** update in the same pass (`172.6 °F`, `5.28 gal`), and `GET /api/config` has still been called exactly **once** in total |
| **AC-23** | **Import graph: calculators import only from the calc package** | Static (`calculatorImportGraph.test.ts`) | For every file under `apps/web/src/components/calculators/` plus `apps/web/src/pages/Calculators.tsx`: every `import … from '<spec>'` specifier is in the closed allowlist `{'react', 'lucide-react', '@truchabrew/calculations', '@truchabrew/shared-types', '../../context/ConfigContext', '../PageContainer', '../TopBar', './CalculatorCard'}` plus sibling paths inside `components/calculators/`. **No** relative import escapes to `../../utils`, `../../api`, `../../hooks`, or reaches into `packages/`. Every name imported from `@truchabrew/calculations` in those files resolves to a defined member of the package root namespace |
| **AC-24** | **Import graph: no duplicated formula — banned-literal sweep** | Static (`calculatorImportGraph.test.ts`) | The concatenated source of the files in AC-23's set contains **none** of: `0.41`, `1.00130346`, `0.000134722124`, `258.6`, `258.2`, `227.1`, `182.4601`, `1262.7794`, `0.0044993`, `0.011774`, `6.894757`, `1.3546`, `1.97`, `0.264172`, `0.219969`, `2.20462`, `28.3495`, `131.25`, `1262.45`, `668.96`, `1.04`. The **only** permitted numeric literals in those files are `0`, `1`, `2`, `3`, `100`, and `1000` (§2.2's kg→g step), plus values inside `className` strings; the test asserts every other numeric literal token is absent. `Math.pow`, `Math.exp`, and `**` appear **zero** times |
| **AC-25** | **Import graph: one definition per formula, repo-wide** | Static (`calculatorImportGraph.test.ts`) | For each of `strikeTemperatureC`, `infusionVolumeL`, `brixToSg`, `sgToBrix`, `hydrometerCorrectedSg`, `refractometerFinalGravity`, `sgToPlato`, `srmToEbc`, `srmToLovibond`, `convertVolume`, `convertMass`, `convertHopMass`, `celsiusToFahrenheit`, `psiToKpa`: the count of `export function <name>` across all of `packages/calculations/src/**` and `apps/web/src/**` is **exactly 1**, and that one is under `packages/calculations/src/` |
| **AC-26** | **Import graph: every calculator-backing function is classified, and the classification is a closed partition** | Static (`calculatorImportGraph.test.ts`) | **(Amended 2026-08-14 — Deviation 8. Supersedes the original wording, which asserted a recipe-path caller for `srmToEbc` and — by omitting it from the standalone set — implicitly for `srmToLovibond`; neither caller exists. See §4 Deviation 8.)** <br><br>**(a) Standalone-only set — exactly eleven.** The calculator-backing functions with **no** recipe/batch-path caller are asserted to be **exactly** `{brixToSg, sgToBrix, hydrometerCorrectedSg, refractometerOriginalGravity, refractometerFinalGravity, psiToKpa, kpaToPsi, psiToBar, barToPsi, srmToEbc, srmToLovibond}`. For each, the test asserts its name appears as a call site **nowhere** in `packages/calculations/src/*.ts` outside its own defining module and `index.ts`, and nowhere in `apps/web/src/**` outside `components/calculators/`. `srmToEbc` and `srmToLovibond` join this set because `brewingMath.ts` calls neither: it computes `const ebc = srm * SRM_TO_EBC` inline at `brewingMath.ts:289` and performs no Lovibond computation at all (both conditions **predate M8_P1**; see Deviation 8 and `.gsd/BUGS.md` BUG-016, logged under AC-35). <br><br>**(b) Recipe-path-caller set — exactly seven, each positively asserted.** This is where the criterion's detection power lives. Each of the following must be asserted **present**, and each assertion must fail if that single call site is removed: <br>• `strikeTemperatureC` and `infusionVolumeL` — called by name inside `packages/calculations/src/mash.ts`'s `calculateMashPlan`. <br>• `convertVolume`, `convertMass`, `convertHopMass`, `sgToPlato`, `celsiusToFahrenheit` — reached over the **two-hop chain** the M7 helpers establish, asserted at **both** hops: hop 1, each is called by name inside its M7 helper in `packages/calculations/src/config.ts` (`formatVolume`→`convertVolume`, `formatMass`→`convertMass`, `formatHopMass`→`convertHopMass`, `formatGravity`→`sgToPlato`, `formatTemperature`→`celsiusToFahrenheit`); hop 2, that helper is called by a recipe-path component on §1.4's Untouched list (`formatVolume`/`formatMass`/`formatHopMass`/`formatGravity` in `apps/web/src/components/StatsHeader.tsx`; `formatTemperature` in `apps/web/src/components/MashSection.tsx`). Asserting both hops is what makes the chain a detector rather than a formality — breaking *either* hop fails. <br><br>**(c) Closure — the partition is total and disjoint.** The union of (a) and (b) must equal **exactly** AC-25's fourteen-name list plus the four names AC-25 does not enumerate (`refractometerOriginalGravity`, `kpaToPsi`, `psiToBar`, `barToPsi`) — **eighteen names, 11 + 7** — and the intersection of (a) and (b) must be **empty**, asserted as set operations in the test. **This is the clause that prevents the allowlist from absorbing failures:** a function cannot be quietly dropped from (b) without being added to (a), and adding it to (a) immediately fails (a)'s own no-caller sweep for as long as any caller remains, or — once the caller is genuinely gone — surfaces the loss as a visible, reviewable edit to the standalone list rather than a silent test deletion. Worked example, binding as an interpretation aid: if `strikeTemperatureC` lost its `mash.ts` call site, (b) fails immediately; moving it to (a) to make (b) pass leaves (c) satisfied but records the regression as an explicit spec-level change to the standalone allowlist, which `/verify`'s critic layer audits against this spec. If `convertVolume` lost its `StatsHeader.tsx` consumer, (b)'s hop-2 assertion fails even though hop 1 still passes. <br><br>**(d) No negation tests.** No assertion in this AC's block may take the form of asserting the *absence* of a caller for a function in (b), nor assert `expect(<callsX>).toBe(false)` as a stand-in for a requirement in (b). Recording a condition is not detecting it |
| **AC-27** | **Runtime identity: the calculator's number is the recipe path's number** | Unit/Integration | For a recipe whose mash profile's first step is `67 °C`, `grainTemperatureC` `20`, computed `strikeWaterL` `W`, total grain `G`, `mashTunHeatCapacityL` `M`: `calculateMashPlan(recipe).strikeTemperatureC` **strictly equals** `strikeTemperatureC({targetMashTempC:67, grainTemperatureC:20, waterVolumeL:W, grainWeightKg:G, mashTunHeatCapacityL:M})` — no tolerance, exact `===`. Asserted against the imported symbol the Calculators page uses, closing the roadmap's threshold by execution as well as by static analysis |
| **AC-28** | **`constants.ts` closed-15 assertion still holds** | Unit (existing) | `packages/calculations/test/units.test.ts`'s M3_P2 AC-4 test still passes unmodified: `constants.ts` exports exactly 15 names. Both new modules' coefficients are module-private (Ambiguity 6). `units.test.ts`'s content hash is unchanged |
| **AC-29** | **No API, schema, or shared-types change** | Verification | `apps/api/**` and `packages/shared-types/**` have zero changed content hashes. No new migration file exists. `GravityUnit` remains `'sg' \| 'plato'` — Brix is not added to it |
| **AC-30** | **Test gate** | Command | `npm test` exits **0** across all four workspaces, with **0** failures and no reduction in the passing count relative to the M7_P2 close baseline (**1126 passed / 2 skipped**) |
| **AC-31** | **Typecheck gate** | Command | `npm run typecheck` exits **0**, and the run demonstrably **reaches all four projects** (not short-circuited by an early `&&` failure) |
| **AC-32** | **Build gate** | Command | `npm run build` exits **0** |
| **AC-33** | **Lint gate** | Command | `npm run lint` exits **0**, introducing no new warning beyond the three pre-existing `react(only-export-components)` warnings. **(Attribution corrected 2026-08-14 — Deviation 9. The count of three is unchanged; the original wording named the wrong three files.)** The three are: `apps/web/src/context/ConfigContext.tsx` **×2** (lines 112 and 120) and `apps/web/src/context/CatalogContext.tsx` **×1** (line 47). `apps/web/src/components/Sidebar.tsx` emits **no** warning — its `only-export-components` occurrence is suppressed by a pre-existing `// oxlint-disable-next-line react/only-export-components` at `Sidebar.tsx:27`, which §1.3's Sidebar edit list does not permit removing |
| **AC-34** | **Scope guardrail** | Manifest Diff | §1.3's New + Modified tables are the complete set of files that may change. Verified by a SHA-256 content manifest captured **before the executor's first edit** and again at the end — `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum` — written to `.gsd/active/M8_P1_pre_exec_manifest.txt` and `.gsd/active/M8_P1_post_exec_manifest.txt` and diffed. **`git diff --name-only` against a base commit is NOT usable in this repository and must not be substituted:** `git rev-list --count HEAD` is `1`, the sole commit (`7d88e64`) predates M1–M7, and no commit represents this phase's starting state — the same finding M4_P1's AC-7, M7_P1's AC-28 and M7_P2's AC-24 each recorded. Every path whose hash changed must appear in §1.3's tables; every §1.3 "Modified" path must actually have changed; **no path on §1.4's Untouched list may have changed**. Any deviation is disclosed in §4 before verification, not after. **(Amendment-pass note, 2026-08-14:** the amendment `/execute` pass captures its **own** fresh pre/post manifest pair — `M8_P1_amend_pre_exec_manifest.txt` / `M8_P1_amend_post_exec_manifest.txt` — taken before its first edit and again at the end. The original pair is retained unmodified as the record of the build pass. The amendment pass's permitted change set is §1.3's four **Amendment-pass modified files** rows and nothing else.**)** |
| **AC-35** | **The `brewingMath.ts:289` inline EBC duplication is logged, not lost** | Verification (amendment pass only) | **(Added 2026-08-14 — Deviation 8.)** `.gsd/BUGS.md` contains a new item **BUG-016** with status `LOGGED` (`.gsd/BUGS.md` currently holds fifteen items, `BUG-001` … `BUG-015`; `BUG-016` is the next free ID — the executor re-checks the highest existing ID before writing and uses the true successor rather than assuming `016`), recording: that `packages/calculations/src/brewingMath.ts:289` computes `const ebc = srm * SRM_TO_EBC` inline instead of calling `srmToEbc`; that `packages/calculations/src/units.ts:33`'s `srmToLovibond` likewise has no recipe-path caller because `brewingMath.ts` performs no Lovibond computation; that **both** call sites resolve to the same shared `SRM_TO_EBC = 1.97` / `LOVIBOND_*` constants in `constants.ts`, so this is a **call-site inconsistency and not a second source of truth** — and BUG-016 is cross-referenced from AC-26(a) by ID (no drift risk — the severity note is part of the required content, so a later reader does not over-triage it); and that the fix belongs to a later phase whose Untouched list permits editing `brewingMath.ts`, which M8_P1's does not. No other `.gsd/BUGS.md` item's status is changed. No file under `packages/calculations/src/` changes as a result of this AC |

---

## 4. Deviation Register

### Deviation 1 — Milestone 8 is split into two phases

**Status: needs sign-off. This is the split itself, flagged per the M3/M5.5/M7 precedent.**

The roadmap describes Milestone 8 as one slice covering nine calculators plus the unit converters. Delivered as one phase that would mean, in a single spec: five new pure-function families (refractometer, hydrometer, pitch rate, Braukaiser starter interpolation, hop decay, gravity correction), two of which (Braukaiser, hop decay) have **no formula in the source document at all**, plus nine UI surfaces plus the import-graph guardrail — realistically 55+ acceptance criteria against a background where three of this project's last four multi-formula phases needed a `/diagnose` cycle over an underdetermined formula.

**Proposed split, each half a complete vertical slice:**

- **M8_P1 (this spec)** — "Measure and convert, without a recipe": the Calculators page and shell, strike water, infusion volume, hydrometer correction, refractometer, and all six unit-converter families. Shippable and useful on its own: the whole brew-day measurement toolkit.
- **M8_P2** — "Plan the pitch, package the beer": pitch rate + starter size (Braukaiser interpolation table), hop alpha-acid decay, gravity correction (DME/water/boil-time), priming sugar + force carbonation. Adds four cards to the page P1 built.

Neither half is a horizontal layer: P1 ships pure functions *and* their UI *and* their tests; P2 does the same. P1 does not leave a stub or a dead route behind.

*If overruled:* fold P2's four calculators into this phase, accepting a single ~60-AC spec. §5 has the P2 scope in enough detail to merge it in without redrafting from scratch.

### Deviation 2 — Calculator inputs remain metric-only, and this is more visible here than anywhere in M7

**Status: needs sign-off. Ambiguity/Key Behavior 4, guarded by AC-18.**

M7_P1 and M7_P2 both deliberately deferred **input-field** unit conversion, converting displays only. That boundary is held unchanged here — but it lands harder on this page than it did on any M7 surface. A US-configured brewer opening the strike-water calculator is asked to type litres and °C, and is then shown the answer in °F. Every other M7 surface at least had a stored metric recipe behind the input; here the user is typing from scratch, and the ask is unambiguous friction.

The honest options are (a) hold the boundary, label every input with its metric unit, and ship — one consistent repo-wide rule, zero risk to canonical storage; or (b) solve converted inputs now, which means parse-convert-store-reconvert round-tripping on every keystroke, with precision drift and cursor behaviour, i.e. the phase M7 twice declined to fold in.

**Recommendation: (a), plus scheduling a dedicated M8_P3 "type in your own units"** covering converted inputs across the calculators *and* the recipe/equipment forms together, with its own canonical-storage round-trip criteria — which is a strictly better outcome than solving it for five calculator cards only and leaving `EquipmentForm` metric.

*If overruled:* converted inputs are added to this phase's five cards with an explicit round-trip AC (`parse → convert to canonical → convert back → format` is stable to the displayed precision), and Deviation 2 is withdrawn.

### Deviation 3 — Three formulas are pinned from published sources outside the build spec

**Status: disclosed, intentional, guarded by AC-2 … AC-9 and the Ambiguity 3 citation duty.**

The source build-spec document specifies neither the Brix→SG relation, its inverse, nor any alcohol-corrected FG formula, despite §1.5 requiring the refractometer tool. Ambiguity 3 pins all three explicitly (with the anchor `brixToSg(12) = 1.0483782…` independently confirming the first against a value any dual-scale refractometer displays), and requires the executor to verify Terrill's seven coefficients against the published source and **stop rather than adjust** on any mismatch.

This is the same situation M7_P1 hit with Garetz — and the countermeasure is deliberately different. Garetz shipped as an executor-authored approximation behind a disclosure comment. Here the formulas are pinned in the spec, numerically, before any code exists, so "does the implementation match the approved spec" is answerable without re-litigating the literature.

### Deviation 4 — `hydrometry.ts` deviates from the source's literal parameter units

**Status: disclosed, intentional, guarded by AC-5 and AC-6 (negative control).**

Build-spec §3.5's `hydrometerCorrection` names its parameters `sampleTempC`/`calibrationTempC` while its polynomial is Fahrenheit-domain. Implementing the source literally produces a correction with the **wrong sign** (a warm sample reading *lower*), demonstrated numerically in Ambiguity 2. This spec deviates from the source's literal text and pins the rejected value as an explicit negative control.

Recorded as a deviation because this project has now found the same class of defect in build-spec §3.5 twice — the strike-temperature formula in M3_P2 was the first, and it cost a full `/diagnose` cycle plus a spec amendment. **§3.5 should be treated as the least reliable section of the source document.**

### Deviation 5 — Priming/force carbonation is a *wrapper*, and it lands in P2 rather than P1

**Status: disclosed.**

The roadmap lists priming/force carbonation among Milestone 8's calculators, and its hardening scope names "remaining build-spec §3 functions" — but `primingSugarG`, `residualCO2Volumes` and `forceCarbonationPsi` were already promoted into `packages/calculations/src/carbonation.ts` under test during **M5_P2**. There is no new math; M8 owes only a standalone UI entry point. It is placed in P2 because it groups naturally with packaging rather than with brew-day measurement, not because it is harder. The same is true of strike water and infusion volume (M3_P2), which this phase wraps without touching `mash.ts`.

### Deviation 6 — No open `BUGS.md` / `FEATURES.md` item is folded in

**Status: disclosed, no status changes made.**

`.gsd/BUGS.md` holds eleven items, all `VERIFIED_RESOLVED`; none concerns calculators. `.gsd/FEATURES.md` holds five `LOGGED` items and none is in scope: FEAT-001 (mash-pH calculator modal) is a **recipe-editor** water-chemistry surface calling `water.ts`, i.e. an M6 follow-on rather than a standalone calculator, and folding it in would pull acid-neutralisation math and a recipe-mutating "Add Acid to Recipe" action into a phase that otherwise writes nothing; FEAT-002/003 are batch and equipment-profile work; FEAT-004/005 are app-wide form-design overhauls that would collide directly with this phase's Untouched list. **No item's status was changed to `IN_PLANNING`.** FEAT-005 is worth noting as adjacent: `CalculatorCard.tsx` deliberately follows its sectioned-container direction so a later FEAT-005 phase inherits rather than rewrites this page.

*Amendment note (2026-08-14):* the "eleven items, all `VERIFIED_RESOLVED`" count above was accurate when this spec was drafted and is now stale — `.gsd/BUGS.md` holds fifteen items, `BUG-012` … `BUG-015` being `OPEN`. None of the four is in this phase's scope, so the substance of Deviation 6 stands. The count is corrected here rather than edited in place so the drafting-time record remains legible. AC-35 appends a sixteenth (`BUG-016`) per Deviation 8.

---

### Deviation 7 — AC-11's passthrough requirement is re-derived over *structurally observable* arguments

**Status: needs sign-off (amendment). Raised by `/diagnose` on 2026-08-14 as a spec error (cause 2), not an implementation bug.**

**The defect.** AC-11 as originally written required, for each of nine functions, that "a `NaN` in **any** numeric argument returns `NaN`". For one function/argument pair that is unsatisfiable *by this spec's own construction*: §2.1 binds `refractometerOriginalGravity` to `brixToSg(initialBrix / wortCorrectionFactor)`, which never reads `finalBrix`. Verified in the shipped code at `packages/calculations/src/hydrometry.ts:86`, which implements that delegation exactly. `refractometerOriginalGravity({initialBrix: 12, finalBrix: NaN, wortCorrectionFactor: 1.04})` therefore returns the finite `1.046441535179445`. §2.1 and AC-11 contradicted each other; §2.1 is the contract the implementation correctly followed, so AC-11 is the half that was wrong.

**Resolution (amended AC-11).** The passthrough requirement now ranges over each function's *structurally observable* arguments, derived mechanically from §2.1's binding-behaviour table by an explicit rule (AC-11(a)), yielding 14 (function, argument) pairs — 10 in `hydrometry.test.ts`, 4 already asserted in the frozen `pressure.test.ts`. This is a **derivation, not a weakening**: the only pair excluded is the one §2.1 makes structurally impossible to observe, and `refractometerFinalGravity` — which shares the identical `RefractometerInput` interface but genuinely reads all three fields — still carries all three requirements and still fails if it ever stops propagating a `NaN` from any of them. AC-11(c) additionally requires the excluded pair to be **enumerated in the test table as an excluded pair**, asserting the finite return and citing §2.1 as the reason, so the exclusion is visible and breaks loudly if the delegation contract ever changes. The pre-amendment implementation silently omitted the row (`packages/calculations/test/hydrometry.test.ts:174-197`); silence is exactly what this clause forbids.

*Alternatives considered and rejected, stated so they can be overruled:*
- **(i) Change §2.1 so `refractometerOriginalGravity` observes `finalBrix`** — e.g. by returning `NaN` when either reading is non-finite. Rejected: it adds a guard to a pure converter purely to satisfy a test, contradicting §2.3's "no guards except the non-finite passthroughs" and §2.5's delegation rule, and it would make OG's domain differ from the published Brix→SG relation for no physical reason.
- **(ii) Drop `finalBrix` from `RefractometerInput` and give `refractometerOriginalGravity` its own two-field interface.** Rejected: it changes an approved §2.1 signature mid-phase and forces `RefractometerCalculator.tsx` — a frozen file — to build two argument objects instead of one. It is the cleaner design in the abstract and is worth considering for M8_P2, but not at the cost of an application-code edit during an amendment pass that otherwise touches none.
- **(iii) Blanket-weaken AC-11 to "each function propagates `NaN` from at least one argument."** Rejected outright: that is the allowlist-absorbs-every-failure pattern, and it would let `refractometerFinalGravity` silently stop observing `finalBrix`.

**Post-approval correction (2026-08-14, hard rule 7).** The amended AC-11(a) as re-`SPEC_APPROVED` declared its itemized derivation to total "21 pairs". It totals **14** (1+1+3+2+3+1+1+1+1), and no combination of §2.1's signatures produces 21. The executor caught this at the start of the follow-up pass and **stopped rather than guessing at seven pairs it could not derive** — the correct call under hard rule 4, since AC-11(a) is declared binding and mechanical. Corrected in place under the lightweight-task exception: the itemized derivation is authoritative and unchanged, only the summary count and the file distribution were wrong. The distribution is now stated explicitly (10 pairs in `hydrometry.test.ts`; the 4 pressure pairs already asserted in the frozen `pressure.test.ts` and deliberately **not** duplicated), which also resolves the second half of the executor's question.

*Worth recording as a pattern, not just an incident:* this is the **sixth** spec-arithmetic slip this project has independently caught, and the fourth of them on an AC numbered 11 specifically (M2_P1's AC-11 rounding-ratio error, M3_P2 twice, M7_P2's AC-11 `0.5 L`→`2.0 L` water-balance figure, now this). Each was caught by an agent re-deriving a number rather than trusting it — which is the practice worth preserving. A count stated alongside its own itemization is exactly where a drafting slip hides, because the itemization reads as authoritative and the total reads as decorative.

### Deviation 8 — AC-26's recipe-path-caller clauses were false for `srmToEbc` **and** `srmToLovibond`

**Status: needs sign-off (amendment). This is the verdict-flipping defect — the critic's single `NO`. Classified by `/diagnose` as a spec error (cause 2). Guarded by the amended AC-26 and the new AC-35.**

**The defect, independently re-verified while drafting this amendment.** AC-26 required `srmToEbc` to be "asserted to be referenced inside the existing engine". It is not, and cannot be:
- `packages/calculations/src/units.ts:25` is `srmToEbc`'s sole definition.
- `apps/web/src/components/calculators/UnitConverterCalculator.tsx:51` is its sole call site repo-wide (outside `units.test.ts`'s round-trip test).
- `packages/calculations/src/brewingMath.ts:289` computes `const ebc = srm * SRM_TO_EBC;` inline and never calls it.

**A second, independent falsehood no existing disclosure covered.** AC-26 declared the standalone-only set to be *exactly* nine named functions. `srmToLovibond` was not among them, so AC-26 implicitly asserted a recipe-path caller for it too. There is none: `brewingMath.ts` performs **no Lovibond computation at all** (its only colour output is `srm` and the inline `ebc`; its one Lovibond mention is a comment at line 40 explaining that MCU is SRM-based, *not* Lovibond-based). `srmToLovibond`'s sole call site is `UnitConverterCalculator.tsx:52`. AC-26 was false in two ways, and the executor's disclosure comment covered only the first.

**Severity is materially lower than "duplicated formula" suggests — this is why the recommendation is what it is.** Both `srmToEbc` (`units.ts:26`) and `brewingMath.ts:289` multiply by the **same** `SRM_TO_EBC = 1.97` imported from `constants.ts:12`. There is exactly **one** encoding of the physical fact in the repository. The drift risk that the roadmap's "a duplicated formula in a calculator is a milestone failure" threshold exists to prevent — two independently editable copies of a number diverging — is **absent**. This is a call-site inconsistency, not two sources of truth. The Lovibond case is identical: `srmToLovibond` uses `LOVIBOND_SLOPE`/`LOVIBOND_OFFSET` from the same `constants.ts`, and nothing duplicates it because nothing else computes Lovibond.

**Resolution (amended AC-26 + new AC-35).** Move **both** `srmToEbc` and `srmToLovibond` into AC-26(a)'s standalone-only allowlist — now eleven names — and log the `brewingMath.ts:289` inline duplication and the Lovibond gap as a single new `.gsd/BUGS.md` item (`BUG-016`, AC-35) for a later phase whose Untouched list permits editing `brewingMath.ts`. The BUGS.md entry is required to carry the no-drift-risk severity note, so a future triage pass does not over-escalate it.

**How the amended AC-26 keeps its teeth.** The concern with any allowlist amendment is that the allowlist becomes a landfill. AC-26(b) and (c) are the answer, and they make the criterion *stronger* than the original:
- (b) now asserts **seven** recipe-path-caller relationships positively, up from the original's four, adding `convertHopMass`, `sgToPlato` and `celsiusToFahrenheit`.
- (b) asserts the `config.ts` helper chain at **both hops**. The original wording claimed `convertVolume`/`convertMass` were "referenced inside `StatsHeader.tsx`", which is literally false — `StatsHeader.tsx` calls `formatVolume`/`formatMass`, which call them. The executor caught this and implemented the two-hop chain with a disclosure comment; the amendment promotes that correct reading into the criterion and extends it. **If `convertVolume` lost its recipe-path caller, hop 2 fails** even though hop 1 still passes; if `formatVolume` stopped calling `convertVolume`, hop 1 fails. **If `strikeTemperatureC` lost its `mash.ts` call site, (b) fails immediately.**
- (c) makes (a) and (b) a **total, disjoint partition** over eighteen named functions, so a function cannot be dropped from (b) without an explicit, reviewable edit adding it to (a) — which the critic audits against this spec. An allowlist that must be edited in the open is not a landfill.
- (d) bans negation assertions outright, so the specific failure mode that produced this defect — converting a detector into a recorder — cannot recur.

**The alternative, stated explicitly for overrule:** relax §1.4's Untouched list so `brewingMath.ts:289` may be changed to `const ebc = srmToEbc(srm);`, which would make AC-26 true **as originally written** for `srmToEbc` (though not for `srmToLovibond`, which would additionally need a Lovibond output added to `brewingMath.ts` — genuinely new behaviour, not a refactor). **Rejected as the recommendation** for four reasons: it edits the core calculation engine during an amendment pass whose whole point is that no application code changes; `brewingMath.ts` is covered by M1's fixture-parity suite, so the edit carries regression surface disproportionate to a defect with **no drift risk**; the Lovibond half cannot be fixed this way at all without inventing new engine output; and hard rule 4 routes a spec error to `/plan`, not to a code patch. I considered the alternative seriously — it is the option that leaves the codebase tidier — and still recommend against it: tidying is worth a scheduled phase, not a mid-amendment exception to a guardrail this spec spent §1.4 establishing.

### Deviation 9 — AC-33's lint-warning attribution corrected (count unchanged)

**Status: disclosed, non-blocking, no sign-off needed. Amendment 2026-08-14.**

AC-33 named the three pre-existing `react(only-export-components)` warnings as coming from `ConfigContext.tsx`, `CatalogContext.tsx` and `Sidebar.tsx`. Verified by running `npm run lint`: the actual three are `ConfigContext.tsx:112`, `ConfigContext.tsx:120` and `CatalogContext.tsx:47`. `Sidebar.tsx` emits none — its occurrence is suppressed by a pre-existing `// oxlint-disable-next-line react/only-export-components` at `Sidebar.tsx:27`. **The count of three is unchanged and the gate's threshold is unchanged**; only the attribution text was wrong, which would have misled anyone diffing warning output line-by-line. No alternative to state — the corrected text is simply the observed fact.

---

## 5. M8_P2 Preview (not yet specced)

Recorded here in the same way M3_P1 §5 previewed M3_P2, so the split's second half is visible at this halt gate.

**M8_P2 — "Plan the pitch, package the beer"**: four more cards on the page P1 builds.

1. **Yeast pitch rate & starter size** — build-spec §3.6. `targetCellsBillions = pitchRate × °P × volumeL` (rates: ale `0.75`, lager `1.5`, high-gravity ale `1.0`–`1.25`) and `viabilityAfterMonths(months, 21) = (1 − 0.21)^months`. °P comes from the **existing** `sgToPlato`. Genuinely standalone — no recipe-path caller today, and that is acceptable under the roadmap's threshold (which forbids duplicating an existing formula, not standalone-only functions); it joins P1's AC-26 allowlist, which must be updated in the same pass.
2. **Braukaiser starter-growth interpolation** — the source explicitly says *"use a lookup/interpolation table from the published Braukaiser growth chart — growth is nonlinear in starter size and gravity, not a single closed-form equation"* and provides **no table**. P2's largest risk: the table must be transcribed from the published chart into a pinned, spec-side data structure with its interpolation rule (bilinear vs. nearest, and out-of-range clamping) resolved explicitly, not left to the executor.
3. **Hop alpha-acid decay** — build-spec §3 gives **no** hop-decay formula (its only decay term is yeast viability). Needs the Garetz hop-storage-index relation `AA_remaining = AA₀ × e^(−k·HSI·days/…)` pinned from a published source with the same citation duty Ambiguity 3 imposes here.
4. **Gravity correction (DME / water / boil time)** and **priming + force carbonation** — the latter a pure wrapper over M5_P2's existing `carbonation.ts` (Deviation 5).

P2 will also extend P1's `calculatorImportGraph.test.ts` allowlists rather than adding a second static-analysis file.

---

> **HALT GATE (STATE 2 — AMENDMENT, 2026-08-14):** This spec was approved and built. `/verify` Layers 1 and 3 are **clean** (1214 passed / 2 skipped; typecheck, build and lint all exit 0). Layer 2's independent critic returned **FAIL** — 32 YES, 1 PARTIAL, 1 NO — and `/diagnose` classified **both** defects as **spec errors**, not implementation bugs: in each case the code faithfully does what §2.1 binds it to do, and the criterion asserting otherwise was the thing that was wrong. The spec has been amended in place. **Two amendment decisions want a human; the third change is a factual correction needing no sign-off.**
>
> **What the follow-up `/execute` pass WILL touch — exhaustively, per §1.3's new *Amendment-pass modified files* table:**
> - `packages/calculations/test/hydrometry.test.ts` — AC-11 describe block only.
> - `apps/web/test/calculatorImportGraph.test.ts` — AC-26 describe block only.
> - `.gsd/BUGS.md` — one appended item (`BUG-016`).
> - Fresh `M8_P1_amend_pre/post_exec_manifest.txt` pair.
>
> **What it will NOT touch: any application source file, at all.** No file under `packages/calculations/src/`, none under `apps/web/src/`. `hydrometry.ts`, `pressure.ts`, all six calculator components, `App.tsx`, `Sidebar.tsx`, `brewingMath.ts`, `units.ts`, `constants.ts`, `config.ts`, `mash.ts` — all frozen and hash-verified. The AC-23 / AC-24 / AC-25 / AC-27 describe blocks are byte-frozen too. Expect the amendment's diff to be **two test blocks and one appended bug entry**.
>
> ---
>
> **(A) §4 Deviation 8 — AC-26 absorbs `srmToEbc` *and* `srmToLovibond` into the standalone allowlist. ← the verdict-flipping one.** AC-26 asserted a recipe-path caller for `srmToEbc` that does not exist (`brewingMath.ts:289` inlines `srm * SRM_TO_EBC` instead of calling it), and — by omitting it from the standalone set — implicitly asserted one for `srmToLovibond` too, which `brewingMath.ts` never computes in any form. Both call sites resolve to the **same shared constants** in `constants.ts`, so there is exactly one encoding of each physical fact and **the drift risk this criterion guards against is absent**: a call-site inconsistency, not two sources of truth. **Recommendation:** move both into the allowlist and log the inline duplication as `BUG-016` (new AC-35) for a phase permitted to edit `brewingMath.ts`. To stop the allowlist becoming a landfill, the amended AC-26 is *stronger* than the original — seven positively-asserted recipe-path callers instead of four, the `config.ts` helper chain asserted at **both hops** (so `convertVolume` losing its `StatsHeader.tsx` consumer fails hop 2, and `strikeTemperatureC` losing its `mash.ts` call site fails immediately), a total-and-disjoint partition over eighteen functions so nothing can be dropped from one set without a visible edit to the other, and an outright ban on negation assertions. **The alternative, if you'd rather:** relax §1.4's Untouched list so `brewingMath.ts:289` becomes `srmToEbc(srm)`, making AC-26 true as originally written for `srmToEbc` — though **not** for `srmToLovibond`, which would need genuinely new engine output. Rejected as the recommendation because it edits the core calculation engine (covered by M1's fixture-parity suite) mid-amendment for a defect carrying no drift risk, and because hard rule 4 routes a spec error to `/plan` rather than to a code patch.
>
> **(B) §4 Deviation 7 — AC-11 now ranges over *structurally observable* arguments.** §2.1 binds `refractometerOriginalGravity` to `brixToSg(initialBrix / wortCorrectionFactor)`, so it cannot observe `finalBrix` — making AC-11's "a `NaN` in **any** numeric argument" unsatisfiable for that one pair by the spec's own construction. The requirement is re-derived mechanically from §2.1 into 14 (function, argument) pairs, and AC-11(c) requires the excluded pair to be **enumerated as an excluded pair** (asserting it returns the finite `1.046441535179445`, with the reason cited) rather than silently dropped, which is what the current test does. This is a derivation, not a weakening: `refractometerFinalGravity` shares the same interface, genuinely reads all three fields, and still fails if it ever stops propagating a `NaN` from any of them. **Alternatives, if you disagree:** (i) add a guard so OG observes `finalBrix` — contradicts §2.3's no-guards rule; (ii) split `RefractometerInput` into two interfaces — cleaner in the abstract, but changes an approved signature and forces an application-code edit this pass otherwise avoids; worth revisiting in M8_P2.
>
> **(C) §4 Deviation 9 — no sign-off needed.** AC-33 named the wrong three files for the three pre-existing lint warnings. The real three are `ConfigContext.tsx` ×2 and `CatalogContext.tsx` ×1; `Sidebar.tsx`'s is suppressed by a pre-existing `oxlint-disable-next-line`. Count and gate threshold unchanged; text corrected.
>
> ---
>
> *The three original approval decisions below are unchanged and remain in force — restated for the record, not reopened.*
>
> **(a) §4 Deviation 1 — the two-phase split.** Milestone 8's nine calculators are split into P1 (brew-day measurement + all unit converters, this spec, now 35 ACs) and P2 (pitch rate, Braukaiser starter table, hop decay, gravity correction, carbonation). Each half is a shippable vertical slice; P1 leaves no stub route behind. §5 previews P2 in enough detail to merge it back in if you would rather have one phase.
>
> **(b) §4 Deviation 2 — calculator inputs stay metric.** A US-configured user types litres and °C into these calculators and reads the answer in gallons and °F. That is M7's own deferred boundary held unchanged, and it is genuinely awkward on a page where nothing is pre-filled from a stored recipe. The recommendation is to hold it and schedule an **M8_P3 "type in your own units"** covering the calculators *and* the recipe/equipment forms together, rather than converting five cards and leaving `EquipmentForm` metric.
>
> **(c) §4 Deviations 3 and 4 — two formula decisions the source document does not make.** The build spec gives **no** refractometer formula, so Ambiguity 3 pins Brix→SG, its inverse, Terrill's alcohol-corrected FG cubic, and a `1.04` wort correction factor, with a binding duty on the executor to verify the coefficients against the published source and **stop** rather than adjust. And build-spec §3.5's hydrometer correction is implemented **against** its own literal parameter units — as written it corrects a warm sample *downward*, which is backwards; AC-6 pins the rejected value as a negative control. This is the second defect found in build-spec §3.5 (the strike-temperature formula was the first, in M3_P2).
>
> Also worth a glance: **§1.4's Untouched list** is deliberately broad — `apps/api/**`, `shared-types/**`, `constants.ts`, `units.ts`, `config.ts`, `mash.ts` and every existing web component except `App.tsx`/`Sidebar.tsx` are all explicitly out; this phase adds functions and a page, and modifies almost nothing. And **AC-23 … AC-27** are where the roadmap's own verification threshold ("asserted by import graph, not convention") is made mechanically checkable.
>
> ---
>
> **AWAITING re-SPEC_APPROVED.** This spec was amended after approval, so the original `SPEC_APPROVED` does not carry over to the amended criteria. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
