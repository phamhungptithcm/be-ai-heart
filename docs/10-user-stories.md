# User Stories and Acceptance Criteria

## Current Planning Source

This file keeps the compact user-story baseline. Current status, enterprise-startup repositioning, and the complete function/API inventory live in:

- [Enterprise Startup Replan and Function Inventory](./23-enterprise-startup-replan.md)
- [Decision Log](./DECISIONS.md)
- [Planning Changelog](./CHANGELOG-PLANNING.md)

## Story Status Snapshot

| Area | Status | Current note |
|---|---|---|
| Local CLI foundation | Done | Core commands, first-run doctor checklist, deterministic JSON output, and the TTY workbench work; public release messaging can still improve. |
| Durable repo memory | Done | Graph v2, cache provenance, readiness, docs, policies, and context links exist. |
| Context pack and MCP | Done | Context pack v2, MCP tools, allowlists, and benchmark summary evidence work. |
| Docs/spec sync | Done/Partial | Document memory exists; planning change requests now have a schema, validator, markdown renderer, docs, and template; a generated accepted-request registry remains future. |
| CLI developer experience | Done/Partial | Connect, JSON contracts, first-run checklist, interactive slash/natural command entry, provider selection, and one-shot chat work; richer tool orchestration remains planned. |
| CLI IDE / AI workbench | Done/Partial | TTY workbench shows repo memory, docs/spec, benchmark, model, provider-key, context, and allowlisted-tool state; full autonomous edit workflows are not in scope. |
| Web UI/portal/admin | Partial | Surfaces build; website trial CTA, portal onboarding, connect empty states, and workbench now point at the same `heart sync setup` activation path; repository profiles include context pack preview with model presets and command box. |
| Portal AI chat and models | Done/Partial | Portal has chat sessions, SSE stream endpoint, context-pack attachment metadata, model settings, provider-key masking/encrypted storage paths, and allowlisted action classification; deeper tool orchestration remains planned. |
| Domain packs/Tolling | Done/Partial | Tolling Management pack and Sales MVP Demo Kit source artifacts exist with CLI/MCP/API/portal integration; customer-specific overlays and production runtime integrations remain future. |
| Benchmark and ROI proof | Done/Partial | Evidence bundle v2, observed capture, MCP benchmark summary, five-type pilot catalog, and evidence-quality trend digest exist; field-calibrated customer scenarios remain next. |
| Governance/security/enterprise | Done/Partial | Tenant/auth/session/audit basics exist; benchmark artifact safety is enforced before publish, model keys are masked, portal chat is allowlisted, and the security packet includes production threat model, retention, export, payment, and deployment boundaries. |
| Billing/payment readiness | Partial/Future | Portal/admin billing posture and entitlement contracts exist; live payment/subscription provider integration remains planned. |
| Team workspace future | Partial/Future | Hosted surfaces exist; shared graph and multi-repo memory are future. |
| Customer adoption/design partner flow | Done/Partial | Website, pricing, and SMB checklist now include local-first pilot, evidence gates, and buyer caveats; founder/operator pipeline polish remains. |

## Epic 1: Repository Understanding

### Story 1.0

As an engineer, I want to install the CLI with one npm package so that `heart` is easy to adopt in local and agent workflows.

Acceptance criteria:

- the publishable package name is `beheart`
- installing the package exposes the `heart` binary outside the monorepo
- the packaged CLI works from a tarball install without depending on sibling workspace source files
- `heart connect install --dry-run` from an installed package points MCP configs at the installed CLI path

### Story 1.0b

As an engineer, I want `heart login` to open the BeHeart portal and finish authentication automatically so that sync
does not require copying API URLs into the terminal.

Acceptance criteria:

- `heart login` opens the hosted portal from an interactive terminal and waits for a short-lived loopback callback
- the callback includes a state token and only accepts localhost loopback URLs
- `heart login --api-key <key>` and `heart login --api-key=<key>` save a portal-created one-time key
- `--url` remains available only as a local or self-hosted API override
- saved credentials are redacted from output and stored with user-only file permissions

### Story 1.0c

As an engineer, I want a single sync setup command after login so that the portal has the first repo profile, docs, and starter context pack without memorizing multiple sync commands.

Acceptance criteria:

- `heart sync setup` uses saved login credentials unless `--url` and `--session` are passed
- the command publishes repository profile, document artifact, and a starter hosted context-pack record
- output includes profile, documents, context pack, and next actions
- secrets and raw local source are not published

### Story 1.1

As an engineer, I want to initialize `be-ai-heart` in a repo so that the system can understand the project structure.

Acceptance criteria:

- `heart init` creates `heart.config.yaml`
- `heart init` creates `.heart/policies.yaml`
- `heart init` repairs missing scaffold files without overwriting an existing config unless `--force` is used
- default ignore patterns are suggested
- language detection result is shown
- detected runtime is shown
- next recommended commands are shown

### Story 1.1b

As an engineer, I want to run repository preflight checks before indexing so that I can fix configuration and parser issues early.

Acceptance criteria:

- `heart doctor` reports config path and load status
- `heart doctor` reports policy path and load status
- `heart doctor` reports effective document roots and ignore paths
- `heart doctor` reports parser availability, cache state, and effective MCP tools
- `heart doctor` returns a top-level readiness status and deterministic summary counts in JSON mode
- `heart doctor` returns warnings and next actions in human mode

### Story 1.1c

As an engineer, I want a low-friction local connect workflow so that I can see whether a supported agent host is ready for `heart mcp serve`.

Acceptance criteria:

- `heart connect detect` returns a stable inventory for supported local agent hosts
- `heart connect detect` returns detected local model runtimes when supported localhost endpoints respond
- `heart connect install --dry-run` returns a deterministic plan without mutating files
- `heart connect install` writes only allowlisted config paths and verifies the result
- `heart connect verify` completes a real MCP stdio handshake for a configured client
- `heart connect doctor` returns support-oriented preflight checks plus next actions
- `heart connect doctor` stays non-ready until a supported client is actually configured for the repo
- connect commands support deterministic JSON output for scripting and agent use

### Story 1.2

As an engineer, I want to scan my repository so that symbols, modules, and dependencies are indexed.

Acceptance criteria:

- `heart scan` completes on a supported repo
- graph artifact is persisted
- scan summary reports file count, symbol count, and parser warnings

## Epic 1A: CLI AI Workbench and Models

### Story 1A.1

As an engineer, I want `heart` to open an interactive AI coding workbench so that repo memory, model selection, and next actions are visible in one local loop.

Acceptance criteria:

- `heart` opens the workbench only in an interactive TTY
- non-TTY, CI, `--json`, direct commands, and MCP stdio stay decoration-free
- workbench status includes repo, path, memory, config, policy, scan, parser, docs/spec, MCP, benchmark, model, provider keys, context, tools, and warnings
- slash and natural commands bridge to the same direct CLI command contracts

### Story 1A.2

As an engineer, I want to select model providers and keys locally so that BeHeart can use my approved model without hiding credential risk.

Acceptance criteria:

- `heart models providers`, `list`, `add-key`, `test`, `select`, and `remove-key` work with deterministic JSON output
- provider model lists use live discovery when a key exists and fallback manifests otherwise
- CLI output masks keys and stores local credentials with user-only file permissions
- provider environment variables are supported as key sources

### Story 1A.3

As an engineer, I want one-shot AI chat with repo or domain context so that I can ask planning questions without leaving the local flow.

Acceptance criteria:

- `heart chat --context repo <prompt>` sends one provider-backed request when a prompt is supplied
- `heart chat --pack tolling-management <prompt>` attaches domain-pack context
- `heart chat --json` returns assistant message, usage, cost, and context attachment metadata
- missing API keys produce a clear next command and do not leak secrets

## Epic 2: Stable Context for AI

### Story 2.1

As an AI agent, I want a project overview so that I understand domains, important modules, and architecture boundaries before coding.

Acceptance criteria:

- `project_overview` tool returns summary, domains, and notable files
- output is compact enough for prompt inclusion

### Story 2.2

As an AI agent, I want a task-specific context pack so that I receive only the most relevant project knowledge for a task.

Acceptance criteria:

- `context_pack` accepts a natural-language task
- response includes reuse candidates and risks
- response respects a token budget or compact mode

### Story 2.3

As an AI agent, I want reuse suggestions so that I do not create duplicate functionality.

Acceptance criteria:

- `context_pack` returns likely reuse candidates or overlap warnings
- results include confidence signals and file references

### Story 2.4

As an AI agent, I want relevant business, requirements, and technical documents in my context pack so that implementation decisions stay aligned with project intent.

Acceptance criteria:

- project documents can be scanned from configured paths
- `context_pack` returns relevant documents when they match the task
- ignored or sensitive documents are excluded from retrieval

## Epic 3: Architecture Safety

### Story 3.1

As a tech lead, I want to define architecture rules so that AI-generated changes stay within project boundaries.

Acceptance criteria:

- policies can be stored in repo config
- `heart policy check` reports violations and warnings

### Story 3.2

As a tech lead, I want impact analysis so that agents understand which modules and tests may be affected.

Acceptance criteria:

- `impact_analysis` returns dependent files and related tests
- output includes likely risk areas
- missing targets are signaled explicitly instead of being silently treated as valid results

### Story 3.3

As a platform owner, I want strict config and policy validation so that bad local configuration fails loudly instead of silently degrading behavior.

Acceptance criteria:

- unknown keys in `heart.config.yaml` are reported as schema errors
- unknown keys in `.heart/policies.yaml` are reported as schema errors
- invalid values are reported without being silently accepted
- `heart doctor` surfaces invalid config or policy status clearly

## Epic 4: Benchmark and ROI

### Story 4.1

As an engineering manager, I want benchmark reports so that I can quantify token and quality improvements.

Acceptance criteria:

- baseline and assisted runs can be compared
- report shows token delta, cost delta, and quality score delta

### Story 4.2

As a sales engineer, I want a repeatable pilot benchmark so that I can prove value to prospects.

Acceptance criteria:

- benchmark scenarios are versioned
- report export is shareable with customers

### Story 4.3

As a sales engineer, I want domain-pack scenarios so that benchmark discussions can include vertical workflows without unsupported ROI claims.

Acceptance criteria:

- Tolling benchmark scenarios are versioned under `benchmarks/` or the pack
- reports identify pack, repo, provider/model, measurement mode, and evidence bundle status
- demo-kit and domain-pack metrics are labeled as observed, estimated, or hypothesis
- fake/demo data is not presented as production customer evidence

## Epic 5: Team and Enterprise Controls

### Story 5.1

As an org admin, I want to manage repositories and members so that the team can use shared context safely.

Acceptance criteria:

- repos can be added to an organization
- member roles are visible
- access can be revoked

### Story 5.2

As an enterprise buyer, I want auditability and deployment controls so that the product can meet internal governance expectations.

Acceptance criteria:

- query logs exist in enterprise mode
- SSO/RBAC are supported in enterprise tier
- private deployment path is documented

## Epic 6: Commercial Surface

### Story 6.1

As a prospect, I want a clear product website so that I understand value, pricing, and how to try the product.

Acceptance criteria:

- website explains problem, solution, ROI, and onboarding
- pricing and demo CTAs are visible

### Story 6.2

As an admin, I want billing and revenue visibility so that the business can manage licenses and growth.

Acceptance criteria:

- active subscriptions are visible
- benchmark-driven expansion opportunities can be tracked

## Epic 7: Web Product Surfaces and Sync Visibility

### Story 7.1

As an engineer, I want the portal repository page to show CLI sync status, graph health, docs freshness, context packs,
benchmarks, diagrams, and policy warnings so that I can tell whether the web view reflects the latest local repo state.

Acceptance criteria:

- repo overview includes scan status, last CLI sync, graph health, docs/spec freshness, context pack history, benchmark evidence, policy warnings, diagrams, and next recommended action
- stale or missing artifacts render empty/error states with a clear next action
- portal data comes from typed backend contracts, not component-owned mock data

### Story 7.2

As a portal user, I want a chat workbench with repo/model/mode/budget controls so that I can ask for product actions
without giving the web app arbitrary shell access.

Acceptance criteria:

- supported commands map to allowlisted backend actions
- risky or side-effecting actions require confirmation
- result cards include status, cited files/docs, and next actions
- model settings keep provider secrets masked

### Story 7.3

As the founder, I want a private dashboard for product, finance, retention, enterprise, support, and security signals so
that operating risk and demand are visible from one internal view.

Acceptance criteria:

- founder metrics include usage, scans, context packs, MCP connections, benchmarks, reported savings, estimated finance, retention, pipeline, support, failed jobs, risky accounts, health, and audit/security events
- estimated finance is labeled as estimated until billing integration is configured
- metrics come from synced artifacts, intake, telemetry, audit, and benchmark records

## Epic 8: Domain Packs and Tolling Demo Kit

### Story 8.1

As an engineer or sales engineer, I want to browse source-backed domain packs so that AI tasks can start with reusable industry context.

Acceptance criteria:

- `heart packs list/show/layers/validate/conflicts` expose pack metadata, layers, citations, warnings, and conflicts
- MCP exposes `domain_pack_*` tools through the configured allowlist
- portal domain-pack pages show layers, build options, artifacts, source notes, benchmarks, and security warnings

### Story 8.2

As a founder or sales engineer, I want to generate the Tolling Sales MVP Demo Kit so that discovery and demos can use credible, fake-data-only assets.

Acceptance criteria:

- `heart packs build tolling-management --output sales-demo-kit` writes a manifest and generated files under `.heart/packs/`
- generated output includes citations, security warnings, selected layers, conflicts, and next actions
- no generated artifact contains real PII, real plates, plate images, real trip history, raw payment data, production endpoints, or secrets
- the kit labels ROI as hypothesis unless an observed benchmark report exists

## Epic 9: Payment, Security, and Deployment Readiness

### Story 9.1

As a security owner, I want model provider keys, MCP tools, portal chat, generated artifacts, and benchmark reports governed so that AI context does not leak sensitive data.

Acceptance criteria:

- CLI and portal model keys are masked and stored only through approved credential paths
- portal chat rejects arbitrary shell-like input and requires confirmation for risky side effects
- MCP allowlists constrain `tools/list` and `tools/call`
- benchmark publication refuses unsafe paths, secret-like values, and sensitive fields
- domain-pack generated artifacts use fake data and source citations

### Story 9.2

As an enterprise buyer, I want billing and deployment posture separated from production claims so that procurement can evaluate risk honestly.

Acceptance criteria:

- portal/admin billing views identify adapter-backed versus mock/estimated data
- no docs claim live payment processing, PCI compliance, SOC 2, ISO 27001, HIPAA, FedRAMP, or general private deployment availability
- production deployment docs list SSO/RBAC, backup/restore, retention/export, billing adapter, tenant isolation, observability, and secret-management gaps
