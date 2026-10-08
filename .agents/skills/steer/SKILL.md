---
name: steer
description: Independently review a finished build against the spec, then present the checkpoint and stop. The review runs in a fresh context, never in the one that built the code.
---

# Steer

Two jobs: get the build independently checked, then hand the decision to the human.

## Process

### 1. Review, in a fresh context

A subagent, or a new session. Never the context that just finished building
(rule 5). Give the reviewer the spec path and tell it to walk *How we will know it
works* item by item.

The reviewer should:

- read the spec and the code from disk, in full
- run the real thing where it can, rather than reading the tests and inferring
- try to break the assumptions the builder made silently
- assess whether the agreed user outcome is met, not whether implementation
  wording literally mirrors the spec
- report each outcome as **verified**, **failed**, or **unverified**, with concise
  evidence; an unverified outcome is never marked passed
- report unrequested behavior and missing artifacts, explaining their user impact
  rather than treating every deviation as an automatic failure
- classify findings using the shared severity policy in `RULES.md`; distinguish
  blockers from non-blocking polish and harmless deviations

### 2. Run scoped checks

Run targeted checks for the changed behavior and focused integration checks
against the current application state. Select broader regression checks when the
change crosses components, changes shared behavior, has significant regression
risk, or reaches a milestone boundary. Do not rerun every earlier milestone's
suite by default at each phase. Report commands run with actual exit codes,
checks deferred with reasons, and any remaining risk. A deferred check is not a
pass.

### 3. Decide whether the review blocks

Critical or major failures block the checkpoint: for example, an approved
material outcome fails, the core journey is broken, a significant regression is
present, or a security, safety, accessibility, or data-integrity risk remains.
An unverified material outcome blocks only when the missing evidence leaves its
success or an important risk unresolved. Route blockers through `/diagnose`;
don't patch during `/steer`.

Minor or advisory findings, wording differences that preserve the agreed
outcome, and harmless isolated deviations do not block. Report them and log
useful follow-up as appropriate. An unrequested change blocks only if it is
harmful, risky, or materially changes agreed scope.

If any blocker remains, report the evidence, route it through `/diagnose`, and
stop without presenting a checkpoint. When no blockers remain, present a
checkpoint even if it includes non-blocking findings or clearly stated
verification limitations.

### 4. If no blockers remain

Present the checkpoint and stop:

```
[CHECKPOINT]

Done and checked: <one or two sentences>
Outcome evidence: <verified / failed / unverified summary>
Checks: <commands and exit codes; deferred checks with reasons>
Non-blocking findings and remaining limitations: <items, or "none">

Waiting on you:
- A) Refine — tell me what to adjust in this phase.
- B) Next phase — move on to the next slice.
- C) Adjust the roadmap — change what's coming, based on what we learned.
- D) Milestone done — close it out and start the next one.
```

## Do not

- Never advance past the checkpoint on your own, however obvious the next step
  looks.
- Don't present a checkpoint while material blockers remain. Report
  non-blocking findings and verification limits transparently.
- Don't review it yourself and call the result independent.

## For a wave

When the manifest in `artifacts.active_wave` names the build, one `/steer` reviews
every phase in it, on the wave branch:

1. **One fresh reviewer per spec, in parallel.** Each walks only its own *How we
   will know it works* list and reports outcomes with evidence.
2. **One integration reviewer**, also fresh, checks cross-lane behavior and
   shared files after the merge.
3. **Run targeted and integration checks** against the merged wave branch.
   Select broader regression checks when the combined change crosses components
   or has significant risk; run the full historical suite at the milestone
   boundary. Report actual exit codes and deferred checks with reasons.
4. **Every finding is recorded.** Defects outside any spec's scope go through
   `/log`. Failures go to `/diagnose`.
5. **One checkpoint**, with a line per phase and outcome verification status,
   blockers separated from non-blocking findings, check results and limitations.
