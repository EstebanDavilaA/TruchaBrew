# GSD Bug Log

This document tracks implementation defects and regressions recorded via `/log`. New feature requests and UX ideas are logged in `.gsd/FEATURES.md`.

---

## Item Status Lifecycle

- **`OPEN`**: Logged defect awaiting triage/diagnosis.
- **`DIAGNOSING`**: Undergoing root cause analysis via `/diagnose`.
- **`IN_PLANNING`**: Spec amendment drafted in `/plan`.
- **`IN_EXECUTION`**: Fix implementation underway in `/execute`.
- **`DEFERRED_TO_MILESTONE`**: Defect or scope gap scheduled for a future milestone.
- **`VERIFIED_RESOLVED`**: Verified resolved by `/verify`.
- **`CLOSED`**: Verified complete by `/verify` and archived during `/steer`.

---

## Logged Bugs

### [BUG-001] "Brew this recipe" button does not appear on recipe view

- **Date Logged:** 2026-08-06
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item)
- **Component:** `apps/web` (Recipe Designer / Recipe Details)
- **Reported Issue:** The button for brewing a recipe ("Brew this") does not appear when viewing or selecting a recipe.
- **Observed Behavior:** No action button exists on recipes to freeze a recipe into a batch and start a brew day.
- **Expected Behavior:** Clicking "Brew this" on a recipe creates a Batch snapshot and opens the brew day tracking interface.
- **Triage & Diagnosis:**
  - Checked `.gsd/ROADMAP.md`: The "Brew this" action and Batch snapshot entity are the central user-visible outcome of **Milestone 4: Brew this recipe, log the brew day**.
- **Resolution Path:** Implemented in Milestone 4 (`handleBrewThis` in `App.tsx` calling `createBatch` in API). Verified by `App.test.tsx` AC-8 suite (5/5 tests passing).

### [BUG-002] Sidebar Navigation & Contextual Topbar Redesign (Missing direct recipe view button)

- **Date Logged:** 2026-08-09
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item / UX Redesign)
- **Component:** `apps/web` (Layout / Navigation Header / Sidebar / Topbar)
- **Reported Issue:** No direct button to navigate to recipes, and navigation structure uses topbar for primary navigation instead of a sidebar layout with contextual topbar actions.
- **Observed Behavior:** Main navigation links are placed in the top bar without a clear dedicated sidebar.
- **Expected Behavior:** Reorganize navigation into a persistent left sidebar (direct buttons to Recipes library, Batches, Equipment Profiles, Schedules) and repurpose the top bar exclusively for contextual page actions.
- **Resolution Path:** Implemented in Milestone 5.5 (`Sidebar.tsx` with direct buttons to Recipes, Batches, Equipment Profiles, Mash Schedules, Fermentation Schedules, Water Profiles, Settings + contextual `TopBar`). Verified by `App.test.tsx` AC-13/15/17/19 tests.

### [BUG-003] Batch Phase Stepper & Phase-Specific Vitals/Comparison UX Redesign

- **Date Logged:** 2026-08-11
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item / UX Redesign)
- **Component:** `apps/web` (Batch tracking / `BatchDetail.tsx`, `BatchHeader.tsx`, `MeasuredComparison.tsx`)
- **Reported Issue:** Changing batch status uses a `<select>` dropdown menu, and vitals/measured-vs-expected fields are not structured around phase-specific step cards.
- **Observed Behavior:** Batch status transitions rely on a simple dropdown box.
- **Expected Behavior:** Replace status dropdown box with explicit phase-transition buttons (`Advance to Brewing`, `Start Fermentation`, `Move to Conditioning`, `Mark Completed`) and phase-structured comparison cards.
- **Resolution Path:** Implemented in Milestone 5.5 (`BatchStepper.tsx` with explicit transition buttons driven by `allowedNextStatuses`, and `MeasuredComparison.tsx`). Verified by `BatchStepper.test.tsx` (24/24 passed) & `MeasuredComparison.test.tsx` (6/6 passed).

### [BUG-004] Equipment/Mash/Fermentation Profile edit-create uses a modal instead of the full-page editor pattern

- **Date Logged:** 2026-08-11
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item / UX Redesign)
- **Component:** `apps/web` (`components/EquipmentForm.tsx`, `components/MashProfileForm.tsx`, `components/FermentationProfileForm.tsx`)
- **Reported Issue:** Editing or creating an Equipment, Mash, or Fermentation Profile opens as a centered modal dialog rather than a full-page editor.
- **Observed Behavior:** Profile forms rendered inside an overlay dialog with backdrop blur.
- **Expected Behavior:** Profile editing/creation takes over the main page area under the persistent Sidebar, with Save/Cancel as contextual actions in `TopBar`.
- **Resolution Path:** Implemented in Milestone 5.5_P2 (`EquipmentForm.tsx`, `MashProfileForm.tsx`, `FermentationProfileForm.tsx`, `WaterProfileForm.tsx` converted to full-page views using `<TopBar>` and `<PageContainer>`). Verified by `App.test.tsx` M5.5_P2 AC-20..24 tests.

### [BUG-005] Navigation and UI Layout Inconsistencies Across Pages (Header actions, Back buttons, Search placement, and Container centering)

- **Date Logged:** 2026-08-12
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item / UX System Gap)
- **Component:** `apps/web` (`components/Sidebar.tsx`, `components/TopBar.tsx`, `components/PageContainer.tsx`, `components/ListRow.tsx`)
- **Reported Issue:** Navigation controls, header titles, search inputs, and primary actions behave inconsistently across pages.
- **Observed Behavior:** Disparate max-width wrappers and ad-hoc header styling across routes.
- **Expected Behavior:** Standardized `TopBar` slots and `PageContainer` wrapper across all primary views.
- **Resolution Path:** Implemented in Milestone 5.5_P3 (`PageContainer.tsx`, `TopBar.tsx`, `Sidebar.tsx`, `ListRow.tsx` across all manager views). Verified by `App.test.tsx` M5.5_P3 AC-4/5/13/23 tests.

### [BUG-006] Item Row Direct Click & Contextual TopBar Delete Actions (Remove list row Edit/Delete buttons)

- **Date Logged:** 2026-08-12
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item / UX Interaction Redesign)
- **Component:** `apps/web` (`RecipeLibrary.tsx`, `EquipmentManager.tsx`, `MashProfileManager.tsx`, `FermentationProfileManager.tsx`)
- **Reported Issue:** Item rows display explicit Edit and Delete action buttons. User requested direct row click navigation and relocating Delete into the contextual `TopBar`.
- **Observed Behavior:** Inline pencil and trash icons on item rows.
- **Expected Behavior:** Clean list items with direct row click navigation, and `Delete` action in `TopBar`.
- **Resolution Path:** Implemented in Milestone 5.5_P4 (`ListRow.tsx` direct clickable rows; `Delete` button relocated into form `TopBar` for Recipes, Equipment, Mash, Fermentation, and Water profiles). Verified by `App.test.tsx` M5.5_P4 AC-37..39 tests.

### [BUG-007] PageContainer Full Screen Width Layout & Full-Width List View Presentation (Remove narrow container bounds & tile grids)

- **Date Logged:** 2026-08-12
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item / UX Layout Redesign)
- **Component:** `apps/web` (`components/PageContainer.tsx`, `components/ListRow.tsx`)
- **Reported Issue:** Narrow/centered max-width containers leaving unused background space on desktop screens, and tile grid layouts instead of dense list rows.
- **Expected Behavior:** Full-screen space utilization (`PageContainer`) and dense full-width list rows across all entity views.
- **Resolution Path:** Implemented in Milestone 5.5_P4 (`PageContainer.tsx` and `LIST_CONTAINER_CLASS` full-width list row presentation across all entity list views).

### [BUG-008] TopBar Back Button Asymmetry Across Primary Routes & Homescreen Concept Proposal

- **Date Logged:** 2026-08-12
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item / Navigation Architectural Proposal)
- **Component:** `apps/web` (`components/TopBar.tsx`, `EquipmentManager.tsx`, `MashProfileManager.tsx`, `FermentationProfileManager.tsx`)
- **Reported Issue:** Top-level primary routes are asymmetric with back arrows on profile lists but not on recipes or batches.
- **Resolution Path:** User selected Option 1 (Clean Navigation Hierarchy). Applied under lightweight-task exception: back arrows removed from top-level list views, restricted strictly to detail/editor routes. Verified by automated tests and visual inspection.

### [BUG-009] TopBar action-button styles inconsistent (Delete/Cancel/Save)

- **Date Logged:** 2026-08-12
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item / UX Consistency Gap)
- **Component:** `apps/web` (`components/EquipmentForm.tsx`, `components/MashProfileForm.tsx`, `components/FermentationProfileForm.tsx`)
- **Reported Issue:** `Delete` rendered as bordered pill, `Cancel` rendered as plain text, `Save` rendered as solid filled pill.
- **Expected Behavior:** Coherent button group with outlined pill buttons for secondary actions (Delete=rose, Cancel=slate) and solid filled pill for primary action (Save=amber).
- **Resolution Path:** Applied under lightweight-task exception: `Cancel` updated to outlined pill styling (`border border-slate-700 hover:border-slate-600`) matching `Delete` across all profile forms. Verified by `npm test`.

### [BUG-010] List row styling inconsistent — BatchList never adopted the shared ListRow primitive

- **Date Logged:** 2026-08-12
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item / UX Consistency Gap)
- **Component:** `apps/web` (`pages/BatchList.tsx`, `components/ListRow.tsx`)
- **Reported Issue:** `BatchList.tsx` rendered hand-rolled `<ul>/<li>` markup with amber titles instead of the shared `ListRow` primitive.
- **Expected Behavior:** `BatchList` renders through `<ListRow>` and `LIST_CONTAINER_CLASS` matching all other entity lists.
- **Resolution Path:** Applied under lightweight-task exception: `BatchList.tsx` converted to render through `<ListRow>` with `LIST_CONTAINER_CLASS`. Verified by `BatchList.test.tsx` (9/9 passed).

### [BUG-011] Batch Detail should open directly in edit mode, not require a separate "Edit Batch" click

- **Date Logged:** 2026-08-12
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Unbuilt / Roadmap Item / UX Consistency Gap)
- **Component:** `apps/web` (`pages/BatchDetail.tsx`, `test/BatchDetail.test.tsx`)
- **Reported Issue:** Opening a batch landed on a read-only summary, requiring an "Edit Batch" click to reach the form.
- **Expected Behavior:** Land directly in edit mode on batch load.
- **Resolution Path:** Implemented in Milestone 5.5_P5 (`BatchDetail.tsx` initializes `formData` on load; `editMode` toggle removed so batch detail opens directly in edit mode). Verified by `BatchDetail.test.tsx` (61/61 passed).

### [BUG-012] Strike Temperature Thermal Mass Over-Compensation & Enzyme Denaturing Risk

- **Date Logged:** 2026-08-14
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type A (Calculation Formula Defect / Physics Model Error)
- **Component:** `packages/calculations` (`mash.ts`, `strikeTemperatureC`), `EquipmentProfile` model
- **Reported Issue:** Strike temperature calculation over-compensates for vessel thermal mass on pre-heated vessels, electric all-in-one, HERMS, and RIMS recirculating systems, resulting in calculated strike temperatures > 80°C (well above the ~78°C threshold where amylase enzymes denature).
- **Observed Behavior:** When a mash tun heat capacity is configured, `strikeTemperatureC` always adds the vessel thermal equivalent into the required heating energy as if doughing in into a cold tun. For a 67°C mash target, calculated strike temperatures can spike to >80°C or even ~88°C depending on configured tun mass/specific heat.
- **Expected Behavior:** 
  - Provide a toggle `calcStrikeWithThermalMass: boolean` (default `false` for pre-heated / recirculating kettles).
  - When `calcStrikeWithThermalMass == false`: Use standard dough-in formula $T_{\text{strike}} = T_{\text{target}} + \frac{c_g}{R_{\text{actual\_ratio}}} \times (T_{\text{target}} - T_{\text{grain}})$ yielding realistic strike temperatures (~73.2°C – 74.0°C for a 67°C target rest at 3.0 L/kg with 20°C grain).
  - When `calcStrikeWithThermalMass == true`: Account for dry tun weight and specific heat ($c_t = 0.12$ for stainless) via $T_{\text{strike}} = T_{\text{target}} + \frac{(c_g \cdot W_{\text{grain}} + c_t \cdot W_{\text{tun}}) \times (T_{\text{target}} - T_{\text{grain}})}{c_w \cdot V_{\text{strike}}}$.
  - Include an enzyme safety warning/clamp when strike temp exceeds 78.0°C.
- **Resolution Path:** Resolved in Milestone 11 (M11_P1 & M11_P2). Implemented `calcStrikeWithThermalMass` energy balance formula, `strikeTempExceedsEnzymeLimit` check (> 78.0°C), EquipmentForm controls, MashSection and StrikeWaterCalculator safety warnings. Verified by unit and component tests (`mash.test.ts`, `EquipmentForm.test.tsx`, `StrikeWaterCalculator.test.tsx`).

### [BUG-013] Unsaved Changes Prompt Fires on Non-Editor Route Transitions Instead of on Leaving Recipe Editor

- **Date Logged:** 2026-08-14
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type B (Navigation / State Lifecycle Defect / UX Defect)
- **Component:** `apps/web` (`App.tsx`, `useRecipeEditor.ts`)
- **Reported Issue:** When editing a recipe and navigating away to another route (e.g. Equipment, Batches, Settings), the user is not prompted when moving out of the recipe editor; instead, the recipe dirty state lingers in memory, causing a "You have unsaved changes. Leave without saving?" discard prompt to pop up later on unrelated route transitions (specifically whenever navigating back to Recipes/Library from any route).
- **Observed Behavior:** 
  - `goToEquipment`, `goToBatches`, `goToMashProfiles`, etc., do not confirm leaving when `view === 'editor'` and `editor.isDirty === true`.
  - `editor.isDirty` stays `true` in background hook state.
  - `goToLibrary()` unconditionally invokes `confirmLeaveEditorIfDirty()` solely based on `editor.isDirty`, even if the active route is not `editor` (e.g. navigating from Equipment to Recipes).
  - Confirming the dialog does not clear or close the dirty editor session, leading to repeated prompts on subsequent navigations.
- **Expected Behavior:** 
  - The unsaved changes discard confirmation should trigger immediately when navigating **out** of `view === 'editor'` to any other route if `editor.isDirty` is `true`.
  - If the user confirms discarding changes, the dirty editor state should be cleanly reset/closed (`editor.closeEditor()`).
  - Navigating between non-editor views (e.g. from Equipment to Recipes, Batches to Settings) should never prompt about unsaved recipe changes once the recipe editor has been exited.
- **Resolution Path:** Resolved in Milestone 13 Phase 1 (M13_P1 AC-4..AC-6). Implemented `navigateGuarded` funnel in `App.tsx` checking `confirmLeaveEditorIfDirty()` upon departure from `view === 'editor'` and resetting editor state via `editor.closeEditor()`. Non-editor transitions bypass the guard. Verified by `App.test.tsx` (15/15 passed).

### [BUG-014] Hop Usage Timing UI & Modeling Mismatch for Whirlpool / Hopstand and Dry-Hop

- **Date Logged:** 2026-08-14
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Domain Modeling & UI Semantics Mismatch)
- **Component:** `apps/web` (`components/HopSection.tsx`), `packages/shared-types` (`HopItem`, `HopUse`)
- **Reported Issue:** Hop schedule timing fields in `HopSection.tsx` treat all hop additions as a single generic "Time (min)" column counting minutes from boil end. This is only meaningful for Boil additions. For Hopstand / Whirlpool, the addition occurs post-boil (steep duration in minutes once cooled to ~80°C), and for Dry-Hop, timing represents fermentation day offset (days after pitch) and dry hop contact duration in days.
- **Observed Behavior:**
  - The hop table header displays a rigid "Time (min)" label across all addition types.
  - Dry-Hop rows disable the time input or render confusing raw minute integers with no day offset or duration semantics.
  - Whirlpool/Hopstand additions show simple minutes without indicating steep temperature or post-boil context.
- **Expected Behavior:**
  - Contextual timing controls and headers based on `HopUse`:
    - **Boil**: Boil duration in minutes (counting down to flameout, e.g. `60 min`, `15 min`).
    - **Whirlpool / Hopstand**: Stand/steep duration in minutes + hopstand temperature (e.g. `20 min @ 80°C`).
    - **Dry Hop**: Day offset (e.g. `Day 3` after fermentation start) and contact duration in days (e.g. `3 days`).
    - **First Wort / Aroma**: Distinct contextual labels.
- **Resolution Path:** Resolved in Milestone 11 (M11_P1 & M11_P2). Implemented contextual timing columns in `HopSection.tsx` for Boil (`boilMins`), Whirlpool (`whirlpoolMins` @ `whirlpoolTempC`), and Dry Hop (`dryHopDayOffset` + `dryHopDurationDays`), backed by schema/types. Verified by `HopSection.test.tsx` (7/7 passing).

### [BUG-015] Batch Detail UX & Layout Defects: Monolithic Form, Coupled Batch Header, and Buried Save/Cancel Actions

- **Date Logged:** 2026-08-14
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (UX / Layout Architecture Defect)
- **Component:** `apps/web` (`pages/BatchDetail.tsx`, `components/BatchStepper.tsx`, `components/TopBar.tsx`)
- **Reported Issue:** Batch status and batch name are coupled inside the monolithic brewday measurements form; phase navigation is coupled to an advancing button stepper rather than direct clickable stage tabs/sections (Planning, Brewing, Fermentation, Completed); and primary Save/Cancel actions are buried at the bottom of the long scrolling form instead of living in the `TopBar`.
- **Observed Behavior:**
  - Batch Name and `BatchStepper` are rendered inside the main form card directly above all numeric brew day measurements.
  - Users cannot directly click between stage views (e.g. jumping between Fermentation readings and Brewing numbers) without triggering status transition mechanics.
  - Save and Discard buttons are positioned at the very bottom of the long form (below tasting notes), forcing excessive vertical scrolling.
- **Expected Behavior:**
  - **Standalone Batch Header Group**: Isolate Batch Name, current Status badge, and recipe metadata into a clean standalone top container.
  - **Stage Tab Navigation (Brewfather-style)**: Horizontal section tabs (`Planning`, `Brewing`, `Fermentation`, `Completed` / `Conditioning`) that switch between viewable stage data on click without forcing a status transition.
  - **TopBar Status Transitions (Advance / Revert)**: Batch lifecycle status transitions (e.g. "Advance to Brewing", "Start Fermentation", or reverting to a previous state) placed as contextual actions in the TopBar / header banner, cleanly separated from content tab switching.
  - **TopBar Action Alignment**: Relocate `Save Changes`, `Discard / Cancel`, and `Delete` into the contextual `TopBar` (matching the pattern established across all other entity forms like `EquipmentForm`, `MashProfileForm`, and `SettingsManager`).
- **Resolution Path:** Resolved in Milestone 13 Phase 1 (M13_P1 AC-7..AC-15). Re-architected `BatchDetail.tsx` with standalone header group, horizontal `BatchStageTabs.tsx` (`Planning`, `Brewing`, `Fermentation`, `Completed`), and contextual `TopBar` actions (Save, Discard, Delete, Status Transitions, Rebrew). Verified by `BatchDetail.test.tsx` (26/26 passed) and `BatchStageTabs.test.tsx` (8/8 passed).

### [BUG-016] `srmToEbc`/`srmToLovibond` have no recipe-path caller — call-site inconsistency, not a second source of truth

- **Date Logged:** 2026-08-14
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Call-Site Inconsistency / Pre-Existing Gap, predates M8_P1)
- **Component:** `packages/calculations` (`brewingMath.ts`, `units.ts`, `constants.ts`)
- **Reported Issue:** `packages/calculations/src/brewingMath.ts:289` computes `const ebc = srm * SRM_TO_EBC` inline instead of calling `srmToEbc`. `packages/calculations/src/units.ts:33`'s `srmToLovibond` likewise has no recipe-path caller, because `brewingMath.ts` performs no Lovibond computation at all (its only colour outputs are `srm` and the inline `ebc`).
- **Observed Behavior:** `srmToEbc`'s sole call site repo-wide (outside `units.test.ts`'s round-trip test) is `apps/web/src/components/calculators/UnitConverterCalculator.tsx:51`. `srmToLovibond`'s sole call site is `UnitConverterCalculator.tsx:52`. Neither is reached from `brewingMath.ts` or any other recipe/batch-path module.
- **Severity note (required, do not over-triage):** both `srmToEbc` (`units.ts:26`) and `brewingMath.ts:289`'s inline `srm * SRM_TO_EBC` multiply by the **same** `SRM_TO_EBC = 1.97` constant imported from `constants.ts:12`; `srmToLovibond` likewise draws its `LOVIBOND_SLOPE`/`LOVIBOND_OFFSET` coefficients from that same `constants.ts`. There is exactly **one** encoding of each physical fact in the repository. This is a **call-site inconsistency, not a second source of truth** — the drift risk a duplicated-formula defect exists to catch (two independently editable copies of a number diverging) is absent here.
- **Expected Behavior:** `brewingMath.ts:289` should call `srmToEbc(srm)` instead of inlining the multiplication, and a Lovibond output should be added to `brewingMath.ts` if the engine is meant to expose one.
- **Resolution Path:** Resolved in Milestone 11 Phase 1 (M11_P1 AC-11): `brewingMath.ts:289` updated to delegate EBC calculation to `srmToEbc(srm)` from `units.ts`. Verified by unit tests and AST containment check in `calculatorImportGraph.test.ts`.

### [BUG-017] Application Shell Scrolling Leak: Window/Body Scroll Scrolls Away Persistent TopBar and Sidebar

- **Date Logged:** 2026-08-15
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (UX / Layout Architecture Defect)
- **Component:** `apps/web` (`App.tsx`, `components/PageContainer.tsx`, `components/Sidebar.tsx`, `components/TopBar.tsx`)
- **Reported Issue:** The outer window/body handles page scrolling, causing the TopBar and navigation layout to scroll out of view when viewing long forms (Recipe Designer, Batch Detail, Equipment Manager, Calculators), rather than locking the viewport and confining scrolling strictly to the `PageContainer`.
- **Observed Behavior:**
  - `App.tsx` layout root uses `min-h-screen`, delegating vertical overflow to the browser window.
  - Scrolling long recipe forms or batch sheets scrolls the contextual `TopBar` and sidebar container away, requiring users to scroll all the way back to access navigation and top-bar actions.
- **Expected Behavior:**
  - **Fixed Viewport App Shell**: Root application container configured as `h-screen overflow-hidden flex`.
  - **Always Visible Sidebar**: `Sidebar` pinned to 100% viewport height (`h-full flex-shrink-0`), with independent internal scroll if items overflow.
  - **Always Visible TopBar**: `TopBar` pinned at the top of the main content column (`flex-shrink-0`), remaining visible at all times regardless of scroll position.
  - **Isolated PageContainer Scrolling**: Vertical scrolling is isolated strictly to the main content container / `PageContainer` (`flex-1 overflow-y-auto min-w-0`), ensuring seamless navigation and instant access to actions across all views.
- **Resolution Path:** Resolved in Milestone 13 Phase 1 (M13_P1 AC-1..AC-3). Configured `App.tsx` root layout as `h-screen overflow-hidden flex bg-slate-950 text-slate-100 font-sans`, pinned `Sidebar.tsx` (`h-full flex-shrink-0`) and `TopBar.tsx` (`flex-shrink-0 sticky top-0`), and isolated scroll exclusively to `PageContainer.tsx` (`flex-1 overflow-y-auto min-w-0 pb-16`). Verified by `App.test.tsx` (15/15 passed).

### [BUG-018] Residual Alkalinity Calculation Over-Estimates Calcium/Magnesium Effect (50x Unit Discrepancy)

- **Date Logged:** 2026-08-17
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type A (Calculation Formula Defect / Unit Mismatch)
- **Component:** `packages/calculations` (`water.ts`, `calculateResidualAlkalinity`)
- **Reported Issue:** The Residual Alkalinity (RA) formula in `water.ts` incorrectly used raw ppm values in place of mEq/L equivalents, leading to massive negative RA results.
- **Resolution Path:** Corrected in M11_P3 by switching to stoichiometric equivalents (`70.14` and `85.05`).

### [BUG-019] Acid "+ Add to Recipe" Produces No Visible Feedback: Predicted Mash pH Badge and Dosage Cards Ignore Acid WaterAgent Items

- **Date Logged:** 2026-08-17
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (UI Feedback Loop Gap / Dead Calculation Code)
- **Component:** `apps/web` (`components/WaterSection.tsx`); consumes `packages/calculations/src/water.ts::calculatePostAcidMashPh`
- **Reported Issue:** Clicking "+ Add to Recipe" on any acid dosage card (Lactic Acid 88%, Phosphoric Acid 75%, Acidulated Malt) appears to do nothing.
- **Observed Behavior (`/diagnose`, live Playwright session):**
  - The add action itself is **correct**: `onMiscsUpdate` fires, a well-formed acid `WaterAgent` `MiscItem` with the right computed amount is appended, and the recipe is marked dirty. No defect in `handleAddAcid`.
  - `WaterSection.tsx` derives `finishedIons -> ra -> predictedPh` solely via `calculateFinishedIons`, which recognises only names in `SALT_CONTRIBUTIONS` (Gypsum, Calcium Chloride, Epsom Salt, Table Salt, Baking Soda). Acid agents are invisible to that chain, so the `predicted-mash-ph-badge`, the required-reduction line, and the dosage cards never move after an acid is added.
  - `calculatePostAcidMashPh(predictedMashPh, totalMaltKg, mashWaterL, additions)` was written in M11_P1 for precisely this purpose and is **dead code** — never imported or called by any component.
  - Secondary gap: no inline confirmation near the button (no toast, no "Added" state), so with a frozen badge the whole interaction reads as a no-op.
- **Expected Behavior:**
  - The badge reflects the pH effect of acid `WaterAgent` items already present in `miscs`, converging toward `targetMashPh` and flipping the panel to "No acid addition needed" once satisfied.
  - Dosage cards show the **residual** requirement while the add buttons continue to write the **full** pre-acid dose (replace-not-append semantics must stay idempotent).
  - A testable inline confirmation appears next to the action buttons.
- **Resolution Path:** Resolved in `M11_P3_feature_spec.md` **Amendment 1 (Section 7)**, AC-18 through AC-25. Implemented `appliedAcids` derivation, `effectivePh` calculation via `calculatePostAcidMashPh`, `preAcidResult` write basis vs `residualAcidResult` read basis, panel-gate flip, and 2500ms inline confirmation banner in `WaterSection.tsx`. Verified by `WaterSection.test.tsx` (20/20 passed) and full Layer 1/2/3 verification suite.

### [BUG-020] WaterProfileForm UI & Layout Mismatch: Centered Narrow Wrapper (max-w-4xl mx-auto) and Inconsistent Card/Input Tokens

- **Date Logged:** 2026-08-18
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (UX / Layout Inconsistency Defect)
- **Component:** `apps/web` (`components/WaterProfileForm.tsx`)
- **Reported Issue:** Water profile forms do not match other profile and entity forms in the app (`EquipmentForm.tsx`, `MashProfileForm.tsx`, `FermentationProfileForm.tsx`, `SettingsManager.tsx`). The form is artificially centered and clamped to `max-w-4xl mx-auto`, preventing it from using the available screen width inside `PageContainer`, and relies on ad-hoc card (`p-6` without `shadow-lg`) and input styling (`bg-slate-950 border-slate-800 rounded-lg`) instead of the shared design system tokens and conventions.
- **Observed Behavior:**
  - `WaterProfileForm.tsx:172` wraps the form in `<form id={FORM_ID} onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">`.
  - On wide displays, large empty gutter areas appear on both sides of the form, unlike `EquipmentForm` or `MashProfileForm` which expand across the full `PageContainer`.
  - Cards do not consume `CARD_CLASS` from `designSystem.ts`.
  - Form inputs use darker, higher-contrast styling (`bg-slate-950 border border-slate-800`) rather than standard form input styling (`bg-slate-800 border border-slate-700`).
- **Expected Behavior:**
  - Remove `max-w-4xl mx-auto` from the `<form>` element so `WaterProfileForm` uses full `PageContainer` width with `className="space-y-6"`, matching all other profile editors.
  - Apply `CARD_CLASS` from `./designSystem` to form card panels.
  - Align input styling with standard form control styling across the app.
- **Resolution Path:** Resolved under Lightweight-Task Exception (`.gsd/HARD_RULES.md` Rule 8). In `WaterProfileForm.tsx`, removed `max-w-4xl mx-auto` to allow full width inside `PageContainer`, wrapped sections in `CARD_CLASS`, and unified input styling to `bg-slate-800 border-slate-700`. Verified by `npm test` and `npm run typecheck` (4/4 workspaces clean).

### [BUG-021] Spanish Localization Strings in Brew Day Tracker (`BrewDayTracker.tsx`)

- **Date Logged:** 2026-08-19
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (Localization / UI Text Inconsistency Defect)
- **Component:** `apps/web` (`components/BrewDayTracker.tsx`)
- **Reported Issue:** Brew Day Tracker contains Spanish localization strings ("Seguimiento de la elaboración", "1. Preparación", "2. Macerado", "3. Hervir", "5. Fermentador", "Calentar ... L de agua a ...", "Contracción térmica del mosto caliente", "Volumen caliente", "Pasos de macerado", "Cronograma de adiciones", "Eficiencia de macerado (en vivo)"). The rest of the application is standard English.
- **Observed Behavior:**
  - `BrewDayTracker.tsx` hardcoded Spanish stage labels (`Preparación`, `Macerado`, `Hervir`, `Fermentador`), guidance texts, tool headers, and addition alarm descriptions.
- **Expected Behavior:**
  - All UI copy across `BrewDayTracker.tsx` and the rest of the application must be standard English.
  - Stage timeline: `1. Preparation`, `2. Mash`, `3. Boil`, `4. Hop Stand`, `5. Fermenter`.
  - Header: `Brew Day Assistant`.
  - Guidance text: `Heat {water} L of water to {strikeTemp}°C`, `Mash: {time} min @ {temp}°C`, `Boil for {boilTime} min`, `Cool to 80°C and start {hopstand} min Hop Stand`, `Confirm chilled wort volume and yeast pitch, then start fermentation.`.
  - Precision tools: `Refractometer (°Bx → SG)` and `Hot Wort Thermal Contraction`.
  - Step details: `Mash Steps`, `Additions Schedule`, `Mash Efficiency (live):`.
- **Resolution Path:** Resolved under Lightweight-Task Exception (`.gsd/HARD_RULES.md` Rule 8). Translated all hardcoded Spanish strings in `BrewDayTracker.tsx` to clean, idiomatic English and updated matching assertions in `BrewDayTracker.test.tsx`. Verified by `npm test` and `npm run typecheck` (4/4 workspaces clean).

### [BUG-022] Boil-stage hop/fining additions use a "Mark Added" button instead of the radio-style check control used by every other checklist step

- **Date Logged:** 2026-08-19
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (UX Consistency Gap)
- **Component:** `apps/web` (`components/BrewDayTracker.tsx`, `components/BrewDayTimelineBar.tsx` context — M18_P1 boil-stage Additions Schedule list)
- **Reported Issue:** The Boil stage's "Additions Schedule" list marks a hop/fining addition done via a distinct pill-style "Mark Added" button, while every other checklist across the Brew Day Assistant (Mash Steps, and the newly-added Preparation/Hop Stand checklists from M18_P1) uses a circular radio-style check control for the same "mark done" action.
- **Observed Behavior:** Screenshots confirm the Mash checklist item renders a plain circular radio toggle next to its label (e.g. "Mash: 67.0°C for 60 min"), while the Boil stage's addition rows render an amber "Mark Added" pill button on the right edge of each row instead, alongside a separate "ADD NOW" badge.
- **Expected Behavior:** The Boil stage's addition rows should use the same radio-style check control as the other checklist steps, so marking a hop/fining addition as added is visually and interactively consistent across all four brew day stages.
- **Triage & Diagnosis:**
  - This is UI-only interaction-pattern drift, not a calculation or state defect — the underlying "mark added" logic (whichever handler currently backs `Mark Added`) is presumed correct and is not in question, only its control's visual treatment.
  - Component is `BrewDayTracker.tsx`'s boil-stage additions list, most recently touched under M18_P1's checklist/timeline work (this session) and under an earlier out-of-band lightweight task that added the pulsing "ADD NOW" alert.
- **Resolution Path:** Formally absorbed under M18_P1 spec refinement (Option A, Addendum 2, AC-33). Refactored the Boil stage Additions Schedule in `BrewDayTracker.tsx` to render each addition as a full-width clickable button carrying the circular radio check toggle (`CheckCircle2` when added, circular border when unadded, pulsing amber border when due) and line-through strikeout styling on the label when checked, completely eliminating the disparate "Mark Added" / "Added ✓" pill button while preserving the pulsing "ADD NOW" alert badge. Updated `BrewDayTracker.test.tsx`'s AC-33 suite to assert interactive checking and unchecking of boil additions. All four Layer 1 gates verified clean (1,704 tests pass, typecheck clean, build clean, oxlint clean).

### [BUG-023] Brew Day Measurements: redundant "Use Expected Target" button should be removed — the placeholder-only, non-destructive hint is already the wanted behavior

- **Date Logged:** 2026-08-19
- **Status:** `VERIFIED_RESOLVED`
- **Category:** Type C (UX Simplification — Redundant Control Removal)
- **Component:** `apps/web` (`pages/BatchDetail.tsx` Brewing tab measurement inputs, M18_P1's FEAT-020 placeholder + "Use Expected Target" accept controls)
- **Reported Issue:** User wants the "Use Expected Target" button removed from each of the five Brew Day Measurements fields (Pre-boil Gravity, Mash pH, Boil Size, Boil Time, Measured OG). **Clarified by the user after initial triage**: the ask is narrower than first read — keep the expected value showing as placeholder/type-hint text exactly as it does today (and keep it strictly non-destructive: it must never silently become the recorded measured value), just remove the now-redundant explicit accept button. The placeholder text alone already conveys the target; the extra click-to-accept control adds nothing.
- **Observed Behavior:** All five fields already display the expected numeric values (e.g. `1.047`, `5.46`, `33.5`, `60`, `1.048`) styled as placeholder/dimmed text, each with an adjacent green "Use Expected Target" pill button that commits that value into the field as a real, saved measurement when clicked.
- **Expected Behavior:** Remove the "Use Expected Target" button from all five fields. The placeholder-only display (M18_P1's Deviation 4 / D-4 non-destructive behavior) is otherwise correct and stays exactly as built — measured fields must still only be written by the brewer's own typed input, never auto-filled, so Milestone 17's `PostBrewCalibrationModal`/`measuredMashEfficiencyPct` calibration feed continues to only ever see genuinely measured values.
- **Triage & Diagnosis:**
  - D-4's core non-destructive guarantee is **not** being reopened — the user explicitly does not want the placeholder to auto-write as a real measurement. This narrows the fix to: delete the accept-button UI element and its handler wiring only.
  - `M18_P1_feature_spec.md` is still active (not yet through `/steer`) and its FEAT-020 §2 / AC set explicitly mandates the "Use Expected Target" 1-click accept control as a build requirement, with acceptance criteria and executor tests written against its presence and click behavior. Removing it makes those specific ACs and their tests false, so this needs a narrow spec amendment (same pattern as prior in-flight AC corrections in this project) before any code changes, not a silent edit against a still-active, unverified spec.
  - Recommend `/diagnose` next: confirm which AC(s)/test(s) in `M18_P1_feature_spec.md` and `BatchDetail.test.tsx` reference the accept button, then a narrow `/plan` amendment removing that requirement, followed by a scoped executor follow-up (button + handler + associated tests only) — the same shape as M2_P1's brewingMath.test.ts exception and M3_P1's AC-46 amendment.
- **Resolution Path:** Applied directly per explicit user instruction ("delete silently"), bypassing the `/diagnose` → re-`/plan` ceremony since the change is a pure UI-control removal with zero data-flow/calibration-safety impact. Removed the "Use Expected Target" button + its `onClick` handler from all five fields in `BatchDetail.tsx`; D-4's non-destructive guarantee is untouched. `BatchDetail.test.tsx`'s AC-37/AC-38/AC-39 block replaced — AC-37/AC-39 struck as superseded, AC-38 retained and rescoped to assert no-write-ever (not just no-write-without-a-click), plus a new assertion confirming no accept control renders. `M18_P1_feature_spec.md` amended in place with a dated addendum (AC-37/AC-39 superseded, AC-38 rescoped, AC-46 screenshot description updated; 44/46 ACs active) so the still-active spec stays consistent with the shipped code. All four Layer 1 gates re-verified green: 690 web tests (net -1, matching test replacement), typecheck/build/lint exit 0.

### [BUG-024] `suggestSaltAdditions` greedy fixed-order dosing overshoots ions later in the priority chain

- **Date Logged:** 2026-08-20
- **Status:** `DEFERRED_TO_MILESTONE`
- **Category:** Type B (Engine / Calculation Accuracy)
- **Component:** `packages/calculations` (`src/water.ts` — `suggestSaltAdditions`), surfaced through `apps/web` (`WaterCalculatorModal.tsx`'s AUTO button)
- **Reported Issue:** Clicking AUTO in the Water Chemistry modal produces a salt dose whose finished ion profile does not land on the selected target profile — several ions overshoot the target by a brewing-significant margin.
- **Observed Behavior:** `suggestSaltAdditions` walks a fixed greedy priority (Calcium Chloride for Cl, then Gypsum for SO4, then Epsom Salt for Mg, then Baking Soda for HCO3, then Table Salt for Na), closing each ion's remaining delta exactly and subtracting that salt's full contribution set from the running deltas. Because each salt carries ions that appear *later* in the chain as well as the one it is chosen for, a salt dosed for its primary ion can push a later ion past its target with no mechanism to walk it back — the algorithm can only add, never reduce, and never revisits an ion once passed.
  Reproduced numerically at spec time for M23_P2 (`suggestSaltAdditions(null-or-0ppm source, target, 23)`, target Ca 100 / Mg 10 / Na 10 / Cl 60 / SO4 150 / HCO3 40 ppm) — doses `Calcium Chloride 10.87 g`, `Gypsum 23.41 g`, `Epsom Salt 8.85 g`, `Baking Soda 4.82 g`, `Table Salt 0 g`, giving finished ions Ca 96.6 / Mg 10.0 / Na 16.8 / Cl 60.0 / SO4 189.6 / HCO3 40.0. Deltas vs target: **SO4 +39.6 ppm, Na +6.8 ppm, Ca -3.4 ppm, and Mg/Cl/HCO3 exact.**
  **Correction to the informal report:** the finding was first described as "Calcium/Sodium/Sulfate overshoot target by 30-40 ppm". The mechanism is confirmed, but the distribution is not — only **sulfate** overshoots by that magnitude (driven by Epsom Salt's 103 ppm/g/L sulfate load being added after Gypsum has already closed the sulfate delta); sodium overshoots by a much smaller ~7 ppm (Baking Soda's sodium arriving after Table Salt would have been the intended sodium source, which is then correctly dosed to 0 g); and **calcium in fact undershoots** by ~3 ppm rather than overshooting. Any fix must be validated against these measured numbers, not the original description.
- **Expected Behavior:** An AUTO dose should land finished ions within a small tolerance of the target profile across all six ions, or else disclose in the UI which ions it could not satisfy. A 40 ppm sulfate excess is enough to move a beer's perceived bitterness/dryness balance meaningfully — the SO4:Cl ratio badge in the same modal reads 3.16 instead of the intended 2.50 for this case.
- **Triage & Diagnosis:**
  - Root cause is the algorithm's shape, not an arithmetic error: fixed ordering + exact-close-per-ion + additive-only + no revisit. The per-salt arithmetic and the `SALT_CONTRIBUTIONS` constants are correct.
  - Candidate fixes span a wide effort range — reordering the greedy chain (cheap, partial), iterating the chain to convergence, an explicit least-squares / constrained-solve over the five salts (correct, largest change), or a UI-level "residual vs target" disclosure that keeps the current dosing but stops presenting it as exact. Choosing among these is a design decision, not a bug-fix detail.
  - `suggestSaltAdditions` is pinned by existing assertions in `packages/calculations/test/water.test.ts`; any change here updates that suite with it.
- **Resolution Path:** **Explicitly deferred.** Logged during `/plan` for M23_P2 (Simplify the Water Calculator modal) at the user's direct instruction, so the finding is not lost. M23_P2 is a content/UX simplification of `WaterCalculatorModal.tsx` only and its hard constraints forbid touching `packages/calculations/src/water.ts` at all — see `M23_P2_feature_spec.md` RA-25. Needs its own `/diagnose` pass to pick a fix strategy, then a scoped phase in a future milestone.

### [BUG-025] `apps/web/test/setup.ts`'s M27_P1 `Request`/`AbortSignal` shim strips `signal` unconditionally

- **Date Logged:** 2026-08-21
- **Status:** `DEFERRED_TO_MILESTONE`
- **Category:** Type C (Test-Harness Hazard, not a production defect)
- **Component:** `apps/web/test/setup.ts` (M27_P1's `TestEnvRequest` shim, added per `M27_P1_feature_spec.md` RA-20)
- **Reported Issue:** The shim added to make `createBrowserRouter`'s internal navigation work under Vitest's jsdom environment (jsdom's `AbortController` fails Node/undici's native `Request` brand check on `.signal`) strips the `signal` property from **every** `Request` constructed in the test environment, unconditionally — it does not check whether the signal is actually the incompatible jsdom kind before dropping it.
- **Observed Behavior:** All test-environment `Request` construction currently succeeds, because no route in the app's route table (`apps/web/src/routes/paths.ts`) declares a `loader` or `action`, and `apps/web/src` contains zero occurrences of `AbortSignal`, `AbortController`, `.signal`, or `new Request(` outside the router's own internals. The shim is provably inert today — confirmed by the independent critic audit of M27_P1 (`.gsd/archive/CRITIC_REPORT.md`, M27_P1 entries, finding F1).
- **Expected Behavior:** A future milestone that adds React Router `loader`/`action` functions, request cancellation, or fetch timeouts would find any abort-dependent test passing (because `signal` is silently absent) while the equivalent production behavior goes unexercised — a false-green test masking a real gap. The shim should narrow to strip only signals that actually fail the `instanceof AbortSignal` check, not all signals unconditionally.
- **Triage & Diagnosis:** Root cause is a narrow, deliberately-scoped test-environment compatibility shim (mandated by M27_P1's RA-2 data-router requirement) that was written broader than strictly necessary. Fixing it is a small, self-contained change to one file with no product-facing impact — but it's being logged rather than fixed opportunistically, since M27_P1's Amendment 1 (RA-20) explicitly scoped this pass to documentation only and deferred narrowing the shim.
- **Resolution Path:** **Deferred.** No current milestone touches route `loader`/`action`s or request cancellation, so there is nothing today for the broad shim to mask. Revisit and narrow the shim (or replace it with a signal-type-checked version) whenever a future milestone introduces the first `loader`/`action`/abort-dependent behavior — at that point this becomes load-bearing rather than latent.

### [BUG-026] Settings Screen Narrow Panel Constraint (`max-w-2xl`) & Layout Inconsistency Across Viewports

- **Date Logged:** 2026-08-22
- **Status:** `OPEN`
- **Category:** Type C (UX / Layout Architecture Inconsistency)
- **Component:** `apps/web` (`components/SettingsManager.tsx`)
- **Reported Issue:** Settings page layout is constrained to 3 narrow stacked panels (`max-w-2xl`) that fail to utilize the available screen width inside `PageContainer`, appearing disjointed and visually inconsistent with other primary screens (Batches, Profiles, Recipe Designer, Calculators) which utilize full viewport space.
- **Observed Behavior:**
  - `SettingsManager.tsx:285` wraps all 3 setting cards (`Units & Display`, `Formulas & Calculations`, `Data & Recipe Ingestion`) inside `<div className="flex flex-col gap-6 max-w-2xl">`.
  - On widescreen/desktop displays (>= 1024px), the 3 cards occupy only a narrow vertical column on the left (672px max-width), leaving vast empty blank space across the rest of the window.
- **Expected Behavior:**
  - Settings page layout should harmonize with the rest of the application's full-width workbench / responsive grid design language.
  - Remove artificial `max-w-2xl` clamp or adapt into a multi-column responsive grid (e.g. 2-column or full-width structured cards matching profile managers and batch views) inside `PageContainer`.
- **Triage & Diagnosis:**
  - Root cause is an explicit hardcoded `max-w-2xl` wrapper class at `SettingsManager.tsx:285`.
  - Can be resolved either under a future layout polish milestone, lightweight-task exception, or future settings reorganization (`MAJ-05` in `UI_UX_SPECIFICATION.md`).
- **Resolution Path:** Logged via `/log` for triage and scheduling.

### [BUG-027] WaterProfileForm Field Overlapping on Viewport Resize & Wasted Screen Space

- **Date Logged:** 2026-08-22
- **Status:** `OPEN`
- **Category:** Type C (UX / Responsive Layout Defect & Information Architecture)
- **Component:** `apps/web` (`components/WaterProfileForm.tsx`)
- **Reported Issue:** Water profile editor input fields (`Calcium`, `Magnesium`, `Sodium`, `Chloride`, `Sulfate`, `Bicarbonate`) overlap each other and overflow outside the card container on mid-size / tablet viewports (~778px). Furthermore, on widescreen/desktop displays, the 2 stacked cards leave large amounts of wasted empty screen space without a structured responsive layout.
- **Observed Behavior:**
  - `WaterProfileForm.tsx:236` defines `<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">` without `min-w-0` or responsive breakpoint wrapping. Long chemical formula labels (e.g. `Magnesium (Mg²⁺) ppm *`, `Bicarbonate (HCO₃⁻) ppm *`) cause the inputs to overflow column boundaries, overlapping adjacent cells and protruding past the right border of the card on screens < 900px.
  - On widescreen/maximized desktop displays, the 2 stacked cards (`Profile Information` and `Ion Concentrations`) span across the entire window with sparse, lonely input fields and vast empty blank space.
- **Expected Behavior:**
  - Water profile form fields must never overlap or overflow the card container across any viewport width (320px to 4K), using appropriate `min-w-0`, responsive grid constraints, and structured label wrapping.
  - Form layout should be organized into balanced, ergonomic cards (e.g. 2-column responsive layout or Cation vs Anion groupings with sulfate:chloride ratio balance indicators) that make meaningful use of widescreen space.
- **Triage & Diagnosis:**
  - Root cause is an unconstrained 3-column grid (`sm:grid-cols-3`) with fixed label lengths and lack of `min-w-0` on grid items, combined with an un-sectioned 2-block flat card layout.
- **Resolution Path:** Logged via `/log` for triage and scheduling.

### [BUG-028] FermentationProfileForm Step Grid Overlap on Intermediate Viewports & Unbalanced Row Layout

- **Date Logged:** 2026-08-22
- **Status:** `OPEN`
- **Category:** Type C (UX / Responsive Layout Defect & Visual Alignment)
- **Component:** `apps/web` (`components/FermentationProfileForm.tsx`)
- **Reported Issue:** In the Fermentation Profile editor, step rows use an unbalanced 5-column grid (`sm:grid-cols-5`) that severely cramps on intermediate/tablet viewports (~762px), causing the Step Type select element to overlap the Temperature and Duration inputs, and causing the Duration input to breach and overflow past the right edge of the card. Additionally, the second row only occupies 2 of 5 columns (Ramp and Pressure), leaving cols 3, 4, 5 completely blank and scattered on widescreen views.
- **Observed Behavior:**
  - `FermentationProfileForm.tsx:308` defines `<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">`.
  - Row 1 allocates 2 cols for Name, 1 col for Type, 1 col for Temp, and 1 col for Duration. On screens between 640px and 850px, each column has only ~100px width. The `<select>` element for Type has intrinsic content width for values like `Conditioning` or `ColdCrash`, which pushes adjacent columns to the right, causing visual overlap and card blowout.
  - Row 2 allocates Ramp in col 1 and Pressure in col 2, leaving the remaining 3 columns completely empty.
- **Expected Behavior:**
  - Step row layout should be responsive and balanced without any element overlapping or container blowout at any viewport width.
  - Rebalance into a clean, symmetric 3-column or 4-column responsive grid (e.g. 6 fields paired into two balanced 3-column rows or responsive breakpoints).
  - Ensure all grid children have `min-w-0` and `<select>` / `<input>` elements respect column boundaries.
- **Triage & Diagnosis:**
  - Root cause is the asymmetric 5-column grid definition `sm:grid-cols-5` with 6 total fields in `FermentationProfileForm.tsx:308`.
- **Resolution Path:** Logged via `/log` for triage and scheduling.

### [BUG-029] MashProfileForm Desktop Irregular Gaps, Step Grid Alignment & Sizing Affordance

- **Date Logged:** 2026-08-22
- **Status:** `OPEN`
- **Category:** Type C (UX / Desktop Grid System & Sizing Affordance)
- **Component:** `apps/web` (`components/MashProfileForm.tsx`)
- **Reported Issue:** Mash Profile editor exhibits large, irregular empty gaps on desktop screens (e.g. between Name and Type in row 1, and between Profile Name and Target pH in the top header section). Step fields look scattered and numeric fields stretch awkwardly without sizing affordance matching numeric input lengths.
- **Observed Behavior:**
  - `MashProfileForm.tsx:355` defines a 4-column grid (`sm:grid-cols-4`) where Row 1 has Name (`sm:col-span-2`), Type (1 col), and Temp (1 col), leaving a wide empty gap between Name and Type on widescreen monitors.
  - In the top section, Profile Name and Target pH are in separate unaligned containers with Sparge Temperature Override isolated below, causing large irregular white space.
- **Expected Behavior:**
  - Adopt a strict, balanced multi-column grid architecture across all viewports:
    - **Desktop (>= 1024px)**:
      - Top section: Profile Name (span 2), Target pH (span 1), and Sparge Temp Override (span 1) in a balanced single row or paired override group.
      - Step cards: Row 1 = Name (span 2 / ~50%), Type (span 1 / 25%), Temp (span 1 / 25%); Row 2 = Rest (min), Ramp (min), Infuse Amount (L), Infuse Water Temp (°C) in an even 4-column layout (`grid-cols-4`).
    - **Tablet (640px - 1024px)**: 2-column grid (Name/Type on top; numeric metrics in 2x2 grid below).
    - **Mobile (< 640px)**: 1-column stacked with paired compact numeric fields.
  - Input field sizing affordance: Name text inputs expand up to ~300-400px / span 2, while numeric inputs (pH, Temp, Minutes, Liters) maintain proportional widths (~100-140px) matching data length.
- **Triage & Diagnosis:**
  - Layout lacks explicit responsive breakpoint tiers (mobile vs tablet vs desktop) and balanced column-span allocations for top-level metadata and step card internals.
- **Resolution Path:** Logged via `/log` for triage and scheduling.

### [BUG-030] Batch Detail Workbench Responsive Grid, Brew Day Assistant Stepper, and Mobile Telemetry Alignment Refactor

- **Date Logged:** 2026-08-24
- **Status:** `OPEN`
- **Category:** Type C (Batches & Brew Day / UI/UX & Layout Architecture)
- **Component:** `apps/web` (`components/BatchDetail.tsx`, `components/BrewDayTracker.tsx`, `components/BrewSheet.tsx`, `components/TopBar.tsx`)
- **Reported Issue:** The Batch Detail view exhibits severe empty space gaps on desktop, the Brew Day Assistant step ribbon collapses into illegible truncated text (`epar Ma...`) on mobile and tablet, and ingredient tables overflow viewport boundaries when expanding the Brew Sheet.
- **Observed Behavior:**
  - On desktop (>=1200px), the 2-column layout creates large dead-space gaps between the left operational card and right telemetry metrics, with isolated full-width cards (`Brew Sheet`, `Notes`) breaking visual continuity.
  - In `BrewDayTracker.tsx`, the horizontal step indicator ribbon (`Preparation`, `Mash`, `Boil`, `Hop Stand`) lacks responsive collapsing, causing labels to severely collide and overlap on mobile/tablet screens.
  - On mobile (<640px), the `Brew Sheet` sub-tables (Hops, Malts) exceed container widths, causing text wrapping inside numeric columns (e.g., timing/temperature data breaking into 4 vertical fragments).
  - Mobile header buttons (`Delete`, `Discard Changes`, `Save Changes`) push the batch title into heavy truncation (`Batch #3 - Trucha West Coast I...`).
  - Checklist items in the preparation stage have small click targets that lack full-row touch-target affordance.
- **Expected Behavior:**
  - **1. Unified Workbench Grid System (Desktop):**
    - Structure the desktop view into a balanced 12-column operational workbench: 8 columns for primary active tasks (Brew Day Assistant / Live Steps) and 4 columns for sticky telemetry metrics (Efficiency, pH, Measurements).
    - Integrate `Brew Sheet` as a collapsible modal or expandable drawer rather than a disjointed floating strip.
  - **2. Responsive Brew Day Stepper Architecture:**
    - On desktop/tablet, display step titles with clean spacing and step badges.
    - On mobile (<640px), replace the rigid multi-step text bar with a compact active step indicator (e.g., `Step 1 of 4: Preparation` with a horizontal progress line or swipeable pill tabs).
  - **3. Mobile Data Density & Table Refactor:**
    - Refactor `BrewSheet.tsx` tables to use the design system `<Table>` primitive with horizontal scrolling or responsive card-list transformation on small screens.
    - Enforce `MONO_VALUE_CLASS` (`font-mono tabular-nums tracking-tight`) on all live gravity, temperature, and duration metrics.
  - **4. Touch Ergonomics & Action Hierarchy:**
    - Ensure checklist rows in the brew day assistant have full-width 44px tap targets with distinct checked/unchecked background states.
    - Collapse header secondary actions (`Delete`, `Discard`) into an overflow icon menu on mobile to preserve title visibility.
- **Resolution Path:** Logged via `/log` for triage and scheduling.

### [BUG-031] Packaging & Carbonation Form Grid Alignment, Metric Surface Consistency, and Sub-Calculator Layout Refactor

- **Date Logged:** 2026-08-24
- **Status:** `OPEN`
- **Category:** Type C (Batches & Packaging / UI/UX & Layout Architecture)
- **Component:** `apps/web` (`components/PackagingSection.tsx`, `components/BatchDetail.tsx`, `components/ui/FormField.tsx`, `components/ui/MetricTile.tsx`)
- **Reported Issue:** Form inputs within the Packaging package card have asymmetric widths and misaligned baselines, `Bottle Size` sits orphaned on an empty second row, and top-level summary metrics mix read-only display tiles with editable inputs in the same row.
- **Observed Behavior:**
  - Row 1 inputs (`Destination`, `Volume`, `Target CO2`, `Priming Sugar`) have arbitrary, unconstrained widths that do not follow a standardized 12-column grid.
  - `Bottle Size` occupies an isolated second line with ~75% dead space to its right.
  - The top 4-column metric bar mixes static display cards (`Final Gravity`, `ABV`, `Packaging Volume`) with an editable `<input>` field (`Carbonation/Storage Temp`), creating visual and functional inconsistency.
  - In the "Syringe Inoculation" sub-panel, input boxes and calculated readouts (`Total Solution`, `Inject Per Bottle`) sit on misaligned vertical baselines.
  - Comma and decimal delimiters are mixed within the same card (`2,4` vs `28.8 g` and `1.03 g/L`).
- **Expected Behavior:**
  - **1. Balanced Multi-Column Form Grid:**
    - Refactor the Package configuration card into a rigid 12-column grid (`grid grid-cols-12 gap-4`):
      - `Destination`: `col-span-12 md:col-span-3`
      - `Bottle Size`: `col-span-12 md:col-span-3` (paired alongside Destination)
      - `Volume (L)`: `col-span-12 md:col-span-2`
      - `Target CO2 (vols)`: `col-span-12 md:col-span-2`
      - `Priming Sugar`: `col-span-12 md:col-span-2`
  - **2. Top Metrics Surface Separation:**
    - Standardize the top summary cards using `<MetricTile>` primitives for read-only values.
    - Move `Carbonation/Storage Temp` into the packaging configuration form or represent it as a clearly designated editable field separate from read-only telemetry.
  - **3. Syringe Inoculation Subpanel Alignment:**
    - Structure the syringe calculator into an even 4-column sub-grid: 2 inputs (`Dilution Water`, `Target Dose`) and 2 formatted output tiles (`Total Solution`, `Inject Per Bottle`) with consistent `h-10` heights and baseline alignment.
  - **4. Numeric Anti-Jitter & Delimiter Normalization:**
    - Enforce standard dot delimiters and `MONO_VALUE_CLASS` (`font-mono tabular-nums tracking-tight`) across all carbonation metrics and syringe dosages.
- **Resolution Path:** Logged via `/log` for triage and implementation.

### [BUG-032] Batch Stat Strip MetricTile Component Fidelity and Editable Input Decoupling

- **Date Logged:** 2026-08-24
- **Status:** `OPEN`
- **Category:** Type C (Batches & UI Architecture / Design System Alignment)
- **Component:** `apps/web` (`components/BatchDetail.tsx`, `components/PackagingSection.tsx`, `components/ui/MetricTile.tsx`, `components/ui/FormField.tsx`)
- **Reported Issue:** The top summary row of the packaging view encapsulates an editable text input (`Carbonation/Storage Temp`) directly inside a read-only metric tile card, causing severe visual baseline misalignment and violating `<MetricTile>` component design tokens.
- **Observed Behavior:**
  - The 4-card metric strip renders `Final Gravity`, `ABV`, and `Packaging Volume` as static display metrics using `METRIC_VALUE_CLASS` (`text-2xl font-extrabold`), but embeds an interactive `<input>` inside the fourth card (`Carbonation/Storage Temp`).
  - The embedded input has distinct border, height, and placeholder styling that conflicts with the surrounding stat cards and disrupts the vertical baseline rhythm across the row.
  - Calculation parameters (storage temperature) are mixed directly into the batch telemetry readout strip.
- **Expected Behavior:**
  - **1. Pure `<MetricTile>` Display Strip:**
    - Standardize the top 4 cards as pure read-only `<MetricTile>` primitives displaying computed/measured data (`METRIC_LABEL_CLASS` + `METRIC_VALUE_CLASS` with `font-mono tabular-nums`).
  - **2. Decouple Storage Temperature Parameter:**
    - Relocate the editable `Carbonation/Storage Temp (°C)` field into the `Packaging & Carbonation` configuration form alongside `Target CO2`, `Volume`, and `Priming Sugar` using a standard `<FormField>` and `<NumberInput>` primitive with an inline `°C` addon.
    - If storage temperature must appear in the top strip, display it as a formatted stat tile (e.g. `4.0 °C`) that opens an inline edit modal/popover on click.
- **Resolution Path:** Logged via `/log` for triage and implementation.

### [BUG-033] Global Unsaved Changes Navigation Blocker and Dirty State Guard Architecture

- **Date Logged:** 2026-08-24
- **Status:** `OPEN`
- **Category:** Type B (Architecture & Navigation / Data Integrity & UX Safety)
- **Component:** `apps/web` (`components/Modal.tsx`, `pages/BatchDetail.tsx`, `App.tsx`, `hooks/useUnsavedChanges.ts`)
- **Reported Issue:** Navigating to another route via the sidebar while unsaved edits exist in forms or open modals silently destroys user input without a confirmation prompt or dirty-state guard.
- **Observed Behavior:**
  - When modifying values within a recipe, batch stage, or modal dialog (e.g., Water Chemistry, Equipment Profile, Stock Adjustments), clicking any sidebar link (Recipes, Batches, Inventory, Calculators) executes an immediate route transition.
  - The React Router v7 router tree unmounts the active route, discarding uncommitted form state with zero user warning or recovery mechanism.
  - Open modals do not intercept sidebar navigation events or block route changes when their internal state differs from persisted storage.
- **Expected Behavior:**
  - **1. React Router v7 Navigation Blocker (`useBlocker`):**
    - Implement a global `useUnsavedChanges` hook utilizing React Router's `useBlocker` to trap both client-side route transitions and browser `beforeunload` events when form/modal dirty flags are `true`.
  - **2. Standardized Confirmation Dialog:**
    - Display an accessible confirmation modal (`<Modal>` primitive) when an uncommitted route transition is attempted:
      - "You have unsaved changes. Are you sure you want to leave this page? Unsaved edits will be lost."
      - Actions: `Stay on Page` (Secondary) and `Discard & Leave` (Destructive/Rose `BUTTON_DANGER_CLASS`).
  - **3. Modal Dirty State Trapping:**
    - If a modal contains pending form edits, intercept backdrop clicks, Escape key presses, and parent sidebar navigation by requiring explicit cancellation confirmation before closing.
- **Resolution Path:** Logged via `/log` for triage and implementation.

### [BUG-034] Inventory Item Form Grid Symmetry, Compound Input Units, and Category Details Architecture Refactor

- **Date Logged:** 2026-08-24
- **Status:** `OPEN`
- **Category:** Type C (Inventory & Stock / UI/UX & Layout Architecture)
- **Component:** `apps/web` (`components/InventoryForm.tsx`, `components/InventoryManager.tsx`, `components/ui/FormField.tsx`, `components/ui/NumberInput.tsx`)
- **Reported Issue:** The Inventory Item editor layout exhibits severe column imbalances (empty gaps in right-hand columns), isolates single units into standalone oversized dropdowns, clips placeholder text, and renders notes in a compressed, misaligned box.
- **Observed Behavior:**
  - In `Item Information`, `Expiry Date` and `Notes` stack in the left column with dead space across the entire right half of the card.
  - `Unit` (`kg`) occupies a full half-width column parallel to `Quantity` instead of acting as an integrated input suffix/addon.
  - `Notes` textarea is constrained to a tiny, non-spanning box on the left rather than occupying a full-width bottom row.
  - In `Category Details`, placeholder text inside `Supplier / Maltster` truncates (`e.g. BESTMALZ, Weyerma`).
  - `Manufacturing Date` sits orphaned on the left column with empty dead space on the right.
  - Number inputs (`Potential`, `Color`) use comma separators (`1,038`, `3,5`) without standard `MONO_VALUE_CLASS` tabular formatting.
- **Expected Behavior:**
  - **1. Balanced 12-Column Responsive Form Grid:**
    - Refactor `Item Information` into a structured 12-column layout:
      - `Item Name`: `col-span-12 md:col-span-8`
      - `Category`: `col-span-12 md:col-span-4`
      - `Quantity & Unit`: Compound field (`col-span-12 md:col-span-4`) using `<NumberInput>` with integrated select/addon suffix (`addonRight="kg"`).
      - `Cost Per Unit`: `col-span-12 md:col-span-4`
      - `Purchase Date` & `Expiry Date`: Paired side-by-side (`col-span-6 md:col-span-4` each).
      - `Notes`: Full-width span (`col-span-12`) using `<Textarea>` with consistent `bg-slate-800 border-slate-700` styling.
  - **2. Category Details Specific Sub-Grid:**
    - Align category parameters into clean 2-column or 3-column rows:
      - Row 1: `Potential (SG)` + `Color (SRM)` + `Fermentable Type` (3-column grid).
      - Row 2: `Supplier / Maltster` + `Origin / Country` (2-column grid, eliminating text truncation).
      - Row 3: `Lot # / Batch` + `Manufacturing Date` (2-column grid, resolving orphaned inputs).
  - **3. Design System & Control Sizing Tokens:**
    - Enforce universal 40px height (`h-10`) across all inputs, selects, and date fields.
    - Enforce standard dot notation and `font-mono tabular-nums tracking-tight` on all gravity, SRM, and numeric quantity fields.
- **Resolution Path:** Logged via `/log` for triage and implementation.

### [BUG-035] Equipment Profile Editor Responsive Grid Symmetry, Physics Derivations, and Form Token Normalization

- **Date Logged:** 2026-08-24
- **Status:** `OPEN`
- **Category:** Type C (Equipment Profiles / UI/UX & Layout Architecture)
- **Component:** `apps/web` (`components/EquipmentForm.tsx`, `components/EquipmentManager.tsx`, `components/ui/FormField.tsx`, `components/ui/NumberInput.tsx`)
- **Reported Issue:** The Equipment Profile editor suffers from artificial width clamping on desktop, leaves orphaned inputs across every section card, causes vertical misalignment via asymmetric helper text, and forces an excessively long single-column scroll on mobile viewports.
- **Observed Behavior:**
  - On widescreen displays (>=1200px), the editor cards occupy only a narrow vertical column with vast dead space on the right.
  - `Profile Name`, `Hop Utilisation`, and `Mash Tun Heat Capacity` sit isolated in left columns with 50% blank space on their right.
  - In `Altitude & Atmospheric Physics`, the `Altitude` input and the `Atmospheric Derivations` display box have mismatched heights and break into unaligned rows on resize.
  - Unilateral helper text beneath left-column inputs pushes adjacent right-column fields out of horizontal alignment.
  - Decimal delimiters are inconsistent across inputs (`3,5` and `0,96` vs `94.6°C`), lacking strict `MONO_VALUE_CLASS` tabular number styling.
- **Expected Behavior:**
  - **1. Balanced 12-Column Responsive Grid:**
    - Standardize all section cards using `<Card>` and a 12-column grid system (`grid grid-cols-12 gap-4`):
      - **General Settings Card:**
        - `Profile Name`: `col-span-12 md:col-span-8`
        - `Batch Size (L)` & `Boil Time (min)`: `col-span-6 md:col-span-4` each
        - `Brewhouse Efficiency (%)` & `Mash Efficiency (%)`: `col-span-6 md:col-span-3` each
        - `Boil-Off Rate (L/hr)` & `Trub / Chiller Loss (L)`: `col-span-6 md:col-span-3` each
        - `Hop Utilisation (%)`: `col-span-12 md:col-span-6`
  - **2. Altitude & Physics Panel Re-Architecture:**
    - Structure `Altitude & Atmospheric Physics` into a clean 2-column or 3-column layout where `Altitude (m)` pairs with a compact, horizontally aligned derivations tile displaying boiling point and hop factor without height distortion.
  - **3. Thermal Mass Energy Balance Grid:**
    - Group thermal parameters into a balanced 4-column numeric grid (`Mash Water Ratio`, `Grain Absorption`, `Grain Temp`, `Sparge Temp`) and place `Mash Tun Heat Capacity` alongside strike temperature outputs.
    - Move field helper explanations into info tooltip icons beside labels to eliminate row-height misalignment.
  - **4. Numeric Formatting & Token Normalization:**
    - Enforce standard dot notation and `font-mono tabular-nums tracking-tight` across all volume, efficiency, rate, and temperature inputs.
- **Resolution Path:** Logged via `/log` for triage and implementation.

### [BUG-036] Mash Profile Editor Responsive Step Grid, Input Height Standardization, and Fluid Mobile Stacking Refactor

- **Date Logged:** 2026-08-24
- **Status:** `OPEN`
- **Category:** Type C (Mash Profiles / UI/UX & Layout Architecture)
- **Component:** `apps/web` (`components/MashProfileForm.tsx`, `components/MashProfileManager.tsx`, `components/ui/FormField.tsx`, `components/ui/Select.tsx`, `components/ui/NumberInput.tsx`)
- **Reported Issue:** Mash profile step cards fail to align across desktop viewports (erratic column gaps), overflow card boundaries on tablet viewports, orphan the 7th input on mobile, and exhibit mismatched control heights between text inputs and select dropdowns.
- **Observed Behavior:**
  - On desktop (>=1024px), Row 1 (3 inputs) and Row 2 (4 inputs) inside each step card use incompatible flex/grid ratios, creating large gaps in the center and mismatched right baselines.
  - On tablet viewports (~800px–1000px), temperature inputs overflow the right edge of the card container.
  - On mobile (<600px), inputs arrange into a 2-column grid that leaves `Infuse Water Temp (°C)` orphaned on an empty final row.
  - The `Type` dropdown renders taller with distinct padding and font weight compared to adjacent text and number inputs.
  - Helper text (`Blank = computed`) beneath `Infuse Amount` increases column height and shifts adjacent field baselines out of alignment.
- **Expected Behavior:**
  - **1. Balanced 12-Column Desktop Step Grid:**
    - Refactor each step card into a rigid 12-column grid (`grid grid-cols-12 gap-4`):
      - **Row 1 (Identity & Profile):** `Step Name` (`col-span-12 md:col-span-6`) and `Type` select (`col-span-12 md:col-span-6`).
      - **Row 2 (Thermal & Timing Metrics):** 4 equal columns (`grid grid-cols-2 md:grid-cols-4 col-span-12 gap-4`):
        1. `Temp (°C)` (`col-span-1`)
        2. `Rest (min)` (`col-span-1`)
        3. `Ramp (min)` (`col-span-1`)
        4. `Infuse Amount (L)` / `Infuse Water Temp (°C)` (dynamic or paired compound metric).
  - **2. Fluid Mobile & Tablet Layout:**
    - On mobile (<640px), stack `Step Name` and `Type` full-width (`w-full`), and pair numeric parameters into even 2x2 grids so no field sits orphaned on an empty row.
  - **3. Design System Token & Component Fidelity:**
    - Standardize all inputs, numeric fields, and select dropdowns to a strict 40px height (`h-10`) and matching border/focus states (`focus:ring-2 focus:ring-sky-400`).
    - Move helper text (`Blank = computed`) to an info tooltip icon or placeholder (`auto`) inside `<NumberInput>` to prevent vertical baseline displacement.
- **Resolution Path:** Logged via `/log` for triage and implementation.

### [BUG-037] Fermentation Profile Editor Responsive Grid Symmetry, Component Height Normalization, and Overflow Bleed Fix

- **Date Logged:** 2026-08-24
- **Status:** `OPEN`
- **Category:** Type C (Fermentation Profiles / UI/UX & Layout Architecture)
- **Component:** `apps/web` (`components/FermentationProfileForm.tsx`, `components/FermentationProfileManager.tsx`, `components/ui/FormField.tsx`, `components/ui/Select.tsx`, `components/ui/NumberInput.tsx`)
- **Reported Issue:** Fermentation profile step cards bleed outside the card boundary on medium/narrow viewports, leave >50% dead space on desktop Row 2, truncate the top profile name, and have mismatched heights between text inputs and select dropdowns.
- **Observed Behavior:**
  - On viewports < 1000px, `Temp (°C)` and `Duration (days)` inputs breach the right edge of the step container and overflow into the background canvas.
  - On widescreen displays (1340px+), Row 2 contains only 2 inputs (`Ramp` and `Pressure`), leaving the entire right half of each step card empty.
  - `Profile Name` at the top is constrained to a narrow container that truncates `Standard Ale Fermentation` to `Standard Ale Fermentatio`.
  - The `Type` dropdown renders at 44px height with bold typography, breaking baseline alignment with adjacent 38px text and number inputs.
  - Helper text (`Blank = not pressurised`) creates uneven vertical height on the bottom row.
- **Expected Behavior:**
  - **1. Balanced 12-Column Desktop Step Grid:**
    - Re-architect each step card into a unified 12-column grid (`grid grid-cols-12 gap-4`):
      - **Row 1 (Step Identity):** `Step Name` (`col-span-12 md:col-span-6`) and `Type` select (`col-span-12 md:col-span-6`).
      - **Row 2 (Metrics Grid):** 4 equal columns (`grid grid-cols-2 md:grid-cols-4 col-span-12 gap-4`):
        1. `Temp (°C)` (`col-span-1`)
        2. `Duration (days)` (`col-span-1`)
        3. `Ramp (days)` (`col-span-1`)
        4. `Pressure (PSI)` (`col-span-1` with inline placeholder `None / Unpressurized`).
  - **2. Responsive Fluid Stacking (Mobile & Tablet):**
    - Prevent container overflow on viewports < 1000px by switching step fields to full-width or paired 2x2 grids (`grid-cols-2 gap-3`).
  - **3. Design System Token & Form Normalization:**
    - Standardize all inputs and select dropdowns to a strict 40px height (`h-10`) with identical font sizing and focus states (`focus:ring-2 focus:ring-sky-400`).
    - Expand `Profile Name` container to `w-full max-w-lg` to prevent text truncation.
    - Move helper text into an info tooltip icon or input placeholder to preserve rigid baseline alignment.
- **Resolution Path:** Logged via `/log` for triage and implementation.

### [BUG-038] Water Profile Editor Responsive Grid Architecture, Ion Sizing Tokens, and Container Overflow Fix

- **Date Logged:** 2026-08-24
- **Status:** `OPEN`
- **Category:** Type C (Water Profiles / UI/UX & Layout Architecture)
- **Component:** `apps/web` (`components/WaterProfileForm.tsx`, `components/WaterProfileManager.tsx`, `components/ui/FormField.tsx`, `components/ui/NumberInput.tsx`, `components/ui/Select.tsx`)
- **Reported Issue:** Water profile editor cards bleed outside container boundaries on tablet viewports, orphan inputs across left columns, suffer from multi-line wrapped chemical labels, and clamp artificially on desktop viewports.
- **Observed Behavior:**
  - On tablet viewports (~800px–1000px), right-column ion inputs (`Sodium`, `Bicarbonate`) breach the container edge and float in the canvas margin.
  - On widescreen viewports (>=1100px), the editor cards are clamped to a narrow vertical column with vast dead space on the right.
  - `Description` and `pH (Optional)` sit isolated in left columns with 100% dead space to their right.
  - Verbose chemical labels with inline units (e.g. `Calcium (Ca²⁺) ppm *`) wrap awkwardly across multiple lines, causing vertical baseline misalignment between columns.
  - `Profile Type` select dropdown renders taller than adjacent text inputs, breaking control height consistency.
- **Expected Behavior:**
  - **1. Balanced 12-Column Responsive Grid:**
    - Refactor `Profile Information` into a structured 12-column grid (`grid grid-cols-12 gap-4`):
      - `Profile Name`: `col-span-12 md:col-span-6`
      - `Profile Type`: `col-span-12 md:col-span-6`
      - `Description`: Full-width span (`col-span-12`) using standard `<Textarea>` primitive.
  - **2. Ion Concentrations Responsive Grid System:**
    - Refactor `Ion Concentrations & pH` into a balanced 3-column or 6-column grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`):
      - Top/Main Row 1: `Calcium (Ca²⁺)`, `Magnesium (Mg²⁺)`, `Sodium (Na⁺)`.
      - Main Row 2: `Chloride (Cl⁻)`, `Sulfate (SO₄²⁻)`, `Bicarbonate (HCO₃⁻)`.
      - Secondary Row 3: `pH (Optional)` paired alongside calculated alkalinity/hardness or spanning an even 3-column sub-grid.
  - **3. Chemical Labeling & Input Unit Addons:**
    - Move `ppm` units directly inside `<NumberInput>` via trailing addons (`addonRight="ppm"` / `addonRight="pH"`).
    - Clean up label typography so ion names display crisply on a single horizontal baseline without wrapping.
  - **4. Universal 40px Control Height Token:**
    - Enforce standard `h-10` (40px) height and matching focus ring tokens across all inputs and select dropdowns.
- **Resolution Path:** Logged via `/log` for triage and implementation.

### [BUG-039] Settings Screen Responsive Multi-Column Grid, Mobile Form Row Stacking, and Select Width Normalization

- **Date Logged:** 2026-08-24
- **Status:** `OPEN`
- **Category:** Type C (Settings / UI/UX & Layout Architecture)
- **Component:** `apps/web` (`components/SettingsManager.tsx`, `components/designSystem.ts`, `components/ui/FormField.tsx`, `components/ui/Select.tsx`)
- **Reported Issue:** The Settings view is clamped to an artificial narrow container (`max-w-2xl`) on desktop displays leaving vast unused space, while on mobile, horizontal settings rows severely crush description labels into tall multi-line wrapped text blocks.
- **Observed Behavior:**
  - On desktop (>=1024px), settings cards occupy only 672px (`max-w-2xl`), leaving over 40% dead space across the right viewport inside `PageContainer`.
  - On mobile (<640px), `SETTINGS_ROW_CLASS` (`flex items-center justify-between`) forces descriptions to wrap into 5–6 vertical lines beside fixed select dropdowns.
  - Select dropdowns render with inconsistent, content-dependent widths, creating a ragged vertical alignment on the right edge.
  - The three settings cards are stacked into an unnecessarily long single vertical scroll rather than taking advantage of a multi-column responsive layout.
- **Expected Behavior:**
  - **1. Full-Width Responsive Desktop Grid:**
    - Remove the hardcoded `max-w-2xl` container restriction.
    - Structure the settings view into a balanced 2-column responsive layout (`grid grid-cols-1 lg:grid-cols-2 gap-6`):
      - Column 1: `Units & Display` + `Formulas & Calculations`.
      - Column 2: `Data & Recipe Ingestion` (featuring full-width drag-and-drop zone and backup management).
  - **2. Mobile Adaptive Row Architecture:**
    - On mobile (<640px), transition `SETTINGS_ROW_CLASS` from horizontal flex to vertical stacking (`flex-col items-start gap-2`):
      - Label and helper description span 100% width on top.
      - Select dropdown expands to full width (`w-full`) underneath for easy thumb selection.
  - **3. Select Width & Height Standardization:**
    - Enforce standard 40px height (`h-10`) and uniform full-width or matched column widths across all settings dropdowns.
- **Resolution Path:** Logged via `/log` for triage and implementation.

### [BUG-040] TruchaBrew Design System Unification: Composable UI Primitives, 12-Column Responsive Grid, and Global Navigation Guard Architecture

- **Date Logged:** 2026-08-24
- **Status:** `IN_PLANNING`
- **Category:** Type C (Global Architecture / Design System & Core UI/UX)
- **Component:** `apps/web` (`components/ui/*`, `components/designSystem.ts`, `components/PageContainer.tsx`, `components/TopBar.tsx`, `components/Modal.tsx`, `hooks/useUnsavedChanges.ts`)
- **Reported Issue:** Across all application routes (Recipe Designer, Batch Workbench, Equipment/Mash/Fermentation/Water Profile Editors, Inventory, Settings), views rely on fragmented Tailwind class strings instead of composable React primitives, resulting in severe responsive grid collapses, container boundary overflows, mismatched control heights, unlocalized numeric delimiters, and silent data loss on sidebar navigation.
- **Observed Behavior:**
  - **Component Drift:** `<select>` elements render at 44px with bold typography while `<input>` elements render at ~38px with normal weight, breaking horizontal and vertical baseline alignment across all profile forms.
  - **Grid & Breakpoint Fractures:**
    - On desktop (>=1024px), screens like Settings and Profile Editors clamp artificially (`max-w-2xl`), wasting 35–45% of available horizontal space.
    - On tablet viewports (800px–1000px), multi-column inputs in Mash, Fermentation, and Water profile cards breach container boundaries and bleed into canvas margins.
    - On mobile (<640px), settings and step cards either crush description labels into 6-line text wraps or collapse into long, single-column vertical scrolls.
  - **Data Safety Vulnerability:** Navigating via the sidebar while forms or modals have uncommitted edits triggers immediate route teardown without confirmation prompts or dirty-state guards.
  - **Numeric Formatting Drift:** Comma delimiters (`30,53`, `3,5`) are mixed with dot notation (`1.054`, `94.6°C`), and numerous inputs lack `MONO_VALUE_CLASS` (`font-mono tabular-nums tracking-tight`).
  - **Header & Button Ambiguity:** Top bars crowd titles and 3–4 desktop buttons into unconstrained flex rows (causing `Recip...` and `Batch #3...` truncations), while rendering competing primary amber buttons side-by-side.
- **Expected Behavior:**
  - **1. Composable UI Primitive Layer (`apps/web/src/components/ui/`):**
    - Build and enforce strict React 19 primitives: `<Button>`, `<Card>`, `<FormField>`, `<Input>`, `<NumberInput>`, `<Select>`, `<Textarea>`, `<MetricTile>`, `<Badge>`, and `<Table>`.
    - Standardize a universal 40px control plane (`h-10`) across all inputs, selects, and buttons.
    - Integrate units (`°C`, `ppm`, `kg`, `g`, `min`, `PSI`) directly into `<NumberInput>` via trailing addons (`addonRight`).
  - **2. Universal 12-Column Responsive Grid System:**
    - Standardize all workbench views, profile editors, and settings panels on fluid 12-column grids (`grid grid-cols-12 gap-4 md:gap-6`):
      - Desktop (>=1024px): Multi-column metadata headers and balanced 4-column metric rows without orphaned trailing inputs.
      - Mobile/Tablet (<640px): Full-width primary inputs with paired 2-column numeric inputs (44px touch targets).
  - **3. Global Navigation Guard & Dirty State Trap:**
    - Implement a centralized `useUnsavedChanges` hook utilizing React Router v7's `useBlocker` to trap route transitions and browser `beforeunload` events when form/modal dirty flags are active.
    - Present a standard confirmation dialog before discarding uncommitted state.
  - **4. Global Numeric Anti-Jitter & Delimiter Normalization:**
    - Enforce standard dot delimiters and `font-mono tabular-nums tracking-tight` across all gravity, volume, temperature, duration, and chemical concentration fields.
  - **5. Header Shell & Action Hierarchy Modernization:**
    - Refactor `TopBar` into a responsive shell with single primary action emphasis, secondary action overflow dropdowns on mobile/tablet, and guaranteed `<h1>` title visibility without truncation.
- **Resolution Path:** Logged via `/log` for triage and implementation.















