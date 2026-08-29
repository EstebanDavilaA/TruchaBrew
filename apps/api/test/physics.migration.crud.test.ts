import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';
import { fullEquipmentInput, fullRecipeInput } from './helpers/fixtures';

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

describe('M11_P1 AC-12..AC-15: Physics Schema & APIs Integration Tests', () => {
  it('AC-12: Database migration 0013 applies cleanly and idempotently', () => {
    const freshDb = createTestDb();
    expect(() => runMigrations(freshDb.db)).not.toThrow();
    // Idempotent check
    expect(() => runMigrations(freshDb.db)).not.toThrow();

    // Verify columns exist by querying sqlite_master / pragma table_info
    const eqCols = freshDb.db.all<{ name: string }>("PRAGMA table_info('equipment_profiles')");
    const colNames = eqCols.map((c) => c.name);
    expect(colNames).toContain('altitude_meters');
    expect(colNames).toContain('calc_strike_with_thermal_mass');
    expect(colNames).toContain('mash_tun_dead_space_l');
    expect(colNames).toContain('kettle_loss_l');
    expect(colNames).toContain('mash_tun_weight_kg');
    expect(colNames).toContain('mash_tun_heat_capacity');

    const hopCols = freshDb.db.all<{ name: string }>("PRAGMA table_info('recipe_hops')");
    const hopColNames = hopCols.map((c) => c.name);
    expect(hopColNames).toContain('dry_hop_day_offset');
    expect(hopColNames).toContain('dry_hop_duration_days');

    freshDb.cleanup();
  });

  it('AC-13: Equipment Profile CRUD persists physics fields', async () => {
    const input = fullEquipmentInput({
      name: 'High Altitude HERMS',
      altitudeMeters: 1850,
      calcStrikeWithThermalMass: true,
      mashTunDeadSpaceL: 1.5,
      kettleLossL: 1.0,
      mashTunWeightKg: 6.2,
      mashTunHeatCapacity: 0.12,
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/equipment-profiles',
      payload: input,
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);

    expect(created.altitudeMeters).toBe(1850);
    expect(created.calcStrikeWithThermalMass).toBe(true);
    expect(created.mashTunDeadSpaceL).toBe(1.5);
    expect(created.kettleLossL).toBe(1.0);
    expect(created.mashTunWeightKg).toBe(6.2);
    expect(created.mashTunHeatCapacity).toBe(0.12);

    // List verification
    const listRes = await app.inject({ method: 'GET', url: '/api/equipment-profiles' });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    const found = list.find((p: any) => p.id === created.id);
    expect(found.altitudeMeters).toBe(1850);
    expect(found.calcStrikeWithThermalMass).toBe(true);
    expect(found.mashTunDeadSpaceL).toBe(1.5);

    // PUT update
    const { derivedFromEquipmentId: _drop, ...updateBody } = input;
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/equipment-profiles/${created.id}`,
      payload: {
        ...updateBody,
        altitudeMeters: 2200,
        calcStrikeWithThermalMass: false,
        mashTunDeadSpaceL: 2.0,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body);
    expect(updated.altitudeMeters).toBe(2200);
    expect(updated.calcStrikeWithThermalMass).toBe(false);
    expect(updated.mashTunDeadSpaceL).toBe(2.0);
  });

  it('AC-14: Recipe hop timing fields round-trip (dryHopDayOffset, dryHopDurationDays)', async () => {
    const input = fullRecipeInput({
      name: 'Hop Physics Test IPA',
      hops: [
        {
          name: 'Cascade Dry Hop',
          amountG: 50,
          alphaAcidPct: 6.5,
          use: 'DryHop',
          boilMins: null,
          whirlpoolMins: null,
          whirlpoolTempC: null,
          dryHopDayOffset: 3,
          dryHopDurationDays: 4.5,
          type: 'Pellet',
        },
        {
          name: 'Mosaic Whirlpool',
          amountG: 30,
          alphaAcidPct: 12.0,
          use: 'Whirlpool',
          boilMins: null,
          whirlpoolMins: 20,
          whirlpoolTempC: 78.0,
          dryHopDayOffset: null,
          dryHopDurationDays: null,
          type: 'Pellet',
        },
      ],
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: input,
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);

    const dryHop = created.hops.find((h: any) => h.use === 'DryHop');
    expect(dryHop).toBeDefined();
    expect(dryHop.dryHopDayOffset).toBe(3);
    expect(dryHop.dryHopDurationDays).toBe(4.5);

    const whirlpoolHop = created.hops.find((h: any) => h.use === 'Whirlpool');
    expect(whirlpoolHop).toBeDefined();
    expect(whirlpoolHop.whirlpoolMins).toBe(20);
    expect(whirlpoolHop.whirlpoolTempC).toBe(78.0);

    // GET round-trip
    const getRes = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.body);
    const fetchedDryHop = fetched.hops.find((h: any) => h.use === 'DryHop');
    expect(fetchedDryHop.dryHopDayOffset).toBe(3);
    expect(fetchedDryHop.dryHopDurationDays).toBe(4.5);
  });

  it('AC-15: Legacy recipe backwards compatibility without new hop timing fields', async () => {
    const legacyRecipe = fullRecipeInput({
      name: 'Legacy Recipe',
      hops: [
        {
          name: 'Traditional Boil Hop',
          amountG: 25,
          alphaAcidPct: 5.0,
          use: 'Boil',
          boilMins: 60,
          whirlpoolMins: null,
          whirlpoolTempC: null,
          type: 'Pellet',
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/recipes',
      payload: legacyRecipe,
    });
    expect(res.statusCode).toBe(201);
    const created = JSON.parse(res.body);
    expect(created.hops[0].name).toBe('Traditional Boil Hop');
    expect(created.hops[0].dryHopDayOffset).toBeNull();
    expect(created.hops[0].dryHopDurationDays).toBeNull();
  });
});
