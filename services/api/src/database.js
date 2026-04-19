import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function resolveServiceDatabasePath(serviceStorageRoot) {
  return path.join(path.resolve(serviceStorageRoot), "service-storage.sqlite");
}

export function withServiceDatabase(serviceStorageRoot, callback) {
  const root = path.resolve(serviceStorageRoot);
  mkdirSync(root, { recursive: true });

  const databasePath = resolveServiceDatabasePath(root);
  const database = new DatabaseSync(databasePath);
  configureDatabase(database);
  ensureServiceSchema(database);

  try {
    return callback(database, {
      databasePath,
      root,
    });
  } finally {
    database.close();
  }
}

function configureDatabase(database) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `);
}

function ensureServiceSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      customer_slug TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_customers_slug
    ON customers (customer_slug);

    CREATE TABLE IF NOT EXISTS repository_profiles (
      profile_slug TEXT PRIMARY KEY,
      workspace_slug TEXT NOT NULL,
      customer_slug TEXT NOT NULL,
      repo TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_repository_profiles_workspace
    ON repository_profiles (workspace_slug);

    CREATE TABLE IF NOT EXISTS repository_documents (
      profile_slug TEXT PRIMARY KEY,
      workspace_slug TEXT NOT NULL,
      customer_slug TEXT NOT NULL,
      repo TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      document_count INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_repository_documents_workspace
    ON repository_documents (workspace_slug);

    CREATE TABLE IF NOT EXISTS document_submissions (
      submission_id TEXT PRIMARY KEY,
      profile_slug TEXT NOT NULL,
      workspace_slug TEXT NOT NULL,
      customer_slug TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_document_submissions_profile_updated
    ON document_submissions (profile_slug, updated_at DESC);

    CREATE TABLE IF NOT EXISTS benchmark_reports (
      report_id TEXT PRIMARY KEY,
      profile_slug TEXT NOT NULL,
      workspace_slug TEXT NOT NULL,
      customer_slug TEXT NOT NULL,
      repo TEXT NOT NULL,
      scenario TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      token_savings_pct REAL NOT NULL DEFAULT 0,
      memory_refresh_reduction_pct REAL NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_benchmark_reports_profile_generated
    ON benchmark_reports (profile_slug, generated_at DESC);

    CREATE TABLE IF NOT EXISTS agent_runs (
      run_id TEXT PRIMARY KEY,
      profile_slug TEXT NOT NULL,
      workspace_slug TEXT NOT NULL,
      customer_slug TEXT NOT NULL,
      repo TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      agent_client TEXT NOT NULL,
      upstream_base_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      exit_code INTEGER,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      token_cost_usd REAL NOT NULL DEFAULT 0,
      observed_usage_coverage_pct REAL NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_created
    ON agent_runs (workspace_slug, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_agent_runs_scenario_mode_created
    ON agent_runs (scenario_id, mode, created_at DESC);

    CREATE TABLE IF NOT EXISTS llm_calls (
      llm_call_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      request_kind TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      latency_ms REAL NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      reasoning_tokens INTEGER NOT NULL DEFAULT 0,
      cached_input_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      usage_available INTEGER NOT NULL DEFAULT 0,
      request_hash TEXT NOT NULL,
      response_id TEXT,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(run_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_llm_calls_run_sequence
    ON llm_calls (run_id, sequence ASC);

    CREATE INDEX IF NOT EXISTS idx_llm_calls_created
    ON llm_calls (created_at DESC);

    CREATE TABLE IF NOT EXISTS website_intake_requests (
      request_id TEXT PRIMARY KEY,
      intake_kind TEXT NOT NULL,
      full_name TEXT NOT NULL,
      work_email TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      team_size INTEGER NOT NULL DEFAULT 0,
      repo_count INTEGER NOT NULL DEFAULT 0,
      primary_goal TEXT NOT NULL,
      message TEXT NOT NULL,
      source_page TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_website_intake_requests_kind_created
    ON website_intake_requests (intake_kind, created_at DESC);

    CREATE TABLE IF NOT EXISTS workspaces (
      workspace_slug TEXT PRIMARY KEY,
      customer_slug TEXT NOT NULL,
      profile_slug TEXT NOT NULL,
      repo TEXT NOT NULL,
      latest_sync_at TEXT NOT NULL,
      profile_synced_at TEXT NOT NULL,
      documents_synced_at TEXT NOT NULL,
      latest_benchmark_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_customer
    ON workspaces (customer_slug);

    CREATE TABLE IF NOT EXISTS workspace_identities (
      workspace_slug TEXT PRIMARY KEY,
      customer_slug TEXT NOT NULL,
      profile_slug TEXT NOT NULL,
      repo TEXT NOT NULL,
      display_name TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      owner_actor_slug TEXT,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_sync_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_identities_customer
    ON workspace_identities (customer_slug);

    CREATE TABLE IF NOT EXISTS actors (
      actor_slug TEXT NOT NULL,
      surface TEXT NOT NULL,
      role TEXT NOT NULL,
      access_mode TEXT NOT NULL,
      customer_slug TEXT,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (actor_slug, surface)
    );

    CREATE TABLE IF NOT EXISTS memberships (
      actor_slug TEXT NOT NULL,
      workspace_slug TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (actor_slug, workspace_slug)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_token TEXT PRIMARY KEY,
      actor_slug TEXT NOT NULL,
      surface TEXT NOT NULL,
      workspace_slug TEXT,
      customer_slug TEXT,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_actor_surface
    ON sessions (actor_slug, surface);

    CREATE TABLE IF NOT EXISTS rate_limits (
      limiter_key TEXT PRIMARY KEY,
      route_kind TEXT NOT NULL,
      surface TEXT NOT NULL,
      window_started_at TEXT NOT NULL,
      reset_at TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at
    ON rate_limits (reset_at);

    CREATE TABLE IF NOT EXISTS audit_events (
      event_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      action TEXT NOT NULL,
      outcome TEXT NOT NULL,
      surface TEXT,
      actor_slug TEXT,
      workspace_slug TEXT,
      customer_slug TEXT,
      target_type TEXT,
      target_id TEXT,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_events_created
    ON audit_events (created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_audit_events_action_created
    ON audit_events (action, created_at DESC);

    CREATE TABLE IF NOT EXISTS request_traces (
      trace_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      method TEXT NOT NULL,
      route_kind TEXT NOT NULL,
      path TEXT NOT NULL,
      surface TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      duration_ms REAL NOT NULL,
      actor_slug TEXT,
      workspace_slug TEXT,
      customer_slug TEXT,
      client_key_hash TEXT,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_request_traces_created
    ON request_traces (created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_request_traces_route_created
    ON request_traces (route_kind, created_at DESC);

    CREATE TABLE IF NOT EXISTS observability_exports (
      export_id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      destination TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL,
      last_attempt_at TEXT,
      delivered_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_observability_exports_status_due
    ON observability_exports (status, next_attempt_at ASC);

    CREATE TABLE IF NOT EXISTS auth_transactions (
      state TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      surface TEXT NOT NULL,
      return_to TEXT NOT NULL,
      workspace_slug TEXT,
      customer_slug TEXT,
      redirect_uri TEXT NOT NULL,
      nonce TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_auth_transactions_provider_surface
    ON auth_transactions (provider_id, surface, expires_at);
  `);

  ensureTableColumns(database, "workspace_identities", [
    { name: "customer_id", sql: "customer_id TEXT" },
  ]);
  ensureTableColumns(database, "actors", [
    { name: "customer_id", sql: "customer_id TEXT" },
  ]);
  ensureTableColumns(database, "sessions", [
    { name: "session_id", sql: "session_id TEXT" },
    { name: "session_family_id", sql: "session_family_id TEXT" },
    { name: "customer_id", sql: "customer_id TEXT" },
    { name: "revoked_at", sql: "revoked_at TEXT" },
    { name: "revocation_reason", sql: "revocation_reason TEXT" },
    { name: "last_seen_at", sql: "last_seen_at TEXT" },
  ]);
  ensureTableColumns(database, "audit_events", [
    { name: "customer_id", sql: "customer_id TEXT" },
  ]);
  ensureTableColumns(database, "request_traces", [
    { name: "customer_id", sql: "customer_id TEXT" },
  ]);

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_id
    ON sessions (session_id);

    CREATE INDEX IF NOT EXISTS idx_sessions_family
    ON sessions (session_family_id);

    CREATE INDEX IF NOT EXISTS idx_sessions_customer_surface
    ON sessions (customer_slug, surface);

    CREATE INDEX IF NOT EXISTS idx_sessions_status
    ON sessions (revoked_at, expires_at);
  `);
}

function ensureTableColumns(database, tableName, columns) {
  const existingColumns = new Set(
    database
      .prepare(`PRAGMA table_info(${tableName})`)
      .all()
      .map((row) => String(row.name ?? "")),
  );

  for (const column of columns) {
    if (existingColumns.has(column.name)) {
      continue;
    }

    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${column.sql}`);
  }
}
