/** Stable new id for top-level page body blocks (used by pa-* nodes and decorators). */
export function newTopLevelBlockId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
