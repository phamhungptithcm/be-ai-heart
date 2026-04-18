# Issue 07: Deep Contract Tests for Symbol Lookup and Impact Analysis

## Title

Add deep contract and fixture tests for `symbol_lookup` and `impact_analysis`

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Make symbol and impact answers reliable enough to serve as agent-facing contracts.

## Scope

- richer fixtures
- symbol edge cases
- multi-hop impact fixtures
- JSON schema stability tests
- negative and ambiguity cases

## Acceptance Criteria

- symbol lookup tests cover exported, nested, overloaded, and ambiguous names where supported
- impact analysis tests cover direct and indirect dependency cases
- tool outputs are versioned and stable

## Dependencies

- Issue 02
- Issue 03

## Out of Scope

- full semantic type analysis for all languages
