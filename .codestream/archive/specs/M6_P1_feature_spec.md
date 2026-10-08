# FEATURE SPECIFICATION: M6_P1 — Water chemistry and mineral additions

- **Milestone:** M6 (Water chemistry and mineral additions)
- **Phase:** P1 (Water profile CRUD, ion contribution math, RA & predicted mash pH, salt auto-suggestion, and batch comparison)
- **Depends on:** Milestone 5.5 (shell, navigation, full-page forms, unified containers, direct batch edit mode) and Milestone 3 (Profile family pattern).
- **Layer:** End-to-end (Database schema & migration 0009, shared types, calculation engine, REST API, web UI components, recipe designer integration, batch detail comparison).

---

## Phase Summary

Water quality directly impacts mash pH, enzyme activity, and beer flavor balance. This phase introduces full water chemistry capabilities to TruchaBrew:

1. **Water Profiles**: Stored source (tap, RO, well) and target (city profiles, beer style targets) mineral profiles containing ion concentrations (Ca, Mg, Na, Cl, SO4, HCO3) and pH. Presets seeded via DB migration.
2. **Water Chemistry Engine**: Pure calculations for ion ppm contributions per gram of mineral salts (Gypsum, Calcium Chloride, Epsom Salt, Table Salt, Baking Soda), Residual Alkalinity (RA in mEq/L), predicted mash pH (based on grist composition and RA), and ion deltas between source and target profiles.
3. **Salt Auto-Suggestion**: Given a source profile, target profile, and batch water volume, automatically calculates recommended salt additions in grams and writes/updates them as `Misc` line items (`use: 'WaterAgent'`) on the recipe.
4. **Recipe & Batch Integration**: Source and Target water profile pickers in the recipe editor; predicted mash pH rendered live on the recipe; measured vs. predicted mash pH rendered side-by-side on the batch detail view.
5. **UI & Navigation Harmonization**: Dedicated `Water Profiles` manager adhering to M5.5's `TopBar`, `PageContainer`, `ListRow`, and full-page `WaterProfileForm` interaction patterns. `Sidebar.tsx` gains a 6th destination item (`Water`).

---

## Key Behaviors

1. **Profile Management**: Users can create, view, edit, and delete named source and target water profiles with 6 core ion metrics (Ca²⁺, Mg²⁺, Na⁺, Cl⁻, SO₄²⁻, HCO₃⁻) and pH.
2. **Ion Contribution Math**: Adding mineral salts (Gypsum, CaCl₂, Epsom, NaCl, Baking Soda) to recipe `Misc` items increases calculated finished water ion concentrations deterministically.
3. **Residual Alkalinity & Predicted Mash pH**: Mash pH is predicted live in the recipe editor from grist thermal/color mass and water Residual Alkalinity ($\text{RA} = \frac{\text{HCO}_3}{61} - (\frac{\text{Ca}}{1.4} + \frac{\text{Mg}}{1.7})$).
4. **Salt Auto-Suggestion Button**: Clicking "Auto-Suggest Salts" in the recipe water section calculates mineral requirements to bridge source-to-target ion deltas and generates/updates `Misc` (`WaterAgent`) items on the recipe.
5. **Batch Measured vs Predicted pH**: Batch detail displays predicted mash pH from the recipe snapshot beside actual measured mash pH (`measuredMashPh`).

---

## Resolved Ambiguities (Binding)

1. **Ion Contribution Constants**:
   - Gypsum ($\text{CaSO}_4 \cdot 2\text{H}_2\text{O}$): +61.5 ppm Ca, +147.4 ppm $\text{SO}_4$ per g/L.
   - Calcium Chloride ($\text{CaCl}_2 \cdot 2\text{H}_2\text{O}$): +72.0 ppm Ca, +127.0 ppm Cl per g/L.
   - Epsom Salt ($\text{MgSO}_4 \cdot 7\text{H}_2\text{O}$): +26.0 ppm Mg, +103.0 ppm $\text{SO}_4$ per g/L.
   - Table Salt ($\text{NaCl}$): +104.0 ppm Na, +161.0 ppm Cl per g/L.
   - Baking Soda ($\text{NaHCO}_3$): +80.0 ppm Na, +191.0 ppm $\text{HCO}_3$ per g/L.
2. **Residual Alkalinity & Mash pH Bounds**:
   - $\text{RA (mEq/L)} = (\text{HCO}_3 / 61.0) - ((\text{Ca} / 1.4) + (\text{Mg} / 1.7))$.
   - Baseline distilled mash pH starts at $5.60$ for base malt ($\le 10$ EBC), decreasing linearly with darker/roasted malts down to $5.20$ for dark crystal and $4.70$ for roasted malts.
   - $\Delta \text{pH} = \text{RA} \times 0.044$.
   - Predicted mash pH is bounded within $[4.50, 6.50]$ (clamped if math produces extreme values).
3. **Salt Auto-Suggest Priority & Non-Negative Bounds**:
   - Auto-suggestion solves deltas greedily: Calcium Chloride for Cl, Gypsum for $\text{SO}_4$, Epsom for Mg, Baking Soda for $\text{HCO}_3$, Table Salt for Na.
   - Grams calculated are non-negative ($\max(0, \text{grams})$); additions never subtract salts.
4. **Delete Safety Guardrail**:
   - Deleting a `WaterProfile` that is currently referenced by any stored recipe (`waterSourceId` or `waterTargetId`) is blocked with HTTP status `409` (`WATER_PROFILE_IN_USE`).
5. **Sidebar Expansion**:
   - `NAV_ITEMS` in `Sidebar.tsx` expands from 5 to 6 destinations: `Recipes`, `Equipment`, `Mash`, `Fermentation`, `Water`, `Batches`. `activeDestinationFor` maps `/water-profiles` to `water`.

---

## 1. Data Schema & Contracts

### 1.1 Database Migration `0009_water_profiles.sql` (Additive)

```sql
CREATE TABLE IF NOT EXISTS `water_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `type` text NOT NULL, -- 'source' | 'target'
  `calcium` real NOT NULL DEFAULT 0,
  `magnesium` real NOT NULL DEFAULT 0,
  `sodium` real NOT NULL DEFAULT 0,
  `chloride` real NOT NULL DEFAULT 0,
  `sulfate` real NOT NULL DEFAULT 0,
  `bicarbonate` real NOT NULL DEFAULT 0,
  `ph` real,
  `description` text
);

ALTER TABLE `recipes` ADD COLUMN `water_source_id` text REFERENCES `water_profiles`(`id`);
ALTER TABLE `recipes` ADD COLUMN `water_target_id` text REFERENCES `water_profiles`(`id`);
```

### 1.2 Shared Types (`packages/shared-types/src/brewing.ts` & `api.ts`)

```typescript
export type WaterProfileType = 'source' | 'target';

export interface WaterProfile {
  id: string;
  name: string;
  type: WaterProfileType;
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
  ph: number | null;
  description: number | string | null;
}

export interface WaterProfileInput {
  name: string;
  type: WaterProfileType;
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
  ph?: number | null;
  description?: string | null;
}

export interface WaterAnalysisResult {
  sourceProfile: WaterProfile | null;
  targetProfile: WaterProfile | null;
  waterVolumeL: number;
  finishedIons: {
    calcium: number;
    magnesium: number;
    sodium: number;
    chloride: number;
    sulfate: number;
    bicarbonate: number;
  };
  residualAlkalinity: number;
  predictedMashPh: number;
}
```

### 1.3 Symbol Inventory

**New Files:**
- `packages/calculations/src/water.ts` (pure water math, RA, predicted pH, salt auto-suggest)
- `packages/calculations/test/water.test.ts` (unit tests for water math)
- `apps/api/src/routes/waterProfiles.ts` (Fastify REST CRUD endpoints)
- `apps/api/test/waterProfiles.test.ts` (API route unit/integration tests)
- `apps/web/src/components/WaterProfileManager.tsx` (List view for water profiles)
- `apps/web/src/components/WaterProfileForm.tsx` (Full-page create/edit form)
- `apps/web/src/components/WaterSection.tsx` (Recipe editor water section)
- `apps/web/test/WaterProfileManager.test.tsx` (Frontend manager tests)
- `apps/web/test/WaterProfileForm.test.tsx` (Frontend form tests)

**Modified Files:**
- `packages/shared-types/src/brewing.ts` (WaterProfile types added, Recipe gains waterSourceId / waterTargetId)
- `packages/shared-types/src/api.ts` (WaterProfile DTOs & error codes added)
- `packages/calculations/src/index.ts` (Re-exports water functions)
- `apps/api/src/db/schema.ts` (Drizzle schema definition for water_profiles table and recipe FKs)
- `apps/api/src/db/seed.ts` (Seeds default water profile presets)
- `apps/api/src/routes/recipes.ts` (Handles waterSourceId & waterTargetId)
- `apps/web/src/components/Sidebar.tsx` (Adds `Water` destination to `NAV_ITEMS`)
- `apps/web/src/App.tsx` (Routes `/water-profiles` view and passes handlers)
- `apps/web/src/pages/BatchDetail.tsx` (Renders predicted mash pH beside measured mash pH)

---

## 2. Transformations & Pure Logic

### 2.1 Pure Logic Functions (`packages/calculations/src/water.ts`)

```typescript
export function calculateResidualAlkalinity(hco3: number, ca: number, mg: number): number {
  return (hco3 / 61.0) - ((ca / 1.4) + (mg / 1.7));
}

export function calculateFinishedIons(
  source: WaterProfile | null,
  waterVolumeL: number,
  miscs: MiscItem[]
): WaterAnalysisResult['finishedIons'];

export function predictMashPh(
  grist: FermentableItem[],
  waterVolumeL: number,
  residualAlkalinity: number
): number;

export function suggestSaltAdditions(
  source: WaterProfile | null,
  target: WaterProfile | null,
  waterVolumeL: number
): { saltName: string; amountGrams: number }[];
```

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | Mineral Salt Constants | Unit Test (`water.test.ts`) | Gypsum, CaCl₂, Epsom, NaCl, Baking Soda ion ppm contributions match exact specification values |
| **AC-2** | Residual Alkalinity Math | Unit Test (`water.test.ts`) | `calculateResidualAlkalinity(150, 60, 10)` equals `0.9252` mEq/L within $10^{-4}$ tolerance |
| **AC-3** | Finished Ion Accumulation | Unit Test (`water.test.ts`) | Adding 5g Gypsum to 20L water increases Ca by 15.375 ppm and SO₄ by 36.85 ppm |
| **AC-4** | Predicted Mash pH Base Malt | Unit Test (`water.test.ts`) | Pure base malt grist with 0 RA yields predicted mash pH of 5.60 |
| **AC-5** | Predicted Mash pH Dark Grist | Unit Test (`water.test.ts`) | Grist with dark roasted malts decreases predicted mash pH below 5.20 |
| **AC-6** | Salt Auto-Suggest Non-Negative | Unit Test (`water.test.ts`) | Auto-suggest salt amounts are always $\ge 0$ grams; excess source ions yield 0g addition |
| **AC-7** | Database Migration 0009 | Integration (`waterProfiles.test.ts`) | `0009_water_profiles.sql` applies cleanly to SQLite DB; `water_profiles` table created with 11 columns |
| **AC-8** | Default Preset Seeds | Integration (`waterProfiles.test.ts`) | Seeding populates default source (Tap, RO) and target (Balanced, Light & Hoppy, Clarty & Malty) profiles |
| **AC-9** | GET /api/water-profiles | Integration (`waterProfiles.test.ts`) | `GET /api/water-profiles` returns array of all water profiles with status 200 |
| **AC-10** | POST /api/water-profiles Validation | Integration (`waterProfiles.test.ts`) | Creating profile with missing `name` or negative ion concentration returns status 400 |
| **AC-11** | PUT /api/water-profiles/:id | Integration (`waterProfiles.test.ts`) | Updating profile modifies fields in DB and returns updated profile with status 200 |
| **AC-12** | DELETE /api/water-profiles In-Use Guard | Integration (`waterProfiles.test.ts`) | Deleting water profile assigned to a recipe returns status 409 `WATER_PROFILE_IN_USE` |
| **AC-13** | Sidebar Destination Expansion | Component (`Sidebar.test.tsx`) | `NAV_ITEMS` contains 6 destinations; `Water` resolves to `/water-profiles` |
| **AC-14** | WaterProfileManager Full Page | Component (`WaterProfileManager.test.tsx`) | Manager renders TopBar titled "Water Profiles" with `+ New Profile` action in `PageContainer` |
| **AC-15** | WaterProfileForm Render & Submit | Component (`WaterProfileForm.test.tsx`) | Form renders all 6 ion inputs; submitting calls `createWaterProfile` or `updateWaterProfile` |
| **AC-16** | Recipe Editor Water Section | Component (`App.test.tsx`) | Recipe editor displays Source & Target profile dropdowns and Predicted Mash pH badge |
| **AC-17** | Recipe Auto-Suggest Button | Component (`App.test.tsx`) | Clicking "Auto-Suggest Salts" updates recipe `Misc` items with calculated mineral additions |
| **AC-18** | Batch Detail Measured vs Predicted pH | Component (`BatchDetail.test.tsx`) | Batch detail displays predicted mash pH from recipe snapshot alongside measured mash pH |
| **AC-19** | Full Test Suite Gate | Command | `npm test` passes across all 3 workspaces (api, web, calculations) with 0 failures |
| **AC-20** | Typecheck & Build Gate | Command | `npm run typecheck` and `npm run build` exit 0 across all workspace projects |
| **AC-21** | Scope Guardrail | Manifest Diff | SHA-256 content manifest diff (`git ls-files -co --exclude-standard -z \| xargs -0 sha256sum`) matches specified new/modified files exactly |

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
