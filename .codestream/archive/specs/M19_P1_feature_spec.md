# FEATURE SPECIFICATION: M19_P1 - Batch Planning Stage Architecture & Itemized Inventory Deduction

**Milestone:** 19 — Batch Planning Stage Architecture & Itemized Inventory Deduction  
**Phase:** 1 (of 1 estimated)  
**Features formalized:** `FEAT-017`, `FEAT-018`  
**Bugs absorbed:** none (all prior bugs `VERIFIED_RESOLVED`)  

## Phase Summary

Overhaul the Batch Planning stage experience into a comprehensive, 2-column planning workbench (`FEAT-017`, `FEAT-018`):
1. **Batch Metadata & Brew Date Controls (`FEAT-017`, `FEAT-018` §1):** Add editable fields for Batch Name (`name`), Batch Number (`batchNo`), Brewer (`brewer`), and Brew Date (`brewDate` picker) persisted to SQLite through `BatchWriteInput` and `PUT /api/batches/:id`. Synchronize name changes dynamically with the `TopBar` and Batch List.
2. **Batch Recipe & Water Summary Cards (`FEAT-018` §2, §3):** Dedicated "Batch Recipe" summary card displaying recipe identity (style, type, vitals), "Adjust Batch Recipe" modal trigger, and snapshot disclaimer; alongside a compact Water & Mash Volume Summary row (Mash water, Sparge water @ temperature, Total water, Total mash volume, and predicted mash pH badge).
3. **Itemized Inventory Checkoff Table (`FEAT-018` §4):** Transform the inventory stock check into a full itemized checkoff table with right-aligned per-item deduction buttons (`Check / Deduct` and `Undo`), live on-hand stock status badges, shortage indicators, and header actions (`Deduct All from Inventory`).
4. **Status Timeline & Notes Log (`FEAT-018` §5):** Embedded status history and batch notes feed within the Planning workbench.

---

## 1. Resolved Ambiguities & Binding Domain Contracts

1. **Batch Metadata Persistence (`batchNo`, `brewer`, `brewDate`):**
   - `batchNo` is an integer `>= 1`. The server validates `batchNo` as integer `>= 1` in `batchWriteBodySchema`.
   - `brewer` is a nullable string (`text('brewer')` in DB), max 200 characters. Nullable in API, defaults to `null` or `''`.
   - `brewDate` is a nullable string (`text('brew_date')` in DB) storing an ISO date string (`YYYY-MM-DD` or full ISO instant).
   - Migration `0015_batch_planning_meta.sql` adds `brewer text` and `brew_date text` to `batches` table.
2. **TopBar & List Title Synchronization:**
   - When a batch's `name` or `batchNo` is updated, the parent state in `BatchDetail.tsx` updates `batch.name` and `batch.batchNo`, immediately updating the `TopBar` title `<h1>` and breadcrumb text without requiring page reload.
3. **Itemized Checkoff Interaction:**
   - Every ingredient line in `StockCheckPanel` features a right-aligned action button:
     - If un-deducted and checkable: renders an action button (e.g. `Deduct`) that executes `POST /api/batches/:id/checkoff` with `{ inventoryItemId }`.
     - If deducted: renders a green deducted state badge with an `Undo` button executing `POST /api/batches/:id/checkoff/reverse`.
     - If un-tracked or unit mismatch: renders disabled indicator with informative status text.
   - Bulk action `Deduct All from Inventory` remains available in the panel header, sequentially processing all remaining un-deducted checkable items.
4. **Water Volume & Mash Calculations (`waterSummary.ts`):**
   - Pure function `calculateWaterSummary(input: WaterSummaryInput): WaterSummary` in `packages/calculations/src/waterSummary.ts`, where:
     ```
     interface WaterSummaryInput {
       recipe: Recipe;
       stats: CalculatedStats | null;
       equipment: EquipmentProfile;
       predictedMashPh: number | null;   // pre-computed by the caller — see §1.5
     }
     interface WaterSummary {
       mashWaterL: number;
       spargeWaterL: number;
       spargeTempC: number;
       totalWaterL: number;
       totalMashVolumeL: number;
       predictedMashPh: number | null;
     }
     ```
   - Field derivation:
     - `mashWaterL`: `stats.mashWaterL`
     - `spargeWaterL`: `stats.spargeWaterL`
     - `spargeTempC`: resolved sparge temperature (`recipe.mashProfile?.spargeTempC ?? equipment.spargeTemperatureC ?? 76`)
     - `totalWaterL`: `stats.totalWaterL`
     - `totalMashVolumeL`: `stats.mashWaterL + (stats.totalGrainKg * 0.65)` (standard grain displacement $0.65\text{ L/kg}$)
     - `predictedMashPh`: the `predictedMashPh` input passed through **verbatim** (no recomputation, no clamping, no rounding). `null` in ⇒ `null` out.
   - `calculateWaterSummary` performs **no** water-chemistry computation of its own. It never imports or calls `predictMashPh`, `calculateFinishedIons`, or `calculateResidualAlkalinity`.

5. **`predictedMashPh` provenance — pre-computed input, not a `CalculatedStats` field (corrects §1.4 as originally drafted):**
   - `CalculatedStats` (`packages/shared-types/src/brewing.ts`) has **no** `predictedMashPh` field and **must not gain one in this phase**. The earlier draft's `predictedMashPh: stats.predictedMashPh` was unimplementable against the declared signature.
   - Mash pH is computed today, and continues to be computed, **only** in `apps/web/src/pages/BatchDetail.tsx`'s existing stats `useMemo` (`calculateFinishedIons` → `calculateResidualAlkalinity` → `predictMashPh(recipe.fermentables, calcStats.totalWaterL, ra)`), exposed as the local `predictedMashPh: number | null`. **That call site and its inputs are unchanged by this phase.**
   - The Planning-tab water-summary `useMemo` in `BatchDetail.tsx` passes that existing local value straight into `calculateWaterSummary` as the `predictedMashPh` input.
   - **Chosen over the alternatives because:** (b) would force `calculateWaterSummary` to re-derive ion/residual-alkalinity inputs it has no declared path to, duplicating chemistry already computed one `useMemo` away; (c) would leave the Water Summary Card reading half its fields from the pure function and one field from ambient component state, splitting a single card's data source. Option (a) also matches the **established in-repo precedent**: `MeasurementTargetsInput` (`packages/calculations/src/measurementTargets.ts`, M18_P1) already declares `predictedMashPh: number | null` as a pre-computed input supplied by this same `BatchDetail.tsx` value. The new input field mirrors that contract exactly.
   - The unrelated `WaterAnalysisResult.predictedMashPh` (`brewing.ts`, water-profile-analysis feature) is **out of scope and untouched** — it is not the source of, and not written by, anything in this phase.

6. **Migration journal registration (`apps/api/drizzle/meta/_journal.json`) — deviation register, amended post-draft:**
   - The original draft's §2.1/§4 listed `apps/api/drizzle/0015_batch_planning_meta.sql` as the only migration artifact. This repo's drizzle-orm migration runner discovers migrations **exclusively** by reading `_journal.json`'s `entries` array — it does not scan the `drizzle/` directory. A `.sql` file with no journal entry is never applied.
   - Without an appended `idx: 15` entry, migration 0015 would sit on disk unreferenced, and **AC-3 and the `apps/api/test/batches.planningMeta.test.ts` integration tests would be unsatisfiable**.
   - This is **the same class of gap** previously hit and corrected by amendment in **M3_P1** (which added `_journal.json` to its Modified table as "exactly one appended entry, idx 0..N-1 byte-unchanged") and again in **M4_P1** (its own `idx: 5` entry). It is recorded here rather than silently added, so the recurrence is traceable in this spec's own history.
   - **Verified current state (2026-08-19):** `_journal.json` holds `version: "7"`, `dialect: "sqlite"`, and entries `idx: 0` through `idx: 14` (highest tag `0014_inventory_custom_details`). The new entry is therefore `idx: 15`, tag `0015_batch_planning_meta`.
   - **No `meta/0015_snapshot.json` is required, and none may be created.** `meta/` contains snapshots for `0000`–`0008` only; migrations `0009` through `0014` are hand-authored and journal-registered with **no** paired snapshot file, and apply correctly. Adding a snapshot here would be inventing scope beyond what drizzle actually needs. The snapshot file is **not** on the §4 allowlist.

7. **Forced test-file fallout from in-scope contract changes — deviation register, amended post-draft (2026-08-19):**
   - Two `apps/web/test/` files that this spec never listed are broken **as a direct, unavoidable consequence** of changes the spec does mandate. Neither can be left untouched without failing AC-15's four gates, and neither represents new scope.
   - **`apps/web/test/BrewDayTracker.test.tsx` — `tsc` TS2739.** §2.2 widens `BatchWriteInput` with required `batchNo`, `brewer`, and `brewDate`. This file builds a `BatchWriteInput` literal (`baseFormData()`, the sole `BatchWriteInput`-typed literal in the file) which no longer satisfies the widened interface. This is a **type-literal fallout**, not a behavior change.
   - **`apps/web/test/StockCheckDeduction.test.tsx` — 4 of 6 tests fail structurally.** AC-10–AC-13 mandate replacing `StockCheckPanel`'s per-row checkbox with Deduct/Undo buttons. Four tests in this M15_P1-era file drive the panel through `stock-check-checkbox-*` testids and the pre-table row text format — an interaction model that **no longer exists in the component at all**. This is not a locator rename; the affordance was removed by design.
   - **This is the same recurring forced-fallout class already hit twice in this repo**, and resolved the same way both times: **M2_P1** (`packages/calculations/test/brewingMath.test.ts` — `baseEquipment()`/`baseRecipe()` literal fallout from a widened type) and **M4_P1** (`packages/calculations/test/scaling.test.ts` — `HopItem` rename fallout). In both, the file was added to the Modified table as a **narrow named exception with the permitted edits enumerated exhaustively**, rather than being silently touched under a general "tests may change" allowance. Recorded here so the recurrence stays traceable in this spec's own history.
   - **`StockCheckDeduction.test.tsx` disposition — partial retirement, not whole-file deletion.** Verified against the as-built `apps/web/test/StockCheckPanel.test.tsx` (written this session for AC-10–AC-13):
     - The **4 failing tests are fully subsumed and strictly exceeded** by the new file — row rendering with required/on-hand amounts (new AC-10 tests cover 7 lines across both `metric` and `us` unit systems, plus a `NaN|undefined|null` sweep), bulk sequential deduction order (new AC-13), bulk stop-at-first-failure (new AC-13), and per-item deduct→undo round trip (new AC-11/AC-12). Retaining rewritten duplicates would add no coverage.
     - The **2 still-passing tests are NOT subsumed**: the bulk button's *in-flight disable → disabled-once-fully-checked* lifecycle, and the bulk button's *absence when `editable: false`*. `StockCheckPanel.test.tsx` asserts neither. Both behaviors remain live in the component and both tests pass green against the new button-based panel unchanged.
     - Therefore the file is **not** deleted and the 4 tests are **not** rewritten: the 4 superseded tests are removed and the 2 unique, already-green tests are kept verbatim. Whole-file deletion would silently drop two live behavioral assertions; rewriting the 4 would duplicate `StockCheckPanel.test.tsx`.

---

## 2. Data Schema & Code Modification Contracts

### 2.1 New Files
- `packages/calculations/src/waterSummary.ts` — Pure calculation of water volumes and total mash volume. Exports `WaterSummaryInput`, `WaterSummary`, and `calculateWaterSummary` per §1.4. Takes `predictedMashPh: number | null` as a pre-computed input (§1.5) and passes it through unchanged; imports nothing from `water.ts`.
- `packages/calculations/test/waterSummary.test.ts` — Unit tests for water summary derivation.
- `apps/api/drizzle/0015_batch_planning_meta.sql` — Database migration adding `brewer` and `brew_date` columns.
- `apps/api/test/batches.planningMeta.test.ts` — Integration tests for updating `batchNo`, `brewer`, and `brewDate`.

### 2.2 Modified Files

> **Untouched by this phase (explicit):** `packages/shared-types/src/brewing.ts` (`CalculatedStats` gains no `predictedMashPh` field; `WaterAnalysisResult` unchanged) and `packages/calculations/src/water.ts` (`predictMashPh` signature and behavior unchanged). Neither appears on the §4 allowlist.

- `packages/shared-types/src/batches.ts` — Add `brewer?: string | null` and `brewDate?: string | null` to `Batch`, update `BatchWriteInput` with `batchNo`, `brewer`, `brewDate`.
- `packages/calculations/src/index.ts` — Export `waterSummary` functions.
- `apps/api/src/db/schema.ts` — Add `brewer` and `brewDate` columns to `batches` table definition.
- `apps/api/src/routes/schemas.ts` — Update `batchWriteBodySchema` with `batchNo`, `brewer`, `brewDate`.
- `apps/api/src/repositories/batchRepository.ts` — Persist `batchNo`, `brewer`, `brewDate` in `update` and read in `getById`.
- `apps/api/src/routes/batches.ts` — Map `batchNo`, `brewer`, `brewDate` in update handlers.
- `apps/web/src/components/StockCheckPanel.tsx` — Transform into rich itemized table with right-aligned per-item deduction buttons and status badges.
- `apps/web/src/pages/BatchDetail.tsx` — Implement 2-column Planning workbench with metadata editing, Batch Recipe card, Water Summary card, and itemized Stock Check. Adds a water-summary `useMemo` calling `calculateWaterSummary`, passing the **existing** local `predictedMashPh` value through as an input (§1.5). The existing `predictMashPh` / `calculateFinishedIons` / `calculateResidualAlkalinity` call chain in the stats `useMemo` is **not** moved, duplicated, or altered.
- `apps/web/test/BatchDetail.test.tsx` — Component tests for planning workbench, metadata editing, water summary, and recipe card.
- `apps/web/test/StockCheckPanel.test.tsx` — Component tests for itemized deduction actions and undo triggers.
- `apps/api/drizzle/meta/_journal.json` — **Narrow, mechanical, unavoidable append only** (§1.6). Exactly **one** new drizzle-kit-shaped entry appended to the end of the `entries` array:
  - `{ "idx": 15, "version": "6", "when": <epoch ms integer>, "tag": "0015_batch_planning_meta", "breakpoints": true }`
  - `tag` must match the migration filename without the `.sql` extension, exactly.
  - Entries `idx: 0` through `idx: 14` must remain **byte-unchanged**, in their existing order. The top-level `version: "7"` and `dialect: "sqlite"` fields are likewise unchanged.
  - No `meta/0015_snapshot.json` is created (§1.6) — this repo's `0009`–`0014` migrations have no snapshot files either.
- `apps/web/test/BrewDayTracker.test.tsx` — **Narrow, mechanical, unavoidable type-literal fix only** (§1.7). The permitted edit is **exhaustively**:
  - In the `baseFormData(): BatchWriteInput` factory (the file's **only** `BatchWriteInput`-typed literal), add exactly three properties: `batchNo` (any integer `>= 1`; `1` is the expected value), `brewer: null`, and `brewDate: null`.
  - **Nothing else in this file may change.** No existing property value in `baseFormData()` may be altered or removed; no `describe`/`it` block may be added, removed, renamed, or reordered; no assertion, mock, fixture (`equipment`, `recipe`, `baseBatch()`), import, or `renderTracker` signature may change. The file's test count and all its existing assertions must be identical before and after.
- `apps/web/test/StockCheckDeduction.test.tsx` — **Partial retirement of superseded tests only** (§1.7 disposition). The permitted edit is **exhaustively**:
  - **Remove** the four tests superseded by `apps/web/test/StockCheckPanel.test.tsx`: the whole `describe('AC-1: renders all categories with required/on-hand and unit badges')` block; the whole `describe('AC-3: per-item checkoff and reversal, real-time badges')` block; and, from within `describe('AC-2: bulk "Deduct All from Inventory"')`, the two tests `'issues one checkoff POST per unchecked checkable item, in order, then reflects all-checked state'` and `'stops at the first failure and surfaces which item failed, leaving prior deductions intact'`.
  - **Keep verbatim, unedited**, the two remaining tests inside `describe('AC-2: ...')`: `'the bulk button disables while in flight and re-enables after; disabled entirely once fully checked'` and `'does not render the bulk button when editable is false'`. Both pass green against the new button-based panel **as-is** — neither may be rewritten, re-scoped, or re-pointed at new testids.
  - **Keep verbatim** the shared fixtures and harness still referenced by those two tests: `DEFAULT_TEST_CONFIG`, `jsonResponse`, the `vi.mock('../src/api/client', …)` block, the `beforeEach`/`afterEach` hooks, `line()`, `threeItemState()`, and `renderPanel()`. No fixture value may be changed.
  - **Permitted incidental cleanup, and only this:** remove the now-unreferenced `import { ApiClientError } from '../src/api/client';` (its sole use was in a removed test) so `lint` stays clean, and update the file's leading comment block to note the partial retirement and point at `StockCheckPanel.test.tsx`. No other import may be removed.
  - The file **must not be deleted**, and no test in it may be rewritten to the button interaction model — that coverage lives in `StockCheckPanel.test.tsx`.
  - Post-edit, this file must report **2 tests, 2 passed, 0 failed**.

---

## 3. Acceptance Criteria Matrix

| ID | Title | Scope | Criterion |
|---|---|---|---|
| AC-1 | Water Summary Math | Unit | `calculateWaterSummary` returns `mashWaterL`/`spargeWaterL`/`totalWaterL` equal to the corresponding `stats` fields; `spargeTempC` resolved by the `recipe.mashProfile?.spargeTempC ?? equipment.spargeTemperatureC ?? 76` chain (test all three fallback rungs); `totalMashVolumeL === stats.mashWaterL + stats.totalGrainKg * 0.65`; and `predictedMashPh` **identical (`===`) to the `predictedMashPh` input value**, unrounded and unclamped. |
| AC-1b | Water Summary Does Not Compute pH | Unit | `packages/calculations/src/waterSummary.ts` contains no import of, or call to, `predictMashPh`, `calculateFinishedIons`, or `calculateResidualAlkalinity`; and `CalculatedStats` in `packages/shared-types/src/brewing.ts` still has no `predictedMashPh` field after this phase. |
| AC-2 | Water Summary Null Safety | Unit | With `stats: null`, `calculateWaterSummary` returns `0` for `mashWaterL`, `spargeWaterL`, `totalWaterL`, and `totalMashVolumeL` without throwing, while still resolving `spargeTempC` from the recipe/equipment/`76` chain. With `predictedMashPh: null` the returned `predictedMashPh` is `null` (never `0`, `NaN`, or a placeholder). Empty-grist input (`totalGrainKg === 0`) yields `totalMashVolumeL === stats.mashWaterL`. |
| AC-3 | Database Migration 0015 | Integration | Migration applies cleanly; `brewer` and `brew_date` columns created with default `NULL`. |
| AC-4 | Batch Metadata API Update | Integration | `PUT /api/batches/:id` updates `name`, `batchNo`, `brewer`, and `brewDate`; reads back identically via `GET /api/batches/:id`. |
| AC-5 | Batch Number Bounds Validation | Integration | `batchNo <= 0` or non-integer returns 400 `VALIDATION_FAILED`. |
| AC-6 | Planning Metadata Inputs | Component | Planning tab renders inputs for Batch Name, Batch Number, Brewer, and Brew Date; changes update state and persist on Save. |
| AC-7 | TopBar Sync on Name Change | Component | Changing Batch Name and saving updates the page `<h1>` and breadcrumb title in `TopBar`. |
| AC-8 | Batch Recipe Card | Component | Planning tab renders "Batch Recipe" card with style, type, vitals (ABV, OG, FG, IBU, EBC), snapshot disclaimer, and "Adjust Batch Recipe" trigger. |
| AC-9 | Water Summary Card | Component | Planning tab renders the Water & Mash Volume Summary row sourced **entirely** from one `calculateWaterSummary` result: Mash water, Sparge water @ `spargeTempC`, Total water, Total mash volume, and a predicted mash pH badge showing `predictedMashPh.toFixed(2)` when non-null and the em-dash placeholder `—` when `null`. The card reads no mash-pH value from any source other than that `WaterSummary` object. |
| AC-10 | Itemized Checkoff Table | Component | `StockCheckPanel` renders itemized table with column headers (Item, Recipe, Stock Status, Action). |
| AC-11 | Per-Item Deduct Button | Component | Clicking an un-deducted item's Deduct button calls `checkoffInventoryItem` for that item ID and updates UI to Deducted. |
| AC-12 | Per-Item Undo Button | Component | Clicking a deducted item's Undo button calls `reverseInventoryCheckoff` for that item ID and restores un-deducted status. |
| AC-13 | Bulk Deduct All | Component | `Deduct All from Inventory` bulk action processes all remaining checkable un-deducted items sequentially. |
| AC-14 | Status & Notes Integration | Component | Planning workbench embeds status history indicators and `BatchNoteLog`. |
| AC-15 | Four Gates Clean | Gate | `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` all pass clean with exit code 0. |

---

## 4. Scope Guardrail Allowlist

Only these paths may be created or modified:
```
packages/calculations/src/waterSummary.ts
packages/calculations/test/waterSummary.test.ts
packages/calculations/src/index.ts
packages/shared-types/src/batches.ts
apps/api/drizzle/0015_batch_planning_meta.sql
apps/api/drizzle/meta/_journal.json
apps/api/src/db/schema.ts
apps/api/src/routes/schemas.ts
apps/api/src/routes/batches.ts
apps/api/src/repositories/batchRepository.ts
apps/api/test/batches.planningMeta.test.ts
apps/web/src/components/StockCheckPanel.tsx
apps/web/src/pages/BatchDetail.tsx
apps/web/test/BatchDetail.test.tsx
apps/web/test/StockCheckPanel.test.tsx
apps/web/test/BrewDayTracker.test.tsx
apps/web/test/StockCheckDeduction.test.tsx
```

`apps/api/drizzle/meta/_journal.json` is permitted **only** for the single appended `idx: 15` entry described in §2.2 / §1.6 — any other edit to it, and any creation of `apps/api/drizzle/meta/0015_snapshot.json`, is a scope violation.

`apps/web/test/BrewDayTracker.test.tsx` and `apps/web/test/StockCheckDeduction.test.tsx` are permitted **only** for the exhaustively enumerated edits in §2.2 / §1.7 — any edit beyond those, and any deletion of `StockCheckDeduction.test.tsx`, is a scope violation.

---

# ⛔ HALT GATE — SPEC APPROVAL REQUIRED

Review this feature specification. Reply with `SPEC_APPROVED` to begin execution.
