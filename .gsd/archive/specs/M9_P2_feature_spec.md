# FEATURE SPECIFICATION: M9_P2 — Check it off, and what did it cost

- **Milestone:** M9 (Inventory, checkoff and cost) — **closing phase**
- **Phase:** P2 of the two-phase split approved at M9_P1's halt gate (M9_P1 §4 Deviation 1). P1 = "what's in stock, and what am I short of". P2 = checkoff, the deduction ledger, reversal, cost rollup, nutrition.
- **Depends on:** **M9_P1** (the `inventory_items` table, `packages/calculations/src/inventory.ts`, `StockCheckPanel`, the `/api/inventory` surface — all shipped, 41/41 ACs, verification-clean 2026-08-16), M4_P1 (the frozen `batches.recipe_snapshot`), M5_P2 (`batches.closing_snapshot`, whose OG/FG the nutrition math reads), M7_P1/M7_P2 (`ConfigContext` and the `format*` helpers), M5.5_P1 (the shell).
- **Layer:** One new table + migration in `apps/api`, two new pure-logic modules in `packages/calculations`, new types in `packages/shared-types`, checkoff controls on an existing panel plus two new panels in `apps/web`. **A full vertical slice, not a storage layer.**
- **Verification threshold this phase is accountable for** (`.gsd/ROADMAP.md` Milestone 9): **all three clauses**, with clauses 1 and 2 discharged here for the first time.
  - *"Checking off a full grain bill deducts exactly the snapshot's amounts and un-checking restores them with no drift after repeated toggles"* — AC-5, AC-6, AC-33.
  - *"A completed batch's cost total equals the sum of its deducted line items at their recorded cost-per-unit"* — AC-14, AC-15, AC-38.
  - *"Batches created before this milestone still open and complete without inventory data"* — re-asserted, not inherited: AC-41, AC-49, AC-52.

---

## Phase Summary

M9_P1 shipped a stocked cupboard and an honest read-only answer to "what am I short of". It deliberately wrote nothing: `costPerUnit` is stored and displayed and never multiplied by anything, and no quantity moves as a side effect of anything (M9_P1 AC-16, AC-29). This phase closes the milestone by adding the write path, and by turning the numbers already on file into two answers a brewer actually wants.

1. **An append-only deduction ledger.** One new `inventory_transactions` table. Checking an ingredient off a batch's Planning stage appends one `deduction` row carrying the amount the batch's **frozen** `recipeSnapshot` requires, the unit, and the `costPerUnit` **as it stood at that instant**. Un-checking appends one `reversal` row pointing at it. Nothing is ever updated in place and nothing is ever deleted.
2. **Stock on hand becomes a derived number.** `inventory_items.quantity` stops being the live figure and becomes the **base** quantity — the amount the user typed into the form — and is never written by a checkoff. What the app shows as on hand is `base − Σ{open deductions}`. Because a reversal *removes a term from a sum* rather than *adding a compensating float back*, repeated toggling is not merely low-drift, it is **bit-exact**: AC-6 pins a concrete pair (`base 0.01`, `amount 0.03`) where the mutate-in-place alternative is provably wrong by `1.734723475976807e-18` after a single toggle and stays wrong forever.
3. **Checkoff controls on the panel P1 already built.** Every *comparable* `StockCheckPanel` line gains a checkbox. Unmatched ("Not tracked") and unit-mismatched lines are not checkable and render no control at all — the two "unknown" outcomes P1 spent Resolved Ambiguity 3 on do not acquire a write path.
4. **A cost breakdown on a completed batch.** The total is the sum of that batch's **open** deduction rows at **their own recorded** `costPerUnit`, in ledger order — so editing a price next month cannot retroactively rewrite what last month's beer cost. Rows whose `costPerUnit` was null at deduction are reported as uncosted, by count, never silently treated as free.
5. **Nutrition on a completed batch.** Calories, carbohydrates and alcohol, computed from the closing snapshot's OG/FG through the standard real-extract model, as new pure functions. Nothing is stored; a Completed batch with a null `closingSnapshot` (every pre-M5_P2 batch) says so rather than rendering a fabricated number.

What this phase deliberately does **not** do: it does not touch `inventory_items` (not one column — §1.2), it does not change `evaluateStock`, `requirementsFromRecipe`, `normalizeInventoryName`, `isOutOfStock`, `isNegativeStock` or `isValidInventoryUnit` (all byte-identical, AC-13), it does not widen `StockLine` (its 12-key surface is re-asserted, AC-13), it does not add a currency (§4 Deviation 3 — **still open, still needs sign-off**), and it does not touch `routes/batches.ts`.

---

## Key Behaviors

1. **The ledger is append-only in the strict sense.** There is no `UPDATE` and no `DELETE` against `inventory_transactions` anywhere in the codebase. Reversal is a second `INSERT`. AC-31 asserts the original deduction row is byte-identical after its reversal.
2. **A reversal is subtraction of a term, not addition of a compensator.** On-hand is `baseQuantity − Σ{amount : kind === 'deduction' AND unreversed}`. Reversing removes that row from the set. Toggling N times returns the *same* set and therefore the *same* IEEE-754 double (AC-5 asserts `Object.is`, not `toBeCloseTo`).
3. **`quantity` means base on write and on-hand on read.** `InventoryWriteInput.quantity` sets the base. Every read response carries `baseQuantity` (what was written), `deductedQuantity` (Σ open), `openDeductionCount`, and `quantity` **replaced by** the derived on-hand. This keeps every M9_P1 consumer — `evaluateStock`, `isOutOfStock`, `InventoryManager`'s flags — correct with **zero change to those functions**, and is the single most important consequence a reader must internalize (Resolved Ambiguity 2).
4. **Cost is frozen at deduction, per row.** `inventory_transactions.cost_per_unit` is copied from the item at the moment of the deduction and never rewritten. AC-26 changes the item's price after checkoff and asserts the breakdown is unmoved.
5. **Checkoff is a Planning-stage action, both directions.** Both `POST .../checkoff` and `POST .../checkoff/reverse` require `batch.status === 'Planning'`; anything else is `409 CHECKOFF_STAGE_INVALID`. A batch that has left Planning has a settled ledger — which is what makes the Completed-batch cost total stable (Resolved Ambiguity 5; §4 Deviation 5).
6. **Deleting an inventory item does not erase history.** `inventory_transactions` carries denormalized `category` / `display_name` / `name_key`, so a completed batch's cost breakdown still names the ingredient after its inventory row is gone (AC-40). This is why there is no FK and no cascade.
7. **Negative stock is still legal and still flagged.** Checking off 5.5 kg against 4.0 kg on hand succeeds and produces `-1.5 kg`. P1's `isOutOfStock`/`isNegativeStock` thresholds are inherited unchanged and now evaluate against the *derived* on-hand.
8. **Pre-M9 and pre-M5_P2 batches are unaffected.** A batch with no ledger rows has a cost breakdown of `{ lines: [], totalCost: 0, ... }` — a real zero, not an error and not a placeholder. A Completed batch with `closingSnapshot === null` renders an explicit "no closing snapshot recorded" message and **no** numbers.

---

## Resolved Ambiguities (Binding)

### 1. The reversal mechanism — a second row, and *exclusion from a sum*, never an inverse addition

The P1 preview said "append-only … and a reversal marker" without saying whether the marker is a mutable flag on the deduction row or a separate row, and without saying how on-hand recomposes. Both are pinned here, because the roadmap's *"no drift after repeated toggles"* clause is decided entirely by this choice.

- **A mutable `reversed` flag — rejected.** It is an `UPDATE` against a table this phase calls append-only. Two words in the same spec cannot mean opposite things.
- **On-hand as `base − Σdeductions + Σreversals` — rejected.** This is the inverse-addition model, and it is *not* exact. Computed, not assumed: with `base = 0.01` and `amount = 0.03`, `(0.01 − 0.03) + 0.03 === 0.010000000000000002`, which is `1.734723475976807e-18` away from `0.01` and never returns. `Object.is(result, 0.01)` is `false` after one toggle and after fifty. This is the exact failure mode the roadmap clause names.
- **On-hand as `base − Σ{open deductions}` — adopted.** A `deduction` row is **open** iff no `reversal` row exists whose `reversesTransactionId` equals its `id`. Reversing removes the term from the sum entirely. The set after `deduct → reverse` is empty, so on-hand is `base − 0`, which is `base` **bit-for-bit**. The set after `deduct → reverse → deduct` is a single-element set identical to the set after the first `deduct`, so that state is bit-for-bit identical too. The guarantee is structural, not tolerance-based.

**Binding summation rule.** `Σ{open deductions}` is a **left fold in ledger order** — `createdAt` ascending, then `id` ascending as the tie-break — with `0` as the seed. The order is pinned because float addition is not associative and an unordered sum is not a reproducible number. The same ordering rule governs the cost total (Resolved Ambiguity 6).

**Amounts are always stored as positive magnitudes.** `amount > STOCK_EPSILON` on every row of both kinds; the sign is carried by `kind`, never by the number. A `reversal` row copies `amount`, `unit`, `costPerUnit`, `category`, `displayName` and `nameKey` verbatim from the deduction it reverses, so a reversal row is self-describing without a join.

**At most one reversal per deduction, enforced by the database.** `UNIQUE INDEX inventory_transactions_reverses_uq ON (reverses_transaction_id)`. SQLite permits unlimited `NULL`s in a unique index, so this constrains reversal rows only and leaves deduction rows (which carry `NULL` there) unconstrained. A double-reverse is therefore structurally impossible, not merely guarded at the route.

### 2. `quantity` is the **base** on write and the **derived on-hand** on read — and `inventory_items` is not altered

The alternative is mutating `inventory_items.quantity` on every checkoff, which destroys Resolved Ambiguity 1's guarantee (it *is* the inverse-addition model, just spelled with SQL). So the column is never written by a checkoff, and the derived figure is produced at read time.

The projection is applied in the repository/route layer through one new pure function (§2.1), producing `InventoryStockView`:

| Key | Meaning |
|---|---|
| `baseQuantity` | exactly the number stored in `inventory_items.quantity` — exactly what the user typed |
| `deductedQuantity` | `Σ{open deductions for this item}`, `0` when there are none |
| `openDeductionCount` | integer count of open deduction rows for this item |
| `quantity` | **replaced** with `baseQuantity − deductedQuantity` |

**Binding consequences, each of which is an AC:**

- `InventoryItem` (the M9_P1 interface) is **not modified**. `InventoryStockView extends InventoryItem`, adding exactly three keys. Every existing consumer that reads `.quantity`, `.unit`, `.costPerUnit`, `.nameKey` etc. compiles and behaves unchanged.
- `evaluateStock`, `isOutOfStock` and `isNegativeStock` are **byte-identical** to their M9_P1 text (AC-13). They read `.quantity`; the projection has already made that the right number. **No P1 pure function is edited to make this phase work** — that is the design constraint this ambiguity was resolved to satisfy.
- With an empty ledger, `deductedQuantity === 0` and `quantity === baseQuantity` **by identity, not by rounding** — `x - 0` is exactly `x` for every finite double, including negatives and including `-0` handling (`0 - 0` is `0`, not `-0`, and the projection never produces `-0` from a positive base). So every M9_P1 acceptance criterion that round-trips a written quantity still passes unmodified (AC-4, AC-34).
- The `?outOfStock=true` filter now evaluates `isOutOfStock(onHand)`, **not** `isOutOfStock(base)`. A row with 4.0 kg base and a 5.5 kg open deduction is out of stock, and saying otherwise would be a lie. This is a deliberate behavior change to an M9_P1 endpoint (§4 Deviation 2).
- **`InventoryForm` edits `baseQuantity`, not `quantity`.** The form is currently seeded from `initial.quantity` (`InventoryForm.tsx:40`); it must be seeded from `initial.baseQuantity`. Seeding it from the derived on-hand and saving would silently subtract the open deductions a second time. AC-51.

### 3. Which lines are checkable — comparable only, and shortfall never blocks

`checkable === (line.matched && !line.unitMismatch)` — i.e. exactly M9_P1's `comparableCount` population. Binding table, and the fallback-retention rule for this phase:

| P1 line case | `checkable` | `checked` | `openTransactionId` | `checkedAmount` | `checkedCostPerUnit` | `checkedAt` | Control rendered |
|---|---|---|---|---|---|---|---|
| Comparable, not checked off | `true` | `false` | `null` | `null` | `null` | `null` | enabled checkbox, unchecked |
| Comparable, checked off | `true` | `true` | the id | the recorded amount | the recorded price (may be `null`) | the row's `createdAt` | enabled checkbox, checked |
| No inventory row (`matched: false`) | `false` | `false` | `null` | `null` | `null` | `null` | **no control at all** |
| Unit mismatch | `false` | `false` | `null` | `null` | `null` | `null` | **no control at all** |

**Binding caller rule (inherited and extended from M9_P1 Resolved Ambiguity 3):** a consumer must branch on `checkable` **before** reading `checked`, `openTransactionId`, `checkedAmount`, `checkedCostPerUnit` or `checkedAt`. Rendering a *disabled* checkbox for an unmatched line is **not** acceptable — a greyed control in the same visual slot reads as "checkable later", which "Not tracked" is not. The two unknown cases render their P1 status text and nothing else (AC-43).

**A shortfall does not block checkoff.** P1 established that negative stock is legal, flagged and never clamped. Requiring 5.5 kg against 4.0 kg on hand is a `201`, the on-hand becomes `-1.5`, and the row lights both the out-of-stock and negative-stock flags. Refusing the checkoff would mean a brewer who is mid-brew-day and short cannot record what they actually used.

### 4. Nutrition — the real-extract model, unclamped, per 100 mL with a 355 mL serving derived

The roadmap says "nutrition on completed batches" and the P1 preview says "calories, carbs from the closing snapshot's OG/FG". Binding definitions, in this exact order of operations (float order is pinned because the results below are pinned to full double precision):

```
OE  = sgToPlato(originalGravity)                          // the EXISTING packages/calculations/src/config.ts cubic
AE  = sgToPlato(finalGravity)
RE  = 0.1808 * OE + 0.8192 * AE                           // real extract, °P
ABW = (OE - RE) / (2.0665 - 0.010665 * OE)                // alcohol by weight, % w/w
caloriesPer100Ml  = (6.9 * ABW + 4.0 * (RE - 0.1)) * finalGravity
carbsGPer100Ml    = (RE - 0.1) * finalGravity
alcoholGPer100Ml  = ABW * finalGravity
<x>PerServing     = <x>Per100Ml * (NUTRITION_SERVING_ML / 100)   // NUTRITION_SERVING_ML = 355
```

- **`sgToPlato` is imported, never re-derived.** It already exists and is already re-exported from `packages/calculations/src/index.ts`. A second Plato conversion in this repository is a phase failure, on the M8 duplicated-formula precedent.
- **Nothing is clamped and nothing is rounded in the pure layer**, on the `ClosingSnapshot` precedent already in `packages/shared-types/src/batches.ts` (`abv` UNROUNDED; `apparentAttenuationPct` UNROUNDED, unclamped, may be negative; `carbonationForcePsi` UNCLAMPED, may be negative). A stuck fermentation with `FG > OG` yields a negative `abwPct` and a negative `alcoholGPer100Ml`, and the model reports them (AC-21). Rounding happens only at the display layer, to 0 decimals for calories and 1 decimal for grams.
- **Nutrition is computed, never stored.** No column is added to `batches`, no migration touches it, and `ClosingSnapshot` is not widened. A pre-M9 Completed batch therefore needs no backfill.
- **`nutritionFromClosingSnapshot(null)` returns `null`**, not a zeroed object. The UI branches on that null and renders an explicit message. A zeroed nutrition panel on a batch with no closing snapshot would read as "this beer has 0 calories", which is the same class of false-reassurance M9_P1 Resolved Ambiguity 3 exists to prevent.

### 5. Both checkoff and reversal require Planning; the ledger is settled thereafter

`POST /api/batches/:batchId/checkoff` and `POST /api/batches/:batchId/checkoff/reverse` both return `409 CHECKOFF_STAGE_INVALID` unless `batch.status === 'Planning'`. Consequences, stated plainly rather than discovered later:

- A batch advanced to Brewing carries its deductions forward permanently. That is the intent — the ingredients went into the kettle.
- A brewer who checked off the wrong thing and has already advanced cannot undo it from the batch. The correction path is an inventory edit (adjust `baseQuantity`), which is auditable in its own right via `updatedAt`.
- This is what makes clause 2 of the verification threshold stable: a Completed batch's cost total cannot move after the fact through either a price edit (Resolved Ambiguity 7) or a late reversal.

Flagged for sign-off as §4 Deviation 5 — permitting reversal in later stages is a one-predicate change if the user prefers it, but it must be decided now, not discovered.

### 6. Cost arithmetic — per-line product, left fold in ledger order, unrounded

```
lineCost   = costPerUnit === null ? null : amount * costPerUnit
totalCost  = open deduction rows, in ledger order (createdAt asc, then id asc),
             left-folded with `+` from a seed of 0, skipping rows whose lineCost is null
```

- **Only open deductions are costed.** A reversed deduction cost nothing — the ingredient went back on the shelf. Reversal rows themselves never appear as cost lines (AC-15).
- **A null `costPerUnit` is uncosted, never zero.** `lineCost` is `null`, the row still appears in `lines`, and it is counted in `uncostedLineCount` with `hasUncostedLines: true`. A total that silently swallowed unpriced ingredients would be understated with no signal (AC-16).
- **`totalCost` is unrounded in the API and in the pure layer**, on the repo-wide precedent. The pinned fixture total is `37.730000000000004`, and the panel renders `37.73` via a display-layer `toFixed(2)`. Both numbers are asserted (AC-14, AC-48) so that neither a rounding creeping into the model nor a raw float leaking into the UI can pass.
- **`totalCost` of an empty ledger is `0`**, a real number — not `null`, not `undefined`, not `NaN` (AC-17, AC-39).

### 7. The recorded price is frozen at the deduction, per row

`inventory_transactions.cost_per_unit` is written once from `inventory_items.cost_per_unit` as read in the same request that creates the deduction, and is never rewritten by anything. A subsequent `PUT /api/inventory/:id` that changes the price affects only future deductions. AC-26 asserts this against a concrete before/after.

The same applies to `amount`: it is read from `requirementsFromRecipe(batch.recipeSnapshot)` — the **frozen** snapshot, exactly as M9_P1's stock check does — and frozen onto the row. Editing the source recipe afterwards cannot move a deduction that has already happened.

### 8. Checkoff is addressed by `inventoryItemId`, not by line index or `nameKey`

The request body is `{ inventoryItemId: string }` and nothing else. The server resolves the item, derives its `(category, nameKey)`, finds the matching requirement in `requirementsFromRecipe(batch.recipeSnapshot)`, and rejects if there is none (`409 CHECKOFF_NOT_COMPARABLE`) or if the units differ (same code). Addressing by id rather than by list position means a concurrent inventory change cannot make the client's index point at a different ingredient.

### 9. `/api/batches/:batchId/stock-check` is preserved **unchanged**; the checkoff view is a new, separate endpoint

M9_P1 AC-16 pins `StockLine`'s key set to exactly 12 names, and M9_P1 AC-27 pins `/stock-check`'s response body. Both are contracts of a closed, verification-clean phase. This phase therefore:

- leaves `StockLine`, `StockEvaluation`, `evaluateStock` and `GET /api/batches/:batchId/stock-check` **byte-identical**, and re-asserts them as a regression (AC-13, AC-37);
- adds `StockCheckoffLine extends StockLine` (+6 keys), `BatchCheckoffState`, and `GET /api/batches/:batchId/checkoff` as the superset the UI consumes.

The cost is one endpoint with no UI caller. That is deliberate and is flagged as §4 Deviation 9 — the alternative (retire `/stock-check` and amend a closed phase's pinned ACs) trades a thin handler for a precedent that closed contracts are negotiable, which is a much worse trade. `/stock-check` remains independently tested and is the pure availability view; `/checkoff` composes it with the ledger.

### 10. Where the new routes are registered — `routes/inventory.ts`, again

All four new endpoints are registered inside `registerInventoryRoutes`. `apps/api/src/routes/batches.ts` stays byte-identical for the second consecutive phase (M9_P1 Resolved Ambiguity 8), and `server.ts` needs **no** new registration call at all this phase — `registerInventoryRoutes` is already wired. `server.ts` is on the Untouched list (§1.5), which is a strict improvement on P1's forced narrow exception.

---

## 1. Data Schema & Contracts

### 1.1 New exported constants and types

**`packages/shared-types/src/inventory.ts`** (existing M9_P1 module — **appended to**; not one existing declaration is edited):

```ts
export type InventoryTransactionKind = 'deduction' | 'reversal';

export interface InventoryTransaction {
  id: string;                          // SERVER-MINTED
  batchId: string;
  inventoryItemId: string;
  kind: InventoryTransactionKind;
  reversesTransactionId: string | null; // non-null IFF kind === 'reversal'
  category: InventoryCategory;          // denormalized; survives item deletion
  displayName: string;                  // denormalized; the item's `name` at deduction time
  nameKey: string;                      // denormalized
  amount: number;                       // POSITIVE magnitude, > STOCK_EPSILON. Sign is carried by `kind`.
  unit: InventoryUnit;
  costPerUnit: number | null;           // FROZEN at the deduction; never rewritten
  createdAt: string;                    // SERVER-MINTED ISO-8601 UTC
}

/** M9_P1's InventoryItem, plus the three ledger-derived keys. `quantity` is REPLACED with on-hand. */
export interface InventoryStockView extends InventoryItem {
  baseQuantity: number;        // exactly inventory_items.quantity
  deductedQuantity: number;    // sum of OPEN deductions; 0 when none
  openDeductionCount: number;  // integer >= 0
}

/** M9_P1's StockLine (12 keys, unchanged), plus exactly 6 checkoff keys. */
export interface StockCheckoffLine extends StockLine {
  checkable: boolean;                // matched && !unitMismatch
  checked: boolean;                  // false whenever !checkable
  openTransactionId: string | null;
  checkedAmount: number | null;
  checkedCostPerUnit: number | null;
  checkedAt: string | null;          // the open deduction row's createdAt
}

export interface BatchCheckoffState {
  lines: StockCheckoffLine[];
  requirementCount: number;
  matchedCount: number;
  comparableCount: number;
  unmatchedCount: number;
  unitMismatchCount: number;
  shortfallCount: number;   // computed against ON-HAND, i.e. post-ledger
  hasShortfall: boolean;
  checkableCount: number;   // === comparableCount, restated for the UI's benefit
  checkedCount: number;
  allCheckedOff: boolean;   // checkableCount > 0 && checkedCount === checkableCount
  stage: BatchStatus;
  editable: boolean;        // stage === 'Planning'
}

export interface BatchCostLine {
  transactionId: string;
  category: InventoryCategory;
  displayName: string;
  nameKey: string;
  amount: number;
  unit: InventoryUnit;
  costPerUnit: number | null;
  lineCost: number | null;  // null IFF costPerUnit is null
}

export interface BatchCostBreakdown {
  lines: BatchCostLine[];
  lineCount: number;
  costedLineCount: number;
  uncostedLineCount: number;
  hasUncostedLines: boolean;
  totalCost: number;        // UNROUNDED; 0 for an empty ledger
}

export interface BeerNutrition {
  originalPlato: number;
  apparentPlato: number;
  realExtractPlato: number;
  abwPct: number;              // UNCLAMPED; negative when FG > OG
  caloriesPer100Ml: number;
  carbsGPer100Ml: number;
  alcoholGPer100Ml: number;
  caloriesPerServing: number;
  carbsGPerServing: number;
  alcoholGPerServing: number;
}

/** The two checkoff request bodies. `inventoryItemId` is the ONLY client-writable field on either. */
export interface CheckoffWriteInput { inventoryItemId: string; }
```

`BatchStatus` is imported type-only from `./batches` (already a sibling module in the same package; no cycle).

**`packages/calculations/src/inventoryLedger.ts`** (new module):

```ts
export const LEDGER_KINDS: readonly InventoryTransactionKind[];   // ['deduction','reversal'], frozen
export const EMPTY_COST_BREAKDOWN: BatchCostBreakdown;            // frozen; lines: [], every count 0, totalCost 0
export const EMPTY_CHECKOFF_STATE: BatchCheckoffState;            // frozen; see §2.2 for the exact value
```

**`packages/calculations/src/nutrition.ts`** (new module):

```ts
export const NUTRITION_SERVING_ML = 355;
export const REAL_EXTRACT_OE_COEFF = 0.1808;
export const REAL_EXTRACT_AE_COEFF = 0.8192;
```
All other coefficients (`6.9`, `4.0`, `0.1`, `2.0665`, `0.010665`) stay module-private. **`packages/calculations/src/constants.ts` is not touched** — `packages/calculations/test/units.test.ts` asserts it exports exactly 15 names, and the module-private-constant precedent is `carbonation.ts` (M8_P1 Ambiguity 6, M9_P1 §2.4).

**`packages/shared-types/src/api.ts`** — `ApiErrorCode` gains exactly **four** members: `'CHECKOFF_ALREADY_OPEN'`, `'CHECKOFF_NOT_OPEN'`, `'CHECKOFF_NOT_COMPARABLE'`, `'CHECKOFF_STAGE_INVALID'`. All nine existing members (the eight pre-M9 codes plus `'INVENTORY_DUPLICATE'`) are unchanged (AC-42).

### 1.2 New table and migration

`apps/api/src/db/schema.ts` gains **one** table. **`inventoryItems` is not altered — not one column, not one index, not one default.** This satisfies the M8_P1→M8_P2 and M3_P1→M3_P2 precedent the planner was asked to check: the second phase is purely additive over the first phase's schema, with no migration back through it.

```
inventory_transactions
  id                      text PRIMARY KEY NOT NULL
  batch_id                text NOT NULL
  inventory_item_id       text NOT NULL
  kind                    text NOT NULL        -- enum enforced at the HTTP boundary (repo convention)
  reverses_transaction_id text                 -- nullable; non-null IFF kind = 'reversal'
  category                text NOT NULL
  display_name            text NOT NULL
  name_key                text NOT NULL
  amount                  real NOT NULL        -- positive magnitude
  unit                    text NOT NULL
  cost_per_unit           real                 -- nullable; frozen at deduction
  created_at              text NOT NULL

INDEX        inventory_transactions_batch_idx     ON (batch_id)
INDEX        inventory_transactions_item_idx      ON (inventory_item_id)
UNIQUE INDEX inventory_transactions_reverses_uq   ON (reverses_transaction_id)
```

12 columns. **No foreign keys** — deliberately, per Key Behavior 6 and M9_P1 Resolved Ambiguity 9's precedent: the denormalized `category`/`display_name`/`name_key` are what keep a closed batch's cost breakdown readable after its inventory row is deleted.

Migration file: `apps/api/drizzle/0012_inventory_transactions.sql`, journal entry `idx: 12, tag: "0012_inventory_transactions", version: "6", breakpoints: true` appended to `apps/api/drizzle/meta/_journal.json` (structural JSON edit only — hard rule 17). `CREATE TABLE IF NOT EXISTS` / `CREATE [UNIQUE] INDEX IF NOT EXISTS`, on the `0011_inventory.sql` precedent, so re-running is a no-op (AC-24). **No seed rows.**

This takes the migrated schema from 20 tables to **21**, which is the forced single-number edit to `apps/api/test/seed.test.ts` line 40 (§1.5).

### 1.3 REST surface

**New (4):**

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| `GET` | `/api/batches/:batchId/checkoff` | — | `200 BatchCheckoffState` | `404 NOT_FOUND` (unknown batch) |
| `POST` | `/api/batches/:batchId/checkoff` | `CheckoffWriteInput` | `201 BatchCheckoffState` | `400 VALIDATION_FAILED`, `404 NOT_FOUND`, `409 CHECKOFF_ALREADY_OPEN`, `409 CHECKOFF_NOT_COMPARABLE`, `409 CHECKOFF_STAGE_INVALID` |
| `POST` | `/api/batches/:batchId/checkoff/reverse` | `CheckoffWriteInput` | `201 BatchCheckoffState` | `400`, `404 NOT_FOUND`, `409 CHECKOFF_NOT_OPEN`, `409 CHECKOFF_STAGE_INVALID` |
| `GET` | `/api/batches/:batchId/cost` | — | `200 BatchCostBreakdown` | `404 NOT_FOUND` (unknown batch) |

Both `POST`s return the **full recomputed `BatchCheckoffState`**, not a bare transaction row. This is the lockstep contract (§2.3 point 4): the client never derives the new on-hand, the new shortfall or the new counts locally — one request, one authoritative new state, one render.

**Changed in behavior, unchanged in path/verb (3):**

| Method | Path | Change |
|---|---|---|
| `GET` | `/api/inventory[?category=&outOfStock=]` | returns `InventoryStockView[]` (three additive keys; `quantity` becomes on-hand). `outOfStock` now filters on **on-hand** (Resolved Ambiguity 2) |
| `POST` | `/api/inventory` | returns `InventoryStockView` (a fresh row always has `deductedQuantity 0`, `openDeductionCount 0`, `quantity === baseQuantity`) |
| `PUT` | `/api/inventory/:id` | body is still exactly `InventoryWriteInput` and `quantity` in the body still sets the **base**; the response is `InventoryStockView` |

**Unchanged, byte-identical, re-asserted (all M9_P1 paths not listed above):** `DELETE /api/inventory/:id` (still an unconditional `204`; ledger rows survive), and `GET /api/batches/:batchId/stock-check` (Resolved Ambiguity 9).

Request-body handling for both `POST` checkoff routes follows the M9_P1 precedent exactly: a `preValidation` hook against the **raw** body rejects any key other than `inventoryItemId` with `400 VALIDATION_FAILED` naming the key — **not** `additionalProperties: false`, which Fastify's repo-wide `removeAdditional: true` would turn into a silent strip.

### 1.4 Symbol inventory — pure function signatures

Full contracts are in §2.1. Summary of the new public surface:

| Module | New exported functions |
|---|---|
| `packages/calculations/src/inventoryLedger.ts` | `openDeductions`, `isReversed`, `sumOpenDeductions`, `projectInventoryStock`, `evaluateCheckoff`, `batchCostBreakdown` |
| `packages/calculations/src/nutrition.ts` | `realExtractPlato`, `alcoholByWeightPct`, `beerNutrition`, `nutritionFromClosingSnapshot` |

### 1.5 Symbol inventory — files

**New files (11):**

| File | Contents |
|---|---|
| `apps/api/drizzle/0012_inventory_transactions.sql` | the migration in §1.2 |
| `apps/api/src/repositories/inventoryTransactionRepository.ts` | `listTransactionsForBatch`, `listTransactionsForItems`, `listAllTransactions`, `insertTransaction`, `findTransactionById`, `rowToInventoryTransaction`. **Insert-and-select only — no `update` and no `delete` function exists in this file** (AC-31 companion source scan) |
| `apps/api/test/inventoryLedger.test.ts` | checkoff/reverse/cost endpoint ACs |
| `apps/api/test/inventoryLedger.migration.test.ts` | migration/idempotency/PRAGMA ACs |
| `packages/calculations/src/inventoryLedger.ts` | the ledger/checkoff/cost pure module (§2.1) |
| `packages/calculations/src/nutrition.ts` | the nutrition pure module (§2.1) |
| `packages/calculations/test/inventoryLedger.test.ts` | AC-1 … AC-18 |
| `packages/calculations/test/nutrition.test.ts` | AC-19 … AC-23 |
| `apps/web/src/components/BatchCostPanel.tsx` | the Completed-stage cost breakdown |
| `apps/web/src/components/BatchNutritionPanel.tsx` | the Completed-stage nutrition panel |
| `apps/web/test/BatchCostPanel.test.tsx` **/** `apps/web/test/BatchNutritionPanel.test.tsx` | AC-48, AC-49 *(two files; counted as one row)* |

*(File count for AC-53: **12** new files — the last row is two files.)*

**Modified files (9) — and the exact extent of each modification:**

| File | Permitted change | Forbidden |
|---|---|---|
| `apps/api/src/db/schema.ts` | append the `inventoryTransactions` table + its three indexes | any edit to `inventoryItems` or any other existing export |
| `apps/api/src/routes/schemas.ts` | append `checkoffWriteBodySchema` and the ledger-kind enum array (derived from `LEDGER_KINDS` by import, not retyped) | any edit to `inventoryWriteBodySchema` or any pre-existing schema |
| `apps/api/src/routes/inventory.ts` | register the four new endpoints; route `GET/POST/PUT /api/inventory` responses through `projectInventoryStock`; move the `outOfStock` filter onto on-hand | any change to the duplicate/validation/date logic, the `preValidation` hooks, `DELETE`'s behaviour, or `GET /api/batches/:batchId/stock-check`'s handler body |
| `apps/api/src/repositories/inventoryRepository.ts` | `listInventory`/`findInventoryById` gain a ledger-projection step and return `InventoryStockView`; the `outOfStock` filter evaluates on-hand | any change to `rowToInventoryItem`'s mapping of the 12 stored columns, to the `(category, nameKey)` ordering rule, or to the write functions' SQL |
| `apps/api/drizzle/meta/_journal.json` | append the `idx: 12` entry (structural JSON edit — hard rule 17) | editing or reordering entries 0–11 |
| `packages/shared-types/src/inventory.ts` | append the types in §1.1 | editing `InventoryItem`, `InventoryWriteInput`, `InventoryDuplicateDetails`, `StockRequirement`, `StockLine` or `StockEvaluation` |
| `packages/shared-types/src/api.ts` | add the four codes to `ApiErrorCode` | reordering or editing the nine existing members |
| `packages/calculations/src/index.ts` | two lines: `export * from './inventoryLedger'` and `export * from './nutrition'` | any change to the `./config` explicit-name block or to the existing `export *` lines |
| `apps/web/src/api/client.ts` | four new functions: `getBatchCheckoff`, `checkoffInventoryItem`, `reverseInventoryCheckoff`, `getBatchCost`; `listInventory`/`createInventoryItem`/`updateInventoryItem` return types widen to `InventoryStockView` | any change to an existing function's URL, method or body construction |
| `apps/web/src/components/StockCheckPanel.tsx` | switch the fetch to `GET /api/batches/:batchId/checkoff`; render checkboxes per §2.3; add the pending/error state | the four-branch order or the branch predicates of `statusTextFor`, the `Not tracked` / `Unit mismatch …` / `In stock` strings, `formatAmount`, the header string, the empty/error branches, or the `key`/`data-testid` expressions |
| `apps/web/src/components/InventoryManager.tsx` | display on-hand and, **only when `deductedQuantity > 0`**, the base and deducted figures alongside it | the filter controls, the request-building logic, the delete flow, or the out-of-stock/negative-stock flag predicates |
| `apps/web/src/components/InventoryForm.tsx` | **exactly one edit:** line 40's initial-state seed, `String(initial.quantity)` → `String(initial.baseQuantity)` | every other line, including the submit-body construction (AC-51 re-asserts M9_P1 AC-35's 8-key body) |
| `apps/web/src/pages/BatchDetail.tsx` | render `<BatchCostPanel batchId={batch.id} />` and `<BatchNutritionPanel closingSnapshot={batch.closingSnapshot} />` **iff** `batch.status === 'Completed'` | the existing `batch.status === 'Planning' && <StockCheckPanel …>` line, the form, the stepper wiring, the measured-vs-estimated panels, the carbonation panel, or any existing fetch |

*(13 rows; `PageContainer.tsx`/`TopBar.tsx` are not among them.)*

**Closed-phase test files modified (4) — extent strictly bounded:**

| File | Permitted change | Forbidden |
|---|---|---|
| `apps/api/test/seed.test.ts` | **exactly one edit:** line 40, `expect(tableNames.length).toBe(20)` → `.toBe(21)`. `0012_inventory_transactions.sql` adds the 21st table | every other line. The seeded-row-count assertions (`equipmentProfiles` 2, `catalogFermentables` 8, `catalogHops` 7, `catalogYeasts` 4, `catalogMiscs` 6, `recipes` 1, and the 3/4/1 line-item counts) must be byte-identical — this migration seeds **zero** rows. Adding an `inventory_transactions` row-count assertion is also forbidden |
| `apps/api/test/inventory.test.ts` | add `baseQuantity`/`deductedQuantity`/`openDeductionCount` to any assertion that enumerates a response's key set, if one exists | weakening, deleting or `.skip`-ing any assertion about duplicates, validation, dates, server-owned keys, ordering or filters |
| `apps/web/test/StockCheckPanel.test.tsx` | repoint the fetch mock from `/stock-check` to `/checkoff` and extend the mocked payload with the six `StockCheckoffLine` keys and the `BatchCheckoffState` counts | changing the AC-37 metric/US formatting assertions (`Short 1.50 kg`, `12.13 lb`/`8.82 lb`/`Short 3.31 lb`, `Short 0.16 oz`), the `Not tracked`/`In stock`/unit-mismatch strings, the empty/error-state assertions, or the mixed-unit regression guard |
| `apps/web/test/BatchDetail.test.tsx` | add `/checkoff` and `/cost` fetch mocks so Planning- and Completed-status cases resolve | changing any existing expectation about the batch form, stepper, readings, notes or measured values |

**Untouched — asserted by the §3 manifest guardrail (AC-53), not by inspection:**

- `apps/api/src/routes/`: `batches.ts`, `recipes.ts`, `equipment.ts`, `schedules.ts`, `waterProfiles.ts`, `config.ts`, `catalog.ts`, `health.ts`
- `apps/api/src/`: **`server.ts`** (no new registration call is needed — Resolved Ambiguity 10), `errors.ts`, `mappers/recipeMapper.ts`, `db/client.ts`, `db/migrate.ts`, `db/seed.ts`, `db/seedCli.ts`
- `apps/api/src/repositories/`: `batchRepository.ts`, `recipeRepository.ts`, `equipmentRepository.ts`, `scheduleRepository.ts`, `catalogRepository.ts`, `waterProfileRepository.ts`
- `apps/api/drizzle/0000_*.sql` … `0011_inventory.sql` (all twelve existing migrations, byte-identical)
- every existing file in `apps/api/test/` (26 files) **except** `seed.test.ts` and `inventory.test.ts` — in particular `stockCheck.test.ts`, `inventory.migration.test.ts`, `batches.test.ts`, `completion.test.ts`, `errors.test.ts`
- `packages/calculations/src/`: every module except `index.ts` — in particular **`inventory.ts`** (M9_P1's, byte-identical, AC-13), `constants.ts`, `units.ts`, `config.ts`, `brewingMath.ts`, `batchPipeline.ts`, `batchClosing.ts`, `fermentation.ts`, `carbonation.ts`, `mash.ts`, `hops.ts`, `yeast.ts`, `hydrometry.ts`, `gravityCorrection.ts`, `pressure.ts`, `water.ts`, `scaling.ts`, `chronology.ts`
- every existing file in `packages/calculations/test/` (20 files) — in particular **`inventory.test.ts`** (its 12-key `StockLine` assertion is the AC-13 regression) and `units.test.ts`'s "exactly 15 names in `constants.ts`"
- `packages/shared-types/src/`: `brewing.ts`, `batches.ts`, `misc.ts`, `schedules.ts`, `config.ts`, `index.ts` (`inventory.ts` is already re-exported by M9_P1)
- `apps/web/src/components/`: everything except `StockCheckPanel.tsx`, `InventoryManager.tsx`, `InventoryForm.tsx` — in particular **`Sidebar.tsx`** (no new nav destination this phase), the ten `calculators/*` components, `MeasuredComparison.tsx`, `CarbonationPanel.tsx`, `ReadingLog.tsx`, `BatchNoteLog.tsx`, `BatchStepper.tsx`, `SettingsManager.tsx`, `PageContainer.tsx`, `TopBar.tsx`
- `apps/web/src/`: **`App.tsx`** (no new route), `pages/BatchList.tsx`, `pages/Calculators.tsx`, `hooks/useRecipeEditor.ts`, `context/` (both files), `utils/srmColor.ts`
- every existing file in `apps/web/test/` except the two named above — in particular `Sidebar.test.tsx`, `App.test.tsx`, `Calculators.test.tsx`, `InventoryManager.test.tsx`, `InventoryForm.test.tsx` and `calculatorImportGraph.test.ts` remain **byte-identical** (this phase adds no nav item and no route, so none of P1's pinned counts move)
- `.gsd/ROADMAP.md`, `.gsd/HARD_RULES.md`, `.gsd/STATE.json` (owned by the orchestrating session), **`.gsd/BUGS.md`**, **`.gsd/FEATURES.md`** (AC-54), `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.agents/`
- root `package.json`, `tsconfig.base.json`, `apps/web/vite.config.ts`, `oxlint` config

### 1.6 Refactoring & legacy cleanup

There is no legacy checkoff code — this is greenfield on top of a clean P1. The cleanup obligations are negative and are enumerated so their absence is checkable:

- **No `UPDATE` and no `DELETE` against `inventory_transactions`, anywhere.** A source scan over `apps/api/src/` asserts the string `inventoryTransactions` never appears as the argument of `db.update(` or `db.delete(` (AC-31).
- **No second normalization helper.** `normalizeInventoryName` keeps exactly one definition. The ledger's `name_key` is written from it, not from an inline `.trim().toLowerCase()`.
- **No second Plato conversion.** `nutrition.ts` imports `sgToPlato` from `./config`; a source scan asserts the coefficients `-668.96`/`1262.45`/`-776.43`/`182.94` appear nowhere in `nutrition.ts` (AC-23).
- **No parallel on-hand computation.** `baseQuantity − deductedQuantity` is computed in exactly one place, `projectInventoryStock`. A source scan asserts no other module in `apps/api/src/` or `apps/web/src/` subtracts a `deductedQuantity` from a `baseQuantity` (AC-34).
- **No widening of `batches`, `Batch`, `BatchWriteInput`, `BatchWithReadings` or `ClosingSnapshot`.** Not one column, not one field. Cost and nutrition are computed, never stored — which is precisely why a pre-M9 batch needs no migration and no backfill.
- **No obsolete registration loop or legacy alias to purge.** `registerInventoryRoutes` is already wired in `server.ts` from M9_P1 and takes no new call site; the `View`/`NavDestination`/`NAV_ITEMS` triple is untouched because this phase adds no destination.

---

## 2. Transformations & Pure Logic

### 2.1 Pure function contracts

**`packages/calculations/src/inventoryLedger.ts`** — no I/O, no randomness, no wall-clock reads. Every function is total and never throws.

```ts
function isReversed(
  transactionId: string,
  ledger: readonly InventoryTransaction[],
): boolean;
// true iff some row has kind === 'reversal' AND reversesTransactionId === transactionId.

function openDeductions(
  ledger: readonly InventoryTransaction[],
): InventoryTransaction[];
// Rows with kind === 'deduction' and !isReversed(row.id, ledger), in LEDGER ORDER
// (createdAt asc, then id asc). Returns a new array; never mutates `ledger`.
// Returns [] for an empty ledger and for a ledger of reversals only.

function sumOpenDeductions(
  ledger: readonly InventoryTransaction[],
): number;
// LEFT FOLD with `+` over openDeductions(ledger).map(r => r.amount), seed 0.
// The order and the seed are BINDING — float addition is not associative.
// Returns exactly 0 (not -0, not NaN) for an empty input.

function projectInventoryStock(
  items: readonly InventoryItem[],
  ledger: readonly InventoryTransaction[],
): InventoryStockView[];
// One O(n) index over `ledger` keyed by inventoryItemId, built ONCE.
// Per item: baseQuantity = item.quantity; deductedQuantity = sumOpenDeductions(rows for that item);
// openDeductionCount = that row count; quantity = baseQuantity - deductedQuantity.
// Item order is PRESERVED exactly as given (the repository has already sorted).
// Ledger rows referencing an unknown inventoryItemId are IGNORED (they belong to a deleted
// item and cannot affect any surviving row). Never mutates either argument.
// With an empty ledger, every output is deep-equal to its input plus {baseQuantity: q,
// deductedQuantity: 0, openDeductionCount: 0} and `quantity` is Object.is-identical to the input's.

function evaluateCheckoff(
  evaluation: StockEvaluation,
  ledger: readonly InventoryTransaction[],
  stage: BatchStatus,
): BatchCheckoffState;
// `evaluation` is the OUTPUT of M9_P1's evaluateStock, computed against ALREADY-PROJECTED
// inventory — so its onHand/shortfall/sufficient are post-ledger. This function adds only
// the six checkoff keys and the four checkoff counters; it never recomputes a shortfall.
// Per line: checkable = line.matched && !line.unitMismatch. When !checkable, ALL SIX keys take
// their null/false values (§Resolved Ambiguity 3 table) regardless of ledger contents.
// When checkable, the open deduction is looked up by line.inventoryItemId.
// stage/editable are copied through; editable = (stage === 'Planning').
// Never mutates `evaluation` (including its `lines` array or any line object) or `ledger`.

function batchCostBreakdown(
  ledger: readonly InventoryTransaction[],
): BatchCostBreakdown;
// `ledger` is ALREADY filtered to one batch by the caller (the repository query).
// Lines are openDeductions(ledger) mapped 1:1, in LEDGER ORDER. Reversal rows and reversed
// deductions never appear. lineCost = costPerUnit === null ? null : amount * costPerUnit.
// totalCost = LEFT FOLD with `+` over the non-null lineCosts in that same order, seed 0.
// Returns a value deep-equal to EMPTY_COST_BREAKDOWN for an empty input. Never mutates.
```

**`packages/calculations/src/nutrition.ts`**:

```ts
function realExtractPlato(originalPlato: number, apparentPlato: number): number;
// REAL_EXTRACT_OE_COEFF * originalPlato + REAL_EXTRACT_AE_COEFF * apparentPlato. In that term order.

function alcoholByWeightPct(originalPlato: number, realExtract: number): number;
// (originalPlato - realExtract) / (2.0665 - 0.010665 * originalPlato). UNCLAMPED; may be negative.

function beerNutrition(originalGravity: number, finalGravity: number): BeerNutrition;
// Exactly the operation order pinned in Resolved Ambiguity 4. sgToPlato is IMPORTED from
// './config' — never re-derived. Nothing is clamped, nothing is rounded. Never throws.

function nutritionFromClosingSnapshot(snapshot: ClosingSnapshot | null): BeerNutrition | null;
// null in, null out. Otherwise beerNutrition(snapshot.originalGravity, snapshot.finalGravity).
// Returns null — NEVER a zeroed BeerNutrition (Resolved Ambiguity 4).
```

`InventoryItem`, `InventoryTransaction`, `StockEvaluation`, `BatchStatus` and `ClosingSnapshot` are imported **type-only** from `@truchabrew/shared-types`, which imports nothing from `@truchabrew/calculations` — no cycle.

### 2.2 No-match / fallback / degenerate contracts

Restated as binding, because these are where a placeholder leaks into rendered state:

- `EMPTY_CHECKOFF_STATE` is `{ lines: [], requirementCount: 0, matchedCount: 0, comparableCount: 0, unmatchedCount: 0, unitMismatchCount: 0, shortfallCount: 0, hasShortfall: false, checkableCount: 0, checkedCount: 0, allCheckedOff: false, stage: 'Planning', editable: true }`, frozen. **`allCheckedOff` is `false` when `checkableCount === 0`** — "nothing to check off" is not "everything is checked off", and rendering a success state for an empty recipe is the exact false-reassurance this clause exists to prevent (AC-11).
- `evaluateCheckoff(evaluationWithLines, [], stage)` returns every line `checked: false`, all six checkoff keys at their null/false values, `checkedCount: 0`, `allCheckedOff: false`. An empty ledger is "nothing checked off yet", never an error and never a partial state.
- A **non-checkable** line's six checkoff keys are `false`/`null` **even if the ledger somehow contains an open deduction naming its `inventoryItemId`** — the branch on `checkable` comes first and is unconditional. This is the defensive half of Resolved Ambiguity 3 (AC-9).
- `batchCostBreakdown([])` and `batchCostBreakdown(reversalsOnly)` both return `EMPTY_COST_BREAKDOWN`-equal values with `totalCost === 0`, never `null` and never `NaN`.
- `nutritionFromClosingSnapshot(null)` returns `null`. **A caller must branch on that null before reading any field.** Rendering `nutrition?.caloriesPerServing ?? 0` is a defect, not a styling choice (AC-49).
- `projectInventoryStock(items, [])` never changes a `quantity` by even one ULP: `Object.is(out.quantity, item.quantity)` for every item, including negative and zero bases (AC-4).

### 2.3 Stateful integration contract — `StockCheckPanel` (checkoff), and the two Completed-stage panels

**`StockCheckPanel`** (modified; mount gate in `BatchDetail` unchanged — `batch.status === 'Planning'`, AC-47):

1. On mount and on `batchId` change, the panel issues exactly **one** `GET /api/batches/:batchId/checkoff`. It never polls and never re-fetches on an unrelated `BatchDetail` re-render. `GET /stock-check` is no longer called by any component.
2. Loading and error states are unchanged from M9_P1 (`stock-check-loading`, `stock-check-error` test ids retained). Neither renders a line list, a count, a checkbox, or a zero.
3. A line renders its checkbox **iff `line.checkable`**. A non-checkable line renders **no control element at all** — not a disabled one (Resolved Ambiguity 3). The checkbox's `disabled` attribute is `true` iff `!state.editable` (batch past Planning) or a toggle is in flight.
4. **Lockstep, binding.** Toggling a checkbox issues exactly one `POST /api/batches/:batchId/checkoff` (when currently unchecked) or one `POST /api/batches/:batchId/checkoff/reverse` (when currently checked), body `{ inventoryItemId: line.inventoryItemId }`. The response **is** the new `BatchCheckoffState` and **replaces** the panel's state wholesale in a single `setState`. The panel **never** locally decrements an on-hand, recomputes a shortfall, flips a `checked` flag optimistically, or issues a follow-up `GET`. One click → one request → one authoritative state → one render. Consequently the row's `Required:`/`On hand:`/status text and its checkbox always agree, because they came from the same response.
5. **Failure never leaves phantom state.** A rejected toggle renders the `ApiClientError` message inline and leaves the previous state **byte-identical** — the checkbox returns to its pre-click position, no count moves, and no line's on-hand changes (AC-46).
6. While a toggle is in flight, **every** checkbox on the panel is disabled. Two concurrent toggles could otherwise interleave two full-state responses and land the panel on the older one.
7. Amount rendering is unchanged: every numeric amount still goes through `formatAmount` → the M7 `format*` helpers keyed off `useConfig().config`. The checkoff work adds no new numeric string to a row (AC-45's assertions are the M9_P1 AC-37 strings, re-asserted post-toggle).
8. The panel writes nothing to `ConfigContext` or `CatalogContext` and holds no state that outlives the batch route.

**`BatchCostPanel`** (new):

1. `BatchDetail` mounts it **only when `batch.status === 'Completed'`**. In the other four statuses it is not mounted, so no request is issued (AC-48).
2. One `GET /api/batches/:batchId/cost` per mount/`batchId` change. Read-only; zero writes.
3. `lineCount === 0` renders **"No ingredients were checked off for this batch."** with no line rows and **no total** — a zero total on a batch nobody checked off would read as "this beer was free".
4. `lineCost === null` renders **"Not priced"** in the cost column. Never `—` in the same slot as a real cost, never `0.00`. When `hasUncostedLines`, a panel-level note names the count.
5. `totalCost` renders `toFixed(2)`. Amounts render through `formatAmount` (the same helper `StockCheckPanel` uses), so a `us`-configured user sees `lb`/`oz`. Costs carry **no currency symbol** (§4 Deviation 3).

**`BatchNutritionPanel`** (new):

1. Mounted **only when `batch.status === 'Completed'`**. Takes `closingSnapshot: ClosingSnapshot | null` as a prop — it issues **no request at all**, because everything it needs is already on the batch object `BatchDetail` has loaded.
2. `closingSnapshot === null` renders **"No closing snapshot recorded for this batch — nutrition is unavailable."** and **no numbers** (AC-49). This is the pre-M5_P2/pre-M9 batch path.
3. Otherwise renders `nutritionFromClosingSnapshot(closingSnapshot)`: calories `toFixed(0)`, grams `toFixed(1)`, per `NUTRITION_SERVING_ML` mL with the per-100 mL figures shown alongside. `abwPct` renders with its sign preserved — a negative value is displayed as negative, not suppressed.
4. Holds no state, issues no request, writes nothing.

---

## 3. Acceptance Criteria & Test Matrix

**Shared ledger fixture (binding; used by AC-8 … AC-18, AC-33, AC-38, AC-45).** M9_P1's inventory fixture is reused **verbatim**:

| id | category | name | nameKey | base quantity | unit | costPerUnit |
|---|---|---|---|---|---|---|
| `inv-1` | Fermentable | `Pale Ale Malt` | `pale ale malt` | `4.0` | `kg` | `3.20` |
| `inv-2` | Fermentable | `Munich Malt` | `munich malt` | `0.0` | `kg` | `4.10` |
| `inv-3` | Hop | `Citra` | `citra` | `50` | `g` | `0.09` |
| `inv-4` | Yeast | `SafAle US-05` | `safale us-05` | `2` | `pkg` | `4.50` |
| `inv-5` | Misc | `Gypsum` | `gypsum` | `-0.5` | `g` | `0.02` |
| `inv-6` | Misc | `Lactic Acid` | `lactic acid` | `100` | `g` | `0.03` |
| `inv-7` | Fermentable | `Flaked Oats` | `flaked oats` | `1.0` | `kg` | `null` |

Recipe snapshot line items (M9_P1's, verbatim): fermentables `Pale Ale Malt 3.0 kg`, `PALE ALE  MALT 2.5 kg`, `Munich Malt 0.5 kg`; hops `Citra 50 g`; yeasts `SafAle US-05 3 pkg`; miscs `Gypsum 4 g`, `Whirlfloc 1 each`, `Lactic Acid 2 ml`. → **7 requirements; 5 comparable/checkable (`inv-1`..`inv-5`); 1 unmatched (`whirlfloc`); 1 unit-mismatched (`lactic acid`); `inv-7` has no requirement.**

**`COST_FIXTURE`** = the above plus one appended fermentable line `Flaked Oats 0.5 kg` (→ 8 requirements, 6 checkable), used only by AC-16 to exercise the null-price path.

**Full-checkoff ledger** (all 5 checkable items, in this creation order): `inv-1` 5.5 kg @ 3.20, `inv-2` 0.5 kg @ 4.10, `inv-3` 50 g @ 0.09, `inv-4` 3 pkg @ 4.50, `inv-5` 4 g @ 0.02.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | Ledger constant exports | Unit | `NUTRITION_SERVING_ML === 355`; `REAL_EXTRACT_OE_COEFF === 0.1808`; `REAL_EXTRACT_AE_COEFF === 0.8192`; `LEDGER_KINDS` deep-equals `['deduction','reversal']`; `EMPTY_COST_BREAKDOWN` deep-equals `{lines:[],lineCount:0,costedLineCount:0,uncostedLineCount:0,hasUncostedLines:false,totalCost:0}`; `EMPTY_CHECKOFF_STATE` deep-equals the §2.2 value; `Object.isFrozen` → `true` for all three objects |
| AC-2 | `isReversed` / `openDeductions` | Unit | Ledger `[d1, d2, r(d1)]` → `isReversed('d1')` `true`, `isReversed('d2')` `false`; `openDeductions` returns exactly `[d2]`; a ledger of reversals only → `[]`; `[]` → `[]`; the input array and every row object are deep-equal to pre-call clones |
| AC-3 | `sumOpenDeductions` order and seed | Unit | Open amounts `[5.5, 0.5, 50, 3, 4]` in ledger order → `63`; `[]` → `0` with `Object.is(result, 0)` (not `-0`); a ledger whose only deduction is reversed → `0` |
| AC-4 | `projectInventoryStock` with an empty ledger is identity on `quantity` (degenerate) | Unit | For all 7 fixture items: `Object.is(out.quantity, item.quantity)`, `out.baseQuantity === item.quantity`, `out.deductedQuantity === 0`, `out.openDeductionCount === 0`; `inv-5`'s `-0.5` stays exactly `-0.5`; `inv-2`'s `0` stays exactly `0` and is not `-0`; item order is preserved; both arguments deep-equal pre-call clones |
| AC-5 | **No drift after repeated toggles — bit-exact** (roadmap clause 1) | Unit | With `inv-1` (base `4.0`) and a 5.5 kg deduction: after 50 `deduct → reverse` cycles modelled as ledger appends, the projected `quantity` in the deducted state is `Object.is(q, -1.5)` **every single time** and in the restored state is `Object.is(q, 4.0)` **every single time**. Asserted with `Object.is`, **not** `toBeCloseTo`. The final ledger has exactly 100 rows (50 deductions + 50 reversals) and `openDeductions` is `[]` |
| AC-6 | The rejected inverse-addition model is provably wrong (pinned counterexample) | Unit | With `base = 0.01` and `amount = 0.03`: `(base - amount) + amount` evaluates to `0.010000000000000002` and `Object.is(that, 0.01)` is `false`, differing by `1.734723475976807e-18`, and repeating the cycle 50 times leaves it at that same wrong value. The **adopted** model — `base - sumOpenDeductions(ledgerWithNoOpenRows)` — returns a value satisfying `Object.is(q, 0.01)` after the same 50 cycles. Both halves asserted in one test, so the design cannot be silently swapped |
| AC-7 | Projection with a partial ledger, and orphaned rows | Unit | Open deductions `inv-1: 5.5` and `inv-3: 50` → `inv-1` `{baseQuantity 4.0, deductedQuantity 5.5, quantity -1.5, openDeductionCount 1}`, `inv-3` `{baseQuantity 50, deductedQuantity 50, quantity 0, openDeductionCount 1}`, `inv-2` untouched at `0`; `isOutOfStock(inv-1.quantity)` `true` and `isNegativeStock(inv-1.quantity)` `true`; `isOutOfStock(inv-3.quantity)` `true` and `isNegativeStock(inv-3.quantity)` `false`; a ledger row naming `inv-99` (deleted item) is ignored and changes no output |
| AC-8 | `evaluateCheckoff` line contract | Unit | With the full-checkoff ledger: `Object.keys(line).sort()` deep-equals the **18**-key list `['category','checkable','checkedAmount','checkedAt','checkedCostPerUnit','checked','displayName','inventoryItemId','inventoryUnit','matched','nameKey','onHand','openTransactionId','requiredAmount','shortfall','sufficient','unit','unitMismatch']`; the `pale ale malt` line has `checkable true`, `checked true`, `openTransactionId` the deduction's id, `checkedAmount 5.5`, `checkedCostPerUnit 3.2`, `checkedAt` the row's `createdAt` |
| AC-9 | Non-checkable lines are inert, defensively (fallback retention) | Unit | `whirlfloc` (`matched:false`) and `lactic acid` (`unitMismatch:true`) both have `checkable false`, `checked false`, `openTransactionId null`, `checkedAmount null`, `checkedCostPerUnit null`, `checkedAt null` — **and this holds even when the ledger is doctored to contain an open deduction naming those lines' `inventoryItemId`**, proving the `checkable` branch is unconditional and comes first |
| AC-10 | `evaluateCheckoff` counters | Unit | Full-checkoff ledger, `stage:'Planning'` → `requirementCount 7`, `matchedCount 6`, `comparableCount 5`, `unmatchedCount 1`, `unitMismatchCount 1`, `checkableCount 5`, `checkedCount 5`, `allCheckedOff true`, `editable true`. With only `inv-1` checked off → `checkedCount 1`, `allCheckedOff false`. With `stage:'Brewing'` → `editable false` and every other counter unchanged |
| AC-11 | Degenerate checkoff states | Unit | `evaluateCheckoff(EMPTY_STOCK_EVALUATION, [], 'Planning')` deep-equals `EMPTY_CHECKOFF_STATE`, and in particular **`allCheckedOff === false`** despite `checkedCount === checkableCount === 0`; `evaluateCheckoff(fixtureEvaluation, [], 'Planning')` → 7 lines, all `checked false`, `checkedCount 0`, `allCheckedOff false` |
| AC-12 | Purity of every new pure function | Unit | `openDeductions`, `sumOpenDeductions`, `projectInventoryStock`, `evaluateCheckoff`, `batchCostBreakdown`, `beerNutrition` and `nutritionFromClosingSnapshot` each leave every argument (including nested arrays and objects) deep-equal to a pre-call structured clone; none reads `Date.now`/`Math.random` (source scan asserts zero occurrences in both new modules) |
| AC-13 | **M9_P1 contracts are byte-identical** (regression) | Unit | `packages/calculations/src/inventory.ts` is byte-identical to its pre-phase content (manifest hash, AC-53); `Object.keys(stockLine).sort()` still deep-equals M9_P1's **12**-key list; `evaluateStock`, `requirementsFromRecipe`, `normalizeInventoryName`, `isOutOfStock`, `isNegativeStock`, `isValidInventoryUnit`, `STOCK_EPSILON`, `INVENTORY_CATEGORIES`, `CANONICAL_INVENTORY_UNIT`, `MISC_INVENTORY_UNITS`, `EMPTY_STOCK_EVALUATION` all still exported with unchanged behaviour; `packages/calculations/test/inventory.test.ts` passes unmodified |
| AC-14 | **Cost total** (roadmap clause 2) | Unit | `batchCostBreakdown(fullCheckoffLedger)` → `lines` of length 5 in ledger order with `lineCost` `[17.6, 2.05, 4.5, 13.5, 0.08]`; `totalCost === 37.730000000000004` (**strict equality**, the unrounded left fold in ledger order); `totalCost.toFixed(2) === '37.73'`; `lineCount 5`, `costedLineCount 5`, `uncostedLineCount 0`, `hasUncostedLines false` |
| AC-15 | Reversed deductions cost nothing | Unit | Reversing the `inv-4` deduction (13.5) → `lines` of length 4, `totalCost === 24.23` — **strict equality**; the left fold `((((0 + 17.6) + 2.05) + 4.5) + 0.08)` lands exactly on the double nearest `24.23`, verified by the planner rather than assumed, which is why this fixture's total is an exact literal while AC-14's is not — `lineCount 4`; **no reversal row appears in `lines`** (assert no line's `transactionId` equals a reversal row's id) |
| AC-16 | Null price is uncosted, never zero | Unit | `COST_FIXTURE` ledger of exactly two deductions — `inv-1` 5.5 kg @ 3.20 and `inv-7` 0.5 kg @ `null` — → `lines[1].costPerUnit null`, `lines[1].lineCost null` (**not `0`**); `totalCost === 17.6`; `lineCount 2`, `costedLineCount 1`, `uncostedLineCount 1`, `hasUncostedLines true` |
| AC-17 | Empty and reversals-only breakdowns (degenerate) | Unit | `batchCostBreakdown([])` deep-equals `EMPTY_COST_BREAKDOWN`; a ledger whose every deduction is reversed → the same, with `totalCost === 0` and `Number.isNaN(totalCost) === false` |
| AC-18 | Cost line order is ledger order, deterministic | Unit | Two ledgers containing the same five rows in different array order but identical `createdAt`/`id` values produce **deep-equal** breakdowns, including an identical `totalCost` bit pattern; two rows sharing a `createdAt` are ordered by `id` ascending |
| AC-19 | Nutrition reference values (primary) | Unit | `beerNutrition(1.050, 1.010)` → `originalPlato` `toBeCloseTo(12.374342499999955, 10)`; `apparentPlato` `toBeCloseTo(2.5615219399998637, 10)`; `realExtractPlato` `toBeCloseTo(4.33567989724788, 10)`; `abwPct` `toBeCloseTo(4.155361985022483, 10)`; `caloriesPer100Ml` `toBeCloseTo(46.07086445850313, 10)`; `carbsGPer100Ml` `toBeCloseTo(4.27803669622036, 10)`; `alcoholGPer100Ml` `toBeCloseTo(4.196915604872708, 10)` |
| AC-20 | Nutrition reference values (two more points) | Unit | `beerNutrition(1.060, 1.012)` → `caloriesPer100Ml` `toBeCloseTo(55.46678695643077, 10)`, `carbsGPer100Ml` `toBeCloseTo(5.136822806439016, 10)`, `abwPct` `toBeCloseTo(5.000787038247508, 10)`. `beerNutrition(1.040, 1.010)` → `caloriesPer100Ml` `toBeCloseTo(36.985560347897504, 10)`, `carbsGPer100Ml` `toBeCloseTo(3.8415286448536565, 10)`, `abwPct` `toBeCloseTo(3.102230702896094, 10)` |
| AC-21 | Nutrition is unclamped at and past the degenerate boundary | Unit | `beerNutrition(1.050, 1.050)` (zero attenuation) → `abwPct === 0` exactly, `alcoholGPer100Ml === 0`, `caloriesPer100Ml` `toBeCloseTo(51.55223849999982, 10)`, `carbsGPer100Ml` `toBeCloseTo(12.888059624999954, 10)`. `beerNutrition(1.050, 1.060)` (FG > OG) → `abwPct` `toBeCloseTo(-0.995296435422155, 10)` — **negative, not clamped to 0** — and `alcoholGPer100Ml` `toBeCloseTo(-1.0550142215474843, 10)` |
| AC-22 | Serving figures are the per-100 mL figures scaled by 3.55 | Unit | For `beerNutrition(1.050, 1.010)`: `caloriesPerServing` `toBeCloseTo(163.5515688276861, 9)`, `carbsGPerServing` `toBeCloseTo(15.187030271582277, 9)`, `alcoholGPerServing` `toBeCloseTo(14.899050397298113, 9)`; and for each of the three pairs, `perServing === per100Ml * (NUTRITION_SERVING_ML / 100)` by strict equality |
| AC-23 | `nutritionFromClosingSnapshot`, and no second Plato conversion | Unit | `nutritionFromClosingSnapshot(null)` returns **`null`** (`toBeNull`, not a zeroed object); given a snapshot with `originalGravity 1.050`/`finalGravity 1.010` it deep-equals `beerNutrition(1.050, 1.010)`; a source scan of `packages/calculations/src/nutrition.ts` finds zero occurrences of `-668.96`, `1262.45`, `-776.43` and `182.94`, and at least one `import` of `sgToPlato` |
| AC-24 | Migration applies and is idempotent | Integration | On a fresh DB, `runMigrations` twice → no error; `PRAGMA table_info(inventory_transactions)` returns exactly the 12 columns of §1.2 with the pinned types/notnull; `PRAGMA index_list` contains `inventory_transactions_batch_idx`, `inventory_transactions_item_idx`, and `inventory_transactions_reverses_uq` with `unique=1`; **`PRAGMA table_info(inventory_items)` is unchanged from M9_P1's 12 columns**; the migrated table count is 21 and every pre-existing table name is still present |
| AC-25 | Checkoff creates one deduction with server-minted fields | Integration | `POST /api/batches/:id/checkoff` `{inventoryItemId:'inv-1'}` on a Planning batch → `201`; exactly one new `inventory_transactions` row with `kind 'deduction'`, `reverses_transaction_id NULL`, `amount 5.5`, `unit 'kg'`, `cost_per_unit 3.2`, `category 'Fermentable'`, `display_name 'Pale Ale Malt'`, `name_key 'pale ale malt'`, non-empty `id`, `created_at` a valid ISO-8601 instant; a body containing `id`, `amount`, `costPerUnit`, `createdAt` or `kind` → `400 VALIDATION_FAILED` naming that key (four separate cases, keys rejected not stripped); `inventory_items.quantity` for `inv-1` is still exactly `4.0` in the database |
| AC-26 | The recorded price is frozen at the deduction | Integration | After checking off `inv-1` at `costPerUnit 3.20`, `PUT /api/inventory/inv-1` with `costPerUnit: 9.99` → `200`; `GET /api/batches/:id/cost` still reports that line's `costPerUnit 3.2` and `lineCost 17.6`, and `totalCost` is unmoved; the ledger row's `cost_per_unit` column is still `3.2` |
| AC-27 | Double checkoff rejected | Integration | A second `POST .../checkoff` for the same `inventoryItemId` on the same batch → `409` code `CHECKOFF_ALREADY_OPEN`; the ledger row count is unchanged; the same `inventoryItemId` on a **different** Planning batch → `201` |
| AC-28 | Non-comparable checkoff rejected | Integration | `POST .../checkoff` for `inv-6` (`lactic acid`, unit mismatch) → `409 CHECKOFF_NOT_COMPARABLE`; for `inv-7` (`flaked oats`, no requirement in the base fixture recipe) → `409 CHECKOFF_NOT_COMPARABLE`; both leave the ledger row count unchanged |
| AC-29 | Stage gate, both directions | Integration | On a batch in each of `['Brewing','Fermenting','Conditioning','Completed']`: `POST .../checkoff` → `409 CHECKOFF_STAGE_INVALID` and `POST .../checkoff/reverse` → `409 CHECKOFF_STAGE_INVALID`; the ledger row count is unchanged in all eight cases |
| AC-30 | Unknown ids | Integration | `POST .../checkoff` with an unknown `batchId` → `404 NOT_FOUND`; with an unknown `inventoryItemId` → `404 NOT_FOUND`; `GET /api/batches/unknown/checkoff` → `404`; `GET /api/batches/unknown/cost` → `404` |
| AC-31 | Reversal is append-only | Integration | `POST .../checkoff/reverse` `{inventoryItemId:'inv-1'}` → `201`; the **original deduction row is byte-identical** (all 12 columns re-read and compared); exactly one new row with `kind 'reversal'`, `reverses_transaction_id` = the deduction's id, and `amount`/`unit`/`cost_per_unit`/`category`/`display_name`/`name_key` copied verbatim; a raw second `INSERT` with the same `reverses_transaction_id` is rejected by the UNIQUE index; a source scan of `apps/api/src/` finds zero occurrences of `inventoryTransactions` as an argument to `db.update(` or `db.delete(` |
| AC-32 | Reversing what is not open | Integration | `POST .../checkoff/reverse` for an item with no open deduction → `409 CHECKOFF_NOT_OPEN`; a second reverse of the same deduction → `409 CHECKOFF_NOT_OPEN` (the route rejects before the UNIQUE index does); ledger row count unchanged in both |
| AC-33 | **End-to-end toggle with no drift, over HTTP** (roadmap clause 1) | Integration | Check off all 5 checkable items → `GET /api/inventory` shows `inv-1` `quantity -1.5`, `inv-2` `-0.5`, `inv-3` `0`, `inv-4` `-1`, `inv-5` `-4.5`, each with the matching `baseQuantity`/`deductedQuantity`. Reverse all 5 → every `quantity` is `Object.is`-identical to its `baseQuantity` (`4.0`, `0`, `50`, `2`, `-0.5`). Repeat the full check/reverse cycle **20 times** → after each of the 40 half-cycles every quantity is `Object.is`-identical to the corresponding first-cycle value; the final ledger holds exactly **200** rows (20 × 5 deductions + 20 × 5 reversals) and `GET /api/batches/:id/checkoff` reports `checkedCount 0` |
| AC-34 | `/api/inventory` returns the projected shape, and the filter follows on-hand | Integration | With `inv-1` checked off: `GET /api/inventory` returns rows carrying `baseQuantity`, `deductedQuantity`, `openDeductionCount` in addition to every M9_P1 key; `inv-1` has `quantity -1.5`, `baseQuantity 4.0`, `deductedQuantity 5.5`, `openDeductionCount 1`; `?outOfStock=true` **includes** `inv-1` (it does not on an empty ledger) and `?outOfStock=false` excludes it; `?category=Fermentable` still filters correctly; default ordering (category, then `nameKey` asc) is unchanged. A source scan finds `baseQuantity - deductedQuantity` (or equivalent) computed in exactly one module, `packages/calculations/src/inventoryLedger.ts` |
| AC-35 | `PUT` writes the base, response reports on-hand | Integration | With `inv-1` checked off (5.5), `PUT /api/inventory/inv-1` with `quantity: 10` → `200` whose `baseQuantity === 10` and `quantity === 4.5`; the database column holds `10`; `createdAt` unchanged, `updatedAt` changed; M9_P1's duplicate/validation/404 behaviours are unchanged (the M9_P1 `inventory.test.ts` cases still pass) |
| AC-36 | `GET /api/batches/:id/checkoff` | Integration | Against the fixture with `inv-1` and `inv-3` checked off → `200` whose body deep-equals `evaluateCheckoff(evaluateStock(requirements, projectedInventory), batchLedger, 'Planning')`; `checkedCount 2`, `checkableCount 5`, `allCheckedOff false`, `stage 'Planning'`, `editable true`; `shortfallCount` reflects the **post-deduction** on-hand |
| AC-37 | **M9_P1's `/stock-check` contract preserved** (regression) | Integration | `GET /api/batches/:batchId/stock-check` on the fixture with an **empty** ledger returns a body deep-equal to the one M9_P1 AC-27 pinned, and `apps/api/test/stockCheck.test.ts` passes **byte-unmodified**; the response contains none of the six `StockCheckoffLine` keys; five successive calls leave every `inventory_items` row and every `inventory_transactions` row byte-identical (M9_P1 AC-29 extended to the new table) |
| AC-38 | `GET /api/batches/:id/cost` | Integration | With all 5 items checked off in fixture order → `200` with `totalCost === 37.730000000000004`, `lineCount 5`, `lines[0]` `{displayName:'Pale Ale Malt', amount:5.5, unit:'kg', costPerUnit:3.2, lineCost:17.6}`; after reversing `inv-4`, the same call returns `totalCost === 24.23` (strict equality — see AC-15) and `lineCount 4` |
| AC-39 | Cost on a batch with no ledger (degenerate) | Integration | `GET /api/batches/:id/cost` on a batch with zero transactions → `200` with `lines: []`, `lineCount 0`, `totalCost 0`, `hasUncostedLines false` — **not** `404`, not `null`, not `NaN` |
| AC-40 | Deleting an inventory item does not erase history | Integration | With `inv-1` checked off, `DELETE /api/inventory/inv-1` → `204`; `GET /api/batches/:id/cost` still returns that line with `displayName 'Pale Ale Malt'`, `amount 5.5`, `costPerUnit 3.2`, `lineCost 17.6` and the same `totalCost`; `GET /api/inventory` no longer lists `inv-1`; `GET /api/batches/:id/checkoff` shows the `pale ale malt` line as `matched false`, `checkable false`, `checked false` (M9_P1 AC-25 behaviour preserved, and no orphan row corrupts the projection) |
| AC-41 | **Pre-M9 batch compatibility** (roadmap clause 3) | Integration | A batch row with `stats_snapshot` NULL, `closing_snapshot` NULL and zero `inventory_transactions` rows: `GET /api/batches/:id` behaves identically to the pre-change suite; `GET .../checkoff` → `200` with `checkedCount 0`; `GET .../cost` → `200` with `totalCost 0`; a full `Planning → Brewing → Fermenting → Conditioning → Completed` run succeeds **with zero inventory rows present in the database**; `GET .../cost` on the now-Completed batch is still `200`/`totalCost 0` |
| AC-42 | Error-code surface | Integration | `ApiErrorCode` includes `'CHECKOFF_ALREADY_OPEN'`, `'CHECKOFF_NOT_OPEN'`, `'CHECKOFF_NOT_COMPARABLE'`, `'CHECKOFF_STAGE_INVALID'`; all nine pre-existing codes (`VALIDATION_FAILED`, `NOT_FOUND`, `EQUIPMENT_NOT_FOUND`, `EQUIPMENT_IN_USE`, `PROFILE_IN_USE`, `RECIPE_IN_USE`, `WATER_PROFILE_IN_USE`, `INTERNAL`, `INVENTORY_DUPLICATE`) still present and unchanged; `apps/api/test/errors.test.ts` passes byte-unmodified |
| AC-43 | Checkbox rendering follows `checkable`, not `checked` | Component | With the fixture: exactly **5** checkbox inputs render; the `whirlfloc` and `lactic acid` rows contain **zero** `input` elements (`queryByRole('checkbox')` within those rows is `null`) — **not a disabled checkbox**; those two rows still read `Not tracked` and a string containing both `g` and `ml`; with `editable: false` all 5 checkboxes carry `disabled` |
| AC-44 | Toggle issues exactly the pinned request | Component | Clicking the unchecked `pale ale malt` checkbox issues exactly one `POST` to `/api/batches/<id>/checkoff` with body `{"inventoryItemId":"inv-1"}` and **no** follow-up `GET`; clicking it again (now checked) issues exactly one `POST` to `/api/batches/<id>/checkoff/reverse` with the same body; the body's `Object.keys()` deep-equals `['inventoryItemId']`; during the in-flight request all 5 checkboxes are `disabled` |
| AC-45 | **Lockstep — one response, one render, no local math** | Component | The `POST` mock resolves with a `BatchCheckoffState` in which `pale ale malt` has `onHand -1.5`, `shortfall 0`, `sufficient true`, `checked true`, and `shortfallCount 3`. After the click the row reads `On hand: -1.50 kg`, status `In stock`, checkbox checked, and the header reads `3 of 7 ingredients short` — all four from that one response. Asserted additionally: the component issued **no** second request, and a test that resolves the `POST` with a *deliberately inconsistent* payload (`checked true` but `onHand` unchanged at `4.00 kg`) renders exactly that inconsistent payload — proving the panel never recomputes locally |
| AC-46 | Failed toggle leaves no phantom state | Component | With `pale ale malt` initially unchecked, a `POST` that rejects with `409 CHECKOFF_ALREADY_OPEN` → the server's message renders inline, the checkbox is **unchecked**, the header still reads `4 of 7 ingredients short`, every row's `On hand:` text is byte-identical to its pre-click text, and the other 4 checkboxes are re-enabled |
| AC-47 | Panel is still Planning-only, and no longer calls `/stock-check` | Component | For `status` in `['Brewing','Fermenting','Conditioning','Completed']` the panel is absent from the DOM **and** zero requests to a URL containing `/checkoff` were issued; on a Planning batch, zero requests to a URL containing `/stock-check` were issued (M9_P1 AC-38 preserved, endpoint switched) |
| AC-48 | `BatchCostPanel` | Component | Mounted only for `status === 'Completed'` (absent and zero `/cost` requests for the other four). With the 5-line fixture breakdown it renders 5 rows and a total reading **`37.73`** (not `37.730000000000004`); the `flaked oats` variant renders **`Not priced`** in that row's cost column and a note naming `1` uncosted line; `lineCount 0` renders **"No ingredients were checked off for this batch."** with zero rows and **no total shown**; no rendered text matches `/NaN\|undefined\|null/` |
| AC-49 | `BatchNutritionPanel`, including the pre-M5_P2 path | Component | Mounted only for `status === 'Completed'`. With `closingSnapshot: null` it renders **"No closing snapshot recorded for this batch — nutrition is unavailable."** and **zero** numeric values (assert no digit-bearing value node in the panel), and issues **zero** requests. With `{originalGravity: 1.050, finalGravity: 1.010}` it renders calories `164` (`163.5515688276861.toFixed(0)`), carbs `15.2` g and alcohol `14.9` g per 355 mL serving, plus `46` kcal / `4.3` g per 100 mL. With `{originalGravity: 1.050, finalGravity: 1.060}` the ABW renders **negative** (`-1.0`), not `0.0` and not blank |
| AC-50 | `InventoryManager` shows on-hand, and base only when it differs | Component | A row with `baseQuantity 4.0`, `deductedQuantity 5.5`, `quantity -1.5` renders `-1.5` as the primary on-hand figure **and** shows the base `4` and deducted `5.5` alongside it, and lights both "Out of stock" and "Negative stock"; a row with `deductedQuantity 0` renders **no** base/deducted annotation at all; the category and out-of-stock filter controls issue the same four pinned URLs M9_P1 AC-33 asserted, byte-identical |
| AC-51 | `InventoryForm` edits the base | Component | Opening the form for an item with `baseQuantity 4.0`/`quantity -1.5` seeds the quantity field with **`4`**, not `-1.5`; submitting unchanged posts `quantity: 4`; the body's `Object.keys().sort()` still deep-equals M9_P1 AC-35's 8-key list `['category','costPerUnit','expiryDate','name','notes','purchaseDate','quantity','unit']` — no `baseQuantity`, no `deductedQuantity`, no `openDeductionCount` |
| AC-52 | Layer 1 — four gates, explicitly by exit code | Integration | `npm test`, `npm run typecheck`, `npm run build` and `npm run lint` each exit **`0`**, and **each exit code is asserted explicitly, not inferred from reading the summary block printed last** — `npm test --workspaces` prints one summary per workspace and continues past a failing one, so a green-looking tail is not evidence (M9_P1 was twice certified Layer-1-clean while the command exited `1`). The per-workspace pass/fail counts are read from all three blocks and reported summed. No lint warning beyond the three pre-existing `only-export-components` warnings (`ConfigContext.tsx` ×2, `CatalogContext.tsx`). Every pre-existing test passes unmodified except the **four** bounded edits in §1.5, and each of those files' non-listed assertions is byte-identical to its pre-change text |
| AC-53 | **Scope guardrail — SHA-256 content manifest, pre- and post-execution** | Verification | `git diff --name-only` against a base commit is **not viable in this repository and must not be used**: `git rev-list --count HEAD` returns **`1`**, and that single commit predates every milestone's work, so a name-only diff against any available base would list essentially the whole tree and prove nothing. Verified before writing this spec, not assumed. **Mechanism instead:** as the **first action after `SPEC_APPROVED` and before the executor's first edit**, capture `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum > .gsd/archive/manual_verification/M9_P2/M9_P2_pre_exec_manifest.txt`, confirm the file exists and is non-empty, and **archive it immediately** — not at `/steer` (this is M9_P1's AC-41 process correction, adopted verbatim; its pre-exec manifest was lost precisely because it sat untracked in `.gsd/active/` across a multi-session handoff). Capture the post-execution manifest with the identical command in the identical shell at the end of the pass. **Pass condition:** the two-manifest diff shows (a) **CHANGED — exactly 17 files**, every one on §1.5's Modified (13) or bounded-test-exception (4) tables and nothing else; (b) **NEW — exactly 12 files**, every one on §1.5's New table, plus the two manifest files themselves; (c) **REMOVED — 0**; and (d) **zero contamination of any §1.5 Untouched-listed path**, specifically including `apps/api/src/server.ts`, `routes/batches.ts`, `batchRepository.ts`, `errors.ts`, migrations `0000`–`0011`, `packages/calculations/src/inventory.ts`, `packages/calculations/test/inventory.test.ts`, `apps/api/test/stockCheck.test.ts`, `apps/web/src/App.tsx`, `apps/web/src/components/Sidebar.tsx`, `apps/web/test/Sidebar.test.tsx`, `apps/web/test/Calculators.test.tsx` and `calculatorImportGraph.test.ts`. Any 18th changed file is a scope violation |
| AC-54 | **`.gsd/BUGS.md` and `.gsd/FEATURES.md` are byte-unchanged** | Verification | Both files' SHA-256 hashes in the post-execution manifest equal their hashes in the pre-execution manifest. **No `BUG-xxx` or `FEAT-xxx` item was pulled into M9_P2's scope and no item's status was set to `IN_PLANNING`** — see the scope note below |

**54 acceptance criteria.**

**Backlog scope note (why AC-54 asserts "unchanged" rather than listing pulled-in items).** `.gsd/BUGS.md` and `.gsd/FEATURES.md` were both read in full during drafting. Every open item was assessed against this phase's slice and **none belongs in it**:

- **BUG-012** (strike-temperature thermal mass) — `packages/calculations/src/mash.ts` physics; needs an `EquipmentProfile` field. No inventory contact.
- **BUG-013** (unsaved-changes prompt on non-editor routes) — `App.tsx` / `useRecipeEditor.ts` navigation lifecycle. Both files are on this phase's Untouched list.
- **BUG-014** (hop timing UI/model mismatch) — `HopItem`/`HopUse` semantics and `HopSection.tsx`. No inventory contact.
- **BUG-015** (tabbed batch architecture) — a `BatchDetail.tsx` layout rewrite. This phase adds two mount lines to that file; folding a full restructure in would make the diff unauditable against §1.5.
- **BUG-016** (`srmToEbc` call site) — explicitly deferred to a phase whose Untouched list permits editing `brewingMath.ts`. This one does not.
- **BUG-017** (app-shell scroll isolation) — `App.tsx`/`PageContainer.tsx`/`Sidebar.tsx`/`TopBar.tsx`, all Untouched here.
- **FEAT-007 / FEAT-008 / FEAT-009** — the feature-side twins of BUG-014 / BUG-015 / BUG-017; same reasoning.
- **FEAT-011** (category-based inventory sections, preset catalogs, modal pickers) — the only *inventory-adjacent* item, and the closest call. It is nonetheless a catalog-and-UI-architecture feature (accordion sections, a preset library of maltsters/hop varieties/yeast strains, searchable modals) with **zero overlap** with checkoff, the ledger, cost or nutrition. It shares a page with this phase's work but not a mechanism, it would require its own catalog tables, and pulling it in would roughly double the slice while delaying the milestone's three verification clauses. It is a strong candidate for its own milestone once M9 closes.

Both files are therefore left **untouched**, following the M9_P1 and M8_P2 precedent of asserting the fact rather than leaving it implicit.

---

## 4. Deviation Register

Everything here departs from, or resolves silence in, the literal `.gsd/ROADMAP.md` Milestone 9 text and the M9_P1 §5 preview. Each needs sign-off at the halt gate.

1. **On-hand is derived, not stored; `inventory_items.quantity` becomes the base quantity.** The roadmap says "check ingredients off … to deduct them", which reads as mutating the stored quantity. It is not implemented that way, and the reason is computed rather than asserted: the mutate-in-place model fails the roadmap's own *"no drift after repeated toggles"* clause on a two-decimal input (`base 0.01`, `amount 0.03` → wrong by `1.734723475976807e-18` after one toggle, forever). The derived model is bit-exact by construction. **Cost to the user:** `quantity` now means "base" on write and "on hand" on read (Resolved Ambiguity 2). Both figures are always visible.
2. **`GET /api/inventory` changes behaviour, not just shape.** The `?outOfStock=true` filter now evaluates on-hand rather than the stored base, and every read response gains three keys. This modifies an endpoint M9_P1 shipped and verified. It is additive at the type level (`InventoryStockView extends InventoryItem`) and every M9_P1 assertion still holds on an empty ledger, but it is a behaviour change and is flagged rather than buried.
3. **No currency field and no currency setting — still.** *(Carried forward from M9_P1 §4 Deviation 3, which explicitly deferred the decision to this spec's halt gate. **This is the open question the user was asked to answer here.**)* `costPerUnit`, `lineCost` and `totalCost` are unitless numbers rendered without a symbol. Adding a single global label would mean one new `user_config` column plus a `SettingsManager` field — reopening M7_P1's approved config contract in a phase that otherwise has no reason to touch it, and adding a fourth file to a `settings` surface this phase currently leaves entirely alone. **Recommendation: leave it out of M9_P2 and add it as a standalone lightweight-task-exception edit after the milestone closes** (rule 7 — one config field, one form input, no new behaviour). **If the user wants it inside this phase instead, say so at the halt gate**, and §1.5's Untouched list must gain `packages/shared-types/src/config.ts`, `apps/api/drizzle/0013_*.sql`, `apps/api/src/routes/config.ts` and `apps/web/src/components/SettingsManager.tsx` as named exceptions before `SPEC_APPROVED`.
4. **Nutrition uses the standard real-extract model, and the roadmap never named a model.** `RE = 0.1808·OE + 0.8192·AE`; calories `= (6.9·ABW + 4.0·(RE − 0.1))·FG` per 100 mL. This is the conventional homebrew formulation, and every coefficient is pinned in §Resolved Ambiguity 4 with reference values computed by the planner (not copied) in AC-19 … AC-22. **Serving size is fixed at 355 mL** (12 US fl oz), which is the basis the formula's `×3.55` factor assumes; it is exported as `NUTRITION_SERVING_ML` so it is a one-line change if the user wants 330 mL or a pint. **Raised for sign-off:** is 355 mL the right default for this user, given the app is otherwise metric-canonical?
5. **Reversal is permitted only while the batch is in Planning.** The roadmap says checkoff happens "during a batch's Planning stage" but says nothing about un-checkoff. Locking both directions to Planning is what makes a Completed batch's cost total immovable, which is verification clause 2. The cost is that a mistake discovered after advancing must be corrected by editing the inventory item's base quantity instead. **Raised for sign-off:** allow reversal in later stages? It is a one-predicate change, but it must be decided now.
6. **Nutrition renders negative ABV/alcohol when FG > OG, unclamped.** Consistent with `ClosingSnapshot`'s existing `apparentAttenuationPct` (UNROUNDED, unclamped, may be negative) and `carbonationForcePsi` (UNCLAMPED). A stuck fermentation shows a negative number rather than a silent zero. AC-21 pins it.
7. **A null `costPerUnit` produces an uncosted line, and the total silently excludes it — but the exclusion is never silent to the user.** `uncostedLineCount`/`hasUncostedLines` are first-class fields and the panel names the count. The alternative (treating a null price as `0`) would make `totalCost` a number that looks complete and is not.
8. **`inventory_transactions` has no foreign keys and denormalizes `category`/`displayName`/`nameKey`.** Deliberate: a deleted inventory row must not erase a closed batch's cost history (AC-40), and M9_P1 Resolved Ambiguity 9 already established that inventory rows carry no `*_IN_USE` guard. This is normalization traded for auditability, and it is the standard ledger trade.
9. **`GET /api/batches/:batchId/stock-check` survives with no UI caller.** Preserving M9_P1's pinned `StockLine` 12-key surface and pinned response body (AC-16/AC-27 of a closed, verification-clean phase) is worth one thin handler. The alternative — retiring it and amending a closed phase's ACs — sets the precedent that closed contracts are negotiable. **Raised for sign-off:** if the user would rather retire it, that is a separate small cleanup after the milestone closes, not a change to make inside this phase.
10. **Four new `ApiErrorCode` members, all `409`.** `CHECKOFF_ALREADY_OPEN`, `CHECKOFF_NOT_OPEN`, `CHECKOFF_NOT_COMPARABLE`, `CHECKOFF_STAGE_INVALID`. Four distinct codes rather than one generic `CHECKOFF_INVALID`, so the UI can say which of four different things went wrong. The repo precedent (five distinct `*_IN_USE`/`*_NOT_FOUND` codes) supports granularity over economy.
11. **Both `POST` endpoints return the full recomputed `BatchCheckoffState`, not the created transaction.** This is what makes §2.3 point 4's lockstep contract enforceable and is why AC-45 can assert the panel does no local arithmetic. The cost is a slightly heavier response body on every toggle.
12. **Four closed-phase test files are edited**, each with an explicitly enumerated permitted change and an explicit forbidden list (§1.5): `apps/api/test/seed.test.ts` (one number, 20→21, forced by this spec's own new table), `apps/api/test/inventory.test.ts` (additive keys only), `apps/web/test/StockCheckPanel.test.tsx` (endpoint repoint + payload extension, with every M9_P1 formatting assertion preserved verbatim), `apps/web/test/BatchDetail.test.tsx` (two fetch mocks). Weakening or deleting any other assertion in those files is a phase failure, not a judgement call. Note that `Sidebar.test.tsx`, `App.test.tsx` and `Calculators.test.tsx` — all three edited in M9_P1 — are **byte-unchanged** here, because this phase adds no nav destination and no route.
13. **`apps/api/src/server.ts` and `apps/web/src/components/Sidebar.tsx` are NOT modified.** M9_P1 needed both as forced narrow exceptions; this phase needs neither, because `registerInventoryRoutes` is already wired and no new nav destination is added. Recorded here as the *absence* of a deviation, so a reader does not assume the exception was carried forward unexamined.
14. **The scope guardrail is a pre/post SHA-256 content manifest, not `git diff --name-only`** (AC-53), and the pre-execution manifest is archived to `.gsd/archive/manual_verification/M9_P2/` **before the first edit**, not at `/steer`. `git rev-list --count HEAD` was run during drafting and returns `1`, so a name-only diff against any available base is unusable here. The archive-immediately rule is M9_P1's own AC-41 process correction, adopted verbatim — its manifest was lost precisely because it was left untracked in `.gsd/active/`.
15. **No `BUG-xxx`/`FEAT-xxx` item is pulled into scope**, and `.gsd/BUGS.md`/`.gsd/FEATURES.md` are left byte-unchanged (AC-54). The full item-by-item assessment, including why the inventory-adjacent **FEAT-011** is nonetheless out of scope, is in §3's backlog scope note. **Raised for sign-off:** if the user disagrees about FEAT-011, it should become its own milestone rather than a late addition here.

---

> **HALT GATE (STATE 2).** This specification is **not** approved. No implementation work — including the pre-execution manifest capture, which is the *first* step of execution, not of planning — may begin until the user replies with the literal string **SPEC_APPROVED**.
>
> Questions the user should answer explicitly, because the executor cannot:
> **(a)** Is `costPerUnit` staying currency-free, or should a single global currency label land inside this phase (§4 Deviation 3 — the question M9_P1 deferred to here)?
> **(b)** Is on-hand-as-a-derived-number, with `quantity` meaning "base" on write and "on hand" on read, the right trade for a bit-exact no-drift guarantee (§4 Deviation 1 / Resolved Ambiguity 2)?
> **(c)** Should un-checkoff be blocked once a batch leaves Planning, or permitted in later stages (§4 Deviation 5)?
> **(d)** Is a 355 mL serving the right nutrition basis for a metric-canonical app (§4 Deviation 4)?
> **(e)** Is keeping `GET /api/batches/:batchId/stock-check` alive with no UI caller acceptable, in order to leave M9_P1's pinned contracts untouched (§4 Deviation 9)?
> **(f)** Is FEAT-011 correctly deferred out of M9_P2 (§4 Deviation 15 / §3's backlog scope note)?
>
> **Review this feature specification. Reply with SPEC_APPROVED to begin execution.**
