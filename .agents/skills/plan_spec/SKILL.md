---
name: plan_spec
description: Technical process instructions for feature spec planning. Spawned during /plan to draft a feature spec for the active milestone/phase, including data contracts and a testable acceptance-criteria matrix that the critic subagent will later audit against independently.
---

# Feature Spec Planning Process

Write specs that a different agent, with no memory of your reasoning, must be able to verify implementation against.

## Quality & Precision Constraints
- **Raw Material Input**: Read `.gsd/FEATURES.md` and `.gsd/BUGS.md` for candidate feature requests (`FEAT-xxx`) and bugs/scope gaps (`BUG-xxx`) assigned to the active milestone. Update their status in `.gsd/FEATURES.md` or `.gsd/BUGS.md` to `IN_PLANNING` upon inclusion in the draft spec.
- **Binding Resolved Ambiguities**: Must include explicit resolution of edge cases, mathematical operators (`>=` vs `>`), exact float/boundary conditions (`[-20.0, 0.5]` vs `-20.01`), gate interactions, and fallback retention rules.
- **Data Schema & Contracts**: Exported constants, interfaces, and explicit symbol inventory (modified vs untouched).
- **Pure Logic vs Stateful Integration Contracts**: Separate pure logic function signatures from stateful frame/render integration logic. Explicitly document no-match return values (`hasActiveFrets: false`) and caller branching requirements so fallback placeholders never leak into state.
- **Refactoring & Legacy Cleanup**: Identify any obsolete registration loops, legacy map aliases, or side effects to be purged during refactoring to prevent regressions.
- **Granular Testable AC Matrix**: Every acceptance criterion must be specific enough that "does the code do this or not" has an unambiguous answer. Must cover normal operation, boundary edge cases, degenerate/empty inputs, stateful frame integration, lockstep synchronization, fallback preservation, and an explicit **Scope Guardrail AC** listing untouched files. **Check whether `git diff --name-only` against a meaningful base commit is actually viable in this repo before specifying it** (in a repo with few or no prior commits covering the work in question, it isn't — this exact unverifiable-criterion mistake recurred five times across one project's history before being fixed). If it isn't viable, specify a pre/post-execution SHA-256 content-manifest diff instead (`git ls-files -co --exclude-standard -z | xargs -0 sha256sum`, taken before the executor's first edit and again at the end) and say so explicitly in the AC text, rather than writing a criterion the executor can't actually satisfy.
- **No Implementation Code**: Types, signatures, contracts, and AC matrix only — no implementation code in the spec.
- **Strict Read-Only Execution**: Do NOT call any code-editing tools (`replace_file_content`, `write_to_file`, `multi_replace_file_content`) on project source files during spec planning.

## Output: `.gsd/active/<milestone>_<phase>_feature_spec.md` (e.g. `M4_P10_feature_spec.md`), written as UTF-8 (`.gsd/HARD_RULES.md` rule 14) — verify the file is valid UTF-8 after writing it, don't assume the write tool's default encoding on this platform is correct.
**Before writing, check `.gsd/active/` for any other file left from a prior phase — do not silently delete or ignore it.** `verify_steer` should have already archived it at `/steer`, but if one is still there, that's a signal something didn't close out cleanly (rule 10); stop and confirm with the user whether it represents unfinished work before proceeding, rather than assuming it's safe to overwrite. Update `.gsd/STATE.json`'s `artifacts.active_spec` to this new filename, and add an `"agent"` field to the `state_history` entry recording this (rule 11).

Use `.gsd/templates/FEATURE_SPEC_TEMPLATE.md` as the base structure.

**Keep `.gsd/ROADMAP.md`'s "Estimated phases" line current for this milestone.** If this phase's scoping reveals the milestone needs more (or fewer) phases than the roadmap currently says, update that milestone's "Estimated phases" line in the same edit — this is the only place `/steer` can read from to tell the user whether more phases are coming after the one just completed, so a stale count there defeats the purpose. If a milestone entry predates this field and has none, add it now rather than leaving it blank.

Hand off with: "Review this feature specification. Reply with SPEC_APPROVED to begin execution."

