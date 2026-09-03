# FEATURE SPECIFICATION: M3_P1 — My Brewhouse, For Real

> **AMENDED 2026-08-06, post-`/verify`. Awaiting re-`SPEC_APPROVED`.** Originally approved 2026-08-05 and built; the independent critic audit traced 54 of 55 criteria YES and one PARTIAL (AC-46) caused by a contradiction inside this document, not by the implementation. This revision corrects that contradiction and three inventory/arithmetic defects the same audit found. **The completed M3_P1 build stands; nothing already implemented is re-derived or re-executed.** Full change list and the one open decision are at the halt gate at the bottom. Every section not named there is byte-unchanged from the approved spec.

## Phase Summary

Today the equipment profile is a nine-field row that the user can **select** but not **edit**. `GET /api/equipment-profiles` and a create-only `POST` (added in M2 solely to persist the scale-derived profile) are the entire surface; there is no `PUT`, no `DELETE`, and no edit form anywhere in `apps/web`. Meanwhile four numbers that are physically properties of *this brewhouse* are compiled into `packages/calculations/src/constants.ts` and read directly by `brewingMath.ts`:

```
MASH_WATER_L_PER_KG        = 3.0    // read at brewingMath.ts:221
GRAIN_ABSORPTION_L_PER_KG  = 0.96   // read at brewingMath.ts:222
HOPSTAND_UTILIZATION_FACTOR= 0.26   // read at brewingMath.ts:165
DEFAULT_HOP_UTILIZATION_PCT= 87     // read at brewingMath.ts:168
```

Two of them carry a literal `// un-hardcoded in M3` comment left by M1's planner. A user with a 2.6 L/kg mash tun or a 1.1 L/kg-absorbing grist has no way to say so, and the water volumes on every recipe are wrong for their kit in a way no setting can fix.

This phase makes the equipment profile the single stored home for every brewhouse number, gives it full CRUD through the API and a real edit form in the web app, and rewrites the calculation engine so that **no function in `/packages/calculations` reads a brewhouse constant that was not passed in as an argument** — the roadmap's own verification threshold, stated as a closed-list guardrail rather than a slogan.

**User-visible outcome:** open Equipment Profiles, edit your actual kit — mash water ratio, grain absorption, hop utilisation, hopstand utilisation, sparge and hopstand temperature, mash-tun heat capacity, grain temperature — save, and every recipe that uses that profile immediately shows different mash water, sparge water, total water and IBU. Create a second profile for your other kettle, delete one you no longer own (unless a recipe still points at it), and have all of it survive a restart.

**This is phase 1 of a two-phase Milestone 3.** See §5 for the split and for M3_P2's scope. P1 delivers "my kit"; P2 delivers "my schedules" (mash and fermentation profiles, strike temperature, infusion volumes, the mash view). Both are vertical slices; neither is a layer.

### Key Behaviors

1. **The equipment profile is the source of truth for every brewhouse number.** Eight new columns join the existing nine. The engine reads all of them off the `EquipmentProfile` argument it already receives.
2. **Four constants are deleted outright, not deprecated.** `MASH_WATER_L_PER_KG`, `GRAIN_ABSORPTION_L_PER_KG`, `HOPSTAND_UTILIZATION_FACTOR` and `DEFAULT_HOP_UTILIZATION_PCT` cease to exist. No shim, no re-export, no default parameter that silently reinstates them.
3. **Existing data does not move.** The migration adds every new column `NOT NULL DEFAULT <the retired constant's value>`, so every recipe already in the database computes bit-identical numbers before and after the migration. M1's six-fixture suite is the proof.
4. **Editing a profile propagates to every recipe that references it.** That is the milestone's entire point, not a side effect. Nothing snapshots equipment yet — M4's batch snapshot is what will protect a brewed batch from a later profile edit.
5. **A profile in use cannot be deleted.** `DELETE` returns `409 EQUIPMENT_IN_USE` when any recipe references it. The `EQUIPMENT_IN_USE` code already exists in `ApiErrorCode`, unused since M2; this phase is where it starts being emitted.
6. **Editing an equipment profile never makes an open recipe dirty.** The recipe row stores `equipment_id`; the embedded profile object is read-side hydration (M2 Key Behavior 2). `isDirty` is therefore redefined over the recipe's *stored inputs*, not over the hydrated object graph.
7. **Two new fields are stored but inert in M3_P1** (`hopstandTemperatureC`, `mashTunHeatCapacityL`, `grainTemperatureC` — the latter two become live in M3_P2's strike-temperature calculation). Storing them now means P2 needs no second equipment migration. This follows M2's precedent for `miscs`.
8. Everything still runs from a cold clone: `npm install && npm test` exits 0, with M1's calculation suite and M2's persistence suite both green.

---

### Resolved Ambiguities (Binding)

- **Which constants count as "brewhouse constants".** The roadmap threshold ("no calculation in `/packages/calculations` reads a brewhouse constant that isn't passed in as an argument") is made testable by a closed list. **Deleted from `constants.ts` in this phase:** `MASH_WATER_L_PER_KG`, `GRAIN_ABSORPTION_L_PER_KG`, `HOPSTAND_UTILIZATION_FACTOR`, `DEFAULT_HOP_UTILIZATION_PCT`. **Explicitly *not* brewhouse constants and therefore retained:** `POUNDS_PER_KG`, `GALLONS_PER_LITER` (unit conversions), `TINSETH_BIGNESS_COEFF`, `TINSETH_BIGNESS_BASE`, `TINSETH_TIME_RATE`, `TINSETH_TIME_DIVISOR`, `MOREY_COEFF`, `MOREY_EXPONENT`, `SRM_TO_EBC`, `LOVIBOND_SLOPE`, `LOVIBOND_OFFSET` (published formula coefficients — swapping them is M7's formula-strategy work, not a kit setting), `AVERAGE_ATTENUATION_BASELINE` (an all-styles reference figure in the RBR definition), and `DEFAULT_ATTENUATION_PCT` (a degenerate-input contract for `averageAttenuationPct([])`, a property of the *yeast list being empty*, not of the brewhouse). AC-4 asserts this list exactly, in both directions.
- **`DEFAULT_HOP_UTILIZATION_PCT` dies with the optional parameter, not by moving.** `calculateSingleHopIbu`'s fourth parameter is currently `hopUtilizationPct?: number` with a `?? DEFAULT_HOP_UTILIZATION_PCT` fallback — which is itself a read of a brewhouse constant that was not passed in. Replacing the default with a new constant would only relocate the violation. The parameter becomes a **required** `HopUtilizationSettings` object (§2.2). A caller that omits it is a `tsc` error, not a silently-defaulted 87%.
- **`hopstandTemperatureC` is stored and displayed but does not drive utilisation in this phase.** Physically, hopstand utilisation falls with hopstand temperature; deriving `hopstandUtilizationFactor` from `hopstandTemperatureC` requires a temperature→utilisation model that M1 never had, and introducing one would move every fixture recipe's IBU and blow M1's ±1.5 IBU band inside a phase whose whole safety argument is "existing numbers do not change". So both fields exist: `hopstandUtilizationFactor` (default `0.26`, the retired constant) is what the engine reads; `hopstandTemperatureC` (default `79.0`) is recorded brew-day paperwork. Coupling them is deferred and is **not** in M3_P2 either — it belongs with M7's formula-strategy work.
- **Boundary operators on every new field, exact.** Validation is inclusive/exclusive exactly as written, enforced identically by the Fastify JSON Schema and by the web form:

  | Field | Admissible | Rejected examples |
  |---|---|---|
  | `mashWaterRatioLPerKg` | `> 0` and `<= 10` | `0`, `-0.1`, `10.01` |
  | `grainAbsorptionLPerKg` | `>= 0` and `<= 5` | `-0.01`, `5.01` |
  | `hopstandUtilizationFactor` | `>= 0` and `<= 1` | `-0.01`, `1.01` |
  | `hopstandTemperatureC` | `>= 0` and `<= 100` | `-0.01`, `100.01` |
  | `spargeTemperatureC` | `>= 0` and `<= 100` | `-0.01`, `100.01` |
  | `mashTunHeatCapacityL` | `>= 0` and `<= 50` | `-0.01`, `50.01` |
  | `grainTemperatureC` | `>= -20` and `<= 50` | `-20.01`, `50.01` |
  | `batchSizeL` | `> 0` | `0`, `-1` |
  | `boilTimeMin` | `>= 0` and `<= 600` | `-1`, `600.01` |
  | `brewhouseEfficiencyPct`, `mashEfficiencyPct` | `> 0` and `<= 100` | `0`, `100.01` |
  | `hopUtilizationPct` | `>= 0` and `<= 200` | `-0.01`, `200.01` |
  | `name` | length `>= 1` after trim | `""`, `"   "` |

  `0` is admissible for `grainAbsorptionLPerKg` (a no-loss BIAB squeeze), for `hopstandUtilizationFactor` (hopstand additions contribute nothing), for `mashTunHeatCapacityL` (a pre-heated or negligible-mass tun) and for `hopUtilizationPct` (an explicit "no hop contribution" setting). `0` is **not** admissible for `mashWaterRatioLPerKg` — a zero-water mash is not a configuration, it is a typo, and it would make P2's strike-temperature calculation divide by zero.
- **Migration default values are exactly the retired constants.** `mash_water_ratio_l_per_kg` → `3.0`, `grain_absorption_l_per_kg` → `0.96`, `hopstand_utilization_factor` → `0.26`. Non-inherited new fields default to `hopstand_temperature_c` → `79.0`, `sparge_temperature_c` → `76.0`, `mash_tun_heat_capacity_l` → `0.0`, `grain_temperature_c` → `20.0`, `notes` → `''`. The same eight values are written explicitly by `seed.ts` for `eq-1`/`eq-2`, so a freshly-seeded database and a migrated pre-M3 database are field-for-field identical (AC-19).
- **`derivedFromEquipmentId` is server-owned and immutable through `PUT`.** `EquipmentUpdateInput` does not contain the field; `updateEquipmentProfile` preserves whatever is stored. A client that sends it gets `400 VALIDATION_FAILED` (`additionalProperties: false`). Provenance is not user-editable, and letting a `PUT` rewrite it would corrupt M2's derived-profile reuse lookup.
- **A hand-edited derived profile simply stops being reused.** `findExistingDerivedProfile` matches on `derivedFromEquipmentId` plus `batchSizeL` within `1e-9` and is **unchanged in this phase**. If the user edits a derived profile's `batchSizeL`, the next scale to that target creates a fresh derived profile instead of reusing it. That is correct behaviour, not a defect: the old row is no longer the profile the scale would have produced.
- **Seed profiles are deletable.** `isSeed` is a *display-ordering* flag (seed-first in the list), not a protection flag. The only bar to deletion is being referenced by a recipe. If the user deletes `eq-1`, `npm run db:seed` recreates it — seeding stays idempotent by `onConflictDoNothing`, so a re-seed after deletion restores the row at its seed defaults and does not clobber any surviving edited profile.
- **Deleting a profile that a *derived* profile points at does not cascade.** `derived_from_equipment_id` is `ON DELETE SET NULL` (unchanged from M2). Deleting `eq-1` while a `eq-1 (40 L)` derived profile exists and is unused by any recipe leaves the derived profile alive with `derivedFromEquipmentId: null`. It does **not** become an orphan and it does **not** block the delete — only a *recipe* reference blocks it.
- **`isDirty` is redefined over stored inputs, not over the hydrated recipe.** `useRecipeEditor`'s `canonicalWorking(recipe)` currently canonicalises the whole `Recipe`, embedded `equipment` object included. Once equipment is editable, saving an equipment profile while a recipe is open would mutate `recipe.equipment` and mark a recipe dirty whose *stored* representation (`equipment_id` + line items) did not change — producing a bogus "unsaved changes" confirm dialog on the way back to the library. The canonical form becomes `canonicalJson(toWriteInput(recipe))`: name, author, styleName, notes, `equipmentId`, and the four line-item arrays with their ids. Consequences, all binding: switching the picker to a *different* profile still marks the recipe dirty (`equipmentId` changed); editing the *currently attached* profile does not; a scale operation still marks it dirty (`equipmentId` changes to the derived profile's id, and amounts change).
- **Equipment edits propagate into an open editor in lockstep, without a save.** On a successful `PUT`, the App calls `editor.applyEquipmentUpdate(updated)`. If `editor.recipe?.equipment.id === updated.id`, the hook replaces `recipe.equipment` with `updated` (identity-preserving on every other field) and the memoised `stats` recompute in the same render. `storedId`, `savedSnapshot` and `saveState` are **not** touched — and by the redefinition above, `isDirty` is unchanged by the substitution. If the ids do not match, `applyEquipmentUpdate` is a no-op on all state.
- **Deleting the profile attached to an open recipe cannot happen.** The recipe references it, so the API returns `409 EQUIPMENT_IN_USE` — but only if that recipe has been *saved*. An **unsaved draft** holding an in-memory reference to a profile is invisible to the server. Binding client-side rule: the equipment manager's Delete button is disabled, with an inline reason, for `editor.recipe?.equipment.id`. This is belt-and-braces over the server check, not a replacement for it; the server check is authoritative and is tested independently.
- **Water volumes get a real exported accessor, closing M2's named residual gap.** M2's AC-11 amendment recorded: *"`mashWaterL`/`spargeWaterL`/`totalWaterL` are computed inline inside `calculateRecipeStats` and have no exported unrounded accessor… deferred to the phase that un-hardcodes the water constants."* That phase is this one. `calculateWaterVolumes` (§2.1) is exported unrounded, `calculateRecipeStats` calls it, and `scaling.test.ts`'s AC-11(a) block is rewritten to call it instead of restating the formula shape. This is the only permitted change to `scaling.test.ts` and it must not alter any tolerance.
- **`deriveScaledEquipment` copies all eight new fields unchanged.** None of them scales with batch size. `mashWaterRatioLPerKg` and `grainAbsorptionLPerKg` are per-kilogram rates, so the *volumes* they produce still scale by exactly `r` because the grain bill does — M2's AC-11 exact-parity property survives untouched. `mashTunHeatCapacityL` is the physical mash tun and does not grow because you asked for more beer; a 20 L → 40 L scale therefore produces a profile the user is expected to correct by hand, which is honest rather than a fabricated number. `notes` is copied verbatim.
- **`CalculatedStats` is unchanged — no field added, renamed or removed.** Strike temperature is not a `CalculatedStats` field; it arrives in M3_P2 through a separate `calculateMashPlan` function with an explicit no-profile branch, precisely so a `number | null` never has to leak into a seventeen-field numeric interface that every downstream consumer treats as total.
- **No new dependency is added.** No new npm package in any workspace. The equipment form is plain React with the existing Tailwind classes and `lucide-react` icons.
- **Dev topology is unchanged.** Vite on `5173`, Fastify on `5177`, `/api` proxied. No new process, no new port.
- **AC-46 amendment (post-`/verify` critic audit): the zero-profile affordance needs one named exception on `RecipeLibrary.tsx`.** AC-46 and §2.4 both required that with zero equipment profiles the "New Recipe" button be **disabled** with an inline note. `RecipeLibraryProps` exposes only `onOpen`/`onOpenError`/`onNew`/`onDeleted` — **no disabling prop** — and `RecipeLibrary.tsx` was on §1.5's Untouched list, so the criterion was **unsatisfiable as written without violating §1.5**. That is a contradiction in this spec, not a defect in the build (`RecipeLibrary.tsx` was confirmed byte-unchanged), and it is the same class as M1's AC-42 and M2's AC-11. It is resolved by carving the exception rather than by lowering the bar, because a live button that silently does nothing on click is a real affordance gap: the user gets no feedback from the interaction at all. Five binding constraints follow.
  - **(a) The prop is a fact, required, and undefaulted.** `RecipeLibraryProps` gains `canCreate: boolean`. Not optional, no default value, no `?`. This mirrors §2.2's rule for `calculateSingleHopIbu`'s settings object and `EquipmentManager`'s existing `activeRecipeEquipmentId` prop: the parent passes a fact, the child derives the disabled state, and a caller that omits it is a `tsc` error rather than a silently-permissive default. `disabledReason: string | null` was the considered alternative and is **rejected** — it puts user-facing copy in a prop and would give the app two places that phrase the zero-profile message.
  - **(b) The wiring expression is fixed, and it is the same one the guard already tests.** `App.tsx` passes `canCreate={equipmentProfiles.length > 0}`. It must be that expression and not a second, separately-derived notion of "can create". The button's enabled state and `handleNew`'s early return are then the same predicate in two places and cannot drift apart into a button that is enabled but inert, or disabled but functional.
  - **(c) `handleNew`'s early-return guard is retained, not replaced.** The `disabled` attribute is the affordance; the guard is the correctness barrier. Keeping both is belt-and-braces in exactly the sense §Resolved-Ambiguities already uses for the delete-disabled rule — a mis-wired or overridden `disabled` attribute must still never reach `startNewRecipe` with no profile, because the failure mode on the other side is the fabricated `id: ''` profile this phase exists to delete.
  - **(d) The disabled state covers the failed-load case too, and must not relabel it.** `canCreate` is `false` whenever the list is empty, including when it is empty **because the load failed**. That is correct: `handleNew` cannot work in either case. But the two states must remain visually distinct — the amber "No equipment profiles yet" note stays gated on `!equipmentError`, so a failed load continues to show the red "Couldn't load equipment profiles" banner and never the amber one. This is the same rule §2.4 already applies to `EquipmentManager`: an empty state shown on a failed load is a lie about the user's data, and a disabled button is not a licence to tell it.
  - **(e) Everything already built for AC-46 stands.** The `id: ''` fabricated profile is gone, `App.tsx` holds no `EquipmentProfile` object literal, and the amber banner with its "Go to Equipment Profiles" button already makes the zero-profile state recoverable in-app. The amendment adds the missing affordance on top of those; it does not reopen them. The residual implementation work is the four enumerated edits in §1.5's `RecipeLibrary.tsx` row plus the one prop at `App.tsx`'s single `<RecipeLibrary …>` call site and the one call site in `RecipeLibrary.test.tsx` — nothing else in the phase is re-executed.

---

## 1. Data Schema & Contracts

### 1.1 Workspace layout — new files and generated migration artifacts

```
/apps/api/drizzle/0001_<name>.sql              NEW — generated migration (COMMITTED)
/apps/api/drizzle/meta/0001_snapshot.json      NEW — generated (COMMITTED)
/apps/api/drizzle/meta/_journal.json           APPENDED — drizzle-kit adds the 0001 entry (COMMITTED).
                                               Mechanically unavoidable: the migrator will not apply
                                               0001 without it. Content is generator output only — it
                                               must not be hand-edited, and the 0000 entry within it
                                               must be byte-unchanged.
/apps/api/test/equipment.crud.test.ts          NEW
/apps/api/test/equipment.migration.test.ts     NEW

/packages/calculations/test/water.test.ts      NEW — calculateWaterVolumes contract
/packages/calculations/test/equipmentDriven.test.ts  NEW — the roadmap's two threshold checks

/apps/web/src/components/EquipmentManager.tsx  NEW — list + delete + entry to the form
/apps/web/src/components/EquipmentForm.tsx     NEW — create/edit, one profile
/apps/web/test/EquipmentManager.test.tsx       NEW
```

No new root scripts. The `db:generate` / `db:seed` scripts from M2 are used as-is.

### 1.2 Database schema — `apps/api/src/db/schema.ts`

`equipment_profiles` gains eight columns. Every other table in the file is **byte-unchanged**.

| Column | Type | Constraint | Default |
|---|---|---|---|
| `mash_water_ratio_l_per_kg` | REAL | NOT NULL | `3.0` |
| `grain_absorption_l_per_kg` | REAL | NOT NULL | `0.96` |
| `hopstand_utilization_factor` | REAL | NOT NULL | `0.26` |
| `hopstand_temperature_c` | REAL | NOT NULL | `79.0` |
| `sparge_temperature_c` | REAL | NOT NULL | `76.0` |
| `mash_tun_heat_capacity_l` | REAL | NOT NULL | `0.0` |
| `grain_temperature_c` | REAL | NOT NULL | `20.0` |
| `notes` | TEXT | NOT NULL | `''` |

The migration is generated by `drizzle-kit generate` and committed. It must be additive `ALTER TABLE … ADD COLUMN` statements only: **no table rebuild, no data copy, no `DROP`**. A rebuild would silently drop the `derived_from_equipment_id` self-reference and the `recipes.equipment_id` `ON DELETE RESTRICT` edge, and the resulting database would look correct while every referential guarantee from M2 was gone. AC-18 inspects the emitted SQL for this directly.

### 1.3 Type changes — `packages/shared-types`

**Modified — `src/brewing.ts`:**

```ts
export interface EquipmentProfile {
  id: string;
  name: string;
  batchSizeL: number;
  boilTimeMin: number;
  brewhouseEfficiencyPct: number;
  mashEfficiencyPct: number;
  boilOffRateLPerHour: number;
  trubChillerLossL: number;
  hopUtilizationPct: number;
  derivedFromEquipmentId: string | null;

  // NEW — all required, all non-nullable.
  mashWaterRatioLPerKg: number;      // L of strike+sparge-basis water per kg grist. > 0.
  grainAbsorptionLPerKg: number;     // L retained by the spent grain per kg. >= 0.
  hopstandUtilizationFactor: number; // multiplier applied to 'Aroma'/'Whirlpool' additions. [0, 1].
  hopstandTemperatureC: number;      // stored + displayed; inert in M3. [0, 100].
  spargeTemperatureC: number;        // brewhouse default; M3_P2's mash profile may override. [0, 100].
  mashTunHeatCapacityL: number;      // water-equivalent thermal mass. Live in M3_P2. [0, 50].
  grainTemperatureC: number;         // grist starting temperature. Live in M3_P2. [-20, 50].
  notes: string;                     // free text, '' when unset. Never null.
}
```

`Recipe`, `CalculatedStats`, `FermentableItem`, `HopItem`, `YeastItem`, `MiscItem` and every union type are **unchanged — no additions, no renames, no removals.**

**Modified — `src/api.ts`:**

```ts
// Unchanged in shape; picks up the eight new fields structurally.
export interface EquipmentCreateInput extends Omit<EquipmentProfile, 'id'> {}

// NEW — omits both `id` (path parameter) and `derivedFromEquipmentId` (server-owned).
export interface EquipmentUpdateInput extends Omit<EquipmentProfile, 'id' | 'derivedFromEquipmentId'> {}

// NEW — the 409 body's `details` payload, so the UI can name the blockers.
export interface EquipmentInUseDetails {
  recipeCount: number;
  recipeNames: string[];   // at most 5, `updatedAt DESC`
}
```

`ApiErrorCode` is **unchanged** — `EQUIPMENT_IN_USE` is already declared and merely starts being emitted.

### 1.4 HTTP contract

| Method & path | Success | Failure |
|---|---|---|
| `GET /api/equipment-profiles` | `200 EquipmentProfile[]` — seed first, then by `name` (unchanged) | `500 INTERNAL` |
| `POST /api/equipment-profiles` | `201 EquipmentProfile` (unchanged, including derived-profile reuse) | `400 VALIDATION_FAILED` |
| **`PUT /api/equipment-profiles/:id`** | `200 EquipmentProfile` — full replace of all **16** mutable fields | `400 VALIDATION_FAILED`, `404 NOT_FOUND` |
| **`DELETE /api/equipment-profiles/:id`** | `204`, empty body | `404 NOT_FOUND`, `409 EQUIPMENT_IN_USE` with `details: EquipmentInUseDetails` |

**Field-count arithmetic, binding (amended post-`/verify`).** Three different counts appear in this spec and they are not interchangeable. `EquipmentProfile` (§1.3) has **18** own fields — 10 pre-M3 plus 8 new; that is the number used by AC-19 and AC-34, which compare *whole profiles*. `EquipmentCreateInput = Omit<EquipmentProfile, 'id'>` has **17**. `EquipmentUpdateInput = Omit<EquipmentProfile, 'id' | 'derivedFromEquipmentId'>` has **16**, and 16 is the number of fields a `PUT` body carries and replaces. The interface declarations in §1.3 are the binding definition; wherever prose and a declaration disagree, the declaration wins.

Every non-2xx body is exactly `ApiErrorBody`, via the existing `sendApiError`. A partial `PUT` body is `400`, never a merge — same contract as `PUT /api/recipes/:id`. There is no `PATCH` for equipment.

Recipe routes (`GET`/`POST`/`PUT`/`PATCH`/`DELETE /api/recipes*`), the catalog route and the health route are **unchanged in this phase**.

### 1.5 Symbol inventory

**New:**

| Symbol | Location |
|---|---|
| `calculateWaterVolumes`, `WaterVolumes` | `packages/calculations/src/brewingMath.ts` |
| `HopUtilizationSettings`, `toHopUtilizationSettings` | `packages/calculations/src/brewingMath.ts` |
| `EquipmentUpdateInput`, `EquipmentInUseDetails` | `packages/shared-types/src/api.ts` |
| `updateEquipmentProfile`, `deleteEquipmentProfile`, `findRecipesUsingEquipment` | `apps/api/src/repositories/equipmentRepository.ts` |
| `equipmentUpdateBodySchema` | `apps/api/src/routes/schemas.ts` |
| `updateEquipmentProfile`, `deleteEquipmentProfile` (client) | `apps/web/src/api/client.ts` |
| `applyEquipmentUpdate` | `apps/web/src/hooks/useRecipeEditor.ts` |
| `EquipmentManager`, `EquipmentForm` | `apps/web/src/components/` |

**Deleted — must not survive as a re-export, alias or default parameter:**

| Symbol | Was |
|---|---|
| `MASH_WATER_L_PER_KG` | `constants.ts:3` |
| `GRAIN_ABSORPTION_L_PER_KG` | `constants.ts:4` |
| `HOPSTAND_UTILIZATION_FACTOR` | `constants.ts:7` |
| `DEFAULT_HOP_UTILIZATION_PCT` | `constants.ts:9` |

**Modified:**

| File | Change |
|---|---|
| `packages/shared-types/src/brewing.ts` | `EquipmentProfile` + 8 required fields (§1.3). Nothing else. |
| `packages/shared-types/src/api.ts` | + `EquipmentUpdateInput`, + `EquipmentInUseDetails`. Nothing else. |
| `packages/calculations/src/constants.ts` | 4 constants deleted; the two `// un-hardcoded in M3` comments and the `// M1's constant; M3 moves it…` comment go with them |
| `packages/calculations/src/brewingMath.ts` | `calculateSingleHopIbu` signature (§2.2); `calculateWaterVolumes` extracted and exported; step 10 of `calculateRecipeStats` calls it; the four constant imports removed |
| `packages/calculations/src/scaling.ts` | `deriveScaledEquipment` copies the 8 new fields verbatim; no other change |
| `packages/calculations/test/units.test.ts` | `HOPSTAND_UTILIZATION_FACTOR` / `DEFAULT_HOP_UTILIZATION_PCT` removed from the import list (lines 3–4) and their two `expect` lines (22–23) deleted. **The other six constant assertions and every conversion test are untouched.** |
| `packages/calculations/test/brewingMath.test.ts` | `baseEquipment()` defaults gain the 8 fields at their retired-constant values; `calculateSingleHopIbu` call sites pass the settings object. **No numeric expectation, tolerance or case changes.** |
| `packages/calculations/test/fixtures/fixtureAdapter.ts` | the equipment literal gains the 8 fields at their retired-constant values. **No expectation, potential or tolerance changes.** |
| `packages/calculations/test/scaling.test.ts` | AC-11(a)'s water terms call `calculateWaterVolumes` instead of restating the formula; new sub-case asserting the 8 fields survive `deriveScaledEquipment`. **No tolerance changes.** |
| `apps/api/src/db/schema.ts` | `equipmentProfiles` + 8 columns |
| `apps/api/src/db/seed.ts` | `SEED_EQUIPMENT_PROFILES` entries gain the 8 fields explicitly |
| `apps/api/src/repositories/equipmentRepository.ts` | `equipmentRowToDomain` maps 8 more fields; `CreateEquipmentInput` gains them; + 3 new functions |
| `apps/api/src/routes/equipment.ts` | + `PUT`, + `DELETE` |
| `apps/api/src/routes/schemas.ts` | `equipmentCreateBodySchema` gains the 8 fields with §Resolved-Ambiguities bounds; + `equipmentUpdateBodySchema` |
| `apps/api/test/helpers/fixtures.ts` | equipment literals gain the 8 fields |
| `apps/web/src/api/client.ts` | + 2 functions |
| `apps/web/src/hooks/useRecipeEditor.ts` | `canonicalWorking` → canonicalises `toWriteInput(recipe)`; + `applyEquipmentUpdate`; `EMPTY_RECIPE_FOR_STATS` gains the 8 fields at zero |
| `apps/web/src/App.tsx` | `view` gains `'equipment'`; header entry point; fabricated fallback profile removed (§2.5); `handleEquipmentChange` unchanged |
| `apps/web/src/components/HopSection.tsx` | `hopstandUtilizationFactor: number` prop added; the `calculateSingleHopIbu` call at line 95 passes the settings object. **No other change.** |
| `apps/web/src/components/RecipeLibrary.tsx` | **Narrow named exception, added by amendment (see the AC-46 amendment bullet in Resolved Ambiguities).** Exactly four things: (1) `RecipeLibraryProps` gains `canCreate: boolean` — required, not optional, no default; (2) it is destructured in the component signature; (3) the "New Recipe" `<button>` gains `disabled={!canCreate}`; (4) that same button gains a `title` when disabled and a disabled visual treatment on its `className`. **Nothing else in this file may change** — no new state, no new import beyond what those four require, no change to `load`, `handleOpen`, `startRename`, `commitRename`, `handleDuplicate`, `handleDelete`, the search input, the error panel, the empty state, or any list-row markup. |
| `apps/web/test/RecipeLibrary.test.tsx` | Call-site update only: the existing `<RecipeLibrary …>` render gains `canCreate`. Required because `apps/web/tsconfig.test.json` has `"include": ["test", "src"]`, so `npm run typecheck` compiles this file and a missing required prop is a `tsc` error. **No assertion, case or expectation changes.** |
| `apps/web/test/setup.ts` | + an explicit `afterEach(() => cleanup())` (3 lines). `apps/web/vitest.config.ts` does not set `test.globals: true`, so `@testing-library/react`'s auto-cleanup never self-registers; `EquipmentManager.test.tsx` is the first suite to call `render()` more than once in a single file, and without the explicit cleanup the DOM leaks between tests and `getBy*` throws on duplicate matches. **`vitest.config.ts` itself stays untouched** — setting `globals: true` there would change behaviour for every pre-existing suite, which is the wider fix, not the narrower one. |
| `apps/web/test/useRecipeEditor.test.tsx` | fixtures gain the 8 fields; + dirty-semantics cases |

**Untouched — must be byte-unchanged:**

`packages/calculations/src/units.ts`; `packages/calculations/test/fixtures.test.ts`; `packages/calculations/test/fixtures/montano_brewing_recipes.json`; `packages/calculations/test/fixtures/fermentablePotentials.ts`; `packages/shared-types/src/misc.ts`; `packages/shared-types/src/index.ts`; `apps/api/src/routes/recipes.ts`; `apps/api/src/routes/catalog.ts`; `apps/api/src/routes/health.ts`; `apps/api/src/repositories/recipeRepository.ts`; `apps/api/src/repositories/catalogRepository.ts`; `apps/api/src/mappers/recipeMapper.ts`; `apps/api/src/server.ts`; `apps/api/src/errors.ts`; `apps/api/src/db/client.ts`; `apps/api/src/db/migrate.ts`; `apps/api/drizzle/0000_futuristic_quasimodo.sql`; `apps/api/drizzle/meta/0000_snapshot.json`; `apps/web/src/components/StatsHeader.tsx`; `FermentableSection.tsx`; `YeastSection.tsx`; `MiscSection.tsx`; `SaveBar.tsx`; `apps/web/src/context/CatalogContext.tsx`; `apps/web/src/utils/srmColor.ts`; `apps/web/src/index.css`; `apps/web/vitest.config.ts`; `packages/better-sqlite3-shim/**`; `CLAUDE.md`; `.claude/**`; `.agents/**`; every path under `.gsd/` except `.gsd/active/M3_P1_feature_spec.md`, `.gsd/STATE.json`, and `.gsd/active/manual_verification/**`.

> **Amendment note.** `apps/web/src/components/RecipeLibrary.tsx` was on this list in the pre-amendment spec and has been **moved to the Modified table above** as a narrow, exhaustively-enumerated exception. That move is the whole substance of the AC-46 amendment; it is not a general licence to edit the file. Every other path on this list is unchanged from the approved spec, and `apps/web/vitest.config.ts` has been added to it explicitly (it was previously unlisted — see the `apps/web/test/setup.ts` row).

---

## 2. Transformations & Pure Logic

No function in this section performs I/O, reads a clock, generates an id, or touches `Math.random`.

### 2.1 Water volumes — `packages/calculations/src/brewingMath.ts`

```ts
export interface WaterVolumes {
  mashWaterL: number;        // unrounded
  grainAbsorptionL: number;  // unrounded
  spargeWaterL: number;      // unrounded
  totalWaterL: number;       // unrounded
}

/**
 * Every term is derived from `equipment` and the two scalars — no module-level
 * brewhouse constant is read. Returns unrounded quantities; rounding is the
 * caller's business (calculateRecipeStats step 11 is the only rounder).
 */
export function calculateWaterVolumes(
  equipment: EquipmentProfile,
  totalGrainKg: number,
  preBoilVolumeL: number,
): WaterVolumes;
```

Definition, exactly:

```
mashWaterL       = totalGrainKg * equipment.mashWaterRatioLPerKg
grainAbsorptionL = totalGrainKg * equipment.grainAbsorptionLPerKg
spargeWaterL     = Math.max(0, preBoilVolumeL - (mashWaterL - grainAbsorptionL))
totalWaterL      = mashWaterL + spargeWaterL
```

This is `brewingMath.ts` lines 221–224 verbatim with the two constants replaced by profile fields — **the arithmetic does not change**, which is what makes AC-1's bit-identity guarantee possible. The `Math.max(0, …)` clamp on sparge is retained and is the *only* clamp: negative inputs are prevented at the validation boundary, not silently repaired here.

`totalGrainKg === 0` returns `{ mashWaterL: 0, grainAbsorptionL: 0, spargeWaterL: max(0, preBoilVolumeL), totalWaterL: max(0, preBoilVolumeL) }` — identical to today's empty-recipe behaviour, so M1's empty-recipe contract is preserved unchanged.

### 2.2 Hop utilisation settings — `packages/calculations/src/brewingMath.ts`

```ts
export interface HopUtilizationSettings {
  hopUtilizationPct: number;       // 100 = textbook Tinseth
  hopstandUtilizationFactor: number; // applied to 'Aroma' and 'Whirlpool' only
}

/** Trivial, pure projection. Exists so the web app cannot drift from the engine. */
export function toHopUtilizationSettings(equipment: EquipmentProfile): HopUtilizationSettings;

/**
 * BREAKING signature change: the fourth parameter is required and is an object.
 * There is no default — a caller that omits it is a type error, by design.
 */
export function calculateSingleHopIbu(
  hop: HopItem,
  wortGravity: number,
  batchVolumeL: number,
  settings: HopUtilizationSettings,
): number;
```

Body changes, and only these: `HOPSTAND_UTILIZATION_FACTOR` → `settings.hopstandUtilizationFactor`; `(hopUtilizationPct ?? DEFAULT_HOP_UTILIZATION_PCT)` → `settings.hopUtilizationPct`. Every existing early-return guard (`classifyHopUse(...) === 'none'`, `timeMinutes <= 0`, `amountG <= 0`, `alphaAcidPct <= 0`, `batchVolumeL <= 0`, `wortGravity <= 1.0`) is retained verbatim and in the same order. `classifyHopUse`, `tinsethBignessFactor` and `tinsethBoilTimeFactor` are untouched.

### 2.3 Scaling — `packages/calculations/src/scaling.ts`

`scaleFactor`, `canScale` and `scaleRecipe` signatures and behaviour are **unchanged**. `deriveScaledEquipment` gains eight lines, all straight copies:

| Field | Rule under `deriveScaledEquipment` |
|---|---|
| `mashWaterRatioLPerKg`, `grainAbsorptionLPerKg` | copied — per-kg rates; the volumes they produce still scale by exactly `r` because the grist does |
| `hopstandUtilizationFactor`, `hopUtilizationPct` | copied — dimensionless |
| `hopstandTemperatureC`, `spargeTemperatureC`, `grainTemperatureC` | copied — temperatures do not scale |
| `mashTunHeatCapacityL` | copied — the physical tun does not grow with the batch |
| `notes` | copied verbatim |

### 2.4 No-match / fallback contracts

| Situation | Contract |
|---|---|
| `PUT /api/equipment-profiles/:id` on an unknown id | `404 NOT_FOUND`. **Nothing is written.** No upsert-on-missing under any circumstance. |
| `DELETE` on an unknown id | `404 NOT_FOUND`. |
| `DELETE` on a profile referenced by ≥1 recipe | `409 EQUIPMENT_IN_USE`, `details` = `{ recipeCount, recipeNames }` (≤5 names, `updatedAt DESC`). The row is **not** deleted and no recipe is modified. |
| `findRecipesUsingEquipment` matching nothing | Returns `[]`. An empty array is a valid result and is what authorises the delete — never `null`, never a thrown error. |
| `GET /api/equipment-profiles` when the table is empty | `200 []`. |
| Web: equipment list load fails | `EquipmentManager` renders an error panel with the server message and Retry. It must **not** render an "no equipment profiles yet" empty state — an empty state on a failed load is a lie about the user's data. |
| Web: equipment save fails | The form stays populated with the user's edits, a persistent error banner shows the server message, and **no** profile in the in-memory list is mutated. A `409`/`400` never closes the form. |
| Web: zero equipment profiles exist, list loaded successfully | "New Recipe" is **disabled** — `RecipeLibrary` receives `canCreate={equipmentProfiles.length > 0}` and applies `disabled={!canCreate}` — **and** the amber inline note renders above the library with its link to the equipment manager. `handleNew` additionally early-returns, so even a bypassed `disabled` attribute cannot proceed. No fabricated placeholder profile is ever constructed (§2.5, §2.6). |
| Web: equipment list load **failed**, so the list is empty | "New Recipe" is **disabled** by the same `canCreate` expression — `handleNew` could not work here either. The **red** "Couldn't load equipment profiles" banner shows; the **amber** "No equipment profiles yet" note does **not** (it stays gated on `!equipmentError`). A failed load must never be relabelled as "you have no profiles". |
| Web: ≥1 equipment profile exists | "New Recipe" is enabled, carries no `title` reason, and `onNew` runs `startNewRecipe(equipmentProfiles[0])` as today. Neither banner renders. |
| `calculateWaterVolumes` with `totalGrainKg === 0` | §2.1's zero-grain row. Not an error, not `NaN`. |
| `calculateSingleHopIbu` with `settings.hopUtilizationPct === 0` | Returns `0` through the normal arithmetic. No special-case branch is added. |
| `applyEquipmentUpdate` when ids do not match, or `recipe === null` | Total no-op. `recipe`, `storedId`, `savedSnapshot`, `saveState`, `saveError` all unchanged. |

### 2.5 Stateful integration

**`apps/web/src/hooks/useRecipeEditor.ts`** — state shape is unchanged (`recipe`, `storedId`, `savedSnapshot`, `saveState`, `saveError`). Two changes:

1. `canonicalWorking(recipe)` becomes the canonical JSON of `toWriteInput(recipe)` — keys lexicographically sorted at every depth, arrays in order, `createdAt`/`updatedAt` still excluded (they are not in `RecipeWriteInput` anyway). `toWriteInput` is the existing function and is unchanged. `savedSnapshot` is written from the same projection everywhere it is written today (`loadRecipe`, successful `save`). The three write sites must use the identical function — a snapshot written from one projection and compared against another produces a permanently-dirty editor.
2. New method, added to `UseRecipeEditorResult`:

```ts
/**
 * Substitutes a freshly-saved equipment profile into the working recipe when
 * (and only when) the open recipe references it. Never writes storedId,
 * savedSnapshot, saveState or saveError — the recipe's stored inputs did not
 * change, so the editor's dirty state must not change either.
 */
applyEquipmentUpdate: (profile: EquipmentProfile) => void;
```

Lockstep requirements, all of which must hold in a single render pass:

- `stats = useMemo(() => calculateRecipeStats(recipe ?? EMPTY_RECIPE_FOR_STATS), [recipe])` stays unconditional and ungated on `saveState`. `applyEquipmentUpdate` changes the `recipe` reference, so `stats` recompute; `StatsHeader`'s water and IBU tiles and `HopSection`'s per-addition IBU column update together, from the same `recipe.equipment`, in the same render. There is no second source of equipment for any consumer.
- `HopSection` receives `hopstandUtilizationFactor` from `recipe.equipment.hopstandUtilizationFactor` — the same object `calculateRecipeStats` consumed. It must **not** be threaded from `App`'s `equipmentProfiles` list, which can be one fetch behind.
- `beforeunload` registration continues to key off `isDirty`, and therefore no longer fires for an equipment-only edit.

**`apps/web/src/App.tsx`** — `view: 'list' | 'editor' | 'equipment'`. Entering `'equipment'` from the editor does **not** run the unsaved-changes confirm (the recipe stays mounted in hook state and is returned to intact); entering `'list'` from the editor still does. After any successful create/update/delete, `loadEquipmentProfiles()` is re-run and, for an update, `editor.applyEquipmentUpdate(updated)` is called.

### 2.6 Refactoring & legacy cleanup

- **Delete the four constants and every import of them.** `grep -rn "MASH_WATER_L_PER_KG\|GRAIN_ABSORPTION_L_PER_KG\|HOPSTAND_UTILIZATION_FACTOR\|DEFAULT_HOP_UTILIZATION_PCT" apps packages` must return nothing. No deprecation re-export, no `/** @deprecated */` alias, no default parameter value that reinstates `0.26` or `87`.
- **Delete the fabricated fallback equipment profile in `App.tsx` (`handleNew`, lines 56–68).** It constructs a profile with `id: ''`, which cannot satisfy `equipmentId` on any write — a recipe started from it is guaranteed to fail its first save with `EQUIPMENT_NOT_FOUND` and a confusing message. It is replaced by the disabled-New-Recipe contract in §2.4. With the equipment manager shipping in this phase, the "no profiles exist" state is now recoverable in-app, which is what makes deleting the placeholder safe.
- **Delete the render-time `setView('list')` at `App.tsx:146`** (the `!recipe` branch) — a React state update during render, carried as a non-blocking finding through both M2 critic passes. With three views it is no longer unreachable-in-practice. Replace it with a `useEffect`-guarded redirect or an early `return null` plus an effect; either is acceptable, a state write during render is not.
- **`calculateSingleHopIbu`'s optional fourth parameter must not survive in any form.** An overload, a `Partial<HopUtilizationSettings>`, or `settings = { hopUtilizationPct: 87, hopstandUtilizationFactor: 0.26 }` as a default all reintroduce exactly the violation this phase exists to remove.
- **`equipmentRowToDomain` stays the single row→domain projection.** No route, repository or test may hand-assemble an `EquipmentProfile` from a row; adding a field in one place and not the other is how a profile ends up with `undefined` where a `number` is declared.
- **No calculation, mapper or repository may read `hop.type`** — M1's AC-39 remains in force.
- `apps/api/drizzle/` stays committed; `apps/api/data/` stays gitignored.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | **M1 fixture suite is bit-identical** | Unit | All six Montano fixtures produce a `CalculatedStats` object deep-equal (`===` on all 17 fields) to the pre-change values, with the fixture equipment carrying `mashWaterRatioLPerKg: 3.0`, `grainAbsorptionLPerKg: 0.96`, `hopstandUtilizationFactor: 0.26`, `hopUtilizationPct: 87`. `fixtures.test.ts` is byte-unchanged and green |
| **AC-2** | `EquipmentProfile` new fields are required and non-nullable | Unit | An `EquipmentProfile` literal omitting any of the 8 fails `tsc`; assigning `null` to any of them fails `tsc`; `npm run typecheck` exits 0 with all 8 present everywhere |
| **AC-3** | Retired constants are gone | Verification | `grep -rn "MASH_WATER_L_PER_KG\|GRAIN_ABSORPTION_L_PER_KG\|HOPSTAND_UTILIZATION_FACTOR\|DEFAULT_HOP_UTILIZATION_PCT" apps packages` (excluding `node_modules`) returns **zero** matches |
| **AC-4** | **Constant inventory is exactly the closed list** | Unit | `constants.ts`'s exported names are exactly `POUNDS_PER_KG`, `GALLONS_PER_LITER`, `TINSETH_BIGNESS_COEFF`, `TINSETH_BIGNESS_BASE`, `TINSETH_TIME_RATE`, `TINSETH_TIME_DIVISOR`, `MOREY_COEFF`, `MOREY_EXPONENT`, `SRM_TO_EBC`, `LOVIBOND_SLOPE`, `LOVIBOND_OFFSET`, `AVERAGE_ATTENUATION_BASELINE`, `DEFAULT_ATTENUATION_PCT` — no more, no fewer — and their values are unchanged from M1 |
| **AC-5** | **No brewhouse constant is read without being passed in** | Verification | `brewingMath.ts`'s import from `./constants` names only formula/unit constants from AC-4's list; no numeric literal in `brewingMath.ts` equals `3.0`, `0.96`, `0.26` or `87` outside a comment; the same holds for `scaling.ts` and `units.ts` |
| **AC-6** | `calculateWaterVolumes` is exported and unrounded | Unit | `calculateWaterVolumes(eq, 5.75, 34.71)` with `mashWaterRatioLPerKg: 3.0`, `grainAbsorptionLPerKg: 0.96` returns `mashWaterL === 17.25` exactly (not `17.3`), and all four fields are finite |
| **AC-7** | `calculateWaterVolumes` reads only its arguments | Unit | Two calls differing only in `equipment.mashWaterRatioLPerKg` (`3.0` vs `2.5`) return `mashWaterL` differing by exactly `totalGrainKg * 0.5` (within `1e-9`) |
| **AC-8** | `calculateWaterVolumes` zero-grain contract | Unit | `totalGrainKg === 0` → `{ mashWaterL: 0, grainAbsorptionL: 0, spargeWaterL: preBoilVolumeL, totalWaterL: preBoilVolumeL }` for `preBoilVolumeL > 0`; and `preBoilVolumeL === 0` → all four are `0`. No `NaN`, no negative |
| **AC-9** | Sparge clamp holds at the boundary | Unit | With `mashWaterRatioLPerKg` large enough that `mashWaterL - grainAbsorptionL > preBoilVolumeL`, `spargeWaterL === 0` exactly (not negative); at the exact equality point `spargeWaterL === 0` |
| **AC-10** | **Grain absorption moves sparge water** (roadmap threshold) | Unit | On a fixture recipe, raising `grainAbsorptionLPerKg` from `0.96` to `1.20` raises the unrounded `spargeWaterL` by exactly `totalGrainKg * 0.24` (within `1e-9`), leaves `mashWaterL` bit-identical, and raises `totalWaterL` by the same amount |
| **AC-11** | **Hop utilisation moves IBU** (roadmap threshold) | Unit | On a fixture recipe, changing `hopUtilizationPct` from `87` to `100` multiplies the unrounded IBU total by exactly `100/87` (within `1e-9`); the rounded `CalculatedStats.ibu` strictly increases. At `hopUtilizationPct: 0` the total IBU is exactly `0` |
| **AC-12** | Hopstand factor affects only hopstand additions | Unit | Changing `hopstandUtilizationFactor` from `0.26` to `0.52` exactly doubles the contribution of every `'Aroma'`/`'Whirlpool'` addition and leaves every `'Boil'`/`'FirstWort'` contribution bit-identical; `'DryHop'` stays `0` |
| **AC-13** | `calculateSingleHopIbu` settings are required | Unit | Calling with three arguments fails `tsc`; there is no overload and no default value for the fourth parameter |
| **AC-14** | Existing IBU guards are intact | Unit | With valid settings, each of `use: 'DryHop'`, `timeMinutes: 0`, `amountG: 0`, `alphaAcidPct: 0`, `batchVolumeL: 0`, `wortGravity: 1.0` independently returns exactly `0` |
| **AC-15** | `deriveScaledEquipment` copies the 8 new fields | Unit | A 20→40 L derive leaves all 8 fields (including `notes`) bit-identical to the source; `batchSizeL`, `trubChillerLossL`, `boilOffRateLPerHour` still scale per M2 |
| **AC-16** | **M2's AC-11 exact-parity survives** | Unit | The amended AC-11(a) parity check still passes at `r = 2`, now sourcing its water terms from `calculateWaterVolumes` rather than a restated formula; AC-11(b)'s per-field rounding bands `(q/2)(1+r)` are unchanged in value |
| **AC-17** | Migration applies additively | Integration | Migrating a database created at `0000` and populated with a recipe adds all 8 columns; every pre-existing recipe's `calculateRecipeStats` output is deep-equal (`===`) before and after; the row count in every table is unchanged |
| **AC-18** | **Migration does not rebuild the table** | Verification | `apps/api/drizzle/0001_*.sql` contains only `ALTER TABLE \`equipment_profiles\` ADD COLUMN …` statements — no `CREATE TABLE`, no `DROP TABLE`, no `INSERT INTO … SELECT`. After migrating, `PRAGMA foreign_key_list('recipes')` still reports `equipment_id → equipment_profiles.id` with `on_delete = RESTRICT`, and `PRAGMA foreign_key_list('equipment_profiles')` still reports the `SET NULL` self-reference |
| **AC-19** | Seeded and migrated profiles agree | Integration | `eq-1` from a freshly-seeded database is field-for-field `===` to `eq-1` in a database migrated from `0000`, across all 18 fields |
| **AC-20** | Seeding stays idempotent | Integration | `seedDatabase` run twice still yields exactly 2 equipment profiles with the 8 new fields at their documented defaults and unchanged `updatedAt` |
| **AC-21** | `PUT` replaces every mutable field | Integration | A `PUT` changing all **16** mutable fields — i.e. every key of `EquipmentUpdateInput = Omit<EquipmentProfile, 'id' \| 'derivedFromEquipmentId'>`, enumerated from the interface rather than hand-listed — returns `200` with every one applied; `GET` afterwards returns the same values; `id` and `createdAt` are unchanged and `updatedAt` has advanced. See §1.4's field-count arithmetic: 18 is the *total* field count (AC-19, AC-34), 17 is the *create*-input count, 16 is what a `PUT` replaces |
| **AC-22** | `PUT` preserves `derivedFromEquipmentId` | Integration | `PUT` on a derived profile leaves `derivedFromEquipmentId` at its stored value; a body **containing** `derivedFromEquipmentId` returns `400 VALIDATION_FAILED` and writes nothing |
| **AC-23** | `PUT` on an unknown id writes nothing | Integration | `404 NOT_FOUND` with a well-formed `ApiErrorBody`; `SELECT COUNT(*) FROM equipment_profiles` is unchanged; no row was upserted |
| **AC-24** | Partial `PUT` body is rejected | Integration | A body missing `mashWaterRatioLPerKg` returns `400 VALIDATION_FAILED`; the stored row is bit-identical to before the call |
| **AC-25** | **Boundary validation, exact operators** | Integration | For each row of the Resolved-Ambiguities bounds table, the stated rejected values return `400 VALIDATION_FAILED` and the stated boundary-admissible values (`mashWaterRatioLPerKg: 10`, `grainAbsorptionLPerKg: 0` and `5`, `hopstandUtilizationFactor: 0` and `1`, `grainTemperatureC: -20` and `50`, `hopUtilizationPct: 0` and `200`, `boilTimeMin: 0`) return `200`/`201`. `mashWaterRatioLPerKg: 0` is rejected; `grainAbsorptionLPerKg: 0` is accepted |
| **AC-26** | `name` whitespace rejection | Integration | `name: "   "` returns `400 VALIDATION_FAILED` on both `POST` and `PUT` |
| **AC-27** | **`DELETE` blocked by a referencing recipe** | Integration | With one recipe on `eq-1`, `DELETE /api/equipment-profiles/eq-1` returns `409` with `error.code === 'EQUIPMENT_IN_USE'` and `details.recipeCount === 1`, `details.recipeNames` containing that recipe's name; the profile row and the recipe row both still exist and are unmodified |
| **AC-28** | `details.recipeNames` is capped | Integration | With 7 recipes on one profile, `details.recipeCount === 7` and `details.recipeNames.length === 5` |
| **AC-29** | `DELETE` succeeds when unreferenced | Integration | Deleting a profile no recipe points at returns `204` with an empty body; a subsequent `GET` of the list omits it; every other profile and every recipe is untouched |
| **AC-30** | `DELETE` on an unknown id | Integration | `404 NOT_FOUND`, well-formed `ApiErrorBody`, profile count unchanged |
| **AC-31** | Deleting a derived profile's source nulls the link | Integration | With `eq-1` and an unreferenced derived profile pointing at it, deleting `eq-1` returns `204` and leaves the derived profile present with `derivedFromEquipmentId === null` — not deleted, not orphaned |
| **AC-32** | A seed profile is deletable when unused | Integration | `DELETE eq-2` (no recipes referencing it) returns `204`; a subsequent `seedDatabase` restores `eq-2` at its seed defaults without altering any other profile |
| **AC-33** | **Editing a profile moves every referencing recipe's numbers** | Integration | Save recipe R on profile P; `PUT` P with `mashWaterRatioLPerKg: 2.5` and `hopUtilizationPct: 100`; re-`GET` R; `calculateRecipeStats` on the reloaded R shows `mashWaterL` at exactly `totalGrainKg * 2.5` (before rounding) and an IBU strictly higher than before. No field of R's own row changed and R's `updatedAt` is unchanged |
| **AC-34** | Equipment edits survive restart | Integration | `PUT` a profile, close the database handle, reopen the file with a new connection and server instance, `GET` — all 18 fields are `===` to the response of the `PUT`. Real temp file, never `:memory:` |
| **AC-35** | Float precision on the new columns | Integration | `mashWaterRatioLPerKg: 2.6875`, `grainAbsorptionLPerKg: 1.0125`, `hopstandUtilizationFactor: 0.2625` round-trip with `===`, not approximate equality |
| **AC-36** | M2 recipe round-trip is unaffected | Integration | M2's `canonicalRecipeJson` restart round-trip still passes byte-identically, now with 18-field equipment hydration |
| **AC-37** | **Equipment edit does not dirty an open recipe** | Integration (web) | With a clean saved recipe open, `applyEquipmentUpdate` with a profile whose id matches: `recipe.equipment` is the new object, `stats` have changed, and `isDirty === false`, `storedId`, `savedSnapshot`, `saveState`, `saveError` all unchanged |
| **AC-38** | Non-matching `applyEquipmentUpdate` is a total no-op | Integration (web) | With a profile whose id differs, and separately with `recipe === null`: every piece of hook state is reference-identical to before the call |
| **AC-39** | Real edits still dirty the recipe | Integration (web) | Changing a fermentable's `amountKg` → `isDirty === true`; switching the picker to a **different** profile → `isDirty === true`; a scale operation → `isDirty === true` |
| **AC-40** | Dirty-state snapshot symmetry | Integration (web) | After a successful save, `isDirty === false`; after `loadRecipe`, `isDirty === false`. Both `savedSnapshot` writes use the same projection as the comparison, so an untouched loaded recipe is never dirty |
| **AC-41** | **Lockstep stats update** | Integration (web) | In the render immediately following `applyEquipmentUpdate`, `StatsHeader`'s Mash Water / Sparge / Total Water / IBU values and `HopSection`'s per-addition IBU column are all computed from the new profile — no component shows a stale value for one render |
| **AC-42** | `HopSection` reads the recipe's profile, not the list | Verification (web) | `App.tsx` passes `recipe.equipment.hopstandUtilizationFactor` and `recipe.equipment.hopUtilizationPct` to `HopSection`; no `equipmentProfiles`-list lookup feeds any IBU display |
| **AC-43** | Failed equipment save preserves the form | Integration (web) | With `PUT` stubbed to `500`, the form's edited values are still on screen, an error banner shows the server message, the form is still open, and the in-memory profile list is unmutated |
| **AC-44** | Failed equipment list load shows an error, not an empty state | Integration (web) | With `GET /api/equipment-profiles` returning `500`, `EquipmentManager` renders an error panel with Retry and does **not** render the "no equipment profiles" empty state |
| **AC-45** | Delete is disabled for the open recipe's profile | Integration (web) | With recipe R open on profile P, P's row in the manager has a disabled Delete with a visible reason; every other profile's Delete is enabled |
| **AC-46** | **No fabricated placeholder profile, and "New Recipe" is genuinely disabled without one** | Verification (web) + Integration (web) | Amended post-`/verify` — see the **AC-46 amendment** bullet in Resolved Ambiguities for the binding rationale and the §1.5 exception it rests on. Four parts, all required. **(a) No fabrication** — `App.tsx` contains no `EquipmentProfile` object literal (a callback *type annotation* is not a literal), no code path anywhere constructs a profile with `id: ''`, and `handleNew` retains its `equipmentProfiles.length === 0` early return. **(b) The control is disabled** — `RecipeLibraryProps` declares `canCreate: boolean` as required (no `?`, no default), and the "New Recipe" `<button>` carries `disabled={!canCreate}` plus a `title` giving the reason. **(c) It is wired to the same predicate as the guard** — `App.tsx`'s single `<RecipeLibrary …>` call site passes literally `canCreate={equipmentProfiles.length > 0}`; no second, separately-derived "can create" notion exists. **(d) Rendered behaviour matches §2.4's three rows** — with zero profiles and no load error, the button is disabled *and* the amber note with its equipment-manager link renders; with a failed load, the button is disabled *and* the red error banner renders while the amber note does **not**; with ≥1 profile, the button is enabled, carries no reason `title`, and firing it calls `onNew` |
| **AC-47** | No render-time state write | Verification (web) | `App.tsx` contains no `setState`/`setView` call in a component body outside an effect, callback or event handler |
| **AC-48** | `units.test.ts` change is minimal | Verification | The only edits are the removal of the two names from the import list and the two `expect` lines; the other six constant assertions and every conversion test are byte-unchanged |
| **AC-49** | Root `npm test` runs all suites green | Command | `npm test` from the repo root reports `@truchabrew/calculations`, `@truchabrew/api` and `@truchabrew/web`, exits `0`, `0 failed` |
| **AC-50** | Cold clone | Command | From a clean checkout with no pre-existing DB file: `npm install && npm test` exits `0`, with no codegen step and no network access |
| **AC-51** | Typecheck / build / lint | Command | `npm run typecheck`, `npm run build`, `npm run lint` each exit `0` across all workspaces |
| **AC-52** | **Manual — edit the kit, watch the numbers move** | Manual | `npm run dev`; open a saved recipe and note Mash Water, Sparge, Total Water and IBU. Go to Equipment Profiles, edit that profile's mash water ratio `3.0 → 2.4` and hop utilisation `87 → 100`, save, return to the recipe — all four values have visibly changed and the recipe shows **no** unsaved-changes prompt on the way back to the library. Screenshots before and after at `.gsd/active/manual_verification/M3_P1_kit_before.png` / `_after.png` |
| **AC-53** | **Manual — create, restart, delete** | Manual | Create a second profile with distinct values through the form; assign it to a recipe and save; stop both processes and restart; the profile and the assignment are intact with the same values. Attempt to delete it — a clear "in use" message names the recipe. Reassign the recipe to another profile, save, delete again — it succeeds. Screenshots at `.gsd/active/manual_verification/M3_P1_equipment_crud.png` and `_in_use.png` |
| **AC-54** | **Manual — validation is visible** | Manual | Entering `0` for mash water ratio, or an empty name, is rejected with a message identifying the field. Screenshot at `.gsd/active/manual_verification/M3_P1_validation.png` |
| **AC-55** | **Scope guardrail** | Verification | Of the paths this session touched: nothing under `.claude/`, `.agents/`; nothing under `.gsd/` except `M3_P1_feature_spec.md`, `STATE.json`, `.gsd/active/manual_verification/**`. `CLAUDE.md`, `README.md`, `.oxlintrc.json`, root `package.json` unmodified. Every path in §1.5's "Untouched" list is byte-unchanged — in particular `packages/calculations/src/units.ts`, `test/fixtures.test.ts`, `test/fixtures/montano_brewing_recipes.json`, `apps/api/src/repositories/recipeRepository.ts`, `apps/api/src/mappers/recipeMapper.ts`, `apps/api/drizzle/0000_futuristic_quasimodo.sql`, and `apps/web/src/components/StatsHeader.tsx`. Checked by per-session provenance (pre-execution stash point or mtime), not a raw whole-tree `git diff` — see M1's AC-42 correction |

---

## 4. Deviation Register — requires explicit sign-off at the halt gate

Seven points where this spec departs from `ROADMAP.md`'s literal wording, from `.gsd/documents/brewfather_clone_build_spec.md`, from a commitment made in M2's approved spec, or — entry 7 only — from this spec's own §1.5 Untouched list. Each is reversible at this gate. **Entries 1–6 were signed off at the original `SPEC_APPROVED` on 2026-08-05 and are restated here unchanged, for context only. Entry 7 is new, is the substance of this amendment, and is the one that needs a decision now.**

1. **Milestone 3 is split into two phases; this spec is P1 only.** `ROADMAP.md` §Milestone 3 describes one milestone with four hardening bullets. Delivering all four in one phase would mean, in a single execution: an 8-column equipment migration, an engine signature change, two brand-new entity families with ordered child tables and their own CRUD, two new calculation functions, and four new UI surfaces. M2 — a strictly smaller scope — needed two `/diagnose` round-trips as it was. The split (§5) keeps each phase a vertical slice with its own user-visible outcome, and P2 genuinely depends on P1 (strike temperature needs `mashTunHeatCapacityL` and `grainTemperatureC` on the profile). *Overrule and both phases collapse into one spec of roughly 100 acceptance criteria.*

2. **`evaporationRate%` is NOT added to the equipment profile, contradicting a commitment made in M2's approved spec.** M2_P1's Resolved Ambiguities state: *"M3 introduces `evaporationRate%` on the equipment profile and revisits this."* This spec does not. Reason: the profile already stores `boilOffRateLPerHour`, and `evaporationRate%` is the same physical quantity in a different unit. Storing both creates two mutable representations of boil-off with no defined precedence — exactly the source-of-truth confusion the roadmap rejects for derived recipe data — and nothing in this phase reads the second one. The real question M2 flagged (boil-off scales with kettle surface area, ~`r^⅔`, not linearly with volume) is a **scaling** concern living in `deriveScaledEquipment`, and it is not resolved by adding a field. It stays deferred, and the linear approximation stays annotated in `scaling.ts`. *Overrule and `evaporation_rate_pct` is added with a stated precedence rule and a derivation from `boilOffRateLPerHour` at a reference batch size.*

3. **The full build-spec §1.4 field set is not adopted wholesale.** `ROADMAP.md` line 67 says equipment CRUD covers "the full field set in build-spec §1.4". This spec adds 8 of the ~13 remaining §1.4 fields and deliberately omits `boilSize` (already derived as `preBoilVolumeL`; storing it would create a second source of truth), `evaporationRate%` (deviation 2), `fermenterLoss`, `fermenterTopUp`, `fermenterVolume`, `mashTunDeadSpace`, `waterCalculation` (the Default/NoSparge/Custom method selector), and `altitude`. None is read by any calculation in M3_P1 or M3_P2, and each would ship as an inert form field inviting the user to enter a number that changes nothing. They are natural M6 (water) and M7 (config) scope. *Overrule and any named subset is added as stored-and-inert columns with form fields, at roughly 2 ACs each.*

4. **`grainTemperatureC` is added to the equipment profile although build-spec §1.4 does not list it.** M3_P2's `strikeTemp` needs a grain starting temperature. The alternatives were an editor-local UI input (which would make a reloaded recipe's strike temperature non-deterministic — the same class of defect as M2's scaled-recipe-reloads-at-20 L bug) or a hardcoded constant (which is the exact thing this milestone's threshold forbids). Storing it on the profile keeps strike temperature fully derivable from stored data. It is genuinely ambient rather than a property of the kit, and the form labels it as such. *Overrule and it becomes an unstored UI input in P2, with strike temperature explicitly documented as non-reproducible across sessions.*

5. **`HOPSTAND_UTILIZATION_FACTOR` is moved onto the profile even though the roadmap names only mash water ratio, grain absorption, `hopstandTemperature` and `spargeTemperature`.** `ROADMAP.md` line 68 does not mention it — but line 71's threshold ("no calculation in `/packages/calculations` reads a brewhouse constant that isn't passed in as an argument") cannot be satisfied while `brewingMath.ts:165` reads it from `constants.ts`, and M1's own source comment at `constants.ts:6` reads *"M1's constant; M3 moves it onto EquipmentProfile alongside hopstandTemperature."* The same argument retires `DEFAULT_HOP_UTILIZATION_PCT`, whose `??` fallback is a constant read that the roadmap's threshold does not tolerate either. Both are therefore in scope. *No overrule expected; flagged because it widens the roadmap's enumerated list and changes a public function signature.*

6. **`isDirty`'s definition changes, which the roadmap does not mention at all.** Making equipment editable creates an interaction the roadmap could not have anticipated: an equipment edit mutates the hydrated `recipe.equipment` object, and M2's `canonicalWorking` hashes that object, so every equipment save would flag every open recipe as having unsaved changes it does not have. Narrowing the canonical form to the recipe's stored inputs is the minimal correct fix and is strictly more faithful to M2's own Key Behavior 2 ("`equipmentId` is the stored reference; the embedded `equipment` object is read-side hydration"). It does change observable behaviour in one other place: an equipment-only difference can no longer make the browser's `beforeunload` prompt fire. *Overrule and the alternative is to rebase `savedSnapshot` on every `applyEquipmentUpdate`, which requires the hook to retain the last server `StoredRecipe` object rather than only its canonical string.*

7. **NEW, added by amendment after the `/verify` critic audit: `apps/web/src/components/RecipeLibrary.tsx` moves off §1.5's Untouched list and takes one named exception.** The critic traced AC-46 **PARTIAL** and it was the sole reason for the phase's FAIL verdict — not because the build was wrong, but because this spec asked for something it simultaneously forbade. AC-46 and §2.4 required "New Recipe" to be `disabled` with zero profiles; the only file that can carry that attribute was on the Untouched list, and `RecipeLibraryProps` had no disabling prop. The build's response — a `handleNew` no-op guard plus an amber banner linking to the equipment manager — preserves **every safety property AC-46 exists to protect** (no fabricated `EquipmentProfile` literal, no `id: ''` path, the zero-profile state recoverable in-app) and the critic confirmed all of it holds. What is missing is only the affordance: the button stays visually enabled and gives no feedback whatsoever on click. This amendment carves a narrow exception — one required `canCreate: boolean` prop threaded from a value `App.tsx` already computes, applied to the button's `disabled` attribute, with the four permitted edits enumerated exhaustively in §1.5 — rather than weakening what AC-46 protects. The precedent is this spec's own treatment of `fixtureAdapter.ts` and M2_P1's `brewingMath.test.ts` amendment: when an Untouched-list entry collides with a requirement, this project names the narrow exception instead of retiring the requirement. Cost is roughly three lines in `RecipeLibrary.tsx`, one prop at `App.tsx`'s single call site, and one call-site update in `RecipeLibrary.test.tsx` (required by `tsconfig.test.json`'s `include`). *Overrule and the alternative is the opposite resolution: leave `RecipeLibrary.tsx` on the Untouched list, and instead reword §2.4 and AC-46 to describe the already-built guard-plus-banner as the accepted contract — dropping the word "disabled" entirely, so the criterion reads "with zero profiles, `handleNew` is a no-op and an inline note links to the equipment manager". Under that overrule **no further code change is needed at all**: the existing build satisfies the reworded criterion as-is, the phase closes on the current tree, and the accepted residual is that a zero-profile user clicking "New Recipe" gets no feedback from the click. Choose this if you would rather close M3_P1 on the existing build than spend a follow-up `/execute` pass on an affordance.*

**Known execution risks** (not deviations — flagged so a miss routes to the right layer):

- **SQLite `ALTER TABLE ADD COLUMN` requires a constant default.** All eight defaults here are literals, so this is satisfied — but if `drizzle-kit` decides to emit a table rebuild instead (its usual strategy for some constraint changes), the `ON DELETE RESTRICT` and `SET NULL` edges silently vanish and every M2 referential guarantee dies while the tests still pass. AC-18 exists specifically to catch this, and a failure there is a **spec/tooling** problem to route through `/diagnose`, not something to patch by hand-editing the generated migration without re-verifying the foreign-key pragmas.
- **`EquipmentProfile` gaining 8 required fields will surface as `tsc` errors across `fixtureAdapter.ts`, `brewingMath.test.ts`, `apps/api/test/helpers/fixtures.ts`, `apps/web/test/helpers/fixtures.ts` and `EMPTY_RECIPE_FOR_STATS`.** These are expected and are fixed by supplying the fields at their documented defaults — never by widening any field to optional or nullable. Any fixture that supplies a value other than the retired constant will move M1's numbers and fail AC-1.
- **`calculateSingleHopIbu`'s signature change is a breaking API change** with three call sites (`brewingMath.ts`, `HopSection.tsx`, `brewingMath.test.ts`). If a fourth appears during execution, it must pass real profile values, not a fabricated literal.
- **The `better-sqlite3` import is the local `packages/better-sqlite3-shim` over `node:sqlite`**, not the native module (see `apps/api/src/db/client.ts`). Any migration behaviour that depends on driver specifics should be verified against the shim, not assumed from `better-sqlite3` documentation.

---

## 5. Phase split — M3_P2 preview (not in scope here, not yet specced)

Recorded so the halt-gate decision is made with the whole milestone in view. P2 gets its own spec after P1 closes at `/steer`.

**M3_P2 — "My schedules."** User-visible outcome: build a named 3-step mash schedule and a named fermentation schedule, pick each on a recipe, and get a brew-day mash sheet showing strike water temperature and per-step infusion volumes computed from your kit's real numbers.

- `mash_profiles` + `mash_steps` (ordered, `position`-keyed, `UNIQUE(profile_id, position)`, `ON DELETE CASCADE`) and `fermentation_profiles` + `fermentation_steps` on the same pattern — the ordering and cascade design M2 already proved on recipe line items.
- `MashStep { name, type: Infusion|Decoction|Temperature, stepTempC, stepTimeMin, rampTimeMin, infuseAmountL }`; `MashProfile { id, name, targetPh, spargeTempC: number | null }` where `null` means "inherit `equipment.spargeTemperatureC`" — resolved by a pure `resolveSpargeTemperatureC(equipment, mashProfile | null): number`, which is how P1's field and the build spec's per-mash-profile field coexist without a second source of truth.
- `FermentationStep { name, type: Primary|Secondary|Tertiary|ColdCrash|Carbonation|Conditioning, stepTempC, stepTimeDays, rampDays, pressurePsi: number | null }` — stored, with `pressurePsi` inert until M5, on M2's stored-but-inert `miscs` precedent.
- `recipes` gains nullable `mash_profile_id` / `fermentation_profile_id` (`ON DELETE SET NULL`), hydrated into `Recipe` as `mashProfile: MashProfile | null` / `fermentationProfile: FermentationProfile | null`.
- `strikeTemp` and `infusionVolume` from build-spec §3.5, promoted into `packages/calculations` as pure functions taking every term as an argument, plus `calculateMashPlan(recipe): MashPlan` returning a discriminated `{ hasMashProfile: false }` when no profile is attached — so a caller must branch and a placeholder strike temperature can never leak into the mash view or into M4's batch snapshot.
- `CalculatedStats` stays unchanged; the mash plan is a separate return value.
- Roadmap threshold carried into P2: a 3-step mash profile round-trips through the DB with step order preserved.

---
> **HALT GATE (STATE 2) — RE-APPROVAL OF AN AMENDMENT, NOT A FIRST APPROVAL.**
> This spec was approved on 2026-08-05, built, and audited. The critic traced **54 of 55 criteria YES**; AC-46 traced PARTIAL on a contradiction in the spec itself, which is what this amendment fixes. **The existing M3_P1 build stands in full — nothing already implemented is to be re-executed, reverted, or re-derived.**
>
> What changed, and only this: **AC-46** and **§2.4** (the zero-profile "New Recipe" contract), a new binding **AC-46 amendment** bullet in Resolved Ambiguities, **§1.5**'s file tables (`RecipeLibrary.tsx` moved to Modified as a narrow named exception; `RecipeLibrary.test.tsx`, `apps/web/test/setup.ts` added; `vitest.config.ts` added to Untouched), **§1.1** (`drizzle/meta/_journal.json`), **§1.4** and **AC-21** (16 mutable fields, not 18/17), and **§4 deviation 7**.
>
> **§4 deviation 7 is the decision in front of you** and it has two mutually exclusive outcomes: approve as drafted, and a follow-up `/execute` pass makes the ~3-line `RecipeLibrary.tsx` change; or overrule it, and §2.4/AC-46 are instead reworded to bless the existing guard-plus-banner with **no further code change at all**. Deviations 1–6 are already signed off and are not reopened.
>
> Reply with **SPEC_APPROVED** to accept this amendment as drafted, **SPEC_APPROVED with deviation 7 overruled** to take the no-code-change path, or provide feedback/adjustments. DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
