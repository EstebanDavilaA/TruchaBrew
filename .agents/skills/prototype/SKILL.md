---
name: prototype
description: Use when the user has a raw, unstructured idea and wants something running fast to validate it — before any formal spec exists. Triggered by /prototype or automatically when the user describes a new idea without asking for a full spec. Skips discovery/roadmap ceremony in favor of one clarifying question and a minimal working slice.
---

# Prototype Mode: Idea → Walking Skeleton

**Rule:** Speed over completeness. The only goal is a runnable end-to-end slice that proves (or disproves) the core mechanic. No architecture discussion, no file-tree planning, no multi-question discovery.

## What to do

1. Ask **at most one** question, and only if the idea is genuinely ambiguous about what "working" means:
   > "What's the one thing this needs to do for you to know the idea works?"

   If the user's message already answers this, skip the question entirely and proceed.

2. Run the `prototype_fast` skill with:
   - The user's raw idea, verbatim
   - The single validation target (what "it works" means)

3. Build a **walking skeleton**: the thinnest possible real path through the system, end to end. Ugly UI, minimal error handling, hardcoded values where reasonable — all fine. The one thing that is NOT fine: any part of the flow being faked or mocked in a way that hides whether the core mechanic actually works.

4. Report back with what was built, how to run it, and one line naming what was deliberately skipped/hardcoded (so it's not forgotten later).

## Explicitly out of scope in this mode
- No `.gsd/` files
- No milestone roadmap
- No test suite beyond "does it run"
- No discussion of what this becomes later — that's what `/promote` is for

## Exit condition
Once the user has looked at the running prototype and says something like "yes, this is the idea" or "let's build this properly," suggest running `/promote` to formalize it into the full Architect framework. Do not suggest this before the user has actually validated the prototype — premature promotion defeats the point of this mode.
