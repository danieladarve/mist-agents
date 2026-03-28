import { logger } from "./logger.js";

export class JsonParseError extends Error {
  constructor(
    message: string,
    public readonly rawContent: string,
  ) {
    super(message);
    this.name = "JsonParseError";
  }
}

export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to fallback strategies
  }

  // Try extracting from markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      logger.debug("JSON extraction: markdown fence content is not valid JSON");
    }
  }

  // Try finding the first { ... } or [ ... ] block
  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const start = objectStart === -1
    ? arrayStart
    : arrayStart === -1
      ? objectStart
      : Math.min(objectStart, arrayStart);

  if (start !== -1) {
    const isObject = trimmed[start] === "{";
    const closer = isObject ? "}" : "]";
    const lastClose = trimmed.lastIndexOf(closer);

    if (lastClose > start) {
      try {
        return JSON.parse(trimmed.slice(start, lastClose + 1));
      } catch {
        logger.debug("JSON extraction: brace-matched substring is not valid JSON");
      }
    }
  }

  throw new JsonParseError(
    `Failed to extract valid JSON from LLM response (${trimmed.length} chars)`,
    trimmed.slice(0, 500),
  );
}

export function extractContentString(
  content: string | Array<{ type: string; text?: string }>,
): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}
