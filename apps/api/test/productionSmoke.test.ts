import { describe, it, expect, beforeAll } from 'vitest';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { createTestDb } from './helpers/testDb';
import { openDatabase } from '../src/db/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const DIST_INDEX = path.join(API_ROOT, 'dist', 'index.js');

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
  });
}

interface SpawnedServer {
  proc: ChildProcess;
  port: number;
  stdout: () => string;
}

async function spawnBuilt(env: Record<string, string>): Promise<SpawnedServer> {
  const port = await getFreePort();
  let out = '';
  const proc = spawn(process.execPath, [DIST_INDEX], {
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout?.on('data', (d) => {
    out += d.toString();
  });
  proc.stderr?.on('data', (d) => {
    out += d.toString();
  });
  return { proc, port, stdout: () => out };
}

async function waitForHealthy(port: number, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.status === 200) return;
      lastErr = new Error(`health status ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Built server did not become healthy within ${timeoutMs}ms: ${String(lastErr)}`);
}

function stopServer(s: SpawnedServer): Promise<void> {
  return new Promise((resolve) => {
    if (s.proc.exitCode !== null || s.proc.signalCode !== null) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      if (s.proc.exitCode === null && s.proc.signalCode === null) s.proc.kill('SIGKILL');
    }, 5000);
    s.proc.once('exit', () => {
      clearTimeout(t);
      resolve();
    });
    s.proc.kill('SIGTERM');
  });
}

async function withServer(
  env: Record<string, string>,
  fn: (s: SpawnedServer) => Promise<void>,
): Promise<void> {
  const s = await spawnBuilt(env);
  try {
    await waitForHealthy(s.port);
    await fn(s);
  } finally {
    await stopServer(s);
  }
}

beforeAll(() => {
  // Build the real artifact with the exact production command (RA-10/AC-12).
  execSync('npm run build', { cwd: API_ROOT, stdio: 'pipe' });
});

describe('M42_P1 production artifact smoke (AC-12, AC-13, AC-17, AC-18, AC-9, AC-10)', () => {
  it('AC-12: build produced a non-empty runnable artifact', () => {
    expect(fs.existsSync(DIST_INDEX)).toBe(true);
    expect(fs.statSync(DIST_INDEX).size).toBeGreaterThan(0);
  });

  it('AC-13: no tsx in the production start path', () => {
    const apiPkg = JSON.parse(fs.readFileSync(path.join(API_ROOT, 'package.json'), 'utf8'));
    const rootPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    expect(apiPkg.scripts.start).toBe('node dist/index.js');
    expect(apiPkg.scripts.start).not.toContain('tsx');
    expect(rootPkg.scripts.start).not.toContain('tsx');
    expect(apiPkg.scripts.build).toContain('esbuild');
  });

  it('AC-17: the built artifact starts, serves API + SPA fallback, and prints an address', async () => {
    const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm42-smoke-'));
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm42-static-'));
    fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><html><body>SPA SHELL</body></html>');

    try {
      await withServer(
        {
          HOST: '127.0.0.1',
          TRUCHABREW_DB_PATH: path.join(dbDir, 'brew.db'),
          TRUCHABREW_STATIC_ROOT: staticDir,
        },
        async (s) => {
          const health = await fetch(`http://127.0.0.1:${s.port}/api/health`);
          expect(health.status).toBe(200);
          expect(await health.json()).toEqual({ ok: true, foreignKeys: 1 });

          const api404 = await fetch(`http://127.0.0.1:${s.port}/api/nope`);
          expect(api404.status).toBe(404);
          expect(api404.headers.get('content-type')).toContain('application/json');

          const page = await fetch(`http://127.0.0.1:${s.port}/recipes/123`);
          expect(page.status).toBe(200);
          expect(page.headers.get('content-type')).toContain('text/html');
          expect(await page.text()).toContain('SPA SHELL');

          expect(s.stdout()).toMatch(/http:\/\//);
        },
      );
    } finally {
      fs.rmSync(dbDir, { recursive: true, force: true });
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('AC-18: startup print includes a LAN line when a non-internal IPv4 exists (else degenerate)', async () => {
    const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm42-lan-'));
    const hasLan = Object.values(os.networkInterfaces()).some((list) =>
      (list ?? []).some((a) => a.family === 'IPv4' && !a.internal),
    );

    try {
      await withServer({ HOST: '0.0.0.0', TRUCHABREW_DB_PATH: path.join(dbDir, 'brew.db') }, async (s) => {
        const urls = s
          .stdout()
          .split('\n')
          .filter((l) => l.startsWith('TruchaBrew server:'))
          .map((l) => l.replace('TruchaBrew server:', '').trim());

        expect(urls.some((u) => u.startsWith('http://localhost:'))).toBe(true);
        if (hasLan) {
          expect(
            urls.some((u) => u.startsWith('http://') && !u.startsWith('http://localhost:')),
          ).toBe(true);
        } else {
          // AC-8(a) degenerate contract: localhost alone, never [] / undefined.
          expect(urls).toEqual([`http://localhost:${s.port}`]);
        }
      });
    } finally {
      fs.rmSync(dbDir, { recursive: true, force: true });
    }
  });

  it('AC-9: default DB path from the built artifact is <repo>/apps/api/data/truchabrew.db', async () => {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm42-static-'));

    try {
      await withServer({ HOST: '127.0.0.1', TRUCHABREW_STATIC_ROOT: staticDir }, async (s) => {
        // Observe the built artifact's own resolution via its open file
        // descriptors: the process must have the default DB file open.
        const fdDir = `/proc/${s.proc.pid}/fd`;
        if (fs.existsSync(fdDir)) {
          const opened = fs
            .readdirSync(fdDir)
            .map((f) => {
              try {
                return fs.readlinkSync(path.join(fdDir, f));
              } catch {
                return '';
              }
            })
            .filter(Boolean);
          expect(opened.some((p) => p.includes('apps/api/data/truchabrew.db'))).toBe(true);
        } else {
          // Non-Linux fallback: the default file at least exists.
          expect(fs.existsSync(path.join(API_ROOT, 'data', 'truchabrew.db'))).toBe(true);
        }
      });
    } finally {
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('AC-10: a pre-seeded DB opens intact via the built artifact; migrations unchanged; no new migrations generated', async () => {
    const seeded = createTestDb({ seed: true });
    const countMigrations = (db: { $client: { prepare: (sql: string) => { get: () => { n: number } } } }) =>
      (db.$client.prepare('SELECT COUNT(*) as n FROM __drizzle_migrations').get() as { n: number }).n;
    const snapshotMigrations = (db: { $client: { prepare: (sql: string) => { all: () => unknown[] } } }) =>
      JSON.stringify(db.$client.prepare('SELECT * FROM __drizzle_migrations ORDER BY id').all());

    const beforeCount = countMigrations(seeded.db);
    const beforeSnapshot = snapshotMigrations(seeded.db);
    const beforeEquip = (
      seeded.db.$client.prepare('SELECT COUNT(*) as n FROM equipment_profiles').get() as { n: number }
    ).n;
    const filePath = seeded.filePath;
    seeded.close(); // keep the file on disk

    try {
      await withServer({ HOST: '127.0.0.1', TRUCHABREW_DB_PATH: filePath }, async (s) => {
        const equip = await fetch(`http://127.0.0.1:${s.port}/api/equipment-profiles`);
        expect(equip.status).toBe(200);
        const body = (await equip.json()) as unknown[];
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBeGreaterThanOrEqual(beforeEquip);
      });
    } finally {
      const reopened = openDatabase(filePath);
      expect(countMigrations(reopened.db)).toBe(beforeCount);
      expect(snapshotMigrations(reopened.db)).toBe(beforeSnapshot);
      reopened.close();
      for (const suffix of ['', '-journal', '-wal', '-shm']) {
        const p = filePath + suffix;
        if (fs.existsSync(p)) fs.rmSync(p);
      }
    }

    // Zero new migrations generated by this phase.
    const drizzleStatus = execSync('git status --porcelain -- apps/api/drizzle', {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    })
      .toString()
      .trim();
    expect(drizzleStatus).toBe('');
  });
});
