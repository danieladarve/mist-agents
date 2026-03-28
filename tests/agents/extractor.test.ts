import { describe, it, expect, vi, beforeEach } from "vitest";
import { createExtractorChain } from "../../src/agents/extractor.js";
import type { AgentConfig } from "../../src/schemas/config.js";

const mockInvoke = vi.fn();

vi.mock("../../src/models.js", () => ({
  createChatModel: () => ({ invoke: mockInvoke }),
}));

const mockConfig: AgentConfig = {
  name: "extractor",
  enabled: true,
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  maxTokens: 4096,
  temperature: 0,
};

describe("createExtractorChain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts entities from pages", async () => {
    const mockEntities = {
      entities: [
        { type: "person", value: "John Smith", confidence: 0.95, pageNumber: 1 },
        { type: "date", value: "2024-01-01", confidence: 0.9, pageNumber: 1 },
      ],
    };

    mockInvoke.mockResolvedValue({ content: JSON.stringify(mockEntities) });

    const chain = createExtractorChain(mockConfig);
    const result = await chain.invoke({
      pages: [{ pageNumber: 1, text: "John Smith was born on 2024-01-01" }],
    });

    expect(result.entities).toHaveLength(2);
    expect(result.entities[0]).toEqual({
      type: "person",
      value: "John Smith",
      confidence: 0.95,
      pageNumber: 1,
    });
    expect(result.pages).toHaveLength(1);
  });

  it("handles empty pages", async () => {
    mockInvoke.mockResolvedValue({ content: JSON.stringify({ entities: [] }) });

    const chain = createExtractorChain(mockConfig);
    const result = await chain.invoke({ pages: [] });

    expect(result.entities).toHaveLength(0);
  });

  it("handles content block array response", async () => {
    mockInvoke.mockResolvedValue({
      content: [
        { type: "text", text: '{"entities": [{"type": "location", "value": "NYC", "confidence": 0.8, "pageNumber": 1}]}' },
      ],
    });

    const chain = createExtractorChain(mockConfig);
    const result = await chain.invoke({
      pages: [{ pageNumber: 1, text: "Located in NYC" }],
    });

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]?.value).toBe("NYC");
  });

  it("extracts JSON from markdown code fence", async () => {
    mockInvoke.mockResolvedValue({
      content: '```json\n{"entities": [{"type": "person", "value": "Jane", "confidence": 0.9, "pageNumber": 1}]}\n```',
    });

    const chain = createExtractorChain(mockConfig);
    const result = await chain.invoke({
      pages: [{ pageNumber: 1, text: "Jane was there" }],
    });

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]?.value).toBe("Jane");
  });

  it("validates entity schema", async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        entities: [{ type: "invalid_type", value: "test", confidence: 0.5, pageNumber: 1 }],
      }),
    });

    const chain = createExtractorChain(mockConfig);
    await expect(
      chain.invoke({ pages: [{ pageNumber: 1, text: "test" }] }),
    ).rejects.toThrow();
  });
});
