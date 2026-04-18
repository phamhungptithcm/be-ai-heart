---
name: qa-engineering
description: Use when designing tests, validating behavior, defining release gates, or checking regressions in be-ai-heart. Trigger on unit tests, integration tests, contract tests, benchmark validation, smoke tests, release readiness, or bug reproduction.
---

# QA Engineering

## Read First

- `docs/02-prd.md`
- `docs/04-mcp-cli-spec.md`
- `docs/06-benchmark-framework.md`

## Workflow

1. Identify high-risk paths first.
2. Choose the lightest test that proves the behavior.
3. Cover success path, failure path, and boundary conditions.
4. Validate security and contract behavior where relevant.

## Coverage Priorities

- graph and context pack correctness
- CLI exit codes and JSON output stability
- MCP tool contracts
- policy enforcement behavior
- benchmark scoring accuracy

## Guardrails

- do not add brittle tests that mirror implementation details
- prefer deterministic fixtures
- note residual risk when full validation is not possible

## Deliverables

- test plan or added tests
- pass/fail evidence
- residual risk notes if anything remains unverified
