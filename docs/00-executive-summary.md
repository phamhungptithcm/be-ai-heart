# Executive Summary

## Problem

AI coding tools are useful, but they are structurally inefficient inside real software teams:

- Context is transient and often lost between sessions.
- Prompts repeatedly restate the same project knowledge.
- Agents do not reliably understand what already exists.
- Duplicate work increases when AI cannot see reusable code paths.
- Teams have no strong control layer for architecture, rules, or safe execution.
- Enterprise buyers care about cost, governance, and consistency, not just raw generation speed.

This creates four business-level pains:

1. High token burn
2. Low reuse of existing code
3. More review and cleanup work
4. Weak confidence in AI-generated changes

## Solution

`be-ai-heart` is a persistent context layer for AI-assisted software development.

It scans the repository, builds a graph of the project, continuously updates architectural knowledge, and serves task-specific context packs to AI agents through CLI and MCP.

Instead of asking the model to rediscover the codebase each time, the team gives the model a durable project memory.

## Core Product Promise

For software teams using AI to code, `be-ai-heart` reduces prompt waste and improves delivery quality by providing:

- Stable codebase understanding
- Reusable project memory
- Architecture-aware context retrieval
- Safer agent workflows
- Measurable savings through benchmark reporting

## Ideal Customer Profile

Primary ICP:

- Engineering teams with `10-200` developers
- Strong usage of Cursor, Codex, Claude Code, GitHub Copilot, or internal agent tooling
- Multi-repo or medium-to-large monorepo environments
- Leaders actively measuring AI cost and engineering productivity

Secondary ICP:

- AI-native startups with fast-moving codebases
- Platform teams building internal developer tooling
- Enterprises that need on-prem or VPC deployment

## Why Now

- AI coding adoption is increasing faster than workflow maturity.
- Token spend is becoming visible at the CFO and engineering leadership level.
- MCP makes it practical to attach structured tools to AI agents.
- Teams want agents, but they do not trust them without guardrails and project memory.

## Product Strategy

Phase 1:

- Single-repo local-first indexing
- Local CLI
- Local MCP server
- Benchmark suite proving token and quality improvements

Phase 2:

- Team workspace
- Shared graph storage
- Policy enforcement
- Usage analytics
- Billing and licensing

Phase 3:

- Multi-language support
- Multi-repo dependency graph
- Enterprise security controls
- On-prem deployment
- Admin and CRM control plane

## Business Model

- Free developer tier for local use
- Team SaaS subscription by seats and indexed repos
- Enterprise annual license with governance, SSO, audit logs, VPC/on-prem, and premium support
- Optional professional services for onboarding and benchmark studies

## Moat

`be-ai-heart` should not position itself as “another coding assistant.” The moat is the context infrastructure:

- Durable code graph and project memory
- High-signal context compiler
- Architecture and policy intelligence
- Benchmark data proving cost and quality impact
- Deep integration into AI-native workflows through CLI and MCP

## 12-Month Targets

- 3-5 design partners
- MVP used weekly by internal and pilot teams
- Benchmark report with repeatable methodology
- First `100k-300k USD` in annualized revenue potential
- Clear enterprise narrative: cost reduction plus AI safety plus architecture consistency
