# Feature Specification: Milestone 13 Phase 2 (M13_P2: Settings Screen Layout Cohesion & Form Header Design System Harmonization)

## 1. Executive Summary & Context

Milestone 13 Phase 2 (M13_P2) completes the visual and architectural cohesion of TruchaBrew's user interface, resolving backlog feature request `FEAT-004` (Settings screen layout cohesion) and closing the residual design-system token harmonization gaps flagged in M13_P1 §3.4.6 across secondary panels and manager form headers:

1. **Settings Screen Layout Cohesion (`FEAT-004`)**:
   - Replaces the 5 disjointed floating cards in `SettingsManager.tsx` with two unified, sectioned list container cards (`CARD_CLASS`) structured under clear section headings:
     - **Units & Display**: Unit System (Metric, US Customary, Imperial), Gravity Display (SG, Plato), Temperature (Celsius, Fahrenheit).
     - **Formulas & Calculations**: IBU Formula (Tinseth, Rager, Garetz approximation), ABV Formula (Simple, Balling).
   - Standardizes setting rows using hairline dividers (`divide-y divide-slate-800`), aligning setting titles and explanatory captions on the left with interactive controls on the right, matching the visual language and density of `ListRow.tsx` and manager views.
   - Retains 100% contract compatibility with `ConfigContext`, `useConfig()`, and backend `GET/PUT /api/config` routes, preserving optimistic updates, error alerts, and the Garetz approximation disclosure.

2. **Form Header & Subpanel Design System Harmonization (§3.4.6 residual gaps)**:
   - Extends `designSystem.ts` with standardized form select/input classes and settings row tokens (`FORM_SELECT_CLASS`, `SETTINGS_ROW_CLASS`).
   - Harmonizes section header typography across the entity forms, per-file, against the tokens M13_P1 already shipped (this amendment **consumes** `SECTION_HEADING_CLASS` / `SUBSECTION_HEADING_CLASS`; it does not redefine either value — their current values are load-bearing for M13_P1's already-verified `BatchDetail` usage):
     - `EquipmentForm.tsx` — 4 headings currently on a third, undocumented pattern (`text-sm font-bold text-slate-100 uppercase tracking-wide`) collapse onto `SECTION_HEADING_CLASS`. This is a **visible** typography change (see D-1).
     - `InventoryForm.tsx`, `WaterProfileForm.tsx` — 2 headings each already match `SUBSECTION_HEADING_CLASS` character-for-character; the literal strings are replaced by an import of the constant. **Zero visual change**; the point is drift protection (see D-3).
     - `MashProfileForm.tsx`, `FermentationProfileForm.tsx` — **no change.** Neither file has a section heading; their only heading-like element is an inline `Steps (n)` control label, which is out of scope (see D-2).
   - Harmonizes residual `rounded-lg` subpanels in `WaterSection.tsx`, `ReadingLog.tsx`, and `BatchNoteLog.tsx` to use `CARD_CLASS` / `SUBPANEL_CLASS` tokens from `designSystem.ts`.

---

## 2. File Organization & Boundaries

### 2.1 Modified Files
- `apps/web/src/components/SettingsManager.tsx`: Refactor from 5 isolated cards into 2 grouped section container cards (`Units & Display`, `Formulas & Calculations`) with `divide-y divide-slate-800` rows, adopting `designSystem.ts` tokens (`CARD_CLASS`, `SECTION_HEADING_CLASS`, `BODY_TEXT_CLASS`, `METADATA_TEXT_CLASS`, `LOADING_STATE_CLASS`, `ERROR_STATE_CLASS`).
- `apps/web/src/components/designSystem.ts`: Add frozen constants `FORM_SELECT_CLASS` and `SETTINGS_ROW_CLASS` for standardized form control and settings row styling.
- `apps/web/src/components/EquipmentForm.tsx`: **Current state (verified):** 4 headings at lines ~493, ~520, ~580, ~592, all `<h4 className="text-sm font-bold text-slate-100 uppercase tracking-wide">` (the line ~592 instance additionally carries `mb-3`). Each is the top-level heading of a card whose wrapper is the literal `bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg` (== `CARD_CLASS`), i.e. structurally the same role `SECTION_HEADING_CLASS` fills in `BatchDetail`. **Target:** import `SECTION_HEADING_CLASS` from `./designSystem` and apply it to all 4; the line ~592 instance keeps its trailing `mb-3` appended after the token (`` `${SECTION_HEADING_CLASS} mb-3` ``). The `uppercase tracking-wide` treatment is dropped. Heading element tags stay `<h4>` (D-4). The 3 icon-bearing headings keep their existing outer `flex items-center gap-2` wrapper `<div>` unchanged — the token's own `flex items-center gap-2` is inert on a text-only heading and is not a reason to restructure the markup.
- `apps/web/src/components/MashProfileForm.tsx`: **Current state (verified):** no section heading exists. The only heading-like element is line ~294, `<h4 className="text-sm font-semibold text-slate-200">Steps ({steps.length})</h4>`, an inline label sitting in a `flex items-center justify-between` row opposite the "Add Step" button. **Target: no change** — this is a control-row label, not a section heading (D-2). File is not modified by this phase.
- `apps/web/src/components/InventoryForm.tsx`: **Current state (verified):** 2 headings at lines ~339 and ~454, both `<h3 className="text-base font-bold text-white mb-2">` — a character-for-character match for the existing `SUBSECTION_HEADING_CLASS`. **Target:** import `SUBSECTION_HEADING_CLASS` and reference it in place of both literal strings. **Rendered output is byte-identical; zero visual change** (D-3). No other styling in the file (including the card wrappers' `p-6 space-y-4`) is touched.
- `apps/web/src/components/WaterProfileForm.tsx`: **Current state (verified):** 2 headings at lines ~183 and ~224, both `<h3 className="text-base font-bold text-white mb-2">` — again an exact match for `SUBSECTION_HEADING_CLASS`. **Target:** identical treatment to `InventoryForm.tsx` — import the constant, replace both literals, zero visual change (D-3).
- `apps/web/src/components/FermentationProfileForm.tsx`: **Current state (verified):** no section heading exists; only line ~247, `<h4 className="text-sm font-semibold text-slate-200">Steps ({steps.length})</h4>`, structurally identical to `MashProfileForm.tsx`'s. **Target: no change** (D-2). File is not modified by this phase.
- `apps/web/src/components/WaterSection.tsx`: Harmonize residual `rounded-lg` cards/subpanels with `SUBPANEL_CLASS` / `CARD_CLASS`.
- `apps/web/src/components/ReadingLog.tsx`: Harmonize container card styling with `CARD_CLASS`.
- `apps/web/src/components/BatchNoteLog.tsx`: Harmonize container card styling with `CARD_CLASS`.
- `apps/web/test/designSystem.test.ts`: Expand assertions to cover new frozen tokens (`FORM_SELECT_CLASS`, `SETTINGS_ROW_CLASS`).

### 2.2 New Files
- `apps/web/test/SettingsManager.test.tsx`: Dedicated comprehensive component tests for `SettingsManager` verifying section groupings, testids, live select changes, optimistic updates, and error states.

### 2.3 Untouched Files (Protected)
- `packages/calculations/` (All calculation engines untouched).
- `packages/shared-types/` (All shared types and models untouched).
- `apps/api/` (All backend routes, repositories, database schemas, and controllers untouched).
- `.gsd/archive/` (Append-only).

---

## 3. Data Schema & Component Contracts

### 3.1 Design System Extensions (`apps/web/src/components/designSystem.ts`)

```typescript
// Additive constants in designSystem.ts
export const FORM_SELECT_CLASS =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-medium disabled:opacity-50 cursor-pointer';

export const SETTINGS_ROW_CLASS =
  'py-3.5 px-4 flex items-center justify-between gap-4';
```

### 3.2 Settings View Hierarchy (`apps/web/src/components/SettingsManager.tsx`)

#### Structural Layout
```tsx
<PageContainer>
  <div className="flex flex-col gap-6 max-w-2xl">
    {/* Section 1: Units & Display */}
    <div className={CARD_CLASS} data-testid="settings-section-units">
      <div className="flex items-center gap-2 mb-4">
        <Sliders className="w-5 h-5 text-amber-500" />
        <h2 className={SECTION_HEADING_CLASS}>Units & Display</h2>
      </div>
      <div className="divide-y divide-slate-800">
        {/* Unit System Row */}
        <div className={SETTINGS_ROW_CLASS}>
          <div>
            <div className="text-sm font-semibold text-slate-200">Unit System</div>
            <div className={METADATA_TEXT_CLASS}>Default measurement system for recipes and inventory</div>
          </div>
          <select data-testid="settings-select-unitSystem" className={FORM_SELECT_CLASS} ... />
        </div>

        {/* Gravity Display Row */}
        <div className={SETTINGS_ROW_CLASS}>
          <div>
            <div className="text-sm font-semibold text-slate-200">Gravity Display</div>
            <div className={METADATA_TEXT_CLASS}>Specific Gravity (1.050) vs Degrees Plato (°P)</div>
          </div>
          <select data-testid="settings-select-gravityUnit" className={FORM_SELECT_CLASS} ... />
        </div>

        {/* Temperature Row */}
        <div className={SETTINGS_ROW_CLASS}>
          <div>
            <div className="text-sm font-semibold text-slate-200">Temperature</div>
            <div className={METADATA_TEXT_CLASS}>Temperature scale used across mash and fermentation</div>
          </div>
          <select data-testid="settings-select-temperatureUnit" className={FORM_SELECT_CLASS} ... />
        </div>
      </div>
    </div>

    {/* Section 2: Formulas & Calculations */}
    <div className={CARD_CLASS} data-testid="settings-section-formulas">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-amber-500" />
        <h2 className={SECTION_HEADING_CLASS}>Formulas & Calculations</h2>
      </div>
      <div className="divide-y divide-slate-800">
        {/* IBU Formula Row */}
        <div className={SETTINGS_ROW_CLASS}>
          <div>
            <div className="text-sm font-semibold text-slate-200">IBU Formula</div>
            <div className={METADATA_TEXT_CLASS}>Hop bitterness calculation model</div>
          </div>
          <select data-testid="settings-select-ibuFormula" className={FORM_SELECT_CLASS} ... />
        </div>

        {/* ABV Formula Row */}
        <div className={SETTINGS_ROW_CLASS}>
          <div>
            <div className="text-sm font-semibold text-slate-200">ABV Formula</div>
            <div className={METADATA_TEXT_CLASS}>Alcohol by volume estimation formula</div>
          </div>
          <select data-testid="settings-select-abvFormula" className={FORM_SELECT_CLASS} ... />
        </div>
      </div>

      {/* Conditional Garetz Note */}
      {config.ibuFormula === 'garetz' && (
        <div data-testid="garetz-approximation-note" className="mt-4 text-xs text-amber-300 bg-amber-950/30 border border-amber-900 rounded-lg px-4 py-3 flex items-start gap-2">
          ...
        </div>
      )}
    </div>
  </div>
</PageContainer>
```

---

## 4. Acceptance Criteria Matrix

| ID | Category | Requirement / Behavior | Verification Method |
|---|---|---|---|
| **AC-1** | Settings Layout | `SettingsManager.tsx` renders two distinct section cards (`settings-section-units` and `settings-section-formulas`) applying `CARD_CLASS`. | `SettingsManager.test.tsx` query by testid asserting classes. |
| **AC-2** | Units Section | `settings-section-units` contains `settings-select-unitSystem`, `settings-select-gravityUnit`, and `settings-select-temperatureUnit` with labels and helper descriptions. | `SettingsManager.test.tsx` assertion. |
| **AC-3** | Formulas Section | `settings-section-formulas` contains `settings-select-ibuFormula` and `settings-select-abvFormula` with labels and helper descriptions. | `SettingsManager.test.tsx` assertion. |
| **AC-4** | Settings Row Styling | Each setting row in both sections applies `SETTINGS_ROW_CLASS` inside a container applying `divide-y divide-slate-800`. | `SettingsManager.test.tsx` DOM inspection. |
| **AC-5** | Form Control Styling | All `<select>` elements in `SettingsManager.tsx` apply `FORM_SELECT_CLASS` from `designSystem.ts`. | `SettingsManager.test.tsx` assertion. |
| **AC-6** | Live Updates & Optimistic Sync | Changing any select control calls `putConfig` and updates shared `useConfig()` state without crashing. | `SettingsManager.test.tsx` simulate change event. |
| **AC-7** | Garetz Note Gating | Selecting `garetz` as IBU formula displays `garetz-approximation-note`; selecting `tinseth` or `rager` removes it. | `SettingsManager.test.tsx` test with different configurations. |
| **AC-8** | Loading & Error States | `status === 'loading'` renders `LOADING_STATE_CLASS`; `status === 'error'` and save errors render `ERROR_STATE_CLASS`. | `SettingsManager.test.tsx` mocked error and loading states. |
| **AC-9** | Design System Export | `designSystem.ts` exports `FORM_SELECT_CLASS` and `SETTINGS_ROW_CLASS` as frozen string constants. | `designSystem.test.ts` exact string equality check. |
| **AC-10** | Form Header Harmonization: Equipment | All 4 `<h4>` section headings in `EquipmentForm.tsx` (Altitude & Atmospheric Physics, Thermal Mass & Mash Strike Energy Balance, Vessel Losses & Dead Space, Hopstand & Whirlpool Parameters) reference the imported `SECTION_HEADING_CLASS`. Zero occurrences of the literal substring `uppercase tracking-wide` remain in the file. The Hopstand heading retains `mb-3` appended after the token. Elements remain `<h4>`; the 3 icon-bearing headings' outer `flex items-center gap-2` wrapper `<div>`s are unchanged. | Grep for `uppercase tracking-wide` in `EquipmentForm.tsx` returns 0 matches; grep for `SECTION_HEADING_CLASS` returns 4 usages + 1 import; existing `EquipmentForm` tests (all `data-testid` hooks unchanged) still pass. |
| **AC-10a** | Token Immutability | `SECTION_HEADING_CLASS` and `SUBSECTION_HEADING_CLASS` in `designSystem.ts` retain their exact M13_P1 values (`'text-lg font-semibold text-slate-100 flex items-center gap-2'` and `'text-base font-bold text-white mb-2'` respectively). Neither is redefined, widened, or parameterized to accommodate `EquipmentForm`. | `designSystem.test.ts` exact string equality (already asserted by M13_P1's suite — must still pass unmodified). |
| **AC-11** | Form Header Harmonization: Mash | `MashProfileForm.tsx` is **not modified by this phase**. It contains no section heading; its `Steps ({steps.length})` `<h4>` control label retains `text-sm font-semibold text-slate-200` verbatim and gains no design-system import. | File absent from this phase's changed-file set (per AC-17 manifest diff). |
| **AC-12** | Form Header Harmonization: Inventory | Both `<h3>` headings in `InventoryForm.tsx` ("Item Information", "Category Details") reference the imported `SUBSECTION_HEADING_CLASS`; no literal `text-base font-bold text-white mb-2` string remains in the file. Rendered `class` attribute on both headings is unchanged from pre-phase output — **no visual diff**. | Grep for the literal returns 0 matches, for `SUBSECTION_HEADING_CLASS` returns 2 usages + 1 import; existing `InventoryForm` tests pass with no expectation edits. |
| **AC-13** | Form Header Harmonization: Water | Both `<h3>` headings in `WaterProfileForm.tsx` ("Profile Information", "Ion Concentrations (ppm / mg/L) & pH") reference the imported `SUBSECTION_HEADING_CLASS`; no literal `text-base font-bold text-white mb-2` remains. Rendered output unchanged — **no visual diff**. | Same method as AC-12, applied to `WaterProfileForm.tsx`. |
| **AC-14** | Form Header Harmonization: Fermentation | `FermentationProfileForm.tsx` is **not modified by this phase**. It contains no section heading; its `Steps ({steps.length})` `<h4>` control label retains `text-sm font-semibold text-slate-200` verbatim and gains no design-system import. | File absent from this phase's changed-file set (per AC-17 manifest diff). |
| **AC-15** | Subpanel Harmonization | `WaterSection.tsx`, `ReadingLog.tsx`, and `BatchNoteLog.tsx` harmonize container styling to `CARD_CLASS` / `SUBPANEL_CLASS`. | Automated codebase grep / test suites. |
| **AC-16** | Quality: Four Gates | `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all pass with exit code 0. | CLI verification. |
| **AC-17** | Scope Guardrail | Pre/post SHA-256 manifest diff confirms only permitted web components and tests modified. `apps/api/`, `packages/calculations/`, and `packages/shared-types/` remain completely untouched. | Pre/post manifest comparison. |

### 4.1 Deviation Register

Amendment 1 (this revision) corrects §1 item 2, §2.1's five form entries, and AC-10 through AC-14. The original text asserted that all 5 forms contained a literal `text-lg font-semibold text-slate-100...` heading string to be replaced with `SECTION_HEADING_CLASS`. Direct re-reading of all 5 files confirms **that string does not appear in any of them**; the original AC-10–AC-14 were therefore unsatisfiable as written. §3.1 (designSystem.ts extensions), §3.2 (SettingsManager redesign), AC-1–AC-9, and AC-15–AC-17 were independently confirmed accurate and are unchanged by this amendment. The entries below record the judgment calls made while correcting it — each is overrulable at the halt gate.

**D-1 — `EquipmentForm.tsx`'s uppercase headings collapse onto `SECTION_HEADING_CLASS` rather than becoming a fourth token.**
`text-sm font-bold text-slate-100 uppercase tracking-wide` (4 instances) matches neither shipped token. It is used exclusively as the top-level heading of a `CARD_CLASS`-shaped section card — structurally the identical role `SECTION_HEADING_CLASS` fills in `BatchDetail`. M13_P1 §3.4.1 states the typography scale is "three tiers, no fourth", and its D-1 set the precedent "extract the already-dominant convention, don't invent a new one". This pattern is confined to a single file and is therefore the minority convention, not the dominant one. **Resolution:** adopt `SECTION_HEADING_CLASS`; accept the visible change (small-caps uppercase label → `text-lg` sentence-case heading) on all 4 Equipment section cards. **Alternative if overruled:** add a fourth `OVERLINE_HEADING_CLASS = 'text-sm font-bold text-slate-100 uppercase tracking-wide'` token to `designSystem.ts`, point `EquipmentForm.tsx`'s 4 headings at it with no visual change, and accept that the scale becomes four tiers — which would also require reopening M13_P1 §3.4.1's "no fourth" statement and adding the token to `designSystem.test.ts`'s frozen assertions.

**D-2 — `MashProfileForm.tsx` and `FermentationProfileForm.tsx` are out of scope; neither is modified.**
Neither file has a section heading. Their only heading-like element is `<h4 className="text-sm font-semibold text-slate-200">Steps (n)</h4>`, sitting inside a `flex items-center justify-between` row directly opposite an "Add Step" button. Its function is a control-row label (a count indicator paired with its action), not a section header — promoting it to `SECTION_HEADING_CLASS` would render a `text-lg` heading inline beside a small button and visually misrepresent the hierarchy. **Resolution:** no change; both files stay out of this phase's changed-file set. **Alternative if overruled:** introduce a labels/eyebrow tier for control-row captions and route both files (plus any comparable inline labels elsewhere) through it — that is a broader design-system extension than this phase scopes, and belongs in its own phase rather than being smuggled in here.

**D-3 — `InventoryForm.tsx` / `WaterProfileForm.tsx` literals are replaced with the constant despite producing zero visual change.**
Both files' headings already equal `SUBSECTION_HEADING_CLASS` character-for-character. Leaving them as hardcoded literals would satisfy the *appearance* of harmonization while leaving nothing structurally tied to the token — the exact drift vector M13_P1's frozen-constant approach exists to close, and the reason the discrepancy this amendment corrects went unnoticed in the first place. **Resolution:** import and reference the constant; rendered output is byte-identical, so no test expectations change. **Alternative if overruled:** leave all four literals in place and drop AC-12/AC-13 to "no change", accepting that four call sites can silently diverge from the token.

**D-4 — Heading element tags are not changed.**
`EquipmentForm.tsx` uses `<h4>`, `InventoryForm.tsx`/`WaterProfileForm.tsx` use `<h3>`. Normalizing tag levels is a document-outline/a11y concern independent of the class-token harmonization this phase is scoped to, and changing them risks breaking role/heading-level test queries for no visual benefit. **Resolution:** class attributes only; tags untouched. **Alternative if overruled:** audit heading levels app-wide as a dedicated a11y phase, rather than partially normalizing 6 tags in 3 files.

---

## 5. Implementation Sequence

1. **Phase 1: Design System Constants**: Add `FORM_SELECT_CLASS` and `SETTINGS_ROW_CLASS` to `designSystem.ts`, update `designSystem.test.ts`.
2. **Phase 2: SettingsManager Redesign**: Refactor `SettingsManager.tsx` to 2 sectioned container cards with `divide-y divide-slate-800` rows and helper captions; create `SettingsManager.test.tsx`.
3. **Phase 3: Form Header & Subpanel Harmonization**: Update `EquipmentForm.tsx` (→ `SECTION_HEADING_CLASS`, D-1), `InventoryForm.tsx` and `WaterProfileForm.tsx` (→ `SUBSECTION_HEADING_CLASS`, D-3), `WaterSection.tsx`, `ReadingLog.tsx`, and `BatchNoteLog.tsx`. `MashProfileForm.tsx` and `FermentationProfileForm.tsx` are deliberately **not** touched (D-2).
4. **Phase 4: Verification & Four Gates**: Run full test suite (`npm test`), typecheck across all 4 workspaces, production build (`npm run build`), and lint (`npm run lint`).
