import type { RecipeWriteInput, StoredRecipe } from '@truchabrew/shared-types';
import { TruchaBrewClient, TruchaBrewApiError, TruchaBrewConnectionError } from '../client.ts';

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

export interface McpServerLike {
  registerTool(tool: McpToolDefinition): void;
}

export function checkUnsupportedRecipeAction(name: string): McpToolResult | null {
  if (name === 'create_recipe') {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: Recipe creation is not supported through MCP. Create recipes directly in TruchaBrew or import via Brewfather JSON.',
        },
      ],
      isError: true,
    };
  }
  if (name === 'delete_recipe') {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: Recipe deletion is not supported through MCP to protect against accidental data loss.',
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

export function storedRecipeToWriteInput(stored: StoredRecipe): RecipeWriteInput {
  return {
    name: stored.name,
    author: stored.author,
    styleName: stored.styleName,
    folder: stored.folder ?? null,
    tags: stored.tags ? [...stored.tags] : [],
    bjcpStyleId: stored.bjcpStyleId ?? null,
    notes: stored.notes,
    equipmentId: stored.equipment.id,
    fermentables: stored.fermentables.map((f) => ({ ...f })),
    hops: stored.hops.map((h) => ({ ...h })),
    yeasts: stored.yeasts.map((y) => ({ ...y })),
    miscs: stored.miscs ? stored.miscs.map((m) => ({ ...m })) : [],
    mashProfileId: stored.mashProfile ? stored.mashProfile.id : null,
    fermentationProfileId: stored.fermentationProfile ? stored.fermentationProfile.id : null,
    waterSourceId: stored.waterSourceId ?? null,
    waterTargetId: stored.waterTargetId ?? null,
  };
}

export function createListRecipesTool(client: TruchaBrewClient): McpToolDefinition {
  return {
    name: 'list_recipes',
    description:
      'Search and list recipes from TruchaBrew by query text, folder, or tag. Returns summary vitals and IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query matching recipe name, style, author, folder, or tags',
        },
        q: {
          type: 'string',
          description: 'Alias for query search text',
        },
        folder: {
          type: 'string',
          description: "Folder filter. Use '__unfiled__' to find recipes without a folder.",
        },
        tag: {
          type: 'string',
          description: 'Filter recipes by exact tag name',
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      try {
        const query = typeof args.query === 'string' ? args.query : typeof args.q === 'string' ? args.q : undefined;
        const folder = typeof args.folder === 'string' ? args.folder : undefined;
        const tag = typeof args.tag === 'string' ? args.tag : undefined;

        const recipes = await client.listRecipes({ q: query, folder, tag });

        if (recipes.length === 0) {
          return {
            content: [{ type: 'text', text: 'No recipes found matching the specified criteria.' }],
          };
        }

        const summaryLines = recipes.map((r) => {
          const parts = [
            `• ${r.name} (ID: ${r.id})`,
            `  Style: ${r.styleName || 'Unspecified'} | Equipment: ${r.equipmentName} (${r.batchSizeL}L)`,
            `  Ingredients: ${r.fermentableCount} fermentable(s), ${r.hopCount} hop addition(s)`,
          ];
          if (r.folder) parts.push(`  Folder: ${r.folder}`);
          if (r.tags && r.tags.length > 0) parts.push(`  Tags: ${r.tags.join(', ')}`);
          return parts.join('\n');
        });

        const text = `Found ${recipes.length} recipe(s):\n\n${summaryLines.join('\n\n')}\n\nFull JSON:\n${JSON.stringify(recipes, null, 2)}`;
        return {
          content: [{ type: 'text', text }],
        };
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  };
}

export function createGetRecipeTool(client: TruchaBrewClient): McpToolDefinition {
  return {
    name: 'get_recipe',
    description:
      'Inspect full recipe details by ID, including fermentables, hops, yeasts, miscs, equipment profile, mash/fermentation profiles, and notes.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          description: 'The unique ID of the recipe to inspect',
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      try {
        if (!args.id || typeof args.id !== 'string' || args.id.trim() === '') {
          return {
            content: [{ type: 'text', text: 'Error: The "id" parameter is required and must be a non-empty string.' }],
            isError: true,
          };
        }

        const recipe = await client.getRecipe(args.id.trim());

        const lines = [
          `Recipe: ${recipe.name} (ID: ${recipe.id})`,
          `Style: ${recipe.styleName || 'Unspecified'} | Author: ${recipe.author || 'Anonymous'}`,
          `Equipment: ${recipe.equipment.name} (${recipe.equipment.batchSizeL}L)`,
        ];
        if (recipe.folder) lines.push(`Folder: ${recipe.folder}`);
        if (recipe.tags && recipe.tags.length > 0) lines.push(`Tags: ${recipe.tags.join(', ')}`);
        if (recipe.notes) lines.push(`Notes: ${recipe.notes}`);

        lines.push(`\nFermentables (${recipe.fermentables.length}):`);
        for (const f of recipe.fermentables) {
          lines.push(`  - ${f.name}: ${f.amountKg} kg (${f.type}, ${f.colorSrm} SRM)`);
        }

        lines.push(`\nHops (${recipe.hops.length}):`);
        for (const h of recipe.hops) {
          const boilText = h.boilMins != null ? ` ${h.boilMins} min` : '';
          lines.push(`  - ${h.name}: ${h.amountG}g (${h.use}${boilText}, ${h.alphaAcidPct}% AA)`);
        }

        lines.push(`\nYeasts (${recipe.yeasts.length}):`);
        for (const y of recipe.yeasts) {
          lines.push(`  - ${y.name} (${y.laboratory || 'Unknown'}, ${y.type})`);
        }

        if (recipe.miscs && recipe.miscs.length > 0) {
          lines.push(`\nMiscs (${recipe.miscs.length}):`);
          for (const m of recipe.miscs) {
            lines.push(`  - ${m.name}: ${m.amount} ${m.unit} (${m.use})`);
          }
        }

        const text = `${lines.join('\n')}\n\nFull JSON:\n${JSON.stringify(recipe, null, 2)}`;
        return {
          content: [{ type: 'text', text }],
        };
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  };
}

export function createUpdateRecipeTool(client: TruchaBrewClient): McpToolDefinition {
  return {
    name: 'update_recipe',
    description:
      'Update an existing recipe in TruchaBrew by ID. Modifies recipe details, ingredients (fermentables, hops, yeasts, miscs), profile associations, and notes. Partial updates are automatically merged with existing recipe data.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          description: 'The unique ID of the recipe to update',
        },
        recipe: {
          type: 'object',
          description: 'Optional nested object containing updated recipe fields',
        },
        name: { type: 'string', description: 'Updated recipe name' },
        author: { type: 'string', description: 'Updated author name' },
        styleName: { type: 'string', description: 'Updated style name' },
        folder: { type: ['string', 'null'], description: "Folder category or null for unfiled" },
        tags: { type: 'array', items: { type: 'string' }, description: 'List of tags' },
        bjcpStyleId: { type: ['string', 'null'], description: 'BJCP style code' },
        notes: { type: 'string', description: 'Updated recipe notes or brewing instructions' },
        equipmentId: { type: 'string', description: 'Assigned equipment profile ID' },
        fermentables: { type: 'array', description: 'Full list of fermentables' },
        hops: { type: 'array', description: 'Full list of hop additions' },
        yeasts: { type: 'array', description: 'Full list of yeast strains' },
        miscs: { type: 'array', description: 'Full list of miscellaneous additions' },
        mashProfileId: { type: ['string', 'null'], description: 'Mash profile ID or null' },
        fermentationProfileId: { type: ['string', 'null'], description: 'Fermentation profile ID or null' },
        waterSourceId: { type: ['string', 'null'], description: 'Source water profile ID or null' },
        waterTargetId: { type: ['string', 'null'], description: 'Target water profile ID or null' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      try {
        if (!args.id || typeof args.id !== 'string' || args.id.trim() === '') {
          return {
            content: [{ type: 'text', text: 'Error: The "id" parameter is required and must be a non-empty string.' }],
            isError: true,
          };
        }

        const id = args.id.trim();

        // Extract updates from nested `recipe` object and/or top-level properties
        const nestedRecipe = (args.recipe && typeof args.recipe === 'object' ? args.recipe : {}) as Record<string, unknown>;
        const provided: Record<string, unknown> = { ...nestedRecipe };

        const allowedKeys = [
          'name',
          'author',
          'styleName',
          'folder',
          'tags',
          'bjcpStyleId',
          'notes',
          'equipmentId',
          'fermentables',
          'hops',
          'yeasts',
          'miscs',
          'mashProfileId',
          'fermentationProfileId',
          'waterSourceId',
          'waterTargetId',
        ];

        for (const key of allowedKeys) {
          if (args[key] !== undefined) {
            provided[key] = args[key];
          }
        }

        const requiredFields = [
          'name',
          'author',
          'styleName',
          'notes',
          'equipmentId',
          'fermentables',
          'hops',
          'yeasts',
          'miscs',
          'mashProfileId',
          'fermentationProfileId',
          'waterSourceId',
          'waterTargetId',
        ];

        const hasAllRequired = requiredFields.every((f) => provided[f] !== undefined);

        let writeInput: RecipeWriteInput;

        if (hasAllRequired) {
          writeInput = provided as unknown as RecipeWriteInput;
        } else {
          // Fetch existing recipe to fill in missing fields (auto-merge)
          const existing = await client.getRecipe(id);
          const base = storedRecipeToWriteInput(existing);
          writeInput = {
            ...base,
            ...(provided as Partial<RecipeWriteInput>),
          };
        }

        const updated = await client.updateRecipe(id, writeInput);

        const text = `Successfully updated recipe "${updated.name}" (ID: ${updated.id}).\n\nUpdated Recipe Details:\n${JSON.stringify(updated, null, 2)}`;
        return {
          content: [{ type: 'text', text }],
        };
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  };
}

export function registerRecipeTools(server: McpServerLike, client: TruchaBrewClient): void {
  server.registerTool(createListRecipesTool(client));
  server.registerTool(createGetRecipeTool(client));
  server.registerTool(createUpdateRecipeTool(client));
}
