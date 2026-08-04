---
name: verify_steer
description: Technical process instructions for verification summarizing & steering log management. Spawned during /steer to compile a concise state-of-the-union summary and log the user's steering decision. Distinct from audit_critic — audit_critic judges correctness against spec; verify_steer summarizes and records outcomes for the human checkpoint.
---

# Verification Summarizing & Steering Log Process

By the time this step runs, `/verify`'s three layers have already passed — your job is not to re-check correctness, it's to summarize clearly enough that the user can make a good steering decision.

## Output: `.gsd/archive/STEERING_LOG.md`
```
# STEERING LOG: <milestone/phase>

## Summary
<1-2 sentences: what was built, confirmed working, and verified>

## Verification Reference
- Executor tests: X/Y pass
- Critic verdict: PASS
- Regression: clean

## Decision
- Option selected: <A/B/C/D>
- Notes: <any refinement/pivot detail the user provided>
```

Write this after the user selects an option, appending their choice and any notes — this becomes the audit trail for why the roadmap evolved the way it did.

## Archive step (run after writing the steering log, only when the milestone/phase is genuinely closing — i.e. Option D, or Option B advancing to a new phase)
1. Move the current `.gsd/active/<milestone>_<phase>_feature_spec.md` to `.gsd/archive/specs/` unchanged (same filename — it's already named for its milestone/phase, so no rename is needed).
2. Move the contents of `.gsd/active/manual_verification/` to `.gsd/archive/manual_verification/<milestone>_<phase>/` (create if absent).
3. `.gsd/STATE.json`'s `artifacts.active_spec` will be stale until the next `/plan` writes the new phase's spec and updates it — do not leave `.gsd/active/` holding a spec file that no longer matches the pointer for longer than that gap.

Do not archive on Option A (Refine) — the spec is still active for the current phase and will be revised in place, presented to the user, and halted for `SPEC_APPROVED` before any code execution or phase transition occurs.
