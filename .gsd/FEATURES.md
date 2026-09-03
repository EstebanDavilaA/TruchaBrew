# GSD Feature Log

This document tracks feature requests, UX enhancements, layout polish, and candidate capability ideas recorded via `/log`.

---

## Item Status Lifecycle

Every entry follows this status progression:
- **`LOGGED`**: New feature request or idea logged via `/log`.
- **`SCHEDULED_MILESTONE (Milestone X)`**: Incorporated into `.gsd/ROADMAP.md` via `/roadmap_slices` or `/discover`.
- **`IN_PLANNING`**: Included in an active feature spec being drafted in `/plan`.
- **`IN_EXECUTION`**: Feature implementation underway in `/execute`.
- **`CLOSED`**: Verified complete by `/verify` and archived during `/steer`.

---

## Logged Features

### FEAT-001: Interactive Mash pH Calculator & Acid Addition Tool (Option 1: Brewfather-Style Modal)
- **Date Logged**: 2026-08-13
- **Status**: `CLOSED` (Delivered & Verified in Milestone 21 Phase 1)
- **Category**: Recipe Builder / Water Chemistry
- **UI UX Selection**: Option 1 (Brewfather-Style Dedicated Modal from `mash_ph_calculator_options.md`)
- **Summary**: Add an interactive Brewfather-style "Water pH" calculator modal triggered by clicking the Predicted Mash pH badge in `WaterSection.tsx`.
- **Details**:
  - **UX Design**: Option 1 — A clean popup modal ("Water pH - Mash pH Calculator") keeping the main recipe editor uncluttered.
  - **Target pH Control**: Allows setting a **Target Mash pH** (e.g. 5.30).
  - **Acid Addition Dosage**: Computes exact acid dosage (Lactic Acid 88% in mL, Phosphoric Acid 75% in mL, or Acidulated Malt in g) to bridge the delta between post-salts predicted pH and target pH.
  - **Engine Logic**: Pure calculation function added to `packages/calculations/src/water.ts` using acid neutralization equivalence factor.
  - **Recipe Integration**: Includes an "Add Acid to Recipe" action button that appends the calculated acid to the recipe's `miscs` list as a `WaterAgent` item (`use: 'Mash'`).
  - **2-Step Water Chemistry**: Supports full 2-step water workflow: (1) Mineral salts for ion/flavor balance + initial pH shift via Residual Alkalinity, (2) Organic acids for target pH fine-tuning without distorting flavor ions.

### FEAT-002: Post-Brew Efficiency Adjustment & Equipment Profile Calibration from Batch Experience
- **Date Logged**: 2026-08-14
- **Status**: `CLOSED` (Delivered & Verified in Milestone 17 Phase 1)
- **Category**: Batch Tracking / Equipment Profiles
- **Summary**: When completing a batch and comparing estimated vs. measured/real values, provide options to (1) adjust the recipe/batch efficiency to match real achieved efficiency, and (2) calibrate the parent Equipment Profile from that brew day experience.
- **Details**:
  - **Estimated vs. Real Comparison**: On the `Completed` batch view or `MeasuredComparison` component, display the delta between estimated target and actual measured Mash Efficiency & Brewhouse Efficiency.
  - **Adjust Recipe/Brew Efficiency**: Provide a direct action ("Apply Achieved Efficiency to Recipe / Batch") that updates `brewhouseEfficiencyPct` and/or `mashEfficiencyPct` based on real measured gravity/volume data.
  - **Calibrate Equipment Profile**: Provide an action ("Update Equipment Profile") that updates the parent Equipment Profile's efficiency (`brewhouseEfficiencyPct` / `mashEfficiencyPct`) and actual measured losses (boil-off, trub loss), so future recipe designs and batch scalings automatically inherit real-world calibrated kit performance.

### FEAT-003: Categorized Equipment Profile Form & Expanded Volume Losses (Mash Tun Dead Space & Kettle Loss)
- **Date Logged**: 2026-08-14
- **Status**: `LOGGED`
- **Category**: Equipment Profiles / UI Polish & Calculation Precision
- **Summary**: Re-structure the Equipment Profile editor (`EquipmentForm.tsx`) into 6 sectioned groups, and expand the Equipment Profile schema to account for mash tun dead space and kettle water losses.
- **Details**:
  - **Form Field Categorization**: Group fields in `EquipmentForm.tsx` into 6 logical sections:
    1. *General Info*: Profile Name, Boil Time, Notes/Description.
    2. *Volumes & Losses*: Batch Target, Batch Size, Boil-Off Rate, Trub/Chiller Loss, plus new loss fields.
    3. *Efficiency*: Brewhouse Efficiency %, Mash Efficiency %, Auto-sync toggle.
    4. *Mash & Water Parameters*: Mash Water Ratio (L/kg), Grain Absorption (L/kg), Sparge Temp.
    5. *Thermal Mass & Temperatures*: Mash Tun Heat Capacity, Grain Temp, Ambient Temp.
    6. *Hop Utilization & Advanced*: Hop Utilization Multiplier %, Hopstand Factor, Hopstand Temp, Whirlpool Time.
  - **Mash Tun Dead Space (`mashTunDeadSpaceL`)**: Add field for liquid volume trapped beneath false bottom / mash tun plumbing. Water calculations in `brewingMath.ts` (`calculateWaterVolumes`) will automatically incorporate mash tun dead space into strike/sparge water requirements.
  - **Kettle Losses (`kettleLossL` / `boilKettleLossL`)**: Add field for unrecoverable water/wort losses remaining in the boil kettle post-transfer, refining post-boil volume and pre-boil volume calculations.

### FEAT-004: Redesign Settings Screen Layout for App-Wide Cohesion
- **Date Logged**: 2026-08-14
- **Status**: `CLOSED` (Delivered & Verified in Milestone 13 Phase 2)
- **Category**: UI/UX / Settings
- **Summary**: Replace the disjointed individual floating cards in `SettingsManager.tsx` with unified, sectioned list containers (`divide-y divide-slate-800`, `border border-slate-800 rounded-xl`) matching the app's established list & section design pattern.
- **Details**:
  - **Visual Hierarchy**: Group settings into logical sections with clear section headers (e.g., *Units & Display* and *Formulas & Calculations*).
  - **Cohesive List Container**: Replace 5 standalone cards with single rounded list panels (`border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800`) utilizing hairline dividers between setting rows.
  - **Consistent Row Design**: Align setting labels on the left and form controls on the right (`py-3.5 px-4 flex items-center justify-between`), adhering to the density and visual language of `ListRow.tsx` and manager views.

### FEAT-005: App-Wide UI/UX Redesign, Form Sectioning & Field Caption System
- **Date Logged**: 2026-08-14
- **Status**: `IN_PLANNING`
- **Category**: UI/UX / App-Wide Design System
- **Progress**: Multi-milestone umbrella item — partially advanced by Milestone 30 (calculator surface) and Milestone 31 (`FormField` label association across the five kit/stock forms). M31_P4 contributes the explanatory-text typography sweep onto `METADATA_TEXT_CLASS`. **Not closed by this phase** — the collapsible sectioning, sticky jump-nav, and per-field "what & how" captions remain outstanding.
- **Summary**: Overhaul all forms and data entry views across the app (Recipe Editor, Equipment Profiles, Water Profiles, Schedules, Settings) with unified section containers, explanatory field captions ("what it is & how it's used"), collapsible accordion cards, and sticky section jump navigation to eliminate visual strain.
- **Details**:
  - **Explanatory Field Captions ("What & How")**: Implement standardized helper text underneath every input field across all forms detailing its physical meaning, calculation impact, and recommended target ranges (e.g. Grain Absorption: *"Water absorbed by spent grain after mashing (0.85–1.0 L/kg)"*, Sulfate: *"Accentuates hop bitterness and dryness"*).
  - **Unified Form Component System (`FormField.tsx`, `SectionCard.tsx`)**: Replace disjointed form fields and isolated cards with standardized rounded container cards (`border border-slate-800 rounded-xl`), hairline row dividers (`divide-y divide-slate-800`), and uniform label typography.
  - **Collapsible Sectioning & Sticky Quick-Nav**: Add collapsible accordion headers with summary badges and sticky jump navigation to multi-section forms (Recipe Editor, Batch Sheet) to enable 1-click focus and eliminate long scrolling fatigue.
  - **App-Wide Form Coverage**:
    - *Recipe Editor (`*Section.tsx`)*: Collapsible ingredient cards, sticky jump nav bar, inline summary chips (`Fermentables: 5.2 kg`, `Hops: 45 IBU`), and field captions.
    - *Equipment Profile (`EquipmentForm.tsx`)*: 6 grouped sections (General, Volumes/Losses, Efficiency, Mash/Water, Thermal Mass, Hop Utilization) with explicit captions.
    - *Water Profiles (`WaterProfileForm.tsx`)*: Cation & Anion grouped cards with captions explaining mineral effects ($Ca^{2+}$ for clarity/yeast health, $SO_4^{2-}$ for hop crispness, $Cl^-$ for malt fullness).
    - *Schedules (`MashProfileForm.tsx`, `FermentationProfileForm.tsx`)*: Step temperature, rest duration, and target pH guidance captions.
    - *Settings (`SettingsManager.tsx`)*: Unified section cards (*Units & Display*, *Formulas & Calculations*) with explanatory captions for unit systems, gravity units, and IBU/ABV strategy choices.

### FEAT-006: High-Precision Equipment Profile Engine (Volume Pipeline, Altitude Sync, Thermal Mass Toggle)
- **Date Logged**: 2026-08-14
- **Status**: `LOGGED`
- **Category**: Equipment Profiles / Physics & Calculation Engine / Brewing Dynamics
- **Summary**: Upgrade the TruchaBrew Equipment Profile Engine to implement strict reversible brewhouse volume accounting from packaged beer back to source water, altitude & boiling point synchronization with hop utilization scaling, and thermal mass strike temperature calculation with an explicit pre-heated vessel toggle to avoid enzyme denaturing.
- **Details**:
  - **1. Strike Temperature Over-Compensation Fix**:
    - Correct thermal mass calculation so pre-heated kettles and recirculating systems (HERMS/RIMS/Single Kettle eBIAB) compute realistic strike temperatures (~$73^\circ\text{C}-74^\circ\text{C}$ for a $67^\circ\text{C}$ rest) rather than enzyme-destroying values ($>80^\circ\text{C}$).
    - Toggle `calcStrikeWithThermalMass: boolean` (Default `false` for recirculated/pre-heated systems).
    - Standard Formula (when `calcStrikeWithThermalMass == false`):
      $$T_{\text{strike}} = T_{\text{target}} + \frac{c_g}{R_{\text{actual\_ratio}}} \times (T_{\text{target}} - T_{\text{grain}})$$
      where $R_{\text{actual\_ratio}} = \frac{V_{\text{strike}}}{W_{\text{grain, kg}}}$, $c_g = 0.40\ \text{cal}/(\text{g}\cdot^\circ\text{C})$.
    - Cold Tun / Thermal Mass Formula (when `calcStrikeWithThermalMass == true`):
      $$T_{\text{strike}} = T_{\text{target}} + \frac{\left(c_g \cdot W_{\text{grain, kg}} + c_t \cdot W_{\text{tun, kg}}\right) \times (T_{\text{target}} - T_{\text{grain}})}{c_w \cdot V_{\text{strike}}}$$
      where $c_t$ is `mashTunHeatCapacity` (Stainless: 0.12, Aluminum: 0.21, Plastic: 0.30), $c_w = 1.00$.
    - **Enzyme Safety Guardrail**: Warning/clamp when $T_{\text{strike}} > 78.0^\circ\text{C}$.
  - **2. Altitude & Boiling Point Synchronization**:
    - Calculate real boiling point from elevation:
      $$T_{\text{boil}} = 100.0 - (0.00335 \times h)$$ (e.g. $94.8^\circ\text{C}$ at $1,500\ \text{m.a.s.l.}$).
    - Dynamically scale hop alpha-acid utilization factor:
      $$F_{\text{alt}} = 1.0 - 0.008 \times (100.0 - T_{\text{boil}})$$
      $$\text{IBU}_{\text{adjusted}} = \text{IBU}_{\text{standard}} \times F_{\text{alt}}$$
  - **3. Complete Brewhouse Volume & Loss Pipeline**:
    - $V_{\text{fermenter}} = V_{\text{packaged}} + L_{\text{fermenter}}$
    - $V_{\text{postboil, cold}} = V_{\text{fermenter}} + L_{\text{kettle\_trub}} + (W_{\text{hops, g}} \times R_{\text{hop\_absorb}})$
    - $V_{\text{postboil, hot}} = \frac{V_{\text{postboil, cold}}}{1 - \gamma_{\text{shrinkage}}}$ ($\gamma_{\text{shrinkage}} = 0.04$)
    - $V_{\text{preboil, hot}} = V_{\text{postboil, hot}} + \left( R_{\text{boiloff}} \times \frac{t_{\text{boil}}}{60} \right)$
    - $L_{\text{grain}} = W_{\text{grain, kg}} \times R_{\text{grain\_absorb}}$
    - $V_{\text{total\_water}} = V_{\text{preboil, hot}} + L_{\text{grain}} + L_{\text{deadspace}} + L_{\text{mash\_loss}}$
    - $V_{\text{strike}} = (W_{\text{grain, kg}} \times R_{\text{mash\_ratio}}) + L_{\text{deadspace}}$
    - $V_{\text{sparge}} = V_{\text{total\_water}} - V_{\text{strike}}$
  - **4. Schema & Data Contract Extensions**:
    - `EquipmentProfile`: `altitudeMeters`, `boilTemperature`, `fermenterLoss`, `kettleTrubLoss`, `wortCoolingShrinkageRate`, `hopAbsorptionRate`, `grainAbsorptionRate`, `mashWaterToGrainRatio`, `mashTunDeadspace`, `mashTunLoss`, `mashTunWeight`, `mashTunHeatCapacity`, `calcStrikeWithThermalMass`, `defaultGrainTemp`.
    - Output model: `WaterVolumeBreakdown`.

### FEAT-007: Domain-Specific Hop Schedule Timing Controls (Whirlpool Steep Duration/Temp & Dry-Hop Day Offset/Duration)
- **Date Logged**: 2026-08-14
- **Status**: `LOGGED`
- **Category**: Recipe Builder / Hop Scheduling & Fermentation Integration
- **Summary**: Overhaul the Hop addition data model and `HopSection.tsx` UI to represent true brewing semantics for each hop use type: Boil time (minutes to flameout), Hopstand / Whirlpool (steep minutes and steep temperature °C), and Dry Hop (fermentation day offset and exposure duration in days).
- **Details**:
  - **1. Contextual UI Inputs in `HopSection.tsx`**:
    - Replace the generic "Time (min)" column with contextual timing cells based on `HopUse`:
      - *Boil / First Wort*: Boil duration in minutes counting down to flameout (`60 min`, `15 min`, etc.).
      - *Whirlpool / Hopstand*: Steep duration (`20 min`) + Target Steep Temperature (`80 °C` / reading equipment profile or hopstand override).
      - *Dry Hop*: Two structured inputs — **Day Offset** (`Start: Day 3` after fermentation start) and **Duration** (`Duration: 4 days`).
  - **2. Schema & Storage Updates**:
    - `HopItem` domain type:
      - `boilMins: number | null` (Boil / First Wort)
      - `whirlpoolMins: number | null`, `whirlpoolTempC: number | null` (Whirlpool / Hopstand)
      - `dryHopDayOffset: number | null`, `dryHopDurationDays: number | null` (Dry Hop)
    - Database migration and Drizzle mapping for `recipe_hops`.
  - **3. Batch Sheet & Brew Log Timeline Sync**:
    - Link Dry Hop schedule directly to Batch fermentation calendar (notifying brewer when Day X of fermentation is reached to add dry hops, and Day X+Y to rack/remove).

### FEAT-008: Brewfather-Style Tabbed Batch Architecture (Isolated Header, Sectioned Stage Views, TopBar Save/Cancel)
- **Date Logged**: 2026-08-14
- **Status**: `CLOSED` (Delivered & Verified in Milestone 13 Phase 1)
- **Category**: Batch Tracking / UI Architecture & Workflow
- **Summary**: Overhaul the Batch Detail page (`BatchDetail.tsx`) inspired by Brewfather's tabbed batch design: isolate Batch Name and Status in a standalone header card, introduce horizontal stage tabs (`Planning`, `Brewing`, `Fermentation`, `Completed` / `Conditioning`) to switch between stage data on click, and elevate Save/Cancel and Status Transition (Advance / Revert) actions into the contextual `TopBar`.
- **Details**:
  - **1. Standalone Batch Header Card**:
    - Separate Batch Name, current Status badge, and Recipe link from numeric measurements into a dedicated top panel.
    - Status badge displayed cleanly in the header.
  - **2. Horizontal Stage Navigation Tabs (Brewfather Pattern)**:
    - Tab bar displaying primary stages:
      - `Planning`: Recipe snapshot, target vitals (OG, FG, ABV, IBU, SRM), water plan summary, and equipment specs.
      - `Brewing`: Pre-boil gravity, actual mash pH, boil size, boil time, OG, and live mash efficiency calculations.
      - `Fermentation`: Fermentation chart, attenuation %, SG/Temp reading log, and cellar notes log.
      - `Conditioning / Completed`: Final gravity, bottling/packaging volume, carbonation panel (volumes CO2, sugar/pressure), tasting notes & 1-5 rating, and full measured-vs-estimated comparison summary.
    - Clicking any tab immediately brings up that section's focused cards without altering or forcing a batch status transition.
  - **3. TopBar Actions & Status Transitions (Advance / Revert)**:
    - **Status Transitions in TopBar / Sub-Header**: Provide explicit action triggers to advance to the next lifecycle stage (e.g. *Advance to Brewing*, *Start Fermentation*, *Move to Conditioning*, *Mark Completed*) or revert to a previous stage (e.g. *Revert to Planning*).
    - **Form Action Alignment**: Relocate primary form actions (`Save Changes`, `Discard Changes`, `Delete Batch`) to the sticky `TopBar`, eliminating bottom form buttons and vertical scrolling fatigue.

### FEAT-009: Viewport Shell Scroll Isolation (Fixed Sidebar, Persistent TopBar, Dedicated PageContainer Scroll)
- **Date Logged**: 2026-08-15
- **Status**: `CLOSED` (Delivered & Verified in Milestone 13 Phase 1)
- **Category**: UI/UX / Layout Architecture
- **Summary**: Fix application shell scrolling by locking the root viewport (`h-screen overflow-hidden flex`) so `Sidebar` and `TopBar` remain permanently visible, and isolate all vertical scrolling strictly to the inner `PageContainer` content area (`flex-1 overflow-y-auto min-w-0`).
- **Details**:
  - **1. Fixed Viewport Root**:
    - Update `App.tsx` layout shell wrapper from `min-h-screen` to `h-screen overflow-hidden flex`.
    - Prevent window/body scrollbars from appearing and shifting layout containers.
  - **2. Always Visible Sidebar**:
    - `Sidebar` container pinned to `h-full flex-shrink-0` with internal scroll if navigation items exceed viewport height.
  - **3. Persistent TopBar Header**:
    - `TopBar` component stays pinned at the top of the main content column (`flex-shrink-0`), guaranteeing title, status indicators, and contextual action buttons (e.g. *Save Changes*, *Discard*, *New Recipe*, *Scale*, *Delete*) remain in view regardless of how far down a form is scrolled.
  - **4. Dedicated PageContainer Scrolling**:
    - Constrain scroll handling to the inner page view (`PageContainer.tsx` / `main` wrapper with `flex-1 overflow-y-auto min-w-0 pb-16`), providing smooth scrolling across long forms (Recipe Editor, Batch Detail, Equipment Profiles, Mash Schedules, Calculators) without losing navigation context.

### FEAT-010: External Provider Recipe Import in Settings (Brewfather JSON & Multi-Provider Ingestion)
- **Date Logged**: 2026-08-15
- **Status**: `IN_PLANNING` (Milestone 22 Phase 1)
- **Category**: Settings & Integrations / Data Ingestion & Migration
- **Summary**: In Settings (`SettingsManager.tsx`), introduce a dedicated "Data & Imports / External Providers" section allowing users to upload and ingest existing recipes from external providers (starting with Brewfather JSON, extensible to BeerXML and others) directly into their TruchaBrew recipe library.
- **Details**:
  - **1. Settings "Data & Imports / Providers" Section (`SettingsManager.tsx`)**:
    - Add a structured settings panel for **Recipe Ingestion & Integrations**.
    - **Provider Selector**: Select external provider format (e.g., *Brewfather (.json)*, *BeerXML (.xml)*, *Standard JSON*).
    - **File Upload Zone**: Drag-and-drop area and file browser button supporting single file or batch multi-recipe uploads.
  - **2. Import Pre-Flight & Preview Modal**:
    - Interactive preview modal displaying parsed recipe vitals before committing:
      - Recipe Name, Style, Batch Size, OG, FG, ABV, IBU, Color.
      - Ingredient counts & breakdown (Fermentables, Hops, Yeasts, Miscs, Water Salts).
      - Target Equipment Profile association (match existing by name/size or generate an imported profile).
      - Mash Profile association (link existing or import embedded mash steps).
    - Multi-recipe batch queue: checkbox selection to review and selectively import recipes.
  - **3. Format Parsing & Mapping Pipeline**:
    - Modular provider adapter architecture (`@truchabrew/calculations` or dedicated ingestion service):
      - **Brewfather Provider**: Parses `.json` schema (documented in `.gsd/documents/bf_api_types.md` and `.gsd/documents/montano_brewing_recipes.json`).
      - Maps fermentables (potential, color, type), hops (use, boil/whirlpool timing, temp), yeasts (attenuation, lab), miscs, water volumes, and mineral salts.
    - Architecture designed so additional provider adapters (e.g. BeerXML, Beersmith) can be plugged in without changing the core import workflow.
  - **4. Validation, Duplicate Handling & Ingestion Feedback**:
    - Detect duplicates against existing library recipes by name/hash with conflict resolution options (*Skip*, *Overwrite*, *Save as Copy*).
    - Clear progress and outcome summary reporting successfully imported recipes and actionable warnings for unrecognized non-standard fields.

### FEAT-011: Category-Based Inventory System with Ingredient Presets & Modal Pickers (Brewfather Style)
- **Date Logged**: 2026-08-16
- **Status**: `CLOSED` (Delivered & Verified in Milestone 12 Phase 1 + Amendment 1)
- **Category**: Inventory / Ingredient Catalogs & Presets / UI Architecture
- **Summary**: Structure the main Inventory view into 4 collapsible/expandable category sections (Fermentables, Hops, Miscs, Yeasts) with item count badges and quick `+ Add` triggers. When adding items to inventory (or recipe/batch design), present a dedicated searchable modal picker populated with rich preset catalog items containing pre-configured brewing constants and metadata (just like Brewfather).
- **Details**:
  - **1. 4 Category-Based Inventory Sections (`Fermentables`, `Hops`, `Miscs`, `Yeasts`)**:
    - Collapsible accordion sections on the main Inventory page (`Inventario`).
    - Section headers display category icon, category name, total item count badge (e.g. `Fermentables (14)`, `Lúpulos (8)`, `Diversos (4)`, `Levaduras (3)`), and a quick `+ AÑADIR` (+ Add) button.
    - Global header with inventory search bar (`Buscar inventario...`), sorting, export/import, print, and filters.
  - **2. Searchable Preset Selection Modals (`Seleccione [Categoría]`)**:
    - Clicking `+ Add` for any category opens a dedicated modal with live search, preset library list, and item-level stock indicators:
    - **Fermentables Modal (`Seleccione Fermentable`)**:
      - Presets with: Maltster/Brand (BESTMALZ, Briess, Admiral Maltings, etc.), Malt Name (Vienna, Acidulated, Black Malt, Caramel Amber, Caramel Munich I/III, Chocolate, Pale Ale, Roasted Barley, Rye Malt, Wheat Malt, Flaked Oats, Admiral Pils, Admiral's Hearth, etc.), Color (EBC / Lovibond), Potential gravity (e.g. `1.035`, `1.036`, `1.040`), Type (`Grano`, `Sugar`, `Extract`), Origin (`Germany`, `US`, `NO`, `California, USA`), and current on-hand / negative stock tracking.
    - **Hops Modal (`Seleccione Lúpulo`)**:
      - Presets with: Hop Variety (Amarillo, Cascade, Citra, East Kent Goldings (EKG), Fuggles, Hallertauer Mittelfrueh, Mosaic, Sabro, Adeena, Admiral, African Queen, Aged Hop Blend, Agnus, Ahhhroma Hops, Ahil, Ahtanum, Akoya, Alliance, Aloha, Alora, etc.), Alpha Acid % (e.g. `9.2%`, `5.5%`, `12.0%`, `14.0%`), Form (`Pellet`, `Leaf`, `Cryo`), Origin/Country (`US`, `United Kingdom`, `Germany`, `South Africa`, `Czech Republic`, `Slovenia`), and on-hand stock.
    - **Miscs Modal (`Seleccione Misceláneo`)**:
      - Presets with: Ingredient Name (Calcium Chloride (CaCl2), Epsom Salt (MgSO4), Gypsum (CaSO4), Whirlfloc, ALDC, Accumash, Agave Nectar, American Oak Cubes (Heavy/Medium Toast), Oak Infusion Spirals, Amylase Enzyme, Anise Star, Anti-foam, Antioxin SBT, Apple/Apricot Extracts & Purees, Aromazyme, Ascorbic Acid, etc.), Role/Type (`Agente del agua` / Water Agent, `Clarificante` / Fining, `Sabor` / Flavor, `Especia` / Spice, `Otro` / Other), and on-hand stock.
    - **Yeasts Modal (`Seleccione Levadura`)**:
      - Presets with: Laboratory/Brand (Fermentis, AB Mauri, AEB, Lallemand, White Labs, Wyeast, etc.), Strain Name/Code (S-04 — SafAle English Ale, US-05 — Safale American, WB-06 — Safbrew Wheat, Y514 — English Ale, Mauribrew Draught, Y497 — Mauribrew L, Y1433 — Mauribrew Weiss, 21078 — FERMO Brew Acid, 21092 — FERMO Brew Citrus, 21106 — FERMO Brew Fruity, 21054 — FERMO R03, Fermo Brew Nectar, Fermoale AY3/AY4/Bel-Abbey, etc.), Type (`Ale`, `Lager`, `Trigo`, `Otro`), Attenuation % (e.g. `75%`, `81%`, `86%`, `69%`, `100%`), Form (`Dry pack`, `Liquid`), and on-hand packages.
  - **3. Preset Selection & Custom Item Fallback**:
    - Selecting a catalog preset auto-fills physical properties and default values (potential, color, alpha acid %, attenuation %, role/type, default units) while allowing the brewer to specify custom inventory batch details (quantity on hand, cost per unit, purchase date, best before date, lot number).
    - Includes a `+ AÑADIR` / Custom addition button inside each modal to define custom user-created ingredients not present in the standard preset catalog.

### FEAT-012: Brewfather-Style Water Chemistry & Acid Calculator Modal (Compact Summary Row, Dedicated Modal, Separate Mash/Sparge Adjustments & Explicit "Save to Recipe" Action)
- **Date Logged**: 2026-08-17
- **Status**: `CLOSED` (Delivered & Verified in Milestone 21 Phase 1)
- **Category**: Recipe Builder / Water Chemistry & UX Architecture
- **Summary**: Replace the bulky inline `WaterSection` form with a clean Brewfather-style recipe summary line featuring an interactive `[CALC] / pH X.XX` trigger button that opens a dedicated, full-featured Water Chemistry & Acid Adjustments Modal. The modal clearly separates grist baseline pH, volumes (mash vs sparge), source/target profiles, independent mash vs sparge mineral additions, acid adjustments, and commits changes back to the recipe via an explicit "Save Adjustments to Recipe" action.
- **Details**:
  - **1. Compact Recipe Section Summary Line (Brewfather Pattern)**:
    - Replace the large inline card in the Recipe Designer with a slim, informative summary row:
      - Water Volumes breakdown: Mash Water (L), Sparge Water (L @ Sparge Temp °C), Total Water (L), Total Mash Volume (Grain + Water L).
      - Active Water Profile & finished ion concentrations chip ($Ca^{2+}, Mg^{2+}, Na^+, Cl^-, SO_4^{2-}, HCO_3^-$).
      - Interactive right-aligned badge button: `pH 5.30 [CALC]` (clicking opens the full Water Calculator modal).
  - **2. Dedicated Water Calculator Modal Architecture**:
    - **Header & Live Target**: Displays live predicted mash pH badge (e.g. `pH del macerado 5.25`), Reset button (`RESTABLECER`), and Auto-adjust salts button (`AUTO`).
    - **Grist Distilled Baseline Breakdown**: Lists grist items with mass, type/EBC, and the calculated distilled-water mash pH baseline (e.g. `5.72`).
    - **Volume Context**: Clear display of Mash Water Volume vs. Sparge Water Volume.
    - **Source Profile & Dilution**: Source water selection with ion display, swap button, and optional distilled/RO dilution percentage slider.
    - **Target Profile & Style Ranges**: Target profile selector with ion goals, plus optional BJCP style guidelines mineral range reference ($Ca: 50-150, SO_4: 50-350, \text{etc.}$).
  - **3. Granular Mineral Additions (Separate Mash & Sparge)**:
    - **Mash Mineral Additions**: Independent gram inputs for Gypsum ($CaSO_4$), Calcium Chloride ($CaCl_2$), Epsom Salt ($MgSO_4$), Hydrated Lime ($Ca(OH)_2$), and Baking Soda ($NaHCO_3$).
    - **Sparge Mineral Additions**: Toggleable section (`Lavado de granos`) to independently dose sparge water salts.
    - **Live Ion Concentrations & Deltas**: Live table showing ion ppm vs target deltas, plus Sulfate to Chloride ratio description (e.g. `Seco o amargo (2.4)`, `Equilibrado (1.0)`, `Maltoso (0.6)`).
  - **4. Acid Adjustments (Separate Mash & Sparge)**:
    - **Mash Acid Toggle (`Ácido Macerado`)**: Enable/disable acid addition, pick acid type (Lactic 88%, Phosphoric 75%, or Acidulated Malt), and input/auto-calculate dosage to hit target mash pH.
    - **Sparge Acid Toggle (`Ácido Lavado de granos`)**: Enable/disable acid addition to sparge water to prevent polyphenol/tannin extraction (targeting sparge water pH 5.5–5.8).
  - **5. Explicit Commit Workflow ("Save Adjustments to Recipe")**:
    - Prominent bottom action button: `GUARDE AJUSTES A LA RECETA` (Save adjustments to recipe).
    - Syncs all chosen salts and acids into the recipe's `miscs` list with proper `use: 'Mash'` and `use: 'Sparge'` classifications and updates recipe water profile IDs in one clean, atomic commit.

### FEAT-013: Interactive Brew Day Assistant, Planning Stock Deduction & Brewing Stage Workflow (Live Timers, Audio Alerts, Checklist & Fermentation Hand-off)
- **Date Logged**: 2026-08-18
- **Status**: `CLOSED` (Delivered & Verified in Milestone 15 Phase 1)
- **Category**: Batch Tracking / Brew Day Assistant & Stage Workflow (Planificación y Elaboración)
- **Summary**: Transform the `Planning` and `Brewing` stage tabs of `BatchDetail.tsx` into a comprehensive, interactive Brew Day Companion (inspired by Brewfather's *Seguimiento de la elaboración*): adds an interactive inventory deduction confirmation in Planning mode to verify and deduct ingredients on brew day start, step-by-step guidance through water heating, grain prep, and mashing with countdown timers and temperature ramps, sparge/lauter calculations, transfer to kettle, pre-boil measurements with in-place refractometer conversion and thermal contraction correction, boil countdown with synchronized hop/misc addition alarms, post-boil cooling & hopstand timers, chilled transfer, gravity/volume logging, yeast pitching, and seamless transition to Fermentation.
- **Details**:
  - **1. Planning Stage Inventory Checkoff & Deduction Verification ("Deducir del Inventario")**:
    - Interactive stock verification panel in `Planning` mode displaying available inventory vs. required recipe amounts for all 4 categories (Fermentables, Hops, Yeasts, Miscs/Salts).
    - **1-Click "Deduct Ingredients from Inventory" Action**: Calls `POST /api/batches/:id/checkoff`, deducting exact recipe quantities with full FIFO ledger traceability and updating on-hand stock badges with green checkmark confirmations.
    - **Reversal & Auditability**: Displays deduction status with option to restore/reverse ledger entries if a brew day is rescheduled.
  - **2. In-Batch Recipe Adjustments & Ingredient Substitutions ("Ajustar Receta del Lote / Receta Ajustada")**:
    - **Brew Day Grain & Hop Substitution**: If an ingredient is out of stock or short on brew day (e.g., needed 5.0kg Pilsner but only 3.5kg on hand + 1.5kg Pale 2-Row available), allows the brewer to substitute, add, or split malts, swap hop varieties (with auto-IBU adjustment based on AA%), or change yeast directly on the batch instance.
    - **Live Batch Target Recalculation**: Instantly recomputes target OG, ABV, IBU, SRM, and water volume requirements specifically for this batch snapshot.
    - **Batch-Only vs. Master Recipe Sync**: Gives the brewer a clear toggle:
      - *(a) Batch-Only Modification (Default)*: Updates `batch.recipeSnapshot` for this specific brew without altering the master recipe in the library.
      - *(b) Save to Master Recipe*: Propagates the modifications back to the original recipe in the library if the brewer wants the changes to be permanent.
    - **Synchronized Stock Deduction**: The inventory deduction engine automatically updates to deduct the *actually substituted* items (e.g., 3.5kg Pilsner + 1.5kg Pale 2-Row) rather than the original unadjusted grain bill.
  - **3. Interactive Brew Day Timeline & Live Timer Bar (`Seguimiento de la elaboración`)**:
    - Persistent top progress tracker across brew day sub-stages:
      - `1. Preparación` (Water & Grain Prep) $\rightarrow$ `2. Macerado` (Mash & Lauter) $\rightarrow$ `3. Hervir` (Boil & Additions) $\rightarrow$ `4. Hop Stand / Enfriamiento` (Whirlpool & Chill) $\rightarrow$ `5. Fermentador` (Pitch & Ferment).
    - Large digital timer countdown display with Play/Pause, Fast-Forward, Skip, Reset, and Web Audio sound cues (with mute toggle).
    - Contextual instruction card displaying the current active step (e.g. *"Calentar 19.32 L de agua a 72.7°C"*, *"Mash Rest: 75 min @ 65.0°C"*, *"Adición de lúpulo: 50 g Saaz a los 60 min"*, *"Enfriar a 80°C e iniciar Hop Stand de 20 min"*).
  - **4. Guided Brew Day Stages & Precision Tools**:
    - **Stage 1 — Water & Grain Preparation**:
      - Strike water volume & target temperature heating guidance ($T_{\text{strike}}$ calculated from grain temp and tun thermal mass).
      - Sparge water volume & heating guidance ($V_{\text{sparge}}$ @ $77^\circ\text{C}$).
      - Malt bill weighing checklist and grinding/milling confirmation.
      - Mineral salt & water acid addition checklist for mash & sparge.
    - **Stage 2 — Mashing, Temperature Ramps & Lautering**:
      - Dough-in confirmation, strike water infusion checklist.
      - Live countdown timer for each mash profile rest step (e.g. Beta-amylase, Alpha-amylase, Mash-out).
      - Temperature ramp guidance between steps.
      - Sparge water infusion and lauter runoff collection tracking.
    - **Stage 3 — Transfer to Kettle & Pre-Boil Measurements**:
      - Input fields for **Pre-Boil Volume (L)** and **Pre-Boil Gravity (SG / °P)**.
      - **In-Place Refractometer Brix $\rightarrow$ SG Converter**: Quick popup/toggle next to gravity inputs for brewers measuring with optical refractometers.
      - **Hot Volume Thermal Shrinkage ($\gamma = 0.04$) Toggle**: 1-click conversion from kettle hot expansion volume to standard 20°C cold volume.
      - Input field for **Actual Measured Mash pH** with comparison against predicted target pH.
      - Live calculation of achieved **Mash Efficiency %** ($E_{\text{mash}}$) before the boil starts, with quick DME/water adjustment suggestions if gravity is off-target.
    - **Stage 4 — Boil Schedule & Timed Additions**:
      - Total boil countdown timer (e.g. 60 min / 90 min).
      - Audible alerts / visual notifications synchronized to hop addition times (e.g. 60 min bittering, 15 min flavor/aroma, 10 min Whirlfloc/Irish moss finings, 0 min flameout).
      - Checklist for chiller sanitization immersion (15 min prior to flameout).
    - **Stage 5 — Post-Boil Measurements, Hopstand & Cooling**:
      - Input fields for **Post-Boil Volume (L)** and **Post-Boil Gravity (Original Gravity - OG)**.
      - Live calculation of achieved **Brewhouse Efficiency %** ($E_{\text{brewhouse}}$) and actual boil-off rate.
      - Hopstand / Whirlpool stage: Target temperature prompt (e.g. cool to $80^\circ\text{C}$), followed by active hopstand steep timer (e.g. 20 min countdown) for aroma hop additions.
    - **Stage 6 — Chilling, Transfer to Fermenter & Yeast Pitching**:
      - Wort chilling to target pitch temperature (e.g. $18^\circ\text{C}$ - $20^\circ\text{C}$ for Ale, $10^\circ\text{C}$ - $12^\circ\text{C}$ for Lager).
      - Transfer to fermenter and input field for **Fermenter Volume (L)** (accounting for kettle trub loss).
      - Yeast rehydration / preparation checklist, wort aeration/oxygenation reminder, and yeast pitching confirmation.
      - 1-click **"Start Fermentation / Iniciar Fermentación"** action that records `fermentationStartDate`, transitions batch status from `Brewing` to `Fermenting`, and hands off to the Fermentation tracking tab.
  - **5. Dual-View Layout ("Hoja de Elaboración" & "Valores Medidos / Estadísticas")**:
    - **Brew Sheet Panel ("Hoja de Elaboración")**: Complete recipe reference card with grain bill, hop schedule, water volumes, and mash profile instructions.
    - **Live Measurements Panel ("Valores Medidos")**: Clean numerical input card for brew day measurements with instant feedback on gravities, volumes, and efficiencies.

### FEAT-014: Fermentation Stage Assistant: Live Vitals Tracking, Timeline Schedule & Proactive Cellar Alerts (Dry Hops, Temperature Ramps & Spunding Pressure)
- **Date Logged**: 2026-08-18
- **Status**: `CLOSED` (Delivered & Verified in Milestone 16 Phase 1)
- **Category**: Batch Tracking / Fermentation Stage & Cellar Schedule (Fermentación)
- **Summary**: Enhance the `Fermentation` stage tab of `BatchDetail.tsx` into a proactive cellar monitoring station that tracks live fermentation vitals (SG, temperature, pressure, attenuation %, live ABV) and keeps the brewer actively informed of upcoming schedule events: dry-hop additions and removals, planned temperature ramps (primary, diacetyl rest, cold crash), spunding valve pressure adjustments, and finings/adjunct additions through a visual fermentation timeline and actionable event banner.
- **Details**:
  - **1. Proactive Cellar Event Feed & Upcoming Action Cards**:
    - **Upcoming Dry-Hop Additions**: Displays scheduled dry hop additions linked from the recipe hop schedule (`HopItem.dryHopDayOffset` and `HopItem.dryHopDurationDays`) with relative day countdown (e.g. *"Dry Hop #1: Add 50g Citra on Day 3 (Tomorrow at 14:00) — Leave for 4 days"*, *"Dry Hop Removal: Rack/remove Citra hops on Day 7"*).
    - **Temperature Schedule Ramp Alerts**: Displays current active fermentation step vs. upcoming target step transitions (e.g. *"Current: Primary @ 19.0°C (Day 1–5)"*, *"Next: Ramp to 22.0°C for Diacetyl Rest in 18 hours (Day 5)"*, *"Cold Crash: Drop to 2.0°C on Day 9"*).
    - **Spunding & Pressure Target Alerts**: Informs brewer of scheduled pressure changes (e.g. *"Set Spunding Valve to 12.0 PSI on Day 4 to naturally carbonate under pressure"*).
    - **Cellar Additions & Finings**: Alerts for gelatin / biofine fining additions, dry yeast nutrients, oak cubes, or fruit purees.
    - **Interactive "Mark Done" / Check-off Action**: 1-click completion of cellar actions that automatically logs a timestamped entry into the Batch Notes / Cellar Log.
  - **2. Live Fermentation Vitals & Metric Dashboard**:
    - **Current Specific Gravity (SG / °P)** and **Current Temperature (°C / °F)** with last reading timestamp.
    - **Refractometer Alcohol Correction**: Automatically corrects optical refractometer readings taken during active fermentation to eliminate false high FG caused by ethanol.
    - **Live Apparent Attenuation %**: Computed dynamically against Original Gravity ($OG$) from latest gravity reading.
    - **Real-Time Estimated ABV %**: Calculated via standard or advanced formula from $(OG - SG_{\text{latest}})$.
    - **Spunding Vessel Pressure (PSI / bar)** input and carbonation level preview.
  - **3. Interactive Fermentation Trajectory Chart & Reading Log**:
    - Multi-series chart plotting Target Temperature schedule curve, actual logged temperatures, and gravity decay curve over time.
    - Overlay markers on the chart showing planned vs. completed cellar actions (Dry Hop, Diacetyl Rest, Cold Crash).
    - Quick-entry log for hydrometer / refractometer / Tilt / iSpindle readings (timestamp, SG, temp, notes) with automatic temperature correction.
  - **4. Stage Completion & Packaging Handoff**:
    - **FG Stability Detector**: Clear visual badge when gravity stabilizes ($\Delta \text{SG} \le 0.001$) across 48+ hours.
    - 1-click **"Advance to Conditioning / Packaging"** action transferring final gravity ($FG$) into batch stats and unlocking bottling, kegging, and packaging carbonation tools.

### FEAT-015: Packaging Stage Split Calculator (Bottles vs Kegs) & Post-Brew Equipment Profile Calibration Feedback Loop
- **Date Logged**: 2026-08-18
- **Status**: `CLOSED` (Delivered & Verified in Milestone 17 Phase 1)
- **Category**: Batch Tracking / Packaging, Carbonation & Equipment Calibration
- **Summary**: Expand the `Completed / Conditioning` stage tab with a split packaging calculator (enabling partial bottling with priming sugar and partial kegging under force carbonation) and a 1-click calibration feedback loop that pushes measured brew day efficiency, boil-off rate, and trub losses back into the parent Equipment Profile and Recipe.
- **Details**:
  - **1. Split Packaging Calculator (Bottling vs Kegging)**:
    - Allows dividing the finished beer volume (e.g. 19 L packaged = 10 L in Keg #1 at 12 PSI + 9 L in 27x 330mL bottles with 58g Table Sugar).
    - Computes exact priming sugar mass by sugar type (Dextrose/Corn Sugar, Sucrose/Table Sugar, DME, Honey) tailored to bottled volume.
    - Computes regulator equilibrium PSI by target CO2 volumes and storage temperature for kegged volume.
  - **2. Post-Brew Calibration Feedback Loop (Closing Loop)**:
    - **Calibrate Equipment Profile**: 1-click action ("Update Equipment Profile") that updates the parent Equipment Profile's boil-off rate (L/hr), kettle trub loss (L), and brewhouse efficiency % from actual brew day achievements.
    - **Calibrate Recipe Target Efficiency**: Action to adjust recipe target efficiency to match real-world brewhouse performance for future batches.
  - **3. Structured Sensory Rating & BJCP Style Comparison**:
    - Star rating (1–5) and structured sensory evaluation (Aroma, Appearance, Flavor, Mouthfeel, Overall Impression).
    - Side-by-side radar comparison of final measured vitals (OG, FG, ABV, IBU, SRM) against BJCP style guideline thresholds.

### FEAT-016: Dedicated "Packaging" Batch Stage Tab & Completed Stage Re-alignment (Bottling/Kegging Vitals, Tasting & Recipe/Equipment Adjustments)
- **Date Logged**: 2026-08-19
- **Status**: `CLOSED` (Delivered & Verified in Milestone 20 Phase 1)
- **Category**: Batch Tracking / Workflow Architecture & Stage Specialization (Embotellado y Evaluación)
- **Summary**: Introduce a dedicated intermediate `Packaging` stage tab between `Fermentation` and `Completed`. The `Packaging` tab houses bottling and kegging details, split carbonation calculator (sugar mass, water/sugar syrup ratio, bottle injection volume, equilibrium PSI), packaging volume, and final brew day vitals/statistics. The `Completed` tab is streamlined to focus exclusively on post-conditioning sensory evaluation (tasting scores, notes), final recipe adjustments, and equipment profile calibration feedback.
- **Details**:
  - **1. 5-Stage Batch Navigation (`Planning` $\rightarrow$ `Brewing` $\rightarrow$ `Fermentation` $\rightarrow$ `Packaging` $\rightarrow$ `Completed`)**:
    - Update `BatchStageTabs` to include 5 distinct tabs:
      - `Planning`: Recipe snapshot, targets, inventory stock verification & deduction.
      - `Brewing`: Brew day timeline, timers, pre-boil/post-boil measurements, boil schedule, chilling & pitch.
      - `Fermentation`: Fermentation chart, SG/temperature readings, cellar schedule (dry hops, temp steps, spunding), and FG measurement.
      - `Packaging`: Packaging volume, split packaging manager (bottles vs. kegs, priming sugar with water/sugar syrup injection ratio, keg PSI), and final batch vitals & yield statistics.
      - `Completed`: Tasting notes & sensory evaluation (Aroma, Appearance, Flavor, Mouthfeel, Overall), BJCP style comparison, batch cost & nutrition breakdown, recipe adjustments, and post-brew equipment profile calibration.
  - **2. Status Transition Alignment**:
    - `Packaging` tab links to `Conditioning` / `Packaging` status with the in-tab action bar: `↳ CHANGE STATUS TO PACKAGING`.
    - `Completed` tab links to `Completed` status with `↳ CHANGE STATUS TO COMPLETED`.
  - **3. User Experience & Ergonomics**:
    - Clear separation of physical packaging operations (bottling, kegging, carbonation) from post-conditioning sensory appraisal and long-term equipment calibration.

### FEAT-017: Editable Batch Name & Batch Number in Batch Detail Header
- **Date Logged**: 2026-08-19
- **Status**: `CLOSED` (Delivered & Verified in Milestone 19 Phase 1)
- **Category**: Batch Tracking / UI/UX & Customization
- **Summary**: Allow brewers to edit and customize the Batch Name and Batch Number (`batchNo`) directly from the Batch Detail view (`BatchDetail.tsx`), enabling custom batch numbering sequences and descriptive batch renaming to match physical cellar logs.
- **Details**:
  - **1. Editable Header Controls**:
    - Provide inline edit inputs or a quick "Edit Batch Info" action on the Batch Detail header card allowing direct modification of `name` (e.g. *"Batch #4 - Porter toda rica toda deliciosa"*) and `batchNo` (e.g. `4`).
  - **2. TopBar & Breadcrumb Synchronization**:
    - Updating the batch name dynamically reflects in the sticky `TopBar` title and batch list overview upon saving.
  - **3. Data Schema & Persistence**:
    - Ensure `PUT /api/batches/:id` accepts `name` and `batchNo` in `BatchWriteInput`, persisting changes across database and client state.

### FEAT-018: Brewfather-Style Batch Planning Stage Architecture (Editable Meta & Brew Date, Batch Recipe Card, Water Summary & Inventory Checkoff Table)
- **Date Logged**: 2026-08-19
- **Status**: `CLOSED` (Delivered & Verified in Milestone 19 Phase 1)
- **Category**: Batch Tracking / Planning Stage & Inventory Integration (Planificación del Lote)
- **Summary**: Overhaul the `Planning` stage tab of `BatchDetail.tsx` into a 2-column Brewfather-inspired planning workbench: allows setting an explicit Brew Date, provides direct batch metadata editing (Name, Number, Brewer), features a dedicated Batch Recipe card with inline vitals and adjust/save actions, water volume & pH summary, and transforms the inventory section into a rich itemized checkoff table with individual item deduction checkboxes and live stock editing.
- **Details**:
  - **1. Planning Header & Metadata Block**:
    - **Batch Identity**: Editable inputs for Batch Name (`name`), Batch Number (`batchNo`), and Brewer name.
    - **Brew Date Picker**: Date picker input for `brewDate` (e.g. `06/30/2025`) stored on the batch record.
  - **2. Batch Recipe Card ("Batch Recipe")**:
    - Recipe summary displaying beer icon, recipe name, style/type (e.g. *All Grain*), and target vitals (ABV, OG, FG, IBU, Color).
    - Quick actions: Save snapshot to master recipe, Scale/Refresh batch recipe, and Edit/Adjust batch recipe modal.
    - Explanatory caption: *"The batch contains a copy of the original recipe. Editing the batch recipe does not alter the original recipe."*
  - **3. Water Volumes & pH Summary Row**:
    - Clean summary line detailing: Mash water volume (L), Sparge water volume (L @ Sparge Temp °C), Total water volume (L), Total mash volume (water + grain L), and predicted mash pH badge.
  - **4. Itemized Inventory Checkoff Table & Per-Item Action Buttons**:
    - **Existing Engine Integration**: Leverages the existing FIFO inventory ledger deduction backend (`/api/batches/:id/checkoff`) and `StockCheckPanel` state.
    - **Header Actions**: `Print` brew sheet button, `Deduct All from Inventory` bulk action, and `Undo Deduct` reversal trigger.
    - **Right-Aligned Per-Item Check / Deduct Buttons**:
      - Positioned on the right side of each ingredient row (aligned beneath the top `Deduct All from Inventory` button).
      - Styled per design tokens (e.g. `Check / Deduct` button in `bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700` or `bg-emerald-950 text-emerald-300` when deducted).
      - Allows checking off / deducting ingredients one-by-one or in bulk with live stock feedback.
    - **Table Columns & Data**:
      - `Item`: Ingredient name, maltster/brand, EBC / Alpha Acid % / form.
      - `Recipe`: Target recipe quantity (e.g. `5.3 kg`, `98 g`, `3 pkg`).
      - `Stock Status`: Real-time on-hand stock balance badge, missing/shortage warnings, and quick inline stock adjustment trigger (`✎`).
      - `Action`: Per-item check / deduct button on the right edge.
  - **5. Status Timeline & Batch Notes Log**:
    - Chronological log of status transitions with timestamps (e.g. `Jun 30, 2025 -> Brewing`, `Jul 1, 2025 -> Fermenting`, `Aug 10, 2025 -> Conditioning`, `Aug 12, 2026 -> Completed`).
    - Dedicated batch notes stream with quick `+ ADD` note trigger.

### FEAT-019: Brewfather-Style Brew Sheet Viewer Toggle & Enhanced Continuous Brew Day Tracker Timeline
- **Date Logged**: 2026-08-19
- **Status**: `CLOSED` (Delivered & verified in Milestone 18 Phase 1)
- **Category**: Batch Tracking / Brewing Assistant & Recipe Reference (Seguimiento de la Elaboración)
- **Summary**: Add an interactive Brew Sheet toggle to the `Brewing` stage tab that expands a rich, printable recipe specification sheet (Vitals, Volumes, Mash rests, Malts, Hops, Miscs, Yeast, Fermentation schedule, Carbonation), and upgrade the `BrewDayTracker` into a continuous horizontal timeline matching Brewfather's interactive brew tracker (retaining the 4 pure brewing sub-stages: `1. Preparation`, `2. Mash`, `3. Boil`, `4. Hop Stand`, with milestone dots, media controls, large centered timer box, and step instruction checklists, while eliminating the redundant fermentation step which belongs in the dedicated Fermentation tab).

### FEAT-020: Recipe Target Pre-fill & Expected Value Placeholders in Brew Day Measurements
- **Date Logged**: 2026-08-19
- **Status**: `CLOSED` (Delivered & verified in Milestone 18 Phase 1; non-destructive placeholders preserved and redundant accept button purged per BUG-023)
- **Category**: Batch Tracking / Brewing Stage UI/UX & Data Entry (Valores Medidos)
- **Summary**: Pre-fill or provide clear target placeholders for all expected recipe values in the `Brew Day Measurements` panel (`Pre-boil Gravity`, `Mash pH`, `Boil Size`, `Boil Time`, `Original Gravity OG`), allowing brewers to see expected targets at a glance and seamlessly override them with actual measured values on edit.
- **Details**:
  - **1. Target Value Pre-fill & Dynamic Placeholders**:
    - For each field in `Brew Day Measurements`:
      - *Pre-boil Gravity (SG)*: Placeholder showing estimated pre-boil gravity (e.g. `1.047`).
      - *Mash pH*: Placeholder showing predicted mash pH from water chemistry (e.g. `5.25`).
      - *Boil Size (L)*: Placeholder showing estimated pre-boil volume from equipment profile (e.g. `34.7 L`).
      - *Boil Time (min)*: Pre-filled with recipe boil duration (e.g. `60 min`).
      - *Measured OG (SG)*: Placeholder showing recipe target Original Gravity (e.g. `1.046`).
  - **2. Seamless Edit & Override Workflow**:
    - Inputs display expected numbers in subtle placeholder styling when no measured value has been entered yet.
    - As soon as the brewer focuses and types an actual hydrometer/refractometer reading, the field commits the true measured value and updates live efficiency & calibration figures.
    - Quick "Use Expected Target" 1-click icon button next to fields to accept estimated targets directly when measurements match prediction.

### FEAT-021: Settings Screen Responsive Full-Width Grid & Layout Modernization
- **Date Logged**: 2026-08-22
- **Status**: `LOGGED`
- **Category**: Settings / UI/UX & Layout Architecture
- **Summary**: Modernize `SettingsManager.tsx` to remove the narrow `max-w-2xl` panel restriction, expanding the settings interface across the available screen space inside `PageContainer` using a balanced multi-column responsive grid (or structured wide container) matching the design language of batch detail, recipe designer, and profile manager views.
- **Details**:
  - **1. Full-Width Space Utilization**: Remove the hardcoded `max-w-2xl` width constraint from the settings container.
  - **2. Responsive Multi-Column Layout**:
    - On desktop (`lg`/`xl` screens), arrange settings cards (`Units & Display`, `Formulas & Calculations`, `Data & Recipe Ingestion`) into a balanced 2-column or 12-column responsive layout.
    - On mobile/tablet screens, gracefully stack panels with full width.
  - **3. Design System Alignment**: Ensure settings panels adhere to standard full-width page container patterns established across other primary application routes.

### FEAT-022: WaterProfileForm Responsive Grid, Cation/Anion Sectioning & Space Optimization
- **Date Logged**: 2026-08-22
- **Status**: `LOGGED`
- **Category**: Water Profiles / UI/UX & Responsive Layout
- **Summary**: Overhaul the Water Profile editor (`WaterProfileForm.tsx`) to fix input field overlapping and clipping on tablet/intermediate viewports (~778px), and restructure the layout into balanced Cation ($Ca^{2+}, Mg^{2+}, Na^+$) vs. Anion ($Cl^-, SO_4^{2-}, HCO_3^-$) grouped cards or a 2-column workbench layout with live Sulfate-to-Chloride ratio calculation, eliminating wasted blank space on widescreen displays.
- **Details**:
  - **1. Responsive Grid & Overlap Prevention**: Ensure input containers and labels use `min-w-0`, appropriate responsive column breakpoints (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3` or 2-column paired layout), preventing any input overlap or horizontal card blowout.
  - **2. Structured Cation & Anion Grouping**:
    - *Cation Card*: Calcium, Magnesium, Sodium.
    - *Anion Card*: Chloride, Sulfate, Bicarbonate, with pH and Sulfate-to-Chloride ratio summary badge.
  - **3. Widescreen Space Utilization**: Balance Profile Info and Ion Panels in a responsive multi-column layout on desktop viewports.

### FEAT-023: FermentationProfileForm Responsive Step Grid & Balanced Field Organization
- **Date Logged**: 2026-08-22
- **Status**: `LOGGED`
- **Category**: Fermentation Profiles / UI/UX & Responsive Layout
- **Summary**: Modernize the Fermentation Profile editor step cards (`FermentationProfileForm.tsx`) to eliminate input field overlap and container blowout on intermediate screens (~762px), and rebalance step fields (Name, Type, Temp, Duration, Ramp, Pressure) into an aligned, responsive grid that eliminates empty trailing gaps on desktop displays.
- **Details**:
  - **1. Balanced Responsive Grid**: Replace the asymmetric 5-column layout (`sm:grid-cols-5`) with balanced 3-column / 4-column responsive groupings (e.g. 2 symmetric rows of 3 fields or responsive breakpoints `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
  - **2. Overlap & Overflow Elimination**: Apply `min-w-0` to all input/select containers, and constrain `<select>` and `<input>` styles to stay strictly within column boundaries.
  - **3. Widescreen Visual Polish**: Eliminate jagged row offsets and empty column voids across step cards.

### FEAT-024: MashProfileForm Responsive Multi-Tier Grid & Sizing Affordance Overhaul
- **Date Logged**: 2026-08-22
- **Status**: `LOGGED`
- **Category**: Mash Profiles / UI/UX & Responsive Grid Architecture
- **Summary**: Re-architect `MashProfileForm.tsx` with a tiered, responsive multi-column layout (Mobile <640px stacked, Tablet 640px–1024px 2-column, Desktop ≥1024px strict 4-column) with proportional field sizing affordances (wide Name fields vs. compact numeric fields), eliminating irregular gaps and scattered field arrangements.
- **Details**:
  - **1. Desktop 4-Column Grid Alignment (≥1024px)**:
    - *Top Section*: Balanced layout for Profile Name (span 2), Target pH (span 1), and Sparge Temp Override (span 1).
    - *Step Cards*: Row 1 = Name (span 2), Type (span 1), Temp (°C) (span 1); Row 2 = Rest (min), Ramp (min), Infuse Amount (L), Infuse Water Temp (°C) in an even 4-column row (`grid-cols-4`).
  - **2. Tablet & Mobile Responsive Breakpoints**:
    - *Tablet (640px–1024px)*: 2-column grid grouping Name/Type on row 1 and numeric inputs in a 2x2 grid below.
    - *Mobile (<640px)*: Single-column full-width stack with paired compact numeric fields.
  - **3. Form Field Sizing Affordance**: Text inputs expand to appropriate width limits (~300–400px / span 2), while numeric inputs (pH, Temp, Minutes, Liters) maintain compact proportional widths (~100–140px).

### FEAT-025: Recipe Library Responsive Layout, Rich Metric Metadata, and Header Hierarchy Polish
- **Date Logged**: 2026-08-22
- **Status**: `LOGGED`
- **Category**: Recipe Library / UI/UX & Layout Architecture
- **Component**: `apps/web` (`components/RecipeLibrary.tsx`, `components/TopBar.tsx`, `components/ListRow.tsx`)
- **Summary**: Overhaul the Recipe Library interface to eliminate severe layout clamping on widescreen displays, resolve awkward header button wrapping and title truncation on mobile (<400px), upgrade row metadata to surface core brewing metrics (ABV, IBU, OG, SRM/color chip), and standardize the search input with design system tokens.
- **Details**:
  - **1. Viewport & Responsive Layout**:
    - *Widescreen (>=1024px)*: Expand the recipe list across available width within `PageContainer` with a responsive multi-column card grid or wide row layout, eliminating large unused voids to the right.
    - *Mobile (<640px / 384px)*: Cleanly stack `TopBar` elements (Title + Search full-width, actions in a cohesive row or icon group) to prevent button overflow and aggressive recipe title truncation.
  - **2. Rich Metric Metadata Architecture**:
    - Update each recipe card/row to display key brewing indicators using `font-mono tabular-nums tracking-tight`:
      - Estimated ABV (e.g. `5.4%`)
      - Bitterness IBU (e.g. `38 IBU`)
      - Target OG (e.g. `1.052`)
      - Visual SRM/EBC color chip or badge alongside Style Name.
  - **3. Design System & Component Fidelity**:
    - Refactor list items using `<ListRow>` or `<Card>` primitives with minimum 44px tap targets for mobile.
    - Standardize search input styling in `TopBar.tsx` / `RecipeLibrary.tsx` to match `designSystem.ts` `INPUT_CLASS` specifications.

### FEAT-026: Recipe Designer Responsive Header, Action Hierarchy, and Sub-Section Table Architecture Refactor
- **Date Logged**: 2026-08-22
- **Status**: `IN_PLANNING`
- **Progress**: Partially advanced by Milestone 32. Detail §2's second bullet ("Enforce `MONO_VALUE_CLASS` on all quantity, time and temperature inputs") is delivered for `HopSection.tsx` by M32_P1 and for `FermentableSection.tsx` / `MiscSection.tsx` by M32_P2. **Not closed** — the `<Table>` primitive and responsive card-collapse (detail §2, first bullet), the TopBar action hierarchy (§1), and the `<FormField>` metadata header grid (§3) all remain outstanding and are owned by Milestones 33–35.
- **Category**: Recipe Designer / UI/UX & Layout Architecture
- **Component**: `apps/web` (`components/RecipeEditor.tsx`, `components/TopBar.tsx`, `components/MiscSection.tsx`, `components/LiveRecipeStats.tsx`)
- **Summary**: Overhaul the Recipe Designer interface to resolve severe title truncation (`Recip...`) and action button crowding at tablet viewports (~800px), establish clear button hierarchy (eliminating competing primary amber buttons), prevent data table horizontal container blowout in `MiscSection.tsx` and sub-panels, enforce tabular numerals (`font-mono tabular-nums`) on all numeric inputs, and standardize recipe metadata fields with `<FormField>` primitives.
- **Details**:
  - **1. Header & Action Hierarchy**:
    - *Responsive TopBar Actions*: On intermediate/tablet viewports (<880px), refactor action buttons so secondary/utility actions (`Delete`, `Scale Batch`) group into an overflow icon menu or compact secondary buttons, preventing header title truncation.
    - *Action Hierarchy Standardization*: `Save Recipe` remains Primary (`BUTTON_PRIMARY_CLASS`), `Brew This` adopts Secondary/Operational action styling (`BUTTON_SECONDARY_CLASS` or dedicated emerald/blue accent), and `Delete` uses Destructive styling (`BUTTON_DANGER_CLASS`).
  - **2. Table Responsiveness & Design System Primitives**:
    - Replace manual table layout in `MiscSection.tsx` (and hop/malt sections) with standardized `<Table>` primitives supporting responsive horizontal scroll or compact card collapse on mobile (<640px), eliminating container boundary overflow and clipped action buttons.
    - Enforce `MONO_VALUE_CLASS` (`font-mono tabular-nums tracking-tight`) on all quantity, time, and temperature inputs to eliminate layout shift.
  - **3. Metadata Header Consistency**:
    - Standardize Recipe Name, Style, Brewer, and Equipment Profile fields using `<FormField>` / `<Input>` tokens with consistent 40px input heights (`h-10`) in a 12-column responsive grid layout.

### FEAT-027: Water Chemistry & Acid Adjustments Modal Architecture, Viewport Containment, and Table Alignment Refactor
- **Date Logged**: 2026-08-22
- **Status**: `LOGGED`
- **Category**: Calculators & Modals / UI/UX & Layout Architecture
- **Component**: `apps/web` (`components/WaterCalculatorModal.tsx`, `components/Modal.tsx`, `components/ui/Table.tsx`, `components/ui/NumberInput.tsx`)
- **Summary**: Overhaul the Water Chemistry modal layout to prevent screen clipping on viewports <= 941px height, decouple crowded header elements into clean title and operational action rows, eliminate ragged mineral table alignment via integrated input unit addons (`addonRight="g"`), and align acid adjustments into a structured responsive grid.
- **Details**:
  - **1. Modal Shell & Scroll Architecture**:
    - Standardize the dialog using `<Modal>` primitive with a fixed viewport height constraint (`max-h-[90vh] flex flex-col`).
    - Implement a fixed modal header, scrollable body (`flex-1 overflow-y-auto pr-1`), and sticky modal footer housing `Cancel` and `Save Adjustments to Recipe` action buttons.
  - **2. Header & Action Decoupling**:
    - Reorganize the top area: isolate the title and close trigger on row 1, and place the pH comparison pills and operational actions (`Reset`, `AUTO`) into a dedicated sub-header or toolbar strip.
  - **3. Rigid Table & Input Tokenization**:
    - Refactor the mineral table to use design system `<Table>` component primitives.
    - Use `<NumberInput>` primitives with built-in trailing unit addons (`addonRight="g"`) and strict `font-mono tabular-nums` formatting to ensure pixel-perfect column alignment.
  - **4. Acid Adjustments Form System**:
    - Align Acid Type, Target pH, and Dosage fields into a clean 2-column or 4-column structured grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`) using standard 40px input heights (`h-10`).

### FEAT-029: Modal Header & Action Footer Design System Standardization
- **Date Logged**: 2026-08-25
- **Status**: `IN_EXECUTION`
- **Category**: Design System / UI/UX Consistency & Component Modernization
- **Components**: `apps/web` (`components/Modal.tsx`, `components/BatchRecipeAdjustModal.tsx`, `components/RecipeImportModal.tsx`, `components/PostBrewCalibrationModal.tsx`, `components/RefractometerFermentationModal.tsx`, `components/PresetPickerModal.tsx`, `components/ConfirmDialog.tsx`, `App.tsx`)
- **Summary**: Standardize the modal header (title, icon badge, subtitle description) and action footer (split cancel/save layout) across all application dialogs to match the `WaterCalculatorModal` reference design.
- **Details**:
  - **1. Modal Header Standardization**:
    - *Header Container*: Standardize modal headers to use `p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-shrink-0`.
    - *Amber Icon Accent Badge*: Left-side icon enclosed in a standard square badge (`p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20`).
    - *Title & Subtitle Hierarchy*: Main title (`text-lg font-bold text-white`) placed directly above a subtitle description (`text-xs text-slate-400`) within the header box, ensuring consistent vertical typography.
    - *Dismiss Action*: Right-aligned `<Button variant="icon" onClick={onClose}><X className="w-5 h-5" /></Button>`.
  - **2. Modal Action Footer Standardization (Split Navigation Pattern)**:
    - *Footer Container*: Standardize modal footers to use `p-6 pt-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between flex-shrink-0`.
    - *Left Action*: Secondary/dismiss action (`Cancel`) rendered via `<Button variant="secondary" size="sm">` anchored to the left.
    - *Right Action*: Primary confirmation/save action rendered via `<Button variant="primary" size="sm">` anchored to the right.
  - **3. Elimination of Inconsistent Modal Patterns**:
    - Normalize padding, borders, and button variants across all 8 modal surfaces.

### FEAT-030: Searchable Preset Picker Modal in Recipe Editor & Full Ingestion Modernization
- **Date Logged**: 2026-08-27
- **Status**: `CLOSED (delivered M34_P5, 2026-08-27)`
- **Resolution**: Delivered in full by Milestone 34 Phase 5 — `PresetPickerModal` searchable catalog picker wired into `FermentableSection.tsx`, `HopSection.tsx`, `YeastSection.tsx`, and `MiscSection.tsx` (AC-2..AC-5), retiring the static `<select>` dropdowns. Independently verified: `CRITIC_REPORT.md` M34_P5 entry (2026-08-27), PASS 28/28 ACs.
- **Category**: UI/UX / Recipe Editor & Component Modernization
- **Components**: `apps/web` (`components/RecipeEditor.tsx`, `components/FermentableSection.tsx`, `components/HopSection.tsx`, `components/YeastSection.tsx`, `components/MiscSection.tsx`, `components/PresetPickerModal.tsx`)
- **Summary**: Replace the static, non-searchable HTML `<select>` dropdown boxes (`-- Select Grain / Malt from Catalog --`, `-- Select Hop Variety --`, etc.) in the Recipe Editor ingredient sections with the searchable `PresetPickerModal` catalog workflow, bringing rich metadata previews, live search filtering, and seamless custom ingredient entry to recipe formulation.
- **Details**:
  - **1. Elimination of Static Recipe Editor Dropdowns**:
    - Retire the wide, un-filterable `<select>` rows at the bottom of `FermentableSection.tsx`, `HopSection.tsx`, `YeastSection.tsx`, and `MiscSection.tsx`.
    - Replace them with clean action buttons (`<Button variant="secondary" size="sm">` e.g. `+ Add Fermentable from Catalog`, `+ Add Hop from Catalog`) that open the dedicated `PresetPickerModal`.
  - **2. Searchable Preset Picker Dialog Integration**:
    - Connect each section to `PresetPickerModal` with instant fuzzy search filtering across all catalog items.
    - Display rich ingredient metadata directly in the selection card:
      - *Fermentables*: Potential SG (e.g. `1.038`), Color SRM (`35 SRM`), Type (`Grain`, `Sugar`, `Extract`).
      - *Hops*: Alpha Acid % (`14.5%`), Form (`Pellet`, `Leaf`, `Cryo`).
      - *Yeast*: Lab (`Lallemand`, `Fermentis`, `White Labs`), Attenuation % (`75-80%`), Form.
      - *Miscs*: Purpose (`WaterAgent`, `Fining`, `Flavor`), Default Stage (`Mash`, `Boil`).
  - **3. Instant Ingestion & Custom Fallback**:
    - Selecting an item from the modal immediately inserts it into the recipe table with calibrated defaults.
    - Persistent `+ Add Custom Item` action in the modal allows manual entry of uncatalogued ingredients without breaking focus.

### FEAT-031: Batch Recipe Adjustment Modal: Scale Batch Recipe Integration
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: Batch Tracking / Recipe Adjustment & Scaling
- **Components**: `apps/web` (`components/BatchRecipeAdjustModal.tsx`, `components/ScaleRecipeModal.tsx`, `pages/BatchDetail.tsx`)
- **Summary**: Add a "Scale Recipe" action button within the "Adjust Batch Recipe" modal (`BatchRecipeAdjustModal.tsx`) allowing the brewer to scale the batch recipe snapshot to a different target batch volume directly during in-batch adjustments on brew day.
- **Details**:
  - **1. Action Button in Adjust Batch Recipe Header/Toolbar**:
    - Add a secondary action button (`<Button variant="secondary" size="sm">` with `<Scale className="w-4 h-4 text-amber-400" />` icon, e.g. `Scale Batch Recipe` or `Scale Volume`) in `BatchRecipeAdjustModal.tsx`.
    - Opens a batch-specific scale dialog or inline input allowing the brewer to input a new target batch size in Liters.
  - **2. In-Batch Scaling Execution**:
    - Reuses the pure calculation `scaleRecipe` from `@truchabrew/calculations` against the local working copy of `localRecipe`.
    - Rescales fermentables, hops, and miscs proportionally while updating the batch equipment profile's `batchSizeL` and target water requirements.
    - Live target metrics (OG, FG, ABV, IBU, SRM, Strike Water, Sparge Water, Total Water) update dynamically in the live vitals tiles.
  - **3. Isolation & Master Sync Safety**:
    - Scaled recipe remains local to the modal until the brewer clicks `Save Adjustments`.
    - Honors the `syncToMasterRecipe` checkbox: if unchecked, only the batch's `recipeSnapshot` is updated to the scaled batch size; if checked, the master recipe in the library is also updated.

### FEAT-032: Full-Width Layout Alignment for Settings Page (`SettingsManager.tsx`)
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: UI/UX / Settings & Layout Architecture
- **Component**: `apps/web` (`components/SettingsManager.tsx`)
- **Summary**: Remove the artificial `max-w-2xl` width constraint from `SettingsManager.tsx` so the Settings screen fills the full available width of `PageContainer`, matching all other application management views (Equipment Profiles, Mash Profiles, Batches, Inventory, Calculators).
- **Details**:
  - **1. Container Width Normalization**:
    - Update `className="flex flex-col gap-6 max-w-2xl"` to `className="flex flex-col gap-6 w-full"` or standard `CARD_STACK_GAP_CLASS` in `SettingsManager.tsx`.
  - **2. Cohesive Viewport Experience**:
    - Settings panels (*Units & Display*, *Formulas & Calculations*, *Data & Recipe Ingestion*) span the full content area rather than leaving an empty right-hand void on desktop screens.

### FEAT-033: Unify Input Field Heights in Mash and Fermentation Profile Step Forms
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: UI/UX / Design System & Form Consistency
- **Components**: `apps/web` (`components/MashProfileForm.tsx`, `components/FermentationProfileForm.tsx`)
- **Summary**: Mash and fermentation profile step rows use compact inputs (`size="sm"`) creating shorter fields compared to Equipment and Water profile forms which use standard `CONTROL_HEIGHT_CLASS` (`h-10` / `size="md"`). Unify step row fields in `MashProfileForm` and `FermentationProfileForm` to use standard default height (`size="md"`).
- **Details**:
  - **1. Mash Profile Step Rows**:
    - Remove `size="sm"` overrides from `<Input>`, `<Select>`, and `<NumberInput>` controls in `MashProfileForm.tsx` step rows.
  - **2. Fermentation Profile Step Rows**:
    - Remove `size="sm"` overrides from `<Input>`, `<Select>`, and `<NumberInput>` controls in `FermentationProfileForm.tsx` step rows.

### FEAT-034: Two-Tier Layout for Brew Day Tracker Timeline Bar
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: UI/UX / Brew Day Assistant & Timeline Architecture
- **Component**: `apps/web` (`components/BrewDayTimelineBar.tsx`)
- **Summary**: Replace the cramped single-bar timeline in `BrewDayTimelineBar.tsx` with a two-tier layout (Option 1). Stage labels (`1. Prep`, `2. Mash`, `3. Boil`, `4. Hop Stand`) render in an upper row of responsive tab buttons, while a sleek continuous proportional progress bar with milestone dots renders directly underneath.
- **Details**:
  - **1. Upper Stage Tabs Row**:
    - 4 clickable stage tabs with clear padding, active state indicators (amber background/border), completed indicators (emerald text), and concise labels.
    - Prevents text cropping on short duration stages (e.g. 5m prep or 10m hopstand).
  - **2. Lower Proportional Progress Track & Milestones**:
    - Continuous horizontal progress bar where each stage segment width matches its `widthFraction`.
    - Milestone pins render cleanly along the progress bar without obstructing stage names.

### FEAT-035: TopBar Layout Responsiveness & Right-Aligned Action Alignment
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: UI/UX / TopBar & Header Responsiveness
- **Component**: `apps/web` (`components/TopBar.tsx`)
- **Summary**: Ensure TopBar action button group is always pinned to the right edge (`ml-auto flex-shrink-0`) and does not wrap into awkward vertical stacking or push into the title.
- **Details**:
  - Pinned actions to right edge with `flex-shrink-0 ml-auto` in `TopBar.tsx`.
  - Preserved responsive wrap behavior while maintaining right alignment across all screen sizes.

### FEAT-036: Vertical Single-Column Layout for Brewing Stage View
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: Batch Tracking / Brewing Stage Layout & Ergonomics
- **Component**: `apps/web` (`pages/BatchDetail.tsx`)
- **Summary**: Replace the 12-column horizontal split grid on the Brewing stage tab with a single vertical column stacking panels in exact logical operator order: (1) Vitals metrics summary, (2) Brew Sheet viewer, (3) Brew Day Assistant tracker, (4) Brew Day Measurements input card, (5) Notes log.
- **Details**:
  - Refactored `apps/web/src/pages/BatchDetail.tsx` Brewing stage tab layout to cleanly stack the five panels vertically.
  - Updated `apps/web/test/BatchDetail.test.tsx` to verify the single-column vertical order.

### FEAT-037: Persistent Batch Addition Check State Across Lifecycle Transitions
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: Batch Tracking / Brew Day State Persistence
- **Components**: `apps/web` (`components/BrewDayTracker.tsx`, `pages/BatchDetail.tsx`)
- **Summary**: Retain checked additions and checklist items when navigating between batch stage tabs or advancing lifecycle status.
- **Details**:
  - Lifted `checkedItemIds` and `userAddedIds` to `BatchDetail.tsx` component state and passed them down via controlled props to `BrewDayTracker`.
  - Maintained backward compatibility in `BrewDayTracker` for isolated test mountings.

### FEAT-038: Decimal Input Handling in Specific Gravity & Numeric Input Fields
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: UI/UX / Forms & Numeric Data Entry
- **Components**: `apps/web` (`pages/BatchDetail.tsx`)
- **Summary**: Prevent premature numeric parsing from eating intermediate typing states (such as `"1."` or `"1.00"`) in Specific Gravity and other decimal input fields.
- **Details**:
  - Added intermediate string buffers for decimal fields (`measuredPreBoilGravity`, `measuredMashPh`, `measuredBoilSizeL`, `measuredBoilTimeMin`, `measuredOg`, `measuredFg`, `carbonationTempC`) in `BatchDetail.tsx`.
  - Kept form data in sync with parsed numeric values without overwriting user keystrokes mid-typing.

### FEAT-039: Persistent Brew Day Tracker Stage & Active Timer Progress Across Tab Switching
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: Batch Tracking / Brew Day Assistant State Retention
- **Components**: `apps/web` (`components/BrewDayTracker.tsx`, `pages/BatchDetail.tsx`, `components/BrewDayTimelineBar.tsx`)
- **Summary**: Retain active brewing sub-stage (e.g. `4. Hop Stand`), active timer countdowns, target timestamps, running state, and fired alarms across Batch tab switches (`Planning` $\leftrightarrow$ `Brewing` $\leftrightarrow$ `Fermentation` $\leftrightarrow$ `Packaging` $\leftrightarrow$ `Completed`) and batch status changes.
- **Details**:
  - Lifted `activeStageIndex`, `selectedMashStepIndex`, `remainingByKey`, `targetEndByKey`, `running`, and `firedBoilAlarms` from `BrewDayTracker` local state up to `BatchDetail` component state.
### FEAT-041: Top-Aligned Metric Tile Labels in Packaging Stats Summary
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: UI/UX / Batch Packaging Visual Alignment
- **Component**: `apps/web` (`pages/BatchDetail.tsx`)
- **Summary**: Align all metric card labels (`Final Gravity`, `ABV`, `Packaging Volume (L)`, `Carbonation/Storage Temp (°C)`) to the top across the packaging stats summary grid by applying `flex flex-col justify-between` to each tile container.
- **Details**:
  - Enhanced tile layouts in `packaging-stats-summary` with flex column space-between distribution so labels line up along the top baseline regardless of input control height or multi-line label text.

### FEAT-042: Priming Sugar Calculation Robustness & Solution Buffer Allowance
- **Date Logged**: 2026-08-28
- **Status**: `CLOSED`
- **Category**: Calculations & Packaging / Priming Solution
- **Components**: `packages/calculations` (`src/carbonation.ts`), `apps/web` (`components/SplitPackagingPanel.tsx`)
- **Summary**: Ensure priming sugar calculation reliably computes sugar requirements even when peak fermentation temperature is unrecorded (falling back to standard 20°C rather than yielding 0g sugar), and add an Extra Buffer (+%) allowance to the priming solution syringe calculator to compensate for dead space, syringe losses, and preparation margins.
- **Details**:
  - In `SplitPackagingPanel.tsx`, added fallback `effectivePeakTemp = peakFermentationTempC !== null && peakFermentationTempC > 0 ? peakFermentationTempC : 20.0`.
  - In `packages/calculations/src/carbonation.ts`, extended `calculatePrimingSolution` with `solutionBufferPct` option. Sugar and water scale proportionally by the buffer factor while keeping the per-bottle syringe injection concentration exact.
  - In `SplitPackagingPanel.tsx`, added an "Extra Buffer (+%)" input control and updated syringe instructions with clear batch preparation guidelines.

### FEAT-043: Proper "Sparge" MiscUse Category for Water Calculator Salt/Acid Additions
- **Date Logged**: 2026-09-01
- **Status**: `CLOSED` (Delivered & Verified in Milestone 37 Phase 2)
- **Category**: Recipe Builder / Water Chemistry & Data Model
- **Components**: `packages/shared-types` (`src/misc.ts`), `apps/api` (`src/routes/schemas.ts`), `apps/web` (`components/WaterCalculatorModal.tsx`, `components/MiscSection.tsx`)
- **Summary**: `WaterCalculatorModal`'s "Save to Recipe" action currently tags sparge salt/acid additions by appending the literal string `" (Sparge)"` to the misc item's name while leaving its `use` field set to `'Mash'`. Replace this with a proper `'Sparge'` value on the `MiscUse` union so sparge additions are categorized, not string-suffixed.
- **Details**:
  - **Schema**: `MiscUse` (`packages/shared-types/src/misc.ts:2`) is a plain string-literal union (`'Mash' | 'Boil' | 'Whirlpool' | 'Primary' | 'Secondary' | 'Bottling'`) backed by a plain `text('use')` column with no DB `CHECK` constraint (`apps/api/src/db/schema.ts:251`) — adding `'Sparge'` is additive, no migration required. The request-validator's `miscUseEnum` array (`apps/api/src/routes/schemas.ts:11`) must gain the new value too.
  - **`WaterCalculatorModal.tsx`**: `handleSave` builds sparge misc items with the name-suffix pattern at lines 452-460 (salts) and 476-486 (acid) — switch both to `use: 'Sparge'` with the plain ingredient name. The load-side effect (lines 180-198) currently detects sparge items via `m.name.includes('(Sparge)')` and strips the suffix (line 182-183) — switch to keying off `m.use === 'Sparge'`.
  - **`MiscSection.tsx:69`**: the generic misc-editor's "use" `<select>` hardcodes the 6-value option list — needs `'Sparge'` added, or a misc with that use has no matching dropdown option.
  - **Tests requiring updates**: `apps/web/test/WaterCalculatorModal.test.tsx` (lines 534, 558, 588, 600, 616 assert names like `'Gypsum (Sparge)'`) and `apps/web/test/WaterSection.test.tsx:227` (asserts `'Calcium Chloride (Sparge)'`) — both pin the current suffix behavior.
  - Touches 4 production files across types/API validation/two UI components plus 2 test files, and introduces a new user-visible category — not eligible for the lightweight-task exception (`CLAUDE.md` rule 7); route through `/plan` as its own phase.

### FEAT-044: Move the balance-strategy → target-ion preset calculation into the Water Profile; the Water Calculator only picks a water profile
- **Date Logged**: 2026-09-01
- **Status**: `CLOSED` (Delivered & Verified in Milestone 37 Phase 2)
- **Progress**: Implemented in M37_P2 Amendment 2 (2026-09-01). The calculator's Balance Strategy selector + `STRATEGY_WEIGHTS` weighting were removed; a pure `applyBalanceStrategy(ions, strategy)` + `BalanceStrategy` + `BALANCE_STRATEGY_RATIO` added to `packages/calculations`; `WaterProfileForm` gained a Balance Strategy `<Select>` + "Apply to Ion Targets" (transient, no schema/DB/API migration). Layer 1 green (2,433 passed / 2 skipped). Awaiting `/steer` critic + regression before `CLOSED`.
- **Category**: Recipe Builder / Water Chemistry — UX Simplification & Information Architecture
- **Components**: `apps/web` (`components/WaterCalculatorModal.tsx` balance-strategy selector, `components/WaterProfileForm.tsx`, water-profile manager view), `packages/calculations` (`waterOptimization.ts` / `water.ts` strategy weights)
- **Summary**: The balance-strategy selector (Balanced / Crisp Hop-Forward / Malty-Full) adds conceptual and visual complexity to the Water Calculator screen. Move the strategy → required-ion determination into the Water Profile, where a profile can compute its own target ions as a preset from a balance strategy, and reduce the Water Calculator to simply letting the user pick a water profile.
- **Details**:
  - **Current state**: the Water Calculator surfaces a `balanceStrategy` selector (`WaterCalculatorModal.tsx:~638`) whose `STRATEGY_WEIGHTS[balanceStrategy]` weights feed `calculateProfileFitScore` and `optimizeWaterProfile` (RA-6, M37_P2). This pushes water-chemistry strategy knobs onto the already-dense calculator surface.
  - **Target**: the balance strategy lives on the Water Profile. Selecting a strategy (e.g. Crisp Hop-Forward → higher SO₄:Cl, Malty-Full → higher Cl:SO₄, Balanced → near 1:1) computes a concrete target-ion preset that the profile stores — so a water profile already encodes the ions it wants rather than the calculator re-deriving them inline.
  - **Simplified calculator**: with the profile carrying the preset, the Water Calculator's mineral-dosing surface reduces to a profile picker (source + target profile) and the salt-adjustment UI; the strategy weights / quality knobs no longer appear as inline complexity.
  - Verbatim user note: *"the balance strategy adds more complexity to this screen. let's add that to the water profile where it can calculate the ions required as presets and let only the user pick here a water profile."*
  - This relocates existing strategy logic and data — crosses a milestone/phase boundary (touches the M37 solver's weights, profile schema/form, and calculator), so it is not a lightweight-task change; route through `/plan` as its own phase.





