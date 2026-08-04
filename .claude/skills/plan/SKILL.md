---
name: plan
description: Use to draft a feature spec for the active milestone/phase before any code is written. Runs State 2 — code generation is strictly forbidden until the user replies SPEC_APPROVED. Triggered by /plan, or automatically when a milestone from .gsd/ROADMAP.md is about to start.
---

# State 2: Feature Planning

**Rule:** No implementation code until the user has explicitly approved the spec with the exact phrase `SPEC_APPROVED`.

## What to do
1. Spawn the `planner` subagent for the active milestone/phase.
2. It drafts `.gsd/active/<milestone>_<phase>_feature_spec.md` (e.g. `M4_P3_feature_spec.md` — `verifier` should have already archived the prior phase's file at `/steer`) containing: data schema/contracts, pure logic function signatures, and an acceptance-criteria test matrix (each AC must be specific and testable — "works well" is not an acceptance criterion).
3. Present the spec and stop with: "Review this feature specification. Reply with SPEC_APPROVED to begin execution."

## Halt gate
Do not proceed to `/execute` under any circumstance until the literal string `SPEC_APPROVED` is received. If the user proposes changes, revise and re-present — do not treat a revision request as approval.
