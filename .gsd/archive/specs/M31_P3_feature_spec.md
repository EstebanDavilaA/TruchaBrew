# FEATURE SPECIFICATION: M31_P3 - InventoryForm.tsx Main Form & Category Details Label Association

> **Milestone 31:** "The forms for your kit and your stock introduce themselves" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 3 of 4.** Migrates `InventoryForm.tsx` (the single densest form in the initiative — 32 unnamed controls across 4 categories) onto `<FormField>` and `components/ui/` primitives, establishing complete accessible name resolution and clickable label focus.

---

## Phase Summary

In Milestone 31 Phases 1 and 2, we hardened `FormField`'s automatic `useId`-driven `id`/`htmlFor` wiring and proved it on `EquipmentForm.tsx`, `FermentationProfileForm.tsx`, `MashProfileForm.tsx`, and `WaterProfileForm.tsx`.

In Milestone 31 Phase 3, we migrate `InventoryForm.tsx` — the densest form surface in the application:
1. **`InventoryForm.tsx` Core Form Migration:**
   - Migrates all 8 primary item information fields (`Category`, `Item Name`, `Quantity`, `Unit`, `Cost Per Unit`, `Purchase Date`, `Expiry Date`, `Notes`) to render through `<FormField>` and UI primitives (`<Input>`, `<Select>`, `<NumberInput>`, `<textarea>`).
   - Replaces hardcoded asterisks with `required={true}` prop on `<FormField>`, rendering the standard amber asterisk `<span className="text-amber-500 ml-0.5">*</span>`.
2. **`InventoryForm.tsx` Category Details Migration (4 Category Cards):**
   - **Hop (6 fields):** `Alpha Acid (%)`, `Hop Form / Type`, `Origin / Country`, `Crop Year`, `Lot # / Batch`, `Harvest / Manufacturing Date`.
   - **Fermentable (7 fields):** `Potential (SG)`, `Color (SRM)`, `Fermentable Type`, `Supplier / Maltster`, `Origin / Country`, `Lot # / Batch`, `Manufacturing Date`.
   - **Yeast (7 fields):** `Laboratory / Brand`, `Product ID / Code`, `Attenuation (%)`, `Yeast Type`, `Form`, `Lot # / Batch`, `Manufacturing Date`.
   - **Misc (4 fields):** `Misc Type`, `Default Use`, `Lot # / Batch`, `Manufacturing Date`.
   - All 24 category detail fields across the 4 category cards render through `<FormField>` wrapping `<Input>`, `<Select>`, and `<NumberInput>`.
3. **Buttons & Layout Modernization:**
   - TopBar buttons (`Cancel`, `Save Item`, `Delete`) and back button migrated to `<Button>`.
   - Removes `max-w-4xl mx-auto` container restriction from `<form>` to allow full responsive width inside `PageContainer`, matching all profile editors.
   - Retires `block text-xs font-semibold text-slate-400 mb-1` across all 32 labels onto `FORM_LABEL_CLASS` via `<FormField>`.
4. **Accessible Name & Click-to-Focus Assertions:**
   - Extend `InventoryForm.test.tsx` and `uiPrimitives.test.tsx` to assert that every single control across all 4 categories resolves to an accessible name via `getByLabelText`, clicking any field label moves focus to its associated control (`document.activeElement`), and zero bare `<label>` tags remain in `InventoryForm.tsx`.

**Why this satisfies vertical-slice constraints (Hard Rule 2):**
This phase focuses exclusively on `InventoryForm.tsx`'s complete form lifecycle and its 4 category detail surfaces, resolving the single largest cluster of unassociated controls in the application without touching unrelated components.

---

## Key Behaviors

1. `apps/web/src/components/InventoryForm.tsx`:
   - Core Item Information fields render through `<FormField>`:
     - `Category`: `<FormField label="Category" required><Select data-testid="inventory-form-category" value={category} onChange={...} disabled={categoryLocked}>{...}</Select></FormField>`
     - `Item Name`: `<FormField label="Item Name" required><Input data-testid="inventory-form-name" value={name} onChange={...} placeholder="e.g. Pale Ale Malt" /></FormField>`
     - `Quantity`: `<FormField label="Quantity" required><NumberInput data-testid="inventory-form-quantity" step="any" value={quantity} onChange={...} /></FormField>`
     - `Unit`: `<FormField label="Unit" required><Select data-testid="inventory-form-unit" value={unit} onChange={...}>{...}</Select></FormField>`
     - `Cost Per Unit`: `<FormField label="Cost Per Unit"><NumberInput data-testid="inventory-form-cost-per-unit" step="any" min="0" value={costPerUnit} onChange={...} placeholder="Optional" /></FormField>`
     - `Purchase Date`: `<FormField label="Purchase Date"><Input data-testid="inventory-form-purchase-date" type="date" value={purchaseDate} onChange={...} /></FormField>`
     - `Expiry Date`: `<FormField label="Expiry Date"><Input data-testid="inventory-form-expiry-date" type="date" value={expiryDate} onChange={...} /></FormField>`
     - `Notes`: `<FormField label="Notes"><textarea data-testid="inventory-form-notes" value={notes} onChange={...} placeholder="Optional notes..." rows={2} className={`${INPUT_CLASS} text-xs`} /></FormField>`
   - Category Details fields render through `<FormField>`:
     - **Hop:**
       - `Alpha Acid (%)`: `<FormField label="Alpha Acid (%)"><NumberInput data-testid="inventory-form-alpha-acid" step="0.1" value={alphaAcidPct} onChange={...} /></FormField>`
       - `Hop Form / Type`: `<FormField label="Hop Form / Type"><Select data-testid="inventory-form-hop-type" value={hopType} onChange={...}>{...}</Select></FormField>`
       - `Origin / Country`: `<FormField label="Origin / Country"><Input data-testid="inventory-form-origin" value={origin} onChange={...} placeholder="e.g. US, Germany" /></FormField>`
       - `Crop Year`: `<FormField label="Crop Year"><NumberInput data-testid="inventory-form-year" value={year} onChange={...} placeholder="e.g. 2025" /></FormField>`
       - `Lot # / Batch`: `<FormField label="Lot # / Batch"><Input data-testid="inventory-form-lot-number" value={lotNumber} onChange={...} /></FormField>`
       - `Harvest / Manufacturing Date`: `<FormField label="Harvest / Manufacturing Date"><Input data-testid="inventory-form-manufacturing-date" type="date" value={manufacturingDate} onChange={...} /></FormField>`
     - **Fermentable:**
       - `Potential (SG)`: `<FormField label="Potential (SG)"><NumberInput data-testid="inventory-form-potential-sg" step="0.001" value={potentialSg} onChange={...} placeholder="e.g. 1.037" /></FormField>`
       - `Color (SRM)`: `<FormField label="Color (SRM)"><NumberInput data-testid="inventory-form-color-srm" step="0.1" value={colorSrm} onChange={...} placeholder="e.g. 3.5" /></FormField>`
       - `Fermentable Type`: `<FormField label="Fermentable Type"><Select data-testid="inventory-form-grain-type" value={grainType} onChange={...}>{...}</Select></FormField>`
       - `Supplier / Maltster`: `<FormField label="Supplier / Maltster"><Input data-testid="inventory-form-supplier" value={supplier} onChange={...} placeholder="e.g. BESTMALZ" /></FormField>`
       - `Origin / Country`: `<FormField label="Origin / Country"><Input data-testid="inventory-form-origin" value={origin} onChange={...} /></FormField>`
       - `Lot # / Batch`: `<FormField label="Lot # / Batch"><Input data-testid="inventory-form-lot-number" value={lotNumber} onChange={...} /></FormField>`
       - `Manufacturing Date`: `<FormField label="Manufacturing Date"><Input data-testid="inventory-form-manufacturing-date" type="date" value={manufacturingDate} onChange={...} /></FormField>`
     - **Yeast:**
       - `Laboratory / Brand`: `<FormField label="Laboratory / Brand"><Input data-testid="inventory-form-laboratory" value={laboratory} onChange={...} placeholder="e.g. Fermentis" /></FormField>`
       - `Product ID / Code`: `<FormField label="Product ID / Code"><Input data-testid="inventory-form-product-id" value={productId} onChange={...} placeholder="e.g. S-04" /></FormField>`
       - `Attenuation (%)`: `<FormField label="Attenuation (%)"><NumberInput data-testid="inventory-form-attenuation" value={attenuationPct} onChange={...} placeholder="e.g. 75" /></FormField>`
       - `Yeast Type`: `<FormField label="Yeast Type"><Select data-testid="inventory-form-yeast-type" value={yeastType} onChange={...}>{...}</Select></FormField>`
       - `Form`: `<FormField label="Form"><Select data-testid="inventory-form-yeast-form" value={yeastForm} onChange={...}>{...}</Select></FormField>`
       - `Lot # / Batch`: `<FormField label="Lot # / Batch"><Input data-testid="inventory-form-lot-number" value={lotNumber} onChange={...} /></FormField>`
       - `Manufacturing Date`: `<FormField label="Manufacturing Date"><Input data-testid="inventory-form-manufacturing-date" type="date" value={manufacturingDate} onChange={...} /></FormField>`
     - **Misc:**
       - `Misc Type`: `<FormField label="Misc Type"><Select data-testid="inventory-form-misc-type" value={miscType} onChange={...}>{...}</Select></FormField>`
       - `Default Use`: `<FormField label="Default Use"><Select data-testid="inventory-form-default-use" value={defaultUse} onChange={...}>{...}</Select></FormField>`
       - `Lot # / Batch`: `<FormField label="Lot # / Batch"><Input data-testid="inventory-form-lot-number" value={lotNumber} onChange={...} /></FormField>`
       - `Manufacturing Date`: `<FormField label="Manufacturing Date"><Input data-testid="inventory-form-manufacturing-date" type="date" value={manufacturingDate} onChange={...} /></FormField>`
   - TopBar buttons (Cancel, Save Item, Delete) and back button render via `<Button>`.
   - All controls in `InventoryForm.tsx` resolve to accessible names via `getByLabelText`.
   - Clicking any label moves keyboard focus to the corresponding control (`document.activeElement`).

---

## Resolved Ambiguities (Binding)

**RA-1 — Preserving Existing Test IDs & Event Handlers.**
All existing `data-testid` attributes (`inventory-form-name`, `inventory-form-category`, `inventory-form-quantity`, `inventory-form-unit`, `inventory-form-cost-per-unit`, `inventory-form-purchase-date`, `inventory-form-expiry-date`, `inventory-form-notes`, `inventory-form-alpha-acid`, `inventory-form-hop-type`, `inventory-form-origin`, `inventory-form-year`, `inventory-form-lot-number`, `inventory-form-manufacturing-date`, `inventory-form-potential-sg`, `inventory-form-color-srm`, `inventory-form-grain-type`, `inventory-form-supplier`, `inventory-form-laboratory`, `inventory-form-product-id`, `inventory-form-attenuation`, `inventory-form-yeast-type`, `inventory-form-yeast-form`, `inventory-form-misc-type`, `inventory-form-default-use`, `inventory-delete`) and submission payload construction (`InventoryWriteInput` with `customDetails`) are preserved 100%.

**RA-2 — Required Indicator Asterisks.**
In `InventoryForm.tsx`, fields previously had manual asterisks in the label strings (`Category *`, `Item Name *`, `Quantity *`, `Unit *`). With `<FormField>`, use `label="Category" required={true}`, `label="Item Name" required={true}`, etc., rendering the standard amber asterisk `<span className="text-amber-500 ml-0.5">*</span>`.

**RA-3 — Label Text Matching in Tests.**
Testing-library `getByLabelText` matches labels containing asterisks and helper text (e.g. `getByLabelText(/item name/i)` or `getByLabelText('Item Name')`, `getByLabelText(/alpha acid/i)` or `getByLabelText('Alpha Acid (%)')`, `getByLabelText(/potential/i)` or `getByLabelText('Potential (SG)')`).

**RA-4 — Full Width Layout inside PageContainer.**
`InventoryForm.tsx` replaces `<form className="max-w-4xl mx-auto space-y-6">` with `<form className="space-y-6">` matching `EquipmentForm`, `MashProfileForm`, and `WaterProfileForm`.

**RA-5 — `designSystem.ts` Remains Untouched.**
`designSystem.ts` is not modified. It continues to export exactly 28 constants.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_EXECUTION` | Milestone 31 Phase 3 delivers accessible name wiring and UI primitives adoption on `InventoryForm.tsx`. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Accessible form fields and unified control plane. |

---

## 1. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/components/InventoryForm.tsx` | **MODIFY** | Migrate all 8 core fields, 24 category detail fields across 4 categories, and TopBar buttons to `components/ui/` primitives and `<FormField>`. |
| `apps/web/test/InventoryForm.test.tsx` | **MODIFY** | Add accessible label queries (`getByLabelText`) and click-to-focus assertions across all core and category detail fields. |
| `apps/web/test/uiPrimitives.test.tsx` | **MODIFY** | Add static sweep assertion confirming zero bare `<label>` elements in `InventoryForm.tsx`. |

---

## 2. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `InventoryForm` Category field is accessible via `getByLabelText('Category')` | Component Test | `getByLabelText(/category/i)` returns the category select dropdown. |
| **AC-2** | `InventoryForm` Item Name field is accessible via `getByLabelText('Item Name')` | Component Test | `getByLabelText(/item name/i)` returns the item name text input. |
| **AC-3** | `InventoryForm` Quantity field is accessible via `getByLabelText('Quantity')` | Component Test | `getByLabelText(/quantity/i)` returns the quantity number input. |
| **AC-4** | `InventoryForm` Unit field is accessible via `getByLabelText('Unit')` | Component Test | `getByLabelText(/unit/i)` returns the unit select dropdown. |
| **AC-5** | `InventoryForm` Cost Per Unit field is accessible via `getByLabelText('Cost Per Unit')` | Component Test | `getByLabelText(/cost per unit/i)` returns the cost per unit input. |
| **AC-6** | `InventoryForm` Purchase Date field is accessible via `getByLabelText('Purchase Date')` | Component Test | `getByLabelText(/purchase date/i)` returns the purchase date input. |
| **AC-7** | `InventoryForm` Expiry Date field is accessible via `getByLabelText('Expiry Date')` | Component Test | `getByLabelText(/expiry date/i)` returns the expiry date input. |
| **AC-8** | `InventoryForm` Notes field is accessible via `getByLabelText('Notes')` | Component Test | `getByLabelText(/notes/i)` returns the notes textarea. |
| **AC-9** | Clicking core item labels in `InventoryForm` focuses the associated input/select/textarea | Component / Interaction | Clicking `screen.getByText(/item name/i)` focuses the item name input (`document.activeElement`). |
| **AC-10** | Hop details Alpha Acid (%) is accessible via `getByLabelText('Alpha Acid (%)')` | Component Test | When category is Hop, `getByLabelText(/alpha acid/i)` returns the alpha acid input. |
| **AC-11** | Hop details Hop Form / Type is accessible via `getByLabelText('Hop Form / Type')` | Component Test | When category is Hop, `getByLabelText(/hop form/i)` returns the hop type select. |
| **AC-12** | Hop details Crop Year is accessible via `getByLabelText('Crop Year')` | Component Test | When category is Hop, `getByLabelText(/crop year/i)` returns the year input. |
| **AC-13** | Fermentable details Potential (SG) is accessible via `getByLabelText('Potential (SG)')` | Component Test | When category is Fermentable, `getByLabelText(/potential/i)` returns the potential SG input. |
| **AC-14** | Fermentable details Color (SRM) is accessible via `getByLabelText('Color (SRM)')` | Component Test | When category is Fermentable, `getByLabelText(/color/i)` returns the color SRM input. |
| **AC-15** | Fermentable details Fermentable Type is accessible via `getByLabelText('Fermentable Type')` | Component Test | When category is Fermentable, `getByLabelText(/fermentable type/i)` returns the grain type select. |
| **AC-16** | Fermentable details Supplier / Maltster is accessible via `getByLabelText('Supplier / Maltster')` | Component Test | When category is Fermentable, `getByLabelText(/supplier/i)` returns the supplier input. |
| **AC-17** | Yeast details Laboratory / Brand is accessible via `getByLabelText('Laboratory / Brand')` | Component Test | When category is Yeast, `getByLabelText(/laboratory/i)` returns the laboratory input. |
| **AC-18** | Yeast details Product ID / Code is accessible via `getByLabelText('Product ID / Code')` | Component Test | When category is Yeast, `getByLabelText(/product id/i)` returns the product ID input. |
| **AC-19** | Yeast details Attenuation (%) is accessible via `getByLabelText('Attenuation (%)')` | Component Test | When category is Yeast, `getByLabelText(/attenuation/i)` returns the attenuation input. |
| **AC-20** | Yeast details Form is accessible via `getByLabelText('Form')` | Component Test | When category is Yeast, `getByLabelText(/form/i)` returns the form select. |
| **AC-21** | Misc details Misc Type is accessible via `getByLabelText('Misc Type')` | Component Test | When category is Misc, `getByLabelText(/misc type/i)` returns the misc type select. |
| **AC-22** | Misc details Default Use is accessible via `getByLabelText('Default Use')` | Component Test | When category is Misc, `getByLabelText(/default use/i)` returns the default use select. |
| **AC-23** | Category detail shared fields (Origin, Lot # / Batch, Manufacturing Date) are accessible via `getByLabelText` | Component Test | `getByLabelText(/origin/i)`, `getByLabelText(/lot #/i)`, `getByLabelText(/manufacturing date/i)` resolve cleanly across categories. |
| **AC-24** | Clicking category detail labels focuses the associated control | Component / Interaction | Clicking `screen.getByText(/alpha acid/i)` focuses the alpha acid input (`document.activeElement`). |
| **AC-25** | `InventoryForm` action buttons render via `<Button>` | Component Test | Cancel, Save Item, and Delete buttons render as `<Button>`. |
| **AC-26** | Zero bare `<label className=...>` in `InventoryForm.tsx` | Static Analysis Sweep | All labels in `InventoryForm.tsx` render via `<FormField>`. |
| **AC-27** | Scope Guardrail — authorized files only | Verification | SHA-256 manifest diff matches authorized set: 0 created, 3 modified (`InventoryForm.tsx`, `InventoryForm.test.tsx`, `uiPrimitives.test.tsx`), 0 deleted. |
| **AC-28** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 across all workspaces. |
| **AC-29** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 clean). |
| **AC-30** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-31** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |
| **AC-32** | Manual verification screenshot captured | Verification | Screenshot `M31_P3_inventory_form_labels.png` saved in `.gsd/active/manual_verification/`. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Modify (3 files)
1. `apps/web/src/components/InventoryForm.tsx`
2. `apps/web/test/InventoryForm.test.tsx`
3. `apps/web/test/uiPrimitives.test.tsx`

### 3.2 Authorized to Create
**None.**

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, constants-only).
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
- **`M31_P3_inventory_form_labels.png`**: Screenshots of `InventoryForm` displaying core item information and Hop / Fermentable / Yeast / Misc category detail cards rendered with `<FormField>` labels, 40px controls, and accessible focus states.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
