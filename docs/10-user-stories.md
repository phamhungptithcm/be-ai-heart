# User Stories and Acceptance Criteria

## Epic 1: Repository Understanding

### Story 1.0

As an engineer, I want to install the CLI with one npm package so that `heart` is easy to adopt in local and agent workflows.

Acceptance criteria:

- the publishable package name is `beheart`
- installing the package exposes the `heart` binary outside the monorepo
- the packaged CLI works from a tarball install without depending on sibling workspace source files
- `heart connect install --dry-run` from an installed package points MCP configs at the installed CLI path

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
