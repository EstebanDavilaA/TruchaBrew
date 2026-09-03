---
name: verify_steer
description: Technical process instructions for verification summarizing & steering log management. Spawned during /steer to compile a concise state-of-the-union summary and log the user's steering decision. Distinct from audit_critic — audit_critic judges correctness against spec; verify_steer summarizes and records outcomes for the human checkpoint.
---

# Verification Summarizing & Steering Log Process

By the time this step runs, `/verify`'s three layers have already passed — your job is not to re-check correctness, it's to summarize clearly enough that the user can make a good steering decision.

## Output: `.gsd/archive/STEERING_LOG.md`
**This file is a cumulative log across the entire project's lifetime (`.gsd/HARD_RULES.md` rule 12). Read its current content first, then APPEND — never truncate or overwrite existing entries.** Write as UTF-8 (rule 14).
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
1. Copy the current `.gsd/active/<milestone>_<phase>_feature_spec.md` to `.gsd/archive/specs/` unchanged (same filename — it's already named for its milestone/phase, so no rename is needed), **then delete the original from `.gsd/active/` as a separate, explicit step** — a "move" that silently leaves the source behind is exactly how a stale duplicate ends up sitting in `active/` for the next session to trip over. Re-list `.gsd/active/` afterward and confirm the spec file is actually gone before continuing (`.gsd/HARD_RULES.md` rule 20) — do not assume the copy step also deleted it.
2. Move the contents of `.gsd/active/manual_verification/` to `.gsd/archive/manual_verification/<milestone>_<phase>/` (create if absent).
3. **Item Closeout**: For any bugs (`BUG-xxx` in `.gsd/BUGS.md`) or feature requests (`FEAT-xxx` in `.gsd/FEATURES.md`) addressed by the closing phase/milestone spec, update their status to `CLOSED` (`VERIFIED_RESOLVED` for bugs / `VERIFIED_COMPLETED` for features).
4. `.gsd/STATE.json`'s `artifacts.active_spec` will be stale until the next `/plan` writes the new phase's spec and updates it — do not leave `.gsd/active/` holding a spec file that no longer matches the pointer for longer than that gap.
5. Append this steering decision to `.gsd/STATE.json`'s `state_history` now, as its own entry with the `agent` field set — not deferred to a later summary (rule 18). Edit `STATE.json` structurally (read, parse, mutate, serialize) and re-parse the file after writing to confirm it's still valid JSON before ending the turn (rule 17).

Do not archive on Option A (Refine) — the spec is still active for the current phase and will be revised in place, presented to the user, and halted for `SPEC_APPROVED` before any code execution or phase transition occurs.
