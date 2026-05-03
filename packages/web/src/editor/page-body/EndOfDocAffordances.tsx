import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $isElementNode, $isParagraphNode } from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { $isTopLevelPaDecorator } from "@/editor/page-body/pa-decorators";
import { $createPaParagraphNode, $isPaParagraphNode } from "@/editor/page-body/pa-nodes";
import { newTopLevelBlockId } from "@/editor/page-body/new-block-id";

/** True when the clickable end zone should show the extra hint (last block is not an “open” empty paragraph). */
export function $shouldShowEndZoneHint(): boolean {
  const root = $getRoot();
  const last = root.getChildren().at(-1);
  if (!last) return true;
  if ($isTopLevelPaDecorator(last)) return true;
  if ($isPaParagraphNode(last) && last.getTextContent().trim() === "") return false;
  if ($isParagraphNode(last) && last.getTextContent().trim() === "") return false;
  return true;
}

function focusOrCreateTrailingParagraph(): void {
  const root = $getRoot();
  const last = root.getChildren().at(-1) ?? null;
  if ($isPaParagraphNode(last) && last.getTextContent().trim() === "") {
    last.selectStart();
    return;
  }
  if ($isParagraphNode(last) && !$isTopLevelPaDecorator(last) && last.getTextContent().trim() === "") {
    if ($isElementNode(last)) last.selectStart();
    return;
  }
  const p = $createPaParagraphNode(newTopLevelBlockId());
  root.append(p);
  p.selectStart();
}

/** Hit target under the editor body; copy matches RichText placeholder (slashHint). */
export function ClickToWriteZone(props: { hint: string }) {
  const [editor] = useLexicalComposerContext();
  const [showHint, setShowHint] = useState(true);
  const zoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setShowHint($shouldShowEndZoneHint());
      });
    });
  }, [editor]);

  const onActivate = useCallback(() => {
    editor.update(() => {
      focusOrCreateTrailingParagraph();
    });
    editor.focus();
  }, [editor]);

  const onFocusFromKeyboard = useCallback(() => {
    onActivate();
    requestAnimationFrame(() => {
      zoneRef.current?.blur();
    });
  }, [onActivate]);

  return (
    <div
      ref={zoneRef}
      role="textbox"
      tabIndex={0}
      aria-label={props.hint}
      className={`relative cursor-text outline-none focus:outline-none focus-visible:outline-none ${
        showHint ? "min-h-12 sm:min-h-14" : "min-h-6"
      }`}
      data-testid="click-to-write-zone"
      onMouseDown={(e) => {
        e.preventDefault();
        onActivate();
      }}
      onFocus={onFocusFromKeyboard}
    >
      {showHint ? (
        <p className="pointer-events-none select-none pt-1 text-[15px] leading-[1.65] text-[var(--pa-tertiary)]">
          {props.hint}
        </p>
      ) : null}
    </div>
  );
}
