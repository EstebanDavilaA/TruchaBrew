import type { CalculatedStats, Recipe } from './brewing';

// All five statuses are live as of M5_P2. See
// packages/calculations/src/batchPipeline.ts's BATCH_STATUSES /
// BATCH_STATUS_TRANSITIONS for the ONE source of truth on which transitions
// are legal — 'Completed' is terminal (AC-1/AC-2).
export type BatchStatus = 'Planning' | 'Brewing' | 'Fermenting' | 'Conditioning' | 'Completed';

export type CarbonationType = 'Sugar' | 'KegForce' | 'KegForceQuick' | 'KegSugar';

/** The beer volume the priming figures were computed against, and where it came from. */
export type BeerVolumeSource = 'measured' | 'recipe';

/**
 * Frozen at the transition into 'Completed', in the same write, from the
 * batch's own measured values and its frozen recipeSnapshot. Never recomputed
 * except when a closing-snapshot INPUT is corrected on an already-Completed
 * batch (M5_P2 spec, Resolved Ambiguities, rule W2). `null` only for a batch
 * that has never been Completed.
 */
export interface ClosingSnapshot {
  frozenAt: string;                      // ISO-8601 UTC; the write's own `now`, supplied as an argument
  originalGravity: number;               // always batch.measuredOg — non-null by the completion gate
  finalGravity: number;                  // always batch.measuredFg
  abv: number;                           // UNROUNDED
  apparentAttenuationPct: number;        // UNROUNDED, unclamped, may be negative
  mashEfficiencyPct: number | null;
  peakFermentationTempC: number | null;
  beerVolumeL: number;
  beerVolumeSource: BeerVolumeSource;
  primingSugarG: number | null;          // grams of SUCROSE
  primingSugarEquivGPerL: number | null; // grams of SUCROSE per litre
  carbonationForcePsi: number | null;    // UNCLAMPED; may be negative
}

export interface BatchNote {
  id: string;
  batchId: string;
  timestamp: string;   // ISO-8601 UTC, server-minted, never rewritten
  status: BatchStatus; // the status the note was written at, server-recorded, never rewritten
  note: string;        // 1..5000 chars
}

export interface BatchNoteWriteInput {
  note: string;        // the ONLY client-writable field
}

export interface Batch {
  id: string;
  name: string;
  batchNo: number;
  // NEW (M19_P1 spec §1.1/§2.2). Both client-writable through
  // BatchWriteInput, nullable in DB and API. `brewer` max 200 chars
  // (enforced at the HTTP boundary, not by SQLite); `brewDate` is an ISO
  // date string (`YYYY-MM-DD` or full ISO instant), unvalidated for real-date
  // shape here (same looseness as the rest of this file's free-text/date
  // fields).
  brewer?: string | null;
  brewDate?: string | null;
  status: BatchStatus;
  recipeId: string; // The original recipe it was brewed from
  recipeSnapshot: Recipe; // The frozen snapshot of the recipe
  // NEW (M4_P1 spec AC-12). A SIBLING of recipeSnapshot, not a widening of
  // it: `Recipe` stays a `Recipe`, so every existing consumer of that field
  // is unaffected. Computed exactly once, at batch creation, from
  // `calculateRecipeStats(recipeSnapshot)` against the same frozen recipe
  // in the same write — never recomputed afterward, including across a
  // calculation-engine formula change (see ROADMAP.md Milestone 7). `null`
  // only for batch rows created before this field existed; callers must
  // fall back to a live recompute AND label it as such rather than treating
  // `null` as "no stats" silently.
  statsSnapshot: CalculatedStats | null;
  measuredPreBoilGravity: number | null;
  measuredMashPh: number | null;
  measuredBoilSizeL: number | null;
  measuredBoilTimeMin: number | null;
  // NEW (M5_P1 spec §1.3). Client-writable through BatchWriteInput. OG is
  // measured at pitch — the end of brew day, i.e. the Brewing -> Fermenting
  // boundary this phase owns. null until entered. See
  // resolveOriginalGravity (packages/calculations/src/fermentation.ts) for
  // the precedence rule against the estimated (statsSnapshot/recalculated) OG.
  measuredOg: number | null;
  // NEW (M5_P1 spec §1.3). SERVER-OWNED, write-once: set by the server, to
  // the transition's own `now`, iff the request transitions a batch whose
  // stored value is null into status 'Fermenting'. Never overwritten, never
  // set by any other transition, never accepted from the client — absent
  // from BatchWriteInput by design. A PUT body containing this key is
  // 400 VALIDATION_FAILED (see the preValidation hook in routes/batches.ts).
  fermentationStartDate: string | null;
  // NEW (M5_P2 spec §1.3). Client-writable through BatchWriteInput, nullable.
  measuredFg: number | null;
  measuredBottlingSizeL: number | null;
  carbonationType: CarbonationType | null;
  carbonationVolumesTarget: number | null;
  carbonationTempC: number | null;
  tasteNotes: string;                        // '' when unset, never null
  tasteRating: number | null;                // integer 1..5
  // NEW (M5_P2 spec §1.3). SERVER-OWNED, write-once: set by the server, to
  // the transition's own `now`, iff the request transitions a batch whose
  // stored value is null into status 'Conditioning'. Mirrors
  // fermentationStartDate exactly. Absent from BatchWriteInput by design. A
  // PUT body containing this key is 400 VALIDATION_FAILED.
  bottlingDate: string | null;
  // NEW (M5_P2 spec §1.3). SERVER-OWNED: computed once, server-side, at the
  // transition into 'Completed' (and recomputed only when a closing-snapshot
  // input is corrected on an already-Completed batch — see the route's W1/W2
  // rule). Absent from BatchWriteInput by design. `null` until the batch is
  // Completed.
  closingSnapshot: ClosingSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchWriteInput {
  name: string;
  // NEW (M19_P1 spec §1.1/§2.2). Integer >= 1, validated server-side by
  // batchWriteBodySchema.
  batchNo: number;
  brewer: string | null;
  brewDate: string | null;
  status: BatchStatus;
  measuredPreBoilGravity: number | null;
  measuredMashPh: number | null;
  measuredBoilSizeL: number | null;
  measuredBoilTimeMin: number | null;
  measuredOg: number | null;
  // NEW (M5_P2 spec §1.3) — seven fields. bottlingDate and closingSnapshot
  // are deliberately NOT here: both are server-owned (see Batch above).
  measuredFg: number | null;
  measuredBottlingSizeL: number | null;
  carbonationType: CarbonationType | null;
  carbonationVolumesTarget: number | null;
  carbonationTempC: number | null;
  tasteNotes: string;
  tasteRating: number | null;
}

// NEW (M5_P1 spec §1.3). A reading is an immutable-in-shape, append-oriented
// log entry — not a positional child row (no `position` column; order is
// derived from `readingTime`, see sortReadings in
// packages/calculations/src/fermentation.ts).
export interface Reading {
  id: string;
  batchId: string;
  readingTime: string;        // ISO-8601 UTC, 'Z'-suffixed
  sg: number | null;
  tempC: number | null;
  comment: string;            // '' when unset, never null
  ph: number | null;
  pressurePsi: number | null;
}

export interface ReadingWriteInput {
  readingTime: string;
  sg: number | null;
  tempC: number | null;
  comment: string;
  ph: number | null;
  pressurePsi: number | null;
}

// (M5_P1 spec §1.3), on the StoredRecipe extends Recipe precedent.
// GET /api/batches (the list) returns Batch[] and carries no reading/note
// data — the list must not grow linearly in reading/note count. GET
// /api/batches/:id returns BatchWithReadings — the full detail payload. The
// name is kept even though it now also carries notes (M5_P2 spec §4
// deviation 7): renaming it would touch six files for a cosmetic gain inside
// the MVP-closing phase, and introducing a second detail type would give one
// payload two names.
export interface BatchWithReadings extends Batch {
  readings: Reading[];        // canonical order (sortReadings); [] when none
  notes: BatchNote[];         // canonical order (sortBatchNotes); [] when none
}
