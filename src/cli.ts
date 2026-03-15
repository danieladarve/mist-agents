#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runPipeline } from "./pipeline.js";
import { setLogLevel } from "./utils/logger.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

function validateApiKey(): void {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    process.stderr.write(
      "Error: ANTHROPIC_API_KEY environment variable is required.\n" +
      "Set it with: export ANTHROPIC_API_KEY=your-key-here\n",
    );
    process.exit(1);
  }
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
    validateApiKey();

    if (opts.verbose) {
      setLogLevel("debug");
    }

    const result = await runPipeline(resolve(file), {
      configPath: opts.config ? resolve(opts.config) : undefined,
      outputPath: opts.output ? resolve(opts.output) : undefined,
      verbose: opts.verbose,
    });

    if (!opts.output) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    }
  });

program.parse();
