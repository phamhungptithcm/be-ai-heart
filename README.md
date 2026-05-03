# BeHeart

Durable project memory for AI-assisted software teams.

![Local-first MVP](https://img.shields.io/badge/status-local--first%20MVP-0f766e)
![CLI and MCP](https://img.shields.io/badge/interface-CLI%20%2B%20MCP-2563eb)
![Web UI](https://img.shields.io/badge/surfaces-website%20%2B%20portal%20%2B%20admin-9333ea)
![TypeScript Node](https://img.shields.io/badge/focus-TypeScript%20%2F%20Node-7c3aed)
![Benchmark driven](https://img.shields.io/badge/ROI-benchmark--driven-b45309)

BeHeart helps AI coding tools understand a repository before they write code. It scans code and project documents, builds reusable project memory, serves compact task-specific context through the `heart` CLI, the interactive CLI AI workbench, and MCP, and includes web surfaces for customer visibility and internal operations.

**Less repeated discovery. Lower token waste. Better reuse. Safer AI coding workflows.**

If this project speaks to a problem your team feels every week, star the repo so it is easier to find again.

## Quick Read

| Question | Short answer |
| --- | --- |
| What is it? | A durable context, agent, and governance layer for AI coding workflows. |
| Who is it for? | Engineers, tech leads, platform teams, managers, design partners, and AI-heavy software teams. |
| Why now? | AI coding is growing fast, but repo memory, reuse, governance, and ROI measurement have not caught up. |
| How do I try it? | Run `heart init`, `heart scan`, then `heart pack "your task"` or open the workbench with `heart`. |
| What works now? | Local CLI/workbench, model selection, one-shot AI chat, MCP server, graph/document memory, context packs, domain packs, benchmark reports, and initial website/portal/admin surfaces. |
| What is planned next? | Deeper shared team memory, saved pack history, richer portal chat execution, enterprise model admin, billing adapters, SSO/RBAC hardening, private deployment paths, and customer-calibrated ROI evidence. |

## Start Here

- **New visitor:** read [Why This Exists](#why-this-exists), then [What BeHeart Does](#what-beheart-does).
- **Engineer:** jump to [Daily Workflow](#daily-workflow).
- **Design partner:** check [Web UI Surfaces](#web-ui-surfaces) and [Benchmark-Backed ROI](#benchmark-backed-roi).
- **Tech lead or platform owner:** scan [Trust, Safety, and Governance](#trust-safety-and-governance).
- **Manager, customer, or investor:** read [Benchmark-Backed ROI](#benchmark-backed-roi) and [Roadmap](#roadmap).

## Tags

`local-first` `AI coding` `project memory` `CLI` `AI workbench` `MCP` `web portal` `portal chat` `admin` `code graph` `document memory` `context packs` `domain packs` `policy warnings` `benchmark ROI`

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

BeHeart exists so AI agents do not have to relearn the project every time a task begins.

## What BeHeart Does

BeHeart scans a repository, builds durable project memory, creates a code and document graph, and returns the smallest useful context for a task. It also gives teams a daily AI coding workbench where provider/model choice, context source, MCP tools, domain packs, and benchmark evidence are visible before sending context to a model.

That context can include:

- **Code context:** relevant files, symbols, modules, call paths, and tests.
- **Reuse context:** existing services, helpers, and implementation paths.
- **Document context:** requirements, decisions, system design, and architecture notes.
- **Governance context:** policy warnings, ownership hints, and architecture constraints.
- **Delivery context:** risks, missing information, citations, and suggested starting points.
- **Domain context:** source-backed reusable industry memory, starting with the Tolling Management Domain Pack.
- **Evidence context:** benchmark reports and ROI evidence labels that separate observed, estimated, and mixed results.

Instead of pasting a large repo summary into every prompt, teams can ask `heart` for a focused context pack and give that to an AI agent through the CLI, portal chat, or MCP. The same memory can support local developer work, team review in the portal, and sales/demo workflows through domain packs.

The repo also includes web UI surfaces so teams can review synced project memory, diagrams, documents, benchmark evidence, usage signals, and operational state outside the terminal.

## Who It Helps

BeHeart is built for teams already using AI in daily engineering work:

- Software engineers who want agents to reuse existing patterns instead of guessing.
- Tech leads who want AI-generated changes to respect architecture boundaries.
- Platform teams building safer internal AI coding workflows.
- Engineering managers who need measurable evidence that AI spend improves delivery.
- AI-native startups moving quickly across fast-changing codebases.
- Teams using Cursor, Codex, Claude Code, GitHub Copilot, Continue, or internal agents.

## The Product Promise

BeHeart is designed to make AI-assisted development more useful, predictable, and economically defensible.

| Team wants | BeHeart helps by |
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
| 2. Check readiness | `heart doctor` | Shows config, policy, scan, docs, MCP, and first-run checklist status |
| 3. Scan code and docs | `heart scan` | Discovers source, symbols, dependencies, docs, and knowledge roots |
| 4. Build project memory | automatic after scan | Stores a versioned local graph of code, documents, policies, and relationships |
| 5. Ask for a context pack | `heart pack "add SSO login audit logging"` | Returns compact context with reuse candidates, citations, risks, and policy signals |
| 6. Work with the AI agent | `heart` or `heart chat --context repo "..."` | Uses selected provider/model with repo, graph, docs, and domain-pack attachments |
| 7. Connect external agents | `heart mcp serve` | Exposes project memory through MCP tools |
| 8. Review on the web | website, portal, admin | Shows public product flow, customer workspace, portal chat, model settings, and internal control plane surfaces |

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
heart
heart login
heart init
heart doctor
heart scan
heart ide
heart overview
heart pack "add SSO login audit logging"
heart packs list
heart packs build tolling-management --output sales-demo-kit --regional texas --agency hctra-example
heart generate tolling-management --stack next-fullstack-postgres
heart mcp serve
heart benchmark run --all
```

Run `heart` in an interactive terminal to open the local BeHeart repo memory workbench. It shows config, scan, docs/spec,
MCP, and benchmark readiness, then accepts slash commands such as `/scan`, `/overview`, and `/pack "your task"`.
It also accepts pack commands such as `/packs`, `/packs tolling-management`, and `/build tolling demo kit`.
In CI, scripts, pipes, or non-TTY shells, `heart` prints normal help and exits instead of opening the workbench.
Run `heart doctor` whenever setup feels uncertain; its first-run checklist shows the current status for `init`,
`doctor`, `scan`, `overview`, `pack`, and `mcp serve`.

Run `heart ide` for the terminal-first coding workbench MVP. It adds file search/open, command palette, keymap inspection,
package-script tasks, text/LSP diagnostics parsing with navigation targets, timeout-bounded LSP capability probing,
reusable in-process LSP sessions for didOpen/didChange diagnostics, git status/diff/review/stage picker with scripted
or TTY selection and confirmation, patch preview/apply with confirmation, rollback support, and
context/graph/docs/policy/domain/memory panels with selectable artifacts around the same BeHeart repo memory layer.

Run `heart generate tolling-management --stack next-fullstack-postgres` to preview a Domain-to-Project starter from the
Tolling Management pack. Re-run with `--confirm` to write the generated README, docs, starter code, DB schema, fake
fixtures, tests, benchmark scenario, context manifest, and `.heart/generation-manifest.json` inside the selected output
directory. MVP stack presets are `next-fullstack-postgres`, `react-node-postgres`, and `spring-react-postgres`.

**AI agent chat**

```bash
heart models providers
heart models add-key --provider openai --api-key-stdin
heart models list --provider openai
heart models pricing --provider openai
heart models validate --json
heart models select openai/gpt-5.1
heart chat --context repo --pack tolling-management "compare implementation risks"
```

BeHeart supports provider-neutral BYOK chat for OpenAI, Anthropic, Gemini, OpenRouter, Mistral, and Groq, plus local
Ollama and LM Studio runtimes that do not require API keys. Bedrock uses AWS SigV4 with `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY`, static `AWS_PROFILE`, or a `source_profile` assume-role chain; `AWS_REGION` defaults to
`us-east-1` when omitted. IAM Identity Center/SSO profiles are detected and return a clear deferred status instead of
running external auth flows. Model lists use provider discovery when a key or local
endpoint is available and fall back to a dated, versioned model manifest when discovery is not available. `heart models
pricing` shows BeHeart's versioned pricing overlay and `heart models validate --json` shows which providers are ready for
live testing, which need real keys, and which need local runtimes. CLI model keys are stored locally with user-only file
permissions or resolved from provider environment variables. The portal stores provider keys only when encrypted
server-side storage is configured. Streaming responses use provider-native SSE/JSON events where supported and stay
normalized to BeHeart chat events, including Bedrock `ConverseStream`.

The interactive workbench is a CLI IDE for AI-assisted work, not a full editor replacement. It keeps the local repo,
memory readiness, docs/spec state, selected model, context source, allowed tools, and next actions in one terminal loop.
For direct automation, `heart chat --json <prompt>` returns a structured one-shot response with usage, cost, and active
context attachments.

**Inspect the system**

```bash
heart find symbol loginUser
heart deps src/auth/login.ts
heart impact src/billing/service.ts
heart policy check
heart docs search "login audit requirements"
heart docs import ./path/to/requirements.md --category requirements
heart docs sync-web
heart packs show tolling-management
heart packs validate tolling-management
heart packs artifacts tolling-management
heart packs open tolling-management --artifact <artifact-id>
```

**Wire MCP into an agent**

```bash
heart connect detect
heart connect install --client cursor --scope repo
heart connect verify --client cursor --scope repo
heart connect doctor
```

**Sync to the portal**

Create a CLI API key in the BeHeart portal, then authenticate once:

```bash
heart login
heart sync setup
heart sync profile
heart sync docs
heart sync benchmark login-audit-flow
```

`heart login` opens the BeHeart portal, completes browser sign-in, and stores the CLI credential locally. `heart sync setup`
publishes the repository profile, document artifact, and a starter hosted context-pack record after login. Use
`heart login --api-key=<key>` when pasting a one-time key from the portal. Use `--url` only for local or self-hosted
BeHeart APIs, and use `--api-key-stdin` in shells or CI where putting keys in command history is not acceptable.

**Run the web surfaces**

```bash
npm run api:dev
npm run website:dev
npm run portal:dev
npm run admin:dev
```

For local UI testing without a hosted OIDC provider, enable demo auth on the API and the private apps:

```bash
BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH=1 npm run api:dev
BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH=1 BE_AI_HEART_DEFAULT_PORTAL_SESSION=portal-demo-session npm run portal:dev
BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH=1 BE_AI_HEART_DEFAULT_ADMIN_SESSION=admin-owner-session npm run admin:dev
```

When demo auth is enabled, the sign-in provider API exposes local-only dummy account links for the customer portal and founder/admin surfaces. The dummy session tokens are ignored unless demo auth is explicitly enabled.

## Web UI Surfaces

BeHeart is local-first at the core, but it also includes Next.js web UI surfaces for the product experience around that core.

| Surface | Path | Purpose |
| --- | --- | --- |
| Website | `apps/website` | Public product narrative, docs entry points, trial flow, service pages, and design-partner intake |
| Portal | `apps/portal` | Customer workspace for repository profiles, document memory, diagrams, benchmarks, usage, members, security, and settings |
| Admin | `apps/admin` | Internal control plane for intake, support, customer inventory, benchmark history, billing posture, observability, and audit work |
| API | `services/api` | Hosted service layer for tenant-scoped portal/admin data, auth/session flow, benchmark launch, intake, and telemetry |

The split is intentional: **website sells, portal proves, admin operates**. The web UI should make project memory and ROI evidence easier to inspect while keeping customer-facing workspace data separate from internal controls.

Current portal API contracts expose workspace/repository lists, repository sync status, graph summaries, diagrams,
docs/spec/business requirement views, context pack history and creation, benchmark reports, policy warnings, chat
commands, model settings, and founder/admin metrics. Chat commands are mapped to allowlisted product actions and do not
execute arbitrary shell input from the portal. Model settings expose provider/model/preset/budget state while keeping
provider secrets masked.

Portal chat is a team-safe command and AI surface over synced artifacts. It can prepare context-pack, graph, docs/spec,
benchmark, and domain-pack actions, but local scans and final local pack generation still belong to the CLI/MCP runtime
unless a safe runner is explicitly available.

## Domain Packs And Tolling Demo Kit

Domain packs are reusable, source-backed memory bundles for vertical software domains. They give agents domain concepts,
workflows, entities, risks, security rules, benchmark scenarios, and demo-safe artifact templates before a customer
project has its own complete implementation history.

The first pack is `tolling-management`. It covers toll road and managed-lane workflows such as roadside event intake,
tag/plate matching, trip posting, invoices, payments, disputes, image review, customer support, inventory, reporting,
privacy, and audit boundaries.

Start with the Tolling Sales MVP Demo Kit:

```bash
heart packs show tolling-management
heart packs layers tolling-management
heart packs build tolling-management --output sales-demo-kit --regional texas --agency hctra-example
heart packs open tolling-management --artifact <artifact-id>
```

The generated kit is a demo and sales artifact, not a production tolling runtime. It must use fake data only, avoid real
PII, plates, plate images, trip histories, payment data, credentials, real toll rates, legal conclusions, or official
agency claims. Use it to support discovery, demos, proposal starters, architecture discussions, and benchmark scenarios.

## What Makes It Different

BeHeart is not another coding assistant.

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

Local-first means a small team can prove value in one repo without signing up for a hosted dependency. It also matters
to enterprise teams because it creates a clean boundary: raw source, raw prompts, and raw benchmark evidence stay local
unless a sync or publication flow is explicitly run and sanitized.

## Trust, Safety, and Governance

Context is powerful, so it has to be handled carefully.

BeHeart is designed around a few security and governance principles:

- **Redaction:** sensitive content should be removed from previews, benchmark reports, and shared artifacts.
- **Provider exposure clarity:** users choose the model provider and should understand which context leaves the machine.
- **BYOK safety:** CLI keys stay in environment variables or local user-only credential files; portal BYOK requires encrypted server-side storage.
- **Ignore safety:** generated output, vendor folders, build artifacts, and caches should stay out of retrieval.
- **Index readiness:** CLI, MCP, and benchmark evidence expose config, policy, cache, parser, document, and generated-noise status.
- **Policy guidance:** rules should guide agents toward approved modules and away from deprecated or banned patterns.
- **MCP and portal allowlists:** disabled tools should not appear available to agents, and portal chat must not become arbitrary shell access.
- **Confirmed artifacts only:** risky portal chat actions require confirmation and write only scoped BeHeart artifacts such as generated domain-pack demo kits.
- **Domain-pack safety:** generated pack artifacts must stay demo-safe and source-cited.
- **Payment readiness:** billing and payment posture is modeled through adapter-friendly contracts; no raw payment data belongs in demo artifacts or docs.
- **Evidence discipline:** reports should separate evidence from interpretation.

Current security docs cover local-first boundaries, hosted sync boundaries, auth/session basics, redaction, benchmark
artifact safety, model-provider key handling, portal chat limits, MCP allowlists, domain-pack generated artifact rules,
and production threat-model gaps. Future enterprise controls include shared graph storage, broader auditability,
RBAC/SSO/SAML hardening, tenant isolation depth, billing-provider integration, usage analytics, private deployment
paths, backup/restore policy, and VPC or on-prem options.

## Benchmark-Backed ROI

BeHeart is built to prove value, not just claim it.

The benchmark goal is to compare a baseline AI workflow against an assisted workflow using BeHeart on the same task, repository snapshot, model class, and scoring rubric.

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

| Area | Current status |
| --- | --- |
| CLI | `heart` binary for local setup, scan, inspection, context packs, docs sync, domain packs, model selection, one-shot chat, and benchmarks |
| Interactive CLI AI workbench | TTY workbench with slash/natural commands, repo readiness, model/provider status, context source, and allowlisted tools |
| MCP | Local server through `heart mcp serve` |
| Web UI | Next.js website, portal, and admin surfaces under `apps/*`; portal chat/model/domain-pack views are implemented as guided surfaces |
| API | `services/api` for hosted auth, tenant-scoped portal/admin data, provider settings, chat command records, domain-pack actions, intake, benchmark launch, and telemetry |
| Graph | Code and document graph memory for one repository first |
| Context compiler | Task-specific packs with citations, reuse signals, risks, and policy guidance |
| Document memory | Project docs treated as first-class context |
| Domain packs | Tolling Management pack plus sales-demo-kit artifact generation |
| Benchmark harness | Evidence bundles, observed/estimated measurement modes, baseline vs assisted reports, and domain-pack scenarios |
| Payment/billing readiness | Portal/admin billing posture and entitlement contracts exist; live billing adapter is planned |
| Deployment/operations readiness | Local/dev scripts, hosted API, SQLite default, Postgres adapter path, observability/admin views; production hardening remains gated |

The v2 implementation focus is to make this memory more credible: cleaner indexing, deeper typed graph relationships, stronger context ranking, safer document memory, clearer citations, and benchmark reports backed by reproducible evidence.

Hosted team and enterprise surfaces are part of the platform direction, but the core product should prove value locally first.

## Roadmap

| Phase | Focus | Highlights |
| --- | --- | --- |
| Local MVP / Guided Pilot | Prove daily value in one repo | Local indexing, TypeScript/JavaScript graph extraction, CLI workbench, provider-backed chat, MCP, context packs, document memory, domain packs, local benchmark reports, initial web surfaces |
| Team Workspace | Share and review memory across teams | Portal workspace, portal chat over synced artifacts, saved context-pack history, team policies, usage analytics, report export, benchmark history, organization foundations |
| Enterprise Readiness | Govern AI coding at scale | Admin controls, multi-repo graph, enterprise model administration, billing adapter, SSO/SAML, RBAC, audit logs, tenant isolation, private deployment, backup/restore, VPC/on-prem options |

## Contributing / Design Partners

Teams using AI coding tools heavily are welcome to test BeHeart, share feedback, and help shape benchmark scenarios.

The most useful design-partner feedback is grounded in real work:

- tasks where agents repeatedly lose context
- areas where duplicate implementations are common
- architecture rules that AI tools often miss
- project documents that should influence code changes
- before-and-after benchmark runs with clear evidence

Buyer and security conversations should stay evidence-led:

- pricing and rollout should follow a specific benchmark report, measurement mode, and confidence label
- local MVP, guided design-partner pilot, and future enterprise controls should be discussed separately
- production threat model, retention, and export boundaries are documented before broad hosted rollout

The product is being built for serious daily use: local first, measurable, governable, and practical for engineers who want AI to understand the system before it edits the system.

**Star this repo** if you want AI agents to start with durable project memory instead of a cold read of the same codebase every session.

## Read More

- [Executive Summary](./docs/00-executive-summary.md)
- [Product Story](./docs/01-product-story.md)
- [Product Requirements](./docs/02-prd.md)
- [Technical Architecture](./docs/03-technical-architecture.md)
- [CLI and MCP Specification](./docs/04-mcp-cli-spec.md)
- [Benchmark Framework](./docs/06-benchmark-framework.md)
- [Go-To-Market and Pricing](./docs/07-go-to-market-pricing.md)
- [Security Overview](./docs/25-security-overview.md)
- [Production Threat Model, Retention, and Export Plan](./docs/26-production-threat-model-retention.md)
- [Planning Change Requests](./docs/CHANGE_REQUESTS.md)
- [Roadmap and Operating Model](./docs/08-roadmap-operating-model.md)
- [Specs Index](./docs/specs/README.md)
