# Milestone 45 / Phase 2 — Equipment profile chat tools and client setup

**Date:** 2026-10-09 · **Status:** DRAFT

> Phase 2 of 2 in Milestone 45. Last phase of Milestone 45; Milestone 46 (batches and inventory via chat) follows.

## Problem

Brewers cannot inspect equipment profiles or tune brewhouse losses and efficiency settings through conversational assistants like Claude Code or Gemini CLI, and using external assistants currently lacks client setup guides and an honest disclosure of what data leaves the local machine.

## Proposed approach

Expose equipment profile lookup and parameter updates as tools on the local stdio MCP server, and provide copy-paste client configuration snippets along with an updated privacy boundary in the documentation and discovery records.

## What you can do after this phase

- In Claude Code or Gemini CLI, ask to list or find an equipment profile by name and view its brewhouse parameters, including batch size, boil-off rate, trub chiller loss, brewhouse efficiency, mash efficiency, and mash tun dead space.
- Ask the assistant in natural language to adjust one or more equipment parameters, such as changing boil-off rate or dead space, and see the updated values reflected immediately in TruchaBrew and preserved after page refresh.
- Configure Claude Code and Gemini CLI to connect to the local TruchaBrew MCP server using documented configuration snippets that target the local API URL or a custom port environment variable.
- See clear error explanations in chat when an update supplies invalid values, such as negative volumes or out-of-range efficiency percentages, without modifying the profile or crashing the server.
- Read an explicit privacy disclosure explaining that while TruchaBrew runs locally with no accounts or telemetry, conversational assistants send inspected recipe and equipment profile data to the external model provider.

## What we are not building

- Creating new equipment profiles or deleting existing equipment profiles through chat tools.
- Direct database connection or arbitrary SQLite query execution from the MCP server.
- Remote MCP network listeners or internet-facing endpoints.
- Recipe inspection and update tools (owned by Phase 1).
- Batch tracking and inventory adjustment tools (deferred to Milestone 46).
- An in-app chat user interface hosted inside TruchaBrew.

## Rules and patterns that apply

- `stdio MCP server transport` — Model Context Protocol stdio specification
- `REST API mediation` — all mutations route through existing Fastify endpoints
- `no silent stripping` — full replacement payload validation preserves immutable provenance
- `home network security boundary` — README#Security

## How we will know it works

- Asking the assistant in Claude Code or Gemini CLI to show an equipment profile returns the profile's batch size, boil-off rate, trub loss, efficiency numbers, and mash tun dead space matching the TruchaBrew UI.
- Asking the assistant to change an equipment profile's boil-off rate and mash tun dead space updates the profile in TruchaBrew without modifying other profile fields or creating duplicates.
- Refreshing TruchaBrew shows the updated equipment values persisted in the database.
- Requesting an invalid parameter change, such as a negative batch size or efficiency above maximum, returns an informative validation error in the assistant and leaves the stored profile unchanged.
- Adding the provided configuration snippet to Claude Code or Gemini CLI successfully establishes a connection to the running TruchaBrew instance.
- Setting a custom API endpoint environment variable directs MCP server requests to that target address.
- Documentation in the project guide and discovery records explicitly describes the external model data boundary for MCP chat interactions.
