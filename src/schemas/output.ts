import { z } from "zod";

export const ExtractedEntitySchema = z.object({
  type: z.enum(["person", "organization", "date", "amount", "location", "other"]),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  pageNumber: z.number().int().positive(),
});

export const SectionSummarySchema = z.object({
  heading: z.string(),
  summary: z.string(),
  pageRange: z.tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([start, end]) => end >= start, { message: "pageRange end must be >= start" }),
  keyEntities: z.array(ExtractedEntitySchema),
});

export const DocumentOutputSchema = z.object({
  metadata: z.object({
    fileName: z.string(),
    totalPages: z.number().int().positive(),
    processedAt: z.string().datetime(),
    pipelineVersion: z.string(),
  }),
  entities: z.array(ExtractedEntitySchema),
  sections: z.array(SectionSummarySchema),
  fullSummary: z.string(),
});

export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;
export type SectionSummary = z.infer<typeof SectionSummarySchema>;
export type DocumentOutput = z.infer<typeof DocumentOutputSchema>;