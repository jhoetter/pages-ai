import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export type McpServerOptions = {
  apiBaseUrl?: string;
  token?: string;
};

async function apiJson(
  base: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; json: unknown }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export async function runMcpServer(opts: McpServerOptions = {}): Promise<void> {
  const base = opts.apiBaseUrl ?? process.env["PAGESAI_API_URL"] ?? "http://127.0.0.1:3399";
  const token = opts.token ?? process.env["PAGESAI_TOKEN"] ?? "";

  const server = new Server(
    { name: "pages-ai", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "pagesai_search",
        description: "Search pages (title and body text)",
        inputSchema: {
          type: "object",
          properties: { q: { type: "string", description: "Search query" } },
          required: ["q"],
        },
      },
      {
        name: "pagesai_get_page",
        description: "Fetch a page and its blocks",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", description: "Page id" } },
          required: ["id"],
        },
      },
      {
        name: "pagesai_run_command",
        description: "Run a PagesAI command envelope via POST /api/commands",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string" },
            payload: { type: "object" },
            actor_id: { type: "string" },
            actor_type: { type: "string", enum: ["human", "agent", "system"] },
          },
          required: ["type", "payload"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    if (name === "pagesai_search") {
      const q = encodeURIComponent(String(args["q"] ?? ""));
      const r = await apiJson(base, token, "GET", `/api/search?q=${q}`);
      return {
        content: [{ type: "text", text: JSON.stringify(r.json) }],
        isError: !r.ok,
      };
    }
    if (name === "pagesai_get_page") {
      const id = String(args["id"] ?? "");
      const r = await apiJson(base, token, "GET", `/api/pages/${encodeURIComponent(id)}`);
      return {
        content: [{ type: "text", text: JSON.stringify(r.json) }],
        isError: !r.ok,
      };
    }
    if (name === "pagesai_run_command") {
      const actorId = typeof args["actor_id"] === "string" ? args["actor_id"] : "mcp";
      const actorType =
        args["actor_type"] === "human" || args["actor_type"] === "system"
          ? args["actor_type"]
          : "agent";
      const r = await apiJson(base, token, "POST", "/api/commands", {
        type: args["type"],
        payload: args["payload"] ?? {},
        actor_id: actorId,
        actor_type: actorType,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(r.json) }],
        isError: !r.ok,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "unknown_tool", name }) }],
      isError: true,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
