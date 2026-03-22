# Mist Agents

CLI tool that chains AI agents to process PDF documents into structured JSON. Feed it a PDF and it runs a pipeline: extract entities, summarise sections, and emit a validated output file.

Built on LangChain with support for **Claude** (Anthropic) and **local models** via Ollama.

## Quick Start

```bash
npm install
export ANTHROPIC_API_KEY=your-key-here

# Process a PDF
npx tsx src/cli.ts document.pdf

# Write output to file
npx tsx src/cli.ts document.pdf -o output.json

# Use a custom pipeline config
npx tsx src/cli.ts document.pdf --config my-agents.yaml

# Verbose logging
npx tsx src/cli.ts document.pdf -v
```

## Using Local Models (Ollama)

No API key needed. Make sure Ollama is running and pull a model:

```bash
ollama pull qwen3:8b
npx tsx src/cli.ts document.pdf --config src/config/agents.ollama.yaml
```

You can mix providers per-agent in your config (e.g. Ollama for extraction, Claude for structuring).

## Pipeline

```
PDF  -->  Extractor  -->  Summariser  -->  Structurer  -->  JSON
          (entities)      (sections)       (validated output)
```

Each agent is configured independently in `agents.yaml`:

```yaml
version: "1.0"
agents:
  - name: extractor
    provider: ollama        # or anthropic
    model: qwen3:8b
    maxTokens: 4096
    temperature: 0
  - name: summariser
    provider: anthropic
    model: claude-sonnet-4-20250514
    maxTokens: 4096
    temperature: 0.2
  - name: structurer
    provider: anthropic
    model: claude-sonnet-4-20250514
    maxTokens: 8192
    temperature: 0
output:
  format: json
  pretty: true
```

## Output Format

All output is validated against a strict schema:

```json
{
  "metadata": {
    "fileName": "document.pdf",
    "totalPages": 12,
    "processedAt": "2026-03-22T10:30:00Z",
    "pipelineVersion": "1.0"
  },
  "entities": [
    { "type": "person", "value": "Jane Smith", "confidence": 0.95, "pageNumber": 1 }
  ],
  "sections": [
    {
      "heading": "Executive Summary",
      "summary": "Overview of the quarterly results...",
      "pageRange": [1, 3],
      "keyEntities": []
    }
  ],
  "fullSummary": "This document covers..."
}
```

Entity types: `person`, `organization`, `date`, `amount`, `location`, `other`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | When using Anthropic provider | Claude API key |
| `MIST_LOG_LEVEL` | No | `debug`, `info`, `warn`, `error` (default: `info`) |
| `MIST_DEFAULT_MODEL` | No | Override model for all agents |

## Development

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run build         # Build for distribution
```

## Project Structure

```
src/
  cli.ts              # Entry point (Commander.js)
  pipeline.ts         # Config loading and agent orchestration
  loader.ts           # PDF text extraction (pdf-parse v2)
  models.ts           # Model factory (Anthropic / Ollama)
  agents/
    extractor.ts      # Entity extraction
    summariser.ts     # Section summaries
    structurer.ts     # Final JSON assembly + validation
  schemas/
    output.ts         # Zod schemas for document output
    config.ts         # Zod schemas for pipeline config
  utils/
    json.ts           # Safe JSON extraction from LLM output
    logger.ts         # Leveled structured logging
    tokens.ts         # Token estimation
  config/
    agents.yaml       # Default config (Anthropic)
    agents.ollama.yaml # Example config (Ollama + Qwen)
```

## License

MIT
