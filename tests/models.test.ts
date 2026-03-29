import { describe, it, expect, vi } from "vitest";
import { requiresApiKey } from "../src/models.js";
import type { AgentConfig } from "../src/schemas/config.js";

vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: class MockChatAnthropic {
    constructor() {}
  },
}));

vi.mock("@langchain/ollama", () => ({
  ChatOllama: class MockChatOllama {
    constructor() {}
  },
}));

describe("requiresApiKey", () => {
  it("returns true when any enabled agent uses anthropic", () => {
    const configs: AgentConfig[] = [
      { name: "extractor", enabled: true, provider: "anthropic", model: "claude-sonnet-4-20250514", maxTokens: 4096, temperature: 0 },
    ];
    expect(requiresApiKey(configs)).toBe(true);
  });

  it("returns false when all agents use ollama", () => {
    const configs: AgentConfig[] = [
      { name: "extractor", enabled: true, provider: "ollama", model: "qwen3:8b", maxTokens: 4096, temperature: 0 },
      { name: "summariser", enabled: true, provider: "ollama", model: "qwen3:8b", maxTokens: 4096, temperature: 0.2 },
    ];
    expect(requiresApiKey(configs)).toBe(false);
  });

  it("returns false when anthropic agents are disabled", () => {
    const configs: AgentConfig[] = [
      { name: "extractor", enabled: false, provider: "anthropic", model: "claude-sonnet-4-20250514", maxTokens: 4096, temperature: 0 },
      { name: "summariser", enabled: true, provider: "ollama", model: "qwen3:8b", maxTokens: 4096, temperature: 0 },
    ];
    expect(requiresApiKey(configs)).toBe(false);
  });

  it("returns true for mixed providers with enabled anthropic", () => {
    const configs: AgentConfig[] = [
      { name: "extractor", enabled: true, provider: "ollama", model: "qwen3:8b", maxTokens: 4096, temperature: 0 },
      { name: "structurer", enabled: true, provider: "anthropic", model: "claude-sonnet-4-20250514", maxTokens: 8192, temperature: 0 },
    ];
    expect(requiresApiKey(configs)).toBe(true);
  });

  it("returns false for empty config", () => {
    expect(requiresApiKey([])).toBe(false);
  });
});

describe("createChatModel", () => {
  it("creates anthropic model", async () => {
    const { createChatModel } = await import("../src/models.js");
    const model = createChatModel({
      name: "test",
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      maxTokens: 4096,
      temperature: 0,
    });
    expect(model).toBeDefined();
  });

  it("creates ollama model", async () => {
    const { createChatModel } = await import("../src/models.js");
    const model = createChatModel({
      name: "test",
      enabled: true,
      provider: "ollama",
      model: "qwen3:8b",
      maxTokens: 4096,
      temperature: 0,
    });
    expect(model).toBeDefined();
  });

  it("creates ollama model with custom baseUrl", async () => {
    const { createChatModel } = await import("../src/models.js");
    const model = createChatModel({
      name: "test",
      enabled: true,
      provider: "ollama",
      model: "qwen3:8b",
      maxTokens: 4096,
      temperature: 0,
      baseUrl: "http://192.168.1.100:11434",
    });
    expect(model).toBeDefined();
  });
});
