---
name: execute
description: Use after a feature spec has been approved with SPEC_APPROVED. Runs State 3 — builds strictly to the approved spec, vertical-slice scope only (not layer-by-layer across the whole project). Triggered automatically upon receiving SPEC_APPROVED, or by /execute.
---

# State 3: Spec-Bound Execution

**Rule:** Build only what the approved spec describes, for this milestone's slice. Do not expand scope to "while I'm here" additions — those go through `/plan` for a future phase, not silently into this one.

## What to do
1. Spawn the `executor` subagent with the approved spec.
2. It builds the vertical slice end to end (not layer-by-layer across unrelated milestones) and writes its own test suite.
3. On completion, automatically hand off to `/verify` — do not stop and wait; verification is not optional and is not a separate user-invoked step under normal flow.

## Note
This is the layer where premature code generation historically happens without spec discipline. The gate that prevents it lives in `/plan`, not here — by the time `/execute` runs, scope is supposed to already be locked. If the executor finds the spec is ambiguous or insufficient mid-build, stop and route to `/diagnose` rather than improvising.
