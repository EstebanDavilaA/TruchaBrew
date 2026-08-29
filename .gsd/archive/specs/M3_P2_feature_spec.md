# FEATURE SPECIFICATION: M3_P2 — My Schedules

> **AMENDED 2026-08-06, post-`/verify`. Awaiting re-`SPEC_APPROVED`.** Originally approved and built; the independent critic audit traced **62 of 64 criteria YES** and returned FAIL on two findings, **both diagnosed as spec-layer, not implementation-layer**. This revision fixes exactly those two and nothing else. **Everything already built that the critic traced YES stands — nothing is re-derived, reverted or re-executed except the two items named below.** Every section not named here is byte-unchanged from the approved spec.
>
> **What changed, and only this:**
> 1. **§2.1** — the strike-temperature formula was internally self-contradictory (its literal text fell with `mashTunHeatCapacityL` while its own prose and AC-6 required it to rise). The formula and its prose are replaced with the **energy-balance form**, chosen explicitly over the two other candidates; a new **deviation 6** in §4 records the decision and its reversal path. **This requires a code change in `packages/calculations/src/mash.ts`, which currently ships a third form** — see deviation 6 and AC-66.
> 2. **New AC-65, AC-66, AC-67** appended. AC-65 pins an exact numeric value at `mashTunHeatCapacityL > 0`, closing the gap the critic identified: AC-6/7/8/9 as written are satisfied by at least three mutually-inconsistent formulas that disagree by up to 15.7 °C, so they underdetermined the implementation. **AC-1..AC-64 are byte-unchanged and are not renumbered.**
> 3. **§1.5** — `apps/api/test/equipment.migration.test.ts` and `apps/api/test/errors.test.ts` move off the Untouched list into the Modified table as narrow named exceptions with their permitted edits enumerated exhaustively, on the M2_P1 `brewingMath.test.ts` / M3_P1 `RecipeLibrary.tsx` precedent. **Not everything the build added to them is blessed** — see AC-67.

## Phase Summary

M3_P1 made the equipment profile the single stored home for every brewhouse number and proved the engine reads all of them off the profile it is handed. Two of those columns — `mashTunHeatCapacityL` and `grainTemperatureC` — were added there **deliberately ahead of the build spec** (P1 deviation 4) and stored **inert**: nothing reads them, `EquipmentForm.tsx` labels them "Stored now, live in a future phase", and `brewing.ts` annotates them `// Live in M3_P2.` This is that phase. They become live, and the two comment sites that call them inert become lies that must be corrected.

What the app cannot do today: describe *how you mash* or *how you ferment*. There is no mash schedule, no fermentation schedule, no strike temperature, no infusion volume, and no brew-day mash sheet anywhere in the product. A recipe knows its grain bill, its hops and its kit — and nothing at all about the 67 °C rest that turns one into the other. M4 logs a brew day against paperwork that does not yet exist.

This phase adds two new stored entity families with ordered child steps (`mash_profiles`/`mash_steps`, `fermentation_profiles`/`fermentation_steps`) on the exact ordering-and-cascade pattern M2 already proved on recipe line items, gives each full CRUD, attaches them to a recipe through nullable pickers, and promotes build-spec §3.5's `strikeTemp` and `infusionVolume` into `/packages/calculations` as pure functions that take **every** term as an argument — including the two P1 fields that have been waiting for them.

**User-visible outcome:** build a named three-step mash schedule and a named fermentation schedule, pick each on a recipe, and get a brew-day mash sheet on that recipe showing the strike water volume, the temperature you must heat it to for your grist at your grain temperature in your mash tun, the per-step infusion volumes needed to hit each subsequent rest, and the sparge temperature that step will actually run at. Edit the schedule and the sheet moves; restart the app and all of it — steps, order, temperatures, durations — is exactly as you left it.

**This closes Milestone 3.** P1 delivered "my kit"; P2 delivers "my schedules". Both are vertical slices; neither is a layer.

### Key Behaviors

1. **A mash profile is an ordered list of steps, and the order is data, not luck.** `mash_steps.position` is dense and 0-based, `UNIQUE(mash_profile_id, position)`, `ON DELETE CASCADE`. The row→domain mapper sorts by `position` and does not trust query order — the same rule `recipeMapper.ts` already enforces for line items. Fermentation profiles are the identical pattern.
2. **`mashTunHeatCapacityL` and `grainTemperatureC` become live.** `strikeTemperatureC` reads both off the `EquipmentProfile` it is passed. No second migration on `equipment_profiles` — that is exactly what P1 deviation 4 bought, and this phase must not spend it twice. `equipment_profiles` is **byte-unchanged** in this phase.
3. **M3's threshold survives intact and is re-asserted, not assumed.** `strikeTemperatureC` and `infusionVolumeL` take every physical term as an argument. The two new module-level values (`STRIKE_GRAIN_HEAT_COEFF = 0.41`, `INFUSION_GRAIN_HEAT_COEFF = 0.4`) are **published formula coefficients**, in the same category as `TINSETH_*` and `MOREY_*` — not kit settings. P1's AC-4 closed-list assertion is extended from 13 names to exactly 15 and re-run.
4. **Both profiles are optional on a recipe, and "no profile" is a branch the caller cannot skip.** `calculateMashPlan` returns a discriminated `{ hasMashProfile: false }`. There is no placeholder strike temperature, no `0`, no `NaN`, and nothing for M4's batch snapshot to inherit as a fake number.
5. **A schedule in use cannot be deleted.** `DELETE` returns `409 PROFILE_IN_USE` when any recipe references it — the same contract, the same shape and the same UI treatment the user already learned from equipment profiles in P1. The FK's `ON DELETE SET NULL` remains as a schema backstop that the API never reaches.
6. **Editing a schedule never makes an open recipe dirty; picking a different one always does.** Identical to P1's equipment rule and for the identical reason: `mash_profile_id` is the recipe's stored input, the hydrated `mashProfile` object is read-side hydration. `isDirty` is already defined over `toWriteInput(recipe)` and needs no redefinition — only two new stored fields inside it.
7. **`CalculatedStats` is unchanged.** Seventeen numeric fields, no additions, no renames. The mash plan is a separate return value from a separate function, precisely so a `number | null` never leaks into an interface every consumer treats as total.
8. **`HopItem` is unchanged.** Per-hop-use scheduling attributes are considered and deliberately excluded — see Resolved Ambiguities and deviation 5.
9. Everything still runs from a cold clone: `npm install && npm test` exits 0, with M1's calculation suite, M2's persistence suite and P1's equipment suite all green.

---

### Resolved Ambiguities (Binding)

- **Per-hop-use scheduling attributes are OUT OF SCOPE and `HopItem` is byte-unchanged.** The user has raised differentiating `Boil` (minutes remaining in the boil), `Whirlpool` (minutes after flameout **plus** a temperature) and `DryHop` (day-offset from fermentation start **plus** duration in days) as distinct attribute sets, against today's single generic `timeMinutes`. It is a real modelling gap and it is not this phase's. Three reasons, all binding: **(a)** M3's verification threshold is about *brewhouse constants* — "no calculation in `/packages/calculations` reads a brewhouse constant that isn't passed in as an argument" — and P1 already closed it; no hop-scheduling attribute is a brewhouse constant, and adding them moves the threshold not one inch. **(b)** The roadmap's M3 hardening scope names "hop utilisation" only as a *rate on the equipment profile*, which shipped in P1; it does not name hop timing semantics anywhere. **(c)** `DryHop`'s "day offset from fermentation start" is not merely unimplemented, it is **undefined** until a fermentation start timestamp exists to offset from — and no `Batch` entity exists before Milestone 4. Shipping a day-offset field now would store a number with no referent, which is the inert-field anti-pattern P1 deviation 3 explicitly rejected. `HopItem`, `HopUse`, `classifyHopUse`, `calculateSingleHopIbu` and `recipe_hops` are all on §1.5's Untouched list. **Recommended placement:** M4 (which introduces `Batch` and the brew-day log, giving whirlpool time-after-flameout a thing to be logged against) for the Boil/Whirlpool split, and M5 (which introduces fermentation logging and therefore a fermentation-start timestamp) for `DryHop`'s day-offset and duration. See deviation 5 to place it explicitly at `/steer`.
- **`spargeTemperatureC` resolution has exactly one rule and one function.** `MashProfile.spargeTempC` is `number | null`; `null` means "inherit the brewhouse default". Resolution is `resolveSpargeTemperatureC(equipment, mashProfile)` (§2.3) and **every** consumer — the mash plan, the mash view, any future caller — goes through it. Precedence: a non-null `mashProfile.spargeTempC` wins; otherwise `equipment.spargeTemperatureC`. A `null` mash profile also yields `equipment.spargeTemperatureC`. `0` is a legitimate stored value and **must not** be treated as absent — the check is `!== null`, never falsy. This is how P1's equipment field and the build spec's per-mash-profile field coexist without a second source of truth.
- **Stored `infuseAmountL` overrides the computed volume; `null` means "compute it".** `MashStep.infuseAmountL` is `number | null`. Storing a computed value would create two mutable representations of the same quantity with no defined precedence — the exact confusion P1 deviation 2 rejected `evaporationRate%` for. So: `null` (the default, and what the form leaves it at unless the user types something) means the plan computes the volume from the step's temperatures; a non-null value is the user's explicit override and is used verbatim, un-clamped and un-recomputed. `MashPlanStep.infusionSource` is `'computed' | 'stored' | 'none'` so the mash view can label an overridden row and a caller can never confuse the two. `0` is a valid override meaning "add no water at this step" and is **not** treated as absent.
- **The first step never reports an infusion; the strike water is reported separately.** `MashPlanStep.infusionVolumeL` is always `null` and `infusionSource` is always `'none'` for `position === 0`, regardless of that step's `type` or its stored `infuseAmountL`. The mash liquor that gets the mash to its first rest is `strikeWaterL`, reported once at the plan level. Reporting it twice — once as strike, once as step 0's infusion — is how a mash sheet ends up telling the user to add the water twice.
- **The strike volume is the recipe's whole mash water, and the discrepancy is displayed, not hidden.** `strikeWaterL = calculateWaterVolumes(equipment, totalGrainKg, preBoilVolumeL).mashWaterL` — P1's exported accessor, unrounded, no re-derivation of the formula. This is the single-infusion assumption, which is correct for the overwhelmingly common case and wrong for a genuine multi-infusion step mash. Rather than silently reconciling, the plan reports `totalInfusionWaterL` and a signed `mashWaterBalanceL = mashWaterL - (strikeWaterL + totalInfusionWaterL)` — which is therefore exactly `-totalInfusionWaterL` under this rule. A negative balance means the schedule calls for more water than the recipe's mash-water figure allows, and the mash view says so in those words. Deriving strike water by subtracting computed infusions is **forbidden**: an infusion volume depends on the current mash volume, which would depend on the strike volume, which would depend on the infusions — a circular definition with no fixed point.
- **`strikeTemperatureC` is `number | null` inside the `hasMashProfile: true` branch, and `null` iff `steps.length === 0`.** A profile with no steps has no target rest temperature, so there is no temperature to heat the water to. `null` is the honest answer; `0`, `NaN` and "the sparge temperature" are not. The iff is exact and is asserted in both directions.
- **Degenerate inputs to the two pure functions return the target temperature or zero — never `NaN`, never `Infinity`.** These are explicit early returns, not emergent behaviour of the arithmetic:

  | Function | Condition | Returns |
  |---|---|---|
  | `strikeTemperatureC` | `grainWeightKg <= 0` | `targetMashTempC` — no grain to heat, so no compensation |
  | `strikeTemperatureC` | `waterVolumeL <= 0` | `targetMashTempC` — guards `waterVolumeL / grainWeightKg` and the thermal-mass ratio |
  | `infusionVolumeL` | `targetTempC <= currentTempC` | `0` — a step that does not raise the temperature is not an infusion |
  | `infusionVolumeL` | `infusionWaterTempC <= targetTempC` | `0` — water at or below the target cannot reach it; guards the zero/negative denominator |
  | `infusionVolumeL` | `grainWeightKg <= 0` **and** `currentMashVolumeL <= 0` | `0` — nothing to heat |

  The guards are evaluated in the order written. `mashTunHeatCapacityL >= 0` is guaranteed by P1's validation, so `waterVolumeL + mashTunHeatCapacityL > 0` whenever `waterVolumeL > 0`.
- **Boundary operators on every new field, exact.** Enforced identically by the Fastify JSON Schema and by the web forms, in the same style P1 established:

  | Field | Admissible | Rejected examples |
  |---|---|---|
  | `MashProfile.name`, `FermentationProfile.name` | length `>= 1` after trim | `""`, `"   "` |
  | `MashProfile.targetPh` | `>= 3` and `<= 9` | `2.99`, `9.01` |
  | `MashProfile.spargeTempC` | `null`, or `>= 0` and `<= 100` | `-0.01`, `100.01` |
  | `MashStep.name` | length `>= 1` after trim | `""`, `"   "` |
  | `MashStep.stepTempC` | `>= 0` and `<= 110` | `-0.01`, `110.01` |
  | `MashStep.stepTimeMin` | `>= 0` and `<= 600` | `-0.01`, `600.01` |
  | `MashStep.rampTimeMin` | `>= 0` and `<= 600` | `-0.01`, `600.01` |
  | `MashStep.infuseAmountL` | `null`, or `>= 0` and `<= 1000` | `-0.01`, `1000.01` |
  | `MashStep.infuseWaterTempC` | `>= 0` and `<= 110` | `-0.01`, `110.01` |
  | `FermentationStep.name` | length `>= 1` after trim | `""`, `"   "` |
  | `FermentationStep.stepTempC` | `>= -10` and `<= 40` | `-10.01`, `40.01` |
  | `FermentationStep.stepTimeDays` | `>= 0` and `<= 365` | `-0.01`, `365.01` |
  | `FermentationStep.rampDays` | `>= 0` and `<= 60` | `-0.01`, `60.01` |
  | `FermentationStep.pressurePsi` | `null`, or `>= 0` and `<= 60` | `-0.01`, `60.01` |
  | `steps` array (either kind) | length `>= 0` and `<= 20` | 21 items |

  `110` (not `100`) is the ceiling on mash and infusion temperatures because a decoction is boiled and infusion water is routinely at `100`; `-10` is the floor on fermentation temperature because a cold crash and a lagering step go below zero. An **empty** `steps` array is admissible for both kinds — a named profile you have not filled in yet is a legitimate saved state, and §2.4 gives it an explicit contract.
- **`recipes` gains two nullable columns and nothing else.** `mash_profile_id` and `fermentation_profile_id`, both `TEXT NULL` with `ON DELETE SET NULL`. SQLite permits adding a column with a `REFERENCES` clause only when its default is `NULL`, which is exactly the intent here. Existing recipes migrate to `NULL` on both, which by Key Behavior 4 means `{ hasMashProfile: false }` and a mash view that asks the user to pick a schedule — not a fabricated one.
- **Deletion is blocked by reference, not nulled through.** `ON DELETE SET NULL` on both FKs is a schema-level backstop that the HTTP API never reaches, because `DELETE` checks references first and returns `409 PROFILE_IN_USE`. Chosen over letting the delete cascade a `NULL` into referencing recipes for one concrete reason: a server-side `SET NULL` silently changes the *stored* state of a recipe that may be open in the editor, leaving the client's `savedSnapshot` describing a row that no longer exists and `isDirty` reporting a lie in either direction. Blocking removes the whole class. It also matches the equipment-delete behaviour the user already learned in P1. See deviation 2.
- **`ApiErrorCode` gains exactly one member: `PROFILE_IN_USE`.** Not two. The `details` payload carries `profileKind` so the client can phrase the message, and the server's `message` already names the blocking recipes in prose (P1's precedent, `equipment.ts:88-94`). `EQUIPMENT_IN_USE` is untouched and keeps its own code — renaming it would break P1's tested contract for no gain.
- **`isDirty` is NOT redefined again.** P1 already narrowed `canonicalWorking` to `canonicalJson(toWriteInput(recipe))`. `RecipeWriteInput` gains `mashProfileId` and `fermentationProfileId`, so those two stored references enter the dirty computation automatically and correctly: picking a different schedule dirties the recipe; editing the attached schedule's steps does not. `applyMashProfileUpdate` / `applyFermentationProfileUpdate` mirror `applyEquipmentUpdate` exactly, including never touching `storedId`, `savedSnapshot`, `saveState` or `saveError`.
- **Two new constants are added to `constants.ts` and the closed list becomes exactly 15.** `STRIKE_GRAIN_HEAT_COEFF = 0.41` and `INFUSION_GRAIN_HEAT_COEFF = 0.4` are published coefficients of the grain/water specific-heat ratio in build-spec §3.5's formulas — the same category as `TINSETH_BIGNESS_COEFF` and `MOREY_EXPONENT`, which P1's AC-4 explicitly retained as *not* brewhouse constants. Swapping them is M7's formula-strategy work, not a kit setting. They are the **only** two additions; AC-4 is re-run against the 15-name list in both directions.
- **`CalculatedStats` is unchanged — no field added, renamed or removed.** Restated from P1 because this is the phase that would be tempted: strike temperature is not a stat, it is a plan.
- **No new dependency is added.** No new npm package in any workspace. The new forms are plain React with the existing Tailwind classes and `lucide-react` icons, mirroring `EquipmentForm.tsx`.
- **Dev topology is unchanged.** Vite on `5173`, Fastify on `5177`, `/api` proxied. No new process, no new port.

---

## 1. Data Schema & Contracts

### 1.1 Workspace layout — new files and generated migration artifacts

```
/apps/api/drizzle/0002_<name>.sql                NEW — generated migration (COMMITTED)
/apps/api/drizzle/meta/0002_snapshot.json        NEW — generated (COMMITTED)
/apps/api/drizzle/meta/_journal.json             APPENDED — drizzle-kit adds the 0002 entry
                                                 (COMMITTED). Generator output only; the 0000
                                                 and 0001 entries within it must be byte-unchanged.
/apps/api/src/repositories/scheduleRepository.ts NEW — mash + fermentation profile CRUD
/apps/api/src/routes/schedules.ts                NEW — both route families
/apps/api/test/schedules.crud.test.ts            NEW
/apps/api/test/schedules.migration.test.ts       NEW

/packages/calculations/src/mash.ts               NEW — strike temp, infusion volume, mash plan
/packages/calculations/test/mash.test.ts         NEW — pure-function contracts
/packages/calculations/test/mashPlan.test.ts     NEW — plan assembly, ordering, degenerate cases

/apps/web/src/components/MashProfileManager.tsx         NEW — list + delete + entry to the form
/apps/web/src/components/MashProfileForm.tsx            NEW — create/edit, ordered step editor
/apps/web/src/components/FermentationProfileManager.tsx NEW
/apps/web/src/components/FermentationProfileForm.tsx    NEW
/apps/web/src/components/MashSection.tsx                NEW — the recipe's mash view + both pickers
/apps/web/test/MashProfileManager.test.tsx              NEW
/apps/web/test/MashSection.test.tsx                     NEW
```

No new root scripts. The `db:generate` / `db:seed` scripts from M2 are used as-is.

### 1.2 Database schema — `apps/api/src/db/schema.ts`

Four new tables. `recipes` gains two columns. **`equipment_profiles` is byte-unchanged in this phase** (Key Behavior 2), as are all four `recipe_*` line-item tables and all four `catalog_*` tables.

`mash_profiles`

| Column | Type | Constraint | Default |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | — |
| `name` | TEXT | NOT NULL | — |
| `target_ph` | REAL | NOT NULL | `5.4` |
| `sparge_temp_c` | REAL | NULL allowed | `NULL` (means inherit) |
| `is_seed` | INTEGER | NOT NULL | `0` |
| `created_at` | TEXT | NOT NULL | — |
| `updated_at` | TEXT | NOT NULL | — |

`mash_steps`

| Column | Type | Constraint | Default |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | — |
| `mash_profile_id` | TEXT | NOT NULL, FK → `mash_profiles.id` `ON DELETE CASCADE` | — |
| `position` | INTEGER | NOT NULL | — |
| `name` | TEXT | NOT NULL | — |
| `type` | TEXT | NOT NULL (`Infusion`\|`Decoction`\|`Temperature`) | — |
| `step_temp_c` | REAL | NOT NULL | — |
| `step_time_min` | REAL | NOT NULL | — |
| `ramp_time_min` | REAL | NOT NULL | — |
| `infuse_amount_l` | REAL | NULL allowed | `NULL` (means compute) |
| `infuse_water_temp_c` | REAL | NOT NULL | `100.0` |

Indexes: `mash_steps_profile_id_idx` on `mash_profile_id`; `mash_steps_profile_position_uq` UNIQUE on `(mash_profile_id, position)`.

`fermentation_profiles`

| Column | Type | Constraint | Default |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | — |
| `name` | TEXT | NOT NULL | — |
| `is_seed` | INTEGER | NOT NULL | `0` |
| `created_at` | TEXT | NOT NULL | — |
| `updated_at` | TEXT | NOT NULL | — |

`fermentation_steps`

| Column | Type | Constraint | Default |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | — |
| `fermentation_profile_id` | TEXT | NOT NULL, FK → `fermentation_profiles.id` `ON DELETE CASCADE` | — |
| `position` | INTEGER | NOT NULL | — |
| `name` | TEXT | NOT NULL | — |
| `type` | TEXT | NOT NULL (`Primary`\|`Secondary`\|`Tertiary`\|`ColdCrash`\|`Carbonation`\|`Conditioning`) | — |
| `step_temp_c` | REAL | NOT NULL | — |
| `step_time_days` | REAL | NOT NULL | — |
| `ramp_days` | REAL | NOT NULL | — |
| `pressure_psi` | REAL | NULL allowed | `NULL` |

Indexes: `fermentation_steps_profile_id_idx`; `fermentation_steps_profile_position_uq` UNIQUE on `(fermentation_profile_id, position)`.

`recipes` — two added columns, nothing else:

| Column | Type | Constraint | Default |
|---|---|---|---|
| `mash_profile_id` | TEXT | NULL allowed, FK → `mash_profiles.id` `ON DELETE SET NULL` | `NULL` |
| `fermentation_profile_id` | TEXT | NULL allowed, FK → `fermentation_profiles.id` `ON DELETE SET NULL` | `NULL` |

The migration is generated by `drizzle-kit generate` and committed. The `recipes` change **must** be additive `ALTER TABLE recipes ADD COLUMN` statements: **no table rebuild, no data copy, no `DROP`**. A rebuild silently drops the `recipes.equipment_id` `ON DELETE RESTRICT` edge and every referential guarantee M2 and P1 rely on, while the tests still pass. AC-13 inspects the emitted SQL directly, exactly as P1's AC-18 did. `CREATE TABLE` statements for the four genuinely-new tables are expected and are not a rebuild.

Enum values are validated at the HTTP boundary by JSON Schema, never by SQLite `CHECK` constraints — M2's rule, unchanged.

### 1.3 Type changes — `packages/shared-types`

**New — `src/schedules.ts`:**

```ts
export type MashStepType = 'Infusion' | 'Decoction' | 'Temperature';
export type FermentationStepType =
  | 'Primary' | 'Secondary' | 'Tertiary' | 'ColdCrash' | 'Carbonation' | 'Conditioning';

export interface MashStep {
  id: string;
  name: string;
  type: MashStepType;
  stepTempC: number;          // [0, 110]
  stepTimeMin: number;        // [0, 600]
  rampTimeMin: number;        // [0, 600]
  infuseAmountL: number | null;   // null = compute; a number is a verbatim override
  infuseWaterTempC: number;       // [0, 110]. Temperature of the water added at this step.
}

export interface MashProfile {
  id: string;
  name: string;
  targetPh: number;               // [3, 9]. Recorded target; prediction is M6.
  spargeTempC: number | null;     // null = inherit equipment.spargeTemperatureC
  steps: MashStep[];              // ordered, dense, 0-based; may be empty
}

export interface FermentationStep {
  id: string;
  name: string;
  type: FermentationStepType;
  stepTempC: number;          // [-10, 40]
  stepTimeDays: number;       // [0, 365]
  rampDays: number;           // [0, 60]
  pressurePsi: number | null; // stored; inert until M5
}

export interface FermentationProfile {
  id: string;
  name: string;
  steps: FermentationStep[];  // ordered, dense, 0-based; may be empty
}
```

**Modified — `src/brewing.ts`:**

```ts
export interface Recipe {
  // ... every existing field unchanged ...
  mashProfile: MashProfile | null;             // NEW — read-side hydration of mash_profile_id
  fermentationProfile: FermentationProfile | null; // NEW
}
```

`EquipmentProfile` is **unchanged in shape**; only the trailing comments on `mashTunHeatCapacityL` and `grainTemperatureC` change (§2.6). `CalculatedStats`, `FermentableItem`, `HopItem`, `YeastItem`, `MiscItem` and every union type are **unchanged — no additions, no renames, no removals.**

**Modified — `src/index.ts`:** `export * from './schedules';` added. Nothing else.

**Modified — `src/api.ts`:**

```ts
export interface RecipeWriteInput {
  // ... every existing field unchanged ...
  mashProfileId: string | null;          // NEW — required key, nullable value
  fermentationProfileId: string | null;  // NEW — required key, nullable value
}

// Steps carry an optional client-supplied id, reused when it already belongs to
// this profile — identical policy to LineItemInput<T> on recipe line items.
export interface MashProfileWriteInput {
  name: string;
  targetPh: number;
  spargeTempC: number | null;
  steps: LineItemInput<MashStep>[];
}

export interface FermentationProfileWriteInput {
  name: string;
  steps: LineItemInput<FermentationStep>[];
}

// The 409 PROFILE_IN_USE body's `details` payload.
export interface ProfileInUseDetails {
  profileKind: 'mash' | 'fermentation';
  recipeCount: number;
  recipeNames: string[];   // at most 5, `updatedAt DESC`
}

export type ApiErrorCode =
  | 'VALIDATION_FAILED' | 'NOT_FOUND' | 'EQUIPMENT_NOT_FOUND'
  | 'EQUIPMENT_IN_USE' | 'PROFILE_IN_USE'   // <- one new member
  | 'INTERNAL';
```

`mashProfileId` and `fermentationProfileId` are **required keys with nullable values**, never optional keys. A body omitting either is `400 VALIDATION_FAILED`, not a silent `null`. This matters for `isDirty`: an optional key would canonicalise to a different string depending on whether the client bothered to send it.

`EquipmentCreateInput`, `EquipmentUpdateInput`, `EquipmentInUseDetails`, `StoredRecipe`, `RecipeSummary`, `LineItemInput<T>` and every `Catalog*` type are **unchanged**.

### 1.4 HTTP contract

| Method & path | Success | Failure |
|---|---|---|
| `GET /api/mash-profiles` | `200 MashProfile[]` — seed first, then by `name`; each with `steps` ordered by `position` | `500 INTERNAL` |
| `POST /api/mash-profiles` | `201 MashProfile` | `400 VALIDATION_FAILED` |
| `PUT /api/mash-profiles/:id` | `200 MashProfile` — full replace of all 4 fields including the whole `steps` array | `400 VALIDATION_FAILED`, `404 NOT_FOUND` |
| `DELETE /api/mash-profiles/:id` | `204`, empty body | `404 NOT_FOUND`, `409 PROFILE_IN_USE` with `details: ProfileInUseDetails` |
| `GET /api/fermentation-profiles` | `200 FermentationProfile[]` — same ordering rules | `500 INTERNAL` |
| `POST /api/fermentation-profiles` | `201 FermentationProfile` | `400 VALIDATION_FAILED` |
| `PUT /api/fermentation-profiles/:id` | `200 FermentationProfile` — full replace of both fields including `steps` | `400 VALIDATION_FAILED`, `404 NOT_FOUND` |
| `DELETE /api/fermentation-profiles/:id` | `204`, empty body | `404 NOT_FOUND`, `409 PROFILE_IN_USE` |

Every non-2xx body is exactly `ApiErrorBody`, via the existing `sendApiError`. A partial `PUT` body is `400`, never a merge — same contract as `PUT /api/recipes/:id` and `PUT /api/equipment-profiles/:id`. There is no `PATCH` for either schedule kind.

**Recipe routes gain two body keys and no new endpoint.** `POST`/`PUT /api/recipes` require `mashProfileId` and `fermentationProfileId` in the body. An id that does not exist is `400 VALIDATION_FAILED` with a message naming the field, checked **before** anything is written — never a foreign-key error surfacing as a `500`, and never a silent `null` substitution. `GET /api/recipes/:id` hydrates both objects. `GET /api/recipes` (the summary list) is **unchanged** — no schedule fields are added to `RecipeSummary`. `PATCH /api/recipes/:id` (rename) and `POST /api/recipes/:id/duplicate` are unchanged in signature; duplicate copies both profile ids to the copy.

`GET/POST/PUT/DELETE /api/equipment-profiles*`, the catalog route and the health route are **unchanged in this phase**.

### 1.5 Symbol inventory

**New:**

| Symbol | Location |
|---|---|
| `MashStepType`, `MashStep`, `MashProfile`, `FermentationStepType`, `FermentationStep`, `FermentationProfile` | `packages/shared-types/src/schedules.ts` |
| `MashProfileWriteInput`, `FermentationProfileWriteInput`, `ProfileInUseDetails` | `packages/shared-types/src/api.ts` |
| `STRIKE_GRAIN_HEAT_COEFF`, `INFUSION_GRAIN_HEAT_COEFF` | `packages/calculations/src/constants.ts` |
| `StrikeTemperatureInput`, `strikeTemperatureC`, `InfusionVolumeInput`, `infusionVolumeL`, `resolveSpargeTemperatureC`, `MashPlanStep`, `MashPlan`, `calculateMashPlan` | `packages/calculations/src/mash.ts` |
| `mashProfiles`, `mashSteps`, `fermentationProfiles`, `fermentationSteps` | `apps/api/src/db/schema.ts` |
| `listMashProfiles`, `getMashProfileById`, `createMashProfile`, `updateMashProfile`, `deleteMashProfile`, `findRecipesUsingMashProfile`, and the six identically-shaped `*FermentationProfile*` counterparts, plus `mashProfileRowsToDomain` / `fermentationProfileRowsToDomain` | `apps/api/src/repositories/scheduleRepository.ts` |
| `registerScheduleRoutes` | `apps/api/src/routes/schedules.ts` |
| `mashProfileWriteBodySchema`, `fermentationProfileWriteBodySchema` | `apps/api/src/routes/schemas.ts` |
| `listMashProfiles`, `createMashProfile`, `updateMashProfile`, `deleteMashProfile` + 4 fermentation counterparts (client) | `apps/web/src/api/client.ts` |
| `applyMashProfileUpdate`, `applyFermentationProfileUpdate` | `apps/web/src/hooks/useRecipeEditor.ts` |
| `MashProfileManager`, `MashProfileForm`, `FermentationProfileManager`, `FermentationProfileForm`, `MashSection` | `apps/web/src/components/` |

**Deleted:** none. This phase deletes no symbol. (P1's four retired brewhouse constants stay deleted — AC-3 re-runs the grep.)

**Modified:**

| File | Change |
|---|---|
| `packages/shared-types/src/brewing.ts` | `Recipe` + `mashProfile`/`fermentationProfile`; the two stale `// Live in M3_P2.` comments on `EquipmentProfile` corrected (§2.6). **No other change — `EquipmentProfile`'s field list, `CalculatedStats` and `HopItem` are byte-unchanged.** |
| `packages/shared-types/src/index.ts` | + `export * from './schedules';`. Nothing else. |
| `packages/shared-types/src/api.ts` | `RecipeWriteInput` + 2 keys; + 3 interfaces; `ApiErrorCode` + `PROFILE_IN_USE`. Nothing else. |
| `packages/calculations/src/constants.ts` | + exactly 2 named formula coefficients. **No existing constant's name or value changes.** |
| `packages/calculations/src/index.ts` | + `export * from './mash';` |
| `packages/calculations/src/scaling.ts` | `scaleRecipe` carries `mashProfile`/`fermentationProfile` through unchanged (they ride the existing `...recipe` spread — verify, do not re-add). `deriveScaledEquipment` is **byte-unchanged**. |
| `packages/calculations/test/units.test.ts` | + 2 assertions for the new coefficients; the closed-list assertion updated from 13 names to 15. **Every existing assertion byte-unchanged.** |
| `packages/calculations/test/brewingMath.test.ts` | `baseRecipe()` gains the two null profile fields. **No numeric expectation, tolerance or case changes.** |
| `packages/calculations/test/fixtures/fixtureAdapter.ts` | the recipe literal gains the two null profile fields. **No expectation, potential or tolerance changes.** |
| `packages/calculations/test/scaling.test.ts` | + one sub-case asserting both profile references survive `scaleRecipe` by reference identity. **No tolerance changes.** |
| `apps/api/src/db/schema.ts` | + 4 tables; `recipes` + 2 columns. Every other table byte-unchanged. |
| `apps/api/src/db/seed.ts` | + `SEED_MASH_PROFILES` (2) and `SEED_FERMENTATION_PROFILES` (1) with their steps, at `SEED_TIMESTAMP`, `onConflictDoNothing`. `SEED_SAMPLE_RECIPE` gains `mashProfileId: null, fermentationProfileId: null` (§2.6). |
| `apps/api/src/mappers/recipeMapper.ts` | `toStoredRecipe` takes and passes through 2 more arguments; `toLineItemRows` **unchanged** |
| `apps/api/src/repositories/recipeRepository.ts` | `assembleStoredRecipe` loads both profiles; create/update validate both ids before writing and persist them; `duplicateRecipe` copies both |
| `apps/api/src/routes/recipes.ts` | `POST`/`PUT` surface an unknown profile id as `400 VALIDATION_FAILED`. No new endpoint. |
| `apps/api/src/routes/schemas.ts` | `recipeWriteBodySchema` + 2 required nullable keys; + 2 new write-body schemas |
| `apps/api/src/server.ts` | + one `registerScheduleRoutes(app, db)` call. **Nothing else — no ajv option change** (P1's critic Finding 1 notes `removeAdditional: true` is repo-wide; changing it is out of scope here). |
| `apps/api/test/helpers/fixtures.ts` | recipe literals gain the two keys |
| `apps/web/src/api/client.ts` | + 8 functions |
| `apps/web/src/hooks/useRecipeEditor.ts` | `EMPTY_RECIPE_FOR_STATS` + 2 null fields; `startNewRecipe` sets both to `null`; `toWriteInput` + 2 keys; + 2 apply methods |
| `apps/web/src/App.tsx` | `view` gains `'mashProfiles'`/`'fermentationProfiles'`; `Header` gains 2 buttons; both manager views rendered; `<MashSection>` rendered in the editor; profile lists loaded and reloaded on mutation |
| `apps/web/src/components/EquipmentForm.tsx` | **Exactly two string literals**: the `hint` on `mashTunHeatCapacityL` (line 75) and on `grainTemperatureC` (line 84) change from "Stored now, live in a future phase" to text naming strike temperature. **Nothing else in this file may change** — no field added or removed, no bound changed, no handler touched. The `hopstandTemperatureC` hint (line 65) stays as-is; it is still genuinely inert. |
| `apps/web/test/useRecipeEditor.test.tsx` | fixtures gain the two keys; + schedule dirty-semantics cases |
| `apps/web/test/helpers/fixtures.ts` | recipe literals gain the two keys |
| `apps/api/test/recipes.crud.test.ts`, `recipes.restart.test.ts`, `recipes.cascade.test.ts`, `scaling.integration.test.ts`, `seed.test.ts` | request bodies gain the two required keys. **No assertion or expectation changes beyond those additions and the new schedule cases named in §3.** |
| `apps/api/test/errors.test.ts` | **Narrow named exception, added by amendment (see the amendment note below §1.5's Untouched list).** Exactly one thing: the single inline `POST /api/recipes` payload gains the keys `mashProfileId: null` and `fermentationProfileId: null`. Required because the payload is an inline literal rather than one built by `test/helpers/fixtures.ts`, and `recipeWriteBodySchema` now `400`s a body omitting either key (§1.3, §1.4) — so without them the test fails for a reason unrelated to what it verifies, and the only byte-identity-preserving alternative is widening the two keys to optional, which §1.3 forbids. **No other executable line in this file may be added, removed or changed** — no new test, no new import, no assertion, status-code or message expectation change, no other payload touched. Adjacent explanatory **comment** lines are permitted and are the only non-executable latitude granted. |
| `apps/api/test/equipment.migration.test.ts` | **Narrow named exception, added by amendment (see the amendment note below §1.5's Untouched list).** Exactly three things, all compile- or behaviour-forced: (1) the in-file `Recipe` literal gains `mashProfile: null` and `fermentationProfile: null`, forced by `Recipe` gaining two required fields (§1.3); (2) the single `toStoredRecipe(...)` call site gains two trailing `null` arguments, forced by that mapper's arity change (§1.5 Modified row); (3) the one `expect(recipesFk).toHaveLength(1)` on `PRAGMA foreign_key_list('recipes')` becomes `toHaveLength(3)`, forced behaviourally by the two new `SET NULL` edges on `recipes` (§1.2). **Nothing else in this file may change.** In particular, **no new foreign-key assertion may be added here** — the `mash_profile_id` and `fermentation_profile_id` `SET NULL` edges are asserted in `apps/api/test/schedules.migration.test.ts`, the file this phase created for exactly that purpose, and duplicating them in an Untouched-list file is elective, not forced. See AC-67. Adjacent explanatory **comment** lines are permitted; no other executable line may be added, removed or changed. |

**Untouched — must be byte-unchanged:**

`packages/shared-types/src/misc.ts`; `packages/calculations/src/brewingMath.ts`; `packages/calculations/src/units.ts`; `packages/calculations/test/fixtures.test.ts`; `packages/calculations/test/fixtures/montano_brewing_recipes.json`; `packages/calculations/test/fixtures/fermentablePotentials.ts`; `packages/calculations/test/water.test.ts`; `packages/calculations/test/equipmentDriven.test.ts`; `apps/api/src/routes/equipment.ts`; `apps/api/src/routes/catalog.ts`; `apps/api/src/routes/health.ts`; `apps/api/src/repositories/equipmentRepository.ts`; `apps/api/src/repositories/catalogRepository.ts`; `apps/api/src/errors.ts`; `apps/api/src/db/client.ts`; `apps/api/src/db/migrate.ts`; `apps/api/src/db/seedCli.ts`; `apps/api/drizzle/0000_futuristic_quasimodo.sql`; `apps/api/drizzle/0001_ambitious_phil_sheldon.sql`; `apps/api/drizzle/meta/0000_snapshot.json`; `apps/api/drizzle/meta/0001_snapshot.json`; `apps/api/test/equipment.crud.test.ts`; `apps/api/test/helpers/canonical.ts`; `apps/api/test/helpers/testDb.ts`; `apps/web/src/components/StatsHeader.tsx`; `HopSection.tsx`; `FermentableSection.tsx`; `YeastSection.tsx`; `MiscSection.tsx`; `SaveBar.tsx`; `RecipeLibrary.tsx`; `EquipmentManager.tsx`; `apps/web/src/context/CatalogContext.tsx`; `apps/web/src/utils/srmColor.ts`; `apps/web/src/index.css`; `apps/web/src/main.tsx`; `apps/web/vitest.config.ts`; `apps/web/test/setup.ts`; `apps/web/test/RecipeLibrary.test.tsx`; `apps/web/test/EquipmentManager.test.tsx`; `packages/better-sqlite3-shim/**`; `CLAUDE.md`; `README.md`; `.oxlintrc.json`; root `package.json`; `.claude/**`; `.agents/**`; every path under `.gsd/` except `.gsd/active/M3_P2_feature_spec.md`, `.gsd/STATE.json`, and `.gsd/active/manual_verification/**`.

> **Note on `HopSection.tsx` and `recipe_hops`.** Both are on the Untouched list *specifically* because per-hop-use scheduling attributes are out of scope (Resolved Ambiguities, deviation 5). If execution finds itself editing either, that is the signal to stop and route back to `/plan`, not to proceed.

> **Amendment note (2026-08-06).** `apps/api/test/equipment.migration.test.ts` and `apps/api/test/errors.test.ts` were on the Untouched list in the pre-amendment spec and have been **moved to the Modified table above** as narrow, exhaustively-enumerated exceptions. §4's "Known execution risks" anticipated the *class* of fallout ("every API test that posts a recipe body") but a general risk note does not override a per-file prohibition — which is why §1.5 carries per-file rows at all. The remedy is the one this project has used three times on this exact defect class: name the narrow exception at `/plan` rather than retire the requirement (M2_P1's `brewingMath.test.ts` under an identical required-field/arity fallout; M2_P1's AC-11 rounding tolerance; M3_P1's `RecipeLibrary.tsx` under AC-46). **These two rows are not a general licence to edit either file, and they do not bless everything the build put there** — the nine duplicate foreign-key assertions added to `equipment.migration.test.ts` are outside the permitted set and must be removed (AC-67). Every other path on this list is unchanged from the approved spec.

---

## 2. Transformations & Pure Logic

No function in this section performs I/O, reads a clock, generates an id, or touches `Math.random`.

### 2.1 Strike temperature — `packages/calculations/src/mash.ts`

```ts
export interface StrikeTemperatureInput {
  targetMashTempC: number;
  grainTemperatureC: number;
  waterVolumeL: number;
  grainWeightKg: number;
  mashTunHeatCapacityL: number;
}

/**
 * Energy balance for a grist and a water-equivalent tun mass, both starting at
 * grainTemperatureC. Every physical term is an argument — no module-level
 * brewhouse value is read. STRIKE_GRAIN_HEAT_COEFF is a published formula
 * coefficient, not a kit setting (see Resolved Ambiguities).
 * Deviates from build-spec §3.5's literal text — see §4 deviation 6.
 */
export function strikeTemperatureC(input: StrikeTemperatureInput): number;
```

**AMENDED 2026-08-06. This replaces the formula in the originally-approved spec. `packages/calculations/src/mash.ts` currently ships a third form and MUST be changed to match this one — see §4 deviation 6, AC-65 and AC-66.**

Definition, exactly, after the two guards in §Resolved-Ambiguities' degenerate table:

```
waterEquivalentL = STRIKE_GRAIN_HEAT_COEFF * grainWeightKg + mashTunHeatCapacityL
result = targetMashTempC
       + (targetMashTempC - grainTemperatureC) * waterEquivalentL / waterVolumeL
```

**Association is binding**, because two acceptance criteria assert exact equality rather than a tolerance: the temperature delta `(targetMashTempC - grainTemperatureC)` is the **leading** factor, multiplied by `waterEquivalentL`, and the product is **then** divided by `waterVolumeL`. This guarantees AC-8 exactly and not merely to within an epsilon — when `grainTemperatureC === targetMashTempC` the leading factor is exactly `0`, so the whole correction term is exactly `0` and the result is exactly `targetMashTempC`, for every admissible water volume, grain weight and tun mass.

Returned **unrounded**. Rounding is the caller's business; the mash view rounds to 1 decimal for display and the plan does not.

**What the formula says, physically, and why this form and not the other two.** `mashTunHeatCapacityL` is a *water-equivalent thermal mass in litres* (`brewing.ts:57`), and this formula treats it as exactly that: an additional `mashTunHeatCapacityL` litres of water sitting at `grainTemperatureC` that the strike liquor must also bring up to `targetMashTempC`. Conservation of energy across grist + tun + liquor, with the grain's specific heat expressed as the fraction `STRIKE_GRAIN_HEAT_COEFF` of water's, gives `waterVolumeL * (Tstrike - target) = (COEFF * grainWeightKg + mashTunHeatCapacityL) * (target - grainTemperatureC)`, which rearranges to the definition above. The grist contributes `COEFF * grainWeightKg` litres-equivalent and the tun contributes `mashTunHeatCapacityL` litres-equivalent; the two are **additive and independent**, which is the whole point of storing the tun's heat capacity in litres of water in the first place. Two binding consequences follow, and AC-65 asserts both:

- **The tun's contribution to the strike temperature is independent of grain weight.** It is exactly `mashTunHeatCapacityL * (targetMashTempC - grainTemperatureC) / waterVolumeL`. The same empty tun, at the same temperature, filled with the same volume of liquor, demands the same extra heat whether you mash 5 kg or 10 kg in it. Any form in which the tun term scales with `grainWeightKg` is wrong on its face, and this is the property that discriminates this formula from the alternative that was shipped.
- **At `mashTunHeatCapacityL === 0` the tun term vanishes and the formula reduces exactly to the classic two-term form** `targetMashTempC + (STRIKE_GRAIN_HEAT_COEFF / (waterVolumeL / grainWeightKg)) * (targetMashTempC - grainTemperatureC)` — Palmer's `Tw = (0.2/r)(T2 - T1) + T2` in metric mass units, which is where `0.41` comes from (`0.2 * 2.086 lb-water-per-quart ≈ 0.417`, the grain/water specific-heat ratio). This is why P1's default of `0.0` means every pre-existing profile keeps the textbook answer. **This boundary discriminates nothing** — all three candidate formulas agree at `mashTunHeatCapacityL === 0`, which is precisely why AC-7 alone was not enough and AC-65 exists.

Consequences that are properties, not incidents, and are asserted directly: raising `grainTemperatureC` toward `targetMashTempC` lowers the strike temperature monotonically, and at `grainTemperatureC === targetMashTempC` the result is exactly `targetMashTempC`. Raising `mashTunHeatCapacityL` from `0` raises the strike temperature monotonically — a cold tun steals heat. **The prose and the formula now agree; in the originally-approved spec they did not, and that contradiction is what this amendment resolves.**

**Two disclosures that are binding, not asides:**

1. **The tun is assumed to start at `grainTemperatureC`.** There is no separate tun-temperature input and none is added in this phase. A preheated tun is therefore modelled as `mashTunHeatCapacityL = 0`, which is what preheating physically achieves, and the field's `[0, 50]` bound (P1) already permits that. Introducing a distinct `mashTunTemperatureC` is out of scope here; it would be a second equipment migration, which P1 deviation 4 explicitly bought this phase out of.
2. **The `grainWeightKg <= 0` guard still returns `targetMashTempC` even when `mashTunHeatCapacityL > 0`, and this takes precedence over the formula.** Strictly, a zero-grain mash into a cold tun still demands `mashTunHeatCapacityL * (targetMashTempC - grainTemperatureC) / waterVolumeL` degrees of compensation. The guard is a deliberate, explicit early return — not emergent arithmetic — and it is pinned by AC-9 (`grainWeightKg === 0` returns exactly `targetMashTempC`) and by AC-41 (a zero-fermentable recipe yields `strikeTemperatureC === steps[0].stepTempC`). **Both of those criteria are unchanged by this amendment and remain binding.** A recipe with no grain has no mash to hit a rest temperature for; returning the target unmodified is the honest answer and keeps AC-41's no-`NaN` sweep trivially true. Revisiting it is a future phase's business, not this amendment's.

**Note on §Resolved-Ambiguities' degenerate table.** That table's two `strikeTemperatureC` rows are **unchanged and remain binding**: `grainWeightKg <= 0` returns `targetMashTempC`, `waterVolumeL <= 0` returns `targetMashTempC`, evaluated in that order. Only the parenthetical *rationale* in the `waterVolumeL <= 0` row is superseded — it now guards the division by `waterVolumeL` in the definition above rather than "`waterVolumeL / grainWeightKg` and the thermal-mass ratio", neither of which appears in the amended formula. Likewise the table's closing sentence about `waterVolumeL + mashTunHeatCapacityL > 0` describes a quantity the amended formula no longer forms; it is harmless and left in place. **The returned values are authoritative and unchanged; §2.1 is authoritative for why.** The table was left byte-unchanged deliberately, so that no criterion which already traced YES is perturbed.

### 2.2 Infusion volume — `packages/calculations/src/mash.ts`

```ts
export interface InfusionVolumeInput {
  grainWeightKg: number;
  currentTempC: number;
  targetTempC: number;
  infusionWaterTempC: number;
  currentMashVolumeL: number;
}

/** build-spec §3.5. Returns litres, unrounded, never negative, never NaN. */
export function infusionVolumeL(input: InfusionVolumeInput): number;
```

Definition, exactly, after the three guards in §Resolved-Ambiguities' degenerate table:

```
result = (targetTempC - currentTempC)
         * (INFUSION_GRAIN_HEAT_COEFF * grainWeightKg + currentMashVolumeL)
         / (infusionWaterTempC - targetTempC)
```

Because the guards make the numerator strictly positive and the denominator strictly positive, the result is strictly positive whenever it is reached. There is no clamp — a clamp would hide a sign error rather than prevent one.

### 2.3 Sparge temperature resolution — `packages/calculations/src/mash.ts`

```ts
/**
 * The ONE rule. `mashProfile.spargeTempC !== null` wins; otherwise the
 * brewhouse default. Never a falsy check — 0 is a legitimate stored value.
 */
export function resolveSpargeTemperatureC(
  equipment: EquipmentProfile,
  mashProfile: MashProfile | null,
): number;
```

| `mashProfile` | `spargeTempC` | Returns |
|---|---|---|
| `null` | — | `equipment.spargeTemperatureC` |
| present | `null` | `equipment.spargeTemperatureC` |
| present | `0` | `0` — **not** the equipment value |
| present | `72.5` | `72.5` |

### 2.4 No-match / fallback contracts

```ts
export interface MashPlanStep {
  stepId: string;
  name: string;
  type: MashStepType;
  position: number;
  stepTempC: number;
  stepTimeMin: number;
  rampTimeMin: number;
  infusionVolumeL: number | null;              // null iff infusionSource === 'none'
  infusionSource: 'computed' | 'stored' | 'none';
  infuseWaterTempC: number;
  mashVolumeAfterL: number;                    // running total, unrounded
}

export type MashPlan =
  | { hasMashProfile: false }
  | {
      hasMashProfile: true;
      profileId: string;
      profileName: string;
      targetPh: number;
      spargeTemperatureC: number;
      spargeTemperatureSource: 'mashProfile' | 'equipment';
      totalGrainKg: number;
      strikeWaterL: number;
      strikeTemperatureC: number | null;   // null iff steps.length === 0
      steps: MashPlanStep[];
      totalInfusionWaterL: number;
      mashWaterBalanceL: number;           // signed; negative = schedule wants more water
    };

/** Pure. Reads only `recipe`. Never throws. */
export function calculateMashPlan(recipe: Recipe): MashPlan;
```

| Situation | Contract |
|---|---|
| `recipe.mashProfile === null` | `{ hasMashProfile: false }` — **the object has no other key.** A caller that wants `strikeTemperatureC` must narrow first; there is no placeholder to read by accident. |
| `mashProfile` present, `steps === []` | `hasMashProfile: true`, `steps: []`, `strikeWaterL` still computed, **`strikeTemperatureC: null`**, `totalInfusionWaterL: 0`, `mashWaterBalanceL: 0`. Not an error, not `0`, not `NaN`. |
| `mashProfile` present, `steps.length >= 1` | `strikeTemperatureC` computed from `steps[0].stepTempC` as the target, `strikeWaterL` as the water volume, `recipe.equipment.grainTemperatureC` and `recipe.equipment.mashTunHeatCapacityL`. |
| step at `position === 0` | `infusionVolumeL: null`, `infusionSource: 'none'`, `mashVolumeAfterL === strikeWaterL` — **always**, regardless of `type` or a stored `infuseAmountL`. |
| step at `position >= 1`, `type === 'Infusion'`, `infuseAmountL === null` | `infusionSource: 'computed'`; volume from `infusionVolumeL({ grainWeightKg: totalGrainKg, currentTempC: previous step's stepTempC, targetTempC: this step's stepTempC, infusionWaterTempC: this step's infuseWaterTempC, currentMashVolumeL: running volume })` |
| step at `position >= 1`, `type === 'Infusion'`, `infuseAmountL` non-null (including `0`) | `infusionSource: 'stored'`; volume is `infuseAmountL` verbatim — not recomputed, not clamped, not reconciled |
| step at `position >= 1`, `type === 'Decoction'` or `'Temperature'` | `infusionVolumeL: null`, `infusionSource: 'none'`, running volume unchanged — **even if `infuseAmountL` is non-null.** A stored amount on a non-infusion step is ignored, never silently applied. |
| recipe with zero fermentables | `totalGrainKg === 0`; `strikeWaterL === 0` (P1's §2.1 zero-grain row); `strikeTemperatureC === steps[0].stepTempC` by the grain guard. No `NaN` anywhere in the plan. |
| `totalInfusionWaterL` | Sum of every non-null `infusionVolumeL` across all steps. `0` when there are none. |
| `mashWaterBalanceL` | `strikeWaterL + totalInfusionWaterL` subtracted from `calculateWaterVolumes(...).mashWaterL`. Under §Resolved-Ambiguities' strike rule this equals `-totalInfusionWaterL` exactly; it is computed, not assumed, so the identity is a test rather than a comment. |
| `GET /api/mash-profiles` when the table is empty | `200 []` |
| `findRecipesUsing*Profile` matching nothing | `[]` — never `null`, never a throw. An empty array is what authorises the delete. |
| `PUT` on an unknown profile id | `404 NOT_FOUND`. **Nothing is written.** No upsert-on-missing under any circumstance. |
| `DELETE` on a profile referenced by ≥1 recipe | `409 PROFILE_IN_USE`, `details = { profileKind, recipeCount, recipeNames }` (≤5 names, `updatedAt DESC`). The profile, its steps and every recipe are unmodified. |
| `POST`/`PUT /api/recipes` with an unknown `mashProfileId` | `400 VALIDATION_FAILED` naming the field. Nothing written. Never a `500`, never a silent `null`. |
| Web: schedule list load fails | The manager renders an error panel with the server message and Retry. It must **not** render an "no profiles yet" empty state — an empty state on a failed load is a lie about the user's data. (P1's rule, restated because it is now enforced in two more places.) |
| Web: schedule save fails | The form stays populated with the user's edits including every step row, a persistent error banner shows the server message, and **no** profile in the in-memory list is mutated. A `409`/`400` never closes the form. |
| Web: recipe has no mash profile | `MashSection` renders the picker with "None" selected and a one-line prompt to pick or create a schedule. It renders **no** strike temperature row, **no** step table and no `—` placeholder standing in for a number. |
| Web: recipe has a mash profile with zero steps | The picker shows the profile; the sheet shows the sparge temperature and a "this schedule has no steps yet" line. **No strike-temperature row is rendered** (it is `null`). |
| `applyMashProfileUpdate` / `applyFermentationProfileUpdate` when ids do not match, or `recipe === null` | Total no-op. `recipe`, `storedId`, `savedSnapshot`, `saveState`, `saveError` all unchanged and reference-identical. |

### 2.5 Stateful integration

**`apps/web/src/hooks/useRecipeEditor.ts`** — state shape is unchanged (`recipe`, `storedId`, `savedSnapshot`, `saveState`, `saveError`). Three changes:

1. `toWriteInput` gains `mashProfileId: recipe.mashProfile?.id ?? null` and `fermentationProfileId: recipe.fermentationProfile?.id ?? null`. `canonicalWorking` is **not** touched — it already canonicalises whatever `toWriteInput` returns, so the two stored references enter `isDirty` automatically and the hydrated objects stay out of it. All three `savedSnapshot` write sites (`loadRecipe`, successful `save`, and nowhere else) keep using the identical projection.
2. `startNewRecipe` sets `mashProfile: null, fermentationProfile: null`. `EMPTY_RECIPE_FOR_STATS` gains the same two nulls.
3. Two new methods on `UseRecipeEditorResult`, each an exact structural mirror of `applyEquipmentUpdate`:

```ts
/**
 * Substitutes a freshly-saved schedule into the working recipe when (and only
 * when) the open recipe references it. Never writes storedId, savedSnapshot,
 * saveState or saveError — the recipe's stored inputs (mash_profile_id /
 * fermentation_profile_id) did not change, so isDirty must not change either.
 */
applyMashProfileUpdate: (profile: MashProfile) => void;
applyFermentationProfileUpdate: (profile: FermentationProfile) => void;
```

Lockstep requirements, all of which must hold in a single render pass:

- `stats = useMemo(() => calculateRecipeStats(recipe ?? EMPTY_RECIPE_FOR_STATS), [recipe])` stays unconditional and ungated on `saveState`, and is **unchanged** — `calculateRecipeStats` does not read either profile and `CalculatedStats` does not move when a schedule changes. This is a property to assert, not merely to leave alone.
- The mash plan is memoised on the same key: `mashPlan = useMemo(() => calculateMashPlan(recipe ?? EMPTY_RECIPE_FOR_STATS), [recipe])`, exposed on `UseRecipeEditorResult` as `mashPlan: MashPlan`. `applyMashProfileUpdate` replaces the `recipe` reference, so `stats` and `mashPlan` recompute in the **same** render — `StatsHeader`'s water tiles and `MashSection`'s strike temperature can never disagree about which equipment profile or grain bill they are describing.
- `MashSection` receives `recipe.mashProfile` and the plan from the hook — the same object graph `calculateMashPlan` consumed. It must **not** look the profile up in `App`'s `mashProfiles` list, which can be one fetch behind.
- `beforeunload` registration continues to key off `isDirty`, and therefore does not fire for a schedule-only edit.

**`apps/web/src/App.tsx`** — `view: 'list' | 'editor' | 'equipment' | 'mashProfiles' | 'fermentationProfiles'`. Entering either schedule view from the editor does **not** run the unsaved-changes confirm (the recipe stays mounted in hook state and is returned to intact — P1's rule for `'equipment'`, extended verbatim); entering `'list'` from the editor still does. Leaving a schedule view returns to `'editor'` when `editor.recipe` is set, else `'list'`. After any successful create/update/delete the corresponding list is re-fetched, and for an update the matching `editor.apply*Update(updated)` is called. Both manager views receive `activeRecipeProfileId` so the open recipe's schedule shows a disabled Delete with an inline reason — belt-and-braces over the server's `409`, which stays authoritative and is tested independently.

**Recipe assembly on the API** — `assembleStoredRecipe` loads the mash profile (with its steps, sorted by `position`) and the fermentation profile in the same read that loads the equipment row, and passes both into `toStoredRecipe`. A `mash_profile_id` that is non-null but resolves to no row is **impossible** under the FK and, if it somehow occurs, hydrates as `null` rather than throwing — a recipe must always be openable.

### 2.6 Refactoring & legacy cleanup

- **The two "inert" lies must be corrected, and this is the phase that owes them.** `packages/shared-types/src/brewing.ts:57-58` currently reads `// water-equivalent thermal mass. Live in M3_P2. [0, 50].` and `// grist starting temperature. Live in M3_P2. [-20, 50].` Both must name what reads them (`strikeTemperatureC`, `mash.ts`) instead of pointing at a phase that has arrived. `apps/web/src/components/EquipmentForm.tsx:75` and `:84` currently show the user the hint **"Stored now, live in a future phase"** on `mashTunHeatCapacityL` and `grainTemperatureC`; after this phase that hint is false on screen. Both become text naming strike temperature. **`grep -rn "live in a future phase" apps packages` must return zero matches** (AC-45). `brewing.ts:55`'s `hopstandTemperatureC` inert note and `EquipmentForm.tsx:65`'s matching hint stay exactly as they are — that field is still genuinely inert and coupling it to utilisation remains M7 work, per P1's Resolved Ambiguities.
- **`brewing.ts:56`'s comment on `spargeTemperatureC`** — `// brewhouse default; M3_P2's mash profile may override.` — becomes a statement of fact naming `resolveSpargeTemperatureC` as the single resolution point. "may override" is now "does override, through exactly one function".
- **Two new row→domain projections, one each, and no hand-assembly anywhere.** `mashProfileRowsToDomain` and `fermentationProfileRowsToDomain` are the only places a profile row becomes a domain object — the same rule `equipmentRowToDomain` carries (P1 §2.6). No route, repository or test may hand-assemble a `MashProfile` from rows.
- **Position assignment is dense, 0-based and by array index, in the repository, on every write.** Client-supplied `position` values are **never** honoured; the array order in the request body is the order, full stop. This mirrors `toLineItemRows`' existing contract and prevents a client from writing a sparse or duplicated position that the `UNIQUE` index would reject at random.
- **Step id reuse follows the recipe line-item policy exactly:** a client-supplied step id is reused iff it already belongs to *this* profile; otherwise a fresh id is minted. On create, all client ids are ignored. Steps are deleted-and-reinserted inside the same transaction as the profile update — never a partial write.
- **No new `ApiErrorCode` beyond `PROFILE_IN_USE`,** and `EQUIPMENT_IN_USE` is not renamed, merged or generalised.
- **No calculation, mapper or repository may read `hop.type`** — M1's AC-39 remains in force.
- **No calculation in `/packages/calculations` may read a brewhouse constant that is not passed in as an argument** — M3's threshold, re-asserted over the new `mash.ts` module by AC-5, not assumed to be inherited from P1.
- `apps/api/drizzle/` stays committed; `apps/api/data/` stays gitignored.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | **M1 fixture suite is bit-identical** | Unit | All six Montano fixtures produce a `CalculatedStats` deep-equal (`===` on all 17 fields) to their pre-change values, with the fixture recipes now carrying `mashProfile: null, fermentationProfile: null`. `fixtures.test.ts` is byte-unchanged and green |
| **AC-2** | `CalculatedStats` is unchanged | Verification | `CalculatedStats` has exactly its 17 existing fields — no addition, rename or removal; no strike-temperature field anywhere in it |
| **AC-3** | P1's retired constants stay dead | Verification | `grep -rn "MASH_WATER_L_PER_KG\|GRAIN_ABSORPTION_L_PER_KG\|HOPSTAND_UTILIZATION_FACTOR\|DEFAULT_HOP_UTILIZATION_PCT" apps packages` (excluding `node_modules`) returns **zero** matches |
| **AC-4** | **Constant inventory is exactly the new closed list** | Unit | `constants.ts`'s exported names are exactly P1's 13 plus `STRIKE_GRAIN_HEAT_COEFF` and `INFUSION_GRAIN_HEAT_COEFF` — 15, no more, no fewer. The 13 pre-existing values are unchanged; the two new ones are `0.41` and `0.4` |
| **AC-5** | **No brewhouse constant is read without being passed in** | Verification | `mash.ts` imports from `./constants` only the two coefficients in AC-4's new pair; no numeric literal in `mash.ts` equals `3.0`, `0.96`, `0.26`, `87`, `76`, `79`, `20` or `100` outside a comment; every physical term of both formulas appears in the input interface |
| **AC-6** | `strikeTemperatureC` reads the two P1 fields | Unit | Two calls differing **only** in `mashTunHeatCapacityL` (`0` vs `5`) return different values, the larger for `5`; two differing only in `grainTemperatureC` (`10` vs `20`) return different values, the larger for `10` |
| **AC-7** | Strike temperature reduces to the classic form at zero tun mass | Unit | With `mashTunHeatCapacityL === 0`, the result equals `targetMashTempC + (0.41 / (waterVolumeL / grainWeightKg)) * (targetMashTempC - grainTemperatureC)` within `1e-9` |
| **AC-8** | Strike temperature identity at equal temperatures | Unit | `grainTemperatureC === targetMashTempC` returns exactly `targetMashTempC` for any positive water volume, grain weight and tun mass |
| **AC-9** | **Strike temperature degenerate inputs** | Unit | `grainWeightKg === 0` returns exactly `targetMashTempC`; `waterVolumeL === 0` returns exactly `targetMashTempC`; both zero returns exactly `targetMashTempC`. No `NaN`, no `Infinity`, in any of the three |
| **AC-10** | **Infusion volume degenerate inputs** | Unit | `targetTempC === currentTempC` → `0`; `targetTempC < currentTempC` → `0`; `infusionWaterTempC === targetTempC` → `0`; `infusionWaterTempC < targetTempC` → `0`; `grainWeightKg === 0 && currentMashVolumeL === 0` → `0`. No `NaN`, no `Infinity`, no negative |
| **AC-11** | Infusion volume is monotone and correct | Unit | For a fixed grist and mash volume, a larger `targetTempC` gap yields a strictly larger volume; a hand-computed reference case matches within `1e-9` |
| **AC-12** | `resolveSpargeTemperatureC` precedence, all four rows | Unit | §2.3's table holds exactly, including `spargeTempC: 0` returning `0` and **not** the equipment value, and `mashProfile === null` returning the equipment value |
| **AC-13** | **Migration does not rebuild `recipes`** | Verification | `apps/api/drizzle/0002_*.sql` touches `recipes` only via `ALTER TABLE \`recipes\` ADD COLUMN` — no `CREATE TABLE recipes`, no `DROP TABLE recipes`, no `INSERT INTO recipes … SELECT`. After migrating, `PRAGMA foreign_key_list('recipes')` still reports `equipment_id → equipment_profiles.id` with `on_delete = RESTRICT`, and additionally reports both new `SET NULL` edges |
| **AC-14** | Migration applies additively to real data | Integration | Migrating a database created at `0001` and populated with a recipe adds both columns as `NULL`, creates all four tables, and leaves every pre-existing recipe's `calculateRecipeStats` output deep-equal (`===`) before and after; the row count in every pre-existing table is unchanged |
| **AC-15** | `equipment_profiles` is untouched by this phase | Verification | `0002_*.sql` contains no statement naming `equipment_profiles`; `apps/api/src/repositories/equipmentRepository.ts` and `apps/api/src/routes/equipment.ts` are byte-unchanged; `EquipmentProfile`'s field list is byte-unchanged |
| **AC-16** | Seeding stays idempotent and adds the documented schedules | Integration | `seedDatabase` run twice yields exactly 2 mash profiles (one 1-step, one 3-step) and 1 fermentation profile (3 steps), with unchanged `updatedAt`, and still exactly 2 equipment profiles. `rec-sample-1` has `mash_profile_id IS NULL` and `fermentation_profile_id IS NULL` |
| **AC-17** | **A 3-step mash profile round-trips with order preserved** (roadmap threshold) | Integration | `POST` a profile with 3 steps in a deliberately non-alphabetical, non-temperature order; `GET` it back — `steps[i].name` and `steps[i].stepTempC` match the submitted order exactly, and `position` is `0,1,2`. Repeat after closing the DB handle and reopening the file with a new connection and server instance: still identical |
| **AC-18** | Positions are dense, 0-based and server-assigned | Integration | A `PUT` body whose steps carry client-supplied `position` values of `7, 3, 99` stores positions `0, 1, 2` in the request's array order; a body with duplicate client positions is accepted and stored densely, not rejected by the UNIQUE index |
| **AC-19** | `PUT` fully replaces the step array | Integration | `PUT`ting 1 step over a 3-step profile leaves exactly 1 step row; `PUT`ting 4 over 1 leaves exactly 4; no orphan `mash_steps` row survives either direction (`SELECT COUNT(*)` asserted) |
| **AC-20** | Step id reuse policy | Integration | A `PUT` re-supplying an existing step's id keeps that row's id; supplying an id belonging to a **different** profile mints a fresh id instead of stealing the row; on `POST`, every client-supplied id is ignored |
| **AC-21** | Deleting a profile cascades its steps | Integration | Deleting an unreferenced 3-step mash profile returns `204` and leaves zero `mash_steps` rows for it; every other profile's steps are untouched |
| **AC-22** | `PUT` on an unknown id writes nothing | Integration | `404 NOT_FOUND` with a well-formed `ApiErrorBody`; profile and step row counts unchanged; no row was upserted. Asserted for both profile kinds |
| **AC-23** | Partial `PUT` body is rejected | Integration | A mash body missing `targetPh`, and a fermentation body missing `steps`, each return `400 VALIDATION_FAILED`; the stored rows are bit-identical to before the call |
| **AC-24** | **Boundary validation, exact operators** | Integration | For each row of the Resolved-Ambiguities bounds table, the stated rejected values return `400 VALIDATION_FAILED` and the stated boundary-admissible values return `200`/`201` — including `targetPh: 3` and `9`, `stepTempC: 0` and `110`, `stepTimeMin: 0` and `600`, `stepTempC: -10` and `40` on fermentation, `pressurePsi: 0` and `null`, `spargeTempC: 0` and `null`, `infuseAmountL: 0` and `null`, and a 20-step array accepted while 21 is rejected |
| **AC-25** | Empty step array is admissible | Integration | `POST` with `steps: []` returns `201` with `steps: []`; `GET` returns the same; it is not coerced to a default step |
| **AC-26** | `name` whitespace rejection | Integration | `name: "   "` returns `400 VALIDATION_FAILED` on `POST` and `PUT`, for both profile kinds and for a step name |
| **AC-27** | **`DELETE` blocked by a referencing recipe** | Integration | With one recipe on mash profile M, `DELETE /api/mash-profiles/M` returns `409` with `error.code === 'PROFILE_IN_USE'`, `details.profileKind === 'mash'`, `details.recipeCount === 1` and `details.recipeNames` containing that recipe's name; the profile, its steps and the recipe all still exist and are unmodified. Same for a fermentation profile with `profileKind === 'fermentation'` |
| **AC-28** | `details.recipeNames` is capped | Integration | With 7 recipes on one profile, `details.recipeCount === 7` and `details.recipeNames.length === 5` |
| **AC-29** | `DELETE` on an unknown id | Integration | `404 NOT_FOUND`, well-formed `ApiErrorBody`, profile count unchanged, for both kinds |
| **AC-30** | Recipe write validates both profile ids | Integration | `POST /api/recipes` with `mashProfileId: 'nope'` returns `400 VALIDATION_FAILED` naming the field and writes **nothing** (recipe count unchanged); same for `fermentationProfileId`; same on `PUT`. Never a `500`, never a silent `null` |
| **AC-31** | Both keys are required, values nullable | Integration | A recipe body **omitting** `mashProfileId` returns `400 VALIDATION_FAILED`; a body with `mashProfileId: null` returns `201`/`200` and stores `NULL` |
| **AC-32** | Recipe round-trip carries both schedules | Integration | A recipe saved with a 3-step mash profile and a 3-step fermentation profile reads back after a real-file restart with both fully hydrated, steps in order, `spargeTempC` null-ness preserved and `pressurePsi` null-ness preserved |
| **AC-33** | M2's recipe round-trip is unaffected | Integration | M2's `canonicalRecipeJson` restart round-trip still passes byte-identically for a recipe with both profile ids `NULL` |
| **AC-34** | Duplicate copies both references | Integration | `POST /api/recipes/:id/duplicate` on a recipe with both schedules produces a copy pointing at the **same** profile ids — the schedules are shared, not cloned, and no new profile row is created |
| **AC-35** | **`calculateMashPlan` no-profile contract** | Unit | `mashProfile: null` returns an object where `hasMashProfile === false` and `Object.keys(...)` is exactly `['hasMashProfile']` — no `strikeTemperatureC`, no `steps`, nothing to read by accident |
| **AC-36** | **Zero-step profile yields a null strike temperature** | Unit | A profile with `steps: []` returns `hasMashProfile: true`, `steps: []`, `strikeTemperatureC === null`, `totalInfusionWaterL === 0`, `mashWaterBalanceL === 0`, and a finite `strikeWaterL`. `strikeTemperatureC === null` **iff** `steps.length === 0` — asserted in both directions against a 1-step profile |
| **AC-37** | Step 0 never reports an infusion | Unit | With `steps[0].type === 'Infusion'` **and** `steps[0].infuseAmountL === 12`, the plan's `steps[0].infusionVolumeL === null`, `infusionSource === 'none'`, and `mashVolumeAfterL === strikeWaterL`. The `12` appears nowhere in `totalInfusionWaterL` |
| **AC-38** | Computed vs stored infusion | Unit | On a 3-step profile: step 1 with `infuseAmountL: null` yields `infusionSource: 'computed'` and a volume equal to `infusionVolumeL(...)` called with the documented arguments within `1e-9`; step 2 with `infuseAmountL: 4.5` yields `infusionSource: 'stored'` and exactly `4.5`; `infuseAmountL: 0` yields `'stored'` and exactly `0`, **not** a computed value |
| **AC-39** | Non-infusion steps never consume water | Unit | A `Decoction` or `Temperature` step at `position >= 1` yields `infusionVolumeL: null`, `infusionSource: 'none'` and an unchanged `mashVolumeAfterL` — **even when its `infuseAmountL` is `9`** |
| **AC-40** | Running volume and balance identity | Unit | `mashVolumeAfterL` is `strikeWaterL` plus the cumulative sum of non-null infusion volumes at every index; `totalInfusionWaterL` equals the final increment sum; `mashWaterBalanceL === -totalInfusionWaterL` within `1e-9` |
| **AC-41** | **Mash plan degenerate recipe** | Unit | A recipe with zero fermentables and a 2-step profile returns `totalGrainKg === 0`, `strikeWaterL === 0`, `strikeTemperatureC === steps[0].stepTempC`, and no `NaN` or `Infinity` in any numeric field of the plan (asserted by sweeping every number in the returned object) |
| **AC-42** | Plan sparge temperature is resolved, not copied | Unit | With `mashProfile.spargeTempC === null` the plan's `spargeTemperatureC === equipment.spargeTemperatureC` and `spargeTemperatureSource === 'equipment'`; with `spargeTempC === 0` it is `0` with source `'mashProfile'` |
| **AC-43** | Plan reads the recipe's own equipment | Unit | Two recipes identical but for `equipment.grainTemperatureC` produce different `strikeTemperatureC`; two identical but for `equipment.mashTunHeatCapacityL` likewise. Neither changes `calculateRecipeStats` output at all |
| **AC-44** | Scaling carries schedules through untouched | Unit | `scaleRecipe` on a recipe with both profiles returns them **reference-identical** (`toBe`), not cloned and not dropped; `deriveScaledEquipment` is byte-unchanged and M2's AC-11 exact-parity check still passes at `r = 2` |
| **AC-45** | **The two inert-field lies are corrected** | Verification | `grep -rn "live in a future phase" apps packages` returns **zero** matches; `brewing.ts`'s `mashTunHeatCapacityL` and `grainTemperatureC` comments name `strikeTemperatureC`; the `hopstandTemperatureC` hint at `EquipmentForm.tsx:65` and its `brewing.ts` comment are **byte-unchanged**; `EquipmentForm.tsx`'s diff is exactly two string literals |
| **AC-46** | **`HopItem` and the hop path are untouched** | Verification | `packages/shared-types/src/brewing.ts`'s `HopItem` and `HopUse` are byte-identical to their pre-phase text; `HopSection.tsx`, `classifyHopUse`, `calculateSingleHopIbu`, `hopInputSchema` and the `recipe_hops` table definition are all byte-unchanged; no `dryHopDayOffset`, `dryHopDurationDays`, `whirlpoolTempC` or equivalent symbol exists anywhere in the repo |
| **AC-47** | **Schedule edit does not dirty an open recipe** | Integration (web) | With a clean saved recipe open on mash profile M, `applyMashProfileUpdate(M')` where `M'.id === M.id`: `recipe.mashProfile` is the new object, `mashPlan` has changed, and `isDirty === false` with `storedId`, `savedSnapshot`, `saveState`, `saveError` all unchanged. Same for fermentation |
| **AC-48** | Non-matching apply is a total no-op | Integration (web) | With a profile whose id differs, and separately with `recipe === null`: every piece of hook state is reference-identical to before the call, for both apply methods |
| **AC-49** | Picking a different schedule DOES dirty the recipe | Integration (web) | Setting `recipe.mashProfile` to a **different** profile → `isDirty === true`; setting it to `null` from a non-null value → `isDirty === true`; after a successful save → `isDirty === false` |
| **AC-50** | **Lockstep plan and stats update** | Integration (web) | In the render immediately following `applyMashProfileUpdate`, `MashSection`'s strike temperature and step table reflect the new profile **and** `StatsHeader`'s Mash Water / Sparge / Total Water values are unchanged and recomputed from the same `recipe` reference — no component shows a stale value for one render, and no schedule edit moves a `CalculatedStats` number |
| **AC-51** | `MashSection` reads the recipe's profile, not the list | Verification (web) | `MashSection` receives its profile and plan from `editor` state; no `mashProfiles`-list lookup feeds any displayed strike temperature, step row or sparge temperature |
| **AC-52** | No-profile mash view renders no placeholder | Integration (web) | With `mashProfile === null`, `MashSection` renders the picker and the prompt, and the DOM contains **no** strike-temperature row and no `—`/`0.0`/`NaN` standing in for one. With a zero-step profile, the sparge temperature and the "no steps yet" line render and the strike-temperature row still does not |
| **AC-53** | Failed schedule save preserves the form | Integration (web) | With `PUT` stubbed to `500`, every edited field **and every step row** is still on screen, an error banner shows the server message, the form is still open, and the in-memory profile list is unmutated |
| **AC-54** | Failed schedule list load shows an error, not an empty state | Integration (web) | With `GET /api/mash-profiles` returning `500`, `MashProfileManager` renders an error panel with Retry and does **not** render the "no profiles yet" empty state. Same for fermentation |
| **AC-55** | Delete is disabled for the open recipe's schedule | Integration (web) | With recipe R open on mash profile M, M's row in the manager has a disabled Delete with a visible reason; every other profile's Delete is enabled. Same for fermentation |
| **AC-56** | Entering a schedule view never prompts for unsaved changes | Integration (web) | With a dirty recipe open, navigating to either schedule view fires **no** confirm and returns to the editor with the recipe and its dirty state intact; navigating to the library still confirms |
| **AC-57** | Root `npm test` runs all suites green | Command | `npm test` from the repo root reports `@truchabrew/calculations`, `@truchabrew/api` and `@truchabrew/web`, exits `0`, `0 failed` |
| **AC-58** | Cold clone | Command | From a clean checkout with no pre-existing DB file: `npm install && npm test` exits `0`, with no codegen step and no network access |
| **AC-59** | Typecheck / build / lint | Command | `npm run typecheck`, `npm run build`, `npm run lint` each exit `0` across all workspaces |
| **AC-60** | **Manual — build a schedule, watch the sheet** | Manual | `npm run dev`; create a 3-step mash schedule (66 °C / 72 °C / 76 °C mash-out, the last two as Infusion with `infuseAmountL` left blank); attach it to a saved recipe and save. The mash view shows a strike volume, a strike temperature above 66 °C, and computed infusion volumes on steps 2 and 3. Screenshot at `.gsd/active/manual_verification/M3_P2_mash_sheet.png` |
| **AC-61** | **Manual — the P1 fields are visibly live** | Manual | With the recipe open, edit its equipment profile's Grain Temperature from `20` to `5` and save; return to the recipe — the strike temperature has **risen** and no unsaved-changes prompt appeared. Then set Mash Tun Heat Capacity from `0` to `4` — the strike temperature rises again. Screenshots before/after at `.gsd/active/manual_verification/M3_P2_strike_before.png` / `_after.png` |
| **AC-62** | **Manual — order, restart, in-use delete** | Manual | Reorder the mash steps in the form and save; stop both processes and restart — the order is as saved. Attempt to delete the attached schedule: a clear "in use" message names the recipe. Detach it from the recipe, save, delete again — it succeeds. Screenshots at `.gsd/active/manual_verification/M3_P2_order_restart.png` and `_in_use.png` |
| **AC-63** | **Manual — fermentation schedule** | Manual | Create a 3-step fermentation schedule (Primary 20 °C / 14 d, ColdCrash 2 °C / 2 d, Conditioning 12 °C / 14 d), attach it, save, restart — all three steps and their order are intact. Screenshot at `.gsd/active/manual_verification/M3_P2_fermentation.png` |
| **AC-64** | **Scope guardrail** | Verification | Of the paths this session touched: nothing under `.claude/`, `.agents/`; nothing under `.gsd/` except `M3_P2_feature_spec.md`, `STATE.json`, `.gsd/active/manual_verification/**`. `CLAUDE.md`, `README.md`, `.oxlintrc.json`, root `package.json` unmodified. Every path in §1.5's "Untouched" list is byte-unchanged — in particular `packages/calculations/src/brewingMath.ts`, `packages/calculations/src/units.ts`, `test/fixtures.test.ts`, `test/fixtures/montano_brewing_recipes.json`, `apps/api/src/repositories/equipmentRepository.ts`, `apps/api/src/routes/equipment.ts`, `apps/api/drizzle/0000_*.sql`, `0001_*.sql`, `apps/web/src/components/StatsHeader.tsx`, `HopSection.tsx`, `RecipeLibrary.tsx` and `EquipmentManager.tsx`. Checked by per-session provenance (pre-execution stash point or mtime), not a raw whole-tree `git diff` — see M1's AC-42 correction |
| **AC-65** | **NEW (amendment). Strike temperature is pinned numerically at `mashTunHeatCapacityL > 0`** | Unit | Three parts, all required. **(a) Exact values.** `strikeTemperatureC({ targetMashTempC: 67, grainTemperatureC: 20, waterVolumeL: 15, grainWeightKg: 5, mashTunHeatCapacityL: 5 })` returns **`89.09`** within `1e-9`; the same inputs at `mashTunHeatCapacityL: 1.5` return **`78.12333333333333`** within `1e-9`; at `mashTunHeatCapacityL: 0` they return **`73.42333333333333`** within `1e-9`. **(b) The tun term does not scale with grain weight.** `strike(M=5) - strike(M=0)` computed at `grainWeightKg: 5` and again at `grainWeightKg: 10`, all other inputs as in (a), are **equal within `1e-9`** (both `≈ 15.666666666666`), and each equals `mashTunHeatCapacityL * (targetMashTempC - grainTemperatureC) / waterVolumeL` within `1e-9`. **(c) Negative controls, asserted as inequalities so the test states what it rejects.** At the (a) inputs with `mashTunHeatCapacityL: 5`, the result is **not** `71.8175` (the originally-approved spec's literal formula, which falls with tun mass) and **not** `75.56444444444445` (the `(waterVolumeL + mashTunHeatCapacityL) / waterVolumeL` form currently shipped in `mash.ts`). This criterion exists because AC-6/7/8/9 are satisfied by all three of those forms — the critic measured a 15.7 °C spread between them — and therefore did not determine the implementation |
| **AC-66** | **NEW (amendment). `mash.ts` implements §2.1's amended formula, and the superseded-formula comment is gone** | Verification | `strikeTemperatureC` in `packages/calculations/src/mash.ts` computes `targetMashTempC + (targetMashTempC - grainTemperatureC) * (STRIKE_GRAIN_HEAT_COEFF * grainWeightKg + mashTunHeatCapacityL) / waterVolumeL`, with the association §2.1 makes binding. The identifier `totalThermalMassL` and any expression dividing by or multiplying by `waterVolumeL + mashTunHeatCapacityL` **no longer appear anywhere in the file**. The 17-line divergence note at the pre-amendment `mash.ts:28-43` — which documents a decision this amendment supersedes and asks for a re-verification that has now happened — is **removed**, and the retained doc comment cites §4 deviation 6 rather than claiming to implement build-spec §3.5 verbatim. `grep -rn "totalThermalMassL" packages` returns **zero** matches. The two guards, `infusionVolumeL`, `resolveSpargeTemperatureC` and `calculateMashPlan` are otherwise unchanged, and AC-6, AC-7, AC-8, AC-9, AC-41 and AC-43 all still pass unmodified in wording |
| **AC-67** | **NEW (amendment). The two §1.5 test-file exceptions are exactly the forced minimum** | Verification | `apps/api/test/errors.test.ts`'s diff against its pre-phase text consists of exactly `mashProfileId: null` and `fermentationProfileId: null` on one inline payload, plus comment lines — no other executable line added, removed or changed. `apps/api/test/equipment.migration.test.ts`'s diff consists of exactly the `Recipe` literal's two `null` profile fields, the two trailing `null` arguments at the single `toStoredRecipe` call site, and `toHaveLength(1)` → `toHaveLength(3)` on `foreign_key_list('recipes')`, plus comment lines. **The added `mashEdge` / `fermentationEdge` `SET NULL` assertions are removed from this file** — `grep -n "mash_profile_id\|fermentation_profile_id" apps/api/test/equipment.migration.test.ts` returns matches only inside comments, never inside an `expect`. The coverage they duplicated is retained and unmoved in `apps/api/test/schedules.migration.test.ts`, which still asserts all three `recipes` edges (RESTRICT + both `SET NULL`); `npm test` stays green with **no** net loss of assertion coverage across the two files |

---

## 4. Deviation Register — requires explicit sign-off at the halt gate

Six points where this spec departs from `ROADMAP.md`'s literal wording, from `.gsd/documents/brewfather_clone_build_spec.md`, from the M3_P1 spec's §5 preview, or — entry 5 — from a scope the user has actively raised. Each is reversible at this gate. **Entries 1–5 were signed off at the original `SPEC_APPROVED` and are restated here unchanged, for context only. Entry 6 is new, is the substance of this amendment, and is the one that needs a decision now.**

1. **`MashStep.infuseWaterTempC` is added to the schema although build-spec §1.5 does not list it.** `infusionVolume` needs the temperature of the water being added. The alternatives were a module-level constant (which is precisely what M3's verification threshold forbids for anything physical, and `100 °C` is at least arguably a kit/technique property rather than a published formula coefficient), a new column on `equipment_profiles` (which would spend the second equipment migration that P1 deviation 4 explicitly bought its way out of, and is wrong anyway — infusion water temperature is a per-step choice, not a property of the kettle), or an unstored UI input (which makes a reloaded recipe's infusion volumes non-deterministic — the same class of defect P1 deviation 4 was created to avoid). Storing it per-step at a `100.0` default keeps the whole mash plan derivable from stored data and costs one column. *Overrule and it becomes a UI input, with infusion volumes documented as non-reproducible across sessions.*

2. **Deleting a referenced schedule is blocked with `409 PROFILE_IN_USE` rather than nulling the reference through.** The M3_P1 §5 preview specified `ON DELETE SET NULL` on both recipe FKs, which reads as "deleting a schedule quietly detaches it from every recipe using it". The FK action is kept — but the API never reaches it, because `DELETE` checks references first and refuses. Reason: a server-side `SET NULL` mutates the *stored* state of a recipe that may be open in the editor, which leaves `savedSnapshot` describing a row that no longer exists and makes `isDirty` wrong in one direction or the other, with no clean fix that does not involve the hook retaining a full server `StoredRecipe`. Blocking eliminates the class, and it matches the equipment-delete behaviour the user already learned in P1 — one deletion rule for all three profile families instead of two. *Overrule and `DELETE` returns `204` unconditionally, the FK nulls referencing recipes, and this spec must additionally define the client-side reconciliation for an open recipe whose schedule was deleted underneath it (roughly 3 extra ACs and a `savedSnapshot` rebase path in `useRecipeEditor`).*

3. **`MashProfile.targetPh` is a required non-null number, not nullable.** Build-spec §1.5 writes `ph(target 5.2-5.6)` with no null case, and the P1 §5 preview wrote `targetPh` unqualified while explicitly writing `spargeTempC: number | null` — so the asymmetry is deliberate and inherited. A default of `5.4` is applied at the DB and in the form. The cost is that a user with no pH opinion still stores one; the benefit is one fewer nullable branch in a phase that already has three (`spargeTempC`, `infuseAmountL`, `pressurePsi`). Actual pH *prediction* is M6 and is untouched here. *Overrule and it becomes `number | null` with an "unset" form state, at roughly 2 extra ACs.*

4. **`FermentationProfile.pressurized` from build-spec §1.5 is not adopted; `FermentationStep.pressurePsi` is.** The build spec carries both a profile-level `pressurized` boolean and a step-level `pressure(PSI)`. The boolean is derivable — a profile is pressurised iff any step has a non-null `pressurePsi` — and storing both creates two mutable representations of one fact with no defined precedence, which is exactly what P1 deviation 2 rejected `evaporationRate%` for. `pressurePsi` is stored and inert until M5, on M2's stored-but-inert `miscs` precedent. *Overrule and `pressurized` is added as a stored boolean with a stated precedence rule against the step values.*

5. **Per-hop-use scheduling attributes are considered and DELIBERATELY EXCLUDED from this phase.** The user has raised — correctly, and this spec agrees the model is currently wrong — that `HopItem` carries one generic `timeMinutes` regardless of `use`, when Boil means *minutes remaining in the boil*, Whirlpool means *minutes after flameout plus a temperature*, and DryHop means *a day-offset from fermentation start plus a duration in days*; and that `DryHop` today classifies to zero IBU with no day or duration field at all. It is excluded here for the three reasons set out in full in §Resolved-Ambiguities' first bullet, of which the decisive one is that **M3's verification threshold is about brewhouse constants, which P1 already closed, and hop scheduling moves it not at all** — while `DryHop`'s day-offset has no *referent* until a `Batch` with a fermentation-start timestamp exists, which is Milestone 4 at the earliest. Adding it now would store a number that points at nothing, the exact inert-field anti-pattern P1 deviation 3 rejected. `HopItem`, `HopUse`, `classifyHopUse`, `calculateSingleHopIbu`, `HopSection.tsx` and `recipe_hops` are all on the Untouched list and AC-46 enforces it. **Recommended placement:** the Boil/Whirlpool split into M4, alongside the batch brew-day log that gives whirlpool time-after-flameout something to be logged against; `DryHop`'s `dayOffset`/`durationDays` into M5, which introduces the fermentation timeline they are measured from. Both would also want M1's IBU fixture bands re-run, since changing what `timeMinutes` means for `Whirlpool` moves calculated IBU. *This entry needs a decision even though nothing in it is being built: **accept** and the user should raise it at `/steer` for explicit roadmap placement in M4/M5; **overrule** and M3_P2 grows a sixth work-stream — a `HopItem` discriminated union or per-use optional fields, a `recipe_hops` migration, a `classifyHopUse`/`calculateSingleHopIbu` signature change, an M1 fixture re-baseline, and a `HopSection.tsx` rewrite — at an estimated 12–15 additional acceptance criteria and a re-opened M1 tolerance argument, in the closing phase of a milestone whose threshold it does not advance.*

6. **NEW, added by amendment after the `/verify` critic audit: `strikeTemperatureC` implements the energy-balance form, NOT build-spec §3.5's literal formula.** `.gsd/documents/brewfather_clone_build_spec.md:214-220` writes the third factor as `(waterVolumeL / totalThermalMassL)`. The originally-approved §2.1 transcribed that faithfully — and then asserted the opposite of it in its own adjacent prose ("*a cold tun steals heat*") and in AC-6. Both cannot be true: at `targetMashTempC 67 / grainTemperatureC 20 / waterVolumeL 15 / grainWeightKg 5`, the literal formula gives `73.42` at `mashTunHeatCapacityL = 0` and **falls** to `71.82` at `mashTunHeatCapacityL = 5`. The document's formula is backwards for what it claims to compute, and the most economical explanation is a derivation slip upstream of this project: the factor `W / (W + M)` is the shape you get when computing the *resulting* mash temperature from a known strike temperature — where extra cold thermal mass genuinely *damps* the temperature achieved — not when solving for the strike temperature required. Inverted into a strike-temperature solution it says a heavier, colder tun needs *less* heat, which is false.

   **Three candidates were on the table and this spec picks one, explicitly, so the ambiguity cannot survive a second pass.** (a) The document's literal `W / (W + M)` — rejected: monotonically wrong in direction, contradicts this spec's own prose and AC-6. (b) `(W + M) / W`, the inversion the build shipped — rejected: it is right in *direction* but wrong in *shape*. It multiplies the **grain** correction by the tun ratio, making the tun's contribution `COEFF * grainWeightKg * mashTunHeatCapacityL * (T2 - T1) / waterVolumeL²` — proportional to grain weight. The same empty tun would then demand twice the compensation because you decided to mash twice the grist in it, which is not a thing that happens. (c) **The energy balance, adopted:** `targetMashTempC + (targetMashTempC - grainTemperatureC) * (STRIKE_GRAIN_HEAT_COEFF * grainWeightKg + mashTunHeatCapacityL) / waterVolumeL`. It is not a patch on a formula, it is a one-line consequence of conservation of energy with `mashTunHeatCapacityL` treated as exactly what `brewing.ts:57` says it is — a water-equivalent mass, in litres, starting at the grist's temperature. Its `mashTunHeatCapacityL = 0` limit is Palmer's classic `Tw = (0.2/r)(T2 - T1) + T2` (`How to Brew`, strike-water section), which is also where `STRIKE_GRAIN_HEAT_COEFF = 0.41` comes from — `0.2` per quart-per-pound × `2.086` lb water per quart ≈ `0.417`, the grain/water specific-heat ratio. Modelling a mash tun as an additive water-equivalent thermal mass at its starting temperature is what the established brewing calculators do (BeerSmith's "mash tun addition", Brewer's Friend's tun thermal mass), so this is the least-invented option of the three, not the most.

   **The acceptance criteria genuinely underdetermined this and that is the defect being fixed.** The critic measured all three forms against AC-6/7/8/9: (a) fails AC-6; **(b) and (c) both pass every one of them** and disagree by 13.5 °C at `mashTunHeatCapacityL = 5`. AC-7's `mashTunHeatCapacityL = 0` boundary discriminates nothing, because all three forms agree there. So **AC-65 is added to pin an exact value at `mashTunHeatCapacityL > 0`**, plus the grain-weight-independence property that separates (b) from (c) directly. Without it, a future re-execution could re-derive the wrong form and still go green.

   **This costs a code change and one screenshot.** `packages/calculations/src/mash.ts` currently ships form (b) — see the disclosed 17-line note at its lines 28–43, which was honest about diverging and is exactly why this decision is being made here rather than being discovered later. Follow-up `/execute` work: change the formula, delete that note (AC-66), update `mash.test.ts`'s strike cases, and **recapture AC-61's `M3_P2_strike_after.png`** — at that screenshot's inputs (`targetMashTempC 66`, `grainTemperatureC 5`, `waterVolumeL 17.25`, `grainWeightKg 5.75`, `mashTunHeatCapacityL 4`) the amended formula gives **88.5 °C** where the shipped form gave `76.3 °C`. **AC-61's wording is unchanged and still holds** — the strike temperature still rises on both edits — only its evidence is stale. **AC-60's evidence survives**: its schedule runs at `mashTunHeatCapacityL = 0`, where all three forms agree, and its `72.3 °C` remains correct. No API, schema, migration, route, hook or component contract is affected; `CalculatedStats` does not move (AC-43).

   *Overrule and there are two coherent alternatives, both of which still need AC-65 rewritten to pin whichever form is chosen. **Overrule to (b)** — keep the shipped inversion — and no code change is needed at all: the phase closes on the current tree, AC-61's screenshot stands, and the accepted residual is that the tun's heat demand scales with grain weight, i.e. the mash sheet under-compensates a heavy tun on small grists and over-compensates on large ones, most visibly for BIAB and no-sparge users. **Overrule to (a)** — the document's literal text — and §2.1's prose, AC-6 and AC-61's "rises again" wording must all be inverted to match, because the strike temperature would then *fall* as tun mass rises; this is the only option that requires editing criteria that currently trace YES, and this spec does not recommend it.*

**Known execution risks** (not deviations — flagged so a miss routes to the right layer):

- **SQLite `ALTER TABLE ADD COLUMN` with a `REFERENCES` clause requires a `NULL` default.** Both new `recipes` columns are nullable with no default, so this is satisfied — but if `drizzle-kit` decides to emit a table rebuild for `recipes` instead, the `equipment_id` `ON DELETE RESTRICT` edge silently vanishes and every M2/P1 referential guarantee dies while the tests still pass. AC-13 exists specifically to catch this. A failure there is a **spec/tooling** problem to route through `/diagnose`, not something to patch by hand-editing the generated migration without re-verifying the foreign-key pragmas.
- **`Recipe` gaining two required fields will surface as `tsc` errors across `fixtureAdapter.ts`, `brewingMath.test.ts`, `apps/api/test/helpers/fixtures.ts`, `apps/web/test/helpers/fixtures.ts`, `EMPTY_RECIPE_FOR_STATS` and every API test that posts a recipe body.** These are expected and are fixed by supplying `null` — never by widening either field to optional. A fixture that supplies a non-null profile will not move M1's numbers (no calculation reads them) but will make AC-1's "byte-unchanged fixture" claim harder to verify; supply `null`.
- **`toStoredRecipe`'s arity changes**, which is a breaking change to a mapper with two call sites in `recipeRepository.ts`. If a third appears during execution, it must pass real loaded profiles, not `null` placeholders.
- **The `better-sqlite3` import is the local `packages/better-sqlite3-shim` over `node:sqlite`**, not the native module. `ON DELETE CASCADE` on the two step tables is inert unless `PRAGMA foreign_keys = ON` is set on the connection — `client.ts` already does this and is on the Untouched list; AC-21 proves the cascade actually fires rather than assuming it.
- **`removeAdditional: true` is still Fastify's repo-wide default** (P1's critic Finding 1). `additionalProperties: false` alone will **not** reject an unknown key on any of the four new write bodies — it strips it silently. If any acceptance criterion here required rejecting an unknown key it would need a `preValidation` hook like `equipment.ts`'s; none does, and no such hook is in scope. Do not assume otherwise from reading the schemas.

---

## 5. Milestone closure

This is the closing phase of Milestone 3. On a passing `/verify`, the roadmap's Milestone 3 verification threshold is met in full across both phases:

- *"Changing `hopUtilization%` on an equipment profile visibly moves the IBU of every recipe using it"* — P1, AC-11/AC-33, verified.
- *"changing grain absorption moves the sparge water volume, with both values reproduced by a unit test against the fixture recipes"* — P1, AC-10, verified.
- *"A mash profile with three steps round-trips through the DB with step order preserved"* — **this phase, AC-17.**
- *"No calculation in `/packages/calculations` reads a brewhouse constant that isn't passed in as an argument"* — P1, AC-4/AC-5, and re-asserted over the new `mash.ts` module by **this phase's AC-4/AC-5**.

Milestone 4 ("Brew this recipe, log the brew day") is the next slice and depends on this one: the batch snapshot freezes the mash and fermentation schedules alongside the grain bill, and the mash sheet built here is the brew-day paperwork M4's measured values are recorded against. Deviation 5's hop-scheduling work is recommended for placement at that `/steer`.

---
> **HALT GATE (STATE 2) — RE-APPROVAL OF AN AMENDMENT, NOT A FIRST APPROVAL.**
> This spec was approved, built, and audited. The critic traced **62 of 64 criteria YES** and returned FAIL on two findings, both of which `/diagnose` placed at the **spec layer**, not the implementation layer. **The existing M3_P2 build stands in full — nothing already implemented is to be re-executed, reverted or re-derived except the two items below.**
>
> **What changed, and only this:** §2.1 (the strike-temperature formula and its prose), three appended criteria **AC-65 / AC-66 / AC-67** (AC-1..AC-64 unchanged and not renumbered), §1.5's file tables (two test files moved from Untouched to Modified as narrow named exceptions, plus an amendment note), and **§4 deviation 6**. Every other section, criterion and deviation is byte-unchanged.
>
> **This amendment needs sign-off on exactly two things:**
>
> **(a) The strike-temperature decision — §4 deviation 6. This is the one to read first.** §2.1's formula contradicted its own prose and AC-6, and the acceptance criteria did not settle it: at least two mutually-inconsistent formulas satisfy AC-6/7/8/9 and disagree by 13.5 °C at `mashTunHeatCapacityL = 5`. This spec now picks the **energy-balance form** — `target + (target - grainTemp) * (0.41 * grainKg + tunL) / waterL` — over both the build-spec document's literal text (wrong in direction) and the form the build shipped (wrong in shape: it makes the tun's heat demand scale with grain weight). **AC-65 pins exact numeric values at `mashTunHeatCapacityL > 0`, including negative controls naming both rejected forms, so this cannot be underdetermined a second time.** Approving this commits to a follow-up `/execute` pass: `packages/calculations/src/mash.ts` changes, its 17-line divergence note is deleted, `mash.test.ts`'s strike cases update, and **AC-61's `_strike_after.png` must be recaptured** (`88.5 °C`, not `76.3 °C`). AC-60's screenshot and every other criterion's evidence stand. Deviation 6 spells out both overrule paths, including the zero-code-change one.
>
> **(b) The two named test-file exceptions — §1.5.** `apps/api/test/equipment.migration.test.ts` and `apps/api/test/errors.test.ts` were on the Untouched list and were edited during the build. The `Recipe`-required-field and `toStoredRecipe`-arity fallout was genuinely compile-forced and the FK-count bump behaviourally forced, so they move to the Modified table with those edits enumerated exhaustively — the same remedy this project used for M2_P1's `brewingMath.test.ts` and M3_P1's `RecipeLibrary.tsx`. **This does not bless everything the build put there:** nine duplicate `SET NULL` foreign-key assertions were added to `equipment.migration.test.ts` that nothing forced — `schedules.migration.test.ts:96` already covers them — and **AC-67 requires them removed**, restoring that file to exactly the forced minimum diff.
>
> **The five original deviations are restated unchanged and were signed off at the first approval.** Deviation 5 (per-hop-use scheduling attributes deferred to M4/M5) still wants raising at `/steer` for explicit roadmap placement.
>
> Reply with **SPEC_APPROVED** to accept this amendment as drafted, or name an overrule on deviation 6, or provide feedback/adjustments. DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
