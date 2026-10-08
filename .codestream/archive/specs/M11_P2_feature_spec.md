# Feature Specification: Milestone 11 Phase 2 (M11_P2: UI & Interactive Physics Integration)

## 1. Executive Summary & Scope

Milestone 11 Phase 2 (M11_P2) completes the user-facing and interactive integration of the brewing physics depth built in M11_P1:
1. **Water Chemistry Acid Additions UI (`FEAT-001`)**: Acid dosage calculator card in `WaterSection.tsx` showing Lactic 88%, Phosphoric 75%, and Acidulated Malt requirements with live target vs predicted mash pH comparison.
2. **High-Precision Equipment Profile UI (`FEAT-006`, `BUG-012`)**: Form controls in `EquipmentForm.tsx` for Altitude (with live boiling point & hop utilization factor), Thermal Mass toggle with dry vessel weight and specific heat ($c_t$), enzyme denaturing safety warning (> 78.0°C), and dead space / kettle loss fields.
3. **Contextual Hop Schedule Controls (`FEAT-007`, `BUG-014`)**: Dynamic timing controls in `HopSection.tsx` tailored to hop use (Boil duration in min, Whirlpool steep minutes @ temp °C, Dry Hop day offset & duration in days).
4. **Calculators Alignment**: `StrikeWaterCalculator.tsx` updated with thermal mass toggle and enzyme limit warning banner.

---

## 2. File Organization & Boundaries

### 2.1 Modified Files
- `apps/web/src/components/WaterSection.tsx`: Acid additions calculation card & live mash pH adjustment preview.
- `apps/web/src/components/EquipmentForm.tsx`: Altitude, thermal mass toggle, tun weight, heat capacity, dead space, kettle loss inputs, and live boiling/enzyme warnings.
- `apps/web/src/components/HopSection.tsx`: Contextual timing table columns and inputs for Boil, Whirlpool, and DryHop additions.
- `apps/web/src/components/calculators/StrikeWaterCalculator.tsx`: Thermal mass toggle, tun weight, and enzyme limit safety warning banner.
- `apps/web/src/components/MashSection.tsx`: Live strike temperature display with thermal mass awareness and enzyme safety indicator.
- `apps/web/test/WaterSection.test.tsx`: Component tests for acid additions calculations and display.
- `apps/web/test/EquipmentForm.test.tsx`: Component tests for equipment physics controls and live derivations.
- `apps/web/test/HopSection.test.tsx`: Component tests for contextual hop timing inputs and validation.

### 2.2 Untouched Files (Protected)
- `packages/calculations/` (already fully verified in M11_P1)
- `apps/api/` (already fully verified in M11_P1)
- `packages/shared-types/` (already fully verified in M11_P1)
- `.gsd/archive/` (append-only)

---

## 3. Data Schema & Component Contracts

### 3.1 WaterSection Acid Additions UI Contract
- Render an **Acid Additions** card within `WaterSection`:
  - **Inputs**: Target Mash pH (defaults to `recipe.mashProfile?.targetPh ?? 5.30`), editable numeric input.
  - **Calculations**: Invokes `calculateAcidAdditions(totalGrainKg, predictedMashPh, targetMashPh)`.
  - **Display**: When `predictedMashPh > targetMashPh`:
    - Displays `Lactic Acid 88%`: `${result.lacticAcid88Ml.toFixed(1)} mL`
    - Displays `Phosphoric Acid 75%`: `${result.phosphoricAcid75Ml.toFixed(1)} mL`
    - Displays `Acidulated Malt`: `${Math.round(result.acidulatedMaltGrams)} g`
  - When `predictedMashPh <= targetMashPh`: Displays green status badge: `"No acid addition needed (Mash pH on target)"`.

### 3.2 EquipmentForm Physics Controls Contract
- Grouped into intuitive sections in `EquipmentForm.tsx`:
  - **Altitude & Atmospheric Physics**:
    - `altitudeMeters`: Number input (-500 to 9000 m).
    - Live helper text: Displays calculated boiling point: `Boiling Point: ${calculateBoilingPoint(altitude).toFixed(1)}°C` and hop utilization scaling factor `(${Math.round(factor * 100)}%)`.
  - **Thermal Mass Strike Energy Balance**:
    - `calcStrikeWithThermalMass`: Checkbox / toggle switch.
    - When checked, reveals `mashTunWeightKg` (kg) and `mashTunHeatCapacity` ($c_t$, default `0.12`).
    - Live strike temperature preview calculated via `calculateStrikeTemperature`.
    - If `strikeTempExceedsEnzymeLimit`: Displays amber warning banner: `"Warning: Calculated strike temperature (${temp}°C) exceeds 78.0°C — risk of denaturing starch conversion enzymes during dough-in."`
  - **Losses & Volumes**:
    - `mashTunDeadSpaceL`: Number input (L).
    - `kettleLossL`: Number input (L).

### 3.3 HopSection Contextual Timing Table Contract
- The hop table dynamically adjusts column headers and input fields per row:
  - **Use === 'Boil'**:
    - Time field: `boilMins` input (min, e.g. 60). Label/placeholder: `"Boil (min)"`.
  - **Use === 'Whirlpool'**:
    - Time field: `whirlpoolMins` input (min, e.g. 20).
    - Temp field: `whirlpoolTempC` input (°C, e.g. 80.0°C). Label/placeholder: `"Steep min @ °C"`.
  - **Use === 'DryHop'**:
    - Offset field: `dryHopDayOffset` integer input (days, e.g. 3).
    - Duration field: `dryHopDurationDays` number input (days, e.g. 4). Label/placeholder: `"Day offset + Duration (days)"`.
  - **Use === 'FirstWort' | 'Aroma'**:
    - Appropriate contextual inputs preserving existing behaviour.

---

## 4. Acceptance Criteria Matrix

| ID | Category | Requirement | Test Verification |
| :--- | :--- | :--- | :--- |
| **AC-1** | Water UI | `WaterSection` renders Acid Additions card with Target Mash pH, Predicted Mash pH, and delta | `WaterSection.test.tsx` |
| **AC-2** | Water UI | When Target pH < Predicted pH, displays accurate Lactic 88%, Phosphoric 75%, and Acidulated Malt dosages | `WaterSection.test.tsx` |
| **AC-3** | Water UI | When Target pH >= Predicted pH, renders "No acid addition needed" indicator with 0 mL/0 g | `WaterSection.test.tsx` |
| **AC-4** | Water UI | Target pH changes in `WaterSection` update acid dosages in real time | `WaterSection.test.tsx` |
| **AC-5** | Equipment UI | `EquipmentForm` renders Altitude input and displays live calculated boiling point ($T_{\text{boil}}$) | `EquipmentForm.test.tsx` |
| **AC-6** | Equipment UI | `EquipmentForm` renders Thermal Mass toggle, revealing vessel weight and heat capacity inputs when enabled | `EquipmentForm.test.tsx` |
| **AC-7** | Equipment UI | Live strike temperature in `EquipmentForm` and `MashSection` updates when thermal mass toggle changes | `EquipmentForm.test.tsx`, `MashSection.test.tsx` |
| **AC-8** | Equipment UI | Enzyme safety warning banner appears when calculated strike temperature > 78.0°C | `EquipmentForm.test.tsx`, `StrikeWaterCalculator.test.tsx` |
| **AC-9** | Equipment UI | `EquipmentForm` renders inputs for `mashTunDeadSpaceL` and `kettleLossL` and saves to profile | `EquipmentForm.test.tsx` |
| **AC-10** | Hop UI | `HopSection` renders contextual input columns based on `HopUse` (Boil, Whirlpool, DryHop) | `HopSection.test.tsx` |
| **AC-11** | Hop UI | Boil hop rows edit `boilMins`; Whirlpool rows edit `whirlpoolMins` and `whirlpoolTempC` | `HopSection.test.tsx` |
| **AC-12** | Hop UI | DryHop rows edit `dryHopDayOffset` and `dryHopDurationDays` with clear day semantics | `HopSection.test.tsx` |
| **AC-13** | Hop UI | Changing hop use dynamically switches the visible input fields without corrupting other row values | `HopSection.test.tsx` |
| **AC-14** | Hop UI | IBU display in `HopSection` updates live and reflects altitude scaling from recipe's equipment profile | `HopSection.test.tsx` |
| **AC-15** | Calculator UI | `StrikeWaterCalculator` includes thermal mass toggle, tun weight input, and enzyme safety alert | `calculatorImportGraph.test.ts`, `StrikeWaterCalculator.test.tsx` |
| **AC-16** | Integration | Saving and reloading an equipment profile preserves all new physics and loss settings in UI | `App.test.tsx` / `EquipmentManager.test.tsx` |
| **AC-17** | Integration | Saving and reloading a recipe preserves contextual hop timing and acid addition state in UI | `App.test.tsx` / `useRecipeEditor.test.tsx` |
| **AC-18** | Quality | Layer 1 Four Gates pass cleanly (`npm test`, `npm run typecheck`, `npm run build`, `npm run lint`) | Monorepo root check |
| **AC-19** | Backlog | `BUG-012` and `BUG-014` updated to `VERIFIED_RESOLVED` in `.gsd/BUGS.md` upon completion | `.gsd/BUGS.md` check |

---

## 5. Scope Guardrails & Non-Goals

- **Non-Goal**: We do not alter underlying database migrations or calculation packages (already completed and certified in M11_P1).
- **Non-Goal**: We do not alter batch pipeline transition logic; batch detail reading logs remain unchanged.
- **Untouched List**: `packages/calculations/`, `apps/api/src/db/`, `packages/shared-types/src/` remain untouched.

---

## 6. Pre-Execution SHA-256 Manifest
Before execution begins, generate pre-execution SHA-256 manifest at `.gsd/archive/manual_verification/M11_P2/pre_exec_manifest.json`.
