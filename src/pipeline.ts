import { readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import yaml from "js-yaml";
import { RunnableLambda } from "@langchain/core/runnables";
import { PipelineConfigSchema } from "./schemas/config.js";
import type { PipelineConfig, AgentConfig } from "./schemas/config.js";
import type { DocumentOutput } from "./schemas/output.js";
import { loadDocument } from "./loader.js";
import { createExtractorChain } from "./agents/extractor.js";
import { createSummariserChain } from "./agents/summariser.js";
import { createStructurerChain } from "./agents/structurer.js";
import { logger } from "./utils/logger.js";

export interface PipelineOptions {
  readonly configPath?: string;
  readonly outputPath?: string;
  readonly verbose?: boolean;
}

type AgentFactory = (config: AgentConfig) => RunnableLambda<unknown, unknown>;

const AGENT_FACTORIES: Record<string, AgentFactory> = {
  extractor: createExtractorChain as unknown as AgentFactory,
  summariser: createSummariserChain as unknown as AgentFactory,
  structurer: createStructurerChain as unknown as AgentFactory,
};

export function loadConfig(configPath?: string): PipelineConfig {
  const defaultConfigPath = new URL("./config/agents.yaml", import.meta.url).pathname;
  const targetPath = configPath ?? defaultConfigPath;

  const raw = readFileSync(targetPath, "utf-8");
  const parsed = yaml.load(raw) as unknown;

  return PipelineConfigSchema.parse(parsed);
}

export async function runPipeline(
  filePath: string,
  options: PipelineOptions = {},
): Promise<DocumentOutput> {
  const config = loadConfig(options.configPath);
  const enabledAgents = config.agents.filter((a) => a.enabled);

  logger.info(`Pipeline v${config.version}: ${enabledAgents.length} agents enabled`);

  const pages = await loadDocument(resolve(filePath));
  logger.info(`Loaded ${pages.length} pages from ${basename(filePath)}`);

  const fileName = basename(filePath);
  const totalPages = pages.length;

  let currentData: unknown = { pages };

  for (const agentConfig of enabledAgents) {
    const factory = AGENT_FACTORIES[agentConfig.name];
    if (!factory) {
      throw new Error(`Unknown agent: ${agentConfig.name}`);
    }

    logger.info(`Running agent: ${agentConfig.name}`);
    const chain = factory(agentConfig);

    if (agentConfig.name === "structurer") {
      currentData = {
        ...(currentData as Record<string, unknown>),
        fileName,
        totalPages,
        pipelineVersion: config.version,
      };
    }

    currentData = await chain.invoke(currentData);
  }

  const result = currentData as DocumentOutput;

  if (options.outputPath) {
    const output = config.output.pretty
      ? JSON.stringify(result, null, 2)
      : JSON.stringify(result);
    writeFileSync(resolve(options.outputPath), output, "utf-8");
    logger.info(`Output written to ${options.outputPath}`);
  }

  return result;
}
