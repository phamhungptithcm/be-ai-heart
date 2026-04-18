# Implementation Blueprint

## Recommended Monorepo Structure

```text
be-ai-heart/
  apps/
    website/
    docs/
    admin/
  packages/
    core/
    document-ingest/
    parser-ts/
    parser-py/
    graph/
    context-compiler/
    policy-engine/
    cli/
    mcp-server/
    benchmark/
    shared-schema/
    sdk/
  services/
    api/
    worker/
  benchmarks/
    scenarios/
    datasets/
    reports/
  docs/
```

## Package Responsibilities

### `packages/core`

- config loading
- repo discovery
- ignore handling
- common primitives

### `packages/parser-ts`

- TypeScript and JavaScript AST extraction
- symbol discovery
- import graph extraction

### `packages/document-ingest`

- project document scanning
- document classification
- document retrieval summaries
- future document-to-code linkage

### `packages/graph`

- node and edge persistence
- graph queries
- snapshot diffs

### `packages/context-compiler`

- query interpretation
- retrieval and ranking
- context pack generation

### `packages/policy-engine`

- load rules
- validate boundaries
- generate warnings

### `packages/cli`

- command surface
- local UX
- JSON output

### `packages/mcp-server`

- MCP tool definitions
- transport
- auth and graph access

### `packages/benchmark`

- scenario runner
- metrics collection
- report generation

## Sprint Plan

### Sprint 1

Goals:

- monorepo scaffolding
- config format locked
- TypeScript parser prototype
- graph schema v1

Definition of done:

- parse one repo and extract symbol records

### Sprint 2

Goals:

- local graph persistence
- CLI `init`, `scan`, `overview`
- ignore and incremental scan basics

Definition of done:

- user can scan a TS repo and inspect summary

### Sprint 3

Goals:

- context compiler v1
- CLI `find`, `deps`, `pack`
- simple reuse detection heuristics

Definition of done:

- user can ask for a task pack and get actionable context

### Sprint 4

Goals:

- local MCP server
- `project_overview`, `context_pack`, `symbol_lookup`
- tool contract tests

Definition of done:

- an MCP-compatible client can retrieve repo context successfully

### Sprint 5

Goals:

- policy rules v1
- `policy check`
- impact analysis

Definition of done:

- system reports clear architecture warnings

### Sprint 6

Goals:

- benchmark runner
- baseline vs assisted comparison
- first executive report template

Definition of done:

- one benchmark scenario produces a shareable ROI report

## Technical Decisions To Lock Early

- monorepo toolchain: start with `npm workspaces` for zero-friction bootstrap, then migrate to `pnpm` plus Turbo or Nx when dependency volume and task orchestration justify it
- language priority: TypeScript first
- storage mode: local SQLite or Postgres for dev, Postgres in shared mode
- embedding strategy: provider-agnostic adapter
- output schema versioning for context packs and MCP

## Current Scaffold Status

The repository bootstrap currently uses:

- `npm workspaces`
- dependency-light Node.js modules
- local `node --test` validation

This is intentional for fast iteration before adding a fuller TypeScript toolchain.

## Suggested Engineering Standards

- strict TypeScript
- contract tests for CLI JSON and MCP outputs
- golden files for context pack snapshots
- benchmark regression suite in CI
- observability hooks from day one in cloud services

## Release Strategy

### Alpha

- local-only
- design partners only
- one language

### Beta

- shared workspace
- basic web console
- structured benchmark exports

### GA

- enterprise controls
- pricing live
- onboarding flow
- support playbook

## First Demo Flow

1. Initialize `heart` on a medium-size repo
2. Run `heart scan`
3. Show `heart overview`
4. Ask for a feature context pack
5. Connect an agent via MCP
6. Compare benchmark without and with `be-ai-heart`

That demo should be the core of both product validation and sales.
