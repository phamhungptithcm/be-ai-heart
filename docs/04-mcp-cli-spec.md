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

## Current CLI Surface

The shipped surface is intentionally small. Commands not listed here are not part of the current implementation.

### Project Setup and Workspace Inspection

```bash
heart init
heart doctor
heart overview
heart pack "add SSO login audit logging"
heart docs search "login audit requirements"
```

Purpose:

- `init`: create `heart.config.yaml` and default project policies
- `doctor`: validate the local repo, config, and environment basics
- `overview`: summarize the graph, policy, and document state
- `pack`: build a task-specific context bundle
- `docs search`: find relevant project documents for a task or domain

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
- supported v1 install targets are `cursor`, `claude-code`, and `continue`

### MCP Runtime

```bash
heart mcp tools
heart mcp serve
```

Purpose:

- `mcp tools`: list the current MCP tool registry
- `mcp serve`: expose the project through MCP

## Recommended Output Style

Human mode:

- terse summary
- most relevant files
- warnings
- next actions

JSON mode:

- deterministic schema
- stable keys
- suitable for downstream agent tooling

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
    - duplicate_detector
```

## MCP Tool Surface

### `project_overview`

Returns:

- project summary
- architecture domains
- notable modules
- ownership hints

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
- optional scope
- optional token budget

Returns:

- summary
- relevant files
- relevant symbols
- relevant documents
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
- summary
- relevance score

### `duplicate_detector`

Inputs:

- task description or code snippet

Returns:

- likely overlapping modules
- confidence score
- reuse suggestions

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
