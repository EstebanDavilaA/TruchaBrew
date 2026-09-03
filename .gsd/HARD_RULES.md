# GSD-Architect Hard Rules — Canonical, Tool-Agnostic

This file is the single source of truth for the framework's non-negotiable rules. `CLAUDE.md` (Claude Code) and `AGENTS.md` (Antigravity/Gemini) each embed a full copy of these rules — verbatim except for tool-specific names (e.g. "the `critic` subagent" vs. "the `audit_critic` skill") — because both files must be self-contained and auto-loaded by their respective tool; a pointer alone is not reliably read. **When these rules change, edit this file first, then copy the change into both `CLAUDE.md` and `AGENTS.md` in the same sitting.** If the three ever disagree, this file wins, and the disagreement itself is a bug to fix immediately, not a judgment call to make in the moment.

Added 2026-08-07 after a ~1-hour desync between a Claude Code session and an Antigravity/Gemini session working the same `.gsd/` state: `STATE.json` went stale, `CRITIC_REPORT.md`/`VERIFICATION_REPORT.md` were overwritten instead of appended (destroying prior milestones' audit trails), a spec file was written in the wrong encoding, two active specs coexisted, and a verification pass that only ran `npm test` (never typecheck/build/lint) reported PASS on a build that didn't compile. Rules 10–15 below close the specific gaps that let that happen. None of them are Gemini-specific or Claude-specific — they were latent in both tools' shared design and would have bitten either one.

Added 2026-08-13 after a fourth desync, this one larger: an Antigravity/Gemini session ran an entire M5.5_P5 build+verify, a cumulative M5.5 (P1–P4) critic audit, an M5.5-overall `/steer`, and an M6_P1 `/plan`→`/execute` cycle with **no `state_history` entries logged for any of it** until a single retroactive summary at the very end; `VERIFICATION_REPORT.md` cited a `CRITIC_REPORT.md` entry for M6_P1's Layer 2 that was never actually written, so a "PASS, 18/18 ACs" verdict had no backing artifact; a stale, already-archived spec copy was left duplicated in `.gsd/active/`; and — most seriously — `STATE.json` itself had been corrupted into invalid JSON (a second copy of the file pasted raw, unescaped, into the middle of one entry's text) in a way that passed every existing check, because rule 10 point 4 only verified UTF-8 decoding, never JSON-parseability. A Claude Code session caught all four only because it happened to try to `JSON.parse` the file for an unrelated reason. Rules 17–20 below close these specific gaps. Like rules 10–15, none of them are tool-specific — the file-corruption mechanism in particular could just as easily come from either tool's file-write path.

## Hard rules (non-negotiable regardless of track or tool)

1. No implementation code before either a prototype's validation target is explicit, or a spec is approved with the literal string `SPEC_APPROVED`.
2. Milestones must be **vertical slices** — a user-visible outcome — never a horizontal layer (types-only, backend-only, UI-only).
3. Neither `/execute` nor `/steer` trusts the executor's own tests as proof of correctness. `/execute` runs Layer 1 (executor's tests, plus typecheck/build/lint — rule 13) and then halts; `/steer` runs Layer 2 (an independent critic audit against the approved spec) and Layer 3 (a regression pass across all prior milestones) before presenting the steering checkpoint. See rule 15 for why Layer 2/3 moved out of an auto-chain and into `/steer`.
4. Any verification failure routes through `/diagnose` before any fix is attempted — implementation bug, spec error, and misunderstood intent are fixed at different layers (`/execute`, `/plan`, `/discover` respectively), and patching at the wrong layer tends to reproduce the same class of bug later.
5. `/steer` is a mandatory halt. Never auto-advance *past* it, even when the next step seems obvious — but see rule 15: the halt happens *at* the checkpoint, not before reaching it.
6. **Strict alternation rule**: `.gsd/` state is shared between Claude Code and Antigravity (Gemini). Only one assistant operates on the active phase at a time; check `.gsd/STATE.json` before starting a session — see rule 10 for what "check" concretely means.
7. **Lightweight-task exception**: a small, self-contained edit (numeric/config tweaks, single-file fixes, doc/log corrections) that introduces no new user-visible capability skips the spec/execute/verify/steer ceremony entirely — no spec, no critic, no steering log update. Just make the edit and confirm it with the user. If a "small" change turns out to touch multiple files, cross a milestone boundary, or introduce new behavior, stop and route it back into the normal lifecycle instead. **Lean on this exception readily** — don't default to full ceremony for a genuinely small change just because heavier process is available.
8. Framework paths are protected (`CLAUDE.md`, `.claude/`, `AGENTS.md`, `.agents/`, `.gsd/`) — never deleted, moved, or mass-overwritten by any skill or scaffolding step under any circumstance. If these paths ever go missing, stop and tell the user immediately rather than proceeding.
9. Milestones must be **vertical slices** (restated from rule 2 for emphasis, since horizontal-layer proposals are the single most common roadmap mistake): every milestone produces something a user can run and use, never a types-only/API-only/UI-only slice.

### 10. Cross-tool pre-flight integrity check — mandatory, hard-blocking

Before taking **any** action in a project where `.gsd/STATE.json` already exists — not only at literal `/onboard`, but at the start of *every* session regardless of which skill is invoked first — check, in order:

1. **Read `.gsd/STATE.json` in full.**
2. **Check the most recent `state_history` entry's `agent` field** (rule 11) and its `state` value. If it names the *other* tool and does not look like a natural halt point (`state: 4` / a `/steer` checkpoint, or an explicit "AWAITING SPEC_APPROVED" / "AWAITING re-SPEC_APPROVED" halt) — **stop and tell the user plainly** before doing anything else, including read-only work. Do not guess whether the other session is "probably done."
3. **Verify `.gsd/active/` contains at most one spec file, and that it matches `artifacts.active_spec`.** If more than one spec file exists, or the pointer doesn't match what's on disk, **stop and flag the discrepancy** rather than silently picking one or archiving the "old" one yourself.
4. **Verify that spec file, and `STATE.json`, are valid UTF-8 text with no encoding corruption, AND that `STATE.json` parses as valid JSON** — an actual `JSON.parse` / `json.load`, not merely a successful text decode. These are independent properties: a file can be perfectly valid UTF-8 while still being structurally broken JSON (this happened on 2026-08-13 — a second document pasted raw into one entry's text — and passed every UTF-8 check while being unparseable). Either failure is a cross-tool corruption signal and stops you.

This check is **hard-blocking**: if any of the four steps fails, do not proceed — surface the specific failure to the user and wait for their direction. This is deliberately stricter than a warning, because a warning is easy to skim past under time pressure, and this exact failure mode already cost real time more than once.

### 11. State provenance

Every `state_history` entry appended to `.gsd/STATE.json` must include an `"agent"` field: `"claude-code"` or `"antigravity-gemini"`. This is what rule 10's check reads. An entry without this field is itself a rule violation — add it retroactively if you find one missing (don't rewrite the entry's other content, just add the field).

### 12. Archive files are append-only

`.gsd/archive/CRITIC_REPORT.md`, `.gsd/archive/VERIFICATION_REPORT.md`, and `.gsd/archive/STEERING_LOG.md` are cumulative logs across the **entire project's lifetime**, not per-milestone scratch files. Before writing to any of them: read the current file first (if it exists), and **append** a new dated section — never truncate, replace, or overwrite existing content. A tool call that would write the whole file (rather than insert/append) needs the full prior content re-included, not discarded.

### 13. Layer 1 (run by `/execute`) is four gates, not one

"Run the executor's tests" means: the project's test suite **and** typecheck **and** build **and** lint — all four, all reported with their actual exit codes — not just whichever of these the spec's own AC matrix happened to enumerate. A green test suite with a broken build is not a Layer 1 pass. (Vitest/esbuild-style test runners strip TypeScript types without checking them — a passing test suite is structurally incapable of catching a type-contract regression, which is exactly what went undetected three times running before this rule existed.) Layer 1 runs inside `/execute` itself now (rule 15) — it is not deferred to a separate `/verify` invocation.

### 14. UTF-8, no BOM, for every framework file

Every file this framework writes or edits — feature specs, `STATE.json`, archive logs, `.gsd/BUGS.md`, `.gsd/FEATURES.md` — must be UTF-8 text (BOM-free preferred, but a BOM is recoverable; UTF-16 or other encodings are not acceptable). If a tool's default file-write path produces something else on a given platform, that is a bug in that session to route around (e.g. explicit encoding on write), not an acceptable variance to leave for the next reader to discover.

### 15. `/execute` halts after Layer 1; Layer 2/3 (critic + regression) run inside `/steer`, not auto-chained from `/execute`

Added 2026-08-15 after `/execute` auto-chaining straight into `/verify` (which immediately spawned `critic`) was found to be burning tokens at a high rate — the critic audit and the regression pass were firing in the same continuous context as the entire build, compounding the executor's already-large context with two more agent-heavy steps before any human had a chance to look at the result.

`/execute` no longer hands off into `/verify` automatically. After building the slice, it runs Layer 1 itself (tests + typecheck + build + lint, rule 13), reports the result, and **halts** — waiting for the user to explicitly invoke `/steer` when ready to proceed. There is no more "reflexive" critic pass after every build.

`/steer`, before presenting the checkpoint, now runs Layer 2 (independent critic audit against the approved spec) and Layer 3 (cross-milestone regression) itself, in a fresh context rather than one still carrying the executor's full build transcript. Once Layer 2/3 clear, `/steer` presents the checkpoint in that same turn — do not stop and wait for a second explicit trigger between "Layer 2/3 passed" and the options block; that half of rule 5's halt-at-the-checkpoint (not before it) still applies. If Layer 2 FAILs or Layer 3 finds a regression, route to `/diagnose` instead of presenting the checkpoint (same handling as before, just evaluated one step later than it used to be).

`/verify` still exists as a standalone, user-invoked Layer-1-only recheck (e.g. re-running tests/typecheck/build/lint after an unrelated environment change) — it is no longer the place Layer 2/3 live.

### 16. Suggested division of labor (soft preference, not enforced)

Documented user preference, not a restriction — either tool can do any step, and rules 1–15 apply identically regardless of which one is doing the work:
- **Antigravity/Gemini** defaults to `/steer`, state-reading and roadmap/bug triage (`/log`), and lightweight-task-exception-scale repairs (rule 7) — faster turnaround suits this class of work.
- **Claude Code** defaults to `/plan`, `/execute`, and `/verify`'s critic layer for larger multi-file work.
- This is a default lean for picking which tool to open for a given task, not a hard boundary — and it does not relax rules 1–15 for whichever tool is used.

### 17. `STATE.json` is edited structurally, never by raw text paste

Any change to `STATE.json` (or any other framework JSON file) is made by reading the file, parsing it as JSON into an in-memory structure, mutating that structure, and serializing it back out — never by pasting, concatenating, or string-inserting raw text into the file, and never by writing a new document's content into the middle of an existing string field. Immediately after the write, re-read the file and run an actual JSON parse against it before treating the write as complete. If that parse fails, this is a blocking corruption event: stop immediately and report it, rather than leaving a broken file for a future session's rule-10 pre-flight to discover later. This is the rule that would have prevented the 2026-08-13 incident (a second full copy of the file pasted raw and unescaped into one entry's text) at the moment it happened, instead of an unrelated session catching it afterward by accident.

### 18. Log every lifecycle step to `state_history` as it happens, not in a retroactive batch

Every `/plan` draft, every `SPEC_APPROVED` (or re-`SPEC_APPROVED`), every `/execute` completion, every individual `/verify` layer result, and every `/steer` decision gets its own `state_history` entry appended **before moving on to the next step** — including multiple steps completed within one continuous session. Do not defer logging until the session's end, and do not compress several distinct lifecycle steps into a single summary entry written after the fact. An entry written after the work is unverifiable narrative; an entry written as each step completes is the actual audit trail rule 10's pre-flight check depends on. This is the rule that would have caught the 2026-08-13 gap, where an entire M5.5_P5 build+verify, a cumulative M5.5 (P1–P4) critic audit, an M5.5-overall `/steer`, and an M6_P1 `/plan`→`/execute` cycle happened with zero corresponding entries until one retroactive summary at the very end.

### 19. A critic-report citation must point at an entry that already exists

Before `VERIFICATION_REPORT.md`'s Layer 2 section cites a dated `CRITIC_REPORT.md` entry (by date, milestone/phase, or verdict), that exact entry must already be written and saved on disk — confirm this by reading `CRITIC_REPORT.md` back, not by assuming the critic step happened because it was supposed to. If Layer 2 was skipped, deferred, or the critic subagent/skill was unavailable in that pass, `VERIFICATION_REPORT.md` must say so plainly ("Layer 2: not run this pass") rather than write a verdict that implies an audit occurred. This is the rule that would have caught the 2026-08-13 incident, where `VERIFICATION_REPORT.md` cited an M6_P1 critic entry — "PASS, 18/18 ACs" — that was never actually appended to `CRITIC_REPORT.md`.

### 20. Archiving a spec removes the `active/` copy in the same action

When `/steer` (or the verifier subagent/persona) archives a spec into `.gsd/archive/specs/` at milestone/phase closure, the corresponding copy in `.gsd/active/` is removed as part of that same action — verified afterward by re-listing `.gsd/active/`, not assumed to have succeeded. A byte-identical duplicate left behind in `active/` is exactly the ambiguity rule 10 point 3 exists to catch in whichever session opens next — don't create the ambiguity you already have a rule to detect.

### 21. `state_history` is archived by milestone boundary, not left to grow unbounded

Added 2026-08-24 after `.gsd/STATE.json` reached 374 `state_history` entries (~360KB, most of a full context window on its own) with no trimming mechanism — every rule-10 pre-flight was paying to load the project's entire lifetime history just to read the last entry and the current milestone/phase.

When `/steer` closes out a milestone (not a phase — phases within an open milestone stay inline), move every `state_history` entry belonging to milestones older than the current milestone and the one immediately before it out of `.gsd/STATE.json` and append them to `.gsd/archive/STATE_HISTORY.md`, in the same append-only style as rule 12's other archive files (read the existing archive first, append a new dated section, never truncate). `STATE.json` itself keeps only the current milestone's and the immediately-prior milestone's entries inline. This is a `STATE.json` edit like any other — it goes through rule 17's read-parse-mutate-serialize-reparse discipline, not a text splice.

Rule 10's pre-flight check is unaffected: it only ever needed the *most recent* entry and the top-level `current_state`/`active_milestone`/`active_phase` fields, all of which stay inline. Rule 19's critic-report citation check is unaffected too — citations are verified against `CRITIC_REPORT.md`, not `state_history`.
