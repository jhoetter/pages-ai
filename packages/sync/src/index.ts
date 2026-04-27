import * as Y from "yjs";

export const roomNameForPage = (pageId: string) => `page:${pageId}`;

export function createPageDoc(): Y.Doc {
  return new Y.Doc();
}

export type ClientWsMessage =
  | { t: "sync_step1"; docId: string; sv: number[] }
  | { t: "sync_update"; docId: string; update: number[] }
  | { t: "awareness"; docId: string; payload: unknown };

export type ServerWsMessage =
  | { t: "sync_ack"; docId: string }
  | { t: "sync_update"; docId: string; update: number[] }
  | { t: "awareness"; docId: string; payload: unknown }
  | { t: "error"; code: string };
