# Discovery

What we're building, for whom, and why — written down before any technical
decisions. `/discover` fills this in by asking. `/roadmap` reads it to cut the
milestones.

Keep it short enough that somebody will actually read it.

---

## What is this?

TruchaBrew is a self-hosted homebrewing companion for a single brewer — recipe
design, batches, water chemistry, equipment and mash/fermentation profiles,
inventory and brew-day tracking in one app that runs on the brewer's own
computer. It is a deliberate replacement for a Brewfather subscription: same
kind of brewing math and workflow, but the recipes and batches live in a SQLite
file on the machine serving the app. No accounts, no cloud, no community recipe
library, nothing uploaded anywhere. A phone on the same wifi reaches it from the
brewery floor through an installable PWA.

## Who is it for?

One brewer who already knows how to brew and wants their own tool instead of a
subscription. Today that person either pays for Brewfather (or equivalent),
loses the vendor's numbers when the subscription lapses, or keeps the real
record in a spreadsheet that doesn't do the math. What's wrong with all three is
the same thing: the record of their brewing isn't theirs, or isn't doing the
work. The secondary reader is a tester the author hands it to — so a build that
needs the author standing next to it to work doesn't count.

## What does success look like?

Observable outcomes, not feelings:

- A brewer who has never seen the repo runs one command on their own computer and
  reaches the app from their phone on the same wifi.
- Six known-good Brewfather recipe exports import and produce calculated OG, FG,
  ABV, IBU and colour that match the vendor's own numbers.
- A full brew day runs end to end in the app — plan, brew, ferment, package,
  complete — with the measured numbers recorded against the planned ones.
- Closing the browser mid-session loses nothing; the database is one file that
  can be backed up and moved to another computer.
- A tester who hits something confusing can say so from inside the app, mid-brew,
  with one thumb.

## What is explicitly NOT being built?

- **Multi-user, accounts, or an access gate.** One instance serves one brewer on a
  trusted network. There is no login and no encryption, by design.
- **Anything reachable from the open internet.** No port-forwarding story, no
  hosted tier, no third-party sync.
- **A native desktop or native mobile app.** A browser plus add-to-home-screen is
  the distribution story. (Electron/Tauri and Capacitor were scoped on
  2026-09-02 and deferred on 2026-09-03 — kept in `.codestream/ROADMAP.md` under
  "Deferred / not scheduled".)
- **Offline-first brew day.** The phone and the server are on the same wifi
  during a brew, so there is nothing to reconcile.
- **A community recipe library or social features.** Recipes are the brewer's own.

## Open questions

- Whether `Recipe.folder` / `Recipe.tags` should be required rather than optional —
  a ~30-file fixture sweep, deferred on 2026-09-01. Logged in
  `.codestream/ROADMAP.md` under "Deferred / not scheduled".
- Whether the PWA/service-worker path is enough for a tester's phone, or whether a
  native shell is eventually needed. Deferred, not closed.

---

<!-- Written by /discover. Revised when the answers change — not silently, and
     not by a later phase that needs a different answer. -->

> **Predecessor.** The previous framework's `.gsd/DISCOVERY.md` — a question-and-answer
> document scoped to the *Living Design System* initiative (Milestones 30–35), not to
> the product — is preserved verbatim at
> `.codestream/archive/pre-codestream/DISCOVERY.md`.
