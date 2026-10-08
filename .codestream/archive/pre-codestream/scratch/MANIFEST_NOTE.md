# M26_P1 Amendment 1 — Scope Guard Manifest (Single Point-in-Time Attestation)

## Retraction of the prior pre/post pair (2026-08-21)

The `manifest_pre.txt` / `manifest_post.txt` pair previously in this directory
was found by the independent critic's second re-audit pass to be fabricated,
not a real pre/post diff: both files contained an identical
self-referential SHA-256-of-empty-string line for `manifest_post.txt` itself,
and file mtimes showed `manifest_pre.txt` was written *after*
`manifest_post.txt` — meaning "pre" was derived from "post" rather than
captured before this diagnosed follow-up's own edits. A manifest built that
way cannot detect the error class (drive-by edits outside the authorized file
list) it exists to catch.

`manifest_pre.txt` has been **deleted**. It is not being reconstructed,
because a genuine pre-edit snapshot for this follow-up window no longer
exists to reconstruct from — any file claiming to be one at this point would
be exactly the same kind of fabrication being retracted here.

## What remains: `manifest_post.txt`

`manifest_post.txt` is now a single point-in-time attestation of the current
working tree, regenerated honestly at 2026-08-21T15:38:04Z — after the AC-16
test-coverage extension in `apps/web/test/App.test.tsx`, after the two stale
comments the third critic pass flagged (F7) were corrected in that same file,
and after this note's own final wording settled. (An earlier version of this
file, generated mid-edit, understated its own timestamp and was superseded —
this is the current, accurate regeneration; it does not itself list a stale
`manifest_pre.txt` entry, confirming that file is genuinely gone.) Generated
the same way as before: `git ls-files -co --exclude-standard` (every tracked +
untracked-but-not-gitignored file), each hashed with `sha256sum --text`,
sorted.

This file is **not a diff**. It proves nothing about what changed during this
follow-up window on its own — there is no corresponding "pre" file left to
compare it against. Treat it only as a record of the tree's exact contents at
that timestamp, useful for a future session to compare against if it captures
its own honest "before" snapshot first.

## What actually supports the scope claim for this follow-up

This follow-up's own change is narrow and independently checkable by reading
it directly, not by a manifest diff: it modified exactly one file,
`apps/web/test/App.test.tsx` (extending the existing `AC-16: hamburger
reaches non-editor routes through App's real navigation tree` describe block
with 7 additional test cases — `equipment`, `mashProfiles`,
`fermentationProfiles`, `waterProfiles`, `inventory`, `calculators`,
`batchDetail` — alongside the pre-existing 3), plus the two files in this
`.gsd/scratch/` directory. No application source file (`Sidebar.tsx`,
`TopBar.tsx`, `MobileNav.tsx`, `App.tsx`, or any of the 15 Amendment-1
components/forms) was touched.

## What this file has never covered, and still does not

Neither this manifest nor its retracted predecessor can retroactively prove
the *original* Amendment 1 component-wiring build (the 15 source files + their
test files, executed before this diagnosed follow-up began) touched only
authorized files — no genuine pre-edit manifest was ever captured for that
build. That build's scope remains independently supported by the critic's own
first-pass audit method: full-tree SHA-256 recomputation plus mtime
bisection (see `.gsd/archive/CRITIC_REPORT.md`, the dated entry for that
audit), not by any file in this directory. This note does not re-litigate
that finding; it only states plainly that this directory's manifest was never
the mechanism that established it.
