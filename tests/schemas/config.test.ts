import { describe, it, expect } from "vitest";
import { AgentConfigSchema, PipelineConfigSchema } from "../../src/schemas/config.js";

describe("AgentConfigSchema", () => {
  it("accepts a valid agent config", () => {
    const config = {
      name: "extractor",
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      maxTokens: 4096,
      temperature: 0,
    };
    expect(AgentConfigSchema.parse(config)).toEqual(config);
  });

  it("applies defaults for optional fields", () => {
    const result = AgentConfigSchema.parse({ name: "test" });
    expect(result.enabled).toBe(true);
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-sonnet-4-20250514");
    expect(result.maxTokens).toBe(4096);
    expect(result.temperature).toBe(0);
  });

  it("accepts ollama provider", () => {
    const result = AgentConfigSchema.parse({
      name: "extractor",
      provider: "ollama",
      model: "qwen3:8b",
    });
    expect(result.provider).toBe("ollama");
    expect(result.model).toBe("qwen3:8b");
  });

  it("accepts optional baseUrl for ollama", () => {
    const result = AgentConfigSchema.parse({
      name: "extractor",
      provider: "ollama",
      model: "qwen3:8b",
      baseUrl: "http://192.168.1.100:11434",
    });
    expect(result.baseUrl).toBe("http://192.168.1.100:11434");
  });

  it("rejects invalid provider", () => {
    expect(() =>
      AgentConfigSchema.parse({ name: "test", provider: "openai" }),
    ).toThrow();
  });

  it("rejects missing name", () => {
    expect(() => AgentConfigSchema.parse({})).toThrow();
  });
});

describe("PipelineConfigSchema", () => {
  it("accepts a valid pipeline config", () => {
    const config = {
      version: "1.0",
      agents: [{ name: "extractor" }],
      output: { format: "json", pretty: true },
    };
    const result = PipelineConfigSchema.parse(config);
    expect(result.version).toBe("1.0");
    expect(result.agents).toHaveLength(1);
    expect(result.output.format).toBe("json");
  });

  it("applies output defaults", () => {
    const config = {
      version: "1.0",
      agents: [],
      output: {},
    };
    const result = PipelineConfigSchema.parse(config);
    expect(result.output.format).toBe("json");
    expect(result.output.pretty).toBe(true);
  });

  it("rejects invalid output format", () => {
    expect(() =>
      PipelineConfigSchema.parse({
        version: "1.0",
        agents: [],
        output: { format: "xml" },
      }),
    ).toThrow();
  });
});
