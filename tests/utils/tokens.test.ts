import { describe, it, expect } from "vitest";
import { estimateTokenCount } from "../../src/utils/tokens.js";

describe("estimateTokenCount", () => {
  it("estimates tokens as chars / 4 rounded up", () => {
    expect(estimateTokenCount("hello")).toBe(2);
    expect(estimateTokenCount("")).toBe(0);
    expect(estimateTokenCount("a".repeat(100))).toBe(25);
  });

  it("handles single character", () => {
    expect(estimateTokenCount("a")).toBe(1);
  });
});
