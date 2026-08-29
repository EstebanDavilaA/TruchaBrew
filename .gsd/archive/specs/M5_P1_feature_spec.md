# FEATURE SPECIFICATION: M5_P1 — Watch it ferment

> **AMENDED 2026-08-08 — narrow follow-up amendment. AWAITING re-SPEC_APPROVED.** This spec was approved unqualified on 2026-08-07 (all nine deviations accepted as written), built, and audited. The `/verify` critic pass returned **FAIL — 48 of 50 criteria YES**, with **AC-50 NO** and **AC-41 PARTIAL**; `/diagnose` found **both to be spec-layer defects, not implementation defects** (hard rule 4 — see `.gsd/archive/CRITIC_REPORT.md`, M5_P1 entry, Findings 1 and 2). This amendment corrects **exactly those two items and nothing else**. **`AC-1`…`AC-50` keep their existing numbers — nothing is renumbered and no acceptance criterion is added**; `AC-41` is corrected in place and `AC-50` itself needs no edit. Deviations **1–9 are settled and are not reopened**; two new register entries, **10** and **11**, record the two changes and are the only items put to the gate. The original draft note follows.
>
> *Original draft note (2026-08-07):* This is a fresh draft against the current tree, written after reading `packages/shared-types/src/batches.ts`, `apps/api/src/routes/batches.ts`, `apps/api/src/repositories/batchRepository.ts`, `apps/api/src/db/schema.ts`, `apps/web/src/pages/BatchDetail.tsx`, `apps/web/src/pages/BatchList.tsx`, `apps/api/drizzle/`, `packages/calculations/src/`, `.gsd/DISCOVERY.md`, `.gsd/ROADMAP.md`, and the archived `M4_P1` / `M3_P2` specs. Nothing in it is inherited from any earlier M5 draft.

## Phase Summary

Milestone 5's user-visible outcome is: *"Log timestamped gravity/temperature readings through fermentation, watch a gravity-and-temp chart and live attenuation build up, then carry the batch through Conditioning to Completed with measured FG, ABV, carbonation, tasting notes and a 1–5 rating — one real brew, planned and logged end to end."*

**Milestone 5 is split into two phases** (§4 deviation 1). This phase, **M5_P1**, delivers the roadmap's **first hardening bullet in full**: `Reading` entry and storage, the gravity-and-temperature chart, and live apparent attenuation — plus the one status transition that gives a reading a stage to be logged in, `Brewing → Fermenting`. **M5_P2** delivers the second bullet — `Fermenting → Conditioning → Completed`, measured FG/ABV/efficiency against the estimates, carbonation, batch notes, tasting notes and rating — and runs **the MVP acceptance run** that closes the milestone. §5 previews P2 in enough detail that it can be planned without re-deriving anything decided here.

**User-visible outcome of this phase:** move a batch from Brewing into Fermenting, log timestamped gravity/temperature readings against it with optional pH, pressure and a comment, and watch a two-axis gravity-and-temperature chart and a live apparent-attenuation figure build up as fermentation progresses — with every reading surviving a full app restart.

### Key Behaviors

1. **A reading is an immutable-in-shape, append-oriented log entry, not a positional child row.** `batch_readings` has **no `position` column**, deliberately: order is derived from `readingTime`, and a dense 0-based position (the `mash_steps` / `recipe_hops` pattern) would be meaningless for a log whose entries arrive at arbitrary real times and can be back-dated. Readings are created, edited and deleted **one at a time** through per-item endpoints, not by full-replace of an array (§4 deviation 5).
2. **The pipeline gains exactly one transition, and there is now exactly one place that defines it.** `Brewing → Fermenting` is added. Three hand-maintained status lists exist today — `ALLOWED_TRANSITIONS` in `routes/batches.ts`, `batchStatusEnum` in `routes/schemas.ts`, and `BATCH_STATUS_OPTIONS` in `BatchDetail.tsx` — and they collapse into one exported source in `packages/calculations/src/batchPipeline.ts` (§2.6). The UI cannot offer a transition the server would reject, because both read the same table.
3. **Attenuation is derived, labelled, and never faked.** Apparent attenuation is computed from the **latest reading that actually carries a gravity** (a temperature-only reading must not blank it) against a resolved original gravity: `measuredOg` when present, the frozen `statsSnapshot.og` otherwise — and when the estimate is used, the figure is **labelled on screen**, on the same discipline as M4_P1's `(recalculated)` marker. With no gravity reading at all, the figure is **suppressed entirely** — no `0`, no `—`, no `NaN`.
4. **The chart's numeric content is a pure function.** `buildFermentationChartModel` produces domains, ticks and plotted points as data; the SVG component is a thin renderer over that model. The plotting *math* is unit-tested independently of any DOM (§4 deviation 2).
5. **Nothing frozen moves.** `recipe_snapshot` and `stats_snapshot` are untouched by every write path this phase adds. M4_P1's AC-12 property — a batch's estimated figures do not move — holds unchanged, and is re-asserted here across reading writes and the new transition.

### Resolved Ambiguities (Binding)

Every item below is binding on execution and on the critic audit. Where a bound is stated, the **operator** is stated.

- **Reading identity and ordering.** Canonical order is `readingTime` **ascending**, ties broken by `id` **lexicographic ascending**. This exact rule is implemented once, in `sortReadings`, and is what the API returns, what the chart plots, and what `latestGravityReading` scans. Two readings may share a `readingTime`; that is admissible, not an error, and the tie-break makes the result deterministic.
- **`readingTime` format.** A string matching **exactly** `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$` — ISO-8601, UTC, `Z` suffix mandatory, milliseconds optional. Offsets (`+02:00`), space separators and bare dates are **rejected with 400**. The pattern is enforced by JSON Schema; a value that matches the pattern but is not a real instant (e.g. `2026-13-45T00:00:00Z`) is **additionally** rejected at the route with `400 VALIDATION_FAILED` before anything is written, because `Number.isNaN(Date.parse(v))` is the only check that catches it. **`format: 'date-time'` is deliberately not used** — it depends on `ajv-formats` being registered, which this repo has never relied on, and a silently-inert `format` keyword would make the criterion untestable.
- **At least one measurement per reading.** `sg` and `tempC` are both nullable, but a reading with **both** `null` is `400 VALIDATION_FAILED` and writes nothing. This is a **route-level** check, not a schema one: expressing "at least one of two nullable numbers is non-null" in JSON Schema requires an `anyOf` whose failure message is unusable, and Fastify's repo-wide `removeAdditional: true` default already makes schema-only reasoning unreliable here (M3_P1 critic Finding 1). `ph`, `pressurePsi` and `comment` are never sufficient on their own.
- **Numeric bounds, exact operators.** All inclusive unless stated. `sg`: `null` or `[0.900, 1.200]` — `0.899` and `1.201` are `400`, `0.900` and `1.200` are accepted. `tempC`: `null` or `[-20, 50]` — the same band `EquipmentProfile.grainTemperatureC` already uses; `-20.01` and `50.01` are `400`. `ph`: `null` or `[3, 9]` — the same band `MashProfile.targetPh` already uses. `pressurePsi`: `null` or `[0, 60]` — the same band `FermentationStep.pressurePsi` already uses. `measuredOg` on the batch: `null` or `[0.900, 1.200]`, identical to a reading's `sg`. `comment`: `string`, `maxLength: 2000`, **`''` is the unset value and is always admissible** — it is never `null`, on the `EquipmentProfile.notes` precedent.
- **`comment` is `''`, never `null`.** A `comment: null` body is `400`. The column is `NOT NULL DEFAULT ''`.
- **Original-gravity precedence.** `resolveOriginalGravity(measuredOg, estimatedOg)` returns `{ og: measuredOg, source: 'measured' }` **iff `measuredOg !== null`** — never a falsy check, for the same reason `resolveSpargeTemperatureC` is bound to `!== null`. `estimatedOg` is `batch.statsSnapshot.og` when `statsSnapshot` is non-`null`, and `calculateRecipeStats(batch.recipeSnapshot).og` in the pre-0006 legacy branch — which stays **labelled `(recalculated)`** exactly as M4_P1 AC-12(e) requires. A recomputed estimate never silently becomes an attenuation baseline.
- **Attenuation is not clamped.** `apparentAttenuationPct(og, fg)` in `brewingMath.ts` is **reused, not reimplemented**, and its result is displayed unclamped. A reading above OG yields a **negative** apparent attenuation and it is shown as such: a clamp to `0` would hide a transposed-digit data-entry error behind a plausible number, which is the opposite of what a brew log is for. The existing function's own `og <= 1.0 → 0` guard is unchanged.
- **Fermentation `t0` precedence, and negative elapsed time.** The chart's time origin is `fermentationStartDate` when it is non-`null`; otherwise the **earliest** reading's `readingTime`. `elapsedHours = (Date.parse(t) - Date.parse(t0)) / 3600000`, unrounded. A reading logged **before** `t0` yields a **negative** `elapsedHours` and is plotted there — not clamped, not dropped. The time axis follows the data.
- **`fermentationStartDate` is server-owned and write-once.** It is set by the server, to the transition's own `now`, **iff** the request transitions a batch whose stored `fermentationStartDate` is `null` into status `Fermenting`. It is **never** overwritten (a `Fermenting → Fermenting` re-save leaves it exactly as it was), **never** set by any other transition, and **never** accepted from the client: a `PUT /api/batches/:id` body containing the key `fermentationStartDate` is `400 VALIDATION_FAILED`. That rejection comes from a `preValidation` hook, **not** from `additionalProperties: false` — Fastify's `removeAdditional: true` default would silently strip the key instead, which is precisely the trap M3_P1's AC-22 fix documented in `schemas.ts:177-183`.
- **Degenerate axis widening, exact pads.** When a chart axis's computed `min === max`, it is widened to `[v - pad, v + pad]` with `pad = 1` for the time axis (hours), `pad = 0.005` for the gravity axis, `pad = 1` for the temperature axis. This is the single-reading case and it must never produce a zero-width domain, because the renderer divides by `max - min`.
- **Ticks are exactly five, evenly spaced, endpoints inclusive.** `ticks.length === 5`, `ticks[0] === min`, `ticks[4] === max`, `ticks[i+1] - ticks[i]` constant within `1e-9`. No "nice number" rounding algorithm is used. Deliberate: a nice-number algorithm is a second body of arithmetic to get wrong and to pin in criteria, and readability is handled by **formatting** (gravity to 3 dp, temperature to 1 dp, hours to 1 dp), not by moving the domain.
- **A series with no data has no axis.** `gravityAxis` is `null` **iff** no reading has `sg !== null`; `temperatureAxis` is `null` **iff** no reading has `tempC !== null`. A `null` axis means the renderer draws **no** axis, **no** line and **no** legend entry for that series — never a placeholder axis at `[0, 1]` and never a flat line at zero.
- **No-readings state.** `buildFermentationChartModel` with zero readings returns an object whose `Object.keys(...)` is **exactly** `['hasPoints']`. `calculateFermentationProgress` with no gravity-bearing reading returns an object whose `Object.keys(...)` is **exactly** `['hasGravityReading']`. Nothing is left on the object to be read by accident — the `MashPlan` / `hasMashProfile` precedent (M3_P2 AC-35), chosen because it makes the caller's branch a type-level obligation rather than a discipline.
- **The chart is a dependency-free inline SVG.** No `recharts`, no `uplot`, no `d3`, no new runtime dependency of any kind is added to any `package.json`. See §4 deviation 2 for the reasoning and the overrule path.
- **Readings are not seeded.** `apps/api/src/db/seed.ts` is untouched. Seeding readings would put fabricated fermentation data in front of the MVP acceptance run that M5_P2 has to perform against real, hand-entered data.
- **The measured-efficiency carryover is DEFERRED to M5_P2, with a named mechanism — this is a decision, not a third silent inheritance.** `.gsd/archive/CRITIC_REPORT_M4_P1_AC12.md` carried forward one non-blocking observation: `BatchDetail.tsx`'s **measured**-efficiency figure (distinct from the estimated `statsSnapshot` figures AC-12 froze) still recomputes live, via `calculateVolumes` / `totalExtractPoints` / `gravityAtVolume` over the frozen `recipeSnapshot`. **It is deferred to M5_P2 and this spec says why, what it costs, and what P1 must not do in the meantime.** *Why deferred:* (a) the drift exposure is materially smaller than the one AC-12 closed — ROADMAP.md's Milestone 7 swaps the **IBU utilisation curves and the FG/ABV estimation methods**, and names none of the three extract/volume functions this figure actually depends on; (b) the correct fix is to freeze the **measured** comparison figures when the batch is closed, alongside measured FG, ABV and attenuation — which is M5_P2's surface, being built there anyway; fixing it in P1 means building a freeze mechanism for a display P2 is about to rebuild, then rebuilding it. *What P1 owes instead:* **AC-32** requires that this phase adds **no new** live-recompute site feeding an unlabelled estimated figure, and leaves the existing one byte-unchanged, so the deferral cannot quietly widen. *Overrule path:* fix it in P1 by persisting the efficiency denominator (`maxPossibleGravityPoints`, unrounded) as a nullable column in migration `0007` and reading it instead of recomputing — roughly 3 additional criteria and one extra column, and it makes P2's freeze work partly redundant.
- **The `DryHop` `timeMinutes` retirement is DEFERRED to M5_P2.** M4_P1's approved spec states that "M5 introduces the fermentation timeline that a day-offset is measured *from*, and M5 owns both the real model and the migration that finally drops this column." P1 does introduce that referent — `fermentationStartDate`. The retirement is nonetheless placed in P2 (§4 deviation 9), because the work is a `HopItem` model change plus a `recipe_hops` migration plus a `classifyHopUse`/`calculateSingleHopIbu` review, with an M1 fixture re-baseline risk attached — none of which advances this phase's outcome, and all of which would put a hop-schedule migration in the same execute pass as the first reading-logging surface. `HopItem`, `recipe_hops`, `classifyHopUse`, `calculateSingleHopIbu` and `HopSection.tsx` are all on §1.5's Untouched list and **AC-41** enforces it.

---

## 1. Data Schema & Contracts

### 1.1 Workspace layout — new files and generated migration artifacts

| Path | Kind |
|---|---|
| `packages/calculations/src/batchPipeline.ts` | New — the single source of truth for batch statuses and their allowed transitions |
| `packages/calculations/src/fermentation.ts` | New — pure fermentation-progress and chart-model logic |
| `packages/calculations/test/batchPipeline.test.ts` | New |
| `packages/calculations/test/fermentation.test.ts` | New |
| `apps/api/drizzle/0007_*.sql` | New — generated by `npm run db:generate` (drizzle-kit names it) |
| `apps/api/drizzle/meta/0007_snapshot.json` | New — generated |
| `apps/api/test/readings.test.ts` | New — HTTP contract for the reading routes and the extended transition matrix |
| `apps/api/test/readings.migration.test.ts` | New — migration `0007` shape, additivity and cascade |
| `apps/api/test/batchPipeline.derivation.test.ts` | New — **added by the 2026-08-08 amendment (§4 deviation 11)**. Holds **AC-41(c)**'s module-substitution proof and nothing else. It gets its own file deliberately: the proof needs `vi.resetModules()` + `vi.doMock` + a fresh dynamic `import()`, and vitest isolates the module registry per file, so putting it beside the existing route suites would risk perturbing their already-resolved imports. |
| `apps/web/src/components/FermentationChart.tsx` | New — inline-SVG renderer over `FermentationChartModel` |
| `apps/web/src/components/ReadingLog.tsx` | New — reading table + add/edit/delete form |
| `apps/web/test/FermentationChart.test.tsx` | New |
| `apps/web/test/ReadingLog.test.tsx` | New |

**No file is deleted by this phase.**

### 1.2 Database schema — `apps/api/src/db/schema.ts`

**New table `batch_readings`:**

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `text` | PK | UUID, server-minted; a client-supplied `id` in a body is rejected (`additionalProperties: false` + the create route never reads one) |
| `batch_id` | `text` | NOT NULL | `references(() => batches.id, { onDelete: 'cascade' })` — the `recipe_fermentables` / `mash_steps` precedent |
| `reading_time` | `text` | NOT NULL | ISO-8601 UTC per Resolved Ambiguities |
| `sg` | `real` | NULL | |
| `temp_c` | `real` | NULL | |
| `comment` | `text` | NOT NULL, `default('')` | never `null` |
| `ph` | `real` | NULL | |
| `pressure_psi` | `real` | NULL | |

Indexes: `batch_readings_batch_id_idx` on `(batch_id)`, and `batch_readings_batch_time_idx` on `(batch_id, reading_time)`. **No `UNIQUE` index** — unlike `mash_steps`, two readings on one batch may legitimately share a time (Resolved Ambiguities). **No `position` column** (Key Behavior 1).

**`batches` gains exactly two nullable columns:**

| Column | Type | Null | Notes |
|---|---|---|---|
| `measured_og` | `real` | NULL | client-writable through `BatchWriteInput` |
| `fermentation_start_date` | `text` | NULL | **server-owned**, write-once, ISO-8601 UTC |

**Nothing else on `batches` changes.** `recipe_snapshot` stays `NOT NULL`; `stats_snapshot` stays nullable with its M4_P1 semantics; the six columns `batchRepository.update()` writes are unchanged except for the addition of `measured_og`.

**Migration `0007` is additive only** — one `CREATE TABLE`, two `CREATE INDEX`, two `ALTER TABLE batches ADD COLUMN`. **No table rebuild of `batches`.** If `drizzle-kit` emits a `batches` rebuild (`CREATE TABLE __new_batches` / `INSERT ... SELECT` / `DROP TABLE`), the `recipe_id → recipes.id ON DELETE RESTRICT` edge silently vanishes and M4's referential guarantee dies while tests still pass. **AC-17** exists to catch exactly this; a failure there routes to `/diagnose`, and the generated SQL is not hand-edited without re-checking the pragmas.

### 1.3 Type changes — `packages/shared-types/src/batches.ts`

```ts
export type BatchStatus = 'Planning' | 'Brewing' | 'Fermenting';   // M5_P2 adds 'Conditioning' | 'Completed'

export interface Reading {
  id: string;
  batchId: string;
  readingTime: string;        // ISO-8601 UTC, 'Z'-suffixed
  sg: number | null;
  tempC: number | null;
  comment: string;            // '' when unset, never null
  ph: number | null;
  pressurePsi: number | null;
}

export interface ReadingWriteInput {
  readingTime: string;
  sg: number | null;
  tempC: number | null;
  comment: string;
  ph: number | null;
  pressurePsi: number | null;
}
```

`Batch` gains **two** fields, both required keys with nullable values:

```ts
  measuredOg: number | null;              // client-writable
  fermentationStartDate: string | null;   // SERVER-OWNED; absent from BatchWriteInput by design
```

`BatchWriteInput` gains **one** field: `measuredOg: number | null`. It does **not** gain `fermentationStartDate` (§Resolved Ambiguities).

A new detail-shape type, on the `StoredRecipe extends Recipe` precedent:

```ts
export interface BatchWithReadings extends Batch {
  readings: Reading[];        // canonical order (§Resolved Ambiguities); [] when none
}
```

`Batch` itself **does not** gain `readings`. `GET /api/batches` (the list) returns `Batch[]` and carries no reading data — the list must not grow linearly in reading count, the same reasoning that keeps `RecipeSummary` lean. `GET /api/batches/:id` returns `BatchWithReadings`.

**`packages/shared-types/src/api.ts` is untouched.** Every failure mode this phase introduces is covered by the existing `VALIDATION_FAILED` and `NOT_FOUND` codes; no new `ApiErrorCode`, no new `*InUseDetails`. Stated explicitly because an unnecessary edit to that file was M4_P1's finding F-1.

### 1.4 HTTP contract

| Method & path | Success | Failure |
|---|---|---|
| `GET /api/batches` | `200 Batch[]` — unchanged shape apart from the two new batch fields; **no `readings` key** | `500 INTERNAL` |
| `GET /api/batches/:id` | `200 BatchWithReadings` — `readings` in canonical order | `404 NOT_FOUND` |
| `POST /api/batches` | `201 BatchWithReadings` with `readings: []`, `measuredOg: null`, `fermentationStartDate: null` | `400 VALIDATION_FAILED`, `404 NOT_FOUND` |
| `PUT /api/batches/:id` | `200 BatchWithReadings` | `400 VALIDATION_FAILED` (bad body, disallowed transition, or a `fermentationStartDate` key present), `404 NOT_FOUND` |
| `POST /api/batches/:batchId/readings` | `201 Reading` | `400 VALIDATION_FAILED`, `404 NOT_FOUND` (unknown batch) |
| `PUT /api/batches/:batchId/readings/:readingId` | `200 Reading` — full replace of all 6 writable fields | `400 VALIDATION_FAILED`, `404 NOT_FOUND` |
| `DELETE /api/batches/:batchId/readings/:readingId` | `204`, empty body | `404 NOT_FOUND` |

Every non-2xx body is exactly `ApiErrorBody`, through the existing `sendApiError`. A **partial** `PUT` body on either resource is `400`, never a merge — the repo-wide rule since M3_P2 §1.4. There is no `PATCH` for readings. **Reading ids are scoped to their batch:** `PUT`/`DELETE` on a `readingId` that exists but belongs to a *different* `batchId` is `404 NOT_FOUND`, never a cross-batch write.

`GET/POST/PUT/DELETE /api/recipes*`, `/api/equipment-profiles*`, `/api/mash-profiles*`, `/api/fermentation-profiles*`, `/api/catalog` and `/api/health` are **unchanged in this phase**.

### 1.5 Symbol inventory

**New:**

| Symbol | Location |
|---|---|
| `Reading`, `ReadingWriteInput`, `BatchWithReadings` | `packages/shared-types/src/batches.ts` |
| `BATCH_STATUSES`, `BATCH_STATUS_TRANSITIONS`, `canTransitionBatchStatus`, `allowedNextStatuses` | `packages/calculations/src/batchPipeline.ts` |
| `FermentationReadingPoint`, `OriginalGravitySource`, `ResolvedOriginalGravity`, `resolveOriginalGravity`, `sortReadings`, `latestGravityReading`, `FermentationProgressInput`, `FermentationProgress`, `calculateFermentationProgress`, `ChartPoint`, `ChartAxis`, `FermentationChartModel`, `FermentationChartInput`, `buildFermentationChartModel` | `packages/calculations/src/fermentation.ts` |
| `batchReadings` (Drizzle table) | `apps/api/src/db/schema.ts` |
| `listReadings`, `createReading`, `updateReading`, `deleteReading`, `findByIdWithReadings` (on `batchRepository`) | `apps/api/src/repositories/batchRepository.ts` |
| `readingWriteBodySchema` | `apps/api/src/routes/schemas.ts` |
| `createReading`, `updateReading`, `deleteReading` (client) | `apps/web/src/api/client.ts` |
| `FermentationChart`, `ReadingLog` | `apps/web/src/components/` |

**Deleted:** `ALLOWED_TRANSITIONS` (local const in `apps/api/src/routes/batches.ts`); `BATCH_STATUS_OPTIONS` (local const in `apps/web/src/pages/BatchDetail.tsx`); the inline `batchStatusEnum` **literal array** in `apps/api/src/routes/schemas.ts` (the binding is kept, its hand-written contents are not). All three are replaced by imports from `batchPipeline.ts` — see §2.6 and **AC-41**.

**Modified:**

| File | Change — exhaustive |
|---|---|
| `packages/shared-types/src/batches.ts` | `BatchStatus` gains `'Fermenting'`; `Reading`, `ReadingWriteInput`, `BatchWithReadings` added; `Batch` gains `measuredOg` and `fermentationStartDate`; `BatchWriteInput` gains `measuredOg` only. **`recipeSnapshot` stays typed exactly `Recipe`; `statsSnapshot` stays `CalculatedStats \| null` with its M4_P1 comment intact.** |
| `packages/calculations/src/index.ts` | `+ export * from './batchPipeline';` and `+ export * from './fermentation';`. Nothing else. |
| `apps/api/src/db/schema.ts` | `+ batchReadings` table and its two indexes; `batches` `+ measuredOg` `+ fermentationStartDate`. **Every other table byte-unchanged**, including `recipe_hops`. |
| `apps/api/drizzle/meta/_journal.json` | **Exactly one appended `idx: 7` entry.** Entries `idx: 0`..`idx: 6` byte-unchanged. Mechanically-unavoidable drizzle-kit output, listed here rather than on Untouched on the M3_P1/M4_P1 precedent for this file. |
| `apps/api/src/repositories/batchRepository.ts` | `+ listReadings/createReading/updateReading/deleteReading/findByIdWithReadings`; `create()` and `update()` carry `measuredOg`; `update()` additionally accepts and writes `fermentationStartDate` **only** when the route computes a first-transition value (a distinct explicit parameter, never merged in from `BatchWriteInput`). **`update()`'s `.set()` literal must still name no snapshot column** — `stats_snapshot` and `recipe_snapshot` stay structurally unwritable there. |
| `apps/api/src/routes/batches.ts` | `ALLOWED_TRANSITIONS` replaced by `canTransitionBatchStatus`; the three reading routes added; the `fermentationStartDate` write-once rule; the `preValidation` hook rejecting a `fermentationStartDate` key in a batch body; the stale M4-era comment corrected (§2.6). The `POST /api/batches` create path — including the single `calculateRecipeStats` call that produces `statsSnapshot` — is otherwise unchanged. |
| `apps/api/src/routes/schemas.ts` | `batchStatusEnum` derived from `BATCH_STATUSES`; `batchWriteBodySchema` `+ measuredOg` (required key, nullable value, bounded); `+ readingWriteBodySchema`. **No other schema in this file changes**, and no ajv option changes. |
| `apps/web/src/api/client.ts` | `+ createReading/updateReading/deleteReading`; `getBatch` return type `Batch → BatchWithReadings`; `updateBatch` return type `Batch → BatchWithReadings`. `listBatches` stays `Promise<Batch[]>`. **No `fetch` call is added outside this file.** |
| `apps/web/src/pages/BatchDetail.tsx` | Readings held in component state and hydrated from `BatchWithReadings`; `<ReadingLog>` and `<FermentationChart>` rendered; the attenuation panel; a `measuredOg` input in the edit form; the status `<select>` fed by `allowedNextStatuses(batch.status)`; a **third** error state for reading mutations, separate from both `error` and `saveError`. **The existing `statsSnapshot` read path, the `(recalculated)` label, and the measured-efficiency `useMemo` block (lines 59-87) are byte-unchanged** apart from being inside the same hook. All hooks stay above both early returns. |
| `apps/web/src/pages/BatchList.tsx` | The status badge's two-branch ternary becomes an exhaustive mapping over `BATCH_STATUSES` so `'Fermenting'` renders distinctly instead of falling into the `Brewing` branch. **Nothing else in this file changes.** |
| `apps/web/test/helpers/fixtures.ts` | **Narrow named exception.** `baseBatch()` builds a full `Batch` literal, which stops compiling the moment `Batch` gains two required keys — the same forced-fallout class as M2_P1's `brewingMath.test.ts` and M3_P2's `equipment.migration.test.ts`. Exactly two things: `baseBatch()` gains `measuredOg: null` and `fermentationStartDate: null`; and a new `baseBatchWithReadings(overrides?: Partial<BatchWithReadings>): BatchWithReadings` helper is added, defaulting `readings: []`. **`baseBatch()`'s existing keys, its `statsSnapshot: calculateRecipeStats(recipeSnapshot)` default and its doc comment are otherwise byte-unchanged**, and no other helper in the file is touched. |
| `apps/web/test/App.test.tsx` | **Narrow named exception.** Exactly one forced edit: line 117's `mockedGetBatch.mockResolvedValue(createdBatch)` no longer typechecks once `getBatch` returns `BatchWithReadings`, so `createdBatch` is built with `baseBatchWithReadings(...)` (or the same object spread with `readings: []`). **No test added or removed, no assertion changed, no other line touched.** Adjacent comment lines are the only further latitude. |
| `apps/api/test/batches.test.ts` | Existing `PUT` bodies gain `measuredOg: null` (forced — required key); the AC-12 block is **byte-unchanged in its assertions**; new cases for `measuredOg` round-trip and the `fermentationStartDate` write-once rule. |
| `apps/api/test/seed.test.ts` | **Narrow named exception — added by the 2026-08-08 amendment (§4 deviation 10).** §1.2's mandated `batch_readings` table mechanically breaks this file's hardcoded structural table count, and the fix has no interpretive latitude: the same forced-fallout class as M2_P1's `brewingMath.test.ts`, M3_P2's `equipment.migration.test.ts` / `errors.test.ts` and M4_P1's `scaling.test.ts`. **Exactly two things, both inside the existing `AC-18` `it` block:** (i) the `expect(tableNames.length).toBe(…)` assertion value changes `15` → `16`; (ii) the single explanatory comment line immediately above it — `// M3_P2 adds 4 tables. M4_P1 adds 1 table (batches): 10 + 4 + 1 = 15.` — is replaced by a comment restating the arithmetic as `10 + 4 + 1 + 1 = 16` and naming this forced-fallout precedent (the landed form runs to 6 lines; length is not constrained, content is: it must state the arithmetic and cite the precedent, and must claim nothing else). **Everything else in the file is byte-unchanged** — every `describe` and `it` title (including `AC-18`'s existing *"migrations create all 10 tables"* wording, which is deliberately **not** re-counted here), the `sqlite_master` query, every `import`, and the whole `AC-19` block. **No test is added or removed, and no other assertion value changes.** |
| `apps/web/test/BatchDetail.test.tsx` | `getBatch` mocks return `BatchWithReadings`; new blocks for the attenuation, suppression, labelling, lockstep and error-isolation criteria. **The AC-12 `vi.hoisted` block and its four existing tests are byte-unchanged in their assertions.** |
| `apps/web/test/BatchList.test.tsx` | `+ one case` asserting the `Fermenting` badge renders distinctly. Existing cases unchanged. |

**Untouched — must be byte-unchanged:**

`packages/shared-types/src/brewing.ts` (in particular `HopItem` and `HopUse`); `packages/shared-types/src/misc.ts`; `packages/shared-types/src/schedules.ts`; `packages/shared-types/src/api.ts`; `packages/shared-types/src/index.ts`; `packages/calculations/src/brewingMath.ts`; `packages/calculations/src/constants.ts`; `packages/calculations/src/units.ts`; `packages/calculations/src/scaling.ts`; `packages/calculations/src/mash.ts`; every existing file under `packages/calculations/test/` (`brewingMath.test.ts`, `equipmentDriven.test.ts`, `fixtures.test.ts`, `mash.test.ts`, `mashPlan.test.ts`, `scaling.test.ts`, `units.test.ts`, `water.test.ts`, `fixtures/**`); `packages/better-sqlite3-shim/**`; `apps/api/src/db/client.ts`; `apps/api/src/db/migrate.ts`; `apps/api/src/db/seed.ts`; `apps/api/src/db/seedCli.ts`; `apps/api/src/errors.ts`; `apps/api/src/index.ts`; `apps/api/src/server.ts`; `apps/api/src/mappers/recipeMapper.ts`; `apps/api/src/repositories/{catalogRepository,equipmentRepository,recipeRepository,scheduleRepository}.ts`; `apps/api/src/routes/{catalog,equipment,health,recipes,schedules}.ts`; **`apps/api/drizzle/0000_*.sql` … `0006_*.sql` and `meta/0000_snapshot.json` … `meta/0006_snapshot.json`**; every existing file under `apps/api/test/` other than `batches.test.ts` **and `seed.test.ts`** (both of which are named exceptions in the Modified table above) — i.e. `batches.migration.test.ts`, `dryhop.roundtrip.test.ts`, `equipment.crud.test.ts`, `equipment.migration.test.ts`, `errors.test.ts`, `hops.migration.test.ts`, `recipes.cascade.test.ts`, `recipes.crud.test.ts`, `recipes.restart.test.ts`, `scaling.integration.test.ts`, `schedules.crud.test.ts`, `schedules.migration.test.ts`, `helpers/**`; `apps/web/src/App.tsx`; `apps/web/src/main.tsx`; `apps/web/src/index.css`; `apps/web/src/hooks/useRecipeEditor.ts`; `apps/web/src/context/CatalogContext.tsx`; `apps/web/src/utils/srmColor.ts`; `apps/web/src/types/brewing.ts`; every existing file under `apps/web/src/components/` (`EquipmentForm.tsx`, `EquipmentManager.tsx`, `FermentableSection.tsx`, `FermentationProfileForm.tsx`, `FermentationProfileManager.tsx`, `HopSection.tsx`, `MashProfileForm.tsx`, `MashProfileManager.tsx`, `MashSection.tsx`, `MiscSection.tsx`, `RecipeLibrary.tsx`, `SaveBar.tsx`, `StatsHeader.tsx`, `YeastSection.tsx`); `apps/web/test/{EquipmentManager,HopSection,MashProfileManager,MashSection,RecipeLibrary,useRecipeEditor}.test.tsx`; `apps/web/test/setup.ts`; `apps/web/vitest.config.ts`; **root `package.json`, `apps/*/package.json`, `packages/*/package.json` and `package-lock.json`** — no dependency is added, removed or version-bumped by this phase; `scripts/typecheck-all.mjs`; `tsconfig*.json`; `CLAUDE.md`; `README.md`; `.oxlintrc.json`; `.claude/**`; `.agents/**`; every path under `.gsd/` except `.gsd/active/M5_P1_feature_spec.md`, `.gsd/STATE.json`, `.gsd/active/manual_verification/**` and the two AC-50 manifest files.

> **Note on `HopItem`, `recipe_hops` and `HopSection.tsx`.** All three are on the Untouched list *specifically* because the `DryHop` `timeMinutes` retirement M4_P1 assigned to "M5" is placed in **M5_P2** (§4 deviation 9). If execution finds itself editing any of them, that is the signal to stop and route back to `/plan`, not to proceed.

> **Note on `packages/calculations/src/constants.ts`.** It is Untouched deliberately: `packages/calculations/test/units.test.ts` asserts a **closed list of exactly 15 exported constant names**, and that test file is also Untouched. This phase adds no formula coefficient, so nothing needs to go there; `BATCH_STATUSES` and `BATCH_STATUS_TRANSITIONS` live in the new `batchPipeline.ts` module instead.

---

## 2. Transformations & Pure Logic

No function in this section performs I/O, reads a clock (`Date.now()`, zero-argument `new Date()`), generates an id, or touches `Math.random`. `Date.parse` on a caller-supplied string is not a clock read.

### 2.1 Batch pipeline — `packages/calculations/src/batchPipeline.ts`

```ts
import type { BatchStatus } from '@truchabrew/shared-types';

export const BATCH_STATUSES: readonly BatchStatus[] = ['Planning', 'Brewing', 'Fermenting'];

/**
 * The ONE allow-list. Every entry includes the status itself, because
 * re-saving measurements without changing status must always be permitted.
 * Order within each array is the order the UI offers.
 */
export const BATCH_STATUS_TRANSITIONS: Readonly<Record<BatchStatus, readonly BatchStatus[]>> = {
  Planning:   ['Planning', 'Brewing'],
  Brewing:    ['Brewing', 'Fermenting'],
  Fermenting: ['Fermenting'],
};

/** Total over the union. Returns false for any unrecognised value without throwing. */
export function canTransitionBatchStatus(from: BatchStatus, to: BatchStatus): boolean;

/** The exact array from BATCH_STATUS_TRANSITIONS, or [] for an unrecognised `from`. Never null. */
export function allowedNextStatuses(from: BatchStatus): readonly BatchStatus[];
```

`canTransitionBatchStatus` must be **defensive against values outside the union**, because its API caller receives a JSON-Schema-validated string but its web caller receives a `<select>` value: an unknown `from` returns `false` rather than throwing on an undefined index. `BATCH_STATUSES` order is `Planning, Brewing, Fermenting` and is the order the status `<select>` renders.

### 2.2 Ordering and selection — `packages/calculations/src/fermentation.ts`

```ts
export interface FermentationReadingPoint {
  id: string;
  readingTime: string;
  sg: number | null;
  tempC: number | null;
}

/**
 * A NEW array, ascending by Date.parse(readingTime), ties broken by `id`
 * lexicographic ascending. Never mutates the input. A readingTime that does
 * not parse sorts LAST (after every parseable one), ties among unparseable
 * ones broken by `id` — deterministic rather than NaN-dependent, even though
 * the route contract makes it unreachable.
 */
export function sortReadings<T extends { id: string; readingTime: string }>(readings: readonly T[]): T[];

/**
 * The LAST element of sortReadings(readings) whose `sg !== null`. `null` when
 * the array is empty or every element has `sg === null`. Deliberately NOT
 * "the last reading" — a temperature-only reading logged after a gravity
 * reading must not blank the attenuation figure.
 */
export function latestGravityReading<T extends FermentationReadingPoint>(readings: readonly T[]): T | null;

export type OriginalGravitySource = 'measured' | 'estimated';
export interface ResolvedOriginalGravity { og: number; source: OriginalGravitySource; }

/** measuredOg !== null wins. Never a falsy check — a stored 0 is not absence. */
export function resolveOriginalGravity(measuredOg: number | null, estimatedOg: number): ResolvedOriginalGravity;
```

### 2.3 Fermentation progress — `packages/calculations/src/fermentation.ts`

```ts
export interface FermentationProgressInput {
  readings: readonly FermentationReadingPoint[];
  measuredOg: number | null;
  estimatedOg: number;
  fermentationStartDate: string | null;
}

export type FermentationProgress =
  | { hasGravityReading: false }
  | {
      hasGravityReading: true;
      originalGravity: number;
      originalGravitySource: OriginalGravitySource;
      latestSg: number;
      latestReadingId: string;
      latestReadingTime: string;
      apparentAttenuationPct: number;   // UNROUNDED, unclamped; may be negative
      elapsedHours: number | null;      // null iff no t0 can be established
    };

/** Pure. Never throws. */
export function calculateFermentationProgress(input: FermentationProgressInput): FermentationProgress;
```

- `hasGravityReading` is `false` **iff** `latestGravityReading(readings) === null`. In that case the returned object's `Object.keys(...)` is **exactly** `['hasGravityReading']`.
- `apparentAttenuationPct` is `apparentAttenuationPct(resolved.og, latest.sg)` from `brewingMath.ts` — **imported, not reimplemented**. Unrounded and unclamped (§Resolved Ambiguities).
- `elapsedHours` is measured from `t0` (§2.4's precedence) to `latestReadingTime`. It is `null` only when `readings` is empty, which is unreachable on the `hasGravityReading: true` branch — so in practice it is always a number there; the `null` arm exists so the type never forces a fabricated `0`.

### 2.4 Chart model — `packages/calculations/src/fermentation.ts`

```ts
export interface ChartPoint {
  readingId: string;
  elapsedHours: number;      // may be negative
  sg: number | null;
  tempC: number | null;
}

export interface ChartAxis {
  min: number;
  max: number;
  ticks: number[];           // exactly 5, ascending, ticks[0] === min, ticks[4] === max
}

export interface FermentationChartInput {
  readings: readonly FermentationReadingPoint[];
  fermentationStartDate: string | null;
}

export type FermentationChartModel =
  | { hasPoints: false }
  | {
      hasPoints: true;
      t0: string;                        // the ISO instant elapsedHours is measured from
      points: ChartPoint[];              // sortReadings order; elapsedHours ascending
      timeAxis: ChartAxis;
      gravityAxis: ChartAxis | null;     // null iff no point has sg !== null
      temperatureAxis: ChartAxis | null; // null iff no point has tempC !== null
    };

/** Pure. Never throws. Never returns NaN or Infinity in any numeric field. */
export function buildFermentationChartModel(input: FermentationChartInput): FermentationChartModel;
```

**`t0` precedence, binding:** `fermentationStartDate !== null` → that value; otherwise `sortReadings(readings)[0].readingTime`. `elapsedHours = (Date.parse(t) - Date.parse(t0)) / 3600000`, unrounded, **not clamped at zero**.

**Axis construction, binding, in order:**
1. Collect the series values — `elapsedHours` for the time axis, the non-`null` `sg` values for gravity, the non-`null` `tempC` values for temperature.
2. If a value set is **empty**, that axis is `null` (only possible for gravity and temperature; the time axis always has at least one value on the `hasPoints: true` branch).
3. `min = Math.min(...values)`, `max = Math.max(...values)`.
4. If `min === max`, widen to `[min - pad, max + pad]` with `pad = 1` (time, hours), `0.005` (gravity), `1` (temperature).
5. `ticks = [0,1,2,3,4].map(i => min + i * (max - min) / 4)`, with `ticks[0]` set to exactly `min` and `ticks[4]` set to exactly `max` so the endpoints are exact rather than accumulated.

### 2.5 No-match / fallback contracts

| Condition | Contract |
|---|---|
| `readings.length === 0` | `buildFermentationChartModel` → `{ hasPoints: false }`, keys exactly `['hasPoints']`. `calculateFermentationProgress` → `{ hasGravityReading: false }`, keys exactly `['hasGravityReading']`. The caller renders **no chart, no axis, no attenuation figure, and no placeholder** — not `—`, not `0`, not `0.0 %`, not `NaN`, not an empty axis frame. |
| Readings exist but none has `sg !== null` | `hasGravityReading: false` as above; the chart still renders with `gravityAxis: null` and a temperature line only. Attenuation is **suppressed**, not zeroed. |
| Readings exist but none has `tempC !== null` | `temperatureAxis: null`; gravity line only. |
| `measuredOg === null` | `originalGravitySource === 'estimated'`; the on-screen attenuation figure carries a visible label naming the estimate as its basis. **A figure derived from an estimate never occupies an unlabelled slot next to measured data.** |
| `batch.statsSnapshot === null` (pre-0006 legacy row) | `estimatedOg` comes from the existing labelled `(recalculated)` recompute path. The attenuation figure then carries **both** markers — it is estimated *and* recalculated — and neither is dropped. |
| Latest gravity reading is **above** OG | `apparentAttenuationPct` is negative and is displayed as-is (§Resolved Ambiguities). Not clamped, not hidden. |
| `latestGravityReading` returns a reading whose `sg` equals OG exactly | `0` is a real value and is displayed as `0.0 %` — the one case where `0` in that slot is legitimate. The suppression rule is keyed on `hasGravityReading`, **never** on the attenuation number being falsy. |
| Unknown `readingId`, or a `readingId` belonging to a different batch | `404 NOT_FOUND`; **nothing is written** and no other batch's row is touched. |

### 2.6 Stateful integration contract — `apps/web/src/pages/BatchDetail.tsx`

- **Hook discipline.** Every hook — including the new readings state, the new reading-error state, and the memo producing `FermentationProgress` / `FermentationChartModel` — is declared **above** both existing early returns (`if (error)`, `if (!batch)`). This is M4_P1 finding F-2's regression guard and it is re-asserted by **AC-39**.
- **Error-state isolation, three states not two.** `error` gates the full-page load-failure early return. `saveError` gates the batch-save banner. A **third**, separate `readingError` gates reading-mutation failures. Reusing `error` for a failed reading write would blank the entire page — the exact second-order bug M4_P1's repair pass caught in `handleSave`. A failed reading write leaves the log, the chart, the entered values and the open form **all on screen**.
- **Lockstep.** In the render immediately following a successful reading create, edit or delete, the reading table, the chart and the attenuation figure **all** reflect the new set, derived from the same `readings` array reference in one memo. No component shows a stale value for one render, and no second fetch is required for them to agree.
- **The status `<select>` offers exactly `allowedNextStatuses(batch.status)`** — never a hand-written array, and never a status the server would reject. When that array has length 1 (i.e. `Fermenting`), the select still renders, showing only the current status.
- **`measuredOg` is an edit-form field** alongside the existing measured values, submitted in the same `PUT` body, with the same `!== null` display discipline the existing measured fields use.
- **Frozen figures stay frozen.** The `statsSnapshot` read path, the `(recalculated)` label and the measured-efficiency block are behaviourally unchanged; no new call to `calculateRecipeStats` is introduced anywhere.

### 2.7 Refactoring & legacy cleanup

1. **Three hand-maintained status lists collapse to one.** `ALLOWED_TRANSITIONS` (`routes/batches.ts:17-20`), the `batchStatusEnum` literal (`routes/schemas.ts:261`) and `BATCH_STATUS_OPTIONS` (`BatchDetail.tsx:6`) are all removed as independent definitions and re-derived from `BATCH_STATUS_TRANSITIONS` / `BATCH_STATUSES`. Enforced by **AC-41**.
2. **A stale comment is corrected.** `routes/batches.ts:11-16` currently reads, in part, *"every other transition — including every status the pre-fix UI used to offer (Fermenting/Conditioning/Completed) … is 400"*. `Fermenting` is now a legal target and that sentence becomes actively misleading. It is rewritten to describe the imported allow-list and to name `Conditioning`/`Completed` as **M5_P2** additions. Same class as M3_P2's AC-45 inert-field-lie correction. Enforced by **AC-42**.
3. **No calculation duplication.** `apparentAttenuationPct` is imported from `brewingMath.ts`; `fermentation.ts` must not contain a second attenuation expression. Enforced by **AC-9**.
4. **Nothing else is retired.** In particular `HopItem.timeMinutes`, `recipe_hops.time_minutes` and migration `0005` are **not** touched (§4 deviation 9).

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | **Status inventory is a closed list** | Unit | `BATCH_STATUSES` is exactly `['Planning','Brewing','Fermenting']` in that order — no more, no fewer, no `'Conditioning'`, no `'Completed'`. `BATCH_STATUS_TRANSITIONS` has exactly those three keys, and each value contains its own key. |
| AC-2 | **Transition matrix, all 9 ordered pairs** | Unit | `canTransitionBatchStatus` returns `true` for exactly `(Planning,Planning)`, `(Planning,Brewing)`, `(Brewing,Brewing)`, `(Brewing,Fermenting)`, `(Fermenting,Fermenting)` and `false` for the other 4 — in particular `(Brewing,Planning)`, `(Fermenting,Brewing)`, `(Planning,Fermenting)` (no stage skipping) and `(Fermenting,Planning)`. An unrecognised `from` or `to` (e.g. `'Completed' as BatchStatus`, `'' as BatchStatus`) returns `false` **without throwing**. |
| AC-3 | `allowedNextStatuses` exact arrays | Unit | `'Planning'` → `['Planning','Brewing']`; `'Brewing'` → `['Brewing','Fermenting']`; `'Fermenting'` → `['Fermenting']`; an unrecognised value → `[]`, never `undefined` and never a throw. |
| AC-4 | **`resolveOriginalGravity` precedence is `!== null`, not falsy** | Unit | `(1.056, 1.052)` → `{ og: 1.056, source: 'measured' }`; `(null, 1.052)` → `{ og: 1.052, source: 'estimated' }`; **`(0, 1.052)` → `{ og: 0, source: 'measured' }`** — a stored `0` is a present value, not absence. Asserted in all three directions. |
| AC-5 | **`sortReadings` order, tie-break and purity** | Unit | Given readings out of order, the result is ascending by `readingTime`; two readings sharing a `readingTime` come back ordered by `id` ascending; the returned array is **not** the input array (`!==`) and the input's element order is unchanged after the call; an unparseable `readingTime` sorts last. |
| AC-6 | **`latestGravityReading` skips gravity-less readings** | Unit | With readings `[t1 sg=1.048, t2 tempC=19 sg=null, t3 tempC=18 sg=null]`, the result is the **t1** reading — not `t3` and not `null`. With `[]` → `null`. With every `sg === null` → `null`. With two same-time gravity readings, the `id`-ascending-last one wins. |
| AC-7 | **No-gravity progress contract** | Unit | `calculateFermentationProgress` with `readings: []`, and again with readings that all have `sg === null`, returns an object where `hasGravityReading === false` and `Object.keys(...)` is **exactly** `['hasGravityReading']` — no `originalGravity`, no `apparentAttenuationPct`, nothing to read by accident. |
| AC-8 | **Progress happy path is pinned numerically** | Unit | With `measuredOg: 1.056`, `estimatedOg: 1.052`, latest gravity reading `sg: 1.012` at `2026-08-03T18:00:00.000Z` and `fermentationStartDate: '2026-08-01T12:00:00.000Z'`: `originalGravity === 1.056`, `originalGravitySource === 'measured'`, `latestSg === 1.012`, `apparentAttenuationPct` equals **`78.57142857142857`** within `1e-9`, and `elapsedHours` equals **`54`** exactly. Repeating with `measuredOg: null` gives `originalGravity === 1.052`, `source === 'estimated'` and `apparentAttenuationPct` equal to **`76.92307692307692`** within `1e-9` — proving the basis actually moves the number. |
| AC-9 | **Attenuation is reused and unclamped** | Unit + Verification | A reading **above** OG (`og 1.052`, `sg 1.060`) yields a **negative** `apparentAttenuationPct` (≈ `-15.38`), not `0`; `sg === og` yields exactly `0`. And `fermentation.ts` contains **no** second implementation: `grep -n "og - fg\|(og - 1)\|131.25\|76.08" packages/calculations/src/fermentation.ts` returns **zero** matches, while the file imports `apparentAttenuationPct` from `./brewingMath`. |
| AC-10 | **`t0` precedence and negative elapsed time** | Unit | With `fermentationStartDate` non-`null` and an earlier first reading, `t0` is the `fermentationStartDate` and the first point's `elapsedHours` is **negative** (not `0`, not dropped). With `fermentationStartDate: null`, `t0` is the earliest reading's time and that point's `elapsedHours` is exactly `0`. Both asserted against the returned `t0` field. |
| AC-11 | **Empty chart contract** | Unit | `buildFermentationChartModel({ readings: [], fermentationStartDate: null })` returns an object where `hasPoints === false` and `Object.keys(...)` is **exactly** `['hasPoints']`. Also returns `hasPoints: false` when `readings: []` and `fermentationStartDate` is non-`null` — a start date alone is not a point. |
| AC-12 | **Single-reading degenerate axes, exact pads** | Unit | One reading, `sg: 1.048`, `tempC: null`, `fermentationStartDate: null`. `timeAxis` is `{ min: -1, max: 1 }`; `gravityAxis` is `{ min: 1.043, max: 1.053 }` within `1e-9`; `temperatureAxis === null`. A sweep over **every** numeric field of the returned object finds no `NaN` and no `Infinity`. A second case with one reading carrying only `tempC: 19` gives `temperatureAxis` `{ min: 18, max: 20 }` and `gravityAxis === null`. |
| AC-13 | **Ticks are exactly five, evenly spaced, endpoints exact** | Unit | For every non-`null` axis in AC-12's and AC-15's cases: `ticks.length === 5`; `ticks[0] === min` and `ticks[4] === max` by strict equality (not tolerance); `ticks` strictly ascending; consecutive gaps equal within `1e-9`. AC-12's gravity axis gives `[1.043, 1.0455, 1.048, 1.0505, 1.053]` within `1e-9`. |
| AC-14 | **A series with no data has no axis — both directions** | Unit | `gravityAxis === null` **iff** no reading has `sg !== null`, asserted both ways (a mixed set with one `sg` yields a non-`null` gravity axis). Same for `temperatureAxis`/`tempC`. No axis is ever fabricated at `[0,1]` or `[0,0]`. |
| AC-15 | **Chart points are canonical, aligned and complete** | Unit | For a 5-reading set supplied out of order, `points` is in `sortReadings` order, `points[i].readingId` matches, `elapsedHours` is non-decreasing, and `points.length === readings.length` — a reading with `sg === null` is still a point (carrying `sg: null`), never dropped from the model. |
| AC-16 | **The pure module is pure** | Verification | `grep -n "Date.now\|new Date()\|Math.random\|randomUUID\|fetch(" packages/calculations/src/fermentation.ts packages/calculations/src/batchPipeline.ts` returns **zero** matches. Neither file imports from `apps/`, `drizzle-orm`, `fastify` or `react`. Every physical/temporal term either arrives as an argument or is derived from one. |
| AC-17 | **Migration `0007` is additive and does not rebuild `batches`** | Verification + Integration | `apps/api/drizzle/0007_*.sql` contains exactly one `CREATE TABLE ... batch_readings`, two `CREATE INDEX`, and two `ALTER TABLE ... batches ADD COLUMN` statements — and **no** `CREATE TABLE __new_batches`, no `DROP TABLE batches`, no `INSERT INTO batches ... SELECT`. After the full `0000`→`0007` chain on a fresh DB, `PRAGMA foreign_key_list('batches')` still reports `recipe_id → recipes.id` with `on_delete = RESTRICT`, and `PRAGMA table_info('batches')` reports `recipe_snapshot` with `notnull = 1`, `stats_snapshot` `notnull = 0`, `measured_og` `notnull = 0`, `fermentation_start_date` `notnull = 0`. |
| AC-18 | **Nothing earlier moves** | Verification | `apps/api/drizzle/0000_*.sql` … `0006_*.sql` and `meta/0000_snapshot.json` … `meta/0006_snapshot.json` are content-identical to their pre-execution state (AC-50's manifest is the check). `meta/_journal.json` differs by **exactly one appended `idx: 7` entry**, with `idx: 0`..`idx: 6` byte-unchanged. |
| AC-19 | **Readings cascade with their batch, and the table's shape is right** | Integration | `PRAGMA foreign_key_list('batch_readings')` reports `batch_id → batches.id` with `on_delete = CASCADE`. Deleting a batch row directly at the DB level removes exactly that batch's readings and leaves every other batch's readings intact (row counts asserted). `PRAGMA table_info('batch_readings')` reports `comment` with `notnull = 1` and a `''` default, `sg`/`temp_c`/`ph`/`pressure_psi` all `notnull = 0`, and **no** `position` column. |
| AC-20 | **Migration applies to real data without a wipe** | Integration | A database populated through `0006` — including at least one `batches` row with a non-`null` `stats_snapshot` and one recipe with line items — is migrated to `0007`: the batch row is still present, `recipe_snapshot` and `stats_snapshot` are **byte-identical** to before, `measured_og` and `fermentation_start_date` are `NULL`, and the row count of every pre-existing table is unchanged. **No delete-and-reseed of any database is required by this phase, and none may be performed.** |
| AC-21 | **Create a reading and read it back in canonical order** | Integration | `POST /api/batches/:id/readings` returns `201` with a server-minted `id`, the submitted `readingTime`, and `batchId` equal to the path parameter. Posting three readings **out of chronological order** and then `GET /api/batches/:id` returns them ascending by `readingTime`; a fourth posted with a duplicate `readingTime` lands adjacent to its twin ordered by `id`. `POST` to an unknown batch id is `404 NOT_FOUND` and writes nothing. |
| AC-22 | **Edit, delete, and cross-batch isolation** | Integration | `PUT` replaces all six writable fields (a field omitted from the body is `400`, never retained — see AC-26) and returns `200`; `DELETE` returns `204` with an empty body and the row is gone. `PUT` and `DELETE` on an unknown `readingId` are `404`. `PUT` and `DELETE` on a `readingId` that exists but belongs to **another** batch are `404` and that other batch's reading is **unmodified** (re-read and compared field-for-field). |
| AC-23 | **Boundary validation, exact operators** | Integration | For each bound in Resolved Ambiguities: the stated rejected values return `400 VALIDATION_FAILED` and the stated admissible values return `201`/`200`. Explicitly covered: `sg` `0.899`→400, `0.900`→201, `1.200`→201, `1.201`→400, `null`→201; `tempC` `-20.01`→400, `-20`→201, `50`→201, `50.01`→400; `ph` `2.99`→400, `3`→201, `9`→201, `9.01`→400; `pressurePsi` `-0.01`→400, `0`→201, `60`→201, `60.01`→400; `comment` `''`→201, a 2000-char string→201, a 2001-char string→400, `null`→400; `measuredOg` on the batch `0.899`→400, `0.900`→200, `1.200`→200, `1.201`→400, `null`→200. In every `400` case the reading/batch row count is unchanged and no row was partially written. |
| AC-24 | **`readingTime` is validated for both shape and reality** | Integration | `'2026-08-03T18:00:00Z'`→201; `'2026-08-03T18:00:00.000Z'`→201; `'2026-08-03T18:00:00+02:00'`→400; `'2026-08-03 18:00:00Z'`→400; `'2026-08-03'`→400; `''`→400; and **`'2026-13-45T99:00:00Z'`→400** — the case a pattern alone lets through, caught by the route's `Number.isNaN(Date.parse(...))` check. `grep -n "date-time" apps/api/src/routes/schemas.ts` returns **zero** matches (the `format` keyword is deliberately not relied on). |
| AC-25 | **A reading must carry at least one measurement** | Integration | A body with `sg: null` **and** `tempC: null` — even with a `comment`, a `ph` and a `pressurePsi` — returns `400 VALIDATION_FAILED` with a message naming both fields, and the reading count is unchanged. `sg` alone → `201`; `tempC` alone → `201`; both → `201`. Also asserted on `PUT`: a stored reading cannot be edited into the both-`null` state. |
| AC-26 | **Partial bodies are rejected, never merged** | Integration | A reading `PUT` body omitting `comment` (or any other of the six keys) returns `400 VALIDATION_FAILED` and the stored row is bit-identical to before the call. A batch `PUT` body omitting `measuredOg` likewise returns `400` — it is a **required key with a nullable value**, matching every other measured field. |
| AC-27 | **`fermentationStartDate` is not client-writable** | Integration | `PUT /api/batches/:id` with `fermentationStartDate` present in the body — with any value, including the batch's own current one and `null` — returns `400 VALIDATION_FAILED`, and the stored value is unchanged. Proved to come from the `preValidation` hook rather than from `additionalProperties: false`: with the hook removed, the same request would be accepted with the key silently stripped (asserted by a test that fails when the hook is deleted, on the M3_P1 AC-22 precedent). `fermentationStartDate` does **not** appear in `BatchWriteInput`. |
| AC-28 | **List stays lean; detail carries readings** | Integration | `GET /api/batches` returns objects with **no** `readings` key at all (`'readings' in body[0] === false`) for a batch that has three readings. `GET /api/batches/:id` for that same batch returns `readings.length === 3` in canonical order. A batch with none returns `readings: []`, never `null` and never an omitted key. |
| AC-29 | **The transition matrix holds over HTTP** | Integration | All 9 ordered `(from, to)` pairs driven through `PUT /api/batches/:id` against a real server: the 5 allowed pairs return `200` with the new status stored; the 4 disallowed pairs return `400 VALIDATION_FAILED` with the stored status **unchanged**. `status: 'Conditioning'`, `status: 'Completed'` and `status: 'garbage'` each return `400` from the JSON-Schema enum, and the enum is proved to be derived rather than hand-written by AC-41. |
| AC-30 | **`fermentationStartDate` is set once, by the right transition only** | Integration | A batch at `Brewing` with `fermentation_start_date IS NULL` transitioned to `Fermenting` comes back with a non-`null` ISO-8601 UTC `fermentationStartDate` matching the reading-time pattern. A second `PUT` (`Fermenting → Fermenting`, changing a measured value) leaves it **byte-identical**. A `Planning → Brewing` transition leaves it `null`. A `Planning → Planning` re-save leaves it `null`. Asserted by re-reading the row, not from the response alone. |
| AC-31 | **`measuredOg` round-trips** | Integration | `PUT` with `measuredOg: 1.056` stores and returns `1.056`; a subsequent `GET` returns `1.056`; `PUT` with `measuredOg: null` clears it back to `null`. The value survives closing the DB handle and reopening the file with a new connection and server instance. |
| AC-32 | **Frozen figures stay frozen across every new write path** | Integration + Verification | After creating a batch, then (a) posting, editing and deleting readings, (b) transitioning `Planning→Brewing→Fermenting`, and (c) saving `measuredOg`, the batch's `statsSnapshot` and `recipeSnapshot` are **byte-identical** to what they were at creation, re-read from the DB. `batchRepository.update()`'s `.set()` literal names **neither** snapshot column. And the deferred carryover does not widen: `grep -n "calculateRecipeStats" apps/web/src/pages/BatchDetail.tsx` returns **exactly one** call site (the existing labelled legacy branch), and the measured-efficiency block at the pre-phase `BatchDetail.tsx:59-87` is behaviourally unchanged. |
| AC-33 | **The status select cannot offer an illegal transition** | Component | Rendering the batch detail for a `Planning` batch, the status `<option>` values are exactly `['Planning','Brewing']`; for `Brewing`, exactly `['Brewing','Fermenting']`; for `Fermenting`, exactly `['Fermenting']` (the select still renders, with one option). Driven from `allowedNextStatuses`, not a literal — the negative control is AC-41's grep. |
| AC-34 | **Zero readings renders no chart and no placeholder** | Component | For a batch with `readings: []`, the DOM contains **no** chart `<svg>`, no axis tick text, and none of `—`, `0.0 %`, `NaN`, `Infinity` in the fermentation panel; an explicit "no readings yet" prompt renders instead. After one reading is added, the `<svg>` appears. |
| AC-35 | **Attenuation is suppressed without a gravity reading** | Component | For a batch whose readings are all temperature-only, no attenuation figure is rendered — specifically no `0`, `0.0 %`, `—`, `NaN` in that slot — while the temperature line **is** drawn. The suppression is keyed on `hasGravityReading`, proved by a companion case where the latest gravity reading equals OG exactly and `0.0 %` **is** rendered (a real zero is a number, not absence). |
| AC-36 | **An estimated basis is always labelled** | Component | With `measuredOg: null`, the attenuation figure is accompanied by a visible marker naming the estimate as its basis; with `measuredOg` set, that marker is **absent**. For a batch that is additionally `statsSnapshot: null`, both the estimate marker and M4_P1's `(recalculated)` marker are present simultaneously and neither is dropped. |
| AC-37 | **Lockstep: table, chart and attenuation move together** | Component | With `createReading` stubbed to resolve, adding a gravity reading through the form updates, **in the same render**, the reading table row count, the chart's point count (asserted on rendered point elements, not on a re-fetch), and the attenuation figure. No second `getBatch` call is required for them to agree (`getBatch` call count unchanged). The same is asserted for a delete. |
| AC-38 | **A failed reading write never blanks the page** | Component | With `createReading` stubbed to reject with an `ApiClientError`, the reading table, the chart, the batch header and the entered form values are **all still on screen**, an error banner shows the server's message, and the full-page `Error: …` early-return view is **not** rendered. Asserted separately for `updateReading` and `deleteReading`. |
| AC-39 | **Hooks are unconditional** | Component + Verification | In `BatchDetail.tsx`, every `useState`/`useEffect`/`useMemo` call appears **above** the first `return` statement in the component body (asserted by source-order check), and a successful batch load followed by a reading add renders without a React hooks-order warning or a blank screen — the M4_P1 F-2 regression test, extended to the new hooks. |
| AC-40 | **`Fermenting` renders distinctly in the batch list** | Component | `BatchList` given batches in all three statuses renders three visually distinct badges; the `Fermenting` badge's class string is not equal to the `Brewing` badge's, and no batch falls through to a default branch. |
| AC-41 | **Exactly one source of truth for statuses** *(corrected in place by the 2026-08-08 amendment — §4 deviation 11)* | Verification | **(a) The retired identifiers are gone.** `grep -rn "ALLOWED_TRANSITIONS" apps packages` returns **zero** matches; `grep -rn "BATCH_STATUS_OPTIONS" apps packages` returns **zero** matches; `apps/api/src/routes/batches.ts` drives its rejection through `canTransitionBatchStatus`. **(b) No consumer hand-maintains a second list.** `grep -rn "'Planning'" apps/api/src apps/web/src` (and likewise `'Brewing'`, `'Fermenting'`) returns matches **only** in display/styling code — e.g. a badge-class record keyed by status — and **never** a second transition table or a second status array. `batchPipeline.ts`'s own table is the sole definition and lives outside both of those trees. **(c) Each consumer is provably *derived* — proved by module substitution, at that consumer's own evaluation point, not by a grep.** *API side (evaluation point: module load).* In `apps/api/test/batchPipeline.derivation.test.ts`: with `@truchabrew/calculations` substituted (`vi.resetModules()` + `vi.doMock` spreading `importActual`) so that `BATCH_STATUSES` is `[...actual, 'Conditioning']`, a **fresh dynamic `import()`** of `apps/api/src/routes/schemas.ts` yields `batchWriteBodySchema.properties.status.enum` **containing `'Conditioning'`, length 4**; and a control case, importing the same module **without** the substitution, yields that enum **not containing `'Conditioning'`, length 3**. **Both halves are required** — the substituted case is what a hand-written literal fails, and the control is what proves the substituted case is not vacuously true. *Web side (evaluation point: call time, already exercised).* `apps/web/src/pages/BatchDetail.tsx` imports `allowedNextStatuses` and calls it in the JSX (`grep -n "allowedNextStatuses" apps/web/src/pages/BatchDetail.tsx` matches), and **AC-33** already asserts the rendered `<option>` values equal that function's exact output for all three statuses; no additional web test is required by this criterion. **(d) BINDING — what this criterion does *not* require, and why.** It does **not** require that mutating `BATCH_STATUSES` **in memory at runtime** widen an already-compiled AJV route schema, and **no test may be written asserting that** — it is false against this implementation and would be false against any reasonable one. Three independently sufficient reasons: (i) `BATCH_STATUSES` is declared `readonly BatchStatus[]`, so an in-memory extension is reachable only through a cast that defeats the very contract under test; (ii) Fastify compiles each route's JSON Schema **once, at route registration**, and ajv v8 additionally inlines a short `enum`'s members as literal comparisons at that point (its `loopEnum` threshold is 200), so **no** by-reference form of `batchStatusEnum` makes an already-compiled validator live, short of recompiling the schema per request or abandoning `enum` for a custom validate function; (iii) a validation schema that can be **widened at runtime** is a hazard, not a feature — an AJV contract earns its keep by being fixed and statically inspectable. Nor was "add a status to `BATCH_STATUSES` alone" ever the real workflow: `BatchStatus` is a TypeScript union in `packages/shared-types`, so M5_P2 will widen the union, `BATCH_STATUSES` and `BATCH_STATUS_TRANSITIONS` **together** and recompile — which is exactly the evaluation point (c) exercises. The drift risk this criterion exists to prevent is **separately hand-duplicated lists**, and (a)–(c) are what eliminate it. |
| AC-42 | **The stale M4-era comment is corrected** | Verification | `grep -n "Fermenting/Conditioning/Completed" apps/api/src/routes/batches.ts` returns **zero** matches. The retained comment describes the imported allow-list and names `Conditioning`/`Completed` as M5_P2 additions. No other comment in the file makes a claim about `Fermenting` being rejected. |
| AC-43 | **M1's fixture suite is bit-identical** | Unit (regression) | All six Montano fixtures produce a `CalculatedStats` deep-equal (strict `===` on all 17 fields) to their pre-phase values. `CalculatedStats` has exactly its 17 existing fields — no addition, rename or removal, and **no** attenuation, reading or fermentation field anywhere in it. `packages/calculations/test/fixtures.test.ts` is byte-unchanged and green. |
| AC-44 | **M2/M3/M4 guarantees still hold with reading data in the DB** | Integration (regression) | With a batch that has readings: M2's recipe restart round-trip (`canonicalRecipeJson`) still passes byte-identically; M3_P2's 3-step mash-profile order round-trip still passes; M4_P1's AC-1 snapshot immutability still passes — editing the source recipe leaves `recipe_snapshot` byte-identical; M4_P1's `DELETE /api/recipes/:id` `409 RECIPE_IN_USE` guard still fires for a recipe with a batch, and that batch's readings are untouched by the refused delete. |
| AC-45 | **All four gates, reported by exit code** | Command | From the repo root: `npm test` exits `0` with `0 failed`, reporting all three workspaces; `npm run typecheck` exits `0` and its per-workspace summary shows **every** workspace check ran; `npm run build` exits `0`; `npm run lint` exits `0` (pre-existing warnings on Untouched files excepted, new warnings not). All four are required — CLAUDE.md hard rule 13. |
| AC-46 | **Cold clone** | Command | From a clean checkout with no pre-existing DB file and no manual step: `npm install && npm test` exits `0`, with no codegen step. **`package-lock.json` is byte-unchanged** — this phase adds no dependency (§4 deviation 2). |
| AC-47 | **Manual — take a batch into Fermenting and log readings** | Manual | `npm run dev`. Open a saved Montano recipe, Brew This, advance the batch `Planning → Brewing → Fermenting`. Log three readings across three different times: `1.048 @ 20.0 °C`, `1.024 @ 21.0 °C` with a comment, `1.012 @ 19.5 °C` with a pH. The chart shows a falling gravity line and a temperature line on a second axis, the reading table lists all three in time order, and the attenuation figure reads a value consistent with the entered OG basis. Screenshot at `.gsd/active/manual_verification/M5_P1_fermentation_log.png`. |
| AC-48 | **Manual — restart and everything is still there** | Manual | Stop both processes, restart them, reopen the same batch: all three readings, their comments, the pH, the chart and the attenuation figure are exactly as left, and the status is still `Fermenting` with its `fermentationStartDate` reflected in the chart's time origin. Screenshot at `.gsd/active/manual_verification/M5_P1_restart.png`. |
| AC-49 | **Manual — a temperature-only reading does not blank the attenuation** | Manual | Add a fourth reading with a temperature but **no** gravity, logged after the third. The attenuation figure still reads the value derived from the third (gravity-bearing) reading — it does not disappear, does not go to `0`, and does not show `NaN`. Then delete the first reading and confirm the chart and figure both update in place without a page reload. Screenshot at `.gsd/active/manual_verification/M5_P1_temp_only.png`. |
| AC-50 | **Scope guardrail — SHA-256 content manifests, NOT `git diff`** | Verification | **`git diff --name-only` against any base commit is not viable in this repo and must not be used.** `git rev-list --count HEAD` is **1**; the sole commit `7d88e64` predates M1–M5 entirely, so a whole-tree diff returns every path from four completed milestones with no way to attribute any of them to this phase. This is the class of unverifiable criterion this project has now hit five times (M1 AC-42, M2 AC-11, M3_P1 AC-46, M3_P2 AC-64, M4_P1 AC-7). **Method, in order.** (a) **Before its first edit**, the executor writes `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum > .gsd/active/M5_P1_pre_exec_manifest.txt` and records the ISO-8601 UTC start time in `.gsd/STATE.json`. (b) After its last edit it writes `.gsd/active/M5_P1_post_exec_manifest.txt` the same way and records the end time. (c) The exact per-session delta is the symmetric difference of the two sorted manifests. `--exclude-standard` already excludes `node_modules`, `dist` and the gitignored dev DB `apps/api/data/*.db*`; the two manifest files, any companion `*_errors.txt`, and `.gsd/STATE.json` are excluded from the comparison **by name**. **Pass condition:** every path in that difference appears in §1.1's New table or §1.5's Modified table, and **no** path on §1.5's Untouched list appears in it — in particular `packages/shared-types/src/api.ts`, `packages/shared-types/src/brewing.ts`, `packages/calculations/src/constants.ts`, `packages/calculations/src/brewingMath.ts`, `apps/web/src/App.tsx`, `apps/web/src/components/HopSection.tsx`, `apps/api/drizzle/0000_*.sql`…`0006_*.sql` and their snapshots, root/workspace `package.json`, `package-lock.json`, `CLAUDE.md`, `README.md`, `.oxlintrc.json`, and everything under `.claude/`, `.agents/` and `.gsd/` other than this spec, `STATE.json`, `manual_verification/**` and the two manifests. **Fallback**, only if a manifest is missing: the M1 AC-42 mtime sweep against the recorded window — every path whose mtime falls inside `[start, end]` must be on a New/Modified list, and every Untouched path must have an mtime strictly earlier than `start`. |

---

## 4. Deviation Register — requires explicit sign-off at the halt gate

Eleven points where this spec departs from `ROADMAP.md`'s literal wording, from `.gsd/documents/brewfather_clone_build_spec.md`, from an established convention in this repo, or from a commitment made in a prior approved spec. Each is reversible at this gate.

> **Amendment note (2026-08-08).** **Entries 1–9 were signed off unqualified on 2026-08-07 and are *not* reopened by this amendment** — they are retained verbatim as the record of what was approved. **Entries 10 and 11 were added on 2026-08-08** and are the only items this amendment puts to the gate.

1. **Milestone 5 is split into two phases; the roadmap does not mandate a split.** The roadmap mandated M3's split explicitly and says nothing either way about M5. The split line is the roadmap's **own two hardening bullets**: bullet 1 (`Reading` entry and storage, the chart, live attenuation) is P1; bullet 2 (`Fermenting → Conditioning → Completed`, measured OG/FG/ABV/efficiency against the estimates, carbonation, tasting notes and rating) is P2, together with the MVP acceptance run. *Reasoning:* M5's verification threshold is **the MVP acceptance run** — the single most consequential verification event in the project, and the one the whole roadmap is pointed at. Doing it all in one pass puts roughly 65 criteria of brand-new surface (two child entities, three transitions, a chart, a new calculation module, and a comparison table) between here and that run, in a project whose last big-bang phase, M4_P1, needed three repair cycles and produced 14 critic findings including a live app-blanking crash. A split lets the fermentation-logging half be independently audited and hardened **before** the closing run is attempted on top of it. Each phase is still a vertical slice with its own user-visible outcome; P1 alone is genuinely usable (log a fermentation and watch it) rather than a horizontal layer. *Overrule and M5 is a single phase:* fold §5's entire preview into this spec — approximately 25–30 additional criteria covering two further transitions, `measuredFg`/`measuredAbv`/measured-attenuation, three carbonation functions with their own boundary matrix, `BatchNote`, tasting notes and rating, plus the MVP acceptance run — for roughly 75–80 criteria in one execute pass.

2. **The chart is a dependency-free inline SVG over a pure model, not Recharts or uPlot.** The roadmap says "gravity/temp chart (Recharts or uPlot)" — an explicit choice between two third-party renderers. This spec picks neither and adds **no** runtime dependency. *Reasoning, in order of weight.* (a) What this project's verification discipline actually needs pinned is the **plotting arithmetic** — domains, degenerate widening, tick placement, the null-series contract — and none of that is a library's job. Once it is a pure function (§2.4) with 5 criteria against it, the renderer is roughly 120 lines of SVG with nothing left to get wrong. (b) The dataset is a handful of readings on a desk-only, single-user, self-hosted tool (`.gsd/DISCOVERY.md` Q2/Q4); neither library's real value — large-series performance, zoom, brushing — is reachable here. (c) A third-party renderer in this repo's `jsdom` + vitest setup needs explicit sizing or a `ResizeObserver` stub before it renders anything at all, which turns every chart criterion into an assertion about test scaffolding rather than about the chart. (d) `package-lock.json` stays byte-unchanged and the cold-clone guarantee (AC-46) is not put at risk by an install step. *Overrule and Recharts becomes the renderer* over the **same** pure model — §2.4's contract and AC-11 through AC-15 are unchanged; the cost is one dependency, a `jsdom` sizing shim in `apps/web/test/setup.ts` (currently Untouched), and `package-lock.json` moving off the Untouched list.

3. **`measuredOg` lands in P1, and live attenuation resolves measured-over-estimated rather than the roadmap's literal "snapshot OG".** The roadmap's bullet 1 says "live apparent attenuation from latest reading vs **snapshot OG**", and puts "measured OG/FG/ABV" in bullet 2. *Reasoning:* OG is measured **at pitch** — the end of brew day, i.e. exactly the `Brewing → Fermenting` boundary this phase owns — while FG is measured at the end of fermentation, which is P2's. Splitting them along the stage they are taken at is the natural line, and the alternative is worse: a brewer whose measured OG is `1.058` against an estimate of `1.052` would watch a wrong attenuation figure for the entire fermentation and then see it jump when P2 lands. The estimate is still the fallback and is always **labelled** as such (AC-36), so nothing is silently substituted. *Overrule and P1 uses `statsSnapshot.og` unconditionally:* drop `measured_og` from migration `0007`, drop `resolveOriginalGravity` and AC-4/AC-31, simplify AC-8 and AC-36, and P2 adds the column and re-baselines the attenuation figure.

4. **`fermentationStartDate` is added, though M5's roadmap bullets do not name it.** It is in build-spec §2's `Batch` shape, and it is what makes the chart's time origin mean "day 3 of fermentation" rather than "3 hours after whenever I happened to take my first sample". Without it, a batch with no readings yet has no timeline at all, and the first reading silently becomes the origin — which then **moves** if that reading is later deleted. Server-owned and write-once (§Resolved Ambiguities) so it cannot drift. *Overrule and the chart's origin is always the earliest reading*, `t0` precedence collapses to one rule, AC-10 and AC-30 shrink, and P2 adds the field when it needs a fermentation duration.

5. **Readings use per-item endpoints, not the full-replace child-collection pattern used everywhere else in this repo.** `recipe_fermentables`, `recipe_hops`, `mash_steps` and `fermentation_steps` are all rewritten wholesale by their parent's `PUT`. Readings are not. *Reasoning:* those collections are **authored as a set** in one form and are small and bounded; a reading log is **appended to over weeks** and grows without bound. Under full-replace, adding one reading means the client resending the entire log, and a client holding a stale copy silently destroys every reading added since it loaded — a data-loss mode with no counterpart in the step collections. Per-item endpoints also make `DELETE` mean "delete this reading" instead of "omit it and hope". The cost is three routes instead of zero and a `readingId`-scoping rule (AC-22). *Overrule and readings ride `PUT /api/batches/:id` as a full-replace array*, `ReadingWriteInput[]` joins `BatchWriteInput`, AC-21/AC-22 are rewritten as array-replace criteria on the `mash_steps` model, and the stale-client overwrite is accepted as a known behaviour.

6. **`BatchNote` is deferred to M5_P2, even though M5's verification threshold names "every note".** `BatchNote { timestamp, status, note }` is in build-spec §2 and was named in **Milestone 4's** hardening scope ("timestamped `BatchNote` entries") — and was never built; there is no `batch_notes` table, no type, no route. M5's threshold then requires "every note" to read back intact. *Reasoning for P2:* a `BatchNote` carries the **status it was written at**, and in P1 only three of the five statuses exist — building it here means shipping a field whose domain is knowingly incomplete, then revisiting it in P2 anyway. P2 also already owns the other free-text surface (tasting notes) and the full status set. A reading's `comment` field, which P1 does build, covers the "note attached to a data point" case in the meantime. *This deferral is disclosed rather than inherited: it is M4 carryover, it is named in M5's own threshold, and P2 cannot close the milestone without it.* *Overrule and `BatchNote` ships in P1:* one more table, one more type, three more routes and a note list — roughly 8 additional criteria — with `BatchNote.status` typed against a three-value union that P2 then widens.

7. **The M4_P1 measured-efficiency carryover is deferred to M5_P2 with a named mechanism, not fixed here and not deferred silently.** Full reasoning, cost and overrule path are in §Resolved Ambiguities; **AC-32** stops the deferral from widening. Flagged in the register because it is the second consecutive phase to defer it, and a second silent pass is exactly how M4_P1's AC-1 reached its third audit unresolved.

8. **The batch status allow-list is promoted into `packages/calculations`, a package named for brewing math.** It is not a calculation. *Reasoning:* it must be readable by both the Fastify route and the React `<select>`, and `packages/shared-types` is **types-only today** — it exports no runtime value at all, and making it value-emitting for one const changes what that package is. `packages/calculations` already houses pure non-arithmetic domain rules (`classifyHopUse`, `resolveSpargeTemperatureC`), already emits runtime values, and is already a dependency of both `apps/api` and `apps/web`. It goes in a **new module**, `batchPipeline.ts`, rather than `constants.ts`, so `units.test.ts`'s closed-list-of-15 assertion (and that Untouched test file) is not disturbed. *Overrule and it goes in `shared-types`* as that package's first runtime export, with a note that it is no longer type-only; nothing else in this spec changes.

9. **The `DryHop` `timeMinutes` retirement, which M4_P1's approved spec assigned to "M5", is placed in M5_P2.** M4_P1 states that "M5 introduces the fermentation timeline that a day-offset is measured *from*, and M5 owns both the real model and the migration that finally drops this column." P1 does introduce that referent (`fermentationStartDate`) — so the enabling condition is met here, and the deferral is a scheduling choice, not an oversight. *Reasoning:* the work is a `HopItem` model change plus a `recipe_hops` migration plus a `classifyHopUse` / `calculateSingleHopIbu` review, and M3_P2 deviation 5 already flagged that changing hop-timing semantics carries an **M1 IBU fixture re-baseline** risk. None of it advances this phase's outcome, and putting a hop-schedule migration in the same execute pass as the first reading-logging surface is how AC-43's regression guarantee gets muddied. `HopItem`, `HopUse`, `recipe_hops`, `classifyHopUse`, `calculateSingleHopIbu` and `HopSection.tsx` are all Untouched here and **AC-41**'s greps plus **AC-50**'s manifest enforce it. *Overrule and it ships in P1:* add the `HopItem` day-offset/duration model, a migration dropping `time_minutes`, and an M1 fixture re-verification — roughly 10 additional criteria and a reopened M1 tolerance argument.

10. **`apps/api/test/seed.test.ts` is carved off the Untouched list into a named §1.5 exception — added 2026-08-08, closing critic Finding 2 / AC-50 NO.** *What was wrong:* this spec contradicted itself. §1.5 named `seed.test.ts` on the Untouched list ("must be byte-unchanged") while §1.2 mandated the new `batch_readings` table, and that file asserts a **hardcoded structural table count**, `expect(tableNames.length).toBe(15)`. A new table mechanically makes `15` wrong. There was no implementation that could satisfy both clauses: leave the file alone and `npm test` fails (AC-45), fix the count and AC-50's scope guardrail fires. The critic reconstructed the landed edit cryptographically — reverting `toBe(16)` → `toBe(15)` and collapsing the 6-line comment back to its original single line reproduces the pre-execution hash `997523dd…` exactly — so the delta is provably **one assertion value plus its explanatory comment, and nothing else**. *Resolution:* the standing remedy this project has applied five times before (M2_P1's `brewingMath.test.ts`, M3_P2's `equipment.migration.test.ts` and `errors.test.ts`, M4_P1's `scaling.test.ts`, and this spec's own `fixtures.ts` / `App.test.tsx` exceptions) — move the file into §1.5's Modified table with the permitted edits enumerated exhaustively, and strike it from the Untouched enumeration. **This costs no follow-up work whatsoever: the change already in the tree is the correct and minimal one, and no code, test or comment needs to move.** It is a spec-text correction so that AC-50 stops reporting a violation that is really the spec's own arithmetic error. *Why the file was missed:* the spec **did** anticipate this class — the Known execution risks below call out the `Batch`-literal instance and grant `fixtures.ts` an exception for it — but it anticipated only the *type-driven* instance (a required key breaking an object literal) and not the *count-driven* one (a new table breaking a hardcoded total), even while enumerating `seed.test.ts` by name three lines away. *Alternative considered and rejected:* weaken AC-45 or AC-18 so the stale `15` could stand. Rejected outright — it would trade a true test for a green one, and `seed.test.ts`'s whole purpose is to notice when the schema's shape changes. *Overrule path:* none that preserves both a passing suite and an untouched file; the only alternative is to accept a knowingly-wrong assertion, which is not offered.

11. **AC-41 is corrected to the property that is actually true and testable, rather than making the AJV route enum runtime-mutable — added 2026-08-08, closing critic Finding 1 / AC-41 PARTIAL. This is the seventh recurrence of this project's unsatisfiable-criterion class** (M1 AC-42, M2 AC-11, M3_P1 AC-46, M3_P2 AC-64 and AC-11, M4_P1 AC-7 and AC-1), and the first one that reached an audit without being flagged at execution — a weaker test was written in its place and the gap left silent, which is the failure mode this entry exists to break. *What was wrong:* AC-41's final clause demanded "a test that extends the constant in-memory and checks both consumers follow". The critic ran that experiment and proved the property **false as literally written**: `allowedNextStatuses` reads `BATCH_STATUS_TRANSITIONS` at **call time** and does follow an in-memory extension, but `apps/api/src/routes/schemas.ts:267` is `const batchStatusEnum = [...BATCH_STATUSES];`, a one-time spread taken at **module load**, so the route enum does not. The only AC-41 test that exists is a source-grep for the absence of the retired identifiers — real and passing, but strictly weaker than the criterion demands. *Decision — path (a): reword the criterion; do not change the architecture.* Reasoning, in order of weight. (i) The rewritten criterion is **not a weakening**: a grep for the retired names would still pass against a cosmetic derivation (`const batchStatusEnum = ['Planning','Brewing','Fermenting']` with a comment citing `BATCH_STATUSES`), so AC-41(c) now demands a **module-substitution proof with a control** — substitute the source module, re-import the consumer, and the enum must actually widen; without the substitution it must not. That is strictly *stronger* than what shipped, and it is a build/re-import-time check rather than a runtime-mutation one. (ii) The architecture is already correct. There is exactly one definition of the statuses, both consumers derive from it, and the drift risk the criterion exists to prevent — two hand-maintained lists silently disagreeing — is genuinely gone. Only the criterion's account of *how* it is correct was wrong. (iii) The alternative, **path (b) — make `schemas.ts`'s enum runtime-dynamic** so an in-memory mutation test would genuinely pass — is rejected on the merits, not merely on cost: a route's JSON Schema is compiled once by Fastify at registration, so a by-reference read would not even achieve the stated goal without recompiling per request or replacing `enum` with a custom validate function; `BATCH_STATUSES` is `readonly`, so the test could only be written through a cast that defeats the contract; and a validation schema that can be **widened at runtime** is an anti-pattern — it converts a fixed, statically inspectable input contract into mutable global state, which is exactly the property you want a request validator *not* to have. (iv) "Adding a status to `BATCH_STATUSES` alone" was never the real workflow regardless: `BatchStatus` is a TypeScript union in `shared-types` that must widen in the same edit. *Cost of path (a):* **no source-code change of any kind.** One new test file, `apps/api/test/batchPipeline.derivation.test.ts` (§1.1), holding AC-41(c)'s substituted case and its control — that is the entire follow-up `/execute` scope arising from this entry. *Overrule path — take (b) instead:* `batchStatusEnum` becomes a function or getter over `BATCH_STATUSES` and the batch route's schema is compiled from it per request (or `enum` is replaced by a custom `validate` keyword); AC-41(c)/(d) are rewritten around a live-mutation assertion; add roughly 2 criteria covering per-request compilation cost and the behaviour when the array is widened between two in-flight requests. This is new implementation scope in `apps/api/src/routes/schemas.ts` and `batches.ts`, both of which are already on §1.5's Modified list, so it needs no file-table change — only a decision that a mutable-at-runtime validation schema is wanted here.

**Known execution risks** (not deviations — flagged so a miss routes to the right layer):

- **`drizzle-kit` may emit a `batches` table rebuild rather than two `ALTER TABLE ADD COLUMN` statements.** Both new columns are nullable with no default, so a rebuild should not be necessary — but if one is emitted, the `recipe_id → recipes.id ON DELETE RESTRICT` edge silently vanishes and M4's referential guarantee dies while every test still passes. **AC-17 exists specifically to catch this.** A failure there is a spec/tooling problem to route through `/diagnose`, not something to patch by hand-editing the generated SQL without re-checking the pragmas.
- **`Batch` gaining two required keys will surface as `tsc` errors at every `Batch` object literal.** The only one in the tree is `baseBatch()` in `apps/web/test/helpers/fixtures.ts`, which is named in §1.5's Modified table with its exact permitted edits. Fixed by supplying `null` — **never** by widening either field to optional. If a second literal turns up during execution, that is a §1.5 gap: stop and route back to `/plan` for a named exception rather than editing an Untouched file. This is the fifth consecutive phase where this exact class has caught the file tables out (M2_P1's `brewingMath.test.ts`, M3_P1's `RecipeLibrary.tsx`, M3_P2's two test files, M4_P1's `scaling.test.ts` and root `package.json`).
- **`getBatch`'s return type change from `Batch` to `BatchWithReadings` is a breaking change to a client function with two call sites** (`BatchDetail.tsx` and the `App.test.tsx` mock at line 117). Both are named in §1.5.
- **`removeAdditional: true` is still Fastify's repo-wide default** (M3_P1 critic Finding 1). `additionalProperties: false` alone will **not** reject `fermentationStartDate` in a batch body — it strips it silently, and the `PUT` would succeed while appearing to honour the rule. AC-27 requires the `preValidation` hook, on the `equipment.ts` precedent, and requires it to be proved as the actual mechanism.
- **`PRAGMA foreign_keys = ON` is set only via `openDatabase`** (`apps/api/src/db/client.ts`, Untouched). The `batch_readings` cascade is inert without it; **AC-19 proves the cascade actually fires** rather than assuming it from the schema declaration.
- **`apps/api/test/batches.migration.test.ts` is on the Untouched list and runs the full migration chain.** It should keep passing unchanged once `0007` is additive, since it asserts on `batches` columns it already knows about. If it breaks, that is evidence the migration is **not** additive (AC-17) — diagnose the migration, do not edit the test.

---

## 5. M5_P2 preview — not specced here, not built here

Recorded so P2 can be planned without re-deriving anything settled above. **Nothing in this section is in scope for this phase**, and no acceptance criterion above depends on it.

- **Pipeline.** `BatchStatus` gains `'Conditioning'` and `'Completed'`; `BATCH_STATUS_TRANSITIONS` gains `Fermenting: ['Fermenting','Conditioning']`, `Conditioning: ['Conditioning','Completed']`, `Completed: ['Completed']`. Because §2.1 is the single source of truth, the route enum and the UI select follow automatically **once the `BatchStatus` union, `BATCH_STATUSES` and `BATCH_STATUS_TRANSITIONS` are widened together and the tree is recompiled** — **AC-41(c)**'s module-substitution test is the proof that they will. *(Amended 2026-08-08, §4 deviation 11: the earlier wording promised an in-memory extension test; AC-41(d) now records why that is neither achievable against a compiled AJV schema nor desirable.)*
- **Measured closing values.** `measuredFg`, `measuredAbv`, `measuredAttenuation`, `measuredEfficiency`, `bottlingDate` on `batches`; a measured-versus-estimated comparison table against `statsSnapshot`. This is where the M4_P1 measured-efficiency carryover (§4 deviation 7) is fixed, by freezing the measured comparison figures when the batch reaches `Completed`.
- **Carbonation — build-spec §3.7, located and transcribed verbatim.** The source is `.gsd/documents/brewfather_clone_build_spec.md:245-259`; the formulas below are quoted from it, **not invented**, and P2 owns their promotion into `packages/calculations/src/carbonation.ts` under test:
  ```js
  const residualCO2 = (peakFermTempC) => 3.0378 - 0.050062*peakFermTempC + 0.00026555*peakFermTempC**2;

  function primingSugarG(volumesCO2Target, peakFermTempC, beerVolumeL) {
    const co2Needed = volumesCO2Target - residualCO2(peakFermTempC);
    return Math.max(0, co2Needed * 4 * beerVolumeL); // ~4 g sucrose per liter per volume of CO2
  }

  function forceCarbPSI(volumesCO2, tempC) {
    const tempF = tempC * 9/5 + 32;
    return -16.6999 - 0.0101059*tempF + 0.00116512*tempF**2 + 0.173354*tempF*volumesCO2
         + 4.24267*volumesCO2 - 0.0684226*volumesCO2**2;
  }
  ```
  Expected P2 signatures, following the `mash.ts` convention (every physical term an argument, no module-level kit value, input interfaces for multi-argument functions, coefficients named in `constants.ts` only if they are published formula coefficients rather than kit settings):
  ```ts
  export function residualCO2Volumes(peakFermentationTempC: number): number;
  export interface PrimingSugarInput { volumesCO2Target: number; peakFermentationTempC: number; beerVolumeL: number; }
  export function primingSugarG(input: PrimingSugarInput): number;          // clamped at 0, per the source
  export interface ForceCarbonationInput { volumesCO2: number; tempC: number; }
  export function forceCarbonationPsi(input: ForceCarbonationInput): number;
  ```
  **Two ambiguities P2 must resolve, flagged now:** (a) `primingSugarG`'s `4 g/L/volume` factor is **sucrose**; `Batch.primingSugarEquiv(g/L)` in build-spec §2 implies other sugars need a conversion factor that §3.7 does not supply — either restrict the UI to sucrose or introduce a named factor table with a source. (b) `forceCarbPSI` is a polynomial fit with **no stated valid domain**; it returns negative PSI at low volumes/temperatures, and P2 must decide the bound and the operator (a clamp at `0`, or a rejected input range) rather than displaying a negative pressure.
- **`carbonationTemp`, `carbonationType: Sugar|KegForce|KegForceQuick|KegSugar`, `carbonationForce(PSI)`, `primingSugarEquiv(g/L)`** on `batches`, per build-spec §2.
- **`BatchNote { timestamp, status, note }`** (§4 deviation 6) and **`tasteNotes` / `tasteRating` (1–5)**.
- **The `DryHop` `timeMinutes` retirement** (§4 deviation 9).
- **The MVP acceptance run**, per the roadmap: one Montano recipe through all five pipeline stages, closed as `Completed` with readings logged, full app restart, entire history read back intact, calculated attenuation and ABV from the measured OG/FG confirmed against a hand-calculation, with screenshot evidence in `.gsd/active/manual_verification/`. **This is what closes Milestone 5 and the MVP.**

---

> **HALT GATE (STATE 2) — NARROW FOLLOW-UP AMENDMENT. AWAITING re-SPEC_APPROVED.**
>
> **This amendment covers exactly two items and nothing else.** M5_P1 was approved on 2026-08-07, built, and audited; the critic returned **FAIL — 48/50**, and `/diagnose` found **both** non-passing criteria to be spec-layer defects rather than implementation defects (hard rule 4). **Still 50 acceptance criteria — `AC-1`…`AC-50` keep their numbers, nothing is renumbered, no AC is added.** Deviations **1–9 are settled and are not reopened**; the nine paragraphs below are retained **for context only**. The two live items are register entries **10** and **11**:
>
> **(A) AC-50 — `apps/api/test/seed.test.ts` (§4 deviation 10). No decision required; no code changes.** The spec contradicted itself: §1.5 required this file to be byte-unchanged while §1.2 mandated a new `batch_readings` table, which mechanically invalidates the file's hardcoded `expect(tableNames.length).toBe(15)`. The file has been moved into §1.5's Modified table as a named exception with its permitted edits enumerated exhaustively — the `15` → `16` assertion value and its explanatory comment, nothing else — and struck from the Untouched enumeration. The critic proved cryptographically that the landed change is exactly that and no more. **The code already in the tree is correct and minimal; this is purely a spec-text correction so AC-50 stops flagging the spec's own arithmetic error.**
>
> **(B) AC-41 — one source of truth for batch statuses (§4 deviation 11). A real decision, taken; overrule path stated.** AC-41 demanded "a test that extends the constant in-memory and checks both consumers follow", and the critic proved that property **false as written**: the web helper reads the transition table at call time and does follow, but `schemas.ts`'s `const batchStatusEnum = [...BATCH_STATUSES]` is a one-time spread taken at module load and does not. **Path (a) chosen — reword the criterion to the property that is actually true, and change no source code** — over path (b), making the AJV route enum runtime-mutable. *Reasoning:* the single-source architecture is already correct and the drift risk AC-41 exists to prevent is genuinely gone; Fastify compiles a route's schema **once** at registration, so path (b) would not even achieve its stated goal without per-request recompilation or abandoning `enum` for a custom validate function; and a validation schema that can be widened at runtime is an anti-pattern, not a feature. **Crucially the reword is not a weakening** — the old grep-only test would still pass against a *cosmetic* derivation, so AC-41(c) now requires a **module-substitution proof with a control**: substitute `@truchabrew/calculations` so `BATCH_STATUSES` gains `'Conditioning'`, freshly re-import `schemas.ts`, and the route enum must actually widen to 4 — while the unsubstituted control must stay at 3. **Follow-up `/execute` cost: one new test file** (`apps/api/test/batchPipeline.derivation.test.ts`, added to §1.1) **and zero source changes.** *Overrule and take path (b) instead:* the enum becomes a getter/function compiled per request, AC-41(c)/(d) are rewritten around a live-mutation assertion, and ~2 criteria are added for per-request compilation and mid-flight widening — new implementation scope in files already on the Modified list.
>
> **One consequential edit outside those two ACs**, flagged rather than buried: §5's M5_P2 preview asserted *"AC-41's extension test is the proof that they will"*. That sentence pointed at the test being retired, so it now names **AC-41(c)** and states the recompile-time evaluation point. No other §5 content changed.
>
> ---
>
> **The nine original deviations (§4), retained for context — already signed off on 2026-08-07 and not reopened. Three of them were the decisions worth reading:**
>
> **(1) Milestone 5 is split into two phases.** The roadmap did not mandate a split for M5 the way it did for M3, so this is a judgment call. The line is the roadmap's own two hardening bullets: **P1** = readings, chart, live attenuation, `Brewing → Fermenting`. **P2** = `Fermenting → Conditioning → Completed`, measured FG/ABV/efficiency against the estimates, carbonation, notes, rating — and **the MVP acceptance run that closes the milestone**. The case for splitting is that the acceptance run is the most consequential verification event in this project, and the alternative puts ~65 criteria of new surface between here and it in one pass, in a project whose last big-bang phase needed three repair cycles. *Overrule and §5 folds into this spec at roughly 75–80 criteria.*
>
> **(2) The chart adds no dependency — inline SVG over a pure model, not Recharts or uPlot.** The roadmap names those two explicitly. The plotting arithmetic is specified as a pure function (§2.4) and pinned by AC-11 through AC-15; the renderer is then ~120 lines of SVG, `package-lock.json` stays byte-unchanged, and no `jsdom` sizing shim is needed to make the chart criteria testable. *Overrule and Recharts renders the same model — the pure contract and its five criteria are unchanged; the cost is one dependency, a test-setup shim, and `package-lock.json` off the Untouched list.*
>
> **(3) Two known carryovers are deferred to M5_P2, explicitly rather than silently.** `BatchNote` (§4 deviation 6) — M4 roadmap scope that was never built, and M5's own threshold names "every note", so P2 cannot close the milestone without it; deferred because a note records **which status it was written at** and P1 has only three of the five. And the **measured-efficiency live recompute** flagged in `CRITIC_REPORT_M4_P1_AC12.md` (§4 deviation 7 and Resolved Ambiguities) — deferred to P2 where the measured-comparison surface and the `Completed` freeze are being built anyway, with **AC-32** added so the deferral cannot quietly widen in the meantime. Both have their overrule paths and their costs stated. *The `DryHop` `timeMinutes` retirement that M4_P1 assigned to "M5" is likewise placed in P2 (§4 deviation 9) — flagged because P1 does introduce the `fermentationStartDate` referent M4_P1 said was missing, so this is a scheduling choice, not a blocked one.*
>
> **The remaining six deviations** — `measuredOg` landing in P1 (3), `fermentationStartDate` added (4), per-item reading endpoints instead of full-replace (5), the status allow-list living in `packages/calculations` rather than `shared-types` (8), plus (6), (7) and (9) above — are each stated with reasoning and an overrule path in §4.
>
> **One method note:** **AC-50 does not use `git diff`.** `git rev-list --count HEAD` is **1** and the sole commit predates M1–M5, so a whole-tree diff cannot attribute anything to this phase. The scope guardrail is a pre/post-execution SHA-256 content manifest instead, with M1's mtime sweep as the documented fallback — the same remedy M4_P1 adopted after this exact criterion class recurred five times. The method itself held: AC-50's manifest reconciliation is precisely what caught `seed.test.ts`, and the fault it reported was the spec's, not the executor's.
>
> ---
>
> **Total remaining work under this amendment: one new test file** (`apps/api/test/batchPipeline.derivation.test.ts`, AC-41(c)) **and zero source-code changes.** The other 48 criteria were traced YES on executed evidence and are untouched here; nothing already built is to be re-executed, reverted or re-audited from scratch.
>
> **Review this amended feature specification. Reply with SPEC_APPROVED to begin execution.**
