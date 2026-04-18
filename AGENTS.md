# AGENTS.md

## Mission

`be-ai-heart` is building a durable context operating layer for AI-assisted software teams. Every change in this repository must move the product toward:

- stable project memory for AI
- lower token spend
- safer and more governable agent workflows
- better reuse, less duplication, and cleaner architecture
- measurable ROI through benchmark evidence

## Instruction Order

When working in this repository, follow this order:

1. User request
2. `AGENTS.md`
3. Relevant local skill files under `skills/*/SKILL.md`
4. Product and technical docs under `docs/`
5. Existing code and tests

If instructions conflict, prefer the higher item in the list.

## Required Reading Before Major Work

- Product scope: `docs/00-executive-summary.md`, `docs/02-prd.md`
- System design: `docs/03-technical-architecture.md`, `docs/04-mcp-cli-spec.md`
- Delivery plan: `docs/08-roadmap-operating-model.md`, `docs/11-implementation-blueprint.md`
- ROI proof: `docs/06-benchmark-framework.md`

## Operating Rules

### Product Rules

- Prioritize trust, measurable savings, and adoption friction over broad feature count.
- Build the smallest vertical slice that proves value in daily AI coding workflow.
- Prefer TypeScript and Node for the MVP unless there is explicit direction to use another stack.
- Preserve local-first workflows even when adding shared or cloud features.

### Architecture Rules

- `packages/*` contain reusable domain logic and must not depend on `apps/*`.
- `services/*` may depend on `packages/*` but not on `apps/*`.
- `apps/*` may depend on `packages/*` and service contracts, but should keep UI-specific code local.
- Keep CLI, MCP, graph, context compiler, and policy engine decoupled behind narrow interfaces.
- Reuse existing modules before creating new ones.

### Security Rules

- Treat security as mandatory, not optional.
- Never hardcode secrets, tokens, API keys, or customer data.
- Minimize data collected, stored, or logged.
- Redact sensitive paths and content from context artifacts where possible.
- Default to least privilege for cloud, CI, and admin systems.
- Any work touching auth, billing, admin, CI, MCP, or cloud must apply `skills/security-engineering/SKILL.md`.

### Quality Rules

- Every code change should include validation appropriate to risk: tests, contract checks, smoke checks, or explicit rationale when not possible.
- Favor deterministic outputs, explicit schemas, and predictable CLI behavior.
- Keep docs aligned with implementation. Do not let architecture drift silently.
- Avoid placeholder complexity. A stub is acceptable only if it clarifies the next real implementation step.

## MVP Delivery Sequence

Build in this order unless the user explicitly overrides it:

1. repo scaffolding and local developer workflow
2. parser and graph primitives
3. context compiler
4. CLI
5. local MCP server
6. benchmark harness
7. website, docs, admin, and cloud control plane

## Definition of Done

A task is done only when all applicable items are true:

- implementation is aligned with documented architecture
- security implications were considered
- tests or validation were added or run when feasible
- relevant docs were updated when behavior or architecture changed
- output is understandable for the next agent without hidden context

## Local Skill Selection

Choose the smallest set of local skills that match the task:

- `skills/core-architecture/SKILL.md`
- `skills/security-engineering/SKILL.md`
- `skills/ui-ux/SKILL.md`
- `skills/project-owner/SKILL.md`
- `skills/business-analyst/SKILL.md`
- `skills/qa-engineering/SKILL.md`
- `skills/frontend-react/SKILL.md`
- `skills/frontend-vue/SKILL.md`
- `skills/backend-nodejs/SKILL.md`
- `skills/backend-java/SKILL.md`
- `skills/devops-platform/SKILL.md`
- `skills/github-workflow/SKILL.md`
- `skills/github-actions/SKILL.md`
- `skills/google-cloud-platform/SKILL.md`
- `skills/cli-engineering/SKILL.md`
- `skills/cli-ux/SKILL.md`
- `skills/mcp-runtime/SKILL.md`
- `skills/benchmark-roi/SKILL.md`

## Skill Usage Policy

- Apply `core-architecture` to any structural code or package changes.
- Apply `security-engineering` to any backend, admin, auth, billing, CI, MCP, or cloud task.
- Apply `qa-engineering` before release-facing merges or when adding new behavior.
- Apply `cli-engineering` and `cli-ux` together for CLI surface changes.
- Apply `mcp-runtime` for any MCP tool design or context pack behavior.
- Apply `benchmark-roi` for experiments, benchmark scripts, measurement, or ROI claims.

## Commit and Review Expectations

- Keep changes scoped and reversible.
- Explain tradeoffs in code or docs where the decision is not obvious.
- Do not introduce flashy architecture that weakens maintainability.
- Prefer boring, testable building blocks over fragile cleverness.
