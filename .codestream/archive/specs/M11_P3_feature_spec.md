# Feature Specification: Milestone 11 Phase 3 (M11_P3: Water Chemistry Physics Correction & 1-Click Water Adjustments Integration)

## 1. Executive Summary & Context

Milestone 11 Phase 3 (M11_P3) completes the water chemistry and brewing physics depth by solving two connected problems:
1. **`BUG-018` Physics Engine Correction**:
   - Correct `calculateResidualAlkalinity(hco3, ca, mg)` in `packages/calculations/src/water.ts` to use stoichiometric milliequivalent denominators ($70.14$ for Calcium and $85.05$ for Magnesium), eliminating the 50x over-estimation of ion neutralizing power.
   - Restore realistic predicted mash pH values ($5.55 - 5.70$) for standard mineral profiles, unlocking the interactive acid additions dosage panel in `WaterSection.tsx`.
2. **Unified 1-Click Water Adjustments Workflow (`FEAT-001` Completion)**:
   - Add **1-Click "+ Add to Recipe"** action buttons to the acid dosage cards in `WaterSection.tsx` (Lactic Acid 88% in mL, Phosphoric Acid 75% in mL, Acidulated Malt in g).
   - Add a unified **"Apply All (Salts + Acid)"** action button that bridges mineral salt additions to the target water profile and applies the calculated Lactic Acid 88% dosage in a single click.
   - Implement smart, non-destructive `miscs` synchronization:
     - Updating salts replaces only mineral salt items, preserving acid items.
     - Updating acids replaces only acid items, preserving mineral salt additions and non-water miscs (finings, spices).

---

## 2. File Organization & Boundaries

### 2.1 Modified Files
- `packages/calculations/src/water.ts`: Correct formula in `calculateResidualAlkalinity`.
- `packages/calculations/test/water.test.ts`: Update unit tests for `calculateResidualAlkalinity` and multi-profile `predictMashPh` cases.
- `apps/web/src/components/WaterSection.tsx`: Add 1-click acid addition buttons, unified "Apply All (Salts + Acid)" action, and smart non-destructive `miscs` partition logic.
- `apps/web/test/WaterSection.test.tsx`: Component tests for 1-click acid additions, "Apply All" action, and non-destructive miscs updates.

### 2.2 Untouched Files (Protected)
- `apps/api/` (API schemas and routes untouched)
- `packages/shared-types/` (Data contracts unchanged)
- `packages/calculations/src/mash.ts`, `yeast.ts`, `hops.ts`, `brewingMath.ts`, `gravityCorrection.ts`, `units.ts`, `constants.ts` (Untouched)
- `.gsd/archive/` (Append-only)

---

## 3. Data Schema & Component Contracts

### 3.1 Residual Alkalinity Mathematical Contract (`packages/calculations/src/water.ts`)

#### Formula
$$\text{RA (mEq/L)} = \frac{\text{hco3}}{61.0} - \left( \frac{\text{ca}}{70.14} + \frac{\text{mg}}{85.05} \right)$$
*(where $70.14 = 20.039\text{ mg/mEq} \times 3.5$ and $85.05 = 12.153\text{ mg/mEq} \times 7.0$)*.

#### Pinned Mathematical Outputs
- `calculateResidualAlkalinity(0, 0, 0)` $\equiv 0.0$
- `calculateResidualAlkalinity(150, 60, 10)` $\equiv 1.4860 \pm 0.0005\text{ mEq/L}$
- `calculateResidualAlkalinity(50, 100, 20)` $\equiv -0.8412 \pm 0.0005\text{ mEq/L}$
- `calculateResidualAlkalinity(0, 70.14, 0)` $\equiv -1.0000 \pm 0.0005\text{ mEq/L}$
- `calculateResidualAlkalinity(0, 0, 85.05)` $\equiv -1.0000 \pm 0.0005\text{ mEq/L}$
- `calculateResidualAlkalinity(61.0, 0, 0)` $\equiv +1.0000 \pm 0.0005\text{ mEq/L}$

### 3.2 Mash pH Prediction Contract (`predictMashPh`)
- Base pale malt grist ($5.0\text{ kg}, 5.60\text{ baseline}$):
  - $\text{RA} = +1.4860\text{ mEq/L} \implies \text{predictedMashPh} = 5.60 + (1.486006 \times 0.044) = 5.665 \approx 5.67$
  - $\text{RA} = -0.8412\text{ mEq/L} \implies \text{predictedMashPh} = 5.60 + (-0.841204 \times 0.044) = 5.563 \approx 5.56$
- Clamping $[4.50, 6.50]$ remains in place for safety.

### 3.3 WaterSection 1-Click Adjustments & Miscs Partition Contract

#### Known Water Agent Names
- **Mineral Salts Set**: `['Gypsum', 'Calcium Chloride', 'Epsom Salt', 'Table Salt', 'Baking Soda']`
- **Acid Adjustments Set**: `['Lactic Acid 88%', 'Phosphoric Acid 75%', 'Acidulated Malt']`

#### Partitioning Rules
When updating `miscs`:
1. `nonWaterMiscs`: All items where `type !== 'WaterAgent'`.
2. `existingSalts`: Items where `type === 'WaterAgent'` and `name` matches a known mineral salt.
3. `existingAcids`: Items where `type === 'WaterAgent'` and `name` matches an acid agent.

#### Action Handlers
1. **`handleAddAcid(acidType: 'lactic' | 'phosphoric' | 'acidMalt')`**:
   - Computes active dosage from `acidResult`.
   - Creates a new `MiscItem`:
     - `'lactic'`: `{ id, name: 'Lactic Acid 88%', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: acidResult.lacticAcid88Ml, unit: 'mL' }`
     - `'phosphoric'`: `{ id, name: 'Phosphoric Acid 75%', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: acidResult.phosphoricAcid75Ml, unit: 'mL' }`
     - `'acidMalt'`: `{ id, name: 'Acidulated Malt', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: Math.round(acidResult.acidulatedMaltGrams), unit: 'g' }`
   - Dispatches `onMiscsUpdate([...nonWaterMiscs, ...existingSalts, newAcidItem])`.
2. **`handleAutoSuggestSalts()`**:
   - Computes suggested salt additions for target water profile.
   - Converts non-zero suggestions to `MiscItem[]`.
   - Dispatches `onMiscsUpdate([...nonWaterMiscs, ...newSaltItems, ...existingAcids])` (retaining active acid additions).
3. **`handleApplyAllAdjustments()`**:
   - Computes suggested salt additions for target water profile.
   - Computes post-salt finished ions and post-salt Residual Alkalinity / predicted mash pH.
   - Computes required Lactic Acid 88% dosage to achieve `targetMashPh`.
   - Dispatches `onMiscsUpdate([...nonWaterMiscs, ...newSaltItems, newLacticAcidItem])` in a single update.

---

## 4. Acceptance Criteria Matrix

| ID | Category | Requirement | Test Verification | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **AC-1** | Pure Math | Corrected RA formula for standard reference water | `water.test.ts` | `calculateResidualAlkalinity(150, 60, 10)` evaluates to $1.4860 \pm 0.0005\text{ mEq/L}$ |
| **AC-2** | Pure Math | Zero ion concentrations yield zero RA | `water.test.ts` | `calculateResidualAlkalinity(0, 0, 0)` returns `0.0` |
| **AC-3** | Pure Math | High-mineral water RA calculation | `water.test.ts` | `calculateResidualAlkalinity(50, 100, 20)` evaluates to $-0.8412 \pm 0.0005\text{ mEq/L}$ |
| **AC-4** | Pure Math | Calcium stoichiometric divisor ($70.14$) | `water.test.ts` | `calculateResidualAlkalinity(0, 70.14, 0)` evaluates to $-1.0000 \pm 0.0005\text{ mEq/L}$ |
| **AC-5** | Pure Math | Magnesium stoichiometric divisor ($85.05$) | `water.test.ts` | `calculateResidualAlkalinity(0, 0, 85.05)` evaluates to $-1.0000 \pm 0.0005\text{ mEq/L}$ |
| **AC-6** | Pure Math | Bicarbonate stoichiometric divisor ($61.0$) | `water.test.ts` | `calculateResidualAlkalinity(61.0, 0, 0)` evaluates to $+1.0000 \pm 0.0005\text{ mEq/L}$ |
| **AC-7** | Pure Math | `predictMashPh` with positive RA profile | `water.test.ts` | Base malt ($5.0\text{ kg}, 5.60$) with $\text{RA} = +1.4860$ yields $5.665 \pm 0.01\text{ pH}$ |
| **AC-8** | Pure Math | `predictMashPh` with negative RA profile | `water.test.ts` | Base malt ($5.0\text{ kg}, 5.60$) with $\text{RA} = -0.8412$ yields $5.563 \pm 0.01\text{ pH}$ |
| **AC-9** | Water UI | Acid Additions card renders accurate dosages for tap profile | `WaterSection.test.tsx` | Selecting tap profile ($Ca=50, Mg=10, HCO_3=120$) with target pH $5.20$ displays accurate non-zero Lactic/Phosphoric/Malt dosages |
| **AC-10** | Water UI | 1-Click "+ Add to Recipe" on Lactic Acid | `WaterSection.test.tsx` | Clicking "+ Add" on Lactic Acid card calls `onMiscsUpdate` with `Lactic Acid 88%` `WaterAgent` item and dosage in `mL` |
| **AC-11** | Water UI | 1-Click "+ Add to Recipe" on Phosphoric Acid | `WaterSection.test.tsx` | Clicking "+ Add" on Phosphoric Acid card calls `onMiscsUpdate` with `Phosphoric Acid 75%` in `mL` |
| **AC-12** | Water UI | 1-Click "+ Add to Recipe" on Acidulated Malt | `WaterSection.test.tsx` | Clicking "+ Add" on Acidulated Malt card calls `onMiscsUpdate` with `Acidulated Malt` in `g` |
| **AC-13** | Water UI | Unified "Apply All (Salts + Acid)" Action | `WaterSection.test.tsx` | Clicking "Apply All (Salts + Acid)" adds suggested mineral salts AND calculated Lactic Acid 88% in a single update |
| **AC-14** | Water UI | Non-destructive Miscs preservation | `WaterSection.test.tsx` | Auto-suggesting salts preserves existing acid additions; adding an acid preserves existing mineral salts and non-water miscs |
| **AC-15** | Quality | Layer 1 Four Gates exit 0 cleanly | Monorepo Root Check | `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` all exit 0 |
| **AC-16** | Backlog | Update bug status in `.gsd/BUGS.md` | `.gsd/BUGS.md` | `BUG-018` marked `VERIFIED_RESOLVED` upon phase completion |
| **AC-17** | Scope Guard | Pre/Post SHA-256 Manifest Diff | Manifest Check | Only `packages/calculations/src/water.ts`, `packages/calculations/test/water.test.ts`, `apps/web/src/components/WaterSection.tsx`, and `apps/web/test/WaterSection.test.tsx` modified |
| **AC-18** | Water UI (A1) | Applied-acid mapping from `miscs` | `WaterSection.test.tsx` | Given `miscs` containing `WaterAgent` items named `Lactic Acid 88%` (2.0), `Lactic Acid 88%` (2.45), `Phosphoric Acid 75%` (1.0) and `Acidulated Malt` (50), the derived `appliedAcids` equals `{ lacticAcid88Ml: 4.45, phosphoricAcid75Ml: 1.0, acidulatedMaltGrams: 50 }` — summed by exact `name` match, `unit` field ignored, non-`WaterAgent` items and mineral-salt names excluded |
| **AC-19** | Water UI (A1) | Post-acid badge — pinned Lactic Acid case | `WaterSection.test.tsx` | Source $Ca=50, Mg=10, HCO_3=120$, 5.0 kg base malt ($colorSrm \le 5.08$), target pH 5.30, no salts. With **no** acid in `miscs` the badge reads `5.65`; with a single `Lactic Acid 88%` `WaterAgent` item of `amount: 4.45` present, `predicted-mash-ph-badge` reads **`5.30`** |
| **AC-20** | Water UI (A1) | Post-acid badge — pinned Acidulated Malt case | `WaterSection.test.tsx` | Same inputs as AC-19; with a single `Acidulated Malt` `WaterAgent` item of `amount: 175` (g) present, `predicted-mash-ph-badge` reads **`5.30`** |
| **AC-21** | Water UI (A1) | Panel flips once target is satisfied | `WaterSection.test.tsx` | Under AC-19's satisfied state, `acid-dosages-panel` is absent and `no-acid-needed-badge` is present; under AC-19's unsatisfied state (no acid in `miscs`) the inverse holds |
| **AC-22** | Water UI (A1) | Handlers dose from the pre-acid basis | `WaterSection.test.tsx` | With an existing `Lactic Acid 88%` item of `amount: 2.00` in `miscs` (AC-19 inputs), clicking `add-lactic-acid-btn` dispatches `onMiscsUpdate` containing exactly one `Lactic Acid 88%` item with `amount: 4.45` (the **full** pre-acid dose, not a residual top-up), proving handlers read `preAcidResult` and not `residualAcidResult` |
| **AC-23** | Water UI (A1) | Degenerate inputs leave the badge untouched | `WaterSection.test.tsx` | (a) `miscs` containing no acid-named `WaterAgent` item ⇒ badge equals `predictedPh.toFixed(2)` exactly; (b) `fermentables` totalling 0 kg grain with an acid item present ⇒ badge equals `predictedPh.toFixed(2)` (no NaN, no clamp artifact) |
| **AC-24** | Water UI (A1) | Inline action confirmation banner | `WaterSection.test.tsx` | `water-adjustment-confirmation` is absent on first render; appears synchronously after clicking `add-lactic-acid-btn` / `add-phosphoric-acid-btn` / `add-acidulated-malt-btn` / `auto-suggest-salts-btn` / `apply-all-water-btn` with the action-specific text of §7.4; and is absent again after advancing timers by 2500 ms |
| **AC-25** | Scope Guard (A1) | Amendment 1 touches no new files | Manifest Check | The pre/post SHA-256 content manifest (§6) shows Amendment 1 changed **only** `apps/web/src/components/WaterSection.tsx` and `apps/web/test/WaterSection.test.tsx`. `packages/calculations/src/water.ts` and `packages/calculations/test/water.test.ts` are **byte-identical** to their post-AC-1..AC-8 state |

---

## 5. Scope Guardrails & Non-Goals

- **Non-Goal**: We do not alter database migrations or REST API route handlers.
- **Non-Goal**: We do not alter any other calculation module (`brewingMath.ts`, `mash.ts`, `yeast.ts`, `hops.ts`, etc.).
- **Untouched List**: `apps/api/`, `packages/shared-types/`, and other `apps/web/src/` components remain untouched.

---

## 6. Pre-Execution SHA-256 Manifest
Before execution begins, generate pre-execution SHA-256 manifest at `.gsd/archive/manual_verification/M11_P3/pre_exec_manifest.json`.

**Amendment 1:** because this repo has no prior commit covering M11_P3's work, `git diff --name-only` against a base commit is **not** a viable scope check here. Instead, before the executor's first edit of Amendment 1, capture `git ls-files -co --exclude-standard -z | xargs -0 sha256sum` to `.gsd/archive/manual_verification/M11_P3/pre_amend1_manifest.txt`, and repeat at the end into `post_amend1_manifest.txt`. AC-25 is verified by diffing those two files.

---

## 7. Amendment 1 — Post-Acid Mash pH Feedback Loop (2026-08-17)

**Trigger:** post-Layer-1 `/diagnose` pass (logged in `.gsd/STATE.json` state_history). User report: "+ Add to Recipe" on an acid card appears to do nothing.

**Diagnosis outcome (no code change required for the add path):** `handleAddAcid` is *correct* — it dispatches `onMiscsUpdate`, appends a well-formed acid `WaterAgent` `MiscItem`, and marks the recipe dirty. AC-10/AC-11/AC-12 remain satisfied and their implementation must not be altered.

**The actual gap:** `WaterSection.tsx` derives `finishedIons → ra → predictedPh` exclusively from `calculateFinishedIons`, which only recognises names present in `SALT_CONTRIBUTIONS`. Acid agents are invisible to that chain, so the `predicted-mash-ph-badge`, the ΔpH line, and the dosage cards never move after an acid is added. `calculatePostAcidMashPh` (`packages/calculations/src/water.ts`, ~line 307) was built in M11_P1 for exactly this purpose and is currently **dead code** — never imported by any component.

### 7.1 Symbol inventory

| Symbol | Status |
| :--- | :--- |
| `calculatePostAcidMashPh` (`water.ts`) | **Consumed, not modified.** Newly imported by `WaterSection.tsx`. |
| `AcidAdditionInputs` (`water.ts`) | **Consumed, not modified.** Imported as a type. |
| `calculateFinishedIons`, `calculateResidualAlkalinity`, `predictMashPh`, `calculateAcidAdditions`, `suggestSaltAdditions` | Unchanged, still called as today. |
| `ACID_AGENT_NAMES` (`WaterSection.tsx`) | Reused as the mapping key set. No new name constant is introduced. |
| `predictedPh` (`WaterSection.tsx`) | Retained as the **pre-acid** basis. Not renamed, not removed. |
| `acidResult` (`WaterSection.tsx`) | **Split** into `preAcidResult` and `residualAcidResult` (see §7.3). |

**Spot-check of `calculatePostAcidMashPh` (per instruction — inspected, not modified):** its mEq inverses are exactly consistent with `calculateAcidAdditions` (lactic ×11.8, phosphoric ×14.9, acidulated malt `g/(kg·100)·(kg·30)` ≡ `g × 0.3`, and `ΔpH = mEq/(kg·30)`). Its one asymmetry — it ignores the `mashWaterL × alkalinityMeqL` term that `calculateAcidAdditions` adds — is **inert here**, because `WaterSection.tsx` calls `calculateAcidAdditions` with only four arguments, leaving `alkalinityMeqL` at its `0` default. **No defect found; `water.ts` must not be edited by this amendment** (AC-25).

### 7.2 Binding resolved ambiguities

1. **Mapping direction — sum by name, defensively.** `appliedAcids: AcidAdditionInputs` is built by reducing `existingAcids` (already computed at `WaterSection.tsx:58`): `Lactic Acid 88%` → `lacticAcid88Ml`, `Phosphoric Acid 75%` → `phosphoricAcid75Ml`, `Acidulated Malt` → `acidulatedMaltGrams`. Amounts are **summed**, not last-write-wins. Rationale: the UI's own `handleAddAcid`/`handleApplyAll` are replace-not-append and can only ever leave **one** acid item, so in the UI-driven path each sum has exactly one term — but `miscs` also arrives from persisted/imported recipes and manual `MiscSection` entry, where duplicates are representable. Summing is correct in both cases; last-write-wins silently discards a real addition.
2. **`unit` is ignored during mapping.** Matching is on exact `name` only. The shipped code writes `unit: 'ml'` (lowercase) for liquid acids while §3.3 of this spec wrote `'mL'`; that casing discrepancy is real but cosmetic and is **explicitly out of scope for this amendment** — do not "fix" it, as it would churn AC-10/AC-11 expectations. Mapping must therefore not filter or branch on `unit`.
3. **`alkalinityMeqL` is not passed.** `calculatePostAcidMashPh` is called with `additions` carrying the three dosage fields only, mirroring the `alkalinityMeqL = 0` default already in effect at `WaterSection.tsx:53`. Passing it on one side but not the other would desynchronise the forward and inverse formulas.
4. **No-acid short-circuit.** `hasAppliedAcid` is `true` iff at least one of the three mapped values is `> 0` (strictly greater; `0` and `undefined` both count as absent). When `false`, `effectivePh` **is** `predictedPh` — the raw unrounded value, *not* a round-trip through `calculatePostAcidMashPh` — so AC-23(a) holds byte-for-byte against today's rendering.
5. **Rounding and the panel gate.** `calculatePostAcidMashPh` already returns a 2-decimal-rounded value. `effectivePh` is compared to `targetMashPh` **directly, with `>`, and with no added epsilon**. This is what makes the worked examples flip cleanly: 5.30 > 5.30 is `false`.
6. **Clamp interaction.** `calculatePostAcidMashPh` clamps to `[4.00, 6.50]`; `predictMashPh` clamps to `[4.50, 6.50]`. These differ and both remain as-is. An over-dosed acid may therefore legitimately drive the badge below 4.50; that is accepted, not a bug.
7. **`totalGrainKg <= 0`.** `calculatePostAcidMashPh` returns `predictedMashPh` unchanged; no guard is added in the component (AC-23(b)).

### 7.3 Stateful integration contract (`WaterSection.tsx` render body)

Derived values, in order, replacing lines 53 and downstream reads:

- `appliedAcids: AcidAdditionInputs` — per §7.2(1). Pure, derived from `existingAcids`.
- `hasAppliedAcid: boolean` — per §7.2(4).
- `effectivePh: number` = `hasAppliedAcid ? calculatePostAcidMashPh(predictedPh, totalGrainKg, waterVolumeL, appliedAcids) : predictedPh`.
- `preAcidResult` = `calculateAcidAdditions(totalGrainKg, predictedPh, targetMashPh)` — the **full** dose, basis for every write path.
- `residualAcidResult` = `calculateAcidAdditions(totalGrainKg, effectivePh, targetMashPh)` — what is **still** needed, basis for every read path.

**Caller branching — binding:**

| Consumer | Uses |
| :--- | :--- |
| `predicted-mash-ph-badge` value | `effectivePh.toFixed(2)` |
| Panel gate `predictedPh > targetMashPh && acidResult.deltaPh > 0` | becomes `effectivePh > targetMashPh && residualAcidResult.deltaPh > 0` |
| "Predicted:" line inside `acid-dosages-panel` | `effectivePh.toFixed(2)` |
| "Required Reduction" ΔpH / mEq line | `residualAcidResult` |
| `lactic-acid-dosage`, `phosphoric-acid-dosage`, `acidulated-malt-dosage` | `residualAcidResult` |
| **`handleAddAcid` item `amount`** | **`preAcidResult`** |
| `handleApplyAll` | unchanged — already recomputes its own post-salt basis from scratch and discards existing acids |
| `RA: … mEq/L` sub-label in the badge | **unchanged** — `ra`, mineral-salt-derived |

**Why handlers must use `preAcidResult` (AC-22):** `handleAddAcid` *replaces* all existing acid items. If it dosed from `residualAcidResult` while an acid was already present, the replacement would carry only the top-up amount and the recipe would silently lose the original dose. Reading residual but writing full is the only combination that is idempotent under repeated clicks.

**Deviation register entry DEV-M11P3-01 — RA and finished-ion display stay mineral-only.** Acids genuinely neutralise bicarbonate, so a fully physical model would move `finishedIons.bicarbonate` and therefore `ra`. This amendment deliberately does **not** do that: acids act on the pH readout only, through `calculatePostAcidMashPh`. Rationale — `calculateFinishedIons` is shared with the ion-panel and with `handleApplyAll`'s post-salt basis, and teaching it about acids would change salt-suggestion behaviour, exceeding this amendment's scope and violating AC-25. Consequence to disclose in-product terms: the `RA:` sub-label and the six finished-ion tiles remain unchanged after an acid is added, while the pH value moves. Revisit as a separate phase if the ion panel is ever expected to reflect acid.

### 7.4 Inline confirmation contract

A single component-scoped banner, **rendered outside the `acid-dosages-panel` gate** (immediately below the acid-additions card header, inside `acid-additions-card`), so it survives the panel flipping to `no-acid-needed-badge` in the same commit as the click.

- State: `const [confirmation, setConfirmation] = useState<string | null>(null)`.
- Element: rendered only when `confirmation !== null`, carrying `data-testid="water-adjustment-confirmation"`, text content exactly the stored string.
- Messages (exact strings): `'Added Lactic Acid 88% to recipe'`, `'Added Phosphoric Acid 75% to recipe'`, `'Added Acidulated Malt to recipe'`, `'Added suggested mineral salts to recipe'`, `'Added salts + acid to recipe'`.
- Lifetime: set synchronously inside the handler, alongside the `onMiscsUpdate` dispatch; cleared to `null` **2500 ms** later.
- The timer is owned by a `useEffect` keyed on `confirmation` that returns a `clearTimeout` cleanup, so re-clicking restarts the window and unmounting cancels it (no `act()` leakage in tests).
- Purely presentational: the banner must never be read back by any calculation and must never enter `miscs`.

### 7.5 File organization delta

No new files. §2.1 stands, narrowed for Amendment 1 to `apps/web/src/components/WaterSection.tsx` and `apps/web/test/WaterSection.test.tsx`. §2.2's protected list is unchanged and additionally covers `packages/calculations/src/water.ts` and `packages/calculations/test/water.test.ts` **for the duration of this amendment** (AC-25).

### 7.6 Worked numbers backing AC-19 / AC-20

Inputs: source $Ca=50$, $Mg=10$, $HCO_3=120$ ppm; grist 5.0 kg base malt ($colorSrm \le 5.08$ ⇒ baseline 5.60); `targetMashPh = 5.30`; no salt items.

- $RA = \frac{120}{61.0} - \left(\frac{50}{70.14} + \frac{10}{85.05}\right) = 1.967213 - (0.712860 + 0.117578) = 1.136775$ mEq/L
- $predictedPh = 5.60 + 1.136775 \times 0.044 = 5.650018$ → badge `5.65` (pre-acid)
- $\Delta pH = 5.650018 - 5.30 = 0.350018$; $mEq_{req} = 5.0 \times 30 \times 0.350018 = 52.5027$
- Lactic 88%: $52.5027 / 11.8 = 4.449382$ → stored `amount: 4.45`
- Post-acid: $4.45 \times 11.8 = 52.51$ mEq ⇒ $\Delta pH = 52.51 / 150 = 0.350067$ ⇒ $5.650018 - 0.350067 = 5.299951$ → **`5.30`** (AC-19)
- Acidulated malt: $5.0 \times 100 \times 0.350018 = 175.009$ → `Math.round` ⇒ stored `amount: 175`
- Post-acid: $175 \times 0.3 = 52.5$ mEq ⇒ $\Delta pH = 0.35$ ⇒ $5.650018 - 0.35 = 5.300018$ → **`5.30`** (AC-20)
- Gate: `5.30 > 5.30` is `false` ⇒ `no-acid-needed-badge` renders (AC-21).

---

> **HALT GATE (STATE 2):** This specification is complete and presented for review.
>
> Implementation code generation is strictly forbidden until explicit approval.
> To approve and proceed to execution, reply with **`SPEC_APPROVED`**.
