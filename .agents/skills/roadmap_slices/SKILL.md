---
name: roadmap_slices
description: Technical process instructions for roadmap creation. Spawned during State 1 (or during /promote) to convert answered discovery questions, or an audited prototype/codebase, into a decoupled-milestone roadmap. Enforces vertical-slice milestones over horizontal layers.
---

# Vertical Slice Roadmapping Process

Turn validated intent into a sequence of milestones that a project can actually be built from without becoming unmanageable.

## The one rule that matters most
Every milestone must produce something a user could look at and use — a vertical slice through the whole system — never a horizontal layer (types-only, backend-only, UI-only). A milestone whose deliverable is "all the data contracts" is a rejected milestone, even if it's technically well-specified. Ask yourself: "could someone open this and actually do the thing?" If not, redraw the milestone boundary.

## Why this matters
Horizontal layering is the single most common cause of the exact failure mode this framework exists to prevent: half-built abstractions accumulating with nothing runnable to validate them against, until the project becomes too large to safely change. Vertical slices force validation to happen continuously instead of at the end.

## Process
1. Read the input — answered `.gsd/DISCOVERY.md` questions, a `map_codebase` audit of existing code, and all candidate entries logged in `.gsd/FEATURES.md` and `.gsd/BUGS.md`.
2. Identify the smallest complete slice that delivers core value first.
3. Sequence subsequent milestones by user-visible capability, incorporating logged features (`FEAT-xxx`) and open scope gaps/defects (`BUG-xxx`) into logical milestone slices.
4. **Update Item Status**: For every feature (`FEAT-xxx` in `.gsd/FEATURES.md`) or bug (`BUG-xxx` in `.gsd/BUGS.md`) assigned to a milestone on `.gsd/ROADMAP.md`, update its status to `SCHEDULED_MILESTONE (Milestone X)`.
5. Write `.gsd/ROADMAP.md`:

```
# ROADMAP: <project name>

## Decoupled Milestones

### Milestone 1: <short name>
- User-visible outcome: ...
- Builds on: none — first slice
- Estimated phases: 1 (or "1–2, TBD at /plan" if the slice looks large enough it might split)
- Hardening scope: ...
- Verification threshold: ...

### Milestone 2: <short name>
- User-visible outcome: ...
- Builds on: Milestone 1
- Estimated phases: 1
- Hardening scope: ...
- Verification threshold: ...
```

6. Confirm milestones are genuinely decoupled: changes anticipated in Milestone 3 should not require reopening Milestone 1's slice. If they would, the boundaries are wrong — redraw them.
7. **Estimated phases is a first guess, not a promise** — the actual split is often only clear once `/plan` scopes the work. `plan_spec` updates this line as its own understanding sharpens; this field exists so `/steer` can tell the user, at each phase's checkpoint, whether more phases are still expected — never leave it blank.

## Halt gate
- Present `.gsd/ROADMAP.md` and stop execution immediately.
- **MANDATORY TOOL RESTRICTION**: Do NOT invoke any file modification tools (`replace_file_content`, `write_to_file`, `multi_replace_file_content`) on workspace code files. Yield the turn and wait for explicit user confirmation via `/steer` before any milestone enters `/plan`.
