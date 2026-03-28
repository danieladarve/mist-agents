import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { PDFParse } from "pdf-parse";
import { estimateTokenCount } from "./utils/tokens.js";
import { logger } from "./utils/logger.js";

export interface PageChunk {
  readonly pageNumber: number;
  readonly text: string;
}

const MAX_ESTIMATED_TOKENS = 150_000;

export async function loadDocument(filePath: string): Promise<readonly PageChunk[]> {
  try {
    await access(filePath, constants.R_OK);
  } catch {
    throw new Error(`File not found or not readable: ${filePath}`);
  }

  const buffer = await readFile(filePath);

  if (buffer.length < 5 || buffer.toString("ascii", 0, 5) !== "%PDF-") {
    throw new Error(`Invalid PDF file: ${filePath}`);
  }

  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const textResult = await parser.getText();

    if (!textResult.text || textResult.text.trim().length === 0) {
      throw new Error(`PDF contains no extractable text: ${filePath}`);
    }

    const estimatedTokens = estimateTokenCount(textResult.text);
    if (estimatedTokens > MAX_ESTIMATED_TOKENS) {
      throw new Error(
        `PDF is too large for processing (~${estimatedTokens} estimated tokens, max ${MAX_ESTIMATED_TOKENS}). ` +
        `Consider splitting the document into smaller parts.`,
      );
    }

    logger.debug(`Document: ~${estimatedTokens} estimated tokens`);

    const pages: PageChunk[] = textResult.pages
      .filter((page: { num: number; text: string }) => page.text.trim().length > 0)
      .map((page: { num: number; text: string }) => ({
        pageNumber: page.num,
        text: page.text.trim(),
      }));

    if (pages.length === 0) {
      throw new Error(`PDF contains no extractable text: ${filePath}`);
    }

    return pages;
  } finally {
    await parser.destroy();
  }
}
