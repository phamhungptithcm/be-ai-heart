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

`be-ai-heart` is a persistent context and AI workbench layer for AI-assisted software development.

It scans the repository, builds a graph of the project, continuously updates architectural knowledge, and serves task-specific context packs to AI agents through CLI, the interactive CLI workbench, portal chat, and MCP.

Instead of asking the model to rediscover the codebase each time, the team gives the model durable project memory plus explicit provider/model choice, policy guardrails, domain context, and benchmark evidence.

## Core Product Promise

For software teams using AI to code, `be-ai-heart` reduces prompt waste and improves delivery quality by providing:

- Stable codebase understanding
- Reusable project memory
- Architecture-aware context retrieval
- CLI AI coding workbench
- Portal chat over synced artifacts
- Provider-neutral model selection and BYOK
- MCP runtime and tool allowlists
- Source-backed domain packs and context packs
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

Current local MVP / guided pilot:

- Single-repo local-first indexing
- Local CLI
- Interactive CLI AI workbench
- Provider/model selection and one-shot `heart chat`
- Local MCP server
- Context packs, docs/spec memory, policies, diagrams, and document sync
- Tolling Management Domain Pack and Tolling Sales MVP Demo Kit artifacts
- Benchmark suite for token, reuse, quality, and ROI evidence; no broad ROI claim without observed runs

Team workspace:

- Team workspace
- Portal chat and repository workbench over synced artifacts
- Shared graph/storage decisions
- Team policy management
- Usage analytics
- Billing and licensing adapters

Enterprise readiness:

- Multi-language support
- Multi-repo dependency graph
- Enterprise security controls
- On-prem deployment
- Admin, billing, support, observability, and CRM adapter control plane

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
- Benchmark reports with repeatable methodology and clear observed/estimated labels
- First `100k-300k USD` in annualized revenue potential
- Clear enterprise narrative: cost reduction evidence plus AI safety, model governance, architecture consistency, and deployment readiness

## Product Surface Map

| Surface | Current role | Status |
| --- | --- | --- |
| CLI | Local setup, scan, docs sync, context packs, domain packs, benchmarks, model setup, one-shot chat | MVP implemented |
| CLI AI workbench | Interactive repo memory and AI command loop | MVP implemented; deeper streaming/tool orchestration planned |
| MCP runtime | Local stdio tools for compatible AI clients | MVP implemented |
| Portal | Tenant-scoped repository, docs/spec, graph, benchmark, domain-pack, model, and chat views | Guided-pilot surface |
| Admin | Internal support, observability, billing posture, sessions, customers, and revenue views | Internal pilot surface |
| Domain packs | Reusable source-backed domain memory, starting with Tolling Management | Phase 1 implemented |
| Billing/payment | Entitlement and billing posture contracts | Adapter-ready; live provider integration planned |
