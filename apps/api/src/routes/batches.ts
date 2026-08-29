import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import type { Batch, BatchNoteWriteInput, BatchWriteInput, ClosingSnapshot, ReadingWriteInput, Recipe, RecipeWriteInput } from '@truchabrew/shared-types';
import { calculateRecipeStats, canTransitionBatchStatus, buildClosingSnapshot, peakFermentationTempC } from '@truchabrew/calculations';
import { batchRepository } from '../repositories/batchRepository';
import {
  getStoredRecipeById,
  updateRecipe,
  EquipmentNotFoundError,
  MashProfileNotFoundError,
  FermentationProfileNotFoundError,
  WaterProfileNotFoundError,
} from '../repositories/recipeRepository';
import { sendApiError } from '../errors';
import type { Db } from '../db/client';
import {
  batchCreateBodySchema,
  batchWriteBodySchema,
  batchNoteWriteBodySchema,
  readingWriteBodySchema,
  batchRecipeSnapshotWriteBodySchema,
} from './schemas';

/**
 * The single allow-list this route enforces is `canTransitionBatchStatus`,
 * imported from packages/calculations/src/batchPipeline.ts — the ONE source
 * of truth for batch statuses and their transitions (M5_P1 spec §2.7 /
 * AC-41, widened to five statuses by M5_P2). All five statuses are live:
 * `Planning -> Brewing -> Fermenting -> Conditioning -> Completed`, in that
 * order, one stage at a time; staying on the same status (re-saving
 * measurements without changing status) is always permitted; `Completed` is
 * TERMINAL — no transition leaves it. Every other transition, including any
 * garbage string and reversing to an earlier stage, is 400.
 */

/**
 * PUT /api/batches/:id may never write any of these three keys — all are
 * server-owned. `fermentationStartDate` (M5_P1) and `bottlingDate` (M5_P2)
 * are write-once, set only by their own transition; `closingSnapshot`
 * (M5_P2) is computed only by the route's W1/W2 rule. None of the three
 * exists on `BatchWriteInput` at all (AC-23).
 */
const SERVER_OWNED_BATCH_KEYS = ['fermentationStartDate', 'bottlingDate', 'closingSnapshot'] as const;

/**
 * String-typed fields where Fastify's ajv `coerceTypes: true` default would
 * otherwise silently coerce a submitted `null` into `''` before this route
 * ever sees it — checked here, against the RAW body, before schema
 * validation runs (M3_P1 critic Finding 1 / M5_P1 AC-27 precedent).
 * `tasteNotes` (on a batch PUT) and `note` (on a note POST/PUT) are the only
 * two string fields in this file where `''` is a meaningful, distinct value
 * from a rejected `null` (AC-24/AC-33). `comment` (reading routes) keeps its
 * own pre-existing, narrower check below — unrelated to notes/batches.
 */
const NULL_REJECTING_STRING_KEYS = ['tasteNotes', 'note'] as const;

/**
 * POST/PUT /api/batches/:batchId/notes(/:noteId) may never write either of
 * these two keys — both are server-minted/recorded at creation and never
 * rewritten (M5_P2 spec, Resolved Ambiguities).
 */
const NOTE_SERVER_OWNED_KEYS = ['timestamp', 'status'] as const;

/** True iff `body` is a non-null object carrying the given own key. */
function bodyHasKey(body: unknown, key: string): boolean {
  return typeof body === 'object' && body !== null && key in body;
}

/** True iff `body` carries `key` with the literal value `null`. */
function bodyHasNullForKey(body: unknown, key: string): boolean {
  return bodyHasKey(body, key) && (body as Record<string, unknown>)[key] === null;
}

/**
 * True iff the RAW request body carries `comment: null`. Checked in a
 * `preValidation` hook, before ajv touches the body — Fastify's default ajv
 * options include `coerceTypes: true`, under which ajv coerces a `null`
 * against a `{ type: 'string' }` schema into `''` (any falsy value coerces
 * to that type's zero value), so `comment: null` would otherwise silently
 * become `comment: ''` and pass schema validation. `''` is the deliberate
 * unset value (Resolved Ambiguities) and must stay distinguishable from a
 * rejected `null` — the same class of "schema-only reasoning is unreliable
 * under Fastify's ajv defaults" gap as the `fermentationStartDate` hook
 * above and the M3_P1 critic Finding 1 precedent.
 */
function bodyHasNullComment(body: unknown): boolean {
  return bodyHasNullForKey(body, 'comment');
}

/**
 * Route-level business rule (M5_P1 spec, Resolved Ambiguities): `sg` and
 * `tempC` are both nullable at the schema layer, but a reading with BOTH
 * `null` is meaningless and rejected here — expressing "at least one of two
 * nullable numbers is non-null" in JSON Schema needs an `anyOf` whose
 * failure message is unusable (M3_P1 critic Finding 1 precedent).
 * `readingTime`'s pattern is enforced by the schema; a value that matches the
 * pattern but is not a real instant (e.g. 2026-13-45T00:00:00Z) is caught
 * here, because `Number.isNaN(Date.parse(v))` is the only check that catches
 * it — `format: 'date-time'` is deliberately not relied on (needs
 * ajv-formats, never registered in this repo).
 */
function validateReadingBody(body: ReadingWriteInput): string | null {
  if (Number.isNaN(Date.parse(body.readingTime))) {
    return `"${body.readingTime}" is not a real ISO-8601 UTC instant.`;
  }
  if (body.sg === null && body.tempC === null) {
    return 'A reading must carry at least one of "sg" or "tempC".';
  }
  return null;
}

/**
 * The seven closing-snapshot INPUT fields (M5_P2 spec, Resolved Ambiguities,
 * rule W2). Order matches ClosingSnapshotInput's optional/measured fields.
 */
function closingSnapshotInputsDiffer(existing: Batch, data: BatchWriteInput): boolean {
  return (
    data.measuredOg !== existing.measuredOg ||
    data.measuredFg !== existing.measuredFg ||
    data.measuredPreBoilGravity !== existing.measuredPreBoilGravity ||
    data.measuredBottlingSizeL !== existing.measuredBottlingSizeL ||
    data.carbonationType !== existing.carbonationType ||
    data.carbonationVolumesTarget !== existing.carbonationVolumesTarget ||
    data.carbonationTempC !== existing.carbonationTempC
  );
}

export function registerBatchRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/batches', async () => {
    return batchRepository.findAll(db);
  });

  app.get<{ Params: { id: string } }>('/api/batches/:id', async (request, reply) => {
    const { id } = request.params;
    const batch = await batchRepository.findByIdWithReadings(db, id);
    if (!batch) {
      sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
      return;
    }
    return batch;
  });

  app.post<{ Body: { recipeId: string } }>(
    '/api/batches',
    { schema: { body: batchCreateBodySchema } },
    async (request, reply) => {
      const { recipeId } = request.body;
      const recipe = getStoredRecipeById(db, recipeId);
      if (!recipe) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Recipe not found');
        return;
      }

      const recipeSnapshot = recipe;
      // Computed exactly once, here, against the same frozen snapshot being
      // stored in the same write — never recomputed again (M4_P1 spec
      // AC-12a/c). This is the one and only call site that produces a
      // batch's statsSnapshot.
      const statsSnapshot = calculateRecipeStats(recipeSnapshot);
      const batchNo = await batchRepository.nextBatchNo(db);
      const now = new Date().toISOString();

      const created = await batchRepository.create(
        db,
        randomUUID(),
        batchNo,
        recipeId,
        recipeSnapshot,
        statsSnapshot,
        {
          name: `Batch #${batchNo} - ${recipe.name}`,
          batchNo,
          brewer: null,
          brewDate: null,
          status: 'Planning',
          measuredPreBoilGravity: null,
          measuredMashPh: null,
          measuredBoilSizeL: null,
          measuredBoilTimeMin: null,
          measuredOg: null,
          measuredFg: null,
          measuredBottlingSizeL: null,
          carbonationType: null,
          carbonationVolumesTarget: null,
          carbonationTempC: null,
          tasteNotes: '',
          tasteRating: null,
        },
        now,
      );

      // A brand-new batch has zero readings and zero notes by construction —
      // no query needed to know that (M5_P1 spec §1.4 / M5_P2 spec §1.4).
      reply.status(201).send({ ...created, readings: [], notes: [] });
    },
  );

  app.put<{ Params: { id: string }; Body: BatchWriteInput }>(
    '/api/batches/:id',
    {
      schema: { body: batchWriteBodySchema },
      // Server-owned keys are rejected via a `preValidation` hook — which
      // runs before schema validation/stripping — inspecting the raw body,
      // on the `equipment.ts` AC-22 precedent. Fastify's repo-wide
      // `removeAdditional: true` default (M3_P1 critic Finding 1) means
      // `additionalProperties: false` alone would silently STRIP these keys
      // instead of rejecting them.
      preValidation: async (request, reply) => {
        for (const key of SERVER_OWNED_BATCH_KEYS) {
          if (bodyHasKey(request.body, key)) {
            sendApiError(reply, 400, 'VALIDATION_FAILED', `${key} is server-owned and cannot be set via PUT.`);
            return;
          }
        }
        for (const key of NULL_REJECTING_STRING_KEYS) {
          if (bodyHasNullForKey(request.body, key)) {
            sendApiError(reply, 400, 'VALIDATION_FAILED', `${key} must be a string (use "" for unset), not null.`);
            return;
          }
        }
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = request.body;

      const existing = await batchRepository.findById(db, id);
      if (!existing) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
        return;
      }

      if (!canTransitionBatchStatus(existing.status, data.status)) {
        sendApiError(
          reply,
          400,
          'VALIDATION_FAILED',
          `Cannot transition batch status from "${existing.status}" to "${data.status}".`,
        );
        return;
      }

      // Completion gate (M5_P2 spec, Resolved Ambiguities): ANY write whose
      // resulting status is 'Completed' requires both measuredOg and
      // measuredFg to be non-null — evaluated against the effective
      // post-write (PUT body) values. This also covers a Completed ->
      // Completed re-save that tries to null one of them back out, so the
      // gate cannot be bypassed by first completing and then clearing the
      // value (AC-21's explicit re-save case).
      if (data.status === 'Completed') {
        const missing: string[] = [];
        if (data.measuredOg === null) missing.push('measuredOg');
        if (data.measuredFg === null) missing.push('measuredFg');
        if (missing.length > 0) {
          sendApiError(
            reply,
            400,
            'VALIDATION_FAILED',
            `Cannot complete batch: missing required field(s): ${missing.join(', ')}.`,
          );
          return;
        }
      }

      const now = new Date().toISOString();

      // Set iff this request transitions a batch whose stored
      // fermentationStartDate is null into status 'Fermenting'. By this
      // point the transition is already known-legal.
      const isFirstFermentingEntry = data.status === 'Fermenting' && existing.fermentationStartDate === null;
      const fermentationStartDateOverride = isFirstFermentingEntry ? now : undefined;

      // Set iff this request transitions a batch whose stored bottlingDate
      // is null into status 'Conditioning' — mirrors fermentationStartDate
      // exactly (M5_P2 spec, Resolved Ambiguities).
      const isFirstConditioningEntry = data.status === 'Conditioning' && existing.bottlingDate === null;
      const bottlingDateOverride = isFirstConditioningEntry ? now : undefined;

      // W1: the write's resulting status is 'Completed' and the stored
      // closingSnapshot is null (the completing write itself).
      // W2: the stored status is already 'Completed' and at least one
      // closing-snapshot INPUT differs from its stored value.
      const isCompletingWrite = data.status === 'Completed' && existing.closingSnapshot === null;
      const isCorrectionOnClosedBatch = existing.status === 'Completed' && closingSnapshotInputsDiffer(existing, data);

      let closingSnapshotOverride: ClosingSnapshot | undefined;
      if (isCompletingWrite || isCorrectionOnClosedBatch) {
        // Non-null by the completion gate above (data.status === 'Completed'
        // is guaranteed here, in both the W1 and W2 cases).
        const readings = await batchRepository.listReadings(db, id);
        closingSnapshotOverride = buildClosingSnapshot({
          frozenAt: now,
          measuredOg: data.measuredOg as number,
          measuredFg: data.measuredFg as number,
          measuredPreBoilGravity: data.measuredPreBoilGravity,
          measuredBottlingSizeL: data.measuredBottlingSizeL,
          recipeSnapshot: existing.recipeSnapshot,
          peakFermentationTempC: peakFermentationTempC(readings),
          carbonationType: data.carbonationType,
          carbonationVolumesTarget: data.carbonationVolumesTarget,
          carbonationTempC: data.carbonationTempC,
        });
      }

      const updated = await batchRepository.update(
        db,
        id,
        data,
        now,
        fermentationStartDateOverride,
        bottlingDateOverride,
        closingSnapshotOverride,
      );
      if (!updated) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
        return;
      }

      // 200 BatchWithReadings (M5_P1 spec §1.4 / M5_P2 spec §1.4) — this PUT
      // never touches readings or notes itself, so they are simply
      // re-attached, not recomputed.
      const readings = await batchRepository.listReadings(db, id);
      const notes = await batchRepository.listNotes(db, id);
      return { ...updated, readings, notes };
    },
  );

  // -----------------------------------------------------------------------
  // In-batch recipe adjustment (M15_P1 spec §2.1/§3.2). Overwrites ONLY this
  // batch's frozen recipeSnapshot/statsSnapshot — the master recipe library
  // entry is untouched UNLESS the caller opts into `syncToMasterRecipe`.
  //
  // JUDGMENT CALL flagged for critic review: spec §3.2 names the sync call
  // site as `updateStoredRecipe(db, recipeSnapshot.id, recipeSnapshot)`, but
  // no such function exists anywhere in this repo (verified against
  // repositories/recipeRepository.ts's full export list). The actual
  // repository function is `updateRecipe(db, id, input: RecipeWriteInput)`,
  // whose input shape is structurally different from `StoredRecipe`
  // (`equipmentId`/`mashProfileId`/`fermentationProfileId` string FKs
  // instead of the hydrated `equipment`/`mashProfile`/`fermentationProfile`
  // objects `StoredRecipe extends Recipe` carries). `toRecipeWriteInput`
  // below performs the mechanical field-by-field translation so the sync
  // path is not silently dropped; nothing about this translation depends on
  // the batch's substitution intent, so no ambiguity in the SUBSTITUTION
  // itself is being resolved here — only the spec's wrong function name.
  // -----------------------------------------------------------------------

  function toRecipeWriteInput(recipe: Recipe): RecipeWriteInput {
    return {
      name: recipe.name,
      author: recipe.author,
      styleName: recipe.styleName,
      notes: recipe.notes,
      equipmentId: recipe.equipment.id,
      fermentables: recipe.fermentables,
      hops: recipe.hops,
      yeasts: recipe.yeasts,
      miscs: recipe.miscs,
      mashProfileId: recipe.mashProfile?.id ?? null,
      fermentationProfileId: recipe.fermentationProfile?.id ?? null,
      waterSourceId: recipe.waterSourceId ?? null,
      waterTargetId: recipe.waterTargetId ?? null,
    };
  }

  app.put<{ Params: { id: string }; Body: { recipeSnapshot: Recipe; syncToMasterRecipe?: boolean } }>(
    '/api/batches/:id/recipe-snapshot',
    { schema: { body: batchRecipeSnapshotWriteBodySchema } },
    async (request, reply) => {
      const { id } = request.params;
      const { recipeSnapshot, syncToMasterRecipe } = request.body;

      const existing = await batchRepository.findById(db, id);
      if (!existing) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
        return;
      }

      const statsSnapshot = calculateRecipeStats(recipeSnapshot);
      const now = new Date().toISOString();

      const updated = await batchRepository.updateRecipeSnapshot(db, id, recipeSnapshot, statsSnapshot, now);
      if (!updated) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
        return;
      }

      // NOTE: this batch write and the optional sync write below are NOT
      // wrapped in a shared transaction (batchRepository is drizzle/async;
      // recipeRepository is better-sqlite3/sync) — if the sync write below
      // fails, the batch's own recipeSnapshot update has already committed.
      // Flagged for critic review alongside the updateStoredRecipe naming
      // deviation noted above.
      if (syncToMasterRecipe === true) {
        try {
          const syncedRecipe = updateRecipe(db, recipeSnapshot.id, toRecipeWriteInput(recipeSnapshot));
          if (!syncedRecipe) {
            // recipeSnapshot.id doesn't resolve to any master recipe row —
            // this batch's own snapshot write above already committed, but
            // reporting 200 here would tell the caller the sync succeeded
            // when nothing was written. Mirrors the same 404 NOT_FOUND
            // convention recipes.ts uses for a missing update target.
            sendApiError(reply, 404, 'NOT_FOUND', `Batch recipe snapshot saved, but master recipe sync failed: recipe not found: ${recipeSnapshot.id}`);
            return;
          }
        } catch (err) {
          if (
            err instanceof EquipmentNotFoundError ||
            err instanceof MashProfileNotFoundError ||
            err instanceof FermentationProfileNotFoundError ||
            err instanceof WaterProfileNotFoundError
          ) {
            sendApiError(reply, 400, 'VALIDATION_FAILED', `Batch recipe snapshot saved, but master recipe sync failed: ${err.message}`);
            return;
          }
          throw err;
        }
      }

      const readings = await batchRepository.listReadings(db, id);
      const notes = await batchRepository.listNotes(db, id);
      return { ...updated, readings, notes };
    },
  );

  // M13_P1 Amendment 2 (spec §3.5.1) — a batch is a leaf in the reference
  // graph (nothing FKs to batches.id except the two cascade children handled
  // at the DB level), so there is no in-use guard and no 409 branch: a batch
  // is deletable in ANY lifecycle status, including 'Completed'. Deleting
  // the same id twice yields 204 then 404 (idempotency is NOT treated as
  // success on the repeat call).
  app.delete<{ Params: { id: string } }>('/api/batches/:id', async (request, reply) => {
    const { id } = request.params;
    const removed = await batchRepository.deleteBatch(db, id);
    if (!removed) {
      sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
      return;
    }
    reply.status(204).send();
  });

  // ---------------------------------------------------------------------
  // Readings (M5_P1). Per-item endpoints, not full-replace (spec §4
  // deviation 5) — see batchRepository.ts. readingId is scoped to its
  // batchId; a readingId that exists but belongs to a different batch is
  // 404, never a cross-batch write (AC-22). Deliberately unchanged by
  // M5_P2 — reading writes never touch closing_snapshot (M5_P2 spec,
  // Resolved Ambiguities): a reading logged after a batch's close cannot
  // retroactively change the priming sugar that was actually used.
  // ---------------------------------------------------------------------

  app.post<{ Params: { batchId: string }; Body: ReadingWriteInput }>(
    '/api/batches/:batchId/readings',
    {
      schema: { body: readingWriteBodySchema },
      preValidation: async (request, reply) => {
        if (bodyHasNullComment(request.body)) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', 'comment must be a string (use "" for unset), not null.');
        }
      },
    },
    async (request, reply) => {
      const { batchId } = request.params;
      const body = request.body;

      const batch = await batchRepository.findById(db, batchId);
      if (!batch) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
        return;
      }

      const validationError = validateReadingBody(body);
      if (validationError) {
        sendApiError(reply, 400, 'VALIDATION_FAILED', validationError);
        return;
      }

      const created = await batchRepository.createReading(db, randomUUID(), batchId, body);
      reply.status(201).send(created);
    },
  );

  app.put<{ Params: { batchId: string; readingId: string }; Body: ReadingWriteInput }>(
    '/api/batches/:batchId/readings/:readingId',
    {
      schema: { body: readingWriteBodySchema },
      preValidation: async (request, reply) => {
        if (bodyHasNullComment(request.body)) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', 'comment must be a string (use "" for unset), not null.');
        }
      },
    },
    async (request, reply) => {
      const { batchId, readingId } = request.params;
      const body = request.body;

      const validationError = validateReadingBody(body);
      if (validationError) {
        sendApiError(reply, 400, 'VALIDATION_FAILED', validationError);
        return;
      }

      const updated = await batchRepository.updateReading(db, batchId, readingId, body);
      if (!updated) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Reading not found');
        return;
      }
      return updated;
    },
  );

  app.delete<{ Params: { batchId: string; readingId: string } }>(
    '/api/batches/:batchId/readings/:readingId',
    async (request, reply) => {
      const { batchId, readingId } = request.params;
      const removed = await batchRepository.deleteReading(db, batchId, readingId);
      if (!removed) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Reading not found');
        return;
      }
      reply.status(204).send();
    },
  );

  // ---------------------------------------------------------------------
  // Notes (M5_P2). Per-item endpoints. `timestamp` and `status` are
  // server-minted/recorded at creation from the server clock and the
  // batch's stored status, never accepted from a client and never rewritten
  // by an edit. noteId is scoped to its batchId — a noteId that exists but
  // belongs to a different batch is 404, never a cross-batch write (AC-32).
  // ---------------------------------------------------------------------

  app.post<{ Params: { batchId: string }; Body: BatchNoteWriteInput }>(
    '/api/batches/:batchId/notes',
    {
      schema: { body: batchNoteWriteBodySchema },
      preValidation: async (request, reply) => {
        for (const key of NOTE_SERVER_OWNED_KEYS) {
          if (bodyHasKey(request.body, key)) {
            sendApiError(reply, 400, 'VALIDATION_FAILED', `${key} is server-owned and cannot be set via POST.`);
            return;
          }
        }
        if (bodyHasNullForKey(request.body, 'note')) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', 'note must be a string, not null.');
        }
      },
    },
    async (request, reply) => {
      const { batchId } = request.params;
      const batch = await batchRepository.findById(db, batchId);
      if (!batch) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
        return;
      }

      const now = new Date().toISOString();
      const created = await batchRepository.createNote(db, randomUUID(), batchId, now, batch.status, request.body);
      reply.status(201).send(created);
    },
  );

  app.put<{ Params: { batchId: string; noteId: string }; Body: BatchNoteWriteInput }>(
    '/api/batches/:batchId/notes/:noteId',
    {
      schema: { body: batchNoteWriteBodySchema },
      preValidation: async (request, reply) => {
        for (const key of NOTE_SERVER_OWNED_KEYS) {
          if (bodyHasKey(request.body, key)) {
            sendApiError(reply, 400, 'VALIDATION_FAILED', `${key} is server-owned and cannot be set via PUT.`);
            return;
          }
        }
        if (bodyHasNullForKey(request.body, 'note')) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', 'note must be a string, not null.');
        }
      },
    },
    async (request, reply) => {
      const { batchId, noteId } = request.params;
      const updated = await batchRepository.updateNote(db, batchId, noteId, request.body);
      if (!updated) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Note not found');
        return;
      }
      return updated;
    },
  );

  app.delete<{ Params: { batchId: string; noteId: string } }>(
    '/api/batches/:batchId/notes/:noteId',
    async (request, reply) => {
      const { batchId, noteId } = request.params;
      const removed = await batchRepository.deleteNote(db, batchId, noteId);
      if (!removed) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Note not found');
        return;
      }
      reply.status(204).send();
    },
  );
}
