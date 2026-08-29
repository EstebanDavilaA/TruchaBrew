# FEATURE SPECIFICATION: M24_P2 — Standardize Vocabulary on "Profile" & Profile Form Test Coverage

## Phase Summary

This is the second and closing phase of **Milestone 24 ("One visual language, one vocabulary")**.

While Phase 1 resolved the visual consistency and contrast of buttons and inputs across the app, Phase 2 resolves the vocabulary consistency. The app currently alternates between the terms **"Profile"** and **"Schedule"** for mash and fermentation definitions (e.g. `Sidebar.tsx` displaying "Mash Schedules" while routes and APIs use `mashProfiles`). This phase standardizes all entity-level user-facing copy and error banners on **"Profile"**, preserves legitimate domain brewing uses of "schedule" (such as a recipe's hop schedule, additions schedule, or mash step sequence), updates all coupled test suites, and establishes comprehensive unit/integration test suites for `MashProfileForm.tsx` and `FermentationProfileForm.tsx` from scratch.

### Key Behaviors

1. **Navigation & TopBar Consistency**: `Sidebar.tsx` navigation labels change from `"Mash Schedules"` and `"Fermentation Schedules"` to `"Mash Profiles"` and `"Fermentation Profiles"`. TopBar titles in manager screens change to `"Mash Profiles"` and `"Fermentation Profiles"`.
2. **Manager & Form Copy Standardization**:
   - `MashProfileManager.tsx` and `FermentationProfileManager.tsx`: TopBar titles, "+ New Profile" buttons, empty states ("No mash profiles yet..."), and error titles ("Couldn't load your mash profiles") standardized on "Profile".
   - `MashProfileForm.tsx` and `FermentationProfileForm.tsx`: Form titles ("New Mash Profile", "New Fermentation Profile"), submit buttons ("Save Profile"), field labels ("Profile Name"), step limit warnings ("A profile may have at most 20 steps."), and empty step messages standardized on "Profile".
   - `MashSection.tsx`: Profile selector headers ("Mash Profile", "Fermentation Profile"), empty state hints ("No mash profile attached. Pick one above, or create one from the Mash Profiles manager..."), and step override badges standardized on "Profile".
3. **Deliberate Preservation of Domain Schedules**: Legitimate brewing schedule terms (e.g., `BrewSheet.tsx` "Mash Schedule" / "Fermentation Schedule" step breakdowns, `HopSection.tsx` "Hop Schedule", `BrewDayTracker.tsx` "Additions Schedule", `EquipmentForm.tsx` "Hopstand & Whirlpool Schedule", and all cellar timeline schedules) are strictly preserved.
4. **Net-New Profile Form Test Suites**: Dedicated test suites `apps/web/test/MashProfileForm.test.tsx` and `apps/web/test/FermentationProfileForm.test.tsx` authored from scratch covering create mode, edit mode, step addition/removal/reordering, validation rules, error handling, and API integration.
5. **Coupled Test Reconciliation**: All test files asserting on "Schedule" navigation labels or titles (`TopBar.test.tsx`, `Sidebar.test.tsx`, `MashProfileManager.test.tsx`, `FermentationProfileManager.test.tsx`, `MashSection.test.tsx`, `useRecipeEditor.test.tsx`) updated to assert "Profile".

---

## Resolved Ambiguities (Binding)

- **RA-1 — Scope of "Profile" Standardization**: The word "Schedule" is replaced with "Profile" **only** where it represents a named reusable configuration entity (Mash Profile or Fermentation Profile).
  - Target src files (5): `Sidebar.tsx`, `MashProfileForm.tsx`, `FermentationProfileForm.tsx`, `MashProfileManager.tsx`, `FermentationProfileManager.tsx`, `MashSection.tsx`.
- **RA-2 — Legitimate Domain Brewing Schedules Preserved**:
  - `BrewSheet.tsx`: "Mash Schedule" and "Fermentation Schedule" section headings in the printable sheet denote the chronological mash/fermentation step tables for that batch and remain byte-unchanged.
  - `HopSection.tsx`: "Hop Schedule" and "Timing / Schedule" column headers denote hop addition timings and remain byte-unchanged.
  - `BrewDayTracker.tsx`: "Additions Schedule" denotes timed boil additions and remains byte-unchanged.
  - `EquipmentForm.tsx`: "Hopstand & Whirlpool Schedule" denotes whirlpool timings and remains byte-unchanged.
  - `CellarActionFeed.tsx` / `calculateCellarSchedule`: All cellar schedule functions, types, and event feeds represent time-based cellar actions and remain byte-unchanged.
- **RA-3 — Internal Identifiers & API Routes Unchanged**: All API routes (`/api/mash-profiles`, `/api/fermentation-profiles`), database tables (`mash_profiles`, `fermentation_profiles`), navigation destination keys (`mashProfiles`, `fermentationProfiles`), and shared types (`MashProfile`, `FermentationProfile`) already use "Profile" and remain untouched.
- **RA-4 — Fixture Data Names**: In `apps/web/test/helpers/fixtures.ts`, fixture profile names `'Test Mash Schedule'` and `'Test Fermentation Schedule'` are preserved as data values to prevent cascading fixture breakage across calculation tests.
- **RA-5 — Net-New Test Authoring Standard**: `MashProfileForm.test.tsx` and `FermentationProfileForm.test.tsx` must test:
  1. Create mode: renders TopBar title "New Mash Profile" / "New Fermentation Profile", Save button "Save Profile", empty inputs with default values.
  2. Edit mode: renders TopBar title "Edit <Name>", pre-populates existing fields and step rows.
  3. Validation: blank name prevents save and shows "Name is required"; out-of-bounds target pH / step values disable save or render error text.
  4. Step management: "Add Step" appends step rows up to 20; "Remove step" removes row; step reordering (move up / move down) operates correctly.
  5. Save execution: clicking "Save Profile" submits validated payload to `createMashProfile` / `updateMashProfile` (or fermentation counterparts) and calls `onSaved`.
  6. Cancel execution: clicking cancel calls `onCancel`.
- **RA-6 — Scope Guardrail Baseline**: Pre/post SHA-256 content manifest diff against working tree files.
- **RA-7 — App.test.tsx Added Post-Approval (2026-08-20)**: During `/execute`, the executor found `apps/web/test/App.test.tsx` asserts `'Mash Schedules'` / `'Fermentation Schedules'` / `'New Mash Schedule'` (and related `NAV_LABELS`/`ROUTE_H1` copy) against the same `Sidebar`/`MashProfileManager`/`FermentationProfileManager`/`MashProfileForm` components §1.1 mandates changing — a coupled test file omitted from the original §1.2 inventory. Routed through `/diagnose` (spec-completeness gap, not an implementation bug) and re-approved as a 7th modified test file. Same mechanical "Schedule"→"Profile" substitution as the other 6 modified test files; no new assertions, no scope expansion beyond the copy mapping already defined in §1.1.

---

## 1. Data Schema & Contracts

### 1.1 Copy & Label Mapping Inventory

| File | Component / Context | Before (Schedule) | After (Profile) |
|---|---|---|---|
| `Sidebar.tsx` | Nav destination item label | `'Mash Schedules'` | `'Mash Profiles'` |
| `Sidebar.tsx` | Nav destination item label | `'Fermentation Schedules'` | `'Fermentation Profiles'` |
| `MashProfileManager.tsx` | TopBar title | `<TopBar title="Mash Schedules">` | `<TopBar title="Mash Profiles">` |
| `MashProfileManager.tsx` | New button label | `New Schedule` | `New Profile` |
| `MashProfileManager.tsx` | Error banner heading | `Couldn't load your mash schedules` | `Couldn't load your mash profiles` |
| `MashProfileManager.tsx` | Empty state text | `No mash schedules yet. Create one to describe how you mash.` | `No mash profiles yet. Create one to describe how you mash.` |
| `FermentationProfileManager.tsx` | TopBar title | `<TopBar title="Fermentation Schedules">` | `<TopBar title="Fermentation Profiles">` |
| `FermentationProfileManager.tsx` | New button label | `New Schedule` | `New Profile` |
| `FermentationProfileManager.tsx` | Error banner heading | `Couldn't load your fermentation schedules` | `Couldn't load your fermentation profiles` |
| `FermentationProfileManager.tsx` | Empty state text | `No fermentation schedules yet. Create one to describe how you ferment.` | `No fermentation profiles yet. Create one to describe how you ferment.` |
| `MashProfileForm.tsx` | TopBar title (create) | `'New Mash Schedule'` | `'New Mash Profile'` |
| `MashProfileForm.tsx` | Save button text | `'Save Schedule'` | `'Save Profile'` |
| `MashProfileForm.tsx` | Field label | `Schedule Name` | `Profile Name` |
| `MashProfileForm.tsx` | Step limit error | `A schedule may have at most 20 steps.` | `A profile may have at most 20 steps.` |
| `MashProfileForm.tsx` | Empty steps notice | `No steps yet — a saved schedule with no steps is fine...` | `No steps yet — a saved profile with no steps is fine...` |
| `FermentationProfileForm.tsx` | TopBar title (create) | `'New Fermentation Schedule'` | `'New Fermentation Profile'` |
| `FermentationProfileForm.tsx` | Save button text | `'Save Schedule'` | `'Save Profile'` |
| `FermentationProfileForm.tsx` | Field label | `Schedule Name` | `Profile Name` |
| `FermentationProfileForm.tsx` | Step limit error | `A schedule may have at most 20 steps.` | `A profile may have at most 20 steps.` |
| `FermentationProfileForm.tsx` | Empty steps notice | `No steps yet — a saved schedule with no steps is fine.` | `No steps yet — a saved profile with no steps is fine.` |
| `MashSection.tsx` | Mash section header | `<Thermometer ... /> Mash Schedule` | `<Thermometer ... /> Mash Profile` |
| `MashSection.tsx` | Mash empty hint | `No mash schedule attached. Pick one above, or create one from the Mash Schedules manager...` | `No mash profile attached. Pick one above, or create one from the Mash Profiles manager...` |
| `MashSection.tsx` | Mash no steps notice | `This schedule has no steps yet` | `This profile has no steps yet` |
| `MashSection.tsx` | Sparge source label | `schedule override` | `profile override` |
| `MashSection.tsx` | Water balance note | `This schedule calls for ...` | `This profile calls for ...` |
| `MashSection.tsx` | Ferm section header | `<Snowflake ... /> Fermentation Schedule` | `<Snowflake ... /> Fermentation Profile` |
| `MashSection.tsx` | Ferm empty hint | `No fermentation schedule attached. Pick one above, or create one from the Fermentation Schedules manager.` | `No fermentation profile attached. Pick one above, or create one from the Fermentation Profiles manager.` |
| `MashSection.tsx` | Ferm no steps notice | `This schedule has no steps yet.` | `This profile has no steps yet.` |

### 1.2 Modified vs. Untouched Files

**Modified — Source Files (6):**
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/MashProfileForm.tsx`
- `apps/web/src/components/FermentationProfileForm.tsx`
- `apps/web/src/components/MashProfileManager.tsx`
- `apps/web/src/components/FermentationProfileManager.tsx`
- `apps/web/src/components/MashSection.tsx`

**Modified — Existing Test Files (7):**
- `apps/web/test/Sidebar.test.tsx`
- `apps/web/test/TopBar.test.tsx`
- `apps/web/test/MashProfileManager.test.tsx`
- `apps/web/test/FermentationProfileManager.test.tsx`
- `apps/web/test/MashSection.test.tsx`
- `apps/web/test/useRecipeEditor.test.tsx`
- `apps/web/test/App.test.tsx` *(added post-approval, 2026-08-20 — RA-7: this integration suite asserts `NAV_LABELS`/`ROUTE_H1` copy such as `'Mash Schedules'`, `'Fermentation Schedules'`, `'New Mash Schedule'` against the live `Sidebar`/`MashProfileManager`/`FermentationProfileManager`/`MashProfileForm` components §1.1 changes; it was omitted from the original file inventory. Same mechanical "Schedule"→"Profile" substitution as the other 6 modified test files, no new assertions.)*

**New Test Files (2):**
- `apps/web/test/MashProfileForm.test.tsx`
- `apps/web/test/FermentationProfileForm.test.tsx`

**Explicitly Untouched Files:**
- `apps/web/src/components/BrewSheet.tsx` (preserves "Mash Schedule" & "Fermentation Schedule" step tables)
- `apps/web/src/components/HopSection.tsx` (preserves "Hop Schedule")
- `apps/web/src/components/BrewDayTracker.tsx` (preserves "Additions Schedule")
- `apps/web/src/components/EquipmentForm.tsx` (preserves "Hopstand & Whirlpool Schedule")
- `apps/web/src/components/CellarActionFeed.tsx` (preserves cellar schedule event tracking)
- `apps/web/test/helpers/fixtures.ts` (preserves fixture names)
- `apps/api/**`, `packages/calculations/**`, `packages/shared-types/**`

---

## 2. Transformations & Pure Logic

No API endpoints or domain schemas change. All edits are localized UI label updates and component test suites.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Title | Scope | Expected Outcome |
|---|---|---|---|
| AC-1 | Sidebar Navigation Labels | Component | `Sidebar` renders navigation buttons with accessible names `"Mash Profiles"` and `"Fermentation Profiles"`. Verified in `Sidebar.test.tsx`. |
| AC-2 | Mash Profile Manager Titles & Copy | Component | `MashProfileManager` renders TopBar title `"Mash Profiles"`, button `"New Profile"`, empty state `"No mash profiles yet."`, and error banner `"Couldn't load your mash profiles"`. Verified in `MashProfileManager.test.tsx`. |
| AC-3 | Fermentation Profile Manager Titles & Copy | Component | `FermentationProfileManager` renders TopBar title `"Fermentation Profiles"`, button `"New Profile"`, empty state `"No fermentation profiles yet."`, and error banner `"Couldn't load your fermentation profiles"`. Verified in `FermentationProfileManager.test.tsx`. |
| AC-4 | Mash Profile Form Create Mode | Component | `MashProfileForm` in create mode renders TopBar title `"New Mash Profile"`, button `"Save Profile"`, and label `"Profile Name"`. Verified in `MashProfileForm.test.tsx`. |
| AC-5 | Mash Profile Form Edit Mode | Component | `MashProfileForm` in edit mode renders TopBar title `Edit <Name>`, populates initial profile, and submits payload to `updateMashProfile`. Verified in `MashProfileForm.test.tsx`. |
| AC-6 | Mash Profile Form Validation & Step Management | Component | `MashProfileForm` validates non-empty name, enforces 20 step maximum (`"A profile may have at most 20 steps."`), allows adding/removing/reordering steps, and handles empty steps notice. Verified in `MashProfileForm.test.tsx`. |
| AC-7 | Fermentation Profile Form Create Mode | Component | `FermentationProfileForm` in create mode renders TopBar title `"New Fermentation Profile"`, button `"Save Profile"`, and label `"Profile Name"`. Verified in `FermentationProfileForm.test.tsx`. |
| AC-8 | Fermentation Profile Form Edit Mode | Component | `FermentationProfileForm` in edit mode renders TopBar title `Edit <Name>`, populates initial profile, and submits payload to `updateFermentationProfile`. Verified in `FermentationProfileForm.test.tsx`. |
| AC-9 | Fermentation Profile Form Validation & Step Management | Component | `FermentationProfileForm` validates non-empty name, enforces 20 step maximum, allows adding/removing steps, and handles empty steps notice. Verified in `FermentationProfileForm.test.tsx`. |
| AC-10 | MashSection Profile Copy | Component | `MashSection` renders section headers `"Mash Profile"` and `"Fermentation Profile"`, and empty selector guidance pointing to `"Mash Profiles manager"` and `"Fermentation Profiles manager"`. Verified in `MashSection.test.tsx`. |
| AC-11 | Domain Brewing Schedules Preserved | Source sweep | `"Mash Schedule"` and `"Fermentation Schedule"` preserved in `BrewSheet.tsx`, `"Hop Schedule"` preserved in `HopSection.tsx`, `"Additions Schedule"` preserved in `BrewDayTracker.tsx`, and `"Hopstand & Whirlpool Schedule"` preserved in `EquipmentForm.tsx`. |
| AC-12 | TopBar Navigation Tests Updated | Unit | `TopBar.test.tsx` line 55 asserts nav labels with `"Mash Profiles"` and `"Fermentation Profiles"`. |
| AC-13 | Sibling Suites Pass Cleanly | Verification | All existing tests across `@truchabrew/web`, `@truchabrew/api`, and `@truchabrew/calculations` pass. |
| AC-14 | Scope Guardrail | Verification | SHA-256 manifest diff verifies only authorized 6 source files, 7 modified test files, 2 new test files, `.gsd/STATE.json`, and `.gsd/ROADMAP.md` modified. |
| AC-16 | App.test.tsx Integration Copy Updated (RA-7) | Unit | `App.test.tsx`'s `NAV_LABELS`/`ROUTE_H1` assertions updated to `"Mash Profiles"`, `"Fermentation Profiles"`, `"New Mash Profile"` (and fermentation counterpart) matching §1.1's mapping, with no other assertions changed. |
| AC-15 | Four Layer 1 Gates Clean | Verification | `npm test` (all workspaces), `npm run typecheck`, `npm run build`, and `npm run lint` all exit 0. |

---

## 4. Follow-ups logged, not built

- `FORM_SELECT_CLASS` vs `INPUT_CLASS` styling shape divergence (logged from M24_P1 for Milestone 25).
- Shared accessible Modal component wrapper (scheduled for Milestone 25).

---

> **HALT GATE (STATE 2):** Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution, or provide feedback/adjustments.
