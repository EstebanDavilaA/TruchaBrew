import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PassThrough } from 'node:stream';
import type { EquipmentProfile } from '@truchabrew/shared-types';
import {
  TruchaBrewClient,
  TruchaBrewApiError,
  TruchaBrewConnectionError,
} from '../src/client.ts';
import {
  createListEquipmentProfilesTool,
  createGetEquipmentProfileTool,
  createUpdateEquipmentProfileTool,
  checkUnsupportedEquipmentAction,
  storedEquipmentToUpdateInput,
  validateEquipmentUpdates,
} from '../src/tools/equipment.ts';
import { McpServer, createServer } from '../src/index.ts';

const mockProfiles: EquipmentProfile[] = [
  {
    id: 'eq-1',
    name: 'Grainfather G30',
    batchSizeL: 23,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 75,
    mashEfficiencyPct: 80,
    boilOffRateLPerHour: 3.0,
    trubChillerLossL: 2.0,
    hopUtilizationPct: 100,
    derivedFromEquipmentId: null,
    mashWaterRatioLPerKg: 3.0,
    grainAbsorptionLPerKg: 0.96,
    hopstandUtilizationFactor: 0.5,
    hopstandTemperatureC: 80,
    spargeTemperatureC: 76,
    mashTunHeatCapacityL: 0,
    grainTemperatureC: 20,
    notes: 'Standard 30L all-in-one system',
    altitudeMeters: 0,
    calcStrikeWithThermalMass: false,
    mashTunDeadSpaceL: 1.5,
    kettleLossL: 0,
    mashTunWeightKg: 0,
    mashTunHeatCapacity: 0.12,
  },
  {
    id: 'eq-2',
    name: 'BrewZilla 35L Gen 4',
    batchSizeL: 25,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 72,
    mashEfficiencyPct: 78,
    boilOffRateLPerHour: 3.5,
    trubChillerLossL: 2.5,
    hopUtilizationPct: 100,
    derivedFromEquipmentId: null,
    mashWaterRatioLPerKg: 2.8,
    grainAbsorptionLPerKg: 1.0,
    hopstandUtilizationFactor: 0.6,
    hopstandTemperatureC: 85,
    spargeTemperatureC: 75,
    mashTunHeatCapacityL: 1.0,
    grainTemperatureC: 21,
    notes: 'Gen 4 single vessel system',
    altitudeMeters: 50,
    calcStrikeWithThermalMass: true,
    mashTunDeadSpaceL: 2.0,
    kettleLossL: 0.5,
    mashTunWeightKg: 5,
    mashTunHeatCapacity: 0.15,
  },
];

describe('Equipment Tools', () => {
  let client: TruchaBrewClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new TruchaBrewClient({ baseUrl: 'http://localhost:3000' });
  });

  describe('storedEquipmentToUpdateInput', () => {
    it('omits id and derivedFromEquipmentId while preserving required and optional fields', () => {
      const input = storedEquipmentToUpdateInput(mockProfiles[0]);
      expect((input as any).id).toBeUndefined();
      expect((input as any).derivedFromEquipmentId).toBeUndefined();
      expect(input.name).toBe('Grainfather G30');
      expect(input.batchSizeL).toBe(23);
      expect(input.boilTimeMin).toBe(60);
      expect(input.brewhouseEfficiencyPct).toBe(75);
      expect(input.mashEfficiencyPct).toBe(80);
      expect(input.boilOffRateLPerHour).toBe(3.0);
      expect(input.trubChillerLossL).toBe(2.0);
      expect(input.mashTunDeadSpaceL).toBe(1.5);
    });
  });

  describe('validateEquipmentUpdates', () => {
    it('accepts valid updates', () => {
      expect(
        validateEquipmentUpdates({
          batchSizeL: 20,
          brewhouseEfficiencyPct: 75,
          mashEfficiencyPct: 82,
          boilOffRateLPerHour: 3.2,
          trubChillerLossL: 1.8,
          mashTunDeadSpaceL: 1.0,
          boilTimeMin: 90,
        }),
      ).toBeNull();
    });

    it('rejects negative or zero batchSizeL', () => {
      expect(validateEquipmentUpdates({ batchSizeL: 0 })).toContain('batchSizeL must be a positive number');
      expect(validateEquipmentUpdates({ batchSizeL: -5 })).toContain('batchSizeL must be a positive number');
    });

    it('rejects out-of-range brewhouseEfficiencyPct', () => {
      expect(validateEquipmentUpdates({ brewhouseEfficiencyPct: 0 })).toContain(
        'brewhouseEfficiencyPct must be greater than 0 and at most 100',
      );
      expect(validateEquipmentUpdates({ brewhouseEfficiencyPct: 105 })).toContain(
        'brewhouseEfficiencyPct must be greater than 0 and at most 100',
      );
      expect(validateEquipmentUpdates({ brewhouseEfficiencyPct: -10 })).toContain(
        'brewhouseEfficiencyPct must be greater than 0 and at most 100',
      );
    });

    it('rejects out-of-range mashEfficiencyPct', () => {
      expect(validateEquipmentUpdates({ mashEfficiencyPct: 0 })).toContain(
        'mashEfficiencyPct must be greater than 0 and at most 100',
      );
      expect(validateEquipmentUpdates({ mashEfficiencyPct: 101 })).toContain(
        'mashEfficiencyPct must be greater than 0 and at most 100',
      );
    });

    it('rejects negative boilOffRateLPerHour and trubChillerLossL', () => {
      expect(validateEquipmentUpdates({ boilOffRateLPerHour: -1 })).toContain(
        'boilOffRateLPerHour must be a non-negative number',
      );
      expect(validateEquipmentUpdates({ trubChillerLossL: -0.5 })).toContain(
        'trubChillerLossL must be a non-negative number',
      );
    });

    it('rejects negative or excessive mashTunDeadSpaceL', () => {
      expect(validateEquipmentUpdates({ mashTunDeadSpaceL: -1 })).toContain(
        'mashTunDeadSpaceL must be between 0 and 500 liters',
      );
      expect(validateEquipmentUpdates({ mashTunDeadSpaceL: 600 })).toContain(
        'mashTunDeadSpaceL must be between 0 and 500 liters',
      );
    });

    it('rejects empty or whitespace-only name', () => {
      expect(validateEquipmentUpdates({ name: '' })).toContain('name must be a non-empty string');
      expect(validateEquipmentUpdates({ name: '   ' })).toContain('name must be a non-empty string');
    });
  });

  describe('checkUnsupportedEquipmentAction', () => {
    it('rejects create_equipment_profile as unsupported', () => {
      const result = checkUnsupportedEquipmentAction('create_equipment_profile');
      expect(result).not.toBeNull();
      expect(result!.isError).toBe(true);
      expect(result!.content[0].text).toContain('Equipment profile creation is not supported through MCP');
    });

    it('rejects delete_equipment_profile as unsupported', () => {
      const result = checkUnsupportedEquipmentAction('delete_equipment_profile');
      expect(result).not.toBeNull();
      expect(result!.isError).toBe(true);
      expect(result!.content[0].text).toContain('Equipment profile deletion is not supported through MCP');
    });

    it('returns null for supported or unrelated actions', () => {
      expect(checkUnsupportedEquipmentAction('list_equipment_profiles')).toBeNull();
      expect(checkUnsupportedEquipmentAction('get_equipment_profile')).toBeNull();
      expect(checkUnsupportedEquipmentAction('update_equipment_profile')).toBeNull();
      expect(checkUnsupportedEquipmentAction('other_action')).toBeNull();
    });
  });

  describe('list_equipment_profiles tool', () => {
    it('returns formatted profiles with required fields and full JSON', async () => {
      vi.spyOn(client, 'listEquipmentProfiles').mockResolvedValue(mockProfiles);

      const tool = createListEquipmentProfilesTool(client);
      const res = await tool.handler({});

      expect(res.isError).toBeFalsy();
      const text = res.content[0].text;
      expect(text).toContain('Found 2 equipment profile(s):');
      expect(text).toContain('• Grainfather G30 (ID: eq-1)');
      expect(text).toContain('Batch Size: 23L');
      expect(text).toContain('Boil-Off Rate: 3 L/h');
      expect(text).toContain('Trub/Chiller Loss: 2L');
      expect(text).toContain('Brewhouse Efficiency: 75%');
      expect(text).toContain('Mash Efficiency: 80%');
      expect(text).toContain('Mash Tun Dead Space: 1.5L');
      expect(text).toContain('• BrewZilla 35L Gen 4 (ID: eq-2)');
      expect(text).toContain('Full JSON:');
    });

    it('filters profiles by query string', async () => {
      vi.spyOn(client, 'listEquipmentProfiles').mockResolvedValue(mockProfiles);

      const tool = createListEquipmentProfilesTool(client);
      const res = await tool.handler({ query: 'Grainfather' });

      expect(res.isError).toBeFalsy();
      const text = res.content[0].text;
      expect(text).toContain('Found 1 equipment profile(s):');
      expect(text).toContain('Grainfather G30');
      expect(text).not.toContain('BrewZilla');
    });

    it('returns informative message when no profiles match', async () => {
      vi.spyOn(client, 'listEquipmentProfiles').mockResolvedValue([]);

      const tool = createListEquipmentProfilesTool(client);
      const res = await tool.handler({ query: 'Nonexistent' });

      expect(res.isError).toBeFalsy();
      expect(res.content[0].text).toBe('No equipment profiles found matching the specified criteria.');
    });

    it('formats API errors gracefully', async () => {
      vi.spyOn(client, 'listEquipmentProfiles').mockRejectedValue(
        new TruchaBrewApiError(500, 'INTERNAL_ERROR', 'Database locked'),
      );

      const tool = createListEquipmentProfilesTool(client);
      const res = await tool.handler({});

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('API Error [INTERNAL_ERROR]: Database locked');
    });

    it('formats connection errors gracefully', async () => {
      vi.spyOn(client, 'listEquipmentProfiles').mockRejectedValue(
        new TruchaBrewConnectionError('http://localhost:3000'),
      );

      const tool = createListEquipmentProfilesTool(client);
      const res = await tool.handler({});

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('Connection Error: Could not connect to TruchaBrew API');
    });
  });

  describe('get_equipment_profile tool', () => {
    it('fetches profile by ID and returns formatted parameters', async () => {
      vi.spyOn(client, 'getEquipmentProfile').mockResolvedValue(mockProfiles[0]);

      const tool = createGetEquipmentProfileTool(client);
      const res = await tool.handler({ id: 'eq-1' });

      expect(res.isError).toBeFalsy();
      const text = res.content[0].text;
      expect(text).toContain('Equipment Profile: Grainfather G30 (ID: eq-1)');
      expect(text).toContain('Batch Size: 23L');
      expect(text).toContain('Boil Time: 60 min');
      expect(text).toContain('Boil-Off Rate: 3 L/h');
      expect(text).toContain('Trub / Chiller Loss: 2 L');
      expect(text).toContain('Brewhouse Efficiency: 75%');
      expect(text).toContain('Mash Efficiency: 80%');
      expect(text).toContain('Mash Tun Dead Space: 1.5 L');
      expect(text).toContain('Mash Water Ratio: 3 L/kg');
      expect(text).toContain('Grain Absorption: 0.96 L/kg');
      expect(text).toContain('Hop Utilization: 100%');
      expect(text).toContain('Notes: Standard 30L all-in-one system');
      expect(text).toContain('Full JSON:');
    });

    it('fetches profile by name', async () => {
      vi.spyOn(client, 'getEquipmentProfile').mockResolvedValue(mockProfiles[1]);

      const tool = createGetEquipmentProfileTool(client);
      const res = await tool.handler({ name: 'BrewZilla 35L Gen 4' });

      expect(res.isError).toBeFalsy();
      expect(client.getEquipmentProfile).toHaveBeenCalledWith('BrewZilla 35L Gen 4');
      expect(res.content[0].text).toContain('BrewZilla 35L Gen 4 (ID: eq-2)');
    });

    it('returns error when ID or name is missing', async () => {
      const tool = createGetEquipmentProfileTool(client);
      const res = await tool.handler({});

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('An equipment profile ID or name is required.');
    });

    it('returns error when profile is not found (404)', async () => {
      vi.spyOn(client, 'getEquipmentProfile').mockRejectedValue(
        new TruchaBrewApiError(404, 'NOT_FOUND', 'Equipment profile not found: "eq-unknown"'),
      );

      const tool = createGetEquipmentProfileTool(client);
      const res = await tool.handler({ id: 'eq-unknown' });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('API Error [NOT_FOUND]: Equipment profile not found: "eq-unknown"');
    });
  });

  describe('update_equipment_profile tool', () => {
    it('updates a single parameter by merging with existing profile', async () => {
      vi.spyOn(client, 'getEquipmentProfile').mockResolvedValue(mockProfiles[0]);
      const updateSpy = vi.spyOn(client, 'updateEquipmentProfile').mockResolvedValue({
        ...mockProfiles[0],
        boilOffRateLPerHour: 3.5,
      });

      const tool = createUpdateEquipmentProfileTool(client);
      const res = await tool.handler({
        id: 'eq-1',
        boilOffRateLPerHour: 3.5,
      });

      expect(res.isError).toBeFalsy();
      expect(updateSpy).toHaveBeenCalledWith(
        'eq-1',
        expect.objectContaining({
          name: 'Grainfather G30',
          batchSizeL: 23,
          boilOffRateLPerHour: 3.5,
          trubChillerLossL: 2.0,
          brewhouseEfficiencyPct: 75,
          mashEfficiencyPct: 80,
          mashTunDeadSpaceL: 1.5,
        }),
      );

      // Verify server-owned fields are NEVER sent in PUT body
      const sentPayload = updateSpy.mock.calls[0][1] as any;
      expect(sentPayload.id).toBeUndefined();
      expect(sentPayload.derivedFromEquipmentId).toBeUndefined();

      expect(res.content[0].text).toContain('Successfully updated equipment profile "Grainfather G30"');
      expect(res.content[0].text).toContain('Boil-Off Rate: 3.5 L/h');
    });

    it('updates multiple parameters via nested profile object', async () => {
      vi.spyOn(client, 'getEquipmentProfile').mockResolvedValue(mockProfiles[0]);
      const updateSpy = vi.spyOn(client, 'updateEquipmentProfile').mockResolvedValue({
        ...mockProfiles[0],
        boilOffRateLPerHour: 3.8,
        mashTunDeadSpaceL: 2.2,
        brewhouseEfficiencyPct: 78,
      });

      const tool = createUpdateEquipmentProfileTool(client);
      const res = await tool.handler({
        id: 'eq-1',
        profile: {
          boilOffRateLPerHour: 3.8,
          mashTunDeadSpaceL: 2.2,
          brewhouseEfficiencyPct: 78,
        },
      });

      expect(res.isError).toBeFalsy();
      expect(updateSpy).toHaveBeenCalledWith(
        'eq-1',
        expect.objectContaining({
          boilOffRateLPerHour: 3.8,
          mashTunDeadSpaceL: 2.2,
          brewhouseEfficiencyPct: 78,
        }),
      );
    });

    it('locates profile by name when id is omitted', async () => {
      vi.spyOn(client, 'getEquipmentProfile').mockResolvedValue(mockProfiles[1]);
      const updateSpy = vi.spyOn(client, 'updateEquipmentProfile').mockResolvedValue({
        ...mockProfiles[1],
        mashTunDeadSpaceL: 2.5,
      });

      const tool = createUpdateEquipmentProfileTool(client);
      const res = await tool.handler({
        name: 'BrewZilla 35L Gen 4',
        mashTunDeadSpaceL: 2.5,
      });

      expect(res.isError).toBeFalsy();
      expect(client.getEquipmentProfile).toHaveBeenCalledWith('BrewZilla 35L Gen 4');
      expect(updateSpy).toHaveBeenCalledWith('eq-2', expect.objectContaining({ mashTunDeadSpaceL: 2.5 }));
    });

    it('returns validation error for negative numbers without calling API', async () => {
      const getSpy = vi.spyOn(client, 'getEquipmentProfile');
      const updateSpy = vi.spyOn(client, 'updateEquipmentProfile');

      const tool = createUpdateEquipmentProfileTool(client);
      const res = await tool.handler({
        id: 'eq-1',
        batchSizeL: -10,
      });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('Validation Error: batchSizeL must be a positive number');
      expect(getSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('returns validation error for out-of-range efficiency without calling API', async () => {
      const updateSpy = vi.spyOn(client, 'updateEquipmentProfile');

      const tool = createUpdateEquipmentProfileTool(client);
      const res = await tool.handler({
        id: 'eq-1',
        brewhouseEfficiencyPct: 120,
      });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain(
        'Validation Error: brewhouseEfficiencyPct must be greater than 0 and at most 100',
      );
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('returns validation error for negative dead space', async () => {
      const updateSpy = vi.spyOn(client, 'updateEquipmentProfile');

      const tool = createUpdateEquipmentProfileTool(client);
      const res = await tool.handler({
        id: 'eq-1',
        mashTunDeadSpaceL: -2,
      });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('Validation Error: mashTunDeadSpaceL must be between 0 and 500 liters');
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('requires an id or name to identify the profile', async () => {
      const tool = createUpdateEquipmentProfileTool(client);
      const res = await tool.handler({ boilOffRateLPerHour: 3.5 });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('An equipment profile ID or name is required to update.');
    });
  });

  describe('TruchaBrewClient equipment methods', () => {
    it('listEquipmentProfiles fetches GET /api/equipment-profiles', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProfiles,
      });

      const customClient = new TruchaBrewClient({ baseUrl: 'http://localhost:3000', fetch: fetchFn as any });
      const result = await customClient.listEquipmentProfiles();

      expect(result).toEqual(mockProfiles);
      expect(fetchFn).toHaveBeenCalledWith(
        'http://localhost:3000/api/equipment-profiles',
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
      );
    });

    it('getEquipmentProfile finds by ID or name', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProfiles,
      });

      const customClient = new TruchaBrewClient({ baseUrl: 'http://localhost:3000', fetch: fetchFn as any });

      // By exact ID
      const byId = await customClient.getEquipmentProfile('eq-1');
      expect(byId.name).toBe('Grainfather G30');

      // By case-insensitive name
      const byName = await customClient.getEquipmentProfile('brewzilla 35l gen 4');
      expect(byName.id).toBe('eq-2');
    });

    it('getEquipmentProfile throws 404 when not found', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProfiles,
      });

      const customClient = new TruchaBrewClient({ baseUrl: 'http://localhost:3000', fetch: fetchFn as any });

      await expect(customClient.getEquipmentProfile('Nonexistent Kettle')).rejects.toThrow(TruchaBrewApiError);
    });

    it('updateEquipmentProfile sends PUT /api/equipment-profiles/:id without server-owned fields', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProfiles[0],
      });

      const customClient = new TruchaBrewClient({ baseUrl: 'http://localhost:3000', fetch: fetchFn as any });
      const input = storedEquipmentToUpdateInput(mockProfiles[0]);

      await customClient.updateEquipmentProfile('eq-1', input);

      expect(fetchFn).toHaveBeenCalledWith(
        'http://localhost:3000/api/equipment-profiles/eq-1',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );

      const callInit = fetchFn.mock.calls[0][1] as RequestInit;
      const sentBody = JSON.parse(callInit.body as string);
      expect(sentBody.id).toBeUndefined();
      expect(sentBody.derivedFromEquipmentId).toBeUndefined();
      expect(sentBody.name).toBe('Grainfather G30');
    });
  });

  describe('McpServer JSON-RPC & Stdio Integration', () => {
    let server: McpServer;

    beforeEach(() => {
      server = createServer(client);
    });

    it('registers equipment tools alongside recipe tools in tools/list', async () => {
      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      expect(res).not.toBeNull();
      const tools = (res!.result as { tools: Array<{ name: string }> }).tools;
      const toolNames = tools.map((t) => t.name);

      // Recipe tools from P1
      expect(toolNames).toContain('list_recipes');
      expect(toolNames).toContain('get_recipe');
      expect(toolNames).toContain('update_recipe');

      // Equipment tools from P2
      expect(toolNames).toContain('list_equipment_profiles');
      expect(toolNames).toContain('get_equipment_profile');
      expect(toolNames).toContain('update_equipment_profile');
    });

    it('handles list_equipment_profiles over JSON-RPC', async () => {
      vi.spyOn(client, 'listEquipmentProfiles').mockResolvedValue(mockProfiles);

      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'list_equipment_profiles',
          arguments: {},
        },
      });

      expect(res).not.toBeNull();
      const result = res!.result as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain('Grainfather G30');
    });

    it('handles get_equipment_profile over JSON-RPC', async () => {
      vi.spyOn(client, 'getEquipmentProfile').mockResolvedValue(mockProfiles[0]);

      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'get_equipment_profile',
          arguments: { id: 'eq-1' },
        },
      });

      expect(res).not.toBeNull();
      const result = res!.result as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain('Equipment Profile: Grainfather G30');
    });

    it('handles update_equipment_profile over JSON-RPC', async () => {
      vi.spyOn(client, 'getEquipmentProfile').mockResolvedValue(mockProfiles[0]);
      vi.spyOn(client, 'updateEquipmentProfile').mockResolvedValue({
        ...mockProfiles[0],
        boilOffRateLPerHour: 3.4,
      });

      const res = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'update_equipment_profile',
          arguments: { id: 'eq-1', boilOffRateLPerHour: 3.4 },
        },
      });

      expect(res).not.toBeNull();
      const result = res!.result as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain('Successfully updated equipment profile "Grainfather G30"');
    });

    it('intercepts create_equipment_profile and delete_equipment_profile as unsupported', async () => {
      const createRes = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'create_equipment_profile', arguments: {} },
      });

      expect(createRes).not.toBeNull();
      const createResult = createRes!.result as { isError: boolean; content: Array<{ text: string }> };
      expect(createResult.isError).toBe(true);
      expect(createResult.content[0].text).toContain('Equipment profile creation is not supported through MCP');

      const deleteRes = await server.handleJsonRpc({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'delete_equipment_profile', arguments: { id: 'eq-1' } },
      });

      expect(deleteRes).not.toBeNull();
      const deleteResult = deleteRes!.result as { isError: boolean; content: Array<{ text: string }> };
      expect(deleteResult.isError).toBe(true);
      expect(deleteResult.content[0].text).toContain('Equipment profile deletion is not supported through MCP');
    });

    it('handles stdio stream messages for equipment tools', async () => {
      vi.spyOn(client, 'listEquipmentProfiles').mockResolvedValue(mockProfiles);

      const inputStream = new PassThrough();
      const outputStream = new PassThrough();

      const lines: string[] = [];
      outputStream.on('data', (chunk) => {
        lines.push(chunk.toString());
      });

      const handle = server.connectStdio(inputStream, outputStream);

      const rpcReq = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'list_equipment_profiles',
          arguments: {},
        },
      };

      inputStream.write(JSON.stringify(rpcReq) + '\n');

      // Allow event loop to process line
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lines.length).toBeGreaterThan(0);
      const parsed = JSON.parse(lines.join(''));
      expect(parsed.id).toBe(10);
      expect(parsed.result.content[0].text).toContain('Grainfather G30');

      handle.close();
    });
  });
});
