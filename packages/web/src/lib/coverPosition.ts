export function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** Parse CSS `x% y%` for background-position; default centered. */
export function parseCoverPosition(s: string | null | undefined): { x: number; y: number } {
  if (s == null || !String(s).trim()) return { x: 50, y: 50 };
  const m = String(s).trim().match(/^(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (m) return { x: Number(m[1]), y: Number(m[2]) };
  return { x: 50, y: 50 };
}

export function formatCoverPosition(x: number, y: number): string {
  return `${Math.round(clampPct(x))}% ${Math.round(clampPct(y))}%`;
}
