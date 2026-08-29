import type { BatchStatus } from '@truchabrew/shared-types';

// The single source of truth for batch statuses and their allowed
// transitions (M5_P1 spec §2.1 / §2.7 / Key Behavior 2). Three hand-maintained
// status lists previously existed independently — ALLOWED_TRANSITIONS in
// routes/batches.ts, the batchStatusEnum literal in routes/schemas.ts, and
// BATCH_STATUS_OPTIONS in BatchDetail.tsx — and all three are now derived
// from the exports below. The UI cannot offer a transition the server would
// reject, because both read the same table (AC-41).

export const BATCH_STATUSES: readonly BatchStatus[] = ['Planning', 'Brewing', 'Fermenting', 'Conditioning', 'Completed'];

/**
 * Free status transitions across all batch statuses (Brewfather style).
 * Every valid status can transition to any other valid status without artificial blockers.
 */
export const BATCH_STATUS_TRANSITIONS: Readonly<Record<BatchStatus, readonly BatchStatus[]>> = {
  Planning: BATCH_STATUSES,
  Brewing: BATCH_STATUSES,
  Fermenting: BATCH_STATUSES,
  Conditioning: BATCH_STATUSES,
  Completed: BATCH_STATUSES,
};

/**
 * Total over the union. Returns true for any pair of valid batch statuses,
 * and false for unrecognised values.
 */
export function canTransitionBatchStatus(from: BatchStatus, to: BatchStatus): boolean {
  if (!BATCH_STATUSES.includes(from) || !BATCH_STATUSES.includes(to)) {
    return false;
  }
  return true;
}

/** The exact array of allowed statuses, or [] for an unrecognised `from`. Never null. */
export function allowedNextStatuses(from: BatchStatus): readonly BatchStatus[] {
  if (!BATCH_STATUSES.includes(from)) return [];
  return BATCH_STATUSES;
}
