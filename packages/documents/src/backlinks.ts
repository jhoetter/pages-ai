/** Scan content tree for page mentions / links */

export function extractPageRefs(content: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n["type"] === "mention" && n["mentionType"] === "page" && typeof n["id"] === "string") {
      ids.push(n["id"]);
    }
    const children = n["children"];
    if (Array.isArray(children)) children.forEach(walk);
  };
  walk(content["root"] ?? content);
  return ids;
}
