import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, type LexicalNode } from "lexical";
import { GripVertical, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { $createPaParagraphNode } from "@/editor/page-body/pa-nodes";
import {
  $topLevelBlockId,
  newTopLevelBlockId,
} from "@/editor/page-body/PageBodyEditor";

const PA_BLOCK_DRAG_MIME = "application/x-pa-block-id";

type HoverState = { id: string; rect: DOMRect };
type MenuState = { id: string; x: number; y: number };
type DropState = { targetId: string; pos: "before" | "after"; rect: DOMRect };

/**
 * Notion-style hover handles for top-level blocks:
 *   `+`  inserts a new empty paragraph after the hovered block (focuses it so the user can keep typing or hit `/`)
 *   `⋮⋮` is a drag handle for reordering AND a click target that opens a small actions menu
 *
 * Positioning is done in viewport coordinates (`position: fixed`) relative to the hovered block's
 * bounding rect, so we don't fight the editor's layout (no negative margins or pl-* hacks).
 */
export function BlockHoverHandles(props: { onOpenComments?: (blockId: string) => void }) {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const [hover, setHover] = useState<HoverState | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [drop, setDrop] = useState<DropState | null>(null);
const railRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Latest drop target; must not drive effect deps or listeners detach every dragover. */
  const dropRef = useRef<DropState | null>(null);

  const findTop = useCallback(
    (cb: (kids: LexicalNode[]) => void) => {
      editor.update(() => {
        cb($getRoot().getChildren());
      });
    },
    [editor],
  );

  const insertAfter = useCallback(
    (id: string) => {
      findTop((kids) => {
        const target = kids.find((k) => $topLevelBlockId(k) === id);
        if (!target) return;
        const fresh = $createPaParagraphNode(newTopLevelBlockId());
        target.insertAfter(fresh);
        fresh.selectStart();
      });
    },
    [findTop],
  );

  const removeBlock = useCallback(
    (id: string) => {
      if (!globalThis.confirm?.(t("canvas.deleteBlockConfirm"))) return;
      findTop((kids) => {
        const target = kids.find((k) => $topLevelBlockId(k) === id);
        target?.remove();
        const root = $getRoot();
        if (root.getChildrenSize() === 0) {
          const n = $createPaParagraphNode(newTopLevelBlockId());
          root.append(n);
          n.selectStart();
        }
      });
    },
    [findTop, t],
  );

  const moveBlock = useCallback(
    (sourceId: string, targetId: string, pos: "before" | "after") => {
      if (sourceId === targetId) return;
      findTop((kids) => {
        const source = kids.find((k) => $topLevelBlockId(k) === sourceId);
        const target = kids.find((k) => $topLevelBlockId(k) === targetId);
        if (!source || !target || source === target) return;
        if (pos === "before") target.insertBefore(source);
        else target.insertAfter(source);
      });
    },
    [findTop],
  );

  // --- Hover tracking on the editable surface ---
  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    let raf: number | null = null;
    const onMove = (e: MouseEvent) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const target = e.target as HTMLElement | null;
        const blockEl = target?.closest("[data-block-id]") as HTMLElement | null;
        if (!blockEl) return;
        const id = blockEl.getAttribute("data-block-id");
        if (!id) return;
        setHover({ id, rect: blockEl.getBoundingClientRect() });
      });
    };
    const onLeave = (e: MouseEvent) => {
      // Don't drop the rail if the mouse just moved onto the rail itself.
      const to = e.relatedTarget as Node | null;
      if (to && railRef.current?.contains(to)) return;
      setHover(null);
    };
    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [editor]);

  // --- Recompute hover rect on scroll/resize so the rail tracks the block ---
  useEffect(() => {
    if (!hover) return;
    const recompute = () => {
      const el = document.querySelector(`[data-block-id="${CSS.escape(hover.id)}"]`);
      if (!el) {
        setHover(null);
        return;
      }
      setHover({ id: hover.id, rect: el.getBoundingClientRect() });
    };
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [hover]);

  useEffect(() => {
    dropRef.current = drop;
  }, [drop]);

  // Clear stale drop state when drag ends anywhere (e.g. cancel outside editor).
  useEffect(() => {
    if (!dragging) return;
    const onDocDragEnd = () => {
      setDragging(false);
      dropRef.current = null;
      setDrop(null);
    };
    document.addEventListener("dragend", onDocDragEnd);
    return () => document.removeEventListener("dragend", onDocDragEnd);
  }, [dragging]);

  // Drag-over indicator while dragging a block handle
  useEffect(() => {
    if (!dragging) return;
    const root = editor.getRootElement();
    if (!root) return;
    const onOver = (e: DragEvent) => {
      const types = e.dataTransfer?.types;
      if (!types) return;
      const list = Array.from(types);
      if (!list.includes(PA_BLOCK_DRAG_MIME) && !list.includes("text/plain")) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      const target = e.target as HTMLElement | null;
      const blockEl = target?.closest("[data-block-id]") as HTMLElement | null;
      if (!blockEl) return;
      const id = blockEl.getAttribute("data-block-id");
      if (!id) return;
      const rect = blockEl.getBoundingClientRect();
      const pos: "before" | "after" =
        e.clientY < rect.top + rect.height / 2 ? "before" : "after";
      setDrop((prev) => {
        if (prev && prev.targetId === id && prev.pos === pos) return prev;
        const next: DropState = { targetId: id, pos, rect };
        dropRef.current = next;
        return next;
      });
    };
    const onDropEv = (e: DragEvent) => {
      const sourceId =
        e.dataTransfer?.getData(PA_BLOCK_DRAG_MIME) || e.dataTransfer?.getData("text/plain");
      if (!sourceId) return;
      e.preventDefault();
      const current = dropRef.current;
      dropRef.current = null;
      setDrop(null);
      setDragging(false);
      if (!current) return;
      moveBlock(sourceId, current.targetId, current.pos);
    };
    root.addEventListener("dragover", onOver);
    root.addEventListener("drop", onDropEv);
    return () => {
      root.removeEventListener("dragover", onOver);
      root.removeEventListener("drop", onDropEv);
    };
  }, [editor, dragging, moveBlock]);

  // --- Close the actions menu on outside click / escape ---
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const ts = setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(ts);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <>
      {hover ? (
        <div
          ref={railRef}
          style={{
            position: "fixed",
            top: hover.rect.top + 2,
            left: Math.max(4, hover.rect.left - 48),
            zIndex: 30,
          }}
          className="flex items-center gap-0 transition-opacity"
        >
          <button
            type="button"
            title={t("canvas.addBlockAfter")}
            aria-label={t("canvas.addBlockAfter")}
            data-testid="block-handle-add"
            className="h-6 w-6 flex items-center justify-center rounded text-[var(--pa-tertiary)] hover:bg-[var(--pa-hover)] hover:text-[var(--pa-fg)]"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertAfter(hover.id)}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            draggable
            title={t("canvas.dragOrMenu")}
            aria-label={t("canvas.dragOrMenu")}
            data-testid="block-handle-grip"
            className="h-6 w-6 flex items-center justify-center rounded text-[var(--pa-tertiary)] hover:bg-[var(--pa-hover)] hover:text-[var(--pa-fg)] cursor-grab active:cursor-grabbing"
            onClick={(e) => setMenu({ id: hover.id, x: e.clientX, y: e.clientY })}
            onDragStart={(e) => {
              if (!e.dataTransfer) return;
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData(PA_BLOCK_DRAG_MIME, hover.id);
              e.dataTransfer.setData("text/plain", hover.id);
              dropRef.current = null;
              setDrop(null);
              setDragging(true);
            }}
            onDragEnd={() => {
              setDragging(false);
              dropRef.current = null;
              setDrop(null);
            }}
          >
            <GripVertical className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {dragging && drop
        ? createPortal(
            <div
              style={{
                position: "fixed",
                top: drop.pos === "before" ? drop.rect.top - 1 : drop.rect.bottom - 1,
                left: drop.rect.left,
                width: drop.rect.width,
                height: 2,
                zIndex: 35,
              }}
              className="pointer-events-none rounded-sm bg-[var(--pa-accent)]"
              aria-hidden
            />,
            document.body,
          )
        : null}

      {menu
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: menu.y + 4,
                left: menu.x,
                zIndex: 40,
              }}
              className="min-w-[160px] rounded-md border border-[var(--pa-divider)] bg-[var(--pa-bg)] py-1 text-sm shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--pa-hover)]"
                onClick={() => {
                  props.onOpenComments?.(menu.id);
                  setMenu(null);
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
                {t("canvas.commentBlock")}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[var(--pa-danger)] hover:bg-[var(--pa-hover)]"
                onClick={() => {
                  removeBlock(menu.id);
                  setMenu(null);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                {t("canvas.deleteBlock")}
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
