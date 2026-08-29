import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { runMigrations } from '../src/db/migrate';

let handle: TestDbHandle;

afterEach(() => {
  handle?.cleanup();
});

describe('AC-24: migration applies and is idempotent', () => {
  it('running migrations twice is a no-op; 12 columns; 3 indexes; inventory_items unchanged; 21 tables', () => {
    handle = createTestDb();

    // Idempotency — re-running the full migration set (including 0012) must not error.
    expect(() => runMigrations(handle.db)).not.toThrow();

    const info = handle.db.$client.prepare("PRAGMA table_info('inventory_transactions')").all() as Array<{
      name: string;
      notnull: number;
      type: string;
      pk: number;
    }>;
    expect(info).toHaveLength(12);
    const byName = new Map(info.map((c) => [c.name, c]));
    expect(byName.get('id')?.pk).toBe(1);
    expect(byName.get('batch_id')?.notnull).toBe(1);
    expect(byName.get('inventory_item_id')?.notnull).toBe(1);
    expect(byName.get('kind')?.notnull).toBe(1);
    expect(byName.get('reverses_transaction_id')?.notnull).toBe(0);
    expect(byName.get('category')?.notnull).toBe(1);
    expect(byName.get('display_name')?.notnull).toBe(1);
    expect(byName.get('name_key')?.notnull).toBe(1);
    expect(byName.get('amount')?.notnull).toBe(1);
    expect(byName.get('unit')?.notnull).toBe(1);
    expect(byName.get('cost_per_unit')?.notnull).toBe(0);
    expect(byName.get('created_at')?.notnull).toBe(1);

    const indexes = handle.db.$client.prepare("PRAGMA index_list('inventory_transactions')").all() as Array<{ name: string; unique: number }>;
    const names = indexes.map((i) => i.name);
    expect(names).toContain('inventory_transactions_batch_idx');
    expect(names).toContain('inventory_transactions_item_idx');
    const reversesUq = indexes.find((i) => i.name === 'inventory_transactions_reverses_uq');
    expect(reversesUq).toBeDefined();
    expect(reversesUq?.unique).toBe(1);

    // inventory_items is unaffected by THIS migration (0012) — 12 M9_P1
    // columns + 1 (custom_details, migration 0014, M12_P1 Amendment 1).
    const itemsInfo = handle.db.$client.prepare("PRAGMA table_info('inventory_items')").all() as Array<{ name: string }>;
    expect(itemsInfo).toHaveLength(13);

    const tables = handle.db.$client
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'")
      .all() as Array<{ name: string }>;
    expect(tables.length).toBe(21);
    expect(tables.map((t) => t.name)).toContain('inventory_transactions');
  });

  it('the UNIQUE index on reverses_transaction_id permits unlimited NULLs but at most one non-null value per target', () => {
    handle = createTestDb();
    const now = new Date().toISOString();
    const insertSql =
      'INSERT INTO inventory_transactions (id, batch_id, inventory_item_id, kind, reverses_transaction_id, category, display_name, name_key, amount, unit, cost_per_unit, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)';
    const insert = (id: string, reverses: string | null) =>
      handle.db.$client.prepare(insertSql).run(id, 'batch-1', 'inv-1', reverses ? 'reversal' : 'deduction', reverses, 'Fermentable', 'Pale Ale Malt', 'pale ale malt', 1, 'kg', 1, now);

    // Two NULL reverses_transaction_id rows (ordinary deductions) — both succeed.
    expect(() => insert(randomUUID(), null)).not.toThrow();
    expect(() => insert(randomUUID(), null)).not.toThrow();

    const deductionId = randomUUID();
    insert(deductionId, null);
    expect(() => insert(randomUUID(), deductionId)).not.toThrow();
    expect(() => insert(randomUUID(), deductionId)).toThrow();
  });
});
