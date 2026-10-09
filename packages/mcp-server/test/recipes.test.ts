import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StoredRecipe, RecipeSummary } from '@truchabrew/shared-types';
import { TruchaBrewClient, TruchaBrewApiError, TruchaBrewConnectionError } from '../src/client.ts';
import {
  createListRecipesTool,
  createGetRecipeTool,
  createUpdateRecipeTool,
  checkUnsupportedRecipeAction,
  storedRecipeToWriteInput,
} from '../src/tools/recipes.ts';
import { McpServer, createServer } from '../src/index.ts';

const mockSampleRecipe: StoredRecipe = {
  id: 'recipe-123',
  name: 'Citra Pale Ale',
  author: 'Brewmaster',
  styleName: 'American Pale Ale',
  folder: 'Hoppy',
  tags: ['Summer', 'Favorite'],
  bjcpStyleId: '18B',
  notes: 'Ferment at 19C for 10 days.',
  equipment: {
    id: 'eq-default',
    name: 'All-in-One 30L',
    batchSizeL: 20,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 75,
    mashEfficiencyPct: 80,
    boilOffRateLPerHour: 3.5,
    trubChillerLossL: 2,
    hopUtilizationPct: 100,
    derivedFromEquipmentId: null,
    mashWaterRatioLPerKg: 3.0,
    grainAbsorptionLPerKg: 0.9,
    hopstandUtilizationFactor: 0.5,
    hopstandTemperatureC: 85,
    spargeTemperatureC: 76,
    mashTunHeatCapacityL: 2.0,
    grainTemperatureC: 20,
    notes: '',
  },
  fermentables: [
    {
      id: 'ferm-1',
      name: 'Pale Ale Malt',
      type: 'Grain',
      amountKg: 4.5,
      colorSrm: 3.0,
      potentialSg: 1.037,
    },
    {
      id: 'ferm-2',
      name: 'Munich Malt',
      type: 'Grain',
      amountKg: 0.5,
      colorSrm: 9.0,
      potentialSg: 1.035,
    },
  ],
  hops: [
    {
      id: 'hop-1',
      name: 'Citra',
      amountG: 20,
      alphaAcidPct: 12.5,
      use: 'Boil',
      boilMins: 60,
      whirlpoolMins: null,
      whirlpoolTempC: null,
      type: 'Pellet',
    },
    {
      id: 'hop-2',
      name: 'Citra',
      amountG: 50,
      alphaAcidPct: 12.5,
      use: 'DryHop',
      boilMins: null,
      whirlpoolMins: null,
      whirlpoolTempC: null,
      dryHopDayOffset: 3,
      dryHopDurationDays: 4,
      type: 'Pellet',
    },
  ],
  yeasts: [
    {
      id: 'yeast-1',
      name: 'SafAle US-05',
      type: 'Ale',
      form: 'Dry',
      laboratory: 'Fermentis',
      attenuationPct: 81,
      amountPkg: 1,
    },
  ],
  miscs: [
    {
      id: 'misc-1',
      name: 'Whirlfloc',
      type: 'Fining',
      use: 'Boil',
      timeMinutes: 10,
      amount: 1,
      unit: 'each',
    },
  ],
  mashProfile: {
    id: 'mash-1',
    name: 'Single Infusion',
    targetPh: 5.4,
    spargeTempC: 76,
    steps: [],
  },
  fermentationProfile: {
    id: 'ferm-prof-1',
    name: 'Standard Ale',
    steps: [],
  },
  waterSourceId: null,
  waterTargetId: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T12:00:00.000Z',
};

describe('Recipe Tools', () => {
  describe('list_recipes tool', () => {
    it('declares correct metadata and input schema', () => {
      const client = new TruchaBrewClient();
      const tool = createListRecipesTool(client);

      expect(tool.name).toBe('list_recipes');
      expect(tool.description).toContain('Search and list recipes');
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toHaveProperty('query');
      expect(tool.inputSchema.properties).toHaveProperty('folder');
      expect(tool.inputSchema.properties).toHaveProperty('tag');
    });

    it('returns formatted recipe summaries and full JSON', async () => {
      const mockSummaries: RecipeSummary[] = [
        {
          id: 'rec-1',
          name: 'Summer Ale',
          author: 'Alice',
          styleName: 'Blonde Ale',
          equipmentId: 'eq-1',
          equipmentName: 'Robobrew 35L',
          batchSizeL: 23,
          fermentableCount: 2,
          hopCount: 2,
          folder: 'Light',
          tags: ['Crisp'],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ];

      const client = new TruchaBrewClient();
      vi.spyOn(client, 'listRecipes').mockResolvedValue(mockSummaries);

      const tool = createListRecipesTool(client);
      const result = await tool.handler({ query: 'Summer' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Found 1 recipe(s)');
      expect(result.content[0].text).toContain('Summer Ale (ID: rec-1)');
      expect(result.content[0].text).toContain('Robobrew 35L (23L)');
      expect(result.content[0].text).toContain('Folder: Light');
      expect(result.content[0].text).toContain('Tags: Crisp');
      expect(result.content[0].text).toContain('"id": "rec-1"');
      expect(client.listRecipes).toHaveBeenCalledWith({ q: 'Summer', folder: undefined, tag: undefined });
    });

    it('handles no matching recipes gracefully', async () => {
      const client = new TruchaBrewClient();
      vi.spyOn(client, 'listRecipes').mockResolvedValue([]);

      const tool = createListRecipesTool(client);
      const result = await tool.handler({ query: 'Stout' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('No recipes found matching the specified criteria.');
    });

    it('returns isError: true on API failure', async () => {
      const client = new TruchaBrewClient();
      vi.spyOn(client, 'listRecipes').mockRejectedValue(
        new TruchaBrewApiError(500, 'INTERNAL', 'Database connection lost'),
      );

      const tool = createListRecipesTool(client);
      const result = await tool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API Error [INTERNAL]: Database connection lost');
    });

    it('returns isError: true on connection failure', async () => {
      const client = new TruchaBrewClient();
      vi.spyOn(client, 'listRecipes').mockRejectedValue(
        new TruchaBrewConnectionError('http://localhost:3000'),
      );

      const tool = createListRecipesTool(client);
      const result = await tool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Connection Error: Could not connect to TruchaBrew API at http://localhost:3000');
    });
  });

  describe('get_recipe tool', () => {
    it('declares correct metadata and requires id', () => {
      const client = new TruchaBrewClient();
      const tool = createGetRecipeTool(client);

      expect(tool.name).toBe('get_recipe');
      expect(tool.inputSchema.required).toEqual(['id']);
      expect(tool.inputSchema.properties).toHaveProperty('id');
    });

    it('validates id is non-empty', async () => {
      const client = new TruchaBrewClient();
      const tool = createGetRecipeTool(client);

      const resultEmpty = await tool.handler({ id: '' });
      expect(resultEmpty.isError).toBe(true);
      expect(resultEmpty.content[0].text).toContain('The "id" parameter is required');

      const resultMissing = await tool.handler({});
      expect(resultMissing.isError).toBe(true);
      expect(resultMissing.content[0].text).toContain('The "id" parameter is required');
    });

    it('returns full recipe breakdown and full JSON', async () => {
      const client = new TruchaBrewClient();
      vi.spyOn(client, 'getRecipe').mockResolvedValue(mockSampleRecipe);

      const tool = createGetRecipeTool(client);
      const result = await tool.handler({ id: 'recipe-123' });

      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain('Recipe: Citra Pale Ale (ID: recipe-123)');
      expect(text).toContain('Style: American Pale Ale');
      expect(text).toContain('Equipment: All-in-One 30L (20L)');
      expect(text).toContain('Pale Ale Malt: 4.5 kg');
      expect(text).toContain('Citra: 20g (Boil 60 min, 12.5% AA)');
      expect(text).toContain('Citra: 50g (DryHop, 12.5% AA)');
      expect(text).toContain('SafAle US-05');
      expect(text).toContain('Whirlfloc: 1 each (Boil)');
      expect(text).toContain('"id": "recipe-123"');
      expect(client.getRecipe).toHaveBeenCalledWith('recipe-123');
    });

    it('returns isError: true when recipe is not found', async () => {
      const client = new TruchaBrewClient();
      vi.spyOn(client, 'getRecipe').mockRejectedValue(
        new TruchaBrewApiError(404, 'NOT_FOUND', 'Recipe not found: rec-404'),
      );

      const tool = createGetRecipeTool(client);
      const result = await tool.handler({ id: 'rec-404' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API Error [NOT_FOUND]: Recipe not found: rec-404');
    });
  });

  describe('update_recipe tool', () => {
    it('declares correct metadata and requires id', () => {
      const client = new TruchaBrewClient();
      const tool = createUpdateRecipeTool(client);

      expect(tool.name).toBe('update_recipe');
      expect(tool.inputSchema.required).toEqual(['id']);
      expect(tool.inputSchema.properties).toHaveProperty('id');
      expect(tool.inputSchema.properties).toHaveProperty('name');
      expect(tool.inputSchema.properties).toHaveProperty('hops');
    });

    it('validates id is non-empty', async () => {
      const client = new TruchaBrewClient();
      const tool = createUpdateRecipeTool(client);

      const result = await tool.handler({ id: '   ' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('The "id" parameter is required');
    });

    it('performs partial update by fetching existing recipe, merging, and submitting', async () => {
      const client = new TruchaBrewClient();
      vi.spyOn(client, 'getRecipe').mockResolvedValue(mockSampleRecipe);

      const updatedRecipe: StoredRecipe = {
        ...mockSampleRecipe,
        notes: 'Dry hop increased to 70g. Ferment at 20C.',
      };
      vi.spyOn(client, 'updateRecipe').mockResolvedValue(updatedRecipe);

      const tool = createUpdateRecipeTool(client);
      const result = await tool.handler({
        id: 'recipe-123',
        notes: 'Dry hop increased to 70g. Ferment at 20C.',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Successfully updated recipe "Citra Pale Ale"');
      expect(result.content[0].text).toContain('Dry hop increased to 70g');

      expect(client.getRecipe).toHaveBeenCalledWith('recipe-123');
      expect(client.updateRecipe).toHaveBeenCalledWith(
        'recipe-123',
        expect.objectContaining({
          name: 'Citra Pale Ale',
          author: 'Brewmaster',
          equipmentId: 'eq-default',
          notes: 'Dry hop increased to 70g. Ferment at 20C.',
          mashProfileId: 'mash-1',
          fermentationProfileId: 'ferm-prof-1',
        }),
      );
    });

    it('supports full write input without getRecipe fetch', async () => {
      const fullInput = storedRecipeToWriteInput(mockSampleRecipe);
      fullInput.name = 'Citra Double Pale Ale';

      const client = new TruchaBrewClient();
      vi.spyOn(client, 'getRecipe');
      vi.spyOn(client, 'updateRecipe').mockResolvedValue({
        ...mockSampleRecipe,
        name: 'Citra Double Pale Ale',
      });

      const tool = createUpdateRecipeTool(client);
      const result = await tool.handler({
        id: 'recipe-123',
        ...fullInput,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Successfully updated recipe "Citra Double Pale Ale"');
      expect(client.getRecipe).not.toHaveBeenCalled();
      expect(client.updateRecipe).toHaveBeenCalledWith('recipe-123', expect.objectContaining({
        name: 'Citra Double Pale Ale',
      }));
    });

    it('supports updates passed in nested recipe object', async () => {
      const client = new TruchaBrewClient();
      vi.spyOn(client, 'getRecipe').mockResolvedValue(mockSampleRecipe);
      vi.spyOn(client, 'updateRecipe').mockResolvedValue({
        ...mockSampleRecipe,
        folder: 'Flagship',
      });

      const tool = createUpdateRecipeTool(client);
      const result = await tool.handler({
        id: 'recipe-123',
        recipe: {
          folder: 'Flagship',
        },
      });

      expect(result.isError).toBeUndefined();
      expect(client.getRecipe).toHaveBeenCalledWith('recipe-123');
      expect(client.updateRecipe).toHaveBeenCalledWith('recipe-123', expect.objectContaining({
        folder: 'Flagship',
      }));
    });

    it('returns error when recipe to update is not found', async () => {
      const client = new TruchaBrewClient();
      vi.spyOn(client, 'getRecipe').mockRejectedValue(
        new TruchaBrewApiError(404, 'NOT_FOUND', 'Recipe not found: rec-404'),
      );

      const tool = createUpdateRecipeTool(client);
      const result = await tool.handler({ id: 'rec-404', name: 'New Name' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API Error [NOT_FOUND]: Recipe not found: rec-404');
    });

    it('returns error when validation fails', async () => {
      const client = new TruchaBrewClient();
      vi.spyOn(client, 'getRecipe').mockResolvedValue(mockSampleRecipe);
      vi.spyOn(client, 'updateRecipe').mockRejectedValue(
        new TruchaBrewApiError(400, 'EQUIPMENT_NOT_FOUND', 'Equipment profile not found: invalid-eq'),
      );

      const tool = createUpdateRecipeTool(client);
      const result = await tool.handler({ id: 'recipe-123', equipmentId: 'invalid-eq' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API Error [EQUIPMENT_NOT_FOUND]: Equipment profile not found: invalid-eq');
    });
  });

  describe('unsupported actions rejection (AC-6)', () => {
    it('rejects create_recipe with explanatory error message', () => {
      const res = checkUnsupportedRecipeAction('create_recipe');
      expect(res).not.toBeNull();
      expect(res?.isError).toBe(true);
      expect(res?.content[0].text).toContain('Recipe creation is not supported through MCP');
    });

    it('rejects delete_recipe with explanatory error message', () => {
      const res = checkUnsupportedRecipeAction('delete_recipe');
      expect(res).not.toBeNull();
      expect(res?.isError).toBe(true);
      expect(res?.content[0].text).toContain('Recipe deletion is not supported through MCP');
    });

    it('returns null for supported or other tool names', () => {
      expect(checkUnsupportedRecipeAction('list_recipes')).toBeNull();
      expect(checkUnsupportedRecipeAction('get_recipe')).toBeNull();
      expect(checkUnsupportedRecipeAction('update_recipe')).toBeNull();
      expect(checkUnsupportedRecipeAction('random_tool')).toBeNull();
    });
  });

  describe('McpServer JSON-RPC protocol handling', () => {
    let server: McpServer;
    let client: TruchaBrewClient;

    beforeEach(() => {
      client = new TruchaBrewClient();
      server = createServer(client);
    });

    it('handles initialize request', async () => {
      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'claude-code', version: '1.0.0' },
        },
      });

      expect(res).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: '@truchabrew/mcp-server',
            version: '0.1.0',
          },
        },
      });
    });

    it('ignores notifications/initialized without response', async () => {
      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      });
      expect(res).toBeNull();
    });

    it('handles ping request', async () => {
      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 'ping-1',
        method: 'ping',
      });

      expect(res).toEqual({
        jsonrpc: '2.0',
        id: 'ping-1',
        result: {},
      });
    });

    it('lists registered recipe tools on tools/list', async () => {
      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      expect(res).not.toBeNull();
      expect(res!.result).toHaveProperty('tools');
      const tools = (res!.result as { tools: Array<{ name: string }> }).tools;
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('list_recipes');
      expect(toolNames).toContain('get_recipe');
      expect(toolNames).toContain('update_recipe');
      expect(toolNames).not.toContain('create_recipe');
      expect(toolNames).not.toContain('delete_recipe');
    });

    it('executes list_recipes via tools/call', async () => {
      vi.spyOn(client, 'listRecipes').mockResolvedValue([]);

      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_recipes',
          arguments: { query: 'IPA' },
        },
      });

      expect(res).not.toBeNull();
      expect(res!.id).toBe(3);
      const resResult = res!.result as { content: Array<{ text: string }> };
      expect(resResult.content[0].text).toContain('No recipes found');
    });

    it('executes get_recipe via tools/call', async () => {
      vi.spyOn(client, 'getRecipe').mockResolvedValue(mockSampleRecipe);

      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'get_recipe',
          arguments: { id: 'recipe-123' },
        },
      });

      expect(res).not.toBeNull();
      expect(res!.id).toBe(4);
      const resResult = res!.result as { content: Array<{ text: string }> };
      expect(resResult.content[0].text).toContain('Recipe: Citra Pale Ale');
    });

    it('executes update_recipe via tools/call', async () => {
      vi.spyOn(client, 'getRecipe').mockResolvedValue(mockSampleRecipe);
      vi.spyOn(client, 'updateRecipe').mockResolvedValue(mockSampleRecipe);

      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'update_recipe',
          arguments: { id: 'recipe-123', notes: 'New notes' },
        },
      });

      expect(res).not.toBeNull();
      expect(res!.id).toBe(5);
      const resResult = res!.result as { content: Array<{ text: string }> };
      expect(resResult.content[0].text).toContain('Successfully updated recipe "Citra Pale Ale"');
    });

    it('intercepts create_recipe and delete_recipe as unsupported (AC-6)', async () => {
      const createRes = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'create_recipe', arguments: {} },
      });

      expect(createRes).not.toBeNull();
      const createResult = createRes!.result as { isError: boolean; content: Array<{ text: string }> };
      expect(createResult.isError).toBe(true);
      expect(createResult.content[0].text).toContain('Recipe creation is not supported through MCP');

      const deleteRes = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'delete_recipe', arguments: { id: 'rec-1' } },
      });

      expect(deleteRes).not.toBeNull();
      const deleteResult = deleteRes!.result as { isError: boolean; content: Array<{ text: string }> };
      expect(deleteResult.isError).toBe(true);
      expect(deleteResult.content[0].text).toContain('Recipe deletion is not supported through MCP');
    });

    it('returns error for unknown tool call', async () => {
      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: { name: 'non_existent_tool' },
      });

      expect(res?.error?.code).toBe(-32601);
      expect(res?.error?.message).toContain('Tool not found: "non_existent_tool"');
    });

    it('returns error for unknown method', async () => {
      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 9,
        method: 'unknown_method',
      });

      expect(res?.error?.code).toBe(-32601);
      expect(res?.error?.message).toContain('Method not found: "unknown_method"');
    });

    it('returns error for invalid JSON-RPC payload', async () => {
      const res = await server.handleJsonRpc('invalid string');
      expect(res?.error?.code).toBe(-32600);
    });

    it('processes stdio streams end-to-end via connectStdio', async () => {
      const { PassThrough } = await import('node:stream');
      const inStream = new PassThrough();
      const outStream = new PassThrough();

      const outputLines: string[] = [];
      outStream.on('data', (chunk) => {
        outputLines.push(chunk.toString());
      });

      const { close } = server.connectStdio(inStream, outStream);

      // Send initialize request
      inStream.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 101,
          method: 'initialize',
          params: {},
        }) + '\n',
      );

      // Send ping request
      inStream.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 102,
          method: 'ping',
        }) + '\n',
      );

      // Send invalid JSON line
      inStream.write('this is not json\n');

      // Allow event loop to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      close();

      const allOutput = outputLines.join('');
      const responses = allOutput
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l));

      expect(responses).toHaveLength(3);
      expect(responses[0]).toEqual(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 101,
          result: expect.objectContaining({
            capabilities: { tools: {} },
            serverInfo: expect.objectContaining({ name: '@truchabrew/mcp-server' }),
          }),
        }),
      );
      expect(responses[1]).toEqual({
        jsonrpc: '2.0',
        id: 102,
        result: {},
      });
      expect(responses[2]).toEqual({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error: invalid JSON' },
      });
    });
  });
});
