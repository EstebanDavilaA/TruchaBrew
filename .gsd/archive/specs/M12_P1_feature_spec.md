# Feature Specification: Milestone 12 Phase 1 (M12_P1: Rich Catalog Presets & Category-Based Inventory)

## 1. Executive Summary & Context

Milestone 12 Phase 1 (M12_P1) delivers the category-based inventory layout and rich ingredient preset catalog system (`FEAT-011`):
1. **Expanded Ingredient Catalog**:
   - Expands the built-in preset catalogs for all 4 categories in `apps/api/src/db/seed.ts` with comprehensive industry-standard malts, hop varieties (with alpha acid %), yeast strains (with lab, form, and attenuation %), and brewing miscs/water agents.
   - Preserves exact existing seed IDs (`f-1..f-8`, `h-1..h-7`, `y-1..y-4`, `m-1..m-6`) while adding rich presets.
2. **Category-Based Collapsible Inventory Layout (`InventoryManager.tsx`)**:
   - Replaces the flat single-list view with 4 clean, collapsible category sections: **Fermentables**, **Hops**, **Yeasts**, and **Miscs**.
   - Each category section features an icon, category title, item count badge (e.g. `Fermentables (8)`), collapse/expand chevron toggle, and a dedicated `+ Add [Category]` button.
   - Retains global search bar (`data-testid="inventory-search"`), category filter, and out-of-stock toggle filter.
3. **Searchable Preset Modal Picker (`PresetPickerModal.tsx`)**:
   - Interactive searchable modal allowing users to search and select ingredients from the catalog.
   - Displays rich metadata badges (e.g., potential SG & color SRM for malts; alpha acid % and form for hops; laboratory and attenuation % for yeasts; role/type for miscs).
   - Selecting a preset opens `InventoryForm` pre-filled with the preset name, category, and canonical unit.
   - Includes an explicit **"+ Add Custom Item"** fallback button in each modal allowing direct custom ingredient creation.
4. **Data Integrity & Ledger Compatibility**:
   - Fully compatible with `inventory_items` and `inventory_transactions` ledger from Milestone 9.
   - Zero database schema migrations required (uses existing DB structure).

---

## 2. File Organization & Boundaries

### 2.1 Modified Files
- `apps/api/src/db/seed.ts`: Expand seed catalog lists for fermentables, hops, yeasts, and miscs with standard presets.
- `apps/web/src/components/InventoryManager.tsx`: Implement 4 collapsible category sections, count badges, quick category add triggers, search filtering, and preset modal integration.
- `apps/web/src/components/InventoryForm.tsx`: Support pre-filling from preset selection (`initialPreset`), category locking when launched from category context, and return navigation.
- `apps/web/test/InventoryManager.test.tsx`: Integration and component tests for 4-category layout, collapsible toggles, search filtering, and preset modal triggers.
- `apps/web/test/InventoryForm.test.tsx`: Component tests for preset pre-filling and custom item creation.

### 2.2 New Files
- `apps/web/src/components/PresetPickerModal.tsx`: Reusable searchable modal picker for selecting ingredients from the catalog or initiating custom ingredient addition.
- `apps/web/test/PresetPickerModal.test.tsx`: Unit and interaction tests for the preset picker modal.

### 2.3 Untouched Files (Protected)
- `apps/api/src/routes/` and API controllers (existing `/api/catalog` and `/api/inventory` endpoints are complete and untouched).
- `packages/calculations/` (Calculation engines and unit conversions untouched).
- `packages/shared-types/` (Data contracts already define `CatalogResponse`, `InventoryItem`, `InventoryStockView`).
- `.gsd/archive/` (Append-only).

---

## 3. Data Schema & Component Contracts

### 3.1 Catalog Expansion Inventory (`apps/api/src/db/seed.ts`)

#### Fermentables Catalog Additions
- Retains existing `f-1..f-8`.
- Adds:
  - `f-9`: `Vienna Malt` (Grain, 3.5 SRM, 1.037 SG)
  - `f-10`: `Caramunich I` (Grain, 35.0 SRM, 1.035 SG)
  - `f-11`: `Wheat Malt (Pale)` (Grain, 2.0 SRM, 1.038 SG)
  - `f-12`: `Rye Malt` (Grain, 3.5 SRM, 1.036 SG)
  - `f-13`: `Acidulated Malt` (Grain, 3.0 SRM, 1.033 SG)
  - `f-14`: `Roasted Barley` (Grain, 500.0 SRM, 1.025 SG)
  - `f-15`: `Black Malt / Patent` (Grain, 550.0 SRM, 1.025 SG)
  - `f-16`: `Flaked Barley` (Grain, 1.5 SRM, 1.032 SG)
  - `f-17`: `Dry Malt Extract (Light)` (Extract, 3.0 SRM, 1.044 SG)

#### Hops Catalog Additions
- Retains existing `h-1..h-7`.
- Adds:
  - `h-8`: `Amarillo` (9.2% AA, Pellet)
  - `h-9`: `Centennial` (9.5% AA, Pellet)
  - `h-10`: `Fuggle` (4.5% AA, Pellet)
  - `h-11`: `East Kent Goldings (EKG)` (5.0% AA, Pellet)
  - `h-12`: `Hallertau Mittelfrüh` (4.0% AA, Pellet)
  - `h-13`: `Galaxy` (14.5% AA, Pellet)
  - `h-14`: `Sabro` (13.5% AA, Pellet)
  - `h-15`: `Columbus / CTZ` (15.0% AA, Pellet)
  - `h-16`: `El Dorado` (15.0% AA, Pellet)

#### Yeasts Catalog Additions
- Retains existing `y-1..y-4`.
- Adds:
  - `y-5`: `S-04 SafAle English Ale` (Fermentis, Ale, Dry, 75% attenuation)
  - `y-6`: `Nottingham Ale Yeast` (Lallemand, Ale, Dry, 77% attenuation)
  - `y-7`: `Belle Saison Yeast` (Lallemand, Ale, Dry, 88% attenuation)
  - `y-8`: `WY1056 American Ale` (Wyeast, Ale, Liquid, 75% attenuation)
  - `y-9`: `WLP002 English Ale` (White Labs, Ale, Liquid, 70% attenuation)
  - `y-10`: `WLP830 German Lager` (White Labs, Lager, Liquid, 77% attenuation)

#### Miscs Catalog Additions
- Retains existing `m-1..m-6`.
- Adds:
  - `m-7`: `Epsom Salt` (WaterAgent, Mash, g)
  - `m-8`: `Table Salt (NaCl)` (WaterAgent, Mash, g)
  - `m-9`: `Baking Soda` (WaterAgent, Mash, g)
  - `m-10`: `Lactic Acid 88%` (WaterAgent, Mash, ml)
  - `m-11`: `Phosphoric Acid 75%` (WaterAgent, Mash, ml)
  - `m-12`: `Gelatin Finings` (Fining, Secondary, g)
  - `m-13`: `Sweet Orange Peel` (Spice, Boil, g)

---

### 3.2 `PresetPickerModal` Contract (`PresetPickerModal.tsx`)

#### Props Interface
```typescript
export interface PresetPickerModalProps {
  category: InventoryCategory;
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (presetName: string, category: InventoryCategory) => void;
  onSelectCustom: (category: InventoryCategory) => void;
}
```

#### Behavior & UI Elements
1. **Header**: Displays category-specific title (`Select Fermentable`, `Select Hop`, `Select Yeast`, `Select Misc`), search input (`data-testid="preset-picker-search"`), and Close button.
2. **List of Presets**:
   - Filtered live by search query (case-insensitive substring match on name, lab, or type).
   - Renders preset item rows (`data-testid="preset-item-${preset.id}"`) with:
     - Name and category icon.
     - Category-specific vitals:
       - Fermentables: `Potential: 1.037 SG • Color: 3.5 SRM • Type: Grain`
       - Hops: `Alpha Acid: 12.5% • Form: Pellet`
       - Yeasts: `Lab: Fermentis • Type: Ale • Attenuation: 78%`
       - Miscs: `Type: WaterAgent • Default: Mash (g)`
     - "+ Select" button (`data-testid="preset-select-${preset.id}"`).
3. **Custom Item Fallback Button**:
   - Persistent trigger: `data-testid="preset-add-custom-btn"`.
   - Clicking dispatches `onSelectCustom(category)` which opens `InventoryForm` in custom create mode with the selected category.

---

### 3.3 `InventoryManager` 4-Category Layout Contract

#### State & Partitioning
- Fetches all inventory items via `listInventory()`.
- Partitions items into 4 category groups:
  - `Fermentable`: `items.filter(i => i.category === 'Fermentable')`
  - `Hop`: `items.filter(i => i.category === 'Hop')`
  - `Yeast`: `items.filter(i => i.category === 'Yeast')`
  - `Misc`: `items.filter(i => i.category === 'Misc')`
- Section collapse state: `collapsedSections: Record<InventoryCategory, boolean>` initialized to all `false` (expanded).

#### Category Section Card Architecture
For each category (`Fermentable`, `Hop`, `Yeast`, `Misc`):
1. **Section Header** (`data-testid="inventory-category-header-${category}"`):
   - Category Icon (Wheat for Fermentable, Flower/Hop for Hop, Flask for Yeast, Sparkles for Misc).
   - Category Title and Count Badge: e.g. `Fermentables (4)`.
   - Quick Add Button (`data-testid="inventory-add-${category.toLowerCase()}"`): Clicking opens `PresetPickerModal` with that category.
   - Collapse Toggle Chevron: Clicking toggles collapse state for that section.
2. **Section Content**:
   - When expanded and items exist: Renders list of `ListRow` items within `LIST_CONTAINER_CLASS`.
   - When expanded and empty: Renders concise empty placeholder (`No ${category.toLowerCase()} items in inventory`).
   - When collapsed: Content is hidden.

---

## 4. Acceptance Criteria Matrix

| ID | Category | Requirement | Test Verification | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **AC-1** | Catalog | Seed database populates expanded catalog items | `seed.test.ts` | `seedDatabase` creates $\ge 16$ fermentables, $\ge 15$ hops, $\ge 9$ yeasts, $\ge 12$ miscs with accurate vitals |
| **AC-2** | Catalog | GET `/api/catalog` returns all 4 expanded categories | `catalog.test.ts` | 200 response returns hydrated `fermentables`, `hops`, `yeasts`, and `miscs` arrays |
| **AC-3** | UI Layout | `InventoryManager` renders 4 collapsible category sections | `InventoryManager.test.tsx` | Renders `Fermentables`, `Hops`, `Yeasts`, and `Miscs` section cards with item count badges |
| **AC-4** | UI Layout | Section collapse and expand toggles | `InventoryManager.test.tsx` | Clicking section header chevron collapses/expands the item list for that category |
| **AC-5** | UI Controls | Quick `+ Add` button per category section | `InventoryManager.test.tsx` | Clicking `inventory-add-hop` opens `PresetPickerModal` with `category="Hop"` |
| **AC-6** | Preset Modal | `PresetPickerModal` live search filtering | `PresetPickerModal.test.tsx` | Typing "citra" in hop picker filters results to Citra preset only |
| **AC-7** | Preset Modal | Preset selection pre-fills `InventoryForm` | `InventoryManager.test.tsx` | Selecting "Citra" preset navigates to `InventoryForm` with name="Citra", category="Hop", unit="g" |
| **AC-8** | Preset Modal | "+ Add Custom Item" fallback button | `PresetPickerModal.test.tsx` | Clicking "+ Add Custom" dispatches `onSelectCustom` with category context |
| **AC-9** | Form Flow | Custom addition via fallback preserves selected category | `InventoryForm.test.tsx` | Opening form via custom fallback locks category to selected category context with blank name |
| **AC-10** | Search | Global search bar in `InventoryManager` | `InventoryManager.test.tsx` | Typing search query filters items across all 4 category sections live |
| **AC-11** | Filters | "Out of stock only" filter in `InventoryManager` | `InventoryManager.test.tsx` | Enabling out-of-stock checkbox filters each category section to out-of-stock items only |
| **AC-12** | Stock Sync | Item edit, save, and delete round-trip from category view | `InventoryManager.test.tsx` | Editing an item from a category row updates inventory and refreshes category item list |
| **AC-13** | Quality | Layer 1 Four Gates exit 0 cleanly | Monorepo Root Check | `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` all exit 0 |
| **AC-14** | Scope Guard | Pre/Post SHA-256 Manifest Diff | Manifest Check | Only permitted inventory and catalog files modified |

---

---

## 5. Scope Guardrails & Non-Goals

- **Non-Goal**: We do not modify recipe calculation equations or water chemistry math.
- **Untouched List**: `packages/calculations/`, `apps/api/src/routes/batches.ts`, `recipes.ts`, `equipment.ts`, `schedules.ts`.

---

## 6. Pre-Execution SHA-256 Manifest
Before execution begins, generate pre-execution SHA-256 manifest at `.gsd/archive/manual_verification/M12_P1/pre_exec_manifest.json`.

---

## 7. Amendment 1: Category-Specific Inventory Item Details & Custom Vitals Editing

### 7.1 Context & Motivation
Brewing ingredients carry specific lot-dependent attributes that frequently vary between crops and suppliers (e.g., a specific crop of Amarillo hops with 8.5% Alpha Acid rather than the catalog preset's 9.2%, custom malts with unique potential SG and color SRM, yeast packages with distinct strain codes and attenuation %, and lot/harvest dates). This amendment refines Milestone 12 Phase 1 to support rich category-specific details across all 4 categories.

### 7.2 Data Contracts & Schema Updates

#### Database Migration (`0014_inventory_custom_details.sql`)
Additive nullable JSON-mode column added to `inventory_items`:
```sql
ALTER TABLE inventory_items ADD COLUMN custom_details text;
```

#### Shared Types (`packages/shared-types/src/inventory.ts`)
```typescript
export interface HopInventoryDetails {
  alphaAcidPct?: number | null;
  hopType?: string | null; // e.g. 'Pellet', 'Leaf', 'Cryo', 'Extract'
  origin?: string | null;
  year?: number | null;
  lotNumber?: string | null;
  manufacturingDate?: string | null;
}

export interface FermentableInventoryDetails {
  potentialSg?: number | null;
  colorSrm?: number | null;
  grainType?: string | null; // e.g. 'Grain', 'LiquidExtract', 'DryExtract', 'Sugar', 'Adjunct'
  supplier?: string | null;
  origin?: string | null;
  yieldPct?: number | null;
  lotNumber?: string | null;
  manufacturingDate?: string | null;
}

export interface YeastInventoryDetails {
  laboratory?: string | null;
  productId?: string | null;
  attenuationPct?: number | null;
  yeastType?: string | null; // e.g. 'Ale', 'Lager', 'Wheat', 'Wine'
  form?: string | null; // e.g. 'Dry', 'Liquid'
  lotNumber?: string | null;
  manufacturingDate?: string | null;
}

export interface MiscInventoryDetails {
  miscType?: string | null; // e.g. 'WaterAgent', 'Fining', 'Spice', 'Flavor', 'Other'
  defaultUse?: string | null; // e.g. 'Mash', 'Boil', 'Whirlpool', 'Primary', 'Secondary', 'Bottling'
  lotNumber?: string | null;
  manufacturingDate?: string | null;
}

export type InventoryCustomDetails =
  | ({ category: 'Hop' } & HopInventoryDetails)
  | ({ category: 'Fermentable' } & FermentableInventoryDetails)
  | ({ category: 'Yeast' } & YeastInventoryDetails)
  | ({ category: 'Misc' } & MiscInventoryDetails);

export interface InventoryItem {
  // ... existing fields ...
  customDetails?: InventoryCustomDetails | null;
}

export interface InventoryWriteInput {
  // ... existing fields ...
  customDetails?: InventoryCustomDetails | null;
}
```

### 7.3 UI Component Contracts

#### 1. `PresetPickerModal.tsx` & Preset Dispatch
- Preset selection passes `presetDetails` corresponding to the selected catalog preset to `onSelectPreset`:
  - Hop preset: passes `{ category: 'Hop', alphaAcidPct: preset.alphaAcidPct, hopType: preset.type }`.
  - Fermentable preset: passes `{ category: 'Fermentable', potentialSg: preset.potentialSg, colorSrm: preset.colorSrm, grainType: preset.type }`.
  - Yeast preset: passes `{ category: 'Yeast', laboratory: preset.laboratory, attenuationPct: preset.attenuationPct, yeastType: preset.type, form: preset.form }`.
  - Misc preset: passes `{ category: 'Misc', miscType: preset.type, defaultUse: preset.defaultUse }`.
- "+ Add Custom Item" fallback initializes `customDetails` with `{ category }` without pre-filled vitals.

#### 2. `InventoryForm.tsx` Category-Specific Form Section
Renders a dedicated **"Category Details"** card below "Item Information" tailored to the active category:
- **Hop Context**:
  - `Alpha Acid (%)`: number input (`data-testid="inventory-form-alpha-acid"`, step 0.1)
  - `Hop Form / Type`: select (`data-testid="inventory-form-hop-type"`, options: Pellet, Leaf, Cryo, Extract)
  - `Origin / Country`: text input (`data-testid="inventory-form-origin"`, placeholder: "e.g. US, Germany")
  - `Crop Year`: number input (`data-testid="inventory-form-year"`, placeholder: "e.g. 2025")
  - `Lot # / Batch`: text input (`data-testid="inventory-form-lot-number"`)
  - `Harvest / Manufacturing Date`: date input (`data-testid="inventory-form-manufacturing-date"`)
- **Fermentable Context**:
  - `Potential (SG)`: number input (`data-testid="inventory-form-potential-sg"`, step 0.001, e.g. 1.037)
  - `Color (SRM)`: number input (`data-testid="inventory-form-color-srm"`, step 0.1, e.g. 3.5)
  - `Fermentable Type`: select (`data-testid="inventory-form-grain-type"`, options: Grain, LiquidExtract, DryExtract, Sugar, Adjunct)
  - `Supplier / Maltster`: text input (`data-testid="inventory-form-supplier"`, placeholder: "e.g. BESTMALZ, Weyermann")
  - `Origin / Country`: text input (`data-testid="inventory-form-origin"`)
  - `Lot # / Batch`: text input (`data-testid="inventory-form-lot-number"`)
  - `Manufacturing Date`: date input (`data-testid="inventory-form-manufacturing-date"`)
- **Yeast Context**:
  - `Laboratory / Brand`: text input (`data-testid="inventory-form-laboratory"`, placeholder: "e.g. Fermentis, White Labs")
  - `Product ID / Code`: text input (`data-testid="inventory-form-product-id"`, placeholder: "e.g. S-04, WLP001")
  - `Attenuation (%)`: number input (`data-testid="inventory-form-attenuation"`, placeholder: "e.g. 75")
  - `Yeast Type`: select (`data-testid="inventory-form-yeast-type"`, options: Ale, Lager, Wheat, Wine)
  - `Form`: select (`data-testid="inventory-form-yeast-form"`, options: Dry, Liquid)
  - `Lot # / Batch`: text input (`data-testid="inventory-form-lot-number"`)
  - `Manufacturing Date`: date input (`data-testid="inventory-form-manufacturing-date"`)
- **Misc Context**:
  - `Misc Type`: select (`data-testid="inventory-form-misc-type"`, options: WaterAgent, Fining, Spice, Flavor, Other)
  - `Default Use`: select (`data-testid="inventory-form-default-use"`, options: Mash, Boil, Whirlpool, Primary, Secondary, Bottling)
  - `Lot # / Batch`: text input (`data-testid="inventory-form-lot-number"`)
  - `Manufacturing Date`: date input (`data-testid="inventory-form-manufacturing-date"`)

#### 3. `InventoryManager.tsx` List Row Vitals Badges
In each category section row meta, renders active vitals badges from `customDetails`:
- Hop: `e.g. 8.5% AA • Pellet` (rendered from `customDetails.alphaAcidPct` and `customDetails.hopType`)
- Fermentable: `e.g. 1.037 SG • 3.5 SRM` (rendered from `customDetails.potentialSg` and `customDetails.colorSrm`)
- Yeast: `e.g. Fermentis S-04 • 75% Att`
- Misc: `e.g. WaterAgent • Mash`

---

### 7.4 Acceptance Criteria Additions

| ID | Category | Requirement | Test Verification | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **AC-15** | Schema | Migration `0014_inventory_custom_details.sql` & REST API persistence | `inventory.migration.test.ts` & `inventory.test.ts` | `inventory_items` persists and returns `customDetails` JSON object across POST, PUT, and GET routes |
| **AC-16** | Form UI | Hop category detail controls | `InventoryForm.test.tsx` | Renders Alpha Acid %, Hop Type, Origin, Year, Lot #, and Manufacturing Date when category is Hop |
| **AC-17** | Form UI | Fermentable category detail controls | `InventoryForm.test.tsx` | Renders Potential SG, Color SRM, Grain Type, Supplier, Origin, Lot #, and Manufacturing Date when category is Fermentable |
| **AC-18** | Form UI | Yeast category detail controls | `InventoryForm.test.tsx` | Renders Laboratory, Product ID, Attenuation %, Yeast Type, Form, Lot #, and Manufacturing Date when category is Yeast |
| **AC-19** | Form UI | Misc category detail controls | `InventoryForm.test.tsx` | Renders Misc Type, Default Use, Lot #, and Manufacturing Date when category is Misc |
| **AC-20** | Form Flow | Preset pre-filling with user vitals customization | `InventoryForm.test.tsx` | Selecting preset pre-fills its vitals; user can override Alpha Acid % (e.g. to 8.5%) and saving persists the customized value |
| **AC-21** | UI Display | Category row vitals badges in `InventoryManager` | `InventoryManager.test.tsx` | List row meta displays active category-specific vitals (e.g. `8.5% AA • Pellet`, `1.037 SG • 3.5 SRM`) |

---

> **HALT GATE (STATE 2):** Amendment 1 is complete and presented for review.
>
> Implementation code generation is strictly forbidden until explicit approval.
> To approve and proceed to execution, reply with **`SPEC_APPROVED`**.

