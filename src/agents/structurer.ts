import { ChatAnthropic } from "@langchain/anthropic";
import { RunnableLambda } from "@langchain/core/runnables";
import type { AgentConfig } from "../schemas/config.js";
import type { ExtractedEntity, SectionSummary, DocumentOutput } from "../schemas/output.js";
import { DocumentOutputSchema } from "../schemas/output.js";
import { logger } from "../utils/logger.js";

export interface StructurerInput {
  readonly entities: readonly ExtractedEntity[];
  readonly sections: readonly SectionSummary[];
  readonly fullSummary: string;
  readonly fileName: string;
  readonly totalPages: number;
  readonly pipelineVersion: string;
}

const SYSTEM_PROMPT = `You are a document structurer. Given entities, section summaries, and metadata, produce a final structured JSON document.

The output must match this exact schema:
{
  "metadata": {
    "fileName": "string",
    "totalPages": number,
    "processedAt": "ISO 8601 datetime string",
    "pipelineVersion": "string"
  },
  "entities": [...],
  "sections": [...],
  "fullSummary": "string"
}

Ensure all entities have valid types: "person", "organization", "date", "amount", "location", "other".
Ensure all confidence values are between 0 and 1.
Ensure all pageNumbers are positive integers.
Ensure processedAt is a valid ISO 8601 datetime.

Return ONLY valid JSON. Do not include any text outside the JSON object.`;

export function createStructurerChain(config: AgentConfig) {
  const model = new ChatAnthropic({
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });

  return new RunnableLambda({
    func: async (input: StructurerInput): Promise<DocumentOutput> => {
      logger.info("Structurer: assembling final document");

      const payload = JSON.stringify({
        fileName: input.fileName,
        totalPages: input.totalPages,
        pipelineVersion: input.pipelineVersion,
        entities: input.entities,
        sections: input.sections,
        fullSummary: input.fullSummary,
      }, null, 2);

      const response = await model.invoke([
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "human" as const, content: `Structure this data into the final document format:\n${payload}` },
      ]);

      const content = typeof response.content === "string"
        ? response.content
        : response.content
            .filter((block): block is { type: "text"; text: string } => block.type === "text")
            .map((block) => block.text)
            .join("");

      const parsed = JSON.parse(content) as unknown;

      const result = DocumentOutputSchema.safeParse(parsed);

      if (result.success) {
        logger.info("Structurer: output validated successfully");
        return result.data;
      }

      logger.warn(`Structurer: validation failed, retrying: ${result.error.message}`);

      const retryResponse = await model.invoke([
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "human" as const, content: `Structure this data into the final document format:\n${payload}` },
        { role: "assistant" as const, content },
        {
          role: "human" as const,
          content: `The JSON you returned failed validation with these errors:\n${result.error.message}\n\nPlease fix the JSON and return only valid JSON.`,
        },
      ]);

      const retryContent = typeof retryResponse.content === "string"
        ? retryResponse.content
        : retryResponse.content
            .filter((block): block is { type: "text"; text: string } => block.type === "text")
            .map((block) => block.text)
            .join("");

      const retryParsed = JSON.parse(retryContent) as unknown;
      const retryResult = DocumentOutputSchema.parse(retryParsed);

      logger.info("Structurer: retry output validated successfully");
      return retryResult;
    },
  });
}
