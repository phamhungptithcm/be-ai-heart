---
name: core-architecture
description: Use when creating or changing packages, services, data models, interfaces, or project structure in be-ai-heart. Trigger on monorepo design, graph model, context compiler, MCP boundaries, storage, contracts, or cross-package refactors.
---

# Core Architecture

## Read First

- `docs/02-prd.md`
- `docs/03-technical-architecture.md`
- `docs/11-implementation-blueprint.md`

## Objective

Keep the system modular, explainable, local-first, and easy for future agents to extend without duplication.

## Workflow

1. Identify the smallest boundary that should own the change.
2. Check whether an existing package already owns that responsibility.
3. Define or update an explicit contract before widening dependencies.
4. Keep data shapes stable and obvious.
5. Add or update tests around package boundaries.

## Guardrails

- `packages/*` should expose narrow APIs.
- Do not let UI apps own domain logic.
- Do not couple MCP transport to graph internals.
- Prefer additive evolution of schemas and contracts.
- Document new architectural decisions in `docs/` when they are material.

## Deliverables

- code aligned to package ownership
- updated architecture notes when boundaries change
- validation proving contracts still hold
