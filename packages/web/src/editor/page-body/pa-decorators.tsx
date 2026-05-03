import { extractPlainText, paragraphFromText } from "@pagesai/documents";
import {
  $applyNodeReplacement,
  $getNodeByKey,
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
} from "lexical";
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { FileEmbedBlock } from "@/components/FileEmbedBlock";
import { InlineDatabaseBlock } from "@/components/InlineDatabaseBlock";
import { usePageBodySurface } from "@/editor/page-body/context";
import type { BlockEntity } from "@/editor/page-body/types";
import { useSpacePagesFlat } from "@/lib/useSpacePagesFlat";

type SerializedPaDivider = {
  type: "pa-divider";
  version: 1;
  blockId: string;
};

export class PaDividerNode extends DecoratorNode<ReactElement> {
  __blockId: string;

  static getType(): string {
    return "pa-divider";
  }

  static clone(node: PaDividerNode): PaDividerNode {
    return new PaDividerNode(node.__blockId, node.__key);
  }

  constructor(blockId: string, key?: NodeKey) {
    super(key);
    this.__blockId = blockId;
  }

  isInline(): boolean {
    return false;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement("div");
    el.setAttribute("data-pa-decorator", "pa-divider");
    return el;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): ReactElement {
    return (
      <hr
        className="my-2 border-0 border-t"
        style={{ borderColor: "var(--pa-divider)" }}
        data-block-id={this.__blockId}
      />
    );
  }

  exportJSON(): SerializedPaDivider {
    return { type: "pa-divider", version: 1, blockId: this.__blockId };
  }

  static importJSON(serializedNode: SerializedPaDivider): PaDividerNode {
    return $applyNodeReplacement(new PaDividerNode(serializedNode.blockId));
  }
}

export function $isPaDividerNode(node: unknown): node is PaDividerNode {
  return node instanceof PaDividerNode;
}

/* --- File embed (React) --- */

type SerializedPaFile = {
  type: "pa-file-embed";
  version: 1;
  blockId: string;
  legacyProperties: Record<string, unknown>;
  legacyContent: Record<string, unknown>;
};

export class PaFileEmbedNode extends DecoratorNode<ReactElement> {
  __blockId: string;
  __legacyProperties: Record<string, unknown>;
  __legacyContent: Record<string, unknown>;

  static getType(): string {
    return "pa-file-embed";
  }

  static clone(node: PaFileEmbedNode): PaFileEmbedNode {
    return new PaFileEmbedNode(node.__blockId, node.__legacyProperties, node.__legacyContent, node.__key);
  }

  constructor(
    blockId: string,
    legacyProperties: Record<string, unknown> = {},
    legacyContent: Record<string, unknown> = { root: { type: "root", children: [] } },
    key?: NodeKey,
  ) {
    super(key);
    this.__blockId = blockId;
    this.__legacyProperties = legacyProperties;
    this.__legacyContent = legacyContent;
  }

  isInline(): boolean {
    return false;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement("div");
    el.setAttribute("data-pa-decorator", "pa-file-embed");
    return el;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): ReactElement {
    const block: BlockEntity = {
      id: this.__blockId,
      type: "file_embed",
      properties: this.__legacyProperties,
      content: this.__legacyContent,
      sortOrder: 0,
    };
    return <FileEmbedShell block={block} lexicalKey={this.getKey()} />;
  }

  exportJSON(): SerializedPaFile {
    return {
      type: "pa-file-embed",
      version: 1,
      blockId: this.__blockId,
      legacyProperties: this.__legacyProperties,
      legacyContent: this.__legacyContent,
    };
  }

  static importJSON(serializedNode: SerializedPaFile): PaFileEmbedNode {
    return $applyNodeReplacement(
      new PaFileEmbedNode(
        serializedNode.blockId,
        serializedNode.legacyProperties ?? {},
        serializedNode.legacyContent ?? { root: { type: "root", children: [] } },
      ),
    );
  }
}

export function $isPaFileEmbedNode(node: unknown): node is PaFileEmbedNode {
  return node instanceof PaFileEmbedNode;
}

function FileEmbedShell(props: { block: BlockEntity; lexicalKey: string }) {
  const { pageId } = usePageBodySurface();
  return <FileEmbedBlock block={props.block} pageId={pageId} lexicalKey={props.lexicalKey} />;
}

/* --- Legacy blocks --- */

type SerializedPaLegacy = {
  type: "pa-legacy";
  version: 1;
  blockId: string;
  dbType: string;
  legacyProperties: Record<string, unknown>;
  legacyContent: Record<string, unknown>;
};

export class PaLegacyNode extends DecoratorNode<ReactElement> {
  __blockId: string;
  __dbType: string;
  __legacyProperties: Record<string, unknown>;
  __legacyContent: Record<string, unknown>;

  static getType(): string {
    return "pa-legacy";
  }

  static clone(node: PaLegacyNode): PaLegacyNode {
    return new PaLegacyNode(
      node.__blockId,
      node.__dbType,
      node.__legacyProperties,
      node.__legacyContent,
      node.__key,
    );
  }

  constructor(
    blockId: string,
    dbType: string,
    legacyProperties: Record<string, unknown> = {},
    legacyContent: Record<string, unknown> = { root: { type: "root", children: [] } },
    key?: NodeKey,
  ) {
    super(key);
    this.__blockId = blockId;
    this.__dbType = dbType;
    this.__legacyProperties = legacyProperties;
    this.__legacyContent = legacyContent;
  }

  isInline(): boolean {
    return false;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement("div");
    el.setAttribute("data-pa-decorator", "pa-legacy");
    return el;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(editor: LexicalEditor, _config: EditorConfig): ReactElement {
    return (
      <LegacyBlockInner
        editor={editor}
        nodeKey={this.getKey()}
        blockId={this.__blockId}
        dbType={this.__dbType}
        legacyProperties={this.__legacyProperties}
        legacyContent={this.__legacyContent}
      />
    );
  }

  exportJSON(): SerializedPaLegacy {
    return {
      type: "pa-legacy",
      version: 1,
      blockId: this.__blockId,
      dbType: this.__dbType,
      legacyProperties: this.__legacyProperties,
      legacyContent: this.__legacyContent,
    };
  }

  static importJSON(serializedNode: SerializedPaLegacy): PaLegacyNode {
    return $applyNodeReplacement(
      new PaLegacyNode(
        serializedNode.blockId,
        serializedNode.dbType,
        serializedNode.legacyProperties ?? {},
        serializedNode.legacyContent ?? { root: { type: "root", children: [] } },
      ),
    );
  }
}

export function $isPaLegacyNode(node: unknown): node is PaLegacyNode {
  return node instanceof PaLegacyNode;
}

function patchLegacyNode(
  editor: LexicalEditor,
  nodeKey: NodeKey,
  patch: { properties?: Record<string, unknown>; content?: Record<string, unknown> },
) {
  editor.update(() => {
    const raw = $getNodeByKey(nodeKey);
    if (!$isPaLegacyNode(raw)) return;
    const n = raw.getWritable();
    if (patch.properties) n.__legacyProperties = { ...n.__legacyProperties, ...patch.properties };
    if (patch.content) n.__legacyContent = patch.content;
  });
}

function PageLinkLegacyDecorated(props: {
  linkedPageId: string;
  legacyContent: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const { spaceId } = usePageBodySurface();
  const { data: pages = [] } = useSpacePagesFlat(spaceId);

  const legacyLabel = extractPlainText(props.legacyContent);
  const row = pages.find((p) => p.id === props.linkedPageId);
  const live = row?.title?.trim();
  const label =
    live && live.length > 0 ? live : legacyLabel || t("editor.slash.pageLink");

  return (
    <Link
      to={`/pages/p/${props.linkedPageId}`}
      className="text-[15px] text-[var(--pa-accent)] underline-offset-2 hover:underline"
    >
      {label}
    </Link>
  );
}

function blockTextClass(type: string): string {
  switch (type) {
    case "heading1":
      return "text-3xl font-bold";
    case "heading2":
      return "text-2xl font-semibold";
    case "heading3":
      return "text-xl font-semibold";
    default:
      return "text-[15px] leading-[1.65]";
  }
}

function LegacyBlockInner(props: {
  editor: LexicalEditor;
  nodeKey: NodeKey;
  blockId: string;
  dbType: string;
  legacyProperties: Record<string, unknown>;
  legacyContent: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const { pageId } = usePageBodySurface();

  const patch = useCallback(
    (p: { properties?: Record<string, unknown>; content?: Record<string, unknown> }) => {
      patchLegacyNode(props.editor, props.nodeKey, p);
    },
    [props.editor, props.nodeKey],
  );

  const block: BlockEntity = useMemo(
    () => ({
      id: props.blockId,
      type: props.dbType,
      properties: props.legacyProperties,
      content: props.legacyContent,
      sortOrder: 0,
    }),
    [props.blockId, props.dbType, props.legacyProperties, props.legacyContent],
  );

  if (props.dbType === "database") {
    const dbId = String(props.legacyProperties["database_id"] ?? "");
    if (!dbId) {
      return <p className="text-xs text-[var(--pa-tertiary)]">{t("canvas.databaseUnset")}</p>;
    }
    return <InlineDatabaseBlock databaseId={dbId} />;
  }

  if (props.dbType === "page_link") {
    const linked = String(props.legacyProperties["linked_page_id"] ?? "");
    if (!linked) {
      return <p className="text-xs text-[var(--pa-tertiary)]">{t("canvas.pageLinkUnset")}</p>;
    }
    return <PageLinkLegacyDecorated linkedPageId={linked} legacyContent={props.legacyContent} />;
  }

  if (props.dbType === "todo") {
    return (
      <TodoLegacy
        block={block}
        patch={patch}
        placeholder={t("editor.slashHint")}
        textClass={blockTextClass("paragraph")}
      />
    );
  }

  if (props.dbType === "toggle") {
    return (
      <ToggleLegacy
        block={block}
        patch={patch}
        placeholder={t("editor.slashHint")}
        label={t("editor.slash.toggle")}
        textClass={blockTextClass("paragraph")}
      />
    );
  }

  if (props.dbType === "callout") {
    return (
      <CalloutLegacy
        block={block}
        patch={patch}
        placeholder={t("editor.slashHint")}
        emojiLabel={t("editor.calloutEmoji")}
        textClass={blockTextClass("paragraph")}
      />
    );
  }

  return (
    <p className="text-xs text-[var(--pa-tertiary)]">
      {props.dbType} ({pageId})
    </p>
  );
}

function TodoLegacy(props: {
  block: BlockEntity;
  patch: (p: { properties?: Record<string, unknown>; content?: Record<string, unknown> }) => void;
  placeholder: string;
  textClass: string;
}) {
  const { t } = useTranslation();
  const checked = Boolean(props.block.properties["checked"]);
  const initial = useMemo(() => extractPlainText(props.block.content), [props.block.content]);
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(extractPlainText(props.block.content));
  }, [props.block.content]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="flex gap-2 items-start">
      <input
        type="checkbox"
        className="mt-1.5 shrink-0"
        checked={checked}
        onChange={(e) => props.patch({ properties: { checked: e.target.checked } })}
        aria-label={t("editor.slash.todo")}
      />
      <textarea
        className={`w-full resize-none bg-transparent outline-none border-0 p-0 focus:ring-0 ${props.textClass}`}
        rows={Math.max(2, text.split("\n").length)}
        placeholder={props.placeholder}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            props.patch({ content: paragraphFromText(v) as Record<string, unknown> });
          }, 400);
        }}
        onBlur={() => props.patch({ content: paragraphFromText(text) as Record<string, unknown> })}
      />
    </div>
  );
}

function ToggleLegacy(props: {
  block: BlockEntity;
  patch: (p: { properties?: Record<string, unknown>; content?: Record<string, unknown> }) => void;
  placeholder: string;
  label: string;
  textClass: string;
}) {
  const open = props.block.properties["open"] !== false;
  const initial = useMemo(() => extractPlainText(props.block.content), [props.block.content]);
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(extractPlainText(props.block.content));
  }, [props.block.content]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-[var(--pa-secondary)] mb-1 hover:text-[var(--pa-fg)]"
        onClick={() => props.patch({ properties: { open: !open } })}
        aria-expanded={open}
      >
        <span className="w-4 text-center">{open ? "▼" : "▶"}</span>
        <span>{props.label}</span>
      </button>
      {open ? (
        <textarea
          className={`w-full resize-none bg-transparent outline-none border-0 p-0 focus:ring-0 ${props.textClass}`}
          rows={Math.max(2, text.split("\n").length)}
          placeholder={props.placeholder}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              props.patch({ content: paragraphFromText(v) as Record<string, unknown> });
            }, 400);
          }}
          onBlur={() => props.patch({ content: paragraphFromText(text) as Record<string, unknown> })}
        />
      ) : null}
    </div>
  );
}

function CalloutLegacy(props: {
  block: BlockEntity;
  patch: (p: { properties?: Record<string, unknown>; content?: Record<string, unknown> }) => void;
  placeholder: string;
  emojiLabel: string;
  textClass: string;
}) {
  const emoji = String(props.block.properties["emoji"] ?? "💡");
  const initial = useMemo(() => extractPlainText(props.block.content), [props.block.content]);
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(extractPlainText(props.block.content));
  }, [props.block.content]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      className="flex gap-2 items-start rounded-md border px-2 py-2"
      style={{ borderColor: "var(--pa-divider)", background: "var(--pa-hover)" }}
    >
      <input
        className="w-9 text-center bg-transparent border-0 outline-none text-lg"
        value={emoji}
        onChange={(e) => props.patch({ properties: { emoji: e.target.value.slice(0, 4) } })}
        aria-label={props.emojiLabel}
      />
      <textarea
        className={`flex-1 resize-none bg-transparent outline-none border-0 p-0 focus:ring-0 ${props.textClass}`}
        rows={Math.max(2, text.split("\n").length)}
        placeholder={props.placeholder}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            props.patch({ content: paragraphFromText(v) as Record<string, unknown> });
          }, 400);
        }}
        onBlur={() => props.patch({ content: paragraphFromText(text) as Record<string, unknown> })}
      />
    </div>
  );
}

export const PAGE_BODY_DECORATOR_NODES = [PaDividerNode, PaFileEmbedNode, PaLegacyNode] as const;

/** Top-level decorator blocks that cannot host a text caret — document must not end on one. */
export function $isTopLevelPaDecorator(node: LexicalNode | null | undefined): boolean {
  if (!node) return false;
  const t = node.getType();
  return t === "pa-divider" || t === "pa-file-embed" || t === "pa-legacy";
}
