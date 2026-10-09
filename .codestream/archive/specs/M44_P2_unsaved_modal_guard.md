# Milestone 44 / Phase 2 — Protect inventory and profile edits when exiting

**Date:** 2026-10-08 · **Status:** APPROVED (2026-10-09)

> P2 of 2. No phases remain after this one.

## Problem

Leaving an edited inventory item or brewing profile can discard pending changes without warning.

## Proposed approach

Warn before a brewer uses Back or Cancel to exit a dirty inventory or profile data-entry form, using the existing confirmation pattern. App-wide navigation and browser reload/close protection remain outside this phase. Keep each form's existing save, delete, and validation behavior.

## What you can do after this phase

- When using Back or Cancel on a dirty inventory, equipment, mash, fermentation, or water-profile form, the brewer can stay and keep the pending values or discard them and exit.
- Clean forms exit without a discard prompt.
- Saving, deleting, and validation continue to work as before.

## What we are not building

- Autosave, crash recovery, or draft persistence.
- Dirty-state protection for nested calculator, import, or logging dialogs.

## Rules and patterns that apply

- `RULES.md` rules 3–5.
- Existing recipe dirty-state and `ConfirmDialog` patterns.
- `.codestream/PROJECT.md` — user data preservation.

## How we will know it works

- Each covered form warns before its ordinary Back/Cancel exit when dirty; staying preserves entered values and discarding exits without saving.
- Clean forms exit without a discard prompt.
- Existing save, delete, and validation flows still work for inventory and each profile type.
