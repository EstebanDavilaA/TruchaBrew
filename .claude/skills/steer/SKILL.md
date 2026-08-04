---
name: steer
description: Use after /verify completes with a passing verdict, or after /promote presents a new roadmap. Runs State 4 — presents state of the union and steering options, then halts. Never advances automatically.
---

# State 4: Steering Checkpoint

**Rule:** Never close context or advance automatically after this point, regardless of how clear the "obvious next step" seems. This is a mandatory human checkpoint.

## What to do
1. Spawn the `verifier` subagent to summarize what just completed and write `.gsd/archive/STEERING_LOG.md`.
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
3. Halt. Wait for an explicit selection.

## Note
If the state of the union includes a `critic` FAIL or an unresolved regression from `/verify`, do not reach this skill at all — that routes to `/diagnose` first. `/steer` should only ever present genuinely completed, verified work.
