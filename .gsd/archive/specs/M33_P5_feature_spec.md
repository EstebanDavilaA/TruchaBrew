# FEATURE SPECIFICATION: M33_P5 — BatchDetail.tsx, Alone: Closing Milestone 33

> **Milestone 33:** "Brew day stops improvising its buttons" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 5 of 5.** Migrates all action buttons in `pages/BatchDetail.tsx` onto `<Button>` (`primary`, `secondary`, `danger`, `icon` variants), preserves `designTokens.test.ts` AC-13 import assertions, and delivers the milestone's closing adoption assertions across all five batch and brew-day files.

---

## Phase Summary

In Milestone 33 Phases 1 through 4:
- **P1:** Settled the `<Button>` icon alignment and `gap-1.5` layout, migrating `StockCheckPanel.tsx` (4 raw buttons).
- **P2:** Migrated `ReadingLog.tsx` (8 raw buttons).
- **P3:** Migrated `BatchNoteLog.tsx` (7 button sites) and audited stage chrome.
- **P4:** Migrated `BrewDayTracker.tsx` (11 action/chrome button sites).

In Milestone 33 Phase 5, we complete the remaining batch surface in `pages/BatchDetail.tsx` and close Milestone 33:
1. **`pages/BatchDetail.tsx` Button Migration:**
   - **Back Navigation Control (D-1):** Migrates to `<Button variant="secondary" size="sm" type="button" onClick={onBack} title="Back" aria-label="Back"><ArrowLeft className="w-4 h-4" /></Button>`.
   - **TopBar Brew Again Action (D-2):** Migrates to `<Button variant="secondary" size="sm" type="button" data-testid="batch-rebrew-btn" disabled={rebrewBusy} onClick={handleRebrew}><RefreshCw className={`w-3.5 h-3.5 ${rebrewBusy ? 'animate-spin' : ''}`} />{rebrewBusy ? 'Creating…' : 'Brew Again'}</Button>`.
   - **TopBar Delete Action (D-3):** Migrates to `<Button variant="danger" size="sm" type="button" data-testid="batch-delete-btn" onClick={handleDeleteClick} disabled={deleteBusy}>Delete</Button>`.
   - **TopBar Discard Changes Action (D-4):** Migrates to `<Button variant="secondary" size="sm" type="button" data-testid="batch-discard-btn" onClick={handleCancel} disabled={isSaving}>Discard Changes</Button>`.
   - **TopBar Save Changes Action (D-5):** Migrates to `<Button variant="primary" size="sm" type="button" data-testid="batch-save-btn" disabled={isSaving} onClick={handleSave}>{isSaving ? 'Saving…' : 'Save Changes'}</Button>`.
   - **Identity Editor Close Action (D-6):** Migrates to `<Button variant="secondary" size="sm" type="button" data-testid="batch-identity-edit-close" onClick={() => setIdentityEditOpen(false)}>Close Editor</Button>`.
   - **Advance Status Action (D-7):** Migrates to `<Button variant="primary" size="sm" type="button" data-testid="batch-advance-status-btn" disabled={isSaving} onClick={...}><CornerDownRight className="w-3.5 h-3.5" />Advance Status to {STATUS_TO_TAB_LABEL[TAB_TO_STATUS[activeTab]]}</Button>`.
   - **Advance to Conditioning Action (D-8):** Migrates to `<Button variant="primary" size="sm" type="button" data-testid="advance-conditioning-btn" disabled={conditioningBusy} onClick={handleAdvanceToConditioning}>{conditioningBusy ? 'Advancing…' : 'Advance to Conditioning →'}</Button>`.
   - **Calibrate Equipment Action (D-9):** Migrates to `<Button variant="secondary" size="sm" type="button" data-testid="open-calibration-modal-btn" onClick={() => setIsCalibrationModalOpen(true)}><Sliders className="w-3.5 h-3.5 text-amber-400" />Calibrate Equipment &amp; Recipe Targets</Button>`.
   - Header identity edit trigger card button (`data-testid="batch-identity-edit-trigger"`) remains as the designated full-width clickable card header wrapper.
2. **Milestone 33 Closing Adoption & Height Consistency Assertions:**
   - **Adoption Sweep:** Proves that all five batch screens (`StockCheckPanel.tsx`, `ReadingLog.tsx`, `BatchNoteLog.tsx`, `BrewDayTracker.tsx`, `pages/BatchDetail.tsx`) contain **zero raw `<button className=...>` action buttons**.
   - **Unified Control Plane Height:** Asserts that `size="sm"` buttons evaluate to ~32px compact height band (`text-xs px-3 py-1.5 font-semibold`) across all batch screens.
3. **Tests:**
   - All 35+ existing tests in `apps/web/test/BatchDetail.test.tsx` pass 100% cleanly.
   - `designTokens.test.ts` AC-13 row for `pages/BatchDetail.tsx` continues to pass cleanly.
   - `uiPrimitives.test.tsx` extended with the milestone closing adoption assertions.

---

## Key Behaviors

1. `apps/web/src/pages/BatchDetail.tsx`:
   - Imports `Button` from `../components/ui`.
   - Retires manual button class strings:
     - `bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg border border-slate-700...` -> `<Button variant="secondary" size="sm">`
     - `inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50...` -> `<Button variant="secondary" size="sm">`
     - `${BUTTON_DANGER_CLASS} text-xs` -> `<Button variant="danger" size="sm">`
     - `${BUTTON_SECONDARY_CLASS} text-xs` -> `<Button variant="secondary" size="sm">`
     - `${BUTTON_PRIMARY_CLASS} text-xs` -> `<Button variant="primary" size="sm">`
     - `inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500...` -> `<Button variant="primary" size="sm">`
     - `${BUTTON_SECONDARY_CLASS} text-xs flex items-center gap-1.5` -> `<Button variant="secondary" size="sm">`
   - Retains all `data-testid`, `onClick`, `disabled`, and icon child elements.

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Untouched.**
`designSystem.ts` continues to export exactly 28 constants. No token is added or modified.

**RA-2 — `Button.tsx` Remains Read-Only / Settled.**
`Button.tsx` API was hardened in M33_P1 and is read-only in this phase.

**RA-3 — Card Header Trigger vs Action Buttons.**
`batch-identity-edit-trigger` in `BatchDetail.tsx` (line 884) is a full-width block trigger wrapping the batch title heading and status badge with `className="w-full text-left cursor-pointer group"`. It is not an action button and remains as a semantic wrapper.

**RA-4 — Binding Process Note: Scope Guardrail Manifest.**
Capturing the pre-edit SHA-256 manifest is the literal first action of `/execute` before modifying any source code file.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_EXECUTION` | Milestone 33 Phase 5 closes button unification and height standardization across all batch screens. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Unified button typography, heights, and icon alignments. |

---

## 1. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/pages/BatchDetail.tsx` | **MODIFY** | Migrate all action buttons onto `<Button>`. |
| `apps/web/test/BatchDetail.test.tsx` | **MODIFY** | Verify all existing tests pass cleanly. |
| `apps/web/test/uiPrimitives.test.tsx` | **MODIFY** | Add Milestone 33 closing adoption assertions (zero raw action buttons across 5 files, button height consistency). |

---

## 2. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `designSystem.ts` and `Button.tsx` confirmed byte-identical (RA-1, RA-2) | Verification | SHA-256 identical pre/post. 28 exports unchanged. |
| **AC-2** | Back control button (D-1) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has title "Back", `aria-label="Back"`, and `<ArrowLeft>` icon. |
| **AC-3** | TopBar Brew Again button (D-2) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `batch-rebrew-btn` and rebrew spinner logic. |
| **AC-4** | TopBar Delete button (D-3) renders via `<Button variant="danger" size="sm">` | Component Test | Button has test ID `batch-delete-btn` and triggers delete dialog. |
| **AC-5** | TopBar Discard Changes button (D-4) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `batch-discard-btn` and cancels pending edits. |
| **AC-6** | TopBar Save Changes button (D-5) renders via `<Button variant="primary" size="sm">` | Component Test | Button has test ID `batch-save-btn` and persists staged form data. |
| **AC-7** | Identity Editor Close button (D-6) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `batch-identity-edit-close` and closes editor view. |
| **AC-8** | Advance Status banner button (D-7) renders via `<Button variant="primary" size="sm">` | Component Test | Button has test ID `batch-advance-status-btn` and advances batch status. |
| **AC-9** | Advance to Conditioning button (D-8) renders via `<Button variant="primary" size="sm">` | Component Test | Button has test ID `advance-conditioning-btn` and advances status to Conditioning. |
| **AC-10** | Calibrate Equipment button (D-9) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `open-calibration-modal-btn` and opens calibration modal. |
| **AC-11** | Zero raw action `<button className=...>` in `pages/BatchDetail.tsx` | Static Sweep (`uiPrimitives.test.tsx`) | All action buttons in `BatchDetail.tsx` use `<Button>`. |
| **AC-12** | Milestone 33 Adoption: Zero raw action buttons across all 5 files | Static Sweep (`uiPrimitives.test.tsx`) | StockCheckPanel, ReadingLog, BatchNoteLog, BrewDayTracker, BatchDetail contain 0 raw action buttons. |
| **AC-13** | Button Height Consistency: Small primary/secondary/danger buttons evaluate to ~32px height band | Rendered Test | Rendered `size="sm"` buttons share `text-xs px-3 py-1.5 font-semibold`. |
| **AC-14** | All existing `BatchDetail.test.tsx` tests pass unmodified | Existing Tests | All 35+ batch lifecycle, reading, note, sensory, and split packaging tests pass 100%. |
| **AC-15** | `designTokens.test.ts` AC-13 row for `pages/BatchDetail.tsx` passes cleanly | Existing Tests | Token imports verified. |
| **AC-16** | Scope Guardrail — pre/post SHA-256 content manifest | Verification | Exactly 3 authorized files modified, 0 created, 0 deleted. |
| **AC-17** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 (>= 2,198 passed across 121 files). |
| **AC-18** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 workspaces clean). |
| **AC-19** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-20** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |
| **AC-21** | Manual verification screenshot (best-effort) | Verification | `M33_P5_batch_detail_buttons.png` saved to `.gsd/active/manual_verification/` if browser automation available. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Modify (3 files)
1. `apps/web/src/pages/BatchDetail.tsx`
2. `apps/web/test/BatchDetail.test.tsx`
3. `apps/web/test/uiPrimitives.test.tsx`

### 3.2 Authorized to Create
**None.**

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, 28 constants).
- `apps/web/src/components/ui/Button.tsx` and `ui/index.ts`.
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
- **`M33_P5_batch_detail_buttons.png`**: Screenshot of `BatchDetail` page showing migrated TopBar action buttons (Save Changes, Discard, Delete, Brew Again), stage advance actions, and back navigation with standardized ~32px compact button heights and unified styling.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
