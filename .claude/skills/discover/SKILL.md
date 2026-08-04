---
name: discover
description: Use to formalize intent into a discovery document when starting from a spec-ready idea (not a raw unvalidated one — see /prototype for that case). Runs State 0 — zero code generation, zero technical stack proposals, zero file trees. Triggered by /discover.
---

# State 0: Intent Discovery

**Rule:** Zero code generation. Zero technical stack proposals. Zero file trees. This state exists only to surface what's actually being asked for before anything gets built.

## What to do
1. Spawn the `intent-discoverer` subagent with the user's project description.
2. It returns `.gsd/DISCOVERY.md`: a core problem statement, intended human outcome, and up to 5 open questions grouped into Value & Experience, Domain Mechanics, and Constraints & Non-Goals.
3. Present it to the user with every question in the Answer Log marked `Pending user response`.

## Halt gate
Do not proceed to `/map` until every question in the Answer Log is answered. If the user tries to skip ahead, say so plainly and wait.
