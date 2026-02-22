import { z } from "zod";

export const AgentConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  model: z.string().default("claude-sonnet-4-20250514"),
  maxTokens: z.number().default(4096),
  temperature: z.number().default(0),
});

export const PipelineConfigSchema = z.object({
  version: z.string(),
  agents: z.array(AgentConfigSchema),
  output: z.object({
    format: z.enum(["json", "jsonl"]).default("json"),
    pretty: z.boolean().default(true),
  }),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;