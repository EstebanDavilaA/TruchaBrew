import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { buildServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';

let handle: TestDbHandle;

afterEach(() => {
  handle?.cleanup();
});

function makeStaticRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm42-static-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><body>SPA SHELL</body></html>');
  return dir;
}

describe('M42_P1 static serving & SPA fallback (RA-7/RA-8)', () => {
  it('AC-15: SPA fallback vs API 404, with a static root present', async () => {
    handle = createTestDb();
    const staticRoot = makeStaticRoot();
    const app: FastifyInstance = buildServer({ db: handle.db, staticRoot });

    const page = await app.inject({ method: 'GET', url: '/recipes/123' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain('SPA SHELL');

    const api404 = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(api404.statusCode).toBe(404);
    expect(api404.headers['content-type']).toContain('application/json');
    const apiBody = api404.json();
    expect(apiBody.error.code).toBe('NOT_FOUND');
    expect(apiBody.error.message).toBe('Route not found: GET /api/nope');

    const postPage = await app.inject({ method: 'POST', url: '/some/page' });
    expect(postPage.statusCode).toBe(404);
    expect(postPage.headers['content-type']).toContain('application/json');
    expect(postPage.json().error.code).toBe('NOT_FOUND');

    fs.rmSync(staticRoot, { recursive: true, force: true });
  });

  it('AC-15: static files themselves are served (index.html at /)', async () => {
    handle = createTestDb();
    const staticRoot = makeStaticRoot();
    const app: FastifyInstance = buildServer({ db: handle.db, staticRoot });

    const root = await app.inject({ method: 'GET', url: '/' });
    expect(root.statusCode).toBe(200);
    expect(root.body).toContain('SPA SHELL');

    fs.rmSync(staticRoot, { recursive: true, force: true });
  });

  it('AC-16: absent static root is not an error — one-arg form keeps today\u2019s JSON 404', async () => {
    handle = createTestDb();
    const app: FastifyInstance = buildServer({ db: handle.db });

    const res = await app.inject({ method: 'GET', url: '/recipes/123' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json().error.message).toBe('Route not found: GET /recipes/123');
  });

  it('AC-16: a provided-but-nonexistent staticRoot also boots and keeps JSON 404', async () => {
    handle = createTestDb();
    const app: FastifyInstance = buildServer({ db: handle.db, staticRoot: '/nonexistent/xyz/does-not-exist' });

    const res = await app.inject({ method: 'GET', url: '/recipes/123' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('M42_P1 migrations folder override (AC-11)', () => {
  it('runMigrations(db) keeps the default; runMigrations(db, dir) accepts an explicit folder', () => {
    // createTestDb already exercised the one-argument form (default folder).
    handle = createTestDb();
    const realDrizzleDir = path.resolve(__dirname, '..', 'drizzle');

    // Two-argument form targeting the real migrations folder: idempotent, no throw.
    expect(() => runMigrations(handle.db, realDrizzleDir)).not.toThrow();

    // The migrations it applied are the real ones: user_config exists.
    const cols = handle.db.$client.prepare("PRAGMA table_info('user_config')").all() as Array<{ name: string }>;
    expect(cols.length).toBeGreaterThan(0);
  });
});
