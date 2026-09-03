# FEATURE SPECIFICATION: M38_P1 — Recipe Folders & Tag Taxonomy

> **Milestone 38:** "Recipe Folders, Tags & BJCP 2021 Style Targets" (`.gsd/ROADMAP.md`)
> **Phase 1 of 3.** Introduces hierarchical folder organization and flexible multi-tag taxonomy to the recipe library. Extends the database schema with additive `folder` and `tags` columns, enhances recipe API endpoints with folder/tag filtering and multi-field search, integrates folder navigation tabs and tag chip badges into `RecipeLibrary.tsx`, and enables folder/tag assignment in the recipe editor.

> ### ⚠ AMENDMENT 1 — 2026-09-01 (Layer 2 FAIL remediation: F-1 data loss + F-2 scope authorization)
> This is a **same-phase amendment**, not a new phase (there is no `M38_P2` for this work — M38's P2/P3 remain the BJCP style-guide slices). M38_P1's first execution passed all four Layer-1 gates but **FAILed Layer 2** (`.gsd/archive/CRITIC_REPORT.md`, M38_P1 entry, 2026-09-01; summarized in `.gsd/archive/VERIFICATION_REPORT.md`, same date) and was routed through `/diagnose`. The critic's own routing recommendation was a spec amendment, not an in-place `/execute` patch, because the root cause is spec-layer: an Authorized Files list that did not cover files the spec's own ACs required.
>
> **What changes in Amendment 1:**
> - **F-1 (blocking, real data loss) closed.** `apps/api/src/routes/batches.ts`'s `toRecipeWriteInput()` omits `folder`/`tags` when building the full-replace `RecipeWriteInput` for the `syncToMasterRecipe: true` branch, silently wiping a recipe's folder and every tag on sync (200 response, zero test coverage). `apps/api/src/routes/batches.ts` is **added to Authorized Files**; the carry-through and its retain-vs-clear semantics are pinned by **RA-6**; new **AC-26 … AC-29** cover the fix and its regression tests.
> - **F-2 (blocking, process) closed.** `apps/api/src/routes/backup.ts` — edited during the first execution outside the Authorized Files list on the executor's own authority — is **retroactively authorized** by **RA-7** and added to the Authorized Files list. The critic independently verified that edit is functionally correct and benign. **No revert of it is required or permitted.** New **AC-30** pins its scope.
> - **F-3 (optional vs required typing) ratified with an explicit decision.** **RA-8** records the call-site survey, the decision to keep `Recipe`/`RecipeSummary`/`RecipeWriteInput` fields optional, the compensating mechanisms, and the deferral — so this does not resurface as an unexplained third finding. **AC-1 is AMENDED** to make the ratified shape unambiguous; new **AC-31** replaces the lost compile-time guard with an enumerated call-site inventory.
> - **F-4 (folder datalist/picker) explicitly deferred**, not silently absent — **RA-9**, §2.2 corrected, `.gsd/ROADMAP.md` M38 P3 line updated.
> - **F-6 (empty-string `?folder=`) pinned** — **RA-10**, new **AC-32**.
> - **AC IDs 1–25 stay stable.** AC-1, AC-21 and AC-25 are amended in place (marked `[AMENDED]`); **AC-26 … AC-32 appended.** New **RA-6 … RA-11** added. No AC is renumbered, so the next critic pass can cite deltas cleanly against the first.
> - **Baseline for this pass:** the working tree **as it stands after the first M38_P1 execution** (2,485 passed / 2 skipped across 126 files, typecheck 4/4, lint 0 errors). This pass is a **delta on top of that work**, not a rebuild. Nothing from the first execution is to be reverted except where an AC below explicitly requires it.

---

## Phase Summary

Milestone 38 establishes comprehensive organizational tools and BJCP 2021 style evaluation across TruchaBrew. Phase 1 provides the foundational taxonomy architecture:

1. **Schema & Domain Models (`packages/shared-types` & `apps/api/src/db/schema.ts`):**
   - Extends `Recipe`, `RecipeSummary`, `RecipeWriteInput`, and `StoredRecipe` with `folder: string | null` and `tags: string[]`.
   - Additive SQLite migration (`0009_recipe_folders_tags.sql`) adding `folder text` and `tags text (mode: 'json')` with safe defaults (`folder = null`, `tags = '[]'`).
2. **API Querying & Filtering (`apps/api/src/routes/recipes.ts` & `recipeRepository.ts`):**
   - `GET /api/recipes` supports query parameters `q` (text search matching name, style, author, folder, tags), `folder` (exact folder or `__unfiled__`), and `tag` (exact tag filter).
   - Full CRUD support for `folder` and `tags` in `createRecipe`, `updateRecipe`, and `duplicateRecipe` (which preserves folder and tag metadata).
3. **Recipe Library UI Enhancement (`apps/web/src/components/RecipeLibrary.tsx`):**
   - Folder selector pill strip / tabs ("All", "Unfiled", and dynamic list of user folders with recipe count badges).
   - Tag badges rendered in `<Badge variant="neutral" size="xs">` per recipe list row.
   - Interactive tag filtering allowing 1-click filtering by clicked tag.
4. **Recipe Editor Metadata Controls (`apps/web/src/App.tsx` & `useRecipeEditor.ts`):**
   - Folder selection / text input and tag entry in recipe header metadata.
   - Clean persistence through `useRecipeEditor` state management and `toWriteInput` projection.

---

## 1. Data Schema & Contracts

### 1.1 `packages/shared-types/src/brewing.ts` & `api.ts`

> **[AMENDED — Amendment 1]** The code block below is the **original** spec text and shows `Recipe.folder`/`tags` and `RecipeSummary.folder`/`tags` as **required**. The as-built shape is **optional** (`folder?: string | null; tags?: string[]`) on `Recipe`, `RecipeSummary`, and `RecipeWriteInput`. **RA-8 ratifies the optional shape as the binding contract for this phase** and records why. Read the block below with `folder?:` / `tags?:` substituted on all three interfaces; `StoredRecipe extends Recipe` inherits it. Every consumer must therefore coalesce (`?? null` / `?? []`) — AC-31 enumerates the sites where that is load-bearing.

```ts
export interface Recipe {
  id: string;
  name: string;
  author: string;
  styleName: string;
  folder: string | null;      // NEW in M38_P1: folder category (null = unfiled)
  tags: string[];             // NEW in M38_P1: array of tag strings (default: [])
  equipment: EquipmentProfile;
  fermentables: FermentableItem[];
  hops: HopItem[];
  yeasts: YeastItem[];
  miscs: MiscItem[];
  notes: string;
  mashProfile: MashProfile | null;
  fermentationProfile: FermentationProfile | null;
  waterSourceId?: string | null;
  waterTargetId?: string | null;
}

export interface RecipeSummary {
  id: string;
  name: string;
  author: string;
  styleName: string;
  folder: string | null;      // NEW in M38_P1
  tags: string[];             // NEW in M38_P1
  equipmentId: string;
  equipmentName: string;
  batchSizeL: number;
  fermentableCount: number;
  hopCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeWriteInput {
  name: string;
  author: string;
  styleName: string;
  folder?: string | null;     // NEW in M38_P1: optional in input, defaults to null
  tags?: string[];            // NEW in M38_P1: optional in input, defaults to []
  notes: string;
  equipmentId: string;
  fermentables: LineItemInput<FermentableItem>[];
  hops: LineItemInput<HopItem>[];
  yeasts: LineItemInput<YeastItem>[];
  miscs: LineItemInput<MiscItem>[];
  mashProfileId: string | null;
  fermentationProfileId: string | null;
  waterSourceId?: string | null;
  waterTargetId?: string | null;
}
```

### 1.2 `apps/api/src/db/schema.ts` — Drizzle Table Definition

```ts
export const recipes = sqliteTable(
  'recipes',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    author: text('author').notNull().default(''),
    styleName: text('style_name').notNull().default(''),
    folder: text('folder'), // NULL = unfiled
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => equipmentProfiles.id, { onDelete: 'restrict' }),
    notes: text('notes').notNull().default(''),
    mashProfileId: text('mash_profile_id').references(() => mashProfiles.id, { onDelete: 'set null' }),
    fermentationProfileId: text('fermentation_profile_id').references(() => fermentationProfiles.id, { onDelete: 'set null' }),
    waterSourceId: text('water_source_id').references(() => waterProfiles.id, { onDelete: 'set null' }),
    waterTargetId: text('water_target_id').references(() => waterProfiles.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
);
```

### 1.3 `apps/api/src/routes/schemas.ts` — Request Validation

```ts
export const recipeWriteBodySchema = {
  type: 'object',
  required: [
    'name',
    'author',
    'styleName',
    'notes',
    'equipmentId',
    'fermentables',
    'hops',
    'yeasts',
    'miscs',
    'mashProfileId',
    'fermentationProfileId',
  ],
  properties: {
    name: { type: 'string', minLength: 1 },
    author: { type: 'string' },
    styleName: { type: 'string' },
    folder: { type: ['string', 'null'], maxLength: 50 },
    tags: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 30 },
    },
    notes: { type: 'string' },
    equipmentId: { type: 'string', minLength: 1 },
    fermentables: { type: 'array', items: fermentableWriteItemSchema },
    hops: { type: 'array', items: hopWriteItemSchema },
    yeasts: { type: 'array', items: yeastWriteItemSchema },
    miscs: { type: 'array', items: miscWriteItemSchema },
    mashProfileId: { type: ['string', 'null'] },
    fermentationProfileId: { type: ['string', 'null'] },
    waterSourceId: { type: ['string', 'null'] },
    waterTargetId: { type: ['string', 'null'] },
  },
  additionalProperties: false,
} as const;
```

---

## 2. Transformations & Pure Logic

### 2.1 Pure Logic Helper Functions

- **`normalizeFolder(folder: string | null | undefined): string | null`**:
  - Trims input string. If empty string `""` or nullish, returns `null`.
  - Max length 50 characters.
- **`normalizeTags(tags: string[] | undefined | null): string[]`**:
  - Filters out empty/whitespace-only items, trims strings, deduplicates case-insensitively while preserving original casing of first occurrence.
- **`filterRecipes(recipes: RecipeSummary[], options: { q?: string; folder?: string | null; tag?: string | null }): RecipeSummary[]`**:
  - Client-side or repository-side filter combining folder matching (`'__unfiled__'` matches `null`), tag matching, and text search across `name`, `styleName`, `author`, `folder`, and `tags`.

### 2.2 Stateful Integration Flow

- **Recipe Library (`RecipeLibrary.tsx`)**:
  - Derives list of distinct folders from loaded recipes: `['__all__\, '__unfiled__\, ...uniqueSortedFolders]`.
  - Computes counts per folder: e.g. `All (12)`, `Unfiled (4)`, `IPAs (5)`, `Lagers (3)`.
  - Renders folder filter tab bar using standard secondary/ghost buttons or pill chips.
  - Renders tag chips under each recipe list row using `<Badge variant="neutral" size="xs">`.
  - Clicking a tag chip sets active tag filter, narrowing the recipe list immediately.

- **Recipe Editor (`App.tsx` / `useRecipeEditor.ts`)**:
  - Adds a folder text `Input` (set or clear; `''` → `null`). **[AMENDED — Amendment 1]** The "datalist or select-picker of existing folder names" this line originally called for is **explicitly deferred to M38_P3** per **RA-9** — it is not in scope for this phase and its absence is intentional, not an oversight.
  - Adds comma-separated / tag input for tag management.
  - Preserves `folder` and `tags` when saving, dirty checking with `canonicalWorking`.

### 2.3 Batch → Master Recipe Sync Contract *(new — Amendment 1, F-1)*

**Pure translation (no DB access, no state):**

```ts
// apps/api/src/routes/batches.ts (module-local helper, not exported)
// AMENDED signature — `existing` is REQUIRED, not optional.
function toRecipeWriteInput(recipe: Recipe, existing: StoredRecipe): RecipeWriteInput;
```

- Every field it already carries stays exactly as-is (no behavior change to `name`/`author`/`styleName`/`notes`/`equipmentId`/line items/`mashProfileId`/`fermentationProfileId`/`waterSourceId`/`waterTargetId`).
- It **additionally** emits `folder` and `tags`, resolved by **RA-6**'s presence rule against `existing`.
- It stays a total, side-effect-free function: no throw, no fetch, no mutation of either argument.

**Stateful integration (route layer, `PUT /api/batches/:id/recipe-snapshot`):**

- On the `syncToMasterRecipe === true` branch **only**, the handler first reads the master recipe via `getStoredRecipeById(db, recipeSnapshot.id)` (already exported from `recipeRepository.ts`; `batches.ts` already imports from that module).
- **No-match branch:** if that read returns `null`, the handler emits the **existing** 404 `NOT_FOUND` response with the **existing** message text (`Batch recipe snapshot saved, but master recipe sync failed: recipe not found: ${recipeSnapshot.id}`) and returns — it must **not** call `updateRecipe` with a placeholder/default `existing`, and must not invent a second 404 variant. The batch's own snapshot write has already committed at that point, exactly as today.
- **Match branch:** `updateRecipe(db, recipeSnapshot.id, toRecipeWriteInput(recipeSnapshot, existing))`.
- The `syncToMasterRecipe !== true` path is **untouched** — no extra read, no extra query, no change in response shape.
- The known non-transactionality of the batch write vs. the sync write (documented in the existing in-file comment) is **out of scope** and is neither fixed nor made worse here.

---

## 3. Acceptance Criteria Matrix (32 ACs — 25 original, 3 amended in place, 7 appended)

| ID | Category | Requirement / Expected Behavior | Verification Method |
|---|---|---|---|
| **AC-1** `[AMENDED]` | Domain Types | `Recipe`, `RecipeSummary`, `RecipeWriteInput`, and `StoredRecipe` (via `extends Recipe`) declare `folder?: string \| null` and `tags?: string[]` — **optional is the ratified shape (RA-8)**, and a required-field declaration is now a FAIL of this AC, not a pass. No `any`, no index-signature widening, no separate parallel type. | `packages/shared-types` typecheck + direct read of `brewing.ts` / `api.ts` |
| **AC-2** | Schema Migration | Additive migration adds `folder` (`text`, nullable) and `tags` (`text`, JSON mode, default `[]`) to `recipes` table; existing data preserved. | `apps/api/test/recipes.migration.test.ts` |
| **AC-3** | POST /api/recipes | Creating a recipe with `folder: "IPA"` and `tags: ["Hazy", "Citra"]` persists and returns both fields. | `apps/api/test/recipes.crud.test.ts` |
| **AC-4** | PUT /api/recipes/:id | Updating `folder` and `tags` updates stored row and returns updated fields; removing folder sets DB column to `NULL`. | `apps/api/test/recipes.crud.test.ts` |
| **AC-5** | Duplicate Recipe | `POST /api/recipes/:id/duplicate` preserves `folder` and `tags` on the duplicated recipe copy. | `apps/api/test/recipes.crud.test.ts` |
| **AC-6** | Tag Sanitization | Tags submitted with surrounding whitespace or duplicates are trimmed and deduplicated case-insensitively (e.g. `[" IPA ", "ipa", "Citra"]` $\rightarrow$ `["IPA", "Citra"]`). | `apps/api/test/recipes.crud.test.ts` |
| **AC-7** | Query Filter by Folder | `GET /api/recipes?folder=IPAs` returns only recipes where `folder === 'IPAs'`. | `apps/api/test/recipes.crud.test.ts` |
| **AC-8** | Query Filter by Unfiled | `GET /api/recipes?folder=__unfiled__` returns only recipes where `folder === null`. | `apps/api/test/recipes.crud.test.ts` |
| **AC-9** | Query Filter by Tag | `GET /api/recipes?tag=Citra` returns only recipes containing `'Citra'` in `tags`. | `apps/api/test/recipes.crud.test.ts` |
| **AC-10** | Multi-Field Text Search | `GET /api/recipes?q=Hazy` matches recipes where `q` appears in `name`, `styleName`, `author`, `folder`, or `tags`. | `apps/api/test/recipes.crud.test.ts` |
| **AC-11** | RecipeLibrary Folder Strip | `RecipeLibrary.tsx` renders a folder pill/tab strip with "All", "Unfiled", and dynamic folders with counts. | `apps/web/test/RecipeLibrary.test.tsx` |
| **AC-12** | RecipeLibrary Folder Switch | Clicking a folder tab filters visible list rows to recipes in that folder. | `apps/web/test/RecipeLibrary.test.tsx` |
| **AC-13** | RecipeLibrary Tag Badges | Recipe rows in `RecipeLibrary.tsx` render each tag using `<Badge variant="neutral" size="xs">`. | `apps/web/test/RecipeLibrary.test.tsx` |
| **AC-14** | RecipeLibrary Tag Filter | Clicking a tag badge filters the library to recipes with that tag; active tag filter displays with a dismiss action. | `apps/web/test/RecipeLibrary.test.tsx` |
| **AC-15** | Recipe Editor Folder Field | Recipe editor in `App.tsx` exposes a folder input/picker allowing setting or clearing the folder. | `apps/web/test/App.test.tsx` |
| **AC-16** | Recipe Editor Tags Field | Recipe editor exposes tag entry allowing adding, editing, and removing tags. | `apps/web/test/App.test.tsx` |
| **AC-17** | Dirty State Tracking | Changing folder or tags dirties the recipe editor (`isDirty === true`); saving resets dirty state. | `apps/web/test/useRecipeEditor.test.ts` |
| **AC-18** | Brewfather Import Mapping | `parseBrewfatherJson` maps Brewfather `folder` / `tags` (if present) to recipe `folder` and `tags`, defaulting to `null` and `[]`. | `packages/calculations/test/brewfatherImport.test.ts` |
| **AC-19** | Backup Export & Restore | Full-database JSON export (`GET /api/backup/export`) and restore (`POST /api/backup/restore`) preserve `folder` and `tags` without data loss. | `apps/api/test/backup.export.test.ts` + `backup.restore.test.ts` |
| **AC-20** | Primitive Adherence | All new buttons, inputs, selects, and badges in `RecipeLibrary.tsx` and `App.tsx` use `components/ui/` primitives (0 raw elements). | `apps/web/test/uiPrimitives.test.tsx` |
| **AC-21** `[AMENDED]` | Layer 1 Gate: Tests | Full test suite passes across all 4 workspaces with monotonic progression against **this amendment's baseline: strictly more than 2,485 passing** (the post-first-execution count), 0 failed, skips still ≤ 2. The original `> 2,437` threshold is superseded — it is already met by the tree this pass starts from and would certify nothing. | `npm test` (exit 0) |
| **AC-22** | Layer 1 Gate: Typecheck | All 4 workspaces pass typecheck cleanly. | `npm run typecheck` (exit 0) |
| **AC-23** | Layer 1 Gate: Build | Production client build compiles cleanly without errors. | `npm run build` (exit 0) |
| **AC-24** | Layer 1 Gate: Lint | Monorepo linter passes with 0 errors. | `npm run lint` (exit 0) |
| **AC-25** `[AMENDED]` | Scope Guardrail | Only files on §5's **amended** Authorized Files list are modified by this pass; 0 unexpected created or deleted files. Verified by the **pre/post SHA-256 content manifest** defined in RA-11, taken inside this pass. `git diff --name-only` against a base commit is **explicitly not a valid check here** and must not be substituted (RA-11). Additionally, these files must be **byte-identical** before and after this pass: `packages/calculations/src/waterOptimization.ts`, `packages/calculations/src/water.ts`, `packages/calculations/src/brewingMath.ts`, `packages/calculations/src/mash.ts`, `apps/web/src/components/WaterCalculatorModal.tsx`, `apps/web/src/components/ui/Badge.tsx`, `apps/api/src/db/schema.ts`, `apps/api/drizzle/0016_recipe_folders_tags.sql`, `apps/api/drizzle/meta/_journal.json`. | Pre/post SHA-256 manifest diff (RA-11) |
| **AC-26** *(new)* | F-1 Fix: Sync Carries Metadata | `toRecipeWriteInput()` in `apps/api/src/routes/batches.ts` emits `folder` and `tags` on the returned `RecipeWriteInput`, resolved per RA-6, and its call site on the `syncToMasterRecipe === true` branch passes the master recipe read via `getStoredRecipeById` as the second argument. All pre-existing emitted fields unchanged. | Direct source read of `batches.ts` + `apps/api/test/batches.recipeSnapshot.test.ts` |
| **AC-27** *(new)* | F-1 Regression Test: Metadata Survives Sync | A test creates a recipe with `folder: "IPAs"` and `tags: ["Hazy", "Citra"]`, creates a batch from it, then issues `PUT /api/batches/:id/recipe-snapshot` with `syncToMasterRecipe: true` and a snapshot carrying those same values. Afterward `GET /api/recipes/:id` returns **`folder === "IPAs"` and `tags` deep-equal to `["Hazy", "Citra"]`** — asserted on the master recipe, not on the batch snapshot. This test must **fail** against the pre-amendment `toRecipeWriteInput`. | `apps/api/test/batches.recipeSnapshot.test.ts` |
| **AC-28** *(new)* | F-1 Edge: Legacy Snapshot Retains | Same flow, but the request's `recipeSnapshot` object **omits the `folder` and `tags` keys entirely** (a pre-M38 batch snapshot). The master recipe's stored `folder` and `tags` are **retained unchanged** (RA-6), not reset to `null`/`[]`. | `apps/api/test/batches.recipeSnapshot.test.ts` |
| **AC-29** *(new)* | F-1 Edge: Explicit Clear Still Works | Same flow with `recipeSnapshot.folder === null` and `recipeSnapshot.tags === []` **present as keys**. The master recipe's `folder` becomes `null` and `tags` becomes `[]` — an intentional clear is not swallowed by AC-28's retention rule. Sync of a snapshot whose `tags` is a non-empty array replaces (does not merge with) the master's existing tags. | `apps/api/test/batches.recipeSnapshot.test.ts` |
| **AC-30** *(new)* | F-2 Retroactive Authorization | `apps/api/src/routes/backup.ts` appears on §5's Authorized Files list. Its `restoreRecipes` insert continues to carry `folder: recipe.folder ?? null` / `tags: recipe.tags ?? []`; **no revert** and **no further change** to that file beyond those two fields is made by this pass. AC-19's export/restore round-trip stays green. | Source read of `backup.ts` + `apps/api/test/backup.restore.test.ts` |
| **AC-31** *(new)* | Call-Site Inventory (compile-time guard replacement) | Every site that constructs a `RecipeWriteInput` **from an existing recipe** and feeds it to the full-replace `updateRecipe` emits `folder` and `tags`. The binding inventory is RA-8's table: `apps/api/src/routes/batches.ts` `toRecipeWriteInput` (AC-26), `apps/web/src/hooks/useRecipeEditor.ts` `toWriteInput`, `apps/api/src/repositories/recipeRepository.ts` `duplicateRecipe`'s internal `const input: RecipeWriteInput`. Sites that construct a **new** recipe from external data (`brewfatherImport.ts`, `beerXmlImport.ts`, `RecipeImportModal.tsx`, `recipes.ts` import route) are exempt and may omit both fields — they legitimately mean "no folder, no tags". Verified by reading each named site, not by grep count alone. | Direct source read of the 3 inventory sites |
| **AC-32** *(new)* | F-6: Empty-String Filter Params | `GET /api/recipes?folder=` (empty value) returns the **same set** as `GET /api/recipes` with no `folder` param at all — "no filter applied", matching the client's semantics (RA-10). Same for `?tag=`. `filterRecipes` (server, `recipeRepository.ts`) and `filterRecipesLocal` (client, `RecipeLibrary.tsx`) agree on this input. Pinned by a test asserting the empty-param response length equals the unfiltered response length, with at least one filed and one unfiled recipe seeded. | `apps/api/test/recipes.crud.test.ts` + `apps/web/test/RecipeLibrary.test.tsx` |

---

## 4. Resolved Ambiguities (Binding)

- **RA-1 — Folder Normalization & `__unfiled__` Representation:**
  - In database and domain models, an unfiled recipe has `folder = null`.
  - Empty string `""` sent in API payload is stored as `null`.
  - In URL query params and UI filter identifiers, `'__unfiled__'` represents recipes with `folder === null`.
- **RA-2 — Tag Representation & Deduplication:**
  - Tags are serialized in SQLite as JSON array `["tag1", "tag2"]`.
  - Tags are deduplicated case-insensitively (`['Session', 'session']` $\rightarrow$ `['Session']`), trimmed of leading/trailing whitespace, and empty strings discarded.
- **RA-3 — Duplicate Recipe Metadata Retention:**
  - When duplicating a recipe (`POST /api/recipes/:id/duplicate`), the new recipe clone inherits the original recipe's `folder` and `tags` unchanged.
- **RA-4 — Search Multi-Field Coverage:**
  - The `q` search parameter searches case-insensitively across: recipe `name`, `styleName`, `author`, `folder`, and every item in `tags`.
- **RA-5 — Backward Compatibility & Backup Export:**
  - Existing recipes in database automatically resolve `folder = null` and `tags = []`.
  - `DatabaseBackup` payload format retains full compatibility: `tags` and `folder` fields are optional on input during restore.

**RA-6 — Batch → master sync resolves `folder`/`tags` by key presence, never by value.** *(new, Amendment 1 — closes F-1)*
`updateRecipe` is **full-replace**: any key the caller omits is coalesced to `null`/`[]` by `normalizeFolder`/`normalizeTags` and overwrites whatever the master recipe held. `toRecipeWriteInput` therefore resolves both fields against the master recipe read (`existing`) using **key presence on the incoming snapshot**, not truthiness:

| Incoming `recipeSnapshot` | Emitted `folder` | Emitted `tags` |
|---|---|---|
| `'folder' in snapshot === false` (key absent — pre-M38 batch snapshot) | `existing.folder ?? null` (**retain**) | — |
| `snapshot.folder === undefined` (key present, value undefined) | `existing.folder ?? null` (**retain**) — treated identically to absent | — |
| `snapshot.folder === null` (explicit clear) | `null` | — |
| `snapshot.folder === "IPAs"` | `"IPAs"` (write through verbatim; `normalizeFolder` in the repository still trims/caps at 50) | — |
| `'tags' in snapshot === false` or `snapshot.tags === undefined` | — | `existing.tags ?? []` (**retain**) |
| `snapshot.tags === []` (explicit clear) | — | `[]` |
| `snapshot.tags === ["Hazy"]` | — | `["Hazy"]` (**replace**, never merge/union with `existing.tags`) |

- `Array.isArray(snapshot.tags)` is the presence test for `tags`; a non-array truthy value is treated as absent (retain), never coerced.
- Retention reads from `existing` — the `StoredRecipe` returned by `getStoredRecipeById` — **not** from a default object. If `getStoredRecipeById` returns `null` there is no `existing` to retain from, and §2.3's no-match branch returns 404 **before** `toRecipeWriteInput` is ever called; a placeholder/empty `existing` must never be constructed and must never reach `updateRecipe`.
- This rule is scoped to the batch sync path only. `POST /api/recipes` and `PUT /api/recipes/:id` keep their existing "omitted means null/[]" semantics (RA-1, RA-2, AC-3/AC-4) — the recipe editor always sends both fields, so full-replace is correct there.

**RA-7 — `apps/api/src/routes/backup.ts` is retroactively authorized as of this amendment.** *(new, Amendment 1 — closes F-2)*
During M38_P1's first execution the executor edited `apps/api/src/routes/backup.ts` — not on the original §5 list; only `packages/shared-types/src/backup.ts` was — because `restoreRecipes`' hand-written `.values({...})` would otherwise silently drop `folder`/`tags` on every restore, making the spec's own AC-19 unreachable. The edit was **disclosed**, is **two fields** (`folder: recipe.folder ?? null`, `tags: recipe.tags ?? []`), and was independently verified by the critic as functionally correct and benign. The defect was in the spec (an AC its file list made unreachable), not in the fix.
The file is now on §5's Authorized Files list, and **this amendment's `SPEC_APPROVED` is the missing approval**. **No revert of that edit is required or permitted** (AC-30). Same handling and same precedent as M37_P2's RA-13. Going forward the rule is unchanged and non-negotiable: a spec-gap discovered mid-execution **halts for an amendment**; it is never self-authorized in-flight. F-1 is the concrete cost of that shortcut — a self-authorized fix covered the one call site the executor thought of, while the structurally identical second instance shipped as a data-loss bug.

**RA-8 — `folder`/`tags` stay OPTIONAL on `Recipe`/`RecipeSummary`/`RecipeWriteInput`; the compile-time guard is replaced, not restored.** *(new, Amendment 1 — closes F-3)*
**Decision: keep optional.** Binding for this phase; AC-1 is amended so that a required declaration now FAILs rather than passes.

*Survey performed this pass (not estimated):* files containing a `Recipe`-shaped object literal (`styleName:` + `fermentables:` in the same file) number **44**, of which only 6 are on the Authorized Files list; the remainder are ~30 test/fixture files spread across all three workspaces (`apps/api/test`, `apps/web/test`, `packages/calculations/test`) plus `apps/api/src/db/seed.ts`, `packages/calculations/src/brewSheet.ts`, and `apps/web/src/components/RecipeImportModal.tsx`. Tightening `Recipe`/`RecipeSummary` to required is therefore **still a ~30-file sweep across three workspaces** — the original estimate holds, and it has not shrunk because `batches.ts` and `backup.ts` are now in scope. That sweep is out of scope for a corrective amendment whose whole purpose is to shrink blast radius after a FAIL.

*Tightening only `RecipeWriteInput` was considered and rejected.* It would be a smaller sweep (~7 files) and is the exact guard that would have caught F-1 at build time, **but** the API route handlers declare `app.post<{ Body: RecipeWriteInput }>` / `app.put<{ Params; Body: RecipeWriteInput }>` while the wire schema (`recipeWriteBodySchema`) deliberately does **not** list `folder`/`tags` in `required`. Making the TS fields required would make `request.body.folder` type as `string | null` at a boundary where it is genuinely `undefined` for existing clients — trading a silent runtime bug for a type that lies at the trust boundary. Not an improvement.

*Compensating mechanisms (what actually replaces the guard):*
1. **AC-31's enumerated call-site inventory** — the three "construct-from-existing-recipe then full-replace" sites are named explicitly and each must emit both fields:

| Site | Emits `folder`/`tags`? | Covered by |
|---|---|---|
| `apps/api/src/routes/batches.ts` → `toRecipeWriteInput` | **must, per RA-6** — this is F-1 | AC-26, AC-27, AC-28, AC-29 |
| `apps/web/src/hooks/useRecipeEditor.ts` → `toWriteInput` | already does (always emits both, never omits) | AC-17, verified by read |
| `apps/api/src/repositories/recipeRepository.ts` → `duplicateRecipe`'s `const input: RecipeWriteInput` | already does (`source.folder ?? null` / `source.tags ?? []`) | AC-5 |

   Construct-from-external-data sites (`brewfatherImport.ts`, `beerXmlImport.ts`, `RecipeImportModal.tsx`, the `recipes.ts` import route, and all `*RecipeInput` test fixtures) are **exempt by design** — omission there correctly means "unfiled, untagged".
2. **Behavioral tests at the boundary** (AC-27/AC-28/AC-29) rather than type-level enforcement, since the failure mode is a silent write, and a test that would have caught F-1 is worth more than a type that merely would have.

*Deferred, recorded so it does not resurface as a new finding:* tightening `Recipe`/`RecipeSummary`/`RecipeWriteInput` to required, with the accompanying ~30-file fixture sweep and the route-body boundary type it requires, is **deferred and unscheduled** — logged in `.gsd/ROADMAP.md`'s "Deferred / not scheduled" section as of this amendment. A future critic finding the fields optional should read this RA and treat it as **ratified, not as an open gap**.

**RA-9 — Folder datalist/picker is deferred to M38_P3, not dropped.** *(new, Amendment 1 — closes F-4)*
§2.2's "datalist or select-picker of existing folder names" is **not built in this phase**, and §2.2 is corrected above to say so. Reason: the folder control lives in `App.tsx`'s editor view, which holds **no recipe list** — `RecipeLibrary.tsx` owns that state and fetches it itself. Offering existing folder names from the editor requires either a new `listRecipes` fetch in `App.tsx` or a new `GET /api/recipes/folders` endpoint; both are new user-visible surface area and new API scope, which is precisely what a post-FAIL corrective amendment must not accumulate. AC-15's own wording (an input allowing set or clear) is already met by the shipped `<Input aria-label="Folder">`.
Deferred to **M38_P3**, which already reworks the recipe-editor header for style-target gauges and is the natural home; `.gsd/ROADMAP.md`'s M38 P3 line is updated to name it. M38 stays at **3 estimated phases** — this adds to P3's scope, it does not add a phase.
**Accepted user-visible consequence until then:** folder names must be retyped exactly, and a typo silently creates a new folder rather than filing into the intended one.

**RA-10 — An empty-string `folder`/`tag` query param means "no filter", server and client alike.** *(new, Amendment 1 — closes F-6)*
`GET /api/recipes?folder=` currently falls into `filterRecipes`' exact-match branch (guarded only on `!== undefined && !== null`) and returns **zero** recipes, while `RecipeLibrary`'s `filterRecipesLocal` uses a truthiness guard and treats the same input as no filter. The two are documented as mirrors and must not diverge.
**Chosen behavior: the client's.** An empty value is "no filter applied" — a user who lands on `?folder=` (cleared input, stale bookmark, hand-edited URL) means "show me everything", never "show me nothing"; and an empty result set is the least recoverable thing to show them. Binding rule for **both** filters:
- `folder` is applied only when it is a non-empty string. `undefined`, `null`, and `''` all mean "no folder filter". `'__unfiled__'` keeps its RA-1 sentinel meaning (`folder === null`) and is unaffected.
- `tag` follows the identical rule: applied only when a non-empty string.
- Whitespace-only (`'   '`) is **not** special-cased — it is treated as a real filter value and matches nothing, same as any other non-existent folder name. Only the empty string is "no filter".
- `q` is unchanged by this RA.

**RA-11 — Manifest baseline for this corrective pass.** *(new, Amendment 1)*
The pre-manifest is taken from the **current** working tree — i.e. *after* M38_P1's first execution — as the executor's **literal first action, before any edit**, and the post-manifest at the end of the pass; AC-25 is the diff of the two.
Command (both times): `git ls-files -co --exclude-standard -z | xargs -0 sha256sum`, saved to `.gsd/active/manual_verification/M38_P1_amendment_pre_exec_manifest.txt` and `..._post_exec_manifest.txt`.
`git diff --name-only` against a base commit is **explicitly not viable** for this phase and must not be substituted: M38_P1's entire first execution is uncommitted, the tree already carries unrelated modified files (the whole `.gsd/` framework tree, plus the pre-existing M37 amendment work), and — as the critic recorded — a repo-wide CRLF conversion marks roughly 200 otherwise-untouched files dirty. A commit-relative diff cannot distinguish this pass's writes from any of that. The pre/post content manifest is immune to all three, because every pre-existing difference is present in **both** snapshots and cancels out of the diff.

---

## 5. Authorized Files to Modify

**Shared & Database:**
- `packages/shared-types/src/brewing.ts`
- `packages/shared-types/src/api.ts`
- `packages/shared-types/src/backup.ts`
- `packages/calculations/src/brewfatherImport.ts`
- `apps/api/src/db/schema.ts`
- `apps/api/drizzle/` (additive migration file + `_journal.json` + snapshot)
- `apps/api/src/routes/schemas.ts`
- `apps/api/src/repositories/recipeRepository.ts`
- `apps/api/src/routes/recipes.ts`
- `apps/api/src/routes/backup.ts` — **added by Amendment 1 (RA-7, retroactive authorization of the first execution's disclosed edit; no revert)**
- `apps/api/src/routes/batches.ts` — **added by Amendment 1 (RA-6 / F-1 fix; `toRecipeWriteInput` + its `syncToMasterRecipe` call site only)**

**Web Client & UI:**
- `apps/web/src/api/client.ts`
- `apps/web/src/hooks/useRecipeEditor.ts`
- `apps/web/src/components/RecipeLibrary.tsx`
- `apps/web/src/App.tsx`

**Tests:**
- `packages/calculations/test/brewfatherImport.test.ts`
- `apps/api/test/recipes.crud.test.ts`
- `apps/api/test/backup.export.test.ts`
- `apps/api/test/backup.restore.test.ts`
- `apps/web/test/RecipeLibrary.test.tsx`
- `apps/web/test/useRecipeEditor.test.tsx` — **corrected by Amendment 1:** the original list said `.ts`; the real, pre-existing file is `.tsx`. Extend that existing suite; do **not** create a second `.ts` file beside it.
- `apps/web/test/App.test.tsx`
- `apps/web/test/uiPrimitives.test.tsx`
- `apps/api/test/batches.recipeSnapshot.test.ts` — **added by Amendment 1 (AC-27, AC-28, AC-29)**

**Framework Files:**
- `.gsd/STATE.json`
- `.gsd/ROADMAP.md`
- `.gsd/active/manual_verification/M38_P1_amendment_{pre,post}_exec_manifest.txt` — **added by Amendment 1 (RA-11)**

**Explicitly NOT Authorized:**
- Physics calculations (`brewingMath.ts`, `waterOptimization.ts`, `water.ts`, `mash.ts`, etc.)
- Equipment / Schedule / Batch **schemas and repositories** — `batchRepository.ts`, `apps/api/src/routes/schemas.ts`'s batch schemas, and the `recipes` table schema/migration are all closed. `apps/api/src/routes/batches.ts` is authorized **only** for the RA-6 change described in §2.3; no other handler, route, or behavior in that file may be touched.
- `apps/web/src/components/BatchRecipeAdjustModal.tsx` — the client side of the sync flow is **untouched**; the fix is entirely server-side.
- The ~30-file `Recipe`/`RecipeSummary` required-typing fixture sweep (RA-8) — deferred and unscheduled.
- Any new API endpoint (notably `GET /api/recipes/folders`) or new fetch in `App.tsx` for the deferred folder picker (RA-9).

**Untouched-symbol inventory (must be byte-identical after this pass):** `normalizeFolder`, `normalizeTags`, `createRecipe`, `updateRecipe`, `duplicateRecipe`, `listRecipeSummaries`, `getStoredRecipeById`, `patchRecipeName`, `deleteRecipe` in `recipeRepository.ts` — **except** `filterRecipes`, whose folder/tag guard changes per RA-10. `assembleStoredRecipe`, `recipeMapper.ts`, `schema.ts`, and the 0016 migration are all unchanged (AC-25).

**Legacy cleanup / obsolete-artifact check:** none required by this amendment. Specifically, the first execution left **no** obsolete registration loop, legacy alias map, or dead symbol behind — the `0016` migration is registered exactly once in `_journal.json`, `filterRecipesLocal` is a deliberate documented client mirror of `filterRecipes` (RA-10 keeps them in lockstep; do **not** delete or "unify" it into a shared import, which would pull `recipeRepository`'s better-sqlite3 dependency into the web bundle), and the `(Sparge)`-style legacy fallbacks in this territory belong to M37, not here. The in-file comment block above `toRecipeWriteInput` describing the `updateStoredRecipe` naming deviation is **retained** and extended, not deleted.

---

## 6. Halt Gate (State 2)

Review the revised feature specification above. Reply with **`SPEC_APPROVED`** to begin execution.
