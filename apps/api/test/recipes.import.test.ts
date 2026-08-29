import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import type { RecipeImportResponse } from '@truchabrew/shared-types';

let handle: TestDbHandle;
let app: FastifyInstance;

beforeEach(() => {
  handle = createTestDb();
  seedDatabase(handle.db);
  app = buildServer({ db: handle.db });
});

afterEach(async () => {
  await app.close();
  handle.cleanup();
});

const sampleRecipe = {
  name: 'Buho Weissbier',
  author: 'Montano Brewing',
  style: { name: 'Weissbier' },
  fermentables: [
    { name: 'Wheat Malt', amountKg: 3.5, colorEBC: 4.8, type: 'Grain' },
    { name: 'Pale Ale', amountKg: 1.5, colorEBC: 6.0, type: 'Grain' },
  ],
  hops: [{ name: 'Hallertauer', amountG: 40, alphaAcidPct: 4.2, use: 'Boil', time: '60 min' }],
  yeast: [{ name: 'WB-06', brand: 'Fermentis', attenuationPct: 86, amount: '1 packet' }],
  misc: [{ name: 'Whirlfloc', type: 'Fining', amount: '1 item', use: 'Boil 15 min' }],
};

describe('M10_P1: REST Ingestion Endpoint (POST /api/recipes/import/brewfather)', () => {
  it('AC-10: imports single recipe and returns 201 with importedCount and recipes array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/recipes/import/brewfather',
      payload: sampleRecipe,
    });

    expect(res.statusCode).toBe(201);
    const body: RecipeImportResponse = JSON.parse(res.body);
    expect(body.importedCount).toBe(1);
    expect(body.recipes).toHaveLength(1);
    expect(body.recipes[0].name).toBe('Buho Weissbier');
    expect(body.recipes[0].author).toBe('Montano Brewing');
    expect(body.recipes[0].styleName).toBe('Weissbier');
    expect(body.recipes[0].fermentables).toHaveLength(2);
    expect(body.recipes[0].hops).toHaveLength(1);
  });

  it('AC-10: imports collection with { recipes: [...] }', async () => {
    const payload = {
      recipes: [sampleRecipe, { ...sampleRecipe, name: 'Second Recipe' }],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/recipes/import/brewfather',
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body: RecipeImportResponse = JSON.parse(res.body);
    expect(body.importedCount).toBe(2);
    expect(body.recipes).toHaveLength(2);
    expect(body.recipes[0].name).toBe('Buho Weissbier');
    expect(body.recipes[1].name).toBe('Second Recipe');
  });

  it('AC-11: duplicate recipe name disambiguation appends (Imported)', async () => {
    // 1st import
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/recipes/import/brewfather',
      payload: sampleRecipe,
    });
    expect(res1.statusCode).toBe(201);
    const body1: RecipeImportResponse = JSON.parse(res1.body);
    expect(body1.recipes[0].name).toBe('Buho Weissbier');

    // 2nd import of same name
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/recipes/import/brewfather',
      payload: sampleRecipe,
    });
    expect(res2.statusCode).toBe(201);
    const body2: RecipeImportResponse = JSON.parse(res2.body);
    expect(body2.recipes[0].name).toBe('Buho Weissbier (Imported)');
  });

  it('AC-12: triplicate recipe name disambiguation appends (Imported 2)', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/recipes/import/brewfather',
      payload: sampleRecipe,
    });
    await app.inject({
      method: 'POST',
      url: '/api/recipes/import/brewfather',
      payload: sampleRecipe,
    });

    const res3 = await app.inject({
      method: 'POST',
      url: '/api/recipes/import/brewfather',
      payload: sampleRecipe,
    });
    expect(res3.statusCode).toBe(201);
    const body3: RecipeImportResponse = JSON.parse(res3.body);
    expect(body3.recipes[0].name).toBe('Buho Weissbier (Imported 2)');
  });

  it('AC-13: invalid payload returns 400 VALIDATION_FAILED', async () => {
    const resEmpty = await app.inject({
      method: 'POST',
      url: '/api/recipes/import/brewfather',
      payload: {},
    });
    expect(resEmpty.statusCode).toBe(400);
    const bodyEmpty = JSON.parse(resEmpty.body);
    expect(bodyEmpty.error.code).toBe('VALIDATION_FAILED');

    const resInvalid = await app.inject({
      method: 'POST',
      url: '/api/recipes/import/brewfather',
      payload: { recipes: [] },
    });
    expect(resInvalid.statusCode).toBe(400);
    const bodyInvalid = JSON.parse(resInvalid.body);
    expect(bodyInvalid.error.code).toBe('VALIDATION_FAILED');
  });

  it('AC-17: pre-existing recipe CRUD operations remain healthy and accessible', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/recipes' });
    expect(listRes.statusCode).toBe(200);

    const importRes = await app.inject({
      method: 'POST',
      url: '/api/recipes/import/brewfather',
      payload: sampleRecipe,
    });
    expect(importRes.statusCode).toBe(201);
    const imported = JSON.parse(importRes.body).recipes[0];

    const getRes = await app.inject({ method: 'GET', url: `/api/recipes/${imported.id}` });
    expect(getRes.statusCode).toBe(200);

    const delRes = await app.inject({ method: 'DELETE', url: `/api/recipes/${imported.id}` });
    expect(delRes.statusCode).toBe(204);
  });
});
