import { readFileSync, existsSync } from "node:fs";
import { PDFParse } from "pdf-parse";

export interface PageChunk {
  readonly pageNumber: number;
  readonly text: string;
}

export async function loadDocument(filePath: string): Promise<readonly PageChunk[]> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = readFileSync(filePath);

  if (buffer.length < 5 || buffer.toString("ascii", 0, 5) !== "%PDF-") {
    throw new Error(`Invalid PDF file: ${filePath}`);
  }

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const textResult = await parser.getText();

  if (!textResult.text || textResult.text.trim().length === 0) {
    await parser.destroy();
    throw new Error(`PDF contains no extractable text: ${filePath}`);
  }

  const pages: PageChunk[] = textResult.pages
    .filter((page: { num: number; text: string }) => page.text.trim().length > 0)
    .map((page: { num: number; text: string }) => ({
      pageNumber: page.num,
      text: page.text.trim(),
    }));

  await parser.destroy();

  if (pages.length === 0) {
    throw new Error(`PDF contains no extractable text: ${filePath}`);
  }

  return pages;
}
