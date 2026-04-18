# Product Requirements Document

## Product Name

`be-ai-heart`

## Problem Statement

AI coding assistants are stateless relative to the software system they operate in. Even when they can inspect files, they lack durable project memory, architecture awareness, and measurable cost controls. This leads to prompt bloat, inconsistent changes, duplicate implementations, and low organizational trust.

## Goal

Create a platform that builds a persistent graph representation of a codebase and serves high-signal context to AI tools so teams can reduce token spend and improve code quality.

## Non-Goals for MVP

- Replacing the IDE
- Training custom foundation models
- Fully autonomous software delivery
- Supporting every language on day one
- Building a full CRM from scratch before product-market validation

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
- Run benchmark suites
- Launch local MCP server

### 4. MCP Runtime

Must:

- Expose codebase understanding to any MCP-compatible AI client
- Provide machine-readable tool responses
- Support task-focused queries such as symbol lookup, impact analysis, and context pack generation

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

## Post-MVP Scope

- Shared team graph service
- SaaS workspace
- Multi-repo graph
- SSO and RBAC
- Audit logs
- Billing and license management
- Admin dashboard
- Multi-language support
- VPC/on-prem deployment

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

- Baseline prompt token usage
- `be-ai-heart` token usage
- Delta in review edits
- Duplicate work indicators
- Architecture compliance score
- Estimated cost savings

## User Experience Requirements

- CLI must feel local, fast, and obvious
- Setup must take under 10 minutes for a happy path repo
- Local-only mode must work without cloud dependency
- MCP responses must be compact and structured
- Benchmark report must be boardroom-friendly, not just engineer-friendly

## Quality Requirements

- Fast incremental re-indexing
- Deterministic outputs where practical
- Clear error reporting
- Secure local secret handling
- High observability in shared/hosted deployments

## Open Questions

- Which language should be prioritized first: TypeScript or Python
- Whether graph storage should start fully relational or hybrid graph-native
- How aggressive duplicate detection should be in MVP
- How much policy enforcement belongs in CLI vs MCP vs cloud control plane
