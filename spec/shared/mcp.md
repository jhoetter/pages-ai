# MCP server

## Command

`pages-ai mcp serve` — stdio MCP transport.

## Manifest

`pages-ai mcp manifest` → JSON list of tools with JSON Schema parameters (subset of command bus).

## Tools (v1)

- `pagesai_search`
- `pagesai_get_page`
- `pagesai_propose_command`

## Safety

- Read-only tools default; propose requires agent token with `propose` scope.

## Implementation

- Package `@pagesai/agent` uses `@modelcontextprotocol/sdk` (MIT).
