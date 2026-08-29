# FEATURE SPECIFICATION: M33_P3 — The Note Log and the Stage Chrome

> **Milestone 33:** "Brew day stops improvising its buttons" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 3 of 5.** Migrates all button elements in `BatchNoteLog.tsx` onto `<Button>` (`primary`, `secondary`, and `icon` variants), retires `!px-3 !py-1.5` overrides, and audits stage chrome controls in `BatchStageTabs.tsx` and `BrewDayTimelineBar.tsx` ensuring full accessibility and keyboard navigation compliance.

---

## Phase Summary

In Milestone 33 Phase 1 and Phase 2, we migrated `StockCheckPanel.tsx` and `ReadingLog.tsx` onto `<Button>`.
In Milestone 33 Phase 3, we migrate `BatchNoteLog.tsx` (7 button sites) and audit the stage chrome components (`BatchStageTabs.tsx` and `BrewDayTimelineBar.tsx`).

In Milestone 33 Phase 3, we accomplish:
1. **`BatchNoteLog.tsx` Button Migration (7 Button Sites):**
   - **Header Add Note Button (N-1):** Migrates to `<Button variant="primary" size="sm" onClick={startAdd} data-testid="note-add-button"><Plus className="w-3.5 h-3.5" /> Add Note</Button>`.
   - **Inline Edit Row Save Icon Button (N-2):** Migrates to `<Button variant="icon" type="submit" disabled={busy} title="Save" aria-label="Save note" className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></Button>`.
   - **Inline Edit Row Cancel Icon Button (N-3):** Migrates to `<Button variant="icon" type="button" onClick={cancelEdit} title="Cancel" aria-label="Cancel editing note" className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></Button>`.
   - **Note Row Edit Icon Button (N-4):** Migrates to `<Button variant="icon" type="button" onClick={() => startEdit(n)} title="Edit" aria-label="Edit note" data-testid={`note-edit-${n.id}`} className="p-1.5 text-slate-400 hover:text-amber-400"><Pencil className="w-3.5 h-3.5" /></Button>`.
   - **Note Row Delete Icon Button (N-5):** Migrates to `<Button variant="icon" type="button" onClick={() => requestDelete(n)} title="Delete" aria-label="Delete note" data-testid={`note-delete-${n.id}`} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></Button>`.
   - **Add Form Save Button (N-6):** Migrates to `<Button variant="primary" size="sm" type="submit" disabled={busy}>Save</Button>`, retiring `${BUTTON_PRIMARY_CLASS} text-xs !px-3 !py-1.5`.
   - **Add Form Cancel Button (N-7):** Migrates to `<Button variant="secondary" size="sm" type="button" onClick={cancelAdd}>Cancel</Button>`, retiring `${BUTTON_SECONDARY_CLASS} text-xs !px-3 !py-1.5`.
   - Achieves **zero raw `<button>` elements** in `BatchNoteLog.tsx`.
2. **Stage Chrome Accessibility & Navigation Audit:**
   - `BatchStageTabs.tsx`: confirms roving `tabIndex`, `role="tab"`, `aria-selected`, `aria-current="step"`, and keyboard arrow navigation pass all 10 existing assertions in `BatchStageTabs.test.tsx`.
   - `BrewDayTimelineBar.tsx`: confirms continuous width-proportional segments, milestone dot positioning, and accessible label tooltips pass all existing assertions in `BrewDayTimelineBar.test.tsx`.
3. **Tests & Static Adoption Sweeps:**
   - All 10 existing tests in `BatchNoteLog.test.tsx` pass cleanly.
   - Extend `uiPrimitives.test.tsx` with a static sweep verifying zero raw `<button>` elements in `BatchNoteLog.tsx`.

---

## Key Behaviors

1. `apps/web/src/components/BatchNoteLog.tsx`:
   - Imports `Button` from `./ui`.
   - All 7 button sites render through `<Button>` with appropriate `variant` and `size` props.
   - Retires manual class strings:
     - `inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md...` -> `<Button variant="primary" size="sm">`
     - `p-2 text-emerald-400 hover:text-emerald-300` -> `<Button variant="icon">`
     - `p-2 text-slate-400 hover:text-slate-200` -> `<Button variant="icon">`
     - `p-1.5 text-slate-400 hover:text-amber-400` -> `<Button variant="icon">`
     - `p-1.5 text-slate-400 hover:text-rose-400` -> `<Button variant="icon">`
     - `${BUTTON_PRIMARY_CLASS} text-xs !px-3 !py-1.5` -> `<Button variant="primary" size="sm">`
     - `${BUTTON_SECONDARY_CLASS} text-xs !px-3 !py-1.5` -> `<Button variant="secondary" size="sm">`

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Untouched.**
`designSystem.ts` continues to export exactly 28 constants. No token is added or modified.

**RA-2 — `Button.tsx` Remains Read-Only / Settled.**
`Button.tsx` API was hardened in M33_P1 and is read-only in this phase.

**RA-3 — Preserving Accessible Names on Icon Buttons.**
All icon buttons in `BatchNoteLog.tsx` (`Save`, `Cancel`, `Edit`, `Delete`) retain their exact `aria-label` and `title` props so screen readers and tooltip helpers resolve cleanly.

**RA-4 — Binding Process Note: Scope Guardrail Manifest.**
Capturing the pre-edit SHA-256 manifest is the literal first action of `/execute` before modifying any source code file.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_EXECUTION` | Milestone 33 Phase 3 migrates BatchNoteLog onto `<Button>` and audits stage chrome. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Unified button typography, heights, and icon alignments. |

---

## 1. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/components/BatchNoteLog.tsx` | **MODIFY** | Migrate all 7 button sites onto `<Button>`. |
| `apps/web/test/BatchNoteLog.test.tsx` | **MODIFY** | Verify all 10 tests pass cleanly and add button component assertions. |
| `apps/web/test/uiPrimitives.test.tsx` | **MODIFY** | Add static sweep proving zero raw `<button>` elements in `BatchNoteLog.tsx`. |

---

## 2. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `designSystem.ts` and `Button.tsx` confirmed byte-identical (RA-1, RA-2) | Verification | SHA-256 identical pre/post. 28 exports unchanged. |
| **AC-2** | Header Add Note button (N-1) renders via `<Button variant="primary" size="sm">` | Component Test | Button has test ID `note-add-button` and opens add form on click. |
| **AC-3** | Inline edit row Save icon button (N-2) renders via `<Button variant="icon">` | Component Test | Button has `aria-label="Save note"`, `type="submit"`, and `<Check>` icon. |
| **AC-4** | Inline edit row Cancel icon button (N-3) renders via `<Button variant="icon">` | Component Test | Button has `aria-label="Cancel editing note"`, `type="button"`, and `<X>` icon. |
| **AC-5** | Note row Edit icon button (N-4) renders via `<Button variant="icon">` | Component Test | Button has `aria-label="Edit note"`, test ID `note-edit-${n.id}`, and `<Pencil>` icon. |
| **AC-6** | Note row Delete icon button (N-5) renders via `<Button variant="icon">` | Component Test | Button has `aria-label="Delete note"`, test ID `note-delete-${n.id}`, and `<Trash2>` icon. |
| **AC-7** | Add form Save button (N-6) renders via `<Button variant="primary" size="sm">` | Component Test | Button has text "Save", `type="submit"`, and disabled state when busy. |
| **AC-8** | Add form Cancel button (N-7) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has text "Cancel", `type="button"`, and closes form on click. |
| **AC-9** | Zero raw `<button className=...>` in `BatchNoteLog.tsx` | Static Sweep (`uiPrimitives.test.tsx`) | Regex `/<button[\s>]/g` in `BatchNoteLog.tsx` matches 0. |
| **AC-10** | All 10 existing `BatchNoteLog.test.tsx` tests pass unmodified | Existing Tests | All add, edit, delete, dialog, order, and error tests pass 100%. |
| **AC-11** | Accessible name resolution on icon buttons preserved | Component Test | `getByLabelText('Edit note')`, `getByLabelText('Delete note')`, `getByLabelText('Save note')`, `getByLabelText('Cancel editing note')` all resolve cleanly. |
| **AC-12** | `BatchStageTabs.test.tsx` (10 tests) passes unmodified | Existing Tests | Stage stepper indicators, keyboard arrow navigation, and roving tabIndex pass 100%. |
| **AC-13** | `BrewDayTimelineBar.test.tsx` (2 tests) passes unmodified | Existing Tests | Timeline segments and milestone dots pass 100%. |
| **AC-14** | Scope Guardrail — pre/post SHA-256 content manifest | Verification | Exactly 3 authorized files modified, 0 created, 0 deleted. |
| **AC-15** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 (>= 2,197 passed across 121 files). |
| **AC-16** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 workspaces clean). |
| **AC-17** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-18** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |
| **AC-19** | Manual verification screenshot (best-effort) | Verification | `M33_P3_batch_note_buttons.png` saved to `.gsd/active/manual_verification/` if browser automation available. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Modify (3 files)
1. `apps/web/src/components/BatchNoteLog.tsx`
2. `apps/web/test/BatchNoteLog.test.tsx`
3. `apps/web/test/uiPrimitives.test.tsx`

### 3.2 Authorized to Create
**None.**

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, 28 constants).
- `apps/web/src/components/ui/Button.tsx` and `ui/index.ts`.
- `BrewDayTracker.tsx`, `pages/BatchDetail.tsx`.
- `packages/**`, `apps/api/**`.

---

## 4. Layer 1 Command Gates

```bash
npm test
npm run typecheck
npm run build
npm run lint
```
All four gates must exit 0 cleanly before `/execute` halts for `/steer`.

---

## 5. Manual Verification Evidence

Save to `.gsd/active/manual_verification/`:
- **`M33_P3_batch_note_buttons.png`**: Screenshot of `BatchNoteLog` component showing migrated `<Button>` components (Add Note, row Edit/Delete, inline edit Save/Cancel, and add form Save/Cancel actions) with standardized ~32px compact heights, icon button targets, and `gap-1.5` layout.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
