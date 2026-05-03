import { CodeNode } from "@lexical/code";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode, type SerializedHeadingNode } from "@lexical/rich-text";
import type { HeadingTagType } from "@lexical/rich-text";
import type { SerializedCodeNode } from "@lexical/code";
import type { EditorConfig, NodeKey, RangeSelection, SerializedLexicalNode } from "lexical";
import {
  $applyNodeReplacement,
  $parseSerializedNode,
  ElementNode,
  ParagraphNode,
  type ParagraphNode as ParagraphNodeType,
  type SerializedElementNode,
  type SerializedParagraphNode,
  type Spread,
} from "lexical";

function newBlockId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* --- Paragraph --- */

export type SerializedPaParagraphNode = Spread<{ blockId: string; type: "pa-paragraph" }, SerializedParagraphNode>;

export class PaParagraphNode extends ParagraphNode {
  __blockId: string;

  static getType(): string {
    return "pa-paragraph";
  }

  static clone(node: PaParagraphNode): PaParagraphNode {
    return new PaParagraphNode(node.__blockId, node.__key);
  }

  constructor(blockId: string = newBlockId(), key?: NodeKey) {
    super(key);
    this.__blockId = blockId;
  }

  getBlockId(): string {
    return this.getLatest().__blockId;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = super.createDOM(config);
    el.setAttribute("data-block-id", this.__blockId);
    el.classList.add("pa-block", "pa-paragraph");
    return el;
  }

  updateDOM(prev: PaParagraphNode, dom: HTMLElement, config: EditorConfig): boolean {
    if (prev.__blockId !== this.__blockId) dom.setAttribute("data-block-id", this.__blockId);
    return super.updateDOM(prev, dom, config);
  }

  static importJSON(serializedNode: SerializedPaParagraphNode): PaParagraphNode {
    const { blockId, ...rest } = serializedNode;
    const base = ParagraphNode.importJSON(rest as unknown as SerializedParagraphNode);
    const node = new PaParagraphNode(blockId);
    node.setFormat(base.getFormatType());
    node.setIndent(base.getIndent());
    node.setDirection(base.getDirection());
    node.setStyle(base.getStyle());
    const children = base.getChildren();
    children.forEach((ch) => node.append(ch));
    return $applyNodeReplacement(node);
  }

  exportJSON(): SerializedPaParagraphNode {
    return { ...super.exportJSON(), blockId: this.__blockId, type: "pa-paragraph" };
  }

  insertNewAfter(rangeSelection: RangeSelection, restoreSelection?: boolean): ParagraphNodeType {
    const newElement = $createPaParagraphNode();
    newElement.setTextFormat(rangeSelection.format);
    newElement.setTextStyle(rangeSelection.style);
    const direction = this.getDirection();
    newElement.setDirection(direction);
    newElement.setFormat(this.getFormatType());
    newElement.setStyle(this.getStyle());
    this.insertAfter(newElement, restoreSelection);
    return newElement;
  }
}

export function $createPaParagraphNode(blockId?: string): PaParagraphNode {
  return $applyNodeReplacement(new PaParagraphNode(blockId));
}

export function $isPaParagraphNode(n: unknown): n is PaParagraphNode {
  return n instanceof PaParagraphNode;
}

/* --- Heading --- */

export type SerializedPaHeadingNode = Spread<{ blockId: string; type: "pa-heading" }, SerializedHeadingNode>;

export class PaHeadingNode extends HeadingNode {
  __blockId: string;

  static getType(): string {
    return "pa-heading";
  }

  static clone(node: PaHeadingNode): PaHeadingNode {
    return new PaHeadingNode(node.getTag(), node.__blockId, node.__key);
  }

  constructor(tag: HeadingTagType = "h1", blockId: string = newBlockId(), key?: NodeKey) {
    super(tag, key);
    this.__blockId = blockId;
  }

  getBlockId(): string {
    return this.getLatest().__blockId;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = super.createDOM(config);
    el.setAttribute("data-block-id", this.__blockId);
    el.classList.add("pa-block", "pa-heading");
    return el;
  }

  updateDOM(prevNode: PaHeadingNode, dom: HTMLElement, config: EditorConfig): boolean {
    if (prevNode.__blockId !== this.__blockId) dom.setAttribute("data-block-id", this.__blockId);
    return super.updateDOM(prevNode as never, dom, config);
  }

  static importJSON(serializedNode: SerializedPaHeadingNode): PaHeadingNode {
    const { blockId, ...rest } = serializedNode;
    const base = HeadingNode.importJSON(rest as SerializedHeadingNode);
    const node = new PaHeadingNode(base.getTag(), blockId);
    node.setFormat(base.getFormatType());
    node.setIndent(base.getIndent());
    node.setDirection(base.getDirection());
    const children = base.getChildren();
    children.forEach((ch) => node.append(ch));
    return $applyNodeReplacement(node) as PaHeadingNode;
  }

  exportJSON(): SerializedPaHeadingNode {
    return { ...super.exportJSON(), blockId: this.__blockId, type: "pa-heading" };
  }

  insertNewAfter(selection?: RangeSelection, restoreSelection = true): PaHeadingNode | PaParagraphNode {
    const anchorOffet = selection ? selection.anchor.offset : 0;
    const lastDesc = this.getLastDescendant();
    const isAtEnd =
      !lastDesc ||
      (selection &&
        selection.anchor.key === lastDesc.getKey() &&
        anchorOffet === lastDesc.getTextContentSize());
    const newElement =
      isAtEnd || !selection ? $createPaParagraphNode() : $createPaHeadingNode(this.getTag());
    const direction = this.getDirection();
    newElement.setDirection(direction);
    this.insertAfter(newElement, restoreSelection);
    if (anchorOffet === 0 && !this.isEmpty() && selection) {
      const paragraph = $createPaParagraphNode();
      paragraph.select();
      this.replace(paragraph, true);
    }
    return newElement;
  }
}

export function $createPaHeadingNode(tag: HeadingTagType = "h1", blockId?: string): PaHeadingNode {
  return $applyNodeReplacement(new PaHeadingNode(tag, blockId));
}

export function $isPaHeadingNode(n: unknown): n is PaHeadingNode {
  return n instanceof PaHeadingNode;
}

/* --- Quote --- */

export type SerializedPaQuoteNode = Spread<{ blockId: string; type: "pa-quote" }, SerializedElementNode>;

export class PaQuoteNode extends QuoteNode {
  __blockId: string;

  static getType(): string {
    return "pa-quote";
  }

  static clone(node: PaQuoteNode): PaQuoteNode {
    return new PaQuoteNode(node.__blockId, node.__key);
  }

  constructor(blockId: string = newBlockId(), key?: NodeKey) {
    super(key);
    this.__blockId = blockId;
  }

  getBlockId(): string {
    return this.getLatest().__blockId;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = super.createDOM(config);
    el.setAttribute("data-block-id", this.__blockId);
    el.classList.add("pa-block", "pa-quote");
    return el;
  }

  updateDOM(prevNode: PaQuoteNode, dom: HTMLElement): boolean {
    if (prevNode.__blockId !== this.__blockId) dom.setAttribute("data-block-id", this.__blockId);
    return super.updateDOM(prevNode as never, dom);
  }

  static importJSON(serializedNode: SerializedPaQuoteNode): PaQuoteNode {
    const { blockId, ...rest } = serializedNode;
    const base = QuoteNode.importJSON(rest as SerializedElementNode);
    const node = new PaQuoteNode(blockId);
    node.setFormat(base.getFormatType());
    node.setIndent(base.getIndent());
    node.setDirection(base.getDirection());
    const children = base.getChildren();
    children.forEach((ch) => node.append(ch));
    return $applyNodeReplacement(node) as PaQuoteNode;
  }

  exportJSON(): SerializedPaQuoteNode {
    return { ...super.exportJSON(), blockId: this.__blockId, type: "pa-quote" };
  }

  insertNewAfter(_: RangeSelection, restoreSelection?: boolean): PaParagraphNode {
    const newBlock = $createPaParagraphNode();
    const direction = this.getDirection();
    newBlock.setDirection(direction);
    this.insertAfter(newBlock, restoreSelection);
    return newBlock;
  }
}

export function $createPaQuoteNode(blockId?: string): PaQuoteNode {
  return $applyNodeReplacement(new PaQuoteNode(blockId));
}

export function $isPaQuoteNode(n: unknown): n is PaQuoteNode {
  return n instanceof PaQuoteNode;
}

/* --- Code --- */

export type SerializedPaCodeNode = Spread<{ blockId: string; type: "pa-code" }, SerializedCodeNode>;

export class PaCodeNode extends CodeNode {
  __blockId: string;

  static getType(): string {
    return "pa-code";
  }

  static clone(node: PaCodeNode): PaCodeNode {
    return new PaCodeNode(node.getLanguage(), node.__blockId, node.__key);
  }

  constructor(language?: string | null, blockId: string = newBlockId(), key?: NodeKey) {
    super(language, key);
    this.__blockId = blockId;
  }

  getBlockId(): string {
    return this.getLatest().__blockId;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = super.createDOM(config);
    el.setAttribute("data-block-id", this.__blockId);
    el.classList.add("pa-block", "pa-code");
    return el;
  }

  updateDOM(prevNode: PaCodeNode, dom: HTMLElement, config: EditorConfig): boolean {
    if (prevNode.__blockId !== this.__blockId) dom.setAttribute("data-block-id", this.__blockId);
    return super.updateDOM(prevNode as never, dom, config);
  }

  static importJSON(serializedNode: SerializedPaCodeNode): PaCodeNode {
    const { blockId, ...rest } = serializedNode;
    const base = CodeNode.importJSON(rest as SerializedCodeNode);
    const node = new PaCodeNode(base.getLanguage(), blockId);
    const children = base.getChildren();
    children.forEach((ch) => node.append(ch));
    return $applyNodeReplacement(node) as PaCodeNode;
  }

  exportJSON(): SerializedPaCodeNode {
    return { ...super.exportJSON(), blockId: this.__blockId, type: "pa-code" };
  }

  insertNewAfter(selection: RangeSelection, restoreSelection?: boolean): PaParagraphNode | null {
    const newElement = $createPaParagraphNode();
    newElement.setTextFormat(selection.format);
    newElement.setTextStyle(selection.style);
    this.insertAfter(newElement, restoreSelection);
    return newElement;
  }
}

export function $createPaCodeNode(language?: string | null, blockId?: string): PaCodeNode {
  return $applyNodeReplacement(new PaCodeNode(language, blockId));
}

export function $isPaCodeNode(n: unknown): n is PaCodeNode {
  return n instanceof PaCodeNode;
}

/* --- List host --- */

export type SerializedPaListBlockNode = Spread<{ blockId: string; type: "pa-list" }, SerializedElementNode>;

export class PaListBlockNode extends ElementNode {
  __blockId: string;

  static getType(): string {
    return "pa-list";
  }

  static clone(node: PaListBlockNode): PaListBlockNode {
    return new PaListBlockNode(node.__blockId, node.__key);
  }

  constructor(blockId: string = newBlockId(), key?: NodeKey) {
    super(key);
    this.__blockId = blockId;
  }

  getBlockId(): string {
    return this.getLatest().__blockId;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const d = document.createElement("div");
    d.className = "pa-list-host pa-block";
    d.setAttribute("data-block-id", this.__blockId);
    return d;
  }

  updateDOM(prev: PaListBlockNode, dom: HTMLElement): boolean {
    if (prev.__blockId !== this.__blockId) {
      dom.setAttribute("data-block-id", this.__blockId);
    }
    return false;
  }

  static importJSON(serializedNode: SerializedPaListBlockNode): PaListBlockNode {
    const { blockId, children = [] } = serializedNode;
    const node = new PaListBlockNode(blockId);
    for (const child of children as SerializedLexicalNode[]) {
      node.append($parseSerializedNode(child));
    }
    return $applyNodeReplacement(node) as PaListBlockNode;
  }

  exportJSON(): SerializedPaListBlockNode {
    return {
      ...super.exportJSON(),
      type: "pa-list",
      blockId: this.__blockId,
      version: 1,
    };
  }

  insertNewAfter(_selection: RangeSelection, restoreSelection?: boolean): PaParagraphNode {
    const nw = $createPaParagraphNode();
    this.insertAfter(nw, restoreSelection);
    return nw;
  }

  isShadowRoot(): boolean {
    return true;
  }
}

export function $createPaListBlockNode(blockId?: string): PaListBlockNode {
  return $applyNodeReplacement(new PaListBlockNode(blockId));
}

export function $isPaListBlockNode(n: unknown): n is PaListBlockNode {
  return n instanceof PaListBlockNode;
}

export const PAGE_BODY_ELEMENT_NODES = [
  PaParagraphNode,
  PaHeadingNode,
  PaQuoteNode,
  PaCodeNode,
  PaListBlockNode,
  ListNode,
  ListItemNode,
] as const;
