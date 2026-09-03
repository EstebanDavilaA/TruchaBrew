---
name: execute
description: Use after a feature spec has been approved with SPEC_APPROVED. Runs State 3 — builds strictly to the approved spec, vertical-slice scope only (not layer-by-layer across the whole project), runs Layer 1 (tests/typecheck/build/lint), then halts for the user to invoke /steer. Triggered automatically upon receiving SPEC_APPROVED, or by /execute.
---

# State 3: Spec-Bound Execution

**Rule:** Build only what the approved spec describes, for this milestone's slice. Do not expand scope to "while I'm here" additions — those go through `/plan` for a future phase, not silently into this one.

## What to do
0. **First action of a session, always**: if `.gsd/STATE.json` already exists, run the pre-flight integrity check (`.gsd/HARD_RULES.md` rule 10) before anything else — this is a hard block, not a formality.
1. Spawn the `executor` subagent with the approved spec.
2. It builds the vertical slice end to end (not layer-by-layer across unrelated milestones) and writes its own test suite.
3. Run Layer 1 yourself (`.gsd/HARD_RULES.md` rule 13): the test suite the executor wrote, **plus** typecheck, build, and lint — all four, all reported by actual exit code.
4. Append this build's completion (with Layer 1 results) to `.gsd/STATE.json`'s `state_history` now, as its own entry with the `agent` field set (rules 11, 18). Edit `STATE.json` structurally and re-parse it after writing to confirm it's still valid JSON (rule 17).
5. Report what was built and Layer 1's results, then **halt**: *"Layer 1 clear. Run `/steer` when you're ready to review — it runs the independent critic audit and regression pass before presenting the checkpoint."* Do not auto-chain into `/verify` or spawn `critic` here (`.gsd/HARD_RULES.md` rule 15) — that used to happen in the same turn and was burning excessive context/tokens by compounding the critic pass on top of the full build transcript.

## Note
This is the layer where premature code generation historically happens without spec discipline. The gate that prevents it lives in `/plan`, not here — by the time `/execute` runs, scope is supposed to already be locked. If the executor finds the spec is ambiguous or insufficient mid-build, stop and route to `/diagnose` rather than improvising.

If Layer 1 fails, do not proceed — hand back to `executor` with the failure and stay in `/execute`; do not involve `/steer` or `critic` until Layer 1 is clean.
