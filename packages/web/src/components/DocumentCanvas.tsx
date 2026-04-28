import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type AssetRef, type SlashCommandDef } from "@pagesai/core";
import { extractPlainText } from "@pagesai/documents";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { BlockInsertMenu } from "@/components/BlockInsertMenu";
import { DatabasePicker } from "@/components/DatabasePicker";
import { InlineDatabaseBlock } from "@/components/InlineDatabaseBlock";
import { PagePickerList } from "@/components/PagePickerList";
import { apiPost } from "@/lib/api";
import { filterSlashCommands, slashMenuFlat } from "@/lib/slashMenu";
import { uploadFileForSpace } from "@/lib/uploadAsset";
import { useAuthedObjectUrl } from "@/lib/useAuthedObjectUrl";
import { runtimeApiBase, runtimeAuthHeaders } from "@/lib/runtime-config";

export type BlockEntity = {
  id: string;
  type: string;
  content: Record<string, unknown>;
  properties: Record<string, unknown>;
  sortOrder: number;
};

type SlashParse = { kind: "none" } | { kind: "slash"; slashStart: number; query: string };

function getSlashParse(text: string, cursor: number): SlashParse {
  if (cursor < 0 || cursor > text.length) return { kind: "none" };
  const lineStart = text.lastIndexOf("\n", cursor - 1) + 1;
  const lineBeforeCursor = text.slice(lineStart, cursor);
  const m = lineBeforeCursor.match(/^(\s*)\/(.*)$/);
  if (!m) return { kind: "none" };
  return { kind: "slash", slashStart: lineStart + m[1].length, query: m[2] ?? "" };
}

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

function listMarkersForBlocks(blocks: BlockEntity[]): Record<string, { bullet: boolean; number: string | null }> {
  const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const out: Record<string, { bullet: boolean; number: string | null }> = {};
  let n = 0;
  for (const b of sorted) {
    if (b.type === "numbered") {
      n += 1;
      out[b.id] = { bullet: false, number: String(n) };
    } else {
      n = 0;
      out[b.id] = { bullet: b.type === "bullet", number: null };
    }
  }
  return out;
}

function blockTextClass(type: string): string {
  switch (type) {
    case "heading1":
      return "text-3xl font-bold";
    case "heading2":
      return "text-2xl font-semibold";
    case "heading3":
      return "text-xl font-semibold";
    case "code":
      return "font-mono text-sm bg-[var(--pa-hover)] rounded px-1";
    case "quote":
      return "border-l-2 pl-3 italic text-[var(--pa-secondary)]";
    default:
      return "text-[15px] leading-[1.65]";
  }
}

function BlockGripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="opacity-70" aria-hidden>
      <circle cx="5" cy="3.5" r="1" fill="currentColor" />
      <circle cx="9" cy="3.5" r="1" fill="currentColor" />
      <circle cx="5" cy="7" r="1" fill="currentColor" />
      <circle cx="9" cy="7" r="1" fill="currentColor" />
      <circle cx="5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="9" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}

function SortableBlockChrome(props: {
  id: string;
  children: ReactNode;
  onDelete: () => void;
  onComment: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.88 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/block relative flex gap-0.5 items-start py-0.5 pl-0.5 -ml-1 rounded-md transition-colors duration-150 hover:bg-[var(--pa-hover)]/40"
      id={`block-${props.id}`}
      data-block-id={props.id}
    >
      <button
        type="button"
        className="w-7 h-8 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing rounded-md text-[var(--pa-tertiary)] opacity-0 group-hover/block:opacity-100 hover:bg-[var(--pa-hover)]"
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        <BlockGripIcon />
      </button>
      <div className="flex-1 min-w-0">{props.children}</div>
      <div className="flex shrink-0 items-start gap-0.5 pt-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity duration-150">
        <button
          type="button"
          className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--pa-tertiary)] hover:bg-[var(--pa-hover)] hover:text-[var(--pa-accent)]"
          aria-label="Comment"
          onClick={props.onComment}
        >
          <span className="text-sm leading-none">💬</span>
        </button>
        <button
          type="button"
          className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--pa-tertiary)] hover:bg-[var(--pa-hover)] hover:text-[var(--pa-danger)] text-lg leading-none font-light"
          aria-label="Delete"
          onClick={props.onDelete}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function FileEmbedBlock(props: { block: BlockEntity; pageId: string }) {
  const { t } = useTranslation();
  const asset = props.block.properties["asset"] as AssetRef | undefined;
  const key = asset?.object_key;
  const blobUrl = useAuthedObjectUrl(key);
  const mime = asset?.mime_type ?? "";
  const name = asset?.display_name ?? t("file.open");

  const download = async () => {
    if (!key) return;
    const base = runtimeApiBase().replace(/\/$/, "");
    const headers = await runtimeAuthHeaders();
    const res = await fetch(`${base}/api/assets?key=${encodeURIComponent(key)}`, { headers });
    if (!res.ok) return;
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    URL.revokeObjectURL(u);
  };

  if (!asset) {
    return <p className="text-xs text-[var(--pa-tertiary)]">{t("canvas.fileUnset")}</p>;
  }

  if (mime.startsWith("image/")) {
    if (!blobUrl) {
      return (
        <div className="text-xs text-[var(--pa-tertiary)] py-2" data-testid="file-embed-loading">
          …
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <img src={blobUrl} alt={name} className="max-h-72 rounded-lg border" style={{ borderColor: "var(--pa-divider)" }} />
        <p className="text-xs text-[var(--pa-tertiary)]">{name}</p>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm"
      style={{ borderColor: "var(--pa-divider)" }}
      data-testid="file-embed-card"
    >
      <span>📎</span>
      <span className="flex-1 truncate">{name}</span>
      <span className="text-[var(--pa-tertiary)] text-xs whitespace-nowrap">{mime}</span>
      <button type="button" className="text-[var(--pa-accent)] text-xs hover:underline" onClick={() => void download()}>
        {t("file.download")}
      </button>
    </div>
  );
}

function TodoBlockEditor(props: { block: BlockEntity; pageId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const checked = Boolean(props.block.properties["checked"]);
  const initial = useMemo(() => extractPlainText(props.block.content), [props.block.content, props.block.id]);
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(extractPlainText(props.block.content));
  }, [props.block.content, props.block.id]);

  const flush = useCallback(() => {
    void apiPost("/api/commands", {
      type: "block.update",
      payload: { block_id: props.block.id, text },
      actor_id: "web",
      actor_type: "human",
    }).then(() => {
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    });
  }, [props.block.id, props.pageId, text, qc]);

  const setChecked = (next: boolean) => {
    void apiPost("/api/commands", {
      type: "block.update",
      payload: { block_id: props.block.id, properties: { checked: next } },
      actor_id: "web",
      actor_type: "human",
    }).then(() => {
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    });
  };

  return (
    <div className="flex gap-2 items-start">
      <input
        type="checkbox"
        className="mt-1.5 shrink-0"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        aria-label={t("editor.slash.todo")}
      />
      <textarea
        className={`w-full resize-none bg-transparent outline-none border-0 p-0 focus:ring-0 ${blockTextClass("paragraph")}`}
        rows={Math.max(2, text.split("\n").length)}
        placeholder={t("editor.slashHint")}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            void apiPost("/api/commands", {
              type: "block.update",
              payload: { block_id: props.block.id, text: v },
              actor_id: "web",
              actor_type: "human",
            }).then(() => {
              void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
            });
          }, 450);
        }}
        onBlur={() => flush()}
      />
    </div>
  );
}

function ToggleBlockEditor(props: { block: BlockEntity; pageId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const open = props.block.properties["open"] !== false;
  const initial = useMemo(() => extractPlainText(props.block.content), [props.block.content, props.block.id]);
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(extractPlainText(props.block.content));
  }, [props.block.content, props.block.id]);

  const flush = useCallback(() => {
    void apiPost("/api/commands", {
      type: "block.update",
      payload: { block_id: props.block.id, text },
      actor_id: "web",
      actor_type: "human",
    }).then(() => {
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    });
  }, [props.block.id, props.pageId, text, qc]);

  const toggleOpen = () => {
    void apiPost("/api/commands", {
      type: "block.update",
      payload: { block_id: props.block.id, properties: { open: !open } },
      actor_id: "web",
      actor_type: "human",
    }).then(() => {
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    });
  };

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-[var(--pa-secondary)] mb-1 hover:text-[var(--pa-fg)]"
        onClick={toggleOpen}
        aria-expanded={open}
      >
        <span className="w-4 text-center">{open ? "▼" : "▶"}</span>
        <span>{t("editor.slash.toggle")}</span>
      </button>
      {open ? (
        <textarea
          className={`w-full resize-none bg-transparent outline-none border-0 p-0 focus:ring-0 ${blockTextClass("paragraph")}`}
          rows={Math.max(2, text.split("\n").length)}
          placeholder={t("editor.slashHint")}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              void apiPost("/api/commands", {
                type: "block.update",
                payload: { block_id: props.block.id, text: v },
                actor_id: "web",
                actor_type: "human",
              }).then(() => {
                void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
              });
            }, 450);
          }}
          onBlur={() => flush()}
        />
      ) : null}
    </div>
  );
}

function CalloutBlockEditor(props: { block: BlockEntity; pageId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const emoji = String(props.block.properties["emoji"] ?? "💡");
  const initial = useMemo(() => extractPlainText(props.block.content), [props.block.content, props.block.id]);
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(extractPlainText(props.block.content));
  }, [props.block.content, props.block.id]);

  const flush = useCallback(() => {
    void apiPost("/api/commands", {
      type: "block.update",
      payload: { block_id: props.block.id, text },
      actor_id: "web",
      actor_type: "human",
    }).then(() => {
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    });
  }, [props.block.id, props.pageId, text, qc]);

  return (
    <div
      className="flex gap-2 items-start rounded-md border px-2 py-2"
      style={{ borderColor: "var(--pa-divider)", background: "var(--pa-hover)" }}
    >
      <input
        className="w-9 text-center bg-transparent border-0 outline-none text-lg"
        value={emoji}
        onChange={(e) => {
          const em = e.target.value.slice(0, 4);
          void apiPost("/api/commands", {
            type: "block.update",
            payload: { block_id: props.block.id, properties: { emoji: em } },
            actor_id: "web",
            actor_type: "human",
          }).then(() => {
            void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
          });
        }}
        aria-label={t("editor.calloutEmoji")}
      />
      <textarea
        className={`flex-1 resize-none bg-transparent outline-none border-0 p-0 focus:ring-0 ${blockTextClass("paragraph")}`}
        rows={Math.max(2, text.split("\n").length)}
        placeholder={t("editor.slashHint")}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            void apiPost("/api/commands", {
              type: "block.update",
              payload: { block_id: props.block.id, text: v },
              actor_id: "web",
              actor_type: "human",
            }).then(() => {
              void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
            });
          }, 450);
        }}
        onBlur={() => flush()}
      />
    </div>
  );
}

function BlockTextEditor(props: {
  block: BlockEntity;
  pageId: string;
  placeholder: string;
  spaceId: string | undefined;
  excludePageId: string;
  listBullet: boolean;
  listNumber: string | null;
  onCreateDatabase: () => Promise<string>;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initial = useMemo(
    () => extractPlainText(props.block.content),
    [props.block.content, props.block.id],
  );
  const [text, setText] = useState(initial);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashSelected, setSlashSelected] = useState(0);
  const slashWasOpen = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pagePickerSlash, setPagePickerSlash] = useState<null | { slashStart: number; cursorEnd: number }>(null);
  const [databasePickerSlash, setDatabasePickerSlash] = useState<null | { slashStart: number; cursorEnd: number }>(
    null,
  );
  const [filePickerSlash, setFilePickerSlash] = useState<null | {
    kind: "file" | "image";
    slashStart: number;
    cursorEnd: number;
  }>(null);

  const filteredSlash = useMemo(() => filterSlashCommands(slashQuery, t), [slashQuery, t]);
  const flatSlash = useMemo(() => slashMenuFlat(filteredSlash), [filteredSlash]);

  useEffect(() => {
    setText(extractPlainText(props.block.content));
  }, [props.block.content, props.block.id]);

  useEffect(() => {
    setSlashSelected((i) => {
      const max = Math.max(0, flatSlash.length - 1);
      return Math.min(i, max);
    });
  }, [flatSlash.length]);

  useEffect(() => {
    if (slashOpen && !slashWasOpen.current) setSlashSelected(0);
    slashWasOpen.current = slashOpen;
  }, [slashOpen]);

  useEffect(() => {
    if (!filePickerSlash) return;
    const inp = fileInputRef.current;
    if (inp) {
      inp.accept = filePickerSlash.kind === "image" ? "image/*" : "*/*";
      inp.click();
    }
  }, [filePickerSlash]);

  useEffect(() => {
    if (!slashOpen && !pagePickerSlash && !databasePickerSlash) return;
    const onDoc = (e: MouseEvent) => {
      const m = menuRef.current;
      const ta = textAreaRef.current;
      if (m?.contains(e.target as Node)) return;
      if (ta?.contains(e.target as Node)) return;
      setSlashOpen(false);
      setPagePickerSlash(null);
      setDatabasePickerSlash(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [slashOpen, pagePickerSlash, databasePickerSlash]);

  const flush = useCallback(() => {
    void apiPost("/api/commands", {
      type: "block.update",
      payload: { block_id: props.block.id, text },
      actor_id: "web",
      actor_type: "human",
    }).then(() => {
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    });
  }, [props.block.id, props.pageId, text, qc]);

  const applySlashBlockType = useCallback(
    (def: SlashCommandDef) => {
      const el = textAreaRef.current;
      if (!el) return;
      const cursor = el.selectionStart;
      const snap = getSlashParse(text, cursor);
      if (snap.kind !== "slash") return;
      const newText = text.slice(0, snap.slashStart) + text.slice(cursor);
      setText(newText);
      setSlashOpen(false);
      if (timer.current) clearTimeout(timer.current);
      const nextType = def.blockType ?? "paragraph";
      const extra = slashDefaultProperties(def);
      const payload: Record<string, unknown> = { block_id: props.block.id, type: nextType, text: newText };
      if (extra) payload["properties"] = extra;
      void apiPost("/api/commands", {
        type: "block.update",
        payload,
        actor_id: "web",
        actor_type: "human",
      }).then(() => {
        void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
      });
      requestAnimationFrame(() => {
        const ta = textAreaRef.current;
        if (!ta) return;
        ta.focus();
        const pos = Math.min(snap.slashStart, newText.length);
        ta.setSelectionRange(pos, pos);
      });
    },
    [props.block.id, props.pageId, qc, text],
  );

  const handleSlashPick = (def: SlashCommandDef) => {
    const el = textAreaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const snap = getSlashParse(text, cursor);
    if (snap.kind !== "slash") return;
    if (def.openPagePicker) {
      setSlashOpen(false);
      setPagePickerSlash({ slashStart: snap.slashStart, cursorEnd: cursor });
      return;
    }
    if (def.openDatabasePicker) {
      setSlashOpen(false);
      setDatabasePickerSlash({ slashStart: snap.slashStart, cursorEnd: cursor });
      return;
    }
    if (def.openFilePicker) {
      setSlashOpen(false);
      setFilePickerSlash({ kind: def.openFilePicker, slashStart: snap.slashStart, cursorEnd: cursor });
      return;
    }
    applySlashBlockType(def);
  };

  const completePageLinkFromSlash = (linkedId: string, title: string) => {
    const ctx = pagePickerSlash;
    if (!ctx) return;
    const newText = text.slice(0, ctx.slashStart) + text.slice(ctx.cursorEnd);
    setText(newText);
    setPagePickerSlash(null);
    if (timer.current) clearTimeout(timer.current);
    void apiPost("/api/commands", {
      type: "block.update",
      payload: {
        block_id: props.block.id,
        type: "page_link",
        text: title,
        properties: { linked_page_id: linkedId },
      },
      actor_id: "web",
      actor_type: "human",
    }).then(() => {
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    });
    requestAnimationFrame(() => {
      const ta = textAreaRef.current;
      if (!ta) return;
      ta.focus();
      const pos = Math.min(ctx.slashStart, newText.length);
      ta.setSelectionRange(pos, pos);
    });
  };

  const completeDatabaseFromSlash = (databaseId: string) => {
    const ctx = databasePickerSlash;
    if (!ctx) return;
    const newText = text.slice(0, ctx.slashStart) + text.slice(ctx.cursorEnd);
    setText(newText);
    setDatabasePickerSlash(null);
    if (timer.current) clearTimeout(timer.current);
    void apiPost("/api/commands", {
      type: "block.update",
      payload: {
        block_id: props.block.id,
        type: "database",
        text: newText,
        properties: { database_id: databaseId },
      },
      actor_id: "web",
      actor_type: "human",
    }).then(() => {
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    });
  };

  const completeFileFromSlash = (asset: AssetRef) => {
    const ctx = filePickerSlash;
    if (!ctx) return;
    const newText = text.slice(0, ctx.slashStart) + text.slice(ctx.cursorEnd);
    setText(newText);
    setFilePickerSlash(null);
    if (timer.current) clearTimeout(timer.current);
    void apiPost("/api/commands", {
      type: "block.update",
      payload: {
        block_id: props.block.id,
        type: "file_embed",
        text: newText,
        properties: { asset },
      },
      actor_id: "web",
      actor_type: "human",
    }).then(() => {
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    });
  };

  const onPickedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const ctx = filePickerSlash;
    setFilePickerSlash(null);
    e.target.value = "";
    if (!file || !ctx || !props.spaceId) return;
    if (ctx.kind === "image" && !file.type.startsWith("image/")) return;
    const asset = await uploadFileForSpace(props.spaceId, file);
    completeFileFromSlash(asset);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const syncSlash = (textVal: string, cursor: number) => {
    if (pagePickerSlash || databasePickerSlash) return;
    const p = getSlashParse(textVal, cursor);
    if (p.kind === "slash") {
      setSlashQuery(p.query);
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }
  };

  const safeSlashIndex = flatSlash.length ? Math.min(slashSelected, flatSlash.length - 1) : 0;

  const listPrefix =
    props.listNumber !== null ? `${props.listNumber}.` : props.listBullet ? "•" : null;

  const ta = (
    <textarea
      ref={textAreaRef}
      className={`w-full resize-none bg-transparent outline-none border-0 p-0 focus:ring-0 focus-visible:ring-0 rounded-sm ${blockTextClass(props.block.type)}`}
      rows={Math.max(2, text.split("\n").length)}
      placeholder={props.placeholder}
      value={text}
      onChange={(e) => {
        const v = e.target.value;
        const cursor = e.target.selectionStart;
        setText(v);
        syncSlash(v, cursor);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          void apiPost("/api/commands", {
            type: "block.update",
            payload: { block_id: props.block.id, text: v },
            actor_id: "web",
            actor_type: "human",
          }).then(() => {
            void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
          });
        }, 450);
      }}
      onKeyDown={(e) => {
        if ((pagePickerSlash || databasePickerSlash) && e.key === "Escape") {
          e.preventDefault();
          setPagePickerSlash(null);
          setDatabasePickerSlash(null);
          return;
        }
        if (slashOpen && flatSlash.length > 0 && !pagePickerSlash && !databasePickerSlash) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSlashSelected((i) => (i + 1) % flatSlash.length);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSlashSelected((i) => (i - 1 + flatSlash.length) % flatSlash.length);
            return;
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const def = flatSlash[safeSlashIndex];
            if (def) handleSlashPick(def);
            return;
          }
        }
        if (e.key === "Escape" && slashOpen && !pagePickerSlash && !databasePickerSlash) {
          e.preventDefault();
          setSlashOpen(false);
        }
      }}
      onClick={(e) => syncSlash(text, e.currentTarget.selectionStart)}
      onSelect={(e) => syncSlash(text, e.currentTarget.selectionStart)}
      onBlur={() => flush()}
    />
  );

  return (
    <div className="relative">
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => void onPickedFile(e)} />
      {listPrefix !== null ? (
        <div className="flex gap-2 items-start">
          <span className="shrink-0 w-7 text-right text-[var(--pa-tertiary)] select-none pt-0.5">{listPrefix}</span>
          <div className="flex-1 min-w-0 relative">{ta}</div>
        </div>
      ) : (
        ta
      )}
      {pagePickerSlash || databasePickerSlash || (slashOpen && flatSlash.length > 0) ? (
        <div ref={menuRef} className="absolute left-0 top-full z-30 mt-1">
          {pagePickerSlash ? (
            <PagePickerList
              spaceId={props.spaceId}
              parentPageId={props.excludePageId}
              excludePageId={props.excludePageId}
              onPick={(id, title) => completePageLinkFromSlash(id, title)}
              onCancel={() => setPagePickerSlash(null)}
            />
          ) : databasePickerSlash ? (
            props.spaceId ? (
              <DatabasePicker
                spaceId={props.spaceId}
                onCancel={() => setDatabasePickerSlash(null)}
                onPickExisting={(id) => completeDatabaseFromSlash(id)}
                onCreateNew={props.onCreateDatabase}
              />
            ) : (
              <p className="text-xs p-2 bg-[var(--pa-surface)] border rounded-md">{t("editor.pagePickerNoSpace")}</p>
            )
          ) : (
            <BlockInsertMenu
              t={t}
              filter={slashQuery}
              showFilterInput={false}
              selectedIndex={safeSlashIndex}
              onSelectedIndexChange={setSlashSelected}
              onPick={handleSlashPick}
              searchPlaceholder={t("editor.menuSearchPlaceholder")}
              emptyHint={t("palette.noSearchResults")}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function DocumentCanvas(props: {
  pageId: string;
  spaceId?: string;
  blocks: BlockEntity[];
  onOpenCommentsForBlock: (blockId: string) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFilter, setMenuFilter] = useState("");
  const [menuIdx, setMenuIdx] = useState(0);
  const [pagePickerAppend, setPagePickerAppend] = useState(false);
  const [databasePickerAppend, setDatabasePickerAppend] = useState(false);
  const [fileAppendKind, setFileAppendKind] = useState<null | "file" | "image">(null);
  const bottomMenuRef = useRef<HTMLDivElement>(null);
  const bottomFileRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(
    () => [...props.blocks].sort((a, b) => a.sortOrder - b.sortOrder),
    [props.blocks],
  );
  const ids = useMemo(() => sorted.map((b) => b.id), [sorted]);
  const listMeta = useMemo(() => listMarkersForBlocks(sorted), [sorted]);

  const menuFlat = useMemo(() => slashMenuFlat(filterSlashCommands(menuFilter, t)), [menuFilter, t]);

  const createDatabaseAndView = useCallback(async (): Promise<string> => {
    if (!props.spaceId) throw new Error("space");
    const res = await apiPost<{ operations?: Array<{ payload?: { database?: { id: string } } }> }>("/api/commands", {
      type: "db.create",
      payload: {
        space_id: props.spaceId,
        parent_page_id: props.pageId,
        title: t("db.untitled"),
      },
      actor_id: "web",
      actor_type: "human",
    });
    const dbId = res.operations?.[0]?.payload?.database?.id;
    if (!dbId) throw new Error("no database id");
    await apiPost("/api/commands", {
      type: "db.view.create",
      payload: { database_id: dbId, type: "table", name: t("db.defaultTableView") },
      actor_id: "web",
      actor_type: "human",
    });
    return dbId;
  }, [props.pageId, props.spaceId, t]);

  useEffect(() => {
    setMenuIdx((i) => Math.min(i, Math.max(0, menuFlat.length - 1)));
  }, [menuFlat.length]);

  useEffect(() => {
    if (!menuOpen && !pagePickerAppend && !databasePickerAppend) return;
    const onDoc = (e: MouseEvent) => {
      if (bottomMenuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
      setPagePickerAppend(false);
      setDatabasePickerAppend(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, pagePickerAppend, databasePickerAppend]);

  useEffect(() => {
    if (menuOpen) {
      setMenuFilter("");
      setMenuIdx(0);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!fileAppendKind) return;
    const inp = bottomFileRef.current;
    if (inp) {
      inp.accept = fileAppendKind === "image" ? "image/*" : "*/*";
      inp.click();
    }
  }, [fileAppendKind]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { mutate: reorder } = useMutation({
    mutationFn: async (newOrder: string[]) => {
      for (let i = 0; i < newOrder.length; i++) {
        await apiPost("/api/commands", {
          type: "block.move",
          payload: { block_id: newOrder[i], sort_order: (i + 1) * 1000 },
          actor_id: "web",
          actor_type: "human",
        });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    },
  });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    reorder(arrayMove(ids, oldIndex, newIndex));
  };

  const appendBlock = useCallback(
    async (blockType: string, opts?: { properties?: Record<string, unknown>; text?: string }) => {
      const inner: Record<string, unknown> = {
        page_id: props.pageId,
        type: blockType,
      };
      if (opts?.text !== undefined) inner["text"] = opts.text;
      if (opts?.properties && Object.keys(opts.properties).length > 0) {
        inner["properties"] = opts.properties;
      }
      await apiPost("/api/commands", {
        type: "block.append",
        payload: inner,
        actor_id: "web",
        actor_type: "human",
      });
      void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
    },
    [props.pageId, qc],
  );

  const handleInsertPick = (def: SlashCommandDef) => {
    if (def.openPagePicker) {
      setMenuOpen(false);
      setPagePickerAppend(true);
      return;
    }
    if (def.openDatabasePicker) {
      setMenuOpen(false);
      setDatabasePickerAppend(true);
      return;
    }
    if (def.openFilePicker) {
      setMenuOpen(false);
      setFileAppendKind(def.openFilePicker);
      return;
    }
    void appendBlock(def.blockType ?? "paragraph", { properties: slashDefaultProperties(def) });
    setMenuOpen(false);
  };

  const onBottomFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const kind = fileAppendKind;
    setFileAppendKind(null);
    e.target.value = "";
    if (!file || !props.spaceId || !kind) return;
    if (kind === "image" && !file.type.startsWith("image/")) return;
    const asset = await uploadFileForSpace(props.spaceId, file);
    await appendBlock("file_embed", { properties: { asset } });
  };

  const deleteBlock = async (blockId: string) => {
    if (!globalThis.confirm?.(t("canvas.deleteBlockConfirm"))) return;
    await apiPost("/api/commands", {
      type: "block.delete",
      payload: { block_id: blockId },
      actor_id: "web",
      actor_type: "human",
    });
    void qc.invalidateQueries({ queryKey: ["page", props.pageId] });
  };

  const renderBlock = (b: BlockEntity) => {
    if (b.type === "divider") {
      return <hr className="my-2 border-[var(--pa-divider)]" />;
    }
    if (b.type === "database") {
      const dbId = String(b.properties["database_id"] ?? "");
      if (!dbId) {
        return <p className="text-xs text-[var(--pa-tertiary)]">{t("canvas.databaseUnset")}</p>;
      }
      return <InlineDatabaseBlock databaseId={dbId} />;
    }
    if (b.type === "file_embed") {
      return <FileEmbedBlock block={b} pageId={props.pageId} />;
    }
    if (b.type === "page_link") {
      const linked = String(b.properties["linked_page_id"] ?? "");
      const label = extractPlainText(b.content) || t("editor.slash.pageLink");
      if (!linked) {
        return <p className="text-xs text-[var(--pa-tertiary)]">{t("canvas.pageLinkUnset")}</p>;
      }
      return (
        <Link
          to={`/pages/p/${linked}`}
          className="text-[15px] text-[var(--pa-accent)] underline-offset-2 hover:underline"
        >
          {label}
        </Link>
      );
    }
    if (b.type === "todo") {
      return <TodoBlockEditor block={b} pageId={props.pageId} />;
    }
    if (b.type === "toggle") {
      return <ToggleBlockEditor block={b} pageId={props.pageId} />;
    }
    if (b.type === "callout") {
      return <CalloutBlockEditor block={b} pageId={props.pageId} />;
    }
    const lm = listMeta[b.id] ?? { bullet: false, number: null };
    return (
      <BlockTextEditor
        block={b}
        pageId={props.pageId}
        placeholder={t("editor.slashHint")}
        spaceId={props.spaceId}
        excludePageId={props.pageId}
        listBullet={lm.bullet}
        listNumber={lm.number}
        onCreateDatabase={createDatabaseAndView}
      />
    );
  };

  const isEmpty = sorted.length === 0;

  return (
    <div className="document-canvas space-y-0" data-testid="document-canvas">
      {isEmpty ? (
        <button
          type="button"
          className="w-full text-left py-3 px-1 text-sm text-[var(--pa-tertiary)] border border-dashed rounded-md hover:bg-[var(--pa-hover)]"
          style={{ borderRadius: "var(--pa-radius-md)", borderColor: "var(--pa-divider)" }}
          onClick={() => void appendBlock("paragraph")}
        >
          {t("canvas.emptyBody")}
        </button>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {sorted.map((b) => (
            <SortableBlockChrome
              key={b.id}
              id={b.id}
              onDelete={() => void deleteBlock(b.id)}
              onComment={() => props.onOpenCommentsForBlock(b.id)}
            >
              {renderBlock(b)}
            </SortableBlockChrome>
          ))}
        </SortableContext>
      </DndContext>

      <div ref={bottomMenuRef} className="relative mt-2 pl-7">
        <input ref={bottomFileRef} type="file" className="hidden" onChange={(e) => void onBottomFileChange(e)} />
        {pagePickerAppend ? (
          <PagePickerList
            spaceId={props.spaceId}
            parentPageId={props.pageId}
            excludePageId={props.pageId}
            onPick={(id, title) => {
              setPagePickerAppend(false);
              void appendBlock("page_link", { properties: { linked_page_id: id }, text: title });
            }}
            onCancel={() => setPagePickerAppend(false)}
          />
        ) : databasePickerAppend ? (
          props.spaceId ? (
            <DatabasePicker
              spaceId={props.spaceId}
              onCancel={() => setDatabasePickerAppend(false)}
              onPickExisting={(id) => {
                setDatabasePickerAppend(false);
                void appendBlock("database", { properties: { database_id: id } });
              }}
              onCreateNew={createDatabaseAndView}
            />
          ) : (
            <p className="text-xs text-[var(--pa-tertiary)]">{t("editor.pagePickerNoSpace")}</p>
          )
        ) : (
          <>
            <button
              type="button"
              data-testid="add-block-trigger"
              className="text-[13px] text-[var(--pa-tertiary)] py-1.5 rounded-md px-1 -ml-1 hover:bg-[var(--pa-hover)] hover:text-[var(--pa-secondary)]"
              style={{ borderRadius: "var(--pa-radius-sm)" }}
              onClick={() => setMenuOpen((x) => !x)}
            >
              + {t("canvas.addBlock")}
            </button>
            {menuOpen ? (
              <div className="absolute left-0 top-full z-20 mt-1">
                <BlockInsertMenu
                  t={t}
                  filter={menuFilter}
                  onFilterChange={(v) => {
                    setMenuFilter(v);
                    setMenuIdx(0);
                  }}
                  showFilterInput
                  selectedIndex={menuIdx}
                  onSelectedIndexChange={setMenuIdx}
                  onPick={handleInsertPick}
                  searchPlaceholder={t("editor.menuSearchPlaceholder")}
                  emptyHint={t("palette.noSearchResults")}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
