import { eq, and, desc, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { batches, batchReadings, batchNotes } from '../db/schema';
import { sortReadings, sortBatchNotes } from '@truchabrew/calculations';
import type {
  Batch,
  BatchNote,
  BatchNoteWriteInput,
  BatchWithReadings,
  BatchWriteInput,
  CalculatedStats,
  ClosingSnapshot,
  Reading,
  ReadingWriteInput,
  Recipe,
} from '@truchabrew/shared-types';

/**
 * Mirrors the existing recipeSnapshot defensive parse (some driver paths
 * return the JSON-mode column already parsed, some return the raw string —
 * see recipeSnapshot below). `null` — the legacy pre-0006 case — passes
 * through untouched; callers decide the labelled-recompute fallback (AC-12e).
 */
function parseStatsSnapshot(raw: unknown): CalculatedStats | null {
  if (raw === null || raw === undefined) return null;
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as CalculatedStats;
}

/** Same defensive-parse shape as parseStatsSnapshot, for the M5_P2 closing_snapshot column. */
function parseClosingSnapshot(raw: unknown): ClosingSnapshot | null {
  if (raw === null || raw === undefined) return null;
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as ClosingSnapshot;
}

function rowToBatch(row: typeof batches.$inferSelect): Batch {
  return {
    id: row.id,
    name: row.name,
    batchNo: row.batchNo,
    brewer: row.brewer,
    brewDate: row.brewDate,
    status: row.status as Batch['status'],
    recipeId: row.recipeId,
    recipeSnapshot: (typeof row.recipeSnapshot === 'string' ? JSON.parse(row.recipeSnapshot) : row.recipeSnapshot) as Recipe,
    statsSnapshot: parseStatsSnapshot(row.statsSnapshot),
    measuredPreBoilGravity: row.measuredPreBoilGravity,
    measuredMashPh: row.measuredMashPh,
    measuredBoilSizeL: row.measuredBoilSizeL,
    measuredBoilTimeMin: row.measuredBoilTimeMin,
    measuredOg: row.measuredOg,
    fermentationStartDate: row.fermentationStartDate,
    measuredFg: row.measuredFg,
    measuredBottlingSizeL: row.measuredBottlingSizeL,
    carbonationType: row.carbonationType as Batch['carbonationType'],
    carbonationVolumesTarget: row.carbonationVolumesTarget,
    carbonationTempC: row.carbonationTempC,
    tasteNotes: row.tasteNotes,
    tasteRating: row.tasteRating,
    bottlingDate: row.bottlingDate,
    closingSnapshot: parseClosingSnapshot(row.closingSnapshot),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The single row -> domain projection for readings (mirrors mashProfileRowsToDomain's precedent). */
function rowToReading(row: typeof batchReadings.$inferSelect): Reading {
  return {
    id: row.id,
    batchId: row.batchId,
    readingTime: row.readingTime,
    sg: row.sg,
    tempC: row.tempC,
    comment: row.comment,
    ph: row.ph,
    pressurePsi: row.pressurePsi,
  };
}

/** The single row -> domain projection for notes (M5_P2 spec §1.2). */
function rowToNote(row: typeof batchNotes.$inferSelect): BatchNote {
  return {
    id: row.id,
    batchId: row.batchId,
    timestamp: row.timestamp,
    status: row.status as BatchNote['status'],
    note: row.note,
  };
}

export const batchRepository = {
  /**
   * The next batch number, derived from `MAX(batch_no) + 1` rather than a row
   * count (critic Finding F-13) — a count reuses numbers after any deletion
   * and races under concurrency. Starts at 1 when the table is empty.
   */
  async nextBatchNo(db: Db): Promise<number> {
    const rows = await db.select({ maxBatchNo: sql<number | null>`MAX(${batches.batchNo})` }).from(batches);
    const max = rows[0]?.maxBatchNo ?? 0;
    return max + 1;
  },

  async findAll(db: Db): Promise<Batch[]> {
    const rows = await db.select().from(batches).orderBy(desc(batches.updatedAt));
    return rows.map(rowToBatch);
  },

  async findById(db: Db, id: string): Promise<Batch | null> {
    const rows = await db.select().from(batches).where(eq(batches.id, id)).limit(1);
    if (rows.length === 0) return null;
    return rowToBatch(rows[0]);
  },

  /**
   * `GET /api/batches/:id`'s shape (M5_P2 spec §1.4). `readings` and `notes`
   * are always in canonical order — `sortReadings`/`sortBatchNotes`
   * (packages/calculations/src/fermentation.ts) are the ONE place that order
   * is implemented; this never hand-sorts.
   */
  async findByIdWithReadings(db: Db, id: string): Promise<BatchWithReadings | null> {
    const batch = await batchRepository.findById(db, id);
    if (!batch) return null;
    const readings = await batchRepository.listReadings(db, id);
    const notes = await batchRepository.listNotes(db, id);
    return { ...batch, readings, notes };
  },

  /**
   * `statsSnapshot` is computed by the caller (once, from the same frozen
   * `recipeSnapshot`, via `calculateRecipeStats`) and is always non-null on
   * create — the `null` case in `Batch.statsSnapshot` exists only for rows
   * that predate this column. See M4_P1 spec AC-12(a)/(c).
   * `fermentationStartDate`/`bottlingDate`/`closingSnapshot` are always
   * `null` at creation — each is only ever set by its own transition (M5_P1 /
   * M5_P2 spec, Resolved Ambiguities).
   */
  async create(
    db: Db,
    id: string,
    batchNo: number,
    recipeId: string,
    recipeSnapshot: Recipe,
    statsSnapshot: CalculatedStats,
    data: BatchWriteInput,
    now: string,
  ): Promise<Batch> {
    const row = {
      id,
      name: data.name,
      batchNo,
      brewer: data.brewer,
      brewDate: data.brewDate,
      status: data.status,
      recipeId,
      recipeSnapshot,
      statsSnapshot,
      measuredPreBoilGravity: data.measuredPreBoilGravity,
      measuredMashPh: data.measuredMashPh,
      measuredBoilSizeL: data.measuredBoilSizeL,
      measuredBoilTimeMin: data.measuredBoilTimeMin,
      measuredOg: data.measuredOg,
      fermentationStartDate: null,
      measuredFg: data.measuredFg,
      measuredBottlingSizeL: data.measuredBottlingSizeL,
      carbonationType: data.carbonationType,
      carbonationVolumesTarget: data.carbonationVolumesTarget,
      carbonationTempC: data.carbonationTempC,
      tasteNotes: data.tasteNotes,
      tasteRating: data.tasteRating,
      bottlingDate: null,
      closingSnapshot: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(batches).values(row);

    return {
      ...row,
      status: row.status as Batch['status'],
      closingSnapshot: null,
    };
  },

  /**
   * Never sets `statsSnapshot` (nor `recipeSnapshot`) — both are frozen at
   * creation. Drizzle's `.set()` only touches the columns named here, so
   * omitting `statsSnapshot` is itself the guarantee; `.returning()` reads
   * back whatever the column already held, untouched by this write.
   *
   * `fermentationStartDateOverride`, `bottlingDateOverride` and
   * `closingSnapshotOverride` are DISTINCT explicit parameters, never merged
   * in from `BatchWriteInput` (which does not carry any of the three fields
   * at all — all three are server-owned). When `undefined` (the common case),
   * the corresponding column is omitted from `.set()` entirely, so it is left
   * exactly as it was — write-once/frozen, never silently overwritten
   * (AC-30).
   */
  async update(
    db: Db,
    id: string,
    data: BatchWriteInput,
    now: string,
    fermentationStartDateOverride?: string,
    bottlingDateOverride?: string,
    closingSnapshotOverride?: ClosingSnapshot,
  ): Promise<Batch | null> {
    const rows = await db
      .update(batches)
      .set({
        name: data.name,
        batchNo: data.batchNo,
        brewer: data.brewer,
        brewDate: data.brewDate,
        status: data.status,
        measuredPreBoilGravity: data.measuredPreBoilGravity,
        measuredMashPh: data.measuredMashPh,
        measuredBoilSizeL: data.measuredBoilSizeL,
        measuredBoilTimeMin: data.measuredBoilTimeMin,
        measuredOg: data.measuredOg,
        measuredFg: data.measuredFg,
        measuredBottlingSizeL: data.measuredBottlingSizeL,
        carbonationType: data.carbonationType,
        carbonationVolumesTarget: data.carbonationVolumesTarget,
        carbonationTempC: data.carbonationTempC,
        tasteNotes: data.tasteNotes,
        tasteRating: data.tasteRating,
        updatedAt: now,
        ...(fermentationStartDateOverride !== undefined ? { fermentationStartDate: fermentationStartDateOverride } : {}),
        ...(bottlingDateOverride !== undefined ? { bottlingDate: bottlingDateOverride } : {}),
        ...(closingSnapshotOverride !== undefined ? { closingSnapshot: closingSnapshotOverride } : {}),
      })
      .where(eq(batches.id, id))
      .returning();

    if (rows.length === 0) return null;
    return rowToBatch(rows[0]);
  },

  /**
   * M15_P1 spec §2.1/§3.2 — in-batch recipe adjustment. Overwrites ONLY
   * `recipeSnapshot` and `statsSnapshot` (the caller recomputes statsSnapshot
   * via calculateRecipeStats against the SAME new recipeSnapshot before
   * calling this, exactly like the batch-create path does) plus
   * `updatedAt`. Never touches any other column — measurements, status,
   * fermentationStartDate, closingSnapshot etc. are all untouched by an
   * in-batch recipe adjustment.
   */
  async updateRecipeSnapshot(db: Db, id: string, recipeSnapshot: Recipe, statsSnapshot: CalculatedStats, now: string): Promise<Batch | null> {
    const rows = await db
      .update(batches)
      .set({ recipeSnapshot, statsSnapshot, updatedAt: now })
      .where(eq(batches.id, id))
      .returning();

    if (rows.length === 0) return null;
    return rowToBatch(rows[0]);
  },

  // -------------------------------------------------------------------------
  // Readings (M5_P1). Per-item endpoints, not full-replace (spec §4
  // deviation 5) — a reading log is appended to over weeks and grows without
  // bound; readingIds are scoped to their batch (never a cross-batch write).
  // -------------------------------------------------------------------------

  /** Canonical order (sortReadings). [] when none. */
  async listReadings(db: Db, batchId: string): Promise<Reading[]> {
    const rows = await db.select().from(batchReadings).where(eq(batchReadings.batchId, batchId));
    return sortReadings(rows.map(rowToReading));
  },

  async createReading(db: Db, id: string, batchId: string, input: ReadingWriteInput): Promise<Reading> {
    const row = {
      id,
      batchId,
      readingTime: input.readingTime,
      sg: input.sg,
      tempC: input.tempC,
      comment: input.comment,
      ph: input.ph,
      pressurePsi: input.pressurePsi,
    };
    await db.insert(batchReadings).values(row);
    return rowToReading(row as typeof batchReadings.$inferSelect);
  },

  /**
   * Full replace of all six writable fields. Returns `null` (nothing
   * written) when `readingId` does not exist OR belongs to a different
   * batch — `readingId` is scoped to `batchId` by the WHERE clause itself,
   * never by a separate check-then-write (AC-22).
   */
  async updateReading(db: Db, batchId: string, readingId: string, input: ReadingWriteInput): Promise<Reading | null> {
    const rows = await db
      .update(batchReadings)
      .set({
        readingTime: input.readingTime,
        sg: input.sg,
        tempC: input.tempC,
        comment: input.comment,
        ph: input.ph,
        pressurePsi: input.pressurePsi,
      })
      .where(and(eq(batchReadings.id, readingId), eq(batchReadings.batchId, batchId)))
      .returning();

    if (rows.length === 0) return null;
    return rowToReading(rows[0]);
  },

  /** Returns `false` (nothing written) when `readingId` doesn't exist or belongs to a different batch. */
  async deleteReading(db: Db, batchId: string, readingId: string): Promise<boolean> {
    const rows = await db
      .delete(batchReadings)
      .where(and(eq(batchReadings.id, readingId), eq(batchReadings.batchId, batchId)))
      .returning({ id: batchReadings.id });
    return rows.length > 0;
  },

  // -------------------------------------------------------------------------
  // Notes (M5_P2 spec §1.2/§1.5). Per-item endpoints. `timestamp` and
  // `status` are server-minted/recorded at creation and structurally
  // unwritable afterward — `updateNote` never names either column.
  // -------------------------------------------------------------------------

  /** Canonical order (sortBatchNotes). [] when none. */
  async listNotes(db: Db, batchId: string): Promise<BatchNote[]> {
    const rows = await db.select().from(batchNotes).where(eq(batchNotes.batchId, batchId));
    return sortBatchNotes(rows.map(rowToNote));
  },

  async createNote(db: Db, id: string, batchId: string, timestamp: string, status: Batch['status'], input: BatchNoteWriteInput): Promise<BatchNote> {
    const row = { id, batchId, timestamp, status, note: input.note };
    await db.insert(batchNotes).values(row);
    return rowToNote(row as typeof batchNotes.$inferSelect);
  },

  /**
   * Replaces `note` ONLY. Returns `null` (nothing written) when `noteId`
   * does not exist OR belongs to a different batch, scoped by the WHERE
   * clause itself (AC-32), same pattern as updateReading.
   */
  async updateNote(db: Db, batchId: string, noteId: string, input: BatchNoteWriteInput): Promise<BatchNote | null> {
    const rows = await db
      .update(batchNotes)
      .set({ note: input.note })
      .where(and(eq(batchNotes.id, noteId), eq(batchNotes.batchId, batchId)))
      .returning();

    if (rows.length === 0) return null;
    return rowToNote(rows[0]);
  },

  /** Returns `false` (nothing written) when `noteId` doesn't exist or belongs to a different batch. */
  async deleteNote(db: Db, batchId: string, noteId: string): Promise<boolean> {
    const rows = await db
      .delete(batchNotes)
      .where(and(eq(batchNotes.id, noteId), eq(batchNotes.batchId, batchId)))
      .returning({ id: batchNotes.id });
    return rows.length > 0;
  },

  // -------------------------------------------------------------------------
  // Batch delete (M13_P1 Amendment 2, spec §3.5.3). Exactly one statement —
  // `batch_readings` and `batch_notes` are removed by the DB-level
  // `ON DELETE CASCADE` already declared on both tables (schema.ts:372/416),
  // not hand-deleted here, and no transaction is opened (§3.5.2, binding).
  // -------------------------------------------------------------------------

  /** Returns `false` (nothing written) when `id` doesn't exist. */
  async deleteBatch(db: Db, id: string): Promise<boolean> {
    const rows = await db.delete(batches).where(eq(batches.id, id)).returning({ id: batches.id });
    return rows.length > 0;
  },
};
