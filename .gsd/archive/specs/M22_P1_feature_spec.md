# FEATURE SPECIFICATION: M22_P1 - External Provider Recipe Ingestion in Settings (FEAT-010)

**Milestone:** 22 — External Provider Recipe Ingestion in Settings  
**Phase:** 1 (of 1 estimated)  
**Features formalized:** `FEAT-010`  
**Refinement:** Initial draft  
**Bugs absorbed:** none  

---

## Phase Summary

Deliver a dedicated "Data & Imports / External Providers" section in Settings (`SettingsManager.tsx`) and an interactive Pre-Flight Recipe Import & Conflict Resolution Modal (`RecipeImportModal.tsx`) (`FEAT-010`). 

Users can upload external recipe files (Brewfather `.json` single/multi-recipe exports and BeerXML `.xml` files), review parsed vitals (OG, FG, ABV, IBU, Color, Style, Batch Size) and ingredient breakdowns, assign target equipment profiles, resolve name collisions (*Skip*, *Overwrite*, *Save as Copy*), and batch-import recipes into their TruchaBrew library.

---

## 1. Resolved Ambiguities & Binding Domain Contracts

1. **File Ingestion & Supported Formats:**
   - **Brewfather JSON (`.json`)**: Handles single recipe exports (object with `name`, `batchSize`, etc.) and multi-recipe array exports `[ { ... }, { ... } ]` or `{ "recipes": [ ... ] }`.
   - **BeerXML (`.xml`)**: Parses standard `<RECIPES><RECIPE>...</RECIPE></RECIPES>` schemas.
2. **Settings UI Integration (`SettingsManager.tsx`):**
   - Adds a section card: "Data & Recipe Ingestion" (`data-testid="settings-import-section"`).
   - Drag-and-drop file upload zone and file browser button (`data-testid="recipe-file-input"`) accepting `.json` and `.xml`.
   - Clear format helper text ("Supports Brewfather JSON and BeerXML formats").
3. **Pre-flight Import Preview Modal (`RecipeImportModal.tsx`):**
   - **Queue & Selective Selection:** Lists all detected recipes with individual toggle checkboxes and a "Select All" toggle.
   - **Recipe Vitals Card:** For each item, renders:
     - Recipe Name & Style badge.
     - Batch Size (L), OG, FG, ABV %, IBU, Color (SRM/EBC).
     - Ingredient counts: Fermentables ($N$), Hops ($N$), Yeasts ($N$), Miscs ($N$).
   - **Equipment Association:** Dropdown to assign an existing Equipment Profile (defaulting to the first active equipment profile).
   - **Duplicate Detection & Collision Strategy:**
     - Cross-references incoming recipe names against existing recipes fetched from `GET /api/recipes`.
     - When a name match is found, marks item with a "Duplicate Detected" badge and provides a strategy radio:
       - `skip`: Skip this recipe during import.
       - `overwrite`: Update the existing recipe (`PUT /api/recipes/:id`).
       - `copy`: Import as a new recipe with ` (Imported Copy)` appended to the name (`POST /api/recipes`).
4. **Ingestion Execution Pipeline:**
   - Primary action button: `Import Selected (N)` (`data-testid="confirm-import-btn"`).
   - Dispatches API requests sequentially or via `Promise.all`:
     - Creates recipes via `POST /api/recipes`.
     - Updates existing recipes if `overwrite` was explicitly selected.
   - Displays progress bar / spinner and summary banner: "Successfully imported $N$ recipes".

---

## 2. Data Schema & Code Modification Contracts

### 2.1 Untouched Modules (Explicit)
- `packages/shared-types/src/batches.ts` — Untouched.
- `apps/web/src/pages/BatchDetail.tsx` — Untouched.
- Database schemas / SQLite migrations — Untouched.

### 2.2 Modified & New Files
- `packages/calculations/src/beerXmlImport.ts` (NEW):
  - Pure BeerXML parser converting XML string to `RecipeWriteInput[]`.
- `packages/calculations/src/index.ts`:
  - Re-export `beerXmlImport` functions.
- `packages/calculations/test/beerXmlImport.test.ts` (NEW):
  - Unit tests for BeerXML parsing (vitals, fermentables, hops, yeasts, miscs).
- `apps/web/src/components/RecipeImportModal.tsx` (NEW):
  - Interactive import preview and conflict resolution modal.
- `apps/web/src/components/SettingsManager.tsx`:
  - Integrate Data & Imports section and modal trigger.
- `apps/web/test/SettingsManager.test.tsx` / `apps/web/test/RecipeImportModal.test.tsx`:
  - Tests covering upload parsing, duplicate resolution, equipment mapping, and recipe creation API calls.

---

## 3. Acceptance Criteria Matrix

| ID | Title | Scope | Criterion |
|---|---|---|---|
| AC-1 | Settings Data & Imports Section | Component | `SettingsManager` renders "Data & Recipe Ingestion" card with file upload zone accepting `.json` and `.xml`. |
| AC-2 | Brewfather JSON Parsing | Calculation | Pure parser correctly parses single and multi-recipe Brewfather JSON files into `RecipeWriteInput[]`. |
| AC-3 | BeerXML Parsing | Calculation | Pure parser correctly parses standard BeerXML documents into `RecipeWriteInput[]`. |
| AC-4 | Pre-Flight Preview Modal | Component | Uploading a valid file opens `RecipeImportModal` displaying recipe names, styles, vitals, and ingredient counts. |
| AC-5 | Multi-Recipe Queue Selection | Component | User can selectively check/uncheck individual recipes or toggle "Select All" in the queue. |
| AC-6 | Equipment Profile Mapping | Component | User can assign an active Equipment Profile to imported recipes. |
| AC-7 | Duplicate Detection & Resolution | Component | Detects name collisions against existing library recipes; allows choosing `skip`, `overwrite`, or `copy`. |
| AC-8 | Ingestion Execution | Integration | Clicking "Import Selected" creates/updates recipes via API and surfaces a success summary banner. |
| AC-9 | Malformed File Error Handling | Component | Uploading an invalid or corrupted file displays a friendly error notification without crashing. |
| AC-10 | Four Gates Clean | Gate | `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all pass clean with exit code 0. |

---

## 4. Scope Guardrail Allowlist

Only these paths may be modified or created:
```
packages/calculations/src/beerXmlImport.ts
packages/calculations/src/brewfatherImport.ts
packages/calculations/src/index.ts
packages/calculations/test/beerXmlImport.test.ts
packages/calculations/test/brewfatherImport.test.ts
apps/web/src/components/RecipeImportModal.tsx
apps/web/src/components/SettingsManager.tsx
apps/web/test/RecipeImportModal.test.tsx
apps/web/test/SettingsManager.test.tsx
```

All other files across `packages/` and `apps/` must remain untouched.

---

# ⛔ HALT GATE — SPEC APPROVAL REQUIRED

Review this feature specification. Reply with `SPEC_APPROVED` to begin execution.
