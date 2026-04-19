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
heart watch
```

Purpose:

- `init`: create `heart.config.yaml`
- `doctor`: validate repo, parsers, ignores, permissions
- `scan`: build or refresh graph
- `watch`: incremental updates during development

### Inspection

```bash
heart overview
heart find symbol loginUser
heart deps src/auth/login.ts
heart impact src/billing/service.ts
heart reuse "create invoice"
heart docs search "login audit requirements"
```

Purpose:

- `overview`: summarize system domains and architecture
- `find symbol`: locate symbol definitions and related edges
- `deps`: explain dependencies
- `impact`: estimate blast radius
- `reuse`: suggest existing implementations relevant to a task
- `docs search`: find relevant project documents for a task or domain

### Context for AI

```bash
heart pack "add SSO login audit logging"
heart pack --json "refactor payment retry flow"
heart ask "where should a new webhook handler live?"
heart mcp serve
```

Purpose:

- `pack`: build a task-specific context bundle
- `ask`: repo-aware Q&A
- `mcp serve`: expose the project through MCP

### Governance and Benchmark

```bash
heart policy check
heart benchmark run
heart benchmark compare baseline.json heart.json
heart report generate
```

Purpose:

- `policy check`: evaluate architecture rules
- `benchmark run`: execute predefined scenarios
- `benchmark compare`: diff performance and cost metrics
- `report generate`: produce executive report output

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
