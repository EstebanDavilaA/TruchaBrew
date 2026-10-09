# Milestone 44 / Phase 1 — Protect recipe and batch page edits

**Date:** 2026-10-08 · **Status:** APPROVED (2026-10-09)

> P1 of 2. P2 remains: protect unsaved edits in inventory and profile data-entry modals.

## Problem

Leaving a recipe or batch page can discard unsaved work without warning. Recipe edits already have partial protection; batch-page edits do not.

## Proposed approach

Use the existing dirty-state and confirmation patterns to protect recipe and batch page exits, including the browser's native warning on reload or close. P1 owns page-level exits; P2 owns dismissal of dirty inventory and profile data-entry modals.

## What you can do after this phase

- Sidebar navigation on desktop or mobile, and page Back actions, ask before leaving a dirty recipe or batch; staying keeps the edits, while choosing to discard continues without saving.
- Reloading or closing while either page is dirty triggers the browser's native warning; cancelling it keeps the page and its edits.
- Clean or successfully saved pages leave without an unnecessary warning. The explicit batch Discard Changes action, save/delete flows, and existing batch actions keep their current behavior.

## What we are not building

- Dirty-state protection inside inventory, equipment, mash, fermentation, or water-profile data-entry modals; that is P2.
- Autosave, crash recovery, draft persistence, nested calculator/import/logging dialog protection, or unrelated responsive redesign.
- Triage of `BUG-026`–`BUG-039`; these remain tracked for separate future triage.

## Rules and patterns that apply

- `RULES.md` rules 3–5.
- Existing recipe dirty-state and `ConfirmDialog` patterns.
- `.codestream/PROJECT.md` — user data preservation.

## How we will know it works

- Dirty recipe and batch edits prompt before sidebar/mobile navigation or a page Back action; staying retains the edits and discarding completes the requested exit without saving.
- Browser reload/close warns while either page is dirty, and cancelling the warning leaves the page and edits intact; clean and successfully saved pages do not warn.
- Explicit batch discard, save/delete, and batch actions retain their current behavior, and a successful save leaves no pending discard warning.
