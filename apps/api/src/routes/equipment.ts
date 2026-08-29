import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { EquipmentCreateInput, EquipmentUpdateInput, EquipmentInUseDetails } from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import {
  listEquipmentProfiles,
  createEquipmentProfile,
  findExistingDerivedProfile,
  updateEquipmentProfile,
  deleteEquipmentProfile,
  findRecipesUsingEquipment,
} from '../repositories/equipmentRepository';
import { sendApiError } from '../errors';
import { equipmentCreateBodySchema, equipmentUpdateBodySchema } from './schemas';

export function registerEquipmentRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/equipment-profiles', async () => {
    return listEquipmentProfiles(db);
  });

  app.post<{ Body: EquipmentCreateInput }>(
    '/api/equipment-profiles',
    { schema: { body: equipmentCreateBodySchema } },
    async (request, reply) => {
      const input = request.body;

      // Reuse an existing derived profile rather than accumulating
      // duplicates: same derivedFromEquipmentId + batchSizeL within 1e-9
      // (see M2_P1 spec, Resolved Ambiguities). Only applies to
      // scale-derived profiles (derivedFromEquipmentId set) — plain
      // equipment creates always insert a new row.
      if (input.derivedFromEquipmentId) {
        const existing = findExistingDerivedProfile(db, input.derivedFromEquipmentId, input.batchSizeL);
        if (existing) {
          reply.status(201).send(existing);
          return;
        }
      }

      const created = createEquipmentProfile(db, randomUUID(), input);
      reply.status(201).send(created);
    },
  );

  app.put<{ Params: { id: string }; Body: EquipmentUpdateInput }>(
    '/api/equipment-profiles/:id',
    {
      schema: { body: equipmentUpdateBodySchema },
      // Fastify's default ajv options set `removeAdditional: true` (see
      // @fastify/ajv-compiler's default-ajv-options.js — server.ts does not
      // override it and is out of scope to touch this phase). That makes
      // `additionalProperties: false` alone SILENTLY STRIP an unrecognised
      // property rather than reject it, which would let a client's
      // `derivedFromEquipmentId` vanish quietly instead of failing loudly —
      // the opposite of AC-22's contract. preValidation runs before schema
      // validation/stripping, so the raw body is inspected here first.
      preValidation: async (request, reply) => {
        const body = request.body;
        if (body && typeof body === 'object' && 'derivedFromEquipmentId' in body) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', 'derivedFromEquipmentId is server-owned and cannot be set via PUT.');
        }
      },
    },
    async (request, reply) => {
      const updated = updateEquipmentProfile(db, request.params.id, request.body);
      if (!updated) {
        sendApiError(reply, 404, 'NOT_FOUND', `Equipment profile not found: ${request.params.id}`);
        return;
      }
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/equipment-profiles/:id', async (request, reply) => {
    const { id } = request.params;

    // Checked BEFORE attempting delete so a still-referenced profile never
    // reaches the DB layer's ON DELETE RESTRICT edge — that would surface as
    // a raw SQLite constraint error (500) rather than a clean 409.
    const referencing = findRecipesUsingEquipment(db, id);
    if (referencing.length > 0) {
      const blockerNames = referencing.slice(0, 5).map((r) => r.name);
      const details: EquipmentInUseDetails = {
        recipeCount: referencing.length,
        recipeNames: blockerNames,
      };
      // Named directly in the message (not just `details`) so a client that
      // only surfaces `error.message` still shows the user which recipe(s)
      // are blocking the delete.
      const namesText = blockerNames.map((n) => `"${n}"`).join(', ');
      const message =
        referencing.length === 1
          ? `Cannot delete — still used by recipe ${namesText}.`
          : `Cannot delete — still used by ${referencing.length} recipes, including ${namesText}.`;
      sendApiError(reply, 409, 'EQUIPMENT_IN_USE', message, details);
      return;
    }

    const removed = deleteEquipmentProfile(db, id);
    if (!removed) {
      sendApiError(reply, 404, 'NOT_FOUND', `Equipment profile not found: ${id}`);
      return;
    }
    reply.status(204).send();
  });
}
