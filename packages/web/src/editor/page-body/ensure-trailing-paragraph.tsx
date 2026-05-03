import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { useEffect } from "react";
import { usePageBodySurface } from "@/editor/page-body/context";
import { $isTopLevelPaDecorator } from "@/editor/page-body/pa-decorators";
import { $createPaParagraphNode } from "@/editor/page-body/pa-nodes";
import { newTopLevelBlockId } from "@/editor/page-body/new-block-id";

/**
 * Keeps the doc from ending on a decorator-only root (or an empty root) by appending an empty
 * `pa-paragraph`. Must run inside `editor.update`.
 *
 * @returns true if a paragraph was appended
 */
export function $ensureTrailingParagraphInRoot(): boolean {
  const root = $getRoot();
  const last = root.getChildren().at(-1) ?? null;
  const needs =
    root.getChildrenSize() === 0 || (last !== null && $isTopLevelPaDecorator(last));
  if (!needs) {
    return false;
  }
  root.append($createPaParagraphNode(newTopLevelBlockId()));
  return true;
}

/** Registers an update listener that restores the trailing paragraph invariant after edits. */
export function EnsureTrailingParagraphPlugin() {
  const [editor] = useLexicalComposerContext();
  const { bodySyncSuspendedRef } = usePageBodySurface();

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      if (bodySyncSuspendedRef.current) {
        return;
      }
      queueMicrotask(() => {
        editor.update(() => {
          if (bodySyncSuspendedRef.current) {
            return;
          }
          $ensureTrailingParagraphInRoot();
        });
      });
    });
  }, [bodySyncSuspendedRef, editor]);

  return null;
}
