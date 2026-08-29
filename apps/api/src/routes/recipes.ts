import type { FastifyInstance } from 'fastify';
import type { RecipeWriteInput, RecipeInUseDetails, RecipeImportResponse, StoredRecipe } from '@truchabrew/shared-types';
import { parseBrewfatherJson } from '@truchabrew/calculations';
import type { Db } from '../db/client';
import {
  listRecipeSummaries,
  getStoredRecipeById,
  createRecipe,
  updateRecipe,
  patchRecipeName,
  duplicateRecipe,
  deleteRecipe,
  findBatchesUsingRecipe,
  EquipmentNotFoundError,
  MashProfileNotFoundError,
  FermentationProfileNotFoundError,
  WaterProfileNotFoundError,
} from '../repositories/recipeRepository';
import { listEquipmentProfiles } from '../repositories/equipmentRepository';
import { sendApiError } from '../errors';
import { recipeWriteBodySchema, recipePatchNameBodySchema } from './schemas';

export function registerRecipeRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Querystring: { q?: string } }>('/api/recipes', async (request) => {
    return listRecipeSummaries(db, request.query.q);
  });

  app.post<{ Body: unknown; Querystring: { equipmentId?: string } }>(
    '/api/recipes/import/brewfather',
    async (request, reply) => {
      try {
        let equipmentId = request.query.equipmentId;
        if (!equipmentId) {
          const profiles = listEquipmentProfiles(db);
          if (profiles.length === 0) {
            sendApiError(reply, 400, 'EQUIPMENT_NOT_FOUND', 'No equipment profiles exist to assign imported recipes to.');
            return;
          }
          equipmentId = profiles[0].id;
        }

        const body = request.body;
        let recipeInputs: RecipeWriteInput[];
        try {
          recipeInputs = parseBrewfatherJson(body, { defaultEquipmentId: equipmentId });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to parse Brewfather JSON payload';
          sendApiError(reply, 400, 'VALIDATION_FAILED', message);
          return;
        }

        if (recipeInputs.length === 0) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', 'No recipes found in payload');
          return;
        }

        const existingSummaries = listRecipeSummaries(db);
        const usedNames = new Set<string>(existingSummaries.map((r) => r.name.toLowerCase()));
        const createdRecipes: StoredRecipe[] = [];

        for (const input of recipeInputs) {
          let resolvedName = input.name;
          if (usedNames.has(resolvedName.toLowerCase())) {
            let candidate = `${resolvedName} (Imported)`;
            let counter = 2;
            while (usedNames.has(candidate.toLowerCase())) {
              candidate = `${resolvedName} (Imported ${counter})`;
              counter++;
            }
            resolvedName = candidate;
          }
          usedNames.add(resolvedName.toLowerCase());

          const recipeToWrite: RecipeWriteInput = {
            ...input,
            name: resolvedName,
          };

          const created = createRecipe(db, recipeToWrite);
          createdRecipes.push(created);
        }

        const response: RecipeImportResponse = {
          importedCount: createdRecipes.length,
          recipes: createdRecipes,
        };

        reply.status(201).send(response);
      } catch (err: unknown) {
        if (err instanceof EquipmentNotFoundError) {
          sendApiError(reply, 400, 'EQUIPMENT_NOT_FOUND', err.message);
          return;
        }
        if (
          err instanceof MashProfileNotFoundError ||
          err instanceof FermentationProfileNotFoundError ||
          err instanceof WaterProfileNotFoundError
        ) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', err.message);
          return;
        }
        throw err;
      }
    },
  );


  app.get<{ Params: { id: string } }>('/api/recipes/:id', async (request, reply) => {
    const recipe = getStoredRecipeById(db, request.params.id);
    if (!recipe) {
      sendApiError(reply, 404, 'NOT_FOUND', `Recipe not found: ${request.params.id}`);
      return;
    }
    return recipe;
  });

  app.post<{ Body: RecipeWriteInput }>(
    '/api/recipes',
    { schema: { body: recipeWriteBodySchema } },
    async (request, reply) => {
      try {
        const created = createRecipe(db, request.body);
        reply.status(201).send(created);
      } catch (err) {
        if (err instanceof EquipmentNotFoundError) {
          sendApiError(reply, 400, 'EQUIPMENT_NOT_FOUND', err.message);
          return;
        }
        if (err instanceof MashProfileNotFoundError || err instanceof FermentationProfileNotFoundError || err instanceof WaterProfileNotFoundError) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', err.message);
          return;
        }
        throw err;
      }
    },
  );

  app.put<{ Params: { id: string }; Body: RecipeWriteInput }>(
    '/api/recipes/:id',
    { schema: { body: recipeWriteBodySchema } },
    async (request, reply) => {
      try {
        const updated = updateRecipe(db, request.params.id, request.body);
        if (!updated) {
          sendApiError(reply, 404, 'NOT_FOUND', `Recipe not found: ${request.params.id}`);
          return;
        }
        return updated;
      } catch (err) {
        if (err instanceof EquipmentNotFoundError) {
          sendApiError(reply, 400, 'EQUIPMENT_NOT_FOUND', err.message);
          return;
        }
        if (err instanceof MashProfileNotFoundError || err instanceof FermentationProfileNotFoundError || err instanceof WaterProfileNotFoundError) {
          sendApiError(reply, 400, 'VALIDATION_FAILED', err.message);
          return;
        }
        throw err;
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    '/api/recipes/:id',
    { schema: { body: recipePatchNameBodySchema } },
    async (request, reply) => {
      const updated = patchRecipeName(db, request.params.id, request.body.name);
      if (!updated) {
        sendApiError(reply, 404, 'NOT_FOUND', `Recipe not found: ${request.params.id}`);
        return;
      }
      return updated;
    },
  );

  app.post<{ Params: { id: string } }>('/api/recipes/:id/duplicate', async (request, reply) => {
    const copy = duplicateRecipe(db, request.params.id);
    if (!copy) {
      sendApiError(reply, 404, 'NOT_FOUND', `Recipe not found: ${request.params.id}`);
      return;
    }
    reply.status(201).send(copy);
  });

  app.delete<{ Params: { id: string } }>('/api/recipes/:id', async (request, reply) => {
    const { id } = request.params;

    // Checked BEFORE attempting delete — same guard as equipment/schedule
    // deletes — so a still-referenced recipe never reaches the DB's
    // batches.recipe_id ON DELETE RESTRICT edge, which would otherwise
    // surface as a raw SQLite constraint error (500) rather than a clean 409
    // (critic Finding F-5).
    const referencing = findBatchesUsingRecipe(db, id);
    if (referencing.length > 0) {
      const blockerNames = referencing.slice(0, 5).map((b) => b.name);
      const details: RecipeInUseDetails = {
        batchCount: referencing.length,
        batchNames: blockerNames,
      };
      const namesText = blockerNames.map((n) => `"${n}"`).join(', ');
      const message =
        referencing.length === 1
          ? `Cannot delete — still used by batch ${namesText}.`
          : `Cannot delete — still used by ${referencing.length} batches, including ${namesText}.`;
      sendApiError(reply, 409, 'RECIPE_IN_USE', message, details);
      return;
    }

    const removed = deleteRecipe(db, id);
    if (!removed) {
      sendApiError(reply, 404, 'NOT_FOUND', `Recipe not found: ${id}`);
      return;
    }
    reply.status(204).send();
  });
}
