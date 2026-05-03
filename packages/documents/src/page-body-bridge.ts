import type { PageBodyBlockDTO } from "@pagesai/core";

export const LEXICAL_EDITOR_STATE_FORMAT = 1;

export type LexicalSerializedRoot = {
  type: "root";
  children?: Array<Record<string, unknown>>;
  direction?: "ltr" | "rtl" | null;
  format?: string | number;
  indent?: number;
  version?: number;
};

export type LexicalSerializedStateShape = {
  root: LexicalSerializedRoot;
};

/** Strip block id from a saved content blob (ids live on the row). */
export function stripBlockIdFromLexicalNode(node: Record<string, unknown>): Record<string, unknown> {
  const { blockId: _b, ...rest } = node;
  const ch = rest["children"];
  if (Array.isArray(ch)) {
    return { ...rest, children: ch.map((c) => stripBlockIdFromLexicalNode(c as Record<string, unknown>)) };
  }
  return { ...rest };
}

/** Inject block id into the top-level Lexical node for editor init. */
export function injectBlockIdIntoLexicalNode(node: Record<string, unknown>, blockId: string): Record<string, unknown> {
  const ch = node["children"];
  if (Array.isArray(ch)) {
    return {
      ...node,
      blockId,
      children: ch.map((c) => injectBlockIdIntoLexicalSubtree(c as Record<string, unknown>)),
    };
  }
  return { ...node, blockId };
}

function injectBlockIdIntoLexicalSubtree(node: Record<string, unknown>): Record<string, unknown> {
  const ch = node["children"];
  if (Array.isArray(ch)) {
    return { ...node, children: ch.map((c) => injectBlockIdIntoLexicalSubtree(c as Record<string, unknown>)) };
  }
  return { ...node };
}

function firstLexicalChild(content: Record<string, unknown>): Record<string, unknown> | null {
  const root = content["root"] as LexicalSerializedRoot | undefined;
  const kids = root?.children;
  if (!kids?.length) return null;
  return kids[0] as Record<string, unknown>;
}

function topLevelLexicalTypeToDbType(node: Record<string, unknown>): string {
  const t = String(node["type"] ?? "paragraph");
  if (t === "pa-heading" || t === "heading") {
    const tag = String(node["tag"] ?? "h1");
    if (tag === "h1") return "heading1";
    if (tag === "h2") return "heading2";
    if (tag === "h3") return "heading3";
    return "heading1";
  }
  if (t === "pa-paragraph" || t === "paragraph") return "paragraph";
  if (t === "pa-quote" || t === "quote") return "quote";
  if (t === "pa-list") {
    const ch = node["children"] as Array<Record<string, unknown>> | undefined;
    const list = ch?.[0];
    const lt = String(list?.["listType"] ?? "bullet");
    return lt === "number" ? "numbered" : "bullet";
  }
  if (t === "pa-code" || t === "code") return "code";
  if (t === "pa-divider") return "divider";
  if (t === "pa-file-embed") return "file_embed";
  if (t === "pa-legacy") return String(node["dbType"] ?? "paragraph");
  return "paragraph";
}

/**
 * Serialize Lexical document JSON (root with top-level block nodes carrying `blockId`) into `page.body_sync` DTO rows.
 */
export function pageBodyDTOsFromLexicalEditorJSON(
  state: LexicalSerializedStateShape,
  sortOrderBase = 1000,
): PageBodyBlockDTO[] {
  const children = state.root.children ?? [];
  return children.map((raw, i) => {
    const node = raw as Record<string, unknown>;
    const id = typeof node["blockId"] === "string" ? node["blockId"] : undefined;
    const sort_order = sortOrderBase * (i + 1);
    const lexType = String(node["type"] ?? "pa-paragraph");

    if (lexType === "pa-divider") {
      return {
        id,
        type: "divider",
        sort_order,
        properties: {},
        content: { root: { type: "root", children: [] } },
      };
    }

    if (lexType === "pa-file-embed") {
      const properties =
        typeof node["legacyProperties"] === "object" && node["legacyProperties"] !== null
          ? { ...(node["legacyProperties"] as Record<string, unknown>) }
          : {};
      const content =
        typeof node["legacyContent"] === "object" && node["legacyContent"] !== null
          ? (node["legacyContent"] as Record<string, unknown>)
          : { root: { type: "root", children: [] } };
      return { id, type: "file_embed", sort_order, properties, content };
    }

    if (lexType === "pa-legacy") {
      const dbType = String(node["dbType"] ?? "paragraph");
      const properties =
        typeof node["legacyProperties"] === "object" && node["legacyProperties"] !== null
          ? { ...(node["legacyProperties"] as Record<string, unknown>) }
          : {};
      const content =
        typeof node["legacyContent"] === "object" && node["legacyContent"] !== null
          ? (node["legacyContent"] as Record<string, unknown>)
          : { root: { type: "root", children: [] } };
      return { id, type: dbType, sort_order, properties, content };
    }

    const stripped = stripBlockIdFromLexicalNode(node);
    const dbType = topLevelLexicalTypeToDbType(node);
    const content: Record<string, unknown> = { root: { type: "root", children: [stripped] } };

    return {
      id,
      type: dbType,
      sort_order,
      properties: {},
      content,
    };
  });
}

function createEmptyPaParagraphLexicalNode(blockId: string): Record<string, unknown> {
  return injectBlockIdIntoLexicalNode(
    {
      type: "pa-paragraph",
      format: "",
      indent: 0,
      direction: null,
      version: 1,
      children: [{ type: "text", text: "", format: 0 }],
    },
    blockId,
  );
}

/**
 * Build Lexical serialized editor state from persisted page body blocks (sorted ascending).
 * Lexical forbids an empty root — when there are no blocks (or every row maps to nothing),
 * we seed one empty paragraph so LexicalComposer can mount.
 */
export function lexicalEditorJSONFromPageBodyBlocks(blocks: PageBodyBlockDTO[]): LexicalSerializedStateShape {
  const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order);
  const children: Array<Record<string, unknown>> = [];

  for (const b of sorted) {
    const child = blockRowToTopLexicalNode(b);
    if (child) children.push(child);
  }

  if (children.length === 0) {
    children.push(
      createEmptyPaParagraphLexicalNode(
        globalThis.crypto?.randomUUID?.() ?? `tmp-empty-${Date.now()}`,
      ),
    );
  }

  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: LEXICAL_EDITOR_STATE_FORMAT,
      children,
    },
  };
}

/**
 * Lexical rejects editor states whose root has zero children. Call after building state from DB rows
 * so dev servers still work if `@pagesai/documents` `dist/` was not rebuilt after bridge changes.
 */
export function ensureLexicalRootHasBlockChildren(state: LexicalSerializedStateShape): LexicalSerializedStateShape {
  const existing = state.root.children ?? [];
  if (existing.length > 0) return state;
  return {
    root: {
      ...state.root,
      type: "root",
      format: state.root.format ?? "",
      indent: state.root.indent ?? 0,
      version: state.root.version ?? LEXICAL_EDITOR_STATE_FORMAT,
      children: [
        createEmptyPaParagraphLexicalNode(
          globalThis.crypto?.randomUUID?.() ?? `tmp-empty-${Date.now()}`,
        ),
      ],
    },
  };
}

export function blockRowToTopLexicalNode(block: PageBodyBlockDTO): Record<string, unknown> | null {
  const id = block.id ?? globalThis.crypto?.randomUUID?.() ?? `tmp-${block.sort_order}`;
  const inner = firstLexicalChild(block.content);

  switch (block.type) {
    case "heading1":
      return injectBlockIdIntoLexicalNode(
        { type: "pa-heading", tag: "h1", format: "", indent: 0, direction: null, version: 1, children: inner?.children ?? [{ type: "text", text: "", format: 0 }] },
        id,
      );
    case "heading2":
      return injectBlockIdIntoLexicalNode(
        { type: "pa-heading", tag: "h2", format: "", indent: 0, direction: null, version: 1, children: inner?.children ?? [{ type: "text", text: "", format: 0 }] },
        id,
      );
    case "heading3":
      return injectBlockIdIntoLexicalNode(
        { type: "pa-heading", tag: "h3", format: "", indent: 0, direction: null, version: 1, children: inner?.children ?? [{ type: "text", text: "", format: 0 }] },
        id,
      );
    case "quote":
      if (inner?.type === "quote" || inner?.type === "pa-quote") {
        return injectBlockIdIntoLexicalNode({ ...inner, type: "pa-quote" } as Record<string, unknown>, id);
      }
      return injectBlockIdIntoLexicalNode(
        {
          type: "pa-quote",
          format: "",
          indent: 0,
          direction: null,
          version: 1,
          children: inner ? [inner] : [{ type: "paragraph", children: [{ type: "text", text: "", format: 0 }] }],
        },
        id,
      );
    case "bullet": {
      const listInner = {
        type: "list",
        listType: "bullet",
        start: 1,
        tag: "ul",
        version: 1,
        children:
          inner?.type === "listitem"
            ? [inner]
            : [
                {
                  type: "listitem",
                  version: 1,
                  value: 1,
                  children: [
                    inner ?? {
                      type: "paragraph",
                      format: "",
                      indent: 0,
                      direction: null,
                      version: 1,
                      children: [{ type: "text", text: "", format: 0 }],
                    },
                  ],
                },
              ],
      };
      return injectBlockIdIntoLexicalNode(
        {
          type: "pa-list",
          format: "",
          indent: 0,
          direction: null,
          version: 1,
          children: [listInner],
        },
        id,
      );
    }
    case "numbered": {
      const listInner = {
        type: "list",
        listType: "number",
        start: 1,
        tag: "ol",
        version: 1,
        children:
          inner?.type === "listitem"
            ? [inner]
            : [
                {
                  type: "listitem",
                  version: 1,
                  value: 1,
                  children: [
                    inner ?? {
                      type: "paragraph",
                      format: "",
                      indent: 0,
                      direction: null,
                      version: 1,
                      children: [{ type: "text", text: "", format: 0 }],
                    },
                  ],
                },
              ],
      };
      return injectBlockIdIntoLexicalNode(
        {
          type: "pa-list",
          format: "",
          indent: 0,
          direction: null,
          version: 1,
          children: [listInner],
        },
        id,
      );
    }
    case "code":
      return injectBlockIdIntoLexicalNode(
        {
          type: "pa-code",
          language: null,
          version: 1,
          children: inner?.children ?? [{ type: "text", text: "", format: 0 }],
        },
        id,
      );
    case "divider":
      return injectBlockIdIntoLexicalNode({ type: "pa-divider", version: 1 }, id);
    case "file_embed":
      return injectBlockIdIntoLexicalNode(
        {
          type: "pa-file-embed",
          version: 1,
          legacyProperties: block.properties,
          legacyContent: block.content,
        },
        id,
      );
    case "database":
    case "page_link":
    case "todo":
    case "toggle":
    case "callout":
      return injectBlockIdIntoLexicalNode(
        {
          type: "pa-legacy",
          version: 1,
          dbType: block.type,
          legacyProperties: block.properties,
          legacyContent: block.content,
        },
        id,
      );
    default: {
      if (!inner) {
        return injectBlockIdIntoLexicalNode(
          {
            type: "pa-paragraph",
            format: "",
            indent: 0,
            direction: null,
            version: 1,
            children: [{ type: "text", text: "", format: 0 }],
          },
          id,
        );
      }
      if (inner.type === "paragraph" || inner.type === "pa-paragraph") {
        return injectBlockIdIntoLexicalNode({ ...inner, type: "pa-paragraph" } as Record<string, unknown>, id);
      }
      return injectBlockIdIntoLexicalNode(
        {
          type: "pa-paragraph",
          format: "",
          indent: 0,
          direction: null,
          version: 1,
          children: [inner],
        },
        id,
      );
    }
  }
}
