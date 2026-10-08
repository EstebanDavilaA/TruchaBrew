# Milestone 44 / Phase 1 — Protect recipe and batch edits when leaving

**Date:** 2026-10-08 · **Status:** DRAFT

> P1 of 2. P2 remains: protect unsaved edits in inventory and profile data-entry modals.

## Problem

Leaving a recipe or batch page can discard unsaved work without warning. A recipe already guards some exits, but batch-page navigation does not.

## Proposed approach

Use the app's existing local navigation and dirty-state patterns to protect recipe and batch page edits. Reconcile the old responsive issues as the roadmap requires, without turning this phase into a visual redesign.

## What you can do after this phase

- When leaving a dirty recipe or batch page through desktop or mobile navigation, back/cancel controls, or browser reload/close, the brewer is warned before the edits are discarded.
- For in-app navigation, the brewer can stay and keep the pending edits or discard them and continue; clean or successfully saved pages leave without an unnecessary prompt.
- Existing behavior remains unchanged when saving, deleting, or acting on a batch.
- Old responsive issues are rechecked against the current app; resolved entries are reconciled, while reproducible issues remain tracked with current evidence.

## What we are not building

- Unsaved-edit protection inside inventory, equipment, mash, fermentation, or water-profile data-entry modals; this is P2.
- Autosave, crash recovery, draft persistence, or unrelated responsive redesigns.

## Rules and patterns that apply

- `RULES.md` rules 3–5.
- Existing recipe dirty-state and `ConfirmDialog` patterns.
- `.codestream/PROJECT.md` — user data preservation.

## How we will know it works

- A dirty recipe and a dirty batch each prompt before sidebar/mobile navigation or their back/cancel exit; staying preserves edits and discarding completes the requested exit.
- Browser reload or close warns while either covered page is dirty, and a cancelled warning leaves the page and edits intact.
- Clean and successfully saved pages leave without a discard prompt; existing save, delete, and batch actions still work.
- `BUG-026`–`BUG-039` are checked against current behavior; resolved entries are reconciled and still-reproducible entries remain open with current evidence.
