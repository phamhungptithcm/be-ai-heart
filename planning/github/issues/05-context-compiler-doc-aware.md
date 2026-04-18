# Issue 05: Document-Aware Context Compiler

## Title

Upgrade context compilation to combine code, documents, and policy signals

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Produce context packs that reflect both implementation reality and documented intent.

## Scope

- ranking inputs across code and document memory
- compact context output schema
- uncertainty and risk signaling
- token-budget-aware packing

## Acceptance Criteria

- context packs include relevant files, symbols, and document references
- ranking logic is test-covered
- pack output remains compact and deterministic enough for agent tooling

## Dependencies

- Issue 03
- Issue 04

## Out of Scope

- model-specific prompt formatting beyond base schemas
