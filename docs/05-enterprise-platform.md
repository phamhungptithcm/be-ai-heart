# Enterprise Platform Boundaries

`be-ai-heart` has three separate web surfaces on purpose:

- `website`: public acquisition, docs, trust, pricing, benchmark proof, sign-in entry
- `portal`: customer and org-admin workspace for tenant-scoped operations
- `admin`: internal-only BeHeart control plane for support, revenue, billing ops, audit, and observability

These surfaces must not collapse into one blended application. Customer actors must never see internal admin controls, internal session registries, platform observability, or control-plane actions.

## Boundary Rules

### Website

Use the website for:

- product narrative
- docs and onboarding guidance
- benchmark proof and trust posture
- pricing and plan framing
- sign-in and trial/demo entry points

Do not use the website for authenticated tenant operations or internal control-plane work.

### Portal

Use the portal for:

- tenant-scoped repository readiness and sync truth
- documents and project memory artifacts
- synced-artifact context pack previews that route final generation back to local `heart pack`
- AI chat command records and model/provider selection over synced artifacts
- domain pack browsing, layer selection, conflict checks, and demo-safe artifact generation
- benchmark evidence and ROI explanation
- usage and billing posture for the customer org
- team access, security audit, and org settings

Portal data must be tenant-safe by default. Customer-facing metrics must come from workspace or tenant truth, not repo-global demo data.

### Admin

Use admin for:

- internal customer inventory and account health
- support queues and internal notes scaffolding
- revenue, expansion, retention, and plan posture
- admin session registry and audit review
- hosted observability, alerts, request traces, and exports
- billing operations and entitlement posture

Admin is internal-only. Admin routes, actions, and payloads must stay inaccessible to portal actors.

## Role Model

### Internal Admin Roles

- `owner`
- `support_admin`
- `sales_ops`
- `customer_success`
- `engineering_admin`

Admin RBAC is additive and least-privilege. `owner` is the only broad internal role. Other roles get only the read or action scopes they need.

### Portal Roles

- `org_admin`
- `engineer`
- `finance_viewer`
- `security_viewer`

Portal RBAC is also additive and least-privilege:

- `org_admin`: full tenant administration across workspace, governance, billing, and settings
- `engineer`: repository rollout, document memory, benchmark readiness, and repo policy settings
- `finance_viewer`: benchmark ROI, usage framing, plan posture, seats, invoices, and upgrade readiness
- `security_viewer`: tenant-scoped sessions, audit trail, retention posture, and auth visibility

Legacy local or demo roles can be normalized into the canonical set at request time, but UI navigation and API contracts should emit the canonical role names above.

## Portal Information Architecture

Portal pages for Phase 1:

- `Overview`
- `Repositories`
- `Documents`
- `Benchmarks`
- `Workbench`
- `Models`
- `Domain Packs`
- `Usage`
- `Billing`
- `Team & Access`
- `Security & Audit`
- `Settings`

Portal overview should make activation and trust obvious:

- repos onboarded
- memory-ready repos
- stale repos
- latest sync freshness
- benchmark-backed repos
- average token savings
- average review cleanup reduction
- estimated monthly savings USD
- open critical alerts
- plan and entitlement status

Portal page intent:

- `Repositories`: readiness and sync truth, not just artifact counts
- `Benchmarks`: benchmark history plus a local-first launcher when the hosted service still has access to the workspace repo path on the current host
- `Usage`: benchmark-derived ROI separated from real metered usage
- `Billing`: plan, seats, invoices, entitlements, and upgrade readiness
- `Team & Access`: members, roles, SSO status, invites, active sessions
- `Security & Audit`: tenant-scoped audit events, session history, retention and export posture
- `Settings`: org profile, repo policy defaults, integration state
- `Workbench`: allowlisted portal chat and product actions over synced repo/domain artifacts
- `Models`: provider/model visibility, masked key state, presets, token budgets, and cost hints
- `Domain Packs`: source-backed pack browser, layer overlays, generated demo artifacts, citations, and security warnings

Production security, retention, export, and deployment boundaries are tracked in [Production Threat Model, Retention, and Export Plan](./26-production-threat-model-retention.md). Enterprise UI should reflect those boundaries instead of implying raw hosted source mirrors or unsupported compliance claims.

## Admin Information Architecture

Admin pages for Phase 1:

- `Overview`
- `Customers`
- `Support`
- `Documents`
- `Benchmarks`
- `Revenue`
- `Ops Health`
- `Sessions & Audit`
- `Observability`
- `Billing Ops`

Admin overview should answer internal operating questions quickly:

- active orgs
- active trials
- benchmark-backed orgs
- expansion-ready orgs
- queued submissions
- failed syncs
- auth failures
- 5xx and alert posture
- at-risk accounts

The founder dashboard extension also tracks:

- total users
- active workspaces and repositories
- scans per day/week
- context packs generated
- MCP connections
- benchmark runs
- token savings reported and estimated cost savings
- estimated MRR/ARR, churn, retention, activation, and trial-to-active conversion
- design partner pipeline and enterprise leads
- support issues, failed sync jobs, risky tenants/repos, API/job health, and audit/security events

Financial values are estimates until a billing provider adapter is configured. The UI labels the source as synced
artifacts, intake, audit events, telemetry, and estimated finance rather than presenting it as booked revenue.

Admin page intent:

- `Customers`: real account inventory with health, readiness, plan, and renewal context
- `Support`: actionable queues, assignment fields, and internal notes scaffolding
- `Revenue`: pipeline, conversion, expansion, and retention separated clearly
- `Sessions & Audit`: internal session registry and admin audit events
- `Observability`: requests, metrics, alerts, and export posture from hosted APIs
- `Billing Ops`: plan posture, entitlements, billing status, adapter-friendly mock or live contracts

Payment and billing readiness:

- Current portal/admin billing views are readiness and posture surfaces, not a live billing system.
- Seats, invoices, subscriptions, entitlements, and plan state should come from a billing adapter when configured.
- Mock-safe fallbacks are acceptable for local demos and internal testing only.
- No portal/admin response may expose payment provider secrets, raw card data, bank data, or customer payment credentials.

## Metric Taxonomy And Source Of Truth

Every enterprise metric should identify its source type:

- `repo_artifact`
- `benchmark_artifact`
- `hosted_telemetry`
- `external_integration`

Source-of-truth rules:

- Repository readiness, sync freshness, stale repo status, and memory coverage come from tenant-scoped workspace and profile artifacts.
- Savings, review cleanup reduction, and benchmark readiness come from benchmark artifacts and must be labeled as benchmark-derived.
- Metered requests, auth failures, 5xx posture, and alert counts come from hosted telemetry.
- Seats, invoices, subscriptions, plan posture, and auth-provider state come from external-integration adapters when configured, or mock-safe fallbacks when not configured.
- `.worktrees` must be excluded from default scanning so customer-facing counts are not inflated by local engineering worktrees.
- Customer-facing surfaces must not present repo-global demo truth as tenant truth.

## Build Vs Buy

For this phase, do not build a full CRM or full billing stack from scratch.

Build directly in BeHeart only what is core to product trust and tenant operations:

- tenant and workspace inventory
- repository readiness and sync truth
- benchmark evidence presentation
- admin customer health and support queues
- session, audit, and observability visibility
- entitlement and plan posture contracts
- model-provider settings and masked key state
- domain-pack generated artifact contracts

Buy or integrate for the rest behind adapter seams:

- billing and subscriptions: `Stripe`
- hosted auth and SSO: `Auth0` or `Clerk`
- CRM and pipeline: `HubSpot` or equivalent
- deeper reporting: internal admin plus optional BI tooling

Provider adapters must support mock-safe operation without live credentials. UI payloads must never expose secrets, raw access tokens, or client secrets.
Local dummy sign-in is allowed only behind `BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH=1`; provider payloads may expose demo account links in that mode, but production auth surfaces must rely on configured hosted providers and scoped sessions.

## Portal Chat And Model Governance

Portal chat is a governed product surface, not a browser shell.

Allowed portal behavior:

- read synced repository, document, diagram, benchmark, and domain-pack artifacts
- create command records for allowlisted product actions
- return cited result cards, status, next actions, and confirmation-required states
- show selected provider/model/preset/token budget/cost hints

Disallowed by default:

- arbitrary shell execution
- raw local file reads from unsynced paths
- raw source mirror access
- provider key display
- money-changing, account-changing, or destructive actions without a future explicit approval/control story

Enterprise model administration remains planned. The current implementation supports provider-neutral settings, local CLI
keys, server environment keys, encrypted portal BYOK where configured, and masked UI/API state.

## Deployment And Operations Readiness

Current supported posture:

- local CLI and MCP
- standalone hosted API for guided portal/admin workflows
- Next.js website, portal, and admin surfaces
- SQLite for local/demo service storage
- Postgres adapter path for hosted storage
- admin observability, request metrics, sessions/audit views, and export scaffolding

Before broad enterprise deployment, the product needs explicit hardening for SSO/SAML, RBAC route review, billing
provider integration, tenant-isolation tests, backup/restore, retention/deletion operations, private deployment, secret
management, and operational runbooks.

## Non-Negotiable Enterprise Rules

- Keep `website`, `portal`, and `admin` separate.
- Reuse existing packages, services, and API routes before adding new ones.
- Keep local-first workflows obvious even when hosted surfaces are enabled.
- Prefer boring, testable contracts over custom platform sprawl.
- Treat auth, billing, admin, audit, and observability work as security-sensitive by default.
