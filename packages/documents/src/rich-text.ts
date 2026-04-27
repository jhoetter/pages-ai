/** Minimal Lexical-like paragraph JSON for CLI and tests */

export function paragraphFromText(text: string): Record<string, unknown> {
  return {
    root: {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", text, format: 0 }],
        },
      ],
    },
  };
}

export function extractPlainText(content: Record<string, unknown>): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n["type"] === "text" && typeof n["text"] === "string") {
      parts.push(n["text"]);
    }
    const children = n["children"];
    if (Array.isArray(children)) children.forEach(walk);
  };
  walk(content["root"] ?? content);
  return parts.join(" ").trim();
}
