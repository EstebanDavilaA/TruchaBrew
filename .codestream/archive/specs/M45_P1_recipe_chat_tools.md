# Milestone 45 / Phase 1 — Recipe inspection and updates through chat

**Date:** 2026-10-09 · **Status:** DRAFT

> P1 of 2. P2 remains: equipment profile chat tools, client setup for Claude Code and Gemini CLI, and privacy/setup documentation.

## Problem

Brewers using Claude Code or Gemini CLI cannot inspect or update their TruchaBrew recipes from chat without leaving the conversation to edit them manually in the web interface.

## Proposed approach

Provide local stdio Model Context Protocol (MCP) tools that connect chat assistants to TruchaBrew's existing recipe REST API for listing, viewing, and updating recipes. P1 establishes the MCP server foundation, API client, and recipe tools; P2 adds equipment profile tools, client setup, and documentation.

## What you can do after this phase

- Search and list recipes in the TruchaBrew library from chat by name, folder, or tag, seeing summary details and vital stats for matching recipes.
- Inspect full recipe details in chat, including vitals, ingredients (fermentables, hops, yeast, miscs), profile associations, and notes.
- Request recipe modifications in natural language (adjusting amounts, adding or removing ingredients, or editing notes); the changes are applied through the REST API and persist in TruchaBrew.
- Refreshing or navigating to the recipe in the TruchaBrew web app immediately shows the updated recipe with new quantities and recomputed statistics.
- Receive clear error messages in chat when a recipe is not found or when an update fails validation, leaving the existing recipe unchanged in TruchaBrew.

## What we are not building

- Creating new recipes or deleting existing recipes through chat.
- Equipment profile chat tools; that is P2.
- Client configuration files for Claude Code and Gemini CLI, setup documentation, or privacy promise updates; that is P2.
- Direct database access or SQL queries; all operations go through the existing REST API.
- A chat interface or conversational widget inside the TruchaBrew web app.
- Batch logging or inventory adjustment tools; deferred to Milestone 46.
- Remote network MCP listeners or public server exposure.

## Rules and patterns that apply

- `RULES.md` rules 3–5.
- Model Context Protocol (MCP) stdio tool pattern.
- REST API recipe validation pattern.
- `.codestream/PROJECT.md` — local trusted network and database preservation.

## How we will know it works

- [ ] Searching recipes through the MCP tool returns matching recipes with summary vitals from the running TruchaBrew instance.
- [ ] Inspecting a recipe by ID returns the full recipe details including fermentables, hops, yeast, miscs, and notes.
- [ ] Updating a recipe through the MCP tool updates the stored recipe via the REST API and returns the updated details.
- [ ] Opening or refreshing TruchaBrew in the browser shows the updated recipe with new ingredient amounts and calculated values.
- [ ] Attempting to update a non-existent recipe or submitting invalid recipe data returns an error and leaves the database unchanged.
- [ ] Requesting recipe creation or deletion through MCP is rejected as unsupported.
