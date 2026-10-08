# Feature Specification: Milestone 13 Phase 1 (M13_P1: App Shell, Navigation Polish & Tabbed Batch Architecture)

## 1. Executive Summary & Context

Milestone 13 Phase 1 (M13_P1) delivers a desktop application shell layout and tabbed batch workflow inspired by Brewfather, resolving open architectural backlog items (`FEAT-008`, `FEAT-009`, `BUG-013`, `BUG-015`, `BUG-017`):
1. **Viewport Shell Scroll Isolation (`FEAT-009`, `BUG-017`)**:
   - Locks the application viewport with `h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans`.
   - Pins `Sidebar` and `TopBar` so they remain permanently in view without window-level scrollbar jitter or layout jumps.
   - Confines vertical scrolling strictly to the `PageContainer` content area (`flex-1 overflow-y-auto min-w-0 pb-16`), ensuring navigation controls and form actions remain instantly accessible regardless of form length.
2. **Editor Navigation Lifecycle & Unsaved Changes Guard (`BUG-013`)**:
   - Fixes the navigation state machine in `App.tsx`: attempting to navigate away from an active, dirty recipe editor (`view === 'editor' && editor.isDirty === true`) triggers the discard confirmation modal immediately upon initiating the route transition.
   - Discarding changes cleanly closes and resets the editor session (`editor.closeEditor()`).
   - Navigating between non-editor views (e.g., Equipment $\rightarrow$ Recipes library, Batches $\rightarrow$ Settings) never triggers false or lingering unsaved changes prompts.
3. **Brewfather-Style Tabbed Batch Architecture (`FEAT-008`, `BUG-015`)**:
   - **Isolated Header Group**: Separates Batch Name, Batch Number, current lifecycle Status badge, and Recipe link from internal measurements into a dedicated top header card.
   - **Horizontal Stage Navigation Tabs**: Introduces 4 clickable stage tabs (`Planning`, `Brewing`, `Fermentation`, `Completed / Conditioning`) allowing brewers to view and jump between stage data on click without mutating or forcing batch status transitions.
   - **TopBar Action Alignment & Status Transitions**: Elevates `Save Changes`, `Discard`, `Delete Batch`, and explicit lifecycle state transitions (`Advance to Brewing`, `Start Fermentation`, `Move to Conditioning`, `Mark Completed`, `Revert`) into the contextual `TopBar` and sub-header actions bar, eliminating bottom form buttons and vertical scrolling fatigue.
4. **1-Click Batch Rebrew Workflow**:
   - Provides a "Rebrew" action (`data-testid="batch-rebrew-btn"`) on completed batches to clone the batch's snapshot into a fresh batch in `Planning` status, incrementing batch number and navigating to the newly created batch.

---

## 2. File Organization & Boundaries

### 2.1 Modified Files
- `apps/web/src/App.tsx`: Lock root viewport layout (`h-screen overflow-hidden flex`), isolate main scroll column (`flex-1 flex flex-col h-full overflow-hidden min-w-0`), wire immediate discard confirmation on exiting `view === 'editor'`, and support batch rebrew navigation.
- `apps/web/src/components/PageContainer.tsx`: Standardize scroll container styling (`flex-1 overflow-y-auto min-w-0 pb-16`) to guarantee isolated page scrolling across all routes.
- `apps/web/src/components/Sidebar.tsx`: Ensure persistent full-height flex column (`h-full flex-shrink-0 flex flex-col`) with internal overflow handling.
- `apps/web/src/components/TopBar.tsx`: Ensure sticky top header (`flex-shrink-0 sticky top-0 z-10`) with support for batch action slots.
- `apps/web/src/pages/BatchDetail.tsx`: Re-architect into tabbed layout with isolated header, horizontal stage tabs (`Planning`, `Brewing`, `Fermentation`, `Completed`), TopBar action alignment, and Rebrew button.
- `apps/web/test/App.test.tsx`: Integration tests for viewport shell layout, immediate editor exit confirmation, and phantom prompt elimination.
- `apps/web/test/BatchDetail.test.tsx`: Component tests for tab switching, stage tab persistence, TopBar action alignment, and Rebrew workflow.

**Added by Amendment 1 (§3.4 Cohesive Design System):**
- `apps/web/src/components/StatsHeader.tsx`: **Class-substitution only.** Replace the literal card/metric-tile/heading class strings with the corresponding `designSystem.ts` constants (`CARD_CLASS`, `METRIC_TILE_CLASS`, `METRIC_LABEL_CLASS`, `METRIC_VALUE_CLASS`, `SECTION_HEADING_CLASS`). No change to props, markup structure, computed values, formatting helpers, or the `ABV_STRATEGY_LABEL`/`IBU_STRATEGY_LABEL` tables.
- `apps/web/src/pages/BatchList.tsx`: **De-duplication only.** Delete the local `STATUS_BADGE_CLASS` map (lines 8–19) and import the shared one from `designSystem.ts`; replace the badge wrapper literal `px-2 inline-flex text-xs leading-5 font-semibold rounded-full` with `STATUS_BADGE_WRAPPER_CLASS`. No change to data fetching, `ListRow` usage, props, or the empty/error branches beyond swapping in `EMPTY_STATE_CLASS`.

**Added by Amendment 2 (§3.5 Batch Delete Contract):**
- `apps/api/src/routes/batches.ts`: **Additive only.** Add exactly one new route handler, `DELETE /api/batches/:id`, registered inside the existing `registerBatchRoutes(app, db)` function, placed immediately after the `PUT /api/batches/:id` handler and before the Readings section comment. No change to any existing handler, to `SERVER_OWNED_BATCH_KEYS`, `NULL_REJECTING_STRING_KEYS`, `NOTE_SERVER_OWNED_KEYS`, the `bodyHas*` helpers, `validateReadingBody`, `closingSnapshotInputsDiffer`, or the file's import list beyond what the new handler requires (it requires no new imports — `batchRepository` and `sendApiError` are already imported).
- `apps/api/src/repositories/batchRepository.ts`: **Additive only.** Add exactly one new method, `deleteBatch`, to the exported `batchRepository` object, following the existing `deleteReading`/`deleteNote` signature convention (`async (db: Db, id: string): Promise<boolean>`, returning `rows.length > 0` from a `.returning({ id: batches.id })` delete). No change to any existing method, to `rowToBatch`/`rowToReading`/`rowToNote`, or to the parse helpers.
- `apps/web/src/api/client.ts`: **Additive only.** Add exactly one new exported function, `deleteBatch(id: string): Promise<void>`, matching the established bodyless-delete convention verbatim (`await request<void>(\`/api/batches/${id}\`, { method: 'DELETE' });`) as used by `deleteRecipe`, `deleteEquipmentProfile`, `deleteReading`, and `deleteBatchNote`. Placed adjacent to the existing batch functions. No change to `request<T>`, `ApiClientError`, or any existing exported call.
- `apps/api/test/batches.delete.test.ts` (**new file**): Route + repository tests for the delete endpoint. Placement and naming follow this repo's existing `apps/api/test/` flat convention (`recipes.cascade.test.ts`, `equipment.crud.test.ts`); it uses the existing `./helpers/testDb` (`createTestDb`) and `../src/server` (`buildServer`) harness exactly as `batches.test.ts` does. No edit to `apps/api/test/batches.test.ts` or any other existing API test file.

### 2.2 New Files
- `apps/web/src/components/BatchStageTabs.tsx`: Reusable horizontal stage tab selector for batch lifecycle views (`Planning`, `Brewing`, `Fermentation`, `Completed`).
- `apps/web/test/BatchStageTabs.test.tsx`: Unit tests for stage tab switching and active styling.

**Added by Amendment 1 (§3.4 Cohesive Design System):**
- `apps/web/src/components/designSystem.ts`: Frozen exported class-string constants + the single shared `STATUS_BADGE_CLASS` map. **Constants and type-only exports only — no React components, no hooks, no side effects.** Follows the established frozen-constant precedent already set by `PAGE_CONTAINER_CLASS` (`PageContainer.tsx`) and `LIST_CONTAINER_CLASS`/`LIST_ROW_CLASS` (`ListRow.tsx`). Exhaustive contents defined in §3.4.
- `apps/web/test/designSystem.test.ts`: Unit tests asserting the exact constant values, `STATUS_BADGE_CLASS` exhaustiveness over `BatchStatus`, and single-source-of-truth (no duplicate literal definitions).

### 2.3 Untouched Files (Protected)
- `packages/calculations/` (Calculation engines and physics models untouched).
- `apps/api/src/routes/` (Backend batch, recipe, equipment, and catalog endpoints untouched) — **narrowed by Amendment 2, see below.**
- `.gsd/archive/` (Append-only).

**Amendment 2 — narrow named backend exception (binding).** The backend protection above is carved open for **exactly two source files and no others**:
1. `apps/api/src/routes/batches.ts` — the single new `DELETE /api/batches/:id` handler described in §2.1 / §3.5.
2. `apps/api/src/repositories/batchRepository.ts` — the single new `deleteBatch` method described in §2.1 / §3.5.

Everything else remains fully protected, specifically:
- Every other file in `apps/api/src/routes/` (`recipes.ts`, `equipment.ts`, `inventory.ts`, `catalog.ts`, `config.ts`, `health.ts`, `schedules.ts`, `waterProfiles.ts`, `schemas.ts`) is byte-unchanged. In particular **no new entry is added to `schemas.ts`** — a bodyless `DELETE` has no request body to validate.
- **All of `apps/api/src/db/` remains untouched** — `schema.ts`, `client.ts`, `migrate.ts`, `seed.ts`, `seedCli.ts`. **No new migration file is added to `apps/api/drizzle/`.** This is possible because the required cascade already exists at the DB level (see §3.5.2): `batch_readings.batch_id` and `batch_notes.batch_id` are both declared `ON DELETE cascade` in `schema.ts` (lines 372 and 416) and in the committed migration SQL (`drizzle/0007_nasty_slipstream.sql`, `drizzle/0008_curly_red_skull.sql`), and `openDatabase` (`db/client.ts`) already sets and verifies `PRAGMA foreign_keys = ON` on every connection.
- Every other repository in `apps/api/src/repositories/` is byte-unchanged.
- `packages/shared-types/` and `packages/calculations/` are byte-unchanged — the delete endpoint introduces no new domain type (its response has no body).

---

## 3. Data Schema & Component Contracts

### 3.1 App Shell Viewport Contract (`App.tsx` & `PageContainer.tsx`)

#### Layout Architecture
```html
<div className="h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans">
  <!-- Persistent Sidebar -->
  <Sidebar className="h-full flex-shrink-0" ... />

  <!-- Main Content Column -->
  <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
    <!-- Contextual Sticky TopBar -->
    <TopBar className="flex-shrink-0 sticky top-0 z-10" ... />

    <!-- Isolated Scrolling Viewport -->
    <PageContainer className="flex-1 overflow-y-auto min-w-0 pb-16">
      {/* Route Views */}
    </PageContainer>
  </div>
</div>
```

### 3.2 Navigation Guard Contract (`App.tsx`)

#### Editor Exit Lifecycle State Machine
1. When user triggers navigation to any destination while `view === 'editor'`:
   - If `editor.isDirty === true`:
     - Intercept navigation and prompt: `"You have unsaved changes. Leave without saving?"`.
     - **If User Confirms (Leave)**: Call `editor.closeEditor()`, reset dirty state, and complete navigation to target destination.
     - **If User Cancels (Stay)**: Abort navigation and remain on `view === 'editor'`.
   - If `editor.isDirty === false`:
     - Navigate immediately without prompt.
2. When navigating between any non-editor views (e.g. `goToEquipment()`, `goToBatches()`, `goToLibrary()`, `goToSettings()`):
   - Never evaluate or invoke `confirmLeaveEditorIfDirty()` since editor is not active.

### 3.3 Tabbed Batch Sheet Contract (`BatchDetail.tsx` & `BatchStageTabs.tsx`)

#### Stage Tab Enum & Definition
```typescript
export type BatchStageTab = 'planning' | 'brewing' | 'fermentation' | 'completed';

export interface BatchStageTabsProps {
  activeTab: BatchStageTab;
  currentStatus: BatchStatus;
  onSelectTab: (tab: BatchStageTab) => void;
}
```

#### Tab Content Mapping
- **`planning` Tab**:
  - Target recipe summary & vitals chip (OG, FG, ABV, IBU, SRM, Color).
  - Water calculation & volumes breakdown summary.
  - Ingredients checklist & stock checkoff (`StockCheckPanel.tsx`).
- **`brewing` Tab**:
  - Measured brewday parameters: Pre-boil Gravity, Actual Mash pH, Actual Boil Size (L), Actual Boil Time (min), Measured OG.
  - Live calculated Mash Efficiency & Brewhouse Efficiency compared to estimates.
- **`fermentation` Tab**:
  - Fermentation chart (`FermentationChart.tsx`), live attenuation %, and current gravity/temp readout.
  - SG/Temperature/pH/Pressure reading log & reading entry form.
  - Cellar & fermentation notes log.
- **`completed` Tab**:
  - Final Measured FG, Packaging / Bottling volume (L), and actual ABV.
  - Carbonation panel (volumes CO2, priming sugar / force carb psi).
  - Tasting notes & 1–5 star rating.
  - Full measured-vs-estimated comparison summary (`MeasuredComparison.tsx`).
  - Batch Ingredient Cost & Real-Extract Nutrition panels (`BatchCostPanel.tsx`, `BatchNutritionPanel.tsx`).
  - **Rebrew Action Button** (`data-testid="batch-rebrew-btn"`).

#### Status Transition & Action Alignment in TopBar
- TopBar contextual actions for Batch route:
  - `Save Changes` (`data-testid="batch-save-btn"`): Submits batch form updates.
  - `Discard Changes` (`data-testid="batch-discard-btn"`): Reverts uncommitted form edits.
  - `Delete Batch` (`data-testid="batch-delete-btn"`): Opens confirmation dialog to delete batch.
  - Lifecycle state transition stepper / actions (`data-testid="batch-advance-status-btn"`): Displays valid next stage transitions according to `allowedNextStatuses`.

---

### 3.4 Cohesive Design System Contract (`designSystem.ts`) — Amendment 1

**Rationale.** The shell pieces this phase already rewrites (`App`, `Sidebar`, `TopBar`, `PageContainer`, `BatchDetail`) are the app's navigational skeleton. The codebase already has a *de facto* visual language, but it is copy-pasted rather than shared, and it has measurably drifted. This amendment does not invent a new look — it **extracts the already-dominant conventions into named constants** and applies them across the surface this phase touches. Audit of the current tree found:
- **Card treatment** — `bg-slate-900 border border-slate-800 rounded-xl` appears in 36 places, with `p-5 shadow-lg` the dominant padding (12 uses); `rounded-lg` is the minority outlier (5 uses).
- **Empty state** — `... rounded-xl p-10 text-center text-slate-400` is already consistent across 7 manager pages.
- **Section headings** — genuinely divergent: `text-lg leading-6 font-medium text-slate-100` (8), `text-lg font-semibold text-slate-100 flex items-center gap-2` (7), `text-base font-bold text-white mb-2` (4).
- **Status badges** — `STATUS_BADGE_CLASS` is **defined twice** (`BatchList.tsx:13`, `BatchDetail.tsx:45`) with the same hues but divergent border handling and divergent wrapper classes, so the same batch status renders differently on the list than on the detail page. This is the concrete cohesion defect this section closes.

#### 3.4.1 Exported Constants (exhaustive)

```typescript
// Surface / container primitives
export const CARD_CLASS: string;              // 'bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg'
export const CARD_STACK_GAP_CLASS: string;    // 'space-y-6'  — vertical rhythm between sibling cards
export const SUBPANEL_CLASS: string;          // 'bg-slate-800/80 p-3 rounded-lg border border-slate-700/60'

// Typography scale (3 tiers, no fourth)
export const SECTION_HEADING_CLASS: string;   // 'text-lg font-semibold text-slate-100 flex items-center gap-2'
export const SUBSECTION_HEADING_CLASS: string;// 'text-base font-bold text-white mb-2'
export const BODY_TEXT_CLASS: string;         // 'text-sm text-slate-300'
export const METADATA_TEXT_CLASS: string;     // 'text-xs text-slate-500'

// Metric tile (identity + primary numbers)
export const METRIC_TILE_CLASS: string;       // === SUBPANEL_CLASS
export const METRIC_LABEL_CLASS: string;      // 'text-xs text-slate-400 font-medium mb-1'
export const METRIC_VALUE_CLASS: string;      // 'text-2xl font-extrabold tracking-tight'

// State conventions
export const EMPTY_STATE_CLASS: string;       // 'bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400'
export const LOADING_STATE_CLASS: string;     // === EMPTY_STATE_CLASS (same shell; copy differs)
export const ERROR_STATE_CLASS: string;       // 'bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 text-sm text-rose-200'

// Status badge — SINGLE source of truth for the whole app
export const STATUS_BADGE_WRAPPER_CLASS: string; // 'px-2.5 py-0.5 rounded-full text-xs font-medium border'
export const STATUS_BADGE_CLASS: Record<BatchStatus, string>;
```

`STATUS_BADGE_CLASS` values are **colour-only** (no `border` keyword — the wrapper supplies it), preserving today's hue semantics exactly:

| Status | Value |
| :--- | :--- |
| `Planning` | `bg-amber-900/40 text-amber-300 border-amber-500/30` |
| `Brewing` | `bg-blue-900/40 text-blue-300 border-blue-500/30` |
| `Fermenting` | `bg-emerald-900/40 text-emerald-300 border-emerald-500/30` |
| `Conditioning` | `bg-purple-900/40 text-purple-300 border-purple-500/30` |
| `Completed` | `bg-slate-700/40 text-slate-300 border-slate-500/30` |

It MUST be typed `Record<BatchStatus, string>` (not a partial or index signature) so a future `BatchStatus` member fails typecheck rather than silently falling through — preserving the invariant already documented at `BatchList.tsx:8-12`.

#### 3.4.2 Colour Semantics — Two Distinct Axes (binding)

Colour carries **two unrelated meanings** in this app, and conflating them is the ambiguity this rule resolves:
1. **Status identity** (`STATUS_BADGE_CLASS`) — which lifecycle stage a batch *is in*. Amber/blue/emerald/purple/slate are **identity hues with no good/bad valence**. Emerald here means "Fermenting", not "success".
2. **Progress state** (`BatchStepper.STATE_CLASS`, unchanged by this phase) — emerald = done, amber = active, slate = upcoming.

**Rule:** a component renders status identity via `STATUS_BADGE_CLASS` **or** progress state via `STATE_CLASS`, never a hand-rolled third mapping. `BatchStageTabs` (§3.3) renders **neither** — tab-active styling uses the Sidebar's existing active convention (`bg-amber-500/10 text-amber-400 border border-amber-500/30`) so "the thing you are currently looking at" reads identically in the sidebar and in in-page tabs. A stage tab's appearance is therefore driven by *selection*, never by batch status — reinforcing AC-9 (clicking a tab must not imply or mutate status).

#### 3.4.3 Navigation Hierarchy — Three Levels, No Overlap (binding)

| Level | Component | Owns | Never contains |
| :--- | :--- | :--- | :--- |
| **L1 — Global** | `Sidebar` | Top-level destinations only (the 9 `NAV_ITEMS`). Persistent, identical on every route. | Record-specific actions; contextual buttons; anything whose label depends on the current record. |
| **L2 — Contextual** | `TopBar` | Current record's identity (`title`) + **mutating actions scoped to the whole record**: Save, Discard, Delete, lifecycle transitions, Rebrew. | Navigation between records; in-record view switching; read-only metrics. |
| **L3 — In-page** | `BatchStageTabs` | Switching *which slice of the current record* is displayed. Pure view state. | Any mutation, any network call, any status change. |

**Placement rule (resolves the "where does this belong" ambiguity):** an action goes to **L2** iff it mutates or destroys the record as a whole; to **L3** iff it only changes what is visible; to **L1** iff it leaves the record entirely. Actions scoped to a *child row* (delete one reading, remove one hop) stay inline in their own row and never migrate to the TopBar.

#### 3.4.4 Detail-Page Data Hierarchy (binding — applies to §3.3 `BatchDetail`)

Every detail page orders content top-to-bottom in exactly this sequence:
1. **Identity + status** — name, number, status badge, source link. Rendered in a `CARD_CLASS` header panel. Never interleaved with measurements (this is AC-7's requirement, now generalized).
2. **Primary metrics** — the small set of headline numbers, as `METRIC_TILE_CLASS` tiles in a responsive grid.
3. **Secondary detail** — everything else, grouped in `CARD_CLASS` panels each opened by a `SECTION_HEADING_CLASS` heading.
4. **Actions** — record-level actions live in the TopBar (L2), *not* at the bottom of the form. Bottom-of-page button clusters are removed from `BatchDetail` (already required by §1.3).

Ordering is **stable across tabs**: each `BatchStageTabs` panel independently follows 2 → 3, so switching tabs never moves the reader's eye to a different layout skeleton.

#### 3.4.5 Empty / Loading / Error Convention (binding)

Each of the three is a distinct, non-substitutable treatment:
- **Empty** — `EMPTY_STATE_CLASS` panel, sentence-case copy in the form `No <plural noun> yet — <what to do about it>.` (matches existing `BatchNoteLog`/`ReadingLog` copy).
- **Loading** — `LOADING_STATE_CLASS` panel with copy `Loading <noun>…` (U+2026 ellipsis, matching `BatchCostPanel.tsx:65`). Never a bare spinner as the sole page content; never reuses the empty-state copy.
- **Error** — `ERROR_STATE_CLASS` banner, copy `Failed to <verb> <noun>.` Rendered **in place of** the panel's content, and is never silently swapped for the empty state (an error must never read as "you have no data").

#### 3.4.6 Explicitly Out of Scope (deferred)

The following inconsistencies were found during the audit and are **deliberately NOT fixed here** — they belong to `FEAT-004` (Settings cohesion) and `FEAT-005` (app-wide UI/UX redesign & field caption system), both `LOGGED`, and are recorded here only as cross-references:
- The 5 residual `rounded-lg` card outliers in `WaterSection.tsx`, `ReadingLog.tsx`, `BatchNoteLog.tsx`.
- The 8 `text-lg leading-6 font-medium` headings in the form components (`EquipmentForm`, `MashProfileForm`, `InventoryForm`, `WaterProfileForm`, `FermentationProfileForm`).
- `SettingsManager.tsx` layout cohesion (`FEAT-004`).
- Field caption / help-text system (`FEAT-005`).

No file outside §2.1/§2.2 may be edited to chase these.

---

### 3.5 Batch Delete Contract — Amendment 2

**Why this section exists.** AC-14 requires a working `Delete Batch` action in the TopBar, tracing to `FEAT-008` / `FEAT-009`. No `DELETE /api/batches/:id` route, repository method, or client call exists anywhere in the codebase, and §2.3 originally protected the entire backend — an internal contradiction that halted execution. This section resolves it with the narrowest possible backend addition (see D-9).

#### 3.5.1 Route Contract

```
DELETE /api/batches/:id
```

- **Registration**: inside the existing `registerBatchRoutes(app: FastifyInstance, db: Db): void`, typed `app.delete<{ Params: { id: string } }>(...)`, matching the existing `app.delete` handlers for readings and notes in the same file.
- **Request body**: none. No `schema`, no `preValidation` hook (there is nothing to validate — the sole parameter is the path param).
- **Success**: HTTP **204 No Content**, empty body, sent via `reply.status(204).send()`. This matches every existing delete in this codebase (`DELETE /api/batches/:batchId/readings/:readingId`, `.../notes/:noteId`, `DELETE /api/recipes/:id`, `DELETE /api/equipment-profiles/:id`).
- **Not found**: HTTP **404**, via `sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found')` — the exact code and message string already used by `GET /api/batches/:id` and `PUT /api/batches/:id` for a missing batch. The 404 is derived from the repository method returning `false` (no row deleted), not from a separate check-then-delete read.
- **No guard, no 409.** Unlike `DELETE /api/recipes/:id` (which returns `409 RECIPE_IN_USE` when batches still reference the recipe), a batch is a leaf in the reference graph: nothing in the schema declares a foreign key **to** `batches.id` other than the two cascade children below. There is therefore no in-use condition to detect, and **no `409` branch is added**. A batch is deletable in **any** lifecycle status, including `Completed` — status does not gate deletion.
- **Idempotency**: deleting the same id twice yields `204` then `404`. The route does not treat a repeat delete as success.

#### 3.5.2 Cascade Behaviour (determined from the actual schema — binding)

**Finding.** The cascade **already exists at the database level**; the repository does **not** need an explicit multi-statement delete and does **not** need a transaction:
- `apps/api/src/db/schema.ts:370-372` — `batchReadings.batchId` → `.references(() => batches.id, { onDelete: 'cascade' })`.
- `apps/api/src/db/schema.ts:414-416` — `batchNotes.batchId` → `.references(() => batches.id, { onDelete: 'cascade' })`.
- Both constraints are present in the committed migration SQL actually applied at runtime (`FOREIGN KEY (\`batch_id\`) REFERENCES \`batches\`(\`id\`) ON UPDATE no action ON DELETE cascade` in `drizzle/0007_nasty_slipstream.sql` and `drizzle/0008_curly_red_skull.sql`).
- `apps/api/src/db/client.ts:34-38` — `openDatabase` executes `PRAGMA foreign_keys = ON` and **throws** if the pragma does not read back as enabled, so enforcement is guaranteed on every connection, including the temp-file connections opened by `apps/api/test/helpers/testDb.ts`.

**Binding consequence:** `batchRepository.deleteBatch` issues **exactly one** statement — a `DELETE FROM batches WHERE id = ?`. It MUST NOT hand-delete `batch_readings` or `batch_notes` rows, and MUST NOT open a transaction. The child rows are removed by SQLite's `ON DELETE CASCADE`.

**Rows deliberately NOT removed — `inventory_transactions`.** `inventoryTransactions.batchId` (`schema.ts:479`) is a plain `text('batch_id').notNull()` with **no `.references(...)` clause at all** — it is an append-only inventory ledger, not a child record of the batch. Deleting a batch therefore leaves its ledger rows in place, and **inventory stock levels are unchanged by a batch delete**. This is the intended behaviour, stated explicitly so it is not mistaken for an oversight: ingredients already deducted for a brew were genuinely consumed, and deleting the batch record must not silently restore stock. Reversing a checkoff remains the existing, separate `POST /api/batches/:batchId/checkoff/reverse` operation, which is **not** invoked by this route. The executor MUST NOT add an FK, a cascade, or a ledger cleanup for this table.

#### 3.5.3 Repository Contract

```typescript
// Added to the exported `batchRepository` object in
// apps/api/src/repositories/batchRepository.ts
async deleteBatch(db: Db, id: string): Promise<boolean>
```

- Returns `true` when a row was deleted, `false` when no batch with that id existed — determined from `.returning({ id: batches.id })` and `rows.length > 0`, byte-for-byte the same shape as the existing `deleteReading` / `deleteNote` methods.
- Named `deleteBatch` (not `delete`) because `delete` is a reserved word in this object-literal context's ergonomics and because the file's existing convention names the entity (`deleteReading`, `deleteNote`, `createNote`, `listNotes`).
- Requires no new import: `batches`, `eq`, and `Db` are already imported at the top of the file.

#### 3.5.4 Client Contract

```typescript
// apps/web/src/api/client.ts
export async function deleteBatch(id: string): Promise<void>
```

Implemented as `await request<void>(\`/api/batches/${id}\`, { method: 'DELETE' });` — identical in shape to the existing `deleteRecipe`. The shared `request<T>` helper already omits the `Content-Type` header on bodyless calls and already raises `ApiClientError` on a non-2xx response, so a `404` surfaces to the caller as a thrown `ApiClientError`. No change to `request<T>` is permitted.

#### 3.5.5 Frontend Wiring (`BatchDetail.tsx` / `App.tsx` — both already in §2.1 scope)

The `Delete Batch` TopBar button (`data-testid="batch-delete-btn"`, already required by AC-14 / §3.3) is gated by the existing `ConfirmDialog.tsx` component (unchanged — it is **not** added to scope), following the recipe-delete precedent in `App.tsx:273-288`:

1. Clicking `batch-delete-btn` sets delete-dialog open state. It MUST NOT call `deleteBatch` directly.
2. `ConfirmDialog` renders with `open`, a title, a message naming the batch, `confirmLabel="Delete"`, and `busy` bound to an in-flight flag. Its own test ids (`confirm-dialog`, `confirm-dialog-confirm`, `confirm-dialog-cancel`) are used as-is.
3. **Cancel** (`confirm-dialog-cancel`) closes the dialog and issues **zero** network calls. The batch remains.
4. **Confirm** (`confirm-dialog-confirm`) sets the busy flag, awaits `deleteBatch(batch.id)`, then on success closes the dialog and navigates back to the batch list via the existing `goToBatches()` transition (`App.tsx:166`) — the same "close, then leave the record" shape `handleDeleteRecipe` uses with `setView('list')`. The deleted batch's detail view is never left on screen after a successful delete.
5. **Failure** (thrown `ApiClientError`) closes the dialog and surfaces the message through the page's existing error treatment — `ERROR_STATE_CLASS` per §3.4.5, copy in the `Failed to delete batch.` form. It MUST NOT navigate away, and MUST NOT render the empty state.
6. The busy flag is cleared in a `finally` branch on both the success and failure paths.

Per §3.4.3, `Delete Batch` is an **L2** action: it lives in the `TopBar`, never in the `Sidebar` (L1) and never in `BatchStageTabs` (L3), and no bottom-of-form delete button survives (AC-26).

---

## 4. Acceptance Criteria Matrix

| ID | Category | Requirement | Test Verification | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **AC-1** | Shell Layout | Root viewport configured with `h-screen overflow-hidden flex` | `App.test.tsx` | App root has `h-screen overflow-hidden flex`, preventing browser-window scrollbars |
| **AC-2** | Shell Layout | Sidebar and TopBar remain pinned with zero scroll drift | `App.test.tsx` | `Sidebar` has `h-full flex-shrink-0` and `TopBar` is `flex-shrink-0 sticky top-0` |
| **AC-3** | Shell Layout | Vertical scrolling isolated to `PageContainer` | `App.test.tsx` | `PageContainer` has `flex-1 overflow-y-auto min-w-0`, confining scroll handling |
| **AC-4** | Navigation | Leaving dirty recipe editor prompts discard confirmation | `App.test.tsx` | Navigating away from dirty editor triggers window confirm; canceling stays on editor |
| **AC-5** | Navigation | Discarding recipe edits closes editor session cleanly | `App.test.tsx` | Confirming discard navigates to destination and resets editor dirty state |
| **AC-6** | Navigation | Non-editor route transitions never trigger phantom discard prompts | `App.test.tsx` | Navigating from Equipment to Recipes or Batches to Settings never calls window confirm |
| **AC-7** | Batch UI | Standalone Batch Header card renders name, status badge, and recipe link | `BatchDetail.test.tsx` | Top header panel displays batch name, status chip (`data-testid="batch-status-badge"`), and recipe name |
| **AC-8** | Batch UI | Horizontal stage tabs (`Planning`, `Brewing`, `Fermentation`, `Completed`) render | `BatchDetail.test.tsx` | Renders 4 clickable stage tabs (`data-testid="batch-tab-${tab}"`) |
| **AC-9** | Batch UI | Clicking stage tabs switches view without mutating batch status | `BatchDetail.test.tsx` | Clicking "Brewing" tab on a "Planning" batch displays brewday fields while status stays "Planning" |
| **AC-10** | Batch UI | Planning tab renders recipe snapshot, water plan, and stock check | `BatchDetail.test.tsx` | Planning tab displays grain/hop summary and `StockCheckPanel` |
| **AC-11** | Batch UI | Brewing tab renders pre-boil gravity, mash pH, and live efficiency | `BatchDetail.test.tsx` | Brewing tab displays brewday measurements and live efficiency |
| **AC-12** | Batch UI | Fermentation tab renders chart, readings log, and cellar notes | `BatchDetail.test.tsx` | Fermentation tab displays chart and reading logger |
| **AC-13** | Batch UI | Completed tab renders final FG, carbonation, comparison, and nutrition | `BatchDetail.test.tsx` | Completed tab displays packaging, carbonation, tasting notes, and nutrition |
| **AC-14** | Batch UI | TopBar contextual action alignment for BatchDetail | `BatchDetail.test.tsx` | `TopBar` renders Save, Discard, Delete, and Status Transition buttons |
| **AC-15** | Batch UI | "Rebrew" action clones completed batch into new Planning batch | `BatchDetail.test.tsx` | Clicking "Rebrew" calls API to create batch from recipe and navigates to new batch ID |
| **AC-16** | Quality | Layer 1 Four Gates exit 0 cleanly | Monorepo Root Check | `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` all exit 0 |
| **AC-17** | Scope Guard | Pre/Post SHA-256 Manifest Diff | Manifest Check | Only permitted frontend app shell and batch detail files modified |
| **AC-18** | Design System | `designSystem.ts` exports every constant in §3.4.1 with the exact documented string values | `designSystem.test.ts` | Each exported constant deep-equals its §3.4.1 value verbatim; module exports no React component and no hook |
| **AC-19** | Design System | `STATUS_BADGE_CLASS` is exhaustive over `BatchStatus` and colour-only | `designSystem.test.ts` | `Object.keys` equals all 5 `BATCH_STATUSES`; no value contains the standalone token `border ` (wrapper supplies it); typed `Record<BatchStatus, string>` |
| **AC-20** | Design System | Status badge is single-source-of-truth — no duplicate local map survives | `designSystem.test.ts` | Source scan of `apps/web/src` finds exactly one definition of `STATUS_BADGE_CLASS` (in `designSystem.ts`); `BatchList.tsx` and `BatchDetail.tsx` both import it |
| **AC-21** | Design System | Same status renders identically on list and detail | `BatchDetail.test.tsx` | A `Fermenting` batch's badge in `BatchList` and in `BatchDetail` header carry the identical resolved `className` string |
| **AC-22** | Design System | Card + section-heading treatment is uniform across the touched surface | `BatchDetail.test.tsx` | Every `CARD_CLASS` panel in `BatchDetail` uses `rounded-xl p-5 shadow-lg`; every section heading uses `SECTION_HEADING_CLASS`; zero literal `rounded-lg` card roots remain in `BatchDetail.tsx` |
| **AC-23** | Nav Hierarchy | Sidebar holds no record-scoped actions | `App.test.tsx` | `Sidebar` renders exactly the 9 `NAV_ITEMS` buttons plus the collapse toggle — no Save/Discard/Delete/Rebrew/transition control at any route |
| **AC-24** | Nav Hierarchy | Stage tabs are pure view state (L3) | `BatchStageTabs.test.tsx` | Clicking every tab fires only `onSelectTab`; component issues zero network calls and never calls a status mutator (asserts §3.4.3 L3 rule and reinforces AC-9) |
| **AC-25** | Nav Hierarchy | Active-selection styling is shared between Sidebar and stage tabs | `BatchStageTabs.test.tsx` | Active tab carries `bg-amber-500/10 text-amber-400 border border-amber-500/30` — byte-identical to Sidebar's active nav item; inactive tabs carry none of these |
| **AC-26** | Data Hierarchy | `BatchDetail` DOM order is identity → metrics → detail → (no bottom actions) | `BatchDetail.test.tsx` | Header card precedes stage tabs, which precede tab content; zero Save/Discard/Delete buttons render below `PageContainer` content |
| **AC-27** | Data Hierarchy | Tab panels share a stable skeleton | `BatchDetail.test.tsx` | Each of the 4 tab panels renders its metric grid before its detail panels; no panel leads with a detail card |
| **AC-28** | States | Empty, loading, and error are visually distinct and non-substitutable | `BatchDetail.test.tsx` | Empty uses `EMPTY_STATE_CLASS`; loading uses `LOADING_STATE_CLASS` with `Loading …` copy; a fetch failure renders `ERROR_STATE_CLASS` with `Failed to …` copy and never the empty-state copy |
| **AC-29** | Scope Guard | Amendment 1 adds no files beyond those listed in §2.1/§2.2 | Manifest Check | Post-execution manifest shows `designSystem.ts`, `designSystem.test.ts` added and `StatsHeader.tsx`/`BatchList.tsx` modified; every file named in §3.4.6 is byte-unchanged |
| **AC-30** | Batch Delete (API) | `DELETE /api/batches/:id` exists and deletes an existing batch | `batches.delete.test.ts` | Request against a seeded batch returns HTTP **204** with an empty body; a subsequent `GET /api/batches/:id` for that id returns **404** and `GET /api/batches` no longer lists it |
| **AC-31** | Batch Delete (API) | Missing batch id returns 404 in the established error shape | `batches.delete.test.ts` | `DELETE /api/batches/<random-uuid>` returns **404** with body `{ error: { code: 'NOT_FOUND', message: 'Batch not found' } }` matching the shape `sendApiError` already produces for `GET`/`PUT /api/batches/:id`; deleting the same real id twice yields 204 then 404 |
| **AC-32** | Batch Delete (cascade) | The batch's own readings and notes are actually gone after delete | `batches.delete.test.ts` | Given a batch with ≥2 readings and ≥2 notes, after a 204 delete a direct `SELECT` on `batch_readings` and `batch_notes` filtered by that `batch_id` returns **0 rows each**, while readings/notes belonging to a *different* batch are untouched (count unchanged) |
| **AC-33** | Batch Delete (cascade) | Cascade is DB-driven, not hand-rolled — no schema or migration change | `batches.delete.test.ts` + Manifest Check | `batchRepository.deleteBatch` issues exactly one delete statement against `batches` and contains no `delete(batchReadings)`, no `delete(batchNotes)`, and no transaction; `apps/api/src/db/**` and `apps/api/drizzle/**` are byte-unchanged in the post-execution manifest |
| **AC-34** | Batch Delete (ledger) | Inventory ledger rows and stock levels survive a batch delete | `batches.delete.test.ts` | Given a batch with at least one `inventory_transactions` row, after a 204 delete those rows still exist and the referenced inventory item's on-hand amount is numerically identical to its pre-delete value (§3.5.2) |
| **AC-35** | Batch Delete (repo) | `deleteBatch` follows the existing repository return convention | `batches.delete.test.ts` | `batchRepository.deleteBatch(db, existingId)` resolves `true`; `batchRepository.deleteBatch(db, unknownId)` resolves `false` and throws nothing |
| **AC-36** | Batch Delete (client) | `deleteBatch(id)` matches the established client call convention | `BatchDetail.test.tsx` | `client.ts` exports `deleteBatch`; invoking it issues exactly one `fetch` to `/api/batches/<id>` with `method: 'DELETE'`, no request body, and no `Content-Type` header; a 404 response rejects with `ApiClientError` |
| **AC-37** | Batch Delete (UI gate) | The confirmation dialog gates the delete call | `BatchDetail.test.tsx` | Clicking `batch-delete-btn` renders `confirm-dialog` and fires **zero** network calls; clicking `confirm-dialog-cancel` closes it having still fired zero calls and left the batch on screen; only `confirm-dialog-confirm` invokes `deleteBatch` — exactly once |
| **AC-38** | Batch Delete (UI outcome) | Successful delete leaves the record; failed delete does not | `BatchDetail.test.tsx` | On resolved `deleteBatch`, the dialog closes and the app navigates to the batch list view (`goToBatches()`), no longer rendering the batch detail; on a rejected `deleteBatch`, the view stays on the batch, renders an `ERROR_STATE_CLASS` banner with `Failed to delete batch.` copy (never the empty-state copy), and the busy flag is cleared |
| **AC-39** | Scope Guard | Amendment 2 touches only its four named files | Manifest Check | Pre/post SHA-256 content manifests (see §6 — **`git diff` is not usable here; this repo has a single commit that predates all of this work**) differ, within `apps/api/**`, in **exactly** `apps/api/src/routes/batches.ts`, `apps/api/src/repositories/batchRepository.ts`, and the added `apps/api/test/batches.delete.test.ts`, plus `apps/web/src/api/client.ts` under `apps/web/**`. Every other file under `apps/api/src/routes/`, all of `apps/api/src/db/`, all of `apps/api/drizzle/`, all other files in `apps/api/src/repositories/`, all other files in `apps/api/test/`, `packages/shared-types/`, and `packages/calculations/` are byte-identical between the two manifests |

---

## 5. Scope Guardrails & Non-Goals

- **Non-Goal**: We do not modify backend calculations or physics engines in `packages/calculations/`.
- **Non-Goal**: We do not alter database schemas or migration files. *(Unchanged by Amendment 2 — the delete endpoint needs no schema or migration change; see §3.5.2.)*
- **Untouched List**: `packages/calculations/`, `apps/api/src/routes/`, `apps/api/src/db/`, `.gsd/archive/` — **narrowed by Amendment 2 to exempt exactly `apps/api/src/routes/batches.ts` and `apps/api/src/repositories/batchRepository.ts`. `apps/api/src/db/` remains fully protected with no exception.** See §2.3.
- **Non-Goal (Amendment 1)**: This is **not** an app-wide redesign. The design system is *extracted* from existing dominant conventions and applied **only** to the app-shell / navigation / batch surface already in §2.1/§2.2. Rolling it out to Inventory, Equipment, Settings, and the form components is deferred to `FEAT-004` / `FEAT-005` (see §3.4.6).

### 5.1 Design Decisions (Amendment 1) — flagged for review at the halt gate

Each decision below is a judgement call made while drafting §3.4. **Any of these can be overruled at the halt gate** — reply with the deviation number and the preferred alternative instead of `SPEC_APPROVED`.

- **D-1 — Extract, do not redesign.** Every constant in §3.4.1 is the *already-dominant* value found in the current tree, not a new aesthetic. Rationale: the user asked for cohesion, and the cheapest, lowest-risk cohesion is making the existing majority convention the enforced one. *Alternative if overruled:* pick a new visual direction first, which would make this a multi-phase redesign milestone rather than a hardening phase.
- **D-2 — Section headings standardize on `text-lg font-semibold text-slate-100 flex items-center gap-2` (7 uses) over `text-lg leading-6 font-medium text-slate-100` (8 uses).** The plurality variant was *not* chosen. Rationale: the chosen one carries the icon slot that matches this app's pervasive lucide-icon habit, and the 8 losing uses are all inside form components that this phase is forbidden to touch anyway — so choosing the larger group would change nothing here while creating churn later. *Alternative if overruled:* adopt the `leading-6 font-medium` variant and accept an icon-less heading style.
- **D-3 — `BatchList.tsx` pulled into scope (narrow).** It is not shell/nav, but it holds the *duplicate* `STATUS_BADGE_CLASS` that causes the list-vs-detail inconsistency. Leaving it out would make AC-20/AC-21 unsatisfiable. Its permitted edit is exhaustively bounded in §2.1. *Alternative if overruled:* drop AC-20/AC-21 and accept that a batch's status badge keeps rendering differently in the two places it appears.
- **D-4 — `StatsHeader.tsx` pulled into scope (class-substitution only).** It is the origin of the metric-tile pattern §3.4.1 codifies; leaving it on literals would mean the canonical example of the convention is the one file not using it. *Alternative if overruled:* define the metric-tile constants from `BatchDetail` alone and leave `StatsHeader` untouched.
- **D-5 — Two colour axes kept separate rather than unified.** Emerald means "Fermenting" as a *status* and "done" as a *step state*, and §3.4.2 preserves that rather than forcing one meaning. Rationale: unifying them would either recolour the lifecycle badges (large visual change, outside this phase) or make the stepper's progress unreadable. *Alternative if overruled:* pick one axis and recolour the other — a visible change to existing screens.
- **D-6 — Stage tabs reuse the Sidebar's amber active treatment.** Makes "what am I looking at" read identically at L1 and L3, and keeps tab appearance driven by selection rather than status (protecting AC-9). *Alternative if overruled:* give tabs their own distinct active style, at the cost of a third selection idiom.
- **D-7 — `designSystem.ts` is plain constants, not Tailwind `@apply` classes or a CVA-style variant library.** Rationale: matches the existing `PAGE_CONTAINER_CLASS` / `LIST_ROW_CLASS` precedent, adds zero dependencies, and keeps the values directly assertable in tests (AC-18). *Alternative if overruled:* introduce a variant library, which adds a dependency and makes the values harder to test literally.
- **D-8 — File placed at `components/designSystem.ts`, not a new `styles/` or `design/` directory.** Rationale: the existing frozen constants already live beside their components in `components/`; a new top-level directory for one file is premature structure. *Alternative if overruled:* name a preferred path.

**Amendment 2 entry — LOCKED, not open for relitigation at the halt gate:**

- **D-9 — Narrow named backend exception for batch deletion (`DELETE /api/batches/:id`).** *What changed:* §2.3's blanket protection of `apps/api/src/routes/` is carved open for exactly two source files — `routes/batches.ts` (one new handler) and `repositories/batchRepository.ts` (one new method) — plus one new API test file and one additive `client.ts` function. `apps/api/src/db/` and `apps/api/drizzle/` remain **fully** protected; no schema or migration change is needed because the `ON DELETE CASCADE` this feature relies on already exists (§3.5.2). *Why:* AC-14 requires a working `Delete Batch` action; it traces to `FEAT-008` and `FEAT-009`, both of which explicitly call for relocating "Delete Batch" into the TopBar. No `DELETE /api/batches/:id` route, repository method, or client call exists anywhere in the codebase, so AC-14 was **unsatisfiable frontend-only** — a spec-layer scope contradiction found by the executor before any code was written, and root-caused via `/diagnose` as a spec-scope defect rather than an implementation bug or a misread intent. The semantics are a genuine hard delete cascading to the batch's own readings and notes, with the inventory ledger deliberately retained. *Status:* the two softer alternatives — (a) deferring `Delete Batch` out of this phase entirely, and (b) converting it to a soft/archive delete — were both put to the user and **explicitly declined**. Unlike D-1..D-8, this entry is a settled decision recorded for auditability, **not** an open question for the halt gate; re-opening it means re-opening the diagnosis, not just overruling a drafting judgement.

---

## 6. Pre-Execution SHA-256 Manifest
Before execution begins, generate pre-execution SHA-256 manifest at `.gsd/archive/manual_verification/M13_P1/pre_exec_manifest.json`.

**Manifest mechanism (binding for AC-17, AC-29, and AC-39).** `git diff` is **not** a usable scope-guard mechanism in this repository: it holds a single commit that predates all of this work, so a diff against any base commit is meaningless here. The scope guard is therefore a **content manifest diff**, generated by

```
git ls-files -co --exclude-standard -z | xargs -0 sha256sum
```

run twice — once **before the executor's first edit** (saved as the pre-execution manifest above) and once at the **end** of execution (saved alongside it as `post_exec_manifest.json`) — and compared path-by-path. A file is "byte-unchanged" iff its hash is identical in both manifests; "modified" iff present in both with differing hashes; "added" iff present only in the post manifest.

---

> **HALT GATE (STATE 2):** Feature Specification for Milestone 13 Phase 1 (M13_P1) is drafted and presented for review.
>
> Implementation code generation is strictly forbidden until explicit approval.
> To approve and proceed to execution, reply with **`SPEC_APPROVED`**.
