# TruchaBrew MCP Server Setup & Client Configuration

TruchaBrew includes a local Model Context Protocol (MCP) server that enables conversational AI assistants—such as **Claude Code**, **Gemini CLI**, and **Claude Desktop**—to inspect and update recipes and equipment profiles in your TruchaBrew brewery.

---

## 1. How It Works

The TruchaBrew MCP server connects external assistants directly to TruchaBrew's REST API using standard input/output (`stdio`).

- **Transport:** stdio (JSON-RPC 2.0).
- **Network Footprint:** The MCP server does not open any external network listeners or ports. It communicates with your running TruchaBrew server over local HTTP (default `http://localhost:3000` or `http://localhost:5177`).
- **Safety Boundaries:** To protect your brewing records and recipe integrity, the MCP server strictly permits querying and modifying existing recipes and equipment profiles. Creating or deleting recipes and equipment profiles via chat is explicitly blocked.

---

## 2. Prerequisites

1. **Node.js 24+** installed.
2. A running TruchaBrew instance (e.g. started via `npm run brew` or `npm start`).
3. Your conversational assistant CLI or client (such as Claude Code or Gemini CLI).

---

## 3. Starting the Server

The MCP server can be launched directly using any of the following commands from the repository root:

- **npm script:**
  ```bash
  npm run mcp
  ```
- **Node directly:**
  ```bash
  node packages/mcp-server/src/index.ts
  ```
- **Or via tsx:**
  ```bash
  npx tsx packages/mcp-server/src/index.ts
  ```
- **When built:**
  ```bash
  node packages/mcp-server/dist/index.js
  ```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `TRUCHABREW_API_URL` | Base URL of the running TruchaBrew API backend. | `http://localhost:3000` |

If TruchaBrew is running on port 5177 (the standard `npm run brew` port), set:
```bash
TRUCHABREW_API_URL=http://localhost:5177
```

---

## 4. Client Configuration Snippets

### A. Claude Code

#### Option 1: Command Line (`claude mcp add`)
Run the following command in your terminal (replace `/path/to/TruchaBrew` with your actual absolute repository path):

```bash
claude mcp add truchabrew -- node /path/to/TruchaBrew/packages/mcp-server/src/index.ts
```

If TruchaBrew is running on port 5177:
```bash
claude mcp add -e TRUCHABREW_API_URL=http://localhost:5177 truchabrew -- node /path/to/TruchaBrew/packages/mcp-server/src/index.ts
```

#### Option 2: Project Configuration (`.mcp.json`)
Create or edit `.mcp.json` in your TruchaBrew repository root:

```json
{
  "mcpServers": {
    "truchabrew": {
      "command": "node",
      "args": ["packages/mcp-server/src/index.ts"],
      "env": {
        "TRUCHABREW_API_URL": "http://localhost:5177"
      }
    }
  }
}
```

---

### B. Gemini CLI

Configure Gemini CLI or Gemini Code Assist by adding the server to your Gemini MCP configuration (e.g. `~/.gemini/settings.json` or `.gemini/mcp.json`):

```json
{
  "mcpServers": {
    "truchabrew": {
      "command": "node",
      "args": ["/path/to/TruchaBrew/packages/mcp-server/src/index.ts"],
      "env": {
        "TRUCHABREW_API_URL": "http://localhost:5177"
      }
    }
  }
}
```

Or using Gemini CLI command registration:
```bash
gemini mcp add truchabrew --command node --args /path/to/TruchaBrew/packages/mcp-server/src/index.ts --env TRUCHABREW_API_URL=http://localhost:5177
```

---

### C. Claude Desktop

In Claude Desktop's configuration file (`claude_desktop_config.json`):
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Add:

```json
{
  "mcpServers": {
    "truchabrew": {
      "command": "node",
      "args": [
        "/path/to/TruchaBrew/packages/mcp-server/src/index.ts"
      ],
      "env": {
        "TRUCHABREW_API_URL": "http://localhost:5177"
      }
    }
  }
}
```

---

## 5. Available Tools

### Recipe Tools
- **`list_recipes`**: Search and list recipes by name, author, style, folder, or tag.
- **`get_recipe`**: Inspect full recipe details, vital statistics, grain bill, hop schedule, yeast, and miscs.
- **`update_recipe`**: Update recipe parameters, ingredients, notes, and profile associations. Partial updates are automatically merged with existing data.

### Equipment Profile Tools
- **`list_equipment_profiles`**: List equipment profiles with key brewing parameters (batch size, boil-off rate, trub chiller loss, brewhouse efficiency, mash efficiency, mash tun dead space).
- **`get_equipment_profile`**: Inspect full equipment profile details by profile ID or name.
- **`update_equipment_profile`**: Adjust brewhouse parameters (e.g. boil-off rate, dead space, trub loss, efficiency percentages). Partial updates are merged with existing profile values.

### Unsupported Operations (Safety Protections)
- `create_recipe` / `delete_recipe`: Blocked to avoid accidental data loss. Recipes are created directly in TruchaBrew or imported via Brewfather JSON.
- `create_equipment_profile` / `delete_equipment_profile`: Blocked to maintain profile provenance and prevent breaking recipe references.

---

## 6. Example Assistant Interactions

Once configured, you can talk naturally to your assistant about your brewery:

- *"List all my equipment profiles in TruchaBrew."*
- *"Show me the details for the Grainfather G30 profile."*
- *"In my Grainfather G30 equipment profile, update the boil-off rate to 3.5 L/hr and mash tun dead space to 1.5 L."*
- *"What recipes do I have tagged as 'Summer'?"*
- *"Check the hop schedule for my West Coast IPA recipe."*

If you supply invalid parameters—such as a negative volume, efficiency over 100%, or an empty profile name—the assistant will report a clear validation error without altering the saved profile.

---

## 7. Privacy & Data Boundary Disclosure

**Important Privacy Notice:**

- **Local-Only Core:** TruchaBrew itself is built from the ground up as a private, self-hosted application. It runs entirely on your local computer, requires no user accounts, has no telemetry, and never uploads your brewing data anywhere.
- **External Assistant Boundary:** When you configure and interact with an external conversational assistant (such as Claude Code by Anthropic or Gemini CLI by Google) through the MCP server:
  1. The MCP server reads the specific recipe or equipment data requested by the assistant from your local TruchaBrew database.
  2. That data is passed via standard output to the assistant running on your machine.
  3. The assistant transmits your prompt and the retrieved data over the internet to the assistant provider's AI model servers (e.g., Anthropic or Google) to generate the conversational response.
  4. Transmission and processing of that data are governed by the terms of service and privacy policies of your chosen AI assistant provider.
- **Opt-In Only:** Using conversational assistants is completely optional. If you do not configure an MCP client, no data ever leaves your computer.
