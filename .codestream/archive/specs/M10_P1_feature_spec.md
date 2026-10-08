# FEATURE SPECIFICATION: M10_P1 — External Recipe Ingestion (Brewfather JSON)

- **Milestone:** M10 (External Recipe Ingestion) — **single-phase milestone (M10_P1)**
- **Phase:** P1 of 1
- **Depends on:** M2_P1 (`RecipeWriteInput`, `createRecipe`, recipe database schema), M3_P1 (`EquipmentProfile` default resolution), M7_P1 (`ConfigContext`), M5.5_P3 (`RecipeLibrary` layout & TopBar).
- **Layer:** Pure parser module in `packages/calculations/src/brewfatherImport.ts`, shared types in `packages/shared-types`, REST ingestion route `POST /api/recipes/import/brewfather` in `apps/api`, and 1-click file upload in `apps/web/src/components/RecipeLibrary.tsx`. **A complete vertical slice.**
- **Verification threshold this phase is accountable for** (`.gsd/ROADMAP.md` Milestone 10):
  - *"All six recipes in `montano_brewing_recipes.json` import successfully and produce recipe records whose calculated OG, FG, ABV, IBU, and Color match TruchaBrew engine outputs."*
  - *"Duplicate imports succeed cleanly with distinct names (auto-suffixing `(Imported)`)."*
  - *"Pre-existing recipe CRUD and test suites remain untouched."*

---

## 1. Scope & System Surface

### 1.1 Summary of Changes
1. **Pure Ingestion Logic (`packages/calculations/src/brewfatherImport.ts`):**
   - Pure parser `parseBrewfatherJson(rawJson: unknown, defaultEquipmentId: string): RecipeWriteInput[]`.
   - Handles single Brewfather recipe objects, collection documents with `recipes: [...]`, and raw arrays `[...]`.
   - Maps fermentables, hops, yeasts, and miscs into TruchaBrew domain shapes with robust unit and timing extraction.
2. **REST Ingestion Endpoint (`POST /api/recipes/import/brewfather` in `apps/api/src/routes/recipes.ts`):**
   - Accepts raw JSON string or object payload.
   - Automatically queries default equipment profile ID if not specified in request.
   - Resolves recipe name collisions by generating `[Name] (Imported)`, `[Name] (Imported 2)`, etc.
   - Atomically inserts imported recipes and returns `201 Created` with array of `StoredRecipe` objects and `ImportSummary`.
3. **Web UI Ingestion Flow (`apps/web/src/components/RecipeLibrary.tsx` & `api/client.ts`):**
   - Adds "Import JSON" button with file picker trigger in `RecipeLibrary` TopBar.
   - Direct 1-click file selection, uploading parsed file to API, updating recipe list immediately, and presenting success notice.

### 1.2 Resolved Ambiguities & Fallback Rules

1. **Payload Root Structure Handling:**
   - Single Recipe Object: If root object has `name` and `fermentables` (or `hops`), wrap into single-item array `[root]`.
   - Collection Document: If root object has `recipes` array (like `montano_brewing_recipes.json`), parse `root.recipes`.
   - Array: If root is an Array `[...]`, parse each element.
   - Anything else or empty list throws descriptive `400 VALIDATION_FAILED` error.
2. **Duplicate Name Disambiguation:**
   - Existing recipes in database are queried for matching names.
   - If `name` already exists, format as `${name} (Imported)`.
   - If `${name} (Imported)` also exists, format as `${name} (Imported 2)`, `${name} (Imported 3)`, incrementing counter until unique.
3. **Fermentable Type & Color Mapping:**
   - Brewfather `type` mapped: `'Grain'` -> `'Grain'`, `'Sugar'` -> `'Sugar'`, `'Extract'` / `'Liquid Extract'` -> `'LiquidExtract'`, `'Dry Extract'` -> `'DryExtract'`, `'Adjunct'` -> `'Adjunct'`. Case-insensitive match, default `'Grain'`.
   - Color: If `color` (SRM) is given, use directly. If only `colorEBC` is given, convert `colorEBC / 1.97` (SRM). Default `0`.
   - Potential: If `potential` (e.g. `1.037`) is given, use directly. If `potential` is missing, derive standard default `1.036`.
4. **Hop Use, Timing & Alpha Acid:**
   - Brewfather `use` string normalized:
     - `'Boil'` or contains `'boil'` -> `use = 'Boil'`, `boilMins = parseMinutes(time)`.
     - `'Dry Hop'` / `'DryHop'` / contains `'dry'` -> `use = 'DryHop'`, `timeMinutes = parseMinutes(time) || parseDays(time) * 1440`.
     - `'First Wort'` / `'FirstWort'` -> `use = 'FirstWort'`, `boilMins = parseMinutes(time)`.
     - `'Whirlpool'` / `'Hopstand'` / `'Aroma'` -> `use = 'Whirlpool'`, `whirlpoolMins = parseMinutes(time) || 20`, `whirlpoolTempC = parseTemp(temp) || 90`.
   - Time string parsing: Parses integer from string like `"60 min"`, `"20 min"`, `"3 days"` or direct numeric value.
5. **Yeast Laboratory, Attenuation & Type:**
   - `laboratory` mapped from `yeast.laboratory` || `yeast.brand` || `'Unknown'`.
   - `attenuationPct` mapped from `yeast.attenuation` || `yeast.attenuationPct` || `75`.
   - `type` mapped to `'Ale' | 'Lager' | 'Wheat' | 'Hybrid'` (case-insensitive substring match, default `'Ale'`).
   - `amountPkg` parsed from numeric or string e.g. `"2 packets"` -> `2`, default `1`.
6. **Misc Type, Use & Unit Mapping:**
   - `type` mapped: `"Water Agent"` -> `'WaterAgent'`, `"Fining"` -> `'Fining'`, `"Flavor"` -> `'Flavor'`, else `'Other'`.
   - `use` mapped: `"Mash"` -> `'Mash'`, `"Sparge"` -> `'Sparge'`, `"Boil"` -> `'Boil'`, `"Primary"` -> `'Primary'`, else `'Other'`.
   - Amount and Unit extracted from composite string e.g. `"3.29 g"` -> `amount = 3.29, unit = 'g'`, `"1 item"` / `"1.12 items"` -> `amount = 1.12, unit = 'items'`.

---

## 2. Contracts & Data Schema

### 2.1 Pure Function Contracts (`packages/calculations/src/brewfatherImport.ts`)

```ts
export interface BrewfatherImportOptions {
  defaultEquipmentId: string;
  defaultMashProfileId?: string | null;
  defaultFermentationProfileId?: string | null;
}

export function parseBrewfatherJson(
  raw: unknown,
  options: BrewfatherImportOptions
): RecipeWriteInput[];
```

### 2.2 REST Ingestion Endpoint

- **Route:** `POST /api/recipes/import/brewfather`
- **Request Body:** Raw JSON (single recipe or collection).
- **Response (`201 Created`):**
  ```ts
  export interface RecipeImportResponse {
    importedCount: number;
    recipes: StoredRecipe[];
  }
  ```
- **Errors:**
  - `400 VALIDATION_FAILED`: Invalid JSON or no valid recipes found in payload.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | Single Brewfather recipe JSON parse | Unit | Parses single recipe object into `RecipeWriteInput` with all fields populated |
| AC-2 | Collection Brewfather JSON parse | Unit | Parses `{ recipes: [...] }` into `RecipeWriteInput[]` matching array length |
| AC-3 | Montano Brewing fixture ingestion | Unit | Parses all 6 recipes in `montano_brewing_recipes.json` without throwing |
| AC-4 | Calculated stats parity on imported recipes | Unit | Calculating stats via `calculateRecipeStats` on imported `Buho Weissbier` yields OG 1.052 ± 0.002, IBU 13 ± 2, Color ~9 EBC |
| AC-5 | Fermentable type and color conversion | Unit | EBC converted to SRM (`colorEBC / 1.97`); grain types mapped accurately |
| AC-6 | Hop use and timing string parsing | Unit | `"60 min"` -> `boilMins: 60`; `"Hopstand @ 90C"` -> `whirlpoolMins: 20`, `whirlpoolTempC: 90` |
| AC-7 | Yeast strain attenuation and brand extraction | Unit | `"WB-06 Safbrew Wheat"`, brand `"Fermentis"` -> `laboratory: "Fermentis"`, `attenuationPct: 86` |
| AC-8 | Misc item parsing from composite strings | Unit | `"3.29 g"` -> `amount: 3.29`, `unit: "g"`; `"Water Agent"` -> `'WaterAgent'` |
| AC-9 | Purity and immutability | Unit | `parseBrewfatherJson` does not mutate input object or global state |
| AC-10 | `POST /api/recipes/import/brewfather` endpoint | Integration | Posts JSON payload -> returns 201 with `importedCount` and `recipes` array |
| AC-11 | Duplicate recipe name disambiguation | Integration | Importing `Buho Weissbier` twice creates `Buho Weissbier` and `Buho Weissbier (Imported)` |
| AC-12 | Triplicate recipe name disambiguation | Integration | Third import creates `Buho Weissbier (Imported 2)` |
| AC-13 | Invalid payload rejection | Integration | Non-JSON or empty object payload returns `400 VALIDATION_FAILED` |
| AC-14 | TopBar "Import JSON" button presence | Component | `RecipeLibrary` renders "Import JSON" button in TopBar with file input |
| AC-15 | 1-Click File Upload flow | Component | Triggering file change calls API client `importBrewfatherRecipes`, shows success notice, reloads list |
| AC-16 | Failed upload error display | Component | API error displays alert notice without crashing library view |
| AC-17 | Pre-existing recipe CRUD preserved | Integration | Existing `GET/POST/PUT/DELETE /api/recipes` routes and tests pass unmodified |
| AC-18 | Layer 1 four gates exit 0 | Verification | `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all exit 0 |
| AC-19 | Scope guardrail manifests | Verification | Pre- and post-exec SHA-256 manifests confirm zero Untouched file contamination |
| AC-20 | `BUGS.md` and `FEATURES.md` integrity | Verification | Backlog defect logs remain intact |

**20 Acceptance Criteria.**

---

## 4. Deviation Register

1. **Direct 1-Click Ingestion instead of Preview Wizard:** The user explicitly chose a streamlined 1-click import in the Recipe Library TopBar with automatic name disambiguation (`(Imported)`) rather than a multi-step modal wizard.
2. **Default Profile Linking:** Imported recipes link to the existing default `EquipmentProfile` (and null mash/fermentation profiles) rather than generating duplicate global equipment profile records, keeping the profile catalog clean.

---

> **HALT GATE (STATE 2):** This specification is complete and presented for review.
>
> Implementation code generation is strictly forbidden until explicit approval.
> To approve and proceed to execution, reply with **`SPEC_APPROVED`**.
