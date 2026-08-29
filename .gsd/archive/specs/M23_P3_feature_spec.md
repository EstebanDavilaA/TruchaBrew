# FEATURE SPECIFICATION: M23_P3 — Water Calculator: unified table layout & pH clarity

## Phase Summary

Milestone 23 Phase 2 gave the Water Calculator modal three default-ON checkboxes that unmounted and remounted whole panels on toggle. That was redesigned into an invariant-geometry table layout where toggles live in column headers.

This amendment adds:
1. **pH Clarity & Comparison**: Exposing both **Initial Mash pH** (unadjusted baseline from grain bill + mineral salt additions) and **Adjusted Mash pH** (post-acid additions), along with Target pH, in both the modal header and the Acid Adjustments section.
2. **Modal Layout & Padding Polish**: Proper padding structure (`p-6` on header, scrollable body, and footer) ensuring content and table edges have proper breathing room and do not press against modal container borders.
3. **Dual Acid Switches**: Optional Mash and Sparge acid switches in table headers.
4. **Suggested / Needed Minerals Reference Column**: 5th column in the minerals table showing batch target salt amounts.

---

### Key Behaviors & Visual Layout

1. **Modal Container & Padding Structure**:
   - Modal container: `max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden`.
   - Header: `p-6 pb-4 border-b border-slate-800 flex items-center justify-between`.
   - Scrollable Body: `p-6 py-4 space-y-4 text-sm overflow-y-auto`.
   - Footer: `p-6 pt-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between`.
2. **Dual pH Badges in Header**:
   - **Initial Mash pH**: Badge with `data-testid="modal-initial-mash-ph"` displaying `Initial pH: <preAcidPredictedPh.toFixed(2)>` (e.g. `5.60`).
   - **Adjusted Mash pH**: Badge with `data-testid="modal-predicted-mash-ph"` displaying `Adjusted pH: <liveMashPh.toFixed(2)>` (e.g. `5.32`).
3. **pH Progression in Acid Adjustments Section**:
   - Section 3 header / status bar displays: `Initial: <preAcidPredictedPh.toFixed(2)> → Target: <targetMashPh.toFixed(2)> → Adjusted: <liveMashPh.toFixed(2)>`.
4. **One "Minerals Needed" table**: Columns `Mineral | Needed | Mash (<x> L) | Sparge (<y> L) | Total`.
5. **One "Acid Adjustments" table**: Columns `Acid Type | Mash | Sparge | Total`, with `add-mash-acid-toggle` and `add-sparge-acid-toggle` in headers.
6. **Geometry Invariance**: Checkboxes disable controls on toggle-off; inputs remain mounted in DOM.

---

### Resolved Ambiguities (Binding)

- **RA-1 — Scope is 2 files: `WaterCalculatorModal.tsx` and its test suite `WaterCalculatorModal.test.tsx`.** All other files in the monorepo remain **hash-identical** (AC-27).
- **RA-2 — Disabled, not unmounted.** Inputs carry `disabled` styling (`disabled:opacity-40 disabled:cursor-not-allowed`) when their corresponding toggle is OFF.
- **RA-3 — Toggling off zeroes amount state.** `handleToggleTreatSparge(false)` zeroes `spargeSalts`; `handleToggleMashAcid(false)` zeroes `mashAcidAmount`; `handleToggleSpargeAcid(false)` zeroes `spargeAcidAmount`. Target pH values remain intact.
- **RA-4 — Dual Header pH Badges:** Both `modal-initial-mash-ph` and `modal-predicted-mash-ph` exist in the modal header. `modal-predicted-mash-ph` text matches `/\d\.\d\d/` and contains `pH`.
- **RA-5 — Modal Padding & Anchored Header/Footer:** Outer container has `overflow-hidden flex flex-col`, header has `p-6 pb-4 border-b`, body has `p-6 py-4 overflow-y-auto`, footer has `p-6 pt-4 border-t`.
- **RA-6 — Save guards symmetrically:** Mash salts always write; sparge salts write while `treatSpargeWater` is ON; mash acid writes while `addMashAcid && mashAcidAmount > 0`; sparge acid writes while `addSpargeAcid && spargeAcidAmount > 0`.
- **RA-7 — Hydration derives `acidType` last-wins.** (Unchanged).
- **RA-8 — Sparge Auto is a no-op for Acidulated Malt.** (Unchanged).
- **RA-9 — Saved sparge acid unit is always `'ml'`.** (Unchanged).
- **RA-10 — Acid Total cell computes live:** `((addMashAcid ? mashAcidAmount : 0) + (addSpargeAcid ? spargeAcidAmount : 0)).toFixed(2) + ' ' + (acidType === 'Acidulated Malt' ? 'g' : 'ml')`.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | Dialog semantics survive (M23_P1 AC-2/AC-3) | Unit (RTL) | Exactly 1 dialog with `aria-modal="true"` and `aria-labelledby="water-calculator-modal-title"` pointing at title `<h3>` |
| AC-2 | Palette sweeps survive | Source sweep | Palette conforms to design system; no forbidden classes |
| AC-3 | Form-control backgrounds survive | Source sweep | `INPUT_CLASS` and `SELECT_CLASS` use `bg-slate-800` |
| AC-4 | Exactly two tables; ion table deleted | Unit (RTL) | `container.querySelectorAll('table')` has length `2` |
| AC-5 | Minerals table headers with live volumes | Unit (RTL) | `Mineral`, `Needed`, `Mash (<x> L)`, `Sparge (<y> L)`, `Total` |
| AC-6 | Five mineral rows in order with Needed column | Unit (RTL) | 5 rows in `SALT_NAMES` order with `mineral-needed-suggested-<slug>` and `mineral-needed-amount-<slug>` |
| AC-7 | Sparge salt toggle in <th> defaults ON | Unit (RTL) | `treat-sparge-water-toggle` in 4th `<th>`, checked by default |
| AC-8 | Geometry invariance across toggles | Integration (RTL) | Table rows and inputs stay mounted with `disabled` attribute on toggle OFF |
| AC-9 | Disabled styling declared | Source sweep + Unit | Inputs receive `disabled:opacity-40 disabled:cursor-not-allowed` |
| AC-10 | Toggling sparge OFF zeroes sparge salts | Integration (RTL) | Sparge inputs zeroed on toggle OFF; mash salts untouched |
| AC-11 | Total column computes live; Needed invariant | Integration (RTL) | Totals update live with AUTO and manual inputs; Needed values invariant |
| AC-12 | AUTO split with sparge ON | Integration (RTL) | Splits suggested amounts proportionally between mash and sparge |
| AC-13 | AUTO doses 100% into mash when sparge OFF | Integration (RTL) | Full amounts in mash; sparge empty |
| AC-14 | Dual acid toggles default ON | Unit (RTL) | `add-mash-acid-toggle` and `add-sparge-acid-toggle` both checked by default; exactly 3 checkboxes in dialog |
| AC-15 | Single shared acid type | Unit (RTL) | One acid type select with 3 options; zero `mashAcidType`/`spargeAcidType` |
| AC-16 | Acid table headers with dual toggles | Unit (RTL) | `Acid Type`, `Mash` (with mash toggle), `Sparge` (with sparge toggle), `Total` |
| AC-17 | Acid toggles OFF disable respective controls | Integration (RTL) | Toggling off disables target pH, dosage, and Auto button, and zeroes dosage |
| AC-18 | Labeled alignment on dosage rows | Unit (RTL) | `Dosage` and `Target pH` labels have `w-14 flex-shrink-0` |
| AC-19 | Acid Total computes live across toggle states | Integration (RTL) | Live sum of active acid amounts with proper unit suffix |
| AC-20 | Sparge Auto calculation | Integration (RTL) | Liquid acids compute; Acidulated Malt is no-op |
| AC-21 | Hydration derives acidType last-wins | Integration (RTL) | Hydrates dosages independently and acidType last-wins |
| AC-22 | Save payload gating on toggles | Integration (RTL) | Commits mash/sparge acids only when respective toggle is ON and dosage > 0 |
| AC-23 | Toggles reset to ON on modal reopen | Integration (RTL) | Reopen resets toggles to ON; Reset button preserves toggle states |
| AC-24 | Layout guardrails | Source sweep | Exactly 1 `md:grid-cols-2` and 1 `md:grid-cols-3`; no conditional grid-cols |
| AC-25 | Dual pH Badges in Header & Live Tracking | Integration (RTL) | Header renders `modal-initial-mash-ph` (`5.60`) and `modal-predicted-mash-ph` (`5.60` -> `5.32` on dosage -> `5.60` on mash toggle OFF) |
| AC-26 | Sibling suites pass unmodified | Verification | `WaterSection.test.tsx` and `ScopeGuardrail.test.tsx` pass unmodified |
| AC-27 | Scope guardrail (SHA-256 manifest) | Verification | Only `WaterCalculatorModal.tsx` and `WaterCalculatorModal.test.tsx` modified |
| AC-28 | Test accounting | Verification | All tests pass in `apps/web` |
| AC-29 | Prop contract unchanged | Typecheck | `WaterCalculatorModalProps` and `onSaveAdjustments` signatures unchanged |
| AC-30 | All four Layer 1 gates green | Verification | `test`, `typecheck`, `build`, `lint` all exit `0` |

---

> **HALT GATE (STATE 2):** Present this spec amendment to the user. Prompt: *"Review this feature specification amendment. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
