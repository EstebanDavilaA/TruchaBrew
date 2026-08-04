---
name: promote
description: Use when a prototype built in /prototype mode has been validated by the user and should now be formalized into the full structured Architect framework with milestones, specs, and halt gates. Triggered by /promote.
---

# Promote: Validated Prototype → Structured Project

**Rule:** Never promote a prototype that hasn't actually been run and confirmed by the user. If there's no evidence of that in the conversation, ask first: "Have you run this and confirmed it's the right direction?"

## What to do

1. Spawn the `codebase-mapper` subagent to audit what exists — treat the prototype code as ground truth for "what already works," not as scaffolding to throw away.
2. `codebase-mapper` produces `.gsd/ROADMAP.md`, but using the **vertical-slice milestone template** (see below), not a layer-based one. The prototype itself typically becomes (or informs) Milestone 1.
3. Initialize `.gsd/STATE.json` with `current_state: 1` (roadmap exists, not yet planning) since discovery is effectively already done — the prototype *was* the discovery process.
4. Present the roadmap and hand off to `/steer` for the user to confirm or adjust before `/plan` begins on the next milestone.

## Vertical-slice milestone template

Every milestone must be a complete, runnable, user-facing slice — never a layer.

```
### Milestone N: <short name>
- User-visible outcome: what a person can actually do after this milestone, in one sentence.
- Builds on: which prior milestone's slice this extends (or "none — first slice").
- Hardening scope: what from the prototype gets made production-grade here (types, error handling, tests) — be specific, don't say "polish."
- Verification threshold: a concrete, testable condition — not "works well."
```

**Anti-pattern to reject:** any milestone whose objective is a layer name ("Data Contracts," "Backend API," "UI Components") rather than a user-visible outcome. If `codebase-mapper` or `roadmapper` proposes a layer-based milestone, send it back.

## Halt gate
Present the roadmap and stop. Do not proceed to `/plan` on the next milestone until the user has explicitly confirmed the roadmap via `/steer`.
