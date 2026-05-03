// @vitest-environment jsdom

import { AutoLinkNode, LinkNode } from "@lexical/link";
import { createEditor, $getRoot } from "lexical";
import { describe, expect, it } from "vitest";
import { PaDividerNode, PAGE_BODY_DECORATOR_NODES, $isTopLevelPaDecorator } from "@/editor/page-body/pa-decorators";
import { $ensureTrailingParagraphInRoot } from "@/editor/page-body/ensure-trailing-paragraph";
import { $createPaParagraphNode, $isPaParagraphNode, PAGE_BODY_ELEMENT_NODES } from "@/editor/page-body/pa-nodes";

const testNodes = [...PAGE_BODY_ELEMENT_NODES, ...PAGE_BODY_DECORATOR_NODES, LinkNode, AutoLinkNode];

function withDomRoot(editor: ReturnType<typeof createEditor>): void {
  const rootEl = document.createElement("div");
  document.body.appendChild(rootEl);
  editor.setRootElement(rootEl);
}

describe("trailing paragraph invariant", () => {
  it("detects when the root needs a trailing paragraph (decorator last)", () => {
    const editor = createEditor({
      namespace: "test-decorator-type",
      onError: (e) => {
        throw e;
      },
      nodes: testNodes,
    });
    withDomRoot(editor);

    editor.update(() => {
      const d = new PaDividerNode("d1");
      expect($isTopLevelPaDecorator(d)).toBe(true);
      expect(d.getType()).toBe("pa-divider");
    });
  });

  it("detects when the root does not need a trailing paragraph (pa-paragraph last)", () => {
    const editor = createEditor({
      namespace: "test-ensure-trailing-detect",
      onError: (e) => {
        throw e;
      },
      nodes: testNodes,
    });
    withDomRoot(editor);

    editor.update(() => {
      const root = $getRoot();
      root.append($createPaParagraphNode("p1"));
      const last = root.getChildren().at(-1) ?? null;
      expect(last).not.toBeNull();
      expect($isTopLevelPaDecorator(last)).toBe(false);
      expect(root.getChildrenSize()).toBe(1);
    });
  });

  it("$ensureTrailingParagraphInRoot appends after a trailing decorator", () => {
    const editor = createEditor({
      namespace: "test-ensure-after-divider",
      onError: (e) => {
        throw e;
      },
      nodes: testNodes,
    });
    withDomRoot(editor);

    editor.update(() => {
      $getRoot().append(new PaDividerNode("d1"));
      expect($ensureTrailingParagraphInRoot()).toBe(true);
      expect($getRoot().getChildrenSize()).toBe(2);
      expect($isPaParagraphNode($getRoot().getChildren().at(-1) ?? null)).toBe(true);
    });
  });

  it("$ensureTrailingParagraphInRoot appends when the root is empty", () => {
    const editor = createEditor({
      namespace: "test-ensure-trailing-empty",
      onError: (e) => {
        throw e;
      },
      nodes: testNodes,
    });
    withDomRoot(editor);

    editor.update(() => {
      expect($getRoot().getChildrenSize()).toBe(0);
      expect($ensureTrailingParagraphInRoot()).toBe(true);
      expect($getRoot().getChildrenSize()).toBe(1);
      expect($isPaParagraphNode($getRoot().getChildren().at(-1) ?? null)).toBe(true);
    });
  });
});
