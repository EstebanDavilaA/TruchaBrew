# FEATURE SPECIFICATION: M7_P2 — Units and formula choices that follow me everywhere

- **Milestone:** M7 (Units and formula choices that follow me everywhere)
- **Phase:** P2 (Hop-mass and volume display conversion, plus the US-vs-Imperial gallon distinction) — **closing phase of M7**
- **Depends on:** M7_P1 (`.gsd/archive/specs/M7_P1_feature_spec.md`, verification-clean 2026-08-14, 29/29 ACs). This phase consumes `ConfigContext`, `UserConfig`, and the §2.2.1 formatting-helper pattern that phase established, and adds no new state, no new API surface, and no schema change.
- **Layer:** Display layer only — `packages/calculations/src/config.ts` (pure helpers) plus the `apps/web/src` components that render hop-mass and volume figures. **No database, no API, no shared-types change.**

---

## Phase Summary

M7_P1 wired the user's saved `UserConfig` through to the screen for **gravity** (SG/Plato), **temperature** (°C/°F), and **grain mass** (kg/lb) — but stopped there. Its §4 Deviation 3 recorded the stopping point explicitly: hop weights (`totalHopG` and the per-hop gram fields in `HopSection`) and **every** volume figure (batch size, pre-boil volume, mash/sparge/total water, `strikeWaterL`) still render in metric no matter what the user selected, and no Imperial-gallon converter exists at all — `lToUsGal`/`usGalToL` are in `packages/calculations/src/config.ts`, but nothing distinguishes a US gallon from an Imperial one, so `unitSystem: 'imperial'` and `unitSystem: 'us'` are today indistinguishable everywhere except in name.

This phase closes that gap for **read-only display figures**, using exactly the contract M7_P1 already established and proved: canonical metric values are read from the DB and API **unchanged**, are rendered converted according to the active `unitSystem`, and are never written back in converted form. Two new helper families mirror `formatMass`/`massUnitLabel`/`convertMass` one-for-one:

1. **Hop mass** — `convertHopMass` / `hopMassUnitLabel` / `formatHopMass` (g → oz), at finer precision than the grain-mass helper because hop quantities are one to two orders of magnitude smaller.
2. **Volume** — `convertVolume` / `volumeUnitLabel` / `formatVolume` (L → US gal for `'us'`, L → **Imperial** gal for `'imperial'`), backed by a new `lToImpGal`/`impGalToL` converter pair. These are **not** the same conversion factor, and this is the first place in the codebase where `'us'` and `'imperial'` produce different numbers on screen.

Converting **input fields** — changing the unit a user *types* grain, hop, or volume amounts into, and round-tripping that back to canonical metric storage on every keystroke — is **explicitly out of scope**, per M7_P1 §4 Deviation 3's own text ("a materially different problem — precision drift, cursor behavior, and canonical-storage integrity"). See Resolved Ambiguity 1 for the binding definition of what counts as an input field here.

---

## Key Behaviors

1. **Display-only conversion, canonical storage untouched.** Every figure this phase converts is a read-only rendering of a value the app already holds in metric. No stored value, no request payload, and no in-memory recipe/equipment object is mutated by a unit change. Changing `unitSystem` issues zero writes of any kind.
2. **Hop mass follows the unit system.** Total-hop figures render in grams under `'metric'` and ounces under `'us'`/`'imperial'`.
3. **Volume follows the unit system, and US ≠ Imperial.** Volume figures render in litres under `'metric'`, US gallons under `'us'`, and Imperial gallons under `'imperial'` — three distinct outputs from one stored litre value, distinguishable both numerically and by unit label.
4. **One screen, one unit.** Within a single rendered view, a `'us'`-configured user never sees a converted figure adjacent to an unconverted one of the same dimension. (This is the same mixed-unit defect M7_P1's AC-29 closed for temperature inside `MashSection`; the residual mixed-unit surfaces that survive this phase are enumerated and justified in §4 Deviation 2 rather than left to be discovered.)
5. **No inline conversion math.** M7_P1's Resolved Ambiguity 4 continues to bind: every conversion goes through a `@truchabrew/calculations` export. No component performs `l * 0.264172` or `g / 28.35` inline.

---

## Resolved Ambiguities (Binding)

### 1. "Input field" — the exact scope boundary

**Binding definition:** a figure is an **input field** (and therefore out of scope) if it is rendered inside an `<input>`/`<select>` element's `value`, or is the `label`/adjacent unit annotation belonging to such an element. A figure is a **display figure** (in scope) if it is rendered as text the user cannot type into.

Consequences, all binding:

- `HopSection`'s per-hop `Amount` column (`<input value={hop.amountG}>`), its `Amount (g)` table header, and the add-hop form's `g` annotation **stay in grams** — AC-10 asserts they are unchanged.
- `FermentableSection`'s per-fermentable `Amount (kg)` input column **stays in kg**.
- `EquipmentForm`'s entire field table (`batchSizeL`, `trubChillerLossL`, `boilOffRateLPerHour`, the two `L/kg` ratios) **stays metric** — that file is untouched (§1.3 guardrail).
- `BatchDetail`'s `Boil Size (L)` and `Bottling Size (L)` numeric inputs **stay in litres**; that file is untouched by this phase entirely.

*Reasoning:* this is M7_P1 §4 Deviation 3's own boundary, restated operationally so "did the executor stay inside it" is a yes/no question. It also keeps this phase's risk profile identical to M7_P1's — a pure rendering change with no path to corrupting a stored value.

### 2. `'us'` and `'imperial'` must be visually distinguishable — the labels differ

`volumeUnitLabel` returns `'L'` / `'gal'` / **`'imp gal'`**, not `'gal'` for both non-metric systems.

*Reasoning:* M7_P1's `massUnitLabel` returns `'lb'` for both `'us'` and `'imperial'` and that was correct — both systems use the avoirdupois pound, so the **numbers are identical** and one label serves both. Volume is the opposite case: 20 L is `5.28` US gallons but `4.40` Imperial gallons. Two different numbers under one identical `gal` label is a misreading hazard for the exact figure (batch size) a brewer scales a recipe against. The labels must carry the distinction the numbers already carry.

### 3. Precision defaults are system-dependent, and that is deliberate

- `formatHopMass`: `fractionDigits` defaults to **`1`** for `'metric'`, **`2`** for `'us'`/`'imperial'`.
- `formatVolume`: `fractionDigits` defaults to **`1`** for `'metric'`, **`2`** for `'us'`/`'imperial'`.
- An explicitly-passed `fractionDigits` argument overrides both branches unconditionally.

*Reasoning:* M7_P1's `formatMass` used a single default of `2` for both branches because kg and lb are within 2.2× of each other. Here the ratios are ~28× (g→oz) and ~3.8× (L→gal), so one fixed default is wrong at one end: `25 g` at 2 dp is meaningless noise (`25.00 g`), while `0.9 oz` at 1 dp loses a digit a brewer actually weighs to. The two-branch default is pinned exactly in §2.1 and by AC-4/AC-5 so it is not left to executor judgment.

### 4. Which conversion constants — reuse over re-derivation

- **US gallon:** reuse the existing `US_GAL_PER_L = 0.264172` already in `packages/calculations/src/config.ts`. Do **not** replace it with the exact `0.26417205235815...`.
- **Imperial gallon:** new `IMP_GAL_PER_L = 0.219969` (from the exact 4.54609 L/imp gal), matched to the US constant's 6-significant-figure style.
- **Ounce:** new `GRAMS_PER_OUNCE = 28.349523125` — the exact avoirdupois definition, used as a divisor.

*Reasoning:* changing `0.264172` would move `lToUsGal`'s already-approved M7_P1 output and put a live constant on the same "two divergent copies" footing that cost M7_P1 a whole `/diagnose` cycle (its AC-22, the two `TINSETH_BIGNESS_BASE` values). One constant per unit, in one file. The ounce constant is exact because it costs nothing to be exact and no prior value exists to stay consistent with. All three appear in AC-15's grep list — they may exist **only** in `packages/calculations/src/config.ts`.

### 5. Ratio and compound units stay metric

`L/kg` (mash water ratio, grain absorption — `EquipmentForm`, `EquipmentManager`), `L/hr` (boil-off rate), `g/L` (priming-sugar sucrose equivalent — `CarbonationPanel`), and `mEq/L` (residual alkalinity — `WaterSection`) are **not converted** and their files are correspondingly untouched or narrowly touched.

*Reasoning:* a ratio's US-customary counterpart is not a mechanical substitution of each side (`L/kg` conventionally becomes `qt/lb`, not `gal/lb`), so each one needs its own target unit, its own factor, and its own reasoning — none of which M7_P1 established a pattern for. `mEq/L` is a chemistry concentration with no US-customary form at all. Converting these badly is worse than not converting them; they are listed here so their absence reads as a decision rather than an oversight (§4 Deviation 4).

### 6. Non-hop gram figures stay in grams

`CarbonationPanel`'s priming-sugar `g` figure and `WaterSection`'s mineral-addition `g` figures are **not** converted, and `formatHopMass` is deliberately named for hops rather than as a generic small-mass helper.

*Reasoning:* both are dosing figures that US homebrewers conventionally measure in grams (priming sugar and brewing salts are sold and dosed by the gram in US practice), and both belong to M5_P2 and M6 surfaces that this phase has no other reason to open. Should a later phase decide otherwise, `convertHopMass` generalizes without a signature change.

### 7. The scale modal's "Current Batch Size" stays in litres

In `App.tsx`'s scale-recipe modal, the read-only `Current Batch Size` figure **remains** `{batchSizeL} L`, and the adjacent target-size `<input>` gains an explicit **`(L)`** annotation in its label.

*Reasoning:* this is the one place a display figure sits directly above an input of the same dimension, as a reference value for what the user is about to type. Converting only the display — `Current Batch Size: 6.60 gal` above a box that silently means litres — invites a user to type `8` meaning gallons and get an 8-litre recipe. Since converting the input is out of scope (Ambiguity 1), the honest resolution is to leave the pair consistent and make the input's unit explicit. This is the single deliberate exception to Key Behavior 4 and is pinned by AC-14.

### 8. `FermentableSection`'s grain total is in scope, though it is neither hop nor volume

`FermentableSection.tsx:49` renders `{totalGrainKg} kg` raw. It is converted via M7_P1's **existing** `formatMass` — no new helper.

*Reasoning:* M7_P1's AC-24 wired `totalGrainKg` through `formatMass` in `StatsHeader` only, so today a `'us'` user reads `11.02 lb` in the stats header and `5 kg` in the fermentables card **in the same scroll view**. That is precisely the defect class M7_P1's AC-29 reasoning closed rather than deferred: one line, in a file this phase is opening anyway, using a helper that already exists and is already exported. Deferring it would ship M7 with a known mixed-unit bug in its own headline feature. This is a completion of M7_P1's charge, not new scope.

### 9. How each component obtains the active config

- Components **already receiving** a `config: UserConfig` prop keep it: `StatsHeader`, `MashSection`.
- `App.tsx` (`AppInner`) already holds `config` from `useConfig()` and passes it down.
- Components **not** currently config-aware call `useConfig()` directly rather than growing a new prop chain: `HopSection` (already a context consumer via `useCatalog()`), `RecipeLibrary`, `EquipmentManager`, `FermentableSection`.

*Reasoning:* both patterns already exist in this codebase and M7_P1 blessed both. Prop-drilling into `RecipeLibrary`/`EquipmentManager` — self-contained routed views that load their own data — would add a prop to a call site for no benefit. All four `useConfig()` consumers already render beneath `ConfigProvider` (mounted at `App.tsx:774`), so no provider placement changes. Their tests wrap in `<ConfigProvider>` using the pattern `BatchDetail.test.tsx` already established.

### 10. Zero and non-finite inputs, and rounding order

Identical to M7_P1 §2.2.1, restated as binding here:

- **Non-finite** (`NaN`, `±Infinity`): every `format*` function returns the single em-dash string `"—"`. Never `"NaN gal"`, never `"0"`.
- **Zero** is finite and formats normally: `"0.0 L"`, `"0.00 gal"`, `"0.0 g"`, `"0.00 oz"`. Zero must **not** collapse to the em-dash.
- **Converters** (`convertHopMass`, `convertVolume`) return `NaN` unchanged for non-finite input — they are converters, not formatters, and must not fabricate a zero.
- **Negative** values convert and format normally (`-2.5 L` → `-0.66 gal`); no clamping. Existing callers that want magnitude apply `Math.abs` before calling, as `MashSection`'s water-balance warning already does.
- **Round once, at the end.** Convert at full precision, then `toFixed`. Rounding the litre value before conversion is a defect.

---

## 1. Data Schema & Contracts

### 1.1 Database, API, shared types — no change

This phase adds **no** migration, **no** endpoint, and **no** type. `UserConfig`, `UnitSystem` (`'metric' | 'us' | 'imperial'`), and the `/api/config` GET/PUT surface are consumed exactly as M7_P1 left them. `apps/api/**` and `packages/shared-types/**` are on the untouched guardrail list (§1.3, AC-24).

### 1.2 New exported constants (`packages/calculations/src/config.ts`, module-private unless noted)

| Symbol | Value | Exported? |
|--------|-------|-----------|
| `US_GAL_PER_L` | `0.264172` — **pre-existing, unchanged** | No (module-private, as today) |
| `IMP_GAL_PER_L` | `0.219969` | No (module-private, same convention as `US_GAL_PER_L` and `LB_PER_KG`) |
| `GRAMS_PER_OUNCE` | `28.349523125` | No (module-private) |

No constant in this table may appear anywhere under `apps/web/src` (AC-15).

### 1.3 Symbol Inventory

**New Files:**

| Path | Charge |
|------|--------|
| `apps/web/test/FermentableSection.test.tsx` | This component has no test file today. Required by AC-12 (grain-total conversion) and by the guardrail half of AC-10's sibling clause (the `Amount (kg)` input column stays kg). Component tests only — no new production file. |

**Modified Files — permitted edits are exhaustive:**

| Path | Permitted edits — exhaustive |
|------|------------------------------|
| `packages/calculations/src/config.ts` | Add `IMP_GAL_PER_L`, `GRAMS_PER_OUNCE`, `lToImpGal`, `impGalToL`, `convertHopMass`, `hopMassUnitLabel`, `formatHopMass`, `convertVolume`, `volumeUnitLabel`, `formatVolume` per §2.1. **No existing export's signature or numeric behavior changes** — `lToUsGal`, `usGalToL`, `formatMass`, `convertMass`, `massUnitLabel`, `formatGravity`, `formatTemperature`, and every strategy function are byte-equivalent in behavior. |
| `packages/calculations/src/index.ts` | Add the eight new names to the existing explicit `export { … } from './config'` list. The `kgToLb` collision note and its exclusion stay exactly as they are. |
| `packages/calculations/test/config.test.ts` | Add cases for the new helpers (AC-1 … AC-7). Existing cases unchanged. |
| `apps/web/src/components/StatsHeader.tsx` | Route `equipment.batchSizeL`, `stats.preBoilVolumeL`, `stats.mashWaterL`, `stats.spargeWaterL`, `stats.totalWaterL` through `formatVolume`, and `stats.totalHopG` through `formatHopMass`. Remove the six hardcoded ` L` / ` g` suffixes. No change to the gravity/ABV/IBU/SRM/BU:GU tiles, to `formatMass` on `totalGrainKg`, or to the strategy-caption maps. |
| `apps/web/src/components/MashSection.tsx` | Route `mashPlan.strikeWaterL`, `step.infusionVolumeL`, `step.mashVolumeAfterL`, and the water-balance warning's `Math.abs(mashPlan.mashWaterBalanceL)` through `formatVolume`. **Delete the now-unused local `fmt()` helper** (§2.4). No change to any `formatTemperature` call, to `MashPlan`, or to any calculation. |
| `apps/web/src/components/HopSection.tsx` | Add `useConfig()`; route the read-only `Total Hops:` summary figure through `formatHopMass`. **The per-hop `Amount` inputs, the `Amount (g)` header, and the add-form `g` annotation are unchanged** (AC-10). No change to IBU rendering or to any handler. |
| `apps/web/src/components/FermentableSection.tsx` | Add `useConfig()`; route the `Total:` figure through the **existing** `formatMass` (Ambiguity 8). The `Amount (kg)` input column and header are unchanged. |
| `apps/web/src/components/RecipeLibrary.tsx` | Add `useConfig()`; route the `{r.batchSizeL} L` list-row meta figure through `formatVolume`. No change to loading, search, duplicate, or error paths. |
| `apps/web/src/components/EquipmentManager.tsx` | Add `useConfig()`; route the `{profile.batchSizeL} L batch` summary figure through `formatVolume`. **The two `L/kg` ratio rows are unchanged** (Ambiguity 5). No change to create/edit/delete paths. |
| `apps/web/src/App.tsx` | Route the two equipment-picker `<option>` label volumes (`{recipe.equipment.batchSizeL}L`, `{eq.batchSizeL}L`) through `formatVolume` using the already-bound `config`. In the scale modal: leave `Current Batch Size` in litres and add the explicit `(L)` annotation to the target-size input's label (Ambiguity 7). No change to `ConfigProvider` placement, routing, or any handler. |
| `apps/web/test/StatsHeader.test.tsx`, `apps/web/test/MashSection.test.tsx`, `apps/web/test/HopSection.test.tsx`, `apps/web/test/RecipeLibrary.test.tsx`, `apps/web/test/EquipmentManager.test.tsx`, `apps/web/test/App.test.tsx` | Provider-wrapping and new assertions forced by the rows above. Any **existing** assertion whose expected value changes must be individually comment-flagged for the critic with the reason (expected: the metric-precision change of §4 Deviation 1). No existing assertion may be deleted or weakened. |

**Untouched (guardrail — AC-24).** No file below may have a changed content hash:

- `apps/api/**` in its entirety (no route, schema, migration, seed, or API test).
- `packages/shared-types/**` in its entirety.
- `packages/calculations/src/brewingMath.ts`, `constants.ts`, `units.ts`, `scaling.ts`, `mash.ts`, `water.ts`, `carbonation.ts`, and every other `packages/calculations/src/*.ts` **except** `config.ts` and `index.ts`.
- `packages/calculations/test/brewingMath.test.ts` and every `packages/calculations/test/*.ts` except `config.test.ts`.
- `apps/web/src/context/ConfigContext.tsx`, `apps/web/src/context/CatalogContext.tsx`, `apps/web/src/api/client.ts`, `apps/web/src/hooks/useRecipeEditor.ts`.
- `apps/web/src/pages/BatchDetail.tsx`, `apps/web/src/pages/BatchList.tsx`, `apps/web/src/components/EquipmentForm.tsx`, `SettingsManager.tsx`, `WaterSection.tsx`, `CarbonationPanel.tsx`, `MeasuredComparison.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `MiscSection.tsx`, `YeastSection.tsx`, `FermentationChart.tsx`, and every `*Form.tsx` / `*Manager.tsx` not named in the Modified table.
- Every `apps/web/test/*.tsx` not named in the Modified table.

---

## 2. Transformations & Pure Logic

### 2.1 Pure function contracts (`packages/calculations/src/config.ts`)

```typescript
// Volume converters — mirroring the existing lToUsGal / usGalToL pair
export function lToImpGal(l: number): number;
export function impGalToL(gal: number): number;

// Hop mass — mirrors convertMass / massUnitLabel / formatMass exactly in shape
export function convertHopMass(grams: number, system: UnitSystem): number;
export function hopMassUnitLabel(system: UnitSystem): 'g' | 'oz';
export function formatHopMass(grams: number, system: UnitSystem, fractionDigits?: number): string;

// Volume — same shape again
export function convertVolume(litres: number, system: UnitSystem): number;
export function volumeUnitLabel(system: UnitSystem): 'L' | 'gal' | 'imp gal';
export function formatVolume(litres: number, system: UnitSystem, fractionDigits?: number): string;
```

**Binding behavior — no latitude:**

| Function | `system` | Returns |
|----------|----------|---------|
| `lToImpGal` | — | `l * IMP_GAL_PER_L` |
| `impGalToL` | — | `gal / IMP_GAL_PER_L` |
| `convertHopMass` | `'metric'` | `grams` unchanged (identity — **not** a rounded value) |
| `convertHopMass` | `'us'` \| `'imperial'` | `grams / GRAMS_PER_OUNCE` (both systems use the avoirdupois ounce — identical, and that is intentional) |
| `hopMassUnitLabel` | `'metric'` / `'us'` / `'imperial'` | `'g'` / `'oz'` / `'oz'` |
| `formatHopMass` | any | `` `${convertHopMass(grams, system).toFixed(d)} ${hopMassUnitLabel(system)}` `` |
| `convertVolume` | `'metric'` | `litres` unchanged (identity) |
| `convertVolume` | `'us'` | `lToUsGal(litres)` — routed through the existing export, **not** a second inline multiplication |
| `convertVolume` | `'imperial'` | `lToImpGal(litres)` |
| `volumeUnitLabel` | `'metric'` / `'us'` / `'imperial'` | `'L'` / `'gal'` / `'imp gal'` |
| `formatVolume` | any | `` `${convertVolume(litres, system).toFixed(d)} ${volumeUnitLabel(system)}` `` |

Where `d` = the caller's `fractionDigits` if supplied, else `1` for `'metric'` and `2` for `'us'`/`'imperial'` (Ambiguity 3).

### 2.2 No-match / degenerate contracts

Per Ambiguity 10, and identical in spirit to M7_P1's §2.2.1 so the two helper families cannot drift:

| Input | `formatHopMass` / `formatVolume` | `convertHopMass` / `convertVolume` |
|-------|----------------------------------|------------------------------------|
| `NaN` | `"—"` | `NaN` |
| `±Infinity` | `"—"` | `NaN` |
| `0` | `"0.0 g"` / `"0.00 oz"` / `"0.0 L"` / `"0.00 gal"` / `"0.00 imp gal"` | `0` |
| negative finite | normal conversion + format, sign retained | normal conversion, sign retained |

**Caller branching:** no caller may branch on the em-dash sentinel or re-check finiteness before calling — the helpers own that decision, exactly as M7_P1's do. Callers pass the raw canonical number and render the returned string.

### 2.3 Stateful integration contract

This phase introduces **no new state**. The integration is strictly:

1. `ConfigProvider` (mounted at `App.tsx:774`, unchanged) resolves `config` exactly as it does today — one `GET /api/config` per app mount, no additional request from any component this phase touches.
2. `StatsHeader` and `MashSection` continue receiving `config` as a prop from `AppInner`. `HopSection`, `FermentableSection`, `RecipeLibrary`, and `EquipmentManager` read `config` via `useConfig()` at render time (Ambiguity 9).
3. On `applyConfig` (a Settings change), every consumer re-renders from the same context value in the **same** React commit — no remount, no refetch, no per-component copy of the config. AC-18 asserts two components change together in one pass.
4. **Render-only fallback, unchanged from M7_P1 §2.2.2.** While `status` is `'loading'`/`'error'`, `config` is `DEFAULT_USER_CONFIG` (`unitSystem: 'metric'`), so these surfaces render metric — identical to today's output. This fallback is renderable but **never persistable**: this phase adds no `PUT` call of any kind, and AC-17 asserts zero write requests are issued by any unit change.
5. **Canonical values are never mutated.** Components receive `stats`, `equipment`, `mashPlan`, and `RecipeSummary` objects and format from them. No component may write a converted value back into any of those objects, into `setRecipe`, or into a request body.

### 2.4 Refactoring & legacy cleanup — mandatory, not optional

- **`MashSection.tsx`'s local `fmt()` helper** (`function fmt(value: number) { return value.toFixed(1); }`) is used by exactly the four volume figures this phase converts. Once they route through `formatVolume`, `fmt` is dead code and **must be deleted**, not left in place. A surviving unused `fmt` is an AC-16 failure (and a lint failure).
- **Hardcoded unit suffixes must be removed, not merely bypassed.** The literal JSX text ` L` / ` g` / `L)` adjacent to each converted figure is deleted — the unit now comes from `volumeUnitLabel`/`hopMassUnitLabel` inside the returned string. Leaving a stale suffix beside a converted value (`5.28 gal L`) is exactly the failure AC-16's negative assertions catch.
- **`HopSection.tsx`'s `totalHopG.toFixed(1)`** is replaced by `formatHopMass(totalHopG, config.unitSystem)`; the inline `.toFixed(1)` is removed rather than nested inside the helper call.
- **No second conversion path.** `convertVolume('us')` delegates to the existing `lToUsGal`; it must not carry its own `litres * 0.264172`. This is the M7_P1 AC-22 lesson (two divergent `TINSETH_BIGNESS_BASE` constants) applied preemptively.

---

## 3. Acceptance Criteria & Test Matrix

All pinned strings below are computed from the §1.2 constants. Every criterion is a "does the code do this, yes or no" check.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | **New helpers exist and are root-exported** | Unit (`config.test.ts`) | `lToImpGal`, `impGalToL`, `convertHopMass`, `hopMassUnitLabel`, `formatHopMass`, `convertVolume`, `volumeUnitLabel`, `formatVolume` are all importable from **`@truchabrew/calculations`'s package root** (not only from `../src/config`). Importing all eight from the root in one statement type-checks and none is `undefined` at runtime |
| **AC-2** | **US and Imperial gallons are different conversions — the wrinkle M7_P1 never touched** | Unit (`config.test.ts`) | `lToUsGal(20)` equals `5.28344` ±`1e-9`; `lToImpGal(20)` equals `4.39938` ±`1e-9`; the two differ by more than `0.8`. `convertVolume(20, 'us') === lToUsGal(20)` exactly and `convertVolume(20, 'imperial') === lToImpGal(20)` exactly. `formatVolume(20, 'us') === "5.28 gal"` and `formatVolume(20, 'imperial') === "4.40 imp gal"`, and those two strings are **not equal** |
| **AC-3** | **Volume unit labels are exact and distinguishable** | Unit (`config.test.ts`) | `volumeUnitLabel('metric') === 'L'`; `volumeUnitLabel('us') === 'gal'`; `volumeUnitLabel('imperial') === 'imp gal'`. `volumeUnitLabel('us') !== volumeUnitLabel('imperial')` |
| **AC-4** | **`formatVolume` pinned values and precision defaults** | Unit (`config.test.ts`) | `formatVolume(20, 'metric') === "20.0 L"`; `formatVolume(15.5, 'metric') === "15.5 L"`; `formatVolume(15.5, 'us') === "4.09 gal"`; `formatVolume(23, 'us') === "6.08 gal"`; `formatVolume(23, 'imperial') === "5.06 imp gal"`. Explicit override wins: `formatVolume(20, 'us', 3) === "5.283 gal"` and `formatVolume(20, 'metric', 0) === "20 L"`. `convertVolume(20, 'metric') === 20` exactly (identity, not rounded) |
| **AC-5** | **`formatHopMass` pinned values, labels, and precision defaults** | Unit (`config.test.ts`) | `formatHopMass(150, 'metric') === "150.0 g"`; `formatHopMass(150, 'us') === "5.29 oz"`; `formatHopMass(150, 'imperial') === "5.29 oz"`; `formatHopMass(25, 'us') === "0.88 oz"`; `formatHopMass(28.349523125, 'us') === "1.00 oz"`. `hopMassUnitLabel` returns `'g'`/`'oz'`/`'oz'`. `convertHopMass(150, 'metric') === 150` exactly; `convertHopMass(150, 'us')` equals `5.291094292437061` ±`1e-9`; `convertHopMass(x, 'us') === convertHopMass(x, 'imperial')` for `x = 150` (deliberately identical — same avoirdupois ounce). Override: `formatHopMass(150, 'us', 1) === "5.3 oz"` |
| **AC-6** | **Degenerate and zero inputs** | Unit (`config.test.ts`) | `formatVolume(NaN, 'us')`, `formatVolume(Infinity, 'metric')`, `formatHopMass(NaN, 'us')`, `formatHopMass(-Infinity, 'imperial')` each return exactly `"—"`. `Number.isNaN(convertVolume(NaN, 'us'))` and `Number.isNaN(convertHopMass(Infinity, 'us'))` are both true. **Zero does not collapse:** `formatVolume(0, 'metric') === "0.0 L"`, `formatVolume(0, 'us') === "0.00 gal"`, `formatVolume(0, 'imperial') === "0.00 imp gal"`, `formatHopMass(0, 'metric') === "0.0 g"`, `formatHopMass(0, 'us') === "0.00 oz"`. Negative: `formatVolume(-2.5, 'us') === "-0.66 gal"` (sign retained, no clamp) |
| **AC-7** | **Round-trip fidelity** | Unit (`config.test.ts`) | `usGalToL(lToUsGal(20))` and `impGalToL(lToImpGal(20))` each return `20` within `1e-9`. `impGalToL(lToUsGal(20)) !== 20` within the same tolerance — proving the two gallon converters are not silently the same function |
| **AC-8** | **`StatsHeader` volume figures convert end-to-end** | Component (`StatsHeader.test.tsx`) | With `equipment.batchSizeL = 20`, `stats.preBoilVolumeL = 23`, `stats.mashWaterL = 15`, `stats.spargeWaterL = 10`, `stats.totalWaterL = 25`: under `unitSystem: 'us'` the rendered output contains `5.28 gal`, `6.08 gal`, `3.96 gal`, `2.64 gal`, `6.60 gal`. Under `'imperial'` it contains `4.40 imp gal` (batch size) and `5.50 imp gal` (total water). Under `'metric'` it contains `20.0 L`, `23.0 L`, `15.0 L`, `10.0 L`, `25.0 L`. Gravity, ABV, IBU, SRM, BU:GU and Total Grain tiles are unaffected in all three cases |
| **AC-9** | **`StatsHeader` total-hops figure converts** | Component (`StatsHeader.test.tsx`) | With `stats.totalHopG = 150`: under `'us'` the Total Hops figure reads `5.29 oz`; under `'imperial'`, `5.29 oz`; under `'metric'`, `150.0 g`. The hardcoded ` g` suffix no longer appears in `StatsHeader.tsx`'s JSX |
| **AC-10** | **`HopSection`: summary converts, inputs do not — the scope boundary, asserted** | Component (`HopSection.test.tsx`) | With `totalHopG = 150`, a hop of `amountG = 25`, and `unitSystem: 'us'`: **(a)** the `Total Hops:` summary reads `5.29 oz`; **(b)** the per-hop Amount `<input>`'s `value` is still exactly `25` (**not** `0.88`), the table header still reads `Amount (g)`, and the add-hop form's unit annotation is still `g`; **(c)** editing that input to `30` calls `onUpdate` with `amountG === 30` — no conversion is applied to the stored value. Under `'metric'` the summary reads `150.0 g` |
| **AC-11** | **`MashSection` volume figures convert; temperatures still work** | Component (`MashSection.test.tsx`) | With `mashPlan.strikeWaterL = 15.5`, a step whose `infusionVolumeL = 8` and `mashVolumeAfterL = 23.5`, and `mashWaterBalanceL = -2`: under `unitSystem: 'us'` the rendered output contains `4.09 gal`, `2.11 gal`, `6.21 gal`, and the water-balance warning contains `0.53 gal`. Under `'metric'` those read `15.5 L`, `8.0 L`, `23.5 L`, `2.0 L` — byte-identical to today's rendering. *(Corrected 2026-08-14, rule-7 lightweight fix, no code change: this cell originally pinned `0.5 L` for the metric water-balance figure, a transcription slip inconsistent with this same row's own `0.53 gal` pin for the identical fixture — `Math.abs(-2)=2`, and `2 × 0.264172 ≈ 0.53`, not `0.5 × 0.264172 ≈ 0.13`. Caught by the executor while writing the AC-11 follow-up test during M7_P2's second execution pass; verified arithmetically before correcting.)* In the **same** render, M7_P1's AC-23/AC-29 temperature behavior is re-asserted unbroken (strike temperature in the configured temperature unit) |
| **AC-12** | **`FermentableSection` grain total converts, closing M7_P1's mixed-unit residue** | Component (`FermentableSection.test.tsx`, new) | With `totalGrainKg = 5` and `unitSystem: 'us'` the `Total:` figure reads `11.02 lb`; under `'imperial'`, `11.02 lb`; under `'metric'`, `5.00 kg`. The per-fermentable `Amount (kg)` input column and header are unchanged, and a fermentable whose amount is `2.5` still renders `2.5` in its input. The string produced here is **identical** to what `StatsHeader` renders for the same `totalGrainKg` under the same config |
| **AC-13** | **`RecipeLibrary` and `EquipmentManager` batch sizes convert; ratio rows do not** | Component (`RecipeLibrary.test.tsx`, `EquipmentManager.test.tsx`) | With a recipe summary of `batchSizeL = 20` and `unitSystem: 'us'`, the library row meta contains `5.28 gal` and not `20 L`. With an equipment profile of `batchSizeL = 20`, `mashWaterRatioLPerKg = 3`, `grainAbsorptionLPerKg = 1.1` under the same config, the manager row contains `5.28 gal batch` **and still contains** `3 L/kg mash water` and `1.1 L/kg absorption` unconverted (Ambiguity 5). Under `'metric'` the batch figures read `20.0 L` |
| **AC-14** | **`App.tsx`: picker labels convert, the scale modal deliberately does not** | Component (`App.test.tsx`) | With an equipment profile of `batchSizeL = 20` and `unitSystem: 'us'`, the equipment-picker `<option>` labels contain `5.28 gal`. In the scale-recipe modal under the **same** config, `Current Batch Size` still reads `20 L` (Ambiguity 7), and the target-size input's label contains the literal annotation `(L)`. Both assertions are made in the same test file so the exception cannot be silently "fixed" into an inconsistency later |
| **AC-15** | **No inline conversion math, and the new constants live in exactly one file** | Verification (grep) | A repo-wide grep over `apps/web/src` for the literals `0.264172`, `0.219969`, `28.3495`, `3.785`, `4.546`, and `2.20462` returns **zero** matches outside comments. A grep over `packages/calculations/src` for `0.219969` and `28.349523125` returns matches in **`config.ts` only** (one occurrence each). `formatVolume` and `formatHopMass` each have **at least one non-test caller** under `apps/web/src`. `convertVolume('us')`'s implementation contains no numeric literal — it delegates to `lToUsGal` (§2.4) |
| **AC-16** | **One screen, one unit — no stale suffixes, no dead helper** | Component (`StatsHeader.test.tsx`, `MashSection.test.tsx`) | With `unitSystem: 'us'` active, `StatsHeader`'s full rendered text matches **neither** `/\d\s*L\b/` **nor** `/\d\s*g\b/` (no litre or gram figure survives), and `MashSection`'s full rendered text matches neither `/\d\s*L\b/` nor the doubled-suffix pattern `/gal\s*L/`. Under `'metric'` neither component's text contains `gal` or ` oz`. The identifier `fmt` no longer appears in `MashSection.tsx` (§2.4) |
| **AC-17** | **Canonical storage integrity — a unit change writes nothing** | Component/Integration (`App.test.tsx`) | Rendering the recipe editor under `unitSystem: 'us'` and then under `'imperial'` issues **zero** `fetch` calls with method `PUT`, `POST`, or `PATCH` to any URL other than `/api/config` (and none at all when the config is supplied pre-resolved). The `recipe`/`equipment` objects handed to the components are deeply equal, after render, to a frozen copy taken before render — no converted value is written back into app state |
| **AC-18** | **Lockstep: one config change, all consumers update in one commit** | Component/Integration (`App.test.tsx`) | Within a single mounted app whose `GET /api/config` resolves to `unitSystem: 'metric'`, `StatsHeader` shows `20.0 L` and `MashSection` shows `15.5 L`. After `applyConfig` sets `unitSystem: 'us'` (no remount, no refetch, no page reload), **both** show `5.28 gal` and `4.09 gal` respectively, and `GET /api/config` has still been called exactly **once** in total |
| **AC-19** | **The US/Imperial distinction reaches the screen, not just the pure layer** | Component (`StatsHeader.test.tsx`) | With `equipment.batchSizeL = 20`, the rendered batch-size text under `unitSystem: 'us'` and under `'imperial'` are **different strings** (`5.28 gal` vs `4.40 imp gal`). This is asserted at the component level specifically because AC-2 alone would pass even if a component hardcoded `'us'` when calling `formatVolume` |
| **AC-20** | **Test gate** | Command | `npm test` exits **0** across all four workspaces, with **0** failures and no reduction in the passing-test count relative to the M7_P1 close baseline (1075 passed / 2 skipped) |
| **AC-21** | **Typecheck gate** | Command | `npm run typecheck` exits **0** across all four projects |
| **AC-22** | **Build gate** | Command | `npm run build` exits **0** |
| **AC-23** | **Lint gate** | Command | `npm run lint` exits **0**, introducing no new warning beyond the pre-existing `ConfigContext.tsx` / `CatalogContext.tsx` react-hooks warnings |
| **AC-24** | **Scope guardrail** | Manifest Diff | §1.3's New + Modified tables are the complete set of files that may change. Verified by a SHA-256 content manifest captured **before the executor's first edit** and again at the end — `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum` — and diffed. **`git diff --name-only` against a base commit is NOT usable in this repository and must not be substituted:** the repo has exactly one commit (`7d88e64`) with ~125 dirty paths, so no commit represents this phase's starting state — the same finding M7_P1's AC-28 recorded. Every path whose hash changed must appear in §1.3's tables; every §1.3 "Modified" path must actually have changed; **no path on §1.3's Untouched list may have changed**. Any deviation is disclosed in §4 before verification, not after |

---

## 4. Deviation Register

### Deviation 1 — Metric volume and hop figures gain a fixed decimal place

**Status: disclosed, intentional, pinned by AC-4/AC-5/AC-8/AC-11.**

`StatsHeader` today renders `{stats.mashWaterL} L` and `{stats.totalHopG} g` with no formatting, so a stored `20` prints `20 L` and `150` prints `150 g`. Routing them through `formatVolume`/`formatHopMass` applies `toFixed(1)`, so a `'metric'` user — i.e. the default configuration, i.e. every existing user — sees `20.0 L` and `150.0 g` instead. `MashSection` is unaffected (its `fmt()` already applied `toFixed(1)`), and `FermentableSection`'s grain total moves from `5 kg` to `5.00 kg` for the same reason (M7_P1's `formatMass` default of 2).

This is a real, user-visible change to numbers on a default-configured screen, so it is recorded here rather than discovered at verification. It is judged correct: a stats row where one figure reads `20 L` and its neighbor `15.5 L` is inconsistent already, and any existing test asserting the bare form must be updated with a comment flag (§1.3).

*Reversal path, if overruled at this halt gate:* give `formatVolume`/`formatHopMass` a `'metric'` branch that returns `String(litres)` unformatted. Cheap to implement, but it makes the metric branch behave unlike every other formatter in the module and unlike M7_P1's `formatMass`, so it is not the recommendation.

### Deviation 2 — Input fields remain metric, so one mixed-unit surface survives on purpose

**Status: disclosed scope boundary, inherited from M7_P1 §4 Deviation 3, guarded by AC-10 and AC-14.**

After this phase a `'us'`-configured user sees converted **display** figures everywhere (`5.28 gal`, `5.29 oz`, `11.02 lb`) while still **typing** grams, kilograms, and litres into the hop amount, fermentable amount, equipment, batch-measurement, and scale-target inputs — each of which remains explicitly labeled with its metric unit. Ambiguity 7's scale-modal exception is the one place this is deliberately made visually consistent rather than converted.

This is the same bounded stopping point M7_P1 chose and for the same reason: converting inputs means round-tripping user-entered values through conversion on every keystroke, which raises precision drift, cursor behavior, and canonical-storage-integrity questions (Key Behavior 1) that deserve their own criteria rather than a footnote in a display phase.

*Follow-on:* a future phase covering converted **input** fields with an explicit canonical-storage round-trip criterion — the item M7_P1 §4 Deviation 3's follow-on note already anticipated. It is **not** required to close M7, whose stated outcome is that the user's saved unit and formula choices follow them across the app's *displays*.

### Deviation 3 — `'us'` and `'imperial'` still differ only in volume

**Status: disclosed, intentional.**

Both systems share the avoirdupois pound and ounce, so `formatMass` and `formatHopMass` return identical strings for both — as M7_P1's §2.2.1 already noted for mass and as AC-5 re-asserts deliberately. After this phase, volume is the **only** dimension where selecting `'imperial'` instead of `'us'` changes anything on screen. That is physically correct, not an incomplete implementation, and is recorded so it is not later filed as a bug.

### Deviation 4 — Ratio, compound, and non-hop gram units are not converted

**Status: disclosed scope boundary (Ambiguities 5 and 6), guarded by AC-13.**

`L/kg` (mash water ratio, grain absorption), `L/hr` (boil-off rate), `g/L` (priming-sugar equivalent), `mEq/L` (residual alkalinity), and the gram figures for priming sugar and water minerals all stay metric. Each needs a target unit this codebase has no precedent for choosing (`L/kg` conventionally becomes `qt/lb`, not `gal/lb`; `mEq/L` has no US-customary form at all), and two of them live in M5_P2/M6 surfaces this phase has no other reason to open. AC-13 asserts the `L/kg` rows are still present and unconverted, so this deviation is measured rather than assumed.

---

> **HALT GATE (STATE 2):** Two decisions want a human before execution begins.
>
> **(a) §4 Deviation 1 — every default-configured (metric) user's screen changes slightly.** `20 L` becomes `20.0 L`, `150 g` becomes `150.0 g`, `5 kg` becomes `5.00 kg`. This is the one user-visible change that lands for users who never open Settings, and there is a documented one-branch reversal if it is not wanted.
>
> **(b) Ambiguity 2 and Ambiguity 7 — two small UI judgments.** Imperial volumes are labeled `imp gal` rather than `gal`, because unlike pounds the *numbers* differ (20 L is `5.28` US gal but `4.40` imp gal) and one shared label would be a misreading hazard. And the scale modal's `Current Batch Size` deliberately stays in litres — it sits directly above a litre-denominated input, and converting only the display half invites a user to type gallons into a litre box.
>
> Also worth a glance before approving: **Ambiguity 8** folds `FermentableSection`'s grain total into this phase (one line, existing helper) because M7_P1 left a `11.02 lb` header and a `5 kg` card on the same screen; and **§1.3's Untouched list** is deliberately broad — `apps/api/**`, `shared-types/**`, `BatchDetail.tsx`, `EquipmentForm.tsx`, and `brewingMath.ts` are all explicitly out.
>
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
