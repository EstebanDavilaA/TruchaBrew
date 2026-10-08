# FEATURE SPECIFICATION: M33_P2 — ReadingLog.tsx, Alone: Retiring the Densest Button Cluster

> **Milestone 33:** "Brew day stops improvising its buttons" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 2 of 5.** Migrates all 8 raw `<button>` elements in `ReadingLog.tsx` onto `<Button>` (`primary`, `secondary`, and `icon` variants), eliminating hand-rolled button styles and achieving zero raw buttons in `ReadingLog.tsx`.

---

## Phase Summary

In Milestone 33 Phase 1, we settled the `<Button>` primitive's `size="sm"`, icon alignment, and `gap-1.5` layout on `StockCheckPanel.tsx`.
In Milestone 33 Phase 2, we tackle the single densest button cluster in the app: `ReadingLog.tsx` (8 raw buttons across header actions, inline edit row, table action cells, and add form).

In Milestone 33 Phase 2, we accomplish:
1. **`ReadingLog.tsx` Button Migration (8 Raw Buttons):**
   - **Header Refractometer Tool Button (B-1):** Migrates to `<Button variant="secondary" size="sm" onClick={() => setRefractModalOpen(true)} data-testid="open-refractometer-btn" title="Convert optical Brix reading into alcohol-corrected SG"><Calculator className="w-3.5 h-3.5 text-amber-400" /> Refractometer Tool</Button>`.
   - **Header Log Reading Button (B-2):** Migrates to `<Button variant="primary" size="sm" onClick={startAdd} data-testid="reading-add-button"><Plus className="w-3.5 h-3.5" /> Log Reading</Button>`.
   - **Inline Edit Row Save Icon Button (B-3):** Migrates to `<Button variant="icon" type="submit" disabled={busy} title="Save" aria-label="Save reading" className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></Button>`.
   - **Inline Edit Row Cancel Icon Button (B-4):** Migrates to `<Button variant="icon" type="button" onClick={cancelEdit} title="Cancel" aria-label="Cancel editing reading" className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></Button>`.
   - **Table Row Edit Icon Button (B-5):** Migrates to `<Button variant="icon" type="button" onClick={() => startEdit(r)} title="Edit" aria-label="Edit reading" data-testid={`reading-edit-${r.id}`} className="p-1.5 text-slate-400 hover:text-amber-400"><Pencil className="w-3.5 h-3.5" /></Button>`.
   - **Table Row Delete Icon Button (B-6):** Migrates to `<Button variant="icon" type="button" onClick={() => requestDelete(r)} title="Delete" aria-label="Delete reading" data-testid={`reading-delete-${r.id}`} className="p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></Button>`.
   - **Add Form Save Button (B-7):** Migrates to `<Button variant="primary" size="sm" type="submit" disabled={busy}>Save</Button>`.
   - **Add Form Cancel Button (B-8):** Migrates to `<Button variant="secondary" size="sm" type="button" onClick={cancelAdd}>Cancel</Button>`.
   - Achieves **zero raw `<button>` elements** in `ReadingLog.tsx`.
2. **Accessible Names & Tooltips Preserved:**
   - All `aria-label`, `title`, `data-testid`, and click handler attributes are preserved verbatim.
   - All M12/M13/M23 accessibility guarantees tested in `ReadingLog.test.tsx` pass 100% cleanly.
3. **Tests & Static Adoption Sweeps:**
   - All existing 14 tests in `apps/web/test/ReadingLog.test.tsx` pass cleanly.
   - Extend `uiPrimitives.test.tsx` with a static sweep verifying zero raw `<button>` elements in `ReadingLog.tsx`.
   - `designTokens.test.ts` AC-13 row for `ReadingLog.tsx` continues to pass cleanly.

---

## Key Behaviors

1. `apps/web/src/components/ReadingLog.tsx`:
   - Imports `Button` from `./ui`.
   - All 8 button elements render through `<Button>` with appropriate `variant` and `size` props.
   - Retires all 8 hand-rolled button class strings:
     - `inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-amber-400 bg-slate-800 hover:bg-slate-700/80 px-2 py-1 rounded border border-slate-700...` -> `<Button variant="secondary" size="sm">`
     - `inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md...` -> `<Button variant="primary" size="sm">`
     - `p-2 text-emerald-400 hover:text-emerald-300` -> `<Button variant="icon">`
     - `p-2 text-slate-400 hover:text-slate-200` -> `<Button variant="icon">`
     - `p-1.5 text-slate-400 hover:text-amber-400` -> `<Button variant="icon">`
     - `p-1.5 text-slate-400 hover:text-rose-400` -> `<Button variant="icon">`
     - `bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-2 rounded-md` -> `<Button variant="primary" size="sm">`
     - `bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-md border border-slate-700` -> `<Button variant="secondary" size="sm">`

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Untouched.**
`designSystem.ts` continues to export exactly 28 constants. No token is added or modified.

**RA-2 — `Button.tsx` Remains Read-Only / Settled.**
`Button.tsx` API was hardened in M33_P1 and is read-only in this phase.

**RA-3 — Preserving Accessible Names on Icon Buttons.**
All icon buttons in `ReadingLog.tsx` (`Save`, `Cancel`, `Edit`, `Delete`) retain their exact `aria-label` and `title` props so screen readers and tooltip helpers resolve cleanly without change.

**RA-4 — Binding Process Note: Scope Guardrail Manifest.**
Capturing the pre-edit SHA-256 manifest is the literal first action of `/execute` before modifying any source code file.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_EXECUTION` | Milestone 33 Phase 2 migrates the 8 raw buttons in ReadingLog onto `<Button>`. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Unified button typography, heights, and icon alignments. |

---

## 1. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/components/ReadingLog.tsx` | **MODIFY** | Migrate all 8 raw `<button>` elements onto `<Button>`. |
| `apps/web/test/ReadingLog.test.tsx` | **MODIFY** | Verify all 14 tests pass cleanly and add button component assertions. |
| `apps/web/test/uiPrimitives.test.tsx` | **MODIFY** | Add static sweep proving zero raw `<button>` elements in `ReadingLog.tsx`. |

---

## 2. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `designSystem.ts` and `Button.tsx` confirmed byte-identical (RA-1, RA-2) | Verification | SHA-256 identical pre/post. 28 exports unchanged. |
| **AC-2** | Header Refractometer Tool button (B-1) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `open-refractometer-btn`, title, and opens modal on click. |
| **AC-3** | Header Log Reading button (B-2) renders via `<Button variant="primary" size="sm">` | Component Test | Button has test ID `reading-add-button` and opens add form on click. |
| **AC-4** | Inline edit row Save icon button (B-3) renders via `<Button variant="icon">` | Component Test | Button has `aria-label="Save reading"`, `type="submit"`, and `<Check>` icon. |
| **AC-5** | Inline edit row Cancel icon button (B-4) renders via `<Button variant="icon">` | Component Test | Button has `aria-label="Cancel editing reading"`, `type="button"`, and `<X>` icon. |
| **AC-6** | Table row Edit icon button (B-5) renders via `<Button variant="icon">` | Component Test | Button has `aria-label="Edit reading"`, test ID `reading-edit-${r.id}`, and `<Pencil>` icon. |
| **AC-7** | Table row Delete icon button (B-6) renders via `<Button variant="icon">` | Component Test | Button has `aria-label="Delete reading"`, test ID `reading-delete-${r.id}`, and `<Trash2>` icon. |
| **AC-8** | Add form Save button (B-7) renders via `<Button variant="primary" size="sm">` | Component Test | Button has text "Save", `type="submit"`, and disabled state when busy. |
| **AC-9** | Add form Cancel button (B-8) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has text "Cancel", `type="button"`, and closes form on click. |
| **AC-10** | Zero raw `<button className=...>` in `ReadingLog.tsx` | Static Sweep (`uiPrimitives.test.tsx`) | Regex `/<button[\s>]/g` in `ReadingLog.tsx` matches 0. |
| **AC-11** | All 14 existing `ReadingLog.test.tsx` tests pass unmodified | Existing Tests | All add, edit, delete, dialog, order, and parse-error tests pass 100%. |
| **AC-12** | Accessible name resolution on icon buttons preserved | Component Test | `getByLabelText('Edit reading')`, `getByLabelText('Delete reading')`, `getByLabelText('Save reading')`, `getByLabelText('Cancel editing reading')` all resolve cleanly. |
| **AC-13** | `designTokens.test.ts` AC-13 row for `ReadingLog.tsx` passes cleanly | Existing Tests | `INPUT_COMPACT_CLASS` import from `./designSystem` verified. |
| **AC-14** | Scope Guardrail — pre/post SHA-256 content manifest | Verification | Exactly 3 authorized files modified, 0 created, 0 deleted. |
| **AC-15** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 (>= 2,196 passed across 121 files). |
| **AC-16** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 workspaces clean). |
| **AC-17** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-18** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |
| **AC-19** | Manual verification screenshot (best-effort) | Verification | `M33_P2_reading_log_buttons.png` saved to `.gsd/active/manual_verification/` if browser automation available. |
| **AC-20** | Control plane height alignment: small primary and secondary buttons evaluate to ~32px height band | Rendered Test | Primary and secondary buttons share `text-xs px-3 py-1.5 font-semibold`. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Modify (3 files)
1. `apps/web/src/components/ReadingLog.tsx`
2. `apps/web/test/ReadingLog.test.tsx`
3. `apps/web/test/uiPrimitives.test.tsx`

### 3.2 Authorized to Create
**None.**

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, 28 constants).
- `apps/web/src/components/ui/Button.tsx` and `ui/index.ts`.
- `BatchNoteLog.tsx`, `BrewDayTracker.tsx`, `pages/BatchDetail.tsx`.
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
- **`M33_P2_reading_log_buttons.png`**: Screenshot of `ReadingLog` component showing migrated `<Button>` components (Refractometer Tool, Log Reading, row Edit/Delete, and form Save/Cancel actions) with standardized ~32px compact heights, icon button targets, and `gap-1.5` layout.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
