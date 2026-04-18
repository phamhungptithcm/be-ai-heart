# Issue 18: Policy DSL v1

## Title

Implement a practical policy DSL for module boundaries, reuse paths, and sensitive paths

## Labels

- `type:feature`
- `type:security`
- `type:backend`
- `priority:p0`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Make project rules explicit enough to guide AI safely in real repos.

## Scope

- module boundaries
- deprecated paths
- preferred reuse paths
- sensitive paths excluded from context
- policy validation and retrieval integration

## Acceptance Criteria

- policy file format is documented
- context compiler and policy checks both honor the DSL
- sensitive paths can be excluded from context generation
- tests cover allowed and blocked paths

## Dependencies

- Issue 03
- Issue 10

## Out of Scope

- enterprise-grade policy authoring UI
