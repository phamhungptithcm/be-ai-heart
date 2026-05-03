# be-ai-heart

Durable project memory for AI-assisted software teams.

![Local-first MVP](https://img.shields.io/badge/status-local--first%20MVP-0f766e)
![CLI and MCP](https://img.shields.io/badge/interface-CLI%20%2B%20MCP-2563eb)
![Web UI](https://img.shields.io/badge/surfaces-website%20%2B%20portal%20%2B%20admin-9333ea)
![TypeScript Node](https://img.shields.io/badge/focus-TypeScript%20%2F%20Node-7c3aed)
![Benchmark driven](https://img.shields.io/badge/ROI-benchmark--driven-b45309)

`be-ai-heart` helps AI coding tools understand a repository before they write code. It scans code and project documents, builds reusable project memory, serves compact task-specific context through the `heart` CLI and MCP, and includes web surfaces for customer visibility and internal operations.

**Less repeated discovery. Lower token waste. Better reuse. Safer AI coding workflows.**

If this project speaks to a problem your team feels every week, star the repo so it is easier to find again.

## Quick Read

| Question | Short answer |
| --- | --- |
| What is it? | A durable context and memory layer for AI coding agents. |
| Who is it for? | Engineers, tech leads, platform teams, managers, design partners, and AI-heavy software teams. |
| Why now? | AI coding is growing fast, but repo memory, reuse, governance, and ROI measurement have not caught up. |
| How do I try it? | Run `heart init`, `heart scan`, then `heart pack "your task"`. |
| What is MVP? | Local-first CLI, MCP server, graph memory, document memory, context packs, policies, benchmarks, and web UI surfaces. |
| What comes later? | Deeper team workspace, shared graph storage, analytics, RBAC, SSO, audit logs, and private deployment paths. |

## Start Here

- **New visitor:** read [Why This Exists](#why-this-exists), then [What be-ai-heart Does](#what-be-ai-heart-does).
- **Engineer:** jump to [Daily Workflow](#daily-workflow).
- **Design partner:** check [Web UI Surfaces](#web-ui-surfaces) and [Benchmark-Backed ROI](#benchmark-backed-roi).
- **Tech lead or platform owner:** scan [Trust, Safety, and Governance](#trust-safety-and-governance).
- **Manager, customer, or investor:** read [Benchmark-Backed ROI](#benchmark-backed-roi) and [Roadmap](#roadmap).

## Tags

`local-first` `AI coding` `project memory` `CLI` `MCP` `web UI` `portal` `admin` `code graph` `document memory` `context packs` `policy warnings` `benchmark ROI`

## Why This Exists

AI coding agents are powerful, but they still start cold too often.

They forget project context between sessions. They repeat the same discovery work. They burn tokens reading files an engineer already explained yesterday. They miss architecture rules. They recreate code that already exists.

That creates real workflow drag:

| Pain | What it causes |
| --- | --- |
| Lost context | More prompting, re-reading, and hand-holding |
| Token waste | More spend on old context instead of new work |
| Missed reuse | Duplicate helpers, services, and patterns |
| Weak guardrails | Architecture drift and policy cleanup in review |
| Soft ROI | AI feels useful, but savings are hard to prove |

`be-ai-heart` exists so AI agents do not have to relearn the project every time a task begins.

## What be-ai-heart Does

`be-ai-heart` scans a repository, builds durable project memory, creates a code and document graph, and returns the smallest useful context for a task.

That context can include:

- **Code context:** relevant files, symbols, modules, call paths, and tests.
- **Reuse context:** existing services, helpers, and implementation paths.
- **Document context:** requirements, decisions, system design, and architecture notes.
- **Governance context:** policy warnings, ownership hints, and architecture constraints.
- **Delivery context:** risks, missing information, citations, and suggested starting points.

Instead of pasting a large repo summary into every prompt, teams can ask `heart` for a focused context pack and give that to an AI agent through the CLI or MCP.

The repo also includes web UI surfaces so teams can review synced project memory, diagrams, documents, benchmark evidence, usage signals, and operational state outside the terminal.

## Who It Helps

`be-ai-heart` is built for teams already using AI in daily engineering work:

- Software engineers who want agents to reuse existing patterns instead of guessing.
- Tech leads who want AI-generated changes to respect architecture boundaries.
- Platform teams building safer internal AI coding workflows.
- Engineering managers who need measurable evidence that AI spend improves delivery.
- AI-native startups moving quickly across fast-changing codebases.
- Teams using Cursor, Codex, Claude Code, GitHub Copilot, Continue, or internal agents.

## The Product Promise

`be-ai-heart` is designed to make AI-assisted development more useful, predictable, and economically defensible.

| Team wants | `be-ai-heart` helps by |
| --- | --- |
| Less repeated prompting | Reusing durable project memory |
| Lower token spend | Returning compact task-specific packs |
| Better code reuse | Surfacing existing implementation paths |
| Safer agent workflows | Returning policies, risks, and warnings |
| Clearer architecture guidance | Connecting code, docs, modules, and decisions |
| Measurable ROI | Comparing baseline vs assisted workflows with benchmarks |

The promise is not that AI becomes perfect. The promise is that agents start with better memory, better constraints, and better evidence before they make changes.

## How It Works

| Step | Command | Result |
| --- | --- | --- |
| 1. Initialize a repo | `heart init` | Creates or repairs local config and policy files |
| 2. Scan code and docs | `heart scan` | Discovers source, symbols, dependencies, docs, and knowledge roots |
| 3. Build project memory | automatic after scan | Stores a versioned local graph of code, documents, policies, and relationships |
| 4. Ask for a context pack | `heart pack "add SSO login audit logging"` | Returns compact context with reuse candidates, citations, risks, and policy signals |
| 5. Connect an AI agent | `heart mcp serve` | Exposes project memory through MCP tools |
| 6. Review on the web | website, portal, admin | Shows public product flow, customer workspace, and internal control plane surfaces |

## Daily Workflow

**Install globally**

```bash
npm install -g beheart
```

**Or install in a repo**

```bash
npm install --save-dev beheart
npx heart doctor
```

**Core loop**

```bash
heart init
heart doctor
heart scan
heart overview
heart pack "add SSO login audit logging"
heart mcp serve
heart benchmark run --all
```

**Inspect the system**

```bash
heart find symbol loginUser
heart deps src/auth/login.ts
heart impact src/billing/service.ts
heart policy check
heart docs search "login audit requirements"
```

**Wire MCP into an agent**

```bash
heart connect detect
heart connect install --client cursor --scope repo
heart connect verify --client cursor --scope repo
heart connect doctor
```

**Run the web surfaces**

```bash
npm run api:dev
npm run website:dev
npm run portal:dev
npm run admin:dev
```

## Web UI Surfaces

`be-ai-heart` is local-first at the core, but it also includes Next.js web UI surfaces for the product experience around that core.

| Surface | Path | Purpose |
| --- | --- | --- |
| Website | `apps/website` | Public product narrative, docs entry points, trial flow, service pages, and design-partner intake |
| Portal | `apps/portal` | Customer workspace for repository profiles, document memory, diagrams, benchmarks, usage, members, security, and settings |
| Admin | `apps/admin` | Internal control plane for intake, support, customer inventory, benchmark history, billing posture, observability, and audit work |
| API | `services/api` | Hosted service layer for tenant-scoped portal/admin data, auth/session flow, benchmark launch, intake, and telemetry |

The split is intentional: **website sells, portal proves, admin operates**. The web UI should make project memory and ROI evidence easier to inspect while keeping customer-facing workspace data separate from internal controls.

## What Makes It Different

`be-ai-heart` is not another coding assistant.

It is the context operating layer underneath AI coding tools.

| Feature | Why it matters |
| --- | --- |
| Durable repo memory | Project understanding persists across sessions. |
| Architecture-aware retrieval | Agents get relevant modules, symbols, policies, and tests instead of broad file dumps. |
| Project document awareness | Requirements, design notes, decisions, and technical docs can guide code work. |
| Reuse detection | Agents can see likely existing implementation paths before creating new ones. |
| Policy warnings | Architecture and governance rules surface before edits happen. |
| MCP integration | Compatible agents can query project memory through structured tools. |
| Web UI surfaces | Teams can inspect project memory, documents, diagrams, benchmarks, and operations outside the terminal. |
| Benchmark evidence | Teams can compare baseline AI work against assisted work with versioned reports. |

## Local-First by Design

The core MVP is designed to work locally first.

A team should be able to initialize a repo, scan it, generate context packs, run the MCP server, and execute benchmarks without depending on a hosted service. The local repository remains the source of truth for indexing and graph construction.

That matters because adoption should feel natural for developers:

- configuration lives with the repo
- scans respect ignore rules and generated/vendor defaults
- project memory can be rebuilt from local source
- core CLI and MCP workflows fit into existing AI coding habits
- web and cloud services can mirror, share, visualize, and govern artifacts without becoming the first dependency

## Trust, Safety, and Governance

Context is powerful, so it has to be handled carefully.

`be-ai-heart` is designed around a few security and governance principles:

- **Redaction:** sensitive content should be removed from previews, benchmark reports, and shared artifacts.
- **Ignore safety:** generated output, vendor folders, build artifacts, and caches should stay out of retrieval.
- **Index readiness:** CLI, MCP, and benchmark evidence expose config, policy, cache, parser, document, and generated-noise status.
- **Policy guidance:** rules should guide agents toward approved modules and away from deprecated or banned patterns.
- **MCP allowlists:** disabled tools should not appear available to agents.
- **Evidence discipline:** reports should separate evidence from interpretation.

Future enterprise controls include shared graph storage, auditability, RBAC, SSO/SAML, tenant isolation, usage analytics, private deployment paths, and VPC or on-prem options.

## Benchmark-Backed ROI

`be-ai-heart` is built to prove value, not just claim it.

The benchmark goal is to compare a baseline AI workflow against an assisted workflow using `be-ai-heart` on the same task, repository snapshot, model class, and scoring rubric.

The benchmark framework is designed to measure:

| Metric | What it tells the team |
| --- | --- |
| Token savings | Whether context packs reduce repeated prompt and discovery cost |
| Time savings | Whether assisted work reaches acceptable output faster |
| Duplicate-work reduction | Whether agents reuse existing code instead of recreating it |
| Context retention | Whether project memory survives follow-up turns and handoffs |
| Architecture compliance | Whether changes follow documented constraints |
| Review cleanup reduction | Whether reviewers spend less time correcting avoidable AI drift |

Reports can include both machine-readable JSON and manager-friendly Markdown. Evidence manifests carry provider, model,
task, measurement mode, run IDs, sanitized repo snapshot hashes, readiness, and deterministic artifact lists. The
framework also separates observed telemetry from estimated inputs, so teams can tell which results are fully measured
and which are directional.

This README does not claim fixed savings numbers. Validated results should come from repeatable benchmark runs and design-partner evidence.

## Project Status

The current product direction is a local-first MVP with a TypeScript and Node.js focus.

| Area | Status direction |
| --- | --- |
| CLI | `heart` binary for local setup, scan, inspection, context packs, and benchmarks |
| MCP | Local server through `heart mcp serve` |
| Web UI | Next.js website, portal, and admin surfaces under `apps/*` |
| API | `services/api` for hosted auth, tenant-scoped portal/admin data, intake, benchmark launch, and telemetry |
| Graph | Code and document graph memory for one repository first |
| Context compiler | Task-specific packs with citations, reuse signals, risks, and policy guidance |
| Document memory | Project docs treated as first-class context |
| Benchmark harness | Evidence bundles and baseline vs assisted reports |

The v2 implementation focus is to make this memory more credible: cleaner indexing, deeper typed graph relationships, stronger context ranking, safer document memory, clearer citations, and benchmark reports backed by reproducible evidence.

Hosted team and enterprise surfaces are part of the platform direction, but the core product should prove value locally first.

## Roadmap

| Phase | Focus | Highlights |
| --- | --- | --- |
| Local MVP | Prove daily value in one repo | Local indexing, TypeScript/JavaScript graph extraction, CLI, MCP, context packs, document memory, local benchmark reports, initial web surfaces |
| Team Workspace | Share memory across teams | Portal workspace, shared graph storage, team policies, usage analytics, report export, benchmark history, organization foundations |
| Enterprise Readiness | Govern AI coding at scale | Admin controls, multi-repo graph, SSO/SAML, RBAC, audit logs, tenant isolation, private deployment, VPC/on-prem options |

## Contributing / Design Partners

Teams using AI coding tools heavily are welcome to test `be-ai-heart`, share feedback, and help shape benchmark scenarios.

The most useful design-partner feedback is grounded in real work:

- tasks where agents repeatedly lose context
- areas where duplicate implementations are common
- architecture rules that AI tools often miss
- project documents that should influence code changes
- before-and-after benchmark runs with clear evidence

The product is being built for serious daily use: local first, measurable, governable, and practical for engineers who want AI to understand the system before it edits the system.

**Star this repo** if you want AI agents to start with durable project memory instead of a cold read of the same codebase every session.

## Read More

- [Executive Summary](./docs/00-executive-summary.md)
- [Product Story](./docs/01-product-story.md)
- [Product Requirements](./docs/02-prd.md)
- [Technical Architecture](./docs/03-technical-architecture.md)
- [CLI and MCP Specification](./docs/04-mcp-cli-spec.md)
- [Benchmark Framework](./docs/06-benchmark-framework.md)
- [Roadmap and Operating Model](./docs/08-roadmap-operating-model.md)
