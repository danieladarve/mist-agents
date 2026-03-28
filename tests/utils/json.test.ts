import { describe, it, expect } from "vitest";
import { extractJson, extractContentString, JsonParseError } from "../../src/utils/json.js";

describe("extractJson", () => {
  it("parses valid JSON directly", () => {
    const result = extractJson('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("parses JSON array", () => {
    const result = extractJson('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it("handles leading/trailing whitespace", () => {
    const result = extractJson('  {"key": "value"}  ');
    expect(result).toEqual({ key: "value" });
  });

  it("extracts JSON from markdown code fence", () => {
    const raw = 'Here is the result:\n```json\n{"key": "value"}\n```\nDone.';
    const result = extractJson(raw);
    expect(result).toEqual({ key: "value" });
  });

  it("extracts JSON from bare code fence", () => {
    const raw = '```\n{"key": "value"}\n```';
    const result = extractJson(raw);
    expect(result).toEqual({ key: "value" });
  });

  it("extracts JSON by finding first { ... } block", () => {
    const raw = 'Here is the output: {"entities": []} and that is all.';
    const result = extractJson(raw);
    expect(result).toEqual({ entities: [] });
  });

  it("extracts JSON array by finding first [ ... ] block", () => {
    const raw = 'Results: [1, 2, 3] done';
    const result = extractJson(raw);
    expect(result).toEqual([1, 2, 3]);
  });

  it("throws JsonParseError for completely invalid content", () => {
    expect(() => extractJson("this is not json at all")).toThrow(JsonParseError);
  });

  it("throws JsonParseError with raw content info", () => {
    try {
      extractJson("garbage");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(JsonParseError);
      expect((error as JsonParseError).rawContent).toBe("garbage");
    }
  });

  it("handles nested braces correctly", () => {
    const raw = 'output: {"a": {"b": "c"}}';
    const result = extractJson(raw);
    expect(result).toEqual({ a: { b: "c" } });
  });
});

describe("extractContentString", () => {
  it("returns string content as-is", () => {
    expect(extractContentString("hello")).toBe("hello");
  });

  it("joins text blocks from array content", () => {
    const content = [
      { type: "text", text: "hello " },
      { type: "text", text: "world" },
    ];
    expect(extractContentString(content)).toBe("hello world");
  });

  it("filters out non-text blocks", () => {
    const content = [
      { type: "text", text: "hello" },
      { type: "tool_use", id: "123" },
      { type: "text", text: " world" },
    ];
    expect(extractContentString(content as Parameters<typeof extractContentString>[0])).toBe("hello world");
  });

  it("returns empty string for empty array", () => {
    expect(extractContentString([])).toBe("");
  });
});
