import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RecipeSummary, RecipeWriteInput, StoredRecipe } from '@truchabrew/shared-types';
import {
  TruchaBrewClient,
  TruchaBrewApiError,
  TruchaBrewConnectionError,
  getTruchaBrewApiUrl,
} from '../src/client.ts';

describe('TruchaBrewClient', () => {
  const originalEnv = process.env.TRUCHABREW_API_URL;

  beforeEach(() => {
    delete process.env.TRUCHABREW_API_URL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TRUCHABREW_API_URL = originalEnv;
    } else {
      delete process.env.TRUCHABREW_API_URL;
    }
  });

  describe('configuration and baseUrl', () => {
    it('defaults to http://localhost:3000 when TRUCHABREW_API_URL is unset', () => {
      const client = new TruchaBrewClient();
      expect(client.baseUrl).toBe('http://localhost:3000');
      expect(getTruchaBrewApiUrl()).toBe('http://localhost:3000');
    });

    it('reads TRUCHABREW_API_URL environment variable', () => {
      process.env.TRUCHABREW_API_URL = 'http://brewpi.local:8080';
      const client = new TruchaBrewClient();
      expect(client.baseUrl).toBe('http://brewpi.local:8080');
      expect(getTruchaBrewApiUrl()).toBe('http://brewpi.local:8080');
    });

    it('prefers explicit constructor baseUrl over environment variable and strips trailing slashes', () => {
      process.env.TRUCHABREW_API_URL = 'http://brewpi.local:8080';
      const client = new TruchaBrewClient({ baseUrl: 'http://custom-host:4000///' });
      expect(client.baseUrl).toBe('http://custom-host:4000');
    });
  });

  describe('listRecipes', () => {
    it('calls GET /api/recipes without params when none provided', async () => {
      const mockSummaries: RecipeSummary[] = [
        {
          id: 'rec-1',
          name: 'West Coast IPA',
          author: 'Alice',
          styleName: 'American IPA',
          equipmentId: 'eq-1',
          equipmentName: 'Grainfather G30',
          batchSizeL: 20,
          fermentableCount: 3,
          hopCount: 4,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ];

      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSummaries,
      });

      const client = new TruchaBrewClient({ baseUrl: 'http://localhost:3000', fetch: fetchFn as any });
      const result = await client.listRecipes();

      expect(result).toEqual(mockSummaries);
      expect(fetchFn).toHaveBeenCalledWith('http://localhost:3000/api/recipes', expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
      }));
    });

    it('appends query string for search, folder, and tag', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      const client = new TruchaBrewClient({ fetch: fetchFn as any });
      await client.listRecipes({ q: 'pale ale', folder: 'IPAs', tag: 'favorite' });

      expect(fetchFn).toHaveBeenCalledWith(
        'http://localhost:3000/api/recipes?q=pale+ale&folder=IPAs&tag=favorite',
        expect.anything(),
      );
    });

    it('handles __unfiled__ folder filter correctly', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      const client = new TruchaBrewClient({ fetch: fetchFn as any });
      await client.listRecipes({ folder: '__unfiled__' });

      expect(fetchFn).toHaveBeenCalledWith(
        'http://localhost:3000/api/recipes?folder=__unfiled__',
        expect.anything(),
      );
    });
  });

  describe('getRecipe', () => {
    it('validates recipe ID is non-empty', async () => {
      const client = new TruchaBrewClient();
      await expect(client.getRecipe('')).rejects.toThrow('Recipe id must be a non-empty string');
      await expect(client.getRecipe('   ')).rejects.toThrow('Recipe id must be a non-empty string');
    });

    it('calls GET /api/recipes/:id with encoded id', async () => {
      const mockRecipe = {
        id: 'rec-1',
        name: 'West Coast IPA',
        author: 'Alice',
        styleName: 'American IPA',
      } as StoredRecipe;

      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRecipe,
      });

      const client = new TruchaBrewClient({ fetch: fetchFn as any });
      const result = await client.getRecipe('rec-1');

      expect(result).toEqual(mockRecipe);
      expect(fetchFn).toHaveBeenCalledWith('http://localhost:3000/api/recipes/rec-1', expect.anything());
    });
  });

  describe('updateRecipe', () => {
    it('validates recipe ID is non-empty', async () => {
      const client = new TruchaBrewClient();
      await expect(client.updateRecipe('', {} as any)).rejects.toThrow('Recipe id must be a non-empty string');
    });

    it('sends PUT /api/recipes/:id with serialized payload', async () => {
      const payload: RecipeWriteInput = {
        name: 'Updated IPA',
        author: 'Alice',
        styleName: 'American IPA',
        notes: 'Updated notes',
        equipmentId: 'eq-1',
        fermentables: [],
        hops: [],
        yeasts: [],
        miscs: [],
        mashProfileId: null,
        fermentationProfileId: null,
        waterSourceId: null,
        waterTargetId: null,
      };

      const mockUpdated = { id: 'rec-1', ...payload } as unknown as StoredRecipe;

      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUpdated,
      });

      const client = new TruchaBrewClient({ fetch: fetchFn as any });
      const result = await client.updateRecipe('rec-1', payload);

      expect(result).toEqual(mockUpdated);
      expect(fetchFn).toHaveBeenCalledWith(
        'http://localhost:3000/api/recipes/rec-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('throws TruchaBrewApiError with API error body details on 404 NOT_FOUND', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: {
            code: 'NOT_FOUND',
            message: 'Recipe not found: rec-999',
          },
        }),
      });

      const client = new TruchaBrewClient({ fetch: fetchFn as any });
      await expect(client.getRecipe('rec-999')).rejects.toThrowError(TruchaBrewApiError);

      try {
        await client.getRecipe('rec-999');
      } catch (err) {
        expect(err).toBeInstanceOf(TruchaBrewApiError);
        const apiErr = err as TruchaBrewApiError;
        expect(apiErr.status).toBe(404);
        expect(apiErr.code).toBe('NOT_FOUND');
        expect(apiErr.message).toBe('Recipe not found: rec-999');
      }
    });

    it('throws TruchaBrewApiError with validation error code on 400 VALIDATION_FAILED', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'body/fermentables must be array',
          },
        }),
      });

      const client = new TruchaBrewClient({ fetch: fetchFn as any });

      try {
        await client.updateRecipe('rec-1', {} as any);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TruchaBrewApiError);
        const apiErr = err as TruchaBrewApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.code).toBe('VALIDATION_FAILED');
        expect(apiErr.message).toBe('body/fermentables must be array');
      }
    });

    it('handles Fastify-style error payload with message', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          statusCode: 400,
          error: 'Bad Request',
          message: 'body must have required property "name"',
        }),
      });

      const client = new TruchaBrewClient({ fetch: fetchFn as any });

      try {
        await client.updateRecipe('rec-1', {} as any);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TruchaBrewApiError);
        const apiErr = err as TruchaBrewApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.message).toBe('body must have required property "name"');
      }
    });

    it('handles non-JSON error response gracefully', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      const client = new TruchaBrewClient({ fetch: fetchFn as any });

      try {
        await client.listRecipes();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TruchaBrewApiError);
        const apiErr = err as TruchaBrewApiError;
        expect(apiErr.status).toBe(502);
        expect(apiErr.code).toBe('HTTP_502');
      }
    });

    it('throws TruchaBrewConnectionError when network/fetch fails', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED'));
      const client = new TruchaBrewClient({ baseUrl: 'http://localhost:3000', fetch: fetchFn as any });

      try {
        await client.listRecipes();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TruchaBrewConnectionError);
        const connErr = err as TruchaBrewConnectionError;
        expect(connErr.baseUrl).toBe('http://localhost:3000');
        expect(connErr.message).toContain('Could not connect to TruchaBrew API at http://localhost:3000');
      }
    });
  });
});
