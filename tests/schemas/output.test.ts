import { describe, it, expect } from "vitest";
import {
  ExtractedEntitySchema,
  SectionSummarySchema,
  DocumentOutputSchema,
} from "../../src/schemas/output.js";

describe("ExtractedEntitySchema", () => {
  it("accepts a valid entity", () => {
    const entity = {
      type: "person",
      value: "John Smith",
      confidence: 0.95,
      pageNumber: 1,
    };
    expect(ExtractedEntitySchema.parse(entity)).toEqual(entity);
  });

  it("rejects invalid entity type", () => {
    const entity = {
      type: "invalid",
      value: "test",
      confidence: 0.5,
      pageNumber: 1,
    };
    expect(() => ExtractedEntitySchema.parse(entity)).toThrow();
  });

  it("rejects confidence out of range", () => {
    expect(() =>
      ExtractedEntitySchema.parse({
        type: "person",
        value: "test",
        confidence: 1.5,
        pageNumber: 1,
      }),
    ).toThrow();

    expect(() =>
      ExtractedEntitySchema.parse({
        type: "person",
        value: "test",
        confidence: -0.1,
        pageNumber: 1,
      }),
    ).toThrow();
  });

  it("rejects non-positive page number", () => {
    expect(() =>
      ExtractedEntitySchema.parse({
        type: "person",
        value: "test",
        confidence: 0.5,
        pageNumber: 0,
      }),
    ).toThrow();
  });
});

describe("SectionSummarySchema", () => {
  it("accepts a valid section summary", () => {
    const section = {
      heading: "Introduction",
      summary: "This is a summary.",
      pageRange: [1, 3] as [number, number],
      keyEntities: [
        { type: "person" as const, value: "John", confidence: 0.9, pageNumber: 1 },
      ],
    };
    expect(SectionSummarySchema.parse(section)).toEqual(section);
  });

  it("accepts empty keyEntities", () => {
    const section = {
      heading: "Section",
      summary: "Summary.",
      pageRange: [1, 1] as [number, number],
      keyEntities: [],
    };
    expect(SectionSummarySchema.parse(section)).toEqual(section);
  });

  it("rejects reversed pageRange", () => {
    expect(() =>
      SectionSummarySchema.parse({
        heading: "Section",
        summary: "Summary.",
        pageRange: [5, 1],
        keyEntities: [],
      }),
    ).toThrow("pageRange end must be >= start");
  });

  it("rejects non-positive page numbers in pageRange", () => {
    expect(() =>
      SectionSummarySchema.parse({
        heading: "Section",
        summary: "Summary.",
        pageRange: [0, 3],
        keyEntities: [],
      }),
    ).toThrow();
  });
});

describe("DocumentOutputSchema", () => {
  it("accepts a valid document output", () => {
    const doc = {
      metadata: {
        fileName: "test.pdf",
        totalPages: 5,
        processedAt: "2024-01-01T00:00:00Z",
        pipelineVersion: "1.0",
      },
      entities: [
        { type: "person" as const, value: "Jane", confidence: 0.88, pageNumber: 2 },
      ],
      sections: [
        {
          heading: "Overview",
          summary: "A brief overview.",
          pageRange: [1, 5] as [number, number],
          keyEntities: [],
        },
      ],
      fullSummary: "Full document summary.",
    };
    expect(DocumentOutputSchema.parse(doc)).toEqual(doc);
  });

  it("rejects invalid processedAt format", () => {
    expect(() =>
      DocumentOutputSchema.parse({
        metadata: {
          fileName: "test.pdf",
          totalPages: 5,
          processedAt: "not-a-date",
          pipelineVersion: "1.0",
        },
        entities: [],
        sections: [],
        fullSummary: "Summary",
      }),
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => DocumentOutputSchema.parse({})).toThrow();
  });
});
