# FEATURE SPECIFICATION: M1_P1 — Numbers I Can Trust

## Phase Summary

Make every number the recipe designer puts on screen defensible against a known-good Brewfather export. Today the calculation engine has four structural defects (IBU utilisation, wort-gravity basis, hopstand handling, unused `brewhouseEfficiencyPct`) and `StatsHeader.tsx` prints two hardcoded string literals — `Efficiency: 75%` and `Attenuation: 78%` — that are unrelated to the loaded recipe. There is no test runner at all.

This phase (a) relocates the flat `src/` tree into the `/packages/calculations` + `/packages/shared-types` + `/apps/web` layout decided in `ROADMAP.md` lines 25–35, (b) stands up vitest inside `/packages/calculations` and drives it from all six Montano fixture recipes, (c) corrects the calculation engine against those fixtures, and (d) makes `StatsHeader` read real efficiency and attenuation from recipe data.

**User-visible outcome:** load any Montano recipe into the designer and the OG, FG, ABV, IBU, colour, BU:GU, RBR, efficiency and attenuation shown on screen agree with Brewfather's own figures for that recipe, inside the tolerance bands in §3.

### Key Behaviors

1. `brewhouseEfficiencyPct` drives OG at fermenter volume; `mashEfficiencyPct` drives pre-boil gravity at pre-boil volume. Neither is derived from the other.
2. Tinseth bigness factor is fed post-boil OG, not `preBoilGravity`.
3. The hardcoded `× 1.1` pellet bump is deleted outright; a single `equipment.hopUtilizationPct` scales every hop addition regardless of `hop.type`.
4. `'Aroma'` and `'Whirlpool'` are one utilisation class ("hopstand") using the addition's own `timeMinutes` and a shared reduced-utilisation factor. `'DryHop'` contributes exactly `0`.
5. `StatsHeader` renders `equipment.brewhouseEfficiencyPct` and a computed `stats.attenuationPct`. No numeric literal representing recipe data survives in that component.
6. Everything runs from a cold clone via `npm install && npm test` at the repo root.

### Resolved Ambiguities (Binding)

- **Package manager.** `npm` workspaces, not pnpm. `package-lock.json` is committed, no `pnpm-lock.yaml` exists, npm 11.16.0 / node 24.18.0 are installed. `ROADMAP.md` line 50 says `pnpm test`; that is superseded — see the Deviation Register.
- **What "within 1%" means for a gravity.** Compared as **gravity points** — `(sg - 1) × 1000` — never as the raw SG number (1% of `1.052` is 10.5 points, a meaningless band). Tolerance is `max(1% of the fixture's point value, 1.0 point)`. The 1.0-point floor is mandatory: the fixture records OG/FG only to whole gravity points (`"ogPoints": 1052`), so it carries ±0.5 point of quantisation of its own and a tighter band asserts precision the source data does not have.
- **Comparison operator.** Every tolerance assertion is **inclusive**: `Math.abs(actual - expected) <= tolerance`. A delta exactly equal to the band passes.
- **OG volume basis.** OG is the gravity of the wort *at fermenter volume* — `batchSizeL`. Pre-boil gravity is at `preBoilVolumeL`. `postBoilVolumeL = batchSizeL + trubChillerLossL` is introduced as a named derived volume and is the basis for nothing in M1 except the fixture's efficiency derivation; it is exported because M3/M4 need it.
- **Efficiency semantics.** `mashEfficiencyPct` = fraction of theoretical extract present in the kettle at `preBoilVolumeL`. `brewhouseEfficiencyPct` = fraction present in the fermenter at `batchSizeL`. Physical consistency implies `brewhouseEfficiencyPct ≈ mashEfficiencyPct × batchSizeL / postBoilVolumeL`, but **the engine must not enforce or derive this** — both are independent profile inputs, and a user whose profile violates the relation gets exactly the numbers their profile describes.
- **Wort-gravity basis for Tinseth.** Post-boil OG (`stats.og`), a single value shared by every addition in the recipe. Rejected alternatives: `preBoilGravity` (current, wrong — inflates IBU ~4%) and per-addition gravity interpolated across the boil (Brewfather appears to do something of this kind, but reconciling its *per-addition* IBU splits is out of M1 scope; recipe-total IBU is the verification target per `ROADMAP.md` line 50).
- **Hopstand utilisation.** `HOPSTAND_UTILIZATION_FACTOR = 0.26`, a module-level exported constant in `/packages/calculations`, applied multiplicatively after the Tinseth utilisation product, using `hop.timeMinutes` as the stand duration. The current `boilTime = 15` clamp for `'Whirlpool'` is deleted — a 20-minute stand is calculated as 20 minutes. This constant is M1's; M3 moves it onto the Equipment profile alongside `hopstandTemperature` and it is annotated as such in source.
- **Zero/degenerate hop inputs.** `calculateSingleHopIbu` returns exactly `0` when any of: `use === 'DryHop'`; `timeMinutes <= 0`; `amountG <= 0`; `alphaAcidPct <= 0`. The check order does not matter — all four short-circuit to `0`. `use === 'FirstWort'` is treated as `'Boil'` with the addition's own `timeMinutes` and **no** first-wort bonus; this is a deliberate, documented choice (no fixture recipe exercises it) rather than the current accidental fall-through.
- **MCU colour basis — roadmap item 3 is rejected on evidence.** The Morey MCU slot keeps grain colour **in SRM**, not Lovibond. Hand-computed against all six fixtures (evidence table in §3), the SRM basis lands at +2.4% to +2.8% for five of six recipes and +10.8% on the darkest; converting to Lovibond degrades five of six (−1.6%, −8.7%, −9.2%, −9.5%, **−13.8%**). The current code is empirically right and only its *naming* is wrong. M1 renames the parameter to `grainColorSrm`, documents the basis, and adds tested `srmToLovibond`/`lovibondToSrm` converters for display and for M8. See the Deviation Register — this needs explicit sign-off.
- **No `lovibond` field is added to `FermentableItem`.** Build-spec §2 lists one, but with the SRM basis binding it would be an unread field. `srmToLovibond()` covers every present need. Deferred to whenever something actually reads it.
- **FG/ABV accuracy is bounded by a missing model, not by a bug.** Brewfather adjusts estimated FG for mash-step fermentability; `Recipe` has no mash profile until M3. Measured against the fixtures, yeast-attenuation-only FG estimation is off by up to 3.7 gravity points (Buho: 86% yeast attenuation, Brewfather reports 78.1% apparent). The FG/ABV/RBR fixture bands in §3 are widened accordingly and the residual is M3 scope. Structural correctness of the FG/ABV formulas is separately pinned by hand-computed unit tests that do not touch the fixtures.
- **Fixture efficiency is per-recipe, derived, and explicitly non-validating.** The fixture's `sharedEquipmentProfile.mashEfficiencyPct` is a rounded account-level average; applying it uniformly cannot reproduce all six OGs from any honest potential table (required weighted-average potentials span 35.6–38.0 PPG while a published table gives 35.7–37.1). The harness therefore derives each recipe's `mashEfficiencyPct` from that recipe's own recorded `preBoilGravity`. Consequence, stated plainly: **the pre-boil-gravity comparison is circular and is not an acceptance criterion.** What the OG AC genuinely validates is the volume/efficiency/concentration chain (the extract term cancels algebraically) — which is exactly the chain M1 changes. Absolute extract prediction cannot be validated from this fixture because Brewfather's export carries no per-fermentable potential/PPG.
- **Anti-tuning guardrail.** The fermentable-potential table is keyed by fermentable **name only**. Any name resolves to one value across all six recipes. No recipe id, no per-recipe override, no per-recipe fudge factor, anywhere in the harness. `hopUtilizationPct` and `HOPSTAND_UTILIZATION_FACTOR` are likewise single shared values. A fixture that will not fit within band is a `/diagnose` input, not a licence to add a knob.
- **Fixture data is copied, not moved.** `.gsd/documents/montano_brewing_recipes.json` is a protected framework path and stays exactly where it is; a byte-identical copy is committed at `packages/calculations/test/fixtures/montano_brewing_recipes.json` so the package has no dependency on `.gsd/`. **Correction (post-execution, AC-29/AC-30):** the byte-identity check is a SHA-256 **pinned as a constant in the test file** at the time of copying, not a live read of `.gsd/documents/` at test time — `.gsd/documents/` is untracked, so a live cross-tree read is absent from a genuine `git clone` and breaks AC-30's cold-clone guarantee. The original wording implied a live comparison; that was a spec self-contradiction, not an implementation bug.
- **Deletions are unconditional.** `src/App.css`, `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png` are confirmed unreferenced (`grep` across `src/`, `index.html`, `vite.config.ts`, `README.md` returns nothing) and are deleted, not relocated. `public/favicon.svg` and `public/icons.svg` **are** referenced and move to `apps/web/public/`.

---

## 1. Data Schema & Contracts

### 1.1 Workspace layout (target)

```
/package.json                     private root, "workspaces": ["apps/*", "packages/*"]
/package-lock.json                regenerated by npm install
/tsconfig.base.json               shared compilerOptions
/packages/shared-types/
    package.json                  name "@truchabrew/shared-types", main+types -> ./src/index.ts
    tsconfig.json
    src/index.ts                  re-exports ./brewing
    src/brewing.ts                (from src/types/brewing.ts)
/packages/calculations/
    package.json                  name "@truchabrew/calculations", dep: @truchabrew/shared-types (workspace:*)
    tsconfig.json
    vitest.config.ts
    src/index.ts                  public surface, re-exports the three modules below
    src/constants.ts              NEW
    src/units.ts                  NEW
    src/brewingMath.ts            (from src/calculations/brewingMath.ts)
    test/units.test.ts                    NEW
    test/brewingMath.test.ts              NEW
    test/fixtures.test.ts                 NEW
    test/fixtures/montano_brewing_recipes.json     copy of the .gsd fixture
    test/fixtures/fermentablePotentials.ts         NEW
    test/fixtures/fixtureAdapter.ts                NEW
/apps/web/
    package.json                  name "@truchabrew/web", deps on both packages
    index.html  vite.config.ts  tsconfig.json  tsconfig.app.json  tsconfig.node.json
    public/favicon.svg  public/icons.svg
    src/main.tsx  src/index.css  src/App.tsx
    src/components/{StatsHeader,FermentableSection,HopSection,YeastSection}.tsx
    src/data/seedData.ts
    src/utils/srmColor.ts
```

Packages ship TypeScript source (`"main": "./src/index.ts"`, `"types": "./src/index.ts"`); there is no per-package build step in M1. Vite transpiles workspace TS directly.

Required root scripts:

| Script | Command contract |
|---|---|
| `npm test` | runs the vitest suite in `packages/calculations`, exits 0 |
| `npm run typecheck` | typechecks all three packages, exits 0 |
| `npm run build` | builds `@truchabrew/web` to `apps/web/dist`, exits 0 |
| `npm run dev` | starts the web dev server |
| `npm run lint` | runs oxlint across the workspace, exits 0 |

### 1.2 Exported constants — `packages/calculations/src/constants.ts`

| Symbol | Value | Note |
|---|---|---|
| `POUNDS_PER_KG` | `2.20462` | |
| `GALLONS_PER_LITER` | `0.264172` | |
| `MASH_WATER_L_PER_KG` | `3.0` | un-hardcoded in M3 |
| `GRAIN_ABSORPTION_L_PER_KG` | `0.96` | un-hardcoded in M3 |
| `HOPSTAND_UTILIZATION_FACTOR` | `0.26` | moves onto EquipmentProfile in M3 |
| `DEFAULT_HOP_UTILIZATION_PCT` | `87` | fallback when the field is absent |
| `TINSETH_BIGNESS_COEFF` | `1.65` | |
| `TINSETH_BIGNESS_BASE` | `0.000125` | |
| `TINSETH_TIME_RATE` | `0.04` | |
| `TINSETH_TIME_DIVISOR` | `4.15` | |
| `MOREY_COEFF` | `1.4922` | |
| `MOREY_EXPONENT` | `0.6859` | |
| `SRM_TO_EBC` | `1.97` | |
| `LOVIBOND_SLOPE` | `1.3546` | `SRM = 1.3546·L − 0.76` |
| `LOVIBOND_OFFSET` | `0.76` | |
| `AVERAGE_ATTENUATION_BASELINE` | `0.7655` | RBR all-styles reference |
| `DEFAULT_ATTENUATION_PCT` | `75` | used when `recipe.yeasts` is empty |

### 1.3 Type changes — `packages/shared-types/src/brewing.ts`

**`EquipmentProfile` — one added field:**

```ts
export interface EquipmentProfile {
  id: string;
  name: string;
  batchSizeL: number;
  boilTimeMin: number;
  brewhouseEfficiencyPct: number;
  mashEfficiencyPct: number;
  boilOffRateLPerHour: number;
  trubChillerLossL: number;
  hopUtilizationPct: number;   // NEW — required. 100 = textbook Tinseth. Scales every hop addition.
}
```

`hopUtilizationPct` is **required**, not optional: making it optional would let a profile silently fall back and hide a mis-seeded value. Both seed profiles in `seedData.ts` gain `hopUtilizationPct: 87`.

**`CalculatedStats` — two added fields, no removals, no renames:**

```ts
export interface CalculatedStats {
  // ... all 15 existing fields unchanged ...
  attenuationPct: number;    // NEW — apparent attenuation from og/fg, 1 decimal
  postBoilVolumeL: number;   // NEW — batchSizeL + trubChillerLossL, 1 decimal
}
```

`FermentableItem`, `HopItem`, `YeastItem`, `Recipe`, and every union type (`FermentableType`, `HopUse`, `HopType`, `YeastType`, `YeastForm`) are **unchanged**. `FermentableItem.colorSrm` keeps its name and meaning.

### 1.4 Symbol inventory

**Modified — signature or behaviour changes:**

| Symbol | Change |
|---|---|
| `calculateRecipeStats(recipe: Recipe): CalculatedStats` | signature unchanged; OG basis, IBU basis, and two new output fields |
| `calculateSingleHopIbu` | **signature changed** — see §2.4 |
| `StatsHeader` (component) | **props changed** — see §2.6 |
| `HopSection` (component) | **props changed** — see §2.6 |
| `sgToPoints(sg: number): number` | unchanged behaviour (still rounds); demoted to display-only |

**New:** everything in §1.2, plus `sgToPointsExact`, `pointsToSg`, `kgToLb`, `litersToGallons`, `srmToLovibond`, `lovibondToSrm`, `ebcToSrm`, `srmToEbc`, `mcuContribution`, `moreySrm`, `calculateVolumes`, `totalExtractPoints`, `gravityAtVolume`, `averageAttenuationPct`, `estimateFg`, `apparentAttenuationPct`, `abvBalling`, `classifyHopUse`, `tinsethBignessFactor`, `tinsethBoilTimeFactor`, `buGuRatio`, `rbRatio`.

**Relocated, byte-identical content:** `src/utils/srmColor.ts`, `src/components/FermentableSection.tsx`, `src/components/YeastSection.tsx`, `src/main.tsx`, `src/index.css`, `index.html`, `public/favicon.svg`, `public/icons.svg`.

**Deleted:** `src/App.css`, `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`, and the now-empty `src/assets/`.

**Untouched (must not appear in `git diff` at all):** `CLAUDE.md`, `.claude/**`, `.agents/**`, `README.md`, `.oxlintrc.json`, and every path under `.gsd/` except `.gsd/active/M1_P1_feature_spec.md`, `.gsd/STATE.json`, and new files under `.gsd/active/manual_verification/`.

---

## 2. Transformations & Pure Logic

All of §2.1–§2.5 are pure: same inputs → same outputs, no I/O, no module-level mutable state, no `Date`/`Math.random`.

### 2.1 Unit conversions — `src/units.ts`

```ts
export function sgToPoints(sg: number): number;        // UNCHANGED: Math.round((sg - 1) * 1000)
export function sgToPointsExact(sg: number): number;   // NEW: (sg - 1) * 1000, no rounding
export function pointsToSg(points: number): number;    // 1 + points / 1000
export function kgToLb(kg: number): number;
export function litersToGallons(liters: number): number;
export function srmToEbc(srm: number): number;         // srm * 1.97
export function ebcToSrm(ebc: number): number;         // ebc / 1.97
export function srmToLovibond(srm: number): number;    // (srm + 0.76) / 1.3546
export function lovibondToSrm(lovibond: number): number; // 1.3546 * lovibond - 0.76
```

`sgToPointsExact` is not cosmetic: `sgToPoints(1.0375)` rounds to `38`, a 1.3% extract error. Every internal extract calculation uses the exact form; `sgToPoints` survives only for display.

### 2.2 Colour

```ts
export function mcuContribution(weightLb: number, grainColorSrm: number, volumeGal: number): number;
export function moreySrm(mcuTotal: number): number;
```

`mcuContribution` returns `0` when `volumeGal <= 0`. `moreySrm` returns exactly `0` when `mcuTotal <= 0` (guards `Math.pow(0, 0.6859)` and negative bases). The third parameter of `mcuContribution` is deliberately named `grainColorSrm` — this is the rename that resolves the "MCU bug".

### 2.3 Gravity, attenuation, ABV

```ts
export interface VolumeSet {
  batchSizeL: number;
  postBoilVolumeL: number;  // batchSizeL + trubChillerLossL
  preBoilVolumeL: number;   // postBoilVolumeL + boilOffRateLPerHour * (boilTimeMin / 60)
}
export function calculateVolumes(equipment: EquipmentProfile): VolumeSet;

// Σ over fermentables of kgToLb(amountKg) * sgToPointsExact(potentialSg). Empty array -> 0.
export function totalExtractPoints(fermentables: FermentableItem[]): number;

// 1 + (extractPointsLbTimesPoints * efficiencyPct/100) / litersToGallons(volumeL) / 1000
// Returns exactly 1.0 when volumeL <= 0, extractPointsLbTimesPoints <= 0, or efficiencyPct <= 0.
export function gravityAtVolume(extractPointsLbTimesPoints: number, efficiencyPct: number, volumeL: number): number;

export function averageAttenuationPct(yeasts: YeastItem[]): number;   // empty -> DEFAULT_ATTENUATION_PCT (75)
export function estimateFg(og: number, attenuationPct: number): number;
export function apparentAttenuationPct(og: number, fg: number): number; // og <= 1.0 -> 0
export function abvBalling(og: number, fg: number): number;             // never negative; clamps at 0
export function buGuRatio(ibu: number, og: number): number;             // og <= 1.0 -> 0
export function rbRatio(buGu: number, apparentAttenuationFraction: number): number;
```

OG is `gravityAtVolume(totalExtractPoints(f), equipment.brewhouseEfficiencyPct, batchSizeL)`.
Pre-boil gravity is `gravityAtVolume(totalExtractPoints(f), equipment.mashEfficiencyPct, preBoilVolumeL)`.
That single substitution is roadmap hardening item 4 and it is the only place `brewhouseEfficiencyPct` is read.

### 2.4 IBU

```ts
export type HopUtilizationClass = 'boil' | 'hopstand' | 'none';
export function classifyHopUse(use: HopUse): HopUtilizationClass;
export function tinsethBignessFactor(wortGravity: number): number;
export function tinsethBoilTimeFactor(minutes: number): number;

// BEFORE: calculateSingleHopIbu(hop: HopItem, wortGravity: number, batchVolumeL: number): number
// AFTER  (4th parameter added, defaulted so the call is still valid without it):
export function calculateSingleHopIbu(
  hop: HopItem,
  wortGravity: number,
  batchVolumeL: number,
  hopUtilizationPct?: number,   // default DEFAULT_HOP_UTILIZATION_PCT (87)
): number;
```

`classifyHopUse` mapping — exhaustive over `HopUse`, no default branch:

| `use` | class | boil-time input | extra factor |
|---|---|---|---|
| `'Boil'` | `'boil'` | `hop.timeMinutes` | — |
| `'FirstWort'` | `'boil'` | `hop.timeMinutes` | — |
| `'Aroma'` | `'hopstand'` | `hop.timeMinutes` | `× HOPSTAND_UTILIZATION_FACTOR` |
| `'Whirlpool'` | `'hopstand'` | `hop.timeMinutes` | `× HOPSTAND_UTILIZATION_FACTOR` |
| `'DryHop'` | `'none'` | — | returns `0` |

Evaluation order inside `calculateSingleHopIbu`:
1. `classifyHopUse(hop.use) === 'none'` → return `0`.
2. `hop.timeMinutes <= 0 || hop.amountG <= 0 || hop.alphaAcidPct <= 0 || batchVolumeL <= 0 || wortGravity <= 1.0` → return `0`. (`batchVolumeL <= 0` guards a division by zero; `wortGravity <= 1.0` guards a recipe with hops but no extract — e.g. an empty fermentables list — from reporting nonsensical positive IBU against wort that isn't there.)
3. `utilization = tinsethBignessFactor(wortGravity) * tinsethBoilTimeFactor(hop.timeMinutes)`.
4. If class is `'hopstand'`: `utilization *= HOPSTAND_UTILIZATION_FACTOR`.
5. `utilization *= (hopUtilizationPct ?? DEFAULT_HOP_UTILIZATION_PCT) / 100`.
6. `return ((hop.alphaAcidPct / 100) * hop.amountG * 1000 / batchVolumeL) * utilization`.

Deleted in this step: the `if (hop.type === 'Pellet') utilization *= 1.1` branch, the `hop.use === 'Whirlpool' ? 15 : hop.timeMinutes` clamp, and the `utilization *= 0.5` whirlpool factor. `hop.type` is no longer read by any calculation.

### 2.5 Stateful integration — `calculateRecipeStats`

Signature unchanged: `(recipe: Recipe) => CalculatedStats`. Ordering constraint that matters: **OG must be computed before the IBU loop**, because `og` is now the Tinseth wort-gravity input. Sequence:

1. `volumes = calculateVolumes(recipe.equipment)`
2. Accumulate `totalGrainKg`, `extractPoints`, `totalMcu` in one pass over `recipe.fermentables` (`totalMcu` via `mcuContribution(kgToLb(f.amountKg), f.colorSrm, litersToGallons(batchSizeL))`).
3. `og = gravityAtVolume(extractPoints, brewhouseEfficiencyPct, batchSizeL)`
4. `preBoilGravity = gravityAtVolume(extractPoints, mashEfficiencyPct, preBoilVolumeL)`
5. `fg = estimateFg(og, averageAttenuationPct(recipe.yeasts))`
6. `abv = abvBalling(og, fg)`; `attenuationPct = apparentAttenuationPct(og, fg)`
7. IBU loop over `recipe.hops` calling `calculateSingleHopIbu(hop, og, batchSizeL, equipment.hopUtilizationPct)`
8. `srm = moreySrm(totalMcu)`; `ebc = srmToEbc(srm)`
9. `buGu = buGuRatio(totalIbu, og)`; `rbr = rbRatio(buGu, attenuationPct / 100)`
10. Water volumes — unchanged formulas, now using `MASH_WATER_L_PER_KG` / `GRAIN_ABSORPTION_L_PER_KG`
11. Rounding, applied only at this final step: `og`/`fg`/`preBoilGravity` 3dp, `abv` 1dp, `ibu` integer, `srm`/`ebc` 1dp, `buGu`/`rbr` 2dp, `attenuationPct` 1dp, `totalGrainKg` 2dp, `totalHopG` integer, all volumes 1dp.

**Empty-recipe contract** (no fermentables, no hops, no yeasts): must return without throwing or emitting `NaN`/`Infinity` in any field — `og === 1`, `fg === 1`, `abv === 0`, `ibu === 0`, `srm === 0`, `ebc === 0`, `buGu === 0`, `rbr === 0`, `attenuationPct === 0`. Volume fields still reflect the equipment profile.

### 2.6 Component contracts

```ts
// BEFORE: interface StatsHeaderProps { stats: CalculatedStats; batchSizeL: number }
// AFTER:
interface StatsHeaderProps { stats: CalculatedStats; equipment: EquipmentProfile }

// BEFORE: HopSectionProps { hops; preBoilGravity: number; batchSizeL; totalHopG; totalIbu; onUpdate }
// AFTER:  HopSectionProps { hops; wortGravity: number; batchSizeL; hopUtilizationPct: number; totalHopG; totalIbu; onUpdate }
```

`StatsHeader` renders `Efficiency: {equipment.brewhouseEfficiencyPct}%` and `Attenuation: {stats.attenuationPct}%`. `App.tsx` passes `equipment={recipe.equipment}` and `wortGravity={stats.og}` / `hopUtilizationPct={recipe.equipment.hopUtilizationPct}`. `HopSection`'s per-row IBU display changes from `Math.round(...)` to `.toFixed(1)` — a 2.1 IBU aroma addition currently renders as `2`.

### 2.7 Fixture harness

`test/fixtures/fermentablePotentials.ts` exports a frozen `Record<string, number>` of PPG keyed by the fixture's fermentable `name`, covering exactly the 16 distinct names across the six recipes, with a source note per entry:

| Name | PPG | | Name | PPG |
|---|---|---|---|---|
| Pale Ale | 37.5 | | Pilsner | 37.0 |
| Wheat Malt | 38.0 | | Chateau Maize Flakes | 39.0 |
| BEST Vienna | 36.5 | | BEST Biscuit | 35.0 |
| Rye Malt | 36.0 | | Caramel Munich I | 34.0 |
| Oats, Flaked | 33.0 | | Caramel Munich III | 33.0 |
| Acidulated | 30.0 | | Caramel Amber | 34.0 |
| Chocolate | 28.0 | | BEST Caramel Aromatic | 33.0 |
| Black Malt | 25.0 | | Roasted Barley | 25.0 |

A lookup miss **throws** — it must never silently default.

`test/fixtures/fixtureAdapter.ts` exports `loadFixtureRecipes(): Array<{ recipe: Recipe; expected: FixtureExpectations }>` and performs, per recipe:

- **Equipment:** `batchSizeL: 28`, `boilTimeMin: 60`, `trubChillerLossL: 2.2`, `boilOffRateLPerHour: 4.51` (these three reproduce the fixture's stated `preBoilVolumeL: 34.71` and give `postBoilVolumeL = 30.2`), `hopUtilizationPct: 87`.
- **Derived efficiencies** (calibration, not validation):
  `mashEfficiencyPct = fixture.preBoilGravityPoints × litersToGallons(34.71) / totalExtractPoints × 100`
  `brewhouseEfficiencyPct = mashEfficiencyPct × 28 / 30.2`
- **Fermentables:** `colorSrm = ebcToSrm(fixture.colorEBC)`, `potentialSg = pointsToSg(POTENTIALS[name])`.
- **Hops:** `use` mapped from the fixture string — `"Boil"` → `'Boil'`; any string containing `"Hopstand"` or `"Aroma"` → `'Aroma'`; `"Dry Hop"` → `'DryHop'`. `timeMinutes` parsed from a leading `"<n> min"`, else `0`. `type: 'Pellet'` for all (inert — nothing reads it).
- **Yeast:** `attenuationPct` from the fixture; `amountPkg` parsed from the leading number of the `amount` string.

### 2.8 Refactoring & legacy cleanup

- Delete the pellet `× 1.1` branch, the whirlpool `15`-minute clamp, and the whirlpool `× 0.5` factor from `calculateSingleHopIbu`. No successor branch keyed on `hop.type` may exist anywhere in `/packages/calculations`.
- Delete the two hardcoded strings `75%` and `78%` from `StatsHeader.tsx`. No numeric literal representing recipe or equipment data remains in that file (Tailwind class strings and `toFixed` precision arguments are not recipe data).
- Delete the `batchSizeL` prop from `StatsHeaderProps` — it is reachable via `equipment.batchSizeL` and keeping both invites drift.
- Delete `src/App.css` and the three template assets. Confirm no `import './App.css'` survives anywhere.
- Delete the root `tsconfig.app.json` / `tsconfig.node.json` from the repo root as part of the move (they belong to `apps/web`); the root keeps only `tsconfig.base.json` plus whatever the root `typecheck` script needs.
- Remove `@types/node`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `vite`, `react`, `react-dom`, `lucide-react` from the root `package.json` and re-declare each in the package that actually uses it. The root `package.json` keeps only workspace wiring, `typescript`, `oxlint`, and `vitest`-adjacent tooling if hoisted.

---

## 3. Acceptance Criteria & Test Matrix

Tolerance definitions used below, all inclusive (`<=`):

- **`TOL_POINTS(expected)`** = `max(0.01 × expected, 1.0)` gravity points.
- **`TOL_IBU`** = `1.5` IBU absolute.
- **`TOL_EBC(expected)`** = `max(1.0, 0.14 × expected)` EBC.
- **`TOL_FG`** = `4.5` gravity points. **`TOL_ABV`** = `0.8` percentage points. **`TOL_BUGU`** = `0.04`. **`TOL_RBR`** = `0.08`.

Fixture evidence supporting these bands (hand-computed at plan time, per-recipe expected deltas — the executor should land near these; a materially different delta means a formula was implemented differently and is a `/diagnose` trigger):

| Recipe | fixture OG / IBU / EBC | ΔOG pts | ΔIBU | ΔEBC (SRM basis) | ΔEBC (Lovibond, rejected) |
|---|---|---|---|---|---|
| Buho Weissbier | 1052 / 13 / 9.3 | −0.28 | −0.25 | +0.23 (+2.5%) | −0.15 (−1.6%) |
| Frontino Porter | 1057 / 26 / 71 | +0.47 | −0.36 | +7.7 (+10.8%) | −6.5 (−9.2%) |
| IPL | 1046 / 33 / 7.1 | −0.03 | +0.56 | +0.17 (+2.4%) | +0.30 (+4.2%) |
| Mapanare IPA | 1065 / 43 / 18.3 | +0.51 | +1.36 | +0.45 (+2.5%) | −1.74 (−9.5%) |
| Navidad Red Ale | 1052 / 22 / 31.5 | −0.28 | −1.37 | +0.90 (+2.8%) | −4.36 (−13.8%) |
| Tangara APA | 1053 / 37 / 15 | −0.13 | −0.07 | +0.42 (+2.8%) | −1.30 (−8.7%) |

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | Constant exports | Unit | `HOPSTAND_UTILIZATION_FACTOR === 0.26`, `DEFAULT_HOP_UTILIZATION_PCT === 87`, `MOREY_COEFF === 1.4922`, `MOREY_EXPONENT === 0.6859`, `SRM_TO_EBC === 1.97`, `LOVIBOND_SLOPE === 1.3546`, `AVERAGE_ATTENUATION_BASELINE === 0.7655`, `DEFAULT_ATTENUATION_PCT === 75` — all importable from `@truchabrew/calculations` |
| **AC-2** | Unit converters round-trip | Unit | `ebcToSrm(srmToEbc(x))` and `lovibondToSrm(srmToLovibond(x))` return `x` within `1e-9` for `x ∈ {0, 1.5, 9.3, 71, 1300}`; `srmToLovibond(3.046)` ≈ `2.809` ±0.001 |
| **AC-3** | `sgToPointsExact` does not round | Unit | `sgToPointsExact(1.0375) === 37.5` (±1e-9) while `sgToPoints(1.0375) === 38`; both exported |
| **AC-4** | OG uses brewhouse efficiency at batch volume | Unit | Synthetic profile `{batchSizeL: 20, brewhouseEfficiencyPct: 75, mashEfficiencyPct: 80, trubChillerLossL: 2, boilOffRateLPerHour: 3.5, boilTimeMin: 60}` + one 5 kg / 1.037 fermentable → `og` equals the hand-computed `1 + (11.0231 × 37 × 0.75) / 5.28344 / 1000` = `1.058` (3dp), and changing **only** `mashEfficiencyPct` leaves `og` bit-identical while moving `preBoilGravity` |
| **AC-5** | Pre-boil gravity uses mash efficiency at pre-boil volume | Unit | Same profile: `preBoilVolumeL === 25.5`; changing **only** `brewhouseEfficiencyPct` leaves `preBoilGravity` bit-identical |
| **AC-6** | Pellet bump is gone | Unit | Two `HopItem`s identical except `type: 'Pellet'` vs `'Leaf'` produce **exactly equal** IBU; `grep -rn "1\.1" packages/calculations/src` returns no utilisation multiplier |
| **AC-7** | `hopUtilizationPct` scales IBU linearly | Unit | Same hop at `hopUtilizationPct` 100 vs 87 → ratio `0.87` within `1e-9`; at `0` → exactly `0` |
| **AC-8** | Aroma and Whirlpool share hopstand utilisation | Unit | Identical hops differing only `use: 'Aroma'` vs `'Whirlpool'` → equal IBU; both equal the same hop as `'Boil'` × `0.26` within `1e-9` |
| **AC-9** | Whirlpool 15-minute clamp removed | Unit | `'Whirlpool'` at `timeMinutes: 30` yields strictly greater IBU than at `timeMinutes: 15` |
| **AC-10** | Degenerate hop inputs | Unit | IBU is exactly `0` for each of: `use: 'DryHop'` (any time); `timeMinutes: 0`; `timeMinutes: -5`; `amountG: 0`; `alphaAcidPct: 0`; `batchVolumeL: 0` (no division-by-zero/`Infinity`); `wortGravity: 1.0` (no extract present) |
| **AC-11** | `FirstWort` classifies as boil | Unit | `classifyHopUse('FirstWort') === 'boil'`; a `'FirstWort'` addition yields IBU exactly equal to the same addition as `'Boil'` |
| **AC-12** | Tinseth is fed OG, not pre-boil gravity | Unit | Holding fermentables fixed and raising `trubChillerLossL` (which lowers `preBoilVolumeL`→ raises `preBoilGravity` while leaving `og` unchanged) leaves total `ibu` bit-identical |
| **AC-13** | Morey / MCU degenerate input | Unit | `moreySrm(0) === 0`, `moreySrm(-1) === 0`, `mcuContribution(5, 3, 0) === 0` — no `NaN`, no `Infinity` |
| **AC-13b** | `gravityAtVolume` degenerate input | Unit | `gravityAtVolume(100, 75, 0) === 1.0`, `gravityAtVolume(0, 75, 20) === 1.0`, `gravityAtVolume(100, 0, 20) === 1.0`, `gravityAtVolume(100, -5, 20) === 1.0` — no `NaN`, no `Infinity` |
| **AC-14** | Empty recipe | Unit | `calculateRecipeStats` on a recipe with empty `fermentables`/`hops`/`yeasts` returns `og:1, fg:1, abv:0, ibu:0, srm:0, ebc:0, buGu:0, rbr:0, attenuationPct:0`; `Object.values(stats).every(Number.isFinite) === true` |
| **AC-15** | Empty yeast list falls back, does not crash | Unit | `averageAttenuationPct([]) === 75`; a recipe with fermentables but no yeast yields `fg < og` and finite `abv` |
| **AC-16** | Fixture harness loads all six | Unit | `loadFixtureRecipes()` returns exactly 6 entries with names `Buho Weissbier`, `Frontino Porter`, `IPL`, `Mapanare IPA`, `Navidad Red Ale`, `Tangara APA` |
| **AC-17** | Potential table has no per-recipe keys | Unit | The exported potentials object has exactly 16 keys, every key appears as a fermentable `name` in the fixture, and an unknown name throws |
| **AC-18** | Derived efficiencies are physically sane | Unit | Every recipe's derived `mashEfficiencyPct` ∈ `[60, 85]` — the only non-circular check on the potential table |
| **AC-19** | **Fixture OG** | Parameterised ×6 | `abs(ogPoints − fixture.ogPoints) <= TOL_POINTS(fixture.ogPoints)` for all six |
| **AC-20** | **Fixture IBU** | Parameterised ×6 | `abs(ibu − fixture.ibu) <= 1.5` for all six, **including Buho Weissbier**, whose currently-computed 21.0 vs actual 13 is the named failing case in `ROADMAP.md` line 50 |
| **AC-21** | **Fixture colour** | Parameterised ×6 | `abs(ebc − fixture.colorEBC) <= TOL_EBC(fixture.colorEBC)` for all six |
| **AC-22** | **Fixture FG** | Parameterised ×6 | `abs(fgPoints − fixture.fgPoints) <= 4.5` for all six |
| **AC-23** | **Fixture ABV** | Parameterised ×6 | `abs(abv − fixture.abvPct) <= 0.8` for all six |
| **AC-24** | **Fixture BU:GU** | Parameterised ×6 | `abs(buGu − fixture.buGu) <= 0.04` for all six |
| **AC-25** | **Fixture RBR** | Parameterised ×6 | `abs(rbr − fixture.rbr) <= 0.08` for all six |
| **AC-26** | Fixture mash water | Parameterised ×5 | `abs(mashWaterL − fixture.water.mashWaterL) / fixture.water.mashWaterL <= 0.01` for the five recipes carrying a `water` block (Tangara has none — the test must skip it explicitly, not silently pass on `undefined`) |
| **AC-27** | Fixture total water | Parameterised ×5 | `abs(totalWaterL − fixture.water.totalWaterL) / fixture.water.totalWaterL <= 0.03` |
| **AC-28** | Single shared calibration | Verification | `grep -rn "hopUtilizationPct\|HOPSTAND_UTILIZATION_FACTOR" packages/calculations/test` shows one assignment of each, applied to all six recipes; no recipe name or index appears as a key in any constant or override map in the test directory |
| **AC-29** | Fixture copy is byte-identical | Verification | `packages/calculations/test/fixtures/montano_brewing_recipes.json` produces the SHA-256 pinned as a constant in `fixtures.test.ts`, taken by hand from `.gsd/documents/montano_brewing_recipes.json` at copy time. **Corrected post-execution** — see the "Fixture data is copied, not moved" note above; the original wording (live cross-tree comparison) contradicted the same section's "no dependency on `.gsd/`" requirement and broke AC-30 on a genuine clone. |
| **AC-30** | Cold-clone test run | Command | From a clean checkout: `npm install && npm test` exits `0`; the vitest summary reports `0 failed` and at least 40 passing assertions |
| **AC-31** | Typecheck | Command | `npm run typecheck` exits `0` across all three packages |
| **AC-32** | Web build | Command | `npm run build` exits `0` and writes `apps/web/dist/index.html` |
| **AC-33** | Lint | Command | `npm run lint` exits `0` with no new warnings versus the pre-move baseline |
| **AC-34** | Workspace layout exists | Verification | `packages/shared-types/src/brewing.ts`, `packages/calculations/src/brewingMath.ts`, `packages/calculations/vitest.config.ts`, `apps/web/src/App.tsx` all exist; root `package.json` declares `"workspaces": ["apps/*", "packages/*"]` |
| **AC-35** | Old tree fully gone | Verification | `src/`, `index.html`, and `vite.config.ts` no longer exist at the repo root; no file under `apps/` or `packages/` imports via a `../../src/` path |
| **AC-36** | Dead assets deleted | Verification | `App.css`, `react.svg`, `vite.svg`, `hero.png` do not exist anywhere in `apps/` or `packages/`; `grep -rn "App.css" apps packages` returns nothing |
| **AC-37** | Web imports cross the package boundary | Verification | `apps/web/src/App.tsx` imports `calculateRecipeStats` from `@truchabrew/calculations` and its types from `@truchabrew/shared-types` — no relative path into another package |
| **AC-38** | No hardcoded stats in `StatsHeader` | Verification | `grep -n "75%\|78%" apps/web/src/components/StatsHeader.tsx` returns nothing; the file references `equipment.brewhouseEfficiencyPct` and `stats.attenuationPct` |
| **AC-39** | `hop.type` no longer affects any number | Verification | `grep -rn "\.type" packages/calculations/src` returns no reference to `HopItem.type` |
| **AC-40** | **Manual/visual check — running app** | Manual | `npm run dev`, load the Mapanare IPA fixture data through the designer, and screenshot `StatsHeader` showing OG/FG/ABV/IBU/EBC/BU:GU/RBR/Efficiency/Attenuation. Every displayed value matches the fixture within the same bands as AC-19…AC-25, and Efficiency/Attenuation are **not** `75%`/`78%`. Screenshot saved to `.gsd/active/manual_verification/M1_P1_stats_header.png`. A passing suite alone does not satisfy this AC (`ROADMAP.md` line 50). |
| **AC-41** | **Manual — reactivity** | Manual | With the dev server running, change the equipment profile's `hopUtilizationPct` from 87 to 43 in `seedData.ts`; the on-screen IBU roughly halves without a manual reload. Second screenshot at `.gsd/active/manual_verification/M1_P1_hop_utilization.png`. Revert the edit afterwards. |
| **AC-42** | **Scope guardrail** | Verification | Of the paths this milestone's session actually touched, **no** path under `.claude/`, `.agents/`, and no path under `.gsd/` other than `.gsd/active/M1_P1_feature_spec.md`, `.gsd/STATE.json`, and files under `.gsd/active/manual_verification/`. `CLAUDE.md`, `README.md`, `.oxlintrc.json` unmodified by this session. `git diff -M --find-renames=90% --name-status HEAD` classifies `srmColor.ts`, `FermentableSection.tsx`, `YeastSection.tsx`, `main.tsx`, `index.css`, `favicon.svg`, `icons.svg` as `R100` (pure renames, content untouched). **Corrected post-execution** — the raw `git diff --name-only HEAD` form false-positived on `CLAUDE.md` and `.claude/skills/map/SKILL.md`, both staged ~20h before this session by unrelated prior work (confirmed by mtime), not touched by the executor. The guardrail's intent is per-session provenance, not a literal whole-working-tree diff; check by mtime/session-start reference or a pre-execution stash point, whichever the verifying agent has available. |

---

## 4. Deviation Register — requires explicit sign-off at the halt gate

Three points where this spec departs from `ROADMAP.md`. Each is a deliberate, evidence-backed call, and each is reversible at this gate.

1. **`npm`, not `pnpm`** (`ROADMAP.md` line 50 says `pnpm test`). `package-lock.json` is committed and no pnpm lockfile exists; switching package managers mid-project is unrelated risk. All commands in §3 are npm. *Overrule by saying so — the spec's ACs then read `pnpm` throughout and `package-lock.json` is replaced.*

2. **The MCU "colour bug" is not a bug** (`ROADMAP.md` line 47, hardening item 3). Passing SRM into the Morey MCU slot matches Brewfather within +2.4…+2.8% on five of six fixtures; converting to Lovibond as the roadmap directs degrades five of six, worst case −13.8% on Navidad Red Ale. Evidence table in §3. M1 therefore *renames and documents* the slot rather than changing the formula, and ships tested Lovibond converters for display use. *Overrule and the Lovibond conversion ships instead, with AC-21's band widening to `max(1.5, 0.18 × expected)`.*

3. **FG / ABV / BU:GU / RBR / colour cannot meet the roadmap's flat ±1%.** ±1% is achievable for OG (with the ±1.0-point quantisation floor) and IBU meets its ±1.5 absolute band. The others cannot, for reasons that are model gaps rather than defects: FG needs mash-temperature fermentability (no mash profile exists until M3 — Buho's yeast is 86% attenuative while Brewfather reports 78.1% apparent), and Morey is a published approximation with known divergence at high MCU. Bands are set from measured per-recipe deltas: FG ±4.5 points, ABV ±0.8, BU:GU ±0.04, RBR ±0.08, EBC `max(1.0, 14%)`. Closing FG/ABV to ±1% is M3 scope and should be added to M3's verification threshold at the next `/steer`.

**Known execution risks** (not deviations — flagged so a miss routes correctly): the IBU fit rests on `hopUtilizationPct = 87` with `HOPSTAND_UTILIZATION_FACTOR = 0.26`, hand-fitted across all six recipes with worst-case residual +1.36 IBU on Mapanare and −1.37 on Navidad. Both sit inside ±1.5 but with under 0.15 IBU of headroom, so small differences in how OG lands will move them. If a fixture falls outside band, **route to `/diagnose` — do not add a per-recipe knob** (AC-28 exists to catch exactly that).

---
> **HALT GATE (STATE 2):** Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments. DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.

