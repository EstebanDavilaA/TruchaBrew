# FEATURE SPECIFICATION: M42_P2 — A brewer's phone can install TruchaBrew

## Phase Summary

Milestone 42 Phase 2 of 3. Phase 1 shipped the single-port production server: it
builds `apps/web` and `apps/api`, serves the built UI from `apps/web/dist` at `/` via
`@fastify/static`, and prints the LAN address to type into a phone. But the app that a
phone receives is still a browser tab with a URL bar and no identity of its own — nothing
tells the phone "this is an app you can put on your home screen and open full-screen."

This phase makes the **built web app PWA-installable** so a phone (or desktop) pointed at
the M42_P1-served origin can add TruchaBrew to its home screen and launch it chromeless.
It delivers exactly what the Milestone 42 roadmap's hardening scope calls for and *no
more*: a `manifest.webmanifest` (name, icons, theme colour, `standalone` display), a set
of raster icons derived from the app's existing `favicon.svg` brand mark, and a **minimal
network-passthrough service worker** that earns add-to-home-screen and a chromeless
launch while provably **never** serving a stale response. It is explicitly **not** an
offline cache — that is deferred (roadmap Deferred entry), and a service worker that
silently served stale brew-day gravity readings would be worse than none.

This phase is `apps/web/**`-only (per the RA-1 directory-disjointness rule from M42_P1);
it does not touch `apps/api`, `packages/`, root `package.json`, `README.md`, or
`.github/`.

### Key Behaviors

1. The built origin serves a parseable web manifest at `/manifest.webmanifest` whose
   required fields (`name`, `short_name`, `start_url`, `scope`, `display: "standalone"`,
   `theme_color`, `background_color`, and `icons` with 192×192 and 512×512 entries) make
   the app installable under current installability criteria.
2. Raster icons exist at the required sizes (192, 512, and a 180px apple-touch-icon),
   derived from the existing `favicon.svg` brand mark on the app's own dark background,
   and are referenced by the manifest / linked from `index.html`.
3. A minimal **network-passthrough** service worker is served at `/sw.js` with scope `/`.
   Its fetch handler forwards every request straight to the network and it contains **no
   cache storage API of any kind**, so no request — including an API reading that returns
   a live gravity — can ever be answered from a stale stored copy.
4. `index.html` links the manifest and the apple-touch icon and declares the
   `theme-color`; the app registers the service worker only in a production build when a
   service-worker-capable (secure) context is present, and never throws when it is not.
5. No regression to the recipe/library/brew UI, and the four Layer 1 gates stay green
   (typecheck/build/lint exit 0; the web test suite gains no **new** failure beyond the
   documented pre-existing out-of-scope drift — see RA-3).

### Resolved Ambiguities (Binding)

- **RA-1 — Manifest filename and location.** `apps/web/public/manifest.webmanifest`,
  which `vite build` copies verbatim to `dist/manifest.webmanifest`, served by the
  M42_P1 `@fastify/static` handler at the origin root as `/manifest.webmanifest`.
  `.webmanifest` is the correct modern extension and is verified to map to
  `application/manifest+json` in this repo's installed `mime-db`, so the static server
  returns the proper content type. `index.html` links it with
  `<link rel="manifest" href="/manifest.webmanifest" />`. This is **not** `manifest.json`
  (the roadmap uses "manifest.json" generically); the binding choice is
  `manifest.webmanifest`.
- **RA-2 — Manifest field values (exact, binding).** `name`/`short_name` both
  `"TruchaBrew"`; `description` byte-identical to the existing `index.html` meta
  description (`"TruchaBrew — Advanced Homebrewing Recipe Designer & Brewery Management
  Suite"`); `start_url` `"/"` and `scope` `"/"` (the M42_P1 origin serves the SPA at
  `/`); `display` `"standalone"` (chromeless launch); `background_color` `"#020617"`
  (slate-950 — the `index.css` `body` background and the app shell background, so the
  launch splash matches the app); `theme_color` `"#0f172a"` (slate-900 — the persistent
  `TopBar`/`Sidebar` chrome surface that occupies the top of a standalone window).
  Theme/brand hex values are exact, lowercase, and consistent between the manifest, the
  `index.html` `theme-color` meta, and the icon artwork background.
- **RA-3 — Icon sourcing (derive, don't invent).** The only brand asset that exists is
  `apps/web/public/favicon.svg` (the purple monogram mark, already linked as the favicon
  and kept untouched). No new design asset is fabricated. P2 authoring renders that mark
  onto the app's `#020617` background at three square raster sizes and commits them as
  static files: `apps/web/public/icons/icon-192.png` (192×192),
  `apps/web/public/icons/icon-512.png` (512×512), and
  `apps/web/public/icons/apple-touch-icon.png` (180×180). These are committed binaries
  produced **once** at authoring time (the executor's choice of rasterizer, e.g. a
  system tool or a one-shot Node devDependency like `@resvg/resvg-js`); vite copies them
  to `dist/icons/` verbatim. **No rasterization runs in the production build and no new
  runtime dependency is added** — the shipped app and the M42_P1 server never touch the
  rasterizer. ACs verify the *result* (valid PNG signature + exact pixel dimensions +
  referenced + copied to dist), not the means. The 512 icon is also declared with
  `purpose: "maskable"` in the manifest (same file); a purpose-built safe-zone maskable
  asset is explicitly **not** required this phase — acceptable minimal, and not a
  blocker for installability. Deferred.
- **RA-4 — Service worker must satisfy the fetch-handler install criterion without any
  caching.** A service worker that only registers (no fetch listener) may not satisfy
  Chromium's installability criterion that the controlling worker has a fetch handler.
  Binding: `sw.js` **does** contain an explicit fetch listener, but it is a pure
  network passthrough — `event.respondWith(fetch(event.request))` — which forwards every
  request live to the network. Combined with the complete absence of the Cache Storage
  API, this both earns installability and is the strongest no-stale guarantee: there is
  no code path by which any request, API or otherwise, is answered from storage.
- **RA-5 — The no-stale-data guarantee is proven by static contract, honestly scoped.**
  jsdom (this repo's test environment) cannot execute a real service worker, so the
  automated no-stale proof is a **static source contract** on `apps/web/public/sw.js`:
  it must call `self.skipWaiting()` (install), `self.clients.claim()` (activate), and
  `event.respondWith(fetch(event.request))` (fetch), and it must contain **zero**
  occurrences of any caching/interception-to-storage construct (`caches`, `CacheStorage`,
  `.cache.`, `cache.add`, `cache.put`, `cache.match`, `addAll`, `waitUntil` for
  precaching). Because there is no storage read and no interception-to-storage, no
  response can be stale by construction. Real end-to-end SW behavior (registration,
  control, live passthrough) is confirmed by a **manual, real-browser** AC (AC-36), the
  same real-hardware class as M42_P1's AC-21/22 — it is not a Layer 1 gate.
- **RA-6 — Registration is a pure-guard + injected-stateful split, and never throws.**
  A pure decision (`shouldRegisterServiceWorker`) gates a stateful registration
  (`registerServiceWorker`) that takes injectable dependencies so every branch is
  unit-testable. Registration happens **only** when `isProd` is true **and** a service
  worker container is available; otherwise it is a no-op resolving `false`. Any
  `register()` rejection is caught and resolves `false`. `main.tsx` calls it
  fire-and-forget (`void registerServiceWorker()`), so neither a rejection nor an absent
  service-worker API can ever surface an error to the user or break rendering.
- **RA-7 — Secure-context reality over the M42_P1 plain-HTTP origin (honest, binding).**
  Service workers and full PWA install require a secure context (HTTPS or `localhost`);
  the M42_P1 server prints plain `http://<LAN-IP>:5177`, which is **not** a secure
  context on a phone, so over the raw LAN origin `navigator.serviceWorker` is absent and
  registration correctly no-ops (RA-6) rather than erroring. The manifest + icons +
  apple-touch-icon still make the app addable on iOS via "Add to Home Screen" (a
  chromeless web clip over HTTP), and full SW-controlled install works over
  `http://localhost:5177` (secure context) and over any future HTTPS serving of the same
  `dist/`. This limitation is **not** hidden: AC-36 (manual install) is written to
  observe and record what actually happens on the tester's phone/browser over the LAN
  URL, and the out-of-scope note (TLS, hosting) stands. No phase of Milestone 42 adds
  TLS; this spec does not pretend the plain-HTTP LAN origin is a full-install context.
- **RA-8 — Pre-existing web drift is out of scope; P2 must not touch it.** ***SUPERSEDED
  at `/steer`, 2026-09-04*** — *what this RA called "pre-existing drift" was actually an
  unintended reversion (working-tree-only, never committed) of a real Milestone 40 design
  change. Confirmed with the user and restored via `git checkout HEAD --` on all 5 named
  files before Layer 2/3 ran; the 2 failures and the flake described below no longer
  exist, and the full suite is genuinely green (see `.gsd/archive/VERIFICATION_REPORT.md`'s
  M42_P2 entry). The carve-out text below is preserved as historical record of what P2's
  executor actually worked against — do not read it as a standing allowance.* The working
  tree already carries uncommitted, out-of-band drift in `apps/web/src/components/
  HopSection.tsx` and `apps/web/src/components/MiscSection.tsx` plus their coupled test
  files (`FermentableSection.test.tsx`, `MiscSection.test.tsx`, `YeastSection.test.tsx`),
  causing **2 pre-existing web test failures** (FermentableSection AC-3, HopSection
  AC-16) and a re-run-passing flake (`App.test.tsx`, M38_P3 AC-32). Because of this,
  root `npm test` exits non-zero **before** P2 does anything. P2 neither repairs nor
  edits any of those files (they are all in the Untouched list). The Layer-1 test gate
  (AC-34) is expressed as: the executor captures the pre-edit failing-test set, and after
  P2 the failing set is **unchanged** (no new failure) while every P2-added test passes.
  This is the honest way to gate a `apps/web` phase that shares directories with
  pre-existing drift — see the note in RA-10 on why a plain "exit 0" is not claimable.
- **RA-9 — `sw.js` and `oxlint`.** Lint is root `oxlint`. If `oxlint` scans
  `apps/web/public/sw.js` and flags browser globals (`self`, `event`, `fetch`), the
  executor may add **one inline disable comment at the top of `sw.js`** (authorized
  content of an authorized file). The executor must **not** modify any lint/oxlint
  config or ignore file (all out of scope). AC-33 requires lint exit 0 with no **new**
  finding attributable to P2. `tsc` does not typecheck `public/sw.js` (it is not in any
  `tsconfig` include), and `ScopeGuardrail.test.tsx`'s raw-HTML ban applies only to
  `apps/web/src` JSX, so the new pure-TS registration module is unaffected.
- **RA-10 — Why the scope guardrail is a SHA-256 content-manifest diff, not
  `git diff --name-only`.** M42_P1's spec used `git diff --name-only 3959a66` because its
  working tree was clean. That is **not** viable here: the working tree already contains
  M42_P1's uncommitted `apps/api` changes **and** the pre-existing web drift (RA-8), so a
  diff against `3959a66` (M41) cannot isolate P2's `apps/web` changes from pre-existing
  noise. Binding guardrail: a pre/post-execution **SHA-256 content manifest**
  (`git ls-files -co --exclude-standard -z | xargs -0 sha256sum`), captured by the
  executor before its first edit and again at the end. The only files whose hashes change
  (or appear as new) between the two manifests must be exactly the Authorized Files, and
  every Untouched file — including the five drift files in RA-8 — must have an identical
  hash in both manifests, proving P2 never touched them. (AC-37.)

---

## 1. Data Schema & Contracts

**No database schema change. No new migration. No `shared-types`, `calculations`, or
`apps/api` change.**

### The manifest — canonical expected content (binding), `apps/web/public/manifest.webmanifest`

The file must exist, be valid JSON, and parse to exactly these values:

```json
{
  "name": "TruchaBrew",
  "short_name": "TruchaBrew",
  "description": "TruchaBrew — Advanced Homebrewing Recipe Designer & Brewery Management Suite",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#020617",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

These are data values, not code. Exact string equality is asserted by the ACs (RA-2).

### Icon files — `apps/web/public/icons/` (new, committed static PNGs)

| File | Exact pixel size | Derived from | Purpose |
|---|---|---|---|
| `apps/web/public/icons/icon-192.png` | 192 × 192 | `favicon.svg` mark on `#020617` | manifest `any` 192 |
| `apps/web/public/icons/icon-512.png` | 512 × 512 | `favicon.svg` mark on `#020617` | manifest `any` 512 and `maskable` 512 |
| `apps/web/public/icons/apple-touch-icon.png` | 180 × 180 | `favicon.svg` mark on `#020617` | iOS `apple-touch-icon` link |

### Service worker contract — `apps/web/public/sw.js` (new, classic non-module script)

Served at `/sw.js`; because it lives at the origin root its scope is `/` by default.
Binding required behavior (AC-21..AC-26):

- `install` → `self.skipWaiting()`.
- `activate` → `self.clients.claim()`.
- `fetch` → a listener whose handler calls `event.respondWith(fetch(event.request))`
  (pure network passthrough — never a stored copy).
- **Forbidden (must be absent):** any Cache Storage construct (`caches`, `CacheStorage`,
  `cache.` method access, `cache.add`, `cache.put`, `cache.match`, `addAll`), any use of
  `event.respondWith` with a non-`fetch` argument, and any precache/offline logic (this
  is not an offline cache — deferred). No request or response is ever written to or read
  from storage, so no stale data is possible (RA-5).
- No `import`/module syntax (classic script), no references to modules.

### Registration module — `apps/web/src/pwa/registerSW.ts` (new)

Exported constants & types:

| Symbol | Type | Value / contract |
|---|---|---|
| `SERVICE_WORKER_URL` | `string` | `'/sw.js'` (exported so tests can assert registration target) |
| `SWRegistrationDeps` | `interface` | `{ isProd: boolean; serviceWorker: { register(url: string, opts?: RegistrationOptions): Promise<unknown> } \| undefined }` |
| `shouldRegisterServiceWorker` | pure fn | `(input: { isProd: boolean; serviceWorkerAvailable: boolean }) => boolean` |
| `registerServiceWorker` | stateful fn | `(deps: SWRegistrationDeps = defaultSWDeps()) => Promise<boolean>` |
| `defaultSWDeps` | fn | returns `{ isProd: import.meta.env.PROD, serviceWorker: ('serviceWorker' in navigator) ? navigator.serviceWorker : undefined }` |

**`shouldRegisterServiceWorker` contract:** returns `input.isProd && input.serviceWorkerAvailable` — pure, no DOM, no globals.

**`registerServiceWorker` contract (no-match/fallback binding):**
1. If `!shouldRegisterServiceWorker({ isProd: deps.isProd, serviceWorkerAvailable: deps.serviceWorker != null })`, return `false` immediately (no `register` call). This is the fallback for dev mode, for non-secure contexts where no service worker exists, and for any test.
2. Otherwise `try { await deps.serviceWorker.register(SERVICE_WORKER_URL); return true; } catch { return false; }`.
3. Never throws in any path.

### `apps/web/index.html` (modified) — reconciliation note

Today `index.html` head contains: charset, the `favicon.svg` link
(`<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`), viewport, description
meta, and `<title>TruchaBrew</title>`. There is **no** existing manifest link,
`theme-color` meta, or apple-touch-icon — so P2 **adds** (does not duplicate):
- `<link rel="manifest" href="/manifest.webmanifest" />`
- `<meta name="theme-color" content="#0f172a" />`
- `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`

The existing `favicon.svg` icon link is **retained unchanged** (no second icon `rel`, no
removal).

### `apps/web/src/main.tsx` (modified)

Adds one import of `registerServiceWorker` from `./pwa/registerSW` and one
fire-and-forget `void registerServiceWorker();` call after render. No other change.

### Symbol Inventory

**Authorized — Modified:**
1. `apps/web/index.html`
2. `apps/web/src/main.tsx`

**Authorized — New:**
3. `apps/web/public/manifest.webmanifest`
4. `apps/web/public/sw.js`
5. `apps/web/public/icons/icon-192.png`
6. `apps/web/public/icons/icon-512.png`
7. `apps/web/public/icons/apple-touch-icon.png`
8. `apps/web/src/pwa/registerSW.ts`
9. `apps/web/test/pwaManifest.test.ts` (manifest/icon/index.html reconciliation + dist-post-build presence)
10. `apps/web/test/registerSW.test.ts` (pure decision matrix + stateful register with injected deps + `sw.js` static contract)

**Untouched — must not change (authoritative, exhaustive for the risky set):**
- All five pre-existing drift files (RA-8): `apps/web/src/components/HopSection.tsx`,
  `apps/web/src/components/MiscSection.tsx`, `apps/web/test/FermentableSection.test.tsx`,
  `apps/web/test/MiscSection.test.tsx`, `apps/web/test/YeastSection.test.tsx`.
- `apps/web/public/favicon.svg`, `apps/web/public/icons.svg` (kept as-is; the favicon
  stays the favicon).
- Every other file under `apps/web/` (all components, pages, hooks, api client, css,
  existing tests, `vite.config.ts`, `package.json`).
- **Everything outside `apps/web/`:** `apps/api/**`, `packages/**`, root
  `package.json`/`package-lock.json`, `README.md`, `.github/**`, `.gsd/**`, any lint or
  config file at any level.

---

## 2. Transformations & Pure Logic

### Pure function contract — `shouldRegisterServiceWorker`

```
shouldRegisterServiceWorker({ isProd: boolean, serviceWorkerAvailable: boolean }) -> boolean
```
Deterministic; returns `isProd && serviceWorkerAvailable`. No side effects, no globals.

### Stateful integration — `registerServiceWorker` + `main.tsx`

1. `defaultSWDeps()` reads `import.meta.env.PROD` (compile-time `false` in dev/vitest,
   `true` in a production build) and `navigator.serviceWorker` (present only in a secure,
   service-worker-capable context).
2. `registerServiceWorker(deps)` applies the pure guard, then registers
   `SERVICE_WORKER_URL` (`/sw.js`) with **no** `scope` option (default scope `/`), and
   resolves `true` on success or `false` on rejection/absence — never throwing.
3. `main.tsx` calls `void registerServiceWorker()` once after render, fire-and-forget —
   not awaited, never on the render critical path, never surfaced as an error.

### Service-worker lifecycle (runtime, real browser)

`/sw.js` installs → `skipWaiting` → activates → `clients.claim` → controls the page →
its fetch listener forwards every request live to the network. Because no cache API
exists, no stored response is ever produced. This is the stateful frame of the feature;
its automated proof is the static contract in RA-5 + the manual real-browser AC-36.

### No-match / fallback contracts

- `registerServiceWorker` in dev, non-PROD, non-secure, or test contexts returns `false`
  (never registers, never throws) — fallback placeholders never leak into state.
- `sw.js`'s fetch path has no "no-match" branch: every request goes to the network; there
  is no cache to miss and no fallback to serve stale.
- Over a plain-HTTP LAN origin (no service worker), the app is unaffected: no error, no
  crash, no registration attempt (RA-7).

### Refactoring & legacy cleanup

- There is **no** prior manifest, service worker, theme-color, or apple-touch-icon to
  reconcile away — none exists today (verified). The only reconciliation is additive
  (RA in §1 `index.html`): the existing `favicon.svg` link and description meta are kept
  byte-identical; nothing is duplicated.
- No legacy registration loop, map alias, or dead export is introduced or purged.
- `apps/web/src/api/client.ts` and every existing fetch path are untouched — the service
  worker adds no proxy layer over them (it is a network passthrough, not an interceptor).

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | Manifest file authored and parseable | Unit (fs read) | `apps/web/public/manifest.webmanifest` exists and `JSON.parse` succeeds with no error |
| AC-2 | `name` / `short_name` | Unit | Both parse to exactly `"TruchaBrew"` |
| AC-3 | `description` | Unit | Equals `"TruchaBrew — Advanced Homebrewing Recipe Designer & Brewery Management Suite"` exactly |
| AC-4 | `start_url` | Unit | Equals `"/"` |
| AC-5 | `scope` | Unit | Equals `"/"` |
| AC-6 | `display` | Unit | Equals `"standalone"` |
| AC-7 | `background_color` | Unit | Equals `"#020617"` exactly |
| AC-8 | `theme_color` | Unit | Equals `"#0f172a"` exactly |
| AC-9 | 192 icon entry | Unit | `icons` contains exactly one entry with `src:"/icons/icon-192.png"`, `sizes:"192x192"`, `type:"image/png"`, `purpose:"any"` |
| AC-10 | 512 `any` icon entry | Unit | `icons` contains exactly one `any` entry with `src:"/icons/icon-512.png"`, `sizes:"512x512"`, `type:"image/png"` |
| AC-11 | 512 `maskable` icon entry | Unit | `icons` contains exactly one `maskable` entry with `src:"/icons/icon-512.png"`, `sizes:"512x512"`, `type:"image/png"` |
| AC-12 | Manifest icon `src`s resolve | Unit | Every manifest icon `src` (resolved against `/`) maps to an existing file under `apps/web/public/` |
| AC-13 | `index.html` links manifest | Static/Unit | `<link rel="manifest" href="/manifest.webmanifest" />` present exactly once in `index.html` `<head>` |
| AC-14 | `index.html` theme-color consistency | Static/Unit | A `<meta name="theme-color" content="#0f172a">` exists and equals the manifest `theme_color` |
| AC-15 | `index.html` apple-touch-icon | Static/Unit | `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />` present exactly once |
| AC-16 | Favicon retained, no duplication | Static/Unit | The original `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` is still present and `index.html` contains no second icon `rel` |
| AC-17 | 192 icon valid | Unit (PNG header) | `apps/web/public/icons/icon-192.png` exists, has a valid PNG signature, and is exactly 192×192 px |
| AC-18 | 512 icon valid | Unit (PNG header) | `apps/web/public/icons/icon-512.png` exists, valid PNG, exactly 512×512 px |
| AC-19 | apple-touch icon valid | Unit (PNG header) | `apps/web/public/icons/apple-touch-icon.png` exists, valid PNG, exactly 180×180 px |
| AC-20 | `sw.js` authored at public root | Unit (fs read) | `apps/web/public/sw.js` exists and is non-empty |
| AC-21 | `sw.js` install skips waiting | Static contract | Source contains `skipWaiting` invoked from an `install` listener |
| AC-22 | `sw.js` activate claims clients | Static contract | Source contains `clients.claim` invoked from an `activate` listener |
| AC-23 | `sw.js` fetch is network passthrough | Static contract | Source contains a `fetch` listener calling `event.respondWith(fetch(event.request))` (a live network fetch, never a stored copy) |
| AC-24 | `sw.js` has no cache storage (no-stale) | Static contract | Source contains **zero** occurrences of `caches`, `CacheStorage`, `cache.`, `cache.add`, `cache.put`, `cache.match`, or `addAll` — no storage read or write path exists |
| AC-25 | `sw.js` has no offline/precache logic | Static contract | Source contains no `waitUntil` used for precaching and no `respondWith` argument other than `fetch(...)` |
| AC-26 | `sw.js` served at scope root | Build-time static | After `vite build`, `apps/web/dist/sw.js` exists (copied from `public/`); its origin-root location implies scope `/` |
| AC-27 | Registration pure decision — true case | Unit | `shouldRegisterServiceWorker({ isProd: true, serviceWorkerAvailable: true }) === true` |
| AC-28 | Registration pure decision — dev case | Unit | `shouldRegisterServiceWorker({ isProd: false, serviceWorkerAvailable: true }) === false` |
| AC-29 | Registration pure decision — no-SW case | Unit | `shouldRegisterServiceWorker({ isProd: true, serviceWorkerAvailable: false }) === false`; and `{ isProd: false, serviceWorkerAvailable: false } === false` |
| AC-30 | Stateful register registers correct URL | Unit (injected deps) | `registerServiceWorker({ isProd: true, serviceWorker: fakeRegister })` resolves `true` and `fakeRegister` was called once with exactly `'/sw.js'` (`SERVICE_WORKER_URL`) and no `scope` option |
| AC-31 | Stateful register guards non-prod / no-SW | Unit | `registerServiceWorker({ isProd: false, serviceWorker: fakeRegister })` resolves `false` and `fakeRegister` was **not** called; `registerServiceWorker({ isProd: true, serviceWorker: undefined })` resolves `false` and does not throw |
| AC-32 | Stateful register swallows rejection | Unit | `registerServiceWorker({ isProd: true, serviceWorker: { register: () => Promise.reject(new Error('x')) } })` resolves `false` (does not throw) |
| AC-33 | `main.tsx` registers the SW | Static | `apps/web/src/main.tsx` imports `registerServiceWorker` from the PWA module and calls `void registerServiceWorker()` |
| AC-34 | **Layer 1 test gate — no new web failure** | Verification | Executor records the pre-edit failing web-test set (baseline = the 2 pre-existing drift failures + any re-run flake per RA-8). After P2: the failing set is unchanged (a subset of the baseline), every P2-added test passes, and no previously-passing web test newly fails. Root `npm test`'s non-zero exit is attributable **only** to the documented pre-existing baseline, never to P2 (RA-8/RA-10). All P2 test files run green in isolation |
| AC-35 | **Layer 1 — typecheck / build / lint** | Verification | `npm run typecheck`, `npm run build`, and `npm run lint` each exit 0. Lint introduces no **new** finding attributable to P2 (RA-9). Build additionally confirms the copied output: `apps/web/dist/manifest.webmanifest`, `dist/sw.js`, `dist/icons/icon-192.png`, `dist/icons/icon-512.png`, `dist/icons/apple-touch-icon.png`, and a `dist/index.html` that references `/manifest.webmanifest` all exist (RA: vite `public/` → `dist/`) |
| AC-36 | **MANUAL / real browser — PWA-installability** | Manual | With `npm run build && npm start` (M42_P1) and no dev server, pointed at `http://localhost:5177` (secure context): the manifest loads, the service worker registers and controls the page, and the app is addable to a home screen and launches chromeless (`standalone`). Over the plain `http://<LAN-IP>` URL the tester records what actually happens (full SW install is **not** available on a non-secure origin — RA-7 — while iOS Add-to-Home-Screen still applies). Screenshot evidence in `.gsd/active/manual_verification/`. **Not a Layer 1 gate; must be reported as outstanding, not inferred from the static ACs** |
| AC-37 | **Scope guardrail (SHA-256 manifest diff)** | Verification | `git diff --name-only` against `3959a66` is **NOT** viable here (RA-10: uncommitted M42_P1 + pre-existing web drift). Executor captures a pre-edit SHA-256 content manifest (`git ls-files -co --exclude-standard -z \| xargs -0 sha256sum`) and a post-edit one. The set of files whose hash changed or that are new between the two must equal **exactly** the Authorized Files in §1; every Untouched file — including the five RA-8 drift files — must be byte-identical across both manifests |

---

> **HALT GATE (STATE 2):** Review this feature specification. Reply with **SPEC_APPROVED** to begin execution.
