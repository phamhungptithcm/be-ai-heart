# Heart Connect Design

## Goal

Add a local-first `heart connect` workflow that can:

- detect supported AI agent hosts installed on a customer machine
- detect supported local AI model runtimes installed or running on that machine
- safely install or update MCP wiring for supported agent hosts
- optionally wire a local model runtime when the selected agent host adapter explicitly supports model configuration
- verify the resulting connection with a real MCP handshake before claiming success

The feature should reduce MCP setup friction without turning `be-ai-heart` into a generic local AI orchestration platform.

## Context

`be-ai-heart` already exposes a working local MCP server through `heart mcp serve`, backed by the existing CLI, workspace cache, graph, context compiler, and MCP tool registry. The current gap is not MCP runtime availability. The gap is local machine integration and configuration ergonomics for external AI tools.

This design keeps the existing local stdio MCP runtime as the source of truth and adds a new local integration layer on top of it.

## Problem Statement

Today, a user who wants to connect `be-ai-heart` to an AI coding agent must:

1. know which AI client on their machine supports MCP
2. find the correct config file for that client
3. add the correct `heart mcp serve --root <repo>` server entry by hand
4. optionally understand how that same client selects a local model runtime such as Ollama
5. manually verify that the client can actually start the MCP server and see the tool registry

That flow is too manual for a product whose value proposition depends on low-friction adoption.

## Design Principles

1. Local-first
   The feature operates on the customer machine and does not depend on `services/api` or the hosted portal.

2. Agent-first
   MCP wiring targets agent hosts, not model runtimes. Model runtime discovery is advisory by default and only becomes installable when a supported agent adapter exposes an explicit model configuration surface.

3. Safe by default
   Detection never mutates files. Installation only touches adapter allowlisted paths. Verification proves the setup works.

4. Stable contracts
   `detect`, `install`, and `verify` must expose deterministic JSON output so other tooling can build on them later.

5. Narrow scope
   V1 should support a small allowlist of agent hosts and runtimes well rather than claiming universal local AI compatibility.

## Scope

### In Scope

- `heart connect detect`
- `heart connect install`
- `heart connect verify`
- `heart connect doctor`
- agent-host discovery for a small allowlist of known clients
- local model-runtime discovery for a small allowlist of known runtimes
- MCP config generation for supported agent hosts
- config backup, atomic patching, and rollback on failed verification
- real stdio MCP verification using `initialize`, `notifications/initialized`, and `tools/list`

### Out of Scope

- hosted MCP transport in `services/api`
- remote model endpoint discovery outside explicit user-provided endpoints
- scanning the full filesystem for arbitrary apps or config files
- silently editing unknown config files
- universal support for every AI editor, extension, and local runtime on day one
- changing `packages/mcp-server` responsibilities beyond what is required for verification

## User Outcomes

### Primary Outcome

A user can run one command to discover which local AI tools on their machine can be connected to `be-ai-heart`, then run one install command to wire a supported client to `heart mcp serve`, and finally run one verify command to prove the integration works.

### Secondary Outcome

A user can also see which local model runtimes already exist on the machine, whether they are reachable, and whether the chosen agent host can be configured to use one of them.

## Recommended Approach

Use an `agent-first, model-aware` design:

- AI agent hosts are the primary integration target because MCP is consumed by agent hosts.
- Model runtimes are a separate capability class. They are discovered independently and only wired during install when the chosen agent adapter explicitly supports model configuration.
- The CLI remains thin. A dedicated `packages/connect` package owns discovery, planning, patching, and verification behavior.

This approach captures the practical value of auto-detection and auto-connection without hiding the real boundary between MCP clients and model providers.

## Command Surface

```bash
heart connect detect [--json] [--root PATH] [--agents] [--models]
heart connect install --client <agent> [--root PATH] [--scope user|repo] [--model <runtime>] [--dry-run] [--backup]
heart connect verify [--client <agent>] [--root PATH] [--json]
heart connect doctor [--json]
```

### `heart connect detect`

Purpose:

- discover supported agent hosts
- discover supported local model runtimes
- return a machine-readable inventory without mutating anything

Behavior:

- `--agents` limits output to agent-host discovery
- `--models` limits output to model-runtime discovery
- default mode returns both

Human output should highlight:

- detected agent hosts
- whether each host is already configured for `heart-mcp`
- detected model runtimes
- whether each runtime is running or merely installed
- next recommended command

JSON output should include:

- `repo_root`
- `agents`
- `models`
- `warnings`
- `recommendations`

### `heart connect install`

Purpose:

- plan and apply config changes needed to register `heart mcp serve --root <repo>` into a supported agent host
- optionally configure a local model runtime when the selected agent adapter supports it

Behavior:

- requires `--client`
- optional `--scope` controls user-level vs repo/workspace-level config when the adapter supports both
- optional `--model` requests model-runtime binding
- `--dry-run` prints the `ConnectionPlan` without mutating files
- `--backup` forces a backup even when the adapter would otherwise use an idempotent patch path

Install must:

- refuse to edit unknown config layouts
- back up the config before mutation
- apply the patch atomically
- run verification after patching
- report `ready`, `partial`, or `failed`

### `heart connect verify`

Purpose:

- prove that a local integration is actually usable

Minimum verification path:

1. confirm required config path exists
2. resolve the registered MCP command
3. spawn the MCP server command
4. send `initialize`
5. send `notifications/initialized`
6. send `tools/list`
7. confirm that the expected tool registry is returned

Optional adapter-specific verification:

- confirm the agent host config references the expected model runtime
- confirm the chosen local model endpoint is reachable

### `heart connect doctor`

Purpose:

- provide support-oriented preflight diagnostics

Examples:

- `heart` binary not available from the expected path
- config file exists but cannot be parsed by the adapter
- local model runtime endpoint is configured but unreachable
- backup directory not writable

## Capability Model

The connect layer should work with four stable internal shapes.

### `AgentHost`

- `id`
- `display_name`
- `supports_mcp`
- `supports_model_override`
- `install_modes`
- `config_locations`
- `detected`
- `configured`
- `discovery_confidence`
- `warnings`

Examples of `id` values:

- `cursor`
- `claude-desktop`
- `codex`
- `continue`
- `cline`
- `windsurf`

### `ModelRuntime`

- `id`
- `display_name`
- `transport`
- `endpoint`
- `installed`
- `running`
- `models_detected`
- `auth_required`
- `discovery_confidence`
- `warnings`

Examples of `id` values:

- `ollama`
- `lm-studio`
- `vllm`
- `llama-cpp`

### `ConnectionPlan`

- `client`
- `scope`
- `repo_root`
- `mcp_entry`
- `model_binding`
- `files_to_backup`
- `files_to_modify`
- `warnings`
- `actions`

This object exists so that `install --dry-run --json` can be fully scriptable and so support tooling can explain exactly what will happen before a write occurs.

### `VerificationReport`

- `client`
- `repo_root`
- `config_status`
- `spawn_status`
- `initialize_status`
- `tools_list_status`
- `model_runtime_status`
- `warnings`
- `status`

Allowed final `status` values:

- `ready`
- `partial`
- `failed`

## Discovery Strategy

Discovery must be allowlisted, confidence-scored, and non-invasive.

### Agent Host Discovery

For each supported adapter:

1. inspect known app, binary, or config locations
2. inspect known user-scope and repo/workspace-scope config files when applicable
3. infer whether the host is:
   - installed only
   - configured for MCP already
   - partially configured
4. assign a discovery confidence

Detection sources are limited to:

- explicit config locations documented in the adapter
- expected binary names in `PATH`
- expected workspace metadata locations

### Model Runtime Discovery

For each supported runtime:

1. inspect known binaries or processes
2. probe known localhost endpoints only
3. call lightweight health or model-list endpoints when safe
4. classify whether the runtime is:
   - installed
   - running
   - reachable
   - listing models successfully

Detection must not scan arbitrary LAN addresses or cloud endpoints.

### Confidence Model

Use:

- `high` when the adapter sees both a known installation signal and a valid config or health response
- `medium` when the adapter sees only one strong signal
- `low` when the adapter infers presence from a weak signal only

## Install Flow

The `install` flow should be:

1. run detection for the selected client
2. build a `ConnectionPlan`
3. print the plan in dry-run mode or continue to apply
4. back up the target config file
5. patch the config atomically
6. verify the result
7. keep changes on success
8. roll back on failed verification when safe to do so

### MCP Wiring

Every supported agent-host adapter must generate a server entry equivalent to:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/packages/cli/bin/heart.js", "mcp", "serve", "--root", "/absolute/path/to/repo"]
}
```

The exact outer config shape depends on the client adapter, but the inner MCP command must remain consistent and local-first.

### Model Wiring

Model-runtime wiring is adapter-gated.

If an agent-host adapter declares `supports_model_override = false`, then:

- `install --model ...` must not pretend success
- the command should apply MCP wiring only
- the result should include an advisory warning explaining that the model runtime was detected but not auto-bound

If an adapter declares `supports_model_override = true`, it may also:

- write the chosen model provider or endpoint
- validate the runtime endpoint if the format is known

## Verification Design

Verification must be real, not speculative.

### Base Verification

The connect package should reuse the same MCP handshake already covered by the current stdio tests:

1. spawn the configured command
2. send `initialize`
3. send `notifications/initialized`
4. send `tools/list`
5. compare the returned tool list with the runtime registry

That proves the most important part of the promise: the host can start `heart-mcp` and receive the tool surface.

### Model Verification

Model verification is advisory unless the chosen adapter and runtime define a reliable verification path.

Examples:

- `ollama`: call the local model list endpoint and confirm the endpoint responds
- `lm-studio`: probe the expected local server only if the adapter knows the endpoint format

Failure to verify the model runtime should not invalidate a successful MCP connection unless the install command explicitly required model binding as a hard prerequisite.

## Architecture Boundaries

### New Package

Create a dedicated `packages/connect` package as the owner of local agent and model integration behavior.

Responsibilities:

- discovery
- planning
- installation
- verification
- stable connect-specific JSON contracts

### Existing Package Responsibilities

`packages/cli`

- parse flags
- delegate to `packages/connect`
- render human and JSON output

`packages/mcp-server`

- remain the owner of MCP runtime transport and tool serving
- no client-specific config patching logic

`packages/core`

- expose only shared primitives when needed
- do not absorb adapter-specific integration logic

`services/api`

- out of scope for V1
- no hosted backend dependency for local connect workflows

## Suggested File Layout

```text
packages/connect/
  src/index.js
  src/detect.js
  src/install.js
  src/verify.js
  src/types.js
  src/planner.js
  src/filesystem.js
  src/agent-adapters/
    cursor.js
    claude-desktop.js
    codex.js
    continue.js
    cline.js
    windsurf.js
  src/model-adapters/
    ollama.js
    lm-studio.js
    vllm.js
    llama-cpp.js
```

This layout keeps CLI output concerns separate from adapter logic and allows each adapter to own its config path rules and patching semantics.

## V1 Rollout Plan

### Phase 1: Detect

Ship `heart connect detect` first.

Success criteria:

- deterministic JSON inventory
- at least a small allowlist of agent hosts and model runtimes
- confidence-scored results

### Phase 2: Verify

Ship `heart connect verify` second.

Success criteria:

- real MCP spawn and handshake verification
- clear failure reasons for missing config, missing binary, or handshake failure

### Phase 3: Install for 2-3 Agent Hosts

Add safe patching for the easiest and most stable adapters first.

Success criteria:

- backup + atomic patch
- idempotent re-run
- rollback on failed verification

### Phase 4: Model Advisory

Add runtime detection, reachability checks, and model listing.

Success criteria:

- strong `ollama` support first
- advisory output for other runtimes where confidence is lower

### Phase 5: Agent-Specific Model Wiring

Only after an adapter proves a stable model config path should V1 expand to model auto-binding.

## Testing Strategy

### Unit Tests

- adapter path discovery
- planner output
- config patch generation
- rollback decisions
- JSON schema stability

### Contract Tests

- `detect --json`
- `install --dry-run --json`
- `verify --json`

### Integration Tests

- MCP verification path using spawned stdio process
- fixture configs for each supported adapter
- idempotent install re-run
- rollback after intentionally broken patch or failed verification

### Risk-Based Tests

- refuse to modify unknown config layouts
- refuse to probe non-localhost endpoints without explicit input
- avoid logging secrets or raw credentials

## Security and Trust Guardrails

1. Detection is read-only.
2. Installation only mutates adapter allowlisted paths.
3. No arbitrary filesystem scans outside adapter rules.
4. No probing outside `localhost` unless the user explicitly provides an endpoint.
5. No logging of tokens, API keys, or full secret-bearing config blobs.
6. Backups must be created before mutation.
7. Verification must happen before success is reported.
8. Unknown or unexpected config formats must fail closed, not be patched heuristically.

## Risks

### Adapter Drift

Client config formats may change over time.

Mitigation:

- keep adapters isolated
- use fixture-based tests
- fail closed on unknown layouts

### False Expectations Around Model Auto-Connect

Users may assume that detecting a local runtime means it can always be wired automatically.

Mitigation:

- keep agent-host and model-runtime statuses separate
- require explicit adapter support for model installation
- use `partial` status where needed instead of claiming full readiness

### Scope Creep

This feature can easily expand into a much larger local AI orchestration layer.

Mitigation:

- keep V1 centered on MCP adoption friction
- treat model runtimes as secondary capability
- avoid hosted or multi-tenant concerns here

## Open Questions

1. Which 2-3 agent hosts should be the first supported install targets?
2. Should failed post-install verification auto-roll back by default, or should rollback require an explicit flag?
3. Should `install` support an interactive mode later, or remain flag-only for V1 to preserve scriptability?

## Final Recommendation

Build `heart connect` as a new local integration layer in `packages/connect`, with an agent-first design and model-aware advisory capabilities.

For V1:

- prioritize `detect`
- add real `verify`
- support safe `install` for a small agent-host allowlist
- make `ollama` the first strong model-runtime adapter

This gives `be-ai-heart` a credible low-friction MCP onboarding path while keeping the architecture local-first, testable, and aligned with the repository's existing MVP direction.
