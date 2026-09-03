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
                                                        /execute (Layer 1, halts) → user runs /steer ───┐
                                                        (Layer 2/3 pass) → checkpoint presented          │
                                                        (fail - local) → /diagnose → back to /execute, /plan, or /discover
                                                        (fail - widespread) → /reset → clean checkpoint → /plan or /discover
```

## Hard rules (non-negotiable regardless of track)

> **Canonical source: `.gsd/HARD_RULES.md`.** This section is a full copy for auto-load reliability, kept byte-identical (modulo tool-specific names) with `AGENTS.md`'s copy. If you edit a rule, edit `.gsd/HARD_RULES.md` first, then mirror the change into both this file and `AGENTS.md` in the same sitting.

1. No implementation code before either a prototype's validation target is explicit, or a spec is approved with the literal string `SPEC_APPROVED`.
2. Milestones must be **vertical slices** — a user-visible outcome — never a horizontal layer (types-only, backend-only, UI-only). See `.claude/agents/roadmapper.md`.
3. Neither `/execute` nor `/steer` trusts the executor's own tests as proof of correctness. `/execute` runs Layer 1 (executor's tests, plus typecheck/build/lint — rule 13) and then halts; `/steer` runs Layer 2 (an independent `critic` audit against the approved spec) and Layer 3 (a regression pass across all prior milestones) before presenting the steering checkpoint. See rule 15 for why Layer 2/3 moved out of an auto-chain and into `/steer`.
4. Any verification failure routes through `/diagnose` before any fix is attempted — implementation bug, spec error, and misunderstood intent are fixed at different layers (`/execute`, `/plan`, `/discover` respectively), and patching at the wrong layer tends to reproduce the same class of bug later.
5. `/steer` is a mandatory halt. Never auto-advance *past* it, even when the next step seems obvious — but see rule 15: the halt happens *at* the checkpoint, not before reaching it.
6. **Strict alternation rule**: `.gsd/` state is shared between Claude Code and Antigravity (Gemini). Only one assistant operates on the active phase at a time; check `.gsd/STATE.json` before starting a session — see rule 10 for what "check" concretely means.
7. **Lightweight-task exception**: a small, self-contained edit (numeric/config tweaks, single-file fixes, doc/log corrections) that introduces no new user-visible capability skips the spec/execute/verify/steer ceremony entirely — no spec, no critic, no steering log update. Just make the edit and confirm it with the user. If a "small" change turns out to touch multiple files, cross a milestone boundary, or introduce new behavior, stop and route it back into the normal lifecycle instead. **Lean on this exception readily** — don't default to full ceremony for a genuinely small change just because heavier process is available.
8. **Framework paths are protected** (see "Protected paths" above). This overrides any instinct to regenerate/reset the project directory during prototyping or scaffolding.

### 10. Cross-tool pre-flight integrity check — mandatory, hard-blocking
Before taking **any** action in a project where `.gsd/STATE.json` already exists — not only at literal `/onboard`, but at the start of *every* session regardless of which skill is invoked first — check, in order: (1) read `.gsd/STATE.json` in full; (2) check the most recent `state_history` entry's `agent` field (rule 11) and `state` value — if it names Antigravity/Gemini and doesn't look like a natural halt point (`state: 4`, or an "AWAITING SPEC_APPROVED"/"AWAITING re-SPEC_APPROVED" halt), **stop and tell the user plainly** before doing anything else, including read-only work; (3) verify `.gsd/active/` holds at most one spec file matching `artifacts.active_spec` — if not, **stop and flag it** rather than silently picking one; (4) verify that spec file and `STATE.json` are valid UTF-8 AND that `STATE.json` parses as valid JSON — an actual parse, not merely a UTF-8 decode; these are independent failure modes, and a file can pass one while failing the other. This is **hard-blocking**: a warning is easy to skim past under time pressure, and this exact failure mode already cost real time more than once (see `.gsd/HARD_RULES.md`'s changelog note).

### 11. State provenance
Every `state_history` entry appended to `.gsd/STATE.json` must include an `"agent"` field: `"claude-code"` or `"antigravity-gemini"`. This is what rule 10 reads. Add it retroactively if you find an entry missing it.

### 12. Archive files are append-only
`.gsd/archive/CRITIC_REPORT.md`, `VERIFICATION_REPORT.md`, and `STEERING_LOG.md` are cumulative logs across the entire project's lifetime. Read the current file first, then **append** a new dated section — never truncate or overwrite existing content.

### 13. Layer 1 (run by `/execute`) is four gates, not one
"Run the executor's tests" means the test suite **and** typecheck **and** build **and** lint — all four, all reported by exit code — not just whichever the spec's own AC matrix happened to enumerate. A green test suite with a broken build is not a Layer 1 pass; test runners that strip types (Vitest/esbuild) are structurally incapable of catching a type-contract regression. Layer 1 runs inside `/execute` itself now (rule 15) — it is not deferred to a separate `/verify` invocation.

### 14. UTF-8, no BOM, for every framework file
Specs, `STATE.json`, archive logs, `.gsd/BUGS.md`, `.gsd/FEATURES.md` — all UTF-8 text. If a tool's file-write path defaults to something else on a given platform, that's a bug in that session to route around, not a variance to leave for the next reader to discover.

### 15. `/execute` halts after Layer 1; Layer 2/3 (critic + regression) run inside `/steer`, not auto-chained from `/execute`
Added 2026-08-15 after `/execute` auto-chaining straight into `/verify` (which immediately spawned `critic`) was found to be burning tokens at a high rate — the critic audit and the regression pass were firing in the same continuous context as the entire build, compounding the executor's already-large context with two more agent-heavy steps before any human had a chance to look at the result.

`/execute` no longer hands off into `/verify` automatically. After building the slice, it runs Layer 1 itself (tests + typecheck + build + lint, rule 13), reports the result, and **halts** — waiting for the user to explicitly invoke `/steer` when ready to proceed. There is no more reflexive critic pass after every build.

`/steer`, before presenting the checkpoint, now runs Layer 2 (independent `critic` audit against the approved spec) and Layer 3 (cross-milestone regression) itself, in a fresh context rather than one still carrying the executor's full build transcript. Once Layer 2/3 clear, `/steer` presents the checkpoint in that same turn — do not stop and wait for a second explicit trigger between "Layer 2/3 passed" and the options block; that half of rule 5's halt-at-the-checkpoint (not before it) still applies. If Layer 2 FAILs or Layer 3 finds a regression, route to `/diagnose` instead of presenting the checkpoint (same handling as before, just evaluated one step later than it used to be).

`/verify` still exists as a standalone, user-invoked Layer-1-only recheck — it is no longer the place Layer 2/3 live.

### 16. Suggested division of labor (soft preference, not enforced)
Antigravity/Gemini defaults to `/steer`, state-reading/roadmap-and-bug triage (`/log`), and lightweight-task-exception repairs (rule 7) — faster turnaround suits this class of work. Claude Code defaults to `/plan`, `/execute`, and `/steer`'s critic layer for larger multi-file work. Either tool can do any step; this is a default lean for which tool to open, not a restriction, and it never relaxes rules 1–15.

### 17. `STATE.json` is edited structurally, never by raw text paste
Any change to `STATE.json` (or any other framework JSON file) is made by reading the file, parsing it as JSON, mutating the in-memory structure, and serializing it back out — never by pasting, concatenating, or string-inserting raw text into the file, and never by writing a new document's content into the middle of an existing string field. Immediately after the write, re-read the file and run an actual JSON parse against it before treating the write as complete. If that parse fails, this is a blocking corruption event: stop immediately and report it, rather than leaving a broken file for a future session's rule-10 pre-flight to discover later.

### 18. Log every lifecycle step to `state_history` as it happens, not in a retroactive batch
Every `/plan` draft, every `SPEC_APPROVED` (or re-`SPEC_APPROVED`), every `/execute` completion, every individual `/verify` layer result, and every `/steer` decision gets its own `state_history` entry appended **before moving on to the next step** — including multiple steps completed within one continuous session. Do not defer logging until the session's end, and do not compress several distinct lifecycle steps into a single summary entry written after the fact. An entry written after the work is unverifiable narrative; an entry written as each step completes is the actual audit trail rule 10's pre-flight check depends on.

### 19. A critic-report citation must point at an entry that already exists
Before `VERIFICATION_REPORT.md`'s Layer 2 section cites a dated `CRITIC_REPORT.md` entry (by date, milestone/phase, or verdict), that exact entry must already be written and saved on disk — confirm by reading `CRITIC_REPORT.md` back, not by assuming the critic step happened because it was supposed to. If Layer 2 was skipped, deferred, or the `critic` subagent was unavailable in that pass, `VERIFICATION_REPORT.md` must say so plainly ("Layer 2: not run this pass") rather than write a verdict that implies an audit occurred.

### 20. Archiving a spec removes the `active/` copy in the same action
When `/steer` (or the `verifier` subagent) archives a spec into `.gsd/archive/specs/` at milestone/phase closure, the corresponding copy in `.gsd/active/` is removed as part of that same action — verified afterward by re-listing `.gsd/active/`, not assumed to have succeeded. A byte-identical duplicate left behind in `active/` is exactly the ambiguity rule 10 point 3 exists to catch in whichever session opens next.

### 21. `state_history` is archived by milestone boundary, not left to grow unbounded
When `/steer` closes out a milestone (not a phase — phases within an open milestone stay inline), move every `state_history` entry belonging to milestones older than the current milestone and the one immediately before it out of `.gsd/STATE.json` and append them to `.gsd/archive/STATE_HISTORY.md`, in the same append-only style as rule 12's other archive files. `STATE.json` keeps only the current and immediately-prior milestone's entries inline. This is a `STATE.json` edit like any other — it goes through rule 17's read-parse-mutate-serialize-reparse discipline, not a text splice. Rule 10's pre-flight only ever needed the most recent entry plus the top-level state fields, both of which stay inline, so this doesn't weaken it.

## Directory reference
```
.claude/
├── skills/
│   ├── onboard/SKILL.md
│   ├── prototype/SKILL.md      ← fast track
│   ├── promote/SKILL.md        ← prototype → structured handoff
│   ├── discover/SKILL.md       ← State 0
│   ├── map/SKILL.md            ← existing-codebase audit → roadmap
│   ├── plan/SKILL.md           ← State 2
│   ├── execute/SKILL.md        ← State 3
│   ├── verify/SKILL.md         ← 3-layer check
│   ├── diagnose/SKILL.md       ← root-cause routing
│   ├── steer/SKILL.md          ← State 4
│   ├── research/SKILL.md       ← feasibility & trade-offs
│   ├── reset/SKILL.md          ← state & code rollback
│   └── log/SKILL.md            ← .gsd/BUGS.md & .gsd/FEATURES.md triage
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
├── HARD_RULES.md                ← canonical rules, mirrored into CLAUDE.md/AGENTS.md
├── STATE.json                   ← every state_history entry carries an "agent" field (rule 11)
├── DISCOVERY.md
├── ROADMAP.md
├── BUGS.md                      ← defect log (either tool)
├── FEATURES.md                  ← feature & UX backlog (either tool)
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
