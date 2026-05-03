import { createLinkMatcherWithRegExp } from "@lexical/link";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { $createListItemNode, $createListNode } from "@lexical/list";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { mergeRegister } from "@lexical/utils";
import type { AssetRef, PageBodyBlockDTO, SlashCommandDef } from "@pagesai/core";
import {
  ensureLexicalRootHasBlockChildren,
  lexicalEditorJSONFromPageBodyBlocks,
  pageBodyDTOsFromLexicalEditorJSON,
  paragraphFromText,
} from "@pagesai/documents";
import { useQueryClient } from "@tanstack/react-query";
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type EditorState,
  type LexicalNode,
} from "lexical";
import type { Ref, RefObject } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { BlockInsertMenu } from "@/components/BlockInsertMenu";
import { DatabasePicker } from "@/components/DatabasePicker";
import { PagePickerList } from "@/components/PagePickerList";
import { apiPost } from "@/lib/api";
import { filterSlashCommands, slashMenuFlat } from "@/lib/slashMenu";
import { uploadFileForSpace } from "@/lib/uploadAsset";
import { BlockHoverHandles } from "@/editor/page-body/BlockHoverHandles";
import { DecoratorKeyboardPlugin } from "@/editor/page-body/DecoratorKeyboardPlugin";
import { ClickToWriteZone } from "@/editor/page-body/EndOfDocAffordances";
import { EnsureTrailingParagraphPlugin } from "@/editor/page-body/ensure-trailing-paragraph";
import { FloatingTextFormatToolbar } from "@/editor/page-body/FloatingTextFormatToolbar";
import { PageBodySurfaceContext, usePageBodySurface } from "@/editor/page-body/context";
import {
  PaDividerNode,
  PaFileEmbedNode,
  PaLegacyNode,
  PAGE_BODY_DECORATOR_NODES,
  $isPaFileEmbedNode,
} from "@/editor/page-body/pa-decorators";
import {
  $createPaCodeNode,
  $createPaHeadingNode,
  $createPaListBlockNode,
  $createPaParagraphNode,
  $createPaQuoteNode,
  $isPaHeadingNode,
  $isPaListBlockNode,
  $isPaParagraphNode,
  $isPaQuoteNode,
  PAGE_BODY_ELEMENT_NODES,
  type PaHeadingNode,
  type PaListBlockNode,
  type PaParagraphNode,
  type PaQuoteNode,
} from "@/editor/page-body/pa-nodes";
import { newTopLevelBlockId } from "@/editor/page-body/new-block-id";
import type { BlockEntity } from "@/editor/page-body/types";

function slashDefaultProperties(def: SlashCommandDef): Record<string, unknown> | undefined {
  switch (def.blockType) {
    case "todo":
      return { checked: false };
    case "toggle":
      return { open: true };
    case "callout":
      return { emoji: "💡" };
    default:
      return undefined;
  }
}

function blocksToDto(blocks: BlockEntity[]): PageBodyBlockDTO[] {
  return [...blocks]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => ({
      id: b.id,
      type: b.type,
      sort_order: b.sortOrder,
      properties: b.properties,
      content: b.content,
    }));
}

const pageBodyTheme = {
  paragraph: "m-0 py-0.5 text-[15px] leading-[1.65]",
  quote: "m-0 py-1 border-l-2 pl-3 italic text-[var(--pa-secondary)]",
  heading: {
    h1: "m-0 py-1 text-3xl font-bold",
    h2: "m-0 py-1 text-2xl font-semibold",
    h3: "m-0 py-1 text-xl font-semibold",
  },
  list: {
    ul: "m-0 pl-6",
    ol: "m-0 pl-6",
    listitem: "m-0",
    nested: { list: "m-0", listitem: "ml-3" },
  },
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "font-mono text-sm bg-[var(--pa-hover)] rounded px-1",
  },
  link: "text-[var(--pa-accent)] underline underline-offset-2",
};

const urlMatcher = createLinkMatcherWithRegExp(
  /https?:\/\/[^\s]+/,
  (t) => t,
);

export { newTopLevelBlockId } from "@/editor/page-body/new-block-id";

export function $topLevelBlockId(node: LexicalNode): string | null {
  if ($isPaParagraphNode(node)) return node.getBlockId();
  if ($isPaHeadingNode(node)) return node.getBlockId();
  if ($isPaQuoteNode(node)) return node.getBlockId();
  if ($isPaListBlockNode(node)) return node.getBlockId();
  if (node instanceof PaDividerNode) return node.__blockId;
  if (node instanceof PaFileEmbedNode) return node.__blockId;
  if (node instanceof PaLegacyNode) return node.__blockId;
  return null;
}

export type PageBodyEditorHandle = {
  appendParagraph: () => void;
  appendHeading: (level: "h1" | "h2" | "h3") => void;
  appendQuote: () => void;
  appendList: (kind: "bullet" | "numbered") => void;
  appendCode: () => void;
  appendDivider: () => void;
  appendLegacy: (dbType: string, properties: Record<string, unknown>, text?: string) => void;
  appendFileEmbed: (asset: AssetRef) => void;
  removeBlockById: (blockId: string) => void;
  flush: () => void;
};

function PageBodyCommandsPlugin(props: {
  forwardedRef: Ref<PageBodyEditorHandle>;
  pageId: string;
  debounceMs: number;
  flushBodySyncRef: RefObject<(() => void) | null>;
}) {
  const [editor] = useLexicalComposerContext();
  const qc = useQueryClient();
  const { bodySyncSuspendedRef } = usePageBodySurface();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `null` until the editor has fully mounted with its initial state. The first effect below
  // seeds it to the initial state hash so we can never accidentally POST an unchanged
  // (or stale-empty) document and wipe the page on the server.
  const lastPostedJson = useRef<string | null>(null);

  // Seed the baseline AFTER the editor is constructed with its initial blocks. Until this runs,
  // `flush` is a no-op — guaranteeing we never post during the brief window between mount and
  // the first paint.
  useEffect(() => {
    lastPostedJson.current = JSON.stringify(editor.getEditorState().toJSON());
  }, [editor]);

  const flush = useCallback(async () => {
    if (bodySyncSuspendedRef.current) return;
    if (lastPostedJson.current === null) return; // not seeded yet — don't risk a destructive write
    const json = JSON.stringify(editor.getEditorState().toJSON());
    if (json === lastPostedJson.current) return;
    const dtos = pageBodyDTOsFromLexicalEditorJSON(
      editor.getEditorState().toJSON() as Parameters<typeof pageBodyDTOsFromLexicalEditorJSON>[0],
    );
    try {
      await apiPost("/api/commands", {
        type: "page.body_sync",
        payload: { page_id: props.pageId, blocks: dtos },
        actor_id: "web",
        actor_type: "human",
      });
      lastPostedJson.current = json;
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    } catch {
      /* retry on next change / explicit flush */
    }
  }, [bodySyncSuspendedRef, editor, props.pageId, qc]);

  useEffect(() => {
    props.flushBodySyncRef.current = () => void flush();
    return () => {
      props.flushBodySyncRef.current = null;
    };
  }, [flush, props.flushBodySyncRef]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), props.debounceMs);
  }, [flush, props.debounceMs]);

  useEffect(() => {
    const onUnload = () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  useImperativeHandle(
    props.forwardedRef,
    () => ({
      flush: () => void flush(),
      appendParagraph: () => {
        editor.update(() => {
          const n = $createPaParagraphNode(newTopLevelBlockId());
          $getRoot().append(n);
          n.selectStart();
        });
      },
      appendHeading: (level) => {
        editor.update(() => {
          const n = $createPaHeadingNode(level, newTopLevelBlockId());
          $getRoot().append(n);
          n.selectStart();
        });
      },
      appendQuote: () => {
        editor.update(() => {
          const n = $createPaQuoteNode(newTopLevelBlockId());
          $getRoot().append(n);
          n.selectStart();
        });
      },
      appendList: (kind) => {
        editor.update(() => {
          const host = $createPaListBlockNode(newTopLevelBlockId());
          const list = $createListNode(kind === "numbered" ? "number" : "bullet", 1);
          const item = $createListItemNode();
          item.append($createPaParagraphNode());
          list.append(item);
          host.append(list);
          $getRoot().append(host);
          host.selectStart();
        });
      },
      appendCode: () => {
        editor.update(() => {
          const n = $createPaCodeNode(null, newTopLevelBlockId());
          $getRoot().append(n);
          n.selectStart();
        });
      },
      appendDivider: () => {
        editor.update(() => {
          const n = new PaDividerNode(newTopLevelBlockId());
          $getRoot().append(n);
        });
      },
      appendLegacy: (dbType, properties, text) => {
        editor.update(() => {
          const id = newTopLevelBlockId();
          const content = (
            text !== undefined
              ? paragraphFromText(text)
              : { root: { type: "root", children: [] } }
          ) as Record<string, unknown>;
          const n = new PaLegacyNode(id, dbType, properties, content);
          $getRoot().append(n);
        });
      },
      appendFileEmbed: (asset) => {
        editor.update(() => {
          const n = new PaFileEmbedNode(
            newTopLevelBlockId(),
            { asset },
            { root: { type: "root", children: [] } } as Record<string, unknown>,
          );
          $getRoot().append(n);
        });
      },
      removeBlockById: (blockId) => {
        editor.update(() => {
          const root = $getRoot();
          const kids = root.getChildren();
          for (const child of kids) {
            if ($topLevelBlockId(child) === blockId) {
              child.remove();
              break;
            }
          }
          if (root.getChildrenSize() === 0) {
            const n = $createPaParagraphNode(newTopLevelBlockId());
            root.append(n);
            n.selectStart();
          }
        });
      },
    }),
    [editor, flush],
  );

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(_state: EditorState) => {
        schedule();
      }}
    />
  );
}

function selectAfterReplace(repl: LexicalNode) {
  if ($isElementNode(repl)) {
    repl.selectStart();
    return;
  }
  // For top-level decorator nodes (database, file_embed, divider, page_link, todo, toggle, callout)
  // the original block's text node is removed along with `top`, leaving the document selection
  // pointing at a now-orphaned text node. Lexical reverts the entire update during commit when
  // the post-update selection cannot resolve, so we must give it a valid caret in the same update.
  let next = repl.getNextSibling();
  if (!next || !$isPaParagraphNode(next)) {
    const trailing = $createPaParagraphNode(newTopLevelBlockId());
    repl.insertAfter(trailing);
    next = trailing;
  }
  if ($isElementNode(next)) {
    next.selectStart();
  }
}

/** Viewport caret rect for anchoring the slash menu below the typed `/`. */
function slashMenuAnchorViewport(editorRoot: HTMLElement | null): DOMRect | null {
  if (!editorRoot) return null;
  const native = window.getSelection();
  if (!native || native.rangeCount === 0) return null;
  const range = native.getRangeAt(0);
  if (!native.isCollapsed) return null;
  if (!editorRoot.contains(range.commonAncestorContainer)) return null;
  let rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    const rects = range.getClientRects();
    const last = rects.length > 0 ? rects[rects.length - 1] : undefined;
    if (last) {
      rect = new DOMRect(last.left, last.top, last.width, last.height);
    }
  }
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

function SlashMenuPlugin(props: {
  spaceId?: string;
  excludePageId: string;
  onCreateDatabase: () => Promise<string>;
}) {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { bodySyncSuspendedRef, flushBodySyncRef } = usePageBodySurface();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [pagePick, setPagePick] = useState(false);
  const [dbPick, setDbPick] = useState(false);
  const [fileKind, setFileKind] = useState<null | "file" | "image">(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Lexical key of the top-level block that contained the `/…` command when the file picker opened (selection is lost after the dialog). */
  const pendingFileReplaceKeyRef = useRef<string | null>(null);
  /** Lexical key of the `PaFileEmbedNode` while uploading (for progress patches). */
  const fileUploadLexicalKeyRef = useRef<string | null>(null);

  const filtered = useMemo(() => filterSlashCommands(query, t), [query, t]);
  const flat = useMemo(() => slashMenuFlat(filtered), [filtered]);

  const [slashMenuPos, setSlashMenuPos] = useState<{ top: number; left: number } | null>(null);

  const updateSlashMenuPosition = useCallback(() => {
    if (!open && !pagePick && !dbPick) {
      setSlashMenuPos(null);
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const root = editor.getRootElement();
        const rect = slashMenuAnchorViewport(root);
        if (!rect) {
          setSlashMenuPos(null);
          return;
        }
        const gap = 6;
        const vw = window.innerWidth;
        const estW = 300;
        const left = Math.max(8, Math.min(rect.left, vw - estW - 8));
        setSlashMenuPos({ top: rect.bottom + gap, left });
      });
    });
  }, [dbPick, editor, open, pagePick]);

  useEffect(() => {
    if (!open && !pagePick && !dbPick) return;
    updateSlashMenuPosition();
  }, [dbPick, open, pagePick, query, selected, updateSlashMenuPosition]);

  useEffect(() => {
    if (!open && !pagePick && !dbPick) return;
    const onScrollOrResize = () => updateSlashMenuPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [dbPick, open, pagePick, updateSlashMenuPosition]);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      if (open || pagePick || dbPick) {
        updateSlashMenuPosition();
      }
    });
  }, [dbPick, editor, open, pagePick, updateSlashMenuPosition]);

  useEffect(() => {
    if (!open) return;
    setSelected((i) => Math.min(i, Math.max(0, flat.length - 1)));
  }, [flat.length, open]);

  useEffect(() => {
    if (!fileKind) return;
    const inp = fileRef.current;
    if (inp) {
      inp.accept = fileKind === "image" ? "image/*" : "*/*";
      inp.click();
    }
  }, [fileKind]);

  const replaceTopWith = useCallback(
    (create: (oldId: string) => LexicalNode) => {
      editor.update(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel)) return;
        const top = sel.anchor.getNode().getTopLevelElementOrThrow();
        let oldId = "";
        if ($isPaParagraphNode(top) || $isPaHeadingNode(top) || $isPaQuoteNode(top) || $isPaListBlockNode(top)) {
          oldId = (top as PaParagraphNode | PaHeadingNode | PaQuoteNode | PaListBlockNode).getBlockId();
        }
        const repl = create(oldId);
        top.replace(repl);
        selectAfterReplace(repl);
      });
      // Lexical commits decorator-block changes after this microtask completes; defer the
      // explicit `page.body_sync` flush so it serializes the post-commit state, otherwise
      // OnChange's debounced flush would see "no delta" until the next user edit.
      globalThis.setTimeout(() => flushBodySyncRef.current?.(), 0);
    },
    [editor, flushBodySyncRef],
  );

  const handlePick = useCallback(
    (def: SlashCommandDef) => {
      if (def.createSubpageInline) {
        if (!props.spaceId) return;
        setOpen(false);
        void (async () => {
          try {
            const res = await apiPost<{ operations?: Array<{ payload?: { page?: { id: string } } }> }>(
              "/api/commands",
              {
                type: "page.create",
                payload: {
                  space_id: props.spaceId,
                  title: t("canvas.untitled"),
                  parent_page_id: props.excludePageId,
                },
                actor_id: "web",
                actor_type: "human",
              },
            );
            const childId = res.operations?.[0]?.payload?.page?.id;
            if (!childId) return;
            void qc.invalidateQueries({ queryKey: ["pages-flat"] });
            replaceTopWith(
              (id) =>
                new PaLegacyNode(
                  id,
                  "page_link",
                  { linked_page_id: childId },
                  paragraphFromText(t("canvas.untitled")) as Record<string, unknown>,
                ),
            );
          } catch {
            /* ignore */
          }
        })();
        return;
      }
      if (def.openPagePicker) {
        setOpen(false);
        setPagePick(true);
        return;
      }
      if (def.openDatabasePicker) {
        setOpen(false);
        setDbPick(true);
        return;
      }
      if (def.openFilePicker) {
        setOpen(false);
        editor.getEditorState().read(() => {
          const sel = $getSelection();
          if ($isRangeSelection(sel) && sel.isCollapsed()) {
            pendingFileReplaceKeyRef.current = sel.anchor.getNode().getTopLevelElementOrThrow().getKey();
          } else {
            pendingFileReplaceKeyRef.current = null;
          }
        });
        setFileKind(def.openFilePicker);
        return;
      }

      setOpen(false);
      const bt = def.blockType ?? "paragraph";
      const extra = slashDefaultProperties(def);

      if (bt === "heading1") {
        replaceTopWith((id) => $createPaHeadingNode("h1", id));
        return;
      }
      if (bt === "heading2") {
        replaceTopWith((id) => $createPaHeadingNode("h2", id));
        return;
      }
      if (bt === "heading3") {
        replaceTopWith((id) => $createPaHeadingNode("h3", id));
        return;
      }
      if (bt === "quote") {
        replaceTopWith((id) => $createPaQuoteNode(id));
        return;
      }
      if (bt === "bullet") {
        replaceTopWith((id) => {
          const host = $createPaListBlockNode(id);
          const list = $createListNode("bullet", 1);
          const item = $createListItemNode();
          item.append($createPaParagraphNode());
          list.append(item);
          host.append(list);
          return host;
        });
        return;
      }
      if (bt === "numbered") {
        replaceTopWith((id) => {
          const host = $createPaListBlockNode(id);
          const list = $createListNode("number", 1);
          const item = $createListItemNode();
          item.append($createPaParagraphNode());
          list.append(item);
          host.append(list);
          return host;
        });
        return;
      }
      if (bt === "code") {
        replaceTopWith((id) => $createPaCodeNode(null, id));
        return;
      }
      if (bt === "divider") {
        replaceTopWith((id) => new PaDividerNode(id));
        return;
      }
      if (bt === "paragraph") {
        replaceTopWith((id) => $createPaParagraphNode(id));
        return;
      }

      const propsPayload = extra ?? {};
      const content = { root: { type: "root", children: [] } } as Record<string, unknown>;
      replaceTopWith((id) => new PaLegacyNode(id, bt, propsPayload, content));
    },
    [props.excludePageId, props.spaceId, qc, replaceTopWith, t, editor],
  );

  useEffect(() => {
    // NB: registerTextContentListener gives the editor's full joined text — its offsets do NOT
    // align with `sel.anchor.offset` (which is local to the current text node). Read directly
    // from the anchor text node so detection works in any block, not only the first one.
    return editor.registerTextContentListener(() => {
      editor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel) || !sel.isCollapsed()) {
          setOpen(false);
          return;
        }
        const anchorNode = sel.anchor.getNode();
        if (anchorNode.getType() !== "text") {
          setOpen(false);
          return;
        }
        const before = anchorNode.getTextContent().slice(0, sel.anchor.offset);
        // Match a `/` that opens a command: at start of the text node OR after whitespace,
        // followed by the (possibly empty) query up to the caret.
        const m = before.match(/(^|\s)\/([^\s/]*)$/);
        if (m) {
          setOpen(true);
          setQuery(m[2] ?? "");
        } else {
          setOpen(false);
        }
      });
    });
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (open || pagePick || dbPick) {
            setOpen(false);
            setPagePick(false);
            setDbPick(false);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          if (open || pagePick || dbPick) {
            updateSlashMenuPosition();
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        () => {
          if (!open || flat.length === 0) return false;
          setSelected((s) => (s + 1) % flat.length);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        () => {
          if (!open || flat.length === 0) return false;
          setSelected((s) => (s - 1 + flat.length) % flat.length);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (ev) => {
          if (!open || flat.length === 0 || !ev || ev.shiftKey) return false;
          const def = flat[Math.min(selected, flat.length - 1)];
          if (def) {
            handlePick(def);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [dbPick, editor, flat, handlePick, open, pagePick, selected, updateSlashMenuPosition]);

  const onPickedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const kind = fileKind;
    setFileKind(null);
    e.target.value = "";
    if (!file || !props.spaceId || !kind) {
      pendingFileReplaceKeyRef.current = null;
      return;
    }
    if (kind === "image" && !file.type.startsWith("image/")) {
      pendingFileReplaceKeyRef.current = null;
      return;
    }

    let embedLexicalKey: string | null = null;
    editor.update(() => {
      const savedKey = pendingFileReplaceKeyRef.current;
      pendingFileReplaceKeyRef.current = null;

      let top: LexicalNode | null = null;
      if (savedKey) {
        const hit = $getNodeByKey(savedKey);
        top = hit?.getTopLevelElementOrThrow() ?? null;
      }
      if (!top) {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) {
          top = sel.anchor.getNode().getTopLevelElementOrThrow();
        }
      }
      if (!top) return;

      const oldId = $topLevelBlockId(top) ?? newTopLevelBlockId();
      const embed = new PaFileEmbedNode(
        oldId,
        {
          uploading: true,
          local_file_name: file.name,
          local_mime: file.type || "application/octet-stream",
          upload_percent: null,
        },
        { root: { type: "root", children: [] } } as Record<string, unknown>,
      );
      top.replace(embed);
      embedLexicalKey = embed.getKey();

      const nextSibling = embed.getNextSibling();
      if (nextSibling !== null && $isElementNode(nextSibling)) {
        nextSibling.selectStart();
      } else {
        const p = $createPaParagraphNode(newTopLevelBlockId());
        embed.insertAfter(p);
        p.selectStart();
      }
    });

    if (!embedLexicalKey) return;

    fileUploadLexicalKeyRef.current = embedLexicalKey;
    bodySyncSuspendedRef.current = true;

    try {
      const asset = await uploadFileForSpace(props.spaceId, file, (loaded, total) => {
        editor.update(() => {
          const kn = fileUploadLexicalKeyRef.current;
          if (!kn) return;
          const node = $getNodeByKey(kn);
          if (!$isPaFileEmbedNode(node)) return;
          const w = node.getWritable();
          w.__legacyProperties = {
            ...w.__legacyProperties,
            upload_percent: total > 0 ? Math.min(100, Math.round((100 * loaded) / total)) : null,
          };
        });
      });

      editor.update(() => {
        const kn = fileUploadLexicalKeyRef.current;
        if (!kn) return;
        const node = $getNodeByKey(kn);
        if (!$isPaFileEmbedNode(node)) return;
        const w = node.getWritable();
        w.__legacyProperties = { asset };
      });
    } catch {
      editor.update(() => {
        const kn = fileUploadLexicalKeyRef.current;
        if (!kn) return;
        const node = $getNodeByKey(kn);
        if (!$isPaFileEmbedNode(node)) return;
        const w = node.getWritable();
        w.__legacyProperties = {
          ...w.__legacyProperties,
          uploading: false,
          upload_error: true,
          upload_percent: null,
        };
      });
    } finally {
      fileUploadLexicalKeyRef.current = null;
      bodySyncSuspendedRef.current = false;
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => void onPickedFile(e)} />
      {(open || pagePick || dbPick) && slashMenuPos
        ? createPortal(
            <div
              className="z-[70]"
              style={{
                position: "fixed",
                top: slashMenuPos.top,
                left: slashMenuPos.left,
              }}
            >
              {pagePick ? (
                <PagePickerList
                  spaceId={props.spaceId}
                  parentPageId={props.excludePageId}
                  excludePageId={props.excludePageId}
                  onPick={(linkedId, title) => {
                    setPagePick(false);
                    replaceTopWith(
                      (id) =>
                        new PaLegacyNode(
                          id,
                          "page_link",
                          { linked_page_id: linkedId },
                          paragraphFromText(title) as Record<string, unknown>,
                        ),
                    );
                  }}
                  onCancel={() => setPagePick(false)}
                />
              ) : dbPick ? (
                props.spaceId ? (
                  <DatabasePicker
                    spaceId={props.spaceId}
                    onCancel={() => setDbPick(false)}
                    onPickExisting={(id) => {
                      setDbPick(false);
                      replaceTopWith(
                        (bid) =>
                          new PaLegacyNode(bid, "database", { database_id: id }, { root: { type: "root", children: [] } }),
                      );
                    }}
                    onCreateNew={props.onCreateDatabase}
                  />
                ) : null
              ) : flat.length > 0 ? (
                <BlockInsertMenu
                  t={t}
                  filter={query}
                  showFilterInput={false}
                  selectedIndex={selected}
                  onSelectedIndexChange={setSelected}
                  onPick={handlePick}
                  searchPlaceholder={t("editor.menuSearchPlaceholder")}
                  emptyHint={t("palette.noSearchResults")}
                />
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function Placeholder(props: { text: string }) {
  return <div className="pointer-events-none absolute left-0 top-0 text-[var(--pa-tertiary)] select-none">{props.text}</div>;
}

export type PageBodyEditorProps = {
  pageId: string;
  spaceId?: string;
  blocks: BlockEntity[];
  onCreateDatabase: () => Promise<string>;
  /** Called when the user picks "Comment" from a block's hover handle menu. */
  onOpenComments?: (blockId: string) => void;
};

export const PageBodyEditor = forwardRef<PageBodyEditorHandle, PageBodyEditorProps>(function PageBodyEditor(
  props,
  ref,
) {
  const { t } = useTranslation();
  const bodySyncSuspendedRef = useRef(false);
  const flushBodySyncRef = useRef<(() => void) | null>(null);
  const initialState = useMemo(() => {
    const dto = blocksToDto(props.blocks);
    const doc = ensureLexicalRootHasBlockChildren(lexicalEditorJSONFromPageBodyBlocks(dto));
    return JSON.stringify(doc);
  }, [props.blocks]);

  const nodes = useMemo(
    () => [...PAGE_BODY_ELEMENT_NODES, ...PAGE_BODY_DECORATOR_NODES, LinkNode, AutoLinkNode],
    [],
  );

  const surface = useMemo(
    () => ({
      pageId: props.pageId,
      spaceId: props.spaceId,
      excludePageId: props.pageId,
      onCreateDatabase: props.onCreateDatabase,
      bodySyncSuspendedRef,
      flushBodySyncRef,
    }),
    [props.onCreateDatabase, props.pageId, props.spaceId],
  );

  return (
    <PageBodySurfaceContext.Provider value={surface}>
      <LexicalComposer
        initialConfig={{
          namespace: "pagesai-page-body",
          theme: pageBodyTheme,
          nodes,
          editorState: initialState,
          onError: console.error,
        }}
      >
        <div className="group/document-canvas relative document-canvas" data-testid="document-canvas">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="relative min-h-[120px] outline-none focus:outline-none [&>*:first-child]:mt-0" />
            }
            placeholder={<Placeholder text={t("editor.slashHint")} />}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <AutoLinkPlugin matchers={[urlMatcher]} />
          <FloatingTextFormatToolbar />
          <EnsureTrailingParagraphPlugin />
          <DecoratorKeyboardPlugin />
          <PageBodyCommandsPlugin
            forwardedRef={ref}
            pageId={props.pageId}
            debounceMs={500}
            flushBodySyncRef={flushBodySyncRef}
          />
          <SlashMenuPlugin spaceId={props.spaceId} excludePageId={props.pageId} onCreateDatabase={props.onCreateDatabase} />
          <BlockHoverHandles onOpenComments={props.onOpenComments} />
          <ClickToWriteZone hint={t("editor.slashHint")} />
        </div>
      </LexicalComposer>
    </PageBodySurfaceContext.Provider>
  );
});
