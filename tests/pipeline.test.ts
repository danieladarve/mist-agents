import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { loadConfig } from "../src/pipeline.js";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    writeFileSync: vi.fn(),
  };
});

vi.mock("../src/loader.js", () => ({
  loadDocument: vi.fn(),
}));

vi.mock("../src/agents/extractor.js", () => ({
  createExtractorChain: vi.fn(),
}));

vi.mock("../src/agents/summariser.js", () => ({
  createSummariserChain: vi.fn(),
}));

vi.mock("../src/agents/structurer.js", () => ({
  createStructurerChain: vi.fn(),
}));

describe("loadConfig", () => {
  const originalEnv = process.env["MIST_DEFAULT_MODEL"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["MIST_DEFAULT_MODEL"];
    } else {
      process.env["MIST_DEFAULT_MODEL"] = originalEnv;
    }
  });

  it("loads the default config", () => {
    const config = loadConfig(
      resolve(import.meta.dirname, "../src/config/agents.yaml"),
    );
    expect(config.version).toBe("1.0");
    expect(config.agents).toHaveLength(3);
    expect(config.agents[0]?.name).toBe("extractor");
    expect(config.agents[1]?.name).toBe("summariser");
    expect(config.agents[2]?.name).toBe("structurer");
    expect(config.output.format).toBe("json");
  });

  it("validates agents have correct defaults", () => {
    const config = loadConfig(
      resolve(import.meta.dirname, "../src/config/agents.yaml"),
    );
    const extractor = config.agents[0]!;
    expect(extractor.enabled).toBe(true);
    expect(extractor.model).toBe("claude-sonnet-4-20250514");
    expect(extractor.maxTokens).toBe(4096);
  });

  it("throws on invalid config file", () => {
    expect(() => loadConfig("/nonexistent/path.yaml")).toThrow();
  });

  it("overrides model with MIST_DEFAULT_MODEL", () => {
    process.env["MIST_DEFAULT_MODEL"] = "claude-haiku-4-5-20251001";
    const config = loadConfig(
      resolve(import.meta.dirname, "../src/config/agents.yaml"),
    );
    for (const agent of config.agents) {
      expect(agent.model).toBe("claude-haiku-4-5-20251001");
    }
  });
});

describe("runPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chains agents in order with typed data flow", async () => {
    const { loadDocument } = await import("../src/loader.js");
    const { createExtractorChain } = await import("../src/agents/extractor.js");
    const { createSummariserChain } = await import("../src/agents/summariser.js");
    const { createStructurerChain } = await import("../src/agents/structurer.js");

    vi.mocked(loadDocument).mockResolvedValue([
      { pageNumber: 1, text: "Test content" },
    ]);

    const extractorResult = {
      pages: [{ pageNumber: 1, text: "Test content" }],
      entities: [{ type: "person" as const, value: "Test", confidence: 0.9, pageNumber: 1 }],
    };

    const summariserResult = {
      entities: extractorResult.entities,
      sections: [
        {
          heading: "Main",
          summary: "Test summary.",
          pageRange: [1, 1] as [number, number],
          keyEntities: [],
        },
      ],
      fullSummary: "Full summary.",
    };

    const structurerResult = {
      metadata: {
        fileName: "test.pdf",
        totalPages: 1,
        processedAt: "2024-01-01T00:00:00Z",
        pipelineVersion: "1.0",
      },
      entities: extractorResult.entities,
      sections: summariserResult.sections,
      fullSummary: "Full summary.",
    };

    vi.mocked(createExtractorChain).mockReturnValue({
      invoke: vi.fn().mockResolvedValue(extractorResult),
    } as never);

    vi.mocked(createSummariserChain).mockReturnValue({
      invoke: vi.fn().mockResolvedValue(summariserResult),
    } as never);

    vi.mocked(createStructurerChain).mockReturnValue({
      invoke: vi.fn().mockResolvedValue(structurerResult),
    } as never);

    const { runPipeline } = await import("../src/pipeline.js");

    const result = await runPipeline("test.pdf", {
      configPath: resolve(import.meta.dirname, "../src/config/agents.yaml"),
    });

    expect(result.metadata.pipelineVersion).toBe("1.0");
    expect(result.entities).toHaveLength(1);
    expect(result.fullSummary).toBe("Full summary.");

    // Verify agents were called with correct inputs
    const extractorInvoke = vi.mocked(createExtractorChain).mock.results[0]!.value.invoke;
    expect(extractorInvoke).toHaveBeenCalledWith({
      pages: [{ pageNumber: 1, text: "Test content" }],
    });
  });

  it("writes output to file when outputPath is specified", async () => {
    const { loadDocument } = await import("../src/loader.js");
    const { createExtractorChain } = await import("../src/agents/extractor.js");
    const { createSummariserChain } = await import("../src/agents/summariser.js");
    const { createStructurerChain } = await import("../src/agents/structurer.js");

    vi.mocked(loadDocument).mockResolvedValue([
      { pageNumber: 1, text: "Content" },
    ]);

    const finalResult = {
      metadata: {
        fileName: "test.pdf",
        totalPages: 1,
        processedAt: "2024-01-01T00:00:00Z",
        pipelineVersion: "1.0",
      },
      entities: [],
      sections: [],
      fullSummary: "Summary.",
    };

    vi.mocked(createExtractorChain).mockReturnValue({
      invoke: vi.fn().mockResolvedValue({ pages: [], entities: [] }),
    } as never);
    vi.mocked(createSummariserChain).mockReturnValue({
      invoke: vi.fn().mockResolvedValue({ entities: [], sections: [], fullSummary: "Summary." }),
    } as never);
    vi.mocked(createStructurerChain).mockReturnValue({
      invoke: vi.fn().mockResolvedValue(finalResult),
    } as never);

    const { runPipeline } = await import("../src/pipeline.js");

    await runPipeline("test.pdf", {
      configPath: resolve(import.meta.dirname, "../src/config/agents.yaml"),
      outputPath: "/tmp/test-output.json",
    });

    expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
      "/tmp/test-output.json",
      expect.any(String),
      "utf-8",
    );
  });

  it("throws when required agent is missing from config", async () => {
    const { loadDocument } = await import("../src/loader.js");

    vi.mocked(loadDocument).mockResolvedValue([
      { pageNumber: 1, text: "Content" },
    ]);

    const { runPipeline } = await import("../src/pipeline.js");

    // Create a config that only has the extractor enabled
    const customConfig = resolve(import.meta.dirname, "fixtures/missing-agent.yaml");
    const { writeFileSync: realWrite, mkdirSync } = await vi.importActual<typeof import("node:fs")>("node:fs");
    mkdirSync(resolve(import.meta.dirname, "fixtures"), { recursive: true });
    realWrite(customConfig, `version: "1.0"\nagents:\n  - name: extractor\n    enabled: true\noutput:\n  format: json\n  pretty: true\n`);

    await expect(
      runPipeline("test.pdf", { configPath: customConfig }),
    ).rejects.toThrow('Required agent "summariser" is not enabled');

    const { unlinkSync } = await vi.importActual<typeof import("node:fs")>("node:fs");
    unlinkSync(customConfig);
  });
});
