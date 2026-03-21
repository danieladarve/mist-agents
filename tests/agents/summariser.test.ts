import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSummariserChain } from "../../src/agents/summariser.js";
import type { AgentConfig } from "../../src/schemas/config.js";

const mockInvoke = vi.fn();

vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: class MockChatAnthropic {
    invoke = mockInvoke;
    constructor() {}
  },
}));

const mockConfig: AgentConfig = {
  name: "summariser",
  enabled: true,
  model: "claude-sonnet-4-20250514",
  maxTokens: 4096,
  temperature: 0.2,
};

describe("createSummariserChain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates section summaries from pages and entities", async () => {
    const mockResponse = {
      sections: [
        {
          heading: "Introduction",
          summary: "An introductory section.",
          pageRange: [1, 2],
          keyEntities: [
            { type: "person", value: "John", confidence: 0.9, pageNumber: 1 },
          ],
        },
      ],
      fullSummary: "This document is about John.",
    };

    mockInvoke.mockResolvedValue({ content: JSON.stringify(mockResponse) });

    const chain = createSummariserChain(mockConfig);
    const result = await chain.invoke({
      pages: [
        { pageNumber: 1, text: "Page 1 content" },
        { pageNumber: 2, text: "Page 2 content" },
      ],
      entities: [
        { type: "person" as const, value: "John", confidence: 0.9, pageNumber: 1 },
      ],
    });

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.heading).toBe("Introduction");
    expect(result.fullSummary).toBe("This document is about John.");
    expect(result.entities).toHaveLength(1);
  });

  it("passes entities through to output", async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ sections: [], fullSummary: "Empty document." }),
    });

    const entities = [
      { type: "amount" as const, value: "$100", confidence: 0.8, pageNumber: 1 },
    ];

    const chain = createSummariserChain(mockConfig);
    const result = await chain.invoke({ pages: [], entities });

    expect(result.entities).toEqual(entities);
  });

  it("handles content block array response", async () => {
    mockInvoke.mockResolvedValue({
      content: [
        { type: "text", text: '{"sections": [], "fullSummary": "Block array test."}' },
      ],
    });

    const chain = createSummariserChain(mockConfig);
    const result = await chain.invoke({ pages: [], entities: [] });

    expect(result.fullSummary).toBe("Block array test.");
  });
});
