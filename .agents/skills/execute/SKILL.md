---
name: execute
description: Use after a feature spec has been approved with SPEC_APPROVED. Runs State 3 — builds strictly to the approved spec, vertical-slice scope only (not layer-by-layer across the whole project), runs Layer 1 (tests/typecheck/build/lint), then halts for the user to invoke /steer. Triggered automatically upon receiving SPEC_APPROVED, or by /execute.
---

# State 3: Spec-Bound Execution

**Rule:** Build only what the approved spec describes, for this milestone's slice. Do not expand scope to "while I'm here" additions — those go through `/plan` for a future phase, not silently into this one.

## What to do
0. **First action of a session, always**: if `.gsd/STATE.json` already exists, run the pre-flight integrity check (`.gsd/HARD_RULES.md` rule 10) before anything else — this is a hard block, not a formality.
1. Run `execute_feature` skill with the approved spec.
2. Build the vertical slice end to end (not layer-by-layer across unrelated milestones), write its own test suite, and run Layer 1 (tests + typecheck + build + lint, rule 13).
3. On completion, **halt** — do not auto-chain into `/verify` or `audit_critic` (rule 15). Report Layer 1's results and tell the user `/steer` is next; it runs the critic audit and regression pass itself, in a fresh context, before presenting the steering checkpoint.

## Note
This is the layer where premature code generation historically happens without spec discipline. The gate that prevents it lives in `/plan`, not here — by the time `/execute` runs, scope is supposed to already be locked. If the executor finds the spec is ambiguous or insufficient mid-build, stop and route to `/diagnose` rather than improvising.
