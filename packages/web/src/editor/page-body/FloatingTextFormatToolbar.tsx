import { $isAutoLinkNode, $isLinkNode, $toggleLink } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
  type TextFormatType,
} from "lexical";
import { Bold, Code, Italic, Link, Strikethrough, Underline } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

const TOOLBAR_H = 40;
const VIEWPORT_PAD = 8;

type ToolbarUi = {
  top: number;
  left: number;
  placeBelow: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  hasLink: boolean;
};

function $selectionTouchesLink(sel: RangeSelection): boolean {
  for (const node of sel.getNodes()) {
    let n: LexicalNode | null = node;
    while (n !== null) {
      if ($isLinkNode(n) || $isAutoLinkNode(n)) {
        return true;
      }
      n = n.getParent();
    }
  }
  return false;
}

function readToolbarModel(editor: LexicalEditor): ToolbarUi | null {
  let out: ToolbarUi | null = null;
  editor.getEditorState().read(() => {
    const sel = $getSelection();
    if (!$isRangeSelection(sel) || sel.isCollapsed()) {
      return;
    }
    const rootEl = editor.getRootElement();
    const native = window.getSelection();
    if (!rootEl || !native || native.rangeCount === 0) {
      return;
    }
    const range = native.getRangeAt(0);
    if (!rootEl.contains(range.commonAncestorContainer)) {
      return;
    }
    if (range.collapsed) {
      return;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return;
    }

    const viewportW = window.innerWidth;
    const cx = rect.left + rect.width / 2;
    let left = cx;
    const barHalf = 120;
    left = Math.min(Math.max(left, VIEWPORT_PAD + barHalf), viewportW - VIEWPORT_PAD - barHalf);

    let topAbove = rect.top + window.scrollY - TOOLBAR_H - 8;
    const placeBelow = topAbove < window.scrollY + VIEWPORT_PAD;
    let top: number;
    if (placeBelow) {
      top = rect.bottom + window.scrollY + 8;
    } else {
      top = topAbove;
    }

    out = {
      top,
      left,
      placeBelow,
      bold: sel.hasFormat("bold"),
      italic: sel.hasFormat("italic"),
      underline: sel.hasFormat("underline"),
      strikethrough: sel.hasFormat("strikethrough"),
      code: sel.hasFormat("code"),
      hasLink: $selectionTouchesLink(sel),
    };
  });
  return out;
}

function syncToolbar(editor: LexicalEditor, setUi: (v: ToolbarUi | null) => void): void {
  requestAnimationFrame(() => {
    setUi(readToolbarModel(editor));
  });
}

/** Notion-style bubble for inline bold / italic / link / … on text selection. */
export function FloatingTextFormatToolbar() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const [ui, setUi] = useState<ToolbarUi | null>(null);

  const update = useCallback(() => {
    syncToolbar(editor, setUi);
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          update();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          setUi(null);
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, update]);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      update();
    });
  }, [editor, update]);

  useEffect(() => {
    const onScroll = () => update();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [update]);

  const dispatchFormat = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    update();
  };

  const onLink = () => {
    let hasLink = false;
    editor.getEditorState().read(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel) && !sel.isCollapsed()) {
        hasLink = $selectionTouchesLink(sel);
      }
    });
    if (hasLink) {
      editor.update(() => {
        $toggleLink(null);
      });
      update();
      return;
    }
    const url = window.prompt(t("editor.linkUrlPrompt"), "https://");
    if (url != null && url.trim() !== "") {
      editor.update(() => {
        $toggleLink(url.trim());
      });
      update();
    }
  };

  if (ui === null) {
    return null;
  }

  const bar = (
    <div
      role="toolbar"
      aria-label={t("editor.textFormatToolbarAria")}
      data-testid="floating-text-format-toolbar"
      className="fixed z-[60] flex items-center gap-0.5 rounded-md border px-1 py-0.5 shadow-lg motion-safe:transition-[opacity,transform]"
      style={{
        top: ui.top,
        left: ui.left,
        transform: ui.placeBelow ? "translateX(-50%)" : "translate(-50%, -100%)",
        borderColor: "var(--pa-divider)",
        background: "var(--pa-bg)",
        boxShadow: "var(--pa-popover-shadow)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <FmtBtn
        label={t("editor.textFormatBold")}
        active={ui.bold}
        onClick={() => dispatchFormat("bold")}
      >
        <Bold className="h-4 w-4" strokeWidth={2} aria-hidden />
      </FmtBtn>
      <FmtBtn
        label={t("editor.textFormatItalic")}
        active={ui.italic}
        onClick={() => dispatchFormat("italic")}
      >
        <Italic className="h-4 w-4" strokeWidth={2} aria-hidden />
      </FmtBtn>
      <FmtBtn
        label={t("editor.textFormatUnderline")}
        active={ui.underline}
        onClick={() => dispatchFormat("underline")}
      >
        <Underline className="h-4 w-4" strokeWidth={2} aria-hidden />
      </FmtBtn>
      <FmtBtn
        label={t("editor.textFormatStrikethrough")}
        active={ui.strikethrough}
        onClick={() => dispatchFormat("strikethrough")}
      >
        <Strikethrough className="h-4 w-4" strokeWidth={2} aria-hidden />
      </FmtBtn>
      <FmtBtn label={t("editor.textFormatCode")} active={ui.code} onClick={() => dispatchFormat("code")}>
        <Code className="h-4 w-4" strokeWidth={2} aria-hidden />
      </FmtBtn>
      <FmtBtn label={t("editor.textFormatLink")} active={ui.hasLink} onClick={onLink}>
        <Link className="h-4 w-4" strokeWidth={2} aria-hidden />
      </FmtBtn>
    </div>
  );

  return createPortal(bar, document.body);
}

function FmtBtn(props: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      title={props.label}
      className={[
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md outline-none",
        "text-[var(--pa-fg)]",
        props.active ? "bg-[var(--pa-hover)]" : "hover:bg-[var(--pa-hover)]",
      ].join(" ")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
