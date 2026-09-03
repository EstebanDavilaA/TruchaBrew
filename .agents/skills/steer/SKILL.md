---
name: steer
description: Use after /execute halts on a clean Layer 1 pass, or after /promote presents a new roadmap. Runs Layer 2 (critic audit) and Layer 3 (regression) itself, then presents state of the union and steering options, then halts. Never advances automatically.
---

# State 4: Steering Checkpoint

**Rule:** Never close context or advance automatically after this point, regardless of how clear the "obvious next step" seems. This is a mandatory human checkpoint — but the checkpoint is the halt itself, not a prerequisite for reaching it. `/execute` now halts after Layer 1 rather than auto-chaining forward, so `/steer` is the normal user-invoked next step: it runs Layer 2/3 itself and then, on a clean pass, presents the checkpoint **in that same turn** (`.gsd/HARD_RULES.md` rule 15). Ending a turn on "ready to proceed" is not compliant — presenting the actual options block below is.

## What to do
0. **First action of a session, always**: if `.gsd/STATE.json` already exists, run the pre-flight integrity check (`.gsd/HARD_RULES.md` rule 10) before anything else. `/steer` is now the normal entry point right after `/execute` halts — it is no longer a same-turn continuation from `/verify` (rule 15).
1. **Layer 2 — Independent critic audit.** Run `audit_critic` skill with the approved spec for this milestone/phase, in this fresh context (deliberately not carrying the executor's build transcript forward — that compounding was the token-burn problem this reorg fixes). Wait for `.gsd/archive/CRITIC_REPORT.md`, then read it back and confirm the new dated entry is actually there before citing it (rule 19).
2. **Layer 3 — Cross-milestone regression.** Run the smoke tests for every previously completed milestone, not just the current one.
3. **Verdict logic:**
   - Layer 2 FAIL → do NOT hand this back to `execute_feature` for a quick patch. Route to `/diagnose`.
   - Layer 3 regression → route to `/diagnose` as well.
   - Both clear → compile `.gsd/archive/VERIFICATION_REPORT.md` (append a new dated section, rule 12) and continue to step 4 in the same turn — do not stop and wait for a separate trigger (rule 15).
4. Run `verify_steer` skill to summarize what just completed and write `.gsd/archive/STEERING_LOG.md` (append a new dated section — never overwrite, rule 12).
5. Present, filling `<phase status>` from `.gsd/ROADMAP.md`'s "Estimated phases" line for the active milestone against `.gsd/STATE.json`'s `active_phase` (e.g. "phase 1 of an estimated 2 — at least one more phase expected", "phase 2 of an estimated 2 — this is likely the closing phase", or "estimate still unclear, plan_spec will scope it at the next /plan" if the line says TBD):
```
[STATE 4: Steering Checkpoint]

State of the Union: <one or two sentences on what's done and verified>

Milestone progress: <phase status>

Please choose:
- Option A (Refine): submit comments/adjustments on the current phase.
- Option B (Proceed Phase): advance to the next phase in the active milestone.
- Option C (Pivot Roadmap): adjust future milestones based on what was learned.
- Option D (Complete): mark this milestone complete, move to the next one.
```
Do not silently treat "Estimated phases" as authoritative — it is `plan_spec`'s current best guess, not a guarantee. Option B stays available even past the estimated count, and Option D stays available before it, if that's what the user's work actually calls for.
6. **Halt & Yield Turn**:
   - Present the options above and stop execution immediately.
   - **MANDATORY TOOL RESTRICTION**: Do NOT invoke any file modification tools (`replace_file_content`, `write_to_file`, `multi_replace_file_content`) on workspace code files. Wait for an explicit human steering selection before taking any further action.

## Option Action Handlers (When User Responds)

When the user selects a steering option, follow the exact protocol below:

- **Option A (Refine current phase)**:
  1. Record choice and user notes in `.gsd/archive/STEERING_LOG.md`.
  2. Do NOT archive `.gsd/active/<milestone>_<phase>_feature_spec.md`.
  3. Do NOT edit implementation source files.
  4. Do NOT advance the phase counter or jump to `/plan` for the next phase.
  5. Update the active feature spec in `.gsd/active/` to incorporate the user's refinement comments into acceptance criteria or contracts.
  6. Present the updated spec and **HALT**: *"Review the revised feature specification. Reply with SPEC_APPROVED to begin execution."* (Do NOT call `/execute` or edit code until `SPEC_APPROVED` is explicitly received!).

- **Option B (Proceed Phase)**:
  1. Record choice in `.gsd/archive/STEERING_LOG.md`.
  2. Archive current feature spec from `.gsd/active/` to `.gsd/archive/specs/` via `verify_steer`.
  3. Increment phase counter in `.gsd/STATE.json`.
  4. Trigger `/plan` for the next phase of the active milestone.
  5. Present the new phase spec and **HALT** for `SPEC_APPROVED`.

- **Option C (Pivot Roadmap)**:
  1. Record choice in `.gsd/archive/STEERING_LOG.md`.
  2. Trigger `roadmap_slices` to revise `.gsd/ROADMAP.md` based on learnings.
  3. Present updated roadmap and **HALT** for user approval before entering `/plan`.

- **Option D (Complete Milestone)**:
  1. Record choice in `.gsd/archive/STEERING_LOG.md`.
  2. Archive current feature spec via `verify_steer`.
  3. Update `.gsd/STATE.json` and `.gsd/ROADMAP.md` to mark active milestone complete.
  4. **Archive `state_history` by milestone boundary** (`.gsd/HARD_RULES.md` rule 21): read `.gsd/STATE.json`, split off every `state_history` entry belonging to milestones older than the milestone that just closed and the one before it, append those entries as a new dated section to `.gsd/archive/STATE_HISTORY.md` (append-only, rule 12), and write `STATE.json` back with only the current-and-prior-milestone entries retained — through the read-parse-mutate-serialize-reparse discipline of rule 17, never a text splice. Skip this step if the combined entry count for those two milestones is still small (no fixed threshold — use judgment).
  5. Advance to next milestone in `.gsd/ROADMAP.md` (Phase 1).
  6. Trigger `/plan` for Milestone + 1 Phase 1, present spec, and **HALT** for `SPEC_APPROVED`.

## Note
If Layer 2 (`audit_critic`) or Layer 3 (regression), run in step 1-3 above, comes back FAIL/regressed, the steering checkpoint (steps 5-6) never gets presented — route to `/diagnose` instead. `/steer` should only ever present genuinely completed, verified work.
