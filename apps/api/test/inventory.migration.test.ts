import { describe, it, expect, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { createTestDb, type TestDbHandle } from './helpers/testDb';

let handle: TestDbHandle;

afterEach(() => {
  handle?.cleanup();
});

describe('AC-17: migration 0011 applies and is idempotent', () => {
  it('running migrations twice on a fresh DB is a no-op the second time', () => {
    handle = createTestDb();
    // createTestDb already ran migrations once; running again must not throw.
    expect(() => runMigrations(handle.db)).not.toThrow();
  });

  it('PRAGMA table_info reports exactly the 13 pinned columns with the right types/notnull', () => {
    handle = createTestDb();
    const columns = handle.db.$client.prepare("PRAGMA table_info('inventory_items')").all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    // 12 base columns (M9_P1) + 1 (custom_details, migration 0014, M12_P1
    // Amendment 1 — see the dedicated AC-15 describe block below).
    expect(columns).toHaveLength(13);

    const byName = new Map(columns.map((c) => [c.name, c]));
    const expectedNotNull: Record<string, boolean> = {
      id: true,
      category: true,
      name: true,
      name_key: true,
      quantity: true,
      unit: true,
      cost_per_unit: false,
      purchase_date: false,
      expiry_date: false,
      notes: true,
      created_at: true,
      updated_at: true,
      custom_details: false,
    };
    for (const [name, expectedRequired] of Object.entries(expectedNotNull)) {
      const col = byName.get(name);
      expect(col, `missing column ${name}`).toBeDefined();
      expect(Boolean(col!.notnull)).toBe(expectedRequired);
    }

    expect(byName.get('quantity')!.type.toUpperCase()).toBe('REAL');
    expect(byName.get('cost_per_unit')!.type.toUpperCase()).toBe('REAL');
  });

  it('PRAGMA index_list contains the unique (category, name_key) index and the category index', () => {
    handle = createTestDb();
    const indexes = handle.db.$client.prepare("PRAGMA index_list('inventory_items')").all() as Array<{
      name: string;
      unique: number;
    }>;
    const uq = indexes.find((i) => i.name === 'inventory_items_category_name_key_uq');
    expect(uq).toBeDefined();
    expect(uq!.unique).toBe(1);

    const categoryIdx = indexes.find((i) => i.name === 'inventory_items_category_idx');
    expect(categoryIdx).toBeDefined();
  });

  it('leaves the count of pre-existing tables unchanged relative to a database migrated without 0011', () => {
    handle = createTestDb();
    const tables = handle.db.$client
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain('inventory_items');
    // Every table this repo shipped before M9_P1 is still present alongside it.
    for (const preExisting of ['equipment_profiles', 'recipes', 'batches', 'water_profiles', 'user_config']) {
      expect(names).toContain(preExisting);
    }
  });

  it('the UNIQUE (category, name_key) index rejects a colliding raw insert', () => {
    handle = createTestDb();
    const now = '2026-08-01T00:00:00.000Z';
    handle.db.$client
      .prepare(
        `INSERT INTO inventory_items (id, category, name, name_key, quantity, unit, cost_per_unit, purchase_date, expiry_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('inv-a', 'Fermentable', 'Pale Ale Malt', 'pale ale malt', 4, 'kg', null, null, null, '', now, now);

    expect(() =>
      handle.db.$client
        .prepare(
          `INSERT INTO inventory_items (id, category, name, name_key, quantity, unit, cost_per_unit, purchase_date, expiry_date, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run('inv-b', 'Fermentable', 'pale ale malt', 'pale ale malt', 1, 'kg', null, null, null, '', now, now),
    ).toThrow();
  });
});

describe('AC-15: migration 0014 adds the nullable custom_details column (M12_P1 Amendment 1)', () => {
  it('PRAGMA table_info reports custom_details as a nullable text column, alongside the pre-existing 12', () => {
    handle = createTestDb();
    const columns = handle.db.$client.prepare("PRAGMA table_info('inventory_items')").all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    expect(columns).toHaveLength(13);
    const customDetailsCol = columns.find((c) => c.name === 'custom_details');
    expect(customDetailsCol).toBeDefined();
    expect(customDetailsCol!.notnull).toBe(0);
    expect(customDetailsCol!.type.toUpperCase()).toBe('TEXT');
  });

  it('running migrations twice (0014 included) on a fresh DB is still a no-op the second time', () => {
    handle = createTestDb();
    expect(() => runMigrations(handle.db)).not.toThrow();
  });

  it('a raw insert omitting custom_details still succeeds (additive, nullable column)', () => {
    handle = createTestDb();
    const now = '2026-08-18T00:00:00.000Z';
    expect(() =>
      handle.db.$client
        .prepare(
          `INSERT INTO inventory_items (id, category, name, name_key, quantity, unit, cost_per_unit, purchase_date, expiry_date, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run('inv-pre-0014', 'Hop', 'Citra', 'citra', 100, 'g', null, null, null, '', now, now),
    ).not.toThrow();
    const row = handle.db.$client.prepare('SELECT custom_details FROM inventory_items WHERE id = ?').get('inv-pre-0014') as { custom_details: unknown };
    expect(row.custom_details).toBeNull();
  });
});

describe('a fresh database opened without seeding still gets a working inventory_items table', () => {
  it('openDatabase + runMigrations alone is sufficient', () => {
    const filePath = path.join(os.tmpdir(), `truchabrew-inventory-migration-${randomUUID()}.db`);
    const { db, close } = openDatabase(filePath);
    runMigrations(db);
    const row = db.$client.prepare('SELECT count(*) as count FROM inventory_items').get() as { count: number };
    expect(row.count).toBe(0);
    close();
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      const p = filePath + suffix;
      if (fs.existsSync(p)) fs.rmSync(p);
    }
  });
});
