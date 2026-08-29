# FEATURE SPECIFICATION: M31_P2 - The Mid-Sized Profiles (`MashProfileForm` & `WaterProfileForm` Label Association)

> **Milestone 31:** "The forms for your kit and your stock introduce themselves" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 2 of 4.** Migrates `MashProfileForm.tsx` (7 unnamed controls per mash step row) and `WaterProfileForm.tsx` (10 unnamed controls) onto `<FormField>` and `components/ui/` primitives, establishing complete accessible name resolution and clickable label focus.

---

## Phase Summary

In Milestone 31 Phase 1, we hardened `FormField`'s automatic `useId`-driven `id`/`htmlFor` association and proved it across `EquipmentForm.tsx` and `FermentationProfileForm.tsx`.

In Milestone 31 Phase 2, we migrate the two mid-sized profile editors:
1. **`MashProfileForm.tsx` Migration:**
   - Migrates profile name, target pH, and sparge temperature override to render through `<FormField>` and UI primitives (`<Input>`, `<NumberInput>`).
   - Migrates all dynamic mash step rows (up to 20 steps) to render all 7 step fields through `<FormField>` with compact controls (`<Input size="sm">`, `<Select size="sm">`, `<NumberInput size="sm">`): `Name`, `Type`, `Temp (°C)`, `Rest (min)`, `Ramp (min)`, `Infuse Amount (L)`, and `Infuse Water Temp (°C)`.
   - Eliminates 7 completely unnamed controls per mash step row.
   - Migrates step management actions (`Add Step`, `Move Up`, `Move Down`, `Remove Step`) and TopBar buttons (`Cancel`, `Save Profile`, `Delete`) to `<Button>`.
   - Retires near-miss label classes (`block text-xs font-medium text-slate-300 mb-1` and `block text-[11px] text-slate-400 mb-1`) onto `FORM_LABEL_CLASS`.
2. **`WaterProfileForm.tsx` Migration:**
   - Migrates profile identity (`Profile Name`, `Profile Type`, `Description`) to `<FormField>` wrapping `<Input>`, `<Select>`, and `<textarea>`.
   - Migrates all 6 mineral ion concentrations (`Calcium (Ca²⁺) ppm`, `Magnesium (Mg²⁺) ppm`, `Sodium (Na⁺) ppm`, `Chloride (Cl⁻) ppm`, `Sulfate (SO₄²⁻) ppm`, `Bicarbonate (HCO₃⁻) ppm`) and `pH (Optional)` to `<FormField>` wrapping `<NumberInput>`.
   - Eliminates 10 completely unnamed controls across the water profile editor.
   - Migrates TopBar action buttons (`Cancel`, `Save Profile`, `Delete`) to `<Button>`.
3. **Accessible Name & Focus Assertions:**
   - Extend `MashProfileForm.test.tsx` and `WaterProfileForm.test.tsx` to assert that every form control resolves to an accessible name via `getByLabelText`, and clicking any field label moves focus to its associated control (`document.activeElement`).

**Why this satisfies vertical-slice constraints (Hard Rule 2):**
This phase completes accessible form-control and label association across the remaining profile editors (`MashProfileForm` and `WaterProfileForm`), providing immediate end-user accessibility and keyboard focus improvements without horizontal layering.

---

## Key Behaviors

1. `apps/web/src/components/MashProfileForm.tsx`:
   - Top-level profile name, target pH, and sparge temperature override render through `<FormField>`:
     - `Profile Name`: `<FormField label="Profile Name" required error={nameError}><Input value={name} onChange={...} placeholder="e.g. 3-Step Mash" /></FormField>`
     - `Target pH`: `<FormField label="Target pH" error={targetPhError}><NumberInput step="0.1" value={targetPh} onChange={...} /></FormField>`
     - `Sparge Temperature Override (°C)`: `<FormField label="Sparge Temperature Override (°C)" hint={...} error={spargeTempCError}><NumberInput step="1" value={spargeTempC} onChange={...} /></FormField>`
   - Dynamic mash step rows (up to 20 steps) render all 7 step fields through `<FormField>`:
     - `Name`: `<FormField label="Name" error={errors.name}><Input size="sm" value={step.name} onChange={...} /></FormField>`
     - `Type`: `<FormField label="Type"><Select size="sm" value={step.type} onChange={...}>{MASH_STEP_TYPES.map(...)}</Select></FormField>`
     - `Temp (°C)`: `<FormField label="Temp (°C)" error={errors.stepTempC}><NumberInput size="sm" step="1" value={step.stepTempC} onChange={...} /></FormField>`
     - `Rest (min)`: `<FormField label="Rest (min)" error={errors.stepTimeMin}><NumberInput size="sm" step="1" value={step.stepTimeMin} onChange={...} /></FormField>`
     - `Ramp (min)`: `<FormField label="Ramp (min)" error={errors.rampTimeMin}><NumberInput size="sm" step="1" value={step.rampTimeMin} onChange={...} /></FormField>`
     - `Infuse Amount (L)`: `<FormField label="Infuse Amount (L)" hint={errors.infuseAmountL ? undefined : "Blank = computed"} error={errors.infuseAmountL}><NumberInput size="sm" step="0.1" value={step.infuseAmountL} onChange={...} placeholder="auto" /></FormField>`
     - `Infuse Water Temp (°C)`: `<FormField label="Infuse Water Temp (°C)" error={errors.infuseWaterTempC}><NumberInput size="sm" step="1" value={step.infuseWaterTempC} onChange={...} /></FormField>`
   - All 7 controls per step row resolve to accessible names via `getByLabelText`.
   - Clicking any step label focuses its corresponding control.
   - Step management actions (`Add Step`, `Move Up`, `Move Down`, `Remove Step`) and TopBar buttons render via `<Button>`.
2. `apps/web/src/components/WaterProfileForm.tsx`:
   - Profile identity and description render through `<FormField>`:
     - `Profile Name`: `<FormField label="Profile Name" required><Input data-testid="water-form-name" value={name} onChange={...} placeholder="e.g. Balanced Tap Water" /></FormField>`
     - `Profile Type`: `<FormField label="Profile Type" required><Select data-testid="water-form-type" value={type} onChange={...}><option value="source">Source Water (Tap, Well, RO)</option><option value="target">Target Profile (Style Target)</option></Select></FormField>`
     - `Description`: `<FormField label="Description"><textarea value={description} onChange={...} placeholder="Optional notes about this water profile..." rows={2} className={`${INPUT_CLASS} text-xs`} /></FormField>`
   - All 6 mineral ion concentrations and pH render through `<FormField>` wrapping `<NumberInput>`:
     - `Calcium (Ca²⁺) ppm`: `<FormField label="Calcium (Ca²⁺) ppm" required><NumberInput data-testid="water-form-ca" step="any" min="0" value={calcium} onChange={...} /></FormField>`
     - `Magnesium (Mg²⁺) ppm`: `<FormField label="Magnesium (Mg²⁺) ppm" required><NumberInput data-testid="water-form-mg" step="any" min="0" value={magnesium} onChange={...} /></FormField>`
     - `Sodium (Na⁺) ppm`: `<FormField label="Sodium (Na⁺) ppm" required><NumberInput data-testid="water-form-na" step="any" min="0" value={sodium} onChange={...} /></FormField>`
     - `Chloride (Cl⁻) ppm`: `<FormField label="Chloride (Cl⁻) ppm" required><NumberInput data-testid="water-form-cl" step="any" min="0" value={chloride} onChange={...} /></FormField>`
     - `Sulfate (SO₄²⁻) ppm`: `<FormField label="Sulfate (SO₄²⁻) ppm" required><NumberInput data-testid="water-form-so4" step="any" min="0" value={sulfate} onChange={...} /></FormField>`
     - `Bicarbonate (HCO₃⁻) ppm`: `<FormField label="Bicarbonate (HCO₃⁻) ppm" required><NumberInput data-testid="water-form-hco3" step="any" min="0" value={bicarbonate} onChange={...} /></FormField>`
     - `pH (Optional)`: `<FormField label="pH (Optional)"><NumberInput data-testid="water-form-ph" step="0.1" min="0" max="14" value={ph} onChange={...} placeholder="e.g. 7.4" /></FormField>`
   - All 10 controls in `WaterProfileForm.tsx` resolve to accessible names via `getByLabelText`.
   - Clicking any label focuses its associated input/select.
   - TopBar buttons (Cancel, Save Profile, Delete) render via `<Button>`.

---

## Resolved Ambiguities (Binding)

**RA-1 — `FormField` Support for Textarea & Native Children.**
`FormField` assigns generated/explicit `id` to single child `<textarea>` elements and renders `<label htmlFor={id}>` identically to input and select controls.

**RA-2 — Required Asterisk Rendering via `required={true}`.**
In `WaterProfileForm.tsx`, fields previously had manual asterisks in the label text strings (e.g. `Profile Name *`). With `<FormField>`, `required={true}` is passed as a prop, rendering the canonical amber asterisk `<span className="text-amber-500 ml-0.5">*</span>`.

**RA-3 — Accessible Name Query Matching in Tests.**
Testing-library `getByLabelText` matches labels containing asterisks and chemical notation (e.g. `getByLabelText(/profile name/i)` or `getByLabelText('Profile Name')`, `getByLabelText(/calcium/i)` or `getByLabelText('Calcium (Ca²⁺) ppm')`).

**RA-4 — Preserving TestIDs & Validation Rules.**
Existing `data-testid` attributes (`water-form-name`, `water-form-type`, `water-form-ca`, `water-form-mg`, `water-form-na`, `water-form-cl`, `water-form-so4`, `water-form-hco3`, `water-form-ph`, `mash-step-row-${index}`, `mash-delete`, `water-delete`) and error handling logic are preserved 100%.

**RA-5 — `designSystem.ts` Remains Untouched.**
`designSystem.ts` is not modified. It continues to export exactly 28 constants.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_EXECUTION` | Milestone 31 Phase 2 delivers accessible name wiring and UI primitives adoption on `MashProfileForm` and `WaterProfileForm`. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Accessible form fields and unified control plane. |

---

## 1. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/components/MashProfileForm.tsx` | **MODIFY** | Migrate profile fields, 7 step controls per row, and buttons to `components/ui/` primitives and `<FormField>`. |
| `apps/web/src/components/WaterProfileForm.tsx` | **MODIFY** | Migrate profile name, type, description, 6 ion fields, pH, and buttons to `components/ui/` primitives and `<FormField>`. |
| `apps/web/test/MashProfileForm.test.tsx` | **MODIFY** | Add label-click focus assertions and `getByLabelText` queries across all fields and step rows. |
| `apps/web/test/WaterProfileForm.test.tsx` | **MODIFY** | Add comprehensive assertions proving all 10 controls resolve via `getByLabelText` and focus on label click. |

---

## 2. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `MashProfileForm` profile name is accessible via `getByLabelText('Profile Name')` | Component Test | `getByLabelText(/profile name/i)` returns the name text input. |
| **AC-2** | `MashProfileForm` target pH is accessible via `getByLabelText('Target pH')` | Component Test | `getByLabelText(/target ph/i)` returns the target pH number input. |
| **AC-3** | `MashProfileForm` sparge temp override is accessible via `getByLabelText('Sparge Temperature Override (°C)')` | Component Test | `getByLabelText(/sparge temperature override/i)` returns the sparge temp input. |
| **AC-4** | Clicking top-level labels in `MashProfileForm` focuses their corresponding input | Component / Interaction | Clicking `screen.getByText(/target ph/i)` focuses the target pH input (`document.activeElement`). |
| **AC-5** | Mash step Name field is accessible via `getByLabelText('Name')` | Component Test | `within(stepRow).getByLabelText('Name')` returns the step name input. |
| **AC-6** | Mash step Type field is accessible via `getByLabelText('Type')` | Component Test | `within(stepRow).getByLabelText('Type')` returns the step type select dropdown. |
| **AC-7** | Mash step Temp field is accessible via `getByLabelText('Temp (°C)')` | Component Test | `within(stepRow).getByLabelText('Temp (°C)')` returns the temperature input. |
| **AC-8** | Mash step Rest field is accessible via `getByLabelText('Rest (min)')` | Component Test | `within(stepRow).getByLabelText('Rest (min)')` returns the rest duration input. |
| **AC-9** | Mash step Ramp field is accessible via `getByLabelText('Ramp (min)')` | Component Test | `within(stepRow).getByLabelText('Ramp (min)')` returns the ramp time input. |
| **AC-10** | Mash step Infuse Amount field is accessible via `getByLabelText('Infuse Amount (L)')` | Component Test | `within(stepRow).getByLabelText('Infuse Amount (L)')` returns the infusion volume input. |
| **AC-11** | Mash step Infuse Water Temp field is accessible via `getByLabelText('Infuse Water Temp (°C)')` | Component Test | `within(stepRow).getByLabelText('Infuse Water Temp (°C)')` returns the infusion temp input. |
| **AC-12** | Clicking any mash step label focuses its corresponding control | Component / Interaction | Clicking `within(stepRow).getByText('Rest (min)')` focuses the rest duration input. |
| **AC-13** | Mash step actions (`Add Step`, `Move Up`, `Move Down`, `Remove Step`) and TopBar buttons render via `<Button>` | Component Test | Step management actions and TopBar buttons render as `<Button>`. |
| **AC-14** | `MashProfileForm` step validation, reordering, and 20-step maximum limit hold | Regression Test | Step validation errors, reordering mechanics, and 20-step limit function accurately. |
| **AC-15** | `WaterProfileForm` profile name is accessible via `getByLabelText('Profile Name')` | Component Test | `getByLabelText(/profile name/i)` returns the profile name text input. |
| **AC-16** | `WaterProfileForm` profile type is accessible via `getByLabelText('Profile Type')` | Component Test | `getByLabelText(/profile type/i)` returns the profile type select dropdown. |
| **AC-17** | `WaterProfileForm` description is accessible via `getByLabelText('Description')` | Component Test | `getByLabelText(/description/i)` returns the description textarea. |
| **AC-18** | All 6 `WaterProfileForm` mineral ion fields (`Ca²⁺`, `Mg²⁺`, `Na⁺`, `Cl⁻`, `SO₄²⁻`, `HCO₃⁻`) are accessible via `getByLabelText` | Component Test | `getByLabelText(/calcium/i)`, `getByLabelText(/magnesium/i)`, `getByLabelText(/sodium/i)`, `getByLabelText(/chloride/i)`, `getByLabelText(/sulfate/i)`, `getByLabelText(/bicarbonate/i)` all resolve cleanly. |
| **AC-19** | `WaterProfileForm` pH field is accessible via `getByLabelText('pH (Optional)')` | Component Test | `getByLabelText(/ph/i)` returns the pH input. |
| **AC-20** | Clicking any label in `WaterProfileForm` focuses its corresponding input / select / textarea | Component / Interaction | Clicking `screen.getByText(/calcium/i)` focuses the calcium input (`document.activeElement`). |
| **AC-21** | `WaterProfileForm` action buttons render via `<Button>` | Component Test | Cancel, Save Profile, and Delete buttons render as `<Button>`. |
| **AC-22** | Zero bare `<label className=...>` in `MashProfileForm.tsx` and `WaterProfileForm.tsx` | Static Analysis Sweep | All labels in both files render via `<FormField>`. |
| **AC-23** | Scope Guardrail — authorized files only | Verification | SHA-256 manifest diff matches authorized set: 0 created, 4 modified (`MashProfileForm.tsx`, `WaterProfileForm.tsx`, `MashProfileForm.test.tsx`, `WaterProfileForm.test.tsx`), 0 deleted. |
| **AC-24** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 across all workspaces. |
| **AC-25** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 clean). |
| **AC-26** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-27** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |
| **AC-28** | Manual verification screenshot captured | Verification | Screenshot `M31_P2_mash_water_labels.png` saved in `.gsd/active/manual_verification/`. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Modify (4 files)
1. `apps/web/src/components/MashProfileForm.tsx`
2. `apps/web/src/components/WaterProfileForm.tsx`
3. `apps/web/test/MashProfileForm.test.tsx`
4. `apps/web/test/WaterProfileForm.test.tsx`

### 3.2 Authorized to Create
**None.**

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, constants-only).
- `apps/web/src/components/InventoryForm.tsx` (reserved for P3/P4).
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
- **`M31_P2_mash_water_labels.png`**: Screenshots of `MashProfileForm` and `WaterProfileForm` showcasing unified `FORM_LABEL_CLASS` label styling, 40px control plane, and accessible mash step rows & water ion inputs.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**

