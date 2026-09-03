import { eq, and } from 'drizzle-orm';
import type { InventoryItem, InventoryWriteInput, InventoryStockView, InventoryCustomDetails } from '@truchabrew/shared-types';
import { normalizeInventoryName, isOutOfStock, INVENTORY_CATEGORIES, projectInventoryStock } from '@truchabrew/calculations';
import type { Db } from '../db/client';
import { inventoryItems } from '../db/schema';
import { listAllTransactions } from './inventoryTransactionRepository';

// ---------------------------------------------------------------------------
// Domain mapping
// ---------------------------------------------------------------------------

type InventoryRow = typeof inventoryItems.$inferSelect;

/**
 * Defensive parse mirroring the repo-wide recipeSnapshot/statsSnapshot
 * precedent (batchRepository) — some driver paths return the JSON-mode
 * column already parsed, others return the raw string. `null`/`undefined`
 * (every row created before migration 0014) passes through unchanged.
 */
function parseCustomDetails(value: unknown): InventoryCustomDetails | null {
  if (value === null || value === undefined) return null;
  return (typeof value === 'string' ? JSON.parse(value) : value) as InventoryCustomDetails;
}

export function rowToInventoryItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    category: row.category as InventoryItem['category'],
    name: row.name,
    nameKey: row.nameKey,
    quantity: row.quantity,
    unit: row.unit as InventoryItem['unit'],
    costPerUnit: row.costPerUnit,
    purchaseDate: row.purchaseDate,
    expiryDate: row.expiryDate,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    customDetails: parseCustomDetails(row.customDetails),
  };
}

// ---------------------------------------------------------------------------
// Listing — default order is category (INVENTORY_CATEGORIES order), then
// nameKey ascending (AC-18). Filters combine with AND, applied in SQL.
// ---------------------------------------------------------------------------

export interface ListInventoryFilters {
  category?: InventoryItem['category'];
  outOfStock?: boolean;
}

/**
 * Returns the ledger-PROJECTED view (M9_P2 Resolved Ambiguity 2) — `quantity`
 * is on-hand, not the stored base. The `outOfStock` filter evaluates on-hand,
 * never the base (§4 Deviation 2). `baseQuantity - deductedQuantity` is
 * computed in exactly one place, `projectInventoryStock`
 * (packages/calculations/src/inventoryLedger.ts) — this function only calls
 * it, never re-derives it (AC-34's source-scan companion).
 */
export function listInventory(db: Db, filters: ListInventoryFilters = {}): InventoryStockView[] {
  const conditions = [];
  if (filters.category !== undefined) {
    conditions.push(eq(inventoryItems.category, filters.category));
  }
  const rows = db
    .select()
    .from(inventoryItems)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all();

  const categoryRank = new Map(INVENTORY_CATEGORIES.map((c, i) => [c, i]));
  const sorted = [...rows].sort((a, b) => {
    const rankDiff = (categoryRank.get(a.category as InventoryItem['category']) ?? 0) - (categoryRank.get(b.category as InventoryItem['category']) ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return a.nameKey < b.nameKey ? -1 : a.nameKey > b.nameKey ? 1 : 0;
  });

  const items = sorted.map(rowToInventoryItem);
  const ledger = listAllTransactions(db);
  const projected = projectInventoryStock(items, ledger);

  return filters.outOfStock === undefined ? projected : projected.filter((r) => isOutOfStock(r.quantity) === filters.outOfStock);
}

export function findInventoryById(db: Db, id: string): InventoryStockView | null {
  const row = db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).get();
  if (!row) return null;
  const item = rowToInventoryItem(row);
  const ledger = listAllTransactions(db);
  return projectInventoryStock([item], ledger)[0];
}

export function findInventoryByCategoryAndNameKey(db: Db, category: InventoryItem['category'], nameKey: string): InventoryItem | null {
  const row = db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.category, category), eq(inventoryItems.nameKey, nameKey)))
    .get();
  return row ? rowToInventoryItem(row) : null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createInventoryItem(db: Db, id: string, input: InventoryWriteInput, now: string): InventoryStockView {
  const trimmedName = input.name.trim();
  db.insert(inventoryItems)
    .values({
      id,
      category: input.category,
      name: trimmedName,
      nameKey: normalizeInventoryName(trimmedName),
      quantity: input.quantity,
      unit: input.unit,
      costPerUnit: input.costPerUnit,
      purchaseDate: input.purchaseDate,
      expiryDate: input.expiryDate,
      notes: input.notes,
      customDetails: input.customDetails ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return findInventoryById(db, id)!;
}

export function updateInventoryItem(db: Db, id: string, input: InventoryWriteInput, now: string): InventoryStockView | null {
  const existing = db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).get();
  if (!existing) return null;
  const trimmedName = input.name.trim();
  db.update(inventoryItems)
    .set({
      category: input.category,
      name: trimmedName,
      nameKey: normalizeInventoryName(trimmedName),
      quantity: input.quantity,
      unit: input.unit,
      costPerUnit: input.costPerUnit,
      purchaseDate: input.purchaseDate,
      expiryDate: input.expiryDate,
      notes: input.notes,
      customDetails: input.customDetails ?? null,
      updatedAt: now,
    })
    .where(eq(inventoryItems.id, id))
    .run();
  return findInventoryById(db, id);
}

export function deleteInventoryItem(db: Db, id: string): boolean {
  const existing = db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).get();
  if (!existing) return false;
  db.delete(inventoryItems).where(eq(inventoryItems.id, id)).run();
  return true;
}
