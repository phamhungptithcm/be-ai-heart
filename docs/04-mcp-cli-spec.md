# CLI and MCP Specification

## Naming

- Binary: `heart`
- MCP server: `heart-mcp`
- Publishable CLI package: `beheart`

The command surface should be obvious and sparse. Do not overload the first release with dozens of verbs.

## Install Contract

The first install path should stay short and memorable.

Preferred global install:

```bash
npm install -g beheart
heart
```

Repo-local install:

```bash
npm install --save-dev beheart
npx heart doctor
```

Packaging rules:

- the published package name is `beheart`
- the installed binary name is `heart`
- the CLI tarball must run outside the monorepo without sibling-package source imports
- `heart connect install --dry-run` from an installed package must generate MCP entries that point to the installed CLI path, not to `packages/cli/bin/heart.js`

## CLI Design Principles

- Predictable
- Local-first
- Short commands
- Machine-readable outputs when needed
- Human-friendly defaults

## Current CLI Surface

The shipped surface is intentionally small. Commands not listed here are not part of the current implementation.

### Project Setup and Workspace Inspection

```bash
heart init
heart doctor
heart scan
heart connect detect
heart connect install --client cursor --scope repo
heart connect verify --client cursor --scope repo
heart connect doctor
```

Purpose:

- `init`: create or repair `heart.config.yaml` and `.heart/policies.yaml`, seed config language priority from detected source languages when possible, and recommend the next local-first commands
- `doctor`: run preflight diagnostics for config, policy, parser availability, effective document roots, ignore paths, cache state, and MCP tool exposure, then emit a top-level readiness status plus next actions
- `scan`: build or refresh graph
- `connect detect`: discover supported local agent-host configs and running local model runtimes without mutating anything
- `connect install`: write an allowlisted local agent-host config entry for `heart mcp serve --root <repo>` and verify the result before claiming success
- `connect verify`: run a real stdio MCP handshake against the configured entry and confirm that `tools/list` succeeds
- `connect doctor`: run support-oriented connect preflight checks and recommend the next local MCP step

### Inspection

```bash
heart overview
heart find symbol loginUser
heart deps src/auth/login.ts
heart impact src/billing/service.ts
heart policy check
heart docs search "login audit requirements"
heart diagram generate mindmap
heart diagram sync
```

Purpose:

- `overview`: summarize system domains and architecture
- `overview --json`: include the reusable workspace readiness contract used by CLI, MCP, cache, and benchmark evidence
- `find symbol`: locate symbol definitions and related edges; a miss returns an empty `matches` array without failing the command
- `deps`: explain dependencies; a missing target returns a deterministic `status = not_found` JSON payload and a non-zero exit code
- `deps`: include compact graph evidence, contained symbols, policy violations, and document constraints when graph data has them
- `impact`: estimate blast radius with compact graph evidence; a missing target returns a deterministic `status = not_found` JSON payload and a non-zero exit code
- `policy check`: evaluate architecture rules
- `docs search`: find relevant project documents for a task or domain across markdown, structured JSON/YAML, `docx`, and `pdf` sources using latest-lineage preference plus local semantic retrieval
- `diagram generate`: write Mermaid review artifacts for repository structure, including a `mindmap` view that combines business, requirements, technical documents, and code domains from saved heart memory
- `diagram sync`: publish the current repository profile plus generated diagrams to local and hosted surfaces

### Context for AI

```bash
heart pack --token-budget 1200 "add SSO login audit logging"
heart pack --json "refactor payment retry flow"
heart mcp tools
heart mcp serve
```

Purpose:

- `pack`: build a task-specific context bundle with reuse, policy, and risk signals
- `mcp tools`: list the current MCP tool registry
- `mcp serve`: expose the project through MCP

### Connect Workflow

```bash
heart connect detect [--json] [--root PATH] [--agents] [--models]
heart connect install --client <agent> [--root PATH] [--scope user|repo] [--model <runtime>] [--dry-run] [--backup]
heart connect verify --client <agent> [--root PATH] [--json]
heart connect doctor [--json] [--root PATH]
heart connect help
heart connect --help
```

Purpose:

- `detect`: discover allowlisted agent hosts and local model runtimes without mutating files
- `install`: wire a supported client to `heart mcp serve` and optionally bind a model runtime when the adapter supports it
- `verify`: perform a real MCP handshake before claiming success
- `doctor`: provide support-oriented diagnostics for the connect workflow
- `help` and `--help`: print the connect usage block

Connect output notes:

- `detect` returns `repo_root`, `agents`, `models`, `warnings`, and `recommendations`
- `install --dry-run` returns the generated plan
- `install --backup` creates backups before mutation and returns `backups` metadata in the result when backups are created
- `verify` returns a status report with handshake and spawn details
- `doctor` returns `inventory`, `warnings`, `actions`, and `status`, where `status` is `ready` only after a supported client is configured
- supported v1 install targets are `cursor`, `claude-code`, and `continue`

### Governance and Benchmark

```bash
heart benchmark run login-audit-flow
heart benchmark run login-audit-flow --baseline-run run_baseline_123 --assisted-run run_assisted_123
heart benchmark run --all
heart benchmark capture baseline login-audit-flow --upstream-base-url http://127.0.0.1:8787/v1 -- agent-command ...
heart benchmark capture assisted login-audit-flow --upstream-base-url http://127.0.0.1:8787/v1 -- agent-command ...
heart benchmark compare baseline.json heart.json
heart agent run --mode baseline --upstream-base-url http://127.0.0.1:8787/v1 -- agent-command ...
heart service export
```

Purpose:

- `benchmark run`: execute one predefined scenario or the full scenario suite and persist local benchmark reports plus evidence bundles
- `benchmark capture`: launch a baseline or assisted agent run through the BeHeart OpenAI-compatible proxy and persist `agent_run` plus `llm_call` telemetry
- `benchmark compare`: diff performance and cost metrics and persist a local evidence bundle
- `agent run`: general-purpose launcher for any OpenAI-compatible agent command routed through the BeHeart proxy
- `service export`: produce a canonical service snapshot artifact

Benchmark artifacts:

- scenario reports: `.heart/benchmarks/<report-id>.json` and `.md`
- captured agent runs: `.heart/benchmarks/captures/<run-id>.json`
- evidence bundle: `.heart/benchmarks/evidence/<report-id>/`
- suite reports from `--all`: `.heart/benchmarks/suites/<suite-id>.json` and `.md`

Evidence manifests use schema version 2 and include sanitized scan provenance, workspace readiness, provider, model,
task, measurement mode, run IDs, a compact repo snapshot summary, and a deterministic artifact list. They must not
publish absolute local repo roots.

Portal launcher note:

- when `heart sync profile` publishes a repository profile to the hosted service, the workspace identity may also register local benchmark-runner metadata for the current host
- the portal can only start benchmark runs when that local repo path is still reachable by `services/api`

Observed benchmark inputs:

- `heart benchmark run <scenario> --baseline-run <run-id> --assisted-run <run-id>` loads token, duration, and cost totals from persisted `agent_run` plus `llm_call` telemetry instead of only scenario stub values
- both run IDs are required together, cannot be combined with `--all`, and must match baseline/assisted modes for the selected scenario
- observed run comparisons require completed runs with full provider usage coverage; incomplete captures must be rerun through the Heart proxy before comparing
- estimated and observed values remain separate in reports through `measurement.mode`

Launcher pricing flags:

- `--input-cost-per-1m`
- `--cached-input-cost-per-1m`
- `--output-cost-per-1m`

These flags are accepted by `heart agent run` and `heart benchmark capture` and are used to compute observed USD cost from provider usage totals when the upstream model API does not return cost directly.
Pricing values must be non-negative numbers.
## Recommended Output Style

Human mode:

- compact root help grouped around first-run commands, core inspection, AI workflow, and benchmark entry points
- terse summary
- most relevant files
- warnings
- next actions
- avoid raw debug dumps for first-run commands; `init`, `doctor`, `pack`, and `connect` should point to the next recommended command explicitly
- support `heart <command> --help` for command-local usage instead of forcing users back to the full root help

JSON mode:

- deterministic schema
- stable keys
- suitable for downstream agent tooling
- no mixed prose on stdout when `--json` is requested
- additive fields are acceptable, but existing keys should remain stable and machine-safe

Validation mode:

- `heart.config.yaml` and `.heart/policies.yaml` should be validated against strict key and type expectations
- unknown keys should surface as explicit schema errors
- invalid values should not be silently accepted

## CLI Contract Rules

- Unknown flags must fail fast with a non-zero exit code and a clear error message.
- Typed flags must reject invalid values instead of silently coercing or ignoring them.
- `--token-budget` must be a positive integer.
- numeric flags such as benchmark pricing inputs must reject `NaN`/non-numeric values instead of being passed through.
- Command-specific flags must be rejected when passed to the wrong command surface.

Recommended exit code contract:

- `0`: success
- `2`: invalid usage or invalid flag input
- `3`: target not found for commands such as `deps` and `impact`

## Connect Contracts

`heart connect detect --json` returns:

- `repo_root`
- `agents`
- `models`
- `warnings`
- `recommendations`

`heart connect install --json --dry-run` returns:

- `plan.client`
- `plan.scope`
- `plan.repo_root`
- `plan.config_path`
- `plan.mcp_entry`
- `plan.files_to_backup`
- `plan.files_to_modify`

`heart connect verify --json` returns:

- `client`
- `repo_root`
- `config_status`
- `spawn_status`
- `initialize_status`
- `tools_list_status`
- `model_runtime_status`
- `warnings`
- `status`

`heart connect doctor --json` returns:

- `repo_root`
- `inventory.repo_root`
- `inventory.agents`
- `inventory.models`
- `inventory.warnings`
- `inventory.recommendations`
- `warnings`
- `actions`
- `status`

## Suggested `heart.config.yaml`

```yaml
project:
  name: be-ai-heart-demo
  language_priority:
    - typescript
  entrypoints:
    - src
  ignore:
    - node_modules
    - dist
    - build
    - out
    - coverage
    - vendor
    - .next
    - .turbo
    - .vercel
    - .heart/cache
    - .heart/diagrams
    - .heart/benchmarks

policies:
  rules_file: .heart/policies.yaml

indexing:
  embeddings: local
  incremental: true

knowledge:
  document_paths:
    - docs

mcp:
  enabled_tools:
    - project_overview
    - symbol_lookup
    - dependency_explain
    - context_pack
    - impact_analysis
    - document_search
    - docs_search
    - policy_check
```

Validation notes:

- unknown top-level or nested config keys should mark config status as invalid
- configured `project.ignore` values are additive with built-in generated/vendor defaults when scanning and in `doctor` output
- `knowledge.document_paths` controls document roots, with `.heart/imported-documents` always added for local imported memory
- `mcp.enabled_tools` should reject unknown tool ids
- `indexing.embeddings` is currently limited to `disabled` or `local`

## MCP Tool Surface

### `project_overview`

Returns:

- project summary
- architecture domains
- notable modules
- ownership hints
- workspace readiness when the tool is served from `heart mcp serve`
- memory profile with typed graph readiness, node counts, and edge counts
- recommended agent workflow and next MCP tools

### `symbol_lookup`

Inputs:

- symbol name or path

Returns:

- definition
- file path
- signatures
- related symbols
- usage notes

### `dependency_explain`

Inputs:

- file path or symbol name

Returns:

- incoming and outgoing imports
- incoming and outgoing calls
- inheritance or implementation edges
- related tests

### `context_pack`

Inputs:

- task description
- optional token budget

Returns:

- summary
- token budget and truncation state
- evidence summary with task coverage, citation counts, and compactness score
- relevant files
- relevant symbols
- relevant documents with lineage, extraction metadata, and local semantic scores
- call paths
- tests to run
- graph context with related files, related symbols, and related tests
- citations with stable evidence rank and confidence
- agent contract with evidence order, follow-up tools, and repo-scan guidance
- reuse candidates
- policies
- risks

### `impact_analysis`

Inputs:

- file path or symbol

Returns:

- dependent files
- tests to inspect
- likely risk areas

### `document_search`

`docs_search` is a compatibility alias with the same input and output contract. If either alias is enabled in
`mcp.enabled_tools`, both aliases are exposed because they dispatch to the same document-memory search behavior.

Inputs:

- task, domain, or document concept

Returns:

- relevant documents
- document category
- source type
- freshness metadata
- sensitivity level
- lineage metadata for latest-version selection
- extraction metadata including layout-aware PDF mode, OCR availability flags, and whether local OCR fallback was applied
- lexical and semantic retrieval scores
- summary
- relevance score

Notes:

- document retrieval should prefer the latest document in a lineage by default
- local semantic vectors should help route synonym-heavy queries without requiring a hosted embedding service
- restricted documents may return redacted summaries instead of raw content previews

## MCP Tool Enforcement

- `mcp.enabled_tools` is an allowlist, not documentation-only metadata.
- The allowlist must constrain:
  - `heart mcp tools`
  - MCP stdio `tools/list`
  - MCP stdio `tools/call`
- Disabled tools must not appear as enabled in the registry.
- Calling a disabled tool must return a clear error instead of falling through to the handler.

### `policy_check`

Inputs:

- optional changed files

Returns:

- violations
- warnings
- suggested compliant paths

## AI Interaction Pattern

Recommended agent workflow:

1. Call `project_overview` once at session start
2. Call `context_pack` for each concrete task
3. Call `symbol_lookup` and `impact_analysis` before editing
4. Call `policy_check` before final patch generation

## Best-Practice UX Rules

- Keep `overview` short enough to skim in under 20 seconds
- Keep `pack` results under a target token budget
- Prefer reuse suggestions over broad code dumps
- Prefer document references over re-embedding the same business or system-design context every session
- Always include a “what already exists” section
- Mark uncertainty explicitly rather than hallucinating structure
