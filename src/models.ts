import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOllama } from "@langchain/ollama";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AgentConfig } from "./schemas/config.js";
import { logger } from "./utils/logger.js";

export function createChatModel(config: AgentConfig): BaseChatModel {
  switch (config.provider) {
    case "anthropic":
      return new ChatAnthropic({
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        clientOptions: { timeout: 120_000 },
      });

    case "ollama":
      logger.debug(`Using Ollama model: ${config.model} at ${config.baseUrl ?? "http://127.0.0.1:11434"}`);
      return new ChatOllama({
        model: config.model,
        temperature: config.temperature,
        numPredict: config.maxTokens,
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
      });

    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}

export const MODEL_TIMEOUT_MS = 120_000;

export function requiresApiKey(configs: readonly AgentConfig[]): boolean {
  return configs.some((c) => c.provider === "anthropic" && c.enabled);
}
