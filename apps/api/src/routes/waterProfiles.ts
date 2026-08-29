import type { FastifyInstance } from 'fastify';
import type { WaterProfileInput, WaterProfileInUseDetails } from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import {
  listWaterProfiles,
  createWaterProfile,
  updateWaterProfile,
  deleteWaterProfile,
  findRecipesUsingWaterProfile,
} from '../repositories/waterProfileRepository';
import { sendApiError } from '../errors';
import { waterProfileWriteBodySchema } from './schemas';

export function registerWaterProfileRoutes(app: FastifyInstance, db: Db): void {
  // AC-9: GET /api/water-profiles — returns all water profiles with status 200
  app.get('/api/water-profiles', async () => {
    return listWaterProfiles(db);
  });

  // AC-10: POST /api/water-profiles — validation: missing name or negative ions → 400
  app.post<{ Body: WaterProfileInput }>(
    '/api/water-profiles',
    { schema: { body: waterProfileWriteBodySchema } },
    async (request, reply) => {
      const created = createWaterProfile(db, request.body);
      reply.status(201).send(created);
    },
  );

  // AC-11: PUT /api/water-profiles/:id — update and return with 200
  app.put<{ Params: { id: string }; Body: WaterProfileInput }>(
    '/api/water-profiles/:id',
    { schema: { body: waterProfileWriteBodySchema } },
    async (request, reply) => {
      const updated = updateWaterProfile(db, request.params.id, request.body);
      if (!updated) {
        sendApiError(reply, 404, 'NOT_FOUND', `Water profile not found: ${request.params.id}`);
        return;
      }
      return updated;
    },
  );

  // AC-12: DELETE /api/water-profiles/:id — in-use guard → 409 WATER_PROFILE_IN_USE
  app.delete<{ Params: { id: string } }>('/api/water-profiles/:id', async (request, reply) => {
    const { id } = request.params;

    // Checked BEFORE attempting delete — same guard pattern as equipment/schedule/recipe.
    const referencing = findRecipesUsingWaterProfile(db, id);
    if (referencing.length > 0) {
      const blockerNames = referencing.slice(0, 5).map((r) => r.name);
      const details: WaterProfileInUseDetails = {
        recipeCount: referencing.length,
        recipeNames: blockerNames,
      };
      const namesText = blockerNames.map((n) => `"${n}"`).join(', ');
      const message =
        referencing.length === 1
          ? `Cannot delete — still used by recipe ${namesText}.`
          : `Cannot delete — still used by ${referencing.length} recipes, including ${namesText}.`;
      sendApiError(reply, 409, 'WATER_PROFILE_IN_USE', message, details);
      return;
    }

    const removed = deleteWaterProfile(db, id);
    if (!removed) {
      sendApiError(reply, 404, 'NOT_FOUND', `Water profile not found: ${id}`);
      return;
    }
    reply.status(204).send();
  });
}
