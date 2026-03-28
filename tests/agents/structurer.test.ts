import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStructurerChain } from "../../src/agents/structurer.js";
import type { AgentConfig } from "../../src/schemas/config.js";

const mockInvoke = vi.fn();

vi.mock("../../src/models.js", () => ({
  createChatModel: () => ({ invoke: mockInvoke }),
}));

const mockConfig: AgentConfig = {
  name: "structurer",
  enabled: true,
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  maxTokens: 8192,
  temperature: 0,
};

const validOutput = {
  metadata: {
    fileName: "test.pdf",
    totalPages: 2,
    processedAt: "2024-01-01T00:00:00Z",
    pipelineVersion: "1.0",
  },
  entities: [
    { type: "person", value: "Jane", confidence: 0.88, pageNumber: 1 },
  ],
  sections: [
    {
      heading: "Overview",
      summary: "A brief overview.",
      pageRange: [1, 2],
      keyEntities: [],
    },
  ],
  fullSummary: "Full document summary.",
};

const structurerInput = {
  entities: [{ type: "person" as const, value: "Jane", confidence: 0.88, pageNumber: 1 }],
  sections: [
    {
      heading: "Overview",
      summary: "A brief overview.",
      pageRange: [1, 2] as [number, number],
      keyEntities: [],
    },
  ],
  fullSummary: "Full document summary.",
  fileName: "test.pdf",
  totalPages: 2,
  pipelineVersion: "1.0",
};

describe("createStructurerChain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces validated document output", async () => {
    mockInvoke.mockResolvedValue({ content: JSON.stringify(validOutput) });

    const chain = createStructurerChain(mockConfig);
    const result = await chain.invoke(structurerInput);

    expect(result.metadata.fileName).toBe("test.pdf");
    expect(result.entities).toHaveLength(1);
    expect(result.sections).toHaveLength(1);
    expect(result.fullSummary).toBe("Full document summary.");
  });

  it("retries on validation failure", async () => {
    const invalidOutput = {
      ...validOutput,
      metadata: { ...validOutput.metadata, processedAt: "not-a-date" },
    };

    mockInvoke
      .mockResolvedValueOnce({ content: JSON.stringify(invalidOutput) })
      .mockResolvedValueOnce({ content: JSON.stringify(validOutput) });

    const chain = createStructurerChain(mockConfig);
    const result = await chain.invoke(structurerInput);

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(result.metadata.processedAt).toBe("2024-01-01T00:00:00Z");
  });

  it("handles content block array response", async () => {
    mockInvoke.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validOutput) }],
    });

    const chain = createStructurerChain(mockConfig);
    const result = await chain.invoke(structurerInput);

    expect(result.metadata.fileName).toBe("test.pdf");
  });
});
