import { describe, expect, it } from "vitest";
import { extractPlainText, paragraphFromText } from "./rich-text.js";

describe("rich-text", () => {
  it("roundtrips plain text", () => {
    const c = paragraphFromText("hello");
    expect(extractPlainText(c)).toBe("hello");
  });
});
