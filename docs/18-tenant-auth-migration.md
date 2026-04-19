# Tenant Auth And Migration Layer

`BeHeart` now has a concrete path from local-first demo mode to multi-customer hosted mode.

## What Exists Now

- Canonical service store in SQLite at `services/api/data/service-storage.sqlite`
- Stable workspace identity records in `workspace_identities`
- Actor and membership registry in `actors` and `memberships`
- Session table in `sessions`
- Customer registry in `customers` with UUID-backed `customer_id`
- Hosted auth provider discovery via `/api/auth/providers`
- OIDC authorization start/callback through `/auth/authorize/:provider` and `/auth/callback/:provider`
- OIDC provider token exchange into scoped app sessions through `/api/session/provider`
- Durable rate limiting backed by SQLite or Postgres instead of in-memory host-local counters, with explicit namespace isolation for shared deployments
- Request body size limits and query-level pagination or filtering for workspaces, repositories, benchmarks, and intake listings
- Append-only audit events at `services/api/data/audit/events.ndjson` for hosted auth, write operations, and rate-limit blocks
- Hosted request tracing at `services/api/data/telemetry/requests.ndjson`
- Observability export outbox in `observability_exports` plus mirrored `services/api/data/telemetry/exports.ndjson`
- Admin observability endpoints at:
  - `/api/admin/audit/events`
  - `/api/admin/sessions`
  - `/api/admin/observability/requests`
  - `/api/admin/observability/metrics`
  - `/api/admin/observability/alerts`
  - `/api/admin/observability/exports`
- Tenant-scoped portal enterprise endpoints at:
  - `/api/account`
  - `/api/overview`
  - `/api/usage/summary`
  - `/api/billing`
  - `/api/members`
  - `/api/policies`
  - `/api/security`
  - `/api/settings`
  - `/api/sessions`
  - `/api/audit/events`
- Prometheus-style metrics export at `/metrics`
- Tenant-scoped write services for:
  - repository profiles
  - repository documents
  - benchmark reports
- CLI HTTP sync lane for:
  - `heart auth provider-session`
  - `heart sync profile`
  - `heart sync docs`
  - `heart sync benchmark`
- Hosted Postgres repository adapter in `services/api/src/postgres-repository.js`
- Standalone API host in `services/api/src/server.js` and `services/api/src/http.js`
- Website, portal, and admin clients now talk directly to the standalone service host instead of Next App Routes

## Session Model

- Request auth resolution prefers:
  - `session` query param
  - `be_ai_heart_session` cookie
  - `x-be-ai-heart-session` header
- Session resolution maps to:
  - actor
  - workspace scope
  - customer scope
- Session registry keeps:
  - `session_id`
  - `session_family_id`
  - `customer_id`
  - `revoked_at`
  - `revocation_reason`
  - `last_seen_at`
- Persisted session rows store a hashed lookup key, while `payload_json` keeps the session token redacted
- Hosted OIDC callback now establishes an HttpOnly cookie and redirects with `session_established=1` instead of leaking a raw session token in the URL
- Cookie-backed write requests require an allowed `Origin` and a matching `x-be-ai-heart-csrf` token
- Session cookies rotate on a configurable cadence to narrow replay windows
- Admin session registry reads and revocations operate on redacted session payloads so raw session material does not leak into audit or operational surfaces
- Local demo defaults are seeded for:
  - `portal-demo-session`
  - `admin-owner-session`

## Write Access Rules

- Owner actors can read and write all workspaces
- Customer actors can write only workspaces they can manage
- Existing workspaces are checked against membership and customer scope
- New workspaces can be provisioned through the write layer before first profile/doc/benchmark sync

## Portal Role Model

Canonical portal roles:

- `org_admin`
- `engineer`
- `finance_viewer`
- `security_viewer`

Legacy roles are normalized into the canonical set at request time so hosted contracts and UI navigation stay stable while older local/demo records still work.

## Migration Path To Postgres

Current CLI export:

```bash
node ./packages/cli/bin/heart.js service export --json
node ./packages/cli/bin/heart.js auth provider-session --url https://portal.example.com --id-token <jwt>
node ./packages/cli/bin/heart.js sync profile --url https://portal.example.com --session <session-token>
```

This writes a canonical snapshot containing:

- all SQLite tables
- source metadata
- a staged Postgres migration plan

Recommended rollout:

1. Keep SQLite as local/demo storage and boot path.
2. Run hosted read/write traffic through the Postgres repository adapter behind `BE_AI_HEART_SERVICE_STORAGE_BACKEND=postgres`.
3. Migrate actors, memberships, sessions, and workspace identities into the hosted Postgres environment.
4. Keep JSON mirrors only for public artifact publishing and offline inspection.

## Current Gaps To Finish

- Configure real Clerk/Auth0 production credentials and callback URLs in the hosted environment
- Replace single-primary durable rate limiting with a genuinely multi-region strategy if the hosted control plane fans out beyond one primary data store
- Forward observability exports into an external telemetry stack with alert routing and retention controls
- Add production migrations and deeper observability around hosted Postgres failover and backfills
