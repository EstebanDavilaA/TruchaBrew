# FEATURE SPECIFICATION: M34_P5 — Chrome, Remaining Managers, FEAT-030 Searchable Catalog Pickers, and BODY_TEXT_CLASS Resolution

> **Milestone 34:** "Every dialog and panel is built from the same parts" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 5 of 5 (Milestone Closure).** Completes the Living Design System panel & dialog modernization by migrating the four remaining profile managers (`EquipmentManager.tsx`, `MashProfileManager.tsx`, `FermentationProfileManager.tsx`, `WaterProfileManager.tsx`), `SettingsManager.tsx`, `SaveBar.tsx`, and `TopBar.tsx` onto `components/ui/` primitives (`<Button>`, `<Select>`, `<Input>`), delivering `FEAT-030` searchable preset catalog pickers across Recipe Editor ingredient sections (`FermentableSection.tsx`, `HopSection.tsx`, `YeastSection.tsx`, `MiscSection.tsx`) replacing static HTML dropdowns, resolving `BODY_TEXT_CLASS` with active production consumers, completing the final AC-13 token conversion sweep across `ReadingLog.tsx` / `BatchDetail.tsx`, and extending `ScopeGuardrail.test.tsx` / `accessibilityAndPolish.test.tsx` to close Milestone 34.

---

## Phase Summary

Milestone 34 Phase 4 migrated the four heaviest panels and Calculators remainder. Phase 5 now completes the milestone across the remaining application chrome, managers, token invariants, and the Recipe Editor searchable catalog ingestion flow:

1. **FEAT-030 Searchable Preset Catalog Picker (Recipe Editor Ingestion Modernization):**
   - Retires the static, non-searchable HTML `<select>` dropdown boxes (`-- Select Grain / Malt from Catalog --`, `-- Select Hop Variety --`, `-- Select Yeast Strain --`, `-- Select Misc from Catalog --`) at the bottom of the four Recipe Editor sections.
   - Replaces them with modern, accessible `<Button variant="secondary" size="sm">` triggers (e.g. `+ Add Fermentable from Catalog`, `+ Add Hop from Catalog`) that open the dedicated `PresetPickerModal` dialog.
   - Leverages instant fuzzy search filtering across all catalog items with rich metadata previews (Potential SG, SRM color, Alpha Acid %, Hop Form, Yeast Lab & Attenuation %, Misc Purpose).
   - Preserves instant selection insertion into recipe state and the persistent `+ Add Custom Item` fallback.
2. **Four Profile Managers Content Migration:**
   - `EquipmentManager.tsx`: Replaces the "New Profile" raw button with `<Button variant="primary" size="sm">` (`data-testid="equipment-new-profile"`), load-error "Retry" with `<Button variant="secondary" size="sm">`.
   - `MashProfileManager.tsx`: Replaces "New Profile" with `<Button variant="primary" size="sm">` (`data-testid="mash-new-profile"`), load-error "Retry" with `<Button variant="secondary" size="sm">`.
   - `FermentationProfileManager.tsx`: Replaces "New Profile" with `<Button variant="primary" size="sm">` (`data-testid="fermentation-new-profile"`), load-error "Retry" with `<Button variant="secondary" size="sm">`.
   - `WaterProfileManager.tsx`: Replaces "New Profile" with `<Button variant="primary" size="sm">` (`data-testid="water-new-profile"`), load-error "Retry" with `<Button variant="secondary" size="sm">`.
3. **`SettingsManager.tsx` Content Migration:**
   - Replaces the 5 raw `FORM_SELECT_CLASS` `<select>` dropdowns (Unit System, Gravity Display, Temperature, IBU Formula, ABV Formula) with `<Select size="sm">` or `<Select size="md">` primitives.
   - Replaces the load-error "Retry" button with `<Button variant="secondary" size="sm">`.
   - Preserves all `data-testid`s, `aria-label`s, and `useConfig` live persistence round-trips.
4. **`SaveBar.tsx` Content Migration:**
   - Replaces the Save Recipe button with `<Button variant="primary" size="sm">` with integrated `<Loader2>` spinner when saving and error retry styling when in error state.
   - Replaces the error banner dismiss button with `<Button variant="icon">`.
5. **`TopBar.tsx` Chrome Migration:**
   - Replaces the mobile navigation hamburger trigger button with a `components/ui/` primitive (`<Button variant="secondary" size="sm" className="md:hidden ...">` or `<Button variant="icon" className="md:hidden ...">`), preserving `aria-label="Open navigation menu"` and drawer open callback.
6. **BODY_TEXT_CLASS Active Consumer Resolution:**
   - Adopts `BODY_TEXT_CLASS` (`text-sm text-slate-300`) across secondary descriptions, manager callouts, and settings explanatory text, ensuring the token is no longer an orphaned constant.
7. **Final AC-13 Token-Import to Adoption Conversion:**
   - `ReadingLog.tsx` and `pages/BatchDetail.tsx` convert their remaining token imports onto primitives where appropriate, reducing `designTokens.test.ts` AC-13 rows to 0 and establishing 100% adoption assertions across all application screens in `uiPrimitives.test.tsx`.
8. **Milestone 34 Closing Assertions:**
   - Reconciles `ScopeGuardrail.test.tsx` and `accessibilityAndPolish.test.tsx` to assert 0 raw interactive elements across all 8 dialogs, 5 batch surfaces, 4 recipe editor sections, and 6 manager/settings surfaces.

---

## Acceptance Criteria Matrix (28 ACs)

| ID | Category | Requirement / Expected Behavior | Verification Method |
|---|---|---|---|
| **AC-1** | Design System Invariant | `designSystem.ts` exports exactly 28 constants; `Modal.tsx` container shell remains untouched and read-only. | Byte-check & `designSystem.test.ts` |
| **AC-2** | FEAT-030 Fermentables | `FermentableSection.tsx` replaces static `<select>` dropdown with `<Button variant="secondary" size="sm">` opening `PresetPickerModal` for fermentables with live search & rich metadata. | `FermentableSection.test.tsx` |
| **AC-3** | FEAT-030 Hops | `HopSection.tsx` replaces static `<select>` dropdown with `<Button variant="secondary" size="sm">` opening `PresetPickerModal` for hops with live search & alpha acid metadata. | `HopSection.test.tsx` |
| **AC-4** | FEAT-030 Yeast | `YeastSection.tsx` replaces static `<select>` dropdown with `<Button variant="secondary" size="sm">` opening `PresetPickerModal` for yeast strains with live search & attenuation metadata. | `YeastSection.test.tsx` |
| **AC-5** | FEAT-030 Miscs | `MiscSection.tsx` replaces static `<select>` dropdown with `<Button variant="secondary" size="sm">` opening `PresetPickerModal` for misc ingredients with live search & purpose metadata. | `MiscSection.test.tsx` |
| **AC-6** | EquipmentManager | "New Profile" renders via `<Button variant="primary" size="sm">` (`data-testid="equipment-new-profile"`); "Retry" renders via `<Button variant="secondary" size="sm">`. | Unit test & snapshot |
| **AC-7** | MashProfileManager | "New Profile" renders via `<Button variant="primary" size="sm">` (`data-testid="mash-new-profile"`); "Retry" renders via `<Button variant="secondary" size="sm">`. | Unit test & snapshot |
| **AC-8** | FermentationProfileManager | "New Profile" renders via `<Button variant="primary" size="sm">` (`data-testid="fermentation-new-profile"`); "Retry" renders via `<Button variant="secondary" size="sm">`. | Unit test & snapshot |
| **AC-9** | WaterProfileManager | "New Profile" renders via `<Button variant="primary" size="sm">` (`data-testid="water-new-profile"`); "Retry" renders via `<Button variant="secondary" size="sm">`. | Unit test & snapshot |
| **AC-10** | SettingsManager Selects | All 5 setting dropdowns (Unit System, Gravity, Temperature, IBU, ABV) render via `<Select>` with preserved options and change handlers. | `SettingsManager.test.tsx` |
| **AC-11** | SettingsManager Retry | Load error "Retry" button renders via `<Button variant="secondary" size="sm">`. | `SettingsManager.test.tsx` |
| **AC-12** | SaveBar Primary | Save button renders via `<Button variant="primary" size="sm">` preserving saving, error retry, and idle states with spinner. | `SaveBar.test.tsx` / `useRecipeEditor.test.tsx` |
| **AC-13** | SaveBar Dismiss | Persistent error banner dismiss button renders via `<Button variant="icon">` preserving `title` and dismiss action. | `SaveBar.test.tsx` |
| **AC-14** | TopBar Hamburger | Mobile drawer trigger renders via `<Button variant="secondary" size="sm">` or `<Button variant="icon">` with `aria-label="Open navigation menu"`. | `TopBar.test.tsx` & `MobileNav.test.tsx` |
| **AC-15** | BODY_TEXT_CLASS | `BODY_TEXT_CLASS` (`text-sm text-slate-300`) is imported and actively consumed across manager/settings callouts and explanatory text (>= 3 distinct production consumers). | Static grep & `designTokens.test.ts` |
| **AC-16** | AC-13 Final Sweep | `designTokens.test.ts` AC-13 row list is cleanly retired (0 rows) and replaced by 100% adoption assertions in `uiPrimitives.test.tsx`. | `designTokens.test.ts` |
| **AC-17** | ReadingLog & BatchDetail | Remaining raw inputs in `ReadingLog.tsx` and `pages/BatchDetail.tsx` migrated onto `components/ui/` primitives. | `ReadingLog.test.tsx` & `BatchDetail.test.tsx` |
| **AC-18** | Static Adoption Sweep | Zero raw `<button className=...>`, zero raw `<select className=...>`, zero raw text/number `<input className=...>` across all manager views, SaveBar, TopBar, Recipe Editor sections, and SettingsManager. | `uiPrimitives.test.tsx` |
| **AC-19** | Modal Shell Invariant | M25 Modal shell tests in `Modal.test.tsx` pass unmodified (focus trap, Escape dismissal, backdrop click, focus restore). | `Modal.test.tsx` (9/9 passed) |
| **AC-20** | EquipmentManager Invariant | Existing CRUD and active recipe blocking tests in `EquipmentManager.test.tsx` pass 100%. | `EquipmentManager.test.tsx` |
| **AC-21** | MashProfileManager Invariant | Existing CRUD and step display tests in `MashProfileManager.test.tsx` pass 100%. | `MashProfileManager.test.tsx` |
| **AC-22** | FermentationProfileManager | Existing CRUD and step display tests in `FermentationProfileManager.test.tsx` pass 100%. | `FermentationProfileManager.test.tsx` |
| **AC-23** | WaterProfileManager Invariant | Existing CRUD and ion display tests in `WaterProfileManager.test.tsx` pass 100%. | `WaterProfileManager.test.tsx` |
| **AC-24** | SettingsManager Invariant | Existing live config switching and persistence round-trip tests in `SettingsManager.test.tsx` and `ConfigContext.test.tsx` pass 100%. | `SettingsManager.test.tsx` |
| **AC-25** | Layer 1 Gate: Tests | Full test suite passes without reduction (>= 2,204 tests passing across 121 files). | `npm test` (exit 0) |
| **AC-26** | Layer 1 Gate: Typecheck | Monorepo typecheck clean across all 4 workspaces. | `npm run typecheck` (exit 0) |
| **AC-27** | Layer 1 Gate: Build | Production client bundle builds cleanly without error. | `npm run build` (exit 0) |
| **AC-28** | Layer 1 Gate: Lint | Monorepo linter clean (0 errors, 4 pre-existing warnings in untouched context files). | `npm run lint` (exit 0) |

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Read-Only (28 Constants).**
No tokens added, modified, or deleted. All primitives are imported from `components/ui`.

**RA-2 — `Modal.tsx` Shell Remains Read-Only.**
No changes to `Modal.tsx` container shell.

**RA-3 — `PresetPickerModal` Reuse in Recipe Sections (FEAT-030).**
`PresetPickerModal` is imported directly into `FermentableSection.tsx`, `HopSection.tsx`, `YeastSection.tsx`, and `MiscSection.tsx`. Selecting a preset triggers the section's `onAdd` callback with the preset's calibrated default values. Custom item selection opens the manual creation flow.

**RA-4 — `BODY_TEXT_CLASS` Resolution.**
`BODY_TEXT_CLASS` (`text-sm text-slate-300`) is imported and applied to explanatory paragraphs and secondary description text in `SettingsManager.tsx` and manager screens. It remains in `designSystem.ts` and is backed by active consumers.

**RA-5 — Native Exemptions Preserved.**
Hidden `<input type="file">`, range sliders (`type="range"`), and checkboxes not abstracted by `components/ui/` remain native.

---

## Authorized Files to Modify

- `apps/web/src/components/FermentableSection.tsx`
- `apps/web/src/components/HopSection.tsx`
- `apps/web/src/components/YeastSection.tsx`
- `apps/web/src/components/MiscSection.tsx`
- `apps/web/src/components/EquipmentManager.tsx`
- `apps/web/src/components/MashProfileManager.tsx`
- `apps/web/src/components/FermentationProfileManager.tsx`
- `apps/web/src/components/WaterProfileManager.tsx`
- `apps/web/src/components/SettingsManager.tsx`
- `apps/web/src/components/SaveBar.tsx`
- `apps/web/src/components/TopBar.tsx`
- `apps/web/src/components/ReadingLog.tsx`
- `apps/web/src/pages/BatchDetail.tsx`
- `apps/web/test/FermentableSection.test.tsx`
- `apps/web/test/HopSection.test.tsx`
- `apps/web/test/YeastSection.test.tsx`
- `apps/web/test/MiscSection.test.tsx`
- `apps/web/test/EquipmentManager.test.tsx`
- `apps/web/test/MashProfileManager.test.tsx`
- `apps/web/test/FermentationProfileManager.test.tsx`
- `apps/web/test/WaterProfileManager.test.tsx`
- `apps/web/test/SettingsManager.test.tsx`
- `apps/web/test/TopBar.test.tsx`
- `apps/web/test/SaveBar.test.tsx`
- `apps/web/test/uiPrimitives.test.tsx`
- `apps/web/test/designTokens.test.ts`
- `apps/web/test/ScopeGuardrail.test.tsx`
- `apps/web/test/accessibilityAndPolish.test.tsx`
- `.gsd/STATE.json`

---

## Halt Gate (State 2)

Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution.
