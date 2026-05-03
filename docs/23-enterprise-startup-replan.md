# Enterprise Startup Replan and Function Inventory

Last updated: 2026-05-03

## Purpose

This document evaluates the current `be-ai-heart` repository state and replans the next implementation stories. It is written for future AI agents and humans who need to continue without rediscovering the codebase.

Scope for this pass:

- no implementation code changes
- product, architecture, story, and function/API planning
- explicit current status, risks, and next backlog
- complete enough function/API inventory for implementation handoff

## 1. Current State Assessment

### Implemented Features

| Area | Current state |
|---|---|
| Local CLI | `heart init`, `doctor`, `scan`, `overview`, `find symbol`, `deps`, `impact`, `policy check`, `docs search`, `pack`, `mcp tools`, `mcp serve`, `connect`, `benchmark`, `agent run`, `service export`, `sync`, and `auth` exist. |
| Config and policy | `heart.config.yaml` and `.heart/policies.yaml` are parsed and validated; strict schema errors are reported; local policy rules drive CLI/MCP checks. |
| Index truthfulness | Generated/vendor/default ignore paths are respected; scan provenance and cache schema metadata persist; repeated scan stability is tested. |
| Typed graph | Graph snapshot schema version 2 exists with typed nodes/edges, confidence/source/provenance, document/policy/decision evidence, diffs, deps, and impact queries. |
| Parser | TypeScript/JavaScript parser extracts files, symbols, imports, import details, calls, routes, extends/implements, tests, hashes, warnings, and relation confidence. |
| Context compiler | `schema_version: 2` context packs include files, symbols, documents, graph context, call paths, tests, reuse candidates, policies, risks, citations, confidence, quality, token budget, truncation, and missing-context warnings. |
| MCP runtime | Stdio MCP supports initialize, ping, `tools/list`, and `tools/call`; tool allowlists are enforced; `document_search` and `docs_search` alias both work. |
| Document memory | Markdown/text/json/yaml/docx/pdf ingestion exists with classification, headings, summary, freshness, sensitivity, redaction, local semantic profiles, lineage, citations, and web submission import. |
| Diagram engine | Mermaid bundles and manifest v2 exist for symbol, high-level, component, class, sequence, and mindmap diagrams with scope/confidence/validation metadata. |
| Benchmark runner | Scenario/dataset loading, comparison, scoring, reports, observed run capture through proxy, evidence bundle v2, readiness/provenance, and portal/admin publication exist. |
| Hosted API | Service host includes auth/session, tenant-scoped workspace/repository/document/benchmark routes, public intake, benchmark launcher, LLM proxy telemetry, audit, observability, rate limiting, SQLite storage, and Postgres planning. |
| Website/portal/admin | Next.js surfaces exist and build. Portal/admin have repository, document, benchmark, usage, billing, members, policies, security, settings, observability, support, customer, and revenue surfaces. |
| Tests | Full suite currently covers CLI, MCP, graph, context, docs, diagrams, benchmark, hosted API, auth, session security, UI helper contracts, and builds. |

### Partial Features

| Area | Partial status | Why partial |
|---|---|---|
| Benchmark credibility | Evidence bundles and observed capture exist. | Needs more customer-like scenarios, repeatable observed runs, and blind/technical review workflow before sales-grade claims. |
| Enterprise readiness | RBAC, session security, tenant-scoped API, admin, audit, observability exist. | Needs SSO/SAML hardening, deployment options, retention/export policies, customer security docs, and production operations runbooks. |
| Web onboarding | Website, portal, admin exist; the website now includes a local-first setup path, evidence-labeled proof language, and a design partner pilot lane. | Needs pricing and buyer packaging polish before broad self-serve launch. |
| Docs/spec sync | Docs are rich but spread across many files. | Need a durable decision log, planning changelog, status dashboard, and rules for updating PRD/spec/architecture on implementation changes. |
| Context economics | Token budget trimming and ROI reporting exist. | Need measured token-cost baselines across real agent workflows and provider/model cost presets. |
| Multi-repo/team workspace | Service artifacts and hosted surfaces exist. | Shared graph store, multi-repo relationships, team policy management, and org rollout remain future. |

### Missing Features

| Missing area | Impact |
|---|---|
| Automated change-request registry | Change-request schema/rendering exists, but accepted requests are still maintained in docs or issues instead of a generated registry. |
| Automated planning/status drift check | Story status and function inventory are maintained manually, so future agents can still leave docs stale after implementation. |
| Saved context pack history | Repository detail has a synced-artifact context pack preview lane, but saved pack history remains future work. |
| Field-calibrated benchmark corpus | The five-type design-partner benchmark suite exists, but customer-calibrated scenarios and repeated observed runs are still needed before sales-grade ROI claims. |
| Production deployment/security threat model | Enterprise buyers need deeper deployment options, retention/export settings, SSO/RBAC hardening, and production operations runbooks. |

### Outdated Docs and Mismatches

| Doc/source | Mismatch |
|---|---|
| `docs/20-v2-execution-backlog.md` | Still describes v2 milestones as planned work. Many M1-M6 items are now implemented. Keep as historical backlog or replace with status-based backlog. |
| `docs/10-user-stories.md` | Now links to this plan and includes a compact status tracker, but older epics remain for historical continuity. |
| `docs/02-prd.md` | Some "later iterations" are already implemented, especially document-to-graph linking and hosted surfaces. Needs PRD refresh after next implementation cycle. |
| `docs/03-technical-architecture.md` | Still recommends future Tree-sitter/Postgres graph direction while current MVP uses TypeScript AST and local JSON/cache plus service SQLite. This is acceptable as target direction but should be labeled current vs target. |
| `docs/11-implementation-blueprint-v2.md` | "Current state" language is now conservative after recent v2 implementation. Keep for rationale, but execution status should move to this plan or a generated status file. |
| README | Stronger than older docs and mostly aligned. Must continue avoiding fixed savings claims without benchmark evidence. |

### Broken Assumptions

- The codebase is no longer only a local prototype. Hosted API, portal, admin, auth, and observability are real enough to require security-sensitive planning.
- The main gap is no longer "build v2 contracts." It is "make v2 credible, repeatable, and easy to adopt."
- The next risk is not missing basic features. It is product coherence: docs, UI, onboarding, benchmark evidence, and enterprise claims must all match what is actually implemented.
- `BR-03` should not be treated as a simple feature story. It is part team workspace, part tenant safety, part sales evidence, and should be gated.

### Readiness by Surface

| Surface | Readiness | Risk |
|---|---:|---|
| CLI | High for local MVP | First-run checklist exists; public install/release messaging can still improve. |
| MCP | High for context workflow | Compact benchmark/status tool exists; tool contracts should remain size-bounded. |
| Backend/packages | High for MVP | Private helpers may be duplicated by agents; document ownership and only export when reuse is real. |
| Web/UI | Medium-high | Local-first onboarding and context-pack preview now exist; pricing/self-serve buyer packaging remains partial. |
| Benchmark/ROI | Medium-high | Contract and five-type pilot corpus exist; customer-calibrated observed proof is still needed for broad sales claims. |
| Enterprise/security | Medium | Tenant/session/audit scaffolding and a security overview exist; production threat model and SSO/private deployment proof remain future. |
| Small-company adoption | High for guided pilots | Local-first CLI, website pilot lane, and benchmark suite are ready; pricing/value packaging needs polish. |

## 2. Product Repositioning

### Positioning

`be-ai-heart` is a local-first AI context and governance layer for software teams. It helps AI coding tools start with the latest project memory, architecture rules, requirements, and ROI evidence instead of repeatedly rediscovering the repo.

### Who It Helps

| Persona | Pain | Value |
|---|---|---|
| Engineer | Re-explains repo context to AI and reviews duplicate work. | Faster task starts, better reuse, fewer broad scans. |
| Tech lead | AI changes drift across architecture boundaries. | Policies, impact analysis, tests, and decision/document links. |
| Engineering manager | AI spend is rising without clear ROI. | Baseline vs assisted benchmark reports and cost/quality evidence. |
| SMB founder/CTO | Wants AI leverage without enterprise platform spend. | Affordable local-first workflow with measurable savings path. |
| Enterprise platform team | Needs governed AI coding workflows. | MCP, policy, RBAC/audit roadmap, tenant-safe hosted surfaces. |

### Pain Solved

- cold-start AI coding sessions
- token waste from repeated context loading
- duplicate implementations
- stale docs and requirements ignored during implementation
- weak AI governance and architecture review
- missing evidence for AI productivity claims

### Measurable Value

Only claim measurable value when backed by benchmark artifacts:

- token reduction by scenario
- time-to-acceptable-change delta
- duplicate work reduction
- review edit reduction
- context retention gain
- policy violation reduction
- direct token cost savings

### Why Small Companies Care

- They cannot afford unmanaged token spend or heavy platform teams.
- They need AI to reuse existing code and requirements quickly.
- Local-first setup lowers adoption friction and avoids vendor lock-in.
- Benchmark reports justify whether paid AI workflows are worth the spend.

### Why Enterprise Teams Can Trust It

- Local-first source of truth reduces default data exposure.
- Tenant-scoped hosted API and RBAC contracts already exist.
- Policy checks, MCP allowlists, audit events, session security, redaction, and observability are designed in.
- Enterprise features are labeled future unless implemented.

### MVP Now

MVP now means:

- TypeScript/JavaScript local repo memory
- durable local cache and graph snapshot v2
- document memory and doc-to-code links
- context packs with budget/citations/reuse/policies
- local MCP tools
- benchmark evidence bundles and observed capture
- basic website/portal/admin visibility

### Future Platform

Future platform means:

- team workspace with shared graph and multi-repo memory
- SSO/SAML, advanced RBAC, audit retention, private deployment
- policy packs and governed MCP usage analytics
- design-partner benchmark corpus and sales-grade ROI reports
- billing/CRM integrations through adapters, not custom sprawl

## 3. Replanned Story Map

Status scale: `Done`, `Partial`, `Not Started`, `Blocked`.

### Epic 1: Clean Local MVP Foundation

| Story ID | User story | Persona | Problem solved | Business value | Technical value | Acceptance criteria | Function/API list affected | Package/app affected | Tests required | Docs required | Security considerations | Priority | Status | Dependencies | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| LMVP-01 | As an engineer, I can initialize, diagnose, scan, and pack context in under 10 minutes. | Engineer | Adoption friction. | Faster trial and design partner success. | Validates local-first flow. | `heart init`, `doctor`, `scan`, `overview`, `pack` work on sample and real TS repo; human output shows next command; JSON deterministic. | CLI handlers, config, doctor, workspace, context compiler. | `packages/cli`, `packages/core`, `packages/context-compiler`. | CLI contract and smoke tests. | README, CLI spec, quickstart. | Do not print secrets or absolute user paths in shared docs. | P0 | Done | Existing CLI. | New-user flow is documented, tested, and surfaced through `heart doctor` first-run state. |
| LMVP-02 | As an engineer, generated/vendor paths never pollute memory. | Engineer | Bad context from noise. | Trust in first scan. | Stable ignore/provenance contract. | Default and config ignores apply to parser, docs, graph, diagrams, packs; repeated scans stable. | `resolveProjectIgnorePaths`, `scanSourceTree`, `scanDocumentTree`, workspace cache. | `packages/core`, `parser-ts`, `document-ingest`. | Ignore/default tests and repeated scan tests. | Architecture and CLI spec. | Avoid indexing secrets in generated artifacts. | P0 | Done | None. | Existing tests pass and docs state defaults. |
| LMVP-03 | As a maintainer, project contracts are visible and versioned. | Maintainer | Agents duplicate schemas. | Lower maintenance risk. | Schema versioning and cache compatibility. | Graph, context, diagram, doc, benchmark artifacts declare schema versions and validation tests. | shared schemas, snapshot, pack validator, manifest writers. | `packages/shared-schema`, `graph`, `context-compiler`, `diagram-generator`, `document-ingest`, `benchmark`. | Contract tests. | Architecture/blueprint. | Redaction defaults included in contract. | P0 | Done | LMVP-02. | All core artifact contracts covered by tests. |
| LMVP-04 | As a contributor, I can see what is current, planned, and deferred. | Human/AI agent | Planning drift. | Faster continuation. | Living status docs. | `docs/10` links to status; decision log and planning changelog exist; this plan identifies next stories. | Docs only. | `docs/*`. | Link/check build optional. | User stories, decisions, changelog. | Avoid unsupported roadmap claims. | P0 | Done | This doc. | Docs identify current status, decisions, planning changes, and the next backlog. |

### Epic 2: Durable Repo Memory

| Story ID | User story | Persona | Problem solved | Business value | Technical value | Acceptance criteria | Function/API list affected | Package/app affected | Tests required | Docs required | Security considerations | Priority | Status | Dependencies | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DRM-01 | As an agent, I can inspect a typed graph with evidence. | AI agent | Import-only reasoning. | Better task quality. | Rich graph v2. | Nodes/edges include confidence/source/provenance; deps/impact include imports, calls, tests, docs, policies. | `buildProjectGraph`, `snapshotProjectGraph`, `createDependencyExplanation`, `createImpactAnalysis`. | `packages/graph`, `parser-ts`. | Parser graph tests. | Architecture. | Redact local roots from snapshots. | P0 | Done | LMVP-03. | Query output is deterministic and compact. |
| DRM-02 | As a tech lead, policies and decisions constrain context. | Tech lead | AI ignores architecture intent. | Less review cleanup. | Documents/decisions become graph evidence. | Requirement/decision docs link to modules/files; constraints appear in context citations. | `buildHeartModel`, graph document links, context citations. | `entity-linker`, `graph`, `context-compiler`. | Entity/context tests. | Architecture and user stories. | Restricted docs remain redacted. | P0 | Done | DRM-01. | Doc-to-code and decision-to-implementation evidence is inspectable. |
| DRM-03 | As a team, repo memory can track freshness and stale state. | Team lead | Agents may use stale memory. | More trust in repeated use. | Readiness and provenance as first-class signals. | Cache/provenance/readiness show config, policy, cache, parser, docs, generated-noise status. | `createWorkspaceReadinessSummary`, storage, doctor. | `packages/core`. | Workspace storage/CLI tests. | CLI spec. | Avoid absolute path leaks in published evidence. | P0 | Done | LMVP-02. | Readiness is in doctor, overview, MCP overview, benchmark evidence. |
| DRM-04 | As a future team workspace, repo memory should support multi-repo references. | Platform owner | Single-repo limit. | Team platform path. | Multi-repo graph boundary. | Design only: define repo identity, cross-repo edge model, tenant boundary, storage migration. | Proposed `linkWorkspaceRepositories`, graph storage adapters. | `packages/graph`, `services/api`. | Design contract tests later. | Architecture decision. | Tenant isolation required. | P2 | Not Started | DRM-01. | ADR accepted, no code until team workspace priority. |

### Epic 3: Context Pack and MCP Workflow

| Story ID | User story | Persona | Problem solved | Business value | Technical value | Acceptance criteria | Function/API list affected | Package/app affected | Tests required | Docs required | Security considerations | Priority | Status | Dependencies | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CMCP-01 | As an AI agent, I get a compact pack with evidence before coding. | AI agent | Broad repo scans waste tokens. | Lower AI cost. | Stable context pack v2. | Pack has budget, citations, reuse, docs, graph context, tests, policies, risks, warnings, confidence. | `compileContextPack`, `validateContextPackContract`. | `packages/context-compiler`. | Context pack tests. | MCP/CLI spec. | Redact sensitive docs. | P0 | Done | DRM-01. | Pack contract stable and tested. |
| CMCP-02 | As an AI client, MCP tells me what tool to call next. | AI agent | Agents over-scan. | Token savings. | `agent_contract` guides follow-ups. | `should_scan_repo_wide` only true for low evidence/truncation; follow-ups respect allowlist. | `createContextPackAgentContract`, `createToolRegistry`, `handleToolCall`. | `packages/mcp-server`. | MCP tests. | MCP spec. | Disabled tools rejected. | P0 | Done | CMCP-01. | MCP responses are compact JSON-only. |
| CMCP-03 | As an AI agent, I can ask for docs with either `document_search` or `docs_search`. | AI agent | Tool naming mismatch. | Better compatibility. | Alias without duplicate logic. | Enabling either exposes both; both dispatch same result; disabled calls fail. | `KNOWN_MCP_TOOL_NAMES`, `resolveEnabledMcpTools`, `handleToolCall`. | `packages/core`, `mcp-server`. | Config/MCP tests. | MCP spec. | Allowlist still enforced. | P0 | Done | CMCP-02. | Alias tested in registry and stdio. |
| CMCP-04 | As an AI agent, I can query benchmark readiness over MCP. | AI agent | ROI context unavailable to agent. | Benchmark-aware implementation choices. | Compact benchmark status tool. | `benchmark_summary` returns latest reports, measurement mode, evidence availability, top ROI metrics, no raw artifacts. | `benchmark_summary`, `createBenchmarkSummary`, MCP registry. | `packages/mcp-server`, `benchmark`, `core`. | MCP contract tests. | MCP spec and benchmark docs. | Never return raw prompts/patches/secrets. | P1 | Done | BRP-01. | Tool available, allowlisted, compact, and tested. |

### Epic 4: Docs / Business Requirements / Spec Sync

| Story ID | User story | Persona | Problem solved | Business value | Technical value | Acceptance criteria | Function/API list affected | Package/app affected | Tests required | Docs required | Security considerations | Priority | Status | Dependencies | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DBS-01 | As a product owner, latest agreed requirements are recorded before coding. | Product owner | Lost business context. | Less rework. | Planning docs become source of truth. | Decision log and planning changelog exist; stories link to decisions; changes have acceptance criteria. | `normalizePlanningChangeRequest`, `validatePlanningChangeRequest`, `renderPlanningChangeRequestMarkdown`. | `packages/core`, `docs/*`. | Planning change-request tests. | `DECISIONS.md`, `CHANGELOG-PLANNING.md`, `CHANGE_REQUESTS.md`, `10-user-stories.md`. | Avoid customer data and redact secret-like planning text. | P0 | Done | None. | Change-request schema, markdown renderer, template, docs, and redaction tests exist. |
| DBS-02 | As an engineer, web-submitted docs appear in local memory. | Engineer | Stale docs in agent context. | Business intent reaches code work. | Local-first doc sync. | `heart docs sync-web` imports matching profile docs; next scan/search/pack sees them; restricted content redacted. | `pullWebDocumentSubmissions`, `scanDocumentTree`, `findRelevantDocuments`. | `document-sync`, `document-ingest`, `cli`, `services/api`. | Document sync and CLI tests. | CLI spec. | Profile isolation and redaction. | P0 | Done | DRM-03. | Round-trip tested. |
| DBS-03 | As a team, I can see stale docs/specs and code links. | Team lead | Requirements drift. | Fewer wrong AI changes. | Docs status model. | Portal shows latest docs, stale docs, linked modules, decisions, sensitivity, next sync action. | `buildDocumentStatusSummary`; existing document APIs. | `document-sync`, `apps/portal`, `apps/admin`, `services/api`. | UI helper and API tests. | User stories and architecture. | Restricted docs never expose body. | P1 | Partial | DBS-02. | Portal/admin docs status shows queued updates, stale/restricted/linked counts, and local-first next actions; richer decision drift remains future work. |
| DBS-04 | As an agent, context packs explain business requirement linkage. | AI agent | Code context lacks why. | Better requirement alignment. | Requirement-to-code citations. | Relevant docs include citations, lineage, linked module/file evidence, freshness, and sensitivity status. | Context citation generation, entity linker. | `context-compiler`, `entity-linker`, `document-ingest`. | Context/entity tests. | Architecture. | Redact restricted summaries. | P0 | Done | DRM-02. | Pack has doc evidence where relevant. |

### Epic 5: CLI Developer Experience

| Story ID | User story | Persona | Problem solved | Business value | Technical value | Acceptance criteria | Function/API list affected | Package/app affected | Tests required | Docs required | Security considerations | Priority | Status | Dependencies | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CLIDX-01 | As a new user, I can run a guided first-run command. | Engineer | Setup uncertainty. | Higher activation. | Encodes happy path. | `heart doctor` shows exact commands and current completion state. | `createFirstRunChecklist`, CLI doctor output. | `packages/cli`, `core`. | CLI contract tests. | README and CLI spec. | No shell execution without user action. | P0 | Done | LMVP-01. | New user can see progress through init/doctor/scan/overview/pack/mcp serve. |
| CLIDX-02 | As a script user, CLI failures are predictable. | Engineer/CI | Automation breaks on ambiguous exit. | Trust in automation. | Stable exit codes. | Unknown flags exit 2; not-found exits 3; invalid typed flags fail clearly; JSON stdout has no prose. | `parseArgs`, `validateAllowedFlags`, handlers. | `packages/cli`. | CLI contract tests. | CLI spec. | Error messages avoid secrets. | P0 | Done | None. | Tests cover core failure paths. |
| CLIDX-03 | As an engineer, MCP connect works with common local clients. | Engineer | Agent wiring friction. | Faster adoption. | Config adapters. | Detect/install/verify/doctor support Cursor, Claude Code, Continue, Ollama, LM Studio; writes allowlisted paths. | `detectConnections`, `buildInstallPlan`, `installConnection`, `verifyConnection`. | `packages/connect`, `cli`. | Connect tests. | CLI spec. | Allowlist config writes; no token capture. | P0 | Done | CMCP-02. | Dry-run and verify tested. |
| CLIDX-04 | As a maintainer, packaged CLI works outside monorepo. | Maintainer | Publish risk. | Real install path. | Bundled CLI artifact. | `beheart` tarball exposes `heart`; connect entries point to installed CLI. | build scripts, CLI dist. | `packages/cli`, `scripts`. | CLI package test. | README. | Package must not include secrets. | P0 | Done | LMVP-01. | Tarball install test passes. |

### Epic 6: Web UI / Portal UX

| Story ID | User story | Persona | Problem solved | Business value | Technical value | Acceptance criteria | Function/API list affected | Package/app affected | Tests required | Docs required | Security considerations | Priority | Status | Dependencies | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WUX-01 | As a prospect, I understand what BeHeart does and how to try it. | Prospect | Generic AI landing page risk. | More trials. | Website narrative. | First screen explains durable project memory and local trial path; commands copyable; claims are evidence-labeled. | Website pages/components. | `apps/website`. | Build and web surface tests. | README, website docs. | Do not overclaim savings. | P0 | Done | Product positioning. | Website has local-first onboarding, copyable commands, evidence-labeled proof language, and design-partner pilot flow. |
| WUX-02 | As a customer, I can inspect repo memory health. | Engineer/lead | Memory trust unclear. | More adoption. | Portal readiness UI. | Repo overview shows readiness, graph nodes, docs, diagrams, benchmarks, empty/loading/error/success. | Portal profile/repository services components. | `apps/portal`, `services/api`. | Web/API tests. | Enterprise platform docs. | Tenant-scoped only. | P0 | Partial | DRM-03. | Portal repo overview answers "can I trust this memory?" |
| WUX-03 | As a user, I can preview a context pack before giving it to an agent. | Engineer | Pack is invisible outside CLI. | Higher trust. | UI for context contract. | Portal accepts task input, shows files/docs/citations/tokens/risks, model presets, command examples, and no raw sensitive content. | Repository services context preview view. | `apps/portal`, `services/api`. | UI/API tests. | CLI/MCP spec and portal docs. | Redact restricted docs and no arbitrary repo path execution from hosted UI. | P1 | Done | CMCP-01. | Synced-artifact preview exists, includes local-first command box/model selector, and routes final pack generation to local `heart pack`; future work can add saved pack history. |
| WUX-04 | As an internal operator, I can support customers without seeing customer secrets. | Support/admin | Support risk. | Enterprise credibility. | Admin control plane. | Admin shows support, customers, benchmarks, sessions, audit, observability with redacted payloads. | Admin components and service routes. | `apps/admin`, `services/api`. | Enterprise and session tests. | Enterprise platform docs. | Internal RBAC and redaction. | P1 | Partial | Tenant API. | Admin support flow has least-privilege states and audit events. |

### Epic 7: Benchmark and ROI Proof

| Story ID | User story | Persona | Problem solved | Business value | Technical value | Acceptance criteria | Function/API list affected | Package/app affected | Tests required | Docs required | Security considerations | Priority | Status | Dependencies | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BRP-01 | As a manager, benchmark claims trace to evidence. | Manager | ROI feels hand-wavy. | Sales/design partner proof. | Evidence bundle v2. | Bundle has provider/model/task/run IDs/repo snapshot/artifact list/readiness/provenance; hosted artifact sanitized. | `writeBenchmarkEvidenceBundle`, `prepareBenchmarkReportArtifact`, storage. | `packages/benchmark`, `services/api`. | Benchmark/service tests. | Benchmark docs. | Raw artifacts local-first and sanitized before sync. | P0 | Done | CMCP-01. | Evidence manifests v2 tested. |
| BRP-02 | As a reviewer, observed comparisons are fair. | Manager/tech lead | Misleading benchmark reports. | Credible ROI. | Run validation. | Baseline and assisted run IDs required together; modes/scenario/provider/model/status/coverage align; incomplete observed runs rejected. | CLI observed run validation, LLM proxy capture. | `packages/cli`, `services/api`, `benchmark`. | CLI and LLM proxy tests. | Benchmark docs. | Subprocess execution is explicit local action. | P0 | Done | BRP-01. | Bad observed pair fails clearly. |
| BRP-03 | As a sales engineer, I can run a design-partner benchmark suite. | Sales engineer | Fixture-only proof. | Pilot conversion. | Scenario catalog. | Add 5 scenario types: bug fix, feature addition, duplicate refactor, cross-module, document-required; each has rubric and expected evidence. | Scenario/dataset manifests, runner, `listDesignPartnerScenarios`. | `benchmarks/*`, `packages/benchmark`. | Benchmark fixture tests. | Benchmark framework. | No customer data in repo fixtures. | P0 | Done | BRP-01. | Five-type local catalog exists and runs through `heart benchmark run --all`; customer-calibrated pilot data remains future work. |
| BRP-04 | As a portal user, I see ROI history and evidence quality. | Manager/finance | ROI not visible over time. | Expansion proof. | Trend digest and UI. | Portal/admin list trend, measurement mode, evidence confidence, top repo/scenario, artifact availability. | `buildBenchmarkTrendDigest`, dashboard helpers, API routes. | `benchmark`, `apps/portal`, `apps/admin`, `services/api`. | Trend/UI/API tests. | Benchmark framework docs. | Tenant-scoped reports only. | P1 | Done | BRP-01. | Trend digest now reports evidence quality, measurement-mode counts, artifact availability, top repo/scenario, and portal/admin panels surface the signal. |

### Epic 8: Governance, Security, and Enterprise Readiness

| Story ID | User story | Persona | Problem solved | Business value | Technical value | Acceptance criteria | Function/API list affected | Package/app affected | Tests required | Docs required | Security considerations | Priority | Status | Dependencies | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GSE-01 | As a tech lead, repo policies guide AI changes. | Tech lead | Architecture drift. | Less review cleanup. | Policy engine. | Repo-local policies loaded/validated; CLI/MCP report violations; doctor shows status. | `loadPolicyRules`, `evaluatePolicyViolations`, CLI/MCP. | `policy-engine`, `core`, `cli`, `mcp-server`. | Policy/CLI/MCP tests. | CLI spec. | Avoid raw sensitive paths in published reports. | P0 | Done | LMVP-02. | Invalid policy fails visibly. |
| GSE-02 | As a security reviewer, secrets are not exposed by memory artifacts. | Security reviewer | Context leakage. | Design partner trust. | Redaction and path sanitization. | Sensitive docs redacted; graph/benchmark published artifacts strip absolute roots; tests include secret-like content. | `validatePublishedArtifactSafety`, redaction helpers, artifact serializers. | `document-ingest`, `graph`, `benchmark`, `services/api`. | Security/redaction tests. | Security docs. | Never log credentials/tokens. | P0 | Done | DBS-02. | Published benchmark artifacts have cross-artifact safety tests and unsafe benchmark reports are refused before publish; broader shared sanitizer can evolve separately. |
| GSE-03 | As an org admin, access is tenant-scoped. | Org admin | Cross-tenant leakage. | Enterprise trust. | RBAC/access layer. | Portal/admin APIs filter by actor membership; sessions hashed/redacted; CSRF required for cookie writes. | Access/session/write routes. | `services/api`, `shared-schema`, apps. | Service access/session tests. | Enterprise platform. | Least privilege. | P0 | Partial | Hosted API. | Security docs and production threat model complete. |
| GSE-04 | As an enterprise buyer, I can review deployment/security posture. | Enterprise buyer | Procurement blocker. | Sales readiness. | Security package. | Publish data flow, local-first mode, hosted mode, auth, RBAC, audit, retention, subprocess execution, deployment options, limitations. | Security docs and website docs. | `docs/*`, `apps/website`. | Website docs/build validation. | `docs/25-security-overview.md`, `docs/26-production-threat-model-retention.md`. | No unsupported compliance claims. | P1 | Done | GSE-02. | Security packet now includes production threat model, retention/export plan, deployment posture, and buyer-safe language limits. |

### Epic 9: Team Workspace Future

| Story ID | User story | Persona | Problem solved | Business value | Technical value | Acceptance criteria | Function/API list affected | Package/app affected | Tests required | Docs required | Security considerations | Priority | Status | Dependencies | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TWF-01 | As a team, shared memory is visible in one workspace. | Org admin | Local-only collaboration limit. | Team plan value. | Workspace model. | Workspace identity, repo profile, docs, benchmarks, members, roles visible and tenant-scoped. | Existing workspace APIs and UI. | `services/api`, `apps/portal`. | Enterprise/API tests. | Enterprise platform. | Tenant isolation. | P2 | Partial | GSE-03. | Shared workspace MVP works for guided pilots. |
| TWF-02 | As a platform owner, shared graph storage is optional and safe. | Platform owner | Multi-user graph sharing. | Team/enterprise path. | Storage adapter boundary. | ADR defines local cache vs shared graph store, migration, access controls, invalidation. | Proposed graph storage adapter. | `graph`, `core`, `services/api`. | Contract tests later. | ADR. | Per-tenant encryption/access. | P2 | Not Started | TWF-01. | Decision made before implementation. |
| TWF-03 | As an enterprise admin, SSO/SAML and audit retention are configurable. | Enterprise admin | Procurement gap. | Enterprise license path. | Provider adapters. | Auth provider adapters hardened; SSO/SAML plan; audit retention/export settings documented. | Auth/session/observability. | `services/api`, apps. | Auth/security tests. | Security runbook. | Sensitive auth data never exposed. | P2 | Partial | GSE-03. | Enterprise controls are coherent and tested. |

### Epic 10: Customer Adoption and Design Partner Flow

| Story ID | User story | Persona | Problem solved | Business value | Technical value | Acceptance criteria | Function/API list affected | Package/app affected | Tests required | Docs required | Security considerations | Priority | Status | Dependencies | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CADP-01 | As a design partner, I can try the product with clear scope and support. | Design partner | Pilot ambiguity. | Better conversion. | Repeatable onboarding. | Pilot offer, setup guide, expected commands, data boundaries, benchmark plan, support channel, success criteria. | Docs/UI. | `docs`, `apps/website`. | Docs/website build. | README, pricing, launch checklist. | No unsupported claims. | P0 | Done | LMVP-01, BRP-03. | Website and SMB checklist now describe a one-repo local-first pilot with benchmark evidence and sanitized sync boundaries. |
| CADP-02 | As a buyer, I understand price vs saved waste. | SMB buyer | Unclear ROI. | Paid conversion. | Pricing narrative. | Pricing page frames current local MVP, design partner pilot, and future enterprise scope with benchmark caveats and pilot CTA. | Website pricing/services. | `apps/website`, docs. | Website build. | GTM/pricing docs. | Claims must cite benchmark evidence. | P1 | Done | BRP-03. | Pricing narrative now uses evidence gates, buyer math, current/future scope labels, and benchmark caveats. |
| CADP-03 | As founder/operator, I can triage intake and benchmark-backed prospects. | Internal operator | Manual GTM chaos. | Faster follow-up. | Admin intake and customer health. | Intake, customers, benchmarks, revenue, support queues show design partner status and next action. | Admin/API views. | `apps/admin`, `services/api`. | Admin/API tests. | Enterprise platform docs. | Admin-only access. | P1 | Partial | GSE-03. | Design partner pipeline is operable. |

## 4. Complete Function/API Inventory

| Area | Package/App/File | Function/API/Command/UI Flow | Exists? | Purpose | Inputs | Outputs | Used By | Story IDs | Notes |
|---|---|---|---|---|---|---|---|---|---|
| CLI | `packages/cli/src/index.js` | `heart init` | Yes | Create/repair local config and policy scaffold. | `--root`, `--force`, `--json`. | Scaffold report, detected environment, next commands. | Engineers. | LMVP-01, CLIDX-01 | Writes `heart.config.yaml` and `.heart/policies.yaml`. |
| CLI | `packages/cli/src/index.js` | `heart doctor` | Yes | Preflight config, policy, parser, cache, docs, MCP. | `--root`, `--json`. | Readiness report, warnings, actions. | Engineers, agents. | LMVP-01, DRM-03 | Should anchor first-run flow. |
| CLI | `packages/cli/src/index.js` | `heart scan` | Yes | Build/reuse local workspace state. | `--root`, `--rebuild`, `--json`. | Cache status, counts, heart model summary. | Engineers, benchmarks. | LMVP-01, DRM-03 | Persists `.heart/cache/workspace-state.json`. |
| CLI | `packages/cli/src/index.js` | `heart overview` | Yes | Summarize repo memory. | `--root`, `--json`. | Overview plus readiness. | Engineers, MCP parity. | LMVP-01, DRM-03 | Useful smoke command. |
| CLI | `packages/cli/src/index.js` | `heart find symbol` | Yes | Find symbols by name. | query, `--root`, `--json`. | Matches array. | Engineers, agents. | DRM-01 | Empty match exits 0. |
| CLI | `packages/cli/src/index.js` | `heart deps` | Yes | Explain dependency relationships. | target, `--root`, `--json`. | Dependency explanation or not_found. | Engineers, agents. | DRM-01 | Missing target exits 3. |
| CLI | `packages/cli/src/index.js` | `heart impact` | Yes | Estimate blast radius. | target, `--root`, `--json`. | Impact report or not_found. | Engineers, agents. | DRM-01 | Missing target exits 3. |
| CLI | `packages/cli/src/index.js` | `heart policy check` | Yes | Evaluate repo policy. | `--root`, `--json`. | Policy report. | Engineers, agents. | GSE-01 | Uses repo-local policies. |
| CLI | `packages/cli/src/index.js` | `heart docs search` | Yes | Search document memory. | query, `--root`, `--json`. | Relevant docs. | Engineers, agents. | DBS-02 | Latest lineage preferred. |
| CLI | `packages/cli/src/index.js` | `heart docs import` | Yes | Import local doc into Heart memory. | source, slug/title/category/summary, roots. | Imported path and sync report. | Engineers. | DBS-02 | Writes `.heart/imported-documents`. |
| CLI | `packages/cli/src/index.js` | `heart docs sync-web` | Yes | Pull portal/admin submitted docs into local repo. | `--slug`, roots. | Import/sync report. | Engineers. | DBS-02 | Profile isolated. |
| CLI | `packages/cli/src/index.js` | `heart pack` | Yes | Compile task context pack. | task, `--token-budget`, `--root`, `--json`. | Context pack v2. | AI workflows. | CMCP-01 | Positive token budget enforced. |
| CLI | `packages/cli/src/index.js` | `heart mcp tools` | Yes | List effective MCP registry. | `--root`, `--json`. | Enabled/disabled tools and schemas. | Engineers, connect verify. | CMCP-02, CMCP-03 | Respects aliases. |
| CLI | `packages/cli/src/index.js` | `heart mcp serve` | Yes | Run stdio MCP server. | `--root`. | JSON-RPC stream. | MCP clients. | CMCP-02 | Local-first runtime. |
| CLI | `packages/cli/src/index.js` | `heart connect detect` | Yes | Detect agent clients/model runtimes. | `--agents`, `--models`, `--root`, `--json`. | Inventory. | Engineers. | CLIDX-03 | Cursor, Claude Code, Continue, Ollama, LM Studio. |
| CLI | `packages/cli/src/index.js` | `heart connect install` | Yes | Install MCP config. | `--client`, `--scope`, `--model`, `--dry-run`, `--backup`. | Plan or verification. | Engineers. | CLIDX-03 | Writes allowlisted paths. |
| CLI | `packages/cli/src/index.js` | `heart connect verify` | Yes | Verify configured MCP client. | `--client`, `--scope`, `--root`, `--json`. | Verification status. | Engineers. | CLIDX-03 | Performs stdio handshake. |
| CLI | `packages/cli/src/index.js` | `heart connect doctor` | Yes | Diagnose connect readiness. | `--root`, `--json`. | Actions/status. | Engineers. | CLIDX-03 | Human output concise. |
| CLI | `packages/cli/src/index.js` | `heart diagram generate` | Yes | Generate Mermaid diagrams. | type/task/target/root/json. | Diagram bundle and artifacts. | Reviewers. | WUX-02 | Manifest v2. |
| CLI | `packages/cli/src/index.js` | `heart diagram sync` | Yes | Publish profile/diagrams/docs to surfaces. | slug, portal/admin roots. | Sync report. | Portal/admin. | WUX-02 | Local artifact sync. |
| CLI | `packages/cli/src/index.js` | `heart benchmark run` | Yes | Run one scenario or suite. | scenario, `--all`, run IDs, provider/model. | Report, evidence bundle, sync report. | Managers. | BRP-01, BRP-02 | Observed pair validation. |
| CLI | `packages/cli/src/index.js` | `heart benchmark capture` | Yes | Capture baseline/assisted agent run through proxy. | mode, scenario, upstream URL, command, pricing. | Agent run capture artifact. | Benchmark runner. | BRP-02 | Explicit local command execution. |
| CLI | `packages/cli/src/index.js` | `heart benchmark compare` | Yes | Compare two benchmark JSON inputs. | baseline json, assisted json. | Report and evidence bundle. | Managers. | BRP-01 | Useful for manual fixtures. |
| CLI | `packages/cli/src/index.js` | `heart agent run` | Yes | Launch arbitrary command through proxy. | mode/scenario/dataset/upstream/pricing/command. | Run telemetry. | Benchmarks. | BRP-02 | Needs clear security caveat in docs. |
| CLI | `packages/cli/src/index.js` | `heart service export` | Yes | Export canonical service snapshot. | `--root`, `--out`, `--json`. | Snapshot path/table counts. | Ops/migration. | TWF-01 | For hosted migration. |
| CLI | `packages/cli/src/index.js` | `heart sync profile/docs/benchmark` | Yes | Push sanitized artifacts to hosted API. | URL, session, root, slug, workspace/customer. | Remote sync result. | Hosted surfaces. | TWF-01, BRP-04 | Requires session. |
| CLI | `packages/cli/src/index.js` | `heart auth provider-session` | Yes | Exchange provider token for hosted session. | URL, provider, id token, workspace/customer. | Session. | Hosted sync users. | TWF-01 | Sensitive. |
| CLI internals | `packages/cli/src/index.js` | `runCli` | Yes | Main dispatcher. | argv, IO. | Exit code. | CLI binary/tests. | CLIDX-02 | External contract. |
| CLI internals | `packages/cli/src/index.js` | `parseArgs`, `validateAllowedFlags`, `parseFlagValue` | Yes | Parse and validate flags. | argv tokens. | Parsed command/errors. | CLI. | CLIDX-02 | Unknown flags fail. |
| CLI internals | `packages/cli/src/index.js` | `executeAgentRunCapture` | Yes | Start proxy and command, persist telemetry. | run metadata, command. | run/proxy/command/summary. | Benchmark capture. | BRP-02 | Security-sensitive subprocess. |
| CLI HTTP | `packages/cli/src/http-client.js` | Remote sync helpers | Yes | Call hosted service. | base URL/session/artifacts. | API result. | CLI sync/auth. | TWF-01 | Must avoid token logging. |
| MCP | `packages/mcp-server/src/tools.js` | `project_overview` | Yes | Repo summary, memory profile, workflow hints. | empty. | Overview/readiness/workflow. | Agents. | DRM-03, CMCP-02 | Compact JSON. |
| MCP | `packages/mcp-server/src/tools.js` | `context_pack` | Yes | Task context pack with agent contract. | task, token_budget. | Pack v2 plus agent_contract. | Agents. | CMCP-01, CMCP-02 | Main product wedge. |
| MCP | `packages/mcp-server/src/tools.js` | `symbol_lookup` | Yes | Find symbols. | query. | Matches. | Agents. | DRM-01 | Compact. |
| MCP | `packages/mcp-server/src/tools.js` | `dependency_explain` | Yes | Explain target relationships. | target. | Dependency report. | Agents. | DRM-01 | Mentioned in docs though not user list. |
| MCP | `packages/mcp-server/src/tools.js` | `impact_analysis` | Yes | Blast radius. | target. | Impact report. | Agents. | DRM-01 | Compact. |
| MCP | `packages/mcp-server/src/tools.js` | `policy_check` | Yes | Policy report. | empty. | Violations/rules. | Agents. | GSE-01 | Uses repo-local policies. |
| MCP | `packages/mcp-server/src/tools.js` | `document_search` | Yes | Search document memory. | query. | Matches. | Agents. | DBS-02 | Primary name. |
| MCP | `packages/mcp-server/src/tools.js` | `docs_search` | Yes | Alias for document search. | query. | Matches. | Agents. | CMCP-03 | Alias compatibility. |
| MCP | `packages/mcp-server/src/tools.js` | `benchmark_summary` | Yes | Compact latest benchmark/ROI state. | optional repo/scenario/filter. | Evidence summary, confidence, latest reports. | Agents. | CMCP-04 | Does not return raw artifacts or absolute benchmark paths. |
| MCP transport | `packages/mcp-server/src/stdio.js` | `createStdioMcpServer`, `startStdioServer` | Yes | MCP stdio JSON-RPC server. | repoRoot, streams. | Server loop. | CLI `mcp serve`. | CMCP-02 | Protocol tests exist. |
| MCP registry | `packages/mcp-server/src/tools.js` | `createToolRegistry`, `handleToolCall`, `createToolCallResult` | Yes | Tool schema, dispatch, response format. | enabled tools, workspace state. | MCP tool results. | CLI/MCP. | CMCP-02 | Allowlist enforced. |
| Config | `packages/core/src/config.js` | `loadHeartConfig` | Yes | Parse and validate config. | repo root. | config state. | Core/doctor/CLI/MCP. | LMVP-02 | Strict schema. |
| Config | `packages/core/src/config.js` | `resolveDocumentRoots` | Yes | Resolve doc roots. | config. | root list. | Workspace/docs. | DBS-02 | Adds `.heart/imported-documents`. |
| Config | `packages/core/src/config.js` | `resolveProjectIgnorePaths`, `resolveEnabledMcpTools` | Yes | Effective ignores and MCP tools. | config values. | normalized arrays. | Core/CLI/MCP. | LMVP-02, CMCP-03 | Alias expansion. |
| Core | `packages/core/src/workspace.js` | `buildWorkspaceState` | Yes | Assemble scan, docs, graph, heart model, policy, readiness. | repoRoot/options. | Workspace state. | CLI/MCP/diagram/benchmark. | DRM-03 | Main local memory builder. |
| Core | `packages/core/src/workspace.js` | `createWorkspaceReadinessSummary` | Yes | Reusable truth/readiness contract. | config/policy/cache/parser/docs. | readiness object. | Doctor/overview/MCP/benchmarks. | DRM-03 | Stable JSON. |
| Core storage | `packages/core/src/storage.js` | cache load/save helpers | Yes | Persist workspace state and graph snapshot. | repoRoot/state. | cache hit/update/stale. | Workspace. | DRM-03 | Schema version 5 currently in cache provenance. |
| Doctor | `packages/core/src/doctor.js` | `runWorkspaceDoctor` | Yes | Preflight diagnostics. | repo root. | doctor report. | CLI. | LMVP-01 | Human next actions. |
| Planning | `packages/core/src/planning.js` | `createPlanningChangeRequestId`, `normalizePlanningChangeRequest`, `validatePlanningChangeRequest`, `renderPlanningChangeRequestMarkdown` | Yes | Keep latest-agreed requirement and scope changes structured before implementation. | change request fields. | normalized request, validation result, markdown. | Docs process, future registry. | DBS-01 | Redacts secret-like planning text. |
| Environment | `packages/core/src/environment.js` | `detectProjectEnvironment` | Yes | Detect language/runtime. | repo root. | env metadata. | Init/doctor. | LMVP-01 | No network. |
| Parser | `packages/parser-ts/src/index.js` | `scanSourceTree` | Yes | Discover and parse TS/JS source. | repo root, ignore/options. | scan result. | Core/graph/tests. | DRM-01 | Generated paths ignored. |
| Parser | `packages/parser-ts/src/index.js` | symbol/import/call/route extraction internals | Yes | Extract typed source relations. | source files. | symbols/imports/calls/routes/relations. | Graph. | DRM-01 | Private but tested via public scan. |
| Graph schema | `packages/shared-schema/src/index.js` | `NODE_TYPES`, `EDGE_TYPES`, `GRAPH_SNAPSHOT_SCHEMA_VERSION` | Yes | Canonical graph constants. | none. | constants. | Graph/tests/docs. | LMVP-03 | Includes v2 types. |
| Graph schema | `packages/shared-schema/src/index.js` | `createGraphNode`, `createGraphEdge`, `createGraphSummary` | Yes | Normalize graph records. | node/edge inputs. | graph records/summary. | Graph builder. | DRM-01 | Adds confidence/source/provenance. |
| Graph | `packages/graph/src/index.js` | `buildProjectGraph` | Yes | Build typed graph. | scan result, docs, policy, heart model. | graph. | Core/context/diagrams. | DRM-01, DRM-02 | Adds docs/policies/decisions. |
| Graph | `packages/graph/src/index.js` | `snapshotProjectGraph`, `hydrateProjectGraph`, `diffProjectGraphSnapshots` | Yes | Snapshot, restore, diff graph. | graph/snapshot. | versioned snapshots/diff. | Storage/tests. | LMVP-03 | Snapshot redacts roots. |
| Graph | `packages/graph/src/index.js` | `createProjectOverview` | Yes | Summary/domain overview. | graph, policy, docs, model. | overview. | CLI/MCP/portal. | DRM-03 | Human/agent summary. |
| Graph | `packages/graph/src/index.js` | `searchSymbols` | Yes | Symbol lookup. | graph, query. | matches. | CLI/MCP. | DRM-01 | Deterministic order. |
| Graph | `packages/graph/src/index.js` | `createDependencyExplanation` | Yes | Explain dependencies. | graph, target. | explanation/not_found. | CLI/MCP. | DRM-01 | Includes evidence arrays. |
| Graph | `packages/graph/src/index.js` | `createImpactAnalysis` | Yes | Estimate impact. | graph, target. | impact/not_found. | CLI/MCP. | DRM-01 | Includes tests/risks/evidence. |
| Graph | `packages/graph/src/index.js` | `createCodeGraphView` | Yes | Focused/full graph for UI. | graph/options. | visual graph. | Service repository detail. | WUX-02 | Sanitized paths. |
| Entity linker | `packages/entity-linker/src/index.js` | `buildHeartModel` | Yes | Link symbols/docs/domains/decisions. | scan result, document index. | heart model. | Core/graph/context. | DRM-02 | Relationship counts. |
| Documents | `packages/document-ingest/src/index.js` | `scanDocumentTree` | Yes | Discover and parse docs. | repo root, roots, ignore. | document index. | Core/CLI/context. | DBS-02 | Supports md/mdx/txt/json/yaml/docx/pdf. |
| Documents | `packages/document-ingest/src/index.js` | `findRelevantDocuments` | Yes | Retrieve relevant docs. | index, query, limit. | matches. | CLI/MCP/context. | DBS-02 | Latest lineage and semantic score. |
| Documents | `packages/document-ingest/src/index.js` | `createDocumentOverview` | Yes | Document summary. | document index. | overview. | UI/API future. | DBS-03 | Useful for status. |
| Documents | `packages/document-ingest/src/index.js` | classification/summarization/sensitivity/redaction internals | Yes | Create safe document records. | file content/metadata. | document artifacts. | scan/search/sync. | GSE-02 | Private; tested via ingest. |
| Document sync | `packages/document-sync/src/index.js` | `publishRepositoryDocuments`, `prepareRepositoryDocumentArtifact`, `syncRepositoryDocumentsToSurfaces` | Yes | Publish safe document artifacts. | profile/repo/doc index. | artifact/sync report. | CLI/API/portal/admin. | DBS-02 | Sanitized. |
| Document sync | `packages/document-sync/src/index.js` | `writeWebDocumentSubmission`, `pullWebDocumentSubmissions`, `importLocalDocument` | Yes | Web/local doc import lane. | submission/source/profile. | local imported docs. | CLI/API. | DBS-02 | Profile isolation. |
| Policy | `packages/policy-engine/src/index.js` | `loadPolicyRules`, `evaluatePolicyViolations`, `createDefaultPoliciesYaml` | Yes | Load/evaluate policies. | policy file/scan result. | rules/violations. | Core/CLI/MCP. | GSE-01 | Strict validation. |
| Context | `packages/context-compiler/src/index.js` | `compileContextPack` | Yes | Rank and assemble context pack. | task, graph, docs, heart model, policy, budget. | pack v2. | CLI/MCP/benchmark. | CMCP-01 | Main product contract. |
| Context | `packages/context-compiler/src/index.js` | `validateContextPackContract` | Yes | Validate pack schema. | pack. | valid/errors. | Tests/future consumers. | LMVP-03 | Contract-first. |
| Context | `packages/context-compiler/src/index.js` | ranking/trimming/citation internals | Yes | Score context and fit budget. | pack/evidence. | ranked/trimmed pack. | `compileContextPack`. | CMCP-01 | Keep private unless reused. |
| Diagrams | `packages/diagram-generator/src/index.js` | `generateDiagramBundle`, `writeDiagramBundle`, `resolveDiagramTypes` | Yes | Create and write diagrams. | workspace state/options. | Mermaid artifacts/manifest. | CLI/portal/admin. | WUX-02 | Manifest v2. |
| Diagrams | `packages/diagram-generator/src/index.js` | `syncRepositoryProfile`, `prepareRepositoryProfileArtifact` | Yes | Publish repo profile/diagrams/code graph/docs. | repo/workspace/bundle. | synced artifact. | CLI/sync/services. | WUX-02 | Published artifacts sanitized. |
| Benchmark | `packages/benchmark/src/framework.js` | `loadBenchmarkScenarioManifest`, `loadBenchmarkDatasetManifest`, `listBenchmarkScenarioManifests` | Yes | Load versioned scenarios/datasets. | refs, repo root. | manifests. | CLI/runner. | BRP-03 | Need richer catalog. |
| Benchmark | `packages/benchmark/src/framework.js` | `normalizeBenchmarkRun`, `normalizeEvaluationConfig`, `buildBenchmarkDeltaMetrics` | Yes | Score runs and deltas. | run inputs/eval config. | normalized run/metrics. | Reports. | BRP-01 | Observed/estimated separated. |
| Benchmark | `packages/benchmark/src/framework.js` | `mergeObservedRunIntoBenchmarkInput` | Yes | Apply captured telemetry. | scenario input, observed run. | benchmark input. | CLI observed reports. | BRP-02 | Pair validated by CLI. |
| Benchmark | `packages/benchmark/src/index.js` | `compareBenchmarkRuns`, `runBenchmarkScenario`, `runBenchmarkSuite` | Yes | Build benchmark reports. | baseline/assisted/scenarios. | reports/suite. | CLI. | BRP-01 | v2 report schema. |
| Benchmark | `packages/benchmark/src/index.js` | `writeBenchmarkReport`, `writeBenchmarkSuiteReport` | Yes | Persist report JSON/Markdown. | repo root, report. | paths. | CLI. | BRP-01 | Local-first. |
| Benchmark | `packages/benchmark/src/index.js` | `writeBenchmarkEvidenceBundle` | Yes | Persist evidence bundle v2. | report, inputs, scenario/dataset, provenance/readiness. | bundle manifest and files. | CLI/API/portal. | BRP-01 | Sanitized when published. |
| Benchmark | `packages/benchmark/src/index.js` | `publishBenchmarkReport`, `prepareBenchmarkReportArtifact` | Yes | Publish sanitized benchmark report. | report, roots/storage. | destinations/artifact. | CLI/API. | BRP-04 | Tenant-safe surface storage. |
| Benchmark | `packages/benchmark/src/trends.js` | `buildBenchmarkTrendDigest` | Yes | Summarize report history. | reports. | trend digest with evidence quality, measurement-mode counts, top repo/scenario. | Portal/admin/repository services. | BRP-04 | UI and service integration exists. |
| Connect | `packages/connect/src/*` | `detectAgents`, `detectConnections`, `buildInstallPlan`, `installConnection`, `verifyConnection`, `runConnectDoctor` | Yes | Local AI client integration. | repo/client/scope/model. | inventory/plan/status. | CLI connect. | CLIDX-03 | Allowlisted config writes. |
| Shared enterprise | `packages/shared-schema/src/enterprise.js` | roles, permissions, navigation helpers | Yes | Canonical portal/admin RBAC. | actor/permission/groups. | access/navigation. | API/apps. | GSE-03 | Least privilege. |
| Profile store | `packages/profile-store/src/index.js` | list/load/sanitize profile helpers | Yes | Read synced repository profiles. | surface, slug, roots. | profiles. | apps/tests. | WUX-02 | Shared UI storage. |
| Web render | `packages/web-render/src/index.js` | static HTML render helpers | Yes | Render simple static pages for tests/artifacts. | sections/cards/diagrams. | HTML. | web surface tests. | WUX-01 | Not main Next UI. |
| API | `services/api/src/http.js` | `handleServiceHttpRequest`, `resolveHttpConfig` | Yes | Main hosted API router/config. | Request/options. | Response/config. | Service host/tests. | TWF-01, GSE-03 | Security-sensitive. |
| API endpoint | `services/api/src/index.js` | `/health` | Yes | Health check. | GET. | service status. | Ops/tests. | GSE-04 | Public safe. |
| API endpoint | `services/api/src/index.js` | `/metrics` | Yes | Prometheus metrics. | GET/window. | text metrics. | Ops/admin. | GSE-04 | Avoid sensitive labels. |
| API endpoint | `services/api/src/index.js` | `/api/auth/providers` | Yes | Auth provider list. | GET surface/return_to. | provider metadata. | Website/portal/admin. | TWF-03 | No secrets. |
| API endpoint | `services/api/src/index.js` | `/auth/authorize/:providerId`, `/auth/callback/:providerId` | Yes | OIDC auth flow. | provider/query/callback. | redirect/session. | Hosted auth. | TWF-03 | CSRF/state. |
| API endpoint | `services/api/src/index.js` | `/api/session`, `/api/admin/session` | Yes | Read/issue sessions. | GET/POST. | session/account. | Apps/CLI. | GSE-03 | Hashed tokens. |
| API endpoint | `services/api/src/index.js` | `/api/session/provider`, `/api/admin/session/provider` | Yes | Exchange provider token. | provider id token/workspace/customer. | session. | CLI/auth. | TWF-03 | Sensitive. |
| API endpoint | `services/api/src/index.js` | `/api/account`, `/api/overview`, `/api/usage/summary` | Yes | Portal account/overview/usage. | session/query. | tenant views. | Portal. | WUX-02 | Tenant-scoped. |
| API endpoint | `services/api/src/index.js` | `/api/billing`, `/api/members`, `/api/policies`, `/api/security`, `/api/settings` | Yes | Portal governance/org views. | session. | tenant views. | Portal. | GSE-03 | RBAC. |
| API endpoint | `services/api/src/index.js` | `/api/sessions`, `/api/audit/events` | Yes | Tenant sessions/audit. | session/query. | redacted sessions/events. | Portal security. | GSE-03 | Redaction/CSRF. |
| API endpoint | `services/api/src/index.js` | `/api/workspaces`, `/api/admin/workspaces` | Yes | List/provision workspaces. | session/body. | workspaces/result. | Portal/admin/CLI. | TWF-01 | Tenant-scoped writes. |
| API endpoint | `services/api/src/index.js` | `/api/repositories`, `/api/admin/repositories`, `/:slug` | Yes | List/write/load repo profiles. | session/body/slug. | profiles/detail. | Portal/admin/CLI sync. | WUX-02 | Actor filtering. |
| API endpoint | `services/api/src/index.js` | `/api/documents`, `/api/admin/documents`, `/documents/submissions` | Yes | List/write docs and web submissions. | session/body/query. | document views/submissions. | Portal/admin/CLI sync. | DBS-02, DBS-03 | Redact restricted docs. |
| API endpoint | `services/api/src/index.js` | `/api/benchmarks`, `/api/admin/benchmarks`, `/:reportId` | Yes | List/write/load benchmark reports. | session/body/report id. | benchmark views. | Portal/admin/CLI sync. | BRP-04 | Sanitized evidence. |
| API endpoint | `services/api/src/index.js` | `/api/benchmarks/runs`, `/runs/:launchId` | Yes | Launch/list benchmark runs. | session/body/query. | launch capability/detail. | Portal. | BRP-04 | Local path capability risk. |
| API endpoint | `services/api/src/index.js` | `/proxy/openai/runs/:runId/v1/*` | Yes | OpenAI-compatible telemetry proxy. | OpenAI-compatible request. | upstream response plus telemetry. | Agent run/benchmark capture. | BRP-02 | Do not store raw request bodies by default. |
| API endpoint | `services/api/src/index.js` | `/api/public/intake` | Yes | Website lead intake. | public form. | intake record. | Website/admin. | CADP-01 | Rate limited. |
| API endpoint | `services/api/src/index.js` | `/api/admin/intake`, `/overview`, `/customers/inventory`, `/billing-ops` | Yes | Internal GTM/admin views. | admin session/query. | internal views. | Admin. | CADP-03 | Admin RBAC. |
| API endpoint | `services/api/src/index.js` | `/api/admin/audit/events`, `/sessions`, `/observability/*` | Yes | Internal audit/session/ops. | admin session/query/body. | redacted events/traces/metrics/exports. | Admin. | GSE-03, GSE-04 | Internal-only. |
| API storage | `services/api/src/storage.js` | artifact/session/audit/rate/run/call storage helpers | Yes | Durable service storage. | records/options. | persisted records. | API/CLI/benchmarks. | GSE-03, BRP-02 | SQLite current, Postgres planned. |
| API access | `services/api/src/access.js` | actor/workspace/repo/document/benchmark access helpers | Yes | Tenant-scoped reads. | actor/query. | filtered resources. | HTTP routes. | GSE-03 | Critical isolation boundary. |
| API write access | `services/api/src/write-access.js` | provision/write artifact helpers | Yes | Tenant-scoped writes. | auth context/payload. | persisted result. | HTTP routes. | GSE-03 | Validate actor permissions. |
| API session | `services/api/src/session.js` | session issue/resolve/revoke/rotate/list | Yes | Session lifecycle. | tokens/actor/workspace. | session records. | HTTP/auth. | GSE-03 | Tokens hashed/redacted. |
| API auth | `services/api/src/auth-provider.js`, `oidc-auth.js`, `provider-config.js` | provider session and OIDC helpers | Yes | Hosted auth. | provider config/token/requests. | sessions/redirects. | Website/portal/admin/CLI. | TWF-03 | No client secret exposure. |
| API observability | `services/api/src/observability*.js` | metrics, alerts, exports | Yes | Ops visibility. | traces/events/config. | metrics/alerts/exports. | Admin. | GSE-04 | Avoid sensitive payloads. |
| API benchmark launcher | `services/api/src/benchmark-launcher.js` | runner capability/launch/list/detail | Yes | Portal-driven benchmark run bridge. | workspace/session/payload. | launch records. | Portal/API. | BRP-04 | Local path must be reachable and safe. |
| API migration | `services/api/src/migration.js` | `exportCanonicalSnapshot`, `writeCanonicalSnapshot`, `createPostgresMigrationPlan` | Yes | Service export/migration. | storage root/out. | snapshot/plan. | CLI service export. | TWF-03 | No secrets in export. |
| Website UI | `apps/website/app/page.jsx` and components | Landing/product overview | Yes | Explain product and CTAs. | public route. | page UI. | Prospects. | WUX-01 | Avoid unsupported claims. |
| Website UI | `apps/website/app/docs/*`, `src/docs` | Docs explorer | Yes | Product docs browsing/search. | docs content/query. | catalog/page/search. | Prospects/users. | CADP-01 | Keep docs current. |
| Website UI | `apps/website/app/pricing`, `benchmark`, `security`, `services` | GTM pages | Yes | Pricing, ROI, trust, services narrative. | public routes. | pages. | Prospects. | CADP-02 | Claims evidence-labeled. |
| Website UI | `apps/website/components/LeadCaptureForm.jsx` | Trial/demo intake | Yes | Capture interest. | form. | API submission. | Prospects/admin. | CADP-01 | Rate limit, no secrets. |
| Portal UI | `apps/portal/app/page.jsx`, `PortalOverviewEnterpriseClient` | Workspace overview | Yes | Tenant memory/benchmark posture. | session/API. | overview UI. | Customers. | WUX-02 | Tenant-safe. |
| Portal UI | `apps/portal/app/repositories/*`, profile components | Repo overview screen | Yes | Repo memory health, graph, diagrams, docs. | repo slug/API. | profile UI. | Engineers/leads. | WUX-02 | Empty/error states. |
| Portal UI | `apps/portal/app/documents`, `PortalDocumentsWorkspaceClient` | Docs/spec status screen | Partial | Documents and submissions. | API data. | docs UI. | Customers. | DBS-03 | Shows queued/stale/restricted/linked counts; latest-agreed workflow remains future. |
| Portal UI | `apps/portal/app/benchmarks/*`, benchmark components | Benchmark ROI dashboard/detail | Yes | ROI and evidence detail. | reports/API. | benchmark UI. | Managers. | BRP-04 | Sanitized evidence only. |
| Portal UI | `apps/portal/app/policies`, `security`, `team-access`, `settings` | Governance screens | Yes | Policies/security/team controls. | tenant API. | governance UI. | Org admins. | GSE-03 | RBAC. |
| Portal UI | `PortalRepositoryServicesWorkspace`, `repository-services.js` | Context pack preview | Yes | Preview pack before agent use. | task/synced artifacts. | pack preview. | Engineers. | WUX-03 | Includes model presets, command examples, and local-first final generation. |
| Admin UI | `apps/admin/app/page.jsx`, overview components | Internal control plane overview | Yes | Internal account/ops view. | admin API. | admin overview. | BeHeart operators. | CADP-03 | Internal RBAC. |
| Admin UI | customers/support/revenue/billing pages | Customer and GTM operations | Yes | Pipeline/customer support/revenue. | admin API. | tables/cards. | Operators. | CADP-03 | Admin-only. |
| Admin UI | benchmarks/documents/observability/sessions pages | Evidence, docs, ops, audit | Yes | Support and audit workflows. | admin API. | admin views. | Operators. | GSE-04 | Redacted data. |
| UI states | `PortalStateBlock`, `AdminStateBlock`, hooks | Empty/loading/error/success states | Yes | User feedback. | status/error/action props. | state UI. | Apps. | WUX-02 | Avoid leaking raw errors. |

## 5. Missing Function List

| Proposed Function | Package/App | Why Needed | Inputs | Outputs | Story Dependency | Test Required |
|---|---|---|---|---|---|---|
| `redactContextArtifact` | `packages/shared-schema` or `document-ingest` | Redaction is document-local; context/benchmark/graph artifacts need shared sanitizer. | artifact, options. | redacted artifact plus findings. | GSE-02 | Secret fixture tests. |
| `createBenchmarkPilotReport` | `packages/benchmark` | Sales-grade report should combine scenario summaries and caveats. | reports, customer/repo metadata. | manager and technical report. | BRP-03 | Benchmark report tests. |
| `buildPilotReadinessSummary` | `apps/admin` or `services/api` | Admin should show which prospects are benchmark-ready. | intake, workspaces, reports. | readiness score/actions. | CADP-03 | Admin helper tests. |
| `createSecurityPostureSummary` | `services/api` | Security page needs coherent status. | tenant/session/audit/settings. | posture summary. | GSE-04 | Service security tests. |
| `createDataRetentionPolicyView` | `services/api` | Enterprise buyers need retention/export clarity. | tenant settings. | retention/export view. | GSE-04 | API tests. |
| `linkWorkspaceRepositories` | `packages/graph` or `services/api` | Future multi-repo memory. | repo profiles, dependency hints. | cross-repo links. | DRM-04, TWF-02 | Contract tests after ADR. |
| `createSharedGraphStorageAdapter` | `packages/graph` | Future team workspace graph storage. | storage config. | graph storage interface. | TWF-02 | Adapter contract tests. |
| `detectOutdatedPlanningDocs` | `scripts` or `packages/core` | Prevent stale docs after implementation changes. | git diff, touched areas, docs map. | warnings/checklist. | DBS-01 | Script test. |
| `generateFunctionInventory` | `scripts` | Keep inventory from drifting. | repo root. | generated markdown/JSON inventory. | LMVP-04 | Script fixture test. |
| `validateGraphSnapshotV2` | `packages/graph` or `packages/shared-schema` | Make graph snapshot schema/versioning reusable outside tests. | graph snapshot artifact. | valid result or typed errors. | LMVP-03, DRM-01 | Valid/invalid graph fixture tests. |
| `validateDocumentArtifactV2` | `packages/document-ingest` or `packages/shared-schema` | Make document memory artifacts safe for context, portal, and sync consumers. | document artifact. | valid result or typed errors. | DBS-02, GSE-02 | Sensitivity/redaction fixture tests. |
| `validateDiagramManifestV2` | `packages/diagram-generator` or `packages/shared-schema` | Prevent portal/admin diagram manifest drift. | diagram manifest. | valid result or typed errors. | WUX-02 | Diagram manifest fixture tests. |
| `validateBenchmarkEvidenceBundleV2` | `packages/benchmark` | Benchmark evidence is buyer-facing and needs public contract validation. | evidence bundle. | valid result or typed errors. | BRP-01 | Evidence bundle fixture tests. |
| `createSupportBundle` | `packages/cli` or new support package | Design partners need a safe troubleshooting artifact. | repo root, readiness, config summary, latest artifacts. | redacted support bundle. | LMVP-01, CLIDX-01, GSE-02 | Secret and ignored-path exclusion tests. |
| `persistPlanningChangeRequest` | future docs tooling or service package | Accepted change requests still need a generated registry or issue-tracker persistence adapter. | normalized change request. | persisted registry entry. | DBS-01 | Golden markdown/JSON fixture. |

## 6. Live Docs / Spec / Biz Requirement Update System

### Source of Truth Docs

| Source | Role |
|---|---|
| `README.md` | Public current product overview and local-first quickstart. |
| `docs/00-executive-summary.md` | Business thesis and target customer. |
| `docs/01-product-story.md` | Narrative and positioning. |
| `docs/02-prd.md` | Product requirements and current/future scope. |
| `docs/03-technical-architecture.md` | Package boundaries and data contracts. |
| `docs/04-mcp-cli-spec.md` | CLI/MCP command and response contracts. |
| `docs/06-benchmark-framework.md` | ROI method and evidence rules. |
| `docs/10-user-stories.md` | Current user stories and story status entry point. |
| `docs/DECISIONS.md` | Latest agreed product/architecture decisions. |
| `docs/CHANGELOG-PLANNING.md` | Planning changes and rationale over time. |
| `docs/CHANGE_REQUESTS.md` | Structured latest-agreed requirement and scope change workflow. |
| `docs/26-production-threat-model-retention.md` | Production threat model, retention, export, and deployment-boundary packet. |
| This file | Current continuation plan and inventory. |

### Decision Log Format

Each decision should include:

- ID: `D-YYYYMMDD-XX`
- Status: Proposed, Accepted, Superseded, Rejected
- Context
- Decision
- Consequences
- Affected docs/code
- Follow-up stories

### Change Request Flow

1. Capture proposed change in `docs/CHANGELOG-PLANNING.md` or an issue.
2. Link affected story IDs and source docs.
3. Add/update acceptance criteria before implementation.
4. If architecture/product scope changes materially, add a `docs/DECISIONS.md` entry.
5. Implementation agent updates code and relevant docs in the same story.
6. Validation includes tests plus a doc drift check.

### Recording "Latest Discussed and Agreed"

- Use `docs/DECISIONS.md` for accepted decisions.
- Use `docs/CHANGELOG-PLANNING.md` for planning updates and status changes.
- Use `docs/10-user-stories.md` for active story status and pointers.
- Avoid burying decisions only in chat transcripts.

### Implementation Changes Update Docs

| Change type | Required doc update |
|---|---|
| CLI command/flag/output/exit | `docs/04-mcp-cli-spec.md`, tests. |
| MCP tool/schema | `docs/04-mcp-cli-spec.md`, MCP tests. |
| Graph/context/doc/benchmark schema | `docs/03-technical-architecture.md`, relevant framework docs, contract tests. |
| Benchmark method/metric/evidence | `docs/06-benchmark-framework.md`, benchmark tests. |
| User-facing product scope | `README.md`, `docs/02-prd.md`, `docs/10-user-stories.md`. |
| Enterprise/security/auth/admin | `docs/05-enterprise-platform.md`, security docs/decision log. |

### Agent Pre-Coding Checklist

Before coding:

1. Read `AGENTS.md`.
2. Read `README.md` and the relevant source docs above.
3. Check `docs/DECISIONS.md` and `docs/CHANGELOG-PLANNING.md`.
4. Check this plan for story status.
5. Inspect code and tests.
6. Skip already done stories.
7. Update docs/specs when behavior changes.

### Outdated Docs Detection

Add a future script `detectOutdatedPlanningDocs` that maps touched files to docs:

- CLI/MCP touched but `docs/04` unchanged: warn.
- benchmark touched but `docs/06` unchanged: warn.
- graph/context/document schemas touched but `docs/03` unchanged: warn.
- web copy/product claims touched but README/product docs unchanged: warn.

### Docs Sync Into Context Packs

Docs become context through:

- `knowledge.document_paths` from `heart.config.yaml`
- `.heart/imported-documents`
- `scanDocumentTree`
- document classification, sensitivity, lineage, semantic profile
- `buildHeartModel`
- document-to-module and decision-to-implementation links
- `compileContextPack`

### Business Requirements Connect to Code

Business requirements should connect to implementation through:

- docs with clear title/category/summary
- decision records with explicit target domains/files
- user stories with acceptance criteria
- `DOCUMENT_TO_MODULE` and `DECISION_TO_IMPLEMENTATION` links
- context pack citations
- benchmark scenarios tied to expected docs/reuse/policy evidence

### Acceptance Criteria Updates

When scope changes:

- Update the story acceptance criteria before coding.
- Record planning change in `docs/CHANGELOG-PLANNING.md`.
- If the change alters architecture or product promise, add a decision.
- Tests should map to the changed acceptance criteria.

## 7. Enterprise-Startup Readiness Plan

### Small Companies

Credible when:

- setup is local-first and under 10 minutes
- `heart pack` reduces repeated discovery in real tasks
- benchmark suite shows directional savings on their repo
- pricing story is cheaper than wasted tokens/review cleanup
- no cloud dependency for local value

Next proof:

- guided first-run checklist
- design partner scenario catalog
- copyable website quickstart and pricing caveats

### Design Partners

Credible when:

- pilot scope is explicit
- one repo can be scanned, packed, connected to MCP, benchmarked, and reviewed in portal
- benchmark report includes executive summary, technical appendix, and evidence caveats
- support flow is repeatable

Next proof:

- pilot readiness report
- onboarding checklist
- 5-scenario repeatable benchmark suite

### Enterprise Buyers Later

Credible when:

- local-first and hosted modes are clearly separated
- SSO/RBAC/audit/session controls are documented and tested
- tenant isolation and artifact redaction have explicit tests
- deployment options and data retention are documented
- admin/portal permissions are least privilege

Next proof:

- security posture packet
- data flow diagram
- audit/retention/export runbook
- private deployment ADR

### Pricing and ROI Narrative

Current allowed claim:

- `be-ai-heart` can produce benchmark-backed evidence for token, time, reuse, context retention, policy, and review cleanup deltas.

Avoid:

- fixed savings percentages without a specific report
- broad enterprise compliance claims
- claims that hosted team workspace is complete

## 8. Next Implementation Backlog

Implement in this order.

### 1. CLIDX-01: Guided First-Run Checklist

Status: Done. `runWorkspaceDoctor` now returns a deterministic `first_run` checklist and human `heart doctor` output renders the same first-run path.

- Why now: Local MVP is strong, but new user activation still depends on reading docs.
- Files likely touched: `packages/core/src/doctor.js`, `packages/core/src/workspace.js`, `packages/cli/src/index.js`, `tests/cli-contracts.test.js`, README, `docs/04-mcp-cli-spec.md`.
- Functions to add/change: `createFirstRunChecklist`, CLI doctor/help output.
- Docs to update: README quickstart, CLI spec.
- Tests to run: `npm test -- tests/cli-contracts.test.js tests/config-loading.test.js tests/workspace-storage.test.js`.
- Expected result: User sees status for `init`, `doctor`, `scan`, `overview`, `pack`, `mcp serve`.
- Blocker risk: Avoid making normal CLI output chatty; JSON must stay deterministic.

### 2. CMCP-04: MCP `benchmark_summary`

Status: Done. MCP now exposes a compact `benchmark_summary` tool through the same allowlist/registry path as the other tools, backed by benchmark summary helpers and contract tests.

- Why now: Agents should know whether ROI/evidence exists without broad file reads.
- Files likely touched: `packages/mcp-server/src/tools.js`, `packages/core/src/config.js`, `packages/benchmark/src/index.js`, `tests/mcp-server.test.js`, `tests/mcp-stdio.test.js`, `docs/04-mcp-cli-spec.md`.
- Functions to add/change: `loadLatestBenchmarkSummaries`, `createBenchmarkSummaryToolPayload`, MCP registry/tool handler.
- Docs to update: MCP spec and benchmark framework.
- Tests to run: `npm test -- tests/mcp-server.test.js tests/mcp-stdio.test.js tests/benchmark.test.js`.
- Expected result: Compact safe MCP summary of latest benchmark/evidence state.
- Blocker risk: Do not return raw prompts, patches, local paths, or sensitive evidence.

### 3. DBS-03: Docs/Spec Status Screen

Status: Partial. Portal/admin document workspaces now show queued updates, stale/restricted/linked counts, and next sync actions; richer latest-agreed requirement drift workflows remain future work.

- Why now: Product promise includes continuously updated docs/spec/business requirements.
- Files likely touched: `packages/document-ingest/src/index.js`, `packages/document-sync/src/index.js`, `services/api/src/repository-services.js`, `apps/portal/components/PortalDocumentsWorkspaceClient.jsx`, tests.
- Functions to add/change: `buildDocumentStatusSummary`, UI status helpers.
- Docs to update: user stories, architecture, README if visible.
- Tests to run: `npm test -- tests/document-ingest.test.js tests/document-sync.test.js tests/service-http-enterprise.test.js tests/dashboard-visual-helpers.test.js`.
- Expected result: Portal shows latest docs, stale docs, linked modules/decisions, queued submissions, sensitivity.
- Blocker risk: Do not expose restricted content.

### 4. BRP-03: Design-Partner Benchmark Scenario Catalog

Status: Done. The benchmark catalog now covers bug fix, feature addition, duplicate refactor, cross-module, and document-required scenario types with local fixtures.

- Why now: ROI proof is the main commercial gap.
- Files likely touched: `benchmarks/scenarios`, `benchmarks/datasets`, `packages/benchmark/src/framework.js`, `tests/benchmark.test.js`, docs.
- Functions to add/change: scenario listing may be enough; add `listDesignPartnerScenarios` only if needed.
- Docs to update: benchmark framework, launch checklist, README.
- Tests to run: `npm test -- tests/benchmark.test.js tests/cli.test.js`.
- Expected result: 5 repeatable scenario types with clear rubrics.
- Blocker risk: Do not include customer data or overstate results.

### 5. WUX-01/CADP-01: Website Local Trial and Design Partner Flow

Status: Done. Website copy now shows the local-first command path, evidence-labeled proof language, and a concrete design-partner pilot flow.

- Why now: Adoption path needs to match product readiness.
- Files likely touched: `apps/website/app/page.jsx`, `apps/website/app/start-trial/page.jsx`, website components, docs.
- Functions to add/change: likely UI only.
- Docs to update: README, GTM/pricing, launch checklist.
- Tests to run: `npm run website:build`, `npm test -- tests/web-surfaces.test.js tests/website-services.test.js tests/website-docs.test.js`.
- Expected result: First screen explains product, local trial commands, design partner scope, current vs future features.
- Blocker risk: Avoid unsupported ROI/compliance claims.

### 6. GSE-02/GSE-04: Security Posture Packet and Artifact Safety Tests

Status: Done for the current docs/security-packet scope. Benchmark artifact publication refuses unsafe sanitized artifacts, and the security packet now includes local-first boundaries, production threat model, retention/export plan, deployment posture, and explicit claim limits.

- Why now: Enterprise credibility depends on trust basics.
- Files likely touched: docs, `packages/benchmark`, `packages/document-ingest`, `services/api`, tests.
- Functions to add/change: `validatePublishedArtifactSafety`, possibly `redactContextArtifact`.
- Docs to update: enterprise platform, new security overview/runbook.
- Tests to run: `npm test -- tests/document-ingest.test.js tests/benchmark.test.js tests/service-http-enterprise.test.js tests/session-security.test.js`.
- Expected result: Clear security posture and cross-artifact redaction/sanitization checks.
- Blocker risk: Do not claim certifications or compliance not achieved.

Expected next safe implementation stories after this pass:

- `CADP-03`: founder/operator pipeline can triage design partners by benchmark readiness and next action.
- `DBS-01 follow-up`: optional generated registry for accepted planning change requests.
- `GSE-03 follow-up`: route-by-route authorization review and retention/export implementation hooks.
- `TWF-02`: ADR for shared graph storage after tenant isolation and retention constraints are locked.

## 9. Final AI Follow-Up Instructions

Next implementation agent:

1. Read `AGENTS.md`, README, `docs/DECISIONS.md`, `docs/CHANGELOG-PLANNING.md`, this plan, and the exact docs for the story.
2. Inspect current code before creating modules.
3. Skip stories already marked `Done`.
4. Start with the earliest P0 incomplete story unless the user overrides.
5. Keep backend, CLI, MCP, service, and UI contracts aligned.
6. Keep packages decoupled: packages do not depend on apps; services do not depend on apps.
7. Update docs/specs when implementation changes behavior, schema, CLI, MCP, architecture, security, benchmark, or UI claims.
8. Add tests for every behavior change where feasible.
9. Run focused tests after each story and full `npm test` before completion when practical.
10. Protect secrets: do not hardcode tokens, do not log credentials, redact context/docs/benchmark artifacts.
11. Preserve local-first behavior and make hosted/cloud behavior additive.
12. Keep MCP responses compact and machine-readable.
13. Keep CLI JSON deterministic and human output concise.
14. Do not make unsupported ROI, security, or enterprise claims. Use measurable ROI language only when backed by benchmark evidence.
15. If graphify artifacts appear later, read `graphify-out/GRAPH_REPORT.md` first and update graphify after code changes.
