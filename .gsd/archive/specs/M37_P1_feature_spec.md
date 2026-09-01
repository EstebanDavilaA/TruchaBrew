# FEATURE SPECIFICATION: M37_P1 — Bounded Multi-Ion Least-Squares Solver

> **Milestone 37:** "Multi-Ion Water Chemistry Solver & Target Tuning" (`.gsd/ROADMAP.md`)
> **Phase 1 of 2.** Delivers a constrained multi-ion water chemistry optimization solver in `@truchabrew/calculations` (`waterOptimization.ts` & `water.ts`), replacing the sequential greedy dosing heuristic in `suggestSaltAdditions` with a bounded non-negative least-squares optimization algorithm that simultaneously balances all 6 core brewing ions ($Ca^{2+}$, $Mg^{2+}$, $Na^+$, $Cl^-$, $SO_4^{2-}$, $HCO_3^-$) against target water profiles without Calcium overshoots or impossible mineral ratios (`BUG-024`).

---

## Phase Summary

Milestone 37 Phase 1 implements pure mathematical optimization in `@truchabrew/calculations`:

1. **Multi-Ion Optimization Solver Engine (`packages/calculations/src/waterOptimization.ts`):**
   - Implements bounded Non-Negative Least Squares (NNLS) / constrained coordinate descent solver:
     $$\min_{g \ge 0} \sum_{i=1}^{6} w_i \left( \text{ion}_i^{\text{actual}}(g) - \text{ion}_i^{\text{target}} \right)^2 + \sum_{i=1}^{6} p_i \max(0, \text{ion}_i^{\text{actual}}(g) - \text{ion}_i^{\text{target}})^2$$
   - Accounts for multi-ion contributions from all 5 primary brewing salts:
     - **Gypsum ($CaSO_4 \cdot 2H_2O$):** $Ca^{2+}$, $SO_4^{2-}$
     - **Calcium Chloride ($CaCl_2 \cdot 2H_2O$):** $Ca^{2+}$, $Cl^-$
     - **Epsom Salt ($MgSO_4 \cdot 7H_2O$):** $Mg^{2+}$, $SO_4^{2-}$
     - **Table Salt ($NaCl$):** $Na^+$, $Cl^-$
     - **Baking Soda ($NaHCO_3$):** $Na^+$, $HCO_3^-$
     - *(Optional/Chalk $CaCO_3$ supported when configured)*
   - Dynamic ion weighting with asymmetric penalty terms ($p_i$) preventing runaway Calcium and Sodium overshoots when Chloride and Sulfate targets are both elevated.
2. **Backward-Compatible Public API & Exported Functions (`packages/calculations/src/water.ts` & `index.ts`):**
   - Refactors `suggestSaltAdditions(source, target, waterVolumeL)` to utilize the bounded multi-ion solver while preserving its exact function signature.
   - Exports new high-fidelity helper `optimizeWaterProfile(source, target, waterVolumeL, options?)` returning detailed convergence metrics:
     - `salts: { saltName: string; amountGrams: number }[]`
     - `resultingWater: IonConcentrations`
     - `residualDeltas: IonConcentrations`
     - `sulfateToChlorideRatio: number`
     - `fitScorePct: number` ($0-100\%$ profile match rating)
3. **Comprehensive Fixture Test Suite (`packages/calculations/test/waterOptimization.test.ts` & `water.test.ts`):**
   - Unit tests covering 10 classic world water profiles (Burton-on-Trent, Pilsen, Dublin, Munich, Dortmund, Edinburgh, Vienna, West Coast IPA, NEIPA / Juicy IPA, RO/Distilled baseline).
   - Assertions verifying:
     - Non-negative salt doses ($g \ge 0$).
     - Elimination of the Calcium overshoot defect in simultaneous high-$Cl^-$ / high-$SO_4^{2-}$ targets.
     - Accurate Sulfate-to-Chloride ratio preservation ($SO_4^{2-} : Cl^-$).
     - Graceful handling of null/zero inputs and source water higher than target profile.

---

## Acceptance Criteria Matrix (20 ACs)

| ID | Category | Requirement / Expected Behavior | Verification Method |
|---|---|---|---|
| **AC-1** | Module Architecture | `packages/calculations/src/waterOptimization.ts` exports `solveOptimalSalts` and `optimizeWaterProfile`. | `calculations/src/index.ts` & Typecheck |
| **AC-2** | Non-Negativity Invariant | All recommended salt doses are non-negative ($g \ge 0$), rounded to 2 decimal places. | `test/waterOptimization.test.ts` |
| **AC-3** | Calcium Overshoot Fix | For targets with elevated $Cl^-$ (e.g. 150 ppm) and $SO_4^{2-}$ (e.g. 150 ppm), resulting $Ca^{2+}$ does not overshoot target by $>25\%$ (`BUG-024` resolution). | `test/waterOptimization.test.ts` |
| **AC-4** | Sulfate-to-Chloride Ratio | The resulting $SO_4^{2-} : Cl^-$ ratio is preserved within $\pm 15\%$ of the target profile's ratio when achievable. | `test/waterOptimization.test.ts` |
| **AC-5** | Epsom Salt Synergy | When target profile requires both $Mg^{2+}$ and $SO_4^{2-}$, the solver allocates Epsom Salt ($MgSO_4$) before over-allocating Gypsum. | `test/waterOptimization.test.ts` |
| **AC-6** | Table Salt Synergy | When target profile requires both $Na^+$ and $Cl^-$, the solver allocates Table Salt ($NaCl$) before over-allocating Calcium Chloride. | `test/waterOptimization.test.ts` |
| **AC-7** | Baking Soda Synergy | When target profile requires $HCO_3^-$, Baking Soda ($NaHCO_3$) is dosed and its $Na^+$ contribution is factored into sodium targets. | `test/waterOptimization.test.ts` |
| **AC-8** | Zero Volume / Null Target | Calling `suggestSaltAdditions` or `optimizeWaterProfile` with volume $\le 0$ or null target returns 0 grams for all salts without throwing. | `test/water.test.ts` |
| **AC-9** | Source Exceeds Target | When source water ion concentration exceeds target profile, that salt dosage is 0 grams and error penalty remains bounded. | `test/waterOptimization.test.ts` |
| **AC-10** | Burton-on-Trent Fixture | Solver accurately doses Gypsum, Epsom, and Calcium Chloride for high-mineral Burton profile ($Ca \approx 295, SO_4 \approx 725, Cl \approx 25$). | `test/waterOptimization.test.ts` |
| **AC-11** | Pilsen Soft Water Fixture | Solver returns minimal salt additions for soft Pilsen profile ($Ca \approx 10, SO_4 \approx 5, Cl \approx 5$). | `test/waterOptimization.test.ts` |
| **AC-12** | NEIPA High-Chloride Fixture | Solver prioritizes Calcium Chloride for NEIPA profile ($Cl:SO_4 \approx 2:1$) without excess Gypsum. | `test/waterOptimization.test.ts` |
| **AC-13** | West Coast IPA Fixture | Solver prioritizes Gypsum for West Coast IPA profile ($SO_4:Cl \approx 3:1$) with crisp bitterness balance. | `test/waterOptimization.test.ts` |
| **AC-14** | Fit Score Calculation | `optimizeWaterProfile` returns a normalized `fitScorePct` ($0-100\%$) reflecting profile compliance. | `test/waterOptimization.test.ts` |
| **AC-15** | Backward Compatibility | Existing signature of `suggestSaltAdditions(source, target, waterVolumeL)` remains 100% compatible. | `test/water.test.ts` |
| **AC-16** | Scope Guardrail | Pre/post SHA-256 manifest verifies only authorized files modified, 0 created in web/api, 0 deleted. | Manifest comparison |
| **AC-17** | Layer 1 Gate: Tests | Full test suite passes without reduction (>= 2,355 tests passing across 125 files). | `npm test` (exit 0) |
| **AC-18** | Layer 1 Gate: Typecheck | All 4 workspaces pass typecheck with 0 errors. | `npm run typecheck` (exit 0) |
| **AC-19** | Layer 1 Gate: Build | Production client bundle builds cleanly in <1.2s. | `npm run build` (exit 0) |
| **AC-20** | Layer 1 Gate: Lint | Monorepo linter passes with 0 errors. | `npm run lint` (exit 0) |

---

## Resolved Ambiguities (Binding)

**RA-1 — Optimization Metric & Penalties.**
The solver uses a bounded coordinate descent optimizer across the 5 salt variables. Standard ion weights ($w_i$) are:
- $SO_4^{2-}$: 1.0, $Cl^-$: 1.0, $Ca^{2+}$: 0.8, $Mg^{2+}$: 0.5, $Na^+$: 0.4, $HCO_3^-$: 0.3.
- Overshoot penalty multipliers: $p_{\text{calcium}} = 2.5$, $p_{\text{sodium}} = 3.0$, $p_{\text{magnesium}} = 2.0$. This explicitly prevents salt additions from pushing mineral concentrations into harsh astringency/chalkiness zones.

**RA-2 — Salt Contribution Constant Alignment.**
All calculations in `waterOptimization.ts` use the exact chemical ion constants defined in `SALT_CONTRIBUTIONS` (`water.ts`), normalized to ppm per gram per liter:
- Gypsum: $Ca = 6.15$, $SO_4 = 14.74$
- Calcium Chloride: $Ca = 7.20$, $Cl = 12.74$
- Epsom Salt: $Mg = 2.46$, $SO_4 = 9.74$
- Table Salt: $Na = 10.40$, $Cl = 16.00$
- Baking Soda: $Na = 7.40$, $HCO_3 = 19.70$

**RA-3 — Downstream value-pin reconcile in `WaterCalculatorModal.test.tsx` (spec-gap amendment, 2026-08-31).**
The spec's Authorized-Files list omits `apps/web/test/WaterCalculatorModal.test.tsx`, but BUG-024's whole point is that `suggestSaltAdditions`' exact output values change (the greedy outputs it pins — `23.41/10.87/8.85/4.82` g and the `14.05/9.36` mash/sparge split — are precisely the defective values the solver replaces). "Backward-compatible" (AC-15) is scoped to the **signature** (verified via `test/water.test.ts`), not output values. Therefore the modal test's exact-value pins are reconciled to the solver's verified-correct outputs, matching the modal's own `parseFloat((grams × ratio).toFixed(2))` rounding: Gypsum total `23.16` → mash `13.9`/sparge `9.26`; CaCl2 `11.01` → `6.61`/`4.4`; Epsom `0.49` → `0.29`/`0.2`; Baking Soda `3.52` → `2.11`/`1.41`; Table Salt `0`. The AC-20 mash-acid dosage pin is reconciled `3.34` → `3.31` (derived from the new finished-water chemistry). No structural or behavioral assertion changes — only numeric pins. This is the same consequence-pin reconcile class as M35_P2's MashSection/YeastSection test updates, driven by the spec's own chartered change.

---

## Authorized Files to Modify

- `packages/calculations/src/waterOptimization.ts` (NEW)
- `packages/calculations/src/water.ts`
- `packages/calculations/src/index.ts`
- `packages/calculations/test/waterOptimization.test.ts` (NEW)
- `packages/calculations/test/water.test.ts`
- `.gsd/STATE.json`
- `.gsd/BUGS.md`

---

## Halt Gate (State 2)

Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution.
