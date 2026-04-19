const POSTGRES_POOL_CACHE = new Map();
const POSTGRES_SCHEMA_CACHE = new Map();

export function isPostgresStorageEnabled() {
  return String(process.env.BE_AI_HEART_SERVICE_STORAGE_BACKEND ?? "").trim().toLowerCase() === "postgres";
}

export function resolvePostgresStorageConfig() {
  return {
    enabled: isPostgresStorageEnabled(),
    databaseUrl: String(process.env.BE_AI_HEART_POSTGRES_URL ?? "").trim(),
    schema: String(process.env.BE_AI_HEART_POSTGRES_SCHEMA ?? "be_ai_heart").trim() || "be_ai_heart",
  };
}

export async function upsertRepositoryProfileInPostgres({ profile } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "repository_profiles")} (
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          generated_at,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT (profile_slug) DO UPDATE SET
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          repo = excluded.repo,
          generated_at = excluded.generated_at,
          payload_json = excluded.payload_json
      `,
      [
        String(profile.profile_slug ?? ""),
        String(profile.workspace_slug ?? profile.profile_slug ?? ""),
        String(profile.customer_slug ?? profile.profile_slug ?? ""),
        String(profile.repo ?? ""),
        String(profile.generated_at ?? ""),
        JSON.stringify(profile),
      ],
    );
  });
}

export async function upsertRepositoryDocumentInPostgres({ artifact } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "repository_documents")} (
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          generated_at,
          document_count,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (profile_slug) DO UPDATE SET
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          repo = excluded.repo,
          generated_at = excluded.generated_at,
          document_count = excluded.document_count,
          payload_json = excluded.payload_json
      `,
      [
        String(artifact.profile_slug ?? ""),
        String(artifact.workspace_slug ?? artifact.profile_slug ?? ""),
        String(artifact.customer_slug ?? artifact.profile_slug ?? ""),
        String(artifact.repo ?? ""),
        String(artifact.generated_at ?? ""),
        Number(artifact.totals?.document_count ?? artifact.documents?.length ?? 0),
        JSON.stringify(artifact),
      ],
    );
  });
}

export async function upsertDocumentSubmissionInPostgres({ submission } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "document_submissions")} (
          submission_id,
          profile_slug,
          workspace_slug,
          customer_slug,
          title,
          category,
          summary,
          updated_at,
          source,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        ON CONFLICT (submission_id) DO UPDATE SET
          profile_slug = excluded.profile_slug,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          title = excluded.title,
          category = excluded.category,
          summary = excluded.summary,
          updated_at = excluded.updated_at,
          source = excluded.source,
          payload_json = excluded.payload_json
      `,
      [
        String(submission.submission_id ?? ""),
        String(submission.profile_slug ?? ""),
        String(submission.workspace_slug ?? submission.profile_slug ?? ""),
        String(submission.customer_slug ?? submission.profile_slug ?? ""),
        String(submission.title ?? ""),
        String(submission.category ?? ""),
        String(submission.summary ?? ""),
        String(submission.updated_at ?? ""),
        String(submission.source ?? "unknown"),
        JSON.stringify(submission),
      ],
    );
  });
}

export async function upsertBenchmarkReportInPostgres({ report } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "benchmark_reports")} (
          report_id,
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          scenario,
          provider,
          model,
          generated_at,
          token_savings_pct,
          memory_refresh_reduction_pct,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
        ON CONFLICT (report_id) DO UPDATE SET
          profile_slug = excluded.profile_slug,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          repo = excluded.repo,
          scenario = excluded.scenario,
          provider = excluded.provider,
          model = excluded.model,
          generated_at = excluded.generated_at,
          token_savings_pct = excluded.token_savings_pct,
          memory_refresh_reduction_pct = excluded.memory_refresh_reduction_pct,
          payload_json = excluded.payload_json
      `,
      [
        String(report.report_id ?? ""),
        String(report.profile_slug ?? ""),
        String(report.workspace_slug ?? report.profile_slug ?? ""),
        String(report.customer_slug ?? report.profile_slug ?? ""),
        String(report.repo ?? ""),
        String(report.scenario ?? ""),
        String(report.provider ?? ""),
        String(report.model ?? ""),
        String(report.generated_at ?? ""),
        Number(report.metrics?.token_savings_pct ?? 0),
        Number(report.metrics?.memory_refresh_reduction_pct ?? 0),
        JSON.stringify(report),
      ],
    );
  });
}

export async function upsertWebsiteIntakeRequestInPostgres({ intakeRequest } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "website_intake_requests")} (
          request_id,
          intake_kind,
          full_name,
          work_email,
          company,
          role,
          team_size,
          repo_count,
          primary_goal,
          message,
          source_page,
          status,
          created_at,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
        ON CONFLICT (request_id) DO UPDATE SET
          intake_kind = excluded.intake_kind,
          full_name = excluded.full_name,
          work_email = excluded.work_email,
          company = excluded.company,
          role = excluded.role,
          team_size = excluded.team_size,
          repo_count = excluded.repo_count,
          primary_goal = excluded.primary_goal,
          message = excluded.message,
          source_page = excluded.source_page,
          status = excluded.status,
          created_at = excluded.created_at,
          payload_json = excluded.payload_json
      `,
      [
        String(intakeRequest.request_id ?? ""),
        String(intakeRequest.intake_kind ?? ""),
        String(intakeRequest.full_name ?? ""),
        String(intakeRequest.work_email ?? ""),
        String(intakeRequest.company ?? ""),
        String(intakeRequest.role ?? ""),
        Number(intakeRequest.team_size ?? 0),
        Number(intakeRequest.repo_count ?? 0),
        String(intakeRequest.primary_goal ?? ""),
        String(intakeRequest.message ?? ""),
        String(intakeRequest.source_page ?? ""),
        String(intakeRequest.status ?? "new"),
        String(intakeRequest.created_at ?? ""),
        JSON.stringify(intakeRequest),
      ],
    );
  });
}

export async function replaceWorkspaceRowsInPostgres({ workspaces = [] } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query("BEGIN");
    try {
      await pool.query(`DELETE FROM ${tableRef(config.schema, "workspaces")}`);
      for (const workspace of workspaces) {
        await pool.query(
          `
            INSERT INTO ${tableRef(config.schema, "workspaces")} (
              workspace_slug,
              customer_slug,
              profile_slug,
              repo,
              latest_sync_at,
              profile_synced_at,
              documents_synced_at,
              latest_benchmark_at,
              payload_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          `,
          [
            String(workspace.workspace_slug ?? ""),
            String(workspace.customer_slug ?? ""),
            String(workspace.profile_slug ?? workspace.workspace_slug ?? ""),
            String(workspace.repo ?? ""),
            String(workspace.latest_sync_at ?? ""),
            String(workspace.profile_synced_at ?? ""),
            String(workspace.documents_synced_at ?? ""),
            String(workspace.latest_benchmark_at ?? ""),
            JSON.stringify(workspace),
          ],
        );
      }
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  });
}

export async function loadRepositoryProfileIndexFromPostgres() {
  return queryPayloadRows("repository_profiles", `
    SELECT profile_slug, workspace_slug, customer_slug, repo, generated_at, payload_json
    FROM %TABLE%
    ORDER BY profile_slug
  `).then((rows) =>
    rows.map((row) => {
      const payload = parsePayload(row.payload_json, {});
      return {
        profile_slug: row.profile_slug,
        workspace_slug: row.workspace_slug,
        customer_slug: row.customer_slug,
        repo: row.repo,
        generated_at: row.generated_at,
        overview: payload.overview,
        heart: payload.heart,
        documents: payload.documents,
        cache: payload.cache,
      };
    }),
  );
}

export async function loadRepositoryDocumentIndexFromPostgres() {
  return queryPayloadRows("repository_documents", `
    SELECT profile_slug, workspace_slug, customer_slug, repo, generated_at, payload_json
    FROM %TABLE%
    ORDER BY profile_slug
  `).then((rows) =>
    rows.map((row) => {
      const payload = parsePayload(row.payload_json, {});
      return {
        profile_slug: row.profile_slug,
        workspace_slug: row.workspace_slug,
        customer_slug: row.customer_slug,
        repo: row.repo,
        generated_at: row.generated_at,
        totals: payload.totals ?? { document_count: payload.documents?.length ?? 0 },
        documents: (payload.documents ?? []).map((document) => ({
          path: document.path,
          title: document.title,
          category: document.category,
          summary: document.summary,
        })),
      };
    }),
  );
}

export async function loadDocumentSubmissionsFromPostgres() {
  return queryPayloadRows("document_submissions", `
    SELECT payload_json
    FROM %TABLE%
    ORDER BY updated_at DESC, submission_id ASC
  `).then((rows) => rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean));
}

export async function loadBenchmarkIndexFromPostgres({ createBenchmarkIndexEntry } = {}) {
  return queryPayloadRows("benchmark_reports", `
    SELECT payload_json
    FROM %TABLE%
    ORDER BY generated_at DESC, report_id ASC
  `).then((rows) =>
    rows
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean)
      .map((report) => createBenchmarkIndexEntry(report)),
  );
}

export async function loadBenchmarkHistoryEntriesFromPostgres({
  profileSlug,
  createBenchmarkIndexEntry,
} = {}) {
  return queryPayloadRows(
    "benchmark_reports",
    `
      SELECT payload_json
      FROM %TABLE%
      WHERE profile_slug = $1
      ORDER BY generated_at DESC, report_id ASC
    `,
    [String(profileSlug ?? "")],
  ).then((rows) =>
    rows
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean)
      .map((report) => createBenchmarkIndexEntry(report)),
  );
}

export async function loadWebsiteIntakeRequestsFromPostgres({ intakeKind } = {}) {
  const hasFilter = String(intakeKind ?? "").trim().length > 0;
  return queryPayloadRows(
    "website_intake_requests",
    `
      SELECT payload_json
      FROM %TABLE%
      ${hasFilter ? "WHERE intake_kind = $1" : ""}
      ORDER BY created_at DESC, request_id ASC
    `,
    hasFilter ? [String(intakeKind)] : [],
  ).then((rows) => rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean));
}

export async function loadWorkspaceRowsFromPostgres() {
  return queryPayloadRows("workspaces", `
    SELECT payload_json
    FROM %TABLE%
    ORDER BY workspace_slug
  `).then((rows) => rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean));
}

export async function upsertWorkspaceIdentityInPostgres({ identity } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "workspace_identities")} (
          workspace_slug,
          customer_slug,
          profile_slug,
          repo,
          display_name,
          plan,
          status,
          owner_actor_slug,
          source,
          created_at,
          updated_at,
          last_sync_at,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        ON CONFLICT (workspace_slug) DO UPDATE SET
          customer_slug = excluded.customer_slug,
          profile_slug = excluded.profile_slug,
          repo = excluded.repo,
          display_name = excluded.display_name,
          plan = excluded.plan,
          status = excluded.status,
          owner_actor_slug = excluded.owner_actor_slug,
          source = excluded.source,
          updated_at = excluded.updated_at,
          last_sync_at = excluded.last_sync_at,
          payload_json = excluded.payload_json
      `,
      [
        identity.workspace_slug,
        identity.customer_slug,
        identity.profile_slug,
        identity.repo,
        identity.display_name,
        identity.plan,
        identity.status,
        identity.owner_actor_slug || null,
        identity.source,
        identity.created_at,
        identity.updated_at,
        identity.last_sync_at,
        JSON.stringify(identity),
      ],
    );
  });
}

export async function loadWorkspaceIdentityFromPostgres({ workspaceSlug } = {}) {
  const rows = await queryPayloadRows(
    "workspace_identities",
    `
      SELECT payload_json
      FROM %TABLE%
      WHERE workspace_slug = $1
      LIMIT 1
    `,
    [String(workspaceSlug ?? "")],
  );
  return parsePayload(rows[0]?.payload_json, null);
}

export async function listWorkspaceIdentitiesFromPostgres({ customerSlug } = {}) {
  const sql = customerSlug
    ? `
        SELECT payload_json
        FROM %TABLE%
        WHERE customer_slug = $1
        ORDER BY workspace_slug
      `
    : `
        SELECT payload_json
        FROM %TABLE%
        ORDER BY workspace_slug
      `;
  const rows = await queryPayloadRows(
    "workspace_identities",
    sql,
    customerSlug ? [String(customerSlug)] : [],
  );
  return rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean);
}

export async function loadActorsFromPostgres() {
  const rows = await queryPayloadRows("actors", `
    SELECT payload_json
    FROM %TABLE%
    ORDER BY surface ASC, actor_slug ASC
  `);
  return rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean);
}

export async function loadMembershipsFromPostgres() {
  const rows = await queryPayloadRows("memberships", `
    SELECT payload_json
    FROM %TABLE%
    ORDER BY actor_slug ASC, workspace_slug ASC
  `);
  return rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean);
}

export async function writeActorsToPostgres({ actors = [] } = {}) {
  return withPostgresPool(async (pool, config) => {
    for (const actor of actors) {
      await pool.query(
        `
          INSERT INTO ${tableRef(config.schema, "actors")} (
            actor_slug,
            surface,
            role,
            access_mode,
            customer_slug,
            payload_json
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          ON CONFLICT (actor_slug, surface) DO UPDATE SET
            role = excluded.role,
            access_mode = excluded.access_mode,
            customer_slug = excluded.customer_slug,
            payload_json = excluded.payload_json
        `,
        [
          String(actor.actor_slug ?? ""),
          String(actor.surface ?? "portal"),
          String(actor.role ?? "customer"),
          String(actor.access_mode ?? "memberships"),
          actor.customer_slug ?? null,
          JSON.stringify(actor),
        ],
      );
    }
  });
}

export async function clearMembershipsForActorInPostgres({ actorSlug } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `DELETE FROM ${tableRef(config.schema, "memberships")} WHERE actor_slug = $1`,
      [String(actorSlug ?? "")],
    );
  });
}

export async function writeMembershipsToPostgres({ memberships = [] } = {}) {
  return withPostgresPool(async (pool, config) => {
    for (const membership of memberships) {
      await pool.query(
        `
          INSERT INTO ${tableRef(config.schema, "memberships")} (
            actor_slug,
            workspace_slug,
            payload_json
          )
          VALUES ($1, $2, $3::jsonb)
          ON CONFLICT (actor_slug, workspace_slug) DO UPDATE SET
            payload_json = excluded.payload_json
        `,
        [
          String(membership.actor_slug ?? ""),
          String(membership.workspace_slug ?? ""),
          JSON.stringify(membership),
        ],
      );
    }
  });
}

export async function upsertSessionInPostgres({ session } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "sessions")} (
          session_token,
          actor_slug,
          surface,
          workspace_slug,
          customer_slug,
          issued_at,
          expires_at,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (session_token) DO UPDATE SET
          actor_slug = excluded.actor_slug,
          surface = excluded.surface,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          issued_at = excluded.issued_at,
          expires_at = excluded.expires_at,
          payload_json = excluded.payload_json
      `,
      [
        session.session_token,
        session.actor_slug,
        session.surface,
        session.workspace_slug || null,
        session.customer_slug || null,
        session.issued_at,
        session.expires_at,
        JSON.stringify(session),
      ],
    );
  });
}

export async function loadSessionFromPostgres({ sessionToken } = {}) {
  const rows = await queryPayloadRows(
    "sessions",
    `
      SELECT payload_json
      FROM %TABLE%
      WHERE session_token = $1
      LIMIT 1
    `,
    [String(sessionToken ?? "")],
  );
  return parsePayload(rows[0]?.payload_json, null);
}

export async function countSessionsInPostgres() {
  return withPostgresPool(async (pool, config) => {
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${tableRef(config.schema, "sessions")}`);
    return Number(result.rows[0]?.count ?? 0);
  });
}

export async function seedSessionsInPostgres({ sessions = [] } = {}) {
  return withPostgresPool(async (pool, config) => {
    for (const session of sessions) {
      await pool.query(
        `
          INSERT INTO ${tableRef(config.schema, "sessions")} (
            session_token,
            actor_slug,
            surface,
            workspace_slug,
            customer_slug,
            issued_at,
            expires_at,
            payload_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          ON CONFLICT (session_token) DO NOTHING
        `,
        [
          session.session_token,
          session.actor_slug,
          session.surface,
          session.workspace_slug || null,
          session.customer_slug || null,
          session.issued_at,
          session.expires_at,
          JSON.stringify(session),
        ],
      );
    }
  });
}

async function queryPayloadRows(tableName, sqlTemplate, values = []) {
  return withPostgresPool(async (pool, config) => {
    const sql = sqlTemplate.replace("%TABLE%", tableRef(config.schema, tableName));
    const result = await pool.query(sql, values);
    return result.rows;
  });
}

async function withPostgresPool(callback) {
  const config = resolvePostgresStorageConfig();
  if (!config.enabled) {
    return null;
  }
  if (!config.databaseUrl) {
    throw new Error("BE_AI_HEART_POSTGRES_URL is required when Postgres storage is enabled.");
  }

  const pool = await getPostgresPool(config);
  await ensurePostgresSchema(pool, config);
  return callback(pool, config);
}

async function getPostgresPool(config) {
  if (POSTGRES_POOL_CACHE.has(config.databaseUrl)) {
    return POSTGRES_POOL_CACHE.get(config.databaseUrl);
  }

  const { Pool } = await loadPgModule();
  const pool = new Pool({
    connectionString: config.databaseUrl,
  });
  POSTGRES_POOL_CACHE.set(config.databaseUrl, pool);
  return pool;
}

async function ensurePostgresSchema(pool, config) {
  const cacheKey = `${config.databaseUrl}:${config.schema}`;
  if (POSTGRES_SCHEMA_CACHE.has(cacheKey)) {
    return POSTGRES_SCHEMA_CACHE.get(cacheKey);
  }

  const ensurePromise = (async () => {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(config.schema)}`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "repository_profiles")} (
        profile_slug TEXT PRIMARY KEY,
        workspace_slug TEXT NOT NULL,
        customer_slug TEXT NOT NULL,
        repo TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "repository_documents")} (
        profile_slug TEXT PRIMARY KEY,
        workspace_slug TEXT NOT NULL,
        customer_slug TEXT NOT NULL,
        repo TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        document_count INTEGER NOT NULL DEFAULT 0,
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "document_submissions")} (
        submission_id TEXT PRIMARY KEY,
        profile_slug TEXT NOT NULL,
        workspace_slug TEXT NOT NULL,
        customer_slug TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        summary TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source TEXT NOT NULL,
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "benchmark_reports")} (
        report_id TEXT PRIMARY KEY,
        profile_slug TEXT NOT NULL,
        workspace_slug TEXT NOT NULL,
        customer_slug TEXT NOT NULL,
        repo TEXT NOT NULL,
        scenario TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        token_savings_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
        memory_refresh_reduction_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "website_intake_requests")} (
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
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "workspaces")} (
        workspace_slug TEXT PRIMARY KEY,
        customer_slug TEXT NOT NULL,
        profile_slug TEXT NOT NULL,
        repo TEXT NOT NULL,
        latest_sync_at TEXT NOT NULL,
        profile_synced_at TEXT NOT NULL,
        documents_synced_at TEXT NOT NULL,
        latest_benchmark_at TEXT NOT NULL,
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "workspace_identities")} (
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
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "actors")} (
        actor_slug TEXT NOT NULL,
        surface TEXT NOT NULL,
        role TEXT NOT NULL,
        access_mode TEXT NOT NULL,
        customer_slug TEXT,
        payload_json JSONB NOT NULL,
        PRIMARY KEY (actor_slug, surface)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "memberships")} (
        actor_slug TEXT NOT NULL,
        workspace_slug TEXT NOT NULL,
        payload_json JSONB NOT NULL,
        PRIMARY KEY (actor_slug, workspace_slug)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "sessions")} (
        session_token TEXT PRIMARY KEY,
        actor_slug TEXT NOT NULL,
        surface TEXT NOT NULL,
        workspace_slug TEXT,
        customer_slug TEXT,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        payload_json JSONB NOT NULL
      )
    `);
  })();

  POSTGRES_SCHEMA_CACHE.set(cacheKey, ensurePromise);
  return ensurePromise;
}

async function loadPgModule() {
  const loadModule = new Function("specifier", "return import(specifier);");
  return loadModule("pg");
}

function tableRef(schema, tableName) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
}

function quoteIdentifier(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function parsePayload(value, fallback) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value ?? fallback;
  } catch {
    return fallback;
  }
}
