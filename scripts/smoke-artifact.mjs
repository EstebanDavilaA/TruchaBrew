#!/usr/bin/env node
// Proves the REAL distributable artifact starts and serves the REAL built
// web UI — not a placeholder shell (RA-11, which distinguishes this from
// apps/api/test/productionSmoke.test.ts's mkdtemp'd "SPA SHELL" fixture).
// node: builtins only; no vitest, no assertion library, no third-party HTTP
// client — fetch is a Node global.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_DIST_INDEX = path.join(repoRoot, 'apps', 'api', 'dist', 'index.js');
const WEB_DIST_INDEX_HTML = path.join(repoRoot, 'apps', 'web', 'dist', 'index.html');
const WEB_DIST_ROOT = path.join(repoRoot, 'apps', 'web', 'dist');

// Preflight (AC-15): if the real build is missing, say so and exit — spawn
// NOTHING on this path.
if (!fs.existsSync(API_DIST_INDEX) || !fs.existsSync(WEB_DIST_INDEX_HTML)) {
  console.error(
    'TruchaBrew smoke check: the built artifact is missing (apps/api/dist/index.js or ' +
      'apps/web/dist/index.html not found). Run "npm run build" first, then re-run "npm run smoke".',
  );
  process.exit(1);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      server.close(() => {
        if (port === null) {
          reject(new Error('could not determine an ephemeral port'));
        } else {
          resolve(port);
        }
      });
    });
  });
}

async function waitForHealthy(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.status === 200) return;
      lastError = new Error(`unexpected status ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`server did not become healthy within ${timeoutMs}ms (last error: ${String(lastError)})`);
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const killTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 5000);
    child.once('exit', () => {
      clearTimeout(killTimer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function main() {
  const port = await getFreePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truchabrew-smoke-'));
  const dbPath = path.join(tempDir, 'smoke.db');

  let capturedOutput = '';
  const child = spawn(process.execPath, [API_DIST_INDEX], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      TRUCHABREW_DB_PATH: dbPath,
      TRUCHABREW_STATIC_ROOT: WEB_DIST_ROOT,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    capturedOutput += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    capturedOutput += chunk.toString();
  });

  let firstFailureName = null;

  // Teardown runs on EVERY path, including an assertion failure.
  try {
    try {
      await waitForHealthy(port, 30000);
    } catch (err) {
      console.error('--- captured server output ---');
      console.error(capturedOutput);
      console.error(String(err));
      firstFailureName = 'server did not become healthy within 30s';
      return;
    }

    const assertions = [
      {
        name: 'GET /api/health returns 200 {ok:true,foreignKeys:1}',
        run: async () => {
          const res = await fetch(`http://127.0.0.1:${port}/api/health`);
          const body = await res.json();
          if (res.status !== 200 || body.ok !== true || body.foreignKeys !== 1) {
            throw new Error(`got ${res.status} ${JSON.stringify(body)}`);
          }
        },
      },
      {
        name: 'GET / returns the real built app shell (200 text/html, #root + manifest link)',
        run: async () => {
          const res = await fetch(`http://127.0.0.1:${port}/`);
          const contentType = res.headers.get('content-type') ?? '';
          const body = await res.text();
          if (
            res.status !== 200 ||
            !contentType.includes('text/html') ||
            !body.includes('<div id="root">') ||
            !body.includes('/manifest.webmanifest')
          ) {
            throw new Error(`got ${res.status} ${contentType}`);
          }
        },
      },
      {
        name: 'GET /recipes/smoke-check returns the SPA-fallback app shell',
        run: async () => {
          const res = await fetch(`http://127.0.0.1:${port}/recipes/smoke-check`);
          const contentType = res.headers.get('content-type') ?? '';
          const body = await res.text();
          if (
            res.status !== 200 ||
            !contentType.includes('text/html') ||
            !body.includes('<div id="root">') ||
            !body.includes('/manifest.webmanifest')
          ) {
            throw new Error(`got ${res.status} ${contentType}`);
          }
        },
      },
      {
        name: 'GET /api/nope returns 404 application/json',
        run: async () => {
          const res = await fetch(`http://127.0.0.1:${port}/api/nope`);
          const contentType = res.headers.get('content-type') ?? '';
          if (res.status !== 404 || !contentType.includes('application/json')) {
            throw new Error(`got ${res.status} ${contentType}`);
          }
        },
      },
      {
        name: 'captured stdout contains a "TruchaBrew server: http://" line',
        run: async () => {
          if (!/TruchaBrew server: http:\/\//.test(capturedOutput)) {
            throw new Error('no matching line in captured output');
          }
        },
      },
    ];

    for (const assertion of assertions) {
      try {
        await assertion.run();
      } catch (err) {
        console.error(`--- captured server output ---`);
        console.error(capturedOutput);
        console.error(`${assertion.name}: ${err instanceof Error ? err.message : String(err)}`);
        firstFailureName = assertion.name;
        break;
      }
    }
  } finally {
    await stopChild(child);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  if (firstFailureName) {
    console.error(`\nTruchaBrew smoke check FAILED: ${firstFailureName}`);
    process.exit(1);
  }

  console.log('\nTruchaBrew smoke check passed: the real built artifact starts and serves the real UI.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
