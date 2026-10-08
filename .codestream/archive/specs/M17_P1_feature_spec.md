# FEATURE SPECIFICATION: M17_P1 - Split Packaging Calculator (Bottles vs Kegs) & Post-Brew Equipment Calibration

## Phase Summary
Enhance the `Conditioning / Packaging` stage tab of `BatchDetail.tsx` into a packaging manager and post-brew calibration station (`FEAT-015`, `FEAT-002`). This phase delivers:
1. **Split Packaging Calculator (`SplitPackagingPanel.tsx`)**: Enables dividing finished beer volume into multiple packaging destinations (e.g. 10 L into Keg @ 2.4 vol CO2 + 9 L into 330mL bottles primed with priming sugar). Computes exact priming sugar by sugar type (Table Sugar/Sucrose, Corn Sugar/Dextrose, DME, Honey), bottle count, and regulator equilibrium force carbonation PSI with zero external dependencies.
2. **Post-Brew Calibration & Equipment Feedback Loop (`PostBrewCalibrationModal.tsx`)**: Compares estimated targets vs. achieved brew day metrics (Mash Efficiency %, Brewhouse Efficiency %, Boil-Off Rate L/hr, and Kettle Trub Loss L). Provides a 1-click **"Calibrate Equipment Profile"** action (`PUT /api/equipment-profiles/:id`) and **"Calibrate Recipe Target Efficiency"** action (`PUT /api/recipes/:id`) to update future batches with real brewhouse performance.
3. **Structured Sensory Evaluation & BJCP Scoring Panel (`SensoryEvaluationPanel.tsx`)**: 5-axis structured tasting evaluation (Aroma max 12, Appearance max 3, Flavor max 20, Mouthfeel max 5, Overall Impression max 10) yielding official 50-point BJCP score tier mapping (Outstanding, Excellent, Very Good, Good, Fair, Problematic) and 1–5 star rating, persisted into batch taste rating and notes.

---

### Key Behaviors
1. **Unified Packaging & Carbonation Manager (`SplitPackagingPanel.tsx`)**:
   - Consolidates packaging configuration and eliminates redundant legacy form fields (`carbonationType`, `carbonationVolumesTarget`, `carbonationTempC`, and redundant `Packaged Volume` input) and the old static `CarbonationPanel`.
   - The top measurement card retains true final physical measurements: `Measured FG (SG)` and editable `Packaging / Bottling Date` (`bottlingDate`).
   - `SplitPackagingPanel` initializes dynamically:
     - If all beer is packaged in bottles, 1 Bottle package row is created allocating 100% of the volume.
     - If all beer is packaged in kegs, 1 Keg package row is created allocating 100% of the volume.
     - Users can add packaging destinations on the fly (e.g., half keg, half bottles, or multiple bottle sizes) with live allocation balance tracking.
   - For keg runs: derives equilibrium regulator PSI from storage temperature and target volumes CO2.
   - For bottle runs: derives exact sugar mass in grams based on selected sugar type (Table Sugar = 1.0x, Corn Sugar / Dextrose = 1.09x, DME = 1.40x, Honey = 1.33x), peak fermentation temperature, and bottle count based on selectable unit sizes (330 mL, 355 mL, 500 mL, 750 mL).
   - **Priming Solution & Syringe Bottle Dosing Tool**:
     - Calculates water/sugar solution dilution accounting for sugar displacement volume ($0.625\text{ mL/g}$).
     - Dual-mode calculation:
       - **Mode A (By Water Volume)**: Brewer specifies boiling water volume (e.g. 200 mL) $\rightarrow$ computes Total Solution Volume (mL) and exact Syringe Injection Dose (mL/bottle).
       - **Mode B (By Syringe Dose)**: Brewer specifies desired dose per bottle (e.g. 5.0 mL or 10.0 mL) $\rightarrow$ computes exact required boiling water volume (mL) and total solution volume.
     - Displays clear brewing instructions (e.g. *"Dissolve 28.8g sugar in 182 mL water to yield 200 mL solution; inject 2.35 mL into each bottle."*).
   - Surfaces real-time balance indicator showing assigned volume vs. remaining unassigned volume.
2. **Post-Brew Equipment & Recipe Calibration**:
   - Calculates achieved boil-off rate: $((V_{\text{preBoil}} - V_{\text{postBoil}}) / (t_{\text{boilMin}} / 60))$. If post-boil volume is unmeasured, estimates from measured OG and pre-boil gravity points.
   - Calculates achieved kettle trub loss: $\max(0, V_{\text{postBoil}} - V_{\text{fermenter}})$.
   - Calculates achieved mash and brewhouse efficiency deltas against recipe/equipment targets.
   - "Calibrate Equipment Profile" button opens confirmation modal displaying side-by-side proposed equipment profile updates and commits via `updateEquipmentProfile`.
   - "Calibrate Recipe Efficiency" updates the recipe target efficiency to match achieved brewhouse efficiency.
3. **Structured Sensory & BJCP Scoring**:
   - Interactive 5-slider or input sensory form for standard BJCP categories (Aroma 0-12, Appearance 0-3, Flavor 0-20, Mouthfeel 0-5, Overall 0-10).
   - Calculates total score (0-50), maps to BJCP tier ("Outstanding (45-50)", "Excellent (38-44)", "Very Good (30-37)", "Good (21-29)", "Fair (14-20)", "Problematic (0-13)"), and syncs with `formData.tasteRating` (1 to 5 stars).
   - 1-click "Save Tasting Note" appends structured sensory assessment to `batch.notes` (`POST /api/batches/:id/notes`).

---

### Resolved Ambiguities (Binding)
1. **Priming Sugar Relative Fermentability Multipliers**:
   - Sucrose / Table Sugar: `1.00`
   - Dextrose (Corn Sugar / Glucose Monohydrate): `1.09`
   - Dry Malt Extract (DME): `1.40`
   - Honey: `1.33`
   - Formula: $\text{primingSugarG}(\text{target}, T_{\text{peak}}, V_{\text{bottles}}) \times \text{multiplier}$.
2. **Priming Solution Displacement & Syringe Dose Math**:
   - Sugar volume displacement: $0.625\text{ mL}$ per gram of sucrose equivalent ($V_{\text{sugarDisplacement}} = \text{sugarG} \times 0.625$).
   - $\text{Total Solution (mL)} = V_{\text{water}} + V_{\text{sugarDisplacement}}$.
   - $\text{Syringe Dose (mL/bottle)} = \text{Total Solution (mL)} / \text{Bottle Count}$.
   - Conversely, given target syringe dose $d$ (mL/bottle):
     $\text{Total Solution (mL)} = d \times \text{Bottle Count}$;
     $V_{\text{waterNeeded}} = \max(0, \text{Total Solution} - V_{\text{sugarDisplacement}})$.
3. **Split Volume Reconciliation**:
   - Total assigned volume: $\sum V_{\text{packages}}$.
   - Remaining unassigned volume: $\text{totalBeerVolumeL} - \text{totalAssignedVolumeL}$.
   - If remaining $> 0$, displays "X L unassigned"; if remaining $< 0$, displays warning "Exceeds total volume by Y L".
4. **Boil-off & Efficiency Calibration Bounds**:
   - Boil-off rate is clamped to realistic physical bounds $[0.5, 10.0]\text{ L/hr}$.
   - Trub loss is clamped to $[0.0, 10.0]\text{ L}$.
   - Brewhouse efficiency is clamped to $[30.0, 95.0]\%$.
5. **Sensory Score to Star Rating Mapping**:
   - Score $\ge 45$: 5 stars
   - Score $38 - 44$: 4 stars
   - Score $30 - 37$: 3 stars
   - Score $21 - 29$: 2 stars
   - Score $\le 20$: 1 star

---

## 1. Data Schema & Contracts

### 1.1 Exported Types & Interfaces (`packages/calculations/src/carbonation.ts`)

```typescript
export type PrimingSugarType = 'table_sugar' | 'corn_sugar' | 'dme' | 'honey';

export interface PrimingSugarOptions {
  volumesCO2Target: number;
  peakFermentationTempC: number;
  beerVolumeL: number;
  sugarType?: PrimingSugarType;
}

export type SplitPackageType = 'keg' | 'bottles';

export interface SplitPackageInput {
  id: string;
  type: SplitPackageType;
  volumeL: number;
  targetVolumesCO2: number;
  // Keg specific
  tempC?: number; // storage temperature for force carbonation PSI
  // Bottle specific
  sugarType?: PrimingSugarType;
  bottleSizeMl?: number;
}

export interface SplitPackageResult {
  id: string;
  type: SplitPackageType;
  volumeL: number;
  targetVolumesCO2: number;
  // Keg outputs
  forceCarbonationPsi: number | null;
  // Bottle outputs
  primingSugarG: number | null;
  primingSugarEquivGPerL: number | null;
  bottleCount: number | null;
  sugarGramsPerBottle: number | null;
}

export interface SplitPackagingSummary {
  totalPackagedVolumeL: number;
  unassignedVolumeL: number;
  results: SplitPackageResult[];
}
```

### 1.2 Pure Function Contracts (`packages/calculations/src/carbonation.ts` & `equipmentDriven.ts`)

```typescript
export function calculatePrimingSugarCustom(input: PrimingSugarOptions): number;

export function calculateSplitPackaging(
  totalBeerVolumeL: number,
  peakFermentationTempC: number,
  packages: readonly SplitPackageInput[]
): SplitPackagingSummary;

export interface CalibrationEvaluationInput {
  recipe: Recipe;
  measuredPreBoilGravity: number | null;
  measuredOg: number | null;
  measuredFg: number | null;
  measuredPreBoilSizeL?: number | null;
  measuredPostBoilSizeL?: number | null;
  measuredBottlingSizeL?: number | null;
  measuredBoilTimeMin?: number | null;
}

export interface CalibrationEvaluationResult {
  canCalibrate: boolean;
  estimatedBrewhouseEfficiencyPct: number;
  achievedBrewhouseEfficiencyPct: number | null;
  estimatedMashEfficiencyPct: number;
  achievedMashEfficiencyPct: number | null;
  currentBoilOffRateLPerHour: number;
  achievedBoilOffRateLPerHour: number | null;
  currentTrubLossL: number;
  achievedTrubLossL: number | null;
}

export function evaluateBatchCalibration(input: CalibrationEvaluationInput): CalibrationEvaluationResult;

export interface SensoryScoreInput {
  aroma: number; // 0-12
  appearance: number; // 0-3
  flavor: number; // 0-20
  mouthfeel: number; // 0-5
  overall: number; // 0-10
}

export interface BJCPScoreResult {
  totalScore: number; // 0-50
  tier: 'Outstanding' | 'Excellent' | 'Very Good' | 'Good' | 'Fair' | 'Problematic';
  suggestedStarRating: number; // 1-5
}

export function calculateBJCPScore(input: SensoryScoreInput): BJCPScoreResult;
```

---

## 2. Component Architecture & Integration Contracts

### 2.1 Component Structure
- `apps/web/src/components/SplitPackagingPanel.tsx` (New Component):
  - Standardized package list header with `Packages ({packages.length})` and single `+ Add Package` action (matching the mash/fermentation step pattern).
  - Each package row allows selecting `Destination` (`Bottles` vs `Keg`), `Volume (L)`, and `Target CO2 (vols)`.
  - Displays dynamic priming sugar calculations per sugar type, bottle counts, force carbonation PSI, and syringe dosing instructions.
  - Live total volume meter showing assigned vs. unassigned volume.
- `apps/web/src/components/PostBrewCalibrationModal.tsx` (New Component):
  - Side-by-side comparison modal showing estimated vs achieved brewhouse efficiency, boil-off rate, and trub losses.
  - 1-click "Update Equipment Profile" action calling `updateEquipmentProfile(profileId, patch)`.
  - 1-click "Update Recipe Target Efficiency" action calling `updateRecipe(recipeId, patch)`.
- `apps/web/src/components/SensoryEvaluationPanel.tsx` (New Component):
  - 5-category BJCP evaluation sliders/inputs.
  - Live total score display (0–50), tier badge, and 5-star rating preview.
  - "Log Tasting Note" button logging structured notes to batch.
- `apps/web/src/pages/BatchDetail.tsx` (Integrated in `activeTab === 'completed'`):
  - Streamlines the top card into `Packaging Measurements` (Measured FG, editable Packaging Date).
  - Mounts `SplitPackagingPanel` (with Priming Solution & Syringe Dosing tool), `MeasuredComparison` with calibration button, `PostBrewCalibrationModal`, and `SensoryEvaluationPanel`.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| AC-1 | Custom Priming Sugar Multipliers | Unit Test | Calculates exact sugar grams for Table Sugar (1.0x), Corn Sugar (1.09x), DME (1.40x), and Honey (1.33x). |
| AC-2 | Split Packaging Keg Calculation | Unit Test | Computes equilibrium force carbonation PSI for keg vessels given storage temperature and target CO2. |
| AC-3 | Split Packaging Bottle Calculation | Unit Test | Computes priming sugar grams, sugar per bottle, and bottle count given volume, target CO2, and bottle size. |
| AC-4 | Split Packaging Volume Summary & Balance | Unit Test | Correctly calculates total assigned volume and remaining unassigned volume across mixed packaging runs. |
| AC-5 | Post-Brew Calibration Metrics Derivation | Unit Test | Evaluates achieved brewhouse efficiency, mash efficiency, boil-off rate, and trub loss from measured batch values with clamping. |
| AC-6 | BJCP Sensory Score Calculation & Tier Mapping | Unit Test | Calculates total score (0–50), assigns correct BJCP quality tier, and derives 1–5 star rating. |
| AC-7 | SplitPackagingPanel Component Rendering | Component Test | Renders packaging rows with unified "+ Add Package" button, row deletion, and inline Destination switcher (Bottles vs Keg). |
| AC-8 | SplitPackagingPanel Live Output Updates | Component Test | Changing sugar type or bottle size dynamically updates sugar mass and bottle count. |
| AC-9 | PostBrewCalibrationModal Rendering & Diffs | Component Test | Displays side-by-side metrics comparing current equipment profile values vs. achieved brew day metrics. |
| AC-10 | Calibrate Equipment Profile Action | Integration Test | Clicking "Update Equipment Profile" issues `PUT /api/equipment-profiles/:id` with calibrated parameters. |
| AC-11 | Calibrate Recipe Efficiency Action | Integration Test | Clicking "Update Recipe Target" issues `PUT /api/recipes/:id` with calibrated brewhouse efficiency. |
| AC-12 | SensoryEvaluationPanel Component & Sliders | Component Test | Sliders/inputs update score in real-time, displaying tier badge and star rating. |
| AC-13 | Log Sensory Tasting Note Action | Integration Test | Clicking "Save Tasting Note" appends structured note to batch notes and updates batch rating. |
| AC-14 | BatchDetail Conditioning Tab Integration | Integration Test | Mounts SplitPackagingPanel as single packaging source, editable packaging date, calibration triggers, and SensoryEvaluationPanel. |
| AC-15 | Four Gates Clean | Gate | `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` all exit 0. |
| AC-16 | Scope Guardrail | Manifest Diff | Only files in §4 allowlist are modified/created. Protected files `fixtures.test.ts` and `designSystem.ts` are byte-unchanged. |
| AC-17 | Priming Solution Dilution & Syringe Dosing | Unit & Component Test | Accurately calculates total solution volume, required water volume, and syringe dose (mL/bottle) accounting for sugar displacement volume. |

---

## 4. Scope Guardrail Allowlist
Permitted files for Milestone 17 Phase 1:
- `packages/calculations/src/carbonation.ts`
- `packages/calculations/src/equipmentDriven.ts`
- `packages/calculations/src/index.ts`
- `packages/calculations/test/carbonation.test.ts`
- `packages/calculations/test/calibration.test.ts`
- `apps/web/src/components/SplitPackagingPanel.tsx`
- `apps/web/src/components/PostBrewCalibrationModal.tsx`
- `apps/web/src/components/SensoryEvaluationPanel.tsx`
- `apps/web/src/pages/BatchDetail.tsx`
- `apps/web/test/SplitPackagingPanel.test.tsx`
- `apps/web/test/PostBrewCalibrationModal.test.tsx`
- `apps/web/test/SensoryEvaluationPanel.test.tsx`
- `apps/web/test/BatchDetail.test.tsx`
- `.gsd/FEATURES.md`
- `.gsd/ROADMAP.md`
- `.gsd/STATE.json`

Protected files (must remain byte-unchanged):
- `packages/calculations/test/fixtures.test.ts`
- `packages/calculations/src/constants.ts`
- `apps/web/src/components/designSystem.ts`

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
