// M9_P1 — Inventory: what's in stock, and what am I short of. New module;
// see .gsd/active/M9_P1_feature_spec.md §1.1.

export type InventoryCategory = 'Fermentable' | 'Hop' | 'Yeast' | 'Misc';
export type InventoryUnit = 'kg' | 'g' | 'pkg' | 'ml' | 'tsp' | 'tbsp' | 'each';

export interface InventoryItem {
  id: string;
  category: InventoryCategory;
  name: string; // trimmed, case preserved exactly as the user typed it
  nameKey: string; // SERVER-OWNED, derived: normalizeInventoryName(name). Absent from InventoryWriteInput.
  quantity: number; // may be negative; never clamped
  unit: InventoryUnit; // constrained by category (Resolved Ambiguity 4)
  costPerUnit: number | null; // >= 0 when non-null. Never multiplied by anything in M9_P1.
  purchaseDate: string | null; // 'YYYY-MM-DD'
  expiryDate: string | null; // 'YYYY-MM-DD'
  notes: string; // '' when unset, never null
  createdAt: string; // SERVER-OWNED ISO-8601 UTC
  updatedAt: string; // SERVER-OWNED ISO-8601 UTC
  // NEW in M12_P1 Amendment 1 (migration 0014) — lot-dependent category
  // vitals. null/absent for rows created before Amendment 1 shipped.
  customDetails?: InventoryCustomDetails | null;
}

/** The 8 client-writable fields, plus `customDetails` (M12_P1 Amendment 1). id / nameKey / createdAt / updatedAt are absent BY DESIGN. */
export interface InventoryWriteInput {
  category: InventoryCategory;
  name: string;
  quantity: number;
  unit: InventoryUnit;
  costPerUnit: number | null;
  purchaseDate: string | null;
  expiryDate: string | null;
  notes: string;
  customDetails?: InventoryCustomDetails | null;
}

// ---------------------------------------------------------------------------
// M12_P1 Amendment 1 — category-specific inventory item details. See
// .gsd/active/M12_P1_feature_spec.md §7.2.
// ---------------------------------------------------------------------------

export interface HopInventoryDetails {
  alphaAcidPct?: number | null;
  hopType?: string | null; // e.g. 'Pellet', 'Leaf', 'Cryo', 'Extract'
  origin?: string | null;
  year?: number | null;
  lotNumber?: string | null;
  manufacturingDate?: string | null;
}

export interface FermentableInventoryDetails {
  potentialSg?: number | null;
  colorSrm?: number | null;
  grainType?: string | null; // e.g. 'Grain', 'LiquidExtract', 'DryExtract', 'Sugar', 'Adjunct'
  supplier?: string | null;
  origin?: string | null;
  yieldPct?: number | null;
  lotNumber?: string | null;
  manufacturingDate?: string | null;
}

export interface YeastInventoryDetails {
  laboratory?: string | null;
  productId?: string | null;
  attenuationPct?: number | null;
  yeastType?: string | null; // e.g. 'Ale', 'Lager', 'Wheat', 'Wine'
  form?: string | null; // e.g. 'Dry', 'Liquid'
  lotNumber?: string | null;
  manufacturingDate?: string | null;
}

export interface MiscInventoryDetails {
  miscType?: string | null; // e.g. 'WaterAgent', 'Fining', 'Spice', 'Flavor', 'Other'
  defaultUse?: string | null; // e.g. 'Mash', 'Boil', 'Whirlpool', 'Primary', 'Secondary', 'Bottling'
  lotNumber?: string | null;
  manufacturingDate?: string | null;
}

export type InventoryCustomDetails =
  | ({ category: 'Hop' } & HopInventoryDetails)
  | ({ category: 'Fermentable' } & FermentableInventoryDetails)
  | ({ category: 'Yeast' } & YeastInventoryDetails)
  | ({ category: 'Misc' } & MiscInventoryDetails);

/** The 409 INVENTORY_DUPLICATE body's `details` payload — same precedent as EquipmentInUseDetails. */
export interface InventoryDuplicateDetails {
  existingId: string;
  category: InventoryCategory;
  nameKey: string;
  existingName: string;
}

// ---------------------------------------------------------------------------
// Stock-evaluation types (spec §1.1) — shared by the API response and the web
// page so the two never drift.
// ---------------------------------------------------------------------------

export interface StockRequirement {
  category: InventoryCategory;
  displayName: string; // first contributing line item's name, verbatim
  nameKey: string;
  unit: InventoryUnit;
  requiredAmount: number; // aggregated; always > STOCK_EPSILON (non-positive groups are omitted)
}

export interface StockLine extends StockRequirement {
  matched: boolean;
  inventoryItemId: string | null;
  inventoryUnit: InventoryUnit | null;
  onHand: number | null;
  unitMismatch: boolean;
  shortfall: number | null; // null in BOTH unknown cases; >= 0 and epsilon-clamped otherwise
  sufficient: boolean | null; // null in BOTH unknown cases
}

export interface StockEvaluation {
  lines: StockLine[];
  requirementCount: number;
  matchedCount: number;
  comparableCount: number; // matched && !unitMismatch
  unmatchedCount: number;
  unitMismatchCount: number;
  shortfallCount: number; // comparable lines with shortfall > 0
  hasShortfall: boolean; // shortfallCount > 0
}

// ---------------------------------------------------------------------------
// M9_P2 — the append-only deduction ledger, the checkoff view, cost and
// nutrition. See .gsd/active/M9_P2_feature_spec.md §1.1. Appended to this
// module; not one M9_P1 declaration above is edited.
// ---------------------------------------------------------------------------

import type { BatchStatus } from './batches';

export type InventoryTransactionKind = 'deduction' | 'reversal';

export interface InventoryTransaction {
  id: string; // SERVER-MINTED
  batchId: string;
  inventoryItemId: string;
  kind: InventoryTransactionKind;
  reversesTransactionId: string | null; // non-null IFF kind === 'reversal'
  category: InventoryCategory; // denormalized; survives item deletion
  displayName: string; // denormalized; the item's `name` at deduction time
  nameKey: string; // denormalized
  amount: number; // POSITIVE magnitude, > STOCK_EPSILON. Sign is carried by `kind`.
  unit: InventoryUnit;
  costPerUnit: number | null; // FROZEN at the deduction; never rewritten
  createdAt: string; // SERVER-MINTED ISO-8601 UTC
}

/** M9_P1's InventoryItem, plus the three ledger-derived keys. `quantity` is REPLACED with on-hand. */
export interface InventoryStockView extends InventoryItem {
  baseQuantity: number; // exactly inventory_items.quantity
  deductedQuantity: number; // sum of OPEN deductions; 0 when none
  openDeductionCount: number; // integer >= 0
}

/** M9_P1's StockLine (12 keys, unchanged), plus exactly 6 checkoff keys. */
export interface StockCheckoffLine extends StockLine {
  checkable: boolean; // matched && !unitMismatch
  checked: boolean; // false whenever !checkable
  openTransactionId: string | null;
  checkedAmount: number | null;
  checkedCostPerUnit: number | null;
  checkedAt: string | null; // the open deduction row's createdAt
}

export interface BatchCheckoffState {
  lines: StockCheckoffLine[];
  requirementCount: number;
  matchedCount: number;
  comparableCount: number;
  unmatchedCount: number;
  unitMismatchCount: number;
  shortfallCount: number; // computed against ON-HAND, i.e. post-ledger
  hasShortfall: boolean;
  checkableCount: number; // === comparableCount, restated for the UI's benefit
  checkedCount: number;
  allCheckedOff: boolean; // checkableCount > 0 && checkedCount === checkableCount
  stage: BatchStatus;
  editable: boolean; // stage === 'Planning'
}

export interface BatchCostLine {
  transactionId: string;
  category: InventoryCategory;
  displayName: string;
  nameKey: string;
  amount: number;
  unit: InventoryUnit;
  costPerUnit: number | null;
  lineCost: number | null; // null IFF costPerUnit is null
}

export interface BatchCostBreakdown {
  lines: BatchCostLine[];
  lineCount: number;
  costedLineCount: number;
  uncostedLineCount: number;
  hasUncostedLines: boolean;
  totalCost: number; // UNROUNDED; 0 for an empty ledger
}

export interface BeerNutrition {
  originalPlato: number;
  apparentPlato: number;
  realExtractPlato: number;
  abwPct: number; // UNCLAMPED; negative when FG > OG
  caloriesPer100Ml: number;
  carbsGPer100Ml: number;
  alcoholGPer100Ml: number;
  caloriesPerServing: number;
  carbsGPerServing: number;
  alcoholGPerServing: number;
}

/** The two checkoff request bodies. `inventoryItemId` is the ONLY client-writable field on either. */
export interface CheckoffWriteInput {
  inventoryItemId: string;
}
