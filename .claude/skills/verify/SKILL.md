---
name: verify
description: Use after /execute completes a milestone or phase. Runs the executor's own tests, an independent critic audit against the approved spec, and a regression pass across all prior milestones. Replaces trusting test-passage alone as proof of correctness.
---

# Verification: Three-Layer Check

**Rule:** "Tests pass" is necessary but never sufficient. A feature can pass every test its own builder wrote and still not do what was asked, and a new feature can silently break an old one.

## What to do

1. **Layer 1 — Executor's own tests.** Run the test suite the `executor` wrote. Record pass/fail. This is a smoke check, not a verdict.

2. **Layer 2 — Independent critic audit.** Spawn the `critic` subagent with the approved spec for this milestone/phase. It does not see the executor's tests as authoritative — it re-derives acceptance criteria from the spec and traces them through the actual implementation. Wait for `.gsd/archive/CRITIC_REPORT.md`.

3. **Layer 3 — Cross-milestone regression.** Run the smoke tests for **every previously completed milestone**, not just the current one — this is what catches Milestone 3 quietly breaking Milestone 1. If a prior milestone's smoke test now fails, this is a regression, not a new bug — flag it as such, since the root cause lives in whatever just changed, not in the old code.

## Verdict logic
- Layer 1 fail → straightforward, do not proceed, hand back to `executor` with the failure.
- Layer 2 FAIL → do NOT hand this back to `executor` for a quick patch. Route to `/diagnose` — a critic FAIL usually means either the spec was ambiguous or the implementation approach itself is wrong, and a patch without diagnosis tends to produce a differently-broken version of the same problem.
- Layer 3 regression → route to `/diagnose` as well, since "what changed that broke this" needs investigation, not a reflexive fix.
- All three clear → compile `.gsd/archive/VERIFICATION_REPORT.md` as before and proceed to `/steer`.

## Output
`.gsd/archive/VERIFICATION_REPORT.md` must include all three layers' results, not just test suite output. A milestone is not verified unless the critic report is attached.
