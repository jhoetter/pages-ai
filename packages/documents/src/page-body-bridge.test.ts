import { describe, expect, it } from "vitest";
import { paragraphFromText } from "./rich-text.js";
import {
  ensureLexicalRootHasBlockChildren,
  lexicalEditorJSONFromPageBodyBlocks,
  pageBodyDTOsFromLexicalEditorJSON,
  stripBlockIdFromLexicalNode,
} from "./page-body-bridge.js";
import type { PageBodyBlockDTO } from "@pagesai/core";

describe("page-body-bridge", () => {
  it("empty block list yields Lexical root with one paragraph (Lexical forbids empty root)", () => {
    const lex = lexicalEditorJSONFromPageBodyBlocks([]);
    const kids = lex.root.children ?? [];
    expect(kids.length).toBeGreaterThanOrEqual(1);
    expect(String(kids[0]?.["type"])).toBe("pa-paragraph");
  });

  it("ensureLexicalRootHasBlockChildren patches stale empty roots", () => {
    const patched = ensureLexicalRootHasBlockChildren({
      root: { type: "root", format: "", indent: 0, version: 1, children: [] },
    });
    expect((patched.root.children ?? []).length).toBe(1);
    expect(String(patched.root.children?.[0]?.["type"])).toBe("pa-paragraph");
  });

  it("round-trips empty paragraph legacy content", () => {
    const blocks: PageBodyBlockDTO[] = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        type: "paragraph",
        sort_order: 1000,
        properties: {},
        content: paragraphFromText("hello") as Record<string, unknown>,
      },
    ];
    const lex = lexicalEditorJSONFromPageBodyBlocks(blocks);
    const back = pageBodyDTOsFromLexicalEditorJSON(lex, 1000);
    expect(back).toHaveLength(1);
    expect(back[0].id).toBe(blocks[0].id);
    expect(back[0].type).toBe("paragraph");
    const inner = back[0].content["root"] as Record<string, unknown>;
    const kids = inner["children"] as Array<Record<string, unknown>>;
    expect(kids[0]["type"]).toBe("pa-paragraph");
    const textNode = (kids[0]["children"] as Array<Record<string, unknown>>)?.[0];
    expect(textNode?.["text"]).toBe("hello");
  });

  it("maps heading + divider + file_embed without losing properties", () => {
    const blocks: PageBodyBlockDTO[] = [
      {
        id: "00000000-0000-4000-8000-000000000002",
        type: "heading2",
        sort_order: 1000,
        properties: {},
        content: paragraphFromText("Title") as Record<string, unknown>,
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        type: "divider",
        sort_order: 2000,
        properties: {},
        content: { root: { type: "root", children: [] } },
      },
      {
        id: "00000000-0000-4000-8000-000000000004",
        type: "file_embed",
        sort_order: 3000,
        properties: { asset: { display_name: "x.png", mime_type: "image/png", provider: "hofos" } },
        content: paragraphFromText("") as Record<string, unknown>,
      },
    ];
    const lex = lexicalEditorJSONFromPageBodyBlocks(blocks);
    const dto = pageBodyDTOsFromLexicalEditorJSON(lex, 1000);
    expect(dto.map((d) => d.type)).toEqual(["heading2", "divider", "file_embed"]);
    expect(dto[2].properties["asset"]).toMatchObject({ display_name: "x.png" });
  });

  it("strips blockId recursively", () => {
    const stripped = stripBlockIdFromLexicalNode({
      type: "pa-paragraph",
      blockId: "abc",
      children: [{ type: "text", text: "x", blockId: "should-go", format: 0 }],
    });
    expect(stripped["blockId"]).toBeUndefined();
    const ch = stripped["children"] as Array<Record<string, unknown>>;
    expect(ch[0]["blockId"]).toBeUndefined();
  });
});
