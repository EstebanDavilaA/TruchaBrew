import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { UserConfig } from '@truchabrew/shared-types';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import {
  resolveConfig,
  describeListenAddresses,
  ENV_DB_PATH,
  ENV_MIGRATIONS_DIR,
  ENV_STATIC_ROOT,
  ENV_PORT,
  ENV_HOST,
  DEFAULT_PORT,
  DEFAULT_HOST,
} from '../src/config';

let handle: TestDbHandle;

afterEach(() => {
  handle?.cleanup();
});

async function setupUnseeded(): Promise<{ app: FastifyInstance }> {
  handle = createTestDb();
  return { app: buildServer({ db: handle.db }) };
}

async function setupSeeded(): Promise<{ app: FastifyInstance }> {
  handle = createTestDb();
  seedDatabase(handle.db);
  return { app: buildServer({ db: handle.db }) };
}

describe('User Config API (M7_P1)', () => {
  // AC-5: Database Migration 0010
  it('AC-5: migration 0010 applies cleanly, creates user_config with a seeded default row', async () => {
    await setupUnseeded();
    const columns = handle.db.$client.prepare("PRAGMA table_info('user_config')").all() as Array<{ name: string }>;
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('unit_system');
    expect(colNames).toContain('gravity_unit');
    expect(colNames).toContain('temperature_unit');
    expect(colNames).toContain('ibu_formula');
    expect(colNames).toContain('abv_formula');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');

    const row = handle.db.$client.prepare("SELECT * FROM user_config WHERE id = 'default'").get() as
      | Record<string, unknown>
      | undefined;
    expect(row).toBeDefined();
    expect(row?.unit_system).toBe('metric');
    expect(row?.gravity_unit).toBe('sg');
    expect(row?.temperature_unit).toBe('celsius');
    expect(row?.ibu_formula).toBe('tinseth');
    expect(row?.abv_formula).toBe('simple');
  });

  it('migration 0010 is idempotent — running migrate twice does not duplicate or error', async () => {
    const { app } = await setupUnseeded();
    // runMigrations already ran once inside createTestDb; running again via
    // the same migrator must be a safe no-op (drizzle's migrator itself
    // tracks applied migrations, but this also exercises this migration's
    // own IF NOT EXISTS / INSERT OR IGNORE idempotency directly).
    const { runMigrations } = await import('../src/db/migrate');
    expect(() => runMigrations(handle.db)).not.toThrow();
    const rows = handle.db.$client.prepare('SELECT COUNT(*) as n FROM user_config').get() as { n: number };
    expect(rows.n).toBe(1);
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
  });

  // AC-6: GET /api/config
  it('AC-6: GET /api/config returns the default UserConfig with status 200 (unseeded db)', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as UserConfig;
    expect(body).toEqual({
      id: 'default',
      unitSystem: 'metric',
      gravityUnit: 'sg',
      temperatureUnit: 'celsius',
      ibuFormula: 'tinseth',
      abvFormula: 'simple',
    });
  });

  it('AC-6: GET /api/config returns 200 against a seeded db too', async () => {
    const { app } = await setupSeeded();
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
  });

  // AC-7: PUT /api/config
  it('AC-7: PUT /api/config updates a single field and returns the updated object with status 200', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { temperatureUnit: 'fahrenheit' } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as UserConfig;
    expect(body.temperatureUnit).toBe('fahrenheit');
    // untouched fields stay at their prior value
    expect(body.unitSystem).toBe('metric');
    expect(body.gravityUnit).toBe('sg');
    expect(body.ibuFormula).toBe('tinseth');
    expect(body.abvFormula).toBe('simple');
  });

  it('AC-7: PUT /api/config updates all five fields at once', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config',
      payload: {
        unitSystem: 'us',
        gravityUnit: 'plato',
        temperatureUnit: 'fahrenheit',
        ibuFormula: 'rager',
        abvFormula: 'balling',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: 'default',
      unitSystem: 'us',
      gravityUnit: 'plato',
      temperatureUnit: 'fahrenheit',
      ibuFormula: 'rager',
      abvFormula: 'balling',
    });
  });

  it('AC-7: PUT /api/config persists — a subsequent GET reflects the update', async () => {
    const { app } = await setupUnseeded();
    await app.inject({ method: 'PUT', url: '/api/config', payload: { ibuFormula: 'garetz' } });
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect((res.json() as UserConfig).ibuFormula).toBe('garetz');
  });

  it('AC-7: PUT /api/config with an empty body is a legal no-op', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: 'default',
      unitSystem: 'metric',
      gravityUnit: 'sg',
      temperatureUnit: 'celsius',
      ibuFormula: 'tinseth',
      abvFormula: 'simple',
    });
  });

  it('GET /api/config self-heals if the default row is missing (e.g. deleted out of band)', async () => {
    const { app } = await setupUnseeded();
    handle.db.$client.prepare("DELETE FROM user_config WHERE id = 'default'").run();
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: 'default',
      unitSystem: 'metric',
      gravityUnit: 'sg',
      temperatureUnit: 'celsius',
      ibuFormula: 'tinseth',
      abvFormula: 'simple',
    });
  });

  it('PUT /api/config self-heals if the default row is missing before the update is applied', async () => {
    const { app } = await setupUnseeded();
    handle.db.$client.prepare("DELETE FROM user_config WHERE id = 'default'").run();
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { gravityUnit: 'plato' } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as UserConfig).gravityUnit).toBe('plato');
  });

  // AC-8: PUT /api/config validation
  it('AC-8: an invalid unitSystem value returns 400', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { unitSystem: 'metricish' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('AC-8: an invalid gravityUnit value returns 400', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { gravityUnit: 'brix' } });
    expect(res.statusCode).toBe(400);
  });

  it('AC-8: an invalid temperatureUnit value returns 400', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { temperatureUnit: 'kelvin' } });
    expect(res.statusCode).toBe(400);
  });

  it('AC-8: an invalid ibuFormula value returns 400', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { ibuFormula: 'daniels' } });
    expect(res.statusCode).toBe(400);
  });

  it('AC-8: an invalid abvFormula value returns 400', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { abvFormula: 'standard' } });
    expect(res.statusCode).toBe(400);
  });

  it('AC-8: an invalid value does not mutate the stored config', async () => {
    const { app } = await setupUnseeded();
    await app.inject({ method: 'PUT', url: '/api/config', payload: { unitSystem: 'bogus' } });
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect((res.json() as UserConfig).unitSystem).toBe('metric');
  });

  it('AC-8: a wrong-type value (number instead of string enum) returns 400', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { unitSystem: 42 } });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// M42_P1 — runtime config (apps/api/src/config.ts)
// ---------------------------------------------------------------------------

describe('M42_P1 runtime config — resolveConfig / describeListenAddresses', () => {
  const PKG = '/x/apps/api';

  it('AC-1: env-name constants export with the exact values in the spec', () => {
    expect(ENV_DB_PATH).toBe('TRUCHABREW_DB_PATH');
    expect(ENV_MIGRATIONS_DIR).toBe('TRUCHABREW_MIGRATIONS_DIR');
    expect(ENV_STATIC_ROOT).toBe('TRUCHABREW_STATIC_ROOT');
    expect(ENV_PORT).toBe('PORT');
    expect(ENV_HOST).toBe('HOST');
    expect(DEFAULT_PORT).toBe(5177);
    expect(DEFAULT_HOST).toBe('0.0.0.0');
  });

  it('AC-2: resolveConfig defaults (empty env)', () => {
    const c = resolveConfig({}, PKG);
    expect(c.dbPath).toBe('/x/apps/api/data/truchabrew.db');
    expect(c.migrationsDir).toBe('/x/apps/api/drizzle');
    expect(c.staticRoot).toBe('/x/apps/web/dist');
    expect(c.port).toBe(5177);
    expect(c.host).toBe('0.0.0.0');
  });

  it('AC-3: each env var is honored in exactly its own field', () => {
    const base = resolveConfig({}, PKG);

    const db = resolveConfig({ [ENV_DB_PATH]: '/custom/brew.db' }, PKG);
    expect(db.dbPath).toBe('/custom/brew.db');
    expect(db.migrationsDir).toBe(base.migrationsDir);
    expect(db.staticRoot).toBe(base.staticRoot);
    expect(db.port).toBe(base.port);
    expect(db.host).toBe(base.host);

    const mig = resolveConfig({ [ENV_MIGRATIONS_DIR]: '/custom/drizzle' }, PKG);
    expect(mig.migrationsDir).toBe('/custom/drizzle');
    expect(mig.dbPath).toBe(base.dbPath);

    const staticRoot = resolveConfig({ [ENV_STATIC_ROOT]: '/custom/web' }, PKG);
    expect(staticRoot.staticRoot).toBe('/custom/web');
    expect(staticRoot.dbPath).toBe(base.dbPath);

    const port = resolveConfig({ [ENV_PORT]: '8080' }, PKG);
    expect(port.port).toBe(8080);
    expect(port.dbPath).toBe(base.dbPath);

    const host = resolveConfig({ [ENV_HOST]: '127.0.0.1' }, PKG);
    expect(host.host).toBe('127.0.0.1');
    expect(host.dbPath).toBe(base.dbPath);
  });

  it('AC-4: empty/whitespace env vars are treated as unset', () => {
    expect(resolveConfig({ [ENV_PORT]: '' }, PKG).port).toBe(5177);
    expect(resolveConfig({ [ENV_PORT]: '   ' }, PKG).port).toBe(5177);
    expect(resolveConfig({ [ENV_DB_PATH]: '  ' }, PKG).dbPath).toBe('/x/apps/api/data/truchabrew.db');
    expect(resolveConfig({ [ENV_HOST]: '' }, PKG).host).toBe('0.0.0.0');
    expect(resolveConfig({ [ENV_STATIC_ROOT]: ' ' }, PKG).staticRoot).toBe('/x/apps/web/dist');
  });

  it('AC-5: invalid PORT throws with the offending value named; valid PORT parses', () => {
    for (const bad of ['abc', '0', '-1', '3.5']) {
      expect(() => resolveConfig({ [ENV_PORT]: bad }, PKG)).toThrowError(/PORT/);
      expect(() => resolveConfig({ [ENV_PORT]: bad }, PKG)).toThrowError(new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    expect(resolveConfig({ [ENV_PORT]: '8080' }, PKG).port).toBe(8080);
  });

  it('AC-6: relative env paths resolve to absolute; no returned field is relative', () => {
    const c = resolveConfig({ [ENV_DB_PATH]: './brew.db' }, PKG);
    expect(path.isAbsolute(c.dbPath)).toBe(true);
    expect(path.isAbsolute(c.migrationsDir)).toBe(true);
    expect(path.isAbsolute(c.staticRoot)).toBe(true);
    expect(c.dbPath).toBe('/x/apps/api/brew.db');
  });

  it('AC-7: describeListenAddresses enumerates LAN IPv4s, localhost first, no internal/IPv6', () => {
    const interfaces = {
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      wlan0: [
        { address: '192.168.1.10', family: 'IPv4', internal: false },
        { address: '10.0.0.5', family: 'IPv4', internal: false },
      ],
    };
    const out = describeListenAddresses('0.0.0.0', 5177, interfaces);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('http://localhost:5177');
    expect(out).toContain('http://192.168.1.10:5177');
    expect(out).toContain('http://10.0.0.5:5177');
    expect(out.some((u) => u.includes('127.0.0.1'))).toBe(false);
    expect(out.some((u) => u.includes('::'))).toBe(false);
  });

  it('AC-8a: bound 0.0.0.0 with no non-internal IPv4 returns only localhost (never [] / undefined)', () => {
    expect(describeListenAddresses('0.0.0.0', 5177, {})).toEqual(['http://localhost:5177']);
    expect(
      describeListenAddresses('0.0.0.0', 5177, {
        lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      }),
    ).toEqual(['http://localhost:5177']);
  });

  it('AC-8b: a specific host returns exactly that address and ignores interfaces', () => {
    const interfaces = {
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      wlan0: [{ address: '192.168.1.10', family: 'IPv4', internal: false }],
    };
    expect(describeListenAddresses('127.0.0.1', 5177, interfaces)).toEqual(['http://127.0.0.1:5177']);
  });

  it('deduplicates repeated LAN IPv4s', () => {
    const interfaces = {
      a: [{ address: '192.168.1.10', family: 'IPv4', internal: false }],
      b: [{ address: '192.168.1.10', family: 'IPv4', internal: false }],
    };
    expect(describeListenAddresses('0.0.0.0', 5177, interfaces)).toEqual([
      'http://localhost:5177',
      'http://192.168.1.10:5177',
    ]);
  });
});
