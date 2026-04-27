export type ViewQuery = {
  filters: Array<{ propertyId: string; op: string; value: unknown }>;
  sorts: Array<{ propertyId: string; direction: "asc" | "desc" }>;
  groupBy?: string;
};

export function applyFilters(
  rows: Array<{ id: string; cells: Record<string, unknown> }>,
  filters: ViewQuery["filters"],
): Array<{ id: string; cells: Record<string, unknown> }> {
  return rows.filter((row) =>
    filters.every((f) => {
      const v = row.cells[f.propertyId];
      switch (f.op) {
        case "eq":
          return v === f.value;
        case "contains":
          return String(v ?? "").includes(String(f.value ?? ""));
        default:
          return true;
      }
    }),
  );
}

export function applySorts(
  rows: Array<{ id: string; cells: Record<string, unknown> }>,
  sorts: ViewQuery["sorts"],
): Array<{ id: string; cells: Record<string, unknown> }> {
  const out = [...rows];
  for (const s of [...sorts].reverse()) {
    out.sort((a, b) => {
      const av = a.cells[s.propertyId];
      const bv = b.cells[s.propertyId];
      const cmp = av === bv ? 0 : av == null ? 1 : bv == null ? -1 : av < bv ? -1 : 1;
      return s.direction === "asc" ? cmp : -cmp;
    });
  }
  return out;
}

/** v1: formulas as simple `=1+1` numeric only — otherwise return null */
export function evalFormulaSafe(expr: string, _row: Record<string, unknown>): number | null {
  const trimmed = expr.trim();
  if (!trimmed.startsWith("=")) return null;
  const inner = trimmed.slice(1);
  if (!/^[\d+\-*/().\s]+$/.test(inner)) return null;
  try {
    return Function(`"use strict"; return (${inner})`)() as number;
  } catch {
    return null;
  }
}
