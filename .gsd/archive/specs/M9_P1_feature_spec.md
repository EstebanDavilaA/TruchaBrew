# FEATURE SPECIFICATION: M9_P1 — Inventory: what's in stock, and what am I short of

- **Milestone:** M9 (Inventory, checkoff and cost)
- **Phase:** P1 of a proposed **two-phase** split — "What's in stock, and what am I short of". See §5 for the M9_P2 preview and §4 Deviation 1 for the split itself, which needs sign-off.
- **Depends on:** M2_P1 (recipe line-item shapes and the `recipes`/`recipe_*` tables), M4_P1 (the frozen `batches.recipe_snapshot`), M5_P1/M5_P2 (the batch pipeline and the Planning stage this phase writes into), M5.5_P1 (the `Sidebar`/`TopBar`/`PageContainer` shell), M6_P1 (`water_profiles` — the most recent new-entity CRUD slice, whose route/repository/schema shape this phase copies), M7_P1/M7_P2 (`ConfigContext` and the `format*` helpers).
- **Layer:** New table + migration in `apps/api`, new pure-logic module in `packages/calculations`, new types in `packages/shared-types`, new routed page + one new panel in `apps/web`. **This is a full vertical slice, not a storage layer.**
- **Verification threshold this phase is accountable for** (from `.gsd/ROADMAP.md` Milestone 9): the third clause — *"Batches created before this milestone still open and complete without inventory data"* — in full (AC-30, AC-38, AC-40). The first two clauses (deduct-on-checkoff / restore-on-uncheck with no drift; a completed batch's cost total equalling the sum of its deducted line items) belong to M9_P2 and are **not** claimed here.

---

## Phase Summary

There is no inventory anywhere in this repository today. A grep for `inventory`, `stock`, or `costPerUnit` across `apps/` and `packages/` returns two incidental comment hits and nothing else. A brewer planning a batch has no way to know whether the 5.5 kg of Pale Ale malt the recipe calls for is actually in the cupboard, and the Planning stage of a batch — deliberately left as a read-only brew sheet by M4_P1, with the checkoff path explicitly deferred to M9 — has nothing to check off against.

This phase builds the half of Milestone 9 that has to exist before anything can be deducted:

1. **A stocked inventory.** One `inventory_items` table covering all four categories (fermentables, hops, yeast, miscs), each row carrying a quantity in that category's canonical unit, an optional cost per unit, an optional purchase date and expiry date, and free-text notes. Full CRUD over a REST surface shaped exactly like M6's water profiles, and a new **Inventory** sidebar destination to drive it.
2. **Negative stock is legal, and flagged.** Writing `-0.5 kg` is a `201`, not a `400` — the roadmap's allow-negative-stock behaviour. What negative stock is *not* is silent: rows at or below zero carry an out-of-stock flag, rows below zero carry an additional negative-stock flag, and the list can be filtered to out-of-stock rows only, server-side.
3. **A stock check on a batch's Planning stage.** Opening a batch that is still in Planning shows, against that batch's **frozen `recipeSnapshot`**, exactly what the recipe needs, what is on hand, and what is short — per ingredient, aggregated across duplicate line items, matched case- and whitespace-insensitively, and honest about the two cases it cannot answer (an ingredient with no inventory row at all, and one whose recorded unit is not the unit the recipe asks in).

What this phase deliberately does **not** do — all of it M9_P2 (§5): **nothing here ever writes a quantity as a side effect of anything.** There is no checkoff, no deduction, no ledger, no reversal, and **no cost arithmetic whatsoever** — `costPerUnit` is stored, validated and displayed, and is never multiplied by anything (AC-16). Nutrition is not in this phase at all.

---

## Key Behaviors

1. **Inventory is a first-class, independently managed entity.** `GET/POST/PUT/DELETE /api/inventory[/:id]`, a sidebar destination, a list with a category filter and an out-of-stock filter, and a create/edit form. It does not require, reference, or depend on any recipe or batch.
2. **One ingredient, one row, per category.** `(category, nameKey)` is UNIQUE at the database level, where `nameKey` is the server-derived normalization of `name`. "Pale Ale Malt", "pale ale malt" and "  PALE   ALE MALT " are the same row and the second write is a `409 INVENTORY_DUPLICATE`, never a silent second row. This is what makes matching a lookup rather than a heuristic.
3. **Negative quantities are accepted and flagged, never rejected and never clamped.** `quantity` is a plain nullable-free `real` with no lower bound. `isOutOfStock` and `isNegativeStock` are two distinct predicates with two distinct thresholds (§2.2).
4. **The stock check reads the batch's frozen snapshot and live inventory.** Requirements come from `batch.recipeSnapshot` — never from the live recipe, which may have been edited since (M4_P1's immutability guarantee is not weakened by one byte). Availability comes from the inventory table as it is *right now*. The result is computed, never stored.
5. **The stock check is strictly read-only.** Calling it any number of times leaves every inventory row's `quantity` and `updatedAt` byte-identical (AC-29). Deduction is M9_P2.
6. **Two answers are "unknown", and they say so.** An ingredient with no inventory row is `matched: false` → the UI reads **"Not tracked"**. An ingredient whose inventory row records a different unit than the recipe asks in is `unitMismatch: true` → the UI reads **"Unit mismatch"**. Neither is ever rendered as `0`, as `—`, as "in stock", or as a shortfall of the full amount (§2.3).
7. **Pre-M9 batches are unaffected.** A batch created before this milestone has no inventory data of any kind — there is nothing on a batch row to be null. It opens, renders a stock check computed entirely from its existing snapshot, and advances through every pipeline stage exactly as it did before (AC-30, AC-40).

---

## Resolved Ambiguities (Binding)

### 1. How a recipe line item is matched to an inventory row — **normalized name + category, unique at write time**

The roadmap says "inventory rows share the ingredient line-item shape already stored" but does not say how a `recipe_fermentables` row finds its inventory row. Three options were considered and two rejected:

- **A foreign key from the line item to the inventory row — rejected.** A batch's `recipeSnapshot` is frozen JSON (M4_P1 AC-12). An FK embedded in it would either dangle when the inventory row is deleted, or force the snapshot to be rewritten — breaking the single strongest invariant this project has, asserted in `apps/api/test/batches.migration.test.ts` and re-asserted in every regression pass since M4.
- **Fuzzy / substring matching — rejected.** "Pale Ale Malt (2-Row)" vs "Pale Ale Malt" is a judgement call, and a judgement call is not auditable by a critic.
- **Exact match on `(category, nameKey)` — adopted.**

**Binding definition of `nameKey`:** `normalizeInventoryName(name)` = trim leading/trailing whitespace, replace every run of one or more Unicode whitespace characters with a single U+0020 space, then `toLowerCase()`. Nothing else — no punctuation stripping, no accent folding, no parenthetical removal.

`(category, nameKey)` carries a `UNIQUE` index, so a match is **at most one row, by construction** — the matcher never has to break a tie, and there is no "multiple matches" branch to specify or test. A colliding write is `409 INVENTORY_DUPLICATE` (AC-20).

*Consequence the user must accept:* a recipe line named `Pale Ale Malt (2-Row)` will **not** match an inventory row named `Pale Ale Malt`. It will read "Not tracked". This is deliberate and visible rather than clever and wrong; renaming one to match the other is a two-second edit the user can make, and a mis-match the user cannot see is not.

### 2. `quantity` bounds, and the two thresholds — `<= STOCK_EPSILON` and `< -STOCK_EPSILON`

`STOCK_EPSILON = 1e-6` (exported, §1.1). Binding:

- `isOutOfStock(q)` is `q <= STOCK_EPSILON` — **inclusive**. `0` → `true`. `1e-9` → `true`. `-0.5` → `true`. `0.0001` → `false`.
- `isNegativeStock(q)` is `q < -STOCK_EPSILON` — **exclusive**. `-0.5` → `true`. `-1e-9` → `false`. `0` → `false`.
- A shortfall smaller than `STOCK_EPSILON` in magnitude is clamped to **exactly `0`** and the line is `sufficient: true`. `required = 0.1 + 0.2` (`0.30000000000000004`) against `onHand = 0.3` yields `shortfall === 0`, not `5.551115123125783e-17` (AC-14).

*Reasoning for an epsilon rather than a bare `<= 0`:* M9_P2's deductions are repeated float subtractions against the same row. A row that has been deducted and restored several times will sit at `4.440892098500626e-16` rather than `0`, and a bare `q <= 0` would report that row as in stock while a bare `q < 0` would report the same row as negative. Both thresholds are pinned now, in P1, so P2 inherits them rather than inventing them.

### 3. The two "unknown" outcomes are distinct from each other and from zero — no-match and unit-mismatch contracts

This is the fallback-retention rule for this phase, and the single most likely place for a placeholder to leak into rendered state:

| Case | `matched` | `inventoryItemId` | `inventoryUnit` | `onHand` | `unitMismatch` | `shortfall` | `sufficient` | Counted in |
|---|---|---|---|---|---|---|---|---|
| Comparable | `true` | the id | the unit | the number | `false` | `number >= 0` | `boolean` | `matchedCount`, `comparableCount`, and `shortfallCount` iff `shortfall > 0` |
| No inventory row | `false` | `null` | `null` | `null` | `false` | `null` | `null` | `unmatchedCount` only |
| Unit mismatch | `true` | the id | the unit | the number | `true` | `null` | `null` | `matchedCount`, `unitMismatchCount` |

**Binding caller rule:** a consumer must branch on `matched` and `unitMismatch` **before** reading `shortfall` or `sufficient`. Rendering `shortfall ?? 0`, `sufficient ?? false`, or an em-dash that sits in the same visual slot as a real shortfall is a defect, not a styling choice. AC-10, AC-11 and AC-37 assert the three cases produce three distinguishable strings.

### 4. Unit mismatch is surfaced, never converted

An inventory row for `Lactic Acid` recorded in `g` against a recipe line asking for `2 ml` is **not** converted. There is no density in this data model, and inventing one (or assuming 1 g/ml) would produce a number that looks authoritative and is wrong. The line reports `unitMismatch: true` and the UI names both units.

Category-canonical units are fixed and enforced on write (`isValidInventoryUnit`, AC-5, AC-22):

| Category | Allowed `unit` values |
|---|---|
| `Fermentable` | `'kg'` — and only `'kg'` |
| `Hop` | `'g'` — and only `'g'` |
| `Yeast` | `'pkg'` — and only `'pkg'` |
| `Misc` | `'g'`, `'ml'`, `'tsp'`, `'tbsp'`, `'each'` (exactly `MiscUnit` from `@truchabrew/shared-types`) |

So a unit mismatch is **structurally only possible in the `Misc` category**. The other three categories cannot mismatch, because neither side has a second unit to mismatch with. This is stated explicitly because it is the kind of asymmetry a reader would otherwise assume was an oversight.

### 5. Requirement aggregation, ordering, and the non-positive-group rule

- **Aggregation:** all line items in one category sharing one `nameKey` are summed into **one** requirement group before any comparison. A recipe with `Pale Ale Malt 3.0 kg` and `PALE ALE  MALT 2.5 kg` produces one group of `5.5 kg`, not two groups and not two shortfalls (AC-6).
- **`displayName`:** the `name` of the **first** contributing line item, exactly as written in the snapshot (`'Pale Ale Malt'`, not `'pale ale malt'`). The user sees their own spelling.
- **Ordering (binding, deterministic):** groups are emitted in category order `Fermentable → Hop → Yeast → Misc`, and within a category in **first-appearance order** in the corresponding snapshot array. Never re-sorted alphabetically, never sorted by shortfall.
- **Non-positive groups are omitted entirely.** A group whose aggregated `requiredAmount` is `<= STOCK_EPSILON` (including a group that sums to `0` from `+1.0` and `-1.0` lines) does not appear in `requirements` at all — it is not a requirement, and emitting it would produce a line reading "you need 0 kg" (AC-7).
- **Yeast amount** is `YeastItem.amountPkg`, in `'pkg'`. **Hop amount** is `HopItem.amountG`, in `'g'`. **Fermentable amount** is `FermentableItem.amountKg`, in `'kg'`. **Misc amount** is `MiscItem.amount` with `MiscItem.unit`.

### 6. `costPerUnit` is stored and displayed; **no arithmetic touches it in this phase**

`costPerUnit` is `number | null`, must be `>= 0` when non-null, and is per one unit of the row's own `unit` (per kg, per g, per pkg, per misc unit). There is **no currency field and no currency setting** — see §4 Deviation 3. `StockLine` carries **no cost-bearing key at all**, and AC-16 asserts the exact key list of a `StockLine` object so that a cost field cannot be quietly added ahead of P2's rollup.

### 7. "Dates" resolved to `purchaseDate` and `expiryDate`

The roadmap says "quantity, cost per unit and dates" without naming them. Binding: two nullable columns, both `'YYYY-MM-DD'` **calendar dates** (not ISO-8601 instants — a bag of malt is bought on a day, not at a moment), both validated by pattern *and* by a real-calendar check (`2026-02-30` is a `400`, `2026-02-28` is a `201`), on the `readingTime` precedent in `routes/batches.ts` where `Number.isNaN(Date.parse(v))` is the only check that catches a pattern-valid impossible date. `createdAt`/`updatedAt` remain server-owned ISO-8601 instants exactly as on every other table.

### 8. Where the stock-check route is registered — `routes/inventory.ts`, not `routes/batches.ts`

`GET /api/batches/:batchId/stock-check` is registered inside `registerInventoryRoutes`. `apps/api/src/routes/batches.ts` — 472 lines of M4/M5 pipeline, completion-gate and server-owned-key logic, verification-clean across four milestones — is **not opened by this phase** and is on §1.4's Untouched list.

Fastify/find-my-way already serves `/api/batches/:id` and `/api/batches/:batchId/readings` side by side today, so the differing parameter name at that segment is an in-repo proven pattern, not a gamble.

### 9. Delete is unconditional — no `*_IN_USE` guard

Equipment, mash/fermentation profiles, water profiles and recipes all carry a `409 *_IN_USE` guard because a real FK points at them. Nothing points at an inventory row: recipes and batches reference ingredients by name, and matching is computed per request. `DELETE /api/inventory/:id` is therefore a plain `204`, and the only observable consequence is that a stock-check line that was `matched: true` becomes `matched: false` on the next call (AC-25). This asymmetry with every other entity in the repo is deliberate and is called out here so it does not read as a forgotten guard.

---

## 1. Data Schema & Contracts

### 1.1 New exported constants and types

**`packages/calculations/src/inventory.ts`** (new module; all coefficients/tables module-private except those named here — `constants.ts` is not touched, per the M8_P1 §Ambiguity-6 precedent that `packages/calculations/test/units.test.ts` asserts `constants.ts` exports exactly 15 names):

```ts
export const STOCK_EPSILON = 1e-6;
export const INVENTORY_CATEGORIES: readonly InventoryCategory[];         // ['Fermentable','Hop','Yeast','Misc'], frozen
export const CANONICAL_INVENTORY_UNIT: Readonly<Record<'Fermentable' | 'Hop' | 'Yeast', InventoryUnit>>;
                                                                          // { Fermentable:'kg', Hop:'g', Yeast:'pkg' }, frozen
export const MISC_INVENTORY_UNITS: readonly InventoryUnit[];              // ['g','ml','tsp','tbsp','each'], frozen
export const EMPTY_STOCK_EVALUATION: StockEvaluation;                     // frozen; lines: [], every count 0, hasShortfall false
```

**`packages/shared-types/src/inventory.ts`** (new module):

```ts
export type InventoryCategory = 'Fermentable' | 'Hop' | 'Yeast' | 'Misc';
export type InventoryUnit = 'kg' | 'g' | 'pkg' | 'ml' | 'tsp' | 'tbsp' | 'each';

export interface InventoryItem {
  id: string;
  category: InventoryCategory;
  name: string;                 // trimmed, case preserved exactly as the user typed it
  nameKey: string;              // SERVER-OWNED, derived: normalizeInventoryName(name). Absent from InventoryWriteInput.
  quantity: number;             // may be negative; never clamped
  unit: InventoryUnit;          // constrained by category (Resolved Ambiguity 4)
  costPerUnit: number | null;   // >= 0 when non-null. Never multiplied by anything in M9_P1.
  purchaseDate: string | null;  // 'YYYY-MM-DD'
  expiryDate: string | null;    // 'YYYY-MM-DD'
  notes: string;                // '' when unset, never null
  createdAt: string;            // SERVER-OWNED ISO-8601 UTC
  updatedAt: string;            // SERVER-OWNED ISO-8601 UTC
}

/** The 8 client-writable fields. id / nameKey / createdAt / updatedAt are absent BY DESIGN. */
export interface InventoryWriteInput {
  category: InventoryCategory;
  name: string;
  quantity: number;
  unit: InventoryUnit;
  costPerUnit: number | null;
  purchaseDate: string | null;
  expiryDate: string | null;
  notes: string;
}

/** The 409 INVENTORY_DUPLICATE body's `details` payload — same precedent as EquipmentInUseDetails. */
export interface InventoryDuplicateDetails {
  existingId: string;
  category: InventoryCategory;
  nameKey: string;
  existingName: string;
}
```

**Stock-evaluation types** (also `packages/shared-types/src/inventory.ts`, so the API response and the web page share one shape):

```ts
export interface StockRequirement {
  category: InventoryCategory;
  displayName: string;     // first contributing line item's name, verbatim
  nameKey: string;
  unit: InventoryUnit;
  requiredAmount: number;  // aggregated; always > STOCK_EPSILON (non-positive groups are omitted)
}

export interface StockLine extends StockRequirement {
  matched: boolean;
  inventoryItemId: string | null;
  inventoryUnit: InventoryUnit | null;
  onHand: number | null;
  unitMismatch: boolean;
  shortfall: number | null;   // null in BOTH unknown cases; >= 0 and epsilon-clamped otherwise
  sufficient: boolean | null; // null in BOTH unknown cases
}

export interface StockEvaluation {
  lines: StockLine[];
  requirementCount: number;
  matchedCount: number;
  comparableCount: number;    // matched && !unitMismatch
  unmatchedCount: number;
  unitMismatchCount: number;
  shortfallCount: number;     // comparable lines with shortfall > 0
  hasShortfall: boolean;      // shortfallCount > 0
}
```

**`packages/shared-types/src/api.ts`** — `ApiErrorCode` gains exactly one member: `'INVENTORY_DUPLICATE'`. All eight existing members are unchanged (AC-31).

### 1.2 New table and migration

`apps/api/src/db/schema.ts` gains one table. Additive only — no existing table, column, index or default is altered.

```
inventory_items
  id            text PRIMARY KEY NOT NULL
  category      text NOT NULL              -- enum enforced at the HTTP boundary, not by CHECK (repo-wide convention)
  name          text NOT NULL
  name_key      text NOT NULL
  quantity      real NOT NULL              -- NO lower bound; negative is legal
  unit          text NOT NULL
  cost_per_unit real                       -- nullable
  purchase_date text                       -- nullable, 'YYYY-MM-DD'
  expiry_date   text                       -- nullable, 'YYYY-MM-DD'
  notes         text NOT NULL DEFAULT ''
  created_at    text NOT NULL
  updated_at    text NOT NULL

UNIQUE INDEX inventory_items_category_name_key_uq ON (category, name_key)
INDEX        inventory_items_category_idx         ON (category)
```

Migration file: `apps/api/drizzle/0011_inventory.sql`, journal entry `idx: 11, tag: "0011_inventory", version: "6", breakpoints: true` appended to `apps/api/drizzle/meta/_journal.json`. `CREATE TABLE IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS`, on the `0010_user_config.sql` precedent, so re-running is a no-op (AC-17). No seed rows (§4 Deviation 11).

### 1.3 REST surface (all new)

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| `GET` | `/api/inventory` | — | `200 InventoryItem[]` | `400` on a bad `category`/`outOfStock` query value |
| `GET` | `/api/inventory?category=Hop` | — | `200` filtered | `400 VALIDATION_FAILED` if not one of the 4 categories |
| `GET` | `/api/inventory?outOfStock=true` | — | `200` filtered to `isOutOfStock(quantity)` | `400` if not `'true'`/`'false'` |
| `POST` | `/api/inventory` | `InventoryWriteInput` | `201 InventoryItem` | `400 VALIDATION_FAILED`, `409 INVENTORY_DUPLICATE` |
| `PUT` | `/api/inventory/:id` | `InventoryWriteInput` (full replace) | `200 InventoryItem` | `400`, `404 NOT_FOUND`, `409 INVENTORY_DUPLICATE` |
| `DELETE` | `/api/inventory/:id` | — | `204` | `404 NOT_FOUND` |
| `GET` | `/api/batches/:batchId/stock-check` | — | `200 StockEvaluation` | `404 NOT_FOUND` (unknown batch) |

Query params combine with AND. Default list order: `category` in `INVENTORY_CATEGORIES` order, then `nameKey` ascending (AC-18).

`POST`/`PUT` reject the four server-owned keys (`id`, `nameKey`, `createdAt`, `updatedAt`) in a **`preValidation` hook against the raw body**, not via `additionalProperties: false` — Fastify's repo-wide `removeAdditional: true` default would otherwise silently *strip* them (M3_P1 critic Finding 1 / `routes/batches.ts` `SERVER_OWNED_BATCH_KEYS` precedent). `notes: null` is rejected in the same hook (`coerceTypes: true` would turn it into `''`, and `''` is the meaningful unset value) — the `NULL_REJECTING_STRING_KEYS` precedent.

### 1.4 Symbol inventory — files

**New files (15):** *(amended 2026-08-16 — was 16; `.gsd/active/M9_P1_pre_exec_manifest.txt` removed from this table, see the AC-41 amendment below and §4 Deviation 14)*

| File | Contents |
|---|---|
| `apps/api/drizzle/0011_inventory.sql` | the migration above |
| `apps/api/src/repositories/inventoryRepository.ts` | `listInventory` (with filters), `findInventoryById`, `findInventoryByCategoryAndNameKey`, `createInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`, `rowToInventoryItem` |
| `apps/api/src/routes/inventory.ts` | `registerInventoryRoutes` — the 6 inventory endpoints **and** `GET /api/batches/:batchId/stock-check` (Resolved Ambiguity 8) |
| `apps/api/test/inventory.test.ts` | CRUD, validation, duplicate, filter ACs |
| `apps/api/test/inventory.migration.test.ts` | migration/idempotency/PRAGMA ACs |
| `apps/api/test/stockCheck.test.ts` | endpoint ACs incl. the legacy-batch and read-only ACs |
| `packages/calculations/src/inventory.ts` | the pure module (§2) |
| `packages/calculations/test/inventory.test.ts` | AC-1 … AC-16 |
| `packages/shared-types/src/inventory.ts` | the types in §1.1 |
| `apps/web/src/components/InventoryManager.tsx` | list + filters + row flags (mirrors `WaterProfileManager.tsx`) |
| `apps/web/src/components/InventoryForm.tsx` | create/edit form (mirrors `WaterProfileForm.tsx`) |
| `apps/web/src/components/StockCheckPanel.tsx` | the Planning-stage panel. **Amended 2026-08-16 — one bounded follow-up fix is now required in this file; see "Follow-up execution items" below.** |
| `apps/web/test/InventoryManager.test.tsx` | AC-33, AC-34 |
| `apps/web/test/InventoryForm.test.tsx` | AC-35, AC-36 |
| `apps/web/test/StockCheckPanel.test.tsx` | AC-37, AC-39 |

**Modified files (12) — and the exact extent of each modification:**

| File | Permitted change |
|---|---|
| `apps/api/src/db/schema.ts` | append the `inventoryItems` table + its two indexes. No existing export touched. |
| `apps/api/src/routes/schemas.ts` | append `inventoryWriteBodySchema` and the inventory enum arrays. No existing schema touched. |
| `apps/api/src/server.ts` | one `import` + one `registerInventoryRoutes(app, deps.db)` call. **Forced narrow exception** — no route in this repo is reachable without it (§4 Deviation 7; M7_P1 `registerConfigRoutes` precedent). |
| `apps/api/drizzle/meta/_journal.json` | append the `idx: 11` entry. Structural JSON edit only (hard rule 17). |
| `packages/shared-types/src/api.ts` | add `'INVENTORY_DUPLICATE'` to `ApiErrorCode`; add `InventoryDuplicateDetails` **or** leave it in `inventory.ts` — either is acceptable, but exactly one home. |
| `packages/shared-types/src/index.ts` | one `export * from './inventory'` line. |
| `packages/calculations/src/index.ts` | one `export * from './inventory'` line. No change to the `./config` explicit-name block. |
| `apps/web/src/api/client.ts` | five new functions: `listInventory`, `createInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`, `getBatchStockCheck`. No existing function touched. |
| `apps/web/src/App.tsx` | `'inventory'` added to `View`; the `inventory` render case; the loader/refresh wiring for it. No other route's behaviour changed. |
| `apps/web/src/components/Sidebar.tsx` | one `NavDestination` member, one `NAV_ITEMS` entry at index 6, one `NAV_ICONS` entry (`Package` from lucide-react), one `ActiveView` member. **Forced narrow exception** (§4 Deviation 7; M7_P1 `settings` precedent). |
| `apps/web/src/pages/BatchDetail.tsx` | render `<StockCheckPanel batchId={batch.id} />` **iff** `batch.status === 'Planning'`. No change to the form, the stepper wiring, the measured-vs-estimated panels, or any existing fetch. |
| `apps/web/src/components/PageContainer.tsx` **/** `TopBar.tsx` | **not modified.** Listed here only to state that the Inventory route uses them unchanged. |

**Closed-milestone test files modified (5) — extent strictly bounded (§4 Deviation 8):**

*Amended 2026-08-16 — rows 4 and 5 are new. Both files were previously on the Untouched list, which was self-contradictory: this spec's own approved additive changes (`0011_inventory.sql`; AC-32's 9-entry `NAV_ITEMS`) make the counts those two files pin arithmetically false, so the executor obeying the Untouched list is exactly what left `npm test` at exit 1. This is the same class of gap as M2_P1's `brewingMath.test.ts` and M3_P2's `equipment.migration.test.ts`/`errors.test.ts`, and it is resolved the same way — a named exception with the permitted edit enumerated exhaustively, not a weakened criterion.*

| File | Permitted change | Forbidden |
|---|---|---|
| `apps/web/test/Sidebar.test.tsx` | update the three pinned arrays in `AC-1: NAV_ITEMS shape` from 8 to 9 entries, to exactly the values in AC-32 | changing, weakening or deleting any other assertion in the file |
| `apps/web/test/App.test.tsx` | add `/api/inventory` to the existing fetch-mock table so the new route resolves; extend any exhaustive per-destination loop to cover `inventory` | relaxing an existing assertion, or skipping a case |
| `apps/web/test/BatchDetail.test.tsx` | add a `/stock-check` fetch mock so Planning-status cases resolve | changing any existing expectation about the batch form, stepper, readings, notes or measured values |
| `apps/api/test/seed.test.ts` | **exactly one edit:** the table-count assertion at line 40, `expect(tableNames.length).toBe(19)` → `.toBe(20)`. `0011_inventory.sql` adds `inventory_items` as the 20th table, so `19` is now arithmetically false. The number is the **total table count in the migrated schema**, not a seeded-row count | every other line in the file. In particular the seeded-row-count assertions (`equipmentProfiles` 2, `catalogFermentables` 8, `catalogHops` 7, `catalogYeasts` 4, `catalogMiscs` 6, `recipes` 1, and the 3/4/1 line-item counts) must be byte-identical — `0011_inventory.sql` seeds **zero** rows (§4 Deviation 11), so not one of them may move. Adding an `inventory_items` row-count assertion is also forbidden |
| `apps/web/test/Calculators.test.tsx` | **exactly one edit:** the `NAV_ITEMS` length assertion at line 550, `expect(NAV_ITEMS).toHaveLength(8)` → `toHaveLength(9)`. This is an M8_P2-era regression guard whose premise (no new nav destination) is superseded by AC-32, which *requires* 9 | every other line in the file, including the enclosing test's name/description text and its `TopBar title is still "Calculators"` assertion, which remains true and must still be asserted. Deleting or `.skip`-ing the test instead of correcting its number is a phase failure, not an equivalent fix |

**Untouched — asserted by manifest hash (AC-41 as amended 2026-08-16 — the substitute-baseline comparison, since the literal pre-exec manifest was never captured), not by inspection:**

- `apps/api/src/routes/`: `batches.ts`, `recipes.ts`, `equipment.ts`, `schedules.ts`, `waterProfiles.ts`, `config.ts`, `catalog.ts`, `health.ts`
- `apps/api/src/repositories/`: `batchRepository.ts`, `recipeRepository.ts`, `equipmentRepository.ts`, `scheduleRepository.ts`, `catalogRepository.ts`, `waterProfileRepository.ts`
- `apps/api/src/db/`: `client.ts`, `migrate.ts`, `seed.ts`, `seedCli.ts`; `apps/api/src/mappers/recipeMapper.ts`; `apps/api/src/errors.ts`
- `apps/api/drizzle/0000_*.sql` … `0010_user_config.sql` (all eleven existing migrations, byte-identical)
- every existing file in `apps/api/test/` (25 files) **except `seed.test.ts`**, which moved to the bounded-exception table above on 2026-08-16 (its single permitted edit is the line-40 table count, `19` → `20`; the other 24 files remain byte-identical)
- `packages/calculations/src/`: every module except `index.ts` — in particular `constants.ts`, `units.ts`, `brewingMath.ts`, `batchPipeline.ts`, `batchClosing.ts`, `fermentation.ts`, `carbonation.ts`, `mash.ts`, `hops.ts`, `yeast.ts`, `hydrometry.ts`, `gravityCorrection.ts`, `pressure.ts`, `water.ts`, `scaling.ts`, `chronology.ts`, `config.ts`
- every existing file in `packages/calculations/test/` (20 files) — `units.test.ts`'s "exactly 15 names in `constants.ts`" assertion in particular
- `packages/shared-types/src/`: `brewing.ts`, `batches.ts`, `misc.ts`, `schedules.ts`, `config.ts`
- `apps/web/src/components/`: everything except `Sidebar.tsx` — in particular the ten `calculators/*` components, `MeasuredComparison.tsx`, `CarbonationPanel.tsx`, `ReadingLog.tsx`, `BatchNoteLog.tsx`, `BatchStepper.tsx`, `SettingsManager.tsx`
- `apps/web/src/pages/`: `BatchList.tsx`, `Calculators.tsx`; `apps/web/src/hooks/useRecipeEditor.ts`; `apps/web/src/context/` (both files); `apps/web/src/utils/srmColor.ts`
- every existing file in `apps/web/test/` except the **five** named in the bounded-exception table above (`Sidebar.test.tsx`, `App.test.tsx`, `BatchDetail.test.tsx`, and — added 2026-08-16 — `Calculators.test.tsx`; the fifth exception, `seed.test.ts`, is in `apps/api/test/`). `calculatorImportGraph.test.ts` in particular remains byte-identical
- `.gsd/ROADMAP.md`, `.gsd/HARD_RULES.md`, `.gsd/STATE.json` (owned by the orchestrating session), `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.agents/`
- root `package.json`, `tsconfig.base.json`, `apps/web/vite.config.ts`, `oxlint` config

### 1.4a Follow-up execution items (amendment of 2026-08-16 — the ONLY work the next `/execute` pass performs)

The M9_P1 build is otherwise complete and 39 of 41 acceptance criteria traced YES against it in the 2026-08-16 critic audit. The next `/execute` pass is **not** a rebuild and must not re-derive, re-run or re-touch anything outside this list. Exactly four files may be opened:

1. **`apps/api/test/seed.test.ts`** — the one permitted edit above (line 40, `19` → `20`).
2. **`apps/web/test/Calculators.test.tsx`** — the one permitted edit above (line 550, `8` → `9`).
3. **`apps/web/src/components/StockCheckPanel.tsx`** — the unit-format fix specified in §2.3 point 4 (as amended). Bounded to `statusTextFor` and its single call site:
   - `statusTextFor`'s signature gains a second parameter, `unitSystem: UnitSystem` (the type is already imported at line 2).
   - The shortfall branch routes `line.shortfall` through the **same** `formatAmount(value, line.unit, unitSystem)` helper that already renders `requiredAmount` and `onHand` on that row, instead of interpolating the raw number and appending `line.unit` itself. `formatAmount` and its `kg`/`g`/passthrough dispatch are **unchanged** — this is a routing fix, not a formatting-rule change.
   - The one call site (`{statusTextFor(line)}` in the row markup) passes `config.unitSystem`, which is already in scope in the component.
   - **Forbidden:** any change to `formatAmount` itself, to the four-branch order or the branch predicates of `statusTextFor`, to the `Not tracked` / `Unit mismatch …` / `In stock` strings, to the fetch effect, to the loading/error/empty branches, to the header string, or to the `key`/`data-testid` expressions. The unit-mismatch branch keeps naming raw `inventoryUnit`/`unit` labels — those are unit *names*, not amounts, and are correctly not formatted.
4. **`apps/web/test/StockCheckPanel.test.tsx`** — add the AC-37 `us` companion case only (see AC-37 as amended) and correct the metric shortfall literal. Every other assertion in the file stays as written.

No other file may be modified in the follow-up pass. In particular `packages/calculations/src/inventory.ts` is **not** touched: the shortfall is a correct number, and the defect is purely in how the web layer renders it — pushing formatting into the pure layer would violate §2.1's purity contract and the M7 repo-wide invariant that no component (and no calc function) performs its own unit conversion.

---

## 2. Transformations & Pure Logic

### 2.1 Pure function contracts — `packages/calculations/src/inventory.ts`

```ts
function normalizeInventoryName(name: string): string;
// trim -> collapse whitespace runs to ' ' -> toLowerCase. Total; '' and '   ' both -> ''.

function isValidInventoryUnit(category: InventoryCategory, unit: InventoryUnit): boolean;
// Fermentable -> unit === 'kg'; Hop -> 'g'; Yeast -> 'pkg'; Misc -> MISC_INVENTORY_UNITS.includes(unit).

function isOutOfStock(quantity: number): boolean;   // quantity <= STOCK_EPSILON
function isNegativeStock(quantity: number): boolean; // quantity < -STOCK_EPSILON

function requirementsFromRecipe(recipe: Recipe): StockRequirement[];
// Aggregates by (category, nameKey); category order Fermentable->Hop->Yeast->Misc; within a
// category, first-appearance order. Groups with requiredAmount <= STOCK_EPSILON are OMITTED.
// Misc groups additionally key on `unit`: two Misc lines with the same name but different units
// are two groups (they are not addable), each matched independently.
// Returns [] for a recipe with no line items. Never throws. Never mutates `recipe`.

function evaluateStock(
  requirements: readonly StockRequirement[],
  inventory: readonly InventoryItem[],
): StockEvaluation;
// One O(n) index over inventory keyed `${category}::${nameKey}` (the UNIQUE index guarantees
// at most one row per key, so there is no tie-break branch). Per requirement, applies the §Resolved
// Ambiguity 3 table verbatim. Never mutates either argument. Never reads costPerUnit.
```

`Recipe` and `InventoryItem` are imported **type-only** from `@truchabrew/shared-types` (which imports nothing from `@truchabrew/calculations`, so no cycle is introduced).

### 2.2 No-match / fallback contracts

Restated as the binding contract, because this is where a placeholder leaks:

- `evaluateStock([], anyInventory)` returns a value **deep-equal to `EMPTY_STOCK_EVALUATION`** — `lines: []`, all seven counts `0`, `hasShortfall: false`. It does not return `null`, `undefined`, or a one-line "nothing to check" placeholder.
- `evaluateStock(requirements, [])` returns `requirements.length` lines, **every one** `matched: false` with `onHand: null` and `shortfall: null`; `unmatchedCount === requirements.length`; `shortfallCount === 0`; **`hasShortfall === false`**. An empty inventory is "unknown", never "you are short of everything".
- A line's `shortfall` is `null` — not `0` — whenever it is unknown. A caller that renders `shortfall ?? 0` produces "0 short" for an untracked ingredient, which is the exact false-reassurance this contract exists to prevent.

### 2.3 Stateful integration contract — `StockCheckPanel` in `BatchDetail`

1. `BatchDetail` renders `<StockCheckPanel batchId={batch.id} />` **only when `batch.status === 'Planning'`**. In the other four statuses the component is not mounted at all, so no request is issued (AC-38).
2. On mount (and on `batchId` change), the panel issues exactly **one** `GET /api/batches/:batchId/stock-check`. It never polls, never re-fetches on an unrelated `BatchDetail` re-render, and issues **zero** write requests of any kind.
3. Loading state renders a labelled placeholder; a failed request renders the `ApiClientError` message inline. Neither state renders a line list, a count, or a zero — a failed stock check must never look like a clean stock check.
4. Rendering per line branches in this order, and only this order: `!matched` → **"Not tracked"**; `unitMismatch` → **"Unit mismatch — on hand in {inventoryUnit}, recipe calls for {unit}"**; `shortfall > 0` → **"Short {formatted shortfall}"**; else → **"In stock"**.

   **Amended 2026-08-16 (binding — resolves the point-4-vs-point-6 tension the critic identified).** The shortfall branch's previous literal template `"Short {shortfall} {unit}"` interpolated the raw number and appended the recipe's unit directly, bypassing point 6's mandated `format*` helpers. Because `requiredAmount` and `onHand` on the same row *do* go through those helpers, a single row rendered two unit systems at once under `unitSystem: 'us'` — e.g. `Required: 12.13 lb · On hand: 8.82 lb · Short 1.5 kg`, telling a US-units brewer they are short `1.5` of a unit appearing nowhere else on the row. **Point 6 wins over point 4's literal template, in every case where the two disagree.** The shortfall is an amount, and every amount on this panel is rendered by the same helper that renders the other amounts on its own row — `formatAmount(line.shortfall, line.unit, config.unitSystem)`, which already emits the unit label, so the template appends no unit of its own.

   Two consequences, both intended and both pinned in AC-37 as amended:
   - Under `unitSystem: 'metric'` the pale-ale-malt row now reads **`Short 1.50 kg`**, not `Short 1.5 kg` — `formatMass` fixes 2 decimals. This is *not* a weakening of the old assertion: the same row's `Required:` text already read `5.50 kg` under the same helper, so the old `1.5` was the one string on the panel that disagreed with its own row. The metric assertion stays, at its corrected value.
   - The unrounded-float exposure closes as a side effect. A shortfall of `1.5000000000000004` (an ordinary float-subtraction residue, entirely reachable through `evaluateStock`) previously rendered in full; going through `toFixed` it cannot. **No epsilon or rounding is added to the pure layer** — `shortfall` stays exact in the API body, and only the display rounds (§2.1's contract is untouched).
   - The `unitMismatch` branch is deliberately excluded from this change: `inventoryUnit` and `unit` there are unit *names* being reported, not amounts being rendered, and formatting them would be a category error.
5. The panel header renders `"{shortfallCount} of {requirementCount} ingredients short"`, and when `requirementCount === 0` renders instead `"This batch's recipe has no trackable ingredients."` with no line rows (AC-39).
6. Numeric amounts on the panel are rendered through the M7 `format*` helpers keyed off `useConfig().config` where a helper exists for that unit (mass in kg via `formatMass`, hop mass in g via `formatHopMass`); `pkg` and the misc units have no M7 helper and are rendered as plain numbers with the unit appended. No component performs its own unit conversion (M7's repo-wide invariant, unchanged).
7. The panel holds no state that outlives the batch route, writes nothing to `ConfigContext` or `CatalogContext`, and is not rendered on any other route.

### 2.4 Refactoring & legacy cleanup

There is **no legacy inventory code to purge** — this is a greenfield entity. The only cleanup obligations are negative ones, and they are enumerated so their absence is checkable:

- **No** parallel normalization helper. `normalizeInventoryName` has exactly one definition in the repository, in `packages/calculations/src/inventory.ts`, and both the API (deriving `name_key` on write) and the web layer call **that** one. An inline `.trim().toLowerCase()` anywhere in `apps/api` or `apps/web` is a defect (AC-16 companion assertion in the import-graph style established by M8_P1).
- **No** second unit table. `CANONICAL_INVENTORY_UNIT` / `MISC_INVENTORY_UNITS` are the single source; `routes/schemas.ts`'s enum arrays must be derived from them by import, not retyped as literals — the `BATCH_STATUSES` / `CARBONATION_TYPES` precedent already in `schemas.ts` line 3.
- **No** new entry in `packages/calculations/src/constants.ts` (`units.test.ts` asserts exactly 15 names there; the module-private-constant precedent is `carbonation.ts`).
- **No** widening of `Batch`, `BatchWriteInput`, `BatchWithReadings`, or the `batches` table. Not one column, not one field. The stock check is computed, never stored — which is precisely why a pre-M9 batch needs no migration and no backfill.

---

## 3. Acceptance Criteria & Test Matrix

**Shared fixture (binding, used by AC-6 … AC-16, AC-27, AC-28, AC-37).** Inventory rows:

| id | category | name | nameKey | quantity | unit | costPerUnit |
|---|---|---|---|---|---|---|
| `inv-1` | Fermentable | `Pale Ale Malt` | `pale ale malt` | `4.0` | `kg` | `3.20` |
| `inv-2` | Fermentable | `Munich Malt` | `munich malt` | `0.0` | `kg` | `4.10` |
| `inv-3` | Hop | `Citra` | `citra` | `50` | `g` | `0.09` |
| `inv-4` | Yeast | `SafAle US-05` | `safale us-05` | `2` | `pkg` | `4.50` |
| `inv-5` | Misc | `Gypsum` | `gypsum` | `-0.5` | `g` | `0.02` |
| `inv-6` | Misc | `Lactic Acid` | `lactic acid` | `100` | `g` | `0.03` |
| `inv-7` | Fermentable | `Flaked Oats` | `flaked oats` | `1.0` | `kg` | `null` |

Recipe snapshot line items: fermentables `Pale Ale Malt 3.0 kg`, `PALE ALE  MALT 2.5 kg`, `Munich Malt 0.5 kg`; hops `Citra 50 g`; yeasts `SafAle US-05 3 pkg`; miscs `Gypsum 4 g`, `Whirlfloc 1 each`, `Lactic Acid 2 ml`.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | Constant exports | Unit | `STOCK_EPSILON === 1e-6`; `INVENTORY_CATEGORIES` deep-equals `['Fermentable','Hop','Yeast','Misc']`; `CANONICAL_INVENTORY_UNIT` deep-equals `{Fermentable:'kg',Hop:'g',Yeast:'pkg'}`; `MISC_INVENTORY_UNITS` deep-equals `['g','ml','tsp','tbsp','each']`; all four `Object.isFrozen` → `true` |
| AC-2 | `normalizeInventoryName` | Unit | `'  Pale   Ale MALT '` → `'pale ale malt'`; `'Citra'` → `'citra'`; `'A\t\nB'` → `'a b'`; `''` → `''`; `'   '` → `''` |
| AC-3 | `isOutOfStock` boundary (inclusive) | Unit | `0`→`true`; `1e-9`→`true`; `1e-6`→`true`; `-0.5`→`true`; `0.0001`→`false`; `4`→`false` |
| AC-4 | `isNegativeStock` boundary (exclusive) | Unit | `-0.5`→`true`; `-1e-9`→`false`; `-1e-6`→`false`; `0`→`false`; `4`→`false` |
| AC-5 | `isValidInventoryUnit` | Unit | `('Fermentable','kg')`→`true`; `('Fermentable','g')`→`false`; `('Hop','g')`→`true`; `('Hop','kg')`→`false`; `('Yeast','pkg')`→`true`; `('Misc','ml')`→`true`; `('Misc','kg')`→`false`; `('Misc','pkg')`→`false` |
| AC-6 | Requirement aggregation, naming and order | Unit | 7 groups, `nameKey`s in exactly the order `['pale ale malt','munich malt','citra','safale us-05','gypsum','whirlfloc','lactic acid']`; group 1 `requiredAmount === 5.5` and `displayName === 'Pale Ale Malt'`; group 1 `unit === 'kg'` |
| AC-7 | Non-positive groups omitted (degenerate) | Unit | Recipe with a single `0 kg` fermentable → `[]`; recipe with `+1.0 kg` and `-1.0 kg` of the same name → `[]`; recipe with no line items at all → `[]` |
| AC-8 | Exactly-equal boundary is sufficient | Unit | Citra line: `requiredAmount 50`, `onHand 50`, `shortfall === 0`, `sufficient === true`, `unitMismatch === false` |
| AC-9 | Shortfall values | Unit | `pale ale malt` `1.5`; `munich malt` `0.5`; `safale us-05` `1`; `gypsum` `4.5` (each `toBeCloseTo(…, 9)`); every one `sufficient === false` |
| AC-10 | No-match contract | Unit | `whirlfloc` line deep-equals `{…, matched:false, inventoryItemId:null, inventoryUnit:null, onHand:null, unitMismatch:false, shortfall:null, sufficient:null}` |
| AC-11 | Unit-mismatch contract | Unit | `lactic acid` line: `matched:true`, `inventoryItemId:'inv-6'`, `inventoryUnit:'g'`, `onHand:100`, `unitMismatch:true`, `shortfall:null`, `sufficient:null` |
| AC-12 | Aggregate counters | Unit | `requirementCount 7`, `matchedCount 6`, `comparableCount 5`, `unmatchedCount 1`, `unitMismatchCount 1`, `shortfallCount 4`, `hasShortfall true` |
| AC-13 | Degenerate / empty inputs | Unit | `evaluateStock([], fixtureInventory)` deep-equals `EMPTY_STOCK_EVALUATION`; `evaluateStock(fixtureRequirements, [])` → 7 lines all `matched:false`, `unmatchedCount 7`, `shortfallCount 0`, **`hasShortfall false`** |
| AC-14 | Epsilon clamp, both sides | Unit | `required 0.1+0.2` vs `onHand 0.3` → `shortfall === 0` (strict equality, not `toBeCloseTo`) and `sufficient true`; `required 1.000002` vs `onHand 1.0` → `shortfall` `toBeCloseTo(0.000002, 9)` and `sufficient false` |
| AC-15 | Category isolation | Unit | Inventory `Hop/citra` does not satisfy a `Misc` requirement named `Citra` → that line `matched:false` |
| AC-16 | Purity, key surface, and no cost math | Unit | `evaluateStock` leaves both arguments deep-equal to pre-call clones; `Object.keys(line).sort()` deep-equals the 12-key list `['category','displayName','inventoryItemId','inventoryUnit','matched','nameKey','onHand','requiredAmount','shortfall','sufficient','unit','unitMismatch']` — i.e. **no cost key exists**; a source scan asserts `costPerUnit` appears zero times in `packages/calculations/src/inventory.ts` |
| AC-17 | Migration applies and is idempotent | Integration | On a fresh DB, `runMigrations` twice → no error; `PRAGMA table_info(inventory_items)` returns exactly the 12 columns of §1.2 with the pinned types/notnull; `PRAGMA index_list` contains `inventory_items_category_name_key_uq` (unique=1) and `inventory_items_category_idx`; the count of pre-existing tables is unchanged |
| AC-18 | List, empty and ordered | Integration | `GET /api/inventory` on an empty DB → `200 []`; with `inv-3`, `inv-1`, `inv-5` inserted in that order → ids returned as `['inv-1','inv-3','inv-5']` (category order, then `nameKey` asc) |
| AC-19 | Create mints server-owned fields | Integration | `POST` `{category:'Fermentable', name:'  Pale   Ale MALT ', quantity:4, unit:'kg', costPerUnit:3.2, purchaseDate:'2026-08-01', expiryDate:null, notes:''}` → `201`; response `name === 'Pale Ale MALT'` (trimmed, inner run collapsed only in `nameKey`, case preserved), `nameKey === 'pale ale malt'`, `id` non-empty, `createdAt === updatedAt` |
| AC-20 | Duplicate detection | Integration | Second `POST` with `name:'pale ale malt'`, same category → `409` code `INVENTORY_DUPLICATE`, `details` deep-equals `{existingId:<id>, category:'Fermentable', nameKey:'pale ale malt', existingName:'Pale Ale MALT'}`; the same `nameKey` under `category:'Misc'` → `201` |
| AC-21 | Negative stock is accepted | Integration | `POST` `quantity:-0.5` → **`201`**; `GET` returns exactly `-0.5` (not `0`, not clamped); the row is flagged by `isOutOfStock` and `isNegativeStock` |
| AC-22 | Write validation matrix | Integration | `name:''`→400; `name:'   '`→400; `category:'Grain'`→400; `('Fermentable','g')`→400; `('Misc','pkg')`→400; `costPerUnit:-1`→400; `costPerUnit:null`→201; `quantity:'abc'`→400; `purchaseDate:'2026-02-30'`→400; `purchaseDate:'2026-02-28'`→201; `expiryDate:'yesterday'`→400; `expiryDate:null`→201. Every 400 carries code `VALIDATION_FAILED` |
| AC-23 | Server-owned keys and `notes:null` rejected, not stripped | Integration | Bodies containing `id`, `nameKey`, `createdAt`, `updatedAt` → four separate `400 VALIDATION_FAILED`, each message naming that key; `notes:null` → `400`; `notes:''` → `201` with `notes === ''` |
| AC-24 | Update semantics | Integration | `PUT` full replace → `200` with all 8 fields replaced, `createdAt` unchanged, `updatedAt` changed; renaming to a value colliding with another row in the same category → `409 INVENTORY_DUPLICATE`; renaming to a fresh value updates `nameKey`; `PUT` unknown id → `404 NOT_FOUND` |
| AC-25 | Delete is unconditional | Integration | `DELETE` existing → `204`, row gone; `DELETE` unknown → `404`; deleting `inv-1` while a batch's stock check references it → next `GET /stock-check` shows that line `matched:false`, `shortfall:null` (never an error, never a stale `onHand`) |
| AC-26 | Query filters | Integration | `?category=Hop` → hops only; `?outOfStock=true` with quantities `[0, -0.5, 1e-9, 0.0001, 4]` → exactly the first three; `?category=Misc&outOfStock=true` → AND-combined; `?category=Bogus` → `400`; `?outOfStock=maybe` → `400`; no params → all rows |
| AC-27 | Stock-check endpoint | Integration | `GET /api/batches/:batchId/stock-check` against the fixture → `200` whose body deep-equals the `StockEvaluation` pinned by AC-9 + AC-10 + AC-11 + AC-12; unknown `batchId` → `404 NOT_FOUND` |
| AC-28 | Stock check reads live inventory, frozen snapshot | Integration | After `PUT inv-1 quantity:6.0`, the same call returns `pale ale malt` `shortfall 0`/`sufficient true`, `shortfallCount 3`, `hasShortfall true`; after editing the **source recipe's** grain bill, the same call is byte-identical (requirements still come from `recipeSnapshot`) |
| AC-29 | Stock check writes nothing | Integration | `quantity` and `updatedAt` of all 7 fixture rows are byte-identical before and after 5 successive `GET /stock-check` calls; no `inventory_items` row count change |
| AC-30 | Pre-M9 batch compatibility | Integration | A batch row with `stats_snapshot` NULL and `closing_snapshot` NULL returns a valid `200` stock check; `GET`/`PUT /api/batches/:id` on that batch behave identically to the pre-change suite; a Planning→Brewing→…→Completed run on it succeeds with zero inventory rows present |
| AC-31 | Error-code surface | Integration | `ApiErrorCode` includes `'INVENTORY_DUPLICATE'`; all eight pre-existing codes (`VALIDATION_FAILED`, `NOT_FOUND`, `EQUIPMENT_NOT_FOUND`, `EQUIPMENT_IN_USE`, `PROFILE_IN_USE`, `RECIPE_IN_USE`, `WATER_PROFILE_IN_USE`, `INTERNAL`) still present and unchanged |
| AC-32 | Sidebar nav shape | Component | `NAV_ITEMS` has length **9**; destinations deep-equal `['list','equipment','mashProfiles','fermentationProfiles','waterProfiles','batches','inventory','settings','calculators']`; labels deep-equal `['Recipes','Equipment Profiles','Mash Schedules','Fermentation Schedules','Water Profiles','Batches','Inventory','Settings','Calculators']`; `NAV_ICONS` is total over `NavDestination`; `activeDestinationFor('inventory') === 'inventory'` |
| AC-33 | Inventory page filters issue the pinned requests | Component | Initial render → `'/api/inventory'`; selecting the Hop filter → `'/api/inventory?category=Hop'`; toggling out-of-stock → `'/api/inventory?outOfStock=true'`; both → `'/api/inventory?category=Hop&outOfStock=true'`. Rows render `name`, `quantity`, `unit`, and `costPerUnit` (or `'—'` when null) |
| AC-34 | Stock flags rendered | Component | Row `quantity:-0.5` shows both an "Out of stock" and a "Negative stock" indicator; row `quantity:0` shows "Out of stock" and **not** "Negative stock"; row `quantity:4` shows neither |
| AC-35 | Form submits exactly `InventoryWriteInput` | Component | Submitting posts a body whose `Object.keys().sort()` deep-equals `['category','costPerUnit','expiryDate','name','notes','purchaseDate','quantity','unit']` — no `id`, `nameKey`, `createdAt`, `updatedAt`; selecting `Fermentable` leaves `kg` as the only unit option, `Misc` offers exactly the five `MISC_INVENTORY_UNITS` |
| AC-36 | Duplicate error surfaces without data loss | Component | A `409 INVENTORY_DUPLICATE` renders the server's message inline and the form retains every entered value (not cleared, not reset to defaults) |
| AC-37 | Planning-stage panel content | Component | **(a) Metric — amended 2026-08-16, retained and strengthened, not weakened.** Under `unitSystem: 'metric'` with the fixture: 7 line rows; `pale ale malt` reads **`Short 1.50 kg`** (previously pinned as `Short 1.5 kg` — corrected to the value §2.3 point 4's mandated `formatAmount`/`formatMass` path produces, matching the `5.50 kg` the same row's `Required:` text already renders); `citra` reads `In stock`; `whirlfloc` reads `Not tracked`; `lactic acid` reads a string containing both `g` and `ml`; header reads `4 of 7 ingredients short`. No rendered text matches `/NaN\|undefined\|null/`. **(b) US companion — new.** The *identical* fixture re-rendered under `unitSystem: 'us'` (same `ConfigProvider` swap M7's suites already use): the `pale ale malt` row's `Required:`/`On hand:` text reads `12.13 lb` / `8.82 lb` **and** its status reads **`Short 3.31 lb`** — all three amounts in `lb`, no `kg` anywhere in that row's text (`expect(rowText).not.toMatch(/kg/)`). The `gypsum` row (`g`, via `formatHopMass`) reads `Short 0.16 oz` and contains no bare ` g` amount. `whirlfloc` still reads `Not tracked` and `citra` still reads `In stock` under `us` — the three non-numeric outcomes are unit-system-invariant. **(c) Regression guard.** No rendered row anywhere in either system mixes unit labels: for each row, the set of unit tokens appearing in its `Required:`/`On hand:`/status text has exactly one member, *except* the `lactic acid` unit-mismatch row, whose two-unit text (`g` and `ml`) is the point of that branch and is explicitly exempt |
| AC-38 | Panel is Planning-only | Component | For `status` in `['Brewing','Fermenting','Conditioning','Completed']`: the panel is absent from the DOM **and** zero requests to a URL containing `/stock-check` were issued |
| AC-39 | Empty and error states | Component | `requirementCount === 0` → the empty-state string, zero line rows, no count header; a rejected fetch → the error message and **no** line list and **no** `0 of 0` header |
| AC-40 | Regression invariance | Integration | Full workspace suite green: every pre-existing `apps/api`, `packages/calculations` and `apps/web` test passes unmodified except the **five** bounded edits in §1.4 (amended 2026-08-16 — was three; `seed.test.ts` and `Calculators.test.tsx` added), and each of those five files' non-listed assertions is byte-identical to its pre-change text. **Green is defined as `npm test` exiting `0`, and the exit code must be asserted explicitly — not inferred from reading the summary block printed last.** `npm test --workspaces` prints one summary per workspace and continues past a failing one, so a green-looking tail is not evidence; this phase was twice certified Layer-1-clean while the command exited `1`. The per-workspace pass/fail counts must be read from all three blocks and reported summed. `npm run typecheck`, `npm run build` and `npm run lint` must each exit `0` as well, with no lint warning beyond the three pre-existing `only-export-components` warnings (`ConfigContext.tsx` ×2, `CatalogContext.tsx`) |
| AC-41 | **Scope guardrail** (rewritten 2026-08-16 — the original mechanism is unrecoverable for this phase; see below and §4 Deviation 14) | Verification | **Satisfied by the substitute-baseline comparison recorded in the 2026-08-16 critic report, which was performed and came out clean.** Verification of this AC consists of confirming that report's three enumerated results, not of re-running the original mechanism: (a) **CHANGED — exactly 14 files**, every one of them on §1.4's Modified table and nothing else (`schema.ts`, `routes/schemas.ts`, `server.ts`, `drizzle/meta/_journal.json`, `App.tsx`, `api/client.ts`, `Sidebar.tsx`, `BatchDetail.tsx`, `calculations/src/index.ts`, `shared-types/src/api.ts`, `shared-types/src/index.ts`, plus `Sidebar.test.tsx`, `App.test.tsx`, `BatchDetail.test.tsx`); (b) **NEW — exactly 15 files**, every one of them on §1.4's New table as amended; (c) **REMOVED — 0**, and **zero contamination of any §1.4 Untouched-listed path**, specifically including `routes/batches.ts`, `batchRepository.ts`, `recipeMapper.ts`, `errors.ts`, migrations `0000`–`0010`, the other 24 `apps/api/test/` files, `constants.ts`, `units.ts`, `brewingMath.ts`, `units.test.ts`, the ten `calculators/*` components and `calculatorImportGraph.test.ts`. The follow-up `/execute` pass of §1.4a adds exactly four more files to the CHANGED set (`seed.test.ts`, `Calculators.test.tsx`, `StockCheckPanel.tsx`, `StockCheckPanel.test.tsx`) — all four are now on the Modified/New tables, and any fifth changed file is a scope violation |

**41 acceptance criteria.** (Count unchanged by the 2026-08-16 amendment — no AC was added, removed or renumbered. Only AC-37, AC-40 and AC-41 were edited; the other 38 stand byte-unchanged.)

**AC-41 — why the criterion was rewritten rather than re-run (binding note, 2026-08-16).**

AC-41 originally required `.gsd/active/M9_P1_pre_exec_manifest.txt`: a SHA-256 content manifest of the whole working tree captured **before the executor's first edit**, to be diffed against a post-execution manifest so that every Untouched-listed path could be proved byte-identical across the execution window. That file was never produced. It is not on disk, not in `stash@{0}`, and not in any reachable git tree.

**It cannot be reconstructed.** A pre-execution manifest is a hash of a filesystem state that no longer exists; re-running the capture command today would hash the *post*-execution tree and produce a manifest that is a forgery of the evidence rather than the evidence. There is no code change, and no executor action, that can discharge the criterion as originally written. Two further facts compound it: the surviving post-exec manifest is itself stale against the working tree (of its 401 entries only 91 match raw bytes, 308 match only after `CRLF → LF` normalization — collateral from the `core.autocrlf` conversion already documented in `STATE.json`'s recovery entry), so even a two-manifest comparison would today flag nearly the whole tree for reasons unrelated to scope.

**What was done instead, and why it is sufficient.** The 2026-08-16 critic pass substituted `.gsd/archive/manual_verification/M8_P2/M8_P2_post_exec_manifest.txt` — a genuine, independently archived snapshot of the tree as it stood when M8 closed, i.e. a true pre-M9 baseline — and compared it against the current tree line-ending-insensitively (a match under raw, `CRLF→LF` or `LF→CRLF` bytes), restricted to `apps/**` and `packages/**`. The result is the clean three-part delta now written into the AC-41 row. This baseline is in one respect *stronger* than the criterion originally asked for: it predates the phase's planning as well as its execution, so it would also have caught any edit made between spec approval and the executor's first write. Its one genuine weakness is the line-ending insensitivity forced by the `autocrlf` conversion, which means a change consisting *solely* of line endings would not be detected — an exposure with no plausible scope-violation shape behind it, and disclosed here rather than glossed.

**Process correction for every future phase (this is the durable half of the finding).** The pre-execution manifest must be captured **and committed or otherwise preserved outside `.gsd/active/` before `/execute` begins** — not left as an untracked file in a working directory that can be lost between sessions, which is exactly how it was lost here. A guardrail whose evidence depends on an untracked artifact surviving a multi-session, multi-assistant handoff is not a guardrail. The concrete requirement for the next spec: capture the manifest as the first action after `SPEC_APPROVED`, verify it exists and is non-empty before the first edit, and archive it to `.gsd/archive/manual_verification/<milestone>_<phase>/` immediately rather than at `/steer`.

---

## 4. Deviation Register

Everything here departs from, or resolves silence in, the literal `.gsd/ROADMAP.md` Milestone 9 text. Each needs sign-off at the halt gate.

1. **The milestone is split into two phases.** The roadmap describes M9 as one milestone. Its hardening scope contains four independently-sized bodies of work — four-category inventory CRUD, negative-stock handling with filtering, an auditable deduction/reversal event log, and a cost-plus-nutrition rollup — comparable in total to M3, M4, M7 and M8, each of which the planner split in two. **P1 = stock and shortfall (this spec). P2 = checkoff, the deduction ledger, reversal, cost rollup, nutrition (§5).** P1 is a vertical slice on its own: a user can stock their cupboard and see what they are short of for a planned batch, end to end, with no P2 code present.
2. **Two of the roadmap's three verification-threshold clauses are explicitly not claimed by this phase.** Only *"batches created before this milestone still open and complete without inventory data"* is discharged here (AC-30/AC-38/AC-40). The deduct/restore-without-drift and cost-total clauses are P2's, and this spec must not be read as partially satisfying them.
3. **No currency field, no currency setting.** The roadmap says "cost per unit" and never names a currency. Adding one would mean either a new `user_config` column — reopening M7_P1's approved config contract in a phase that has no other reason to touch it — or a per-row currency, which invites mixed-currency totals in P2. `costPerUnit` is a unitless number rendered without a symbol. **Raised for sign-off:** if a single global currency label is wanted, it is cheapest to add in P2 alongside the rollup, not here.
4. **"Dates" resolved to `purchaseDate` + `expiryDate`, both nullable `'YYYY-MM-DD'`** (Resolved Ambiguity 7). The roadmap's plural is otherwise unspecified.
5. **Matching is normalized-name + category with a write-time UNIQUE constraint** (Resolved Ambiguity 1) — the roadmap says only that inventory rows "share the ingredient line-item shape". The visible consequence is that `Pale Ale Malt (2-Row)` will not match `Pale Ale Malt`, and reads "Not tracked" rather than being silently reconciled.
6. **Unit mismatch is reported, never converted** (Resolved Ambiguity 4), and is structurally possible only in the `Misc` category.
7. **`apps/api/src/server.ts`, `apps/web/src/components/Sidebar.tsx` and `apps/api/drizzle/meta/_journal.json` are modified as forced narrow exceptions.** No route in this repo is reachable without a `server.ts` registration call, no page is reachable without a `Sidebar` entry, and no migration runs without a journal entry. Precedent: M7_P1 blessed exactly this trio of exceptions for `registerConfigRoutes` and the `settings` destination, and M3_P1 for the journal. Each edit is bounded in §1.4 and is flagged here for critic attention rather than buried.
8. **Five closed-milestone test files are edited** (`Sidebar.test.tsx`, `App.test.tsx`, `BatchDetail.test.tsx`, and — added by the 2026-08-16 amendment — `apps/api/test/seed.test.ts` and `apps/web/test/Calculators.test.tsx`), each with an explicitly enumerated permitted change and an explicit forbidden list (§1.4). Weakening or deleting any other assertion in those files is a phase failure, not a judgement call. The two added files are single-number corrections forced by this spec's own approved changes (a new table; a ninth nav item); the original spec listed them as Untouched, which was a self-contradiction, and the correction is to name the exception, not to relax the count.
9. **The out-of-stock threshold is `<= STOCK_EPSILON`, not `<= 0`** (Resolved Ambiguity 2). The roadmap says only "an out-of-stock filter". The epsilon is chosen now so P2's repeated deduct/restore float arithmetic inherits a pinned threshold instead of inventing one.
10. **Nutrition is entirely deferred to P2.** It appears in M9's hardening scope alongside the cost rollup and shares its "on completed batches" trigger; splitting them across phases would put two half-implementations of the completed-batch summary in the codebase at once.
11. **No seed inventory data.** `apps/api/src/db/seed.ts` is untouched and `0011_inventory.sql` inserts no rows. Seeded stock would be fictional quantities of ingredients the user does not own, and `apps/api/test/seed.test.ts` is on the Untouched list.
12. **`GET /api/batches/:batchId/stock-check` is registered from `routes/inventory.ts`** (Resolved Ambiguity 8), so `routes/batches.ts` stays byte-identical.
13. **The scope guardrail is a SHA-256 content manifest, not `git diff --name-only`** (AC-41). This repository has exactly one commit, which predates every milestone's work, so a name-only diff against any available base would list essentially the entire tree and prove nothing. Verified before writing this spec (`git rev-list --count HEAD` → `1`), not assumed.

14. **AC-41's guardrail is discharged against a substitute baseline, because the specified one was never captured and cannot be reconstructed** (added 2026-08-16). The required pre-execution manifest does not exist; the M8_P2 archived post-exec manifest was used as a pre-M9 baseline instead and the comparison came out clean. Full reasoning, the disclosed weakness (line-ending insensitivity forced by the `core.autocrlf` conversion), and the process correction for future phases are in the AC-41 note at the end of §3. **Raised for sign-off:** this asks the user to accept a substituted form of evidence for one verification criterion. The alternative is to declare AC-41 permanently unsatisfiable for M9_P1 and close the phase with 40 of 41 criteria — which records the same facts but blocks the phase, and buys nothing the substitute check has not already proved.

15. **One implementation defect found by the 2026-08-16 critic pass is fixed in a bounded follow-up rather than deferred** (added 2026-08-16). `StockCheckPanel` rendered a row's shortfall in the recipe's raw metric unit while rendering the same row's required/on-hand amounts through the M7 helpers, producing `Required: 12.13 lb · On hand: 8.82 lb · Short 1.5 kg` under `unitSystem: 'us'`. Scope of the fix is enumerated in §1.4a; the spec-layer decision it depended on (which of §2.3's two clauses wins) is resolved in §2.3 point 4 in favour of point 6's helpers. This is deliberately *not* deferred to P2: it is a wrong number in front of the user, in code this phase introduced, and the fix is four files with no contract change.

---

## 5. M9_P2 Preview (not in scope, not approved by this spec)

**"Check it off, and what did it cost"** — the second half of the milestone, to be specced separately after P1 closes:

- **An auditable deduction ledger.** A new `inventory_transactions` table — one append-only row per checkoff event carrying `batchId`, `inventoryItemId`, the deducted amount, the unit, the `costPerUnit` **as recorded at the moment of deduction** (so a later price edit cannot retroactively rewrite a closed batch's cost), a server-minted timestamp, and a reversal marker. Stock on hand becomes a function of the base quantity and the ledger, so an un-checkoff restores exactly and repeated toggles cannot drift (the roadmap's "no drift after repeated toggles" clause).
- **Checkoff UI in the Planning stage**, built directly on P1's `StockCheckPanel` lines — each comparable line gains a checkbox; unmatched and unit-mismatched lines are not checkable.
- **Cost rollup on a completed batch** — total equals the sum of that batch's deducted ledger rows at their recorded `costPerUnit`, which is the roadmap's second verification clause and is only meaningfully testable once the ledger exists.
- **Nutrition on completed batches**, computed from the closing snapshot's OG/FG (calories, carbohydrates), as new pure functions in `packages/calculations`.
- **Whether a currency label is added** (§4 Deviation 3), decided at that spec's halt gate.

---

> **HALT GATE (STATE 2) — re-presented 2026-08-16 after amendment.** This specification is **not** approved. The M9_P1 build already exists and is otherwise verification-clean at 39 of 41 criteria; the follow-up `/execute` pass is bounded to the four files of §1.4a and may not begin until the user replies with the literal string **SPEC_APPROVED**.
>
> **What changed in this amendment** (nothing else was touched; the 38 acceptance criteria that traced YES are byte-unchanged and no AC was renumbered):
> - **§1.4** — `apps/api/test/seed.test.ts` and `apps/web/test/Calculators.test.tsx` moved off the Untouched list into the bounded-exception table (now 5 files, was 3), each with exactly one permitted numeric edit and an explicit forbidden list. The New-files table drops the never-produced pre-exec manifest (now 15, was 16).
> - **§1.4a (new)** — the follow-up `/execute` pass is bounded to exactly four files.
> - **§2.3 point 4** — the shortfall's literal template loses to point 6's `format*` helpers, resolving the tension that produced the mixed-unit row.
> - **AC-37** — metric assertion retained at its corrected value (`Short 1.50 kg`), plus a new `us` companion and a no-mixed-units regression guard.
> - **AC-40** — extended to five permitted test-file edits, and "green" redefined as an explicitly asserted exit code.
> - **AC-41** — rewritten against evidence that exists, with the process correction for future phases recorded.
> - **§4** — Deviations 14 and 15 added; Deviation 8 updated.
>
> Questions the user should answer explicitly, because the executor cannot: **(a)** Is the substituted AC-41 evidence acceptable, or should AC-41 be recorded as permanently unsatisfiable for this phase (§4 Deviation 14)? **(b)** Is the P1/P2 split at "stock and shortfall" vs "checkoff, cost and nutrition" the right seam (§4 Deviation 1)? **(c)** Is exact normalized-name matching acceptable, knowing `Pale Ale Malt (2-Row)` will read "Not tracked" against an inventory row named `Pale Ale Malt` (§4 Deviation 5)? **(d)** Is a currency-free `costPerUnit` acceptable for now (§4 Deviation 3)?
>
> **Review this feature specification. Reply with SPEC_APPROVED to begin execution.**
