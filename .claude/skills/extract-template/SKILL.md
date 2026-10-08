---
name: extract-template
description: Use to push framework improvements made in this project (new/edited skills, subagents, hard rules, spec templates) back upstream to the SLIPSTREAM template at /run/media/eda/944A97BC4A979A16/Dev/Templates/SLIPSTREAM, so future projects start from the battle-tested version. Triggered by /extract-template, or phrases like "sync the template", "push these framework changes to SLIPSTREAM", "update the template repo".
---

# Extract Template: Propagate Framework Improvements Upstream

**Rule:** This project's `.claude/`, `.agents/`, and `.gsd/HARD_RULES.md`/`.gsd/templates/` are a downstream, battle-tested copy of the `SLIPSTREAM` template at `/run/media/eda/944A97BC4A979A16/Dev/Templates/SLIPSTREAM`. When this project refines the framework itself (a new skill, a hardened agent prompt, a new hard rule, a corrected spec template), that improvement is only useful to future projects once it's copied back upstream. This skill does that copy — diff first, scrub project-specific content, get explicit approval, then write. It never commits or pushes inside the template repo on its own initiative.

This is framework tooling, not a TruchaBrew feature — it is exempt from the `SPEC_APPROVED` lifecycle (`CLAUDE.md` rule 1 governs app code; this skill never touches `apps/`, `packages/`, or app-level `.gsd/` runtime state). Treat it like rule 7's lightweight-task exception: no spec, no critic, no steering log entry. Just diff, confirm, write.

## Non-negotiables

1. **Never write to the template repo without showing the user a diff-based summary first and getting explicit approval.** The template repo is a separate git repository (`/run/media/eda/944A97BC4A979A16/Dev/Templates/SLIPSTREAM/.git`) outside this project — writing to it is exactly the class of "affects a system beyond the local task" action that needs confirmation before, not after.
2. **Never run `git add`, `git commit`, or `git push` inside the template repo.** Leave the working tree changed and let the user review (`git -C <template> status`/`diff`) and commit themselves, unless they explicitly ask you to commit for them in this same conversation.
3. **Never delete a template-only file or directory** (something the template has that the project doesn't) without calling it out and getting explicit confirmation — it may be intentionally generic scaffolding the project simply hasn't needed yet, not something to prune to match the project.
4. **Check the template repo's own working tree state before touching it.** If `git -C <template> status --short` already shows uncommitted changes, surface them to the user before proceeding — you could otherwise be copying on top of the user's own in-progress template edits, or your diff could be misleadingly attributed to this project when some of it is already-uncommitted template work.
5. **Never copy project-identifying content verbatim.** Scrub before proposing (see "Genericize before proposing" below).

## Scope — what counts as "template material"

Compare only these paths between the project root and the template root. Anything else in the project is either app code or project-runtime state, not framework material.

**In scope (diff and propose):**
- `CLAUDE.md`
- `.gsd/HARD_RULES.md`
- `.gsd/templates/**` (spec/roadmap/state-schema/steering-checkpoint templates)
- `.claude/skills/**/SKILL.md`
- `.claude/agents/**/*.md`
- `.agents/AGENTS.md`
- `.agents/skills/**/SKILL.md`
- `.agents/workflows/**/*.md` — legacy structure. If the project has deleted files here in favor of `.agents/skills/`, that is a **structural** change to propose (retire the workflow file and confirm/create its `.agents/skills/` counterpart in the template), not a content diff to ignore because the file is "just gone."

**Out of scope (never diff or touch):**
- `.gsd/STATE.json`, `.gsd/ROADMAP.md`, `.gsd/DISCOVERY.md`, `.gsd/BUGS.md`, `.gsd/FEATURES.md`, `.gsd/active/**`, `.gsd/archive/**`, `.gsd/documents/**`, `.gsd/scratch/**` — this project's runtime state, never template content.
- `.claude/settings.json`, `.claude/settings.local.json` — contains this machine/project's literal paths and permission allowlist, not generic framework config.
- `README.md`, `LICENSE`, `.gitattributes`, `.gitignore` at the project root — project packaging, not framework. (The template's own `README.md` documents the framework and is edited directly in the template repo, not derived from the project's.)
- `apps/`, `packages/`, and everything else that is the actual application.

If the user asks to extract something outside this default scope (e.g. a specific `.gsd/templates` addition that isn't listed, or a genuinely reusable snippet from README.md), treat that as an explicit one-off addition to the scope for this run — call it out in the summary like any other proposed change.

## Process

1. **Resolve paths.** Project root = current working directory. Template root = `/run/media/eda/944A97BC4A979A16/Dev/Templates/SLIPSTREAM` unless the user names a different template location. Confirm both exist.

2. **Check template repo cleanliness first** (non-negotiable 4). Run `git -C <template> status --short`. If it's dirty, show the user what's already changed there before your own diff, so they aren't confused about provenance later.

3. **Diff in-scope paths.** For each path in scope:
   - File exists in both, content differs → **candidate update**.
   - File exists in project only → **candidate addition**.
   - File exists in template only → **leave alone**, just note it exists (never a candidate for deletion without separate explicit confirmation per non-negotiable 3).
   - A whole directory concept changed (e.g. `.agents/workflows/` emptied out, `.agents/skills/` populated) → **candidate structural change**, described in prose, not just a file list.

4. **Genericize before proposing.** Before adding any project → template change to the summary, scan the actual diff text (not just the filename) for project-identifying content and strip or generalize it:
   - The project's own name/brand (e.g. "TruchaBrew") and domain vocabulary (e.g. brewing/kettle-specific terms) used as if they were generic framework language.
   - Hardcoded absolute paths specific to this machine/project (`/run/media/.../TruchaBrew/...`, `/home/user/...`).
   - Emails, usernames, or other personal identifiers.
   - Concrete milestone numbers/examples (`M42`, `M37_P2`) used as illustrative text in agent/skill prompts — replace with a generic placeholder or a different, clearly-labeled example if the surrounding prose needs one.
   - App-specific package/path conventions (`apps/web`, `apps/api`) *unless* the template already documents that exact monorepo layout as its convention — check before assuming it needs stripping.

   If a diff is genuinely generic framework improvement (a new hard rule, a corrected process step, a new skill with no project-specific content), it needs no scrubbing — most hard-rule and skill-process changes will be like this.

5. **Present the summary before writing anything.** Group by file, one line per candidate change:
   ```
   UPDATE  .gsd/HARD_RULES.md         — adds rules 16–21 (generic, no scrubbing needed)
   ADD     .claude/skills/log/SKILL.md — new skill, ported from Gemini side per rule 16
   STRUCTURAL .agents/workflows/*.md → .agents/skills/*/SKILL.md — project retired workflows/ in favor of skills/; template still has both
   SKIP    CLAUDE.md "Project-specific context" section — TruchaBrew-specific, not propagated
   ```
   Ask the user to approve the whole batch, approve a subset, or adjust. Do not write until they respond.

6. **Apply approved changes.** Copy file contents (or hand-edit for partial/scrubbed diffs) into the template repo at the matching path. For `.gsd/templates/STATE_SCHEMA_TEMPLATE.json` or any other JSON file, read-parse-mutate-serialize rather than text-splicing (same discipline as `CLAUDE.md` rule 17, applied here because it's the same failure mode). Create new directories as needed for additions.

7. **Verify and report.** Re-run `git -C <template> status --short` and `git -C <template> diff --stat` and show the user what actually landed. Remind them the template repo's changes are uncommitted — they review and commit (or discard) at their own pace; this skill does not do it for them.
