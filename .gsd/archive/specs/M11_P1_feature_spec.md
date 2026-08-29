# Feature Specification: M11_P1 — Brewing Physics & Calculations Depth (Calculations Engine, Schema & APIs)

## 1. Context & Scope

Milestone 11 expands the scientific fidelity, calculation precision, and domain modeling of TruchaBrew. Phase 1 focuses on the core physics calculations, shared data contracts, SQLite database schema expansions, and REST API layers:

1. **Water Chemistry Acid Additions & Mash pH Neutralization (`FEAT-001`):**
   - Pure calculation engine in `packages/calculations/src/water.ts` for predicting mash pH shift from organic acids:
     - **Lactic Acid 88%** (density ~1.206 g/mL, normality ~11.8 mEq/mL).
     - **Phosphoric Acid 75%** (normality ~14.9 mEq/mL).
     - **Acidulated Malt** (~3% lactic acid by weight, 1% acid malt lowers mash pH by ~0.10 pH units).
   - Functions `calculateAcidAdditions` and `calculatePostAcidMashPh`.

2. **Equipment Profile Physics & Volume Accounting (`FEAT-006`, `BUG-012`):**
   - **Thermal Mass Strike Calculation with Safety Clamp:**
     - Toggle `calcStrikeWithThermalMass: boolean` (Default `false` for recirculated/pre-heated systems).
     - When `false`: Standard Infusion formula $T_{\text{strike}} = T_{\text{target}} + \frac{0.40}{R} (T_{\text{target}} - T_{\text{grain}})$.
     - When `true`: Thermal Mass formula $T_{\text{strike}} = T_{\text{target}} + \frac{(0.40 \cdot W_{\text{grain}} + c_t \cdot W_{\text{tun}}) (T_{\text{target}} - T_{\text{grain}})}{1.0 \cdot V_{\text{strike}}}$.
     - Flag `strikeTempExceedsEnzymeLimit: boolean` when $T_{\text{strike}} > 78.0^\circ\text{C}$.
   - **Altitude & Boiling Point Synchronization:**
     - $T_{\text{boil}} = 100.0 - (0.00335 \times h)$ where $h$ is altitude in meters.
     - Altitude hop utilization scaling factor $F_{\text{alt}} = 1.0 - 0.008 \times (100.0 - T_{\text{boil}})$.
     - $\text{IBU}_{\text{adjusted}} = \text{IBU}_{\text{standard}} \times F_{\text{alt}}$.
   - **Reversible Volume & Loss Pipeline:**
     - Expansion of `calculateWaterVolumes` to account for `mashTunDeadSpaceL` and `kettleLossL`.
     - $V_{\text{strike}} = (W_{\text{grain}} \times R_{\text{mash}}) + L_{\text{deadspace}}$.
     - $V_{\text{sparge}} = V_{\text{total\_water}} - V_{\text{strike}}$.

3. **Domain-Specific Hop Scheduling Model (`FEAT-007`, `BUG-014`):**
   - Expand `HopItem` and `recipe_hops` schema with contextual timing fields:
     - `boilMins: number | null` (Boil / First Wort).
     - `whirlpoolMins: number | null`, `whirlpoolTempC: number | null` (Whirlpool / Hopstand).
     - `dryHopDayOffset: number | null`, `dryHopDurationDays: number | null` (Dry Hop).
   - Backward-compatible mapping with legacy `timeMinutes`.

4. **Engine Call-Site Consistency (`BUG-016`):**
   - Update `packages/calculations/src/brewingMath.ts:289` to call `srmToEbc(srm)` from `./units` instead of inlining the multiplication.

---

## 2. Technical Contracts & Schema

### 2.1 Physics & Mathematics Formulas

#### Acid Addition Formulas (`packages/calculations/src/water.ts`)
- Target pH difference: $\Delta \text{pH} = \text{predictedMashPh} - \text{targetMashPh}$.
- If $\Delta \text{pH} \le 0$, zero acid required.
- Mash Buffer Capacity: $\beta_{\text{mash}} \approx 30\ \text{mEq}/(\text{kg}\cdot\Delta\text{pH})$ (for typical pale/medium malts).
- Total alkalinity neutralization needed:
  $$E_{\text{req}}\ (\text{mEq}) = \text{totalMaltKg} \times \beta_{\text{mash}} \times \Delta \text{pH} + V_{\text{mashWaterL}} \times \text{Alkalinity}_{\text{mEq/L}}$$
- Acid dosages:
  - **Lactic Acid (88% wt, ~11.8 mEq/mL):** $\text{Vol}_{\text{lactic, mL}} = \frac{E_{\text{req}}}{11.8}$.
  - **Phosphoric Acid (75% wt, ~14.9 mEq/mL):** $\text{Vol}_{\text{phosphoric, mL}} = \frac{E_{\text{req}}}{14.9}$.
  - **Acidulated Malt (g):** $\text{Weight}_{\text{acidMalt, g}} = \text{totalMaltKg} \times 1000 \times \left(\frac{\Delta \text{pH}}{0.10 \times 100}\right) = \text{totalMaltKg} \times 100 \times \Delta \text{pH}$.

#### Boiling Point & Altitude
- $T_{\text{boil}}(h) = 100.0 - (0.00335 \times h)$ where $h$ is altitude in meters.
- Example: At $h = 1500\text{m}$, $T_{\text{boil}} = 100.0 - 5.025 = 94.975^\circ\text{C}$.
- Hop utilization scaling factor: $F_{\text{alt}} = \max(0.5, 1.0 - 0.008 \times (100.0 - T_{\text{boil}}))$.

#### Strike Temperature & Thermal Mass
- When `calcStrikeWithThermalMass === false`:
  $$T_{\text{strike}} = T_{\text{target}} + \frac{0.40 \cdot W_{\text{grain, kg}}}{V_{\text{strike, L}}} \times (T_{\text{target}} - T_{\text{grain, }^\circ\text{C}})$$
- When `calcStrikeWithThermalMass === true`:
  $$T_{\text{strike}} = T_{\text{target}} + \frac{0.40 \cdot W_{\text{grain, kg}} + c_{\text{tun}} \cdot W_{\text{tun, kg}}}{V_{\text{strike, L}}} \times (T_{\text{target}} - T_{\text{grain, }^\circ\text{C}})$$
  where default $c_{\text{tun}} = 0.12$ (Stainless Steel), $W_{\text{tun}} = 0$ if omitted.
- Safety clamp: `strikeTempExceedsEnzymeLimit = T_strike > 78.0`.

### 2.2 Shared Types (`packages/shared-types`)

```typescript
export interface AcidAdditionResult {
  targetPh: number;
  deltaPh: number;
  mEqRequired: number;
  lacticAcid88Ml: number;
  phosphoricAcid75Ml: number;
  acidulatedMaltGrams: number;
}

export interface EquipmentPhysicsParams {
  altitudeMeters?: number;
  calcStrikeWithThermalMass?: boolean;
  mashTunWeightKg?: number;
  mashTunHeatCapacity?: number;
  mashTunDeadSpaceL?: number;
  kettleLossL?: number;
}

export interface HopItem {
  id: string;
  name: string;
  alphaAcidPct: number;
  amountGrams: number;
  use: HopUse;
  timeMinutes: number; // Legacy/fallback field
  boilMins?: number | null;
  whirlpoolMins?: number | null;
  whirlpoolTempC?: number | null;
  dryHopDayOffset?: number | null;
  dryHopDurationDays?: number | null;
  form: HopForm;
  notes?: string;
}
```

### 2.3 Database Schema Extensions (`apps/api/src/db/schema.ts`)

- Migration `0013_brewing_physics.sql`:
  - `equipment_profiles`:
    - `altitude_meters` (`real`, default `0`).
    - `calc_strike_with_thermal_mass` (`integer`, default `0`).
    - `mash_tun_dead_space_l` (`real`, default `0`).
    - `kettle_loss_l` (`real`, default `0`).
    - `mash_tun_weight_kg` (`real`, default `0`).
    - `mash_tun_heat_capacity` (`real`, default `0.12`).
  - `recipe_hops`:
    - `boil_mins` (`real`, nullable).
    - `whirlpool_mins` (`real`, nullable).
    - `whirlpool_temp_c` (`real`, nullable).
    - `dry_hop_day_offset` (`integer`, nullable).
    - `dry_hop_duration_days` (`real`, nullable).

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | Acid addition calculation (Lactic 88%) | Unit | `calculateAcidAdditions` with 5.0 kg malt, predicted pH 5.60, target pH 5.30 calculates correct lactic mL (~3.8 mL) |
| AC-2 | Acid addition calculation (Phosphoric 75%) | Unit | Calculates correct phosphoric acid dosage for the same delta (~3.0 mL) |
| AC-3 | Acidulated malt dosage calculation | Unit | Calculates correct acidulated malt dosage (150 g for 0.30 pH shift on 5.0 kg grain) |
| AC-4 | Acid calculation zero/negative delta guard | Unit | Target pH >= predicted pH returns 0 mL / 0 g without negative numbers or error |
| AC-5 | Altitude boiling point calculation | Unit | `calculateBoilingPoint(0)` = 100.0°C; `calculateBoilingPoint(1500)` = 94.975°C (±0.01°C) |
| AC-6 | Altitude hop utilization factor | Unit | `calculateAltitudeHopUtilization(30, 1500)` scales 30 IBU down by factor (1.0 - 0.008 * 5.025 = 0.9598) -> 28.79 IBU |
| AC-7 | Thermal mass strike temperature toggle OFF | Unit | `calcStrikeWithThermalMass: false` produces standard strike temp (~73.5°C for 67°C rest) |
| AC-8 | Thermal mass strike temperature toggle ON | Unit | `calcStrikeWithThermalMass: true` with 5 kg steel tun increases strike temp accordingly |
| AC-9 | Strike temperature enzyme limit guardrail | Unit | Returns `strikeTempExceedsEnzymeLimit: true` when strike temp > 78.0°C |
| AC-10 | Water volume accounting with dead space & kettle loss | Unit | `calculateWaterVolumes` includes `mashTunDeadSpaceL` in strike water and accounts for `kettleLossL` |
| AC-11 | `brewingMath.ts:289` calls `srmToEbc` (`BUG-016`) | Unit | `calculateRecipeStats` delegates EBC calculation to `srmToEbc` from `units.ts` |
| AC-12 | Database migration 0013 applies cleanly | Integration | Migrations run idempotently, adding columns to `equipment_profiles` and `recipe_hops` |
| AC-13 | Equipment Profile CRUD persists physics fields | Integration | `POST/PUT /api/equipment` saves and returns `altitudeMeters`, `calcStrikeWithThermalMass`, `mashTunDeadSpaceL`, `kettleLossL` |
| AC-14 | Recipe hop timing fields round-trip | Integration | `POST/PUT /api/recipes` saves and returns `boilMins`, `whirlpoolMins`, `whirlpoolTempC`, `dryHopDayOffset`, `dryHopDurationDays` |
| AC-15 | Legacy recipe backwards compatibility | Integration | Recipes with null new hop timing fields default cleanly to `timeMinutes` mapping |
| AC-16 | Recipe calculations utilize equipment altitude | Integration | `calculateRecipeStats` automatically factors equipment profile altitude into hop IBU calculation |
| AC-17 | Layer 1 four gates exit 0 | Verification | `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all exit 0 |
| AC-18 | Scope guardrail manifests | Verification | Pre- and post-exec SHA-256 manifests confirm zero Untouched file contamination |
| AC-19 | `BUGS.md` status update | Verification | Update `BUG-016` status to `IN_EXECUTION` / `VERIFIED_RESOLVED` |

**19 Acceptance Criteria.**

---

## 4. Deviation Register

1. **Two-Phase Milestone Execution:** Milestone 11 is phased into M11_P1 (Calculations Engine, Database Schema & APIs) and M11_P2 (Interactive UI Controls: Water Acid Modal in `WaterSection`, Grouped `EquipmentForm`, and Contextual `HopSection`), preserving strict vertical decoupling.

---

> **HALT GATE (STATE 2):** This specification is complete and presented for review.
>
> Implementation code generation is strictly forbidden until explicit approval.
> To approve and proceed to execution, reply with **`SPEC_APPROVED`**.
