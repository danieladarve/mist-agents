import { RunnableLambda } from "@langchain/core/runnables";
import { z } from "zod";
import type { AgentConfig } from "../schemas/config.js";
import type { PageChunk } from "../loader.js";
import { SectionSummarySchema } from "../schemas/output.js";
import type { ExtractedEntity, SectionSummary } from "../schemas/output.js";
import { createChatModel, MODEL_TIMEOUT_MS } from "../models.js";
import { extractJson, extractContentString } from "../utils/json.js";
import { logger } from "../utils/logger.js";

export interface SummariserInput {
  readonly pages: readonly PageChunk[];
  readonly entities: readonly ExtractedEntity[];
}

export interface SummariserOutput {
  readonly entities: readonly ExtractedEntity[];
  readonly sections: readonly SectionSummary[];
  readonly fullSummary: string;
}

const SummariserResponseSchema = z.object({
  sections: z.array(SectionSummarySchema),
  fullSummary: z.string(),
});

const SYSTEM_PROMPT = `You are a document summariser. Given document pages and extracted entities, create section summaries.

Group pages into logical sections (by topic or every 3-5 pages if no clear sections).
For each section provide:
- heading: a descriptive title
- summary: 2-3 sentence summary
- pageRange: [startPage, endPage]
- keyEntities: relevant entities from that section

Also provide a fullSummary of the entire document in 3-5 sentences.

Return ONLY valid JSON in this exact format:
{
  "sections": [
    {
      "heading": "Introduction",
      "summary": "...",
      "pageRange": [1, 3],
      "keyEntities": [{"type": "person", "value": "...", "confidence": 0.9, "pageNumber": 1}]
    }
  ],
  "fullSummary": "..."
}

Do not include any text outside the JSON object.`;

export function createSummariserChain(config: AgentConfig) {
  const model = createChatModel(config);

  return new RunnableLambda({
    func: async (input: SummariserInput): Promise<SummariserOutput> => {
      logger.info(`Summariser: processing ${input.pages.length} pages with ${input.entities.length} entities`);

      const pageTexts = input.pages
        .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
        .join("\n\n");

      const entityList = JSON.stringify(input.entities, null, 2);

      const response = await model.invoke([
        { role: "system" as const, content: SYSTEM_PROMPT },
        {
          role: "human" as const,
          content: `Document pages:\n${pageTexts}\n\nExtracted entities:\n${entityList}`,
        },
      ], { timeout: MODEL_TIMEOUT_MS });

      const content = extractContentString(response.content);
      const raw = extractJson(content);
      const parsed = SummariserResponseSchema.parse(raw);

      logger.info(`Summariser: created ${parsed.sections.length} section summaries`);

      return {
        entities: input.entities,
        sections: parsed.sections,
        fullSummary: parsed.fullSummary,
      };
    },
  });
}
