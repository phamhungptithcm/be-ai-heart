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

## Interactive Workbench Contract

When `heart` runs with no command in an interactive TTY, it opens the local BeHeart workbench. The workbench is a
human-facing shell for the same CLI contracts, not a separate domain layer.

It must show:

- repo identity and safely shortened local path
- local memory status
- config and policy status
- scan/cache status
- docs/spec document status
- MCP tool readiness
- benchmark evidence readiness
- recent activity and suggested next actions

It must support:

```bash
/help
/init
/doctor
/scan
/overview
/pack <task>
/find <symbol>
/impact <path>
/docs <query>
/policy
/benchmark
/connect [client]
/mcp
/clear
/exit
```

Natural aliases such as `scan this repo`, `show overview`, `make context pack for "..."`, `check policies`,
`find loginUser`, `show impact for src/auth/login.ts`, `search docs for billing requirements`, `run benchmark`,
`connect cursor`, `help`, and `exit` resolve to the same command bridge.

Compatibility rules:

- `heart --help` prints normal help.
- `heart <command>` runs the direct command.
- `heart --json` never prints workbench decoration.
- `heart mcp serve` never prints workbench decoration or banners.
- non-TTY and CI `heart` prints compact help and exits without hanging.
- `exit`, `/exit`, `quit`, and `/quit` close the workbench with exit code `0`.

`heart chat` opens the same workbench in an interactive terminal. In non-TTY mode it must not hang; when a prompt is
provided it runs one model-backed chat request and exits.

## CLI IDE Workbench MVP

`heart ide` opens the terminal-first AI coding workbench. It is a practical MVP surface layered on existing BeHeart
memory, chat, graph, docs/spec, and patch safety contracts; it is not a full editor replacement.

Supported MVP commands:

```bash
heart ide [--json] [--root PATH]
heart ide status [--json] [--root PATH]
heart ide files [--json] [--root PATH] [query]
heart ide open [--json] [--root PATH] [--editor EDITOR] <file>
heart ide keymap [--json] [--root PATH] [--profile NAME] [--keymap PATH]
heart ide palette [--json] [query]
heart ide tasks [--json] [--root PATH]
heart ide run <test|lint|typecheck|script> [--json] [--root PATH] [--confirm]
heart ide diagnostics [--json] [--root PATH] [--source NAME] [--format text|lsp] [output-file]
heart ide diagnostics-nav [--json] [--root PATH] [--source NAME] [--format text|lsp] [output-file]
heart ide lsp-probe [--json] [--root PATH] [--server PRESET] [--timeout-ms N]
heart ide lsp-diagnostics [--json] [--root PATH] [--server PRESET] [--timeout-ms N] <file>
heart ide git [--json] [--root PATH]
heart ide diff [--json] [--root PATH] [--staged]
heart ide review [--json] [--root PATH]
heart ide stage-picker [--json] [--root PATH] [--interactive] [--select NUMBERS] [--confirm]
heart ide stage [--json] [--root PATH] --confirm <file...>
heart ide unstage [--json] [--root PATH] --confirm <file...>
heart ide context [--json] [--root PATH] <task>
heart ide graph [--json] [--root PATH]
heart ide docs [--json] [--root PATH] [query]
heart ide policy [--json] [--root PATH]
heart ide domain [--json] [--root PATH] [list|show|build] [pack-id]
heart ide generate [--json] [--root PATH] <domain-id> --stack <stack-id> [--mode MODE] [--confirm]
heart ide memory [--json] [--root PATH] [summary|graph|docs|policy|domain|attachments] [query] [--select ARTIFACT_ID]
heart ide patch-preview [--json] [--root PATH] <patch.json>
heart ide patch-apply [--json] [--root PATH] --confirm <patch.json>
heart ide patch-rollback [--json] [--root PATH] <rollback-id>
```

Compatibility rules:

- `heart ide --help` prints usage and exits.
- non-TTY `heart ide` prints usage and exits without hanging.
- `heart ide --json` returns a clean `WorkbenchSession` payload.
- `heart --help` remains normal CLI help.
- MCP stdio commands remain decoration-free.
- Patch writes require `patch-preview` followed by `patch-apply --confirm`.
- Task execution goes through package-script discovery and command safety classification.
- Diagnostics parsing accepts compiler/linter output or LSP `textDocument/publishDiagnostics` JSON from a repo-local file or stdin and returns compact grouped diagnostics; `diagnostics-nav` returns sorted numbered jump targets and `heart ide open` next actions.
- `lsp-probe` performs a timeout-bounded `initialize` handshake against allowlisted LSP presets and returns capability summaries; it does not keep a server running.
- `lsp-diagnostics` starts an allowlisted LSP process through the reusable in-process session manager, initializes it, sends didOpen/didChange-compatible document notifications, collects `publishDiagnostics` until timeout, then shuts the process down; cross-command background daemon persistence remains deferred.
- Git index mutation through `stage`, `unstage`, or `stage-picker --select ... --confirm` requires explicit confirmation; `diff --staged`, `review`, and plain `stage-picker` are read-only.
- Context, graph, docs, policy, domain, and combined `memory` drill-down commands expose BeHeart memory panels without starting a full-screen UI; `memory --select ARTIFACT_ID` returns the selected artifact and next actions.
- Domain-to-Project generation runs through the same confirmed `heart generate` contract; preview is the default and file writes require `--confirm`.

## Current CLI Surface

The shipped surface is intentionally bounded. Commands not listed here are not part of the current implementation unless
they are explicitly labeled future in a planning spec.

### Project Setup and Workspace Inspection

```bash
heart init
heart login
heart doctor
heart scan
heart sync setup
heart connect detect
heart connect install --client cursor --scope repo
heart connect verify --client cursor --scope repo
heart connect doctor
```

Purpose:

- `init`: create or repair `heart.config.yaml` and `.heart/policies.yaml`, seed config language priority from detected source languages when possible, and recommend the next local-first commands
- `login`: save a portal-created CLI API key in the local BeHeart credential store so sync commands can authenticate without repeating `--session`
- `doctor`: run preflight diagnostics for config, policy, parser availability, effective document roots, ignore paths, cache state, and MCP tool exposure, then emit a top-level readiness status, a deterministic `first_run` checklist, and next actions
- `scan`: build or refresh graph
- `sync setup`: after login, publish repository profile, document artifact, and a starter hosted context-pack record in one guided onboarding command
- `connect detect`: discover supported local agent-host configs and running local model runtimes without mutating anything
- `connect install`: write an allowlisted local agent-host config entry for `heart mcp serve --root <repo>` and verify the result before claiming success
- `connect verify`: run a real stdio MCP handshake against the configured entry and confirm that `tools/list` succeeds
- `connect doctor`: run support-oriented connect preflight checks and recommend the next local MCP step

### AI Agent Chat and Models

```bash
heart models providers [--json]
heart models list [--provider PROVIDER] [--json]
heart models pricing [--provider PROVIDER] [--json]
heart models validate [--live] [--json]
heart models add-key --provider PROVIDER --api-key-stdin
heart models test --provider PROVIDER [--json]
heart models select PROVIDER/MODEL [--json]
heart models remove-key --provider PROVIDER [--json]
heart agent settings [--json]
heart chat [--json] [--provider PROVIDER] [--model PROVIDER/MODEL|MODEL] [--context repo|graph] [--pack PACK] <prompt>
```

Contracts:

- `models providers --json` returns typed provider metadata, key status, env fallback, selected model, and local storage security note.
- `models list --json` returns dynamic model discovery when a key or local model endpoint exists and `versioned_fallback` metadata otherwise.
- `models pricing --json` returns BeHeart's versioned pricing catalog overlay. Provider-returned dynamic pricing wins at request time; unknown prices are labeled instead of guessed.
- `models validate --json` returns a safe validation manifest. `--live` tests only configured providers or local runtimes and never prints raw keys.
- `models add-key` masks key output and writes local model credentials with user-only file permissions.
- `models test` calls provider model discovery and returns normalized auth/rate/model errors. Ollama and LM Studio tests use their local endpoints without API keys; Bedrock signs `ListFoundationModels` with AWS environment credentials, static `AWS_PROFILE`, or `source_profile` assume-role chains. IAM Identity Center/SSO profiles and `credential_process` return explicit blocked/deferred statuses.
- `agent settings --json` returns selected model, configured providers, allowlisted tools, and storage note.
- `chat --json <prompt>` returns assistant message, usage, cost, and active BeHeart context attachments.
- `heart --json`, MCP stdio, and non-TTY direct commands must remain decoration-free.

### Inspection

```bash
heart overview
heart find symbol loginUser
heart deps src/auth/login.ts
heart impact src/billing/service.ts
heart policy check
heart docs search "login audit requirements"
heart docs import ./requirements.md --category requirements
heart docs sync-web
heart diagram generate mindmap
heart diagram sync
heart packs list
heart packs show tolling-management
heart packs layers tolling-management
heart packs build tolling-management --output sales-demo-kit --regional texas --agency hctra-example
heart packs validate tolling-management
heart packs conflicts tolling-management --agency hctra-example
heart packs sync tolling-management
heart packs artifacts tolling-management
heart packs open tolling-management --artifact <artifact-id>
heart generate stacks
heart generate stack next-fullstack-postgres
heart generate modes
heart generate tolling-management --stack next-fullstack-postgres
heart generate tolling-management --mode sales-demo --stack next-fullstack-postgres --confirm
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
- `docs import`: copy a local document into `.heart/imported-documents` and publish document artifacts to local portal/admin surfaces when configured
- `docs sync-web`: pull portal/admin submitted document updates into local imported memory for the selected profile
- `diagram generate`: write Mermaid review artifacts for repository structure, including a `mindmap` view that combines business, requirements, technical documents, and code domains from saved heart memory
- `diagram sync`: publish the current repository profile plus generated diagrams to local and hosted surfaces
- `packs list/show/layers`: browse source-backed domain packs, layer model, output types, citations, and warnings
- `packs build`: generate demo-safe pack artifacts under `.heart/packs/<pack-id>/generated/<output>/...` with manifest, citations, conflicts, and security warnings
- `packs validate/conflicts`: check source files and surface layer/overlay conflicts without silently merging policy
- `packs artifacts/open`: list and inspect generated pack artifacts from `.heart/packs/<pack-id>/generated/...`
- `packs sync`: sync reviewed generated outputs back to `packs/<pack-id>/generated/...` when supported
- `generate stacks/stack/modes`: inspect supported Domain-to-Project stack presets, tradeoffs, and output modes
- `generate <domain-id>`: create a previewable generation plan from a domain pack and stack; write docs/code/tests/fixtures/benchmarks only after `--confirm`

Domain-to-Project generation rules:

- default flow asks only for domain and stack unless output directory, stack selection, overwrite, payment/security risk, or domain conflicts block generation
- generated output stays inside the selected output directory
- `.heart/generation-manifest.json` records generated files, citations, warnings, assumptions, validation results, story IDs, and rollback token
- demo data is fake; secrets, raw payment data, and real PII are not generated
- MVP stacks are `next-fullstack-postgres`, `react-node-postgres`, and `spring-react-postgres`

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

MCP includes `benchmark_summary` for compact local ROI evidence. It returns report counts, latest report metadata,
measurement-mode counts, averaged headline metrics, artifact evidence counts, and next actions without exposing local
absolute benchmark paths.

MCP also exposes Domain-to-Project tools:

- `stack_preset_list`: list supported stack presets without writing files
- `domain_project_plan`: preview generated modules, files, warnings, questions, and validation commands
- `domain_project_generate`: generate only when `confirmed: true`; otherwise returns a confirmation-needed response

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

### Portal Login and API Keys

```bash
heart login
heart sync setup
heart login --api-key <key>
heart login --api-key=<key>
heart login --api-key-stdin
heart login --url http://127.0.0.1:4010 --api-key=<key>
heart logout
```

`heart login` is the default user path: the CLI starts a short-lived localhost callback, opens the BeHeart portal,
and stores the returned credential after `/api/session` accepts it. Portal users can also create one-time CLI API keys
from the customer portal settings page and run `heart login --api-key=<key>`. The service returns the raw API key only
once. The CLI stores credentials in a local credential file with user-only file permissions and redacts keys from human
and JSON output. `heart sync setup` can then publish the repository profile, documents, and a starter hosted context-pack
record in one guided step. `heart sync profile`, `heart sync docs`, and `heart sync benchmark` can also use the saved
credential when `--url` and `--session` are omitted. `--url` is an override for local development or self-hosted BeHeart APIs, not
part of the normal hosted login path.

Security rules:

- the portal API-key list never returns raw key material
- service storage persists only hashed session lookup keys plus redacted payloads
- CLI API keys cannot mint additional API keys
- browser login callbacks must use loopback HTTP with a state token
- `--api-key-stdin` is preferred for scripts and CI
- `heart logout` removes the local credential

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
- observed run comparisons require completed runs with full provider usage coverage; incomplete captures must be rerun through the BeHeart proxy before comparing
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
- `doctor --json` includes `first_run.steps` for `init`, `doctor`, `scan`, `overview`, `pack`, and `mcp_serve`; human output renders the same checklist without changing exit semantics
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
  name: beheart-demo
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
    - domain_pack_list
    - domain_pack_get
    - domain_pack_layers
    - domain_pack_build_options
    - domain_pack_generate
    - domain_pack_validate
    - domain_pack_conflicts
    - domain_pack_context
    - domain_pack_benchmark_scenarios
    - stack_preset_list
    - domain_project_plan
    - domain_project_generate
    - impact_analysis
    - document_search
    - docs_search
    - policy_check
    - benchmark_summary
```

Validation notes:

- unknown top-level or nested config keys should mark config status as invalid
- configured `project.ignore` values are additive with built-in generated/vendor defaults when scanning and in `doctor` output
- `knowledge.document_paths` controls document roots, with `.heart/imported-documents` always added for local imported memory
- `mcp.enabled_tools` should reject unknown tool ids
- `indexing.embeddings` is currently limited to `disabled` or `local`

## MCP Tool Surface

### Domain Pack Tools

Domain pack tools are compact JSON contracts for AI clients. They do not return raw large pack documents by default and include citations, layer labels, conflicts, and security warnings.

Tools:

- `domain_pack_list`
- `domain_pack_get`
- `domain_pack_layers`
- `domain_pack_build_options`
- `domain_pack_generate`
- `domain_pack_validate`
- `domain_pack_conflicts`
- `domain_pack_context`
- `domain_pack_benchmark_scenarios`

`domain_pack_generate` accepts an allowlisted output type such as `sales-demo-kit`, regional layer such as `texas`, agency overlay such as `hctra-example`, customer requirements, and token budget. It writes local artifacts with a manifest and returns compact file names, citations, warnings, and next actions.

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

## Portal Chat and CLI Sync Contract

The portal chat workbench uses the same local-first product model as CLI and MCP, but it must not become a raw shell.
Portal commands are normalized into allowlisted backend actions:

- `scan repo`
- `generate context pack for "..."`
- `show graph for module`
- `explain architecture`
- `search docs for spec`
- `compare benchmark`
- `update story status`
- `show policy violations`

Read-only commands can complete as command records with result cards, cited files/docs, and next actions. Side-effecting
commands return `needs_confirmation` when the backend cannot safely execute them without explicit approval. Destructive
or arbitrary shell-like input is rejected. CLI remains the source of truth for local scans and `.heart` artifacts; the
portal displays synced state and can create hosted context pack records where the backend has a safe artifact source.

Model selection is scoped to provider, model, purpose preset, token budget, and cost hint. Provider keys are configured
through CLI local credentials, server environment variables, or encrypted portal BYOK storage when
`BE_AI_HEART_PORTAL_SECRET_KEY` is configured. API responses only expose masked key state.

The MVP stream route is `POST /api/chat/sessions/:sessionId/messages/stream`. It uses the same portal auth,
workspace/session scope check, CSRF protections for cookie-backed sessions, and provider-key redaction as the JSON
message route. Stream events include assistant deltas, usage, completion payload, and context attachment metadata for
repo, docs, graph, domain pack, and selected hosted context pack. Portal chat must never forward arbitrary shell input;
local scans still run through CLI/MCP workflows.

## Planned And Future Commands

The following names appear in planning specs as possible future ergonomics, but they are not current CLI commands:

```bash
heart demo-kit create tolling-management
heart demo-kit website tolling-management
heart demo-kit prototype tolling-management
heart demo-kit proposal tolling-management
heart demo-kit benchmark tolling-management
```

Use current domain-pack generation instead:

```bash
heart packs build tolling-management --output sales-demo-kit
heart packs build tolling-management --output website
heart packs build tolling-management --output ui-prototype
heart packs build tolling-management --output proposal
heart packs build tolling-management --output benchmarks
```
