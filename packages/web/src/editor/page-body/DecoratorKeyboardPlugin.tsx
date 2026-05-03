import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $createNodeSelection,
  $isNodeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_NORMAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
  type ElementNode,
  type LexicalNode,
  type RangeSelection,
} from "lexical";
import { useEffect } from "react";
import { $isTopLevelPaDecorator } from "@/editor/page-body/pa-decorators";
import { $createPaParagraphNode, $isPaParagraphNode } from "@/editor/page-body/pa-nodes";
import { newTopLevelBlockId } from "@/editor/page-body/new-block-id";

function $isCollapsedAtEndOfTopLevelBlock(sel: RangeSelection): boolean {
  if (!sel.isCollapsed()) {
    return false;
  }
  const anchor = sel.anchor;
  const anchorNode = anchor.getNode();
  if ($isTextNode(anchorNode)) {
    return anchor.offset === anchorNode.getTextContentSize();
  }
  if ($isElementNode(anchorNode) && anchor.type === "element") {
    const size = anchorNode.getChildrenSize();
    if (size === 0) {
      return true;
    }
    return anchor.offset === size;
  }
  return false;
}

function $isCollapsedAtStartOfTopLevelBlock(sel: RangeSelection): boolean {
  if (!sel.isCollapsed()) {
    return false;
  }
  const anchor = sel.anchor;
  if (anchor.type === "text") {
    return anchor.offset === 0;
  }
  if (anchor.type === "element") {
    return anchor.offset === 0;
  }
  return false;
}

function $focusFirstTextAfterDecorator(decorator: LexicalNode): void {
  let after: LexicalNode | null = decorator.getNextSibling();
  while (after !== null && $isTopLevelPaDecorator(after)) {
    after = after.getNextSibling();
  }
  if (after !== null && $isElementNode(after)) {
    after.selectStart();
    return;
  }
  const p = $createPaParagraphNode(newTopLevelBlockId());
  decorator.insertAfter(p);
  p.selectStart();
}

/** Notion-like keyboard behaviour around top-level decorator blocks. */
export function DecoratorKeyboardPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (ev) => {
          if (ev && (ev as KeyboardEvent).shiftKey) {
            return false;
          }
          const sel = $getSelection();
          if (!$isNodeSelection(sel)) {
            return false;
          }
          const nodes = sel.getNodes();
          if (nodes.length !== 1) {
            return false;
          }
          const n = nodes[0];
          if (!$isTopLevelPaDecorator(n)) {
            return false;
          }
          const p = $createPaParagraphNode(newTopLevelBlockId());
          n.insertAfter(p);
          p.selectStart();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        () => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel) || !sel.isCollapsed()) {
            return false;
          }
          const top = sel.anchor.getNode().getTopLevelElementOrThrow();
          const nextTop = top.getNextSibling();
          if (nextTop === null || !$isTopLevelPaDecorator(nextTop)) {
            return false;
          }
          const atEnd =
            $isCollapsedAtEndOfTopLevelBlock(sel) ||
            (($isPaParagraphNode(top) || top.getType() === "paragraph") && top.getTextContent().trim() === "");
          if (!atEnd) {
            return false;
          }
          $focusFirstTextAfterDecorator(nextTop);
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        () => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel) || !sel.isCollapsed()) {
            return false;
          }
          if (!$isCollapsedAtStartOfTopLevelBlock(sel)) {
            return false;
          }
          const top = sel.anchor.getNode().getTopLevelElementOrThrow() as ElementNode;
          const prev = top.getPreviousSibling();
          if (prev === null || !$isTopLevelPaDecorator(prev)) {
            return false;
          }
          const nodeSel = $createNodeSelection();
          nodeSel.add(prev.getKey());
          $setSelection(nodeSel);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor]);

  return null;
}
