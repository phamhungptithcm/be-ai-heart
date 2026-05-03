# Security Overview

This document summarizes the current BeHeart security posture for design partners and early enterprise review. It is a product and engineering packet, not a compliance certification.

For production threat modeling, retention, export, and deployment boundaries, use [Production Threat Model, Retention, and Export Plan](./26-production-threat-model-retention.md).

## Data Flow

1. Local CLI scans source and configured project documents inside the repository.
2. Local artifacts are written under `.heart/` for cache, diagrams, imported docs, and benchmark evidence.
3. Optional sync publishes sanitized repository profiles, document artifacts, diagrams, and benchmark reports to the hosted service.
4. Portal users read tenant-scoped repository memory, docs/spec status, benchmark evidence, billing posture, and governance state.
5. Portal chat creates allowlisted command records and model-backed chat sessions over synced artifacts.
6. Admin users read internal support, observability, revenue, billing ops, sessions, and audit views behind separate internal roles.
7. MCP serves local repo memory over stdio and must not receive decorative UI output.
8. Domain-pack generators write demo-safe artifacts with manifests, citations, conflicts, and security warnings.

## Local-First Mode

Local mode is the default trust boundary.

- Source code stays on the developer machine unless the user explicitly runs a sync or benchmark publish flow.
- Context packs are generated locally with `heart pack`.
- MCP runs through `heart mcp serve` and uses configured tool allowlists.
- Interactive `heart` workbench never starts in non-TTY, CI, JSON, or MCP stdio mode.
- Generated/vendor/cache paths are ignored by default.
- Model provider context leaves the machine only when the user runs provider-backed chat or another explicit provider flow.
- CLI model keys come from provider environment variables or local user-only credential files.

## Hosted Mode

Hosted portal/admin mode stores synced summaries and artifacts, not a full source mirror.

- Repository profiles contain counts, summaries, graph views, diagrams, doc metadata, and benchmark summaries.
- Document artifacts redact restricted summaries and previews.
- Benchmark reports publish sanitized evidence manifests and summary metrics.
- Benchmark reports are checked with `validatePublishedArtifactSafety` before hosted publication; unsafe reports with sensitive fields, secret-like values, or absolute local paths are refused.
- Portal context pack preview uses synced artifacts only and routes final generation back to local `heart pack`.
- The hosted service can request benchmark runs only when a local runner path was registered and is still reachable.
- Portal chat uses allowlisted actions and confirmation states; it must not execute arbitrary shell input.
- Portal model-provider secrets are masked and require encrypted storage or server environment variables.

## Auth And RBAC

- Portal and admin surfaces are separate.
- Portal roles are tenant-scoped: `org_admin`, `engineer`, `finance_viewer`, `security_viewer`.
- Admin roles are internal: `owner`, `support_admin`, `sales_ops`, `customer_success`, `engineering_admin`.
- Session lookup keys are hashed; payloads redact raw session tokens.
- Cookie-backed writes require allowed origin and CSRF validation.
- Portal model provider secrets are either configured as server-side environment variables or stored encrypted with
  `BE_AI_HEART_PORTAL_SECRET_KEY` using AES-256-GCM. Client responses expose only masked key presence.
- CLI model provider secrets use provider environment variables or local `~/.beheart/model-credentials.json` with
  user-only file permissions. Shared machines should prefer environment variables or an OS keychain.

## Model Providers And API Keys

Supported provider contracts are BYOK and provider-neutral.

- CLI: environment variables or `~/.beheart/model-credentials.json` with user-only file permissions.
- Portal: server environment variables or encrypted BYOK fields when `BE_AI_HEART_PORTAL_SECRET_KEY` is configured.
- API/UI output: masked key presence only.
- Logs, benchmark reports, chat records, and generated artifacts must not include raw keys.
- Model availability, pricing, and capability metadata can change; docs and UI must label live discovery vs fallback metadata.
- Static pricing metadata is a dated BeHeart overlay only. Provider-returned dynamic pricing wins when available; unknown
  prices must show an explicit warning instead of a guessed cost.
- Bedrock uses AWS SigV4 with environment credentials, static AWS profiles, or `source_profile` assume-role chains. Raw
  AWS secrets and STS session tokens are used only in memory for request signing; `AWS_REGION` defaults to `us-east-1`
  when omitted. IAM Identity Center/SSO profiles and `credential_process` are detected but not executed by the gateway.
- Users should understand that selected context may be sent to the selected external provider during `heart chat` or portal chat.

## Portal Chat And MCP Tool Safety

- Portal chat maps input to allowlisted product intents, cited result cards, and confirmation-required states.
- Shell-like or destructive arbitrary input is rejected by default.
- Side-effecting actions must be explicit, scoped, and audited before broader production use.
- Confirmed portal file writes are limited to generated BeHeart docs/spec/template output directories and
  `.heart/packs/generated/` artifacts.
  Writes to arbitrary source files, package metadata, secret-bearing paths, or traversal targets are denied.
- MCP `tools/list` and `tools/call` are constrained by `mcp.enabled_tools`.
- Disabled MCP tools must not appear enabled and must return clear errors if called.
- MCP and JSON outputs must stay protocol-clean and compact.

## Domain Packs And Generated Artifacts

- Tolling Management and future domain packs are source-backed memory, not production legal or operational authority.
- Generated artifacts must include source citations, selected layers, conflicts, warnings, and generated/demo labels.
- Generated tolling artifacts must not contain real PII, real plates, plate images, trip history, support transcripts, payment account data, production endpoints, or secrets.
- Toll rates, fee amounts, notice windows, collections rules, and legal outcomes require customer-approved source authority.
- Local Ollama and LM Studio providers do not require API keys. Portal usage must treat local endpoints as runtime
  status only unless a trusted server-side runner explicitly owns that connection.

## Audit And Observability

- Session, document submission, write, and admin operations emit audit events where implemented.
- Admin observability exposes request metrics, alerts, traces, and export state.
- Observability payloads must avoid raw tokens, credentials, and customer secrets.

## Retention And Artifacts

- Local `.heart` artifacts remain under the repository owner’s control.
- Hosted benchmark artifact retention is entitlement-driven in the service payloads.
- Export paths are tenant-scoped.
- Raw benchmark prompts, patches, and tool outputs remain local unless explicitly sanitized for publication.
- Production retention defaults, export manifest requirements, and deletion expectations are tracked in `docs/26-production-threat-model-retention.md`.

## Subprocess Execution

The benchmark agent runner can start local subprocesses only through explicit CLI commands such as `heart agent run` or benchmark capture flows.

- Subprocess execution is a local action.
- The CLI binds benchmark metadata into environment variables for capture.
- The hosted portal must fall back to CLI-driven benchmarking if the registered local repo path is unavailable.

## Deployment Options

Current supported posture:

- local-only CLI and MCP
- standalone hosted API for portal/admin data
- Next.js website, portal, and admin surfaces
- SQLite local service storage by default
- Postgres adapter path for hosted storage

Future or customer-specific posture:

- private deployment
- stronger SSO/SAML policy controls
- external billing, CRM, and BI adapters
- shared graph storage with tenant isolation

Payment and billing posture:

- Current billing screens and admin billing ops are readiness/adapter surfaces.
- Live subscription and payment-provider integration is planned, not generally available.
- No raw card data, bank data, payment provider secrets, or customer payment credentials should be stored in docs, generated artifacts, benchmark reports, or portal chat records.

## Known Limitations

- This project does not yet claim SOC 2, ISO 27001, HIPAA, or PCI compliance.
- Portal context pack preview is metadata-based; final pack generation remains local.
- Multi-repo shared graph storage is a future design area.
- Portal AI chat is not a production autonomous execution environment.
- Billing/payment integration and private deployment are not generally available product claims.
- Security review should be repeated before any production customer deployment or regulated-data pilot.

## Validation Hooks

- `tests/document-ingest.test.js` covers restricted document redaction.
- `tests/benchmark.test.js` covers published benchmark artifact safety.
- `tests/service-access.test.js` covers tenant-scoped repository and document access.
- `tests/session-security.test.js` covers session token hashing and redaction.
- `tests/service-http-auth.test.js` covers CSRF and provider-secret rejection paths.
- `tests/model-registry.test.js`, `tests/ai-gateway.test.js`, `tests/cli-models.test.js`, and
  `tests/service-ai-chat.test.js` cover model registry fallback/discovery, native stream parsing, provider error
  redaction, CLI key masking, encrypted portal BYOK storage, risky tool confirmation, and scoped portal tool execution.
