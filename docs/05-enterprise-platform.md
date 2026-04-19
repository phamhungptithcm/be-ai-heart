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

Admin page intent:

- `Customers`: real account inventory with health, readiness, plan, and renewal context
- `Support`: actionable queues, assignment fields, and internal notes scaffolding
- `Revenue`: pipeline, conversion, expansion, and retention separated clearly
- `Sessions & Audit`: internal session registry and admin audit events
- `Observability`: requests, metrics, alerts, and export posture from hosted APIs
- `Billing Ops`: plan posture, entitlements, billing status, adapter-friendly mock or live contracts

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

Buy or integrate for the rest behind adapter seams:

- billing and subscriptions: `Stripe`
- hosted auth and SSO: `Auth0` or `Clerk`
- CRM and pipeline: `HubSpot` or equivalent
- deeper reporting: internal admin plus optional BI tooling

Provider adapters must support mock-safe operation without live credentials. UI payloads must never expose secrets, raw access tokens, or client secrets.

## Non-Negotiable Enterprise Rules

- Keep `website`, `portal`, and `admin` separate.
- Reuse existing packages, services, and API routes before adding new ones.
- Keep local-first workflows obvious even when hosted surfaces are enabled.
- Prefer boring, testable contracts over custom platform sprawl.
- Treat auth, billing, admin, audit, and observability work as security-sensitive by default.
