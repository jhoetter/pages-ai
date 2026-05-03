const STORAGE_KEY = "pagesai:starred-pages:v1";

/** Load starred page IDs (client-only persistence). */
export function loadStarredPageIds(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveStarredPageIds(ids: Set<string>): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

/** Remove IDs that no longer exist in the workspace. */
export function pruneStarredPageIds(validIds: ReadonlySet<string>): Set<string> {
  const cur = loadStarredPageIds();
  let changed = false;
  for (const id of cur) {
    if (!validIds.has(id)) {
      cur.delete(id);
      changed = true;
    }
  }
  if (changed) saveStarredPageIds(cur);
  return cur;
}

export function toggleStarredPageId(id: string): Set<string> {
  const next = loadStarredPageIds();
  if (next.has(id)) next.delete(id);
  else next.add(id);
  saveStarredPageIds(next);
  return next;
}
