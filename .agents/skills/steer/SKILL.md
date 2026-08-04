---
name: steer
description: Use after /verify completes with a passing verdict, or after /promote presents a new roadmap. Runs State 4 — presents state of the union and steering options, then halts. Never advances automatically.
---

# State 4: Steering Checkpoint

**Rule:** Never close context or advance automatically after this point, regardless of how clear the "obvious next step" seems. This is a mandatory human checkpoint.

## What to do
1. Run `verify_steer` skill to summarize what just completed and write `.gsd/archive/STEERING_LOG.md`.
2. Present:
```
[STATE 4: Steering Checkpoint]

State of the Union: <one or two sentences on what's done and verified>

Please choose:
- Option A (Refine): submit comments/adjustments on the current phase.
- Option B (Proceed Phase): advance to the next phase in the active milestone.
- Option C (Pivot Roadmap): adjust future milestones based on what was learned.
- Option D (Complete): mark this milestone complete, move to the next one.
```
3. **Halt & Yield Turn**:
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
  4. Advance to next milestone in `.gsd/ROADMAP.md` (Phase 1).
  5. Trigger `/plan` for Milestone + 1 Phase 1, present spec, and **HALT** for `SPEC_APPROVED`.

## Note
If the state of the union includes a `critic` FAIL or an unresolved regression from `/verify`, do not reach this skill at all — that routes to `/diagnose` first. `/steer` should only ever present genuinely completed, verified work.
