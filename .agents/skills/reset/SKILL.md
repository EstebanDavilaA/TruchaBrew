---
name: reset
description: Use when implementation or refactoring breaks too many features or causes cascading regressions across the codebase. Resets code and .gsd state back to a known clean checkpoint (git commit, tag, or prior verified milestone/phase). Triggered by /reset.
---

# State Recovery: Reset to Clean Checkpoint

**Rule:** When an implementation attempt or refactor introduces widespread feature breakage, cascading test failures, or corrupted code that is too costly or risky to patch incrementally, do NOT keep adding diagnostic patches. Reset the codebase and `.gsd/` state back to a known clean checkpoint.

## What to do

1. **Identify Target Checkpoint:**
   Determine the target restoration point with the user or from `.gsd/STATE.json`:
   - **Verified Milestone / Phase Target**: The last passing verification checkpoint (`gate: "verified"` or `gate: "steered"` in `.gsd/STATE.json`).
   - **Phase Spec Baseline Target**: The git commit prior to executing the active phase's spec (`SPEC_APPROVED`).
   - **Explicit Commit / Tag Target**: A specific git commit SHA, tag, or `HEAD~N`.

2. **Audit Blast Radius & Stash Scratch Work:**
   - Inspect `git status` and `git diff --stat` to present all changed/broken files to the user.
   - If there are uncommitted experiments, debug scripts, or scratch files to preserve, stash them (`git stash`) or copy them to `.gsd/archive/stashed_experiments/`.

3. **Execute Reset via `reset_checkpoint`:**
   - Run `reset_checkpoint` technical process skill to perform the filesystem & git restoration.
   - Realign `.gsd/STATE.json`, `.gsd/ROADMAP.md`, and `.gsd/active/` so GSD runtime state strictly matches the restored code baseline.

4. **Post-Reset Baseline Verification:**
   - Run full project build and unit test suite (`npm test`).
   - Confirm 100% pass rate on the restored baseline.

5. **Route Next Action:**
   - **Route to `/plan`**: If re-specifying the phase with tighter scope/guardrails.
   - **Route to `/discover`**: If domain intent or architectural premise needs re-clarification.
   - **Route to `/steer`**: If re-evaluating roadmap milestone priorities with the user.
