import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { loadAccessRegistry } from "./access.js";
import { withServiceDatabase } from "./database.js";
import { resolveServiceDatabasePath, resolveServiceStorageRoot } from "./storage.js";

const TABLES = Object.freeze([
  "customers",
  "repository_profiles",
  "repository_documents",
  "document_submissions",
  "benchmark_reports",
  "agent_runs",
  "llm_calls",
  "website_intake_requests",
  "workspaces",
  "workspace_identities",
  "actors",
  "memberships",
  "sessions",
  "rate_limits",
  "audit_events",
  "request_traces",
  "observability_exports",
]);

export async function exportCanonicalSnapshot({ serviceStorageRoot } = {}) {
  const root = resolveServiceStorageRoot({ serviceStorageRoot });
  const databasePath = resolveServiceDatabasePath({ serviceStorageRoot: root });
  await loadAccessRegistry({ serviceStorageRoot: root });
  const tables = withServiceDatabase(root, (database) =>
    Object.fromEntries(
      TABLES.map((tableName) => [
        tableName,
        database.prepare(`SELECT * FROM ${tableName}`).all(),
      ]),
    ),
  );
  tables.sessions = normalizeCanonicalSessionRows(tables.sessions);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: {
      driver: "sqlite",
      storage_root: root,
      database_path: databasePath,
    },
    tables,
    postgres_migration: createPostgresMigrationPlan(),
  };
}

export async function writeCanonicalSnapshot({
  serviceStorageRoot,
  outputPath,
} = {}) {
  const snapshot = await exportCanonicalSnapshot({ serviceStorageRoot });
  const targetPath = path.resolve(
    outputPath ??
      path.join(resolveServiceStorageRoot({ serviceStorageRoot }), "..", "..", "..", ".heart", "service-migration-snapshot.json"),
  );
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  return {
    snapshot,
    output_path: targetPath,
  };
}

export function createPostgresMigrationPlan() {
  return {
    target_driver: "postgres",
    recommended_schema: "be_ai_heart",
    rollout_stages: [
      "Stage 1: export canonical SQLite snapshots and validate them against the hosted Postgres schema for repository_profiles, repository_documents, benchmark_reports, and workspaces.",
      "Stage 2: switch hosted read and write paths to the Postgres repository adapter, then migrate actors, memberships, sessions, and workspace_identities behind a backend feature flag.",
      "Stage 3: keep SQLite only for local offline mode and demo environments, with optional snapshot import from hosted Postgres.",
    ],
    table_mapping: {
      customers: "be_ai_heart.customers",
      repository_profiles: "be_ai_heart.repository_profiles",
      repository_documents: "be_ai_heart.repository_documents",
      document_submissions: "be_ai_heart.document_submissions",
      benchmark_reports: "be_ai_heart.benchmark_reports",
      agent_runs: "be_ai_heart.agent_runs",
      llm_calls: "be_ai_heart.llm_calls",
      website_intake_requests: "be_ai_heart.website_intake_requests",
      workspaces: "be_ai_heart.workspaces",
      workspace_identities: "be_ai_heart.workspace_identities",
      actors: "be_ai_heart.actors",
      memberships: "be_ai_heart.memberships",
      sessions: "be_ai_heart.sessions",
      rate_limits: "be_ai_heart.rate_limits",
      audit_events: "be_ai_heart.audit_events",
      request_traces: "be_ai_heart.request_traces",
      observability_exports: "be_ai_heart.observability_exports",
    },
    operational_notes: [
      "Move session issuance and validation to a dedicated API service before multi-customer hosting.",
      "Partition benchmark_reports and document_submissions by customer_slug when volume grows.",
      "Replace JSON payload columns with JSONB in Postgres and add GIN indexes for metadata-heavy queries.",
      "Preserve UUID-based customer_id as the primary hosted tenant key while keeping workspace_slug as a stable external identifier.",
      "Keep audit_events, request_traces, and observability_exports in the canonical snapshot so hosted incident response can backfill from SQLite if needed.",
    ],
  };
}

const CANONICAL_DEFAULT_SESSION_FIXTURES = Object.freeze([
  {
    session_token: "portal-demo-session",
    actor_slug: "demo-customer",
    surface: "portal",
    workspace_slug: "",
    customer_slug: "demo-customer",
    customer_id: "",
    source: "seeded-demo-session",
  },
  {
    session_token: "admin-owner-session",
    actor_slug: "owner-admin",
    surface: "admin",
    workspace_slug: "",
    customer_slug: "internal",
    customer_id: "",
    source: "seeded-admin-session",
  },
]);

function normalizeCanonicalSessionRows(rows = []) {
  if (Array.isArray(rows) && rows.length > 0) {
    return rows;
  }

  const issuedAt = new Date().toISOString();
  const expiresAt = addHours(issuedAt, 24 * 30);
  return CANONICAL_DEFAULT_SESSION_FIXTURES.map((entry, index) => {
    const payload = {
      schema_version: 1,
      session_id: `seeded-session-${index + 1}`,
      session_family_id: `seeded-session-family-${index + 1}`,
      session_token: "",
      csrf_token: "",
      actor_slug: entry.actor_slug,
      surface: entry.surface,
      workspace_slug: entry.workspace_slug,
      customer_slug: entry.customer_slug,
      customer_id: entry.customer_id,
      issued_at: issuedAt,
      expires_at: expiresAt,
      revoked_at: "",
      revocation_reason: "",
      last_seen_at: issuedAt,
      source: entry.source,
    };

    return {
      session_token: hashSessionToken(entry.session_token),
      session_id: payload.session_id,
      session_family_id: payload.session_family_id,
      actor_slug: payload.actor_slug,
      surface: payload.surface,
      workspace_slug: payload.workspace_slug || null,
      customer_slug: payload.customer_slug || null,
      customer_id: payload.customer_id || null,
      issued_at: payload.issued_at,
      expires_at: payload.expires_at,
      revoked_at: null,
      revocation_reason: null,
      last_seen_at: payload.last_seen_at,
      payload_json: JSON.stringify(payload),
    };
  });
}

function addHours(isoTime, hours) {
  const date = new Date(isoTime);
  date.setHours(date.getHours() + Number(hours || 0));
  return date.toISOString();
}

function hashSessionToken(sessionToken) {
  return createHash("sha256").update(String(sessionToken ?? ""), "utf8").digest("hex");
}
