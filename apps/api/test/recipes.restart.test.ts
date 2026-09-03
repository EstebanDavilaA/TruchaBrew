import { describe, it, expect, afterEach } from 'vitest';
import { calculateRecipeStats } from '@truchabrew/calculations';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { canonicalRecipeJson } from './helpers/canonical';
import { fullRecipeInput } from './helpers/fixtures';

let handle: TestDbHandle;

afterEach(() => {
  handle?.cleanup();
});

describe('restart round-trip', () => {
  it('AC-22: byte-identical canonical JSON before and after a real close/reopen', async () => {
    handle = createTestDb();
    seedDatabase(handle.db);
    const app1 = buildServer({ db: handle.db });

    const createRes = await app1.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput() });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    await app1.close();

    // Close the database handle and reopen the SAME FILE with a new connection and a new server instance.
    handle = handle.reopen();
    const app2 = buildServer({ db: handle.db });

    const getRes = await app2.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    expect(getRes.statusCode).toBe(200);
    const reloaded = JSON.parse(getRes.body);

    expect(canonicalRecipeJson(reloaded)).toBe(canonicalRecipeJson(created));
    await app2.close();
  });

  it('AC-23: calculateRecipeStats deep-equals on all 17 fields before and after restart', async () => {
    handle = createTestDb();
    seedDatabase(handle.db);
    const app1 = buildServer({ db: handle.db });

    const createRes = await app1.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput() });
    const created = JSON.parse(createRes.body);
    const statsBefore = calculateRecipeStats(created);
    await app1.close();

    handle = handle.reopen();
    const app2 = buildServer({ db: handle.db });
    const getRes = await app2.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    const reloaded = JSON.parse(getRes.body);
    const statsAfter = calculateRecipeStats(reloaded);

    expect(Object.keys(statsAfter).length).toBe(17);
    for (const key of Object.keys(statsBefore) as (keyof typeof statsBefore)[]) {
      expect(statsAfter[key]).toBe(statsBefore[key]);
    }
    await app2.close();
  });

  it('AC-24: equipment reference resolves after restart with every field bit-identical', async () => {
    handle = createTestDb();
    seedDatabase(handle.db);
    const app1 = buildServer({ db: handle.db });

    const createRes = await app1.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ equipmentId: 'eq-2' }) });
    const created = JSON.parse(createRes.body);
    await app1.close();

    handle = handle.reopen();
    const app2 = buildServer({ db: handle.db });
    const getRes = await app2.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    const reloaded = JSON.parse(getRes.body);

    expect(reloaded.equipment.id).toBe('eq-2');
    expect(reloaded.equipment).toEqual(created.equipment);
    await app2.close();
  });

  it('AC-45: a WaterAgent misc round-trips end to end and calculateRecipeStats is bit-identical to the same recipe without it', async () => {
    handle = createTestDb();
    seedDatabase(handle.db);
    const app1 = buildServer({ db: handle.db });

    const withMisc = fullRecipeInput({
      miscs: [{ name: 'Gypsum', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: 4, unit: 'g' }],
    });
    const withoutMisc = fullRecipeInput({ name: 'Trucha Test IPA (no misc)', miscs: [] });

    const createWithRes = await app1.inject({ method: 'POST', url: '/api/recipes', payload: withMisc });
    const createdWith = JSON.parse(createWithRes.body);
    const createWithoutRes = await app1.inject({ method: 'POST', url: '/api/recipes', payload: withoutMisc });
    const createdWithout = JSON.parse(createWithoutRes.body);
    await app1.close();

    handle = handle.reopen();
    const app2 = buildServer({ db: handle.db });
    const getRes = await app2.inject({ method: 'GET', url: `/api/recipes/${createdWith.id}` });
    const reloaded = JSON.parse(getRes.body);

    expect(reloaded.miscs.length).toBe(1);
    expect(reloaded.miscs[0]).toMatchObject({
      name: 'Gypsum',
      type: 'WaterAgent',
      use: 'Mash',
      timeMinutes: 0,
      amount: 4,
      unit: 'g',
    });

    const statsWith = calculateRecipeStats(reloaded);
    const statsWithout = calculateRecipeStats(createdWithout);
    expect(statsWith).toEqual(statsWithout);
    await app2.close();
  });
});
