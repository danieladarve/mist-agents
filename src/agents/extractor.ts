import { RunnableLambda } from "@langchain/core/runnables";
import { z } from "zod";
import type { AgentConfig } from "../schemas/config.js";
import type { PageChunk } from "../loader.js";
import { ExtractedEntitySchema } from "../schemas/output.js";
import type { ExtractedEntity } from "../schemas/output.js";
import { createChatModel } from "../models.js";
import { extractJson, extractContentString } from "../utils/json.js";
import { logger } from "../utils/logger.js";

export interface ExtractorInput {
  readonly pages: readonly PageChunk[];
}

export interface ExtractorOutput {
  readonly pages: readonly PageChunk[];
  readonly entities: readonly ExtractedEntity[];
}

const ExtractorResponseSchema = z.object({
  entities: z.array(ExtractedEntitySchema),
});

const SYSTEM_PROMPT = `You are a document entity extractor. Analyze the provided text and extract all key entities.

For each entity, identify:
- type: one of "person", "organization", "date", "amount", "location", "other"
- value: the exact text of the entity
- confidence: 0.0-1.0 how confident you are in the extraction
- pageNumber: which page the entity was found on

Return ONLY valid JSON in this exact format:
{
  "entities": [
    {"type": "person", "value": "John Smith", "confidence": 0.95, "pageNumber": 1}
  ]
}

Do not include any text outside the JSON object.`;

export function createExtractorChain(config: AgentConfig) {
  const model = createChatModel(config);

  return new RunnableLambda({
    func: async (input: ExtractorInput): Promise<ExtractorOutput> => {
      logger.info(`Extractor: processing ${input.pages.length} pages`);

      const pageTexts = input.pages
        .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
        .join("\n\n");

      const response = await model.invoke([
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "human" as const, content: pageTexts },
      ]);

      const content = extractContentString(response.content);
      const raw = extractJson(content);
      const parsed = ExtractorResponseSchema.parse(raw);

      logger.info(`Extractor: found ${parsed.entities.length} entities`);

      return {
        pages: input.pages,
        entities: parsed.entities,
      };
    },
  });
}
