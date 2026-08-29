import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import type {
  InventoryItem,
  InventoryWriteInput,
  InventoryDuplicateDetails,
  InventoryCategory,
  StockEvaluation,
  CheckoffWriteInput,
  BatchCheckoffState,
  InventoryTransaction,
} from '@truchabrew/shared-types';
import {
  normalizeInventoryName,
  isValidInventoryUnit,
  requirementsFromRecipe,
  evaluateStock,
  INVENTORY_CATEGORIES,
  evaluateCheckoff,
  batchCostBreakdown,
} from '@truchabrew/calculations';
import type { Db } from '../db/client';
import {
  listInventory,
  findInventoryById,
  findInventoryByCategoryAndNameKey,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '../repositories/inventoryRepository';
import { listTransactionsForBatch, insertTransaction } from '../repositories/inventoryTransactionRepository';
import { batchRepository } from '../repositories/batchRepository';
import { sendApiError } from '../errors';
import { inventoryWriteBodySchema, checkoffWriteBodySchema } from './schemas';

/**
 * POST/PUT /api/inventory may never write any of these four keys — all are
 * server-owned. None exists on InventoryWriteInput at all. Checked in a
 * `preValidation` hook against the RAW body — which runs before schema
 * validation/stripping — on the `routes/batches.ts` SERVER_OWNED_BATCH_KEYS
 * precedent (M3_P1 critic Finding 1): Fastify's repo-wide
 * `removeAdditional: true` default means `additionalProperties: false` alone
 * would silently STRIP these keys instead of rejecting them.
 */
const INVENTORY_SERVER_OWNED_KEYS = ['id', 'nameKey', 'createdAt', 'updatedAt'] as const;

/**
 * `notes: null` would otherwise be silently coerced to `''` by Fastify's
 * `coerceTypes: true` default before this route ever sees it — the
 * `NULL_REJECTING_STRING_KEYS` precedent (routes/batches.ts). `''` is the
 * meaningful unset value and must stay distinguishable from a rejected `null`.
 */
const INVENTORY_NULL_REJECTING_STRING_KEYS = ['notes'] as const;

function bodyHasKey(body: unknown, key: string): boolean {
  return typeof body === 'object' && body !== null && key in body;
}

function bodyHasNullForKey(body: unknown, key: string): boolean {
  return bodyHasKey(body, key) && (body as Record<string, unknown>)[key] === null;
}

/**
 * True iff `value` matches `'YYYY-MM-DD'` AND is a real calendar date
 * (Resolved Ambiguity 7 — `2026-02-30` is a 400, `2026-02-28` is a 201). The
 * schema already enforces the pattern shape; this catches the
 * pattern-valid-but-unreal case. `Date.parse` (the `readingTime` precedent in
 * routes/batches.ts) does NOT apply directly here — ISO date-ONLY strings are
 * silently rolled over by `Date.parse`/`new Date(...)` rather than rejected
 * (verified against this repo's own runtime), so the calendar check is done
 * by hand: constructing the UTC date from the parsed components and checking
 * it round-trips to the same year/month/day.
 */
function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Cross-field business rules the JSON schema cannot express alone. */
function validateInventoryBody(body: InventoryWriteInput): string | null {
  if (!isValidInventoryUnit(body.category, body.unit)) {
    return `"${body.unit}" is not a valid unit for category "${body.category}".`;
  }
  if (body.purchaseDate !== null && !isRealCalendarDate(body.purchaseDate)) {
    return `"${body.purchaseDate}" is not a real calendar date.`;
  }
  if (body.expiryDate !== null && !isRealCalendarDate(body.expiryDate)) {
    return `"${body.expiryDate}" is not a real calendar date.`;
  }
  return null;
}

function duplicateDetails(existing: InventoryItem): InventoryDuplicateDetails {
  return { existingId: existing.id, category: existing.category, nameKey: existing.nameKey, existingName: existing.name };
}

/**
 * `inventoryItemId` is the ONLY client-writable key on either checkoff
 * body (Resolved Ambiguity 8). A raw-body preValidation hook rejects any
 * other key with 400 VALIDATION_FAILED naming it — same reasoning as
 * INVENTORY_SERVER_OWNED_KEYS above: `additionalProperties: false` alone is
 * inert under Fastify's repo-wide `removeAdditional: true` default.
 */
function checkoffExtraKeyError(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (key !== 'inventoryItemId') return key;
  }
  return null;
}

/**
 * Builds the recomputed `BatchCheckoffState` for a batch — the single
 * function both `GET /checkoff` and both `POST` checkoff routes call, so the
 * lockstep contract (§2.3 point 4) is backed by one code path, not two that
 * could drift. `null` batch/recipeSnapshot has already been checked by the
 * caller.
 */
function computeCheckoffState(db: Db, batchId: string, recipeSnapshot: Parameters<typeof requirementsFromRecipe>[0], status: BatchCheckoffState['stage']): BatchCheckoffState {
  const requirements = requirementsFromRecipe(recipeSnapshot);
  const inventory = listInventory(db);
  const evaluation: StockEvaluation = evaluateStock(requirements, inventory);
  const ledger = listTransactionsForBatch(db, batchId);
  return evaluateCheckoff(evaluation, ledger, status);
}

export function registerInventoryRoutes(app: FastifyInstance, db: Db): void {
  // GET /api/inventory — category/outOfStock filters combine with AND
  // (AC-26). Default order: category (INVENTORY_CATEGORIES order), then
  // nameKey ascending (AC-18) — implemented in the repository.
  app.get<{ Querystring: { category?: string; outOfStock?: string } }>('/api/inventory', async (request, reply) => {
    const { category, outOfStock } = request.query;

    let categoryFilter: InventoryCategory | undefined;
    if (category !== undefined) {
      if (!(INVENTORY_CATEGORIES as readonly string[]).includes(category)) {
        sendApiError(reply, 400, 'VALIDATION_FAILED', `"${category}" is not a valid inventory category.`);
        return;
      }
      categoryFilter = category as InventoryCategory;
    }

    let outOfStockFilter: boolean | undefined;
    if (outOfStock !== undefined) {
      if (outOfStock !== 'true' && outOfStock !== 'false') {
        sendApiError(reply, 400, 'VALIDATION_FAILED', `"${outOfStock}" is not a valid outOfStock value — use "true" or "false".`);
        return;
      }
      outOfStockFilter = outOfStock === 'true';
    }

    return listInventory(db, { category: categoryFilter, outOfStock: outOfStockFilter });
  });

  app.post<{ Body: InventoryWriteInput }>(
    '/api/inventory',
    {
      schema: { body: inventoryWriteBodySchema },
      preValidation: async (request, reply) => {
        for (const key of INVENTORY_SERVER_OWNED_KEYS) {
          if (bodyHasKey(request.body, key)) {
            sendApiError(reply, 400, 'VALIDATION_FAILED', `${key} is server-owned and cannot be set via POST.`);
            return;
          }
        }
        for (const key of INVENTORY_NULL_REJECTING_STRING_KEYS) {
          if (bodyHasNullForKey(request.body, key)) {
            sendApiError(reply, 400, 'VALIDATION_FAILED', `${key} must be a string (use "" for unset), not null.`);
            return;
          }
        }
      },
    },
    async (request, reply) => {
      const body = request.body;
      const validationError = validateInventoryBody(body);
      if (validationError) {
        sendApiError(reply, 400, 'VALIDATION_FAILED', validationError);
        return;
      }

      const trimmedName = body.name.trim();
      const nameKey = normalizeInventoryName(trimmedName);
      const existing = findInventoryByCategoryAndNameKey(db, body.category, nameKey);
      if (existing) {
        sendApiError(
          reply,
          409,
          'INVENTORY_DUPLICATE',
          `An inventory item named "${existing.name}" already exists in category "${existing.category}".`,
          duplicateDetails(existing),
        );
        return;
      }

      const now = new Date().toISOString();
      const created = createInventoryItem(db, randomUUID(), body, now);
      reply.status(201).send(created);
    },
  );

  app.put<{ Params: { id: string }; Body: InventoryWriteInput }>(
    '/api/inventory/:id',
    {
      schema: { body: inventoryWriteBodySchema },
      preValidation: async (request, reply) => {
        for (const key of INVENTORY_SERVER_OWNED_KEYS) {
          if (bodyHasKey(request.body, key)) {
            sendApiError(reply, 400, 'VALIDATION_FAILED', `${key} is server-owned and cannot be set via PUT.`);
            return;
          }
        }
        for (const key of INVENTORY_NULL_REJECTING_STRING_KEYS) {
          if (bodyHasNullForKey(request.body, key)) {
            sendApiError(reply, 400, 'VALIDATION_FAILED', `${key} must be a string (use "" for unset), not null.`);
            return;
          }
        }
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const validationError = validateInventoryBody(body);
      if (validationError) {
        sendApiError(reply, 400, 'VALIDATION_FAILED', validationError);
        return;
      }

      const existingItem = findInventoryById(db, id);
      if (!existingItem) {
        sendApiError(reply, 404, 'NOT_FOUND', `Inventory item not found: ${id}`);
        return;
      }

      const trimmedName = body.name.trim();
      const nameKey = normalizeInventoryName(trimmedName);
      const colliding = findInventoryByCategoryAndNameKey(db, body.category, nameKey);
      if (colliding && colliding.id !== id) {
        sendApiError(
          reply,
          409,
          'INVENTORY_DUPLICATE',
          `An inventory item named "${colliding.name}" already exists in category "${colliding.category}".`,
          duplicateDetails(colliding),
        );
        return;
      }

      const now = new Date().toISOString();
      const updated = updateInventoryItem(db, id, body, now);
      if (!updated) {
        sendApiError(reply, 404, 'NOT_FOUND', `Inventory item not found: ${id}`);
        return;
      }
      return updated;
    },
  );

  // Unconditional delete — no *_IN_USE guard (Resolved Ambiguity 9). Nothing
  // points at an inventory row via FK; the only observable consequence is
  // that a stock-check line that was matched:true becomes matched:false on
  // the next call (AC-25).
  app.delete<{ Params: { id: string } }>('/api/inventory/:id', async (request, reply) => {
    const { id } = request.params;
    const removed = deleteInventoryItem(db, id);
    if (!removed) {
      sendApiError(reply, 404, 'NOT_FOUND', `Inventory item not found: ${id}`);
      return;
    }
    reply.status(204).send();
  });

  // ---------------------------------------------------------------------
  // Stock check (Resolved Ambiguity 8) — GET /api/batches/:batchId/stock-check
  // is registered HERE, not in routes/batches.ts, so that 472-line,
  // verification-clean file stays byte-identical this phase. Requirements
  // come from the batch's FROZEN recipeSnapshot — never the live recipe;
  // availability comes from the inventory table as it is right now. Strictly
  // read-only: this handler never writes to any table (AC-29).
  // ---------------------------------------------------------------------

  app.get<{ Params: { batchId: string } }>('/api/batches/:batchId/stock-check', async (request, reply) => {
    const { batchId } = request.params;
    const batch = await batchRepository.findById(db, batchId);
    if (!batch) {
      sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
      return;
    }

    const requirements = requirementsFromRecipe(batch.recipeSnapshot);
    const inventory = listInventory(db);
    const evaluation: StockEvaluation = evaluateStock(requirements, inventory);
    return evaluation;
  });

  // ---------------------------------------------------------------------
  // Checkoff (M9_P2) — the append-only ledger's write path, plus the
  // checkoff/cost read views. All four registered HERE, inside
  // registerInventoryRoutes, on the same Resolved Ambiguity 8/10 precedent
  // as stock-check above — routes/batches.ts and server.ts stay untouched.
  // ---------------------------------------------------------------------

  app.get<{ Params: { batchId: string } }>('/api/batches/:batchId/checkoff', async (request, reply) => {
    const { batchId } = request.params;
    const batch = await batchRepository.findById(db, batchId);
    if (!batch) {
      sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
      return;
    }
    return computeCheckoffState(db, batchId, batch.recipeSnapshot, batch.status);
  });

  app.get<{ Params: { batchId: string } }>('/api/batches/:batchId/cost', async (request, reply) => {
    const { batchId } = request.params;
    const batch = await batchRepository.findById(db, batchId);
    if (!batch) {
      sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
      return;
    }
    const ledger = listTransactionsForBatch(db, batchId);
    return batchCostBreakdown(ledger);
  });

  app.post<{ Params: { batchId: string }; Body: CheckoffWriteInput }>(
    '/api/batches/:batchId/checkoff',
    {
      schema: { body: checkoffWriteBodySchema },
      preValidation: async (request, reply) => {
        const extraKey = checkoffExtraKeyError(request.body);
        if (extraKey) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', `"${extraKey}" is not a recognized field on this request.`);
        }
      },
    },
    async (request, reply) => {
      const { batchId } = request.params;
      const { inventoryItemId } = request.body;

      const batch = await batchRepository.findById(db, batchId);
      if (!batch) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
        return;
      }
      if (batch.status !== 'Planning') {
        sendApiError(reply, 409, 'CHECKOFF_STAGE_INVALID', `Cannot check off an ingredient while the batch is "${batch.status}".`);
        return;
      }

      const item = findInventoryById(db, inventoryItemId);
      if (!item) {
        sendApiError(reply, 404, 'NOT_FOUND', `Inventory item not found: ${inventoryItemId}`);
        return;
      }

      const requirements = requirementsFromRecipe(batch.recipeSnapshot);
      const requirement = requirements.find((r) => r.category === item.category && r.nameKey === item.nameKey);
      if (!requirement || requirement.unit !== item.unit) {
        sendApiError(reply, 409, 'CHECKOFF_NOT_COMPARABLE', `"${item.name}" does not comparably match a requirement on this batch's recipe.`);
        return;
      }

      const ledger = listTransactionsForBatch(db, batchId);
      const alreadyOpen = ledger.some(
        (row) => row.kind === 'deduction' && row.inventoryItemId === inventoryItemId && !ledger.some((r) => r.kind === 'reversal' && r.reversesTransactionId === row.id),
      );
      if (alreadyOpen) {
        sendApiError(reply, 409, 'CHECKOFF_ALREADY_OPEN', `"${item.name}" is already checked off on this batch.`);
        return;
      }

      const now = new Date().toISOString();
      const transaction: InventoryTransaction = {
        id: randomUUID(),
        batchId,
        inventoryItemId,
        kind: 'deduction',
        reversesTransactionId: null,
        category: item.category,
        displayName: item.name,
        nameKey: item.nameKey,
        amount: requirement.requiredAmount,
        unit: requirement.unit,
        costPerUnit: item.costPerUnit,
        createdAt: now,
      };
      insertTransaction(db, transaction);

      reply.status(201).send(computeCheckoffState(db, batchId, batch.recipeSnapshot, batch.status));
    },
  );

  app.post<{ Params: { batchId: string }; Body: CheckoffWriteInput }>(
    '/api/batches/:batchId/checkoff/reverse',
    {
      schema: { body: checkoffWriteBodySchema },
      preValidation: async (request, reply) => {
        const extraKey = checkoffExtraKeyError(request.body);
        if (extraKey) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', `"${extraKey}" is not a recognized field on this request.`);
        }
      },
    },
    async (request, reply) => {
      const { batchId } = request.params;
      const { inventoryItemId } = request.body;

      const batch = await batchRepository.findById(db, batchId);
      if (!batch) {
        sendApiError(reply, 404, 'NOT_FOUND', 'Batch not found');
        return;
      }
      if (batch.status !== 'Planning') {
        sendApiError(reply, 409, 'CHECKOFF_STAGE_INVALID', `Cannot reverse a checkoff while the batch is "${batch.status}".`);
        return;
      }

      const ledger = listTransactionsForBatch(db, batchId);
      const openDeduction = ledger.find(
        (row) => row.kind === 'deduction' && row.inventoryItemId === inventoryItemId && !ledger.some((r) => r.kind === 'reversal' && r.reversesTransactionId === row.id),
      );
      if (!openDeduction) {
        sendApiError(reply, 409, 'CHECKOFF_NOT_OPEN', `No open checkoff for inventory item ${inventoryItemId} on this batch.`);
        return;
      }

      const now = new Date().toISOString();
      const reversal: InventoryTransaction = {
        id: randomUUID(),
        batchId,
        inventoryItemId,
        kind: 'reversal',
        reversesTransactionId: openDeduction.id,
        category: openDeduction.category,
        displayName: openDeduction.displayName,
        nameKey: openDeduction.nameKey,
        amount: openDeduction.amount,
        unit: openDeduction.unit,
        costPerUnit: openDeduction.costPerUnit,
        createdAt: now,
      };
      insertTransaction(db, reversal);

      reply.status(201).send(computeCheckoffState(db, batchId, batch.recipeSnapshot, batch.status));
    },
  );
}
