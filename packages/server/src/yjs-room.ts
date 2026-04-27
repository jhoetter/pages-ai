import * as Y from "yjs";
import { roomNameForPage } from "@pagesai/sync";

const rooms = new Map<string, Y.Doc>();

export function getOrCreateRoom(pageId: string): Y.Doc {
  const name = roomNameForPage(pageId);
  let doc = rooms.get(name);
  if (!doc) {
    doc = new Y.Doc();
    rooms.set(name, doc);
  }
  return doc;
}

export function applyUpdate(pageId: string, update: Uint8Array): Uint8Array {
  const doc = getOrCreateRoom(pageId);
  Y.applyUpdate(doc, update);
  return Y.encodeStateAsUpdate(doc);
}

export function getStateVector(pageId: string): Uint8Array {
  const doc = getOrCreateRoom(pageId);
  return Y.encodeStateVector(doc);
}

export function encodeFullUpdate(pageId: string): Uint8Array {
  const doc = getOrCreateRoom(pageId);
  return Y.encodeStateAsUpdate(doc);
}
