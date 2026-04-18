---
name: mcp-runtime
description: Use when designing or implementing MCP tools, context pack behavior, tool schemas, or AI-runtime interactions for be-ai-heart. Trigger on MCP server features, tool contracts, payload design, retrieval behavior, and agent integration.
---

# MCP Runtime

## Read First

- `docs/03-technical-architecture.md`
- `docs/04-mcp-cli-spec.md`

## Objective

Expose high-signal project context to agents without flooding the model with low-value data.

## Workflow

1. Start from the agent decision the tool should improve.
2. Define a compact, structured response.
3. Prefer summaries, references, and reusable candidates over raw dumps.
4. Explicitly represent risk, uncertainty, and policy constraints.

## Guardrails

- tools should answer one question well
- avoid returning giant file blobs unless strictly necessary
- keep token budget visible in design choices
- transport and retrieval logic should stay separable

## Deliverables

- tool contract
- compact response schema
- tests or fixtures for tool behavior
