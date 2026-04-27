import { describe, expect, it } from "vitest";
import { applyFilters, applySorts, evalFormulaSafe } from "./query.js";

describe("database query", () => {
  it("filters eq", () => {
    const rows = [
      { id: "1", cells: { Status: "Todo" } },
      { id: "2", cells: { Status: "Done" } },
    ];
    expect(applyFilters(rows, [{ propertyId: "Status", op: "eq", value: "Done" }])).toEqual([
      rows[1],
    ]);
  });

  it("sorts", () => {
    const rows = [
      { id: "a", cells: { n: 2 } },
      { id: "b", cells: { n: 1 } },
    ];
    const s = applySorts(rows, [{ propertyId: "n", direction: "asc" }]);
    expect(s.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("formula sandbox", () => {
    expect(evalFormulaSafe("=1+2", {})).toBe(3);
    expect(evalFormulaSafe("=process", {})).toBeNull();
  });
});
