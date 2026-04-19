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
}
