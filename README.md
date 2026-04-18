# be-ai-heart

`be-ai-heart` is a startup-ready product concept and execution plan for a context infrastructure layer that helps AI coding agents understand a codebase without repeatedly reloading the same knowledge into the prompt.

The core thesis is simple:

- Teams waste money because AI loses context between sessions.
- Repeated prompting burns tokens and still produces duplicate, inconsistent, or unsafe code.
- Enterprises need a durable project memory layer, not just a better prompt.

`be-ai-heart` turns a codebase into a living graph of modules, symbols, architecture rules, decisions, and reusable context packs that AI can consume through CLI and MCP.

## Vision

Become the standard context operating system for AI-assisted software teams:

- Stable project memory
- Lower token spend
- Safer agent execution
- Better reuse and less duplicate work
- More consistent architecture and cleaner output

## Product Naming

- Product/company name: `be-ai-heart`
- CLI name: `heart`
- MCP server name: `heart-mcp`
- Project config file: `heart.config.yaml`
- Generated knowledge artifact: `heart.lock.json`

## What Is In This Repo

- [Agent Instructions](./AGENTS.md)
- [Executive Summary](./docs/00-executive-summary.md)
- [Product Story](./docs/01-product-story.md)
- [PRD](./docs/02-prd.md)
- [Technical Architecture](./docs/03-technical-architecture.md)
- [CLI and MCP Spec](./docs/04-mcp-cli-spec.md)
- [Enterprise Platform Plan](./docs/05-enterprise-platform.md)
- [Benchmark Framework](./docs/06-benchmark-framework.md)
- [Go-To-Market and Pricing](./docs/07-go-to-market-pricing.md)
- [Roadmap and Operating Model](./docs/08-roadmap-operating-model.md)
- [Investor One-Pager](./docs/09-investor-one-pager.md)
- [User Stories and Acceptance Criteria](./docs/10-user-stories.md)
- [Implementation Blueprint](./docs/11-implementation-blueprint.md)
- [Document Ingestion Context Layer](./docs/12-document-ingestion-context-layer.md)
- [Competitive Landscape](./docs/13-competitive-landscape.md)
- [GitHub Delivery Plan](./docs/14-github-delivery-plan.md)

## Agent Layer

This repository now includes a project-level agent governance layer:

- `AGENTS.md` defines the global operating rules for any Codex or agent workflow.
- `skills/*/SKILL.md` provides focused instructions for security, architecture, QA, frontend, backend, DevOps, GitHub, Google Cloud, CLI, MCP, and benchmark work.

Use this layer before scaling implementation so future AI work remains consistent.

## Product Summary

`be-ai-heart` has four product layers:

1. `Core Graph Engine`
   Builds a semantic graph of the codebase: repositories, modules, files, symbols, dependencies, ownership, decisions, and policies.
2. `Agent Context Runtime`
   Compiles the right context pack for a given task and exposes it to AI through MCP and CLI.
3. `Enterprise Control Plane`
   Handles tenants, billing, usage analytics, benchmark reporting, governance, and admin workflows.
4. `Commercial Surface`
   Marketing website, docs portal, onboarding, licensing, self-serve trials, and enterprise sales support.

It now also treats project documents as first-class context inputs so the heart can preserve business intent, requirements, and system design alongside code.

## Recommended First Execution Order

1. Build the graph engine for one language stack.
2. Ship the CLI and local MCP server.
3. Prove value with benchmark scripts and measurable token savings.
4. Launch a docs site and product website.
5. Add multi-tenant cloud control plane, billing, and enterprise admin.

## Suggested Initial Tech Stack

- Parsing/indexing: Tree-sitter + language-specific AST adapters
- Graph storage: Postgres + `pgvector`, later Neo4j or Memgraph for selected workloads
- Search: hybrid symbol search + semantic retrieval
- Backend: TypeScript services or Go for indexing worker
- CLI: TypeScript or Rust
- MCP server: TypeScript
- Frontend: Next.js
- Auth: Clerk or Auth0
- Billing: Stripe
- Product analytics: PostHog
- CRM: HubSpot first, custom admin later

## Success Metrics

- `30%+` token reduction on repeated AI coding workflows
- `20%+` faster time to acceptable patch
- `40%+` reduction in duplicate implementations
- `25%+` improvement in architecture compliance score
- `3` design partners in the first 90 days
- First paid pilot within 6 months

## Repo Status

This repository now contains:

- the execution-grade planning and documentation package
- a project-level agent/skill governance system
- a dependency-light MVP monorepo scaffold
- a minimal parser, graph, context compiler, policy engine, CLI, MCP tool registry, and benchmark layer
- basic tests that run locally with `npm test`

## Local Commands

```bash
npm run build
npm test
npm run overview
npm run mcp:tools
npm run mcp:serve
node ./packages/cli/bin/heart.js pack --json "improve login audit flow"
```
