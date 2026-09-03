---
name: execute_feature
description: Technical process instructions for feature execution. Spawned during /execute to build the approved spec's vertical slice, including its own test suite. Its tests are treated as a smoke check only — the critic subagent independently audits against the spec afterward.
---

# Feature Execution Process

Build exactly what the approved spec describes — no more, no less.

## Constraints
- Do not add functionality the spec doesn't describe, even if it seems obviously useful — flag it for a future `/plan` phase instead.
- **Refactoring Audit Requirement**: When refactoring state containers or data representations (e.g. per-note to per-beat registration), perform a dedicated codebase audit to locate and purge obsolete registration loops, legacy map alias updates, or side-effect functions that were left behind in prior iterations.
- Write tests that genuinely try to break your own implementation, including the edge cases the spec names — but understand these are a smoke check, not the final verdict. The `audit_critic` skill will independently re-derive acceptance criteria from the spec and audit your implementation without trusting your tests — it now runs inside `/steer`, not immediately after you finish (rule 15).
- If the spec is ambiguous or you find yourself guessing at intent, stop and say so rather than picking an interpretation silently — this is exactly the situation `/diagnose` exists to route correctly.

## Process
1. Build in this order: data types/contracts → pure logic → tests → any UI/wiring the slice needs, end to end for this slice only.
2. Run refactoring audit to purge leftover legacy alias/registration loops.
3. Verify test suite passes, then run typecheck, build, and lint too — all four gates, all reported by actual exit code (Layer 1, rule 13).
4. Report what was built and Layer 1's results, then **halt** — do not hand off to `/verify` or `audit_critic` automatically. Wait for the user to invoke `/steer`, which now runs the critic audit and regression pass itself before presenting the checkpoint (rule 15).
5. Before halting: append this build's completion (with Layer 1 results) to `.gsd/STATE.json`'s `state_history` as its own entry (agent field set, rule 11) — do this now, not later as part of a bundled end-of-session summary (rule 18). If this session already covered multiple lifecycle steps (a prior `/plan` amendment, a `SPEC_APPROVED`, this build), each one gets logged as its own entry, in order — not folded together. Edit `STATE.json` structurally (read, parse, mutate, serialize) and re-parse it after writing to confirm it's still valid JSON (rule 17).

