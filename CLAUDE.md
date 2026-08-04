# Architect Framework — Claude Code Port

Ported from the Antigravity-native `architect-template`, with two customizations:
1. A two-speed entry point (prototype-first, not spec-first-always).
2. Vertical-slice milestones (not layer-based) and independent critic verification.

## Protected paths — never delete or overwrite
`CLAUDE.md`, `.claude/` (this directory), `.agents/`, and `.gsd/` are the framework itself, not project output. No skill, subagent, or scaffolding step — including `/prototype` and its `prototyper` subagent — may delete, move, mass-overwrite, or `rm -rf` these paths under any circumstance, including "clean slate" project scaffolding, template initializers (`npm create`, `create-vite`, etc.), or full-repo resets. If a scaffolding tool would normally wipe the target directory, run it in a temp directory and copy only the app files in, or scaffold in place file-by-file instead. If these paths ever go missing, stop and tell the user immediately rather than proceeding — do not silently continue.

## Entry point
Start with `/onboard`. It routes to:
- **`/prototype`** — raw, unvalidated idea. Minimal ceremony, fast walking skeleton.
- **`/discover`** — idea is already validated/clear enough to spec directly.
- **Existing codebase audit** — formalizes what's already there via `codebase-mapper`.

## The full lifecycle
```
/onboard → /prototype → (user validates) → /promote ─┐
                                                        │
/onboard → /discover ─────────────────────────────────┼─→ /map → /plan →
                                                                  [SPEC_APPROVED] →
                                                        /execute → /verify ───┐
                                                        (pass) → /steer       │
                                                        (fail - local) → /diagnose → back to /execute, /plan, or /discover
                                                        (fail - widespread) → /reset → clean checkpoint → /plan or /discover
```

## Hard rules (non-negotiable regardless of track)
1. No implementation code before either a prototype's validation target is explicit, or a spec is approved with the literal string `SPEC_APPROVED`.
2. Milestones must be **vertical slices** — a user-visible outcome — never a horizontal layer (types-only, backend-only, UI-only). See `.claude/agents/roadmapper.md`.
3. `/verify` never trusts the executor's own tests as proof of correctness. It runs three layers: executor's tests, an independent `critic` audit against the approved spec, and a regression pass across all prior milestones.
4. Any verification failure routes through `/diagnose` before any fix is attempted — implementation bug, spec error, and misunderstood intent are fixed at different layers (`/execute`, `/plan`, `/discover` respectively), and patching at the wrong layer tends to reproduce the same class of bug later.
5. `/steer` is a mandatory halt. Never auto-advance past it, even when the next step seems obvious.
6. **Strict alternation rule**: `.gsd/` state is shared between Claude Code and Antigravity (Gemini). Only one assistant operates on the active phase at a time; check `.gsd/STATE.json` before starting a session.
7. **Lightweight-task exception**: a small, self-contained edit (numeric/config tweaks, single-file fixes, doc/log corrections) that introduces no new user-visible capability skips the spec/execute/verify/steer ceremony entirely — no spec, no critic, no steering log update. Just make the edit and confirm it with the user. If a "small" change turns out to touch multiple files, cross a milestone boundary, or introduce new behavior, stop and route it back into the normal lifecycle instead.
8. **Framework paths are protected** (see "Protected paths" above). This overrides any instinct to regenerate/reset the project directory during prototyping or scaffolding.

## Directory reference
```
.claude/
├── skills/
│   ├── onboard/SKILL.md
│   ├── prototype/SKILL.md      ← fast track
│   ├── promote/SKILL.md        ← prototype → structured handoff
│   ├── discover/SKILL.md       ← State 0
│   ├── plan/SKILL.md           ← State 2
│   ├── execute/SKILL.md        ← State 3
│   ├── verify/SKILL.md         ← 3-layer check
│   ├── diagnose/SKILL.md       ← root-cause routing
│   ├── steer/SKILL.md          ← State 4
│   ├── research/SKILL.md       ← feasibility & trade-offs
│   └── reset/SKILL.md          ← state & code rollback
└── agents/
    ├── codebase-mapper.md
    ├── intent-discoverer.md
    ├── prototyper.md
    ├── roadmapper.md            ← vertical-slice enforcement
    ├── planner.md
    ├── executor.md
    ├── critic.md                ← independent correctness audit
    ├── verifier.md              ← steering-log summarizer
    ├── researcher.md            ← feasibility & prompt refinement
    └── reset-specialist.md      ← safe rollback & state alignment
```
.gsd/                            ← runtime state, unchanged across IDEs
├── STATE.json
├── DISCOVERY.md
├── ROADMAP.md
├── drafts/                      ← ungated spec drafts (never SPEC_APPROVED) — not part of the tracked lifecycle
├── active/                      ← only what's needed to build the NEXT thing — the only place agents read from
│   ├── <milestone>_<phase>_feature_spec.md  ← current phase's approved spec, e.g. M4_P3_feature_spec.md (name tracked in STATE.json's artifacts.active_spec)
│   └── manual_verification/     ← current milestone's in-progress screenshot evidence
└── archive/                     ← historical record, kept on disk, not auto-read by agents
    ├── specs/                   ← completed milestones' specs
    ├── manual_verification/<milestone>_<phase>/
    ├── CRITIC_REPORT.md         ← cumulative log across all milestones
    ├── VERIFICATION_REPORT.md   ← cumulative log across all milestones
    ├── STEERING_LOG.md          ← cumulative log across all milestones
    └── pre_reset/               ← specs/roadmap from before the 2026-07-24 full intent reset
```

`critic` reads only the single spec file in `.gsd/active/` (never a glob over historical specs). `verifier` moves the outgoing spec and manual-verification evidence into `archive/` at `/steer`, once a milestone/phase genuinely closes.

## Project-specific context
