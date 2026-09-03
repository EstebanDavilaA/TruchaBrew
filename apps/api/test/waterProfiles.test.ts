import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { WaterProfileInput, WaterProfileInUseDetails } from '@truchabrew/shared-types';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';

let handle: TestDbHandle;

afterEach(() => {
  handle?.cleanup();
});

async function setupSeeded(): Promise<{ app: FastifyInstance }> {
  handle = createTestDb();
  seedDatabase(handle.db);
  return { app: buildServer({ db: handle.db }) };
}

async function setupUnseeded(): Promise<{ app: FastifyInstance }> {
  handle = createTestDb();
  return { app: buildServer({ db: handle.db }) };
}

function fullWaterProfileInput(overrides: Partial<WaterProfileInput> = {}): WaterProfileInput {
  return {
    name: 'Test Profile',
    type: 'source',
    calcium: 50,
    magnesium: 10,
    sodium: 20,
    chloride: 30,
    sulfate: 40,
    bicarbonate: 120,
    ph: 7.4,
    description: 'Test description',
    ...overrides,
  };
}

describe('Water Profiles API (M6_P1)', () => {
  // AC-7: Database Migration 0009
  it('AC-7: migration 0009 applies cleanly and creates water_profiles table with 13 columns', async () => {
    const { app: _app } = await setupUnseeded();
    const columns = handle.db.$client.prepare("PRAGMA table_info('water_profiles')").all() as Array<{ name: string }>;
    expect(columns.length).toBeGreaterThanOrEqual(11);
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('type');
    expect(colNames).toContain('calcium');
    expect(colNames).toContain('magnesium');
    expect(colNames).toContain('sodium');
    expect(colNames).toContain('chloride');
    expect(colNames).toContain('sulfate');
    expect(colNames).toContain('bicarbonate');
    expect(colNames).toContain('ph');
    expect(colNames).toContain('description');
  });

  // AC-8: Default Preset Seeds
  it('AC-8: seedDatabase populates default source and target water profiles', async () => {
    const { app } = await setupSeeded();
    const res = await app.inject({ method: 'GET', url: '/api/water-profiles' });
    expect(res.statusCode).toBe(200);
    const profiles = res.json();
    expect(profiles.length).toBeGreaterThanOrEqual(5);

    const names = profiles.map((p: any) => p.name);
    expect(names).toContain('Balanced Tap Water');
    expect(names).toContain('RO / Distilled Water');
    expect(names).toContain('Balanced Profile');
    expect(names).toContain('Light & Hoppy Profile');
    expect(names).toContain('Clarty & Malty Profile');
  });

  // AC-9: GET /api/water-profiles
  it('AC-9: GET /api/water-profiles returns array of all water profiles with status 200', async () => {
    const { app } = await setupSeeded();
    const res = await app.inject({ method: 'GET', url: '/api/water-profiles' });
    expect(res.statusCode).toBe(200);
    const profiles = res.json();
    expect(Array.isArray(profiles)).toBe(true);
  });

  // AC-10: POST /api/water-profiles Validation
  it('AC-10: POST /api/water-profiles with missing name returns status 400', async () => {
    const { app } = await setupUnseeded();
    const body = fullWaterProfileInput({ name: '' });
    const res = await app.inject({ method: 'POST', url: '/api/water-profiles', payload: body });
    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.error.code).toBe('VALIDATION_FAILED');
  });

  it('AC-10: POST /api/water-profiles with negative ion returns status 400', async () => {
    const { app } = await setupUnseeded();
    const body = fullWaterProfileInput({ calcium: -10 });
    const res = await app.inject({ method: 'POST', url: '/api/water-profiles', payload: body });
    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.error.code).toBe('VALIDATION_FAILED');
  });

  it('AC-10: POST /api/water-profiles with valid payload returns status 201 and created profile', async () => {
    const { app } = await setupUnseeded();
    const body = fullWaterProfileInput();
    const res = await app.inject({ method: 'POST', url: '/api/water-profiles', payload: body });
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Test Profile');
    expect(created.calcium).toBe(50);
  });

  // AC-11: PUT /api/water-profiles/:id
  it('AC-11: PUT /api/water-profiles/:id modifies fields in DB and returns status 200', async () => {
    const { app } = await setupUnseeded();
    const createRes = await app.inject({ method: 'POST', url: '/api/water-profiles', payload: fullWaterProfileInput() });
    const created = createRes.json();

    const updateBody = fullWaterProfileInput({ name: 'Updated Name', calcium: 100 });
    const res = await app.inject({ method: 'PUT', url: `/api/water-profiles/${created.id}`, payload: updateBody });
    expect(res.statusCode).toBe(200);
    const updated = res.json();
    expect(updated.name).toBe('Updated Name');
    expect(updated.calcium).toBe(100);
  });

  it('PUT /api/water-profiles/:id returns 404 for unknown id', async () => {
    const { app } = await setupUnseeded();
    const res = await app.inject({ method: 'PUT', url: '/api/water-profiles/non-existent-id', payload: fullWaterProfileInput() });
    expect(res.statusCode).toBe(404);
  });

  // AC-12: DELETE /api/water-profiles In-Use Guard
  it('AC-12: DELETE /api/water-profiles/:id returns status 204 when unused', async () => {
    const { app } = await setupUnseeded();
    const createRes = await app.inject({ method: 'POST', url: '/api/water-profiles', payload: fullWaterProfileInput() });
    const created = createRes.json();

    const res = await app.inject({ method: 'DELETE', url: `/api/water-profiles/${created.id}` });
    expect(res.statusCode).toBe(204);
  });

  it('AC-12: DELETE /api/water-profiles/:id assigned to a recipe returns status 409 WATER_PROFILE_IN_USE', async () => {
    const { app } = await setupSeeded();
    // Get tap water profile id
    const profilesRes = await app.inject({ method: 'GET', url: '/api/water-profiles' });
    const profiles = profilesRes.json();
    const tapProfile = profiles.find((p: any) => p.id === 'wp-src-tap');

    // Create a recipe referencing this profile as waterSourceId
    const recipeBody = {
      name: 'Water Test Recipe',
      author: 'Tester',
      styleName: 'IPA',
      notes: '',
      equipmentId: 'eq-1',
      fermentables: [{ name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 3, potentialSg: 1.037 }],
      hops: [],
      yeasts: [],
      miscs: [],
      mashProfileId: null,
      fermentationProfileId: null,
      waterSourceId: tapProfile.id,
      waterTargetId: null,
    };
    const recipeRes = await app.inject({ method: 'POST', url: '/api/recipes', payload: recipeBody });
    expect(recipeRes.statusCode).toBe(201);

    // Attempt to delete tapProfile -> 409
    const deleteRes = await app.inject({ method: 'DELETE', url: `/api/water-profiles/${tapProfile.id}` });
    expect(deleteRes.statusCode).toBe(409);
    const json = deleteRes.json();
    expect(json.error.code).toBe('WATER_PROFILE_IN_USE');
    const details = json.error.details as WaterProfileInUseDetails;
    expect(details.recipeCount).toBeGreaterThanOrEqual(1);
    expect(details.recipeNames).toContain('Water Test Recipe');
  });
});
