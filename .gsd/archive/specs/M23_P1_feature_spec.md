# FEATURE SPECIFICATION: M23_P1 — Nothing in this app is second-class anymore

## Phase Summary

Milestone 23 is the first slice of the Experience Redesign initiative and bundles the UX audit's six "quick win" items into **one** vertical slice (per `.gsd/DISCOVERY.md` answer 4 — the user explicitly declined to take these under the lightweight-task exception so that a single moment exists where the claim "nothing here is visibly second-class" becomes true and is verifiable as a whole).

This is a **single-phase milestone**. The six fix clusters share one acceptance surface (accessibility + visual parity asserted together), touch disjoint files, and carry no ordering dependency between them; splitting a11y-semantics from visual-parity — the split `/plan` was authorized to consider — would produce two matrices that both have to be re-run against the same eight dialogs, for no diagnostic benefit.

**User-visible outcome:** Every dialog in the app declares itself a dialog to assistive technology and wears the same palette as the rest of the product. Every icon-only control in the recipe Misc table, the reading log, and the note log says what it does. Deleting a note or a reading asks in the app's own voice through `ConfirmDialog` instead of a raw browser `window.confirm()` box. The batch list, while loading or after a failed load, shows the icon + message + Retry treatment its sibling list screens already use, instead of bare unstyled text. Two dead components stop shipping.

### Key Behaviors

1. `RecipeImportModal.tsx` and `WaterCalculatorModal.tsx` — the two dialogs predating the design-token system — declare `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at their own title element, and move off their off-palette colors onto the app standard.
2. Every interactive control in `MiscSection.tsx`, `ReadingLog.tsx`, and `BatchNoteLog.tsx` resolves to a non-empty accessible name.
3. `BatchNoteLog.tsx` and `ReadingLog.tsx` delete flows route through the existing `ConfirmDialog` component. `App.tsx:144`'s `confirmLeaveEditorIfDirty` is **untouched** (deferred to Milestone 27).
4. `BatchList.tsx`'s loading and error states are rebuilt onto the sibling-screen pattern, and the error state gains a working **Retry** that re-issues the load.
5. `BatchStepper.tsx`, `BatchStepper.test.tsx`, `CarbonationPanel.tsx`, `CarbonationPanel.test.tsx` are deleted — four files, source and test together.
6. The six other dialogs in the app do not regress: they keep the dialog semantics they already have.

### Resolved Ambiguities (Binding)

These resolutions are binding on the executor. Where a resolution departs from a literal reading of `.gsd/ROADMAP.md`'s Milestone 23 text, the reason is stated; the roadmap's **verification threshold** governs, because that is the gate the critic audits against.

- **RA-1 — There are eight dialogs, not seven.** The roadmap's threshold says "all seven, including `App.tsx:761`'s inline scale modal." A source sweep of `apps/web/src` finds **six** containers already carrying `role="dialog"` (`App.tsx:761`, `BatchRecipeAdjustModal.tsx:71`, `ConfirmDialog.tsx:21`, `PostBrewCalibrationModal.tsx:90`, `PresetPickerModal.tsx:115`, `RefractometerFermentationModal.tsx:66`) plus the **two** this phase adds = **eight**. The roadmap's count was one short (it did not count `RefractometerFermentationModal.tsx`, which `ReadingLog.tsx:316` renders). The AC matrix enumerates all eight by file and line. The threshold's intent — *every* dialog reports dialog semantics — is met at eight, not seven.
- **RA-2 — `aria-labelledby` is required only on the two in-scope modals.** `BatchRecipeAdjustModal.tsx`, `ConfirmDialog.tsx`, and `PresetPickerModal.tsx` today declare `role="dialog"` + `aria-modal="true"` but **no** `aria-labelledby`. Adding it to those three is **explicitly out of scope** for this phase — they are already on the token system, they are not "second-class," and they are migrated onto the shared `Modal` wrapper in Milestone 25 where labelling is handled once. This phase must not modify them. "Correct dialog semantics" for the six non-in-scope dialogs means **`role="dialog"` + `aria-modal="true"` still present** (a no-regression assertion), not newly-added labelling.
- **RA-3 — Select backgrounds are corrected alongside input backgrounds.** The brief names only `WaterCalculatorModal.tsx`'s `INPUT_CLASS` (`bg-slate-950` → `bg-slate-800`). Both modals *also* carry a local select class-string on `bg-slate-950` (`WaterCalculatorModal.tsx:22` `SELECT_CLASS`, `RecipeImportModal.tsx:11` `FORM_SELECT_CLASS`). Both are corrected to `bg-slate-800` in this phase. Rationale: the app standard for a form control surface is `bg-slate-800` (`designSystem.ts:41` `FORM_SELECT_CLASS`), and leaving a `bg-slate-950` select sitting beside a corrected `bg-slate-800` input **inside the same modal** would leave exactly the visible drift this milestone's outcome statement claims to remove. This is a value correction in place, not a token extraction — hoisting these local constants into `designSystem.ts` is Milestone 24's job and is **out of scope here**.
- **RA-4 — Every interactive control in the three named components gets an accessible name, not only the controls the brief enumerates.** The brief names `MiscSection.tsx`'s remove button and the four icon buttons each in `BatchNoteLog.tsx`/`ReadingLog.tsx`. The roadmap's threshold is broader: "every interactive control in the three named components resolves to an accessible name." A full audit of the three files finds **seven** unlabelled controls in `MiscSection.tsx` (not one). The threshold governs; §2.2 enumerates all of them exhaustively. Controls that already resolve to a name via visible text or an existing `aria-label`/`htmlFor` are listed as untouched in §1.2 so the executor does not churn them.
- **RA-5 — `title` attributes are retained, not replaced.** Where a control already carries `title`, the `title` stays and `aria-label` is **added**. `aria-label` wins the accessible-name computation, so the computed name is the `aria-label` value; `title` continues to serve as the hover tooltip. Removing `title` is out of scope and would be a regression in pointer affordance.
- **RA-6 — `aria-label` values on per-row controls are row-scoped and interpolated.** Per-row controls in `MiscSection.tsx` interpolate `item.name` so that a table of N miscs yields N distinct accessible names (a test can then target one row unambiguously). Controls in `BatchNoteLog.tsx`/`ReadingLog.tsx` use fixed strings — those components already carry per-row `data-testid`s (`note-edit-${id}`, `reading-delete-${id}`, …) for row targeting, so name uniqueness is not needed there and fixed strings read better to a screen reader.
- **RA-7 — The confirm dialog closes on rejection as well as fulfilment.** When `onDelete` rejects, `pendingDelete` is set back to `null` (the dialog closes) and the row stays on screen. Rationale: the parent (`BatchDetail.tsx:1183` `reading-error`, `:1197` `note-error`) renders the failure banner *behind* the dialog overlay; leaving the dialog open would hide the only feedback the user gets. This preserves the components' existing documented discipline — a rejected promise leaves the row on screen and the parent owns the error message — while relocating the confirmation. `busy` is bound to the in-flight flag so both dialog buttons disable during the request, matching the `MashProfileForm.tsx:220-229` and `BatchDetail.tsx:773-781` call-site precedent.
- **RA-8 — Cancel must never invoke the delete callback.** `onCancel` sets `pendingDelete` to `null` and does nothing else. `onDelete` is called **zero** times on a cancelled flow. This is the property the outgoing `window.confirm() === false` branch guaranteed and is asserted explicitly (AC-14, AC-18).
- **RA-9 — `ConfirmDialog` renders `null` when closed** (`ConfirmDialog.tsx:16`), so no dialog DOM and no second `role="dialog"` node leaks into `BatchNoteLog`/`ReadingLog` in their resting state. Assertions that count dialogs in these components must hold at zero when no delete is pending (AC-15, AC-19).
- **RA-10 — `designSystem.ts` is not modified.** `apps/web/test/designSystem.test.ts` pins all 17 token strings by exact equality and asserts the module exports no functions/components/hooks. No token *string* changes in this phase and no new exports are added to that module. `BatchList.tsx` **consumes** `LOADING_STATE_CLASS` and `ERROR_STATE_CLASS` as they already exist.
- **RA-11 — No conflicting Tailwind utilities are appended to a token string.** `ERROR_STATE_CLASS` already carries `px-4 py-3`. The `BatchList` error container composes it as `` `${ERROR_STATE_CLASS} flex items-start gap-3` `` — layout utilities only, **no** second padding/background/border/text-color utility. Class-attribute order does not determine Tailwind precedence (CSS source order does), so appending a conflicting `py-4` would produce an unpredictable result rather than an override.
- **RA-12 — `BatchList`'s public prop signature is unchanged.** Retry is internal state, not a new prop. `BatchList` keeps exactly `{ onViewBatch: (id: string) => void }`; `App.tsx`'s call site is untouched.
- **RA-13 — `BatchList`'s empty state is untouched.** It already uses `EMPTY_STATE_CLASS` correctly. Only the loading and error branches are rebuilt.
- **RA-14 — Loading is `batches === null && error === null`.** The existing component keys "loading" off `!batches`, which after a failed load is still true — but the error branch early-returns first, so the bug is latent rather than live. The rebuilt `load()` sets `batches` to `null` and `error` to `null` at entry, and the render branches in the order **error → loading → empty → list**, making the states mutually exclusive by construction rather than by early-return ordering.
- **RA-15 — Retry is idempotent under repeat clicks.** Clicking Retry calls `load()` again unconditionally. No in-flight guard is required or added; the last resolution wins. Out of scope: request cancellation / stale-response guarding (no such pattern exists anywhere in the app today, and adding one here would be unmatched drift).
- **RA-16 — `App.tsx` is not modified by this phase at all.** Not for the scale modal (already correct, `test/accessibilityAndPolish.test.tsx:207-214` asserts textually on it), not for `confirmLeaveEditorIfDirty` at line 144, not for the `BatchList` call site. `App.tsx` appears in the §3 Scope Guardrail's untouched list.
- **RA-17 — Deleting the two dead components is a four-file deletion.** `BatchStepper.test.tsx` (23 tests) and `CarbonationPanel.test.tsx` (7 tests) currently pass; deleting only the sources would break the suite. Verified zero imports from any other `src/` file — the only occurrences of either identifier outside their own test files are self-references inside the component files themselves.
- **RA-18 — The scope guardrail uses a SHA-256 content manifest, not `git diff`.** This repo has **exactly one commit**, and `apps/web/` **does not exist in `HEAD` at all** (`git ls-tree -r --name-only HEAD | grep -c apps/web` → `0`). Every file this phase touches is already untracked-or-added relative to any base commit, so `git diff --name-only <base>` cannot distinguish "the executor changed this" from "this was never committed." AC-25 therefore specifies a pre/post content-manifest diff. See §3, AC-25 for the exact commands.

---

## 1. Data Schema & Contracts

### 1.1 Exported Constants & Types

**No new module-level exports are created in this phase, and no existing exported symbol changes its type.**

Consumed (unchanged, imported by `BatchList.tsx`):

| Symbol | Module | Value (frozen — pinned by `designSystem.test.ts`) |
|---|---|---|
| `LOADING_STATE_CLASS` | `src/components/designSystem.ts:61` | `=== EMPTY_STATE_CLASS` → `'bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400'` |
| `ERROR_STATE_CLASS` | `src/components/designSystem.ts:62` | `'bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 text-sm text-rose-200'` |
| `EMPTY_STATE_CLASS` | `src/components/designSystem.ts:59` | already imported by `BatchList.tsx:7` — unchanged |

Consumed (unchanged, imported by `BatchNoteLog.tsx` and `ReadingLog.tsx`):

```ts
// src/components/ConfirmDialog.tsx — EXISTING, NOT MODIFIED
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;   // defaults to 'Delete'
  busy?: boolean;          // disables both buttons while true
  onConfirm: () => void;   // NOTE: returns void, not Promise<void>
  onCancel: () => void;
}
export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element | null;
```

Its test hooks, relied on by this phase's tests: `data-testid="confirm-dialog"`, `"confirm-dialog-confirm"`, `"confirm-dialog-cancel"`.

### 1.2 Symbol Inventory

**Local class-string constants — value changed in place (NOT hoisted; hoisting is M24):**

| File:line | Constant | Current value (exact) | Required value (exact) |
|---|---|---|---|
| `RecipeImportModal.tsx:9` | `BUTTON_PRIMARY_CLASS` | `'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow transition-colors cursor-pointer disabled:opacity-50'` | `'bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl shadow transition-colors cursor-pointer disabled:opacity-50'` |
| `RecipeImportModal.tsx:11` | `FORM_SELECT_CLASS` | `'bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer'` | same with `bg-slate-950` → `bg-slate-800` (RA-3) |
| `WaterCalculatorModal.tsx:19` | `BUTTON_PRIMARY_CLASS` | `'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl shadow transition-colors cursor-pointer'` | `'bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl shadow transition-colors cursor-pointer'` |
| `WaterCalculatorModal.tsx:21` | `INPUT_CLASS` | `'bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500'` | same with `bg-slate-950` → `bg-slate-800` |
| `WaterCalculatorModal.tsx:22` | `SELECT_CLASS` | `'bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer w-full'` | same with `bg-slate-950` → `bg-slate-800` (RA-3) |

The app-standard primary-button triplet `bg-amber-600 hover:bg-amber-500 text-white` is the already-dominant convention — see `BatchNoteLog.tsx:102`, `ReadingLog.tsx:309`, `MashProfileManager.tsx:92`.

**Local class-string constants — explicitly NOT changed:** `MODAL_BACKDROP_CLASS` and `MODAL_CONTAINER_CLASS` in both modals; `BUTTON_SECONDARY_CLASS` in both modals (already `bg-slate-800`-based, on palette); `INPUT_CLASS` in `ReadingLog.tsx:25` (already `bg-slate-800`, on palette).

**Inline off-palette classes — changed (RecipeImportModal error banner, line 248):**

`'p-3 bg-red-950/80 border-b border-red-800 text-red-300 text-xs flex items-center gap-2'`
→ `'p-3 bg-rose-950/80 border-b border-rose-800 text-rose-300 text-xs flex items-center gap-2'`

This is the **only** `red-*` occurrence in either modal. After this change, zero `red-` Tailwind classes remain in `RecipeImportModal.tsx` or `WaterCalculatorModal.tsx` (AC-6).

**New DOM `id` attributes (new, previously absent):**

| File | Element | `id` to add | Referenced by |
|---|---|---|---|
| `RecipeImportModal.tsx:201` | `<h3>Import External Recipes</h3>` | `recipe-import-modal-title` | `aria-labelledby` on the container at line 193 |
| `WaterCalculatorModal.tsx:333` | `<h3>Water Chemistry &amp; Acid Adjustments</h3>` | `water-calculator-modal-title` | `aria-labelledby` on the container at line 325 |

`role`/`aria-modal`/`aria-labelledby` go on the **inner** `MODAL_CONTAINER_CLASS` div (line 193 / line 325), **not** the backdrop — matching the dominant existing precedent (`RecipeImportModal`-shaped nesting is the same shape as `PresetPickerModal.tsx:113-118` and `BatchRecipeAdjustModal.tsx:69-75`). The `data-testid` already on those divs (`recipe-import-modal`, `water-calc-modal`) is retained.

**New React state (component-local):**

| File | State | Type | Initial |
|---|---|---|---|
| `BatchNoteLog.tsx` | `pendingDeleteNote` | `BatchNote \| null` | `null` |
| `ReadingLog.tsx` | `pendingDeleteReading` | `Reading \| null` | `null` |

**Files deleted (4):** `src/components/BatchStepper.tsx`, `test/BatchStepper.test.tsx`, `src/components/CarbonationPanel.tsx`, `test/CarbonationPanel.test.tsx`.

**Public component prop interfaces — ALL UNCHANGED:** `RecipeImportModalProps`, `WaterCalculatorModalProps`, `MiscSectionProps`, `BatchNoteLogProps`, `ReadingLogProps`, `ConfirmDialogProps`, and `BatchList`'s inline `{ onViewBatch }`. No call site of any of these components changes.

**Controls in the three named components that ALREADY resolve to an accessible name — do not touch:**

- `MiscSection.tsx:175` "Add Misc" button (visible text).
- `BatchNoteLog.tsx:98` "Add Note" (text), `:122` textarea (`aria-label="Note"`), `:180` textarea (`aria-label="New note"`), `:188` "Save" (text), `:191` "Cancel" (text).
- `ReadingLog.tsx:293` "Refractometer Tool" (text), `:305` "Log Reading" (text), all six `ReadingFormFields` inputs (wrapped by `Field`'s `<label htmlFor>`, lines 101-159), `:411` "Save" (text), `:414` "Cancel" (text).

---

## 2. Transformations & Pure Logic

### 2.1 Dialog semantics (pure markup contract)

For each of the two in-scope modals, the container element carries exactly these three attributes in addition to what it already has:

```
role="dialog"
aria-modal="true"
aria-labelledby="<the id of that modal's own <h3> title element>"
```

The `aria-labelledby` target must be the modal's **own** title, and that `id` must be unique within the rendered document. No shared/global id, no `aria-label` used as a substitute (the roadmap threshold and the `App.tsx` scale-modal precedent both specify `aria-labelledby` pointing at a title element).

The close (`X`) icon button in both modals (`RecipeImportModal.tsx:208`, `WaterCalculatorModal.tsx:376`) currently has **no** accessible name. It is **out of scope** for the accessible-name AC (which the roadmap scopes to the three named components), but the executor **may** add `aria-label="Close"` to both. If added, it is not asserted; if not added, no AC fails. This is the one discretionary item in the spec and is called out so the critic does not read it either way as a defect.

### 2.2 Accessible-name contract (exhaustive)

Every control below gains an `aria-label`. Existing `title` attributes are retained (RA-5). Values are exact.

**`MiscSection.tsx` — seven controls (RA-4):**

| Line | Control | `aria-label` |
|---|---|---|
| 81 | per-row Use `<select>` | `` `Use for ${item.name}` `` |
| 94 | per-row Time `<input type="number">` | `` `Time in minutes for ${item.name}` `` |
| 103 | per-row Amount `<input type="number">` | `` `Amount of ${item.name}` `` |
| 114 | per-row Remove `<button>` (has `title="Remove misc"`) | `` `Remove ${item.name}` `` |
| 138 | add-form catalog `<select>` | `Misc to add from catalog` |
| 152 | add-form Use `<select>` | `Use for new misc` |
| 165 | add-form Amount `<input>` | `Amount for new misc` |

**`BatchNoteLog.tsx` — four controls:**

| Line | Control | Existing | `aria-label` |
|---|---|---|---|
| 129 | edit-mode Save (submit) | `title="Save"` | `Save note` |
| 132 | edit-mode Cancel | `title="Cancel"` | `Cancel editing note` |
| 151 | row Edit | `title="Edit"` | `Edit note` |
| 160 | row Delete | `title="Delete"` | `Delete note` |

**`ReadingLog.tsx` — four controls (this file has zero `aria-label`s on buttons today):**

| Line | Control | Existing | `aria-label` |
|---|---|---|---|
| 360 | edit-mode Save (submit) | `title="Save"` | `Save reading` |
| 363 | edit-mode Cancel | `title="Cancel"` | `Cancel editing reading` |
| 380 | row Edit | `title="Edit"` | `Edit reading` |
| 389 | row Delete | `title="Delete"` | `Delete reading` |

### 2.3 Stateful integration contract — `window.confirm()` → `ConfirmDialog`

The outgoing shape in both files is a single async handler that blocks on `window.confirm` (`BatchNoteLog.tsx:79-89`, `ReadingLog.tsx:275-286`). It splits into a **synchronous request step** and an **async confirm step**.

**`BatchNoteLog.tsx`:**

```
requestDelete(n: BatchNote): void
  → setPendingDeleteNote(n)
  → performs NO async work, calls onDelete ZERO times

confirmDelete(): Promise<void>
  → if (pendingDeleteNote === null) return          // guard
  → setBusy(true)
  → try   { await onDelete(pendingDeleteNote.id) }
    catch { /* parent already recorded noteError; row stays on screen */ }
    finally { setBusy(false); setPendingDeleteNote(null) }   // RA-7: closes on BOTH paths

cancelDelete(): void
  → setPendingDeleteNote(null)
  → calls onDelete ZERO times                       // RA-8
```

Row delete button at line 160: `onClick={() => requestDelete(n)}` (was `onClick={() => handleDelete(n)}`). `data-testid={`note-delete-${n.id}`}` retained.

Dialog element, rendered as a sibling inside the component's root `<div>`:

```
<ConfirmDialog
  open={pendingDeleteNote !== null}
  busy={busy}
  title="Delete this note?"
  message="This cannot be undone."
  confirmLabel="Delete"
  onConfirm={() => { void confirmDelete(); }}
  onCancel={cancelDelete}
/>
```

The `void`-wrapped call is required because `ConfirmDialogProps.onConfirm` is typed `() => void`, not `() => Promise<void>` — this matches `MashProfileForm.tsx:225-227`. Copy is the outgoing `'Delete this note? This cannot be undone.'` split at the sentence boundary into `title` / `message`.

**`ReadingLog.tsx`:** structurally identical with `pendingDeleteReading: Reading | null`, `onDelete(pendingDeleteReading.id)`, `title="Delete this reading?"`, `message="This cannot be undone."`, row button at line 389 → `onClick={() => requestDelete(r)}`, `data-testid={`reading-delete-${r.id}`}` retained.

`ReadingLog.tsx` already renders `RefractometerFermentationModal` at line 316; the `ConfirmDialog` is placed as an additional sibling. Its own `parseError` state, the `toWriteInput` throw path, and all three existing `catch {}` blocks are **untouched**.

**Lockstep property:** `busy` is the single existing flag in both components and is already shared with the edit-mode Save button (`disabled={busy}`). Binding `ConfirmDialog`'s `busy` to it means an in-flight delete disables the edit-form Save button and both dialog buttons **in lockstep**, from one source of truth. No second busy flag is introduced (AC-16, AC-20).

### 2.4 Stateful integration contract — `BatchList.tsx` loading/error rebuild

```
load(): Promise<void>          // useCallback, stable identity, empty dep array
  → setError(null)
  → setBatches(null)                                    // RA-14: re-enters the loading state
  → try   { setBatches(await listBatches()) }
    catch { setError(err instanceof ApiClientError ? err.message : 'Failed to load batches.') }

useEffect(() => { void load(); }, [load])
```

The `ApiClientError` narrowing and the `'Failed to load batches.'` fallback string are carried over **verbatim** from line 16 — the existing tests at `test/BatchList.test.tsx:33-40` and `:124-135` assert on the propagated client message, and must keep passing unchanged.

Render order is **error → loading → empty → list**, mutually exclusive (RA-14). `TopBar title="Brewing Batches"` and a single `PageContainer` wrap **every** branch — `test/BatchList.test.tsx:124-135` (M5.5_P3 AC-30) asserts exactly one `page-container` and one `<h1>` in the error state, and this must not regress.

**Error branch** (`data-testid="batch-list-error"`), modelled on `MashProfileManager.tsx:98-112` / `RecipeLibrary.tsx:192-207`, composed onto the token per RA-11:

- container: `` className={`${ERROR_STATE_CLASS} flex items-start gap-3`} ``
- `<AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />` (`lucide-react`)
- `<div className="flex-1">` containing `<div className="font-semibold text-rose-300">Couldn't load your batches</div>` and `<div className="text-rose-200/90">{error}</div>`
- Retry `<button type="button" data-testid="batch-list-retry" onClick={() => { void load(); }} className="flex items-center gap-1.5 text-xs font-semibold bg-rose-900/60 hover:bg-rose-900 border border-rose-700 rounded px-3 py-1.5 transition-colors cursor-pointer">` containing `<RotateCw className="w-3.5 h-3.5" /> Retry`

**Loading branch** (`data-testid="batch-list-loading"`), modelled on `SettingsManager.tsx:272-277`:

- container: `className={LOADING_STATE_CLASS}`
- `<Beaker className="w-8 h-8 mx-auto mb-3 text-slate-600 animate-pulse" />` (`lucide-react` — `Beaker` is the icon the sibling empty states use, `MashProfileManager.tsx:116`, `RecipeLibrary.tsx:213`)
- text `Loading batches…` (U+2026 horizontal ellipsis, matching `BatchDetail.tsx:453` `'Loading batch…'` and `SettingsManager.tsx:275`)

The bare `<div className="text-center py-12">Loading...</div>` (line 35, ASCII three-dot) and `<div className="text-rose-500">Error: {error}</div>` (line 24) are **removed**; neither literal survives anywhere in the file.

### 2.5 Refactoring & Legacy Cleanup

Purge these obsolete paths — leaving any of them behind is a phase failure, not a cosmetic leftover:

1. **`BatchNoteLog.tsx:79-89` `handleDelete`** — the `window.confirm`-gated async handler is fully replaced by the three functions in §2.3. No orphaned `handleDelete` remains.
2. **`ReadingLog.tsx:275-286` `handleDelete`** — same.
3. **`test/BatchNoteLog.test.tsx:93-105`** — the `const originalConfirm = window.confirm; window.confirm = () => true;` save/restore stub is **deleted**. The test is rewritten to click `note-delete-note-1`, then click `confirm-dialog-confirm`. No `window.confirm` reference remains anywhere in this file.
4. **`test/ReadingLog.test.tsx:137-148`** — the "delete asks for confirmation and calls onDelete only when confirmed" test is rewritten against `ConfirmDialog`. Its existing two-phase shape (assert `onDelete` not called, then confirm, then assert called) is **preserved** — only the confirmation mechanism changes. No `window.confirm` reference remains anywhere in this file.
5. **`BatchList.tsx:19-28`** — the error **early-return** block is removed; the error state renders through the single unified return described in §2.4. Exactly one `return` statement remains in the component.
6. **`BatchList.tsx:13-17`** — the inline `useEffect` body is replaced by the `useCallback` + `void load()` pattern. No orphaned inline `.then(setBatches).catch(...)` chain remains.
7. **Four-file deletion (RA-17).** `git`-tracked or not, all four files are removed from disk. No `import` of `BatchStepper`, `stepStates`, `TRANSITION_LABEL`, or `CarbonationPanel` remains anywhere in `apps/web/src` or `apps/web/test`. **Do not** leave a re-export shim or a stub file.
8. **No new `designSystem.ts` exports and no token-string edits** (RA-10). If the executor finds itself editing `designSystem.test.ts`, that is a signal it has strayed out of scope — stop and re-read RA-10.

---

## 3. Acceptance Criteria & Test Matrix

Tests live in `apps/web/test/`. Where an existing suite covers the file, extend it rather than creating a parallel one; `MiscSection.tsx`, `WaterCalculatorModal.tsx` have no dedicated suite today — new suites `MiscSection.test.tsx` and `WaterCalculatorModal.test.tsx` are created for their ACs.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | `RecipeImportModal` dialog semantics | Unit (RTL) | Rendered with `isOpen`, `getByRole('dialog')` returns exactly one node; it has `aria-modal="true"`; `toHaveAccessibleName('Import External Recipes')`; its `aria-labelledby` equals the `id` of the rendered `<h3>` |
| AC-2 | `WaterCalculatorModal` dialog semantics | Unit (RTL) | Same three assertions; accessible name `'Water Chemistry & Acid Adjustments'`; `aria-labelledby` resolves to that modal's own `<h3>` id |
| AC-3 | Closed modals expose no dialog | Unit (RTL) | With `isOpen={false}`, `queryAllByRole('dialog')` has length `0` for both modals — the new attributes do not leak into the closed state |
| AC-4 | All eight dialogs declare `role="dialog"` + `aria-modal="true"` (RA-1) | Source sweep | For each of `App.tsx`, `BatchRecipeAdjustModal.tsx`, `ConfirmDialog.tsx`, `PostBrewCalibrationModal.tsx`, `PresetPickerModal.tsx`, `RefractometerFermentationModal.tsx`, `RecipeImportModal.tsx`, `WaterCalculatorModal.tsx`: source contains both `role="dialog"` and `aria-modal="true"`. Asserted per-file via `it.each`, so a failure names the file |
| AC-5 | Off-palette buttons corrected | Source sweep | `RecipeImportModal.tsx` and `WaterCalculatorModal.tsx` each contain zero occurrences of `bg-amber-500 hover:bg-amber-400` and zero of `text-slate-950`; each contains `bg-amber-600 hover:bg-amber-500 text-white`. (`bg-amber-500/10`, `accent-amber-500`, `focus:border-amber-500` are legitimate and must survive — the assertion targets the exact button substrings, not a bare `amber-500` grep) |
| AC-6 | `red-*` → `rose-*` | Source sweep | `RecipeImportModal.tsx` matched against `/\bbg-red-|\bborder-red-|\btext-red-/g` yields `0`; it contains `bg-rose-950/80`, `border-rose-800`, `text-rose-300`. Same zero-match assertion for `WaterCalculatorModal.tsx` |
| AC-7 | Form-control backgrounds on standard (RA-3) | Source sweep | `WaterCalculatorModal.tsx` contains zero occurrences of `bg-slate-950` in its `INPUT_CLASS`/`SELECT_CLASS` declarations and both declare `bg-slate-800`; `RecipeImportModal.tsx`'s `FORM_SELECT_CLASS` declares `bg-slate-800`. (`bg-slate-950/40`, `bg-slate-950/60`, `bg-slate-950/80` panel/backdrop surfaces are **not** form controls and are deliberately untouched) |
| AC-8 | `MiscSection` — every control named (RA-4) | Unit (RTL) | Rendered with two miscs (`'Irish Moss'`, `'Gypsum'`): all seven §2.2 controls resolve. Specifically `getByLabelText('Remove Irish Moss')`, `getByLabelText('Use for Gypsum')`, `getByLabelText('Amount of Irish Moss')`, `getByLabelText('Time in minutes for Gypsum')`, `getByLabelText('Misc to add from catalog')`, `getByLabelText('Use for new misc')`, `getByLabelText('Amount for new misc')` each return exactly one element |
| AC-9 | `MiscSection` — zero unnamed controls, generically | Unit (RTL) | Every element from `getAllByRole('button')`, `getAllByRole('combobox')`, and `getAllByRole('spinbutton')` in the rendered output has a non-empty computed accessible name. Asserted as a loop over the union, so a control added later without a label fails this AC |
| AC-10 | `MiscSection` — per-row names are distinct (RA-6) | Unit (RTL) | With two miscs, the four per-row accessible names are unique across rows; `getAllByLabelText(/^Remove /)` has length `2` |
| AC-11 | `BatchNoteLog` — icon buttons named | Unit (RTL) | With one note: `getByLabelText('Edit note')` and `getByLabelText('Delete note')` resolve. After clicking edit: `getByLabelText('Save note')` and `getByLabelText('Cancel editing note')` resolve |
| AC-12 | `ReadingLog` — icon buttons named | Unit (RTL) | With one reading: `getByLabelText('Edit reading')` and `getByLabelText('Delete reading')` resolve. After clicking edit: `getByLabelText('Save reading')` and `getByLabelText('Cancel editing reading')` resolve |
| AC-13 | `title` retained alongside `aria-label` (RA-5) | Unit (RTL) | `getByLabelText('Delete note')` has attribute `title="Delete"`; `getByLabelText('Delete reading')` has `title="Delete"`; `getByLabelText(/^Remove /)` has `title="Remove misc"` |
| AC-14 | `BatchNoteLog` delete — confirm path & cancel path (RA-8) | Integration (RTL) | Click `note-delete-note-1` → `onDelete` **not** called, `confirm-dialog` present. Click `confirm-dialog-cancel` → `onDelete` called **0** times, dialog gone. Click delete again, click `confirm-dialog-confirm` → `onDelete` called exactly once with `'note-1'` |
| AC-15 | `BatchNoteLog` resting state has no dialog (RA-9) | Unit (RTL) | Before any delete click, `queryByTestId('confirm-dialog')` is `null` and `queryAllByRole('dialog')` has length `0` |
| AC-16 | `BatchNoteLog` busy lockstep (RA-7) | Integration (RTL) | With an `onDelete` returning a manually-resolved deferred promise: after confirming, `confirm-dialog-confirm` and `confirm-dialog-cancel` are both `disabled`. After resolving, dialog is gone and `onDelete` was called once |
| AC-17 | `BatchNoteLog` rejected delete closes the dialog, keeps the row (RA-7) | Integration (RTL) | `onDelete` rejects → `queryByTestId('confirm-dialog')` becomes `null`, `note-row-note-1` is still in the document, and no unhandled rejection is raised |
| AC-18 | `ReadingLog` delete — confirm path & cancel path (RA-8) | Integration (RTL) | Same shape as AC-14 against `reading-delete-r1` / `onDelete('r1')`; preserves the existing test's two-phase assertion |
| AC-19 | `ReadingLog` resting state has no dialog (RA-9) | Unit (RTL) | Before any delete click, `queryByTestId('confirm-dialog')` is `null`. `RefractometerFermentationModal` closed ⇒ `queryAllByRole('dialog')` has length `0` |
| AC-20 | `ReadingLog` rejected delete closes the dialog, keeps the row (RA-7) | Integration (RTL) | `onDelete` rejects → dialog gone, `reading-row-r1` still present, `parseError` banner **not** rendered (the local parse-error path is unrelated and must not be triggered) |
| AC-21 | No `window.confirm` outside `App.tsx:144` | Source sweep | `BatchNoteLog.tsx`, `ReadingLog.tsx`, `test/BatchNoteLog.test.tsx`, `test/ReadingLog.test.tsx` each match `/window\.confirm/g` **0** times. `App.tsx` matches exactly **1** time (the `confirmLeaveEditorIfDirty` return at line 144) — asserting `1`, not `0`, is what pins the M27 deferral as deliberate rather than accidental. Follows the `MashProfileManager.test.tsx:300-309` precedent |
| AC-22 | `BatchList` loading state | Unit (RTL) | With `listBatches` pending: `batch-list-loading` present, its `className` equals `LOADING_STATE_CLASS` imported from `designSystem`, it contains an `svg`, and its text matches `/Loading batches…/`. `screen.queryByText('Loading...')` is `null` |
| AC-23 | `BatchList` error state matches the sibling pattern | Integration (RTL) | With `listBatches` rejecting `ApiClientError('INTERNAL','Request failed with status 500.')`: `batch-list-error` present; its `className` starts with `ERROR_STATE_CLASS`; it contains an `svg`; text `Couldn't load your batches` present; the raw client message `Request failed with status 500.` present (existing `BatchList.test.tsx:33-40` still green); `batch-list-retry` present with accessible name `Retry`. The `text-rose-500` bare div is gone: `container.querySelector('.text-rose-500')` is `null` |
| AC-24 | `BatchList` Retry re-issues the load and recovers (RA-15) | Integration (RTL) | `listBatches` rejects once then resolves `[batch-1]`. Click `batch-list-retry` → `listBatches` called exactly `2` times; `batch-list-error` gone; `batch-row-batch-1` rendered. Shell invariants hold throughout: exactly one `<h1>` with accessible name `Brewing Batches` and exactly one `page-container` in the error, loading, and list states (extends `BatchList.test.tsx:124-135`) |
| AC-25 | **Scope Guardrail** (RA-18 — `git diff` is NOT viable here) | Verification | This repo has **1 commit** and `apps/web/` is absent from `HEAD`, so `git diff --name-only <base>` cannot distinguish executor changes from pre-existing uncommitted state. Instead: **before the first edit**, run `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum \| sort -k2 > <scratch>/manifest_pre.txt`; **after the last edit**, run the same command to `manifest_post.txt`; `diff manifest_pre.txt manifest_post.txt` must show changes confined to: the 8 modified source files (`RecipeImportModal.tsx`, `WaterCalculatorModal.tsx`, `MiscSection.tsx`, `BatchNoteLog.tsx`, `ReadingLog.tsx`, `BatchList.tsx`, plus `test/BatchNoteLog.test.tsx`, `test/ReadingLog.test.tsx`, `test/BatchList.test.tsx`), the newly-added test files, and the 4 deletions. **Hash-identical (untouched), asserted explicitly:** `src/App.tsx`, `src/components/designSystem.ts`, `test/designSystem.test.ts`, `test/accessibilityAndPolish.test.tsx`, `src/components/ConfirmDialog.tsx`, `src/components/BatchRecipeAdjustModal.tsx`, `src/components/PostBrewCalibrationModal.tsx`, `src/components/PresetPickerModal.tsx`, `src/components/RefractometerFermentationModal.tsx`, `src/pages/BatchDetail.tsx`, and everything under `apps/api/`, `packages/`, `.gsd/` (except this spec and `STATE.json`) |
| AC-26 | Four dead files are gone (RA-17) | Verification | `src/components/BatchStepper.tsx`, `test/BatchStepper.test.tsx`, `src/components/CarbonationPanel.tsx`, `test/CarbonationPanel.test.tsx` do not exist. A recursive grep of `apps/web/src` and `apps/web/test` for `BatchStepper`, `CarbonationPanel`, `stepStates`, `TRANSITION_LABEL` returns **zero** matches |
| AC-27 | Test count drops by exactly the two deleted suites | Verification | **Measured baseline:** `apps/web` = **51 test files / 691 tests**; `BatchStepper.test.tsx` = **23** tests, `CarbonationPanel.test.tsx` = **7** tests (both verified green at spec time). Post-phase web totals must equal `(51 − 2 + F_new)` files and `(691 − 30 + T_new)` tests, where the executor **reports `F_new` and `T_new` explicitly** in its Layer 1 output. Any other delta means a pre-existing test broke or was silently dropped |
| AC-28 | Six untouched dialogs do not regress (RA-2) | Source sweep | `BatchRecipeAdjustModal.tsx`, `ConfirmDialog.tsx`, `PresetPickerModal.tsx` still declare `role="dialog"` + `aria-modal="true"` and still have **no** `aria-labelledby` (asserting absence pins RA-2's deferral as deliberate, so an unplanned M25 change here is caught). `App.tsx`, `PostBrewCalibrationModal.tsx`, `RefractometerFermentationModal.tsx` still declare all three including their existing `aria-labelledby` ids (`scale-modal-title`, `calibration-modal-title`, `refractometer-modal-title`) |
| AC-29 | Prop contracts unchanged (RA-12) | Typecheck + source sweep | `tsc -b` passes with **no** call-site edits at `App.tsx`'s `<BatchList>`, `<RecipeImportModal>`, and `BatchDetail.tsx`'s `<ReadingLog>` / `<BatchNoteLog>` / `<WaterCalculatorModal>` usages. `BatchList`'s signature remains `({ onViewBatch }: { onViewBatch: (id: string) => void })` |
| AC-30 | All four Layer 1 gates green (HARD_RULES rule 13) | Verification | `test` **and** `typecheck` **and** `build` **and** `lint` each exit `0`, across all workspaces (`shared-types`, `calculations`, `web`, `api`). Lint's 4 pre-existing `react/only-export-components` warnings are the accepted baseline — exit code `0`, and **no new** warning classes introduced |

---

## Notes on backlog linkage

`.gsd/FEATURES.md` and `.gsd/BUGS.md` were both checked in full. **No FEAT-xxx or BUG-xxx item corresponds to this scope** — the UX audit that seeded the Experience Redesign initiative was ingested directly into `.gsd/DISCOVERY.md` and `.gsd/ROADMAP.md` and its twelve items were never individually logged. The highest existing ids are FEAT-020 and BUG-023, both unrelated. Nothing was set to `IN_PLANNING`; there is nothing to set.

---
> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
