# FEATURE SPECIFICATION: M31_P1 - The Contract, Proven Small (EquipmentForm & FermentationProfileForm Label Association)

> **Milestone 31:** 'The forms for your kit and your stock introduce themselves' (Living Design System initiative, .gsd/ROADMAP.md)
> **Phase 1 of 4.** Hardens FormField's automatic useId-driven id/htmlFor wiring and proves it by migrating EquipmentForm.tsx and FermentationProfileForm.tsx (closing 6 unnamed controls per fermentation step and unifying label typography onto FORM_LABEL_CLASS).

---

## Phase Summary

In Milestone 30, TruchaBrew established the foundational UI primitive library under apps/web/src/components/ui/ (FormField, Input, Select, Button, NumberInput) and migrated the Calculators hub.

In Milestone 31 Phase 1, we prove FormField's label-association contract at scale on the newest, cleanest profile forms:
1. **FormField.tsx Hardening:** Hardens FormField to own id/htmlFor association automatically using React 19 useId(). When a child form control is rendered inside <FormField label= ...>, FormField automatically generates an identifier, applies <label htmlFor={id}>, and clones the child element with id={id} (if not already set). Explicit htmlFor / id props remain fully supported.
2. **EquipmentForm.tsx Migration:** Migrates profile identity, 19 numeric physics fields, altitude, thermal mass toggle, losses, hopstand, and notes to render through FormField and NumberInput / Input / textarea, retiring the lock text-xs font-medium text-slate-300 mb-1 label variant onto FORM_LABEL_CLASS. Migrates form action buttons to Button.
3. **FermentationProfileForm.tsx Migration:** Migrates profile name and all dynamic step row controls (Name, Type, Temp, Duration, Ramp, Pressure) to render through FormField and compact UI primitives (Input size=sm, Select size=sm, NumberInput size=sm), eliminating 6 completely unnamed controls per step row. Migrates step actions (Add Step, Move Up, Move Down, Delete) and form header buttons to Button.
4. **Accessible Name & Focus Assertions:** Author tests proving that every control in EquipmentForm and FermentationProfileForm is accessible by name via getByLabelText, and clicking a label focuses its associated input/select.

---

## Acceptance Criteria Summary

All 27 Acceptance Criteria (AC-1..AC-27) fully satisfied and verified clean across Layer 1 (2,036 tests), Layer 2 (Critic PASS 27/27 ACs), and Layer 3 (Regression clean).
