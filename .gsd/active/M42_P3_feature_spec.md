# FEATURE SPECIFICATION: M42_P3 — One command, one page of instructions, one green pipeline

## Phase Summary

Milestone 42 Phase 3 of 3 — the closing phase of *"A brewer you've never met runs their own copy."*

Phase 1 built the production server (esbuild-bundled `apps/api/dist/index.js`, `@fastify/static`
with SPA fallback, env-driven DB path / migrations dir / static root / port / host, and the
startup-printed LAN address). Phase 2 made the browser tab installable (manifest, three icons,
network-passthrough service worker). **Both are invisible to the person this milestone is for.**

Today a brewer who is handed this repo still faces: install Node (undocumented, unversioned),
`npm install`, `npm run build`, `npm start` — three separate commands they must know exist — and a
`README.md` that is *still the unmodified Vite starter template* (verified this session: it opens
`# React + TypeScript + Vite` and talks about `@vitejs/plugin-react-swc` and the React Compiler).
Nothing in the tree tells them what this program is, what it needs, where their data lives, that it
has no password, or what to type into a phone. There is no `.github/` directory and no CI of any
kind — this repo has never had one.

This phase produces **the hand-off surface itself**: one command (`npm run brew`) that goes from a
freshly-unzipped folder to a running server with a printed address; a `README.md` written for a
homebrewer rather than a developer; an in-app statement of the honest security posture; a
dependency-free smoke script that proves the *real* built artifact (API + the actual web `dist/`)
starts and serves; and this project's first CI workflow, running the four Layer 1 gates plus that
smoke start.

The user-visible outcome — and the reason this is a vertical slice and not a tooling layer — is that
**a person who is not the author can get TruchaBrew running on their own machine and reach it from
their phone, following only a written page.** That outcome is the milestone's verification threshold
and it is deliberately **not** claimable from Layer 1 (see RA-12).

### Key Behaviors

1. `npm run brew` is the whole setup: it checks the Node version in brewer-readable language,
   installs, builds, and starts — in one command, on Windows, macOS and Linux alike.
2. `README.md` is rewritten from scratch for a non-developer: what you need, what to type, what
   address to open, how to put it on a phone's home screen, where the database file is, and a plain
   statement that this server has no login and must never be exposed to the internet.
3. The same security statement is visible inside the app, in Settings, next to the backup controls.
4. `npm run smoke` starts the actual built artifact against the actual built web UI and proves it
   serves the app shell, a client route, and a JSON 404 — then shuts it down and cleans up.
5. `.github/workflows/ci.yml` runs `npm ci` and then `npm test`, `npm run typecheck`,
   `npm run build`, `npm run lint`, `npm run smoke` on the **documented minimum Node version**.

---

### Resolved Ambiguities (Binding)

- **RA-1 — Phase boundary, and one deliberate, bounded exception to it.** M42_P1's RA-1 set a
  directory-disjointness rule: *P1 = `apps/api/**` + root `package.json`; P2 = `apps/web/**`;
  P3 = repo-root packaging + `README.md` + `.github/`.* This phase honors that with **one named
  exception**: the milestone's own hardening scope requires the honest security posture to be
  *"stated in the README **and visible in the app**"*, and neither P1 nor P2 delivered the in-app
  half (P1 was API-only; P2 shipped manifest/icons/service worker). Closing M42 with a stated
  hardening requirement unmet, or deferring it into M43 (whose feedback box is a different concern),
  are both worse than a bounded exception. **Binding:** this phase adds exactly one new
  `apps/web/src` file (`ServerSecurityNotice.tsx`), one new `apps/web/test` file, and **exactly two
  added lines** to `SettingsManager.tsx` (one import, one JSX element) — nothing else under
  `apps/web/` is authorized. Diagnosability is preserved because the exception is one static,
  non-interactive, logic-free component whose failure cannot be confused with a packaging failure.

- **RA-2 — THE DECISION: a documented one-command install script, NOT Docker Compose.** The roadmap
  requires this be decided at `/plan` on what a brewer with no Node toolchain can actually follow.
  Decided: **install script (implemented as a cross-platform Node script behind one npm command).**
  Docker Compose is **rejected**, on four grounds, in descending weight:

  1. **Docker breaks the printed LAN address — this milestone's single most important affordance.**
     P1's `describeListenAddresses()` enumerates `os.networkInterfaces()` *in the process that is
     listening*. Inside a container that is the container's bridge interface (e.g. `172.18.0.2`),
     **not** the host's LAN IP. The brewer would be told to type an address their phone cannot
     reach, which is precisely the *"find your machine's IP address is exactly where a non-technical
     tester gives up"* failure the roadmap names. The only fix, `network_mode: host`, **does not
     work on Docker Desktop for macOS or Windows** — the two platforms a homebrewer is most likely
     on. Making it work would mean re-opening `apps/api` (P1's territory) to accept an
     externally-supplied advertised host. That is a real regression in the milestone's own outcome,
     traded for nothing.
  2. **Docker is a strictly larger download, not a smaller one.** There is no published image and
     publishing one would mean the author hosts distribution infrastructure, which the milestone
     explicitly forecloses (*"You never host anything"*). So the brewer would run
     `docker compose up --build`, which downloads a Node base image (~200 MB+) **and then runs
     `npm ci` and the Vite build inside it anyway.** Docker's footprint is the install-script
     footprint plus Docker Desktop (~600 MB, WSL2 on Windows, BIOS virtualization on some machines,
     a commercial-use licence prompt). Its failure modes — virtualization disabled in firmware,
     WSL2 not installed — are exactly the ones a non-technical person cannot self-diagnose, and
     they fail *before* any TruchaBrew code runs, where the README can offer no help.
  3. **Docker hides the brewer's data from the brewer.** The milestone's outcome is *"their recipes
     and batches living in a file on their own machine."* Under Compose that file is behind a bind
     mount or, worse, an anonymous volume the brewer cannot find. Native install puts it at
     `apps/api/data/truchabrew.db` — a path the README can name, they can see, and they can copy.
     M36's backup/restore escape hatch stays explainable in one sentence.
  4. **The native path needs no native toolchain.** The usual argument for Docker here — SQLite
     needs a compiler — **does not apply to this repo.** `better-sqlite3` resolves to the local
     workspace shim `packages/better-sqlite3-shim` (verified: `node_modules/better-sqlite3` is a
     symlink to it), which is pure JavaScript over Node's built-in `node:sqlite`. There is no
     node-gyp step, no MSVC requirement, no prebuilt-binary lottery. `npm install` on a stock Node
     installation is the entire toolchain story.

  The counter-argument — that installing Node is a bigger technical ask than installing Docker — is
  acknowledged and rejected on the concrete artifacts: nodejs.org ships a signed, next-next-finish
  installer per platform, which is a strictly smaller and more familiar act than installing Docker
  Desktop. **Shipping both is also explicitly rejected**: the roadmap requires a README *"written
  for that reader"*, and a README with two setup paths is written for a reader who can choose
  between them — i.e. a developer.

- **RA-3 — The one command is `npm run brew`, and it is deliberately not a shell script.** A `.sh`
  does not run on stock Windows; a `.bat` does not run on macOS or Linux; shipping both means the
  README branches by platform and the CI can only ever exercise one of them. An npm script is
  invoked identically on all three (`npm run brew`), and `npm` is already present the moment Node
  is — so **no `npm install` is needed before the one command works**, which is what makes "one
  command" literally true from a fresh unzip. The name `brew` is chosen over `setup` (which implies
  it only sets up and does not run), over `start` (already taken by P1 and meaning "run the
  already-built artifact" — that meaning is preserved byte-for-byte), and over `serve`/`run`
  (ambiguous with npm's own vocabulary). It collides with nothing in npm's namespace.

- **RA-4 — The documented Node floor is major version 24, and it is enforced in three places that
  must agree.** Verified against source, not assumed: the SQLite driver is
  `packages/better-sqlite3-shim/index.js`, which does `import { DatabaseSync } from 'node:sqlite'`,
  and **nothing anywhere in the tree passes `--experimental-sqlite`** (swept this session, zero
  hits). So the app only runs on a Node where `node:sqlite` is available unflagged. **Binding floor:
  Node 24.** Enforced by `MINIMUM_NODE_MAJOR` in `scripts/nodeVersion.mjs`, stated in `README.md`,
  and pinned as CI's `node-version` — CI runs the **floor**, not `latest`, because CI's job here is
  to prove the promise the README makes, and a CI that only proves Node 26 works while the README
  promises 24 is proving the wrong thing. AC-21 asserts all three name the same integer.
  **Failure protocol, binding:** if CI on Node 24 goes red for a `node:sqlite` or engine reason, the
  resolution is to **raise the documented floor to the lowest version CI proves green and update all
  three sites in the same commit** — never to switch CI to `latest`/`lts/*` while the README keeps
  promising 24, and never to add `--experimental-sqlite` to the brewer's path.

- **RA-5 — Pure logic and stateful integration are separate modules, for a hard runtime reason.**
  `scripts/brew.mjs` executes **before `npm install` has ever run**, so it may import **only**
  `node:`-prefixed builtins plus the one relative module `./nodeVersion.mjs`. A single bare package
  specifier (`chalk`, `semver`, `execa`, …) makes the one command fail on a fresh unzip with a
  module-not-found error, which is an unrecoverable first impression. `scripts/nodeVersion.mjs` is
  **pure and import-free**: it exports constants and two total functions, performs no I/O, spawns
  nothing, prints nothing, and calls no `process.exit` — which is what makes it unit-testable
  without the test run triggering an install (AC-6, AC-7).

- **RA-6 — Version-parse operator precision and the fail-closed contract.** `isSupportedNodeVersion`
  compares **major only**, with an inclusive `>=`: exactly `24.0.0` passes, `23.11.1` fails. A
  leading `v` is optional and stripped. Pre-release/build suffixes are ignored
  (`v25.0.0-nightly20260101` → 25). Leading zeros are accepted (`v024.0.0` → 24). **No-match
  contract:** for any input `parseNodeMajor` cannot resolve to a positive integer — `''`, whitespace
  only, `'banana'`, `'v'`, `undefined`, `null` — `parseNodeMajor` returns **`null`** (never `NaN`,
  never `0`, never a placeholder) and `isSupportedNodeVersion` returns **`false`**. Unparseable
  **fails closed**: the script refuses to run and prints the guidance message, rather than pressing
  on into an obscure crash deep inside a build. Minor/patch are never consulted, so no float or
  boundary comparison exists to get wrong.

- **RA-7 — `npm install` for the brewer, `npm ci` for CI, and the install is unconditional.**
  `brew.mjs` runs `npm install`: it is a fast no-op when `node_modules` is already satisfied, which
  matters because the brewer runs this same command every brew day. CI runs `npm ci`: it is the
  reproducible, lockfile-exact form, and wiping `node_modules` each run is free on a fresh runner
  but hostile on a brewer's laptop. **`brew.mjs` must not short-circuit the install** by testing for
  `node_modules/` — that check is wrong after a `git pull` or a partially-failed first install, and
  the failure it produces (missing new dependency, mid-build) is far more confusing than 3 seconds
  of npm deciding there is nothing to do.

- **RA-8 — Windows spawn contract, and an honest statement that CI does not exercise it.** Every
  child process `brew.mjs` spawns uses `shell: process.platform === 'win32'`, exactly as the
  pre-existing `scripts/typecheck-all.mjs` already does — without it, `spawnSync('npm', …)` fails on
  Windows because `npm` is `npm.cmd`. Stated plainly: **CI runs `ubuntu-latest` only, so the Windows
  branch of this contract is never exercised by any automated gate in this phase.** A Windows CI
  matrix is out of scope (RA-10); the Windows path is covered by the manual hand-off rehearsal
  (AC-34) or not at all, and must be reported that way rather than implied green.

- **RA-9 — Root-level test wiring, and the `&&` trade-off, stated rather than hidden.** The
  packaging deliverables (README content, script contracts, workflow content, the Node-floor
  lockstep) have no workspace to live in — root `npm test` today is
  `npm test --workspaces --if-present`, which cannot see a root-level file. Binding: add a root
  vitest project (`vitest.config.mjs`, `test/packaging.test.mjs`) and extend the root script to
  `npm test --workspaces --if-present && vitest run`. Two consequences are accepted deliberately:
  (a) the new suite is **plain ESM JavaScript, not TypeScript** — this avoids a fifth entry in
  `scripts/typecheck-all.mjs` and a new root `tsconfig`, and matches the precedent already set by
  `scripts/typecheck-all.mjs`; (b) the `&&` short-circuits, so a red workspace suite hides the
  packaging suite. This is the same class of problem that `typecheck-all.mjs`'s own header comment
  documents, and it is accepted here only because the short-circuit **already exists today** (npm's
  `--workspaces` aborts at the first failing workspace) and the packaging suite is small,
  dependency-free and deterministic. **If a future phase adds meaningful root-level tests, the
  indicated fix is a `scripts/test-all.mjs` mirroring `typecheck-all.mjs`** — building that
  orchestrator now, for one file, is disproportionate. The root config's `include` is **load-bearing
  and must be explicit**: vitest's default include would otherwise collect every `apps/**` test file
  a second time (AC-12).

- **RA-10 — CI scope boundary, drawn tightly.** IN: one workflow file, one job, `ubuntu-latest`,
  `actions/checkout`, `actions/setup-node` (pinned `node-version`, `cache: 'npm'`), `npm ci`, then
  the four Layer 1 gates and `npm run smoke`. OUT, and asserted absent by AC-20: any release, tag,
  version-bump, changelog, signing, notarization, `npm publish`, container build or registry push;
  any deployment; any `secrets.` reference; any artifact upload; any OS or Node matrix; any
  scheduled run; any coverage service; any branch-protection or auto-merge automation. The roadmap
  is explicit that *"the app-store-shaped release and signing pipeline the 2026-09-02 draft proposed
  is gone"* — this workflow's entire job is **proving the distributable artifact starts.**

- **RA-11 — `npm run smoke` is not redundant with P1's `productionSmoke.test.ts`, and the difference
  is the whole point.** Verified by reading it: P1's test writes a **temporary
  `index.html` containing the literal string `SPA SHELL`** into a `mkdtemp` directory and points
  `TRUCHABREW_STATIC_ROOT` at that. It therefore proves the fallback *mechanism* while proving
  nothing about the real `apps/web/dist` — the actual distributable — ever being served. The smoke
  script points at `apps/web/dist` and asserts the served shell contains markers only the genuine
  Vite build produces (`<div id="root">` and the P2 manifest link). It is also runnable **outside
  vitest** (`npm run smoke`), which is what lets CI express "the artifact starts" as its own step
  and what lets a human reproduce that claim in one command. P1's test is **not modified, replaced
  or removed** — it stays exactly as it is.

- **RA-12 — Layer 1 vs. manual, stated exhaustively and honestly.** This is the phase where the
  temptation to launder a manual claim into a green test is highest, so the line is drawn here.

  **Layer 1 CAN verify:** that `nodeVersion.mjs`'s functions are correct at every boundary and
  degenerate input; that `brew.mjs` imports nothing that requires a prior install, gates on the
  version before doing anything, and contains no `tsx`; that the root package scripts have exactly
  the specified values and the untouched ones are byte-identical; that the root vitest project
  collects only its own file; that `npm run smoke` starts the **real** built artifact and gets the
  real app shell, a client route, and a JSON 404 back; that the workflow file exists, is tab-free,
  and names exactly the intended steps and nothing forbidden; that README and CI and the script
  agree on the Node floor; that the README contains every required section and none of the Vite
  template; that the in-app notice renders the required copy and is token-clean; and that the four
  Layer 1 gates are green locally.

  **Layer 1 CANNOT verify, and must never be reported as if it had:**
  (a) that the workflow is valid GitHub Actions YAML and actually runs green — that requires a push
  and a real run (AC-33);
  (b) that a **person who is not the author**, on a **machine with no repo checkout and no Node**,
  following **only the README**, gets to a running server — every automated check in this phase runs
  on a machine that already has both, and none of them read the README the way a human does
  (AC-34);
  (c) that a phone on real wifi reaches the printed address, installs to the home screen, and opens
  a recipe — real hardware, real network, carried over from M42_P1's AC-21/AC-22 and M42_P2's AC-36
  (AC-35);
  (d) that the Windows path works at all (RA-8).
  A green `npm run smoke` proves the artifact starts. It proves nothing whatsoever about whether the
  instructions can be followed. Those are different claims and this spec keeps them apart.

- **RA-13 — The workflow is asserted by content sweep, not by a YAML parser, and that limitation is
  named.** No YAML parser is declared anywhere in this repo, and adding one as a dependency to
  assert eleven lines of a config file is disproportionate. Binding: assert required substrings,
  their relative order, forbidden substrings, and **zero tab characters** (tabs are illegal as YAML
  indentation and are the single most common way a hand-written workflow fails to parse). The
  authoritative proof of validity is the real GitHub run in AC-33, which is manual by construction.
  A test that claimed "the workflow is valid" from substring matching would be a lie.

- **RA-14 — `BUG-043` under CI: no retries, capture the name.** `.gsd/BUGS.md`'s `BUG-043` (a ~1-in-17
  unreproducible web-suite flake) names **this milestone's CI workflow** as where it will surface
  most often, since CI runs the suite far more than a human does. Binding: the workflow must contain
  **no retry, no `continue-on-error`, and no `--retry` flag** — masking the flake destroys the only
  artifact that would make it diagnosable. Its standing instruction applies unchanged: if a single
  unexplained red test appears, re-run before treating it as a regression, and **capture the failing
  test name and output**. `BUG-043` is not moved to `IN_PLANNING` and is not a deliverable of this
  phase.

- **RA-15 — The rehearsal depends on the repo being reachable by the tester; flagged, not assumed.**
  The remote is `https://github.com/EstebanDavilaA/TruchaBrew.git` (default branch `master`). The
  README's "get the files" step points at that repository's ZIP download. **If the repository is
  private, AC-34's rehearsal is blocked at step one** and no amount of README quality fixes it. This
  is a distribution decision for the user, not the executor: the options are (i) make the repository
  public — it holds no secrets, and the database is gitignored — or (ii) hand the tester a ZIP
  directly and adjust the README's first step. **The executor must not change repository visibility
  and must not invent a distribution channel.** Raise it at `/steer` if it is still unresolved.

- **RA-16 — Out of scope, explicitly.** No Docker, Compose, Dockerfile or `.dockerignore` (RA-2 —
  their absence is asserted). No container registry, no published image, no release automation, no
  signing, no versioning scheme, no changelog. No TLS, no auth, no login, no CORS, no rate limiting
  — the roadmap is explicit that the absence of accounts *is* the design. No change to any file
  under `apps/api/**` or `packages/**`. No change to `apps/web/vite.config.ts`, `.oxlintrc.json`,
  `.gitignore`, `scripts/typecheck-all.mjs`, or any `tsconfig*.json`. No feedback box (Milestone
  43). No offline caching (deferred; P2 shipped a deliberately network-passthrough worker). No
  schema change and no new migration.

- **RA-17 — Scope guardrail method: SHA-256 content manifest, because `git diff` is NOT viable
  here.** Checked this session rather than assumed: `HEAD` is `3959a66` ("Milestone 41 completed"),
  and `git status --porcelain` returns **24 dirty entries** — the entire uncommitted output of
  M42_P1 and M42_P2 (`apps/api/src/config.ts`, `apps/web/public/manifest.webmanifest`, `sw.js`, the
  icons, `main.tsx`, `index.html`, both package manifests, the lockfile, and more). A repo-wide
  `git diff --name-only 3959a66` would therefore return P1's and P2's files alongside this phase's
  and prove nothing about P3's scope. **Binding: take a SHA-256 content manifest immediately before
  the first edit and again at the end** —
  `git ls-files -co --exclude-standard -z | xargs -0 sha256sum` — and diff the two manifests
  (AC-36). Two **per-file** exceptions where a plain `git diff` *is* viable and must be used because
  it is stricter: `README.md` and `apps/web/src/components/SettingsManager.tsx` are both currently
  **clean** at `HEAD`, so `git diff -- <path>` against `HEAD` isolates exactly this phase's change to
  each (AC-30 depends on this). Root `package.json` is **already dirty** from P1 and gets the
  manifest treatment plus an explicit byte-comparison of the untouched script values (AC-11).

- **RA-18 — The existing web governance sweeps must pass unmodified, and the new component is shaped
  to guarantee it.** `apps/web/test/` carries at least five static sweeps that walk
  `apps/web/src` wholesale (`designTokens.test.ts`, `designSystem.test.ts`,
  `controlTargetSize.test.ts`, `uiPrimitives.test.tsx`, `ScopeGuardrail.test.tsx`), so a new
  component file is inspected by all of them the moment it lands. Binding constraints on
  `ServerSecurityNotice.tsx`, each chosen to satisfy a specific existing sweep: it declares **zero
  local class-string constants** (`designTokens.test.ts` AC-12/AC-22), uses **only** the already-
  exported `CARD_CLASS`, `SECTION_HEADING_CLASS` and `BODY_TEXT_CLASS` tokens and **zero**
  `text-slate-500`/`text-slate-600` literals (AC-18/AC-20), contains **zero interactive elements** —
  no `<button>`, `<input>`, `<select>`, `<textarea>` or `<a href>` (`uiPrimitives.test.tsx`'s raw-
  element governance and M40_P3's sub-44px allowlist), and declares **zero explicit `h-N` height
  classes** (`controlTargetSize.test.ts`). **Editing any pre-existing test file is a halt-and-report
  signal**, exactly as M42_P1's AC-19 established — it means behavior drifted, and the correct
  response is to stop, not to relax the sweep.

---

## 1. Data Schema & Contracts

**No database schema change. No new migration. No `shared-types` change. No API change.**

### Exported constants — new, `scripts/nodeVersion.mjs` (new file, pure, zero imports)

| Symbol | Type | Value | Meaning |
|---|---|---|---|
| `MINIMUM_NODE_MAJOR` | `number` | `24` | Lowest Node major the app supports (RA-4) |
| `NODE_DOWNLOAD_URL` | `string` | `'https://nodejs.org/'` | Printed in the failure message; also asserted present in `README.md` |

### Pure function contracts — `scripts/nodeVersion.mjs`

```js
/**
 * Pure. Extracts the major version from a Node version string.
 * Accepts an optional leading "v"; ignores minor, patch and any
 * pre-release/build suffix. Returns null for anything it cannot
 * resolve to a positive integer — never NaN, never 0.
 * @param {unknown} versionString
 * @returns {number | null}
 */
export function parseNodeMajor(versionString)

/**
 * Pure. True iff parseNodeMajor(versionString) >= MINIMUM_NODE_MAJOR.
 * Fails closed: any input parseNodeMajor cannot resolve returns false.
 * @param {unknown} versionString
 * @returns {boolean}
 */
export function isSupportedNodeVersion(versionString)
```

Boundary table (binding, and directly mirrored by AC-2/AC-3/AC-4/AC-5):

| Input | `parseNodeMajor` | `isSupportedNodeVersion` |
|---|---|---|
| `'v24.0.0'` | `24` | `true` (inclusive `>=`) |
| `'24.0.0'` | `24` | `true` |
| `'v024.0.0'` | `24` | `true` |
| `'v24'` | `24` | `true` |
| `'v25.0.0-nightly20260101'` | `25` | `true` |
| `'v26.8.1'` | `26` | `true` |
| `'v23.11.1'` | `23` | `false` |
| `'v0.10.0'` | `0` → treated as unresolved → `null` | `false` |
| `''` / `'   '` / `'banana'` / `'v'` / `undefined` / `null` | `null` | `false` |

### Root `package.json` script contract

| Script | Value after this phase | Status |
|---|---|---|
| `brew` | `node scripts/brew.mjs` | **new** |
| `smoke` | `node scripts/smoke-artifact.mjs` | **new** |
| `test` | `npm test --workspaces --if-present && vitest run` | **modified** (RA-9) |
| `dev`, `dev:web`, `dev:api`, `build`, `start`, `typecheck`, `lint`, `db:generate`, `db:seed` | unchanged, byte-for-byte | **untouched** |

Root `devDependencies` gains `"vitest": "^3.2.4"` (the exact range both workspaces already declare,
so the lockfile resolves it to an already-present version and no new package is downloaded).

### New symbols — `apps/web/src/components/ServerSecurityNotice.tsx`

```tsx
/** Static, non-interactive Settings card stating the honest security posture. */
export function ServerSecurityNotice(): React.JSX.Element
```

Takes no props, holds no state, performs no I/O, and renders a single
`<div className={CARD_CLASS} data-testid="settings-security-notice">` containing an
`aria-hidden` lucide icon, an `<h2 className={SECTION_HEADING_CLASS}>`, and one or more
`<p className={BODY_TEXT_CLASS}>`. Constraints per RA-18.

### Modified symbols

| Symbol | File | Change |
|---|---|---|
| module body | `apps/web/src/components/SettingsManager.tsx` | **+1** import line, **+1** JSX line (`<ServerSecurityNotice />` as the last card in the `flex flex-col gap-6` settings stack). Zero removed lines, zero modified lines. |
| `scripts.test` / `scripts.brew` / `scripts.smoke` / `devDependencies` | root `package.json` | per the table above |

### Untouched symbols (must not change)

Everything exported from `apps/api/src/config.ts` (`resolveConfig`, `describeListenAddresses`,
`ENV_*`, `DEFAULT_PORT`, `DEFAULT_HOST`), `buildServer`, `runMigrations`, `openDatabase`,
`seedDatabase`, every `register*Routes`, every export of
`apps/web/src/components/designSystem.ts`, `registerServiceWorker` and everything under
`apps/web/src/pwa/`, every export of `packages/**`, and every function in
`scripts/typecheck-all.mjs`.

---

## 2. Transformations & Integration

### Pure layer — `scripts/nodeVersion.mjs`

Zero imports (not even `node:` builtins). Zero side effects: no `console`, no `process.exit`, no
`spawn`, no filesystem access. Importing this module from a test must be free of observable effects
(AC-6). This is what allows the version gate to be exhaustively tested without the test triggering
an install.

### Stateful layer — `scripts/brew.mjs` (binding step order)

Repo root is resolved as `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')`, the
same idiom `apps/api/src/index.ts` already uses.

1. **Version gate, before anything else.** If `isSupportedNodeVersion(process.version)` is `false`:
   print a brewer-readable message naming (a) the version actually detected, (b)
   `MINIMUM_NODE_MAJOR`, (c) `NODE_DOWNLOAD_URL`, then `process.exit(1)`. **No child process is
   spawned on this path** (AC-8).
2. `npm install` — `spawnSync`, `cwd` = repo root, `stdio: 'inherit'`,
   `shell: process.platform === 'win32'`. Non-zero status → print a plain-language failure line and
   `process.exit(status)`. Do not continue.
3. `npm run build` — same options, same failure handling.
4. `npm start` — same options. When it exits, exit with its status. This step is the process's
   remaining lifetime; Ctrl+C reaches the child through the inherited stdio/process group and ends
   both.
5. No step's non-zero exit code is ever swallowed, remapped to 0, or retried.

### Stateful layer — `scripts/smoke-artifact.mjs` (binding step order)

`node:` builtins only; no vitest, no assertion library, no third-party HTTP client (`fetch` is a
Node global).

1. **Preflight.** If `apps/api/dist/index.js` or `apps/web/dist/index.html` is missing: print a
   message naming `npm run build` and exit non-zero. **Spawn nothing** (AC-15).
2. Acquire an ephemeral free port by binding `net.createServer()` to `127.0.0.1:0` and closing it.
3. Create a temp dir via `fs.mkdtempSync`; spawn `node apps/api/dist/index.js` with
   `HOST=127.0.0.1`, `PORT=<ephemeral>`, `TRUCHABREW_DB_PATH=<tempdir>/smoke.db`,
   `TRUCHABREW_STATIC_ROOT=<repo>/apps/web/dist`; capture stdout/stderr while echoing them.
4. Poll `GET /api/health` until `200`, bounded (≤ 30 s). On timeout: print the captured output and
   fail.
5. Assert, in one run:
   - `GET /api/health` → `200`, body `{ ok: true, foreignKeys: 1 }`;
   - `GET /` → `200`, `content-type` contains `text/html`, body contains **both** `<div id="root">`
     **and** `/manifest.webmanifest` (proves the genuine Vite+P2 build, not a placeholder shell —
     the assertion is agnostic about whether `@fastify/static`'s index or the SPA fallback served
     it, since both must return the same file);
   - `GET /recipes/smoke-check` → `200`, `text/html`, same two markers (SPA fallback);
   - `GET /api/nope` → `404`, `content-type` contains `application/json`;
   - captured stdout contains ≥ 1 line matching `TruchaBrew server: http://`.
6. **Teardown runs on every path, including assertion failure** (`try/finally`): `SIGTERM` the
   child, wait ≤ 5 s, `SIGKILL` if still alive, then `fs.rmSync(tempdir, { recursive: true, force:
   true })`.
7. Exit `0` only if every assertion passed; otherwise exit `1` after printing the **name** of the
   first failing assertion.

**No-match / isolation contract:** the smoke run must never touch
`apps/api/data/truchabrew.db`. Its DB lives and dies in the temp dir (AC-17).

### `.github/workflows/ci.yml` (binding shape)

Single workflow, single job, `runs-on: ubuntu-latest`. Triggers: `push` (branch `master`),
`pull_request`, `workflow_dispatch`. Steps, in this order:

1. `actions/checkout@<pinned major>`
2. `actions/setup-node@<pinned major>` with `node-version: '24'` and `cache: 'npm'`
3. `npm ci`
4. `npm test`
5. `npm run typecheck`
6. `npm run build`
7. `npm run lint`
8. `npm run smoke`

Each gate is its **own step**, so a red gate is identifiable from the step name without reading
logs. Steps 4–8 run in that order because `npm test` already builds the API in
`productionSmoke.test.ts`'s `beforeAll`, `npm run build` produces the web `dist/` that step 8
requires, and `npm run smoke` therefore runs last against a complete tree. No step declares
`continue-on-error` (RA-14).

### README structure (binding section set)

Written for a homebrewer. Required sections, in a reading order that matches what they do:

1. What TruchaBrew is — two or three sentences, no jargon.
2. **What you need** — a PC (Windows/macOS/Linux), **Node.js 24 or newer** with `https://nodejs.org/`,
   and a phone on the same wifi.
3. **Get the files** — the GitHub ZIP download (Code → Download ZIP) or `git clone`, then unzip.
4. **The one command** — open a terminal in the folder and run `npm run brew`; the first run takes a
   few minutes.
5. **Open it** — the server prints addresses; use the `http://localhost:…` one on the PC and the
   `http://192.168.x.x:…` one on the phone.
6. **Put it on your phone's home screen** — Android/Chrome and iOS/Safari, both named.
7. **Your data** — lives at `apps/api/data/truchabrew.db` on your own machine, is never uploaded
   anywhere, and can be exported from **Settings → Database Backup & Export**.
8. **Security — please read** — no login, no password, no encryption; anyone on the same network can
   open it; never port-forward it or expose it to the internet; it is built for a trusted home
   network.
9. **Stopping and restarting** — Ctrl+C to stop; `npm run brew` to start again; `npm start` as the
   fast restart once it is already built.
10. **If it doesn't work** — phone can't connect → allow Node through the firewall (on Windows, tick
    **Private networks** on the Defender prompt); check both devices are on the same wifi and not a
    guest network; `npm` not recognized → Node isn't installed or the terminal needs restarting;
    port already in use → set `PORT`.
11. **For developers** — `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`,
    `npm run lint`, `npm run smoke`.

### Refactoring & legacy cleanup

- **The entire Vite starter template README is deleted, not appended to.** `README.md` today is the
  unmodified `# React + TypeScript + Vite` template; every one of its sections (the plugin list, the
  React Compiler note, the "Expanding the Oxlint configuration" block) is removed. AC-22 asserts
  their absence by literal string, so a partial rewrite fails.
- **No obsolete registration path, alias map or dead script is introduced.** `npm start` keeps
  exactly P1's meaning; `npm run dev` keeps exactly its current meaning; `scripts/typecheck-all.mjs`
  is not touched.
- `tsx` remains a devDependency and remains in `dev` and `db:seed` — developer scripts, not the
  brewer's path. AC-10 sweeps the **one-command path** specifically, extending M42_P1's AC-13 rather
  than restating it.
- No `.dockerignore`, `Dockerfile`, `docker-compose.yml` or `compose.yaml` is created; AC-20 asserts
  none exists anywhere in the tree (verified absent this session).

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|---|---|---|
| AC-1 | Version-floor constants exported | Unit | `scripts/nodeVersion.mjs` exports `MINIMUM_NODE_MAJOR === 24` and `NODE_DOWNLOAD_URL === 'https://nodejs.org/'` |
| AC-2 | `parseNodeMajor` normal cases | Unit | `'v24.0.0'`→`24`, `'24.0.0'`→`24`, `'v024.0.0'`→`24`, `'v24'`→`24`, `'v25.0.0-nightly20260101'`→`25`, `'v26.8.1'`→`26` |
| AC-3 | `parseNodeMajor` degenerate/empty inputs | Unit | `''`, `'   '`, `'banana'`, `'v'`, `undefined`, `null` each return **exactly `null`** — never `NaN`, never `0`, never `undefined` |
| AC-4 | `isSupportedNodeVersion` exact boundary | Unit | `'v23.11.1'`→`false`; `'v24.0.0'`→`true` (inclusive `>=`, the boundary value itself passes); `'v24.0.0-rc.1'`→`true`; `'v99.0.0'`→`true` |
| AC-5 | Fail-closed no-match contract | Unit | Every input from AC-3 yields `isSupportedNodeVersion === false`; no input anywhere yields a truthy result from an unparseable string |
| AC-6 | Pure module is side-effect free | Static sweep | `scripts/nodeVersion.mjs` contains **zero** `import`/`require` statements and zero occurrences of `console.`, `process.exit`, `spawn`, `execSync`, `readFile`, `writeFile` |
| AC-7 | `brew.mjs` runs before any install | Static sweep | Every import specifier in `scripts/brew.mjs` is either `node:`-prefixed or exactly `./nodeVersion.mjs`. **Zero** bare package specifiers |
| AC-8 | Version gate precedes every child process | Static sweep | In `scripts/brew.mjs` source order, the first `isSupportedNodeVersion` call and its `process.exit(1)` both appear **before** the first `spawnSync`/`spawn`/`exec` occurrence; the failure branch's message contains the detected version, `MINIMUM_NODE_MAJOR` and `NODE_DOWNLOAD_URL` |
| AC-9 | One-command chain and failure propagation | Static sweep | `brew.mjs` invokes npm exactly three times, in order `install` → `run build` → `start`; every invocation passes `stdio: 'inherit'` and `shell: process.platform === 'win32'`; a non-zero status from any step exits with that same status (zero occurrences of `exit(0)` on a failure path, zero retry loops, zero `\|\| true`) |
| AC-10 | No `tsx` in the one-command path | Static sweep | `scripts/brew.mjs`, and root `package.json`'s `brew`/`build`/`start`, contain zero occurrences of `tsx`. `dev` and `db:seed` retaining `tsx` does **not** fail this |
| AC-11 | Root script contract, including what must NOT change | Static sweep | `brew === 'node scripts/brew.mjs'`, `smoke === 'node scripts/smoke-artifact.mjs'`, `test === 'npm test --workspaces --if-present && vitest run'`; and `dev`, `dev:web`, `dev:api`, `build`, `start`, `typecheck`, `lint`, `db:generate`, `db:seed` are **byte-identical** to their pre-phase values (compared against the values recorded in §1) |
| AC-12 | Root vitest collects only the packaging suite | Verification | `vitest run` at the repo root reports exactly **1** test file, and its path is `test/packaging.test.mjs`; **zero** files under `apps/` are collected (a missing/implicit `include` fails this) |
| AC-13 | The packaging suite is actually inside the Layer 1 test gate | Verification | `npm test` output contains the root packaging suite's own vitest summary in addition to the two workspace summaries |
| AC-14 | Smoke script is dependency-free | Static sweep | Every import specifier in `scripts/smoke-artifact.mjs` is `node:`-prefixed; zero bare package specifiers |
| AC-15 | Smoke preflight on a missing build (degenerate input) | Integration | With `apps/api/dist/index.js` absent (or `apps/web/dist/index.html` absent), `npm run smoke` exits non-zero, its message names `npm run build`, and **no server process is spawned** |
| AC-16 | **Smoke: the real artifact serves the real UI** | Integration (spawn) | `npm run smoke` against a completed `npm run build` exits **0** having asserted all five checks in §2 step 5 — including that `GET /` and `GET /recipes/smoke-check` both return `200 text/html` containing **both** `<div id="root">` and `/manifest.webmanifest`, and that `GET /api/nope` returns `404 application/json` |
| AC-17 | Smoke isolation and cleanup | Integration | The smoke run neither creates nor modifies `apps/api/data/truchabrew.db` (mtime and existence unchanged across a run); after the run the temp dir is gone and no child `node` process survives — asserted for the failing path too, by forcing one assertion to fail once and confirming teardown still ran |
| AC-18 | CI workflow exists and is structurally sane | Static sweep | `.github/workflows/ci.yml` exists, contains **zero tab characters**, and declares `on:` with `push` (branch `master`), `pull_request` and `workflow_dispatch`, and exactly one job with `runs-on: ubuntu-latest` |
| AC-19 | CI runs the four gates plus the smoke, in order | Static sweep | The workflow contains, in this relative source order: `actions/checkout@`, `actions/setup-node@` (with `node-version: '24'` and `cache: 'npm'`), `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`, `npm run smoke` — each as its own step |
| AC-20 | CI scope guardrail — nothing release-shaped, nothing Docker-shaped | Static sweep | The workflow contains zero occurrences of `docker`, `publish`, `release`, `sign`, `notariz`, `deploy`, `secrets.`, `upload-artifact`, `matrix`, `schedule`, `continue-on-error`, `retry`. Separately, the repo contains **no** `Dockerfile`, `docker-compose*`, `compose.y*ml` or `.dockerignore` anywhere outside `node_modules` |
| AC-21 | **Node-floor lockstep across three files** | Integration | The integer in `MINIMUM_NODE_MAJOR`, the major in `.github/workflows/ci.yml`'s `node-version`, and the version stated in `README.md` are **the same number**. Changing any one alone turns this red |
| AC-22 | The Vite template README is gone, not appended to | Static sweep | `README.md` contains **zero** occurrences of `This template provides a minimal setup`, `@vitejs/plugin-react-swc`, `React Compiler`, and `Expanding the Oxlint configuration` |
| AC-23 | README has every required section | Static sweep | `README.md` contains a heading for each of the eleven §2 sections (what it is, what you need, get the files, the one command, open it, home screen, your data, security, stop/restart, troubleshooting, developers) |
| AC-24 | README names the one command and the fast restart | Static sweep | `README.md` contains `npm run brew` and `npm start`, and contains **zero** instructions telling the brewer to run `npm install` or `npm run build` as separate setup steps (those belong to the developer section only, which must not be phrased as brewer setup) |
| AC-25 | README states the honest security posture | Static sweep | `README.md` states, in the security section: that there is no login/password, that anyone on the same network can open it, and that it must not be exposed to the internet or port-forwarded — asserted by three distinct substring checks |
| AC-26 | README names the data file and the backup path | Static sweep | `README.md` contains `apps/api/data/truchabrew.db` and references **Settings → Database Backup & Export** |
| AC-27 | README troubleshooting covers the two real failure modes | Static sweep | `README.md`'s troubleshooting section names the firewall case (allowing Node on a **private** network) and the `PORT` override |
| AC-28 | In-app security notice renders the required copy | Unit (render) | Rendering `<ServerSecurityNotice />` produces an element with `data-testid="settings-security-notice"` whose text states: no login/password, visible to anyone on the same wifi, not to be exposed to the internet, and that the data lives in a file on this machine |
| AC-29 | In-app notice is token-clean and non-interactive | Static sweep | `ServerSecurityNotice.tsx` declares zero local class-string constants; references only `CARD_CLASS`, `SECTION_HEADING_CLASS`, `BODY_TEXT_CLASS` from `designSystem`; contains zero `<button>`, `<input>`, `<select>`, `<textarea>`, `<a ` elements; contains zero `h-` height classes and zero `text-slate-500`/`text-slate-600` literals |
| AC-30 | `SettingsManager.tsx` change is exactly two added lines | Verification | `git diff -- apps/web/src/components/SettingsManager.tsx` shows exactly **2 added lines, 0 removed, 0 modified** (viable for this file specifically: it is clean at `HEAD` — see RA-17); `<ServerSecurityNotice` appears exactly once and is the last card in the settings stack |
| AC-31 | Pre-existing suites and governance sweeps pass unedited | Regression | The full `apps/web` and `apps/api` suites pass with **no edits to any pre-existing test file**, including `designTokens.test.ts`, `designSystem.test.ts`, `controlTargetSize.test.ts`, `uiPrimitives.test.tsx` and `ScopeGuardrail.test.tsx`. A required edit is a **halt-and-report** signal, not a fix |
| AC-32 | Four Layer 1 gates green locally | Verification | `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` each exit 0. Test count ≥ the post-M42_P2 baseline (2,824 passed / 2 skipped across 141 files) plus this phase's new tests; existing counts do not drop. `npm run smoke` also exits 0 locally |
| AC-33 | **MANUAL / real GitHub** — CI actually runs green | Manual | After the first push containing this workflow, the GitHub Actions run completes green on all eight steps, and its reported test counts match the local counts from AC-32 for the same commit. Evidence: run URL + screenshot in `.gsd/active/manual_verification/`. **Not a Layer 1 gate** — no local check can prove the YAML parses or the runner behaves (RA-13). If `BUG-043` fires, record the failing test name and re-run; do not add a retry (RA-14) |
| AC-34 | **MANUAL / clean machine, real person** — the hand-off rehearsal | Manual | On a machine with **no repo checkout and no Node toolchain**, a person who is **not the author**, following **only `README.md`**, installs Node, gets the files, runs `npm run brew`, opens the printed address, reaches it from a phone on the same wifi, adds it to the home screen, and opens a recipe. Evidence in `.gsd/active/manual_verification/`. **This is the milestone's verification threshold and cannot be inferred from AC-16 or AC-33** (RA-12). Blocked if the repository is unreachable by the tester (RA-15) |
| AC-35 | **MANUAL** — inherited outstanding evidence is captured in the same rehearsal | Manual | The rehearsal also closes M42_P1's AC-21/AC-22 (a phone reaches the built server at the address it actually printed, verbatim, with no IP-hunting) and M42_P2's AC-36 (real-browser install prompt on localhost and LAN, checking the critic's flagged first-load/reload caveat). Recorded alongside AC-34's evidence |
| AC-36 | Scope guardrail — SHA-256 content manifest, **not** `git diff` | Verification | A SHA-256 manifest taken with `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum` **immediately before the first edit** and again at the end differs on **exactly** the twelve Authorized Files and nothing else. `git diff --name-only` against `HEAD` (`3959a66`) is **explicitly not viable** here and must not be substituted: the tree already carries 24 uncommitted M42_P1/M42_P2 entries, so a repo-wide diff cannot isolate this phase (RA-17) |

---

## 4. Authorized Files

**Modified**
1. `README.md` (full rewrite — the Vite template is deleted, not extended)
2. `package.json` (root — `brew`/`smoke` scripts, extended `test`, `vitest` devDependency)
3. `package-lock.json` (dependency install side effect)
4. `apps/web/src/components/SettingsManager.tsx` (**exactly two added lines** — RA-1, AC-30)

**New**
5. `scripts/nodeVersion.mjs`
6. `scripts/brew.mjs`
7. `scripts/smoke-artifact.mjs`
8. `vitest.config.mjs` (root)
9. `test/packaging.test.mjs` (root)
10. `.github/workflows/ci.yml`
11. `apps/web/src/components/ServerSecurityNotice.tsx`
12. `apps/web/test/ServerSecurityNotice.test.tsx`

**Explicitly NOT authorized:** any file under `apps/api/**` (P1's territory — including
`apps/api/test/productionSmoke.test.ts`, which stays exactly as it is), any file under `packages/**`,
any file under `apps/web/public/**` or `apps/web/src/pwa/**` (P2's territory), any other file under
`apps/web/src/`, any **pre-existing** file under `apps/web/test/`, `apps/web/vite.config.ts`,
`scripts/typecheck-all.mjs`, `.oxlintrc.json`, `.gitignore`, any `tsconfig*.json`, `.gsd/**` other
than this spec and the state/roadmap updates that accompany it, and any Docker, Compose or
container-registry artifact of any kind.

---
> **HALT GATE (STATE 2):** Review this feature specification. Reply with **SPEC_APPROVED** to begin execution.
