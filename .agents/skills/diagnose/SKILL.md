---
name: diagnose
description: Use whenever a bug, wrong behavior, or critic FAIL is found — either during /verify or discovered later while using the app. Determines root cause before any fix is attempted, so patches don't just produce a differently-broken version of the same problem.
---

# Diagnose: Find the Real Root Cause Before Fixing Anything

**Rule:** Do not let the executor (or yourself) jump straight to a patch. A bug found "down the line" almost always has one of three distinct causes, and each needs a different fix. Misdiagnosing which one wastes a fix cycle and often reintroduces the same class of bug later.

## The three causes

1. **Implementation bug** — the spec was right, the code just doesn't do what the spec says.
   → Fix: straightforward. Re-run `/execute` for that specific piece, re-verify.

2. **Spec was wrong or ambiguous** — the code faithfully does what the spec said, but the spec itself didn't capture the actual requirement.
   → Fix: do NOT patch the code first. Go back to `/plan` for that milestone, correct the spec, get it re-approved (`SPEC_APPROVED`), then re-execute. Patching code against a spec that's still wrong just creates a second gap between spec and reality.

3. **Original intent was misunderstood** — the spec matches what was asked for in `/discover`, but what was asked for wasn't actually what was needed. This usually surfaces as "technically correct, but not useful."
   → Fix: go back further, to `.gsd/DISCOVERY.md`. Re-open the relevant question, get a corrected answer from the user, and let that cascade forward through `/map` and `/plan` again. Do not try to patch your way out of a wrong premise at the execution layer.

## Process

0. **Request a pointer before searching.** If the user's report doesn't already cite a milestone/phase and AC ID, ask for one before scanning anything: "Which milestone/phase and AC does this relate to, if known?" A cited AC lets you jump directly to the relevant spec section and implementation instead of re-reading the codebase to locate it. Only fall back to a broader search if the user genuinely doesn't know (e.g. behavior found outside any tested flow) — don't skip asking just because a rough guess is possible.

1. Gather: what was expected, what actually happens, and where in the pipeline this was caught (critic report, regression failure, or a bug you noticed while using the app). `.gsd/archive/CRITIC_REPORT.md` is a cumulative log across every milestone — use the milestone/phase id (from the user or `.gsd/STATE.json`) to jump straight to that section rather than reading the whole file.
2. Trace backward: check the implementation against the spec first (cause 1 vs. 2), then check the spec against the original discovery answers if the spec looks faithful but still feels wrong (cause 2 vs. 3).
3. State the diagnosis explicitly before doing anything else:
   ```
   DIAGNOSIS: <implementation bug | spec error | intent misunderstanding>
   REASONING: <why — one or two sentences>
   ROUTE TO: <execute | plan | discover>
   ```
4. Route accordingly. Never fix at a layer below where the diagnosis points — that's the shortcut that causes the same bug to resurface later in a new form.

## Note on cost
Cause 3 is the expensive one — it can unwind several milestones' worth of downstream work. This is exactly why `/prototype` mode exists earlier in the flow: catching an intent misunderstanding on a throwaway walking skeleton is cheap; catching it three structured milestones deep is not. If you're hitting cause-3 diagnoses often on structured work, that's a signal the corresponding `/prototype` step was skipped or rushed.
