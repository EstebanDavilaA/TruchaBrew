# PROJECT

Project specifics live here, in one place, so `RULES.md` can stay generic.

## What this is

TruchaBrew is a self-hosted homebrewing companion for one person: design a
recipe, trust the numbers, brew it, and log the batch end-to-end. It replaces a
Brewfather subscription — recipes, batches, water chemistry, inventory and
brew-day tracking in a single app that runs on the brewer's own computer. There
are no accounts and no cloud; everything lives in one SQLite file on the machine
that serves the app. A phone on the same wifi reaches it from the brewery floor
through an installable PWA.

## Stack

- **Language / runtime:** TypeScript, Node.js 24 or newer (ESM throughout).
- **Repo shape:** npm workspaces monorepo — `apps/*`, `packages/*`.
- **API:** Fastify 5, Drizzle ORM over SQLite (`better-sqlite3`), bundled with esbuild.
- **Web:** React 19, React Router 7, Vite 8, Tailwind CSS 4.
- **Calculations:** pure TypeScript in `packages/calculations` — the source of truth
  for every number the app displays.
- **Tests:** Vitest (workspace suites plus a root packaging suite).

## Where things live

- `apps/api/` — Fastify server, Drizzle schema and migrations (`drizzle/`),
  repositories, routes; serves the built web bundle too.
- `apps/web/` — React client (pages, components, design system, PWA manifest).
- `packages/calculations/` — pure brewing math; no I/O.
- `packages/shared-types/` — types shared across API, web and calculations.
- `packages/better-sqlite3-shim/` — install-time fallback for `better-sqlite3`.
- `scripts/` — repo-level tooling: `brew.mjs` (one-command setup/run),
  `typecheck-all.mjs`, `smoke-artifact.mjs`, `nodeVersion.mjs`.
- `test/` — root packaging/install test suite.
- `apps/api/data/truchabrew.db` — the user's data. Never committed; never deleted.

## The checks (rule 4)

Every one of these runs before a build is reported as passing, and every exit
code is reported.

| Check | Command |
|---|---|
| tests | `npm test` |
| typecheck | `npm run typecheck` |
| build | `npm run build` |
| lint | `npm run lint` |
| smoke | `npm run smoke` — starts the real built artifact, verifies it serves, shuts it down |

All five gates apply. A green test suite with a broken build is not a pass.

## Known constraints

- **Trusted home network only.** There is no login, no password and no encryption.
  Nothing may add a network-exposure path that assumes otherwise, and nothing may
  weaken this into the README's security section.
- **Never lose the user's database.** `apps/api/data/truchabrew.db` is not tracked
  by git. Schema changes go through generated Drizzle migrations in
  `apps/api/drizzle/` — never a destructive in-place rewrite.
- **Node 24+** is required; `scripts/nodeVersion.mjs` enforces it.
- Framework paths — `RULES.md`, `CLAUDE.md`, `.agents/`,
  `.github/copilot-instructions.md` and `.codestream/` — are protected by
  `RULES.md`. Never delete, move or mass-overwrite them.
- `.codestream/archive/` is historical record. Read it, never rewrite it.

## Known open defects

`.codestream/BUGS.md`. Keep the list there, not here.
