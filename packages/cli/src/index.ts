#!/usr/bin/env node
import { runMcpServer } from "@pagesai/agent";
import { EXIT } from "@pagesai/core";
import { blocksToMarkdown } from "@pagesai/documents";
import { Command } from "commander";
import { readFile } from "node:fs/promises";

function token(): string {
  return process.env["PAGESAI_TOKEN"] ?? "";
}

const program = new Command();
program.name("pages-ai").description("PagesAI CLI").version("0.1.0");
program.option("--format <fmt>", "json|markdown", "json");
program.option("--locale <locale>", "de|en", process.env["PAGESAI_LOCALE"] ?? "en");
program.option(
  "--api-url <url>",
  "API base",
  process.env["PAGESAI_API_URL"] ?? "http://127.0.0.1:3399",
);

function getApiUrl(): string {
  return (program.opts() as { apiUrl: string }).apiUrl.replace(/\/$/, "");
}

function isJsonFormat(): boolean {
  return (program.opts() as { format: string }).format === "json";
}

function printErr(payload: unknown): void {
  if (isJsonFormat()) console.error(JSON.stringify(payload));
  else console.error(payload);
}

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; json: unknown }> {
  const base = getApiUrl();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(token() ? { authorization: `Bearer ${token()}` } : {}),
  };
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  } catch (e) {
    printErr({ error: { code: "NETWORK", message: "fetch failed", details: String(e) } });
    process.exit(EXIT.NETWORK);
    return { ok: false, json: {} };
  }
}

const auth = program.command("auth");
auth
  .command("login")
  .description("Show how to configure token for standalone")
  .action(() => {
    console.log(
      JSON.stringify(
        {
          hint: "Set PAGESAI_TOKEN if server uses PAGESAI_DEV_TOKEN; otherwise open dev mode needs no token.",
        },
        null,
        2,
      ),
    );
  });
auth.command("whoami").action(async () => {
  const r = await api("GET", "/api/spaces");
  console.log(JSON.stringify(r.json, null, 2));
  if (!r.ok) process.exit(EXIT.AUTH);
});
auth
  .command("token")
  .command("create")
  .description("Echo dev token from env when set (v1 stub for standalone auth)")
  .action(() => {
    const dev = process.env["PAGESAI_DEV_TOKEN"]?.trim();
    const tok = token().trim();
    if (isJsonFormat()) {
      console.log(
        JSON.stringify({
          token: dev ?? tok ?? null,
          hint: dev || tok ? "Use Authorization: Bearer <token>" : "Set PAGESAI_DEV_TOKEN on server and export PAGESAI_TOKEN for CLI",
        }),
      );
    } else if (dev || tok) {
      console.log(dev ?? tok);
    } else {
      console.log(
        "Set PAGESAI_DEV_TOKEN on the server and export PAGESAI_TOKEN in your shell for authenticated CLI calls.",
      );
    }
  });

const space = program.command("space");
space.command("list").action(async () => {
  const r = await api("GET", "/api/spaces");
  console.log(JSON.stringify(r.json, null, 2));
});

const page = program.command("page");
page
  .command("create")
  .requiredOption("--title <t>")
  .option("--parent <id>")
  .requiredOption("--space <id>")
  .action(async (opts) => {
    const r = await api("POST", "/api/commands", {
      type: "page.create",
      payload: { space_id: opts.space, parent_page_id: opts.parent, title: opts.title },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
page
  .command("list")
  .requiredOption("--space <id>")
  .option("--parent <id>")
  .option("--all", "List all pages in space (flat)")
  .action(async (opts) => {
    const q = new URLSearchParams({ space_id: opts.space });
    if (opts.parent) q.set("parent_page_id", opts.parent);
    if (opts.all) q.set("all_in_space", "1");
    const r = await api("GET", `/api/pages?${q}`);
    console.log(JSON.stringify(r.json, null, 2));
  });
page
  .command("update")
  .requiredOption("--page <id>")
  .option("--title <t>")
  .option("--icon <emoji>")
  .option("--cover <url>", "cover image URL")
  .option(
    "--cover-position <css>",
    'cover focal point as CSS background-position (e.g. "40% 60%"); omit or empty to clear',
  )
  .option("--parent <id>", "parent page uuid")
  .action(async (opts) => {
    const payload: Record<string, unknown> = { page_id: opts.page };
    if (opts.title) payload.title = opts.title;
    if (opts.icon !== undefined) payload.icon = opts.icon || null;
    if (opts.cover !== undefined) payload.cover_image_url = opts.cover || null;
    if (opts.coverPosition !== undefined) payload.cover_image_position = opts.coverPosition || null;
    if (opts.parent !== undefined) payload.parent_page_id = opts.parent || null;
    const r = await api("POST", "/api/commands", {
      type: "page.update",
      payload,
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
page
  .command("body-sync")
  .description("Replace page body blocks (page.body_sync); JSON file is DTO array or { blocks: [...] }")
  .requiredOption("--page <id>")
  .requiredOption("--file <path>", "JSON file with blocks array")
  .action(async (opts) => {
    const raw = JSON.parse(await readFile(opts.file, "utf8")) as unknown;
    const blocks = Array.isArray(raw) ? raw : (raw as { blocks: unknown }).blocks;
    if (!Array.isArray(blocks)) {
      printErr({ error: "expected array or { blocks: [] }" });
      process.exit(EXIT.VALIDATION);
    }
    const r = await api("POST", "/api/commands", {
      type: "page.body_sync",
      payload: { page_id: opts.page, blocks },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
page
  .command("show")
  .argument("<id>")
  .action(async (id) => {
    const r = await api("GET", `/api/pages/${id}`);
    const fmt = (program.opts() as { format: string }).format;
    if (fmt === "markdown") {
      const body = r.json as { blocks?: Array<{ type: string; content: Record<string, unknown> }> };
      console.log(blocksToMarkdown(body.blocks ?? []));
    } else console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
page
  .command("archive")
  .argument("<id>")
  .action(async (id) => {
    const r = await api("POST", "/api/commands", {
      type: "page.archive",
      payload: { page_id: id, archived: true },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
page
  .command("restore")
  .argument("<id>")
  .description("Un-archive a page")
  .action(async (id) => {
    const r = await api("POST", "/api/commands", {
      type: "page.archive",
      payload: { page_id: id, archived: false },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
page
  .command("move")
  .requiredOption("--page <id>")
  .option("--parent <id>")
  .option("--sort <n>", "sort order (number)", (v) => Number(v))
  .action(async (opts) => {
    const r = await api("POST", "/api/commands", {
      type: "page.move",
      payload: {
        page_id: opts.page,
        parent_page_id: opts.parent,
        sort_order: opts.sort,
      },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });

const block = program.command("block");
block
  .command("list")
  .argument("<pageId>")
  .description("List blocks (page JSON)")
  .action(async (pageId) => {
    const r = await api("GET", `/api/pages/${pageId}`);
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
block
  .command("append")
  .requiredOption("--page <id>")
  .requiredOption("--type <t>")
  .option("--text <t>")
  .action(async (opts) => {
    const r = await api("POST", "/api/commands", {
      type: "block.append",
      payload: { page_id: opts.page, type: opts.type, text: opts.text },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
block
  .command("insert")
  .requiredOption("--after <id>")
  .requiredOption("--type <t>")
  .option("--text <t>")
  .action(async (opts) => {
    const r = await api("POST", "/api/commands", {
      type: "block.insert",
      payload: { after_block_id: opts.after, type: opts.type, text: opts.text },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
block
  .command("update")
  .requiredOption("--block <id>")
  .option("--type <t>")
  .option("--text <t>")
  .action(async (opts) => {
    const r = await api("POST", "/api/commands", {
      type: "block.update",
      payload: { block_id: opts.block, type: opts.type, text: opts.text },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
block
  .command("move")
  .requiredOption("--block <id>")
  .option("--after <id>")
  .option("--parent <id>")
  .action(async (opts) => {
    const r = await api("POST", "/api/commands", {
      type: "block.move",
      payload: {
        block_id: opts.block,
        after_block_id: opts.after,
        parent_block_id: opts.parent,
      },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
block
  .command("delete")
  .requiredOption("--block <id>")
  .action(async (opts) => {
    const r = await api("POST", "/api/commands", {
      type: "block.delete",
      payload: { block_id: opts.block },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });

const db = program.command("db");
db.command("create")
  .requiredOption("--space <id>")
  .requiredOption("--title <t>")
  .action(async (opts) => {
    const r = await api("POST", "/api/commands", {
      type: "db.create",
      payload: { space_id: opts.space, title: opts.title },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
db.command("property")
  .command("add")
  .requiredOption("--database <id>")
  .requiredOption("--name <n>")
  .requiredOption("--type <t>")
  .action(async (opts) => {
    const r = await api("POST", "/api/commands", {
      type: "db.property.add",
      payload: { database_id: opts.database, name: opts.name, type: opts.type },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
db.command("row")
  .command("create")
  .requiredOption("--database <id>")
  .requiredOption("--cells <json>")
  .action(async (opts) => {
    let cells: Record<string, unknown>;
    try {
      cells = JSON.parse(opts.cells) as Record<string, unknown>;
    } catch {
      printErr({ error: { code: "VALIDATION", message: "cells must be JSON object" } });
      process.exit(EXIT.VALIDATION);
      return;
    }
    const r = await api("POST", "/api/commands", {
      type: "db.row.create",
      payload: { database_id: opts.database, cells },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
db.command("view")
  .command("create")
  .requiredOption("--database <id>")
  .requiredOption("--name <n>")
  .requiredOption("--type <t>")
  .action(async (opts) => {
    const r = await api("POST", "/api/commands", {
      type: "db.view.create",
      payload: { database_id: opts.database, name: opts.name, type: opts.type },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
db.command("query")
  .requiredOption("--database <id>")
  .requiredOption("--view <id>")
  .action(async (opts) => {
    const r = await api("POST", `/api/databases/${opts.database}/query`, {
      view_id: opts.view,
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });

program
  .command("search")
  .argument("<q>", "query string")
  .action(async (q) => {
    const r = await api("GET", `/api/search?q=${encodeURIComponent(q)}`);
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });

program
  .command("backlinks")
  .argument("<pageId>")
  .action(async (pageId) => {
    const r = await api("GET", `/api/backlinks/${encodeURIComponent(pageId)}`);
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });

const imprt = program.command("import");
imprt
  .command("markdown")
  .requiredOption("--page <id>")
  .requiredOption("--file <path>", "markdown file")
  .action(async (opts) => {
    const md = await readFile(opts.file, "utf8");
    const r = await api("POST", "/api/commands", {
      type: "import.markdown",
      payload: { page_id: opts.page, markdown: md },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });

program
  .command("export")
  .command("page")
  .argument("<id>")
  .action(async (id) => {
    const r = await api("GET", `/api/pages/${id}`);
    if (!r.ok) {
      console.log(JSON.stringify(r.json, null, 2));
      process.exit(EXIT.VALIDATION);
    }
    const body = r.json as { blocks?: Array<{ type: string; content: Record<string, unknown> }> };
    const fmt = (program.opts() as { format: string }).format;
    if (fmt === "markdown" || fmt === "json") {
      if (fmt === "markdown") console.log(blocksToMarkdown(body.blocks ?? []));
      else console.log(JSON.stringify(r.json, null, 2));
    } else {
      console.log(blocksToMarkdown(body.blocks ?? []));
    }
  });

const proposals = program.command("proposals");
proposals
  .command("list")
  .option("--space <id>")
  .option("--status <s>", "pending|approved|rejected")
  .action(async (opts) => {
    const q = new URLSearchParams();
    if (opts.space) q.set("space_id", opts.space);
    if (opts.status) q.set("status", opts.status);
    const r = await api("GET", `/api/proposals${q.toString() ? `?${q}` : ""}`);
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
proposals
  .command("approve")
  .argument("<id>")
  .action(async (id) => {
    const r = await api("POST", "/api/commands", {
      type: "proposal.approve",
      payload: { proposal_id: id },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });
proposals
  .command("reject")
  .argument("<id>")
  .action(async (id) => {
    const r = await api("POST", "/api/commands", {
      type: "proposal.reject",
      payload: { proposal_id: id },
      actor_id: "cli",
      actor_type: "human",
    });
    console.log(JSON.stringify(r.json, null, 2));
    if (!r.ok) process.exit(EXIT.VALIDATION);
  });

const mcp = program.command("mcp");
mcp.command("manifest").action(() => {
  console.log(
    JSON.stringify(
      {
        tools: [
          { name: "pagesai_search", description: "Search pages" },
          { name: "pagesai_get_page", description: "Get page with blocks" },
          { name: "pagesai_run_command", description: "POST /api/commands" },
        ],
      },
      null,
      2,
    ),
  );
});
mcp
  .command("serve")
  .description("Run MCP server (stdio) — same API surface as CLI")
  .action(async () => {
    await runMcpServer({ apiBaseUrl: getApiUrl(), token: token() });
  });

program.parse();
