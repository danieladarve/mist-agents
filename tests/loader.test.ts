import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

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
    vi.mocked(existsSync).mockReturnValue(false);

    const { loadDocument } = await import("../src/loader.js");
    await expect(loadDocument("/fake/file.pdf")).rejects.toThrow("File not found");
  });

  it("throws if file is not a valid PDF", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(Buffer.from("not a pdf file"));

    const { loadDocument } = await import("../src/loader.js");
    await expect(loadDocument("/fake/file.pdf")).rejects.toThrow("Invalid PDF file");
  });

  it("throws if PDF has no extractable text", async () => {
    const pdfBuffer = Buffer.from("%PDF-some content");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(pdfBuffer);
    mockGetText.mockResolvedValue({ text: "", pages: [] });

    const { loadDocument } = await import("../src/loader.js");
    await expect(loadDocument("/fake/file.pdf")).rejects.toThrow("no extractable text");
  });

  it("returns page chunks from valid PDF", async () => {
    const pdfBuffer = Buffer.from("%PDF-some content");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(pdfBuffer);
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
  });

  it("filters out empty pages", async () => {
    const pdfBuffer = Buffer.from("%PDF-content");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(pdfBuffer);
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
});
