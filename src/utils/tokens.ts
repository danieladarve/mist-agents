export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedCharLimit = maxTokens * 4;
  if (text.length <= estimatedCharLimit) {
    return text;
  }
  return text.slice(0, estimatedCharLimit);
}
