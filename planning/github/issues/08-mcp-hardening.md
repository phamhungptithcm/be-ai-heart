# Issue 08: MCP Server Hardening and Versioned Contracts

## Title

Harden `heart-mcp` for reliable agent integration

## Labels

- `type:feature`
- `type:backend`
- `type:security`
- `priority:p0`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Turn the current MCP server baseline into a robust integration surface for external agents.

## Scope

- versioned tool contracts
- better error handling
- request validation
- logging discipline
- safe output shaping

## Acceptance Criteria

- tool schemas are explicit and documented
- malformed requests fail safely
- stdout remains protocol-clean
- high-risk paths have tests

## Dependencies

- Issue 05
- Issue 07

## Out of Scope

- non-stdio transports in the first pass
