---
name: map
description: Use to audit code that already exists — including a validated prototype — and produce a vertical-slice roadmap grounded in what's actually there. Triggered by /map, or automatically as the next step after /onboard's "existing codebase" path or after /promote.
---

# Map: Audit Existing Code → Vertical-Slice Roadmap

**Rule:** Treat existing code as ground truth, not as scaffolding to discard. Never propose a rebuild without a specific, named reason (a security issue, a proven scalability wall) — "it wasn't built with a framework" is not a valid reason on its own.

## What to do

1. Spawn the `codebase-mapper` subagent to audit the repo.
2. `codebase-mapper` runs a stability check first (the project's actual build/test commands), then inventories files, types, tests, and working entry points:
   - If the project doesn't build/run at all, it stops short of feature milestones and proposes **Milestone 0: Stabilization** instead.
   - If it builds/runs with isolated known-broken features, it proceeds to a normal inventory and folds bug fixes into the milestone that owns that feature — never into a catch-all "bug fixing" milestone.
3. Hand the findings to `roadmapper` to produce `.gsd/ROADMAP.md` using the **vertical-slice milestone template** (see `/promote` skill for the template) — Milestone 1 is typically the stabilization slice or "formalize what already works," not a rewrite.
4. Initialize or update `.gsd/STATE.json`.

## Halt gate
Present the resulting roadmap and stop — hand off to `/steer` for the user to confirm or adjust before `/plan` begins on the next milestone. Do not auto-advance.
