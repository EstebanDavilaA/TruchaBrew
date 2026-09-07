# FEATURE SPECIFICATION: M42_P1 — One command, one address, no dev server

## Phase Summary

Milestone 42 Phase 1 of 3. Today TruchaBrew only runs the way its author runs it: two
processes (`vite` on 5173 and `tsx src/index.ts` on 5177), the UI served by a dev
transpiler, the API served by a second dev transpiler, the two stitched together by
Vite's `/api` proxy, and the database at a path baked into the source. A brewer who is
not the author cannot start that, and nothing in the tree emits a runnable server.

This phase produces the **production server**: a compiled, dependency-light API artifact
that serves the built web UI *and* the API from a **single port**, opens its database at
an **environment-configurable path that defaults byte-identically to today's**, and
**prints the LAN address to type into a phone** at startup. After this phase, `npm run
build && npm start` from the repo root yields one process, one URL, and no `tsx`.

The user-visible outcome — and the reason this is a vertical slice and not a build-tooling
layer — is that the app becomes reachable at **one address the server tells you**, from
the PC and from a phone on the same wifi, with no dev server running. That is directly
demonstrable by a human, and it is the thing Phase 3's README will instruct a tester to do.

Phases 2 and 3 (PWA installability; one-command packaging + README) are **out of scope**
here — see RA-1 for the boundary reasoning and RA-2 for the deviation from the roadmap's
own suggested split.

### Key Behaviors

1. `apps/api` gains a real build producing `apps/api/dist/index.js`, runnable by plain
   `node` with **no `tsx` in the production start path**.
2. The built API serves `apps/web/dist` as static files and falls back to `index.html`
   for client-side routes, while `/api/*` keeps its existing JSON 404 contract exactly.
3. DB path, migrations directory, static root, port and bind host all become
   environment-driven, each defaulting to today's effective value so an existing
   database opens with its data and migration state unchanged.
4. On startup the server prints every reachable address, including its LAN IPv4
   address(es), not just `localhost`.
5. `buildServer()` stays test-injectable and its existing single-argument call form keeps
   working unmodified — all 515 existing API tests pass without edits.

### Resolved Ambiguities (Binding)

- **RA-1 — Phase boundary (why this is a coherent slice, not a horizontal layer).** The
  slice is defined by *reachability at one address without a dev server*, which is a
  user-visible outcome a human can confirm in one action (open the printed URL on a phone,
  see the app, open a recipe). Every change in this phase is required for that outcome and
  nothing in it is speculative infrastructure. The three phases are additionally disjoint
  by **directory**, which is what makes a Phase 3 failure diagnosable per the roadmap's own
  requirement: **P1 touches `apps/api/**` and root `package.json` only; P2 touches
  `apps/web/**` only; P3 touches repo-root packaging, `README.md` and `.github/` only.**
  No file is authorized in two phases.
- **RA-2 — Deviation from the roadmap's suggested split, stated plainly.** The roadmap
  proposes the startup-printed LAN address as part of Phase 2 (alongside PWA
  installability). **This spec moves it into Phase 1** for two reasons: (a) it is four
  lines in `apps/api/src/index.ts`, the exact file this phase already rewrites for
  env-driven config and the exact process whose bind host it reports — putting it in P2
  would make P2 the only phase that touches `apps/api`, destroying the directory
  disjointness in RA-1; (b) without it, P1's own outcome is not demonstrable, because
  nobody can reach the single-port server from a phone without first being told its
  address. With this move, P2 becomes purely `apps/web` (manifest, icons, service worker
  registration) and is verifiable entirely on its own. The roadmap's *concern* — that the
  tester-facing part be diagnostically separable from the server part — is preserved and
  strengthened, not weakened. `vite.config.ts`'s `host: true` is **already present**
  (shipped in M40_P1) and needs no change in any phase of this milestone; the roadmap's
  M42 hardening scope listing it as pending is stale.
- **RA-3 — Bundling, not `tsc --outDir` (a blocker the roadmap does not mention).** Plain
  `tsc` emission is **structurally unrunnable** here, verified against source, for two
  independent reasons: (i) `tsconfig.base.json` sets `moduleResolution: "bundler"`, so
  every relative import in `apps/api/src` is extensionless (`./db/client`, `./server`) and
  `tsc` does not rewrite specifiers — the emitted ESM would fail Node's resolver
  immediately; (ii) `@truchabrew/calculations` and `@truchabrew/shared-types` both declare
  `"main": "./src/index.ts"`, i.e. their published entrypoint is **TypeScript source**, so
  compiled API output importing them would hand `.ts` files to `node`. Fixing (ii) by
  compiling the two packages and rewriting their `main` fields would cascade into
  `apps/web`'s build and both packages' test configs — out of proportion and out of this
  phase's directory boundary. **Binding decision: bundle `apps/api` with `esbuild`** into a
  single ESM file, which resolves both problems at once by inlining the workspace TS and
  emitting a self-contained module. Runtime npm dependencies stay **external** (see RA-4).
- **RA-4 — Exact externals.** The bundle marks exactly these as external:
  `fastify`, `@fastify/static`, `drizzle-orm`, `better-sqlite3`. Everything else —
  notably `@truchabrew/calculations` and `@truchabrew/shared-types` — is **inlined**.
  Rationale: the four externals are real, installable, JS-only packages present in
  `node_modules` at runtime (`better-sqlite3` resolves to the local
  `packages/better-sqlite3-shim`, pure JS over `node:sqlite`, no native addon), while the
  two workspace packages are the ones whose entrypoints are unloadable TypeScript.
  `--packages=external` alone is **forbidden** — it would externalize the workspace
  packages too and reintroduce the RA-3(ii) failure.
- **RA-5 — Default DB path must not move, and this is fragile.** Today
  `apps/api/src/index.ts` computes `path.resolve(import.meta.dirname, '..', 'data')` from
  `src/`, giving `apps/api/data/truchabrew.db`. From a bundle at `apps/api/dist/index.js`
  the same expression gives `apps/api/data` **only because `dist/` happens to sit at the
  same depth as `src/`**. That coincidence is not something to rely on silently. Binding:
  the default path is computed and asserted explicitly, and AC-9 pins the resolved default
  to `<repo>/apps/api/data/truchabrew.db` **from the built artifact**, not from source.
  An existing database at that path must open with its data and `__drizzle_migrations`
  state unchanged (AC-10) — zero new migrations may be generated by this phase.
- **RA-6 — The migrations folder genuinely does move, and must be fixed.**
  `apps/api/src/db/migrate.ts` resolves `path.resolve(__dirname, '..', '..', 'drizzle')`
  from `src/db/`, i.e. `apps/api/drizzle`. From a bundle at `apps/api/dist/index.js` that
  same expression resolves to `<repo>/drizzle`, which does not exist — the built server
  would crash on startup. Unlike RA-5 this is a real break, not a coincidence that holds.
  Binding: `runMigrations` accepts an optional explicit migrations folder, defaulting to
  today's value when called with one argument, so existing call sites and tests are
  unaffected.
- **RA-7 — SPA fallback must not swallow API 404s.** `server.ts`'s current
  `setNotFoundHandler` returns the `ApiErrorBody` JSON 404 for *every* unmatched route,
  and `apps/api`'s existing tests assert that contract. Binding branch, in this order:
  a request whose path starts with `/api/` (exact prefix, case-sensitive) **always** gets
  today's JSON 404 with today's message string, unchanged; any other unmatched `GET` or
  `HEAD` request gets `apps/web/dist/index.html` with status **200** and
  `Content-Type: text/html`; any other unmatched request with any other method
  (`POST`/`PUT`/`DELETE`/…) gets today's JSON 404. A fallback that returned HTML for a
  mistyped API path would turn every future API typo into a silent success and is a
  phase failure.
- **RA-8 — Static serving is optional at runtime.** If the configured static root does not
  exist (the normal case during `npm run dev:api`, and the case for every existing test),
  `@fastify/static` is **not registered at all** and the server boots normally with
  API-only behavior identical to today's, including the unmodified JSON 404 for non-API
  paths. Absence of a built web `dist/` is never a startup error. This keeps
  `buildServer({ db })` — the form all 515 existing API tests use — behaviorally
  unchanged (AC-16).
- **RA-9 — Env var names are exported constants, not string literals sprinkled at use
  sites.** See §1. Precedence for every one of them: explicit environment variable if set
  and non-empty after trimming, otherwise the documented default. An empty-string env var
  is treated as **unset** (a `.env` line like `PORT=` must not produce port `NaN`).
- **RA-10 — Layer 1 verifies the production claim by smoke-starting the real artifact,
  not by unit-testing an intention.** Given this sandbox's documented build/native-binding
  history (`VERIFICATION_REPORT.md`, M37_P2 entry onward), a claim as load-bearing as
  "the built server actually starts and serves requests" must not rest on mocks. Binding:
  a new test spawns the **actual built `dist/index.js`** with `node` on an ephemeral port
  against a temp-directory DB, polls `/api/health`, asserts a client-route path returns
  HTML 200 and an unknown `/api/` path returns the JSON 404, then terminates it (AC-17).
  What Layer 1 **cannot** verify, flagged here rather than fabricated later: reachability
  from a real phone over a real LAN, and the printed IP being the one that actually works
  on the tester's network — those are AC-21/AC-22, **manual, real-hardware only**, in the
  same spirit as M40's AC-15/AC-18 and M41's AC-39/AC-40. They are not Layer 1 gates and
  must not be reported as passing on the strength of the smoke test.
- **RA-11 — esbuild's platform binary is a known risk class in this sandbox.** `esbuild`
  ships a platform-specific binary, the same install-resolution class that broke
  `rolldown`/`lightningcss` during M37_P2. If it fails to install here, that is an
  **environment defect to report plainly** (M37_P2 precedent), not a reason to fake AC-17
  or to substitute a hand-written "bundle". No alternate bundler is pre-authorized;
  escalate instead.
- **RA-12 — Out of scope, explicitly.** No `manifest.json`, no service worker, no icons,
  no `index.html` change (Phase 2). No Docker/Compose file, no install script, no
  `README.md` rewrite, no `.github/` CI workflow (Phase 3). No TLS, no auth, no CORS, no
  rate limiting, no schema change, no new migration, no calculation change, and no
  `apps/web/src` change of any kind.
- **RA-13 — BUGS/FEATURES review.** `BUG-043` (rare ~1-in-17 unreproducible web-suite
  flake) names Milestone 42 as where it will surface most often, **but explicitly under
  the CI workflow**, which is Phase 3. It is **not** pulled into this phase and is not
  moved to `IN_PLANNING`. Its standing instruction still applies: if a single unexplained
  red test appears during this phase, re-run before treating it as a regression, and
  capture the failing test name if it fires. No other open `BUGS.md`/`FEATURES.md` item
  concerns production builds, static serving, env config or PWA.

---

## 1. Data Schema & Contracts

**No database schema change. No new migration. No `shared-types` change.**

### Exported constants — new, `apps/api/src/config.ts` (new file)

| Symbol | Type | Default | Meaning |
|---|---|---|---|
| `ENV_DB_PATH` | `'TRUCHABREW_DB_PATH'` | — | env var name |
| `ENV_MIGRATIONS_DIR` | `'TRUCHABREW_MIGRATIONS_DIR'` | — | env var name |
| `ENV_STATIC_ROOT` | `'TRUCHABREW_STATIC_ROOT'` | — | env var name |
| `ENV_PORT` | `'PORT'` | — | env var name (pre-existing name, preserved) |
| `ENV_HOST` | `'HOST'` | — | env var name |
| `DEFAULT_PORT` | `number` | `5177` | unchanged from today |
| `DEFAULT_HOST` | `string` | `'0.0.0.0'` | unchanged from today |

### Pure function contracts — `apps/api/src/config.ts`

```ts
export interface RuntimeConfig {
  dbPath: string;          // absolute
  migrationsDir: string;   // absolute
  staticRoot: string;      // absolute; may point at a non-existent dir
  port: number;
  host: string;
}

/** Pure: resolves runtime config from an env bag and a package-root anchor. */
export function resolveConfig(env: NodeJS.ProcessEnv, packageRoot: string): RuntimeConfig;

/** Pure: LAN-reachable URLs for a bind host+port, given a network-interface bag. */
export function describeListenAddresses(
  host: string,
  port: number,
  interfaces: Record<string, Array<{ address: string; family: string; internal: boolean }> | undefined>,
): string[];
```

- `resolveConfig` reads only its `env` argument (never `process.env` directly) and
  performs no filesystem access — it never checks existence, so it is deterministic and
  unit-testable. Empty/whitespace-only values are treated as unset (RA-9). A non-numeric
  or non-positive `PORT` **throws** with a message naming `PORT` and the offending value —
  it must never silently become `NaN`.
- Defaults, relative to `packageRoot` (= `apps/api`): `dbPath` →
  `<packageRoot>/data/truchabrew.db`; `migrationsDir` → `<packageRoot>/drizzle`;
  `staticRoot` → `<packageRoot>/../web/dist`.
- `describeListenAddresses` returns `http://localhost:<port>` first, then one
  `http://<ipv4>:<port>` per **non-internal IPv4** interface address, in the order the
  interface bag yields them, de-duplicated. When `host` is not `0.0.0.0` (or `::`), it
  returns exactly `http://<host>:<port>` and consults no interfaces. **No-match contract:**
  when bound to `0.0.0.0` with zero non-internal IPv4 addresses, it returns the
  `localhost` entry alone — never an empty array, never a placeholder like
  `http://undefined:<port>`.

### Modified symbols

| Symbol | File | Change |
|---|---|---|
| `ServerDeps` | `apps/api/src/server.ts` | gains optional `staticRoot?: string` |
| `buildServer` | `apps/api/src/server.ts` | conditional static registration + branched not-found handler; **signature stays one argument, existing call form unchanged** |
| `runMigrations` | `apps/api/src/db/migrate.ts` | gains optional second parameter `migrationsFolder?: string`, defaulting to today's resolved value |
| module body | `apps/api/src/index.ts` | uses `resolveConfig`, passes `staticRoot`/`migrationsDir`, prints `describeListenAddresses` output |
| `scripts.build`/`scripts.start` | `apps/api/package.json` | new `build`; `start` becomes `node dist/index.js` |
| `scripts.build`/`scripts.start` | root `package.json` | root `build` also builds api; new root `start` |

### Untouched symbols (must not change)

`openDatabase`, `seedDatabase`, `sendApiError`, every `register*Routes` function and every
route handler, `db/schema.ts`, all files under `apps/api/drizzle/`, the entire
`apps/web/src` tree, `apps/web/vite.config.ts`, and `packages/**`.

---

## 2. Transformations & Integration

### Stateful integration — `apps/api/src/index.ts` startup order (binding)

1. `resolveConfig(process.env, packageRoot)`.
2. `fs.mkdirSync(path.dirname(config.dbPath), { recursive: true })`.
3. `openDatabase(config.dbPath)`.
4. `runMigrations(db, config.migrationsDir)`.
5. `seedDatabase(db)`.
6. `buildServer({ db, logger: true, staticRoot: config.staticRoot })`.
7. `listen({ port, host })`, then print each line of `describeListenAddresses(...)`.

Step order 2→5 is identical in effect to today's; only the values are now configurable.

### Static + fallback registration inside `buildServer` (binding)

- Register `@fastify/static` with `root: staticRoot`, `wildcard: false`, and **no**
  `prefix` beyond `/`, **only if** `staticRoot` is provided and exists as a directory.
- The not-found handler branches exactly per RA-7. When static is not registered, the
  handler is behaviorally identical to today's for **all** paths.
- Static registration happens **after** every `register*Routes` call, so no static file can
  ever shadow an API route.

### Refactoring & legacy cleanup

- `tsx` is removed from the **production** path only. It remains a devDependency and
  remains in `dev`, and in `db:seed` — those are developer scripts, not the start path.
  AC-13 sweeps `start` scripts specifically, not the whole file.
- `apps/api/src/db/seedCli.ts` keeps its own hardcoded path and is **not** in scope
  (developer tooling, not the production start path) — noted here so a later audit does not
  file it as a missed site.
- No legacy alias, registration loop or dead export is introduced; `server.ts`'s
  historical "forced registration exception" comments are left verbatim.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|---|---|---|
| AC-1 | Env-name constants exported | Unit | `ENV_DB_PATH`/`ENV_MIGRATIONS_DIR`/`ENV_STATIC_ROOT`/`ENV_PORT`/`ENV_HOST`/`DEFAULT_PORT`/`DEFAULT_HOST` import cleanly with the exact values in §1 |
| AC-2 | `resolveConfig` defaults | Unit | With `env = {}` and `packageRoot = '/x/apps/api'`: `dbPath === '/x/apps/api/data/truchabrew.db'`, `migrationsDir === '/x/apps/api/drizzle'`, `staticRoot === '/x/apps/web/dist'`, `port === 5177`, `host === '0.0.0.0'` |
| AC-3 | Every env override honored | Unit | Each of the five vars, set individually to a non-default value, is reflected in exactly its own field and no other field changes |
| AC-4 | Empty env var = unset | Unit | `PORT: ''` and `PORT: '   '` both yield `5177`, not `NaN`; same treatment for the other four |
| AC-5 | Invalid port throws | Unit | `PORT: 'abc'`, `PORT: '0'`, `PORT: '-1'` each throw an `Error` whose message contains `PORT` and the offending value; a valid `'8080'` yields `8080` |
| AC-6 | Relative env paths resolve to absolute | Unit | `TRUCHABREW_DB_PATH: './brew.db'` yields an absolute path; no returned field is ever relative |
| AC-7 | `describeListenAddresses` LAN enumeration | Unit | Bound `0.0.0.0:5177` with a fake interface bag containing one internal `127.0.0.1` and two non-internal IPv4s returns exactly 3 entries, `http://localhost:5177` first, both LAN IPs present, no internal and no IPv6 entry |
| AC-8 | Degenerate address cases | Unit | (a) `0.0.0.0` with an empty/all-internal interface bag returns exactly `['http://localhost:5177']` — never `[]`, never an `undefined` placeholder; (b) host `'127.0.0.1'` returns exactly `['http://127.0.0.1:5177']` and ignores the interface bag entirely |
| AC-9 | Default DB path unmoved from the **built** artifact | Integration | Running `dist/index.js` with no env set resolves its DB to `<repo>/apps/api/data/truchabrew.db` — asserted against the built file's own resolution, not `src/` |
| AC-10 | Existing DB opens intact | Integration | A pre-seeded copy of a DB opened via the new path resolves the same file, reads its rows, and leaves `__drizzle_migrations` row count and contents unchanged; `git status --porcelain apps/api/drizzle` is empty (zero new migrations generated) |
| AC-11 | `runMigrations` default preserved | Unit | `runMigrations(db)` (one argument) still targets `apps/api/drizzle`; `runMigrations(db, dir)` targets `dir` |
| AC-12 | Build produces a runnable artifact | Build | `npm run build --workspace=@truchabrew/api` exits 0 and creates `apps/api/dist/index.js`, non-empty |
| AC-13 | No `tsx` in the production start path | Static sweep | `apps/api/package.json`'s `start` and root `package.json`'s `start` contain no `tsx`; `start` is `node dist/index.js`. `dev`/`db:seed` retaining `tsx` does **not** fail this (RA-12/cleanup note) |
| AC-14 | Workspace TS is inlined, not externalized | Static sweep | The built `dist/index.js` contains **zero** `from '@truchabrew/calculations'` / `'@truchabrew/shared-types'` import specifiers, and **does** retain external imports of `fastify`, `drizzle-orm`, `better-sqlite3` |
| AC-15 | SPA fallback vs API 404 (RA-7) | Integration | With a static root present: `GET /recipes/123` → 200 `text/html` (body is `index.html`); `GET /api/nope` → 404 with today's exact `ApiErrorBody` shape and `Route not found: GET /api/nope` message; `POST /some/page` → 404 JSON, not HTML |
| AC-16 | Absent static root is not an error | Integration | `buildServer({ db })` (existing one-arg form) and `buildServer({ db, staticRoot: '<nonexistent>' })` both boot; both return today's JSON 404 for `GET /recipes/123`; no throw, no log-level error |
| AC-17 | **Smoke: the real built artifact starts and serves** | Integration (spawn) | Spawn `node apps/api/dist/index.js` with `PORT` = ephemeral and `TRUCHABREW_DB_PATH` in a temp dir; within a bounded timeout `/api/health` returns its documented 200 payload, an unknown `/api/` path returns JSON 404, and stdout contains at least one `http://` line; process exits cleanly on termination and the temp DB is removed |
| AC-18 | Startup print includes a LAN line | Integration (spawn) | The spawned artifact's stdout, when bound to `0.0.0.0` on a host with a non-internal IPv4, contains both a `localhost` URL and at least one non-`localhost` `http://` URL. If the runner has no non-internal IPv4, the test asserts the AC-8(a) degenerate contract instead and says so — it does not silently pass |
| AC-19 | Existing API suite unmodified and green | Regression | All 515 existing `apps/api` tests pass with **no edits to any pre-existing api test file**; a required edit is a halt-and-report signal that behavior drifted |
| AC-20 | Four Layer 1 gates green | Verification | `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` each exit 0. Test count ≥ the M41_P1 baseline plus this phase's new tests; the web suite count is unchanged |
| AC-21 | **MANUAL / real hardware** — phone reaches the built server | Manual | With `npm run build && npm start` on the author's PC and no dev server running, a phone on the same wifi opens the printed LAN URL, the app loads, a client route deep-link works, and a recipe opens. Screenshot in `.gsd/active/manual_verification/`. **Not a Layer 1 gate; must be reported as outstanding, not inferred from AC-17** |
| AC-22 | **MANUAL / real hardware** — the printed address is the one that works | Manual | The URL the tester types is one the server actually printed, verbatim, with no IP-hunting. Recorded alongside AC-21's evidence |
| AC-23 | Scope guardrail | Verification | `git diff --name-only 3959a66 -- apps packages` (plus `git add -N` for new files) returns **exactly** the Authorized Files under `apps/`, and **nothing under `apps/web/` or `packages/`**. Verified viable this session: `HEAD` is `3959a66` ("Milestone 41 completed") and `git status --porcelain` returns zero lines, so the working tree is genuinely clean and a diff-based check isolates this phase — no SHA-256 content manifest is required |

---

## 4. Authorized Files

**Modified**
1. `apps/api/package.json` (build/start scripts; `@fastify/static` dep; `esbuild` devDep)
2. `apps/api/src/index.ts`
3. `apps/api/src/server.ts`
4. `apps/api/src/db/migrate.ts`
5. `package.json` (root — `build` also builds api; new `start`)
6. `package-lock.json` (dependency install side effect)

**New**
7. `apps/api/src/config.ts`
8. `apps/api/test/config.test.ts`
9. `apps/api/test/staticServing.test.ts`
10. `apps/api/test/productionSmoke.test.ts`

**Explicitly NOT authorized:** any file under `apps/web/`, any file under `packages/`,
`apps/api/src/db/schema.ts`, anything under `apps/api/drizzle/`, `apps/api/src/db/seedCli.ts`,
any pre-existing `apps/api/test/*` file, `README.md`, `.github/**`, and any
Docker/Compose/install-script artifact.

---
> **HALT GATE (STATE 2):** Review this feature specification. Reply with **SPEC_APPROVED** to begin execution.
