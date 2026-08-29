// M9_P2 — the append-only ledger's DB access. New file; see
// .gsd/active/M9_P2_feature_spec.md §1.5. Insert-and-select only — no
// `update` and no `delete` function exists in this file (AC-31 companion
// source scan).
import { eq } from 'drizzle-orm';
import type { InventoryTransaction } from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import { inventoryTransactions } from '../db/schema';

type InventoryTransactionRow = typeof inventoryTransactions.$inferSelect;

export function rowToInventoryTransaction(row: InventoryTransactionRow): InventoryTransaction {
  return {
    id: row.id,
    batchId: row.batchId,
    inventoryItemId: row.inventoryItemId,
    kind: row.kind as InventoryTransaction['kind'],
    reversesTransactionId: row.reversesTransactionId,
    category: row.category as InventoryTransaction['category'],
    displayName: row.displayName,
    nameKey: row.nameKey,
    amount: row.amount,
    unit: row.unit as InventoryTransaction['unit'],
    costPerUnit: row.costPerUnit,
    createdAt: row.createdAt,
  };
}

export function listTransactionsForBatch(db: Db, batchId: string): InventoryTransaction[] {
  const rows = db.select().from(inventoryTransactions).where(eq(inventoryTransactions.batchId, batchId)).all();
  return rows.map(rowToInventoryTransaction);
}

/** All transactions for a batch, restricted to a set of inventoryItemIds — used by the checkoff view's lookup. */
export function listTransactionsForItems(db: Db, batchId: string, inventoryItemIds: readonly string[]): InventoryTransaction[] {
  const all = listTransactionsForBatch(db, batchId);
  const idSet = new Set(inventoryItemIds);
  return all.filter((row) => idSet.has(row.inventoryItemId));
}

export function listAllTransactions(db: Db): InventoryTransaction[] {
  const rows = db.select().from(inventoryTransactions).all();
  return rows.map(rowToInventoryTransaction);
}

export function insertTransaction(db: Db, transaction: InventoryTransaction): InventoryTransaction {
  db.insert(inventoryTransactions)
    .values({
      id: transaction.id,
      batchId: transaction.batchId,
      inventoryItemId: transaction.inventoryItemId,
      kind: transaction.kind,
      reversesTransactionId: transaction.reversesTransactionId,
      category: transaction.category,
      displayName: transaction.displayName,
      nameKey: transaction.nameKey,
      amount: transaction.amount,
      unit: transaction.unit,
      costPerUnit: transaction.costPerUnit,
      createdAt: transaction.createdAt,
    })
    .run();
  return transaction;
}

export function findTransactionById(db: Db, id: string): InventoryTransaction | null {
  const row = db.select().from(inventoryTransactions).where(eq(inventoryTransactions.id, id)).get();
  return row ? rowToInventoryTransaction(row) : null;
}
