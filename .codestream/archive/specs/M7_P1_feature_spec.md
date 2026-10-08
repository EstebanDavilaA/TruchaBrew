# FEATURE SPECIFICATION: M7_P1 — Units and formula choices that follow me everywhere

- **Milestone:** M7 (Units and formula choices that follow me everywhere)
- **Phase:** P1 (User configuration persistence, unit conversions, configurable IBU/ABV formula strategy functions, and UI Settings page)
- **Depends on:** Milestone 6 (Water chemistry and mineral additions), Milestone 5.5 (UI Shell & TopBar/Sidebar navigation).
- **Layer:** End-to-end (Database schema & migration 0010, shared types, calculation engine formula strategies, REST API, web UI components, and recipe/batch display layer).

---

## AMENDMENT NOTE (2026-08-13)

> **This spec was amended in place after the M7_P1 critic pass (`/.gsd/archive/CRITIC_REPORT.md`, M7_P1 section). It supersedes the previously-approved text and requires re-approval with `SPEC_APPROVED`.**
>
> **What changed, and only this:**
>
> 1. **New §1.4** — an amendment-only file inventory covering the live-wiring work. §1.3's New/Modified tables are **byte-unchanged**; §1.4 is additive.
> 2. **New §2.2** — the display-layer formatting contract (`formatGravity`, `formatTemperature`, `formatMass`, `convertMass`, `massUnitLabel`), the `ConfigContext` stateful contract, and the amended `calculateRecipeStats` options contract. §2.1 is **byte-unchanged**.
> 3. **New AC-14 … AC-28** appended to §3. **AC-1 … AC-13 are byte-unchanged and are not renumbered.** These close the gap the critic identified as F-2: the phase's own Key Behaviors 1/2/4, Phase Summary point 5, §1.3's charges to `brewingMath.ts` and `App.tsx`, and Resolved Ambiguity 4's named helper functions all require the saved config to actually change what the app displays and calculates — and AC-1…AC-13 tested none of it. The executor built exactly what the matrix demanded and passed it, while changing a setting still moves zero numbers anywhere in the application. The remedy is a criterion that pins the wiring, not a quiet acceptance that "no AC required it".
> 4. **New §4 Deviation Register** — deviation 1 (Garetz is an explicitly-approximate placeholder and must be labeled as such in the UI, per AC-27), deviation 2 (routing ABV through the config changes the default on-screen ABV from Balling to Simple), deviation 3 (hop-gram→oz and volume L→gal display are deferred out of this phase).
>
> **Explicitly NOT changed by this amendment:** AC-4's text and Resolved Ambiguities §2's Tinseth formula. The missing `× hopUtilizationPct/100` term (critic finding F-1) is a pure implementation defect against already-correct pinned spec text; it is fixed at the `/execute` layer with no spec change. AC-22 below is a *wiring/consolidation* criterion and composes with that fix — it does not restate or relax it.

## SECOND AMENDMENT NOTE (2026-08-13) — bookkeeping closure only

> **This is a small, purely additive second amendment, made in place after the M7_P1 SECOND critic pass (`.gsd/archive/CRITIC_REPORT.md`, "M7_P1 (SECOND PASS)" section, 2026-08-13). It closes two spec-layer bookkeeping gaps that pass through as criterion failures even though no implementation defect underlies them. It requires re-approval with `SPEC_APPROVED`.**
>
> **What changed, and only this:**
>
> 1. **New §1.3.1 — Named-exception addendum to §1.3 (closes AC-13).** The first execution pass changed six paths (five work items) that §1.3's literal tables never listed, five of which are structurally *mandated* by other parts of this same spec (§1.1's migration, Key Behavior 5's navigation). Both critic passes independently confirmed every one of them mechanically necessary with zero scope creep. §1.3's own tables remain byte-unchanged; §1.3.1 carves the exceptions beside them, in the same named-exception form this project has already used at M2_P1 (`brewingMath.test.ts`), M3_P1 (findings 5 and 6), M3_P2 (`equipment.migration.test.ts`, `errors.test.ts`), and M4_P1. This is the sixth occurrence of an identical recurring gap class and is closed the same way.
> 2. **New AC-29 (closes critic Finding 2).** Fermentation-schedule step temperatures in `MashSection.tsx` must route through `formatTemperature` like every other temperature in that component.
>
> **AC-1 … AC-28 are byte-unchanged and are not renumbered — including AC-13 and AC-25.** AC-13's existing text reads "matches **specified** new/modified files exactly"; §1.3.1 is what *specifies* those files, so no edit to the criterion itself is needed or permitted. AC-25's text was already corrected separately under hard rule 7 (lightweight-task exception) following critic Finding 4 and is left exactly as found.
>
> **Not addressed here, by design:** AC-22 (Finding 1, the two live `TINSETH_BIGNESS_BASE` constants) and AC-19 (Finding 3, `{stats.abv}%` printing `9%` where `9.0%` is pinned). Per the second critic pass's own routing, AC-22 is a decision that must go through `/diagnose` before any spec text moves, and AC-19 is an `/execute`-layer implementation fix against already-correct spec text. Neither is folded into this bookkeeping amendment.

---

## Phase Summary

Milestone 7 introduces application-wide user configuration preferences for units of measure and brewing formula strategies. Storage in SQLite remains strictly canonical (metric masses/volumes in kg/g/L, temperatures in °C, and specific gravity in SG). The display and calculation layers adapt dynamically to the user's saved preferences:

1. **User Configuration Storage**: Stored single-user configuration settings containing unit systems (Metric, US Customary, Imperial), specific gravity vs. Plato preference, temperature unit (°C vs °F), IBU formula strategy (Tinseth, Rager, Garetz), and ABV formula strategy (Simple vs. Balling).
2. **Standardized Unit Conversion Engine**: Pure functions in `@truchabrew/calculations` for losslessly converting between metric and US/Imperial units, °C and °F, and SG and °Plato ($^\circ\text{P} = -668.96 + 1262.45 \times \text{SG} - 776.43 \times \text{SG}^2 + 182.94 \times \text{SG}^3$).
3. **Swappable Formula Strategy Engine**: Parameterized and strategy-driven calculation functions for IBU (Tinseth, Rager, Garetz) and ABV (Simple: $(OG - FG) \times 131.25$, Balling: $\frac{132.715 \times (OG - FG)}{FG}$).
4. **Backend REST API**: `/api/config` endpoints (`GET /api/config`, `PUT /api/config`) with JSON schema validation and default seeding.
5. **UI Settings View & Formatting Helpers**: Dedicated Settings manager page in `apps/web` with intuitive select controls for unit systems and formula strategies. Format helpers throughout the app leverage the active configuration without modifying underlying database storage values.

---

## Key Behaviors

1. **Canonical Storage Integrity**: Database schema and API payloads preserve canonical metric & SG values. Toggling display units in the UI changes rendered values and labels without mutating stored DB values or introducing floating-point drift.
2. **Configurable IBU Formulas**: Users can select between `Tinseth` (default), `Rager`, and `Garetz` hop utilization equations. Recalculating recipe or batch IBU honors the active strategy setting.
3. **Configurable ABV Formulas**: Users can select between `Simple` ($(OG - FG) \times 131.25$) and `Balling` ($\frac{132.715 \times (OG - FG)}{FG}$) ABV calculation methods.
4. **Gravity & Temperature Unit Display**: Gravity values can be displayed as Specific Gravity (e.g. `1.050`) or degrees Plato (e.g. `12.4 °P`). Temperature values convert between °C and °F ($^\circ\text{F} = \text{C} \times \frac{9}{5} + 32$).
5. **Settings Page Navigation**: Settings view accessible via sidebar/topbar. Changing settings updates application state and persists immediately via `PUT /api/config`.

---

## Resolved Ambiguities (Binding)

1. **Unit System Enum & Definitions**:
   - `unitSystem`: `'metric'` (kg, g, L, °C), `'us'` (lb, oz, gal, °F), `'imperial'` (lb, oz, Imp gal, °F).
   - `gravityUnit`: `'sg'` (e.g. `1.050`), `'plato'` (e.g. `12.4 °P`).
   - `temperatureUnit`: `'celsius'` (`°C`), `'fahrenheit'` (`°F`).
   - `ibuFormula`: `'tinseth'` (default), `'rager'`, `'garetz'`.
   - `abvFormula`: `'simple'` (default), `'balling'`.
2. **Formula Mathematics**:
   - **Tinseth IBU**: $BinetFactor = 1.65 \times 0.000125^{\text{bGrava}-1}$, $TimeFactor = \frac{1 - e^{-0.04 \times t}}{4.15}$, $Utilization = BinetFactor \times TimeFactor \times \frac{hopUtilizationPct}{100}$. *(Corrected 2026-08-14, rule-7 lightweight fix, no code change: the constant was `0.0001254` in this spec's original text, a transcription-drift digit not present in the source build-spec document or in M1_P1's already-approved `TINSETH_BIGNESS_BASE = 0.000125`. AC-22 requires the strategy path to agree exactly with the pre-existing engine, and honoring the literal `0.0001254` would have broken M1's approved fixtures — the third-pass critic independently confirmed `0.000125` is correct and the spec digit was the error. See §4 deviation 4.)*
   - **Rager IBU**: $Utilization = 0.1811 + 0.0838 \times \tanh\left(\frac{t - 31.32}{14.6}\right)$, Gravity Adjustment $GA = \max(0, \frac{\text{boilGravity} - 1.050}{0.2})$. $IBU = \frac{\text{weightGrams} \times (\text{alphaPct} / 100) \times Utilization \times 1000}{\text{volumeLters} \times (1 + GA)}$.
   - **Garetz IBU**: Uses Garetz temperature, concentration, and elevation factor adjustments.
   - **Simple ABV**: $\text{ABV} = (\text{OG} - \text{FG}) \times 131.25$.
   - **Balling ABV**: $\text{ABV} = \frac{132.715 \times (\text{OG} - \text{FG})}{\text{FG}}$.
3. **Single User Default Configuration**:
   - Primary key in SQLite `user_config` table is fixed to `'default'`.
   - Initial seeded config: `{ unitSystem: 'metric', gravityUnit: 'sg', temperatureUnit: 'celsius', ibuFormula: 'tinseth', abvFormula: 'simple' }`.
4. **No Inline Conversions**:
   - All unit conversions and formula strategies must be executed via exported utility functions in `@truchabrew/calculations` (e.g., `formatGravity`, `formatTemperature`, `convertMass`, `calculateIbuWithStrategy`). No component may perform hardcoded `(c * 9)/5 + 32` inline math.

---

## 1. Data Schema & Contracts

### 1.1 Database Migration `0010_user_config.sql` (Additive)

```sql
CREATE TABLE IF NOT EXISTS `user_config` (
  `id` text PRIMARY KEY NOT NULL DEFAULT 'default',
  `unit_system` text NOT NULL DEFAULT 'metric',
  `gravity_unit` text NOT NULL DEFAULT 'sg',
  `temperature_unit` text NOT NULL DEFAULT 'celsius',
  `ibu_formula` text NOT NULL DEFAULT 'tinseth',
  `abv_formula` text NOT NULL DEFAULT 'simple',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO `user_config` (`id`, `unit_system`, `gravity_unit`, `temperature_unit`, `ibu_formula`, `abv_formula`)
VALUES ('default', 'metric', 'sg', 'celsius', 'tinseth', 'simple');
```

### 1.2 Shared Types (`packages/shared-types/src/config.ts`)

```typescript
export type UnitSystem = 'metric' | 'us' | 'imperial';
export type GravityUnit = 'sg' | 'plato';
export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type IbuFormulaStrategy = 'tinseth' | 'rager' | 'garetz';
export type AbvFormulaStrategy = 'simple' | 'balling';

export interface UserConfig {
  id: string;
  unitSystem: UnitSystem;
  gravityUnit: GravityUnit;
  temperatureUnit: TemperatureUnit;
  ibuFormula: IbuFormulaStrategy;
  abvFormula: AbvFormulaStrategy;
}

export interface UserConfigInput {
  unitSystem?: UnitSystem;
  gravityUnit?: GravityUnit;
  temperatureUnit?: TemperatureUnit;
  ibuFormula?: IbuFormulaStrategy;
  abvFormula?: AbvFormulaStrategy;
}
```

### 1.3 Symbol Inventory

**New Files:**
- `packages/shared-types/src/config.ts` (UserConfig & strategy types)
- `packages/calculations/src/config.ts` (Unit conversion & formula strategy helpers)
- `packages/calculations/test/config.test.ts` (Unit conversion & formula strategy unit tests)
- `apps/api/src/routes/config.ts` (Fastify REST endpoints GET/PUT `/api/config`)
- `apps/api/test/config.test.ts` (API route integration tests)
- `apps/web/src/components/SettingsManager.tsx` (Settings view UI component)
- `apps/web/test/SettingsManager.test.tsx` (Settings view component tests)

**Modified Files:**
- `packages/shared-types/src/index.ts` (Re-exports config types)
- `packages/calculations/src/index.ts` (Re-exports unit & strategy functions)
- `packages/calculations/src/brewingMath.ts` (Updates ABV and IBU calculations to support strategy choices)
- `apps/api/src/db/schema.ts` (Drizzle schema for `user_config` table)
- `apps/api/src/db/seed.ts` (Seeds default `user_config` row)
- `apps/web/src/App.tsx` (Loads user config, passes config context/state, routes Settings view)

### 1.3.1 Named-Exception Addendum to §1.3 (ADDED 2026-08-13, second amendment — closes AC-13)

§1.3's New/Modified tables above remain **byte-unchanged**. The six paths below are additionally in scope for AC-13's manifest, as **named exceptions**. Each was changed during the *first* execution pass; each is either directly mandated by another binding section of this same spec or is mechanically required for an already-listed criterion to pass at all. Both M7_P1 critic passes independently reviewed all six and found no scope creep.

| Path | Status | Why it is in scope — the binding clause it serves |
|------|--------|----------------------------------------------------|
| `apps/api/drizzle/0010_user_config.sql` | New | **§1.1 mandates this file by name and pins its exact SQL body.** §1.3's New-file table simply failed to restate it. AC-5 cannot pass without it. This is a §1.3 transcription omission, not an executor decision. |
| `apps/api/drizzle/meta/_journal.json` | Modified | Drizzle's migration runner will not apply `0010_user_config.sql` without a corresponding journal entry. Mechanically inseparable from the row above; AC-5 fails without it. Edit permitted is **exactly one appended journal entry for migration 0010** — no other entry may be altered or reordered. |
| `apps/api/src/server.ts` | Modified | Registering the `apps/api/src/routes/config.ts` plugin (a §1.3 New file) on the Fastify instance. Without this two-line registration the route is unreachable and **AC-6, AC-7 and AC-8 all fail**. Edit permitted is the import plus the `register` call for the config routes only — no other route, hook, or server option may change. |
| `apps/api/test/seed.test.ts` | Modified | §1.3 lists `apps/api/src/db/seed.ts` as Modified (seeding the default `user_config` row). That seed change moves this test's asserted table count by one. Edit permitted is **the table-count expectation only**; no assertion may be deleted or weakened. |
| `apps/web/src/components/Sidebar.tsx` | Modified | **Key Behavior 5** requires the Settings view to be "accessible via sidebar/topbar". Without a Settings entry here, `SettingsManager.tsx` (a §1.3 New file) is unreachable by any user action and Key Behavior 5 is unmet. Edit permitted is the single Settings navigation entry. |
| `apps/web/test/Sidebar.test.tsx` | Modified | The nav-item assertions forced by the row above. |

**Interaction with AC-28 — binding, and deliberately asymmetric.** These six paths are in scope for **AC-13** (which measures the *first* execution pass) and remain on §1.4's **Untouched** guardrail list for **AC-28** (which measures the *amendment* pass). They are already correct as landed; the live-wiring work needs no further change to any of them. A path may therefore legitimately appear in §1.3.1 and in §1.4's Untouched list at the same time, and that is not a contradiction: the two criteria measure two different, non-overlapping change windows.

**Not a licence to broaden scope.** §1.3.1 is a historical-accuracy correction to an inventory that was already incomplete when it was approved. It grants no new work. Each row's "edit permitted" clause is exhaustive; anything beyond it is out of scope and fails AC-13 as surely as an unlisted file would.

### 1.4 Amendment File Inventory (ADDED 2026-08-13 — additive to §1.3, which is unchanged)

The live-wiring work required by AC-14…AC-28 touches these files **in addition to** §1.3's tables. AC-28's manifest is the union of §1.3 and §1.4; nothing outside that union may change.

**New Files (amendment):**

| Path | Charge |
|------|--------|
| `apps/web/src/context/ConfigContext.tsx` | `ConfigProvider` + `useConfig()`. Single source of truth for the loaded `UserConfig`. Modeled on the existing `apps/web/src/context/CatalogContext.tsx` — same provider/hook shape, same throw-outside-provider convention. |
| `apps/web/test/ConfigContext.test.tsx` | Provider/hook tests: mount load, loading state, error state, `applyConfig` propagation. |

**Modified Files (amendment):**

| Path | Permitted edits — exhaustive |
|------|------------------------------|
| `packages/calculations/src/config.ts` | Add `DEFAULT_USER_CONFIG`, `formatGravity`, `formatTemperature`, `convertMass`, `massUnitLabel`, `formatMass` per §2.2.1. Reconcile the Tinseth strategy path so it agrees with the engine (AC-22). No other existing export's signature changes. |
| `packages/calculations/src/index.ts` | Add the six new names above to the existing explicit `export { … } from './config'` list. The `kgToLb` collision note and its exclusion stay exactly as they are. |
| `packages/calculations/src/brewingMath.ts` | `calculateRecipeStats` gains the optional second parameter of §2.2.3 and dispatches ABV/IBU accordingly. **This honors §1.3's existing charge to this file, which the first execution pass left byte-unchanged.** No other exported function's signature changes. |
| `packages/calculations/test/config.test.ts` | Add cases for the new helpers and AC-22's equality property. Existing cases unchanged except AC-3's tolerance may tighten. |
| `packages/calculations/test/brewingMath.test.ts` | **Narrow named exception.** Add cases for the new options parameter only. Existing assertions must remain green **unmodified** — AC-21's back-compat rule exists precisely so this file needs no edits to its current expectations. Comment lines permitted. |
| `apps/web/src/App.tsx` | Wrap the routed views in `ConfigProvider`; no config fetching logic inline in `App.tsx` itself beyond mounting the provider. |
| `apps/web/src/components/SettingsManager.tsx` | Replace the private `useState<UserConfig \| null>` with `useConfig()`; keep the existing optimistic-update-and-revert behavior and its error surfaces intact; relabel the Garetz option and add its caveat note (AC-27). The local `requestConfig`/`getConfig`/`putConfig` helpers **move into `ConfigContext.tsx`** rather than being duplicated. |
| `apps/web/src/components/StatsHeader.tsx` | Accept the active `UserConfig`; render gravity, ABV, IBU, and grain mass through the §2.2.1 helpers; replace the two hardcoded formula captions (`"Balling Formula"`, `"Tinseth"`) with the active strategy's name. |
| `apps/web/src/components/MashSection.tsx` | Render strike / sparge / step temperatures through `formatTemperature`. No change to `MashPlan` or to any calculation. |
| `apps/web/src/hooks/useRecipeEditor.ts` | Pass the active config's strategies into `calculateRecipeStats`. No change to the hook's other responsibilities. |
| `apps/web/src/pages/BatchDetail.tsx` | Pass the active config into the **fallback recompute path only** — see §2.2.4. `batch.statsSnapshot`, when present, is rendered as stored. |
| `apps/web/test/SettingsManager.test.tsx`, `apps/web/test/StatsHeader.test.tsx`, `apps/web/test/MashSection.test.tsx`, `apps/web/test/App.test.tsx`, `apps/web/test/BatchDetail.test.tsx` | Provider-wrapping and new-assertion edits forced by the above. Any existing assertion whose *expected value* changes must be individually comment-flagged for the critic with the reason. |

**Untouched (guardrail — AC-28):** `apps/api/**` in its entirety (no API, route, schema, migration, seed or API-test change is required or permitted by this amendment — the `/api/config` surface already passes AC-6/7/8 live), `packages/shared-types/**` (the `UserConfig` contract is already correct and complete), `apps/web/src/api/client.ts`, `apps/web/src/context/CatalogContext.tsx`, `apps/web/src/components/Sidebar.tsx`, and every `apps/web/src/components/*Manager.tsx` / `*Form.tsx` not named above.

---

## 2. Transformations & Pure Logic

### 2.1 Pure Logic Functions (`packages/calculations/src/config.ts`)

```typescript
export function sgToPlato(sg: number): number;
export function platoToSg(plato: number): number;
export function celsiusToFahrenheit(c: number): number;
export function fahrenheitToCelsius(f: number): number;
export function kgToLb(kg: number): number;
export function lbToKg(lb: number): number;
export function lToUsGal(l: number): number;
export function usGalToL(gal: number): number;

export function calculateAbvWithStrategy(og: number, fg: number, strategy: AbvFormulaStrategy): number;
export function calculateRecipeIbuWithStrategy(
  recipe: Recipe,
  strategy: IbuFormulaStrategy
): number;
```

### 2.2 Amendment Contracts (ADDED 2026-08-13 — §2.1 unchanged)

#### 2.2.1 Pure display helpers (`packages/calculations/src/config.ts`)

These are the functions Resolved Ambiguity 4 already names as binding. None of them existed after the first execution pass; the only `formatGravity`/`formatTemperature` in the repository are unrelated private helpers inside `FermentationChart.tsx` that perform no unit conversion and are not the ones meant here.

```typescript
export const DEFAULT_USER_CONFIG: UserConfig; // exactly { id: 'default', unitSystem: 'metric', gravityUnit: 'sg', temperatureUnit: 'celsius', ibuFormula: 'tinseth', abvFormula: 'simple' } — identical to the values migration 0010 seeds

export function formatGravity(sg: number, unit: GravityUnit): string;
export function formatTemperature(celsius: number, unit: TemperatureUnit, fractionDigits?: number): string;
export function convertMass(kg: number, system: UnitSystem): number;
export function massUnitLabel(system: UnitSystem): 'kg' | 'lb';
export function formatMass(kg: number, system: UnitSystem, fractionDigits?: number): string;
```

**Binding behavior — no latitude:**

| Function | `unit` / `system` | Returns |
|----------|-------------------|---------|
| `formatGravity` | `'sg'` | `sg.toFixed(3)`, **no suffix** (preserves today's `1.050` rendering exactly) |
| `formatGravity` | `'plato'` | `` `${sgToPlato(sg).toFixed(1)} °P` `` — e.g. `"12.4 °P"` |
| `formatTemperature` | `'celsius'` | `` `${celsius.toFixed(fractionDigits)} °C` `` |
| `formatTemperature` | `'fahrenheit'` | `` `${celsiusToFahrenheit(celsius).toFixed(fractionDigits)} °F` `` |
| `convertMass` | `'metric'` | `kg` unchanged (identity — **not** a rounded value) |
| `convertMass` | `'us'` \| `'imperial'` | `kg * 2.20462` (the existing `POUNDS_PER_KG`; both systems use the avoirdupois pound, so they are identical here and that is intentional, not an oversight) |
| `massUnitLabel` | `'metric'` / `'us'` / `'imperial'` | `'kg'` / `'lb'` / `'lb'` |
| `formatMass` | any | `` `${convertMass(kg, system).toFixed(fractionDigits)} ${massUnitLabel(system)}` `` |

- `fractionDigits` defaults: `formatTemperature` → `1`; `formatMass` → `2`.
- **Degenerate input, binding:** if the numeric input is `NaN` or non-finite, every `format*` function returns the single em-dash string `"—"` and performs no conversion. It must never return `"NaN °P"`, `"Infinity"`, or `"0"`. `convertMass` returns `NaN` unchanged (it is a converter, not a formatter, and must not fabricate a zero).
- **No rounding before conversion.** `formatGravity(sg, 'plato')` converts the full-precision SG and rounds once, at the end. Rounding to 3 decimals first and then converting is a defect.

#### 2.2.2 Stateful contract — `apps/web/src/context/ConfigContext.tsx`

```typescript
export interface ConfigContextValue {
  config: UserConfig;                        // never null — see the fallback rule below
  status: 'loading' | 'ready' | 'error';
  error: string | null;                      // non-null only when status === 'error'
  applyConfig: (next: UserConfig) => void;   // replaces the shared config (used by SettingsManager after a successful PUT)
  reload: () => void;
}

export function ConfigProvider(props: { children: React.ReactNode }): JSX.Element;
export function useConfig(): ConfigContextValue;  // throws outside a provider, same as useCatalog()
```

**Fallback rule, and the caller branching it requires — binding.** Before the mount-time `GET /api/config` resolves, and if it fails, `config` is `DEFAULT_USER_CONFIG` and `status` is `'loading'` / `'error'` respectively. This is a *rendering* fallback only, and it is safe precisely because those values are byte-identical to what migration 0010 seeds — the same idempotent-defaults reasoning the API's `getOrCreateDefaultConfig` already uses. Two prohibitions follow, and AC-16 tests both:

- **The fallback must never be persisted.** No code path may `PUT` `DEFAULT_USER_CONFIG`, or any value derived from it, while `status !== 'ready'`.
- **The Settings view must never present the fallback as the user's saved settings.** `SettingsManager` branches on `status`: `'loading'` renders a loading state, `'error'` renders the existing error panel with a retry that calls `reload()`, and only `'ready'` renders the five selects. Display surfaces (StatsHeader, MashSection) may render against the fallback, because a default-configured user's screen is identical either way.

`ConfigProvider` owns the `GET`/`PUT` helpers currently living inside `SettingsManager.tsx`; they are moved, not duplicated.

#### 2.2.3 Amended engine entry point (`packages/calculations/src/brewingMath.ts`)

```typescript
export interface RecipeStatsOptions {
  abvFormula?: AbvFormulaStrategy;
  ibuFormula?: IbuFormulaStrategy;
}

export function calculateRecipeStats(recipe: Recipe, options?: RecipeStatsOptions): CalculatedStats;
```

**Binding back-compatibility rule.** When `options` is omitted, or a field within it is omitted, `calculateRecipeStats` behaves **exactly as it does today**: ABV via `abvBalling`, IBU via the existing `calculateSingleHopIbu` loop. The omitted-field default is *legacy behavior*, **not** `DEFAULT_USER_CONFIG`'s `'simple'`/`'tinseth'`. This keeps every existing caller and every existing test numerically identical, and confines the user-visible change to the two call sites that explicitly opt in. `CalculatedStats`'s shape does not change.

#### 2.2.4 Which call sites pass config — binding

| Call site | Passes config? | Rule |
|-----------|----------------|------|
| `useRecipeEditor.ts:148` (live recipe editor) | **Yes** | The recipe being edited is a live calculation and follows the active config. |
| `BatchDetail.tsx:158`, `batch.statsSnapshot` present | **No** | A snapshot is a historical record of what was actually brewed. It is rendered as stored and is never recomputed under a newly-selected strategy. |
| `BatchDetail.tsx:158`, fallback recompute (`statsSnapshot` null) | **Yes** | Nothing was recorded, so the active config governs. |

Gravity/temperature/mass *formatting* applies to snapshot values as normal — reformatting a stored number is a display change, not a recalculation.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | Unit Conversion Functions | Unit Test (`config.test.ts`) | `sgToPlato(1.050)` equals `12.37` °P; `celsiusToFahrenheit(20)` equals `68.0` °F; round-trip conversions return within $10^{-4}$ tolerance |
| **AC-2** | ABV Formula Strategy Simple | Unit Test (`config.test.ts`) | `calculateAbvWithStrategy(1.050, 1.010, 'simple')` equals `5.25`% ABV |
| **AC-3** | ABV Formula Strategy Balling | Unit Test (`config.test.ts`) | `calculateAbvWithStrategy(1.050, 1.010, 'balling')` equals `5.256`% ABV |
| **AC-4** | IBU Formula Strategy Tinseth vs Rager | Unit Test (`config.test.ts`) | Calculating recipe IBU under `'tinseth'` vs `'rager'` produces distinct, correct strategy-specific IBU values |
| **AC-5** | Database Migration 0010 | Integration (`config.test.ts`) | `0010_user_config.sql` applies cleanly to SQLite DB; `user_config` table created with default row |
| **AC-6** | GET /api/config | Integration (`config.test.ts`) | `GET /api/config` returns default `UserConfig` object with status 200 |
| **AC-7** | PUT /api/config | Integration (`config.test.ts`) | `PUT /api/config` updates configuration options and returns updated object with status 200 |
| **AC-8** | PUT /api/config Validation | Integration (`config.test.ts`) | Invalid unit or strategy enum values in `PUT /api/config` payload return status 400 |
| **AC-9** | Settings Manager UI Component | Component (`SettingsManager.test.tsx`) | Render Settings page with select controls for Unit System, Gravity Unit, Temperature Unit, IBU Strategy, and ABV Strategy |
| **AC-10** | Settings Persist on Change | Component (`SettingsManager.test.tsx`) | Selecting a new setting triggers `PUT /api/config` and updates global app config state |
| **AC-11** | Full Test Suite Gate | Command | `npm test` passes across all 3 workspaces (api, web, calculations) with 0 failures |
| **AC-12** | Typecheck & Build Gate | Command | `npm run typecheck` and `npm run build` exit 0 across all workspace projects |
| **AC-13** | Scope Guardrail | Manifest Diff | SHA-256 content manifest diff matches specified new/modified files exactly |

### 3.1 Amendment Criteria — AC-14 … AC-28 (ADDED 2026-08-13)

**AC-1 … AC-13 above are byte-unchanged and are not renumbered.** These criteria close critic finding F-2 (nothing consumes the config) and F-3 (the un-caveated Garetz label). Every one of them is a "does the code do this, yes or no" check.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-14** | **App loads the config on mount into shared state** | Component (`App.test.tsx` / `ConfigContext.test.tsx`) | Mounting `<App />` issues exactly **one** `GET /api/config` (not one per consuming component), and the resolved `UserConfig` becomes readable via `useConfig()` from any descendant. Asserted by mounting a probe consumer under `ConfigProvider` with a mocked `GET` returning `gravityUnit: 'plato'` and reading `'plato'` back out of the hook. Before this amendment `App.tsx` issued no `GET /api/config` at all — a passing run must show the call count go 0 → 1 |
| **AC-15** | **One config, one source of truth — closes AC-10's PARTIAL** | Component (`SettingsManager.test.tsx`) | `SettingsManager` reads and writes the shared context, **not** a private `useState<UserConfig \| null>`. Changing the Gravity select to `plato` fires `PUT /api/config` (AC-10, still holding) **and** a sibling probe component rendered under the same `ConfigProvider` observes `gravityUnit === 'plato'` without any remount or refetch. `grep -n "useState<UserConfig" apps/web/src/components/SettingsManager.tsx` returns **zero** matches. The existing optimistic-update-then-revert-on-failure path is preserved: on a 500 the sibling probe observes the value revert to its previous setting and the error panel renders |
| **AC-16** | **Fallback never leaks into state or into Settings** | Component (`ConfigContext.test.tsx`, `SettingsManager.test.tsx`) | Three parts. **(a)** With `GET /api/config` pending, `useConfig()` reports `status: 'loading'` and `config === DEFAULT_USER_CONFIG`, and **no** `PUT` request is issued. **(b)** With `GET` rejecting, `status: 'error'`, `error` is non-null, `SettingsManager` renders its error panel and **not** the five selects, and a retry control invokes `reload()` which re-issues the `GET`. **(c)** No network request with method `PUT` is observed at any point in (a) or (b) — the fallback is renderable but never persistable |
| **AC-17** | **The four named helpers exist, are root-exported, and are pinned** | Unit (`config.test.ts`) | `formatGravity`, `formatTemperature`, `convertMass`, `massUnitLabel`, `formatMass` and `DEFAULT_USER_CONFIG` are importable from **`@truchabrew/calculations`'s package root** (not only from `../src/config`). Pinned exactly: `formatGravity(1.050, 'sg') === "1.050"`; `formatGravity(1.050, 'plato') === "12.4 °P"`; `formatGravity(1.012, 'plato') === "3.1 °P"`; `formatTemperature(67, 'celsius') === "67.0 °C"`; `formatTemperature(67, 'fahrenheit') === "152.6 °F"`; `formatTemperature(20, 'fahrenheit') === "68.0 °F"`; `convertMass(5, 'metric') === 5`; `convertMass(5, 'us')` equals `11.0231` within `1e-9`; `formatMass(5, 'us') === "11.02 lb"`; `formatMass(5, 'metric') === "5.00 kg"`. Degenerate: `formatGravity(NaN, 'plato')`, `formatTemperature(NaN, 'fahrenheit')` and `formatMass(NaN, 'us')` each return `"—"`, and `Number.isNaN(convertMass(NaN, 'us'))` is true |
| **AC-18** | **Gravity actually renders in Plato on screen (the concrete end-to-end case)** | Component (`StatsHeader.test.tsx`) | With a fixture whose `stats.og = 1.050`, `stats.fg = 1.012` and config `gravityUnit: 'plato'`, the rendered Original Gravity tile contains the text **`12.4 °P`** and the Final Gravity tile contains **`3.1 °P`**; neither tile contains the substring `1.050` or `1.012`. With the same fixture and `gravityUnit: 'sg'`, the tiles contain **`1.050`** and **`1.012`** and no `°P` appears anywhere in the component. The pre-boil gravity sub-line follows the same rule. This is the criterion that fails today: changing this setting and reloading currently changes nothing on screen |
| **AC-19** | **ABV honors the configured strategy, value and caption** | Component (`StatsHeader.test.tsx`) + Unit | With `stats` derived from `og: 1.100`, `fg: 1.030`: under `abvFormula: 'simple'` the ABV tile renders **`9.2%`** and its caption reads **`Simple`**; under `'balling'` it renders **`9.0%`** and the caption reads **`Balling`**. (Pure-layer check: `calculateAbvWithStrategy(1.100, 1.030, 'simple')` = `9.1875` ±`1e-9`, `'balling'` = `9.019466019417484` ±`1e-9`.) The hardcoded string `Balling Formula` no longer appears in `StatsHeader.tsx`. This fixture is chosen deliberately: at typical gravities the two formulas agree to one decimal, so a low-gravity fixture cannot discriminate them |
| **AC-20** | **IBU honors the configured strategy, value and caption** | Component (`StatsHeader.test.tsx`) | With one fixed recipe fixture, the IBU rendered under `ibuFormula: 'rager'` differs from the value rendered under `'tinseth'` by **at least 1 whole IBU**, and the caption under the tile reads the active strategy's display name (`Tinseth` / `Rager` / `Garetz (approximate)`) rather than the hardcoded `Tinseth`. `grep -n '>Tinseth<\|"Tinseth"' apps/web/src/components/StatsHeader.tsx` returns zero hardcoded-caption matches |
| **AC-21** | **`calculateRecipeStats` back-compat is exact** | Unit (`brewingMath.test.ts`) | `calculateRecipeStats(recipe)` and `calculateRecipeStats(recipe, {})` return values **deeply equal** to each other and to the pre-amendment implementation's output for the same recipe — ABV via `abvBalling`, IBU via the existing engine loop. Every pre-existing assertion in `brewingMath.test.ts` passes with its **expected values unmodified**. `calculateRecipeStats(recipe, { abvFormula: 'simple' })` returns a *different* `abv` for a fixture where Simple and Balling disagree at one decimal, proving the parameter is actually read and not ignored |
| **AC-22** | **There is one Tinseth in the repository, and the default path does not move** | Unit (`config.test.ts`) | On a fixture containing **both** a 60-minute Boil addition **and** a Whirlpool/Aroma addition, `calculateRecipeIbuWithStrategy(recipe, 'tinseth')` equals the total IBU produced by `calculateRecipeStats(recipe)`'s existing engine loop within **`0.01` IBU**, and `calculateRecipeStats(recipe, { ibuFormula: 'tinseth' }).ibu === calculateRecipeStats(recipe).ibu` exactly. Consequence, asserted: selecting the **default** IBU strategy changes no recipe's displayed IBU. *This is a wiring/consolidation criterion. It composes with the separately-diagnosed fix to the Tinseth strategy's missing `× hopUtilizationPct/100` term and its missing hopstand factor (critic F-1) — that fix is required for this criterion to pass, and it needs no spec change because Resolved Ambiguities §2's Tinseth formula is already correct as written* |
| **AC-23** | **Temperatures render through `formatTemperature`** | Component (`MashSection.test.tsx`) | With a mash plan whose `strikeTemperatureC = 67` and config `temperatureUnit: 'fahrenheit'`, the Strike Temperature tile contains **`152.6 °F`** and does not contain `67`; sparge temperature and every mash-step row temperature likewise render in °F. Under `'celsius'` they render in °C and no `°F` appears in the component. `grep -nE "\* ?9 ?/ ?5|\* ?1\.8 ?\+ ?32" apps/web/src` returns zero matches |
| **AC-24** | **Grain mass renders through `formatMass`** | Component (`StatsHeader.test.tsx`) | With `stats.totalGrainKg = 5` and config `unitSystem: 'us'`, the Total Grain figure renders **`11.02 lb`**; under `'imperial'` likewise `11.02 lb`; under `'metric'`, **`5.00 kg`**. The hardcoded ` kg` suffix on that figure is gone from the JSX |
| **AC-25** | **No inline conversion math anywhere (Resolved Ambiguity 4, enforced)** | Verification | Every conversion in `apps/web/src` goes through a `@truchabrew/calculations` export. A repo-wide grep over `apps/web/src` for the literal constants `131.25`, `132.715`, `2.20462`, `0.264172`, `1262.45`, `776.43`, `182.94` and `668.96` returns **zero** matches outside comments. `formatGravity`, `formatTemperature` and `formatMass` each have **at least one non-test caller** under `apps/web/src`. `calculateAbvWithStrategy` and `calculateRecipeIbuWithStrategy` each have **at least one non-test caller reachable from a real user action** — either directly under `apps/web/src`, or indirectly via `calculateRecipeStats` (§2.2.3) as long as `calculateRecipeStats` itself is invoked from `apps/web/src` with a non-default `options` argument on a live code path (not merely from `packages/calculations/test/config.test.ts`). This is the condition AC-25 exists to catch — that these functions were reachable only from tests — not a requirement that `apps/web/src` bypass `calculateRecipeStats`'s centralized dispatch (§2.2.3) to call them a second, redundant time directly. *Amended 2026-08-13 after the second critic pass found the original literal wording contradicted §2.2.3's own architecture; the property the AC protects — no dead-code-only-in-tests — was independently confirmed to already hold via the live `App.tsx` → `useRecipeEditor.ts` → `calculateRecipeStats` chain.* |
| **AC-26** | **Persistence round-trip: the change survives a reload and still moves the numbers** | Component/Integration | Sequence, asserted in order: (1) mount the app with `GET /api/config` returning defaults; the OG tile shows `1.050`. (2) Change Gravity Display to Plato; a `PUT` fires (AC-10) and the OG tile shows `12.4 °P` **without a page reload**. (3) Remount the app fresh with `GET /api/config` now returning `gravityUnit: 'plato'` (simulating the reload); the OG tile shows `12.4 °P` on first paint. Today step 2 and step 3 both fail — the setting persists correctly at the API layer while every number on screen stays put |
| **AC-27** | **Garetz is labeled as approximate at the point of selection** | Component (`SettingsManager.test.tsx`) | The IBU Formula select's third option's visible label is exactly **`Garetz (approximate)`** — the bare string `Garetz` is no longer offered as an option label. A visible caveat element with `data-testid="garetz-approximation-note"` renders whenever `ibuFormula === 'garetz'` is the selected value, stating in plain language that the Garetz implementation is approximate and not a full implementation of the published method. The enum value persisted over the wire remains `'garetz'` unchanged (AC-7/AC-8 unaffected), and `IbuFormulaStrategy` is not narrowed. See §4 deviation 1 |
| **AC-28** | **Amendment scope guardrail** | Manifest Diff | The union of §1.3 and §1.4 is the complete set of files that may change. Verified by a SHA-256 content manifest captured **before the executor's first edit** and again at the end — `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum` — and diffed. **`git diff --name-only` against a base commit is NOT usable in this repository and must not be substituted:** the repo has exactly one commit and ~125 dirty paths, so no commit exists that represents this phase's starting state. Every path whose hash changed must appear in §1.3 or §1.4; every §1.4 "Modified" path must actually have changed (the first pass left `brewingMath.ts` byte-unchanged while §1.3 listed it as Modified — that must not recur); no path on §1.4's Untouched list may have changed. Any deviation is disclosed in §4 before verification, not after |

**Gate criteria AC-11 and AC-12 re-apply unchanged to the amended work:** `npm test`, `npm run typecheck`, `npm run build` and `npm run lint` must each exit 0 across all four workspaces after the wiring lands.

### 3.2 Second-Amendment Criterion — AC-29 (ADDED 2026-08-13)

**AC-1 … AC-28 above are byte-unchanged and are not renumbered.** AC-29 closes second-pass critic Finding 2.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-29** | **Fermentation-step temperatures render through `formatTemperature` too — one component, one unit** | Component (`MashSection.test.tsx`) | With a recipe whose `fermentationProfile.steps` contains a step with `stepTempC = 20`, and config `temperatureUnit: 'fahrenheit'`, the fermentation-schedule table row (`data-testid="fermentation-plan-step-0"`) contains **`68.0 °F`** and does **not** contain the substring `°C`. Under `temperatureUnit: 'celsius'` the same row contains **`20.0 °C`**. Asserted jointly with a mash-step row in the **same render**, so the test fails if the two tables ever disagree on unit: with `'fahrenheit'` active, `grep`-equivalent assertion that the string `°C` appears **nowhere** in `MashSection`'s rendered output, and with `'celsius'` active that `°F` appears nowhere. The literal JSX `{step.stepTempC} °C` no longer appears in `MashSection.tsx` |

**Why this is closed here rather than deferred (the alternative considered and rejected).** The competing option was a §4 deviation entry deferring fermentation-step conversion alongside deviation 3's hop-gram/oz and litre/gallon deferrals. That would have been the consistent choice if this were new scope — but it is not, on three counts:

1. **§1.4 already charges this file with exactly this work.** `MashSection.tsx`'s permitted-edit row reads "Render strike / sparge / **step** temperatures through `formatTemperature`," unqualified. Key Behavior 4 is likewise unqualified. Only AC-23's *test* text narrowed to mash-step rows; the contract above it never did. This is a criterion that under-measured its own contract, which is the same defect class the first amendment was written to fix.
2. **It is one line inside a file that is already open, with the dependency already in scope.** `config` and `formatTemperature` are both already bound in this component and already used three lines' worth elsewhere in it. Deviation 3's deferrals are genuinely different in kind — they cross many files and, for input fields, raise canonical-storage round-trip questions (Key Behavior 1) that warrant their own phase. Converting one read-only display figure raises none of those.
3. **The phase is returning to `/execute` regardless** (AC-22 and AC-19 are both open). The marginal cost of this line is effectively zero, whereas the cost of deferring is shipping a screen where a Fahrenheit-preference user reads strike temperature in °F and the fermentation schedule in °C, simultaneously, in one component — the precise mixed-unit inconsistency §4 deviation 3 accepts only because its alternative was expensive.

Deferral would have been defensible bookkeeping; closure is the cheaper and more honest end state, and it keeps this amendment's footprint to a single line of production code.

---

## 4. Deviation Register (ADDED 2026-08-13)

### Deviation 1 — Garetz ships as an explicitly-labeled approximation, not a real Garetz implementation

**Status: disclosed and accepted for this phase. Enforced by AC-27.**

This spec's Resolved Ambiguities §2 pins complete closed-form formulas for Tinseth and Rager, and gives Garetz exactly one prose sentence — "Uses Garetz temperature, concentration, and elevation factor adjustments" — with no formula, no coefficients, and no worked example. No acceptance criterion in this spec, before or after this amendment, requires Garetz to be numerically correct; AC-4 names only Tinseth and Rager.

The executor's handling of this was correct and is **not** treated as a defect. Rather than inventing coefficients and calling them Garetz, it shipped `singleHopIbuGaretzCandidate` — a named, loudly-disclosed candidate carrying a provenance block, a cross-referenced type alias, tests explicitly labeled structural-only, and elevation/temperature factors pinned at a literal `1.0` rather than buried inside a fudge constant. That is the opposite of a silent fallback and is the behavior this project wants when a spec under-determines an implementation.

**What this amendment fixes is the product surface, not the code's honesty.** The Settings select offered a plain, unqualified option labeled `Garetz`. A user picking it would receive a Tinseth-derived number presented as Garetz — mechanism mislabeling at the one layer the user actually sees, currently harmless only because nothing consumes the config at all. AC-27 requires the label to read `Garetz (approximate)` with a visible caveat note.

**A full Garetz implementation is explicitly out of scope for M7_P1.** Garetz's published method (Garetz, *Using Hops*, 1994) is table-driven utilization divided by a combined `GF × HF × TF` adjustment, where the hopping-rate factor is self-referential (it depends on the desired IBU and requires iteration) and the temperature factor is a function of **elevation in feet**. This codebase has no altitude field anywhere: `M3_P1 §4 deviation 3` deliberately excluded `altitude` from `EquipmentProfile` as inert at the time. A faithful Garetz therefore requires a schema addition — a new `EquipmentProfile` field, a migration, and API/form surface — which is a phase of its own, not a line item here.

*Reversal path, if overruled at this halt gate:* either (a) pin a cited Garetz formula in Resolved Ambiguities §2 and accept the `EquipmentProfile.altitude` addition into this phase's scope, or (b) remove `'garetz'` from the selectable enum until such a formula exists — which costs a `shared-types` narrowing, an API validation change, and a migration guard for any row already persisting `'garetz'`. Option (b) is the more honest end state and the more expensive one; the label caveat is chosen here as the proportionate fix for a single-user app whose Garetz option is currently unreachable anyway.

### Deviation 2 — Wiring ABV through the config changes the default on-screen ABV from Balling to Simple

**Status: disclosed, intentional, and numerically pinned by AC-19/AC-21.**

`calculateRecipeStats` currently hardcodes `abvBalling(og, fg)`, and `StatsHeader` captions it `"Balling Formula"`. But this spec's seeded default `abvFormula` is `'simple'` (Resolved Ambiguity 3). The moment the config is actually consumed, a user on untouched default settings sees their ABV computed by the Simple formula instead of Balling.

This is correct behavior — the seeded default is the spec's own decision — but it is a **user-visible change to an existing displayed number**, so it is recorded here rather than discovered during verification. The magnitude is small at normal gravities (the two formulas differ by roughly `1.011 / FG`, i.e. ~0.1% at `FG 1.010`) and becomes visible at high finishing gravities: at `OG 1.100 / FG 1.030` it is `9.2%` versus `9.0%`. §2.2.3's back-compat rule confines the change strictly to the two opted-in call sites; the pure engine's default output is unchanged, which is why no existing `brewingMath.test.ts` expectation moves (AC-21).

Batch stats snapshots are unaffected — §2.2.4 makes stored snapshots read-only history, never recomputed under a newly-selected strategy.

*Reversal path, if overruled:* change the seeded default `abvFormula` to `'balling'` in migration 0010 and Resolved Ambiguity 3, which preserves today's on-screen number for every existing user. This costs a migration edit and contradicts nothing else in the spec.

### Deviation 3 — Hop-gram → ounce and volume litre → gallon display are deferred out of this phase

**Status: disclosed scope boundary. Deliberately NOT covered by AC-14…AC-28.**

Resolved Ambiguity 1 defines `'us'` and `'imperial'` as including ounces and gallons. This amendment wires **grain mass only** (`totalGrainKg`, AC-24) plus gravity and temperature. Hop weights (`totalHopG`, and the per-hop gram inputs across `HopSection`), all volume displays (batch size, pre-boil, mash/sparge/total water, `strikeWaterL`), and the Imperial-vs-US gallon distinction (`lToUsGal` exists; no Imperial-gallon converter does) remain in metric regardless of `unitSystem`.

This is a bounded, deliberate stopping point, not an oversight: converting the *input* fields (as opposed to read-only display figures) means round-tripping user-entered values through conversion on every keystroke, which is a materially different problem — precision drift, cursor behavior, and canonical-storage integrity (Key Behavior 1) — and belongs in its own phase with its own criteria. Until then, a `'us'`-configured user sees pounds for grain and litres for water on the same screen. That inconsistency is the accepted, disclosed cost of closing the live-wiring gap in this phase rather than expanding it.

*Follow-on:* an M7_P2 covering hop mass, volumes, an Imperial-gallon converter, and converted **input** fields with an explicit canonical-storage round-trip criterion.

### Deviation 4 — Resolved Ambiguities §2's Tinseth constant corrected from `0.0001254` to `0.000125`

**Status: disclosed, rule-7 lightweight text correction (2026-08-14), no code change. Verified by the third-pass critic audit.**

This spec's Resolved Ambiguities §2 originally pinned the Tinseth bigness-factor constant as `0.0001254`. The third execution pass (AC-22, consolidating the strategy-path Tinseth implementation onto the pre-existing engine's single source of truth in `packages/calculations/src/constants.ts`) found that value was never actually used by the established engine, which has carried `TINSETH_BIGNESS_BASE = 0.000125` since M1_P1 — itself matching both the source `.gsd/documents/brewfather_clone_build_spec.md` and the published Tinseth formula. `0.0001254` was transcription drift introduced when this spec's own prose was written, not a deliberate deviation from the engine.

Honoring the spec's literal `0.0001254` was not a live option: AC-21 requires `brewingMath.test.ts`'s existing assertions (traced back to M1's approved fixtures) to stay unmoved, and AC-22 requires the strategy path to match that same engine within 0.01 IBU / exactly on the default-strategy path — both would have been violated by moving the engine's constant instead of correcting the spec's transcribed digit. The third-pass critic independently re-derived the correct value from the same sources before this text was corrected, rather than taking the executor's word for it.

No behavior changed as a result of this correction — the code was already right; only Resolved Ambiguities §2's text was wrong. Resolved Ambiguities §2 above now reads `0.000125`.

---

> **HALT GATE (STATE 2) — AMENDED 2026-08-13, re-approval required:** This spec was amended in place after the M7_P1 critic pass and must be re-approved before execution resumes. Two decisions need a human at this gate:
>
> **(a) The live-wiring gap — AC-14 … AC-26.** The first execution pass satisfied every literal criterion in AC-1…AC-13 and yet changing a setting still moves zero numbers anywhere in the app: `App.tsx` never issues `GET /api/config`, no config state exists for AC-10 to update, `brewingMath.ts` was left byte-unchanged despite §1.3 charging it, and Resolved Ambiguity 4's `formatGravity` / `formatTemperature` / `convertMass` were never written. The AC matrix under-specified the phase's own Key Behaviors; these fifteen criteria pin the wiring, with concrete numbers (`1.050` → `12.4 °P`, `67 °C` → `152.6 °F`, `5 kg` → `11.02 lb`, Simple `9.2%` vs Balling `9.0%`) so a re-execution cannot go green without the app's numbers actually changing. **§4 deviation 2 is the one to read before approving** — wiring ABV through the config changes the default on-screen ABV from Balling to Simple, and there is a one-line reversal if that is not wanted.
>
> **(b) The Garetz label — §4 deviation 1, AC-27.** The spec never gave Garetz a formula, and the executor correctly shipped a loudly-disclosed placeholder rather than inventing one. The disclosure stops at the UI, where the select still offers a plain "Garetz". This amendment relabels it `Garetz (approximate)` with a visible caveat, and records that a faithful Garetz needs an elevation field that M3_P1 deliberately excluded — out of scope here. Overrule paths (cite a real formula and take the schema addition, or drop the enum member entirely) are spelled out in deviation 1.
>
> Not changed: AC-1…AC-13's text, and Resolved Ambiguities §2's Tinseth formula — the missing `hopUtilizationPct` term is an implementation defect going back to `/execute` with no spec change.
>
> **(c) SECOND AMENDMENT, 2026-08-13 — bookkeeping closure, added after the second critic pass.** Two additions, both small and both additive. **§1.3.1** carves the six first-pass paths that §1.3's tables never listed into named exceptions — the migration SQL §1.1 itself mandates, its drizzle journal entry, the two-line route registration AC-6/7/8 depend on, a seed table-count bump, and the Sidebar entry Key Behavior 5 requires — closing **AC-13**, which has now failed two consecutive critic passes for inventory reasons rather than implementation ones. This is the sixth instance of this recurring gap class in this project and is closed in the same named-exception form as the previous five. **AC-29** requires fermentation-step temperatures in `MashSection.tsx` to route through `formatTemperature`, closing second-pass Finding 2 (a Fahrenheit user currently sees °F and °C in the same component); the reasoning for closing rather than deferring, including the deferral option that was considered and rejected, is recorded inline under §3.2. **AC-1…AC-28 are byte-unchanged and un-renumbered**, AC-25 included — it was already corrected separately under hard rule 7. **Still open and deliberately excluded from this amendment:** AC-22 (two live `TINSETH_BIGNESS_BASE` constants — a decision that must route through `/diagnose` first) and AC-19 (`9%` vs the pinned `9.0%` — an `/execute`-layer fix against correct spec text).
>
> Prompt: *"Review this amended feature specification. Reply with **SPEC_APPROVED** to begin execution."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
