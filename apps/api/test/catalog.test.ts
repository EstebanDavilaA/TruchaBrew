import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { CatalogResponse } from '@truchabrew/shared-types';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';

// M12_P1 (FEAT-011) — new test-only file exercising the pre-existing,
// untouched GET /api/catalog route against the expanded seed catalog
// (spec §2.3: apps/api/src/routes/ is protected; this file adds coverage,
// it does not modify the route). Not listed in spec §2.2's New Files table
// — flagged for critic review; AC-2 explicitly names `catalog.test.ts` as
// its verification file, and apps/api/test/seed.test.ts was extended under
// the same unlisted-but-required precedent at M7_P1 (see that file's AC-18
// comment).
let handle: TestDbHandle;

afterEach(() => {
  handle?.cleanup();
});

async function setupSeeded(): Promise<{ app: FastifyInstance }> {
  handle = createTestDb();
  seedDatabase(handle.db);
  return { app: buildServer({ db: handle.db }) };
}

describe('AC-2: GET /api/catalog returns all 4 expanded categories', () => {
  it('200 response returns hydrated fermentables, hops, yeasts, and miscs arrays', async () => {
    const { app } = await setupSeeded();
    const res = await app.inject({ method: 'GET', url: '/api/catalog' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as CatalogResponse;

    expect(body.fermentables.length).toBeGreaterThanOrEqual(16);
    expect(body.hops.length).toBeGreaterThanOrEqual(15);
    expect(body.yeasts.length).toBeGreaterThanOrEqual(9);
    expect(body.miscs.length).toBeGreaterThanOrEqual(12);

    expect(body.fermentables.find((f) => f.id === 'f-9')).toMatchObject({ name: 'Vienna Malt', type: 'Grain', colorSrm: 3.5, potentialSg: 1.037 });
    expect(body.hops.find((h) => h.id === 'h-8')).toMatchObject({ name: 'Amarillo', alphaAcidPct: 9.2, type: 'Pellet' });
    expect(body.yeasts.find((y) => y.id === 'y-5')).toMatchObject({ name: 'S-04 SafAle English Ale', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 75 });
    expect(body.miscs.find((m) => m.id === 'm-7')).toMatchObject({ name: 'Epsom Salt', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'g' });
  });
});
