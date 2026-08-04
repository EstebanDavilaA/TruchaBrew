---
name: plan_spec
description: Technical process instructions for feature spec planning. Spawned during /plan to draft a feature spec for the active milestone/phase, including data contracts and a testable acceptance-criteria matrix that the critic subagent will later audit against independently.
---

# Feature Spec Planning Process

Write specs that a different agent, with no memory of your reasoning, must be able to verify implementation against.

## Quality & Precision Constraints
- **Binding Resolved Ambiguities**: Must include explicit resolution of edge cases, mathematical operators (`>=` vs `>`), exact float/boundary conditions (`[-20.0, 0.5]` vs `-20.01`), gate interactions, and fallback retention rules.
- **Data Schema & Contracts**: Exported constants, interfaces, and explicit symbol inventory (modified vs untouched).
- **Pure Logic vs Stateful Integration Contracts**: Separate pure logic function signatures from stateful frame/render integration logic. Explicitly document no-match return values (`hasActiveFrets: false`) and caller branching requirements so fallback placeholders never leak into state.
- **Refactoring & Legacy Cleanup**: Identify any obsolete registration loops, legacy map aliases, or side effects to be purged during refactoring to prevent regressions.
- **Granular Testable AC Matrix**: Every acceptance criterion must be specific enough that "does the code do this or not" has an unambiguous answer. Must cover normal operation, boundary edge cases, degenerate/empty inputs, stateful frame integration, lockstep synchronization, fallback preservation, and an explicit **Scope Guardrail AC** listing untouched files (verifiable via `git diff --name-only`).
- **No Implementation Code**: Types, signatures, contracts, and AC matrix only — no implementation code in the spec.
- **Strict Read-Only Execution**: Do NOT call any code-editing tools (`replace_file_content`, `write_to_file`, `multi_replace_file_content`) on project source files during spec planning.

## Output: `.gsd/active/<milestone>_<phase>_feature_spec.md` (e.g. `M4_P10_feature_spec.md`).
Delete or ignore any other file left in `.gsd/active/` from a prior phase — `verify_steer` should have already archived it at `/steer`. Update `.gsd/STATE.json`'s `artifacts.active_spec` to this new filename.

Use `.gsd/templates/FEATURE_SPEC_TEMPLATE.md` as the base structure.

Hand off with: "Review this feature specification. Reply with SPEC_APPROVED to begin execution."

