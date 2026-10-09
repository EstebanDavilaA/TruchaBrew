#!/usr/bin/env node
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TruchaBrewClient } from './client.ts';
import {
  type McpToolDefinition,
  registerRecipeTools,
  checkUnsupportedRecipeAction,
} from './tools/recipes.ts';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class McpServer {
  private readonly tools = new Map<string, McpToolDefinition>();

  registerTool(tool: McpToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getTools(): McpToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async handleJsonRpc(message: unknown): Promise<JsonRpcResponse | null> {
    if (!message || typeof message !== 'object') {
      return {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid Request: payload must be an object' },
      };
    }

    const req = message as Partial<JsonRpcRequest>;
    const id = req.id !== undefined ? req.id : null;
    const isNotification = req.id === undefined;

    if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
      if (isNotification) return null;
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid Request: "jsonrpc" must be "2.0" and "method" must be a string' },
      };
    }

    try {
      switch (req.method) {
        case 'initialize': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: '@truchabrew/mcp-server',
                version: '0.1.0',
              },
            },
          };
        }

        case 'notifications/initialized': {
          return null;
        }

        case 'ping': {
          return {
            jsonrpc: '2.0',
            id,
            result: {},
          };
        }

        case 'tools/list': {
          const toolList = Array.from(this.tools.values()).map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          }));
          return {
            jsonrpc: '2.0',
            id,
            result: { tools: toolList },
          };
        }

        case 'tools/call': {
          const params = (req.params || {}) as { name?: string; arguments?: Record<string, unknown> };
          const toolName = params.name;

          if (!toolName || typeof toolName !== 'string') {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Invalid params: tool name is required' },
            };
          }

          // Check for explicitly unsupported recipe operations (AC-6)
          const unsupportedResult = checkUnsupportedRecipeAction(toolName);
          if (unsupportedResult) {
            return {
              jsonrpc: '2.0',
              id,
              result: unsupportedResult,
            };
          }

          const tool = this.tools.get(toolName);
          if (!tool) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Tool not found: "${toolName}"` },
            };
          }

          const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
          const toolResult = await tool.handler(args);

          return {
            jsonrpc: '2.0',
            id,
            result: toolResult,
          };
        }

        default: {
          if (isNotification) return null;
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: "${req.method}"` },
          };
        }
      }
    } catch (err: unknown) {
      if (isNotification) return null;
      const message = err instanceof Error ? err.message : String(err);
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: `Internal error: ${message}` },
      };
    }
  }

  connectStdio(
    inputStream: NodeJS.ReadableStream = process.stdin,
    outputStream: NodeJS.WritableStream = process.stdout,
  ): { close: () => void } {
    const rl = readline.createInterface({
      input: inputStream,
      terminal: false,
    });

    let queue = Promise.resolve();

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      queue = queue.then(async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          const errorResponse: JsonRpcResponse = {
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error: invalid JSON' },
          };
          outputStream.write(JSON.stringify(errorResponse) + '\n');
          return;
        }

        const response = await this.handleJsonRpc(parsed);
        if (response !== null) {
          outputStream.write(JSON.stringify(response) + '\n');
        }
      });
    });

    return {
      close: () => rl.close(),
    };
  }
}

export function createServer(client?: TruchaBrewClient): McpServer {
  const c = client ?? new TruchaBrewClient();
  const server = new McpServer();
  registerRecipeTools(server, c);
  return server;
}

export function runStdioServer(): void {
  const server = createServer();
  server.connectStdio();
}

// Auto-run if executed directly as script
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runStdioServer();
}

export { TruchaBrewClient } from './client.ts';
export * from './tools/recipes.ts';
