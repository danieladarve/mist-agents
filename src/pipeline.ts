import { readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import yaml from "js-yaml";
import { PipelineConfigSchema } from "./schemas/config.js";
import type { PipelineConfig, AgentConfig } from "./schemas/config.js";
import type { DocumentOutput } from "./schemas/output.js";
import { loadDocument } from "./loader.js";
import { createExtractorChain } from "./agents/extractor.js";
import type { ExtractorOutput } from "./agents/extractor.js";
import { createSummariserChain } from "./agents/summariser.js";
import type { SummariserOutput } from "./agents/summariser.js";
import { createStructurerChain } from "./agents/structurer.js";
import type { StructurerInput } from "./agents/structurer.js";
import { logger } from "./utils/logger.js";

export interface PipelineOptions {
  readonly configPath?: string;
  readonly config?: PipelineConfig;
  readonly outputPath?: string;
  readonly verbose?: boolean;
}

function applyModelOverride(config: PipelineConfig): PipelineConfig {
  const modelOverride = process.env["MIST_DEFAULT_MODEL"];
  if (!modelOverride) {
    return config;
  }

  logger.info(`Overriding all agent models with MIST_DEFAULT_MODEL: ${modelOverride}`);

  return {
    ...config,
    agents: config.agents.map((agent) => ({
      ...agent,
      model: modelOverride,
    })),
  };
}

export function loadConfig(configPath?: string): PipelineConfig {
  const defaultConfigPath = new URL("./config/agents.yaml", import.meta.url).pathname;
  const targetPath = configPath ?? defaultConfigPath;

  const raw = readFileSync(targetPath, "utf-8");
  const parsed = yaml.load(raw, { schema: yaml.CORE_SCHEMA }) as unknown;

  const config = PipelineConfigSchema.parse(parsed);
  return applyModelOverride(config);
}

export async function runPipeline(
  filePath: string,
  options: PipelineOptions = {},
): Promise<DocumentOutput> {
  const config = options.config ?? loadConfig(options.configPath);
  const enabledAgents = config.agents.filter((a) => a.enabled);

  if (enabledAgents.length === 0) {
    throw new Error("No agents are enabled in the pipeline configuration.");
  }

  logger.info(`Pipeline v${config.version}: ${enabledAgents.length} agents enabled`);

  const pages = await loadDocument(resolve(filePath));
  logger.info(`Loaded ${pages.length} pages from ${basename(filePath)}`);

  const fileName = basename(filePath);
  const totalPages = pages.length;

  // Run extractor
  const extractorConfig = findAgent(enabledAgents, "extractor");
  const extractorChain = createExtractorChain(extractorConfig);
  logger.info("Running agent: extractor");
  const extractorOutput: ExtractorOutput = await extractorChain.invoke({ pages });

  // Run summariser
  const summariserConfig = findAgent(enabledAgents, "summariser");
  const summariserChain = createSummariserChain(summariserConfig);
  logger.info("Running agent: summariser");
  const summariserOutput: SummariserOutput = await summariserChain.invoke({
    pages: extractorOutput.pages,
    entities: extractorOutput.entities,
  });

  // Run structurer
  const structurerConfig = findAgent(enabledAgents, "structurer");
  const structurerChain = createStructurerChain(structurerConfig);
  logger.info("Running agent: structurer");
  const structurerInput: StructurerInput = {
    entities: summariserOutput.entities,
    sections: summariserOutput.sections,
    fullSummary: summariserOutput.fullSummary,
    fileName,
    totalPages,
    pipelineVersion: config.version,
  };
  const result: DocumentOutput = await structurerChain.invoke(structurerInput);

  if (options.outputPath) {
    const output = config.output.pretty
      ? JSON.stringify(result, null, 2)
      : JSON.stringify(result);
    writeFileSync(resolve(options.outputPath), output, "utf-8");
    logger.info(`Output written to ${options.outputPath}`);
  }

  return result;
}

function findAgent(agents: readonly AgentConfig[], name: string): AgentConfig {
  const agent = agents.find((a) => a.name === name);
  if (!agent) {
    throw new Error(
      `Required agent "${name}" is not enabled. Enable it in your agents.yaml config.`,
    );
  }
  return agent;
}
