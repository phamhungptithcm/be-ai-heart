# Production Threat Model, Retention, and Export Plan

This document extends the early security overview with the production controls BeHeart needs before broad customer deployment. It is not a compliance certification.

## Scope

Current scope:

- local CLI and MCP use
- optional hosted API
- website, portal, and admin surfaces
- tenant-scoped repository profiles, document artifacts, benchmark reports, usage summaries, audit events, and sessions
- model provider settings, portal chat command records, and chat/session metadata
- domain-pack generated artifacts and manifests
- SQLite-backed local service storage and Postgres adapter path

Out of scope until future stories:

- SSO/SAML hardening beyond existing provider-session and OIDC scaffolding
- shared graph storage for raw multi-repo memory
- raw source mirror in hosted mode
- regulated-data deployments
- SOC 2, ISO 27001, HIPAA, PCI, or FedRAMP claims

## Assets

| Asset | Sensitivity | Current location | Primary risk |
|---|---|---|---|
| Source code and raw repo memory | High | Local repo and `.heart/cache` | accidental sync, prompt/context leakage |
| Imported documents and requirements | Medium to high | `.heart/imported-documents`, hosted document summaries | restricted business content leakage |
| Context packs | Medium to high | local CLI/MCP output | over-broad task context |
| Benchmark raw prompts, patches, and tool output | High | `.heart/benchmarks/evidence` | customer content in published evidence |
| Benchmark summaries and manifests | Medium | hosted API, portal/admin | misleading ROI or sensitive paths |
| Sessions and auth metadata | High | hosted service storage | account takeover, token disclosure |
| Model provider API keys | High | CLI credential file, env vars, encrypted portal storage when configured | key leakage, unauthorized model spend |
| Portal chat records | Medium to high | hosted service storage | prompt/context leakage, unsafe action replay |
| Domain-pack generated artifacts | Medium | `.heart/packs`, hosted artifact views when synced | fake data confused with production truth, hidden PII |
| Audit and observability events | Medium | hosted service storage/admin | sensitive metadata in logs |
| Billing/customer records | Medium | hosted service storage/admin | internal access misuse |
| Payment provider data | High | future billing/payment adapters | card/payment secret exposure |

## Trust Boundaries

| Boundary | Allowed by default | Explicitly disallowed by default |
|---|---|---|
| Local CLI to local artifacts | scan, pack, benchmark, diagram generation | network sync without user command |
| Local MCP stdio | compact JSON tool responses | decorative UI output, secrets, ignored files |
| Local artifacts to hosted sync | sanitized summaries, manifests, counts, diagrams, selected doc metadata | raw source, raw prompts, raw patches, absolute local paths |
| Portal tenant access | tenant-scoped workspace/repo/doc/benchmark summaries | cross-tenant reads or admin-only data |
| Portal chat to BeHeart actions | allowlisted product actions, confirmation-required states, cited synced artifacts | arbitrary shell, unsynced file reads, destructive actions |
| Model provider calls | explicit user/provider-selected chat requests | silent external context sharing |
| Domain-pack generation | demo-safe generated artifacts with citations and warnings | real PII, plates, payment data, legal/toll-rate claims |
| Admin support access | redacted support, revenue, audit, session, and observability summaries | raw session tokens, customer secrets, raw source mirror |

## Threats and Controls

| Threat | Control now | Required hardening before production expansion |
|---|---|---|
| Cross-tenant data leakage | membership-scoped access helpers and route tests | centralized authorization review and row-level storage tests for every new route |
| Secret leakage in artifacts | document redaction and `validatePublishedArtifactSafety` for benchmark publication | shared sanitizer for graph, context, document, benchmark, and support bundles |
| Unsafe MCP output | tool allowlists and compact machine-readable responses | response-size budget tests for every new MCP tool |
| Unsafe local command execution | benchmark subprocess execution is explicit CLI action | runner allowlists, command audit, and user confirmation for any hosted-triggered runner |
| Session disclosure | hashed lookup keys and redacted payloads | rotation policy, retention policy, and provider-specific logout behavior |
| Misleading ROI claims | measurement mode, confidence labels, evidence bundles, trend digest | repeated observed-run review before public case-study claims |
| Sensitive observability payloads | admin observability avoids raw secrets by contract | field allowlists and automated log redaction tests |
| Over-broad admin access | separate portal/admin permissions | internal access review, audit export, and break-glass process |
| Provider key leakage | masked CLI/API/UI output and encrypted portal storage when configured | OS keychain support, key rotation policy, provider spend alerts |
| Unsafe portal chat action | intent allowlist and confirmation-required state | route-by-route executor review, replay protection, action audit |
| Domain-pack artifact leakage | fake-data-only warnings and generated artifact validation | shared sanitizer for all pack outputs before hosted sync |
| Payment data exposure | no raw payment handling in current demo/billing surfaces | billing adapter threat model, PCI scope review, tokenized provider integration |

## Retention Plan

| Data class | Default current handling | Recommended production default | Export path |
|---|---|---|---|
| Local `.heart/cache` | owned by repo user | user-controlled cleanup command | local filesystem only |
| Local `.heart/benchmarks/evidence` | owned by repo user | retain until user deletes or exports | local filesystem only |
| Hosted repository profiles | retained while workspace is active | configurable workspace retention window | tenant-scoped service export |
| Hosted document summaries | retained while workspace is active | delete on workspace removal or doc withdrawal | tenant-scoped document export |
| Hosted benchmark reports | retained while workspace is active | configurable report retention by plan | tenant-scoped benchmark export |
| Hosted chat command records | retained by service storage | bounded retention by plan and workspace setting | tenant-scoped chat/audit export |
| Model provider key metadata | retained while configured | delete on key removal; retain redacted audit metadata only | tenant-scoped security export |
| Domain-pack generated artifacts | local-first by default | retain locally until user deletes; hosted copies plan-bound when synced | tenant-scoped artifact export |
| Sessions | retained by service storage | short-lived active sessions plus revocation history | admin/session audit export |
| Audit events | retained by service storage | plan-specific retention window | admin audit export |
| Observability metrics | retained by service storage | aggregated metrics with bounded trace retention | admin observability export |

Do not sync raw customer source, raw prompts, raw patches, raw credentials, or full private document bodies into hosted storage unless a future opt-in security story defines the control, retention, and export contract.

## Export Plan

Current export capabilities:

- `heart service export` writes a canonical service snapshot.
- hosted service storage includes tenant-scoped artifacts for repository, document, benchmark, session, audit, and observability records.
- admin observability export can queue and flush operational exports.

Required production export behavior:

- tenant owner can request workspace export
- export excludes raw secrets and raw local-only evidence by default
- export manifest lists data classes, generated time, requester, and redaction status
- export files are scoped to one tenant/workspace/customer
- deletion requests produce an audit event and remove hosted summaries after the configured retention window

## Deployment Posture

Current supported deployments:

- local-only CLI and MCP
- standalone hosted API
- Next.js website, portal, and admin
- SQLite service storage for local/demo deployments
- Postgres adapter path for hosted deployments

Future deployment decisions required:

- private deployment model and tenant isolation guarantees
- SSO/SAML provider requirements
- production secret management
- backup and restore policy
- audit retention settings
- raw artifact opt-in policy, if ever needed
- billing provider and entitlement adapter security model
- provider-key rotation and revocation behavior
- portal chat executor authorization and replay prevention

## Buyer-Facing Language

Safe current language:

- "Local-first by default."
- "Hosted sync publishes sanitized summaries and manifests."
- "Raw benchmark evidence remains local unless explicitly sanitized."
- "Portal/admin access is tenant-scoped and role-aware."
- "Security posture is documented; formal compliance certifications are not claimed."
- "Provider keys are masked; portal BYOK requires encrypted storage or server-side secrets."
- "Domain-pack and demo-kit outputs are source-cited, fake-data-only artifacts."

Avoid:

- claiming SOC 2, ISO 27001, HIPAA, PCI, or FedRAMP
- implying hosted sync stores a full source mirror
- implying ROI claims apply beyond the benchmark scenarios measured
- implying SSO/SAML/private deployment is generally available before implementation and testing
- implying portal chat can safely execute arbitrary code or account/payment changes
- implying demo-kit payment flows are production billing/payment implementations

## Validation Hooks

- `tests/service-access.test.js` covers tenant-scoped repository and document reads.
- `tests/session-security.test.js` covers session token hashing and redaction.
- `tests/service-http-auth.test.js` covers CSRF and provider-secret rejection paths.
- `tests/benchmark.test.js` covers unsafe benchmark artifact publication rejection.
- `tests/planning-change-request.test.js` covers redaction in planning change request records.
