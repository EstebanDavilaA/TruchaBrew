import { describe, it, expect, afterEach } from 'vitest';
import { canScale, deriveScaledEquipment, scaleRecipe, calculateRecipeStats } from '@truchabrew/calculations';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { fullRecipeInput } from './helpers/fixtures';
import { equipmentProfiles } from '../src/db/schema';

let handle: TestDbHandle;

afterEach(() => {
  handle?.cleanup();
});

/** Mirrors the web app's scale flow (spec §2.5) against the real API. */
async function scaleRecipeViaApi(app: ReturnType<typeof buildServer>, storedRecipe: any, targetBatchSizeL: number) {
  expect(canScale(storedRecipe.equipment.batchSizeL, targetBatchSizeL)).toBe(true);

  const equipmentInput = {
    ...deriveScaledEquipment(storedRecipe.equipment, targetBatchSizeL, 'placeholder-id'),
  };
  delete (equipmentInput as any).id;

  const createEqRes = await app.inject({ method: 'POST', url: '/api/equipment-profiles', payload: equipmentInput });
  const persistedEquipment = JSON.parse(createEqRes.body);

  const scaled = scaleRecipe(storedRecipe, targetBatchSizeL, persistedEquipment);

  const writeBody = {
    name: scaled.name,
    author: scaled.author,
    styleName: scaled.styleName,
    notes: scaled.notes,
    equipmentId: persistedEquipment.id,
    fermentables: scaled.fermentables,
    hops: scaled.hops,
    yeasts: scaled.yeasts,
    miscs: scaled.miscs,
    mashProfileId: scaled.mashProfile?.id ?? null,
    fermentationProfileId: scaled.fermentationProfile?.id ?? null,
    waterSourceId: scaled.waterSourceId ?? null,
    waterTargetId: scaled.waterTargetId ?? null,
  };
  const putRes = await app.inject({ method: 'PUT', url: `/api/recipes/${storedRecipe.id}`, payload: writeBody });
  return { status: putRes.statusCode, body: JSON.parse(putRes.body), equipmentStatus: createEqRes.statusCode };
}

describe('derived profile reuse (AC-38)', () => {
  it('scaling the same recipe to 40 L twice creates exactly one additional equipment_profiles row', async () => {
    handle = createTestDb();
    seedDatabase(handle.db);
    const app = buildServer({ db: handle.db });

    const createRes = await app.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ equipmentId: 'eq-1' }) });
    const created = JSON.parse(createRes.body);

    const before = handle.db.select().from(equipmentProfiles).all().length;

    // "Scaling the same recipe to 40 L twice" — both requests derive from the
    // same 20 L source recipe/equipment, as a user re-opening the 20 L
    // recipe and scaling to 40 L on two separate occasions would.
    const first = await scaleRecipeViaApi(app, created, 40);
    const afterFirst = handle.db.select().from(equipmentProfiles).all().length;
    expect(afterFirst).toBe(before + 1);

    const second = await scaleRecipeViaApi(app, created, 40);
    const afterSecond = handle.db.select().from(equipmentProfiles).all().length;
    expect(afterSecond).toBe(before + 1); // no new row on the second scale
    expect(second.body.equipment.id).toBe(first.body.equipment.id);

    const derivedRow = handle.db
      .select()
      .from(equipmentProfiles)
      .all()
      .find((row) => row.derivedFromEquipmentId === 'eq-1' && Math.abs(row.batchSizeL - 40) < 1e-9)!;
    expect(derivedRow.isSeed).toBe(0);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await app.close();
  });
});

describe('scaled recipe persists at its new size (AC-39)', () => {
  it('save 20 L, scale to 40 L, save, restart, reload -> 40 L with the same OG/IBU', async () => {
    handle = createTestDb();
    seedDatabase(handle.db);
    const app1 = buildServer({ db: handle.db });

    const createRes = await app1.inject({ method: 'POST', url: '/api/recipes', payload: fullRecipeInput({ equipmentId: 'eq-1' }) });
    const created = JSON.parse(createRes.body);
    const statsBefore = calculateRecipeStats(created);

    const scaledResult = await scaleRecipeViaApi(app1, created, 40);
    expect(scaledResult.status).toBe(200);
    expect(scaledResult.body.equipment.batchSizeL).toBe(40);
    await app1.close();

    handle = handle.reopen();
    const app2 = buildServer({ db: handle.db });
    const reGet = await app2.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    const reloaded = JSON.parse(reGet.body);

    expect(reloaded.equipment.batchSizeL).toBe(40);
    const statsAfter = calculateRecipeStats(reloaded);
    expect(statsAfter.og).toBe(statsBefore.og);
    expect(statsAfter.ibu).toBe(statsBefore.ibu);
    await app2.close();
  });
});
