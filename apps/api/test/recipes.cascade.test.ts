import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { fullRecipeInput } from './helpers/fixtures';

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

const LINE_ITEM_TABLES = ['recipe_fermentables', 'recipe_hops', 'recipe_yeasts', 'recipe_miscs'];

describe('delete leaves no orphans (AC-27)', () => {
  it('removes all line items for the deleted recipe and leaves no globally orphaned rows', async () => {
    const createRes = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput() });
    const created = JSON.parse(createRes.body);

    const del = await app.inject({ method: 'DELETE', url: `/api/recipes/${created.id}` });
    expect(del.statusCode).toBe(204);
    expect(del.body).toBe('');

    for (const table of LINE_ITEM_TABLES) {
      const scoped = handle.db.get<{ count: number }>(
        sql.raw(`select count(*) as count from ${table} where recipe_id = '${created.id}'`),
      );
      expect(scoped?.count).toBe(0);

      const orphaned = handle.db.get<{ count: number }>(
        sql.raw(`select count(*) as count from ${table} where recipe_id not in (select id from recipes)`),
      );
      expect(orphaned?.count).toBe(0);
    }
  });
});

describe('delete does not remove the equipment profile (AC-28)', () => {
  it('the equipment profile and other recipes using it survive', async () => {
    const first = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ name: 'First' }) });
    const second = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ name: 'Second' }) });
    const firstBody = JSON.parse(first.body);
    const secondBody = JSON.parse(second.body);

    const del = await app.inject({ method: 'DELETE', url: `/api/recipes/${firstBody.id}` });
    expect(del.statusCode).toBe(204);

    const eqRes = await app.inject({ method: 'GET', url: '/api/equipment-profiles' });
    const equipmentIds = JSON.parse(eqRes.body).map((e: { id: string }) => e.id);
    expect(equipmentIds).toContain('eq-1');

    const secondGet = await app.inject({ method: 'GET', url: `/api/recipes/${secondBody.id}` });
    expect(secondGet.statusCode).toBe(200);
    expect(JSON.parse(secondGet.body).equipment.id).toBe('eq-1');
  });
});
