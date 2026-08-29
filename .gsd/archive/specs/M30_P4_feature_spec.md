# FEATURE SPECIFICATION: M30_P4 - The Hub Itself & UI Primitives Adoption Guardrail

> **Milestone 30:** "The calculators all look like one tool." (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 4 of 4.** Closing phase for Milestone 30. Migrates `Calculators.tsx`'s category filter buttons onto `<Button>`, establishes the milestone's adoption assertions and focus-treatment parity test, verifies all 10 calculator cards against the primitive layer, and captures final milestone manual verification evidence.

---

## Phase Summary

In Phase 1, form-control tokens in `designSystem.ts` were repaired to expose keyboard focus rings app-wide, and `FORM_LABEL_CLASS` and `CONTROL_HEIGHT_CLASS` were added.
In Phase 2, `components/ui/` was born with `<FormField>`, `<Input>`, and `<Select>`, and `CalculatorCard.tsx` was re-pointed onto them.
In Phase 3, `<Button>` and `<NumberInput>` were added to `components/ui/`, and `CalculatorCard.tsx` was unified onto `CARD_CLASS`, `SUBPANEL_CLASS`, and `MONO_VALUE_CLASS`.

In Phase 4, we complete and close Milestone 30:
1. Migrate `apps/web/src/pages/Calculators.tsx`'s 5 category filter buttons from raw `<button>` elements onto `<Button>` from `components/ui/`.
2. Verify that all 10 calculator cards render their controls and container shells through `components/ui/` and `CalculatorCard.tsx`.
3. Author the Milestone 30 **Adoption Guardrail assertions**:
   - Statically verify all 10 calculator cards import and render through `CalculatorCard` and `components/ui/`.
   - Statically verify zero raw `<input>` (type text/number) or raw `<select>` elements exist across `apps/web/src/components/calculators/` (outside `CalculatorCard.tsx`'s primitive wiring and `StrikeWaterCalculator.tsx`'s thermal mass checkbox).
   - Statically verify zero raw `<button>` elements exist in `apps/web/src/pages/Calculators.tsx` (all buttons render through `<Button>`).
   - Integration test proving keyboard-focused inputs and keyboard-focused buttons display unified amber focus ring styling (`focus-visible:outline-amber-500`, `focus-visible:outline-2`).
   - Integration test proving calculator fields evaluate to universal 40px `h-10` height and `rounded-lg` corners.
4. Capture manual verification evidence for the full Calculators hub.

**Why this satisfies vertical-slice constraints (Hard Rule 2):**
This phase connects the final user-facing controls on the Calculators hub (`Calculators.tsx`) to the primitive layer, asserts that all 10 calculator tools conform to the unified design tokens without bypassing the primitive boundary, and closes Milestone 30 with four passing Layer 1 gates.

---

## Key Behaviors

1. In `apps/web/src/pages/Calculators.tsx`, the 5 category filter controls ("All", "Water & Mash", "Gravity & Refractometry", "Yeast & Pitching", "Hops & Carbonation") render as `<Button>` components imported from `../components/ui`.
2. All category filter buttons preserve their `aria-pressed`, `onClick`, and active/inactive visual styling, maintaining 100% test compatibility with `Calculators.test.tsx`.
3. All 10 calculator cards (`StrikeWaterCalculator`, `InfusionVolumeCalculator`, `HydrometerCalculator`, `RefractometerCalculator`, `GravityCorrectionCalculator`, `PitchRateCalculator`, `StarterGrowthCalculator`, `HopDecayCalculator`, `CarbonationCalculator`, `UnitConverterCalculator`) render exclusively via `CalculatorCard`, `NumericField`, `SelectField`, and `ResultRow`.
4. Automated adoption guardrail tests verify:
   - Zero raw `<input type="text">` or `<input type="number">` elements exist in `components/calculators/`.
   - Zero raw `<select>` elements exist in `components/calculators/`.
   - Zero raw `<button>` elements exist in `pages/Calculators.tsx`.
   - Focused `<NumberInput>` and focused `<Button>` share identical 2px amber `:focus-visible` focus ring styles.
5. All 10 calculator cards remain interactive and calculate accurate brewing physics across metric and imperial unit configurations.

---

## Resolved Ambiguities (Binding)

**RA-1 — `Calculators.tsx` Category Button Migration.**
The 5 category filter buttons in `apps/web/src/pages/Calculators.tsx` are migrated to `<Button>`:
```tsx
<Button
  aria-pressed={activeCategory === 'All'}
  className={`${PILL_BASE} ${activeCategory === 'All' ? ACTIVE_PILL : INACTIVE_PILL}`}
  onClick={() => setActiveCategory('All')}
>
  All
</Button>
```
`<Button>` defaults to `type="button"`, applies base button classes, and merges `className` cleanly. Active and inactive pill visual styles and accessibility properties (`role="group"`, `aria-label="Calculator Categories"`, `aria-pressed`) remain intact.

**RA-2 — Checkbox Input Exemption in `StrikeWaterCalculator.tsx`.**
`StrikeWaterCalculator.tsx` includes an inline `<input id="strike-calc-thermal-mass-toggle" type="checkbox" ...>` for toggling vessel thermal mass calculations (added in M11_P2). Because checkbox primitives are not in scope for Milestone 30 (which focuses on text inputs, numeric inputs, selects, and buttons), the adoption guardrail explicitly audits for raw text/number inputs and selects, while permitting the existing thermal mass checkbox toggle.

**RA-3 — Focus Treatment Parity Assertion.**
The adoption test suite verifies that both `<NumberInput>` / `<Input>` and `<Button>` render with `focus-visible:outline-2`, `focus-visible:outline-offset-2`, and `focus-visible:outline-amber-500` (or compose `INPUT_CLASS` / `BUTTON_*_CLASS` tokens carrying them), guaranteeing consistent keyboard navigation across the entire page.

**RA-4 — `calculatorImportGraph.test.ts` Invariants.**
`Calculators.tsx` imports `{ Button }` from `../components/ui`. `apps/web/test/calculatorImportGraph.test.ts`'s allowlist already includes `components/ui.tsx` (and `components/designSystem.tsx`), so this import conforms to the closed allowlist without requiring allowlist expansion.

**RA-5 — `designSystem.ts` remains strictly constants-only and untouched.**
`designSystem.ts` is not modified. It continues to export exactly 28 constants. `designSystem.test.ts` passes unmodified.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_PLANNING` | Milestone 30 completes Phase 4 (universal 40px control plane and primitives adoption on Calculators hub). Remainder spans M31–M35. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Hub controls and calculator cards unified onto design tokens. |

---

## 1. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/pages/Calculators.tsx` | **MODIFY** | Migrate category filter buttons from raw `<button>` to `<Button>` imported from `../components/ui`. |
| `apps/web/test/uiPrimitives.test.tsx` | **MODIFY** | Add Milestone 30 adoption assertions, focus-treatment parity assertions, and zero-raw-element sweeps for `components/calculators/` and `pages/Calculators.tsx`. |

---

## 2. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `Calculators.tsx` renders category pills using `<Button>` | Component / Static | The 5 category filter buttons in `Calculators.tsx` render via `<Button>` from `components/ui`. |
| **AC-2** | Category filter buttons default to `type="button"` | Component Test | All 5 filter buttons carry `type="button"`. |
| **AC-3** | Category filter group retains `role="group"` and `aria-label` | Accessibility Test | Group container carries `role="group"` and `aria-label="Calculator Categories"`. |
| **AC-4** | Active category button carries `aria-pressed="true"`, others `"false"` | Component Test | Active category has `aria-pressed="true"`; inactive categories have `aria-pressed="false"`. |
| **AC-5** | Clicking category button filters visible calculator cards | Integration Test | Clicking "Water & Mash", "Gravity & Refractometry", "Yeast & Pitching", "Hops & Carbonation", or "All" filters cards appropriately. |
| **AC-6** | Zero raw `<input type="text">` or `<input type="number">` in `components/calculators/` | Static Analysis Sweep | Source files in `components/calculators/` contain zero raw text/number input tags outside `CalculatorCard.tsx`'s primitive wiring. |
| **AC-7** | Zero raw `<select>` elements in `components/calculators/` | Static Analysis Sweep | Source files in `components/calculators/` contain zero raw `<select>` tags outside `CalculatorCard.tsx`'s primitive wiring. |
| **AC-8** | Zero raw `<button>` elements in `pages/Calculators.tsx` | Static Analysis Sweep | `apps/web/src/pages/Calculators.tsx` contains zero raw `<button>` tags outside `<Button>` primitive usage. |
| **AC-9** | All 10 calculator cards import and render through `CalculatorCard` | Static Analysis Sweep | All 10 calculator component files import and render `CalculatorCard` and its field primitives. |
| **AC-10** | Focused input and focused button exhibit matching amber focus-visible rings | Unit / CSS Test | Both `<NumberInput>` / `<Input>` and `<Button>` render with `focus-visible:outline-amber-500`, `focus-visible:outline-2`, and `focus-visible:outline-offset-2`. |
| **AC-11** | Calculator inputs and selects match in universal 40px height (`h-10`) | Unit / CSS Test | Both `<NumberInput>` and `<Select>` in `CalculatorCard` evaluate to `h-10` and `rounded-lg`. |
| **AC-12** | Calculator inputs and result outputs share `MONO_VALUE_CLASS` typography | Unit / CSS Test | Both `<NumberInput>` and `ResultRow` apply `font-mono tabular-nums tracking-tight`. |
| **AC-13** | Strike Water Calculator calculates accurate temperatures across units | Regression Test | Strike water temperature produces expected values under Celsius and Fahrenheit. |
| **AC-14** | Infusion Volume Calculator computes accurate step infusion volumes | Regression Test | Infusion volume calculates accurately under Metric and US units. |
| **AC-15** | Hydrometer Calculator computes temperature-corrected gravities | Regression Test | Hydrometer temperature correction produces expected SG and Plato readouts. |
| **AC-16** | Refractometer Calculator computes Brix to SG with alcohol correction | Regression Test | Refractometer calculation produces expected OG and FG values. |
| **AC-17** | Gravity Correction Calculator computes dilution, DME, and boil time | Regression Test | Gravity correction computes expected adjustments. |
| **AC-18** | Pitch Rate and Starter Growth Calculators compute yeast metrics | Regression Test | Yeast pitching and starter growth cards calculate expected cell counts and extract weights. |
| **AC-19** | Hop Decay and Carbonation Calculators compute storage and carbonation | Regression Test | Hop decay and carbonation cards produce expected residual CO2, priming sugar, and force carb PSI. |
| **AC-20** | Unit Converter Calculator converts across all 6 unit families | Regression Test | Unit converter card renders all conversion rows accurately. |
| **AC-21** | Scope Guardrail — authorized files only | Verification | SHA-256 pre/post manifest diff matches authorized set: 0 created, 2 modified (`Calculators.tsx`, `uiPrimitives.test.tsx`), 0 deleted. |
| **AC-22** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 across all workspaces. |
| **AC-23** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 clean). |
| **AC-24** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-25** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |
| **AC-26** | Manual verification screenshot captured | Verification | Screenshot `M30_P4_calculators_hub_adoption.png` saved in `.gsd/active/manual_verification/`. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Modify (2 files)
1. `apps/web/src/pages/Calculators.tsx`
2. `apps/web/test/uiPrimitives.test.tsx`

### 3.2 Authorized to Create
**None.**

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, constants-only).
- Any calculator component in `apps/web/src/components/calculators/*.tsx` (already verified and complete in P2/P3).
- `package.json`, `package-lock.json`.
- Any file in `packages/**` or `apps/api/**`.

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
- **`M30_P4_calculators_hub_adoption.png`**: Screenshot of the full Calculators hub showcasing category filter buttons rendered via `<Button>`, unified 40px `h-10` input/select fields, `rounded-lg` cards, and consistent monospace readouts across calculator cards.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**

