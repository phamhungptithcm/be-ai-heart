---
name: backend-nodejs
description: Use when implementing Node.js backend logic for be-ai-heart. Trigger on packages, APIs, workers, CLI internals, MCP server logic, graph processing, context compilation, or benchmark tooling written in Node.js.
---

# Backend Node.js

## Read First

- `docs/03-technical-architecture.md`
- `docs/04-mcp-cli-spec.md`
- `docs/11-implementation-blueprint.md`

## Workflow

1. Start from the package or service boundary.
2. Model input and output explicitly.
3. Keep functions small and side effects obvious.
4. Prefer standard library and minimal dependencies early.
5. Add deterministic tests for domain logic.

## Guardrails

- do not mix transport logic with core domain logic
- keep file system and process execution behind narrow adapters
- treat CLI and MCP payloads as external contracts
- avoid unbounded in-memory data loading when repository size may scale

## Deliverables

- clean module boundaries
- explicit contracts
- tests or smoke validation
