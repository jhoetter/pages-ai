import { describe, expect, it } from "vitest";
import * as Y from "yjs";

describe("yjs", () => {
  it("applies update to empty doc", () => {
    const a = new Y.Doc();
    a.getText("x").insert(0, "hi");
    const u = Y.encodeStateAsUpdate(a);
    const b = new Y.Doc();
    Y.applyUpdate(b, u);
    expect(b.getText("x").toString()).toBe("hi");
  });
});
