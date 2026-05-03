# Project Implementation Story Plan

## 1. Current State Summary

`be-ai-heart` already has a working local-first prototype: CLI, MCP stdio tools, TypeScript/JavaScript source scanning, local workspace cache, document ingest, context packs, graph and diagram artifacts, benchmark reports, and hosted sync/persistence surfaces. The codebase is further along than the original MVP docs, and parts of v2 are already present.

What exists now:

- `packages/core` loads `heart.config.yaml`, resolves document roots, applies ignore paths, builds workspace state, persists `.heart/cache/workspace-state.json`, and reports doctor diagnostics.
- `packages/parser-ts` scans source, extracts symbols, imports, import details, calls, routes, extends/implements relations, file hashes, and incremental scan stats.
- `packages/graph` builds typed file/class/interface/function/method/test/document/policy nodes and imports/calls/extends/implements/tested_by/violates_policy edges. It also supports graph snapshotting, hydration, diffing, symbol search, overview, dependency explanation, impact analysis, and code graph view artifacts.
- `packages/context-compiler` emits `schema_version: 2` context packs with ranking, citations, call paths, tests, risks, missing-context warnings, evidence summary, and token-budget trimming.
- `packages/document-ingest` supports `md`, `mdx`, `txt`, `json`, `yaml`, `docx`, and `pdf`, with lineage, freshness, sensitivity detection, redaction, local semantic vectors, and optional OCR.
- `packages/diagram-generator` supports `symbol-graph`, `high-level`, `component`, `class`, `sequence`, and `mindmap`, plus diagram manifests and profile sync.
- `packages/mcp-server` exposes stdio MCP `initialize`, `ping`, `tools/list`, and `tools/call`, with tool allowlist enforcement from config.
- `packages/benchmark` loads versioned scenarios/datasets, normalizes benchmark runs, compares baseline vs assisted, writes reports, writes evidence bundles, and publishes sanitized benchmark artifacts.
- `packages/connect` supports local MCP client detection/install/verify/doctor for Cursor, Claude Code, Continue, Ollama, and LM Studio signals.
- `services/api` has tenant-scoped hosted artifact persistence, auth/session routes, portal/admin read/write contracts, LLM proxy telemetry, benchmark launcher, audit events, observability, rate limits, SQLite storage, and Postgres repository adapters.

What docs say is next:

- `docs/11-implementation-blueprint-v2.md` and `docs/20-v2-execution-backlog.md` define the v2 delivery order: Index Truthfulness, Typed Graph v2, Context Compiler v2, Diagram Engine v2, Document Memory v2, Benchmark Runner v2.
- v2 goal is not product expansion. It is deeper trust: cleaner scans, stronger typed graph semantics, compact agent-facing memory, honest diagrams, governable documents, and evidence-backed ROI.

Current implementation status:

- IT-01, IT-02, and IT-03 are implemented: config, policy, ignore roots, scan provenance, and reusable readiness are wired through CLI, MCP, cache, and benchmark evidence.
- TG-01 through TG-04 are implemented: graph snapshots are schema version 2, typed nodes/edges include confidence/source/provenance, parser relationships carry evidence, impact/deps include relationship evidence, and context packs expose reuse/test links.
- CC-01 through CC-03 are implemented: context pack v2 validation, deterministic trimming, citations, and MCP `agent_contract` behavior are covered by tests.
- DG-01 through DG-03 are implemented: diagram manifests are schema version 2 and sequence/class/high-level diagrams expose scope/confidence without generated/vendor noise.
- DM-01 through DM-03 are implemented or covered by existing document sync paths: document artifacts include v2 lineage/source/citation fields, document/decision links feed graph evidence, and web-submitted docs import into local memory.
- BR-01 and BR-02 are implemented: evidence bundle manifests are schema version 2, observed run comparison rejects unfair or incomplete run pairs, and portal/admin benchmark details expose trace fields.

Remaining gaps:

- Some v2 validators and ranking helpers remain private implementation details; promote only if another package needs direct reuse.
- BR-03 tenant-safe trend publication remains post-MVP hardening. Existing trend helpers and surfaces work, but broader hosted expansion should stay deferred unless explicitly prioritized.
- Raw benchmark prompts, patches, and tool outputs remain local-first by default; hosted views publish sanitized summaries and artifact inventories only.

Resolved or deferred questions:

- Keep internal ranking, trimming, and citation helpers private unless another package needs them; current public behavior is covered by contract tests.
- `docs_search` is an MCP compatibility alias for `document_search`; enabling either alias exposes both names.
- Benchmark raw artifacts remain local-only by default, with hosted sync limited to sanitized evidence summaries and deterministic artifact inventories.
- `IMPACTS` and `RECOMMENDED_REUSE` are currently derived as stable evidence objects rather than broadly persisted as graph edges.

## 2. Epics and Stories

### Epic 1: Index Truthfulness

Goal: scans must reflect the real repo, not generated noise, stale config, or hidden policy drift.

#### Story IT-01 - Config, Ignore, and Document Root Truth

- Scope: MVP.
- User story: As an engineer, I want `heart scan` to honor local config and ignore rules so generated artifacts do not pollute project memory.
- Business outcome: More trustworthy first impression and lower adoption friction.
- Technical outcome: `heart.config.yaml` drives source ignores, document roots, MCP allowlist, and cache provenance deterministically.
- Acceptance criteria:
  - `project.ignore` excludes `.next`, `dist`, `.worktrees`, `.heart/cache`, `.heart/diagrams`, `.heart/benchmarks`, and configured custom paths.
  - `knowledge.document_paths` is the only default document search source plus `.heart/imported-documents`.
  - Two unchanged scans return stable file/document/symbol counts and stable top context candidates.
  - `heart doctor --json` exposes effective ignores and document roots.
- Files/packages likely affected: `packages/core/src/config.js`, `packages/core/src/workspace.js`, `packages/parser-ts/src/index.js`, `packages/document-ingest/src/index.js`, `tests/config-loading.test.js`, `tests/workspace-ignore-defaults.test.js`, `tests/workspace-storage.test.js`.
- Dependencies: none.
- Risks: over-filtering may hide real project files; default ignores may conflict with unusual repo layouts.
- Validation/tests: `npm test -- tests/config-loading.test.js tests/workspace-ignore-defaults.test.js tests/workspace-storage.test.js`.
- Definition of done: scan provenance records config hash, policy hash, ignore paths, document roots, cache schema, and no generated directories appear in graph/context/diagrams under normal config.

#### Story IT-02 - Policy Truth and Schema Failure

- Scope: MVP.
- User story: As a tech lead, I want repo-local policies to be loaded and validated so architecture checks do not silently use stale defaults.
- Business outcome: Higher trust in governance and safer agent workflows.
- Technical outcome: `.heart/policies.yaml` validation is strict, surfaced in doctor, and used by CLI/MCP policy checks.
- Acceptance criteria:
  - Unknown top-level or rule keys are schema errors.
  - Invalid rule shapes mark policy status invalid without hiding errors.
  - `heart policy check` and MCP `policy_check` use repo-local rules.
  - Disabled or invalid policy state is visible in `heart doctor`.
- Files/packages likely affected: `packages/policy-engine/src/index.js`, `packages/core/src/doctor.js`, `packages/mcp-server/src/tools.js`, `tests/policy-engine.test.js`, `tests/cli-contracts.test.js`, `tests/mcp-server.test.js`.
- Dependencies: IT-01.
- Risks: hard-failing policy loads can disrupt first-run UX if errors are not actionable.
- Validation/tests: `npm test -- tests/policy-engine.test.js tests/cli-contracts.test.js tests/mcp-server.test.js`.
- Definition of done: policy validation is deterministic, CLI/MCP outputs cite policy file path/status, and failures tell user next fix.

#### Story IT-03 - Index Truthfulness Gate

- Scope: MVP.
- User story: As an AI agent, I want an index readiness signal so I know whether graph/context output is safe to rely on.
- Business outcome: Reduces bad AI edits caused by misleading context.
- Technical outcome: Workspace state includes a truthfulness/readiness summary consumed by `doctor`, `overview`, MCP `project_overview`, and benchmark evidence.
- Acceptance criteria:
  - Readiness reports config status, policy status, generated-noise exclusion, cache status, parser engine, document count, and warnings.
  - MCP `project_overview.memory_profile` exposes typed graph readiness and document memory readiness.
  - Benchmark evidence records scan provenance used for assisted context.
- Files/packages likely affected: `packages/core/src/doctor.js`, `packages/core/src/workspace.js`, `packages/mcp-server/src/tools.js`, `packages/benchmark/src/index.js`, `tests/cli-contracts.test.js`, `tests/mcp-stdio.test.js`, `tests/benchmark.test.js`.
- Dependencies: IT-01, IT-02.
- Risks: readiness can become noisy if every warning blocks usage.
- Validation/tests: `npm test -- tests/cli-contracts.test.js tests/mcp-stdio.test.js tests/benchmark.test.js`.
- Definition of done: readiness signal separates blocking errors from warnings and is stable in JSON mode.

### Epic 2: Typed Graph v2

Goal: graph must support relationship reasoning, test impact, reuse, and document constraints with explicit evidence.

#### Story TG-01 - Graph Snapshot v2 Contract

- Scope: MVP.
- User story: As an AI agent, I want a versioned graph schema so I can interpret nodes and edges without guessing.
- Business outcome: Safer handoff between agents and fewer duplicate graph abstractions.
- Technical outcome: Shared graph schema includes v2 node/edge types, schema version, confidence, source, provenance, and metadata contracts.
- Acceptance criteria:
  - `GraphSnapshotV2` includes `schema_version`, `repo`, `root`, `nodes`, `edges`, `summary`, `generated_at`, and `scan_provenance`.
  - Minimum node types include `Repository`, `Package`, `Module`, `File`, `Class`, `Interface`, `Function`, `Method`, `Test`, `Document`, `Decision`, `Policy`.
  - Minimum edge types include `CONTAINS`, `IMPORTS`, `CALLS`, `EXTENDS`, `IMPLEMENTS`, `TESTED_BY`, `DOCUMENTS`, `CONSTRAINS`, `VIOLATES_POLICY`, `IMPACTS`, `RECOMMENDED_REUSE`.
  - `snapshotProjectGraph` and `hydrateProjectGraph` preserve v2 schema fields.
- Files/packages likely affected: `packages/shared-schema/src/index.js`, `packages/graph/src/index.js`, `packages/core/src/storage.js`, `tests/parser-graph.test.js`, `tests/workspace-storage.test.js`.
- Dependencies: IT-01.
- Risks: schema churn can break existing portal/admin graph artifacts if not additive.
- Validation/tests: `npm test -- tests/parser-graph.test.js tests/workspace-storage.test.js`.
- Definition of done: v1 consumers still work, v2 fields are additive, and schema validation fixtures exist.

#### Story TG-02 - Parser Relation Extraction Contract

- Scope: MVP.
- User story: As an AI agent, I want calls, inheritance, implementations, routes, and tests captured consistently so dependency answers are not import-only.
- Business outcome: Better change confidence and fewer missed tests.
- Technical outcome: Parser relation outputs are explicit, stable, and covered by fixtures.
- Acceptance criteria:
  - Exported parser contract includes source files, symbols, imports, import details, calls, routes, relations, and warnings.
  - Calls extraction supports direct calls, imported calls, method calls where target name can be resolved, and route handlers for supported TS/JS patterns.
  - Test detection covers `.test`, `.spec`, and `__tests__` import/name heuristics.
  - Unsupported patterns return lower confidence or warnings, not false precision.
- Files/packages likely affected: `packages/parser-ts/src/index.js`, `packages/graph/src/index.js`, `tests/parser-graph.test.js`, `tests/fixtures/sample-repo`, `tests/helpers/typed-graph-fixture.js`.
- Dependencies: TG-01.
- Risks: over-aggressive call resolution can create wrong edges; under-aggressive extraction can reduce value.
- Validation/tests: `npm test -- tests/parser-graph.test.js`.
- Definition of done: relation extraction has deterministic fixtures and confidence/provenance is recorded in graph edges.

#### Story TG-03 - Dependency and Impact Query v2

- Scope: MVP.
- User story: As an engineer, I want `heart deps` and `heart impact` to explain file, symbol, call, inheritance, policy, doc, and test relationships.
- Business outcome: More useful daily AI coding workflow.
- Technical outcome: `createDependencyExplanation` and `createImpactAnalysis` use graph edges beyond imports and expose missing-target contracts.
- Acceptance criteria:
  - Missing target returns `{ found: false, status: "not_found" }` and CLI exit code `3`.
  - Symbol targets include incoming/outgoing calls, extends/implements, related tests, related files, and risk areas.
  - File targets include imports, imported by, contained symbols, calls, tests, policy violations, and document constraints when available.
  - Outputs are protocol-clean JSON in CLI and MCP.
- Files/packages likely affected: `packages/graph/src/index.js`, `packages/cli/src/index.js`, `packages/mcp-server/src/tools.js`, `tests/cli-contracts.test.js`, `tests/parser-graph.test.js`, `tests/mcp-server.test.js`.
- Dependencies: TG-01, TG-02.
- Risks: large result sets can inflate context; ranking must keep high-signal first.
- Validation/tests: `npm test -- tests/cli-contracts.test.js tests/parser-graph.test.js tests/mcp-server.test.js`.
- Definition of done: query output is deterministic, compact, and includes evidence type plus confidence.

#### Story TG-04 - Reuse and Test Linking

- Scope: MVP.
- User story: As an AI agent, I want reusable code paths and related tests surfaced before editing so I avoid duplicate implementations.
- Business outcome: Lower duplicate work and stronger benchmark ROI.
- Technical outcome: Graph has reusable candidate derivation and `TESTED_BY`/`RECOMMENDED_REUSE` evidence usable by context compiler and MCP.
- Acceptance criteria:
  - Reuse candidates map to existing exported functions/classes/interfaces with file path, reason, and confidence.
  - `TESTED_BY` links can be derived from imports and test naming.
  - `RECOMMENDED_REUSE` can be persisted or derived with stable evidence.
  - Context packs include tests to run from graph evidence.
- Files/packages likely affected: `packages/graph/src/index.js`, `packages/context-compiler/src/index.js`, `packages/shared-schema/src/index.js`, `tests/context-pack.test.js`, `tests/parser-graph.test.js`.
- Dependencies: TG-02, TG-03.
- Risks: false reuse candidates can mislead agents into wrong abstractions.
- Validation/tests: `npm test -- tests/context-pack.test.js tests/parser-graph.test.js`.
- Definition of done: reuse/test links have confidence and citations, and false positives are bounded in fixtures.

### Epic 3: Context Compiler v2

Goal: `context_pack` is the compact, defensible memory object for AI work.

#### Story CC-01 - Context Pack Contract and Budget

- Scope: MVP.
- User story: As an AI agent, I want a stable context pack schema that respects token budget so I can use it directly without repo-wide rescans.
- Business outcome: Measurable token savings.
- Technical outcome: Context pack schema is validated, budget trimming is deterministic, and important evidence is retained.
- Acceptance criteria:
  - Schema includes `task`, `summary`, `relevant_files`, `relevant_symbols`, `relevant_documents`, `call_paths`, `tests_to_run`, `reuse_candidates`, `policies`, `risks`, `missing_context_warnings`, `confidence`, `citations`, `estimated_tokens`, and `truncated`.
  - `--token-budget` positive integer is enforced by CLI.
  - Trimming preserves highest ranked citations, call paths, tests, and risks before lower-value extras.
  - Repeated same-task packs are stable on unchanged repo.
- Files/packages likely affected: `packages/context-compiler/src/index.js`, `packages/cli/src/index.js`, `packages/mcp-server/src/tools.js`, `tests/context-pack.test.js`, `tests/cli-contracts.test.js`, `tests/mcp-stdio.test.js`.
- Dependencies: IT-03, TG-03.
- Risks: approximate token estimates can undercount or over-trim.
- Validation/tests: `npm test -- tests/context-pack.test.js tests/cli-contracts.test.js tests/mcp-stdio.test.js`.
- Definition of done: schema tests cover full and budgeted packs; JSON keys are stable.

#### Story CC-02 - Multi-Signal Ranking and Citations

- Scope: MVP.
- User story: As an AI agent, I want ranked code, docs, policies, tests, and reuse evidence so I can trust why context was included.
- Business outcome: Better code quality and lower review cleanup.
- Technical outcome: Ranking combines lexical match, graph proximity, document links, policy relevance, recent activity, reuse likelihood, and test impact.
- Acceptance criteria:
  - Every top file/symbol/document has score and citation/evidence.
  - Document-heavy tasks include relevant docs and linked implementation modules.
  - Policy-heavy tasks boost affected files and policies.
  - Low-evidence tasks return missing-context warnings instead of pretending certainty.
- Files/packages likely affected: `packages/context-compiler/src/index.js`, `packages/entity-linker/src/index.js`, `packages/document-ingest/src/index.js`, `tests/context-pack.test.js`, `tests/entity-linker.test.js`, `tests/document-ingest.test.js`.
- Dependencies: TG-04, DM-02.
- Risks: lexical weighting may dominate semantic/graph signals; recency can over-rank unrelated recent files.
- Validation/tests: `npm test -- tests/context-pack.test.js tests/entity-linker.test.js tests/document-ingest.test.js`.
- Definition of done: fixture tasks cover document-heavy, reuse-heavy, policy-heavy, cross-module, and low-context cases.

#### Story CC-03 - MCP Agent Contract

- Scope: MVP.
- User story: As an MCP-compatible AI client, I want compact follow-up guidance so I know when to call deps, impact, docs, or policy tools.
- Business outcome: Higher adoption by agent users and lower prompt waste.
- Technical outcome: MCP `context_pack` includes `agent_contract` with evidence order, follow-up tools, scan-wide guidance, truncation state, and tool allowlist awareness.
- Acceptance criteria:
  - `agent_contract.should_scan_repo_wide` becomes true only for low confidence, missing evidence, heavy truncation, or empty matches.
  - Follow-up tools respect `mcp.enabled_tools`.
  - Disabled tools are absent from `tools/list` and rejected by `tools/call`.
  - Response remains JSON-only over MCP.
- Files/packages likely affected: `packages/mcp-server/src/tools.js`, `packages/mcp-server/src/stdio.js`, `packages/context-compiler/src/index.js`, `tests/mcp-server.test.js`, `tests/mcp-stdio.test.js`.
- Dependencies: CC-01.
- Risks: too conservative scan-wide guidance weakens token-savings promise.
- Validation/tests: `npm test -- tests/mcp-server.test.js tests/mcp-stdio.test.js`.
- Definition of done: MCP fixtures prove allowlist enforcement and compact agent contract behavior.

### Epic 4: Diagram Engine v2

Goal: diagrams are human review artifacts with honest confidence and scope.

#### Story DG-01 - Diagram Artifact v2 Manifest

- Scope: MVP.
- User story: As a reviewer, I want diagram metadata to show scope and confidence so I can tell what is discovered vs inferred.
- Business outcome: Improves trust in demos and design-partner review.
- Technical outcome: Diagram manifest upgrades to v2 with validation, confidence, inference mode, source graph snapshot, and scope.
- Acceptance criteria:
  - Manifest includes `schema_version: 2`, `type`, `title`, `format`, `inference_mode`, `summary`, `confidence`, `scope`, `validation`, and artifact path.
  - Low-confidence/heuristic diagrams are labelled clearly.
  - Generated/vendor code does not appear in normal diagrams.
- Files/packages likely affected: `packages/diagram-generator/src/index.js`, `packages/graph/src/index.js`, `apps/portal/components/MermaidDiagram.jsx`, `apps/admin/components/AdminMermaidDiagram.jsx`, `tests/diagram-generator.test.js`.
- Dependencies: IT-01, TG-01.
- Risks: changing manifest version may break portal/admin components if fallback is missing.
- Validation/tests: `npm test -- tests/diagram-generator.test.js tests/web-surfaces.test.js`.
- Definition of done: v1 profiles remain readable and v2 manifest fields are validated.

#### Story DG-02 - Component and High-Level Diagrams From Typed Graph

- Scope: MVP.
- User story: As a customer reviewer, I want component and high-level diagrams that reflect package/service/app boundaries rather than file-list demos.
- Business outcome: Stronger onboarding and architecture trust.
- Technical outcome: Component/high-level diagrams consume typed graph domains, modules, documents, and policy edges.
- Acceptance criteria:
  - Component diagram groups packages/apps/services/domains with meaningful edges.
  - High-level diagram uses graph/document/domain evidence, not only filename heuristics.
  - Diagrams cite inference mode and confidence.
  - Portal profile exposes diagrams without build output noise.
- Files/packages likely affected: `packages/diagram-generator/src/index.js`, `packages/entity-linker/src/index.js`, `packages/graph/src/index.js`, `tests/diagram-generator.test.js`, `tests/service-http-repository-detail.test.js`.
- Dependencies: DG-01, TG-03, DM-02.
- Risks: component extraction may overfit this monorepo layout.
- Validation/tests: `npm test -- tests/diagram-generator.test.js tests/service-http-repository-detail.test.js`.
- Definition of done: component/high-level fixture outputs are deterministic and readable from synced profile surfaces.

#### Story DG-03 - Sequence and Class Evidence Upgrade

- Scope: MVP.
- User story: As a reviewer, I want class and sequence diagrams based on real routes, handlers, types, and calls so they do not overclaim precision.
- Business outcome: Better customer confidence and fewer misleading diagrams.
- Technical outcome: Sequence diagrams prefer route/call-chain evidence; class diagrams filter generated/low-confidence shapes.
- Acceptance criteria:
  - Sequence diagrams prefer parsed HTTP route traces when available.
  - Class diagrams include classes/interfaces/methods from typed graph only.
  - Heuristic fallback is labelled beta/low confidence.
  - Participant labels are unique and deterministic.
- Files/packages likely affected: `packages/diagram-generator/src/index.js`, `packages/parser-ts/src/index.js`, `packages/graph/src/index.js`, `tests/diagram-generator.test.js`, `tests/parser-graph.test.js`.
- Dependencies: TG-02, DG-01.
- Risks: route patterns outside supported frameworks will still be heuristic.
- Validation/tests: `npm test -- tests/diagram-generator.test.js tests/parser-graph.test.js`.
- Definition of done: sequence/class diagrams include evidence metadata and do not fail on unsupported patterns.

### Epic 5: Document Memory v2

Goal: business and requirements docs are first-class, compact, linkable, and safe.

#### Story DM-01 - Document Artifact v2 Contract

- Scope: MVP.
- User story: As an AI agent, I want document memory with summary, lineage, sensitivity, and citations so I can use business intent without raw dumps.
- Business outcome: Better requirement alignment with lower token spend.
- Technical outcome: Document artifact schema is explicit and redaction-safe.
- Acceptance criteria:
  - Artifact includes `document_id`, `path`, `source`, `category`, `title`, `summary`, `headings`, `freshness`, `sensitivity`, `version_ref`, `lineage`, `extraction`, and `citations`.
  - Restricted docs return redacted summaries/previews by default.
  - `.docx` and `.pdf` adapters record extraction mode and OCR status.
  - Latest lineage is preferred for retrieval.
- Files/packages likely affected: `packages/document-ingest/src/index.js`, `packages/document-sync/src/index.js`, `packages/shared-schema/src/index.js`, `tests/document-ingest.test.js`, `tests/document-sync.test.js`.
- Dependencies: IT-01.
- Risks: redaction false positives can hide useful business context; false negatives can leak sensitive data.
- Validation/tests: `npm test -- tests/document-ingest.test.js tests/document-sync.test.js`.
- Definition of done: document fixtures prove lineage, semantic retrieval, redaction, and extraction metadata.

#### Story DM-02 - Document-to-Graph and Decision Links

- Scope: MVP.
- User story: As an AI agent, I want docs linked to modules and decisions so context packs explain why code is relevant.
- Business outcome: Better reuse and intent alignment.
- Technical outcome: `entity-linker` relationships become graph evidence through `DOCUMENTS` and `CONSTRAINS` edges or equivalent stable citation objects.
- Acceptance criteria:
  - Requirement/technical docs link to implementation domains with confidence and rationale.
  - Decision-like docs link to target files/symbols.
  - Context pack citations include document-to-module evidence.
  - Graph snapshot exposes document/decision relation counts.
- Files/packages likely affected: `packages/entity-linker/src/index.js`, `packages/graph/src/index.js`, `packages/context-compiler/src/index.js`, `packages/shared-schema/src/index.js`, `tests/entity-linker.test.js`, `tests/context-pack.test.js`.
- Dependencies: TG-01, DM-01.
- Risks: document terms can map to wrong module names; confidence must be visible.
- Validation/tests: `npm test -- tests/entity-linker.test.js tests/context-pack.test.js`.
- Definition of done: document links are inspectable, cited, and absent when evidence is weak.

#### Story DM-03 - Portal/Admin Document Updates Into Local Memory

- Scope: MVP for design-partner loop; hosted hardening post-MVP.
- User story: As a team member, I want portal-submitted docs to appear in the next local scan so AI agents use current business context.
- Business outcome: Enables durable team memory without replacing local-first source of truth.
- Technical outcome: Web submissions import into `.heart/imported-documents`, sync to surfaces, and affect subsequent `heart pack`.
- Acceptance criteria:
  - `heart docs sync-web` imports only matching profile submissions.
  - Imported docs are included by `resolveDocumentRoots`.
  - `heart docs search` and MCP document search return imported docs after scan.
  - Sync does not expose restricted body text in public artifacts.
- Files/packages likely affected: `packages/document-sync/src/index.js`, `packages/core/src/config.js`, `packages/document-ingest/src/index.js`, `services/api/src/http.js`, `tests/document-sync.test.js`, `tests/cli.test.js`, `tests/service-http-enterprise.test.js`.
- Dependencies: DM-01.
- Risks: hosted/local sync may create stale or duplicate document versions.
- Validation/tests: `npm test -- tests/document-sync.test.js tests/cli.test.js tests/service-http-enterprise.test.js`.
- Definition of done: portal/admin document flow round-trips into local context with lineage and profile isolation.

### Epic 6: Benchmark Runner v2

Goal: ROI claims trace to repeatable run artifacts, not scenario summaries only.

#### Story BR-01 - Evidence Bundle v2 Contract

- Scope: MVP.
- User story: As an engineering manager, I want every benchmark claim to trace back to raw evidence so ROI is credible.
- Business outcome: Supports design-partner and sales conversations.
- Technical outcome: Benchmark evidence bundle includes baseline, assisted, evaluation, scenario, dataset, provenance, context pack evidence, and raw artifact references.
- Acceptance criteria:
  - Bundle manifest includes repo snapshot/ref, model/provider, task, scenario/dataset, measurement mode, run ids, and artifact list.
  - Baseline and assisted artifacts are separate.
  - Context pack citation/count/compactness evidence is recorded for assisted runs.
  - Raw artifacts are local-first and sanitized before hosted publication.
- Files/packages likely affected: `packages/benchmark/src/index.js`, `packages/benchmark/src/framework.js`, `packages/cli/src/index.js`, `services/api/src/storage.js`, `tests/benchmark.test.js`, `tests/cli.test.js`, `tests/service-http-benchmarks.test.js`.
- Dependencies: CC-01, IT-03.
- Risks: storing raw prompts or patches can leak sensitive data if sync rules are weak.
- Validation/tests: `npm test -- tests/benchmark.test.js tests/cli.test.js tests/service-http-benchmarks.test.js`.
- Definition of done: local evidence bundle is reproducible and hosted artifact is sanitized.

#### Story BR-02 - Observed Run Capture and Fair Compare

- Scope: MVP.
- User story: As a benchmark reviewer, I want observed baseline and assisted runs compared under the same scenario so metrics are defensible.
- Business outcome: Converts benchmark from internal demo to ROI proof.
- Technical outcome: `heart benchmark capture`, `heart agent run`, and `heart benchmark run --baseline-run --assisted-run` preserve run telemetry and fairness metadata.
- Acceptance criteria:
  - Captured runs include provider/model, upstream URL, command argv, duration, token usage, cost, measurement coverage, and status.
  - `observed` and `estimated` measurement modes remain separate in reports.
  - Both run ids are required for observed compare.
  - Pricing flags validate numeric values and are recorded.
- Files/packages likely affected: `packages/cli/src/index.js`, `packages/benchmark/src/framework.js`, `services/api/src/llm-proxy.js`, `services/api/src/storage.js`, `tests/cli-contracts.test.js`, `tests/cli.test.js`, `tests/service-http-llm-proxy.test.js`.
- Dependencies: BR-01.
- Risks: agent commands can be unsafe if not treated as local explicit execution; reports can overclaim low-coverage runs.
- Validation/tests: `npm test -- tests/cli-contracts.test.js tests/cli.test.js tests/service-http-llm-proxy.test.js`.
- Definition of done: observed report labels confidence and refuses incomplete observed compare inputs.

#### Story BR-03 - Benchmark Trends and Portal/Admin Evidence Views

- Scope: Post-MVP hardening after local v2 proof.
- User story: As a platform owner, I want benchmark history and trends by workspace/repo so I can track adoption and ROI over time.
- Business outcome: Supports paid pilots and expansion.
- Technical outcome: Portal/admin surfaces use the same benchmark evidence model as CLI, with tenant scoping and sanitized details.
- Acceptance criteria:
  - Portal/admin can list benchmark reports and trends by workspace/profile.
  - Manager, technical, and raw-evidence views use same source report.
  - Tenant-scoped reads/writes are enforced.
  - Sensitive raw local artifacts are not published unless explicitly sanitized.
- Files/packages likely affected: `packages/benchmark/src/trends.js`, `services/api/src/access.js`, `services/api/src/storage.js`, `apps/portal/src/dashboard-visuals.js`, `apps/admin/src/dashboard-visuals.js`, `tests/benchmark-trends.test.js`, `tests/service-http-enterprise.test.js`, `tests/dashboard-visual-helpers.test.js`.
- Dependencies: BR-01, BR-02.
- Risks: hosted evidence can become a data-governance risk if raw artifacts sync by default.
- Validation/tests: `npm test -- tests/benchmark-trends.test.js tests/service-http-enterprise.test.js tests/dashboard-visual-helpers.test.js`.
- Definition of done: trend views are tenant-safe and clearly separate observed vs estimated metrics.

## 3. Function/API Inventory

| Area | Package/File | Function/API/Command | Exists? | Purpose | Inputs | Outputs | Used By | Story IDs |
|---|---|---|---|---|---|---|---|---|
| CLI | `packages/cli/src/index.js` | `heart init` | Yes | Create/repair config and policy scaffold | `--root`, `--force`, `--json` | scaffold report, next commands | engineers | IT-01, IT-02 |
| CLI | `packages/cli/src/index.js` | `heart doctor` | Yes | Preflight config, policy, parser, docs, cache, MCP | `--root`, `--json` | readiness report | engineers, agents | IT-01, IT-03 |
| CLI | `packages/cli/src/index.js` | `heart scan` | Yes | Build/refresh local graph cache | `--root`, `--rebuild`, `--json` | counts, cache state, policy warnings | engineers, benchmarks | IT-01, TG-01 |
| CLI | `packages/cli/src/index.js` | `heart overview` | Yes | Summarize indexed repo | `--root`, `--json` | overview object | engineers, MCP parity | IT-03 |
| CLI | `packages/cli/src/index.js` | `heart find symbol` | Yes | Find symbol definitions | query, `--root`, `--json` | matches array | engineers, agents | TG-03 |
| CLI | `packages/cli/src/index.js` | `heart deps` | Yes | Explain dependencies for file/symbol | target, `--root`, `--json` | dependency explanation or not_found | engineers, agents | TG-03 |
| CLI | `packages/cli/src/index.js` | `heart impact` | Yes | Estimate impact radius | target, `--root`, `--json` | impact report or not_found | engineers, agents | TG-03 |
| CLI | `packages/cli/src/index.js` | `heart policy check` | Yes | Evaluate repo policy rules | `--root`, `--json` | rules, violations | engineers, agents | IT-02 |
| CLI | `packages/cli/src/index.js` | `heart docs search` | Yes | Search project documents | query, `--root`, `--json` | matched docs | engineers, agents | DM-01 |
| CLI | `packages/cli/src/index.js` | `heart docs import` | Yes | Import local document into Heart memory | source file, title/category/summary/slug | imported path, sync report | engineers | DM-03 |
| CLI | `packages/cli/src/index.js` | `heart docs sync-web` | Yes | Pull web document submissions into local memory | slug, roots | imported count, sync report | engineers | DM-03 |
| CLI | `packages/cli/src/index.js` | `heart pack` | Yes | Compile task context pack | task, token budget, root, json | context pack | AI agents | CC-01, CC-02 |
| CLI | `packages/cli/src/index.js` | `heart mcp tools` | Yes | List effective MCP tool registry | root, json | enabled/disabled tools | engineers, connect verify | CC-03 |
| CLI | `packages/cli/src/index.js` | `heart mcp serve` | Yes | Run stdio MCP server | root | MCP JSON-RPC stream | AI clients | CC-03 |
| CLI | `packages/cli/src/index.js` | `heart connect detect` | Yes | Detect agent hosts/model runtimes | root, agents, models, json | inventory | engineers | IT-03 |
| CLI | `packages/cli/src/index.js` | `heart connect install` | Yes | Install MCP config for agent host | client, scope, model, dry-run, backup | plan or verification result | engineers | IT-03 |
| CLI | `packages/cli/src/index.js` | `heart connect verify` | Yes | Run real MCP stdio handshake | client, scope, model, root | verification status | engineers | CC-03 |
| CLI | `packages/cli/src/index.js` | `heart connect doctor` | Yes | Diagnose connect readiness | root, json | actions, status | engineers | IT-03 |
| CLI | `packages/cli/src/index.js` | `heart diagram generate` | Yes | Generate Mermaid artifacts | type, task, target, root | `.heart/diagrams/*`, manifest | reviewers | DG-01, DG-02, DG-03 |
| CLI | `packages/cli/src/index.js` | `heart diagram sync` | Yes | Publish profile/diagrams/doc artifacts | slug, portal/admin roots | profile sync report | portal/admin | DG-01, DM-03 |
| CLI | `packages/cli/src/index.js` | `heart benchmark run` | Yes | Run one scenario or suite | scenario/all/run ids/root | report, evidence bundle | managers, sales | BR-01, BR-02 |
| CLI | `packages/cli/src/index.js` | `heart benchmark capture` | Yes | Capture baseline/assisted command through proxy | mode, scenario, upstream, command, pricing | agent run capture | benchmark runner | BR-02 |
| CLI | `packages/cli/src/index.js` | `heart benchmark compare` | Yes | Compare two benchmark reports | baseline json, assisted json | report, evidence bundle | managers | BR-01 |
| CLI | `packages/cli/src/index.js` | `heart agent run` | Yes | Launch arbitrary agent command through proxy | mode, upstream, command, pricing | run telemetry | benchmark capture | BR-02 |
| CLI | `packages/cli/src/index.js` | `heart service export` | Yes | Export canonical service snapshot | root, out, json | snapshot path/table counts | migration ops | BR-03 |
| CLI | `packages/cli/src/index.js` | `heart auth provider-session` | Yes | Exchange provider id token with hosted service | url, provider, token, workspace/customer | session | hosted sync users | DM-03, BR-03 |
| CLI | `packages/cli/src/index.js` | `heart sync profile/docs/benchmark` | Yes | Push sanitized local artifacts to API | url, session, slug, artifact inputs | remote sync result | hosted surfaces | DG-01, DM-03, BR-03 |
| CLI parser | `packages/cli/src/index.js` | `runCli(argv, io)` | Yes | Main CLI dispatcher | argv, IO | exit code | binary, tests | All |
| CLI parser | `packages/cli/src/index.js` | `parseArgs`, `validateAllowedFlags`, `parseFlagValue` | Internal | Parse flags and enforce command contracts | argv tokens | parsed command or usage error | CLI | CC-01, BR-02 |
| CLI launcher | `packages/cli/src/index.js` | `executeAgentRunCapture` | Internal | Start proxy-backed agent command and persist telemetry | run metadata, command | run, proxy, command, summary | benchmark capture, agent run | BR-02 |
| CLI HTTP | `packages/cli/src/http-client.js` | `exchangeProviderSessionRemote` | Yes | Call hosted session exchange | base URL, id token, workspace/customer | provider session | auth command | DM-03 |
| CLI HTTP | `packages/cli/src/http-client.js` | `syncRepositoryProfileRemote` | Yes | Push profile artifact to service | base URL, session, profile | API result | sync profile | DG-01 |
| CLI HTTP | `packages/cli/src/http-client.js` | `syncRepositoryDocumentsRemote` | Yes | Push document artifact to service | base URL, session, artifact | API result | sync docs | DM-03 |
| CLI HTTP | `packages/cli/src/http-client.js` | `syncBenchmarkReportRemote` | Yes | Push benchmark report to service | base URL, session, report | API result | sync benchmark | BR-03 |
| MCP protocol | `packages/mcp-server/src/stdio.js` | `initialize` | Yes | MCP init handshake | JSON-RPC request | protocol/capabilities/server info | MCP clients | CC-03 |
| MCP protocol | `packages/mcp-server/src/stdio.js` | `ping` | Yes | Health check | JSON-RPC request | empty result | MCP clients | CC-03 |
| MCP protocol | `packages/mcp-server/src/stdio.js` | `tools/list` | Yes | List allowed MCP tools | initialized server | tool definitions | MCP clients | CC-03 |
| MCP protocol | `packages/mcp-server/src/stdio.js` | `tools/call` | Yes | Execute one MCP tool | name, arguments | tool result | MCP clients | CC-03 |
| MCP server | `packages/mcp-server/src/stdio.js` | `createStdioMcpServer` | Yes | Construct stdio MCP server | repoRoot, streams, buildState | server object | CLI mcp serve | CC-03 |
| MCP server | `packages/mcp-server/src/stdio.js` | `startStdioServer` | Yes | Start MCP server | repoRoot, streams | no return | CLI | CC-03 |
| MCP registry | `packages/mcp-server/src/tools.js` | `createToolRegistry` | Yes | Build allowlisted tool definitions | enabled tools | tool definitions | mcp tools, tools/list | CC-03 |
| MCP registry | `packages/mcp-server/src/tools.js` | `handleToolCall` | Yes | Dispatch MCP tool to graph/compiler/policy/docs | tool name, args, workspace state | structured payload | tools/call | CC-03 |
| MCP registry | `packages/mcp-server/src/tools.js` | `createToolCallResult` | Yes | Wrap payload for MCP content | payload | MCP tool result | stdio server | CC-03 |
| MCP tool | `packages/mcp-server/src/tools.js` | `project_overview` | Yes | Repo summary and memory profile | empty | overview, workflow | AI agents | IT-03 |
| MCP tool | `packages/mcp-server/src/tools.js` | `symbol_lookup` | Yes | Find symbols | query | matches | AI agents | TG-03 |
| MCP tool | `packages/mcp-server/src/tools.js` | `dependency_explain` | Yes | Explain dependencies | target | dependency report | AI agents | TG-03 |
| MCP tool | `packages/mcp-server/src/tools.js` | `context_pack` | Yes | Compile task context | task, token_budget | context pack + agent_contract | AI agents | CC-01, CC-03 |
| MCP tool | `packages/mcp-server/src/tools.js` | `impact_analysis` | Yes | Estimate blast radius | target | impact report | AI agents | TG-03 |
| MCP tool | `packages/mcp-server/src/tools.js` | `document_search` | Yes | Search project docs | query | matched docs | AI agents | DM-01 |
| MCP tool | `packages/mcp-server/src/tools.js` | `docs_search` | Yes | Compatibility/user-facing alias for document search | query | matched docs | AI agents | DM-01 |
| MCP tool | `packages/mcp-server/src/tools.js` | `policy_check` | Yes | Evaluate policies | empty | rules, violations | AI agents | IT-02 |
| Schema | `packages/shared-schema/src/index.js` | `NODE_TYPES` | Partial | Canonical graph node names | none | node type constants | graph, MCP | TG-01 |
| Schema | `packages/shared-schema/src/index.js` | `EDGE_TYPES` | Partial | Canonical graph edge names | none | edge type constants | graph, MCP | TG-01, TG-04 |
| Schema | `packages/shared-schema/src/index.js` | `createGraphNode` | Yes | Normalize graph node | id, type, name, path, metadata | node | graph builder | TG-01 |
| Schema | `packages/shared-schema/src/index.js` | `createGraphEdge` | Yes | Normalize graph edge | id, from, to, type, metadata | edge | graph builder | TG-01 |
| Schema | `packages/shared-schema/src/index.js` | `createGraphSummary` | Yes | Count node/edge types | nodes, edges | summary | graph builder | TG-01 |
| Schema | `packages/shared-schema/src/index.js` | `parseSimpleYaml` | Yes | Minimal YAML parser | raw YAML | object | config, policy | IT-01, IT-02 |
| Schema | `packages/shared-schema/src/enterprise.js` | `PORTAL_ROLES`, `ADMIN_ROLES`, permissions/navigation | Yes | Enterprise RBAC constants | none | role/permission maps | services/apps | BR-03 |
| Schema | `packages/shared-schema/src/enterprise.js` | `resolveActorAccess`, `actorHasPermission`, `filterNavigationGroupsForActor` | Yes | Resolve RBAC access | actor, permission/group | access result | API/apps | BR-03 |
| Schema | `packages/core/src/storage.js` | `WORKSPACE_CACHE_SCHEMA_VERSION` | Yes | Local cache schema version | none | version number | workspace cache | IT-03 |
| Schema | `packages/benchmark/src/framework.js` | `DEFAULT_SCORE_WEIGHTS` | Yes | Benchmark scoring weights | none | weights | benchmark reports | BR-01 |
| Schema | `packages/shared-schema/src/index.js` | `GraphSnapshotV2` | No | Validated graph snapshot contract | graph state | versioned snapshot | graph/core/MCP | TG-01 |
| Schema | `packages/shared-schema/src/index.js` | `ContextPackV2` | Partial | Shared pack contract | compiler output | validated pack | CLI/MCP/benchmark | CC-01 |
| Schema | `packages/shared-schema/src/index.js` | `DiagramManifestV2` | No | Diagram artifact contract | diagrams | manifest | portal/admin | DG-01 |
| Schema | `packages/shared-schema/src/index.js` | `DocumentArtifactV2` | Partial | Document memory contract | document index | artifact | docs/context/sync | DM-01 |
| Schema | `packages/shared-schema/src/index.js` | `BenchmarkEvidenceBundleV2` | Partial | Benchmark evidence contract | run set | evidence bundle | benchmark/API | BR-01 |
| Core config | `packages/core/src/config.js` | `createDefaultConfig` | Yes | Build default config object | project name, options | config object | init/load config | IT-01 |
| Core config | `packages/core/src/config.js` | `createDefaultConfigYaml` | Yes | Build scaffold YAML | project name, languages | YAML text | init | IT-01 |
| Core config | `packages/core/src/config.js` | `loadHeartConfig` | Yes | Parse and validate repo config | repo root | config state | workspace/doctor | IT-01 |
| Core config | `packages/core/src/config.js` | `resolveDocumentRoots` | Yes | Resolve document roots plus imported docs | config | root list | workspace | DM-03 |
| Core config | `packages/core/src/config.js` | `resolveEnabledMcpTools` | Yes | Filter MCP allowlist | enabled tools | known tools | CLI/MCP | CC-03 |
| Core env | `packages/core/src/environment.js` | `detectProjectEnvironment` | Yes | Detect languages/runtime | repo root, ignore | environment summary | init/doctor | IT-01 |
| Core workspace | `packages/core/src/workspace.js` | `buildWorkspaceState` | Yes | Assemble config, policy, scan, docs, graph, cache | repoRoot, options | workspace state | CLI/MCP | All MVP |
| Core doctor | `packages/core/src/doctor.js` | `runWorkspaceDoctor` | Yes | Build diagnostics | repo root | doctor report | CLI | IT-03 |
| Core storage | `packages/core/src/storage.js` | `getWorkspaceCachePaths` | Yes | Resolve cache paths | repo root | paths | workspace | IT-03 |
| Core storage | `packages/core/src/storage.js` | `loadCachedWorkspaceState` | Yes | Load valid portable cache | repo root | cache entry/null | workspace | IT-03 |
| Core storage | `packages/core/src/storage.js` | `persistWorkspaceState` | Yes | Write workspace cache atomically | repo root, state | path | workspace | IT-03 |
| Core storage | `packages/core/src/storage.js` | `hydrateCachedGraph` | Yes | Reattach scan result to graph snapshot | cache entry, scan | graph | workspace | TG-01 |
| Parser | `packages/parser-ts/src/index.js` | `scanSourceTree` | Yes | Discover and parse source files | root, ignore, previous scan | scan result | core workspace | IT-01, TG-02 |
| Parser | `packages/parser-ts/src/index.js` | `extractSymbolsFromContent` | Yes | Extract symbols from one source string | content, path, TS module | symbols | tests/tools | TG-02 |
| Parser | `packages/parser-ts/src/index.js` | `extractImportsFromContent` | Yes | Extract import specifiers | content, path, TS module | imports | tests/tools | TG-02 |
| Parser | `packages/parser-ts/src/index.js` | `extractFileFactsFromContent` | Internal | Extract imports, symbols, calls, routes, warnings | content, path, TS module | file facts | scanSourceTree | TG-02 |
| Parser | `packages/parser-ts/src/index.js` | `extractImportsWithTypeScript`, `extractImportDetailsWithTypeScript` | Internal | AST import/export/require extraction | TS source file | imports/detail records | scanSourceTree | TG-02 |
| Parser | `packages/parser-ts/src/index.js` | `extractSymbolsWithTypeScript` | Internal | AST class/interface/function/method/type extraction | TS source file | symbols | scanSourceTree | TG-02 |
| Parser | `packages/parser-ts/src/index.js` | `extractCallsWithTypeScript` | Internal | First-pass call-site extraction | TS source file | call records | graph builder | TG-02 |
| Parser | `packages/parser-ts/src/index.js` | `extractRoutesWithTypeScript` | Internal | Next/router route metadata extraction | TS source file | route records | diagrams/benchmark | DG-03 |
| Parser | `packages/parser-ts/src/index.js` | `readSymbolRelations` | Internal | Extract extends/implements names | AST node | relation names | graph builder | TG-02 |
| Parser | `packages/parser-ts/src/index.js` | `extractCallsFromContent` | No | Public call extractor for fixtures/tools | content, path | call records | tests/v2 APIs | TG-02 |
| Parser | `packages/parser-ts/src/index.js` | `extractTestReferencesFromContent` | No | Public test reference extractor | content, path | test links | graph | TG-04 |
| Graph | `packages/graph/src/index.js` | `buildProjectGraph` | Yes | Build graph from scan/docs/policies | scan result, options | graph | workspace | TG-01 |
| Graph | `packages/graph/src/index.js` | `snapshotProjectGraph` | Yes | Create serializable graph snapshot | graph | snapshot | cache | TG-01 |
| Graph | `packages/graph/src/index.js` | `hydrateProjectGraph` | Yes | Hydrate snapshot with scan result | snapshot, scan | graph | cache | TG-01 |
| Graph | `packages/graph/src/index.js` | `diffProjectGraphSnapshots` | Yes | Diff two snapshots | previous, next | added/removed nodes/edges | tests/future CLI | TG-01 |
| Graph | `packages/graph/src/index.js` | `searchSymbols` | Yes | Query symbols by name | graph, query | symbols | CLI/MCP | TG-03 |
| Graph | `packages/graph/src/index.js` | `createProjectOverview` | Yes | Summarize repo memory | graph, policy, docs, heart model | overview | CLI/MCP/profile | IT-03 |
| Graph | `packages/graph/src/index.js` | `createCodeGraphView` | Yes | Build visual graph artifact | graph, mode/options | layout artifact | portal/admin | DG-02 |
| Graph | `packages/graph/src/index.js` | `createImpactAnalysis` | Yes | Analyze impact for target | graph, target | impact report | CLI/MCP | TG-03 |
| Graph | `packages/graph/src/index.js` | `createDependencyExplanation` | Yes | Explain deps for target | graph, target | dependency report | CLI/MCP | TG-03 |
| Graph | `packages/graph/src/index.js` | `deriveTestedFiles` | Internal | Link test files to implementation files | test path, imports, file index | file paths | buildProjectGraph | TG-04 |
| Graph | `packages/graph/src/index.js` | `resolveSymbolTarget`, `createImportedSymbolIndex` | Internal | Resolve relation/call targets | file/import context | symbol target | buildProjectGraph | TG-02 |
| Graph | `packages/graph/src/index.js` | `deriveImpactEdges` | No | Persist or derive `IMPACTS` relationships | graph, target/scope | impact edges | impact/context/benchmark | TG-03 |
| Graph | `packages/graph/src/index.js` | `detectReuseCandidates` | No | Stable reusable candidate API | graph, task/query | candidates | context/MCP | TG-04 |
| Entity linker | `packages/entity-linker/src/index.js` | `buildHeartModel` | Yes | Link docs, domains, modules, decisions | scan result, document index | heart model | workspace/context | DM-02 |
| Entity linker | `packages/entity-linker/src/index.js` | `getLinkedModulesForDocuments` | Yes | Find modules linked to docs | heart model, doc paths | linked modules | context compiler | DM-02, CC-02 |
| Entity linker | `packages/entity-linker/src/index.js` | `getModuleRelationshipsForDocuments` | Yes | Find module relationships from doc support | heart model, doc paths | relationships | context compiler | DM-02 |
| Entity linker | `packages/entity-linker/src/index.js` | `getDecisionImplementationsForDocuments` | Yes | Link decision docs to implementation targets | heart model, doc paths | targets | context compiler | DM-02 |
| Entity linker | `packages/entity-linker/src/index.js` | `linkDocumentsToGraph` | No | Emit graph edges from heart model links | heart model, graph | DOCUMENTS/CONSTRAINS edges | graph/context | DM-02 |
| Context | `packages/context-compiler/src/index.js` | `compileContextPack` | Yes | Build task-specific memory pack | task, graph, docs, heart model, policy, budget | context pack | CLI/MCP/benchmark | CC-01, CC-02 |
| Context | `packages/context-compiler/src/index.js` | `rankRelevantDocuments` | Internal | Rank docs for task | doc index, task, tokens | docs | compileContextPack | CC-02 |
| Context | `packages/context-compiler/src/index.js` | `createGraphBoostMaps` | Internal | Boost candidates by graph proximity | graph, seed symbols/files | score maps | compileContextPack | CC-02 |
| Context | `packages/context-compiler/src/index.js` | `createPolicyBoostMaps` | Internal | Boost policy-relevant files/symbols | scan, policy report, task tokens | score maps | compileContextPack | CC-02 |
| Context | `packages/context-compiler/src/index.js` | `buildCitations` | Internal | Emit evidence citations | docs/files/symbols/calls/policies | citations | compileContextPack | CC-02 |
| Context | `packages/context-compiler/src/index.js` | `finalizeContextPack` | Internal | Estimate tokens and trim pack | pack, token budget | finalized pack | compileContextPack | CC-01 |
| Context | `packages/context-compiler/src/index.js` | `createEvidenceSummary` | Internal | Score evidence coverage/compactness | pack | evidence summary | compileContextPack/benchmark | CC-01, BR-01 |
| Context | `packages/context-compiler/src/index.js` | `collectCallPaths`, `collectTestsToRun` | Internal | Build call/test evidence | graph, ranked entries | call paths/tests | compileContextPack | TG-04, CC-02 |
| Context | `packages/context-compiler/src/index.js` | `validateContextPackV2` | No | Validate pack schema and stable keys | pack | validation result | tests/MCP/benchmark | CC-01 |
| Context | `packages/context-compiler/src/index.js` | `rankContextCandidates` | No | Public ranking API to prevent duplicate logic | task, graph, docs, policies | ranked candidates | compiler/diagrams/benchmarks | CC-02 |
| Policy | `packages/policy-engine/src/index.js` | `DEFAULT_POLICY_RULES` | Yes | Built-in architecture rules | none | rules | policy load fallback | IT-02 |
| Policy | `packages/policy-engine/src/index.js` | `createDefaultPoliciesYaml` | Yes | Scaffold policy file | none | YAML | init | IT-02 |
| Policy | `packages/policy-engine/src/index.js` | `loadPolicyRules` | Yes | Load and validate policy YAML | repo root, rules file | policy state | workspace | IT-02 |
| Policy | `packages/policy-engine/src/index.js` | `evaluatePolicyViolations` | Yes | Check imports against rules | scan result, rules | violations | workspace/MCP | IT-02 |
| Policy | `packages/policy-engine/src/index.js` | `normalizePolicyDocument`, `normalizePolicyRules` | Internal | Validate policy schema | parsed yaml | rules/errors | loadPolicyRules | IT-02 |
| Policy | `packages/policy-engine/src/index.js` | `validatePolicySchema` | No | Public validator for doctor/tests | raw/parsed policy | validation result | CLI/doctor | IT-02 |
| Documents | `packages/document-ingest/src/index.js` | `scanDocumentTree` | Yes | Discover, parse, classify, enrich docs | root, roots, ignore, previous index | document index | workspace | DM-01 |
| Documents | `packages/document-ingest/src/index.js` | `findRelevantDocuments` | Yes | Search docs by lexical/semantic score | doc index, task, limit | matches | CLI/MCP/context | DM-01, CC-02 |
| Documents | `packages/document-ingest/src/index.js` | `createDocumentOverview` | Yes | Summarize document index | document index | overview | future overview | DM-01 |
| Documents | `packages/document-ingest/src/index.js` | `createDocumentRecord` | Internal | Create normalized doc record | file path, relative path, stat | document | scanDocumentTree | DM-01 |
| Documents | `packages/document-ingest/src/index.js` | `classifyDocument` | Internal | Categorize docs | path, content | category | scanDocumentTree | DM-01 |
| Documents | `packages/document-ingest/src/index.js` | `readDocumentPayload` | Internal | Read doc by extension | file path, relative path | content/extraction | createDocumentRecord | DM-01 |
| Documents | `packages/document-ingest/src/index.js` | `extractDocxPayload`, `extractPdfPayload` | Internal | Parse docx/pdf | file path | content/extraction | readDocumentPayload | DM-01 |
| Documents | `packages/document-ingest/src/index.js` | `extractPdfTextWithOcrMyPdf`, `detectOcrCapability` | Internal | OCR weak PDF text when available | PDF path/extraction | OCR content/capability | readDocumentPayload | DM-01 |
| Documents | `packages/document-ingest/src/index.js` | `detectSensitivity`, `redactSensitiveContent` | Internal | Classify/redact sensitive content | path/content | sensitivity/redacted text | document ingest/sync | DM-01 |
| Documents | `packages/document-ingest/src/index.js` | `enrichDocumentsWithLineage`, `enrichDocumentsWithSemanticProfiles` | Internal | Add lineage and local vectors | docs | enriched docs | scanDocumentTree | DM-01 |
| Documents | `packages/document-ingest/src/index.js` | `validateDocumentArtifactV2` | No | Validate synced doc artifact | artifact | validation result | sync/API/tests | DM-01 |
| Document sync | `packages/document-sync/src/index.js` | `publishRepositoryDocuments` | Yes | Persist/publish document artifact | surface/storage/profile/doc index | persisted/synced record | diagram sync/API | DM-03 |
| Document sync | `packages/document-sync/src/index.js` | `prepareRepositoryDocumentArtifact` | Yes | Build web-safe doc artifact | profile, repo, doc index | artifact | CLI remote sync | DM-03 |
| Document sync | `packages/document-sync/src/index.js` | `syncRepositoryDocumentsToSurfaces` | Yes | Publish docs to portal/admin | repo, profile, roots, doc index | sync report | CLI docs/diagram | DM-03 |
| Document sync | `packages/document-sync/src/index.js` | `writeWebDocumentSubmission` | Yes | Persist web submitted doc | submission, roots/storage | submission record | API document submissions | DM-03 |
| Document sync | `packages/document-sync/src/index.js` | `pullWebDocumentSubmissions` | Yes | Import web submissions to local repo | repo, portal, profile | import report | CLI docs sync-web | DM-03 |
| Document sync | `packages/document-sync/src/index.js` | `importLocalDocument` | Yes | Import local doc as JSON memory | repo, source path, metadata | imported path | CLI docs import | DM-03 |
| Diagram | `packages/diagram-generator/src/index.js` | `DIAGRAM_TYPES` | Yes | Diagram type constants | none | type map | CLI/tests | DG-01 |
| Diagram | `packages/diagram-generator/src/index.js` | `generateDiagramBundle` | Yes | Generate selected diagrams | workspace state, types, task, target | bundle | CLI/profile sync | DG-01, DG-02, DG-03 |
| Diagram | `packages/diagram-generator/src/index.js` | `writeDiagramBundle` | Yes | Write `.mmd` artifacts and manifest | repo root, bundle | artifact paths/manifest | CLI | DG-01 |
| Diagram | `packages/diagram-generator/src/index.js` | `syncRepositoryProfile` | Yes | Publish profile, diagrams, code graph, docs | repo, workspace, bundle, roots | sync result | CLI diagram sync | DG-01, DM-03 |
| Diagram | `packages/diagram-generator/src/index.js` | `prepareRepositoryProfileArtifact` | Yes | Build web-safe profile artifact | repo, workspace, bundle, artifacts | profile artifact | CLI remote sync | DG-01 |
| Diagram | `packages/diagram-generator/src/index.js` | `resolveDiagramTypes` | Yes | Validate requested diagram type | requested type | type list or error | CLI | DG-01 |
| Diagram | `packages/diagram-generator/src/index.js` | `generateSymbolGraphDiagram`, `generateHighLevelDiagram`, `generateComponentDiagram`, `generateClassDiagram`, `generateSequenceDiagram`, `generateMindmapDiagram` | Internal | Build Mermaid content | workspace state/options | diagram | generateDiagramBundle | DG-02, DG-03 |
| Diagram | `packages/diagram-generator/src/index.js` | `finalizeDiagram`, `validateDiagram`, `buildDiagramTrust` | Internal | Attach trust/validation metadata | diagram | finalized diagram | generateDiagramBundle | DG-01 |
| Diagram | `packages/diagram-generator/src/index.js` | `buildSequenceInteractions`, `collectRelevantRoutes`, `buildRouteTraceInteractions` | Internal | Route/call sequence evidence | graph/routes/task | interactions | sequence diagram | DG-03 |
| Diagram | `packages/diagram-generator/src/index.js` | `validateDiagramManifestV2` | No | Validate v2 diagram manifest | manifest | validation result | portal/admin/tests | DG-01 |
| Benchmark | `packages/benchmark/src/framework.js` | `loadBenchmarkScenarioManifest` | Yes | Load scenario JSON and dataset | scenario ref, repo root | scenario manifest | CLI/benchmark | BR-01 |
| Benchmark | `packages/benchmark/src/framework.js` | `loadBenchmarkDatasetManifest` | Yes | Load dataset JSON | dataset ref, repo root | dataset manifest | scenarios | BR-01 |
| Benchmark | `packages/benchmark/src/framework.js` | `listBenchmarkScenarioManifests` | Yes | List scenario manifests | repo root | scenario list | suite run | BR-01 |
| Benchmark | `packages/benchmark/src/framework.js` | `normalizeEvaluationConfig` | Yes | Normalize weights/targets/rubric | evaluation config | normalized config | run normalize | BR-01 |
| Benchmark | `packages/benchmark/src/framework.js` | `normalizeBenchmarkRun` | Yes | Score one run | run input, evaluation | normalized run/scorecard | compare | BR-01 |
| Benchmark | `packages/benchmark/src/framework.js` | `mergeObservedRunIntoBenchmarkInput` | Yes | Apply captured usage telemetry | input, observed run | benchmark input | CLI observed reports | BR-02 |
| Benchmark | `packages/benchmark/src/framework.js` | `buildFrameworkSummary` | Yes | Summarize scenario/dataset/eval | manifests/evaluation | framework summary | reports | BR-01 |
| Benchmark | `packages/benchmark/src/framework.js` | `buildBenchmarkDeltaMetrics` | Yes | Compute score deltas | baseline, assisted | metric deltas | compare | BR-01 |
| Benchmark | `packages/benchmark/src/framework.js` | `createSuiteReport` | Yes | Aggregate scenario reports | reports, repo, profile | suite report | `benchmark run --all` | BR-03 |
| Benchmark | `packages/benchmark/src/framework.js` | `renderScenarioReportMarkdown`, `renderSuiteReportMarkdown` | Yes | Human-readable reports | report/suite | markdown | report writers | BR-01 |
| Benchmark | `packages/benchmark/src/index.js` | `compareBenchmarkRuns` | Yes | Build scenario comparison report | baseline, assisted, metadata | report | benchmark run/compare | BR-01 |
| Benchmark | `packages/benchmark/src/index.js` | `runBenchmarkScenario` | Yes | Run one scenario manifest | scenario ref, options | report | CLI | BR-01 |
| Benchmark | `packages/benchmark/src/index.js` | `runBenchmarkSuite` | Yes | Run all/listed scenarios | options | suite + scenario runs | CLI | BR-03 |
| Benchmark | `packages/benchmark/src/index.js` | `writeBenchmarkReport` | Yes | Persist JSON/Markdown report | repo root, report | paths | CLI | BR-01 |
| Benchmark | `packages/benchmark/src/index.js` | `writeBenchmarkSuiteReport` | Yes | Persist suite JSON/Markdown | repo root, suite | paths | CLI | BR-03 |
| Benchmark | `packages/benchmark/src/index.js` | `writeBenchmarkEvidenceBundle` | Yes | Persist evidence files | report, inputs, scenario/dataset | bundle manifest | CLI | BR-01 |
| Benchmark | `packages/benchmark/src/index.js` | `publishBenchmarkReport` | Yes | Persist/sync sanitized report | report, roots/storage | destinations | CLI/API | BR-03 |
| Benchmark | `packages/benchmark/src/index.js` | `prepareBenchmarkReportArtifact` | Yes | Build web-safe report | report | artifact | remote sync | BR-03 |
| Benchmark | `packages/benchmark/src/trends.js` | `buildBenchmarkTrendDigest` | Yes | Summarize report trends | reports | trend digest | portal/admin helpers | BR-03 |
| Benchmark | `packages/benchmark/src/index.js` | `createBenchmarkRunSet` | No | Canonical baseline+assisted run set | scenario, baseline, assisted, metadata | run set | runner/evidence | BR-01, BR-02 |
| Benchmark | `packages/benchmark/src/index.js` | `captureBenchmarkArtifact` | No | Capture raw prompt/tool/patch/eval artifact | run id, artifact type, payload | artifact ref | runner | BR-01 |
| Connect | `packages/connect/src/detect.js` | `detectAgents`, `detectConnections` | Yes | Detect agent hosts and models | repo root, detectors | inventory | CLI connect | IT-03 |
| Connect | `packages/connect/src/planner.js` | `buildInstallPlan` | Yes | Build MCP install plan | client, scope, repo, model | plan | CLI connect | IT-03 |
| Connect | `packages/connect/src/install.js` | `installConnection` | Yes | Mutate allowlisted agent config | client, plan/model | verification result | CLI connect | IT-03 |
| Connect | `packages/connect/src/verify.js` | `verifyConnection` | Yes | Run stdio MCP handshake | client, repo, plan | status report | CLI connect | CC-03 |
| Connect | `packages/connect/src/verify.js` | `runConnectDoctor` | Yes | Diagnose connect setup | repo root | status/actions | CLI connect | IT-03 |
| Connect | `packages/connect/src/agent-adapters/*.js` | `detectCursor`, `detectClaudeCode`, `detectContinue` | Yes | Adapter-specific config detection | repo/env/exec | detection records | detectConnections | IT-03 |
| Connect | `packages/connect/src/agent-adapters/*.js` | `buildCursorInstallPlan`, `buildClaudeCodeInstallPlan`, `buildContinueInstallPlan` | Yes | Adapter-specific install plans | scope, repo, model | plan | buildInstallPlan | IT-03 |
| Connect | `packages/connect/src/model-adapters/*.js` | `detectOllama`, `detectLmStudio` | Yes | Detect local model runtimes | fetch impl | model records | detectConnections | IT-03 |
| Hosted API | `services/api/src/server.js` | `startServiceHost` | Yes | Start local API host | port/host/storage options | server/url/config | CLI agent run, tests | BR-02 |
| Hosted API | `services/api/src/http.js` | `handleServiceHttpRequest` | Yes | Main HTTP router | Request, config | Response | API host | DM-03, BR-03 |
| Hosted API | `services/api/src/http.js` | `resolveHttpConfig` | Yes | Resolve API roots/security/rate limits | options/env | config | API host/tests | BR-03 |
| Hosted API | `services/api/src/index.js` | `apiManifest.endpoints` | Yes | Enumerate service endpoints | none | endpoint list | docs/tests/apps | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /health` | Yes | Health status | request | service status | ops/tests | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /metrics` | Yes | Prometheus traffic metrics | query window | text metrics | ops/admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/auth/providers` | Yes | Public auth provider list | surface/return_to | provider metadata | portal/admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /auth/authorize/:providerId` | Yes | Start OIDC flow | provider, query | redirect | portal/admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /auth/callback/:providerId` | Yes | Complete OIDC flow | provider, code/state | redirect/session cookie | portal/admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET/POST /api/session` and `/api/admin/session` | Yes | Read/issue workspace session | cookie/header/body | session/account | portal/admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `POST /api/session/provider` and `/api/admin/session/provider` | Yes | Exchange hosted provider token | provider id, id token | session | CLI/auth | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/account` | Yes | Portal account view | session | actor/workspace/providers | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/overview` | Yes | Portal overview | session | summary | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/usage/summary` | Yes | Portal usage metrics | session/window | usage summary | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/billing` | Yes | Portal billing snapshot | session | billing data | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/members` | Yes | Portal members | session | member list | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/policies` | Yes | Portal policy view | session | policy summary | portal | IT-02, BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/security` | Yes | Portal security view | session | security/audit summary | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/settings` | Yes | Portal settings | session | settings view | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/sessions` | Yes | Portal sessions | session/query | redacted sessions | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/audit/events` | Yes | Portal tenant audit events | session/query | events | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET/POST /api/workspaces` and `/api/admin/workspaces` | Yes | List/provision workspaces | session/body | workspaces/result | portal/admin | DM-03, BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET/POST /api/repositories` and `/api/admin/repositories` | Yes | List/write repository profiles | session/body | profiles/result | CLI sync, portal/admin | DG-01 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/repositories/:slug` and `/api/admin/repositories/:slug` | Yes | Repository detail/profile/code graph | slug, graph mode | repository view | portal/admin | DG-02 |
| Hosted endpoint | `services/api/src/http.js` | `GET/POST /api/documents` and `/api/admin/documents` | Yes | List/write document artifacts | session/body | document view/result | CLI sync, portal/admin | DM-03 |
| Hosted endpoint | `services/api/src/http.js` | `POST /api/documents/submissions` and `/api/admin/documents/submissions` | Yes | Submit web document memory | profile, title, body | submission | portal/admin | DM-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET/POST /api/benchmarks` and `/api/admin/benchmarks` | Yes | List/write benchmark reports | session/body/query | reports/result | CLI sync, portal/admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/benchmarks/:reportId` and admin variant | Yes | Load benchmark report | report id | report | portal/admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET/POST /api/benchmarks/runs` | Yes | List/start portal benchmark launches | workspace, body | capability/launches/result | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/benchmarks/runs/:launchId` | Yes | Load benchmark launch detail | launch id | launch detail | portal | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `POST /api/public/intake` | Yes | Capture public website lead | intake body | intake record | website/admin | Post-MVP |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/admin/intake` | Yes | Admin intake listing | admin session/query | requests/summary | admin | Post-MVP |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/admin/overview` | Yes | Admin overview | admin session | overview | admin | Post-MVP |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/admin/customers/inventory` | Yes | Admin customer inventory | admin session | customers | admin | Post-MVP |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/admin/billing-ops` | Yes | Admin billing ops | admin session | billing ops | admin | Post-MVP |
| Hosted endpoint | `services/api/src/http.js` | `GET/POST /api/admin/sessions` | Yes | Admin session audit/revoke | query/body | redacted sessions/revoked count | admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/admin/audit/events` | Yes | Admin audit events | query | JSON/NDJSON events | admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/admin/observability/requests` | Yes | Admin request traces | query/window | traces | admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/admin/observability/metrics` | Yes | Admin traffic metrics | query/window | summary | admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET /api/admin/observability/alerts` | Yes | Admin operational alerts | query/window | alerts | admin | BR-03 |
| Hosted endpoint | `services/api/src/http.js` | `GET/POST /api/admin/observability/exports` | Yes | List/flush observability exports | query/body | exports/delivery | admin | BR-03 |
| Hosted endpoint | `services/api/src/llm-proxy.js` | `/proxy/openai/runs/:runId/v1/*` | Yes | OpenAI-compatible proxy with telemetry | OpenAI-compatible request | proxied response + llm_call records | agent run/benchmark capture | BR-02 |
| Hosted storage | `services/api/src/storage.js` | `writeRepositoryProfileArtifactRecord`, `writeRepositoryDocumentArtifactRecord`, `writeBenchmarkArtifactRecord` | Yes | Tenant-scoped artifact persistence | storage root, artifact | persisted paths/records | API/CLI sync | DG-01, DM-03, BR-03 |
| Hosted storage | `services/api/src/storage.js` | `publishProfilesToSurface`, `publishDocumentsToSurface`, `publishBenchmarksToSurface`, `publishWorkspacesToSurface` | Yes | Mirror service artifacts to app public roots | service root, surface root | published files | portal/admin | DG-01, DM-03, BR-03 |
| Hosted storage | `services/api/src/storage.js` | `writeAgentRunRecord`, `writeLlmCallRecord`, `loadAgentRunCapture` | Yes | Persist observed run telemetry | run/call/run id | records/capture | proxy/CLI benchmark | BR-02 |
| Hosted write access | `services/api/src/write-access.js` | `provisionWorkspaceForActor`, `writeRepositoryProfileForActor`, `writeRepositoryDocumentsForActor`, `writeBenchmarkReportForActor` | Yes | Tenant-scoped writes with auth context | auth context, payload | persisted result | HTTP routes | DM-03, BR-03 |
| Hosted access | `services/api/src/access.js` | `listAccessibleWorkspacesPage`, `listAccessibleRepositoryProfilesPage`, `loadAccessibleRepositoryView`, `loadAccessibleDocumentsView`, `loadAccessibleBenchmarkIndexPage`, `loadAccessibleBenchmarkReport` | Yes | Tenant-scoped hosted reads | auth/surface/query | filtered resources | HTTP routes | BR-03 |
| Hosted launcher | `services/api/src/benchmark-launcher.js` | `resolveWorkspaceBenchmarkRunnerCapability`, `requestWorkspaceBenchmarkLaunch`, `listWorkspaceBenchmarkLaunches`, `loadWorkspaceBenchmarkLaunchDetail` | Yes | Portal benchmark runner bridge | workspace/session/payload | capability/launch detail | API/portal | BR-03 |
| Hosted migration | `services/api/src/migration.js` | `exportCanonicalSnapshot`, `writeCanonicalSnapshot`, `createPostgresMigrationPlan` | Yes | Service export/migration plan | service root/out | snapshot/plan | `heart service export` | BR-03 |
| Test helpers | `tests/helpers/temp-repo.js` | `createTempRepoCopy`, `appendFileWithFreshMtime`, `writeFileWithFreshMtime` | Yes | Deterministic temp fixture repos | test context/files | temp repo/path | tests | All |
| Test helpers | `tests/helpers/typed-graph-fixture.js` | `writeTypedGraphFixture`, `loginFlowTest` | Yes | Typed graph fixture setup | repo root | fixture files/test flow | graph/context tests | TG-02, TG-04 |
| Test helpers | `tests/helpers/connect-test-context.js` | `createConnectTestContext` | Yes | Connect fixture env | test context | repo/env helpers | connect tests | IT-03 |

## 4. Missing Function List

| Proposed name | Package | Reason | Story dependency | Input/output contract | Test needed |
|---|---|---|---|---|---|
| `validateGraphSnapshotV2` | `packages/shared-schema` or `packages/graph` | Prevent schema drift across cache, MCP, diagrams, and benchmark artifacts | TG-01 | Input: candidate snapshot. Output: `{ valid, errors, warnings }`. | Graph fixture with valid v2, missing required fields, unknown edge types. |
| `createGraphSnapshotV2` | `packages/graph` | Current snapshot lacks explicit schema version/provenance/confidence | TG-01 | Input: graph, scan provenance. Output: `GraphSnapshotV2`. | Cache round-trip preserves schema fields. |
| `normalizeGraphNodeV2` | `packages/shared-schema` | Need confidence/source/span/hash defaults without duplicate ad hoc node builders | TG-01 | Input: node-like object. Output: normalized node or validation error. | Node type/metadata validation fixtures. |
| `normalizeGraphEdgeV2` | `packages/shared-schema` | Need provenance/confidence on `CALLS`, `TESTED_BY`, `DOCUMENTS`, `IMPACTS`, reuse edges | TG-01 | Input: edge-like object. Output: normalized edge or validation error. | Edge type/provenance validation fixtures. |
| `extractCallsFromContent` | `packages/parser-ts` | Calls extraction exists only internal, making targeted tests/tools harder | TG-02 | Input: source text, relative path. Output: call records. | Direct/imported/method call fixtures. |
| `extractTestReferencesFromContent` | `packages/parser-ts` | Test linkage is graph-internal and should have parser-level evidence where possible | TG-04 | Input: test source/path. Output: referenced symbols/files. | `.test`, `.spec`, `__tests__` fixtures. |
| `deriveImpactEdges` | `packages/graph` | `IMPACTS` is required by v2 but not in shared schema/current graph | TG-03 | Input: graph, optional changed files/symbols. Output: `IMPACTS` edges/evidence. | Impact fixture proves imports+calls+tests contribute. |
| `detectReuseCandidates` | `packages/graph` | Reuse candidates are currently compiler-local heuristic output | TG-04 | Input: graph, task/query, options. Output: candidates with file/symbol/reason/confidence. | Reuse-heavy benchmark fixture. |
| `linkDocumentsToGraph` | `packages/entity-linker` or `packages/graph` | Document links exist in heart model but not as v2 graph edges | DM-02 | Input: graph, heart model. Output: graph with `DOCUMENTS`/`CONSTRAINS` edges or edge list. | Decision/requirements docs link to modules. |
| `validateContextPackV2` | `packages/context-compiler` or `packages/shared-schema` | Pack contract is central to CLI/MCP/benchmark and should be validated | CC-01 | Input: pack. Output: `{ valid, errors }`. | Golden full/budgeted pack fixtures. |
| `rankContextCandidates` | `packages/context-compiler` | Ranking is private; v2 risks duplicate ranking in diagrams/benchmarks | CC-02 | Input: task, graph, doc index, policy report, heart model. Output: ranked files/symbols/docs/tests/reuse. | Stability fixture across repeated runs. |
| `trimContextPackToBudget` | `packages/context-compiler` | Budget trimming exists inside `finalizeContextPack`; explicit API would support tests and MCP | CC-01 | Input: pack, token budget. Output: trimmed pack with `estimated_tokens` and `truncated`. | Boundary budgets preserve key citations/tests. |
| `emitContextCitations` | `packages/context-compiler` | Citation rules are private; benchmark evidence needs stable citation summaries | CC-02, BR-01 | Input: selected evidence. Output: normalized citations with type/rank/confidence. | Citation rank/type/count fixture. |
| `validateDiagramManifestV2` | `packages/diagram-generator` or `packages/shared-schema` | Current manifest is v1 and not strictly validated | DG-01 | Input: manifest. Output: `{ valid, errors }`. | Portal/admin fixture accepts v1 and v2. |
| `generateDiagramManifestV2` | `packages/diagram-generator` | Manifest shape should be explicit and separate from file writing | DG-01 | Input: bundle/artifacts. Output: v2 manifest. | Manifest golden snapshot. |
| `redactContextArtifact` | `packages/document-ingest` or new `packages/security` | Redaction logic is document-local; context/benchmark artifacts also need reusable redaction | DM-01, BR-01 | Input: artifact, policy/options. Output: redacted artifact + findings. | Secret patterns in pack/doc/benchmark outputs. |
| `validateDocumentArtifactV2` | `packages/document-ingest` or `packages/shared-schema` | Document sync and context need a stable contract | DM-01 | Input: document artifact. Output: validation result. | Docx/pdf/restricted/latest-lineage fixtures. |
| `syncImportedDocumentsIntoNextScan` | `packages/document-sync` or `packages/core` | Current pieces exist; explicit API would make round-trip behavior obvious | DM-03 | Input: repo root, profile slug, source. Output: imported files and next document roots. | Web submission affects next `heart docs search`. |
| `createBenchmarkRunSet` | `packages/benchmark` | Need first-class paired baseline/assisted run model | BR-01, BR-02 | Input: scenario, baseline run, assisted run, repo snapshot. Output: run set with fairness metadata. | Requires same scenario/model/repo snapshot. |
| `captureBenchmarkArtifact` | `packages/benchmark` | Raw prompts/tool outputs/patches/eval outputs are not complete in evidence bundle | BR-01 | Input: run id, type, payload/path, sensitivity. Output: artifact reference. | Sensitive raw artifact remains local/sanitized. |
| `evaluateBenchmarkRunSet` | `packages/benchmark` | Scoring should consume same run set used by reports | BR-01 | Input: run set, rubric. Output: evaluation result and scorecard. | Manager/technical reports match same evidence. |
| `publishBenchmarkTrends` | `services/api` or `packages/benchmark` | Trends exist as digest helpers, but hosted publication contract is implicit | BR-03 | Input: report history/workspace. Output: trend artifact. | Tenant-scoped trend read fixtures. |

## 5. Implementation Sequence

| Story batch | Why now | Blocking dependencies | Validation command | Expected artifact |
|---|---|---|---|---|
| Batch 1: IT-01, IT-02 | Trust starts with clean input and real config/policy behavior | none | `npm test -- tests/config-loading.test.js tests/workspace-ignore-defaults.test.js tests/policy-engine.test.js tests/workspace-storage.test.js` | stable scan/doctor/policy contracts |
| Batch 2: IT-03, TG-01 | Every later layer needs readiness and a versioned graph contract | Batch 1 | `npm test -- tests/cli-contracts.test.js tests/parser-graph.test.js tests/workspace-storage.test.js` | `GraphSnapshotV2` and readiness profile |
| Batch 3: TG-02, TG-03, TG-04 | Context and diagrams depend on real relationship evidence | Batch 2 | `npm test -- tests/parser-graph.test.js tests/context-pack.test.js tests/mcp-server.test.js` | typed relationship queries, reuse/test evidence |
| Batch 4: CC-01, CC-02, CC-03 | Agent-facing memory is the product wedge | Batch 3 | `npm test -- tests/context-pack.test.js tests/cli-contracts.test.js tests/mcp-server.test.js tests/mcp-stdio.test.js` | validated compact context pack contract |
| Batch 5: DG-01, DG-02, DG-03 | Diagrams should consume stable graph/pack evidence after contracts settle | Batch 3, CC-02 | `npm test -- tests/diagram-generator.test.js tests/web-surfaces.test.js tests/service-http-repository-detail.test.js` | v2 diagram manifest and honest diagrams |
| Batch 6: DM-01, DM-02, DM-03 | Document memory must stay safe and linked before ROI claims | Batch 1, TG-01, CC-02 | `npm test -- tests/document-ingest.test.js tests/document-sync.test.js tests/entity-linker.test.js tests/context-pack.test.js` | document artifact v2 and doc-to-graph evidence |
| Batch 7: BR-01, BR-02 | Benchmark claims need stable pack and evidence contracts | Batch 4, DM-01 | `npm test -- tests/benchmark.test.js tests/cli.test.js tests/service-http-llm-proxy.test.js tests/service-http-benchmarks.test.js` | local evidence-rich benchmark report |
| Batch 8: BR-03 | Hosted trend views are useful after local proof is credible | Batch 7 | `npm test -- tests/benchmark-trends.test.js tests/service-http-enterprise.test.js tests/dashboard-visual-helpers.test.js` | tenant-safe benchmark trend surfaces |

## 6. First Sprint Backlog

Smallest vertical slice: prove that one repo can be scanned cleanly, queried with a compact context pack, and benchmarked with traceable evidence without leaving local-first workflow.

Sprint goal:

- Run `heart init`, `heart doctor`, `heart scan`, `heart pack --token-budget 1200 "add login audit logging"`, `heart mcp tools`, and `heart benchmark run login-audit-flow`.
- Show generated artifacts are excluded, config/policy are honored, context pack has citations and reuse/test evidence, and benchmark output records the assisted context evidence.

Backlog:

1. IT-01: Add/verify scan truthfulness fixture that includes generated `.next`, `.heart/diagrams`, and custom ignore paths.
2. IT-02: Add/verify strict policy validation and doctor surfacing for invalid policy shape.
3. TG-01: Add `GraphSnapshotV2` schema fields additively: `schema_version`, `generated_at`, `scan_provenance`, confidence/provenance defaults.
4. TG-04: Stabilize reuse/test evidence returned by graph/context fixtures.
5. CC-01: Add context pack schema validation and budgeted golden fixture.
6. BR-01: Add evidence bundle fields tying assisted benchmark report to context pack citation/compactness summary.

Prioritization fit:

- Trust/correctness: clean scan, strict policy/config, validated graph/pack schemas.
- Measurable savings: budgeted context pack and benchmark evidence.
- Adoption ease: CLI path stays local-first and existing commands remain unchanged.
- Local-first workflow: all artifacts stay under repo-local `.heart/` unless user syncs.

Suggested sprint validation:

```bash
npm test -- tests/config-loading.test.js tests/workspace-ignore-defaults.test.js tests/policy-engine.test.js tests/parser-graph.test.js tests/context-pack.test.js tests/benchmark.test.js tests/cli-contracts.test.js
```

Expected sprint artifact:

- Passing tests for truthfulness, graph snapshot v2, budgeted context pack, and benchmark evidence.
- Updated docs only if behavior or contracts changed.
- No new hosted feature surface unless required to preserve existing sync behavior.

## 7. AI Follow-up Instructions

Before implementing, another AI agent should:

1. Read `AGENTS.md`, then the required docs in this order: `docs/00-executive-summary.md`, `docs/02-prd.md`, `docs/03-technical-architecture.md`, `docs/04-mcp-cli-spec.md`, `docs/06-benchmark-framework.md`, `docs/08-roadmap-operating-model.md`, `docs/10-user-stories.md`, `docs/11-implementation-blueprint-v2.md`, and this plan.
2. Read relevant local skills before changing code: `project-owner`, `business-analyst`, `core-architecture`, `qa-engineering`, `security-engineering`, `cli-engineering`, `cli-ux`, `mcp-runtime`, and `benchmark-roi`.
3. If `graphify-out/` exists, read `graphify-out/GRAPH_REPORT.md` first and use graphify wiki/query/path/explain before broad raw-file search.
4. Inspect existing code before creating modules. Reuse package ownership already present:
   - `packages/core` for config/cache/workspace lifecycle.
   - `packages/parser-ts` for TS/JS extraction.
   - `packages/graph` for graph schema/build/query.
   - `packages/context-compiler` for ranking/pack schema.
   - `packages/document-ingest` and `packages/document-sync` for document memory.
   - `packages/diagram-generator` for human-facing diagrams.
   - `packages/mcp-server` for MCP transport/tools.
   - `packages/benchmark` for benchmark scenarios/reports/evidence.
   - `services/api` for tenant-scoped hosted persistence only.
5. Avoid duplicate modules. If a helper exists privately, decide whether to export it, test it through public behavior, or document why it remains private.
6. Keep package boundaries clean: `packages/*` must not depend on `apps/*`; `services/*` may depend on `packages/*` but not `apps/*`; `apps/*` keep UI-specific code local.
7. Update docs when behavior, command contracts, schemas, or architecture boundaries change.
8. Run focused tests for the touched area plus `npm test` before release-facing merge when feasible.
9. Never hardcode secrets, tokens, API keys, customer data, or raw sensitive documents. Redact context, docs, benchmark, and hosted artifacts by default.
10. Keep outputs deterministic and script-friendly. JSON mode must not mix prose on stdout.
11. After modifying code files, run `graphify update .` if graphify artifacts are available.
12. Mark MVP vs post-MVP in new stories and PR notes. Do not expand product scope beyond v2 without explicit user direction.
