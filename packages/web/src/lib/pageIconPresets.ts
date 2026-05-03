/** Curated single-codepoint glyphs for page icons (first-click random pick). */
export const PAGE_ICON_PRESETS: readonly string[] = [
  "📄",
  "✨",
  "💡",
  "🎯",
  "🚀",
  "📌",
  "📝",
  "🗂️",
  "📎",
  "🔖",
  "🏠",
  "💼",
  "🌿",
  "🌊",
  "⭐",
  "🎨",
  "📚",
  "🧭",
  "🔭",
  "🛠️",
];

export function pickRandomPageIcon(): string {
  const i = Math.floor(Math.random() * PAGE_ICON_PRESETS.length);
  return PAGE_ICON_PRESETS[i] ?? PAGE_ICON_PRESETS[0]!;
}
