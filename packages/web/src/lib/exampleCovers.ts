/**
 * Solid-color covers are stored in `cover_image_url` as `pa-cover:#rrggbb`
 * so we keep a single column and avoid collisions with real URLs.
 */
const PA_COVER_PREFIX = "pa-cover:" as const;

/** Hex presets without `#` — palette-style backgrounds (Tailwind-ish ramps). */
export const EXAMPLE_COVER_COLORS_HEX: readonly string[] = [
  "b91c1c",
  "ea580c",
  "ca8a04",
  "65a30d",
  "15803d",
  "0f766e",
  "0369a1",
  "1d4ed8",
  "6d28d9",
  "86198f",
  "be185d",
  "27272a",
  "52525b",
  "e4e4e7",
];

export function formatCoverColorToken(hexDigits: string): string {
  let h = hexDigits.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/.test(h)) h = "737373";
  return `${PA_COVER_PREFIX}#${h}`;
}

export type ParsedCoverDraft =
  | { kind: "image"; url: string }
  | { kind: "color"; color: string };

export function parseCoverDraft(raw: string): ParsedCoverDraft {
  const s = raw.trim();
  const low = s.toLowerCase();
  if (low.startsWith(PA_COVER_PREFIX.toLowerCase())) {
    const rest = s.slice(PA_COVER_PREFIX.length).trim();
    const body = rest.startsWith("#") ? rest.slice(1) : rest;
    let h = body.toLowerCase();
    if (/^[0-9a-f]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
    if (/^[0-9a-f]{6}$/.test(h)) return { kind: "color", color: `#${h}` };
  }
  return { kind: "image", url: s };
}

export function tryParseHexCoverInput(raw: string): string | null {
  const s = raw.trim();
  let h = s.replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (/^[0-9a-f]{6}$/.test(h)) return formatCoverColorToken(h);
  return null;
}

/**
 * Curated landscape cover images (Unsplash, stable CDN URLs).
 * Used for quick "random" / gallery picks — no API keys.
 */
export const EXAMPLE_COVER_URLS: readonly string[] = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=2000&q=80",
];

export function pickRandomCover(): string {
  const colors = EXAMPLE_COVER_COLORS_HEX.map((h) => formatCoverColorToken(h));
  const pool = [...EXAMPLE_COVER_URLS, ...colors];
  const i = Math.floor(Math.random() * pool.length);
  return pool[i] ?? EXAMPLE_COVER_URLS[0]!;
}
