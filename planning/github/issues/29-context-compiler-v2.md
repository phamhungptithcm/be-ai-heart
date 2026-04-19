# Issue 29: Context Compiler v2

## Title

Make `context_pack` the primary compact memory object for AI workflows

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:runtime`

## Milestone

`V2 M3 Context Compiler v2`

## Objective

Turn `context_pack` into a stable, compact, evidence-rich contract that agents can ingest instead of repeatedly rescanning the repository.

## Scope

- add real `token_budget` handling and deterministic trimming
- rank by graph proximity, document linkage, reuse signals, policy relevance, and likely test impact
- add explicit citations for symbols, files, and documents
- stabilize shared JSON schema across CLI and MCP
- surface confidence rollups and missing-context warnings
- add regression fixtures for document-heavy, reuse-heavy, and cross-module tasks

## Acceptance Criteria

- similar tasks return materially similar top context across repeated runs
- packs are compact enough to replace broad repo rescanning in common tasks
- reuse candidates and risks point to concrete project evidence
- confidence and missing-context warnings are explicit when retrieval quality is weak

## Dependencies

- Issue 28

## Out of Scope

- model-specific prompt templates
- hosted vector search rollout
- autonomous task orchestration on top of the pack
