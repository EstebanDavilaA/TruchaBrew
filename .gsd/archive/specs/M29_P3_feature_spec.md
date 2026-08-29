# Feature Specification: Milestone 29, Phase 3 (Comprehensive App-Wide Harmonization)

**Milestone 29:** Product-Wide UI/UX Ergonomics, Accessibility & Information Architecture (`FEAT-020`)  
**Phase:** Phase 3 — App-Wide High-Contrast Surface, Form & Numeric Harmonization (`M29_P3`)  
**Status:** ARCHIVED (COMPLETE)  
**Date:** 2026-08-22  

---

## 1. Overview & Intent

Per direct user steering, Phase 3 establishes and applies a single, cohesive, high-contrast visual design language across the **entire application** without exception:

1. **Core Design Token Upgrade (`designSystem.ts`)**:
   - `CARD_CLASS`: High-contrast `bg-slate-900/90 border border-slate-800/90 rounded-xl p-5 shadow-lg`.
   - `SUBPANEL_CLASS`: High-contrast `bg-slate-950/60 p-4 rounded-xl border border-slate-800/80`.
   - `INPUT_CLASS`: High-contrast structured input `bg-slate-950 border border-slate-700/80 text-slate-100 rounded-xl focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 block w-full px-3.5 py-2 text-sm transition-colors`.
   - `INPUT_COMPACT_CLASS`: High-contrast compact input `bg-slate-950 border border-slate-700/80 text-slate-100 rounded-lg focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 px-2.5 py-1.5 text-xs transition-colors`.
   - `FORM_SELECT_CLASS`: High-contrast dropdown `bg-slate-950 border border-slate-700/80 text-slate-100 rounded-xl focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 block w-full px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer`.
   - `FORM_SELECT_COMPACT_CLASS`: High-contrast compact dropdown `bg-slate-950 border border-slate-700/80 text-slate-100 rounded-lg focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer`.

2. **Recipe Designer & Sections**:
   - Recipe identity header in `App.tsx` (Recipe Name, Style Name, Brewer, Equipment select).
   - `StatsHeader.tsx` with `MONO_VALUE_CLASS` on all dynamic values.
   - `FermentableSection.tsx`, `HopSection.tsx`, `YeastSection.tsx`, `MiscSection.tsx`, `MashSection.tsx`, `WaterSection.tsx`.

3. **Calculators Hub & All Calculator Cards**:
   - `Calculators.tsx` and `CalculatorCard.tsx`.
   - All 10 standalone calculators: `StrikeWaterCalculator.tsx`, `RefractometerCalculator.tsx`, `HydrometerCalculator.tsx`, `GravityCorrectionCalculator.tsx`, `CarbonationCalculator.tsx`, `PitchRateCalculator.tsx`, `StarterGrowthCalculator.tsx`, `HopDecayCalculator.tsx`, `InfusionVolumeCalculator.tsx`, `UnitConverterCalculator.tsx`.

4. **Batch Detail & Brew Day Logging**:
   - `BatchDetail.tsx` (batch status selector, target metrics, quick action controls).
   - `ReadingLog.tsx` (date/time, gravity, temperature, and notes inputs).
   - `BatchNoteLog.tsx` (new note textarea, category selects).
   - `SensoryEvaluationPanel.tsx` & `SplitPackagingPanel.tsx`.

5. **Catalog Profile Managers & Forms**:
   - `EquipmentForm.tsx`
   - `MashProfileForm.tsx`
   - `FermentationProfileForm.tsx`
   - `WaterProfileForm.tsx`
   - `InventoryForm.tsx`

6. **Settings Manager**:
   - `SettingsManager.tsx` (unit systems, formula selects, and settings cards).

7. **All Modals & Dialogs**:
   - `WaterCalculatorModal.tsx`
   - `PostBrewCalibrationModal.tsx`
   - `RefractometerFermentationModal.tsx`
   - `BatchRecipeAdjustModal.tsx`
   - `PresetPickerModal.tsx`
   - `RecipeImportModal.tsx`
   - `ConfirmDialog.tsx`

---

## 2. Acceptance Criteria Matrix

| AC ID | Area | Requirement Description | Verification |
|---|---|---|---|
| **AC-1** | Core Tokens | `designSystem.ts` defines high-contrast tokens with `bg-slate-950` inputs/selects, `border-slate-700/80`, `rounded-xl`/`rounded-lg`, and amber focus rings. | `designTokens.test.ts` |
| **AC-2** | Recipe Designer | Recipe Name, Style Name, and Brewer in `App.tsx` use high-contrast card styling with clear edit affordance. | `App.test.tsx` |
| **AC-3** | StatsHeader | `StatsHeader.tsx` uses `MONO_VALUE_CLASS` on all dynamic calculated vitals. | `StatsHeader.test.tsx` |
| **AC-4** | Calculators Hub | All 10 calculator cards in `apps/web/src/components/calculators/` use high-contrast `INPUT_CLASS` and `font-mono tabular-nums`. | `Calculators.test.tsx` |
| **AC-5** | Batch Forms | `BatchDetail.tsx`, `ReadingLog.tsx`, `BatchNoteLog.tsx`, `SensoryEvaluationPanel.tsx`, and `SplitPackagingPanel.tsx` use unified `INPUT_CLASS` / `FORM_SELECT_CLASS`. | `BatchDetail.test.tsx` |
| **AC-6** | Profile Forms | `EquipmentForm.tsx`, `MashProfileForm.tsx`, `FermentationProfileForm.tsx`, `WaterProfileForm.tsx`, and `InventoryForm.tsx` use structured `INPUT_CLASS` and `FORM_SELECT_CLASS`. | Profile form tests |
| **AC-7** | Settings | `SettingsManager.tsx` uses high-contrast selects, cards, and structured setting rows. | `SettingsManager.test.tsx` |
| **AC-8** | Modals | All modals (`WaterCalculatorModal`, `PostBrewCalibrationModal`, `RefractometerFermentationModal`, `BatchRecipeAdjustModal`, `PresetPickerModal`, `RecipeImportModal`, `ConfirmDialog`) use `SUBPANEL_CLASS` and `INPUT_CLASS`. | Modal tests |
| **AC-9** | Layer 1 | All automated test suites (1,947+ tests), typecheck across all 4 workspaces, production build, and lint pass with exit code 0. | `npm test && npm run typecheck && npm run build && npm run lint` |
| **AC-10** | Scope | Pre/post SHA-256 manifest confirms clean changes within frontend workspaces. | SHA-256 manifest diff |
