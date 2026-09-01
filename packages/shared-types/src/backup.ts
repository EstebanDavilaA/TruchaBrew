import type { StoredRecipe } from './api';
import type { BatchWithReadings } from './batches';
import type { EquipmentProfile, WaterProfile } from './brewing';
import type { MashProfile, FermentationProfile } from './schedules';
import type { InventoryItem } from './inventory';
import type { UserConfig } from './config';

/**
 * M36_P1 — the full-database JSON export envelope returned by
 * `GET /api/backup/export` (RA-1). `schemaVersion` is a literal `1` (not
 * `number`) so a future format revision is a type-level breaking change,
 * not a silent widening — the same "narrow literal for format evolution"
 * rule this repo already applies to enums like `BatchStatus`.
 *
 * The 8 entity families are nested under `data`, never top-level siblings
 * of `schemaVersion`/`exportedAt`/`appVersion` (RA-1) — this keeps the
 * envelope's own metadata cleanly separated from the payload it describes,
 * and leaves room for sibling metadata fields (e.g. a future `checksum`)
 * without colliding with an entity family name.
 */
export interface DatabaseBackup {
  schemaVersion: 1;
  /** ISO 8601 UTC timestamp of when this export was generated. */
  exportedAt: string;
  /** TruchaBrew semantic version that produced this export. */
  appVersion: string;
  data: {
    recipes: StoredRecipe[];
    batches: BatchWithReadings[];
    equipmentProfiles: EquipmentProfile[];
    mashProfiles: MashProfile[];
    fermentationProfiles: FermentationProfile[];
    waterProfiles: WaterProfile[];
    inventoryItems: InventoryItem[];
    config: UserConfig;
  };
}

// ---------------------------------------------------------------------------
// M36_P2 — restore contracts. `POST /api/backup/restore` (routes/backup.ts)
// consumes a RestoreRequest and returns a RestoreSummary.
// ---------------------------------------------------------------------------

/**
 * `replace` wipes every active user row (RA-1's reverse-dependency clear
 * order) before inserting the backup's entities verbatim with their
 * original ids. `merge` preserves every existing row; an incoming entity
 * whose id collides with an existing row in the same table is inserted
 * under a freshly generated UUIDv4 instead, with its child rows' foreign
 * keys remapped to match (RA-2).
 */
export type RestoreMode = 'replace' | 'merge';

export interface RestoreRequest {
  backup: DatabaseBackup;
  mode: RestoreMode;
}

/**
 * Per-entity-family row counts for the restore preview grid and the
 * post-restore summary. Mirrors the 7 ARRAY families under
 * `DatabaseBackup.data` — `config` is a single row, not a collection, so it
 * has no count of its own here (the same reasoning `RecipeSummary` applies
 * to line-item counts: only things you can count as N are counted).
 */
export interface EntityCounts {
  recipes: number;
  batches: number;
  equipmentProfiles: number;
  mashProfiles: number;
  fermentationProfiles: number;
  waterProfiles: number;
  inventoryItems: number;
}

export interface RestoreSummary {
  /** ISO 8601 UTC timestamp of when the restore completed. */
  restoredAt: string;
  mode: RestoreMode;
  counts: EntityCounts;
}
