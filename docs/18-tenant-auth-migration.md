# Tenant Auth And Migration Layer

`BeHeart` now has a concrete path from local-first demo mode to multi-customer hosted mode.

## What Exists Now

- Canonical service store in SQLite at `services/api/data/service-storage.sqlite`
- Stable workspace identity records in `workspace_identities`
- Actor and membership registry in `actors` and `memberships`
- Session table in `sessions`
- Hosted auth provider discovery via `/api/auth/providers`
- OIDC authorization start/callback through `/auth/authorize/:provider` and `/auth/callback/:provider`
- OIDC provider token exchange into scoped app sessions through `/api/session/provider`
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
  - `x-be-ai-heart-session` header
  - `be_ai_heart_session` cookie
- Session resolution maps to:
  - actor
  - workspace scope
  - customer scope
- Local demo defaults are seeded for:
  - `portal-demo-session`
  - `admin-owner-session`

## Write Access Rules

- Owner actors can read and write all workspaces
- Customer actors can write only workspaces they can manage
- Existing workspaces are checked against membership and customer scope
- New workspaces can be provisioned through the write layer before first profile/doc/benchmark sync

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
- Add server-side session hardening such as rotating cookies and stricter CSRF/origin policy
- Introduce UUID-based `customer_id` while preserving `workspace_slug` as external stable identifier
- Add production migrations and observability around hosted Postgres failover and backfills
