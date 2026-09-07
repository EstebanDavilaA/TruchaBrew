// M42_P3 root packaging suite (RA-9). Plain ESM JavaScript, not TypeScript —
// deliberate (avoids a fifth scripts/typecheck-all.mjs entry and a new root
// tsconfig). Covers what a static/pure check CAN prove: nodeVersion.mjs's
// boundary behavior, brew.mjs/smoke-artifact.mjs's import hygiene and step
// ordering, the root package.json script contract, the CI workflow's
// content and shape, the README's required sections, and the Node-floor
// lockstep across all three sites.
//
// What this file deliberately does NOT do: spawn a real server, run a real
// `npm run smoke`, or invoke `vitest`/`npm test` recursively on itself.
// Those are Integration/Verification-type ACs (AC-12, AC-13, AC-15, AC-16,
// AC-17) proven by actually running the commands, not by nesting more tests
// around them (RA-12/RA-13 — a test that claimed a real run happened from
// static text would be a lie).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MINIMUM_NODE_MAJOR,
  NODE_DOWNLOAD_URL,
  parseNodeMajor,
  isSupportedNodeVersion,
} from '../scripts/nodeVersion.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf-8');
}

// ---------------------------------------------------------------------------
// AC-1 .. AC-5: scripts/nodeVersion.mjs boundary behavior
// ---------------------------------------------------------------------------

describe('AC-1: nodeVersion.mjs exports the version-floor constants', () => {
  it('MINIMUM_NODE_MAJOR is 24 and NODE_DOWNLOAD_URL is the nodejs.org root', () => {
    expect(MINIMUM_NODE_MAJOR).toBe(24);
    expect(NODE_DOWNLOAD_URL).toBe('https://nodejs.org/');
  });
});

describe('AC-2: parseNodeMajor normal cases', () => {
  it.each([
    ['v24.0.0', 24],
    ['24.0.0', 24],
    ['v024.0.0', 24],
    ['v24', 24],
    ['v25.0.0-nightly20260101', 25],
    ['v26.8.1', 26],
    ['v23.11.1', 23],
  ])('parseNodeMajor(%j) === %j', (input, expected) => {
    expect(parseNodeMajor(input)).toBe(expected);
  });
});

describe('AC-3: parseNodeMajor degenerate/empty inputs return exactly null', () => {
  it.each([['', 'empty string'], ['   ', 'whitespace only'], ['banana', 'non-numeric'], ['v', 'bare v'], [undefined, 'undefined'], [null, 'null'], ['v0.10.0', 'major zero']])(
    '%j (%s) -> null, never NaN, never 0, never undefined',
    (input) => {
      const result = parseNodeMajor(input);
      expect(result).toBe(null);
      expect(Number.isNaN(result)).toBe(false);
      expect(result).not.toBe(0);
      expect(result).not.toBe(undefined);
    },
  );
});

describe('AC-4: isSupportedNodeVersion exact boundary (inclusive >=, major only)', () => {
  it.each([
    ['v23.11.1', false],
    ['v24.0.0', true],
    ['v24.0.0-rc.1', true],
    ['v99.0.0', true],
  ])('isSupportedNodeVersion(%j) === %j', (input, expected) => {
    expect(isSupportedNodeVersion(input)).toBe(expected);
  });
});

describe('AC-5: fail-closed no-match contract', () => {
  it.each(['', '   ', 'banana', 'v', undefined, null, 'v0.10.0'])(
    'isSupportedNodeVersion(%j) === false',
    (input) => {
      expect(isSupportedNodeVersion(input)).toBe(false);
    },
  );
});

describe('AC-6: nodeVersion.mjs is a pure, side-effect-free module', () => {
  const source = read('scripts/nodeVersion.mjs');

  it('has zero import/require statements', () => {
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\s*\(/);
  });

  it('has zero console/process.exit/spawn/execSync/readFile/writeFile occurrences', () => {
    for (const token of ['console.', 'process.exit', 'spawn', 'execSync', 'readFile', 'writeFile']) {
      expect(source).not.toContain(token);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-6 .. AC-10: scripts/brew.mjs static sweeps
// ---------------------------------------------------------------------------

describe('AC-7: brew.mjs imports only node: builtins or ./nodeVersion.mjs', () => {
  it('every import specifier is node:-prefixed or exactly ./nodeVersion.mjs', () => {
    const source = read('scripts/brew.mjs');
    const specifiers = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const spec of specifiers) {
      expect(spec.startsWith('node:') || spec === './nodeVersion.mjs').toBe(true);
    }
  });
});

describe('AC-8: version gate precedes every child process', () => {
  const source = read('scripts/brew.mjs');

  it('isSupportedNodeVersion and process.exit(1) both appear before the first spawn call', () => {
    const gateIdx = source.indexOf('isSupportedNodeVersion');
    const exitIdx = source.indexOf('process.exit(1)');
    // Match an actual invocation (open paren), not the `import { spawnSync }`
    // declaration line itself, which necessarily precedes any logic.
    const spawnIdx = source.search(/spawnSync\s*\(|\bspawn\(|\bexec\(/);
    expect(gateIdx).toBeGreaterThan(-1);
    expect(exitIdx).toBeGreaterThan(-1);
    expect(spawnIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(spawnIdx);
    expect(exitIdx).toBeLessThan(spawnIdx);
  });

  it('the failure branch names the detected version, MINIMUM_NODE_MAJOR and NODE_DOWNLOAD_URL', () => {
    expect(source).toMatch(/process\.version/);
    expect(source).toMatch(/MINIMUM_NODE_MAJOR/);
    expect(source).toMatch(/NODE_DOWNLOAD_URL/);
  });
});

describe('AC-9: one-command chain and failure propagation', () => {
  const source = read('scripts/brew.mjs');

  it('invokes npm exactly 3 times, in order install -> run build -> start', () => {
    const npmCalls = [...source.matchAll(/spawnSync\(\s*['"]npm['"]\s*,\s*\[([^\]]*)\]/g)].map((m) => m[1]);
    expect(npmCalls).toHaveLength(3);
    expect(npmCalls[0]).toMatch(/['"]install['"]/);
    expect(npmCalls[1]).toMatch(/['"]run['"]/);
    expect(npmCalls[1]).toMatch(/['"]build['"]/);
    expect(npmCalls[2]).toMatch(/['"]start['"]/);
  });

  it('every invocation passes stdio: "inherit" and shell: process.platform === "win32"', () => {
    const optionsArgs = [
      ...source.matchAll(/spawnSync\(\s*['"]npm['"]\s*,\s*\[[^\]]*\]\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g),
    ].map((m) => m[1]);
    expect(optionsArgs).toHaveLength(3);
    // All 3 calls must share the same options identifier, and that shared
    // object must declare both flags exactly once.
    expect(new Set(optionsArgs).size).toBe(1);
    expect(source).toMatch(/stdio:\s*['"]inherit['"]/);
    expect(source).toMatch(/shell:\s*process\.platform\s*===\s*['"]win32['"]/);
  });

  it('contains zero exit(0)-on-failure, retry loop, or || true occurrences', () => {
    expect(source).not.toContain('exit(0)');
    expect(source).not.toMatch(/\|\|\s*true/);
    expect(source.toLowerCase()).not.toMatch(/\bretry\b/);
  });
});

describe('AC-10: no tsx in the one-command path', () => {
  it('brew.mjs and the root brew/build/start scripts contain zero occurrences of tsx', () => {
    const brewSource = read('scripts/brew.mjs');
    expect(brewSource).not.toContain('tsx');

    const rootPkg = JSON.parse(read('package.json'));
    expect(rootPkg.scripts.brew).not.toContain('tsx');
    expect(rootPkg.scripts.build).not.toContain('tsx');
    expect(rootPkg.scripts.start).not.toContain('tsx');
  });

  it('dev and db:seed retaining tsx does not fail this (developer scripts, not the brewer path)', () => {
    const rootPkg = JSON.parse(read('package.json'));
    // Not asserted absent — just documenting that their presence is fine.
    expect(typeof rootPkg.scripts.dev).toBe('string');
    expect(typeof rootPkg.scripts['db:seed']).toBe('string');
  });
});

describe('AC-14: smoke-artifact.mjs is dependency-free', () => {
  it('every import specifier is node:-prefixed', () => {
    const source = read('scripts/smoke-artifact.mjs');
    const specifiers = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const spec of specifiers) {
      expect(spec.startsWith('node:')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-11: root package.json script contract
// ---------------------------------------------------------------------------

describe('AC-11: root package.json script contract', () => {
  const pkg = JSON.parse(read('package.json'));

  it('the new/modified scripts have exactly the specified values', () => {
    expect(pkg.scripts.brew).toBe('node scripts/brew.mjs');
    expect(pkg.scripts.smoke).toBe('node scripts/smoke-artifact.mjs');
    expect(pkg.scripts.test).toBe('npm test --workspaces --if-present && vitest run');
  });

  it('the untouched scripts are byte-identical to their pre-phase values', () => {
    const PRE_PHASE_SCRIPTS = {
      dev: 'concurrently -k -n api,web -c yellow,cyan "npm run dev:api" "npm run dev:web"',
      'dev:web': 'npm run dev --workspace=@truchabrew/web',
      'dev:api': 'npm run dev --workspace=@truchabrew/api',
      build: 'npm run build --workspace=@truchabrew/web && npm run build --workspace=@truchabrew/api',
      start: 'npm run start --workspace=@truchabrew/api',
      typecheck: 'node scripts/typecheck-all.mjs',
      lint: 'oxlint',
      'db:generate': 'npm run db:generate --workspace=@truchabrew/api',
      'db:seed': 'npm run db:seed --workspace=@truchabrew/api',
    };
    for (const [name, value] of Object.entries(PRE_PHASE_SCRIPTS)) {
      expect(pkg.scripts[name]).toBe(value);
    }
  });

  it('devDependencies gains vitest at the exact range both workspaces already declare', () => {
    expect(pkg.devDependencies.vitest).toBe('^3.2.4');
  });
});

// ---------------------------------------------------------------------------
// AC-18 .. AC-20: .github/workflows/ci.yml
// ---------------------------------------------------------------------------

describe('AC-18: CI workflow exists, is tab-free, and declares the required triggers/job shape', () => {
  const source = read('.github/workflows/ci.yml');

  it('contains zero tab characters', () => {
    expect(source).not.toContain('\t');
  });

  it('declares push (branch master), pull_request, workflow_dispatch triggers', () => {
    expect(source).toMatch(/^on:/m);
    expect(source).toMatch(/^\s*push:/m);
    expect(source).toContain('master');
    expect(source).toMatch(/^\s*pull_request:/m);
    expect(source).toMatch(/^\s*workflow_dispatch:/m);
  });

  it('declares exactly one job, on ubuntu-latest', () => {
    const runsOnCount = (source.match(/runs-on:/g) ?? []).length;
    expect(runsOnCount).toBe(1);
    expect(source).toContain('runs-on: ubuntu-latest');
  });
});

describe('AC-19: CI runs the four gates plus the smoke, in order, each its own step', () => {
  it('checkout, setup-node(node-version 24, cache npm), npm ci, test, typecheck, build, lint, smoke appear in this relative order', () => {
    const source = read('.github/workflows/ci.yml');
    const markers = [
      'actions/checkout@',
      'actions/setup-node@',
      "node-version: '24'",
      "cache: 'npm'",
      'npm ci',
      'npm test',
      'npm run typecheck',
      'npm run build',
      'npm run lint',
      'npm run smoke',
    ];
    let cursor = -1;
    for (const marker of markers) {
      const idx = source.indexOf(marker);
      expect(idx, `expected to find "${marker}" in ci.yml`).toBeGreaterThan(-1);
      expect(idx, `expected "${marker}" to appear after the previous marker`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it('each gate is declared under its own "- name:" / "run:" step (not chained with &&)', () => {
    const source = read('.github/workflows/ci.yml');
    const nameCount = (source.match(/^\s*- name:/gm) ?? []).length;
    expect(nameCount).toBeGreaterThanOrEqual(8);
  });
});

describe('AC-20: CI scope guardrail — nothing release-shaped, nothing Docker-shaped', () => {
  it('the workflow contains none of the forbidden substrings', () => {
    const source = read('.github/workflows/ci.yml').toLowerCase();
    const forbidden = [
      'docker',
      'publish',
      'release',
      'sign',
      'notariz',
      'deploy',
      'secrets.',
      'upload-artifact',
      'matrix',
      'schedule',
      'continue-on-error',
      'retry',
    ];
    for (const word of forbidden) {
      expect(source).not.toContain(word);
    }
  });

  it('no Dockerfile, docker-compose*, compose.y*ml or .dockerignore exists anywhere outside node_modules', () => {
    const forbiddenNames = /^(Dockerfile|docker-compose.*\.ya?ml|compose\.ya?ml|\.dockerignore)$/i;
    const hits = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (forbiddenNames.test(entry.name)) {
          hits.push(full);
        }
      }
    }
    walk(REPO_ROOT);
    expect(hits).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-21: Node-floor lockstep across three files
// ---------------------------------------------------------------------------

describe('AC-21: Node-floor lockstep across three files', () => {
  it('MINIMUM_NODE_MAJOR, the CI node-version, and the README all name 24', () => {
    expect(MINIMUM_NODE_MAJOR).toBe(24);
    expect(read('.github/workflows/ci.yml')).toContain("node-version: '24'");
    expect(read('README.md')).toMatch(/Node\.js\s*24/i);
  });
});

// ---------------------------------------------------------------------------
// AC-22 .. AC-27: README.md
// ---------------------------------------------------------------------------

describe('AC-22: the Vite starter README is gone, not appended to', () => {
  it('contains zero occurrences of the Vite template markers', () => {
    const readme = read('README.md');
    for (const marker of [
      'This template provides a minimal setup',
      '@vitejs/plugin-react-swc',
      'React Compiler',
      'Expanding the Oxlint configuration',
    ]) {
      expect(readme).not.toContain(marker);
    }
  });
});

describe('AC-23: README has a heading for each of the eleven required sections', () => {
  const readme = read('README.md');

  it.each([
    'What is TruchaBrew?',
    'What You Need',
    'Get the Files',
    'The One Command',
    'Open It',
    "Put It on Your Phone's Home Screen",
    'Your Data',
    'Security',
    'Stopping and Restarting',
    "If It Doesn't Work",
    'For Developers',
  ])('has a heading containing "%s"', (fragment) => {
    const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headingPattern = new RegExp(`^#{1,3}.*${escaped}`, 'm');
    expect(readme).toMatch(headingPattern);
  });
});

describe('AC-24: README names the one command and the fast restart; no brewer-facing npm install/build steps', () => {
  const readme = read('README.md');

  it('contains npm run brew and npm start', () => {
    expect(readme).toContain('npm run brew');
    expect(readme).toContain('npm start');
  });

  it('does not instruct the brewer to run npm install or npm run build as separate setup steps', () => {
    const devIdx = readme.search(/^#{1,3}.*For Developers/m);
    expect(devIdx).toBeGreaterThan(-1);
    const brewerFacing = readme.slice(0, devIdx);
    expect(brewerFacing).not.toContain('npm install');
    expect(brewerFacing).not.toMatch(/npm run build/);
  });
});

describe('AC-25: README states the honest security posture as three distinct statements', () => {
  const readme = read('README.md');

  it('states no login/password', () => {
    expect(readme).toMatch(/no login/i);
    expect(readme).toMatch(/no password/i);
  });

  it('states anyone on the same network can open it', () => {
    expect(readme).toMatch(/anyone (on|connected to) (the )?same wifi network/i);
  });

  it('states it must never be exposed to the internet or port-forwarded', () => {
    expect(readme).toMatch(/never port-forward.*internet|never.*expose.*internet/i);
  });
});

describe('AC-26: README names the data file and the backup path', () => {
  const readme = read('README.md');

  it('contains the db path and the Settings > Database Backup & Export reference', () => {
    expect(readme).toContain('apps/api/data/truchabrew.db');
    expect(readme).toMatch(/Settings.*Database Backup.*Export/s);
  });
});

describe('AC-27: README troubleshooting covers the firewall/private-network case and the PORT override', () => {
  const readme = read('README.md');

  it('names the Windows Private networks firewall case and PORT override', () => {
    expect(readme).toMatch(/private network/i);
    expect(readme).toMatch(/\bPORT\b/);
  });
});
