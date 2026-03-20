import { describe, it, expect } from "vitest";
import { estimateTokenCount, truncateToTokenLimit } from "../../src/utils/tokens.js";

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

describe("truncateToTokenLimit", () => {
  it("returns text unchanged if within limit", () => {
    const text = "short text";
    expect(truncateToTokenLimit(text, 100)).toBe(text);
  });

  it("truncates text exceeding limit", () => {
    const text = "a".repeat(100);
    const result = truncateToTokenLimit(text, 10);
    expect(result.length).toBe(40);
  });

  it("handles empty text", () => {
    expect(truncateToTokenLimit("", 10)).toBe("");
  });
});
