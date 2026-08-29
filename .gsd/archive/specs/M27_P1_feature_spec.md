# FEATURE SPECIFICATION: M27_P1 — Batches and Recipes Have Addresses (React Router Adoption + Blocker-Based Dirty-Editor Guard) — Amendment 1

> **Amendment 1 (2026-08-21) is appended at the end of this document (§5).** It corrects three factual errors in this spec's own text — it changes **no** implementation, route topology, blocker predicate, or design decision. Where Amendment 1's §5 text conflicts with the original text below, **Amendment 1 governs**. Inline corrections carrying an "(A1)" marker have been applied in place and are cross-referenced to §5.

## Phase Summary

Milestone 27 replaces `apps/web`'s hand-rolled 11-value `view` `useState` state machine with real URL routes, so a batch, recipe, or profile screen has a bookmarkable, shareable, refresh-safe address and the browser Back/Forward buttons work. It simultaneously rebuilds the dirty-recipe-editor navigation guard on React Router's `useBlocker` data API, surfacing the app's own `ConfirmDialog` (M25_P1) in place of the last remaining `window.confirm()` in the codebase.

### Scoping decision: **ONE phase, not two** (resolving the roadmap's open 1–2 estimate)

`.gsd/ROADMAP.md:371` left the phase count explicitly TBD at `/plan`, hypothesizing a split of "route topology first, guard and edge cases second." **That split is rejected**, on evidence gathered by reading the files rather than estimating from line counts:

1. **The two halves cannot be separated without shipping a BUG-013 regression in between.** Today's guard (`App.tsx:160-166`) works because `navigateGuarded` is the *sole* funnel through which navigation can occur — there is no other way to change screens, since `view` is a private `useState`. The moment routes exist, the browser's Back/Forward buttons and the address bar become navigation paths that do **not** pass through any funnel. A "route topology only" Phase 1 would therefore ship an app where pressing Back from a dirty recipe editor silently discards the user's edits with no prompt — a *new* hole in exactly the guarantee `BUG-013` (`.gsd/BUGS.md:153-169`, status `VERIFIED_RESOLVED` via M13_P1 AC-4..AC-6) exists to protect. `useBlocker` is precisely the mechanism that closes that hole, so it must land in the same phase that opens it.
2. **`BatchDetail.tsx` — the roadmap's "most fragile file" — needs zero changes.** It is 1,315 lines (not the 1,224 the roadmap cites), but its entire coupling to navigation is `BatchDetailProps` at `pages/BatchDetail.tsx:124-133`: a `batchId: string` and three callbacks, consumed at exactly four call sites (`:427` `onBack`, `:564` `onDeleted`, `:585` `onRebrewed`, plus `onOpenMobileNav` passed through to `TopBar` at `:439`, `:449`, `:728`). Feeding `batchId` from `useParams()` and pointing the three callbacks at `navigate()` leaves the file byte-identical. The fragility the roadmap feared is not on this milestone's path.
3. **`Sidebar.tsx` and `MobileNav.tsx` also need (almost) no changes.** Their contract is already `activeView: ActiveView` + `onNavigate(destination)` with all routing *decisions* delegated upward (`components/Sidebar.tsx:78-95`, and `activeDestinationFor` at `:69-74` is already a total pure mapping). Deriving an `ActiveView` from the pathname preserves both prop interfaces exactly, so both components and both of their test suites stay untouched (see §1.4).
4. **`App.tsx`'s 853 lines overstate the work.** Ten of the eleven `view ===` branches (`:373-566`) are the *same* five-line shell — `<div class="h-screen…"><Sidebar/><MobileNav/><div class="flex-1…">{one screen}</div></div>` — repeated verbatim. A layout route with an `<Outlet/>` collapses all ten into one, so this refactor makes `App.tsx` materially *smaller*, not larger.

The genuine weight of this milestone is concentrated in **test-harness adaptation**, not production code — and test adaptation is not a coherent standalone phase. §1.4 and §2.4 bound that work precisely.

### Key Behaviors

1. Every screen has a URL. Pasting `/batches/<id>` or `/recipes/<id>/edit` into a fresh tab lands directly on that record; refreshing any screen redisplays that same screen.
2. Browser Back and Forward move through navigation history correctly, including into and out of batch detail and the recipe editor.
3. Navigating away from a **dirty** recipe editor — by sidebar click, in-app control, **or browser Back/Forward** — raises the app's `ConfirmDialog`. Confirming discards the edit and completes the navigation; cancelling leaves the edit intact **and the URL unchanged**.
4. Navigating between any two non-editor screens, or away from a **clean** editor, never prompts (BUG-013's guarantee, restated in router terms).
5. Zero `window.confirm()` invocations remain anywhere in `apps/web/src`.

---

## Resolved Ambiguities (Binding)

- **RA-1 — Library and version.** `react-router` v7 (`^7`), added to `apps/web/package.json` `dependencies`. It is the roadmap's named choice (`ROADMAP.md:373`) and supports React 19.2 (the version pinned at `apps/web/package.json`). `.gsd/DISCOVERY.md:24` (Answer to Question 2) constrains only *sequencing* — "routing does NOT need to be its own first milestone" — and says nothing about library selection, so it imposes no constraint here. No other routing dependency is added; no `history` package.
- **RA-2 — A data router is mandatory, not a preference.** `useBlocker` is a data-router-only API: it functions under `createBrowserRouter` + `<RouterProvider>` and does **not** function under the legacy `<BrowserRouter>` component. Because Key Behavior 3 is non-negotiable, the executor **must** use `createBrowserRouter`. A `<BrowserRouter>`-based implementation is a spec violation even if every navigation AC passes.
- **RA-3 — `<App />` stays renderable with no props, and creates a fresh router per mount.** `App` continues to be the default export of `App.tsx` and continues to render with zero props, so all 45 `render(<App />)` call sites in `test/App.test.tsx` and the 1 in `test/accessibilityAndPolish.test.tsx:336` remain textually unchanged. The router instance is created **per mount** (e.g. lazily inside the component's initial state) from a module-scope route array — never once at module scope, which would leak router history between tests in the same file.
- **RA-4 — Test URL isolation is achieved by resetting `window.location`, not by `createMemoryRouter`.** jsdom's URL persists across tests in a file. The executor adds `window.history.replaceState({}, '', '/')` to the existing `beforeEach` in `test/App.test.tsx` (currently `:82-120`). Deep-link tests set the URL the same way immediately before `render(<App />)`. `createMemoryRouter`/`MemoryRouter` are **not** introduced; using them would force all 46 render sites to change and would test a different router implementation than production ships.
- **RA-5 — Route topology is screen-level for profiles, record-level for batches and recipes.** Mash, fermentation, water, and equipment profiles have **no per-record screen** to address: their managers render an inline create/edit form driven by local component state (`components/MashProfileManager.tsx:35` `formTarget`, `:36` `deletingId`), not a separate route. Giving a profile record its own URL would require inventing a screen that does not exist, which is new feature work, not routing. Profiles therefore get **screen-level** URLs only. The roadmap's "a profile has a URL" (`ROADMAP.md:369`) is satisfied at that granularity.
- **RA-6 — Trailing-slash and case handling.** Paths are lowercase and declared without trailing slashes. React Router's default matching treats `/batches` and `/batches/` as equivalent; no custom normalization is written. Paths are **case-sensitive** (router default) — `/Batches` does not match and falls to the catch-all.
- **RA-7 — Unknown paths redirect, they do not render an error screen.** A `path: '*'` route renders `<Navigate to="/recipes" replace />`. `replace` (not push) so the bad URL does not occupy a history entry and Back does not return to it. No 404 screen is designed in this phase — that would be new UI, outside the milestone's hardening scope.
- **RA-8 — `/` redirects to `/recipes` with `replace`.** `list` is today's initial `view` (`App.tsx:58`), so `/recipes` is the app's home screen.
- **RA-9 — The blocker predicate is a three-way AND, and the editor-path term is what preserves BUG-013.** The blocker blocks if and only if: (a) `editor.isDirty === true`, **and** (b) the *current* location's pathname is an editor path (`/recipes/new` or `/recipes/:id/edit`), **and** (c) `nextLocation.pathname !== currentLocation.pathname`. Term (b) is the direct router-domain translation of `App.tsx:161`'s `if (view === 'editor')` and is the sole reason BUG-013 cannot regress: a stale `isDirty` on a non-editor screen can never block, because term (b) is false. Term (b) is checked against `currentLocation`, **never** `nextLocation`.
- **RA-10 — Same-path transitions never block.** Term (c) exempts search-param-only or hash-only changes on the same pathname, and self-replacements. Comparison is on `pathname` only; `search` and `hash` are ignored by the predicate.
- **RA-11 — The post-save URL self-replacement is explicitly exempt from blocking.** When a never-saved recipe is saved on `/recipes/new`, `editor.storedId` becomes non-null and the URL is corrected to `/recipes/<storedId>/edit` via `navigate(..., { replace: true })`. In addition to term (a) being false after a successful save (`isDirty === false`), the predicate **must** explicitly exempt a transition whose `nextLocation.pathname` is the editor path for the currently-open `editor.storedId`. Belt and braces: this removes any dependence on the ordering of two state updates within one React commit.
- **RA-12 — Confirm ordering is `closeEditor()` then `proceed()`; cancel is `reset()` alone.** On confirm: call `editor.closeEditor()` **first**, then `blocker.proceed()`. This preserves M13_P1 AC-5's "accepting leaves and resets dirty state" and prevents the blocker from re-arming on the in-flight navigation. On cancel: call `blocker.reset()` and **nothing else** — no `closeEditor`, no `navigate`, no editor mutation, so the edit and the URL are both provably untouched.
- **RA-13 — The dirty-editor `ConfirmDialog` is rendered by the layout, not by the editor screen.** It renders whenever `blocker.state === 'blocked'`. Rendering it inside the editor screen would unmount it mid-transition. Its props are bound in §1.3.
- **RA-14 — `handleRecipeDeleted` (`App.tsx:252-257`) is RETAINED verbatim**, including its `// eslint-disable-next-line` comment and the `void handleRecipeDeleted;` statement at `:257`. Its comment at `:248-250` pins it via M5.5_P4 spec §2.9.6: "not to be deleted as apparent dead code without a spec amendment." This spec grants no such amendment. It looks exactly like dead code that a routing refactor should sweep away — it is not, and removing it is a spec violation.
- **RA-15 — `test/ScopeGuardrail.test.tsx:75-85` MUST be modified, and this is the one sanctioned exception to the roadmap's "tests pass unmodified" threshold.** That test currently asserts `content.match(/window\.confirm\(/g)` has length **exactly 1** in `App.tsx`, under a describe block titled "AC-21: no window.confirm outside App.tsx:144 (M27 deferral is deliberate)". M27 is the milestone that ends the deferral, so the assertion inverts to **zero**, and the block's title/comments update to record that M27 closed it. Leaving this test untouched would make a correct implementation fail Layer 1. No other assertion in `ScopeGuardrail.test.tsx` changes.
  **(A1) Correction:** this RA originally scoped the collateral test rewrites in `test/App.test.tsx` to **four** `vi.spyOn(window, 'confirm')` sites. That count is wrong — there are **five**. See **RA-21 / §5.2** for the fifth site (M5.5_P4's AC-39 delete-recipe-flow test) and why rewriting it is mechanically required rather than discretionary.
- **RA-16 — `window.confirm` sweeps must count invocations, not identifier mentions.** A raw `/window\.confirm/` sweep of `App.tsx` currently returns 2 matches, one of which is prose in the comment at `:156`. Since this phase deletes both the call *and* the comment block that mentions it, the post-condition is zero on either pattern — but AC-19's assertion is written against `/window\.confirm\(/` to match the existing convention documented at `ScopeGuardrail.test.tsx:76-83`.
- **RA-17 — No Vite or server configuration change is required, and none may be made.** Verified, not assumed: `apps/web/vite.config.ts` declares no `appType`, so Vite's default `appType: 'spa'` history fallback applies to `vite dev` and `vite preview`, making deep links resolve. `apps/api` does **not** serve the built frontend — a sweep of `apps/api/src/` for `express.static`/`sendFile`/`dist` returns only unrelated prose matches — so no API fallback route is needed. The existing `/api` proxy (`vite.config.ts:9-14`) cannot collide with any route in §1.1, none of which begin with `api`.
- **RA-18 — `Sidebar.tsx` receives exactly one change: `type ActiveView` becomes `export type ActiveView`** (`components/Sidebar.tsx:55`). Every other byte of that file, including `activeDestinationFor` (`:69-74`), `NAV_ITEMS`, `NAV_ICONS`, and `SidebarProps`, is unchanged. If oxlint's `react/only-export-components` flags the added type export, the fix is to add the same `// oxlint-disable-next-line react/only-export-components` comment already used at `:28`, `:42`, and `:68` — **not** to move the type to another file or restructure the module.
- **RA-19 — Scope-guardrail verification uses a SHA-256 content manifest, not `git diff`.** Checked, not presumed: this repo has exactly **1** commit (`7d88e64`), and `apps/web/src/App.tsx` does not exist in it (`git cat-file -e HEAD:apps/web/src/App.tsx` fails). There is no meaningful base commit to diff against, so `git diff --name-only` cannot express AC-22. See AC-22 for the manifest procedure.

---

## 1. Data Schema & Contracts

### 1.1 Route Topology (new module: `apps/web/src/routes/paths.ts`)

| Path | Screen component | Replaces `view` value |
|------|------------------|------------------------|
| `/` | `<Navigate to="/recipes" replace />` | — (RA-8) |
| `/recipes` | `RecipeLibrary` | `'list'` |
| `/recipes/new` | recipe editor, new-recipe mode | `'editor'` (via `handleNew`) |
| `/recipes/:recipeId/edit` | recipe editor, loaded-recipe mode | `'editor'` (via `handleOpen`) |
| `/batches` | `BatchList` | `'batches'` |
| `/batches/:batchId` | `BatchDetail` | `'batchDetail'` + `activeBatchId` |
| `/equipment` | `EquipmentManager` | `'equipment'` |
| `/profiles/mash` | `MashProfileManager` | `'mashProfiles'` |
| `/profiles/fermentation` | `FermentationProfileManager` | `'fermentationProfiles'` |
| `/profiles/water` | `WaterProfileManager` | `'waterProfiles'` |
| `/inventory` | `InventoryManager` | `'inventory'` |
| `/settings` | `SettingsManager` | `'settings'` |
| `/calculators` | `Calculators` | `'calculators'` |
| `*` | `<Navigate to="/recipes" replace />` | — (RA-7) |

All thirteen screen paths sit as children of a single **layout route** that renders the app shell (`<Sidebar/>`, `<MobileNav/>`, and the `flex-1 flex flex-col h-full overflow-hidden min-w-0` wrapper currently duplicated verbatim at `App.tsx:378`, `:423`, `:444`, `:465`, `:485`, `:507`, `:519`, `:531`, `:543`, `:555`, `:580`) around an `<Outlet/>`.

### 1.2 Exported Constants & Pure Functions (`apps/web/src/routes/paths.ts`)

```ts
import type { NavDestination, ActiveView } from '../components/Sidebar';

/** Literal path constants for every static (non-parameterized) route. */
export const ROUTE_PATHS: {
  readonly root: '/';
  readonly recipes: '/recipes';
  readonly recipeNew: '/recipes/new';
  readonly batches: '/batches';
  readonly equipment: '/equipment';
  readonly mashProfiles: '/profiles/mash';
  readonly fermentationProfiles: '/profiles/fermentation';
  readonly waterProfiles: '/profiles/water';
  readonly inventory: '/inventory';
  readonly settings: '/settings';
  readonly calculators: '/calculators';
};

/** Total over all 9 NavDestination values. Never returns undefined. */
export function pathForDestination(destination: NavDestination): string;

/** Path builder for a saved recipe's editor screen. */
export function editorPathForRecipe(recipeId: string): string; // `/recipes/${recipeId}/edit`

/** Path builder for a batch's detail screen. */
export function batchDetailPath(batchId: string): string;       // `/batches/${batchId}`

/**
 * Total inverse mapping: pathname -> the ActiveView string that Sidebar and
 * MobileNav already accept. Unknown pathnames return 'list' (RA-7 alignment).
 */
export function viewForPath(pathname: string): ActiveView;

/** True iff the pathname is `/recipes/new` or `/recipes/:id/edit`. RA-9 term (b). */
export function isEditorPath(pathname: string): boolean;
```

### 1.3 Dirty-Editor `ConfirmDialog` Binding

Rendered by the layout route (RA-13) when `blocker.state === 'blocked'`. Reuses the existing `ConfirmDialogProps` (`components/ConfirmDialog.tsx:4-14`) unchanged — **no new props are added to that component**:

| Prop | Bound value |
|------|-------------|
| `open` | `blocker.state === 'blocked'` |
| `title` | `'Discard unsaved changes?'` |
| `message` | `'You have unsaved changes to this recipe. Leaving now will discard them.'` |
| `confirmLabel` | `'Discard changes'` (overrides the `'Delete'` default at `ConfirmDialog.tsx:39`) |
| `busy` | omitted (no async work on either branch) |
| `onConfirm` | `editor.closeEditor()` then `blocker.proceed()` (RA-12) |
| `onCancel` | `blocker.reset()` only (RA-12) |

### 1.4 Modified vs. Untouched Files

**Modified (5 source + 4 test + 1 manifest = 10 files) — count and membership corrected by Amendment 1 (RA-20); see §5.1. (The critic's F8 finding: the original amendment text miscounted this header as "7 source + 4 test + 2 manifest = 13" — pure arithmetic against the table below, which has always had 10 rows; membership, which AC-22 actually tests, was correct throughout.)**

| File | Change |
|------|--------|
| `apps/web/package.json` | Add `react-router` `^7` to `dependencies` (RA-1). No other dependency change. |
| `package-lock.json` (repo root) | **(A1)** Regenerated by npm as the unavoidable mechanical consequence of RA-1's sanctioned `react-router` dependency add. Carries no hand-authored change. It was omitted from this table in the original spec — an oversight, not a scope boundary. See §5.1 / RA-20. |
| `apps/web/src/main.tsx` | 10 lines today; renders `<App />` inside `<StrictMode>` at `:6-10`. Unchanged in shape — `App` keeps owning the router (RA-3). Only touched if the executor needs an import adjustment; a byte-identical outcome is acceptable and preferred. |
| `apps/web/src/App.tsx` | The bulk of the phase. Delete `type View` (`:44-55`), `view`/`setView` (`:58`), `activeBatchId`/`setActiveBatchId` (`:74`), the editor-redirect effect (`:139-143`), `confirmLeaveEditorIfDirty` (`:145-148`), `navigateGuarded` (`:160-166`), the nine `goTo*` helpers (`:168-179`), `handleNavigate`'s if/else chain (`:181-201`), `handleViewBatch` (`:203-206`), and the ten duplicated shell wrappers across `:373-566`. Add the route tree, the layout route, per-screen route components, and the `useBlocker` guard. |
| `apps/web/src/routes/paths.ts` | **New file.** §1.2. Pure, no React imports beyond types. |
| `apps/web/src/components/Sidebar.tsx` | Exactly one change: `export` added to `type ActiveView` at `:55` (RA-18). |
| `apps/web/test/App.test.tsx` | 1,495 lines. Add URL reset to `beforeEach` (RA-4). Rewrite the **five** (**(A1)** — corrected from "four"; see RA-21 / §5.2) `vi.spyOn(window, 'confirm')`-driven sites to drive `ConfirmDialog` via its existing `data-testid` hooks (`confirm-dialog`, `confirm-dialog-cancel`, `confirm-dialog-confirm`, `ConfirmDialog.tsx:18/25/34`): the four originally named (`:497`, `:514`, `:542`, `:627`) **plus** the M5.5_P4 AC-39 delete-recipe-flow test (`.gsd/archive/specs/M5.5_P4_feature_spec.md:328`), whose `spy records ≥ 1` clause is mechanically unsatisfiable once AC-21 holds. Add the new routing suites. Every `render(<App />)` site stays textually unchanged (RA-3). |
| `apps/web/test/setup.ts` | **(A1)** Moved here from the Untouched table. Add a test-environment `Request` shim so `createBrowserRouter`'s internal navigation can construct a `Request` under jsdom. **Mandatory, not optional** — see RA-20 / §5.1 for the mechanism and the critic's revert experiment (74 of 92 `App.test.tsx` tests fail without it). |
| `apps/web/test/ScopeGuardrail.test.tsx` | The AC-21 block only (`:52-86`): App.tsx `window.confirm(` count `1` → `0`, plus title/comment update (RA-15). Nothing else in the file changes. |
| `apps/web/test/accessibilityAndPolish.test.tsx` | May need only the same `beforeEach` URL reset as RA-4 if its single `render(<App />)` at `:336` proves order-dependent. **No assertion in this file may change.** |

**Untouched — asserted, each verified by reading the file:**

| File | Why it stays untouched |
|------|------------------------|
| `apps/web/src/pages/BatchDetail.tsx` (1,315 lines) | Props at `:124-133` already isolate it from routing; `batchId` comes from `useParams` in the route component, the three callbacks from `navigate`. Zero internal changes. This is the milestone's single most important scope boundary. |
| `apps/web/src/components/MobileNav.tsx` (100 lines) | Consumes the same `activeView`/`onNavigate` contract; both preserved by `viewForPath`. |
| `apps/web/src/pages/BatchList.tsx` (96 lines) | `onViewBatch: (id: string) => void` (`:17`), called at `:81`. Contract preserved. |
| `apps/web/src/components/RecipeLibrary.tsx` (267 lines) | `RecipeLibraryProps` (`:12-20`) — `onOpen`/`onNew`/`onOpenError`/`canCreate`/`notices` all preserved. |
| `apps/web/src/components/ConfirmDialog.tsx` (46 lines) | Reused exactly as-is via existing props (§1.3). |
| `apps/web/src/components/Modal.tsx`, `TopBar.tsx`, `PageContainer.tsx`, `designSystem.ts` | Not on this milestone's path. |
| `apps/web/src/hooks/useRecipeEditor.ts` (315 lines) | `isDirty`, `storedId`, `recipe`, `loadRecipe`, `startNewRecipe`, `closeEditor`, `save` are all consumed as they exist. No hook signature change. |
| `apps/web/vite.config.ts`, `apps/web/vitest.config.ts` | RA-17. Both remain untouched. ~~`apps/web/test/setup.ts`~~ **(A1)** — struck from this row and moved to the Modified table. The original justification ("jsdom + existing setup need no routing additions") was **factually wrong** once RA-2 mandates a data router; see RA-20 / §5.1. |
| All of `apps/api/**`, `packages/shared-types/**`, `packages/calculations/**` | This is a frontend-only routing change. Zero API surface change. |
| The other 53 files under `apps/web/test/` | Component suites that never mount `<App />`. |

---

## 2. Transformations & Pure Logic

### 2.1 Pure Function Contracts

`pathForDestination` and `viewForPath` are **mutually consistent total mappings**: for every one of the 9 `NavDestination` values `d`, `activeDestinationFor(viewForPath(pathForDestination(d))) === d`. This round-trip is directly asserted (AC-3) rather than assumed, because it is the invariant that keeps the sidebar's active-item highlight correct after the refactor.

`viewForPath` is total: every possible string input returns a valid `ActiveView`. It has **no** "no match" sentinel and never returns `null` or `undefined` — an unmatched pathname returns `'list'`, matching RA-7's redirect target so the highlight is already correct while the redirect commits.

`isEditorPath` returns `true` only for `/recipes/new` and paths matching `/recipes/:id/edit` with a non-empty `:id`. It returns `false` for `/recipes`, `/recipes/` and — importantly — for `/recipes/abc` (a bare recipe path that matches no route).

### 2.2 Stateful Integration Contract — the blocker

Evaluation order inside the predicate, short-circuiting on the first `false`:

1. `editor.isDirty === true` — else return `false`.
2. `isEditorPath(currentLocation.pathname) === true` — else return `false` (**BUG-013 term, RA-9**).
3. `nextLocation.pathname !== currentLocation.pathname` — else return `false` (RA-10).
4. `nextLocation.pathname !== editorPathForRecipe(editor.storedId)` when `editor.storedId !== null` — else return `false` (**post-save self-replacement, RA-11**).
5. Otherwise return `true` → dialog renders.

### 2.3 Editor Route Lifecycle

- **`/recipes/new`**: while `equipmentProfiles` has not yet resolved, render nothing (the existing `App.tsx:569-574` early-return-null precedent). Once resolved: if `equipmentProfiles.length === 0`, `navigate('/recipes', { replace: true })` — preserving `handleNew`'s current no-op-with-zero-profiles rule (`App.tsx:237`); otherwise, if `editor.recipe === null`, call `editor.startNewRecipe(equipmentProfiles[0])`.
- **`/recipes/:recipeId/edit`**: if `editor.storedId !== recipeId`, call `editor.loadRecipe(recipeId)`. On rejection, set the existing `libraryError` state and `navigate('/recipes', { replace: true })` — the same error surface `handleOpen`/`onOpenError` feeds today (`App.tsx:381`).
- **Post-save correction (RA-11)**: on `/recipes/new`, once `editor.storedId` becomes non-null, `navigate(editorPathForRecipe(editor.storedId), { replace: true })`. `replace`, so Back does not return to `/recipes/new`.
- **Brew This** (`App.tsx:215-230`): on success, `navigate(batchDetailPath(created.id))` (push). Failure path unchanged — no navigation, server message surfaced via `brewThisError`.
- **Delete recipe** (`App.tsx:259-274`): `editor.closeEditor()` **then** `navigate('/recipes')`, so the blocker cannot fire on a recipe the user just deleted. **(A1)** The `closeEditor()` call **must** be wrapped in `flushSync` for this ordering to actually hold under React 19's concurrent scheduler — see **RA-22 / §5.3**. `flushSync` is the sanctioned mechanism implementing this bullet, not a deviation from it.

### 2.4 Refactoring & Legacy Cleanup (explicit purge list)

Every one of these must be **gone** from `App.tsx` at the end of the phase — each is a live symbol today whose survival would indicate an incomplete refactor:

- `type View` union (`:44-55`) — superseded by `ActiveView` from `Sidebar.tsx` + the route table.
- `view`, `setView` (`:58`) and all 23 `setView(...)` / `view ===` references.
- `activeBatchId`, `setActiveBatchId` (`:74`) — superseded by `useParams`.
- The `view === 'editor' && editor.recipe === null` redirect effect (`:139-143`) — superseded by §2.3's route lifecycle.
- `confirmLeaveEditorIfDirty` (`:145-148`) — the last `window.confirm()`.
- `navigateGuarded` (`:160-166`) and its 10-line M13_P1 comment block (`:150-159`), which explicitly documents a mechanism that no longer exists. A comment describing a deleted funnel is worse than no comment; it must be replaced by one describing the blocker predicate and citing BUG-013 + RA-9.
- The nine `goTo*` const helpers (`:168-179`).
- `handleNavigate`'s nine-branch if/else chain (`:181-201`) — collapses to `navigate(pathForDestination(destination))`.
- `handleViewBatch` (`:203-206`) — collapses to `navigate(batchDetailPath(id))`.
- Nine of the ten duplicated shell wrapper `<div>`/`<Sidebar>`/`<MobileNav>` triples (`:373-566`) — absorbed into the layout route.

**Explicitly NOT purged (RA-14):** `handleRecipeDeleted` (`:252-257`), its comment (`:248-250`), its `eslint-disable` line (`:251`), and `void handleRecipeDeleted;` (`:257`).

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | `ROUTE_PATHS` exports the 11 static path literals of §1.2 | Unit | Each key equals its exact literal string; `ROUTE_PATHS.mashProfiles === '/profiles/mash'` etc. |
| AC-2 | `pathForDestination` is total over `NavDestination` | Unit | Iterating all 9 values of `NAV_ITEMS` yields a non-empty string starting with `/` for each; no `undefined` |
| AC-3 | Round-trip invariant (§2.1) | Unit | For all 9 destinations `d`: `activeDestinationFor(viewForPath(pathForDestination(d))) === d` |
| AC-4 | `viewForPath` is total with a `'list'` fallback | Unit | `viewForPath('/nonsense')`, `viewForPath('')`, `viewForPath('/')` each `=== 'list'`; never `undefined`/`null` |
| AC-5 | `viewForPath` resolves parameterized paths | Unit | `viewForPath('/batches/b-1') === 'batchDetail'`; `viewForPath('/recipes/r-1/edit') === 'editor'`; `viewForPath('/recipes/new') === 'editor'` |
| AC-6 | `isEditorPath` exact boundaries | Unit | `true` for `/recipes/new` and `/recipes/r-1/edit`; **`false`** for `/recipes`, `/recipes/`, `/recipes/r-1`, `/batches/b-1`, `''` |
| AC-7 | Case sensitivity (RA-6) | Unit | `viewForPath('/Batches') === 'list'` (falls to fallback), while `viewForPath('/batches') === 'batches'` |
| AC-8 | Deep link to a batch lands on that record | Integration | `window.history.replaceState({}, '', '/batches/b-1')` then `render(<App />)` → `getBatch` called with `'b-1'`, and the batch's name renders in the sole `<h1>` |
| AC-9 | Deep link to a saved recipe's editor | Integration | URL `/recipes/r-saved-1/edit` then `render(<App />)` → `getRecipe('r-saved-1')` called; "Brew This" control present |
| AC-10 | Sidebar navigation changes the URL | Integration | Clicking each of the 9 `NAV_ITEMS` from `/recipes` sets `window.location.pathname` to `pathForDestination(d)` and renders that screen. **(A1)** The shipped test loop must iterate **all 9** destinations, not a 3-destination sample — the expected outcome always said 9; only the test's coverage was narrower. The critic widened the loop during the audit and confirmed all 9 pass, so this is a test-breadth correction with no behavioral risk (§5.4) |
| AC-11 | Back returns to the previous screen | Integration | `/recipes` → click Batches → `history.back()` → pathname is `/recipes` and Recipe Library renders |
| AC-12 | Forward re-enters the screen | Integration | After AC-11's back, `history.forward()` → pathname `/batches`, BatchList renders |
| AC-13 | Unknown path redirects with `replace` (RA-7) | Integration | URL `/no-such-page` → renders Recipe Library, pathname becomes `/recipes`, and `history.back()` does **not** return to `/no-such-page` |
| AC-14 | `/` redirects to `/recipes` (RA-8) | Integration | `render(<App />)` at `/` → pathname `/recipes` |
| AC-15 | Dirty editor + sidebar click raises `ConfirmDialog`, not `window.confirm` | Integration | `confirm-dialog` testid present; a `vi.spyOn(window, 'confirm')` installed for the assertion is **never called** |
| AC-16 | Cancelling leaves edit intact **and URL unchanged** | Integration | Click `confirm-dialog-cancel` → pathname still the editor path, the dirtied field retains its edited value, `editor` still dirty |
| AC-17 | Confirming discards and completes navigation | Integration | Click `confirm-dialog-confirm` → pathname is the requested destination, and returning to the editor shows the recipe's *saved* values (dirty state reset per RA-12) |
| AC-18 | **Browser Back from a dirty editor is blocked too** | Integration | From a dirty `/recipes/r-saved-1/edit`, `history.back()` → `confirm-dialog` appears and pathname is still the editor path. *(This is the case a route-topology-only phase would have regressed — see Phase Summary.)* |
| AC-19 | BUG-013 preserved: no phantom prompts | Integration | Dirty the editor, confirm-leave to Equipment, then navigate Equipment→Recipes and Batches→Settings: `confirm-dialog` never appears and `window.confirm` is never called on any transition |
| AC-20 | Clean editor never prompts | Integration | Open a saved recipe, make **no** edit, click Batches → navigates immediately, no `confirm-dialog` |
| AC-21 | Zero `window.confirm` in `apps/web/src` | Source sweep | Recursive sweep of `apps/web/src/**/*.{ts,tsx}` for `/window\.confirm\(/` yields **0** matches (RA-16); `ScopeGuardrail.test.tsx`'s App.tsx assertion updated to `0` per RA-15 |
| AC-22 | **Scope guardrail** | Verification | **`git diff --name-only` is NOT viable here** — the repo has 1 commit and `apps/web/src/App.tsx` is absent from it (RA-19). Instead: capture `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum` **before the first edit** and again at the end; the diff of the two manifests must list **only** the **10** files named as Modified in §1.4 (**(A1)** — corrected from 9 (11 minus the manifest header's original miscount); `apps/web/test/setup.ts` and `package-lock.json` are now on that list per RA-20/§5.1. A manifest diff listing 9–10 of them is conforming, since `main.tsx` may legitimately end byte-identical). In particular the hashes of `pages/BatchDetail.tsx`, `components/MobileNav.tsx`, `pages/BatchList.tsx`, `components/RecipeLibrary.tsx`, `components/ConfirmDialog.tsx`, `components/Modal.tsx`, `hooks/useRecipeEditor.ts`, `vite.config.ts`, `vitest.config.ts`, and every file under `apps/api/` and `packages/` must be **unchanged** |
| AC-23 | `Sidebar.tsx` changed by exactly one token (RA-18) | Verification | `Sidebar.tsx` differs from its pre-phase content only by the added `export` on `type ActiveView`; `Sidebar.test.tsx` and `MobileNav.test.tsx` are hash-identical and pass unmodified |
| AC-24 | Legacy purge complete (§2.4) | Source sweep | `App.tsx` contains zero occurrences of `setView`, `activeBatchId`, `navigateGuarded`, `confirmLeaveEditorIfDirty`, and no `type View =` declaration |
| AC-25 | `handleRecipeDeleted` retained (RA-14) | Source sweep | `App.tsx` still contains `handleRecipeDeleted` and `void handleRecipeDeleted;` |
| AC-26 | Data router used, not `<BrowserRouter>` (RA-2) | Source sweep | `apps/web/src` contains `createBrowserRouter` and `RouterProvider`, and **zero** occurrences of `<BrowserRouter` or `MemoryRouter` |
| AC-27 | The 46 `render(<App />)` sites are unchanged (RA-3) | Verification | `test/App.test.tsx` still contains 45 `render(<App />)` occurrences and `accessibilityAndPolish.test.tsx:336` still contains 1; none rewritten to take props or a router wrapper |
| AC-28 | Prior-milestone suites still green | Regression | **(A1)** Every pre-existing test in `App.test.tsx` passes with its assertions unmodified, **except the five `window.confirm`-spy-driven tests enumerated in §1.4 / RA-21** — the four originally named (`:497`, `:514`, `:542`, `:627`) and M5.5_P4's AC-39 delete-recipe-flow test, all five of which are re-expressed in `ConfirmDialog` terms without weakening any behavioral clause. Note that M5.5_P4's **AC-37** test keeps its `window.confirm` spy and its `not.toHaveBeenCalled()` assertion **verbatim** — it stays satisfiable under AC-21 and must not be rewritten. Otherwise unchanged — notably AC-13 (`:280`), AC-14 (`:309`), AC-15 (`:362`), AC-16 collapse-survives-navigation (`:388`), AC-17 (`:414`), AC-18 (`:440`) |
| AC-29 | Four Layer 1 gates (HARD_RULES rule 13) | Verification | `npm test` (workspaces), `npm run typecheck`, `npm run build`, `npm run lint` each exit 0; total test count is **≥ 1,912** (the M26_P1 baseline) — monotonic, never reduced |
| AC-30 | Manual verification evidence | Manual + screenshot | In the running app: (a) paste `/batches/<id>` into a fresh tab → that batch; (b) refresh on `/profiles/mash` → still Mash Profiles; (c) Back/Forward across three screens; (d) dirty a recipe, click a sidebar item, screenshot the `ConfirmDialog`, cancel, screenshot the intact edit + unchanged URL. Saved to `.gsd/active/manual_verification/` per `ROADMAP.md:376`. **(A1) STATUS: OUTSTANDING — not satisfied, not waived.** See RA-23 / §5.5 |

---

## 4. Follow-ups logged, not built

- **Per-record profile URLs** (RA-5) — would require designing a profile detail screen that does not exist today. Not a routing task; log to `.gsd/FEATURES.md` if wanted.
- **A real 404 screen** (RA-7) — this phase redirects instead. New UI, outside the milestone's hardening scope.
- **Production static-hosting history fallback** (RA-17) — no such deployment exists in this repo today; revisit when one does.

---

## 5. Amendment 1 (2026-08-21) — Documentation of Reality, No Design Change

**Trigger.** The `SPEC_APPROVED` build of M27_P1 shipped, passed Layer 1 clean (1,936 passed / 2 skipped; typecheck, build, lint all exit 0), and was then audited by an independent `critic` (`.gsd/archive/CRITIC_REPORT.md`, entry dated 2026-08-21, "M27_P1 — Batches and Recipes Have Addresses"). The audit returned **FAIL** — and simultaneously found **no defect in the implementation**. Every substantive AC's behavior was confirmed correct by direct source trace, independent source sweeps, independent re-verification of the pre/post SHA-256 manifests, and four executed mutation/revert experiments. A BUG-013 mutation spot-check (inverting RA-9 term (b) from `currentLocation` to `nextLocation`) failed 8 tests including three pre-existing BUG-013 tests, proving the blocker predicate is genuinely load-bearing and genuinely covered.

The FAIL was rooted entirely in **three narrow gaps in this spec's own text**: AC-22 and AC-28 were PARTIAL against their *literal wording* while their *protective purpose* held perfectly, and AC-30 is outstanding. `/diagnose` classified this at the **spec layer** and routed to `/plan`.

**Scope of this amendment — binding.** Amendment 1 changes **only this document**. It authorizes **zero** code changes, and it re-opens **nothing** about the implementation: the route topology (§1.1), the pure-function contracts (§1.2, §2.1), the blocker predicate and its four terms (RA-9 through RA-12, §2.2), the editor route lifecycle (§2.3), the legacy purge list (§2.4), and every RA and AC not explicitly named below all stand **exactly as originally approved and as built**. Anyone reading this amendment as license to revisit a design decision is reading it wrong.

### 5.1 — RA-20: `apps/web/test/setup.ts` is a MODIFIED file, and this is a consequence of RA-2, not scope creep

**RA-20 (binding).** `apps/web/test/setup.ts` must be modified to add a test-environment `Request` shim, and §1.4's original placement of it in the Untouched table — justified by the claim *"jsdom + existing setup need no routing additions"* — is **withdrawn as factually incorrect**.

*Mechanism, stated precisely:* `createBrowserRouter`'s internal navigation path constructs a `Request` (react-router's `createClientSideRequest`, called from `startNavigation`) and passes it an `AbortController.signal`. Under Vitest's jsdom environment, that `AbortController` is jsdom's, while `Request` resolves to Node's native (undici) implementation — whose brand check rejects a foreign `AbortSignal`. The two are structurally incompatible, and the failure is thrown from inside react-router itself, not from application code.

*Evidence, by experiment rather than argument:* the critic reconstructed a reverted `setup.ts` (shim removed, `cleanup()` registration retained) and ran `App.test.tsx` against it under a throwaway scratch vitest config. Result: **74 of 92 tests failed**, every one with `TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal`, stack `new Request (undici) ← createClientSideRequest ← startNavigation ← Object.navigate ← react-router`. The scratch file was removed and `setup.ts`'s hash confirmed unchanged throughout.

*Why no in-scope alternative existed:* the shim must execute before every test file that mounts `<App />`. That leaves `setup.ts`, or `vitest.config.ts` (also pinned Untouched), or an import injected into `accessibilityAndPolish.test.tsx` (whose §1.4 entry permits only the `beforeEach` URL reset). **The original spec left no legal landing spot for a fix that RA-2's data-router mandate makes unavoidable.** Once `useBlocker` is required (Key Behavior 3) and therefore `createBrowserRouter` is required (RA-2), touching this file is entailed by the spec, not a departure from it.

**`package-lock.json`** is likewise added to the Modified table. It is regenerated mechanically by npm from RA-1's already-sanctioned `react-router` dependency add; §1.4 named `apps/web/package.json` but never enumerated the lockfile it necessarily updates. AC-22's file count moves from 9 to **10** (matching §1.4's table, which has always had 10 rows — see §5.6's F8 correction of an arithmetic slip in an earlier draft of this section).

*Recorded, not fixed here (critic finding F1, advisory):* the shipped shim strips `signal` from **every** `Request` in the test environment, unconditionally and without asserting that the signal was the incompatible jsdom kind. This masks nothing today — `apps/web/src` contains zero occurrences of `AbortSignal`, `AbortController`, `.signal`, or `new Request(`, and no route in `ROUTES` declares a `loader` or `action`, so the signal is never consumed. It is a **latent** hazard: a future milestone adding route loaders, request cancellation, or fetch timeouts would find abort-dependent tests passing while production behavior goes unexercised. **Log to `.gsd/BUGS.md` as a test-harness hazard; narrowing the shim is explicitly out of scope for this amendment.**

### 5.2 — RA-21: there are FIVE `window.confirm` spy sites in `test/App.test.tsx`, not four

**RA-21 (binding).** RA-15 and §1.4 named four `vi.spyOn(window, 'confirm')` sites (`:497`, `:514`, `:542`, `:627`) as the complete set requiring rewrite. That enumeration was **incomplete**. A **fifth** site exists: the delete-recipe-flow test defined as **AC-39** by `.gsd/archive/specs/M5.5_P4_feature_spec.md:328`.

*Why rewriting it is mechanically required, not discretionary:* M5.5_P4's AC-39 reads — *"a `window.confirm` spy records **zero** calls across AC-32/AC-37's flows, while `App.tsx`'s `confirmLeaveEditorIfDirty` still calls it (**spy records ≥ 1**) when navigating away from a dirty editor by the back arrow."* That `≥ 1` clause is **unsatisfiable by construction** the moment this phase's **AC-21** requires zero `window.confirm` calls anywhere in `apps/web/src`. The two assertions are in direct logical contradiction; AC-21 is the whole point of the milestone (Key Behavior 5) and stands unchanged, so AC-39's spy assertion is what must be re-expressed. Rewriting it in `ConfirmDialog` testid terms (`confirm-dialog`, `confirm-dialog-cancel`, `confirm-dialog-confirm`) is the only way to keep the test meaningful.

*Fidelity constraint (binding):* the rewrite preserves **every behavioral clause** of the original — a rejected delete keeps the editor open, surfaces the error, and the dirty-editor guard still fires on a subsequent navigation — and adds assertions rather than removing any. The critic confirmed the rewritten test is not vacuous: it **failed** under the BUG-013 mutation experiment, alongside the pre-existing BUG-013 tests.

*Boundary (binding, and the reason this is a correction rather than a blanket exemption):* M5.5_P4's **AC-37** test (`App.test.tsx:895`) also carries a `window.confirm` spy, with a `not.toHaveBeenCalled()` assertion. That assertion **remains satisfiable** under AC-21 and is preserved **verbatim**. The distinction is exact: a spy asserting *zero* calls survives AC-21 untouched; only a spy asserting *at least one* call is contradicted by it. AC-28's wording is corrected accordingly, so it no longer implies only four tests are exempt from "assertions unmodified."

### 5.3 — RA-22: `flushSync` is the sanctioned mechanism for §2.3's "closeEditor() then navigate" ordering

**RA-22 (binding).** In `handleDeleteRecipe`, `editor.closeEditor()` is wrapped in `flushSync` before `navigate('/recipes')` is called. This **implements** §2.3's delete-recipe bullet; it does not deviate from it.

*Mechanism:* `useBlocker`'s predicate closure is captured from the **last completed render**. A synchronous `navigate()` issued immediately after a non-flushed `setState` therefore evaluates against a **stale** `isDirty: true`, and spuriously blocks navigation away from a recipe the user just deleted. §2.3 already mandates the ordering *"`closeEditor()` **then** `navigate('/recipes')`, so the blocker cannot fire on a recipe the user just deleted"* — under React 19's concurrent scheduler, `flushSync` is what makes that mandate actually hold rather than merely appear to.

*Evidence:* the critic removed the wrapper, leaving a bare `editor.closeEditor(); navigate(…)`. Result: **M5.5_P4's AC-37 test fails** at `waitFor(() => screen.getByText('Saved Test Recipe'))` — a **pre-existing test with unmodified assertions**, which is the strongest available evidence that `flushSync` fixes a real bug rather than accommodating a test written to fit. Reverted and hash-verified.

*Scope limit:* `flushSync` is sanctioned at **this one call site only**. It is not a general license to flush state updates elsewhere in `App.tsx`; the blocker's other interactions (RA-12's confirm/cancel handlers) are unchanged and require no flush.

### 5.4 — AC-10 test breadth: 3 of 9 destinations exercised, must be 9

Not a deviation and not a design change — a coverage gap between AC-10's stated expected outcome ("each of the 9 `NAV_ITEMS`") and the shipped test, which loops over only **3**. The critic widened the loop to all 9 in a scratch edit and re-ran: **all 9 set the correct pathname and render**, so the behavior is verified and the residual risk is negligible (`handleNavigate` is a single generic `navigate(pathForDestination(d))` code path, and AC-2/AC-3 already cover all 9 mappings at the unit level). AC-10's row is annotated so the shipped loop is broadened and the next regression pass covers all 9 **without a critic in the loop**.

*Advisory findings deliberately NOT acted on (recorded for the record):* critic findings **F5** (`Sidebar.tsx` gained the `export` keyword plus the RA-18-sanctioned `oxlint-disable` comment and one prose comment matching the file's own house style at `:28`/`:42`/`:68`) and **F6** (`App.test.tsx` holds 53 `render(<App />)` sites rather than the 45 AC-27's literal count names — the increase being entirely the spec-sanctioned new routing suites, with **every** site textually `render(<App />)` and `App` still a zero-prop default export). Both were assessed as immaterial by the critic, both satisfy their AC's actual intent, and neither RA-18/AC-23 nor AC-27 is amended.

### 5.5 — RA-23: AC-30 manual verification is OUTSTANDING — neither satisfied nor waived

**RA-23 (binding).** AC-30's manual verification evidence **was never captured**. No live browser was available during execution, and `.gsd/active/manual_verification/` **does not exist**. None of AC-30's four evidence items (a) deep-link to `/batches/<id>` in a fresh tab, (b) refresh on `/profiles/mash`, (c) Back/Forward across three screens, (d) dirty a recipe → screenshot the `ConfirmDialog` → cancel → screenshot the intact edit and unchanged URL — have been produced.

This amendment **does not** mark AC-30 satisfied, and **does not** drop the requirement. AC-30 stands as written. It resolves in exactly one of two ways, both requiring a human:

1. **Capture it** — a human runs the dev server, performs (a) through (d), and saves the screenshot evidence to `.gsd/active/manual_verification/` per `ROADMAP.md:376`; or
2. **Waive or defer it explicitly** — the user makes a recorded decision at `/steer` to waive AC-30 for this phase or defer the evidence to the milestone's close, logged in `.gsd/archive/STEERING_LOG.md` with the reason.

Note that M27's roadmap **verification threshold** names this evidence directly ("verified in the running app with screenshot evidence in `.gsd/active/manual_verification/`, not tests alone"), so option 2 is a deliberate relaxation of the milestone's own stated bar and should be recorded as such rather than assumed. **`/steer` must not present a checkpoint over AC-30 without resolving it one way or the other on the record.**

### 5.6 — What a Layer 2 re-audit should find

No code is expected to change under this amendment except the AC-10 test-loop broadening (§5.4), which is a test-breadth change with behavior already proven. A re-audit against this amended spec should find:

- **AC-22 → YES.** The manifest diff's two previously-unlisted files (`apps/web/test/setup.ts`, `package-lock.json`) are now enumerated in §1.4's Modified table; the count is 10 (§1.4's table row count — an earlier draft of this section miscounted the header as 13; see §5.6's F8 correction). Every pinned-unchanged file — `pages/BatchDetail.tsx`, `components/MobileNav.tsx`, `pages/BatchList.tsx`, `components/RecipeLibrary.tsx`, `components/ConfirmDialog.tsx`, `components/Modal.tsx`, `hooks/useRecipeEditor.ts`, `vite.config.ts`, `vitest.config.ts`, and all of `apps/api/**` + `packages/**` — remains byte-identical, as already independently confirmed.
- **AC-28 → YES.** Five sanctioned rewrite sites, M5.5_P4 AC-37 preserved verbatim.
- **AC-10 → YES** with the shipped loop covering all 9 destinations.
- **AC-30 → resolved per RA-23**, by captured evidence or by a recorded waiver/deferral. It is the only AC whose closure this amendment cannot itself effect.

### 5.7 — Post-PASS cleanup (F1, F8) — lightweight-task fixes, no ceremony

The Layer 2 re-audit against this amendment returned **PASS** (`.gsd/archive/CRITIC_REPORT.md`, second M27_P1 re-audit entry, dated 2026-08-21), with two non-blocking advisory findings. Both are closed here, directly, as `.gsd/HARD_RULES.md` rule 7 lightweight-task edits — self-contained, no new user-visible capability, no spec/execute/verify/steer ceremony:

- **F1 — the `setup.ts` `Request`/`AbortSignal` shim hazard (§5.1, RA-20) was recorded but never logged.** Logged as `.gsd/BUGS.md` **BUG-025** (`DEFERRED_TO_MILESTONE`): the shim strips `signal` unconditionally rather than only from the incompatible jsdom kind, which is inert today (zero `loader`/`action`/abort usage in `apps/web/src`) but would silently mask abort-dependent test coverage if a future milestone adds either.
- **F8 — this section's own §1.4 header miscounted the Modified-file table as "7 source + 4 test + 2 manifest = 13."** The table has always had 10 rows (5 source, 4 test, 1 manifest); membership — what AC-22 actually verifies — was correct throughout, only the header arithmetic and the two AC-22 cross-references were wrong. Corrected in place at §1.4's header, AC-22's row, §5.1's closing sentence, and §5.6's first bullet above.

---
> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
