# FEATURE SPECIFICATION: M32_P4 — Identity, Scale, and Readback: The Milestone Closes

> **Milestone 32:** "The recipe designer's numbers line up" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 4 of 4.** Migrates `App.tsx`'s recipe scale modal onto `<NumberInput>`, unifies all secondary readback typography in `StatsHeader.tsx` onto `MONO_VALUE_CLASS` (`font-mono tabular-nums tracking-tight`), and delivers the milestone's closing adoption & typography assertions across all 5 recipe section files and readback headers.

---

## Phase Summary

In Milestone 32 Phases 1, 2, and 3:
- **P1:** Settled the `NumberInput` `width`/`size`/`align` API and migrated `HopSection.tsx` (13 numeric inputs).
- **P2:** Migrated `FermentableSection.tsx` (2 numeric inputs) and `MiscSection.tsx` (3 numeric inputs).
- **P3:** Migrated `YeastSection.tsx` (1 numeric input) and unified `MashSection.tsx` (11 computed readback cells) onto `MONO_VALUE_CLASS`.

In Milestone 32 Phase 4, we complete the remaining surfaces and close the milestone:
1. **`App.tsx` Scale Modal Migration:**
   - Migrates the Target Batch Size input in `App.tsx`'s scale modal onto `<NumberInput type="number" width="full" className="flex-1">`.
   - Unifies the Current Batch Size readback in `App.tsx` onto `MONO_VALUE_CLASS` (`text-amber-400 font-mono tabular-nums tracking-tight`).
2. **`StatsHeader.tsx` Readback Typography Unification:**
   - Upgrades all 12 secondary `font-mono tabular-nums` readback sites across the top bar, metric tile sub-lines, and bottom quick-specs bar onto `MONO_VALUE_CLASS` (gaining `tracking-tight`):
     - Top bar: Batch Size (`MSH-1`), Pre-Boil Vol (`MSH-2`), Efficiency (`MSH-3`).
     - Tile sub-lines: Pre-boil OG (`MSH-4`), Attenuation (`MSH-5`), Color EBC (`MSH-6`), RBR (`MSH-7`).
     - Quick specs bar: Total Grain (`MSH-8`), Total Hops (`MSH-9`), Mash Water (`MSH-10`), Sparge Water (`MSH-11`), Total Water (`MSH-12`).
3. **Milestone 32 Closing Adoption & Consistency Assertions:**
   - **Adoption Assertion:** Asserts zero raw `<input type="number">` elements remain across all five recipe designer section files (`HopSection.tsx`, `FermentableSection.tsx`, `MiscSection.tsx`, `YeastSection.tsx`, `MashSection.tsx`) and `App.tsx`.
   - **Entered vs Readback Typography Assertion:** Asserts that entered values in recipe designer inputs and rendered readbacks in `StatsHeader` and `MashSection` share the exact same typographic tokens (`font-mono tabular-nums tracking-tight`), closing the `tracking-tight` defect.
   - **Dimension & Geometry Parity:** Asserts that input controls with matching size band evaluate to unified control height and typography.

---

## Key Behaviors

1. `apps/web/src/App.tsx`:
   - Scale modal target batch size input renders through `<NumberInput>`:
     ```tsx
     <NumberInput
       type="number"
       aria-label="Target batch size in liters"
       step="1"
       min="1"
       value={targetScaleL}
       onChange={(e) => setTargetScaleL(parseFloat(e.target.value) || 1)}
       width="full"
       className="flex-1"
     />
     ```
   - Scale modal current batch size readback renders:
     ```tsx
     <strong className={`text-amber-400 ${MONO_VALUE_CLASS}`}>{recipe.equipment.batchSizeL} L</strong>
     ```
   - Imports `NumberInput` from `./components/ui` and `MONO_VALUE_CLASS` from `./components/designSystem`.
2. `apps/web/src/components/StatsHeader.tsx`:
   - All 12 secondary `font-mono tabular-nums` readback spans/divs apply `MONO_VALUE_CLASS` (or `${MONO_VALUE_CLASS}`).
   - Primary metric tiles continue applying `${METRIC_VALUE_CLASS} ${MONO_VALUE_CLASS}`.
   - Zero raw `font-mono tabular-nums` without `tracking-tight` in `StatsHeader.tsx`.
3. `apps/web/test/StatsHeader.test.tsx` and `apps/web/test/uiPrimitives.test.tsx`:
   - Extend test suites to assert all 12 secondary readbacks carry `MONO_VALUE_CLASS`.
   - Add milestone closing adoption sweep proving zero raw `<input type="number">` in the five section files and `App.tsx`.
   - Add typography parity assertion proving input value typography equals readback typography.

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Untouched.**
`designSystem.ts` continues to export exactly 28 constants. No token is added, removed, or mutated.

**RA-2 — `NumberInput.tsx` Remains Strictly Untouched.**
`NumberInput` API (`size`, `align`, `width`, `addonRight`, `className`) was settled in M32_P1 and is read-only.

**RA-3 — Preserving Existing Test IDs & Accessibility Labels.**
The scale modal input in `App.tsx` retains its exact `aria-label="Target batch size in liters"`, `step="1"`, `min="1"`, and value binding. `accessibilityAndPolish.test.tsx` passes 100% unmodified.

**RA-4 — Preserving Recipe Header Text Inputs.**
Recipe Name, Style Name, and Brewer text inputs in `App.tsx` (lines 823, 834, 845) are `type="text"` string inputs and are out of scope for `NumberInput` migration.

**RA-5 — Binding Process Note: Scope Guardrail Manifest.**
Capturing the pre-edit SHA-256 manifest is the literal first action of `/execute` before modifying any source code file.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_EXECUTION` | Milestone 32 Phase 4 closes numeric input migration and readback typography alignment across recipe designer. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Unified numeric typography and control plane. |

---

## 1. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/App.tsx` | **MODIFY** | Migrate scale modal batch size input onto `<NumberInput>` and current batch size readback onto `MONO_VALUE_CLASS`. |
| `apps/web/src/components/StatsHeader.tsx` | **MODIFY** | Unify 12 secondary readbacks onto `MONO_VALUE_CLASS`. |
| `apps/web/test/StatsHeader.test.tsx` | **MODIFY** | Add assertions verifying `MONO_VALUE_CLASS` on all secondary stats readbacks. |
| `apps/web/test/uiPrimitives.test.tsx` | **MODIFY** | Add Milestone 32 closing adoption assertions (zero raw `<input type="number">` in 5 section files + `App.tsx`, entered vs readback typography parity). |

---

## 2. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `designSystem.ts` and `NumberInput.tsx` confirmed byte-identical (RA-1, RA-2) | Verification | SHA-256 identical pre/post. 28 exports unchanged. |
| **AC-2** | `App.tsx` scale modal target batch size renders via `<NumberInput>` | Component Test | Target batch size input renders `<NumberInput>` with `type="number"`, `min="1"`, `step="1"`, and `MONO_VALUE_CLASS`. |
| **AC-3** | `App.tsx` scale modal retains `aria-label="Target batch size in liters"` | Component Test | `getByLabelText('Target batch size in liters')` resolves cleanly to the scale input. |
| **AC-4** | `App.tsx` scale modal current batch size readback carries `MONO_VALUE_CLASS` | Component Test | Current batch size strong element carries `font-mono tabular-nums tracking-tight`. |
| **AC-5** | `App.tsx` contains zero raw `<input type="number">` | Source Sweep | Regex search for `<input[^>]*type=["']number["']` in `App.tsx` returns 0 matches. |
| **AC-6** | `StatsHeader.tsx` top-bar batch size readback (`MSH-1`) carries `MONO_VALUE_CLASS` | Component Test | Batch size value carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-7** | `StatsHeader.tsx` top-bar pre-boil volume readback (`MSH-2`) carries `MONO_VALUE_CLASS` | Component Test | Pre-boil volume value carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-8** | `StatsHeader.tsx` top-bar efficiency readback (`MSH-3`) carries `MONO_VALUE_CLASS` | Component Test | Brewhouse efficiency value carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-9** | `StatsHeader.tsx` pre-boil gravity sub-line (`MSH-4`) carries `MONO_VALUE_CLASS` | Component Test | Pre-boil OG text line carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-10** | `StatsHeader.tsx` attenuation sub-line (`MSH-5`) carries `MONO_VALUE_CLASS` | Component Test | Attenuation text line carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-11** | `StatsHeader.tsx` color EBC annotation (`MSH-6`) carries `MONO_VALUE_CLASS` | Component Test | EBC text span carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-12** | `StatsHeader.tsx` RBR sub-line (`MSH-7`) carries `MONO_VALUE_CLASS` | Component Test | RBR text line carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-13** | `StatsHeader.tsx` total grain readback (`MSH-8`) carries `MONO_VALUE_CLASS` | Component Test | Total grain value carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-14** | `StatsHeader.tsx` total hops readback (`MSH-9`) carries `MONO_VALUE_CLASS` | Component Test | Total hops value carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-15** | `StatsHeader.tsx` mash water readback (`MSH-10`) carries `MONO_VALUE_CLASS` | Component Test | Mash water value carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-16** | `StatsHeader.tsx` sparge water readback (`MSH-11`) carries `MONO_VALUE_CLASS` | Component Test | Sparge water value carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-17** | `StatsHeader.tsx` total water readback (`MSH-12`) carries `MONO_VALUE_CLASS` | Component Test | Total water value carries `font-mono`, `tabular-nums`, `tracking-tight`. |
| **AC-18** | Zero raw `font-mono tabular-nums` without `tracking-tight` in `StatsHeader.tsx` | Source Sweep | All numeric readbacks in `StatsHeader.tsx` use `MONO_VALUE_CLASS`. |
| **AC-19** | Milestone 32 Adoption: Zero raw `<input type="number">` in 5 section files | Static Sweep (`uiPrimitives.test.tsx`) | HopSection, FermentableSection, MiscSection, YeastSection, MashSection contain 0 raw `<input type="number">`. |
| **AC-20** | Milestone 32 Adoption: Zero raw `<input type="number">` in `App.tsx` | Static Sweep (`uiPrimitives.test.tsx`) | `App.tsx` contains 0 raw `<input type="number">`. |
| **AC-21** | Typography Parity: Entered numeric inputs share `MONO_VALUE_CLASS` with readbacks | Integration Test | Inputs in HopSection / FermentableSection / MiscSection / YeastSection and readbacks in StatsHeader / MashSection share `font-mono tabular-nums tracking-tight`. |
| **AC-22** | Dimension & Geometry Parity: Standard controls render `h-10` / `rounded-lg`, compact controls render `px-2.5` / `py-1` | Integration Test | Controls across sections match designated size band classes. |
| **AC-23** | All pre-existing `StatsHeader.test.tsx` tests pass unmodified | Existing Tests | All unit conversion, formula label, and Plato/SG tests pass 100%. |
| **AC-24** | All pre-existing `App.test.tsx` tests pass unmodified | Existing Tests | Scale modal and recipe editor tests in `App.test.tsx` pass 100%. |
| **AC-25** | M14 accessibility guarantees in `accessibilityAndPolish.test.tsx` pass unmodified | Existing Tests | Scale modal dialog semantics and ingredient table accessibility pass cleanly. |
| **AC-26** | Scope Guardrail — pre/post SHA-256 content manifest | Verification | Exactly 4 authorized files modified, 0 created, 0 deleted. |
| **AC-27** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 (>= 2,183 passed across 121 files). |
| **AC-28** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 workspaces clean). |
| **AC-29** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-30** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |
| **AC-31** | Manual verification screenshot (best-effort) | Verification | `M32_P4_identity_scale_readback.png` saved to `.gsd/active/manual_verification/` if browser automation available. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Modify (4 files)
1. `apps/web/src/App.tsx`
2. `apps/web/src/components/StatsHeader.tsx`
3. `apps/web/test/StatsHeader.test.tsx`
4. `apps/web/test/uiPrimitives.test.tsx`

### 3.2 Authorized to Create
**None.**

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, 28 constants).
- `apps/web/src/components/ui/NumberInput.tsx` and `ui/index.ts`.
- `HopSection.tsx`, `FermentableSection.tsx`, `MiscSection.tsx`, `YeastSection.tsx`, `MashSection.tsx`.
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
- **`M32_P4_identity_scale_readback.png`**: Screenshots of `StatsHeader` and `App.tsx` Scale Recipe modal illustrating unified numeric typography (`font-mono tabular-nums tracking-tight`) across entered numbers and displayed readbacks.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
