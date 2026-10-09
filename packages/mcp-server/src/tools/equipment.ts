import type { EquipmentProfile, EquipmentUpdateInput } from '@truchabrew/shared-types';
import { TruchaBrewClient, TruchaBrewApiError, TruchaBrewConnectionError } from '../client.ts';
import type { McpToolDefinition, McpToolResult, McpServerLike } from './recipes.ts';

export function checkUnsupportedEquipmentAction(name: string): McpToolResult | null {
  if (name === 'create_equipment_profile') {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: Equipment profile creation is not supported through MCP. Create equipment profiles directly in TruchaBrew.',
        },
      ],
      isError: true,
    };
  }
  if (name === 'delete_equipment_profile') {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: Equipment profile deletion is not supported through MCP to protect against accidental data loss and breaking recipe references.',
        },
      ],
      isError: true,
    };
  }
  return null;
}

function formatError(err: unknown): McpToolResult {
  if (err instanceof TruchaBrewApiError) {
    const detailsStr = err.details !== undefined ? `\nDetails: ${JSON.stringify(err.details, null, 2)}` : '';
    return {
      content: [{ type: 'text', text: `API Error [${err.code}]: ${err.message}${detailsStr}` }],
      isError: true,
    };
  }
  if (err instanceof TruchaBrewConnectionError) {
    return {
      content: [{ type: 'text', text: `Connection Error: ${err.message}` }],
      isError: true,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text', text: `Error: ${msg}` }],
    isError: true,
  };
}

export function storedEquipmentToUpdateInput(profile: EquipmentProfile): EquipmentUpdateInput {
  return {
    name: profile.name,
    batchSizeL: profile.batchSizeL,
    boilTimeMin: profile.boilTimeMin,
    brewhouseEfficiencyPct: profile.brewhouseEfficiencyPct,
    mashEfficiencyPct: profile.mashEfficiencyPct,
    boilOffRateLPerHour: profile.boilOffRateLPerHour,
    trubChillerLossL: profile.trubChillerLossL,
    hopUtilizationPct: profile.hopUtilizationPct,
    mashWaterRatioLPerKg: profile.mashWaterRatioLPerKg,
    grainAbsorptionLPerKg: profile.grainAbsorptionLPerKg,
    hopstandUtilizationFactor: profile.hopstandUtilizationFactor,
    hopstandTemperatureC: profile.hopstandTemperatureC,
    spargeTemperatureC: profile.spargeTemperatureC,
    mashTunHeatCapacityL: profile.mashTunHeatCapacityL,
    grainTemperatureC: profile.grainTemperatureC,
    notes: profile.notes,
    ...(profile.altitudeMeters !== undefined ? { altitudeMeters: profile.altitudeMeters } : {}),
    ...(profile.calcStrikeWithThermalMass !== undefined
      ? { calcStrikeWithThermalMass: profile.calcStrikeWithThermalMass }
      : {}),
    ...(profile.mashTunDeadSpaceL !== undefined ? { mashTunDeadSpaceL: profile.mashTunDeadSpaceL } : {}),
    ...(profile.kettleLossL !== undefined ? { kettleLossL: profile.kettleLossL } : {}),
    ...(profile.mashTunWeightKg !== undefined ? { mashTunWeightKg: profile.mashTunWeightKg } : {}),
    ...(profile.mashTunHeatCapacity !== undefined ? { mashTunHeatCapacity: profile.mashTunHeatCapacity } : {}),
  };
}

export function validateEquipmentUpdates(updates: Record<string, unknown>): string | null {
  if ('batchSizeL' in updates && updates.batchSizeL !== undefined) {
    const val = updates.batchSizeL;
    if (typeof val !== 'number' || isNaN(val) || val <= 0) {
      return `Validation Error: batchSizeL must be a positive number greater than 0 (got ${val}).`;
    }
  }
  if ('boilTimeMin' in updates && updates.boilTimeMin !== undefined) {
    const val = updates.boilTimeMin;
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 600) {
      return `Validation Error: boilTimeMin must be between 0 and 600 minutes (got ${val}).`;
    }
  }
  if ('brewhouseEfficiencyPct' in updates && updates.brewhouseEfficiencyPct !== undefined) {
    const val = updates.brewhouseEfficiencyPct;
    if (typeof val !== 'number' || isNaN(val) || val <= 0 || val > 100) {
      return `Validation Error: brewhouseEfficiencyPct must be greater than 0 and at most 100 percent (got ${val}).`;
    }
  }
  if ('mashEfficiencyPct' in updates && updates.mashEfficiencyPct !== undefined) {
    const val = updates.mashEfficiencyPct;
    if (typeof val !== 'number' || isNaN(val) || val <= 0 || val > 100) {
      return `Validation Error: mashEfficiencyPct must be greater than 0 and at most 100 percent (got ${val}).`;
    }
  }
  if ('boilOffRateLPerHour' in updates && updates.boilOffRateLPerHour !== undefined) {
    const val = updates.boilOffRateLPerHour;
    if (typeof val !== 'number' || isNaN(val) || val < 0) {
      return `Validation Error: boilOffRateLPerHour must be a non-negative number (got ${val}).`;
    }
  }
  if ('trubChillerLossL' in updates && updates.trubChillerLossL !== undefined) {
    const val = updates.trubChillerLossL;
    if (typeof val !== 'number' || isNaN(val) || val < 0) {
      return `Validation Error: trubChillerLossL must be a non-negative number (got ${val}).`;
    }
  }
  if ('mashTunDeadSpaceL' in updates && updates.mashTunDeadSpaceL !== undefined) {
    const val = updates.mashTunDeadSpaceL;
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 500) {
      return `Validation Error: mashTunDeadSpaceL must be between 0 and 500 liters (got ${val}).`;
    }
  }
  if ('kettleLossL' in updates && updates.kettleLossL !== undefined) {
    const val = updates.kettleLossL;
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 500) {
      return `Validation Error: kettleLossL must be between 0 and 500 liters (got ${val}).`;
    }
  }
  if ('mashWaterRatioLPerKg' in updates && updates.mashWaterRatioLPerKg !== undefined) {
    const val = updates.mashWaterRatioLPerKg;
    if (typeof val !== 'number' || isNaN(val) || val <= 0 || val > 10) {
      return `Validation Error: mashWaterRatioLPerKg must be between 0 and 10 L/kg (got ${val}).`;
    }
  }
  if ('grainAbsorptionLPerKg' in updates && updates.grainAbsorptionLPerKg !== undefined) {
    const val = updates.grainAbsorptionLPerKg;
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 5) {
      return `Validation Error: grainAbsorptionLPerKg must be between 0 and 5 L/kg (got ${val}).`;
    }
  }
  if ('hopUtilizationPct' in updates && updates.hopUtilizationPct !== undefined) {
    const val = updates.hopUtilizationPct;
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 200) {
      return `Validation Error: hopUtilizationPct must be between 0 and 200 percent (got ${val}).`;
    }
  }
  if ('hopstandUtilizationFactor' in updates && updates.hopstandUtilizationFactor !== undefined) {
    const val = updates.hopstandUtilizationFactor;
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 1) {
      return `Validation Error: hopstandUtilizationFactor must be between 0 and 1 (got ${val}).`;
    }
  }
  if ('hopstandTemperatureC' in updates && updates.hopstandTemperatureC !== undefined) {
    const val = updates.hopstandTemperatureC;
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 100) {
      return `Validation Error: hopstandTemperatureC must be between 0 and 100 °C (got ${val}).`;
    }
  }
  if ('spargeTemperatureC' in updates && updates.spargeTemperatureC !== undefined) {
    const val = updates.spargeTemperatureC;
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 100) {
      return `Validation Error: spargeTemperatureC must be between 0 and 100 °C (got ${val}).`;
    }
  }
  if ('mashTunHeatCapacityL' in updates && updates.mashTunHeatCapacityL !== undefined) {
    const val = updates.mashTunHeatCapacityL;
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 50) {
      return `Validation Error: mashTunHeatCapacityL must be between 0 and 50 L (got ${val}).`;
    }
  }
  if ('grainTemperatureC' in updates && updates.grainTemperatureC !== undefined) {
    const val = updates.grainTemperatureC;
    if (typeof val !== 'number' || isNaN(val) || val < -20 || val > 50) {
      return `Validation Error: grainTemperatureC must be between -20 and 50 °C (got ${val}).`;
    }
  }
  if ('name' in updates && updates.name !== undefined) {
    const val = updates.name;
    if (typeof val !== 'string' || val.trim().length === 0) {
      return 'Validation Error: name must be a non-empty string.';
    }
  }
  return null;
}

export function createListEquipmentProfilesTool(client: TruchaBrewClient): McpToolDefinition {
  return {
    name: 'list_equipment_profiles',
    description:
      'List equipment profiles configured in TruchaBrew with name, batchSizeL, boilOffRateLPerHour, trubChillerLossL, brewhouseEfficiencyPct, mashEfficiencyPct, and mashTunDeadSpaceL.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional search text to filter profiles by name',
        },
        q: {
          type: 'string',
          description: 'Alias for query search text',
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      try {
        const query = typeof args.query === 'string' ? args.query : typeof args.q === 'string' ? args.q : undefined;
        let profiles = await client.listEquipmentProfiles();

        if (query && query.trim() !== '') {
          const qLower = query.trim().toLowerCase();
          profiles = profiles.filter((p) => p.name.toLowerCase().includes(qLower));
        }

        if (profiles.length === 0) {
          return {
            content: [{ type: 'text', text: 'No equipment profiles found matching the specified criteria.' }],
          };
        }

        const lines = profiles.map((p) => {
          const deadSpace = p.mashTunDeadSpaceL ?? 0;
          return [
            `• ${p.name} (ID: ${p.id})`,
            `  Batch Size: ${p.batchSizeL}L | Boil-Off Rate: ${p.boilOffRateLPerHour} L/h | Trub/Chiller Loss: ${p.trubChillerLossL}L`,
            `  Brewhouse Efficiency: ${p.brewhouseEfficiencyPct}% | Mash Efficiency: ${p.mashEfficiencyPct}% | Mash Tun Dead Space: ${deadSpace}L`,
          ].join('\n');
        });

        const text = `Found ${profiles.length} equipment profile(s):\n\n${lines.join('\n\n')}\n\nFull JSON:\n${JSON.stringify(profiles, null, 2)}`;
        return {
          content: [{ type: 'text', text }],
        };
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  };
}

export function createGetEquipmentProfileTool(client: TruchaBrewClient): McpToolDefinition {
  return {
    name: 'get_equipment_profile',
    description:
      'Fetch equipment profile details by ID or name, including brewhouse parameters, boil-off rate, trub chiller loss, efficiencies, and mash tun dead space.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Equipment profile ID',
        },
        name: {
          type: 'string',
          description: 'Equipment profile name (case-insensitive)',
        },
        query: {
          type: 'string',
          description: 'Equipment profile ID or name',
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      try {
        const idOrName = (args.id || args.name || args.query) as string | undefined;
        if (!idOrName || typeof idOrName !== 'string' || idOrName.trim() === '') {
          return {
            content: [{ type: 'text', text: 'Error: An equipment profile ID or name is required.' }],
            isError: true,
          };
        }

        const p = await client.getEquipmentProfile(idOrName.trim());

        const lines = [
          `Equipment Profile: ${p.name} (ID: ${p.id})`,
          `Batch Size: ${p.batchSizeL}L`,
          `Boil Time: ${p.boilTimeMin} min`,
          `Boil-Off Rate: ${p.boilOffRateLPerHour} L/h`,
          `Trub / Chiller Loss: ${p.trubChillerLossL} L`,
          `Brewhouse Efficiency: ${p.brewhouseEfficiencyPct}%`,
          `Mash Efficiency: ${p.mashEfficiencyPct}%`,
          `Mash Tun Dead Space: ${p.mashTunDeadSpaceL ?? 0} L`,
          `Mash Water Ratio: ${p.mashWaterRatioLPerKg} L/kg`,
          `Grain Absorption: ${p.grainAbsorptionLPerKg} L/kg`,
          `Hop Utilization: ${p.hopUtilizationPct}%`,
          `Hopstand Utilization Factor: ${p.hopstandUtilizationFactor}`,
          `Hopstand Temperature: ${p.hopstandTemperatureC}°C`,
          `Sparge Temperature: ${p.spargeTemperatureC}°C`,
          `Mash Tun Heat Capacity: ${p.mashTunHeatCapacityL} L`,
          `Grain Starting Temperature: ${p.grainTemperatureC}°C`,
        ];

        if (p.notes) {
          lines.push(`Notes: ${p.notes}`);
        }

        const text = `${lines.join('\n')}\n\nFull JSON:\n${JSON.stringify(p, null, 2)}`;
        return {
          content: [{ type: 'text', text }],
        };
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  };
}

export function createUpdateEquipmentProfileTool(client: TruchaBrewClient): McpToolDefinition {
  return {
    name: 'update_equipment_profile',
    description:
      'Update equipment profile parameters in TruchaBrew by ID or name. Supports partial updates, merging modified fields into the existing profile before updating. Modifiable fields include batchSizeL, boilOffRateLPerHour, trubChillerLossL, brewhouseEfficiencyPct, mashEfficiencyPct, mashTunDeadSpaceL, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique ID of the equipment profile to update',
        },
        name: {
          type: 'string',
          description: 'Profile name (used to look up profile if id is omitted, or new name if id is provided)',
        },
        profile: {
          type: 'object',
          description: 'Optional nested object containing updated equipment parameters',
        },
        batchSizeL: { type: 'number', description: 'Target batch size in liters (> 0)' },
        boilTimeMin: { type: 'number', description: 'Boil time in minutes (0-600)' },
        boilOffRateLPerHour: { type: 'number', description: 'Boil-off rate in L/h (>= 0)' },
        trubChillerLossL: { type: 'number', description: 'Trub / chiller loss in liters (>= 0)' },
        brewhouseEfficiencyPct: { type: 'number', description: 'Brewhouse efficiency percentage (0-100]' },
        mashEfficiencyPct: { type: 'number', description: 'Mash efficiency percentage (0-100]' },
        mashTunDeadSpaceL: { type: 'number', description: 'Mash tun dead space in liters (0-500)' },
        hopUtilizationPct: { type: 'number', description: 'Hop utilization percentage (0-200)' },
        mashWaterRatioLPerKg: { type: 'number', description: 'Mash water ratio in L/kg (0-10)' },
        grainAbsorptionLPerKg: { type: 'number', description: 'Grain absorption in L/kg (0-5)' },
        hopstandUtilizationFactor: { type: 'number', description: 'Hopstand utilization factor (0-1)' },
        hopstandTemperatureC: { type: 'number', description: 'Hopstand temperature in °C (0-100)' },
        spargeTemperatureC: { type: 'number', description: 'Sparge temperature in °C (0-100)' },
        mashTunHeatCapacityL: { type: 'number', description: 'Mash tun heat capacity (0-50 L)' },
        grainTemperatureC: { type: 'number', description: 'Grain starting temperature (-20 to 50 °C)' },
        notes: { type: 'string', description: 'Equipment notes' },
        altitudeMeters: { type: 'number', description: 'Altitude in meters (-500 to 9000)' },
        calcStrikeWithThermalMass: { type: 'boolean', description: 'Calculate strike water with thermal mass' },
        kettleLossL: { type: 'number', description: 'Kettle loss in liters (0-500)' },
        mashTunWeightKg: { type: 'number', description: 'Mash tun weight in kg (0-500)' },
        mashTunHeatCapacity: { type: 'number', description: 'Mash tun heat capacity (0-5)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      try {
        const nested = (args.profile && typeof args.profile === 'object' ? args.profile : {}) as Record<
          string,
          unknown
        >;

        // Target lookup identifier
        const targetId = typeof args.id === 'string' && args.id.trim() !== '' ? args.id.trim() : undefined;
        const targetName =
          typeof args.name === 'string' && args.name.trim() !== ''
            ? args.name.trim()
            : typeof args.query === 'string' && args.query.trim() !== ''
              ? args.query.trim()
              : typeof nested.name === 'string' && nested.name.trim() !== ''
                ? nested.name.trim()
                : undefined;

        const lookupIdentifier = targetId ?? targetName;
        if (!lookupIdentifier) {
          return {
            content: [{ type: 'text', text: 'Error: An equipment profile ID or name is required to update.' }],
            isError: true,
          };
        }

        // Collect all updates from nested `profile` and top-level properties
        const allowedUpdateKeys = [
          'batchSizeL',
          'boilTimeMin',
          'boilOffRateLPerHour',
          'trubChillerLossL',
          'brewhouseEfficiencyPct',
          'mashEfficiencyPct',
          'mashTunDeadSpaceL',
          'hopUtilizationPct',
          'mashWaterRatioLPerKg',
          'grainAbsorptionLPerKg',
          'hopstandUtilizationFactor',
          'hopstandTemperatureC',
          'spargeTemperatureC',
          'mashTunHeatCapacityL',
          'grainTemperatureC',
          'notes',
          'altitudeMeters',
          'calcStrikeWithThermalMass',
          'kettleLossL',
          'mashTunWeightKg',
          'mashTunHeatCapacity',
        ];

        const providedUpdates: Record<string, unknown> = {};

        for (const key of allowedUpdateKeys) {
          if (nested[key] !== undefined) {
            providedUpdates[key] = nested[key];
          }
          if (args[key] !== undefined) {
            providedUpdates[key] = args[key];
          }
        }

        // If targetId was given and args.name was also provided, treat args.name as a name change
        if (targetId && typeof args.name === 'string' && args.name.trim() !== '') {
          providedUpdates.name = args.name.trim();
        } else if (typeof nested.newName === 'string' && nested.newName.trim() !== '') {
          providedUpdates.name = nested.newName.trim();
        } else if (typeof args.newName === 'string' && args.newName.trim() !== '') {
          providedUpdates.name = args.newName.trim();
        }

        // Validate updates
        const validationError = validateEquipmentUpdates(providedUpdates);
        if (validationError) {
          return {
            content: [{ type: 'text', text: validationError }],
            isError: true,
          };
        }

        // Fetch existing profile to populate base update input (auto-merge)
        const existing = await client.getEquipmentProfile(lookupIdentifier);
        const base = storedEquipmentToUpdateInput(existing);

        const mergedInput: EquipmentUpdateInput = {
          ...base,
          ...(providedUpdates as Partial<EquipmentUpdateInput>),
        };

        // Extra safety: delete server-owned fields if present
        delete (mergedInput as Record<string, unknown>).id;
        delete (mergedInput as Record<string, unknown>).derivedFromEquipmentId;

        const updated = await client.updateEquipmentProfile(existing.id, mergedInput);

        const lines = [
          `Successfully updated equipment profile "${updated.name}" (ID: ${updated.id}).`,
          '',
          'Updated Parameters:',
          `• Batch Size: ${updated.batchSizeL}L`,
          `• Boil-Off Rate: ${updated.boilOffRateLPerHour} L/h`,
          `• Trub / Chiller Loss: ${updated.trubChillerLossL} L`,
          `• Brewhouse Efficiency: ${updated.brewhouseEfficiencyPct}%`,
          `• Mash Efficiency: ${updated.mashEfficiencyPct}%`,
          `• Mash Tun Dead Space: ${updated.mashTunDeadSpaceL ?? 0} L`,
          `• Boil Time: ${updated.boilTimeMin} min`,
          `• Hop Utilization: ${updated.hopUtilizationPct}%`,
        ];

        const text = `${lines.join('\n')}\n\nFull JSON:\n${JSON.stringify(updated, null, 2)}`;
        return {
          content: [{ type: 'text', text }],
        };
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  };
}

export function registerEquipmentTools(server: McpServerLike, client: TruchaBrewClient): void {
  server.registerTool(createListEquipmentProfilesTool(client));
  server.registerTool(createGetEquipmentProfileTool(client));
  server.registerTool(createUpdateEquipmentProfileTool(client));
}
