# FEATURE SPECIFICATION: M2_P1 — A Recipe Library That Survives a Refresh

## Phase Summary

Today TruchaBrew is a single-recipe, in-memory designer. `App.tsx` seeds `useState<Recipe>(INITIAL_SAMPLE_RECIPE)` from a static TS constant, the equipment picker reads `SEED_EQUIPMENT_PROFILES` from the same file, and the three ingredient sections each `import { INGREDIENT_CATALOG } from '../data/seedData'`. A page refresh discards everything. There is no `Misc` category anywhere in the type system, and `handleScaleRecipe` rewrites ingredient amounts while leaving `trubChillerLossL` and `boilOffRateLPerHour` frozen at their pre-scale values.

This phase introduces `/apps/api` (Node + TypeScript + Fastify) backed by SQLite through Drizzle ORM, migrates the equipment profiles and the ingredient catalog from static TS constants into seeded DB rows, replaces the designer's `useState`-only model with an explicit load/save cycle against a REST API, adds a recipe library view (search, open, rename, duplicate, delete), adds the Misc ingredient category end-to-end, and rebuilds recipe scaling so it derives a physically consistent equipment profile instead of a half-scaled one.

**User-visible outcome:** create a recipe, name it, save it, close the browser, restart both processes, reopen — the recipe is in a searchable library, opens with the same ingredients, the same equipment profile, and the same computed stats it had before. Scaling 20 L → 40 L holds OG, IBU, pre-boil gravity and water volumes. A save that fails leaves the edits on screen with an error the user cannot miss.

### Key Behaviors

1. **The DB stores inputs only.** No `og`, `fg`, `ibu`, `srm`, water volume or any other derived value is persisted. `calculateRecipeStats` runs client-side on every keystroke, exactly as it does today, and its signature does not change.
2. **`equipmentId` is the stored reference; the embedded `equipment` object is read-side hydration.** A recipe row holds `equipment_id` with `ON DELETE RESTRICT`. The API returns the profile inlined so the calculation engine keeps receiving `Recipe` in the shape it already accepts.
3. **Saving is explicit, never automatic.** A Save control with `idle` / `saving` / `error` states. A failed save does not mutate, revert, or discard the working recipe; the editor stays dirty and a persistent error banner shows the server's message with a Retry action.
4. **Deletion cascades in the database, not in application code.** Foreign keys are declared `ON DELETE CASCADE` and `PRAGMA foreign_keys = ON` is asserted on every connection.
5. **Scaling derives a new equipment profile.** `scaleRecipe` is a pure function; volume-bearing equipment fields (`batchSizeL`, `trubChillerLossL`, `boilOffRateLPerHour`) scale together so every downstream volume and gravity is invariant. Ratio-invariant fields (efficiencies, `boilTimeMin`, `hopUtilizationPct`) do not scale.
6. **Misc line items are stored and edited but calculate nothing in M2.** `calculateRecipeStats` ignores `recipe.miscs`. Water-agent chemistry is M6.
7. Everything still runs from a cold clone: `npm install && npm test` exits 0, with the M1 calculation suite unchanged and green.

### Resolved Ambiguities (Binding)

- **ORM: Drizzle, not Prisma.** Four reasons, in priority order. (a) *Cold-clone integrity* — M1's AC-30 guarantees `npm install && npm test` works from a fresh clone; Prisma requires a `prisma generate` codegen step whose output lives in `node_modules`, which means either a `postinstall` hook or a broken cold clone, and a generated client is a second source of truth alongside `@truchabrew/shared-types`. Drizzle's schema *is* TypeScript — no codegen, no engine binary. (b) *Layout fit* — this repo ships packages as raw TS with `"main": "./src/index.ts"` and no per-package build step; Drizzle preserves that, Prisma does not. (c) *Migration transparency* — `drizzle-kit` emits plain `.sql` files that are read and reviewed as SQL, which matters because the orphan-row guarantee below is a schema-level property. (d) *Weight* — Prisma's query engine is ~15–20 MB of binary for a single-user local SQLite file. **This decision is reversible only at this gate**; after execution it is load-bearing for M3–M9.
- **SQLite driver: `better-sqlite3`.** Synchronous, mature, Drizzle's first-class SQLite driver. Node 24's built-in `node:sqlite` is still flagged experimental and emits a runtime `ExperimentalWarning`; it is the documented fallback if native compilation fails on this machine (see Known Execution Risks).
- **`PRAGMA foreign_keys = ON` is mandatory and asserted.** SQLite defaults foreign-key enforcement to **OFF per connection**. Without this pragma every `ON DELETE CASCADE` in the schema is inert and the "no orphaned ingredient rows" threshold silently fails while looking correct. It is set at connection open and there is a dedicated AC that queries `PRAGMA foreign_keys` and asserts `1`.
- **"Byte-identical after restart" is defined precisely.** It means: `canonicalRecipeJson(before) === canonicalRecipeJson(after)`, where `canonicalRecipeJson` serializes the `StoredRecipe` with keys in a fixed lexicographic order, line-item arrays in stored `position` order, and **`createdAt` / `updatedAt` excluded**. Timestamps are metadata, not recipe content; including them would make the criterion untestable. All numeric columns are SQLite `REAL` (IEEE-754 double, bit-identical to a JS `number`) — no number is ever stored as `TEXT`, so the round-trip is exact, not approximate.
- **Recomputed stats are compared with `===`, not a tolerance.** Because inputs round-trip exactly and `calculateRecipeStats` is pure, `calculateRecipeStats(before)` must deep-equal `calculateRecipeStats(after)` field for field. A tolerance here would hide exactly the bug the threshold exists to catch.
- **Line-item ordering.** Every line-item table carries `position INTEGER NOT NULL` with `UNIQUE(recipe_id, position)`. Positions are dense, 0-based, assigned by array index on write. Reads are `ORDER BY position ASC`. Insertion order in the UI is therefore preserved across restart, and reordering is a write of new positions.
- **ID ownership.** The server assigns every persisted `id` via `crypto.randomUUID()`. On create, client-supplied line-item ids are **ignored, not honoured** — they exist only as React keys. On update, a line item whose `id` matches an existing row for that recipe is updated in place; any other id (including a client-invented one) produces a new row. After any successful write the client **replaces its working recipe with the server's response**, which reconciles ids in one step. Seeded rows are the exception: they keep their existing stable string ids (`eq-1`, `eq-2`, `f-1`…`f-8`, `h-1`…`h-7`, `y-1`…`y-4`, `m-1`…`m-6`, `rec-sample-1`) so that seeding is idempotent and existing behaviour is preserved.
- **Update semantics: full replace, not patch.** `PUT /api/recipes/:id` replaces the entire line-item set for that recipe inside a single transaction (delete-not-present, upsert-present, rewrite positions). A partial body is a `400`, not a merge. The single exception is `PATCH /api/recipes/:id` which accepts `{ name }` only, for rename from the library list.
- **No optimistic concurrency, deliberately.** `DISCOVERY.md` Q4 locks this to single-user on one machine. Last write wins. No ETag, no version column, no 409-on-stale. If multi-device ever arrives it is a new milestone, not a retrofit hidden here.
- **Equipment profiles are selectable and derivable in M2, not editable.** `POST /api/equipment-profiles` exists solely to serve the scale-derived profile path. There is no equipment edit form, no `PUT`, and no `DELETE` — full CRUD is M3's named scope. The embedded `recipe.equipment` object is treated as read-only by the web app; mutating it in place would not persist, and no code path does.
- **Scale reuses a derived profile rather than accumulating duplicates.** Before creating a derived profile, the API looks for an existing profile with the same `derivedFromEquipmentId` **and** a `batchSizeL` equal within `1e-9`. If one exists it is reused. Otherwise a new one is created, named `` `${source.name} (${targetBatchSizeL} L)` ``. Scaling the same recipe to 40 L twice yields one extra profile row, not two.
- **Boil-off scales linearly with batch size — an acknowledged approximation.** Evaporation is physically driven by kettle surface area (~ratio^⅔), not volume. Linear scaling is chosen because it makes `preBoilVolumeL` scale by exactly the ratio, which makes pre-boil gravity and every water volume exactly invariant — the property the verification threshold actually tests. M3 introduces `evaporationRate%` on the equipment profile and revisits this. The linear choice is annotated as such in source.
- **Scaling rounding.** `amountKg` → 3 decimal places, `amountG` → 1 decimal place, misc `amount` → 2 decimal places. The current code's `toFixed(2)` on kilograms and `Math.round` on grams introduces up to ~0.4% drift at non-integer ratios (e.g. 20 L → 25 L turns 0.25 kg into 0.31 kg, a 0.4% error), which can push OG outside M1's ±1% band. The finer rounding keeps drift below 0.05% at any ratio in `[0.25, 4]`.
- **Scaling no-op contract.** `scaleFactor(current, target)` returns `0` when `current <= 0` or `target <= 0`. `scaleRecipe` returns a recipe deep-equal to its input when the factor is `0` or exactly `1`. The **caller must branch on `scaleFactor`** and skip the API round-trip entirely on a no-op — a derived profile must never be created for a no-op scale.
- **A failed save never touches the working recipe.** On a rejected or errored write, `recipe` and `savedSnapshot` are both left exactly as they were, so `isDirty` stays `true`. The error banner is not auto-dismissed and not cleared by further editing; it clears only on a subsequent successful save or an explicit user dismiss, and dismissing does **not** clear the dirty flag. No default, blank, or placeholder recipe is ever substituted for a failed load or save.
- **Stats stay live during network failure.** `useMemo(() => calculateRecipeStats(recipe), [recipe])` is unconditional. It is not gated on `saveState`. Editing with a save error on screen still updates OG/IBU/colour on every keystroke.
- **No router is added.** `App` holds `view: 'list' | 'editor'` in state. Adding `react-router` for two views is a dependency this milestone does not need; URL-addressable recipes are deferred.
- **The seeded sample recipe replaces the Reset button.** `INITIAL_SAMPLE_RECIPE` becomes a seeded DB row (`rec-sample-1`, "Trucha West Coast IPA"). The header's "Reset" button — which restored a hardcoded constant — is removed and replaced by "New Recipe", which opens a blank unsaved draft. Restoring the sample now means opening it from the library.
- **`recipe.miscs` is required, not optional.** Making it `MiscItem[] | undefined` would let every future consumer (M4's batch snapshot, M6's water agents, M9's inventory) silently skip the category — the exact failure the roadmap added it to prevent. Consequence: `packages/calculations/test/fixtures/fixtureAdapter.ts` must supply `miscs: []`, and `EquipmentProfile` gains a required-nullable `derivedFromEquipmentId`. Both are one-line edits to M1 test scaffolding, listed in §1.5.
- **AC-11 amendment (post-`/verify` critic audit): the ratio invariant is asserted on unrounded quantities; the rounded fields get a rounding-derived band.** AC-11 originally required the seven *rounded* `CalculatedStats` fields to equal their 20 L value × 2 within `1e-6`. That is mathematically unsatisfiable, and not because of any defect in `scaling.ts`. `brewingMath.ts` step 11 rounds each output field independently, so two values at different magnitudes are not guaranteed to stay in an exact ratio: the sample recipe's true mash water is `17.25 L` at 20 L, which rounds up to `17.3`, while at 40 L the true value is `34.5 L` and needs no rounding at all — `17.3 × 2 = 34.6 ≠ 34.5` even though the unrounded quantities are exactly double. `brewingMath.ts` is byte-unchanged in this phase (§1.5), so the fix belongs in the criterion, not the engine. Three binding constraints follow.
  - **(a) What "exact by construction" actually covers.** `preBoilVolumeL` and `postBoilVolumeL` are exact for *any* ratio: `calculateVolumes` is homogeneous of degree 1 in `batchSizeL`, `trubChillerLossL` and `boilOffRateLPerHour`, and `deriveScaledEquipment` scales all three by `r` while leaving `boilTimeMin` alone. The **ingredient sums are not** exact for any ratio — §2.1 rounds `amountKg` to 3 dp and `amountG` to 1 dp per line item, so a non-integer ratio perturbs them. They are exact *here* only because at `r = 2` that per-item rounding is a no-op on every value in the seeded sample (`5.0 / 0.5 / 0.25 kg`, `20 / 30 / 50 / 50 g`). AC-11 is therefore explicitly a **ratio-2, seeded-sample** criterion; per-item rounding drift at non-integer ratios is AC-12's job, not AC-11's. `1e-6` (not `===`) remains the bar because summation order still admits float noise. This also qualifies §2.1's "`…` all scale by exactly `r`" sentence: that holds of the unrounded quantities, not of the rounded `CalculatedStats` fields.
  - **(b) How the unrounded expected value must be computed.** Wherever the engine exports something that yields the unrounded quantity, the test **must call it** — `calculateVolumes` for the two volumes, and `MASH_WATER_L_PER_KG` / `GRAIN_ABSORPTION_L_PER_KG` imported from `@truchabrew/calculations` for the water terms. Hand-copied numeric literals (e.g. a bare `3.0`) are prohibited: they silently stop tracking the engine the moment a constant moves, which is exactly what M3 plans to do when it un-hardcodes both. **Known residual gap, accepted for M2:** `mashWaterL` / `spargeWaterL` / `totalWaterL` are computed inline inside `calculateRecipeStats` and have no exported unrounded accessor, so their *formula shape* is still restated in the test even when the constants are imported. Exposing them (e.g. a `calculateWaterVolumes(...)` helper) requires editing `brewingMath.ts`, which §1.5 forbids in this phase. It is deferred to the phase that un-hardcodes the water constants, and is partly mitigated meanwhile by part (b) of AC-11, which runs against real `calculateRecipeStats` output.
  - **(c) Why the band is a formula, not a constant.** For a field rounded to quantum `q`, the worst-case disagreement between `round(x·r)` and `round(x)·r` is `q/2 + r·(q/2) = (q/2)(1 + r)` — one rounding step on each side, the second magnified by the ratio. That bound is derived, not tuned to make the suite green. A flat `0.15` happens to be the correct value for a `q = 0.1` field at `r = 2`, but it is ~10× looser than necessary for `totalGrainKg` (`q = 0.01` → `0.015`) and, more seriously, ~10× **tighter** than sound for `totalHopG` (`Math.round`, `q = 1` → `1.5`). A flat `0.15` on `totalHopG` passes today only because the sample's hop grams are integers that double exactly; any recipe with a fractional gram total would fail a correct implementation. The per-field formula is required so the check cannot be flaky in one direction and toothless in the other.
- **API tests never touch the development database.** Each test file opens its own SQLite file under `os.tmpdir()` and deletes it on teardown. No test uses `:memory:` — an in-memory database cannot exercise the close-and-reopen path that the restart criterion depends on.
- **Dev topology.** Two processes: Vite on `5173`, Fastify on `5177` (override via `PORT`). Vite proxies `/api` → `http://localhost:5177`. The API does not serve the built web bundle in M2; single-process production packaging is not in scope.

---

## 1. Data Schema & Contracts

### 1.1 Workspace layout — additions only

Everything under `packages/` and `apps/web/` from M1 stays where it is. New tree:

```
/apps/api/
    package.json              name "@truchabrew/api", deps: fastify, drizzle-orm, better-sqlite3
                              devDeps: drizzle-kit, vitest, tsx, @types/better-sqlite3
    tsconfig.json             extends ../../tsconfig.base.json
    vitest.config.ts
    drizzle.config.ts         dialect "sqlite", schema -> ./src/db/schema.ts, out -> ./drizzle
    drizzle/                  generated .sql migrations + meta/  (COMMITTED)
    src/index.ts              process entry: build server, migrate, seed, listen
    src/server.ts             buildServer(deps): FastifyInstance — no listen(), test-injectable
    src/db/client.ts          openDatabase(filePath): Db  (sets PRAGMA foreign_keys = ON)
    src/db/schema.ts          Drizzle table definitions (§1.2)
    src/db/migrate.ts         runMigrations(db): void
    src/db/seed.ts            seedDatabase(db): void — idempotent
    src/repositories/recipeRepository.ts
    src/repositories/equipmentRepository.ts
    src/repositories/catalogRepository.ts
    src/routes/recipes.ts  src/routes/equipment.ts  src/routes/catalog.ts  src/routes/health.ts
    src/mappers/recipeMapper.ts     rows <-> StoredRecipe
    test/recipes.crud.test.ts  test/recipes.restart.test.ts  test/recipes.cascade.test.ts
    test/scaling.integration.test.ts  test/seed.test.ts  test/errors.test.ts
    test/helpers/testDb.ts  test/helpers/canonical.ts

/packages/calculations/src/scaling.ts        NEW — pure scaling logic
/packages/calculations/test/scaling.test.ts  NEW

/packages/shared-types/src/misc.ts           NEW — Misc domain types
/packages/shared-types/src/api.ts            NEW — wire DTOs shared by api + web

/apps/web/src/api/client.ts                  NEW — typed fetch wrapper
/apps/web/src/components/MiscSection.tsx     NEW
/apps/web/src/components/RecipeLibrary.tsx   NEW
/apps/web/src/components/SaveBar.tsx         NEW
/apps/web/src/context/CatalogContext.tsx     NEW
/apps/web/src/hooks/useRecipeEditor.ts       NEW
```

**Root script contract (modified):**

| Script | Command contract |
|---|---|
| `npm test` | `npm test --workspaces --if-present` — runs `@truchabrew/calculations` **and** `@truchabrew/api` suites; exits 0 |
| `npm run dev` | starts API and web concurrently |
| `npm run dev:web` / `npm run dev:api` | each process alone |
| `npm run typecheck` | typechecks all four packages, exits 0 |
| `npm run build` | builds `@truchabrew/web`, exits 0 |
| `npm run lint` | oxlint across the workspace, exits 0 |
| `npm run db:generate` | `drizzle-kit generate` in `apps/api` |
| `npm run db:seed` | idempotent reseed against the dev database |

`apps/api/data/*.db*` is added to `.gitignore`. `apps/api/drizzle/**` is **committed**.

### 1.2 Database schema — `apps/api/src/db/schema.ts`

All timestamps are ISO-8601 UTC strings (`2026-08-04T12:00:00.000Z`) in `TEXT`. All quantities are `REAL`. All enums are `TEXT`, validated at the HTTP boundary by Fastify JSON-Schema (ajv), not by a CHECK constraint.

**`equipment_profiles`**

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `name` | TEXT NOT NULL | |
| `batch_size_l` | REAL NOT NULL | |
| `boil_time_min` | REAL NOT NULL | |
| `brewhouse_efficiency_pct` | REAL NOT NULL | |
| `mash_efficiency_pct` | REAL NOT NULL | |
| `boil_off_rate_l_per_hour` | REAL NOT NULL | |
| `trub_chiller_loss_l` | REAL NOT NULL | |
| `hop_utilization_pct` | REAL NOT NULL | |
| `derived_from_equipment_id` | TEXT NULL | `REFERENCES equipment_profiles(id) ON DELETE SET NULL` |
| `is_seed` | INTEGER NOT NULL DEFAULT 0 | 1 for `eq-1`/`eq-2` |
| `created_at`, `updated_at` | TEXT NOT NULL | |

**`recipes`**

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `name` | TEXT NOT NULL | indexed |
| `author` | TEXT NOT NULL DEFAULT `''` | |
| `style_name` | TEXT NOT NULL DEFAULT `''` | |
| `equipment_id` | TEXT NOT NULL | `REFERENCES equipment_profiles(id) ON DELETE RESTRICT` |
| `notes` | TEXT NOT NULL DEFAULT `''` | |
| `created_at`, `updated_at` | TEXT NOT NULL | |

**Line-item tables** — all four share: `id TEXT PK`, `recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE`, `position INTEGER NOT NULL`, index on `recipe_id`, `UNIQUE(recipe_id, position)`.

| Table | Additional columns |
|---|---|
| `recipe_fermentables` | `name` TEXT, `type` TEXT, `amount_kg` REAL, `color_srm` REAL, `potential_sg` REAL, `notes` TEXT NULL |
| `recipe_hops` | `name` TEXT, `amount_g` REAL, `alpha_acid_pct` REAL, `use` TEXT, `time_minutes` REAL, `type` TEXT |
| `recipe_yeasts` | `name` TEXT, `type` TEXT, `form` TEXT, `laboratory` TEXT, `attenuation_pct` REAL, `amount_pkg` REAL |
| `recipe_miscs` | `name` TEXT, `type` TEXT, `use` TEXT, `time_minutes` REAL, `amount` REAL, `unit` TEXT, `notes` TEXT NULL |

**Catalog tables** (the migrated `INGREDIENT_CATALOG`): `catalog_fermentables` (`id`, `name`, `type`, `color_srm`, `potential_sg`), `catalog_hops` (`id`, `name`, `alpha_acid_pct`, `type`), `catalog_yeasts` (`id`, `name`, `laboratory`, `type`, `form`, `attenuation_pct`), `catalog_miscs` (`id`, `name`, `type`, `default_use`, `default_unit`).

### 1.3 Type changes — `packages/shared-types`

**New — `src/misc.ts`:**

```ts
export type MiscType = 'Spice' | 'Fining' | 'WaterAgent' | 'Herb' | 'Flavor' | 'Other';
export type MiscUse  = 'Mash' | 'Boil' | 'Whirlpool' | 'Primary' | 'Secondary' | 'Bottling';
export type MiscUnit = 'g' | 'ml' | 'tsp' | 'tbsp' | 'each';

export interface MiscItem {
  id: string;
  name: string;
  type: MiscType;
  use: MiscUse;
  timeMinutes: number;   // 0 for uses with no time dimension
  amount: number;
  unit: MiscUnit;
  notes?: string;
}
```

**Modified — `src/brewing.ts`:**

```ts
export interface EquipmentProfile {
  // ... all 9 existing fields unchanged ...
  derivedFromEquipmentId: string | null;   // NEW — required, nullable. null for user/seed profiles.
}

export interface Recipe {
  // ... all 9 existing fields unchanged ...
  miscs: MiscItem[];   // NEW — required. Ignored by calculateRecipeStats in M2.
}
```

`FermentableItem`, `HopItem`, `YeastItem`, `CalculatedStats` and every existing union type are **unchanged — no additions, no renames, no removals**. `CalculatedStats` in particular gains nothing: Misc calculates nothing in M2.

**New — `src/api.ts`:**

```ts
export interface StoredRecipe extends Recipe { createdAt: string; updatedAt: string; }

export interface RecipeSummary {
  id: string; name: string; author: string; styleName: string;
  equipmentId: string; equipmentName: string; batchSizeL: number;
  fermentableCount: number; hopCount: number;
  createdAt: string; updatedAt: string;
}

export type LineItemInput<T> = Omit<T, 'id'> & { id?: string };

export interface RecipeWriteInput {
  name: string; author: string; styleName: string; notes: string;
  equipmentId: string;
  fermentables: LineItemInput<FermentableItem>[];
  hops: LineItemInput<HopItem>[];
  yeasts: LineItemInput<YeastItem>[];
  miscs: LineItemInput<MiscItem>[];
}

export interface EquipmentCreateInput extends Omit<EquipmentProfile, 'id'> {}

export interface CatalogFermentable { id: string; name: string; type: FermentableType; colorSrm: number; potentialSg: number; }
export interface CatalogHop        { id: string; name: string; alphaAcidPct: number; type: HopType; }
export interface CatalogYeast      { id: string; name: string; laboratory: string; type: YeastType; form: YeastForm; attenuationPct: number; }
export interface CatalogMisc       { id: string; name: string; type: MiscType; defaultUse: MiscUse; defaultUnit: MiscUnit; }
export interface CatalogResponse {
  fermentables: CatalogFermentable[]; hops: CatalogHop[];
  yeasts: CatalogYeast[]; miscs: CatalogMisc[];
}

export type ApiErrorCode =
  | 'VALIDATION_FAILED' | 'NOT_FOUND' | 'EQUIPMENT_NOT_FOUND'
  | 'EQUIPMENT_IN_USE'  | 'INTERNAL';

export interface ApiErrorBody { error: { code: ApiErrorCode; message: string; details?: unknown } }
```

### 1.4 HTTP contract

| Method & path | Success | Failure |
|---|---|---|
| `GET /api/health` | `200 { ok: true, foreignKeys: 1 }` | — |
| `GET /api/catalog` | `200 CatalogResponse` | `500 INTERNAL` |
| `GET /api/equipment-profiles` | `200 EquipmentProfile[]` (seed first, then by `name`) | `500` |
| `POST /api/equipment-profiles` | `201 EquipmentProfile` | `400 VALIDATION_FAILED` |
| `GET /api/recipes?q=` | `200 RecipeSummary[]`, `updatedAt DESC`; `q` = case-insensitive substring over `name` **or** `styleName`; absent/empty `q` returns all | `500` |
| `GET /api/recipes/:id` | `200 StoredRecipe` (equipment hydrated) | `404 NOT_FOUND` |
| `POST /api/recipes` | `201 StoredRecipe` | `400 VALIDATION_FAILED`, `400 EQUIPMENT_NOT_FOUND` |
| `PUT /api/recipes/:id` | `200 StoredRecipe` | `400`, `404 NOT_FOUND` |
| `PATCH /api/recipes/:id` | `200 StoredRecipe` — body `{ name }` only | `400`, `404` |
| `POST /api/recipes/:id/duplicate` | `201 StoredRecipe` named `"<name> (copy)"`, all-new line-item ids, same `equipmentId` | `404` |
| `DELETE /api/recipes/:id` | `204`, empty body | `404 NOT_FOUND` |

Every non-2xx response body is exactly `ApiErrorBody`. No route ever returns an HTML error page or a bare string.

### 1.5 Symbol inventory

**Modified:**

| Symbol / file | Change |
|---|---|
| `EquipmentProfile` (shared-types) | `+ derivedFromEquipmentId: string \| null` (required, nullable) |
| `Recipe` (shared-types) | `+ miscs: MiscItem[]` (required) |
| `packages/calculations/test/fixtures/fixtureAdapter.ts` | supplies `miscs: []` and `derivedFromEquipmentId: null`; **no other change** — all M1 fixture expectations, potentials and tolerances untouched |
| `packages/calculations/test/brewingMath.test.ts` | `baseEquipment()` and `baseRecipe()` helper defaults gain `derivedFromEquipmentId: null` and `miscs: []` respectively, so their object literals satisfy the now-required fields; **no other line changes** — every existing numeric expectation, tolerance and test case is untouched |
| `apps/web/src/App.tsx` | rewritten around `view` state + `useRecipeEditor`; `INITIAL_SAMPLE_RECIPE` / `SEED_EQUIPMENT_PROFILES` imports removed; `handleScaleRecipe` replaced |
| `FermentableSection` / `HopSection` / `YeastSection` | `INGREDIENT_CATALOG` import replaced by `useCatalog()`; **all other props and rendering unchanged** |
| root `package.json` | `test` script becomes `--workspaces --if-present`; `dev` runs both processes |

**New:** everything in §1.1's new-file list, plus `MiscItem`/`MiscType`/`MiscUse`/`MiscUnit`, every symbol in §1.3's `api.ts`, and `scaleFactor`, `deriveScaledEquipment`, `scaleRecipe`, `canScale` in `packages/calculations`.

**Deleted:** `apps/web/src/data/seedData.ts` in its entirety — `SEED_EQUIPMENT_PROFILES`, `INGREDIENT_CATALOG` and `INITIAL_SAMPLE_RECIPE` all move to `apps/api/src/db/seed.ts`. The file must not survive as a shim.

**Untouched — must not change:** `packages/calculations/src/constants.ts`, `src/units.ts`, `src/brewingMath.ts`; `packages/calculations/test/units.test.ts`, `test/fixtures.test.ts`, `test/fixtures/montano_brewing_recipes.json`, `test/fixtures/fermentablePotentials.ts` (`test/brewingMath.test.ts` is exempted per the row above — helper defaults only); `apps/web/src/components/StatsHeader.tsx`; `apps/web/src/utils/srmColor.ts`; `apps/web/src/index.css`; `CLAUDE.md`; `.claude/**`; `.agents/**`; every path under `.gsd/` except `.gsd/active/M2_P1_feature_spec.md`, `.gsd/STATE.json`, and files under `.gsd/active/manual_verification/`.

---

## 2. Transformations & Pure Logic

### 2.1 Pure scaling — `packages/calculations/src/scaling.ts`

No I/O, no `Date`, no `Math.random`, no `crypto`. The new profile's id is an **injected argument** precisely so this stays deterministic.

```ts
/** 0 when either volume is <= 0 (degenerate). Otherwise target / current. */
export function scaleFactor(currentBatchSizeL: number, targetBatchSizeL: number): number;

/** True iff scaling would change anything: factor is finite, > 0, and not exactly 1. */
export function canScale(currentBatchSizeL: number, targetBatchSizeL: number): boolean;

/**
 * Volume-bearing fields scale; ratio-invariant fields do not.
 * newId is injected by the caller — this function never generates an id.
 */
export function deriveScaledEquipment(
  source: EquipmentProfile,
  targetBatchSizeL: number,
  newId: string,
): EquipmentProfile;

/**
 * Returns a recipe deep-equal to `recipe` when canScale() is false.
 * Otherwise returns a new Recipe with scaled amounts and `equipment` replaced
 * by `scaledEquipment`. Line-item ids, names, types, uses and times are preserved.
 */
export function scaleRecipe(
  recipe: Recipe,
  targetBatchSizeL: number,
  scaledEquipment: EquipmentProfile,
): Recipe;
```

**`deriveScaledEquipment` field rules** (`r = scaleFactor(source.batchSizeL, target)`):

| Field | Rule |
|---|---|
| `id` | `newId` |
| `name` | `` `${source.name} (${targetBatchSizeL} L)` `` |
| `batchSizeL` | `targetBatchSizeL` |
| `trubChillerLossL` | `source.trubChillerLossL * r`, 3 dp |
| `boilOffRateLPerHour` | `source.boilOffRateLPerHour * r`, 3 dp — linear approximation, annotated |
| `boilTimeMin` | unchanged |
| `brewhouseEfficiencyPct`, `mashEfficiencyPct`, `hopUtilizationPct` | unchanged |
| `derivedFromEquipmentId` | `source.derivedFromEquipmentId ?? source.id` — chains flatten to the original root, they never nest |

**`scaleRecipe` field rules:** `fermentables[].amountKg *= r` (3 dp); `hops[].amountG *= r` (1 dp); `miscs[].amount *= r` (2 dp) for **every** unit including `tsp`/`tbsp`/`each` — misc additions are per-batch doses; `yeasts` are **not scaled** (pitch-rate scaling is M8's calculator, and silently doubling packet counts would be a fabricated number). `name`, `author`, `styleName`, `notes`, `id` unchanged.

**Invariants this produces** (all exercised in §3): `og`, `ibu`, `preBoilGravity`, `buGu`, `rbr`, `srm`, `ebc`, `abv` are invariant under scaling; `preBoilVolumeL`, `postBoilVolumeL`, `mashWaterL`, `spargeWaterL`, `totalWaterL`, `totalGrainKg`, `totalHopG` all scale by exactly `r`.

### 2.2 Canonical serialization — `apps/api/test/helpers/canonical.ts`

```ts
/** Deterministic JSON: keys lexicographically sorted at every depth,
 *  arrays in stored position order, createdAt/updatedAt omitted at every depth. */
export function canonicalRecipeJson(recipe: StoredRecipe): string;
```

This is the sole definition of "byte-identical" for §3.

### 2.3 Row ↔ domain mapping — `apps/api/src/mappers/recipeMapper.ts`

```ts
export function toStoredRecipe(
  recipeRow: RecipeRow, equipment: EquipmentProfile,
  fermentables: FermentableRow[], hops: HopRow[], yeasts: YeastRow[], miscs: MiscRow[],
): StoredRecipe;

export function toLineItemRows(
  recipeId: string, input: RecipeWriteInput, idFor: (existing?: string) => string,
): { fermentables: FermentableRow[]; hops: HopRow[]; yeasts: YeastRow[]; miscs: MiscRow[] };
```

`toStoredRecipe` sorts each line-item array by `position` before mapping; it does not trust input order. `idFor` is injected so `toLineItemRows` is pure and testable.

### 2.4 No-match / fallback contracts

| Situation | Contract |
|---|---|
| `GET /api/recipes/:id` on an unknown id | `404` with `ApiErrorBody.error.code === 'NOT_FOUND'`. The API never returns an empty or default recipe object. |
| `POST`/`PUT` referencing an unknown `equipmentId` | `400 EQUIPMENT_NOT_FOUND`. **Nothing is written** — the whole operation is one transaction. |
| `GET /api/recipes?q=` matching nothing | `200 []`. An empty list is a valid result, never a `404`. |
| Web: recipe list load fails | Library shows an error panel with the server message and a Retry button. It must **not** render "No recipes yet" — an empty-state message on a failed load is a lie about the user's data. |
| Web: recipe open fails | Stays on the library view with an error banner. Does **not** enter the editor with a blank recipe. |
| Web: save fails | `recipe` and `savedSnapshot` unchanged; `isDirty` stays `true`; persistent error banner + Retry. |
| Web: catalog load fails | Ingredient "add from catalog" dropdowns render disabled with an inline "Catalog unavailable" note. Manual/ad-hoc ingredient entry still works, and the recipe still saves. |
| `scaleRecipe` with a no-op or degenerate target | Returns a deep-equal recipe; caller skips the network call entirely. |
| Recipe with zero fermentables/hops/yeasts/miscs | Saves and round-trips successfully. Empty arrays are valid; stats fall back to M1's empty-recipe contract. |

### 2.5 Stateful integration — `apps/web/src/hooks/useRecipeEditor.ts`

State owned by the hook:

```ts
{
  recipe: Recipe | null,          // working copy — the only thing the editor renders
  storedId: string | null,        // null for an unsaved draft
  savedSnapshot: string | null,   // canonical JSON of the last server-confirmed state
  saveState: 'idle' | 'saving' | 'error',
  saveError: { code: ApiErrorCode; message: string } | null,
}
// derived, never stored:
isDirty = recipe !== null && canonicalWorking(recipe) !== savedSnapshot
```

Save sequence (`save()`):

1. If `recipe === null` → return, no request.
2. `saveState = 'saving'`. `recipe` is **not** touched.
3. `POST /api/recipes` when `storedId === null`, else `PUT /api/recipes/:storedId`.
4. **On 2xx:** set `recipe` to the server's `StoredRecipe` (this is the id-reconciliation step), `storedId` to its id, `savedSnapshot` to its canonical form, `saveState = 'idle'`, `saveError = null`.
5. **On non-2xx or network throw:** `saveState = 'error'`, `saveError` from the parsed `ApiErrorBody` (or a generic transport message if the body is unparseable). `recipe`, `storedId`, `savedSnapshot` are all left untouched. **No step of the failure path writes to `recipe`.**

Other integration rules, in lockstep:

- `stats = useMemo(() => calculateRecipeStats(recipe ?? EMPTY), [recipe])` — recomputed on every `recipe` change regardless of `saveState`.
- Leaving the editor for the library while `isDirty` → a confirm dialog. Cancel keeps the editor and the edits.
- `beforeunload` is registered while `isDirty` and unregistered when clean.
- Scale flow: `canScale()` gate → `POST /api/equipment-profiles` (or reuse of an existing derived profile) → `deriveScaledEquipment` → `scaleRecipe` → `setRecipe`. The recipe is now dirty and **not** auto-saved; the user saves explicitly.
- Deleting the currently-open recipe returns to the library and clears all editor state.

### 2.6 Refactoring & legacy cleanup

- Delete `apps/web/src/data/seedData.ts`. `grep -rn "seedData" apps packages` must return nothing.
- Delete the three `import { INGREDIENT_CATALOG } from '../data/seedData'` statements; the sections read `useCatalog()`.
- Delete the `handleResetRecipe` handler and the "Reset" header button along with the `RotateCcw` import if it becomes unused.
- Delete the old `handleScaleRecipe` body entirely. No successor may mutate `prev.equipment` in place while keeping the source profile's `id` — that is the specific bug that would make a scaled recipe reload at its original batch size.
- Delete the modal copy "*All fermentables and hop amounts will automatically rescale proportionally while maintaining original gravity and IBU balance*" and replace it with text that also names the derived equipment profile, so the UI stops describing behaviour the code did not have.
- Root `package.json`'s `test` script must not remain hardcoded to the calculations workspace; a passing `npm test` that silently skips the entire API suite is a milestone failure.
- No calculation, mapper, or repository may read `hop.type` (M1's AC-39 stays in force).

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | Misc type exports | Unit | `MiscItem`, `MiscType`, `MiscUse`, `MiscUnit` import from `@truchabrew/shared-types`; `MiscType` admits exactly `Spice\|Fining\|WaterAgent\|Herb\|Flavor\|Other` and `MiscUnit` exactly `g\|ml\|tsp\|tbsp\|each` |
| **AC-2** | `Recipe.miscs` is required | Unit | A `Recipe` object literal omitting `miscs` fails `tsc`; `AC-2` is satisfied by `npm run typecheck` exiting 0 with `miscs` present everywhere |
| **AC-3** | `scaleFactor` degenerate inputs | Unit | `scaleFactor(0, 40) === 0`, `scaleFactor(20, 0) === 0`, `scaleFactor(-5, 40) === 0`, `scaleFactor(20, -1) === 0`, `scaleFactor(20, 40) === 2`; no `NaN`, no `Infinity` |
| **AC-4** | `canScale` boundary | Unit | `canScale(20, 20) === false` (exactly equal → no-op), `canScale(20, 20.0001) === true`, `canScale(20, 0) === false`, `canScale(0, 20) === false` |
| **AC-5** | `scaleRecipe` no-op returns deep-equal | Unit | `scaleRecipe(r, r.equipment.batchSizeL, anyProfile)` deep-equals `r` — including `r.equipment`, which must **not** be swapped for `anyProfile` |
| **AC-6** | `deriveScaledEquipment` scales volume fields | Unit | Source `{batchSizeL:20, trubChillerLossL:2.0, boilOffRateLPerHour:3.5}` → target 40 gives `{batchSizeL:40, trubChillerLossL:4.0, boilOffRateLPerHour:7.0}` |
| **AC-7** | `deriveScaledEquipment` leaves ratio-invariant fields alone | Unit | `boilTimeMin`, `brewhouseEfficiencyPct`, `mashEfficiencyPct`, `hopUtilizationPct` are bit-identical to the source |
| **AC-8** | Derived-from chains flatten | Unit | Deriving from a profile whose `derivedFromEquipmentId` is `'eq-1'` yields `derivedFromEquipmentId === 'eq-1'`, not the intermediate profile's id |
| **AC-9** | **OG and IBU invariant under 20→40 scale** | Unit | With the seeded sample recipe: `stats40.og === stats20.og` and `stats40.ibu === stats20.ibu` exactly. (Bands are irrelevant here — this is an algebraic identity, and any drift means rounding was applied too coarsely.) |
| **AC-10** | Pre-boil gravity invariant under scale | Unit | `stats40.preBoilGravity === stats20.preBoilGravity`. Asserted separately because it is the value the **current** implementation actually breaks — hand-computed, the existing code moves it from 1.057 to 1.063, ~6.8 gravity points, far outside M1's ±1% band |
| **AC-11** | Water/weight quantities scale by exactly the ratio | Unit | Two-part, at ratio `r = 2` on the seeded sample recipe — see the **AC-11 amendment** bullet in Resolved Ambiguities for the binding rationale and constraints. **(a) Exact parity, `1e-6`** — the *unrounded* quantities each equal their 20 L value × 2: `totalGrainKg` / `totalHopG` as raw sums over `scaled.fermentables[].amountKg` / `scaled.hops[].amountG`; `preBoilVolumeL` / `postBoilVolumeL` from `calculateVolumes(recipe.equipment)` on each profile; `mashWaterL = Σ amountKg × MASH_WATER_L_PER_KG`; `spargeWaterL = max(0, preBoilVolumeL − (mashWaterL − Σ amountKg × GRAIN_ABSORPTION_L_PER_KG))`; `totalWaterL = mashWaterL + spargeWaterL`. Every constant and every volume value is **imported from `@truchabrew/calculations`** — no numeric literal in the test may restate an engine constant. **(b) Rounding band** — the actual `calculateRecipeStats` fields satisfy `abs(stats40[f] − stats20[f] × r) <= (q_f / 2) × (1 + r)`, where `q_f` is that field's rounding quantum in `brewingMath.ts` step 11: `0.1` for `mashWaterL`, `spargeWaterL`, `totalWaterL`, `preBoilVolumeL`, `postBoilVolumeL`; `0.01` for `totalGrainKg`; `1` for `totalHopG` (`Math.round`). A single blanket `0.15` for all seven is **not** acceptable |
| **AC-12** | Non-integer scale stays in M1's bands | Unit | Scaling the sample recipe 20 → 25 L (ratio 1.25): `abs(ogPoints40 − ogPoints20) <= max(0.01 × ogPoints20, 1.0)` and `abs(ibu − ibu20) <= 1.5` — the rounding-drift guard |
| **AC-13** | Yeast is not scaled | Unit | After a 20→40 scale, every `yeasts[i].amountPkg` is unchanged |
| **AC-14** | Misc amounts scale for every unit | Unit | Miscs with units `g`, `ml`, `tsp`, `tbsp`, `each` all have `amount` doubled at ratio 2 |
| **AC-15** | Line-item identity survives scaling | Unit | Scaled recipe's `fermentables[i].id/name/type`, `hops[i].id/name/use/timeMinutes/alphaAcidPct` are unchanged from the source |
| **AC-16** | Empty recipe scales without throwing | Unit | `scaleRecipe` on a recipe with all four arrays empty returns successfully; `calculateRecipeStats` on the result is all-finite |
| **AC-17** | **Foreign keys are enforced** | Integration | On a freshly opened test DB, `PRAGMA foreign_keys` returns `1`, and `GET /api/health` reports `foreignKeys: 1` |
| **AC-18** | Migrations apply from empty | Integration | Running migrations against a nonexistent file creates all 10 tables; running them a second time is a no-op and does not throw |
| **AC-19** | Seeding is idempotent | Integration | `seedDatabase` run twice leaves exactly 2 equipment profiles, 8 catalog fermentables, 7 catalog hops, 4 catalog yeasts, 6 catalog miscs, and 1 recipe (`rec-sample-1`) — no duplicates |
| **AC-20** | Seeded values match the retired constants | Integration | Seeded `eq-1` equals the former `SEED_EQUIPMENT_PROFILES[0]` field-for-field (`batchSizeL:20, brewhouseEfficiencyPct:75, mashEfficiencyPct:80, boilOffRateLPerHour:3.5, trubChillerLossL:2.0, hopUtilizationPct:87`); seeded `rec-sample-1` has 3 fermentables, 4 hops, 1 yeast with the same names and amounts as the former `INITIAL_SAMPLE_RECIPE` |
| **AC-21** | Create → read round-trip | Integration | `POST /api/recipes` then `GET /api/recipes/:id`: `canonicalRecipeJson` of both is identical |
| **AC-22** | **Restart round-trip is byte-identical** | Integration | Write a recipe with all four categories populated; **close the database handle**; reopen the same file with a new connection and a new server instance; `GET /api/recipes/:id` → `canonicalRecipeJson` identical to pre-close. Uses a real temp file, never `:memory:` |
| **AC-23** | **Recomputed stats survive restart exactly** | Integration | `calculateRecipeStats(before)` deep-equals `calculateRecipeStats(after)` on all 17 `CalculatedStats` fields — `===`, no tolerance |
| **AC-24** | Equipment reference resolves after restart | Integration | The reopened recipe's `equipment.id` equals the originally selected id and every equipment field is bit-identical — this is the roadmap's named "`equipmentId` still resolves after reload" requirement |
| **AC-25** | Line-item order preserved | Integration | A recipe saved with fermentables in order `[C, A, B]` reads back in `[C, A, B]`, before and after restart. `position` values are `0,1,2` |
| **AC-26** | Float precision is exact | Integration | `amountKg: 5.005`, `alphaAcidPct: 12.35`, `potentialSg: 1.0375` round-trip with `===`, not approximate equality |
| **AC-27** | **Delete leaves no orphans** | Integration | After `DELETE /api/recipes/:id` → `204`: `SELECT COUNT(*)` on each of `recipe_fermentables`, `recipe_hops`, `recipe_yeasts`, `recipe_miscs` `WHERE recipe_id = ?` is `0`, **and** a global anti-join (`WHERE recipe_id NOT IN (SELECT id FROM recipes)`) returns `0` across all four tables |
| **AC-28** | Delete does not remove the equipment profile | Integration | After deleting a recipe, its `equipmentId` profile still exists and other recipes using it still load |
| **AC-29** | Update replaces, does not accumulate | Integration | `PUT` a recipe whose 3 fermentables are reduced to 1 → the DB holds exactly 1 `recipe_fermentables` row for that recipe; removed rows are gone, not soft-deleted |
| **AC-30** | Update preserves ids for retained rows | Integration | `PUT` with an unchanged fermentable keeps its original row `id`; a newly added item receives a fresh server id distinct from any client-sent value |
| **AC-31** | Rename via PATCH | Integration | `PATCH /api/recipes/:id` `{name:"X"}` → `200`, name is `"X"`, and every line item is untouched (same ids, same amounts) |
| **AC-32** | Duplicate is a deep copy | Integration | `POST /api/recipes/:id/duplicate` → new recipe id, name `"<name> (copy)"`, same `equipmentId`, same line-item **content**, and **every** line-item id different from the source's. Editing the copy's amounts leaves the original unchanged in the DB |
| **AC-33** | Search filters case-insensitively | Integration | `?q=ipa` matches a recipe named `"Trucha West Coast IPA"` and one with `styleName: "21A. American IPA"`; `?q=` and an absent `q` both return all; `?q=zzz` returns `200 []`, not `404` |
| **AC-34** | Unknown recipe id | Integration | `GET`, `PUT`, `PATCH`, `DELETE` on an unknown id each return `404` with `error.code === 'NOT_FOUND'` and a well-formed `ApiErrorBody` |
| **AC-35** | Unknown equipment id writes nothing | Integration | `POST /api/recipes` with `equipmentId: 'nope'` → `400 EQUIPMENT_NOT_FOUND`, and the `recipes` row count is unchanged from before the call |
| **AC-36** | Malformed body is rejected atomically | Integration | `POST` with `hops[0].use: 'Sprinkle'` (invalid enum) and with a missing `name` each return `400 VALIDATION_FAILED`; no row is written in either case |
| **AC-37** | Empty-array recipe is valid | Integration | A recipe with all four line-item arrays empty saves, returns `201`, and round-trips through restart with `canonicalRecipeJson` equality |
| **AC-38** | Derived profile is created once and reused | Integration | Scaling the same recipe to 40 L twice creates exactly **one** additional `equipment_profiles` row; its `derivedFromEquipmentId` is the source id and `isSeed` is 0 |
| **AC-39** | Scaled recipe persists at its new size | Integration | Save a 20 L recipe, scale to 40 L, save, restart, reload → `equipment.batchSizeL === 40`, and recomputed `og`/`ibu` equal the pre-scale values. (This is the criterion the current `handleScaleRecipe` fails: it keeps `id: 'eq-1'`, so a reload would silently restore 20 L.) |
| **AC-40** | Failed save preserves edits | Integration (web) | With the API stubbed to return `500`, edit the recipe name and save: `saveState === 'error'`, `saveError.message` is rendered, the edited name is **still in the input**, and `isDirty` is still `true`. No blank/default recipe is substituted |
| **AC-41** | Error banner is not auto-cleared | Integration (web) | After a failed save, further editing keeps the banner visible; only a successful save (or explicit dismiss) removes it, and dismissing leaves `isDirty === true` |
| **AC-42** | Retry after failure succeeds cleanly | Integration (web) | With the API restored, Retry produces `saveState === 'idle'`, `saveError === null`, `isDirty === false`, and the working recipe's line-item ids now match the server's |
| **AC-43** | Stats stay live during a save error | Integration (web) | While `saveState === 'error'`, changing a fermentable's `amountKg` changes the displayed OG in the same render — stats are not gated on network state |
| **AC-44** | Failed list load shows an error, not an empty state | Integration (web) | With `GET /api/recipes` returning `500`, the library renders an error panel with Retry and does **not** render the "no recipes yet" empty state |
| **AC-45** | Misc section round-trips end to end | Integration | Add a `WaterAgent` misc (`Gypsum, 4 g, Mash, 0 min`) through the API, restart, reload → present with identical field values; `calculateRecipeStats` output is **bit-identical** to the same recipe without the misc (M2 proves Misc is stored but inert) |
| **AC-46** | `seedData.ts` is gone | Verification | `apps/web/src/data/seedData.ts` does not exist; `grep -rn "seedData\|INGREDIENT_CATALOG\|INITIAL_SAMPLE_RECIPE\|SEED_EQUIPMENT_PROFILES" apps/web packages` returns nothing |
| **AC-47** | Old scale logic is gone | Verification | No code path constructs an equipment object that changes `batchSizeL` while retaining the source profile's `id`; `grep -rn "handleScaleRecipe" apps/web` finds only the new implementation |
| **AC-48** | Root `npm test` runs both suites | Command | `npm test` from the repo root reports results from **both** `@truchabrew/calculations` and `@truchabrew/api`, exits `0`, `0 failed` |
| **AC-49** | M1 regression | Command | The full M1 calculation suite (units, brewingMath, all six Montano fixtures — OG/IBU/colour/FG/ABV/BU:GU/RBR and the water checks) still passes unmodified apart from `fixtureAdapter.ts`'s two added fields |
| **AC-50** | Cold clone | Command | From a clean checkout with no pre-existing DB file: `npm install && npm test` exits `0`, with **no** `prisma generate`-style codegen step and no network access required |
| **AC-51** | Typecheck / build / lint | Command | `npm run typecheck`, `npm run build`, `npm run lint` each exit `0` across all four packages |
| **AC-52** | Migrations are committed, DB is not | Verification | `apps/api/drizzle/` contains at least one `.sql` migration and is git-tracked; `apps/api/data/` is gitignored and no `.db` file is tracked |
| **AC-53** | **Manual — full restart recovery** | Manual | `npm run dev`; create a new recipe through the UI with at least 2 fermentables, 3 hops (one Boil, one Whirlpool, one DryHop), 1 yeast and 1 misc; note the on-screen OG/FG/ABV/IBU/EBC/BU:GU/RBR. Stop **both** processes, restart them, reopen from the library — every ingredient and every displayed stat matches. Screenshots before and after at `.gsd/active/manual_verification/M2_P1_restart_before.png` / `_after.png` |
| **AC-54** | **Manual — scale 20 → 40 L** | Manual | With a saved 20 L recipe, scale to 40 L; OG and IBU on screen are unchanged, grain and hop amounts have doubled, the equipment picker shows the derived profile. Save, restart, reopen — still 40 L with the same OG/IBU. Screenshot at `.gsd/active/manual_verification/M2_P1_scale_40l.png` |
| **AC-55** | **Manual — failed save is visible** | Manual | With the recipe open and edited, kill the API process, press Save. An error is clearly visible, the edits remain on screen, and restarting the API and pressing Save again succeeds. Screenshot of the error state at `.gsd/active/manual_verification/M2_P1_save_error.png` |
| **AC-56** | **Scope guardrail** | Verification | Of the paths this session touched: nothing under `.claude/`, `.agents/`; nothing under `.gsd/` except `M2_P1_feature_spec.md`, `STATE.json`, and `.gsd/active/manual_verification/**`. `CLAUDE.md`, `README.md`, `.oxlintrc.json` unmodified. Within `packages/calculations`, only `src/scaling.ts`, `src/index.ts`, `test/scaling.test.ts`, `test/fixtures/fixtureAdapter.ts` and `test/brewingMath.test.ts` appear — and in `brewingMath.test.ts` the only permitted change is the two named default fields on `baseEquipment()`/`baseRecipe()` (§1.5). `src/constants.ts`, `src/units.ts`, `src/brewingMath.ts`, `test/units.test.ts` and `test/fixtures.test.ts` must be byte-unchanged. `apps/web/src/components/StatsHeader.tsx` and `src/utils/srmColor.ts` byte-unchanged. Check by per-session provenance (pre-execution stash point or mtime), not a raw whole-tree `git diff` — see M1's AC-42 correction |

---

## 4. Deviation Register — requires explicit sign-off at the halt gate

Four points where this spec departs from `ROADMAP.md` or resolves something it left open. Each is reversible at this gate.

1. **ORM choice: Drizzle** (`ROADMAP.md` line 56 leaves this explicitly open, "decided at `/plan`"). Rationale in §Resolved Ambiguities. The decisive factor is M1's cold-clone guarantee: Prisma's `prisma generate` step means either a `postinstall` hook or a broken `npm install && npm test` from a fresh clone, and its generated client duplicates `@truchabrew/shared-types` as a second source of truth. *Overrule and the schema becomes `apps/api/prisma/schema.prisma`, `@prisma/client` replaces `drizzle-orm`, a `postinstall: prisma generate` is added to the root `package.json`, and AC-50 is amended to permit that codegen step.*

2. **The roadmap's description of the `handleScaleRecipe` bug is out of date after M1 — OG and IBU are already invariant.** `ROADMAP.md` line 59 says scaling "does not actually preserve gravity and IBU". Hand-checked against the current post-M1 code with the seeded 20 L sample recipe: `og = gravityAtVolume(extractPoints, brewhouseEfficiencyPct, batchSizeL)`, and doubling both `extractPoints` and `batchSizeL` leaves `og` algebraically identical (1.068 → 1.068); IBU is `mg/L × utilization(og)`, and both the mg and the L double, so it too is identical. **IBU's dependence on the un-scaled volumes was real before M1** — the pre-M1 engine fed `preBoilGravity` into Tinseth, and `preBoilGravity` *does* move under the broken scale — so M1's wort-gravity-basis fix incidentally closed the roadmap's stated symptom. What remains genuinely broken is (a) `preBoilGravity`, which moves from **1.057 to 1.063** (≈6.8 gravity points, ~6× M1's ±1% band) because `trubChillerLossL` and `boilOffRateLPerHour` stay frozen; (b) all four water volumes; and (c) — newly critical once persistence exists — the scaled recipe keeps `equipment.id === 'eq-1'`, so a saved-then-reloaded scaled recipe would silently snap back to 20 L. This spec fixes all three via the derived-profile design, and AC-9/AC-10 assert OG/IBU and pre-boil gravity separately so the distinction is provable rather than assumed. *No overrule needed unless you want the fix scoped differently; flagged because the roadmap's stated symptom and the actual defect are not the same thing.*

3. **No derived `RecipeData` cache is stored at all.** `ROADMAP.md` line 57 says "derived `RecipeData` is a cache, never the source of truth" and build-spec §2 defines a `RecipeData` block. This spec stores **zero** derived values. A cache with no invalidation story is a correctness liability — a stale `og` column that disagrees with the recomputed one is precisely the "source of truth" confusion the roadmap warns about, and there is no read-performance problem to solve at single-user scale with a local SQLite file. Recomputing from stored inputs is a *stronger* guarantee than the roadmap asked for, and AC-23 tests it as an exact identity rather than a tolerance. *Overrule and a `recipe_data` table is added with an explicit "recompute on read, compare, log divergence" rule.*

4. **`POST /api/equipment-profiles` ships in M2, ahead of M3's equipment CRUD.** `ROADMAP.md` line 67 assigns editable equipment profiles to M3. M2 needs create-only, and only for the scale-derived path — there is no edit form, no `PUT`, no `DELETE`. Without it, scaling either cannot persist or must corrupt the referenced profile. *Overrule and scaling becomes editor-local, unsaveable at a new batch size until M3 — which would forfeit the roadmap's own 20 L → 40 L verification threshold.*

**Known execution risks** (not deviations — flagged so a miss routes to the right layer):

- **`better-sqlite3` is a native module.** It needs a prebuilt binary for Node 24.18.0 on Windows, or a local toolchain to compile. If `npm install` fails to produce a working binding, the documented fallback is `node:sqlite` via `drizzle-orm`'s node-sqlite driver (accepting its `ExperimentalWarning`), **not** switching to a different ORM. That substitution changes only `apps/api/src/db/client.ts`.
- **`PRAGMA foreign_keys` is per-connection.** If any code path opens a second connection without it (a migration runner, a test helper, a CLI script), cascades silently stop working on that connection while AC-27 may still pass on the main one. Every connection must go through `openDatabase()`. A cascade failure discovered later is a `/diagnose` input, not a patch to the delete handler.
- **`Recipe` gaining a required `miscs` and `EquipmentProfile` gaining a required `derivedFromEquipmentId` will surface as `tsc` errors across the M1 fixture adapter and any test recipe literal.** These are expected and are fixed by adding the fields, never by widening the types to optional.

---
> **HALT GATE (STATE 2):** Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments. DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
