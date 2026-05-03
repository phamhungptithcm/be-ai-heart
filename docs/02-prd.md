# Product Requirements Document

## Product Name

`be-ai-heart`

## Problem Statement

AI coding assistants are stateless relative to the software system they operate in. Even when they can inspect files, they lack durable project memory, architecture awareness, and measurable cost controls. This leads to prompt bloat, inconsistent changes, duplicate implementations, and low organizational trust.

## Goal

Create a platform that builds persistent repo and document memory, serves high-signal context to AI tools, gives users a provider-neutral AI workbench, and produces benchmark evidence so teams can reduce repeated discovery, improve reuse, and govern AI coding work.

## Non-Goals for MVP

- Replacing the full IDE or code editor. The CLI workbench is an AI coding command surface, not a source editor.
- Training custom foundation models
- Fully autonomous software delivery
- Supporting every language on day one
- Building a full CRM from scratch before product-market validation
- Running live payment, billing, or customer account mutations from AI chat
- Claiming proven ROI without benchmark evidence

## Primary Users

- AI-heavy software engineers
- Tech leads
- Platform engineering teams
- Engineering managers
- Enterprise admins

## MVP Scope

### 1. Code Graph Engine

Must:

- Scan a repository
- Parse files into symbol-level metadata
- Track modules, classes, functions, interfaces, files, imports, call relationships, and ownership tags
- Detect duplicated or overlapping functionality heuristically
- Store graph snapshots and diffs

### 2. Context Compiler

Must:

- Take a task intent or question
- Retrieve the smallest useful context set
- Return architecture notes, relevant symbols, reuse candidates, and warnings
- Return relevant business, requirements, and system design documents when they affect the task
- Rank results by relevance and reuse likelihood

### 3. CLI

Must:

- Initialize project config
- Scan and build graph locally
- Inspect symbols and module dependencies
- Generate task-specific context packs
- Import and sync project docs/specs
- Browse and build domain-pack artifacts
- Configure model providers and local BYOK credentials
- Run one-shot AI chat with selected repo/domain context
- Run benchmark suites
- Launch local MCP server

### 3.5. Interactive CLI AI Workbench

Must:

- Open when `heart` runs in an interactive TTY
- Show repo memory, config, policy, docs/spec, MCP, benchmark, model, provider-key, context, and allowlisted-tool status
- Support slash commands and natural aliases for scan, overview, pack, docs, domain packs, benchmark, connect, MCP, model, and chat workflows
- Stay script-safe: no workbench decoration in `--json`, MCP stdio, CI, or non-TTY command runs

### 4. MCP Runtime

Must:

- Expose codebase understanding to any MCP-compatible AI client
- Provide machine-readable tool responses
- Support task-focused queries such as symbol lookup, impact analysis, and context pack generation
- Respect `mcp.enabled_tools` allowlists and expose domain-pack and benchmark-summary tools only when enabled

### 4.5. AI Agent and Model Provider Layer

Must:

- Support provider-neutral model selection through CLI and portal contracts
- Support BYOK for OpenAI, Anthropic, Gemini, OpenRouter, Mistral, and Groq where adapters exist
- Use dynamic model discovery when credentials are available and dated fallback manifests otherwise
- Mask all provider keys in CLI, API, logs, portal, benchmark artifacts, and reports
- Attach repo memory, graph, docs/specs, domain packs, and benchmark evidence with explicit source labels
- Keep tool execution allowlisted and confirmation-aware

### 5. Rules and Guardrails

Must:

- Let teams define architecture rules and coding conventions
- Mark preferred modules and deprecated modules
- Warn when requested work appears to duplicate existing capability

### 6. Benchmarking

Must:

- Compare AI workflows with and without `be-ai-heart`
- Measure token usage, time-to-acceptable-change, duplication, and rule compliance
- Produce shareable reports for internal stakeholders and prospects
- Support domain-pack scenarios, including Tolling Management tasks
- Separate observed telemetry from estimated or scenario-derived values

### 7. Web Portal, Admin, and Website

Must:

- Keep website, portal, and admin as separate surfaces
- Let portal users inspect synced repo profiles, docs/spec status, graph, diagrams, context pack previews, benchmark reports, domain packs, model settings, chat command records, billing posture, team access, and security posture
- Let admin users inspect internal customer, support, revenue, billing ops, sessions, audit, observability, and benchmark posture
- Treat portal chat as allowlisted product actions over synced artifacts, not arbitrary shell access

### 8. Domain Packs

Must:

- Provide source-backed reusable domain memory outside one customer repo
- Support layers for core, regional, agency/operator, customer, and accepted customer docs
- Surface citations, conflicts, security warnings, and generated-artifact labels
- Start with the Tolling Management Domain Pack and Tolling Sales MVP Demo Kit
- Generate only demo-safe artifacts unless a future production domain-pack runtime is explicitly designed

## Post-MVP Scope

- Shared team graph service
- SaaS workspace
- Multi-repo graph
- SSO and RBAC
- Audit logs
- Billing provider and license management integration
- Enterprise model administration
- Admin dashboard hardening
- Multi-language support
- VPC/on-prem deployment
- Backup, restore, retention, export, and private deployment operations
- Additional domain packs

## Functional Requirements

### Repository Intake

- Support Git repositories from local path first
- Ignore build artifacts, generated files, and vendor folders
- Detect framework and language automatically
- Allow manual overrides in `heart.config.yaml`

### Project Document Intake

- Scan business, technical, system design, and requirement documents from configured project paths
- Classify documents into durable categories for retrieval
- Include document metadata and summaries in the heart knowledge layer
- Keep sensitive or ignored documents out of the retrieval path

### Graph Modeling

- Node types: repo, package, module, file, class, function, interface, test, owner, decision, policy
- Edge types: imports, calls, implements, extends, owns, depends_on, tested_by, violates, related_to
- Persist per-scan metadata: hash, timestamps, commit ref, language, parser version
- Model project documents and their relationship to implementation domains in later iterations
- Keep docs/spec/business requirement sync explicit through document memory, imported docs, planning change requests, and portal document status views

### Querying

- Search by symbol name
- Search by responsibility or natural language intent
- Explain module relationships
- Estimate impact radius of a change
- Suggest reusable code paths

### Context Pack Output

- Summary of project or subdomain
- Relevant files and symbols
- Relevant project documents
- Existing reusable components
- Architecture constraints
- Risks and unanswered questions
- Suggested starting points for implementation

### Governance

- Rule files stored in repo
- Warnings for banned imports or deprecated modules
- Recommended file ownership boundaries

### Benchmark Output

- Baseline prompt token usage or observed usage telemetry
- `be-ai-heart` token usage or observed usage telemetry
- Delta in review edits
- Duplicate work indicators
- Architecture compliance score
- Estimated cost savings
- Measurement mode: `observed`, `estimated`, or mixed when applicable
- Evidence manifest with sanitized repo snapshot, provider/model, task, run IDs, and artifact list

### Domain Pack Output

- Pack metadata and source notes
- Layer selections and effective rules
- Conflict report
- Security warnings
- Generated artifact manifest
- Demo-safe files for supported outputs such as `sales-demo-kit`, `website`, `ui-prototype`, `proposal`, `benchmarks`, and `context-pack`

## User Experience Requirements

- CLI must feel local, fast, and obvious
- Setup must take under 10 minutes for a happy path repo
- Local-only mode must work without cloud dependency
- MCP responses must be compact and structured
- The interactive CLI workbench must make next actions and risk visible without blocking direct commands
- Portal chat must show stale/synced state and reject arbitrary shell-like input
- Provider/model selection must show key status without exposing key material
- Benchmark report must be boardroom-friendly, not just engineer-friendly

## Quality Requirements

- Fast incremental re-indexing
- Deterministic outputs where practical
- Clear error reporting
- Secure local secret handling
- High observability in shared/hosted deployments
- Tenant-scoped hosted access for synced artifacts
- Redaction for context packs, docs/spec previews, domain-pack artifacts, and benchmark reports
- Payment and billing readiness through adapter contracts, not raw payment handling

## Open Questions

- Which customer segment should drive the first customer-calibrated observed benchmark set
- How much portal chat should execute remotely versus prepare local CLI/MCP actions
- Which billing provider and entitlement adapter should be integrated first
- Which SSO/RBAC/private deployment controls are required before first enterprise pilot
- Which additional domain pack should follow Tolling Management
