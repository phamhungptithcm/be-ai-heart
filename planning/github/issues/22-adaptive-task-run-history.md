# Issue 22: Adaptive Task Run History

## Title

Capture bounded task-run history and outcome metrics for adaptive learning

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Create the evidence layer that lets the heart learn from repeated AI-assisted work without storing unsafe or noisy transcripts.

## Scope

- task-run schema for local-first storage
- bounded run artifacts: task, context-pack version, skill references, files explored, files changed, and warnings
- outcome metrics: success or failure, review edits, memory refreshes, time to acceptable patch, duplicate signals, and policy violations
- redaction and size limits for stored evidence
- fixture coverage for persistence and replay behavior

## Acceptance Criteria

- repeated local runs create deterministic structured task-run records
- records include enough evidence for later reflection without storing raw full transcripts by default
- sensitive paths or secret-like content are excluded or redacted by default
- tests cover storage format, replay behavior, and redaction

## Dependencies

- Issue 03
- Issue 19

## Out of Scope

- autonomous skill updates
- cross-tenant shared learning
