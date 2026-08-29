import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { UserConfig } from '@truchabrew/shared-types';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';

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
