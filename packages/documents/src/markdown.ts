import { extractPlainText, paragraphFromText } from "./rich-text.js";

/** Very small markdown → blocks: split on double newlines as paragraphs */
export function markdownToBlocks(
  md: string,
): Array<{ type: string; content: Record<string, unknown> }> {
  const chunks = md
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return chunks.map((text) => ({
    type: "paragraph",
    content: paragraphFromText(text.replace(/\n/g, " ")),
  }));
}

export function blocksToMarkdown(
  blocks: Array<{ type: string; content: Record<string, unknown> }>,
): string {
  return blocks.map((b) => extractPlainText(b.content)).join("\n\n");
}
