#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, runPipeline } from "./pipeline.js";
import { requiresApiKey } from "./models.js";
import { setLogLevel, logger } from "./utils/logger.js";
import { JsonParseError } from "./utils/json.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

function formatError(error: unknown): string {
  if (error instanceof JsonParseError) {
    return "LLM returned unparseable output. Re-run with --verbose for details.";
  }
  if (error instanceof Error) {
    if (error.message.includes("429") || error.message.includes("rate limit")) {
      return "Rate limited by API. Wait a moment and try again.";
    }
    if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT")) {
      return "API request timed out. Check your connection and try again.";
    }
    if (error.message.includes("ECONNREFUSED")) {
      return "Connection refused. If using Ollama, ensure it is running (ollama serve).";
    }
    if (error.message.includes("401") || error.message.includes("authentication")) {
      return "Invalid ANTHROPIC_API_KEY. Check your API key and try again.";
    }
    return error.message;
  }
  return "An unexpected error occurred.";
}

let shuttingDown = false;

function setupShutdownHandlers(): void {
  const handler = () => {
    if (shuttingDown) {
      process.exit(1);
    }
    shuttingDown = true;
    logger.info("Shutting down gracefully...");
    process.exit(130);
  };

  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}

const program = new Command()
  .name("mist")
  .version(pkg.version)
  .description("Chain AI agents to process documents")
  .argument("<file>", "Path to PDF file")
  .option("-c, --config <path>", "Path to agents.yaml config")
  .option("-o, --output <path>", "Write output to file instead of stdout")
  .option("-v, --verbose", "Enable verbose logging", false)
  .action(async (file: string, opts: { config?: string; output?: string; verbose?: boolean }) => {
    setupShutdownHandlers();

    if (opts.verbose) {
      setLogLevel("debug");
    }

    try {
      const configPath = opts.config ? resolve(opts.config) : undefined;
      const config = loadConfig(configPath);
      const enabledAgents = config.agents.filter((a) => a.enabled);

      if (requiresApiKey(enabledAgents) && !process.env["ANTHROPIC_API_KEY"]) {
        process.stderr.write(
          "Error: ANTHROPIC_API_KEY environment variable is required for Anthropic provider.\n" +
          "Set it with: export ANTHROPIC_API_KEY=your-key-here\n" +
          "Or use a local model by setting provider: ollama in your agents.yaml config.\n",
        );
        process.exit(1);
      }

      const result = await runPipeline(resolve(file), {
        config,
        outputPath: opts.output ? resolve(opts.output) : undefined,
        verbose: opts.verbose,
      });

      if (!opts.output) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      }
    } catch (error: unknown) {
      const message = formatError(error);
      process.stderr.write(`Error: ${message}\n`);
      if (opts.verbose && error instanceof Error && error.stack) {
        process.stderr.write(`\nStack trace:\n${error.stack}\n`);
      }
      if (opts.verbose && error instanceof JsonParseError) {
        logger.debug(`Raw LLM output (truncated): ${error.rawContent.slice(0, 300)}`);
      }
      process.exit(1);
    }
  });

program.parse();
