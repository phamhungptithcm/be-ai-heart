# Issue 28: Typed Graph v2

## Title

Promote the project graph from file import graph to typed collaboration graph

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:heart-core`

## Milestone

`V2 M2 Typed Graph v2`

## Objective

Model architecture and implementation collaboration with typed nodes and richer edges so downstream retrieval and diagrams can stop inferring everything from imports alone.

## Scope

- add first-class node types for `Class`, `Interface`, `Function`, `Method`, `Test`, `Document`, and `Policy`
- persist `EXTENDS` and `IMPLEMENTS` edges from parser output
- add first-pass `CALLS` extraction for supported TypeScript and JavaScript patterns
- derive `TESTED_BY` links from test imports and naming conventions
- extend impact analysis helpers to use typed graph relationships
- support deterministic graph snapshot diffing across scans

## Acceptance Criteria

- function-to-function and class-to-class relationships are queryable from the graph layer
- `impact_analysis` no longer depends only on imports
- graph snapshots can be diffed deterministically between scans
- typed graph output is available to the context compiler and diagram generator without adapter duplication

## Dependencies

- Issue 27

## Out of Scope

- multi-language call graph support
- shared cloud graph storage redesign
- runtime tracing or production telemetry ingestion
