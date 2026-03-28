import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAccess = vi.fn();
const mockReadFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

vi.mock("node:fs", () => ({
  constants: { R_OK: 4 },
}));

let mockGetText = vi.fn();
let mockDestroy = vi.fn();

vi.mock("pdf-parse", () => ({
  PDFParse: class MockPDFParse {
    constructor() {}
    getText = mockGetText;
    destroy = mockDestroy;
  },
}));

describe("loadDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetText = vi.fn();
    mockDestroy = vi.fn();
  });

  it("throws if file does not exist", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const { loadDocument } = await import("../src/loader.js");
    await expect(loadDocument("/fake/file.pdf")).rejects.toThrow("not found or not readable");
  });

  it("throws if file is not a valid PDF", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("not a pdf file"));

    const { loadDocument } = await import("../src/loader.js");
    await expect(loadDocument("/fake/file.pdf")).rejects.toThrow("Invalid PDF file");
  });

  it("throws if PDF has no extractable text", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("%PDF-some content"));
    mockGetText.mockResolvedValue({ text: "", pages: [] });

    const { loadDocument } = await import("../src/loader.js");
    await expect(loadDocument("/fake/file.pdf")).rejects.toThrow("no extractable text");
    expect(mockDestroy).toHaveBeenCalled();
  });

  it("returns page chunks from valid PDF", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("%PDF-some content"));
    mockGetText.mockResolvedValue({
      text: "Page 1 content\nPage 2 content",
      pages: [
        { num: 1, text: "Page 1 content" },
        { num: 2, text: "Page 2 content" },
      ],
    });

    const { loadDocument } = await import("../src/loader.js");
    const pages = await loadDocument("/fake/file.pdf");

    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({ pageNumber: 1, text: "Page 1 content" });
    expect(pages[1]).toEqual({ pageNumber: 2, text: "Page 2 content" });
    expect(mockDestroy).toHaveBeenCalled();
  });

  it("filters out empty pages", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("%PDF-content"));
    mockGetText.mockResolvedValue({
      text: "Content",
      pages: [
        { num: 1, text: "Content" },
        { num: 2, text: "   " },
        { num: 3, text: "More content" },
      ],
    });

    const { loadDocument } = await import("../src/loader.js");
    const pages = await loadDocument("/fake/file.pdf");

    expect(pages).toHaveLength(2);
    expect(pages[0]?.pageNumber).toBe(1);
    expect(pages[1]?.pageNumber).toBe(3);
  });

  it("throws if PDF exceeds token limit", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("%PDF-content"));
    const hugeText = "x".repeat(700_000); // ~175k tokens
    mockGetText.mockResolvedValue({
      text: hugeText,
      pages: [{ num: 1, text: hugeText }],
    });

    const { loadDocument } = await import("../src/loader.js");
    await expect(loadDocument("/fake/file.pdf")).rejects.toThrow("too large");
    expect(mockDestroy).toHaveBeenCalled();
  });

  it("calls destroy even when getText throws", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("%PDF-content"));
    mockGetText.mockRejectedValue(new Error("parse failure"));

    const { loadDocument } = await import("../src/loader.js");
    await expect(loadDocument("/fake/file.pdf")).rejects.toThrow("parse failure");
    expect(mockDestroy).toHaveBeenCalled();
  });
});
