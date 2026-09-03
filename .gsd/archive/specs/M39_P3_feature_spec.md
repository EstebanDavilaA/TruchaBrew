# FEATURE SPECIFICATION: M39_P3 — Water, Mash & Fermentation Profile Form Sectioning

> **Phase scope note (read first):** Milestone 39 (FEAT-005 umbrella) is 3 phases. **P3 is the
> FINAL phase of M39.** P1 shipped the `SectionCard` + `StickyJumpNav` primitives. P2 applied
> `SectionCard` sectioning to the Recipe Editor's four ingredient cards and the six
> EquipmentForm sections — and then, through **Amendment 3 (2026-09-02)**, the user directed
> removal of the `StickyJumpNav` jump-nav **and** its `useSectionScrollSpy` scroll-spy from
> **both** shipped forms (Recipe Editor + EquipmentForm) because the sticky bar read as
> unprofessional in the running app. Only `SectionCard` sectioning was kept.
>
> **This phase (P3) follows the re-scoped direction of M39_P2 Amendment 3.** It applies
> `SectionCard` sectioning (plus `FormField` hint captions) to the three profile forms —
> `WaterProfileForm.tsx`, `MashProfileForm.tsx`, `FermentationProfileForm.tsx`. It does
> **NOT** introduce any `StickyJumpNav` jump-nav or scroll-spy (binding — see Resolved
> Ambiguities). The `StickyJumpNav` primitive remains in `components/ui/` (untouched) for
> possible future reuse, but P3 must not consume it.

## Phase Summary

Complex data-entry forms across the app are being unified onto the shipped `SectionCard`
primitive (P1) so each form reads as a stack of clean, titled, consistently-headed section
cards, with brewing-guidance captions under representative inputs (P2 applied this to the
Recipe Editor + EquipmentForm; the user validated `SectionCard` sectioning while rejecting
the sticky jump-nav).

**P3 (this phase) completes `SectionCard` sectioning across the three *profile* forms** —
the last forms listed in the ROADMAP's M39 scope. Each profile form is a standalone full-page
editor (its own `TopBar` page title + `PageContainer`), hosted by exactly one manager
(`WaterProfileManager`, `MashProfileManager`, `FermentationProfileManager`) that switches
between a list view and the form view.

Today each form hand-rolls `<div className={CARD_CLASS}>` shells with ad-hoc authored
headings (`h3` `SUBSECTION_HEADING_CLASS` card titles in Water; a single untitled card with
an internal `h4` "Steps" region in Mash and Fermentation). P3 replaces those with the shipped
`SectionCard` primitive, giving every profile form a uniform, titled, consistently-leveled
set of section cards and delivering the last "field captions" obligations of the umbrella.

### Key Behaviors
1. **WaterProfileForm** renders two **non-collapsible** `SectionCard`s — *Profile Information*
   and *Ion Concentrations & pH* — each `headingLevel={2}`, replacing the current two
   `CARD_CLASS` cards.
2. **MashProfileForm** renders two **non-collapsible** `SectionCard`s — *Profile Details*
   (name, target pH, sparge override) and *Mash Steps* (Add Step + step rows) — splitting the
   current single untitled `CARD_CLASS` card.
3. **FermentationProfileForm** renders two **non-collapsible** `SectionCard`s — *Profile
   Details* (name) and *Fermentation Steps* — splitting the current single `CARD_CLASS` card.
4. A representative set of profile fields gain **brewing-guidance captions** via `FormField`'s
   existing `hint` prop (new bound copy on four Water fields + Mash target pH; the pre-existing
   Mash sparge/infuse and Fermentation pressure hints are preserved).
5. **No** `StickyJumpNav` jump-nav and **no** scroll-spy is introduced anywhere in this phase,
   consistent with the M39_P2 Amendment 3 pivot. The `StickyJumpNav` primitive and its tests
   remain in place, untouched.

---

## 0. Resolved Ambiguities (Binding)

- **Section taxonomy — stable `id`s and titles (binding).** Six `SectionCard`s total, one per
  logical section across the three forms. `id` is written verbatim by `SectionCard` onto the
  root `<section>`; derived `data-testid`s follow `${id}-section` / `${id}-title` /
  `${id}-panel` (P1 contract). Each id is unique within its own form page (fields use distinct
  prefixes like `water-form-*` / `mash-field-*` / `ferm-*`, so no collision).

  | Form | `id` | `title` | Body content |
  |---|---|---|---|
  | Water | `water-profile-information` | Profile Information | Profile Name, Profile Type, Description |
  | Water | `water-ion-concentrations` | Ion Concentrations & pH | Ca/Mg/Na/Cl/SO₄/HCO₃ grid, Balance Strategy + Apply, pH |
  | Mash | `mash-profile-details` | Profile Details | Profile Name, Target pH, Sparge Temp Override |
  | Mash | `mash-steps` | Mash Steps | Add Step control, cap warning, empty-state, step rows |
  | Fermentation | `fermentation-profile-details` | Profile Details | Profile Name |
  | Fermentation | `fermentation-steps` | Fermentation Steps | Add Step control, cap warning, empty-state, step rows |

  The pre-existing Water card titles *Profile Information* and *Ion Concentrations (ppm /
  mg/L) & pH* are retained (shortened copy optional only in the body sub-labels, never the
  section title). Mash/Fermentation gain their first ever card-level titles (*Profile
  Details*, *Mash Steps* / *Fermentation Steps*).

- **Collapsibility — ALL six sections are NON-COLLAPSIBLE (binding).** None of the six
  `SectionCard`s passes `collapsible`. Binding rationale:
  1. **Validation-gated save (decisive).** Each form disables Save when `hasErrors` is true and
     computes `hasErrors` over *all* step rows and top-level fields regardless of visibility. A
     collapsible card unmounts its body on collapse; a user who collapsed a section containing
     an inline error would see Save stay disabled with the error hidden inside the collapsed
     card — a UX footgun.
  2. **Matches the user-validated adjacent outcome.** EquipmentForm — a bounded profile-adjacent
     editor reviewed and kept by the user through M39_P2 Amendment 3 — is entirely
     non-collapsible. The three profile forms are the same class of short, validation-gated
     editor.
  3. **Bounded length.** Unlike the Recipe Editor's long ingredient tables, none of these forms
     is a long-scroll fatigue case that warrants progressive disclosure.
  The umbrella's "accordion" phrasing is satisfied by the collapsible Recipe Editor ingredient
  cards already delivered in P2; P3's contribution is clean titled sectioning + captions. If
  `/steer` later wants collapsibility on these forms, it is a trivial follow-up on the same
  `SectionCard` axis — but it is deliberately NOT the P3 default.

- **Heading level — `headingLevel={2}` on all six (binding).** Each profile form is a standalone
  page whose `TopBar` renders its page title as an **`h1`** (verified: existing suites assert
  `getByRole('heading', { level: 1 })` for `New Water Profile` / `New Mash Profile` / `New
  Fermentation Profile`, etc.). The `SectionCard`s are therefore the top-level content sections
  beneath that `h1`, so level **2** is the correct outline level. This *fixes* the pre-existing
  outline skip (Water was `h1` → `h3`; Mash/Fermentation `h1` → `h4`) to a clean `h1` → `h2`
  and unifies all three forms on `SectionCard`'s default level. The alternative of `h3` (to
  mirror Water's old authored headings) was considered and rejected because it would perpetuate
  the skip at the exact moment a proper sectioning primitive makes fixing it free. The Mash /
  Fermentation step-row "Step N" markers are non-heading `<span>`s and are unaffected.

- **`SectionCard` body is always mounted (no-match / fallback contract).** Because all six
  sections are non-collapsible, `SectionCard` always renders its `{id}-panel` and `children`
  (P1 non-collapsible contract). No collapse-unmount can occur, so there is **no** path for a
  field, inline error, or empty-state to disappear from the DOM or "leak" into another
  section's state. The zero-step empty-state ("No steps yet — …") remains rendered when
  `steps.length === 0`; the >20-step cap warning still renders at the 21st add attempt; the
  `mash-step-row-N` / `ferm-step-row-N` rows render when steps exist. All content that existed
  before remains mounted after sectioning, in the same order within each card.

- **Section spacing & internal rhythm (binding).** Sibling `SectionCard`s must not touch. Each
  profile `<form>` that renders two cards carries the vertical card-gap utility
  `space-y-6` — Water's `<form>` already has `space-y-6` (keep it); **Mash and Fermentation
  `<form>`s gain `space-y-6`** (mirroring `EquipmentForm`'s `<form className="space-y-6">`).
  The intra-card vertical rhythm the removed `CARD_CLASS` wrappers previously supplied is
  preserved: for Water, each `SectionCard`'s children are placed inside a single inner
  container carrying the wrapper's former `space-y-4`; Mash / Fermentation already rely on
  element-level `mb-*` margins on their fields so no extra inner wrapper spacing is required
  (the executor must not *drop* those `mb-*` margins). No content is removed, reordered, or
  restyled beyond the shell change.

- **`data-testid` preservation (binding).** Field-level testids are the contract existing
  tests rely on and must be preserved verbatim: `water-form-name`, `water-form-type`,
  `water-form-description`, `water-form-ca`, `water-form-mg`, `water-form-na`,
  `water-form-cl`, `water-form-so4`, `water-form-hco3`, `water-form-ph`,
  `water-form-strategy`, `water-form-apply-strategy`, `water-delete`;
  `mash-field-name`, `mash-field-ph`, `mash-field-sparge`, `mash-delete`, `mash-step-row-N`;
  `fermentation-delete` and the `ferm-step-row-N` rows (Fermentation's name field has no
  testid — it is found by its label `/profile name/i`, which is preserved). Existing suites
  query these and by role/label/text — none query the removed `CARD_CLASS` shells, none query
  the section titles by exact text, and none query `getByRole('heading')` below level 1
  (verified by inspection). **Expected outcome: all six existing form/manager suites pass
  with no assertion changes.** Reconciliation authorization is limited to *assertion-level*
  fixes if a stray structural assertion is discovered — never removal or weakening of a
  behavior assertion (mirroring M39_P2).

- **No jump-nav / no scroll-spy (binding).** Consistent with M39_P2 Amendment 3, P3 introduces
  **no** `StickyJumpNav` render and **no** `useSectionScrollSpy` (or any scroll-spy hook). The
  three source files must not import `StickyJumpNav` or any scroll-spy hook, must render no
  `data-testid="jump-nav"`, and no new hook file is created. The retained `StickyJumpNav.tsx` +
  `StickyJumpNav.test.tsx` and `SectionCard.tsx` + tests are **untouched** this phase.

- **Caption mechanism — `FormField`'s existing `hint` prop only (no new primitive).**
  `FormField` already exposes `hint?: string`, rendered as a `METADATA_TEXT_CLASS` caption under
  the field when no error is shown. P3 adds caption copy via `hint` on a **representative,
  bound subset** (exact strings in §1). `FormField.tsx`, `SectionCard.tsx`, `StickyJumpNav.tsx`,
  `designSystem.ts` and `designSystem.test.ts` are untouched.

- **No `sectionId` optional prop on any profile form (binding).** Each of the three profile
  forms has exactly **one** host — its own manager (`WaterProfileManager`,
  `MashProfileManager`, `FermentationProfileManager`; verified: each `*Form.tsx` is imported by
  exactly one manager). Unlike P2's four ingredient components (reused by
  `BatchRecipeAdjustModal.tsx`), there is no second consumer, so no `sectionId` prop and no new
  public type is introduced. Existing prop unions (create/edit variants, `onSaved`, `onCancel`,
  `deleteAction`, `onOpenMobileNav`) are preserved unchanged.

- **Removed authored headings (refactoring / legacy cleanup).** Water's two
  `<h3 className={SUBSECTION_HEADING_CLASS}>` card titles are replaced by the `SectionCard`
  titles (the `SUBSECTION_HEADING_CLASS` import becomes unused in `WaterProfileForm.tsx` and is
  removed). Mash/Fermentation's single `CARD_CLASS` wrappers are replaced by two `SectionCard`s
  each; their `CARD_CLASS` import becomes unused and is removed. The inline "Steps (N)" `h4` in
  Mash/Fermentation is removed; its count is surfaced as the `SectionCard` **`badge`** ("N
  steps", singular "1 step"). Verified: no existing test pins the literal "Steps (N)" text or
  the `h4` — only the step rows and the "no steps yet" empty-state text, both preserved. The
  "Add Step" button (queried by tests as `getByRole('button', { name: /add step/i })`) moves
  into the (always-mounted) `mash-steps` / `fermentation-steps` card body top-right; its
  accessible name is unchanged. Any token import that becomes unused (Water `CARD_CLASS`,
  `SUBSECTION_HEADING_CLASS`; Mash/Ferm `CARD_CLASS`) is removed so `lint`/`typecheck` stay
  clean (no unused-import errors). Tokens still used (Water `INPUT_CLASS`; Mash/Ferm
  `METADATA_TEXT_CLASS`, `SUBPANEL_CLASS`) are retained. `designSystem.ts` itself is never
  edited.

---

## 1. Data Schema & Contracts

### Exported constants / types

- **None added.** No new exported constant, interface, prop, or type is introduced by this
  phase. The three profile forms keep their existing exported components and exact prop unions.
  `SectionCard` (already exported from `components/ui`) is consumed as-is; `ui/index.ts` is
  **not** edited (it already re-exports `SectionCard`).

### Caption copy — bound exact strings (binding)

These exact strings must render via `FormField`'s `hint` on the named fields (they appear when
that field has no error; `FormField` handles suppression). The executor **must** include every
bound string verbatim and **may** add further non-trivial guidance hints beyond this set (never
omit a bound one). Existing hints listed under "Preserve" must remain byte-identical.

**Add — WaterProfileForm (`WaterProfileForm.tsx`):**
| Field (`htmlFor`) | `hint` (exact) |
|---|---|
| Calcium (`water-form-ca`) | `Calcium supports yeast health and mash enzyme activity — typical target 40–120 ppm.` |
| Chloride (`water-form-cl`) | `Chloride rounds the body and enhances malt sweetness; a higher Cl:SO₄ ratio softens hop bite.` |
| Sulfate (`water-form-so4`) | `Sulfate dries the finish and accentuates hop bitterness; a higher SO₄:Cl ratio sharpens hops.` |
| pH (`water-form-ph`) | `Leave blank to inherit; for a balanced mash aim near pH 5.2–5.6.` |

**Add — MashProfileForm (`MashProfileForm.tsx`):**
| Field (`htmlFor`) | `hint` (exact) |
|---|---|
| Target pH (`mash-field-ph`) | `Typical mash target 5.2–5.6 at room temperature for clean conversion.` |

**Preserve (must remain unchanged, do not duplicate/reword):**
- Mash Sparge Temp Override: `Blank means inherit the equipment profile's sparge temperature.`
- Mash per-step Infuse Amount: `Blank = computed`
- Fermentation per-step Pressure: `Blank = not pressurised`

### Symbol inventory

**MODIFIED source files (only edits listed here; authorized):**
| File | Edit |
|------|------|
| `apps/web/src/components/WaterProfileForm.tsx` | Wrap the two existing `CARD_CLASS` cards as `SectionCard id="water-profile-information"` and `SectionCard id="water-ion-concentrations"` (both non-collapsible, `headingLevel={2}`); add the four bound `hint` captions; remove the now-unused `CARD_CLASS` / `SUBSECTION_HEADING_CLASS` imports (keep `INPUT_CLASS`); preserve internal `space-y-4` rhythm inside each card's children; keep `<form className="space-y-6">`. Import `SectionCard` from `./ui`. |
| `apps/web/src/components/MashProfileForm.tsx` | Split the single `CARD_CLASS` card into `SectionCard id="mash-profile-details"` (name, target pH, sparge) and `SectionCard id="mash-steps"` (badge = step count; body = Add Step + step rows); both non-collapsible, `headingLevel={2}`; add the bound Target-pH hint; move "Add Step" into the `mash-steps` body top-right; remove the inline "Steps (N)" `h4`; add `space-y-6` to the `<form>`; remove the now-unused `CARD_CLASS` import (keep `METADATA_TEXT_CLASS`, `SUBPANEL_CLASS`). Import `SectionCard` from `./ui`. |
| `apps/web/src/components/FermentationProfileForm.tsx` | Split the single `CARD_CLASS` card into `SectionCard id="fermentation-profile-details"` (name) and `SectionCard id="fermentation-steps"` (badge = step count; body = Add Step + step rows); both non-collapsible, `headingLevel={2}`; add `space-y-6` to the `<form>`; remove the now-unused `CARD_CLASS` import (keep `METADATA_TEXT_CLASS`, `SUBPANEL_CLASS`). Import `SectionCard` from `./ui`. |

**NEW test file (authorized to be created):**
| File | Role |
|------|------|
| `apps/web/test/M39_P3_ProfileFormSectioning.test.tsx` | NEW suite pinning all six `SectionCard`s, non-collapsible contract, `headingLevel={2}`, bound caption copy, spacing, cap/empty-state retention, and the no-jump-nav guarantee across the three forms. |

**Authorized-for-reconciliation ONLY (expected: no changes required; assertion-level fixes only, never behavior weakening):**
`apps/web/test/WaterProfileForm.test.tsx`, `apps/web/test/MashProfileForm.test.tsx`,
`apps/web/test/FermentationProfileForm.test.tsx`, `apps/web/test/WaterProfileManager.test.tsx`,
`apps/web/test/MashProfileManager.test.tsx`, `apps/web/test/FermentationProfileManager.test.tsx`.

**UNTOUCHED (explicit):** every other file. In particular `components/ui/index.ts`,
`SectionCard.tsx`, `StickyJumpNav.tsx` (+ their tests), `FormField.tsx`, `designSystem.ts` /
`designSystem.test.ts`, all three managers (`WaterProfileManager.tsx`,
`MashProfileManager.tsx`, `FermentationProfileManager.tsx`), `App.tsx`, every non-`ui`
component, and every `apps/api/*`, `packages/*`, `.gsd/*` file.

---

## 2. Transformations & Pure Logic

### Pure logic
- **None required.** Sectioning is purely presentational markup restructuring on already-stateful
  forms. There is no new pure function, arithmetic, or data transformation in this phase; all
  existing validation and payload-building logic is untouched and unchanged.

### Stateful integration contract
- **Collapse-state owner:** N/A — every `SectionCard` is rendered **non-collapsible**, so no
  card owns disclosure state (`collapsible`/`open`/`defaultOpen`/`onToggle` are not exercised;
  body is always mounted). This is what guarantees no field/error/empty-state can unmount and
  no Save-blocking error can hide.
- **Step-count badge (stateful, derived at render):** the `mash-steps` and
  `fermentation-steps` `SectionCard`s pass a `badge` equal to the live step count —
  `${steps.length} step${steps.length === 1 ? '' : 's'}` — recomputed each render from the same
  `steps` state that drives the rows. When `steps.length === 0` the badge reads `0 steps`.
- **Field values & validation (unchanged):** the existing controlled state per field, the
  per-step `errors` maps, `hasErrors`, the Add/Remove/Move-step handlers, and the `handleSubmit`
  payload builders are byte-for-byte unchanged in behavior; sectioning only changes the DOM
  shell each field/row lives in. Balance-strategy `Apply` (Water) still writes computed
  Cl/SO₄ into the ion fields.
- **No-match / fallback (unchanged, preserved by always-mounted panels):** the zero-step
  empty-state, the `>20`-step cap warning, the null-infuse / null-pressure "blank = computed /
  not pressurised" handling, and validation-error rendering all behave exactly as before and
  are never hidden by collapse.

### Refactoring / legacy cleanup (binding)
- Remove the inline "Steps (N)" `h4` header in Mash/Fermentation (its count moves to the
  `SectionCard` `badge`); verified no test pins that text.
- Remove now-unused design-token imports from the three forms (`CARD_CLASS` in all three;
  `SUBSECTION_HEADING_CLASS` in Water) so `lint`/`typecheck` report no unused imports; retain
  still-used tokens. **Do not** edit `designSystem.ts`.
- No obsolete registration loops, alias maps, or side effects exist in these forms to purge;
  the only legacy shell removed is the hand-rolled `CARD_CLASS` wrappers / authored headings
  replaced by `SectionCard`.

---

## 3. Acceptance Criteria & Test Matrix

Baseline (M39_P2 close, Layer 1 green): **2,646 passed / 2 skipped across 134 files** (web +
api + calculations). All new ACs below are web (`apps/web`) tests unless noted. Test convention:
`@testing-library/react` (`render`, `screen`, `within`, `fireEvent`, `waitFor`) + `vitest`,
matching the existing per-form suites and the P2 sectioning suites. Mock `../api/client` as the
existing suites do (they already mock `create/update<Profile>`).

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | WaterProfileForm renders two SectionCards with correct root ids/testids | Unit | `getByTestId('water-profile-information-section')` and `getByTestId('water-ion-concentrations-section')` present; each root `<section>` has DOM `id` equal to the `id` (`water-profile-information`, `water-ion-concentrations`) |
| AC-2 | Water titles visible at the right heading | Unit | `getByTestId('water-profile-information-title')` and `getByTestId('water-ion-concentrations-title')` present with accessible names `Profile Information` and `Ion Concentrations & pH` |
| AC-3 | MashProfileForm renders two SectionCards | Unit | `mash-profile-details-section` and `mash-steps-section` present with root ids `mash-profile-details`, `mash-steps` |
| AC-4 | Mash titles visible | Unit | `mash-profile-details-title` = `Profile Details`, `mash-steps-title` = `Mash Steps` |
| AC-5 | FermentationProfileForm renders two SectionCards | Unit | `fermentation-profile-details-section` and `fermentation-steps-section` present with root ids `fermentation-profile-details`, `fermentation-steps` |
| AC-6 | Fermentation titles visible | Unit | `fermentation-profile-details-title` = `Profile Details`, `fermentation-steps-title` = `Fermentation Steps` |
| AC-7 | All six sections NON-collapsible | Unit | for each of the six ids: `queryByTestId('{id}-toggle')` is null AND `getByTestId('{id}-title')` is present (non-collapsible variant) |
| AC-8 | All six section titles are `h2` | Unit | for each of the six `{id}-title` elements, `tagName === 'H2'` |
| AC-9 | All six panels always mounted | Unit | for each of the six ids, `getByTestId('{id}-panel')` exists and contains the section's content on first render |
| AC-10 | Water field testids preserved & functional | Unit | `water-form-name`, `water-form-type`, `water-form-ca`, `water-form-cl`, `water-form-so4`, `water-form-ph`, `water-form-strategy`, `water-form-apply-strategy` all present; editing `water-form-name` reflects in the input value |
| AC-11 | Mash field/step testids preserved | Unit | `mash-field-name`, `mash-field-ph`, `mash-field-sparge` present; click `Add Step` ⇒ `mash-step-row-0` present |
| AC-12 | Fermentation name + step rows preserved | Unit | name found via `getByLabelText(/profile name/i)`; click `Add Step` ⇒ `ferm-step-row-0` present |
| AC-13 | Mash/Ferm step CRUD intact | Integration | existing behaviors pass: Add appends up to 20 rows (no `*-step-row-20`), Remove and Move-up/Move-down reorder rows correctly (reuse the existing `MashProfileForm`/`FermentationProfileForm` suites, unmodified) |
| AC-14 | Sibling card separation | Unit | in each form render, the two SectionCard root `<section>`s are siblings under the same `<form>`, and the `<form>` carries `space-y-6` (Water already does; Mash/Fermentation gained it) |
| AC-15 | Empty-state + cap retention | Unit | with zero steps the `no steps yet` text renders inside the steps card; after 20 Add clicks `{form}-step-row-20` is absent and the cap warning (`at most 20 steps`) renders |
| AC-16 | Water Calcium caption exact | Unit | `screen.getByText('Calcium supports yeast health and mash enzyme activity — typical target 40–120 ppm.')` present in the ions card |
| AC-17 | Water Chloride caption exact | Unit | `screen.getByText('Chloride rounds the body and enhances malt sweetness; a higher Cl:SO₄ ratio softens hop bite.')` present |
| AC-18 | Water Sulfate caption exact | Unit | `screen.getByText('Sulfate dries the finish and accentuates hop bitterness; a higher SO₄:Cl ratio sharpens hops.')` present |
| AC-19 | Water pH caption exact | Unit | `screen.getByText('Leave blank to inherit; for a balanced mash aim near pH 5.2–5.6.')` present |
| AC-20 | Mash Target pH caption exact | Unit | `screen.getByText('Typical mash target 5.2–5.6 at room temperature for clean conversion.')` present |
| AC-21 | Pre-existing hints preserved byte-identical | Unit | Mash sparge (`Blank means inherit the equipment profile's sparge temperature.`), Mash infuse (`Blank = computed`), and Fermentation pressure (`Blank = not pressurised`) hints still present |
| AC-22 | Hints are captions, suppressed on error | Unit | a hint's text node is a `METADATA_TEXT_CLASS`-styled span; entering an error value on that field removes the hint and shows the error (FormField semantics) — e.g. invalid Mash Target pH suppresses its caption |
| AC-23 | No jump-nav introduced (pivot) | Unit/Verification | rendering each of the three forms yields `queryByTestId('jump-nav') === null`; grep of the three source files shows **no** import or usage of `StickyJumpNav` and **no** import/usage of `useSectionScrollSpy` (or any scroll-spy hook) |
| AC-24 | No new hook/source files | Verification | no new file is created outside the authorized set — specifically no `useSectionScrollSpy.ts` or any new `components/` file; only the three forms are modified + the one new test file is added |
| AC-25 | Primitive-only consumption | Verification | all six SectionCards are rendered via `SectionCard` imported from `'./ui'`; `ui/index.ts` is unchanged (byte-identical) |
| AC-26 | No new design tokens / primitives | Verification | `designSystem.ts` and `designSystem.test.ts` byte-unchanged; no new file added under `components/ui/` |
| AC-27 | No new public props/types on the three forms | Verification | each form's exported component and prop-union type is unchanged in shape (create/edit variants, `onSaved`/`onCancel`/`deleteAction`/`onOpenMobileNav`); no `sectionId` or similar prop added |
| AC-28 | Clean heading outline per form | Unit | each form renders exactly one `h1` (TopBar title) and its two `h2` SectionCard titles; no `<h1>`–`<h6>` element exists inside any SectionCard body |
| AC-29 | No reconciliation required | Gate | `WaterProfileForm.test.tsx`, `MashProfileForm.test.tsx`, `FermentationProfileForm.test.tsx`, and the three manager suites pass **with no assertion changes** (if a stray structural assertion is found, only an assertion-level fix is permitted — never behavior weakening/removal) |
| AC-30 | Water save + validation regression | Integration | create/edit save calls mocked `createWaterProfile`/`updateWaterProfile` with the correct payload; name-required, non-negative-ions, and pH 0–14 validation errors render; balance-strategy Apply updates Cl/SO₄ (existing `WaterProfileForm.test.tsx` passes) |
| AC-31 | Mash save + validation regression | Integration | create/edit save round-trips name/pH/sparge and step rows into the payload; validation gates Save via `hasErrors` (existing `MashProfileForm.test.tsx` passes) |
| AC-32 | Fermentation save + validation regression | Integration | create/edit save round-trips name and step rows into the payload; validation gates Save (existing `FermentationProfileForm.test.tsx` passes) |
| AC-33 | Field a11y labels preserved | Unit | M31_P4-style sweep passes: every `input`/`select`/`textarea` in each form resolves to a non-empty accessible name (label association preserved) |
| AC-34 | No control loss on sectioning | Unit | for each form, the count of `input`/`select`/`textarea` elements after sectioning equals the baseline count (Water: name/type/description/ca/mg/na/cl/so4/hco3/ph/strategy = 11 controls; Mash: name/ph/sparge + 7/step × N; Fermentation: name + 6/step × N) — no control dropped by the wrapper change |
| AC-35 | Layer 1 — tests grow past baseline | Gate | full `npm test` passes with **passed count strictly > 2,646**, 2 skipped, exit 0 (web + api + calculations) |
| AC-36 | Layer 1 — typecheck/build/lint | Gate | `npm run typecheck` (typecheck-all) exits 0; web `build` exits 0; `lint` exits 0 with **0 errors** and no *new* warnings (only the same pre-existing warnings) |
| AC-37 | Scope guardrail — authorized-file manifest | Verification | See method below |

### Scope Guardrail AC (AC-37) — method

**`git diff --name-only` against a meaningful base commit is NOT viable in this repo.**
Verified: the repo has only **6 commits** on `master` (last substantive commit is `M37_P2`), and
the working tree already carries large uncommitted modifications (the framework `.agents/`,
`.claude/`, `.gsd/` files are modified and unstaged). There is no committed baseline covering the
M39 work, so a `git diff` against any single commit cannot isolate "what the executor changed."
Therefore the guardrail is a **pre/post-execution SHA-256 content-manifest diff** (the same
method M39_P1 / M39_P2 used):

1. **Before the executor's first edit**, capture the full tracked+untracked content manifest:
   `git ls-files -co --exclude-standard -z | xargs -0 sha256sum | sort > /tmp/m39p3_manifest_before.txt`
2. **After the executor's final edit**, capture:
   `git ls-files -co --exclude-standard -z | xargs -0 sha256sum | sort > /tmp/m39p3_manifest_after.txt`
3. **Diff the two manifests**: `diff /tmp/m39p3_manifest_before.txt /tmp/m39p3_manifest_after.txt`.

**AC-37 (pass criterion):** the after-manifest differs from the before-manifest **only** for
paths whose hash changed or that appear only in the after set, and the complete set of
added/changed paths is a subset of the authorized files:

`apps/web/src/components/WaterProfileForm.tsx`,
`apps/web/src/components/MashProfileForm.tsx`,
`apps/web/src/components/FermentationProfileForm.tsx`,
`apps/web/test/M39_P3_ProfileFormSectioning.test.tsx`,
plus, **only if** a stray structural assertion required an assertion-level fix:
any of `apps/web/test/WaterProfileForm.test.tsx`, `apps/web/test/MashProfileForm.test.tsx`,
`apps/web/test/FermentationProfileForm.test.tsx`, `apps/web/test/WaterProfileManager.test.tsx`,
`apps/web/test/MashProfileManager.test.tsx`,
`apps/web/test/FermentationProfileManager.test.tsx`.

(The three modified source files appear in both manifests with changed hashes; the new test file
appears only in the after set.) **Any** changed hash outside this authorized set — in particular
`ui/index.ts`, `SectionCard.tsx`, `StickyJumpNav.tsx`, `FormField.tsx`, `designSystem.ts`,
`designSystem.test.ts`, all managers, `App.tsx`, all other components, `apps/api/*`,
`packages/*`, `.gsd/*` — **fails AC-37**. The executor must not write the manifest files inside
the repo tree (they are capture artifacts under `/tmp/`, as written above).

---

## FEAT-005 status ruling

**Recommendation: advance FEAT-005 from `IN_PLANNING` to a *partially-delivered / in-progress*
status that reflects substantial multi-form delivery while keeping the umbrella OPEN — do NOT
close it.** (The orchestrator owns the actual `.gsd/FEATURES.md` status-token edit and the exact
token wording.)

Rationale:
- **Delivered by M39 (this milestone, closing at P3):** `SectionCard` sectioning now covers the
  Recipe Editor's four ingredient cards (P2), all six EquipmentForm sections (P2), and — after
  P3 — the Water, Mash, and Fermentation profile forms. Field captions are delivered on
  EquipmentForm (P2) and, via this phase's bound hint copy, on Water + Mash (plus the preserved
  Mash/Fermentation step-row hints). This is a large, user-visible share of FEAT-005's scope and
  is the natural moment (the P1 ruling named "P2 or P3") to move FEAT-005 off `IN_PLANNING`.
- **Not yet delivered (keeps the umbrella OPEN):** the FEAT-005 detail still lists **Settings**
  (`SettingsManager.tsx`, *Units & Display* / *Formulas & Calculations*) as outstanding form
  coverage, and Settings is **not** part of any M39 phase — no milestone currently on the
  ROADMAP schedules it (M40+ are the unrelated Desktop & Mobile Deployment milestone). In
  addition, the umbrella's "sticky jump-nav" element was **removed by user decision** in M39_P2
  Amendment 3, so the remaining conceptual scope is the Settings surface (plus any optional
  collapsibility follow-ups on the profile forms, which P3 deliberately did not add).
- Closing FEAT-005 at M39 close would misrepresent delivery; leaving it `IN_PLANNING` after
  three shipped phases understates it. The honest status is partial delivery with Settings as
  the named remaining surface. P3 itself makes **no** `.gsd/FEATURES.md` edit.

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature
> specification. Reply with **SPEC_APPROVED** to begin execution, or provide
> feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS
> RECEIVED.
