# DISCOVERY: TruchaBrew Living Design System

## 1. Problem Taxonomy

- **Core Problem Statement:** The user's own framing is the load-bearing signal here: "I've been asking for a long time cohesive design and design critics but I end up patching the app in a patchwork quilt manner." This is a complaint about a recurring *process* failure, not a request to implement a specific component library. Despite the prior "Experience Redesign" initiative (Milestones 23-28) already addressing visual-consistency, accessibility, modals, routing, and IA, the underlying pattern — individual screens/components getting one-off styling fixes instead of drawing from a single enforced source of truth — appears to still be recurring, or the user doesn't trust that it's actually been solved. Alongside this, the user attached a highly detailed, prescriptive technical brief (exact hex values, exact Tailwind class strings, named component APIs, file paths) that reads as sourced from an external tool/consultant/audit rather than written fresh in this conversation — it describes one possible *solution* (a `components/ui/` primitive layer) but was not necessarily authored with knowledge of what Milestones 23-28 already built, whether it would duplicate that work, or whether it fits this project's own spec-gated, vertical-slice process.

- **Intended Human Outcome:** The user wants to stop experiencing TruchaBrew as something that gets patched piecemeal — they want confidence that once a design decision is made (a color, a spacing rule, an input's shape), it holds everywhere, automatically, and that new UI added later can't drift from it without something catching it. "Design critics" in their opening line suggests they also want an enforcement/review mechanism, not just a one-time cleanup — i.e., the outcome is durability of consistency over time, not just a consistent snapshot today.

## 2. Open Domain Questions (Max 5)

### Value & Experience
1. Milestones 23-28 ("Experience Redesign") already did visual-consistency, accessibility, modal, routing, and IA work. From your side, did that work not actually deliver the "cohesive" feel you were after, or is this a genuinely new/deeper ask (e.g., that work fixed screens but didn't stop *future* patchwork because there was never a shared primitive layer to draw from)? Understanding which of those it is changes whether this is a gap-fill or a foundational rework.
2. "Design critics" in your framing — do you mean you want a recurring/automated check (e.g., a lint rule, a design-token test, or a critic-agent audit step) that catches drift going forward, or were you referring to the critic audits this framework already runs during `/steer`, which you feel haven't been catching this class of problem?

### Domain Mechanics
3. The pasted brief is a complete, decisive-looking spec (component names, exact prop shapes, exact class strings) — but per this project's process, specs get drafted in `/plan` against a scoped milestone, not adopted wholesale from an external document sight-unseen. Do you want that pasted brief treated as raw *input/reference material* for planning (to be reconciled against what M23-28 already built, and possibly revised), or do you already consider it final and want it followed close to verbatim?
4. Should this be scoped as its own initiative (roadmap discovery -> `/map` or `/plan` -> milestones), or does part of it belong in `.gsd/BUGS.md` / `.gsd/FEATURES.md` triage via `/log` instead — e.g., specific "this button doesn't match that button" patchwork instances logged as bugs, versus the primitive-layer architecture itself treated as a real initiative?

### Constraints & Non-Goals
5. Is a from-scratch `components/ui/` primitive layer (new files, new design-token module, migrating every existing raw `<input>`/`<select>`/`<button>` across the app) the right scope, or would auditing and consolidating what M23-28 already introduced be preferred first, with new primitives only where gaps are found? Relatedly, is there any part of the pasted brief you already know you *don't* want (e.g., specific hex values, specific component names) versus material you're fine letting `/plan` revise?

## 3. Answer Log
- [x] Question 1: The "Experience Redesign" work (M23-28) didn't actually deliver the cohesive feel the user was after — it's still inconsistent today, not just a case of new drift since.
- [x] Question 2: "Design critics" refers to this framework's own `/steer` critic-agent audits — the user feels those haven't been catching this class of problem (patchwork UI inconsistency).
- [x] Question 3: The pasted technical brief (component APIs, hex values, Tailwind classes) is reference input for `/plan` to reconcile against existing work — not a final spec to follow verbatim.
- [x] Question 4: Scope this as a full new roadmap initiative (discovery -> `/map`/`/plan` -> milestones), not a `/log` bug/feature triage.
- [x] Question 5: Full rebuild + migration — build the complete `components/ui/` primitive layer and migrate every existing raw `<input>`/`<select>`/`<button>` across the app to use it. Nothing in the pasted brief is locked in; all of it (hex values, component names, exact classes) is open to revision during `/plan`.
