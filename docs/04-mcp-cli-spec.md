# CLI and MCP Specification

## Naming

- Binary: `heart`
- MCP server: `heart-mcp`

The command surface should be obvious and sparse. Do not overload the first release with dozens of verbs.

## CLI Design Principles

- Predictable
- Local-first
- Short commands
- Machine-readable outputs when needed
- Human-friendly defaults

## Core CLI Commands

### Project Setup

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

- `init`: create `heart.config.yaml` and `.heart/policies.yaml`, detect the primary language/runtime, and recommend the next local-first commands
- `doctor`: run preflight diagnostics for config, policy, parser availability, effective document roots, ignore paths, cache state, and MCP tool exposure
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
```

Purpose:

- `overview`: summarize system domains and architecture
- `find symbol`: locate symbol definitions and related edges; a miss returns an empty `matches` array without failing the command
- `deps`: explain dependencies; a missing target returns a deterministic `status = not_found` JSON payload and a non-zero exit code
- `impact`: estimate blast radius; a missing target returns a deterministic `status = not_found` JSON payload and a non-zero exit code
- `policy check`: evaluate architecture rules
- `docs search`: find relevant project documents for a task or domain across markdown, structured JSON/YAML, `docx`, and `pdf` sources using latest-lineage preference plus local semantic retrieval

### Context for AI

```bash
heart pack --token-budget 1200 "add SSO login audit logging"
heart pack --json "refactor payment retry flow"
heart mcp serve
```

Purpose:

- `pack`: build a task-specific context bundle with reuse, policy, and risk signals
- `mcp serve`: expose the project through MCP

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

Portal launcher note:

- when `heart sync profile` publishes a repository profile to the hosted service, the workspace identity may also register local benchmark-runner metadata for the current host
- the portal can only start benchmark runs when that local repo path is still reachable by `services/api`

Observed benchmark inputs:

- `heart benchmark run <scenario> --baseline-run <run-id> --assisted-run <run-id>` loads token, duration, and cost totals from persisted `agent_run` plus `llm_call` telemetry instead of only scenario stub values
- if a supplied run has full usage coverage, the report marks that side as `measurement.mode = observed`
- if a supplied run has incomplete or no provider usage, the report marks that side as `measurement.mode = estimated`

Launcher pricing flags:

- `--input-cost-per-1m`
- `--cached-input-cost-per-1m`
- `--output-cost-per-1m`

These flags are accepted by `heart agent run` and `heart benchmark capture` and are used to compute observed USD cost from provider usage totals when the upstream model API does not return cost directly.

## Recommended Output Style

Human mode:

- terse summary
- most relevant files
- warnings
- next actions
- avoid raw debug dumps for first-run commands; `init`, `doctor`, `pack`, and `connect` should point to the next recommended command explicitly

JSON mode:

- deterministic schema
- stable keys
- suitable for downstream agent tooling
- no mixed prose on stdout when `--json` is requested

Validation mode:

- `heart.config.yaml` and `.heart/policies.yaml` should be validated against strict key and type expectations
- unknown keys should surface as explicit schema errors
- invalid values should not be silently accepted

## CLI Contract Rules

- Unknown flags must fail fast with a non-zero exit code and a clear error message.
- Typed flags must reject invalid values instead of silently coercing or ignoring them.
- `--token-budget` must be a positive integer.
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
    - coverage

policies:
  rules_file: .heart/policies.yaml

indexing:
  embedding: local
  incremental: true

mcp:
  enabled_tools:
    - project_overview
    - symbol_lookup
    - dependency_explain
    - context_pack
    - impact_analysis
    - document_search
    - policy_check
```

Validation notes:

- unknown top-level or nested config keys should mark config status as invalid
- `mcp.enabled_tools` should reject unknown tool ids
- `indexing.embeddings` is currently limited to `disabled` or `local`

## MCP Tool Surface

### `project_overview`

Returns:

- project summary
- architecture domains
- notable modules
- ownership hints
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
