import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { MashProfileWriteInput, FermentationProfileWriteInput, ProfileInUseDetails } from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import {
  listMashProfiles,
  createMashProfile,
  updateMashProfile,
  deleteMashProfile,
  findRecipesUsingMashProfile,
  listFermentationProfiles,
  createFermentationProfile,
  updateFermentationProfile,
  deleteFermentationProfile,
  findRecipesUsingFermentationProfile,
  type RecipeUsingProfile,
} from '../repositories/scheduleRepository';
import { sendApiError } from '../errors';
import { mashProfileWriteBodySchema, fermentationProfileWriteBodySchema } from './schemas';

/** Shared 409 PROFILE_IN_USE shape for both profile kinds — mirrors equipment.ts's EQUIPMENT_IN_USE precedent. */
function inUseMessage(referencing: RecipeUsingProfile[]): string {
  const blockerNames = referencing.slice(0, 5).map((r) => r.name);
  const namesText = blockerNames.map((n) => `"${n}"`).join(', ');
  return referencing.length === 1
    ? `Cannot delete — still used by recipe ${namesText}.`
    : `Cannot delete — still used by ${referencing.length} recipes, including ${namesText}.`;
}

export function registerScheduleRoutes(app: FastifyInstance, db: Db): void {
  // ---------------------------------------------------------------------
  // Mash profiles
  // ---------------------------------------------------------------------

  app.get('/api/mash-profiles', async () => {
    return listMashProfiles(db);
  });

  app.post<{ Body: MashProfileWriteInput }>(
    '/api/mash-profiles',
    { schema: { body: mashProfileWriteBodySchema } },
    async (request, reply) => {
      const created = createMashProfile(db, randomUUID(), request.body);
      reply.status(201).send(created);
    },
  );

  app.put<{ Params: { id: string }; Body: MashProfileWriteInput }>(
    '/api/mash-profiles/:id',
    { schema: { body: mashProfileWriteBodySchema } },
    async (request, reply) => {
      const updated = updateMashProfile(db, request.params.id, request.body);
      if (!updated) {
        sendApiError(reply, 404, 'NOT_FOUND', `Mash profile not found: ${request.params.id}`);
        return;
      }
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/mash-profiles/:id', async (request, reply) => {
    const { id } = request.params;

    // Checked BEFORE attempting delete — the same guard equipment.ts uses —
    // so a still-referenced profile never reaches the DB's ON DELETE SET
    // NULL backstop; DELETE always blocks rather than detaching (deviation 2).
    const referencing = findRecipesUsingMashProfile(db, id);
    if (referencing.length > 0) {
      const details: ProfileInUseDetails = {
        profileKind: 'mash',
        recipeCount: referencing.length,
        recipeNames: referencing.slice(0, 5).map((r) => r.name),
      };
      sendApiError(reply, 409, 'PROFILE_IN_USE', inUseMessage(referencing), details);
      return;
    }

    const removed = deleteMashProfile(db, id);
    if (!removed) {
      sendApiError(reply, 404, 'NOT_FOUND', `Mash profile not found: ${id}`);
      return;
    }
    reply.status(204).send();
  });

  // ---------------------------------------------------------------------
  // Fermentation profiles
  // ---------------------------------------------------------------------

  app.get('/api/fermentation-profiles', async () => {
    return listFermentationProfiles(db);
  });

  app.post<{ Body: FermentationProfileWriteInput }>(
    '/api/fermentation-profiles',
    { schema: { body: fermentationProfileWriteBodySchema } },
    async (request, reply) => {
      const created = createFermentationProfile(db, randomUUID(), request.body);
      reply.status(201).send(created);
    },
  );

  app.put<{ Params: { id: string }; Body: FermentationProfileWriteInput }>(
    '/api/fermentation-profiles/:id',
    { schema: { body: fermentationProfileWriteBodySchema } },
    async (request, reply) => {
      const updated = updateFermentationProfile(db, request.params.id, request.body);
      if (!updated) {
        sendApiError(reply, 404, 'NOT_FOUND', `Fermentation profile not found: ${request.params.id}`);
        return;
      }
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/fermentation-profiles/:id', async (request, reply) => {
    const { id } = request.params;

    const referencing = findRecipesUsingFermentationProfile(db, id);
    if (referencing.length > 0) {
      const details: ProfileInUseDetails = {
        profileKind: 'fermentation',
        recipeCount: referencing.length,
        recipeNames: referencing.slice(0, 5).map((r) => r.name),
      };
      sendApiError(reply, 409, 'PROFILE_IN_USE', inUseMessage(referencing), details);
      return;
    }

    const removed = deleteFermentationProfile(db, id);
    if (!removed) {
      sendApiError(reply, 404, 'NOT_FOUND', `Fermentation profile not found: ${id}`);
      return;
    }
    reply.status(204).send();
  });
}
