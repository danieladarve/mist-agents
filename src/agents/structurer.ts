import { RunnableLambda } from "@langchain/core/runnables";
import type { AgentConfig } from "../schemas/config.js";
import type { ExtractedEntity, SectionSummary, DocumentOutput } from "../schemas/output.js";
import { DocumentOutputSchema } from "../schemas/output.js";
import { createChatModel, MODEL_TIMEOUT_MS } from "../models.js";
import { extractJson, extractContentString } from "../utils/json.js";
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
  const model = createChatModel(config);

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
      ], { timeout: MODEL_TIMEOUT_MS });

      const content = extractContentString(response.content);
      const raw = extractJson(content);
      const result = DocumentOutputSchema.safeParse(raw);

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
          content: "The JSON you returned failed validation. Please fix the JSON and return only valid JSON.",
        },
      ], { timeout: MODEL_TIMEOUT_MS });

      const retryContent = extractContentString(retryResponse.content);
      const retryRaw = extractJson(retryContent);
      const retryResult = DocumentOutputSchema.safeParse(retryRaw);

      if (retryResult.success) {
        logger.info("Structurer: retry output validated successfully");
        return retryResult.data;
      }

      throw new Error(
        `Structurer failed validation after retry. Errors: ${retryResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    },
  });
}
