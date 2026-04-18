---
name: cli-engineering
description: Use when designing or implementing the be-ai-heart CLI. Trigger on command names, flags, output schemas, exit codes, config handling, local workflows, or scriptability of the `heart` command.
---

# CLI Engineering

## Read First

- `docs/04-mcp-cli-spec.md`
- `docs/11-implementation-blueprint.md`

## Principles

- short verbs
- stable output
- excellent error messages
- machine-readable JSON mode
- no unnecessary dependencies

## Workflow

1. Design the command contract before coding.
2. Keep default output human-readable and concise.
3. Add `--json` when structured output matters.
4. Use meaningful exit codes.
5. Validate command behavior with fixtures or smoke tests.

## Guardrails

- do not create overlapping commands
- do not print noisy logs by default
- config discovery and error reporting must be explicit
- CLI changes must remain script-friendly

## Deliverables

- command implementation
- help and examples when needed
- tests or smoke checks for command behavior
