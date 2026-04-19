import { createHash } from "node:crypto";

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

export async function upsertCustomerInPostgres({ customer } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "customers")} (
          customer_id,
          customer_slug,
          display_name,
          status,
          created_at,
          updated_at,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (customer_slug) DO UPDATE SET
          display_name = excluded.display_name,
          status = excluded.status,
          updated_at = excluded.updated_at,
          payload_json = excluded.payload_json
      `,
      [
        String(customer.customer_id ?? ""),
        String(customer.customer_slug ?? ""),
        String(customer.display_name ?? customer.customer_slug ?? ""),
        String(customer.status ?? "active"),
        String(customer.created_at ?? ""),
        String(customer.updated_at ?? ""),
        JSON.stringify(customer),
      ],
    );
  });
}

export async function loadCustomerFromPostgres({ customerId, customerSlug } = {}) {
  const clauses = [];
  const values = [];
  if (customerId) {
    values.push(String(customerId));
    clauses.push(`customer_id = $${values.length}`);
  }
  if (customerSlug) {
    values.push(String(customerSlug));
    clauses.push(`customer_slug = $${values.length}`);
  }
  if (clauses.length === 0) {
    return null;
  }

  const rows = await queryPayloadRows(
    "customers",
    `
      SELECT payload_json
      FROM %TABLE%
      WHERE ${clauses.join(" OR ")}
      ORDER BY updated_at DESC, customer_slug ASC
      LIMIT 1
    `,
    values,
  );
  return parsePayload(rows[0]?.payload_json, null);
}

export async function listCustomersFromPostgres({ status, limit = 100, offset = 0 } = {}) {
  const clauses = [];
  const values = [];
  if (status) {
    values.push(String(status));
    clauses.push(`status = $${values.length}`);
  }
  values.push(Number(limit));
  const limitRef = `$${values.length}`;
  values.push(Number(offset));
  const offsetRef = `$${values.length}`;

  const rows = await queryPayloadRows(
    "customers",
    `
      SELECT payload_json
      FROM %TABLE%
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY customer_slug ASC
      LIMIT ${limitRef}
      OFFSET ${offsetRef}
    `,
    values,
  );
  return rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean);
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

export async function upsertAgentRunInPostgres({ run } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "agent_runs")} (
          run_id,
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          scenario_id,
          dataset_id,
          mode,
          status,
          provider,
          model,
          agent_client,
          upstream_base_url,
          created_at,
          started_at,
          ended_at,
          exit_code,
          total_tokens,
          token_cost_usd,
          observed_usage_coverage_pct,
          payload_json
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb
        )
        ON CONFLICT (run_id) DO UPDATE SET
          profile_slug = excluded.profile_slug,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          repo = excluded.repo,
          scenario_id = excluded.scenario_id,
          dataset_id = excluded.dataset_id,
          mode = excluded.mode,
          status = excluded.status,
          provider = excluded.provider,
          model = excluded.model,
          agent_client = excluded.agent_client,
          upstream_base_url = excluded.upstream_base_url,
          created_at = excluded.created_at,
          started_at = excluded.started_at,
          ended_at = excluded.ended_at,
          exit_code = excluded.exit_code,
          total_tokens = excluded.total_tokens,
          token_cost_usd = excluded.token_cost_usd,
          observed_usage_coverage_pct = excluded.observed_usage_coverage_pct,
          payload_json = excluded.payload_json
      `,
      [
        String(run.run_id ?? ""),
        String(run.profile_slug ?? ""),
        String(run.workspace_slug ?? run.profile_slug ?? ""),
        String(run.customer_slug ?? run.profile_slug ?? ""),
        String(run.repo ?? ""),
        String(run.scenario_id ?? ""),
        String(run.dataset_id ?? ""),
        String(run.mode ?? "adhoc"),
        String(run.status ?? "pending"),
        String(run.provider ?? ""),
        String(run.model ?? ""),
        String(run.agent_client ?? "shell"),
        String(run.upstream_base_url ?? ""),
        String(run.created_at ?? ""),
        String(run.started_at ?? run.created_at ?? ""),
        run.ended_at ? String(run.ended_at) : null,
        Number.isFinite(Number(run.exit_code)) ? Number(run.exit_code) : null,
        Number(run.total_tokens ?? 0),
        Number(run.token_cost_usd ?? 0),
        Number(run.observed_usage_coverage_pct ?? 0),
        JSON.stringify(run),
      ],
    );
  });
}

export async function loadAgentRunFromPostgres({ runId } = {}) {
  const rows = await queryPayloadRows(
    "agent_runs",
    `
      SELECT payload_json
      FROM %TABLE%
      WHERE run_id = $1
      LIMIT 1
    `,
    [String(runId ?? "")],
  );
  return parsePayload(rows[0]?.payload_json, null);
}

export async function upsertLlmCallInPostgres({ call } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "llm_calls")} (
          llm_call_id,
          run_id,
          created_at,
          sequence,
          provider,
          model,
          request_kind,
          method,
          path,
          status_code,
          latency_ms,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          reasoning_tokens,
          cached_input_tokens,
          cost_usd,
          usage_available,
          request_hash,
          response_id,
          payload_json
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb
        )
        ON CONFLICT (llm_call_id) DO UPDATE SET
          run_id = excluded.run_id,
          created_at = excluded.created_at,
          sequence = excluded.sequence,
          provider = excluded.provider,
          model = excluded.model,
          request_kind = excluded.request_kind,
          method = excluded.method,
          path = excluded.path,
          status_code = excluded.status_code,
          latency_ms = excluded.latency_ms,
          prompt_tokens = excluded.prompt_tokens,
          completion_tokens = excluded.completion_tokens,
          total_tokens = excluded.total_tokens,
          reasoning_tokens = excluded.reasoning_tokens,
          cached_input_tokens = excluded.cached_input_tokens,
          cost_usd = excluded.cost_usd,
          usage_available = excluded.usage_available,
          request_hash = excluded.request_hash,
          response_id = excluded.response_id,
          payload_json = excluded.payload_json
      `,
      [
        String(call.llm_call_id ?? ""),
        String(call.run_id ?? ""),
        String(call.created_at ?? ""),
        Number(call.sequence ?? 0),
        String(call.provider ?? ""),
        String(call.model ?? ""),
        String(call.request_kind ?? "unknown"),
        String(call.method ?? "POST"),
        String(call.path ?? "/"),
        Number(call.status_code ?? 0),
        Number(call.latency_ms ?? 0),
        Number(call.prompt_tokens ?? 0),
        Number(call.completion_tokens ?? 0),
        Number(call.total_tokens ?? 0),
        Number(call.reasoning_tokens ?? 0),
        Number(call.cached_input_tokens ?? 0),
        Number(call.cost_usd ?? 0),
        call.usage_available ? 1 : 0,
        String(call.request_hash ?? ""),
        call.response_id ? String(call.response_id) : null,
        JSON.stringify(call),
      ],
    );
  });
}

export async function loadLlmCallsFromPostgres({ runId, limit, offset } = {}) {
  const values = [String(runId ?? "")];
  values.push(Number(limit ?? 500));
  const limitRef = `$${values.length}`;
  values.push(Number(offset ?? 0));
  const offsetRef = `$${values.length}`;

  return queryPayloadRows(
    "llm_calls",
    `
      SELECT payload_json
      FROM %TABLE%
      WHERE run_id = $1
      ORDER BY sequence ASC, created_at ASC
      LIMIT ${limitRef}
      OFFSET ${offsetRef}
    `,
    values,
  ).then((rows) => rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean));
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

export async function upsertAuditEventInPostgres({ event } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "audit_events")} (
          event_id,
          created_at,
          action,
          outcome,
          surface,
          actor_slug,
          workspace_slug,
          customer_slug,
          customer_id,
          target_type,
          target_id,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
        ON CONFLICT (event_id) DO UPDATE SET
          created_at = excluded.created_at,
          action = excluded.action,
          outcome = excluded.outcome,
          surface = excluded.surface,
          actor_slug = excluded.actor_slug,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          customer_id = excluded.customer_id,
          target_type = excluded.target_type,
          target_id = excluded.target_id,
          payload_json = excluded.payload_json
      `,
      [
        String(event.event_id ?? ""),
        String(event.created_at ?? ""),
        String(event.action ?? ""),
        String(event.outcome ?? "success"),
        String(event.surface ?? ""),
        String(event.actor_slug ?? ""),
        String(event.workspace_slug ?? ""),
        String(event.customer_slug ?? ""),
        String(event.customer_id ?? ""),
        String(event.target_type ?? ""),
        String(event.target_id ?? ""),
        JSON.stringify(event),
      ],
    );
  });
}

export async function loadAuditEventsFromPostgres({
  action,
  actorSlug,
  workspaceSlug,
  customerSlug,
  customerId,
  surface,
  outcome,
  searchTerm,
  limit,
  offset,
} = {}) {
  const clauses = [];
  const values = [];

  if (action) {
    values.push(String(action));
    clauses.push(`action = $${values.length}`);
  }
  if (actorSlug) {
    values.push(String(actorSlug));
    clauses.push(`actor_slug = $${values.length}`);
  }
  if (workspaceSlug) {
    values.push(String(workspaceSlug));
    clauses.push(`workspace_slug = $${values.length}`);
  }
  if (customerSlug) {
    values.push(String(customerSlug));
    clauses.push(`customer_slug = $${values.length}`);
  }
  if (customerId) {
    values.push(String(customerId));
    clauses.push(`customer_id = $${values.length}`);
  }
  if (surface) {
    values.push(String(surface));
    clauses.push(`surface = $${values.length}`);
  }
  if (outcome) {
    values.push(String(outcome));
    clauses.push(`outcome = $${values.length}`);
  }
  if (searchTerm) {
    values.push(`%${String(searchTerm).trim()}%`);
    clauses.push(`payload_json::text ILIKE $${values.length}`);
  }

  values.push(Number(limit ?? 50));
  const limitRef = `$${values.length}`;
  values.push(Number(offset ?? 0));
  const offsetRef = `$${values.length}`;

  return queryPayloadRows(
    "audit_events",
    `
      SELECT payload_json
      FROM %TABLE%
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY created_at DESC, event_id ASC
      LIMIT ${limitRef}
      OFFSET ${offsetRef}
    `,
    values,
  ).then((rows) => rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean));
}

export async function writeRequestTraceInPostgres({ trace } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "request_traces")} (
          trace_id,
          created_at,
          method,
          route_kind,
          path,
          surface,
          status_code,
          duration_ms,
          actor_slug,
          workspace_slug,
          customer_slug,
          customer_id,
          client_key_hash,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
        ON CONFLICT (trace_id) DO UPDATE SET
          created_at = excluded.created_at,
          method = excluded.method,
          route_kind = excluded.route_kind,
          path = excluded.path,
          surface = excluded.surface,
          status_code = excluded.status_code,
          duration_ms = excluded.duration_ms,
          actor_slug = excluded.actor_slug,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          customer_id = excluded.customer_id,
          client_key_hash = excluded.client_key_hash,
          payload_json = excluded.payload_json
      `,
      [
        String(trace.trace_id ?? ""),
        String(trace.created_at ?? ""),
        String(trace.method ?? "GET"),
        String(trace.route_kind ?? "unknown"),
        String(trace.path ?? "/"),
        String(trace.surface ?? ""),
        Number(trace.status_code ?? 0),
        Number(trace.duration_ms ?? 0),
        String(trace.actor_slug ?? ""),
        String(trace.workspace_slug ?? ""),
        String(trace.customer_slug ?? ""),
        String(trace.customer_id ?? ""),
        String(trace.client_key_hash ?? ""),
        JSON.stringify(trace),
      ],
    );
  });
}

export async function loadRequestTracesFromPostgres({
  routeKind,
  method,
  surface,
  minStatusCode,
  maxStatusCode,
  since,
  limit,
  offset,
} = {}) {
  const clauses = [];
  const values = [];

  if (routeKind) {
    values.push(String(routeKind));
    clauses.push(`route_kind = $${values.length}`);
  }
  if (method) {
    values.push(String(method).toUpperCase());
    clauses.push(`method = $${values.length}`);
  }
  if (surface) {
    values.push(String(surface));
    clauses.push(`surface = $${values.length}`);
  }
  if (Number.isFinite(Number(minStatusCode))) {
    values.push(Number(minStatusCode));
    clauses.push(`status_code >= $${values.length}`);
  }
  if (Number.isFinite(Number(maxStatusCode))) {
    values.push(Number(maxStatusCode));
    clauses.push(`status_code <= $${values.length}`);
  }
  if (since) {
    values.push(String(since));
    clauses.push(`created_at >= $${values.length}`);
  }

  values.push(Number(limit ?? 100));
  const limitRef = `$${values.length}`;
  values.push(Number(offset ?? 0));
  const offsetRef = `$${values.length}`;

  return queryPayloadRows(
    "request_traces",
    `
      SELECT payload_json
      FROM %TABLE%
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY created_at DESC, trace_id ASC
      LIMIT ${limitRef}
      OFFSET ${offsetRef}
    `,
    values,
  ).then((rows) => rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean));
}

export async function upsertObservabilityExportInPostgres({ exportEntry } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "observability_exports")} (
          export_id,
          category,
          destination,
          status,
          attempt_count,
          next_attempt_at,
          last_attempt_at,
          delivered_at,
          last_error,
          created_at,
          updated_at,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
        ON CONFLICT (export_id) DO UPDATE SET
          category = excluded.category,
          destination = excluded.destination,
          status = excluded.status,
          attempt_count = excluded.attempt_count,
          next_attempt_at = excluded.next_attempt_at,
          last_attempt_at = excluded.last_attempt_at,
          delivered_at = excluded.delivered_at,
          last_error = excluded.last_error,
          updated_at = excluded.updated_at,
          payload_json = excluded.payload_json
      `,
      [
        String(exportEntry.export_id ?? ""),
        String(exportEntry.category ?? ""),
        String(exportEntry.destination ?? ""),
        String(exportEntry.status ?? "pending"),
        Number(exportEntry.attempt_count ?? 0),
        String(exportEntry.next_attempt_at ?? ""),
        exportEntry.last_attempt_at ?? null,
        exportEntry.delivered_at ?? null,
        exportEntry.last_error ?? null,
        String(exportEntry.created_at ?? ""),
        String(exportEntry.updated_at ?? ""),
        JSON.stringify(exportEntry),
      ],
    );
  });
}

export async function loadObservabilityExportsFromPostgres({
  status,
  category,
  limit = 100,
  offset = 0,
  dueBefore,
} = {}) {
  const clauses = [];
  const values = [];
  if (status) {
    values.push(String(status));
    clauses.push(`status = $${values.length}`);
  }
  if (category) {
    values.push(String(category));
    clauses.push(`category = $${values.length}`);
  }
  if (dueBefore) {
    values.push(String(dueBefore));
    clauses.push(`next_attempt_at <= $${values.length}`);
  }
  values.push(Number(limit));
  const limitRef = `$${values.length}`;
  values.push(Number(offset));
  const offsetRef = `$${values.length}`;

  const rows = await queryPayloadRows(
    "observability_exports",
    `
      SELECT payload_json
      FROM %TABLE%
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY created_at ASC, export_id ASC
      LIMIT ${limitRef}
      OFFSET ${offsetRef}
    `,
    values,
  );
  return rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean);
}

export async function consumeRateLimitWindowInPostgres({
  limiterKey,
  routeKind,
  surface,
  windowStartedAt,
  resetAt,
} = {}) {
  return withPostgresPool(async (pool, config) => {
    const result = await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "rate_limits")} (
          limiter_key,
          route_kind,
          surface,
          window_started_at,
          reset_at,
          count,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 1, $4)
        ON CONFLICT (limiter_key) DO UPDATE SET
          route_kind = excluded.route_kind,
          surface = excluded.surface,
          window_started_at = CASE
            WHEN ${tableRef(config.schema, "rate_limits")}.reset_at <= excluded.window_started_at
              THEN excluded.window_started_at
            ELSE ${tableRef(config.schema, "rate_limits")}.window_started_at
          END,
          reset_at = CASE
            WHEN ${tableRef(config.schema, "rate_limits")}.reset_at <= excluded.window_started_at
              THEN excluded.reset_at
            ELSE ${tableRef(config.schema, "rate_limits")}.reset_at
          END,
          count = CASE
            WHEN ${tableRef(config.schema, "rate_limits")}.reset_at <= excluded.window_started_at
              THEN 1
            ELSE ${tableRef(config.schema, "rate_limits")}.count + 1
          END,
          updated_at = excluded.updated_at
        RETURNING count, reset_at
      `,
      [
        String(limiterKey ?? ""),
        String(routeKind ?? "unknown"),
        String(surface ?? ""),
        String(windowStartedAt ?? ""),
        String(resetAt ?? ""),
      ],
    );
    return {
      count: Number(result.rows[0]?.count ?? 0),
      reset_at: String(result.rows[0]?.reset_at ?? ""),
    };
  });
}

export async function pruneExpiredRateLimitsInPostgres({ now } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `DELETE FROM ${tableRef(config.schema, "rate_limits")} WHERE reset_at <= $1`,
      [String(now ?? new Date().toISOString())],
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

export async function loadWorkspaceRowsPageFromPostgres({
  workspaceSlugs = [],
  customerSlug,
  accessAll = false,
  repo,
  limit = 50,
  offset = 0,
} = {}) {
  return withPostgresPool(async (pool, config) => {
    const { whereClause, values } = buildAccessScopedFilters({
      accessAll,
      workspaceColumn: "workspace_slug",
      workspaceSlugs,
      customerSlug,
      extraFilters: repo ? [{ sql: "repo = %VALUE%", value: String(repo) }] : [],
    });
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM ${tableRef(config.schema, "workspaces")}
      ${whereClause}
    `;
    const dataValues = [...values, Number(limit), Number(offset)];
    const dataSql = `
      SELECT payload_json
      FROM ${tableRef(config.schema, "workspaces")}
      ${whereClause}
      ORDER BY workspace_slug ASC
      LIMIT $${dataValues.length - 1}
      OFFSET $${dataValues.length}
    `;
    const [countResult, dataResult] = await Promise.all([
      pool.query(countSql, values),
      pool.query(dataSql, dataValues),
    ]);

    return {
      total_count: Number(countResult.rows[0]?.count ?? 0),
      items: dataResult.rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean),
    };
  });
}

export async function loadRepositoryProfilesPageFromPostgres({
  workspaceSlugs = [],
  customerSlug,
  accessAll = false,
  repo,
  profileSlug,
  limit = 50,
  offset = 0,
} = {}) {
  return withPostgresPool(async (pool, config) => {
    const extraFilters = [];
    if (repo) {
      extraFilters.push({ sql: "repo = %VALUE%", value: String(repo) });
    }
    if (profileSlug) {
      extraFilters.push({ sql: "profile_slug = %VALUE%", value: String(profileSlug) });
    }

    const { whereClause, values } = buildAccessScopedFilters({
      accessAll,
      workspaceColumn: "workspace_slug",
      workspaceSlugs,
      customerSlug,
      extraFilters,
    });
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM ${tableRef(config.schema, "repository_profiles")}
      ${whereClause}
    `;
    const dataValues = [...values, Number(limit), Number(offset)];
    const dataSql = `
      SELECT profile_slug, workspace_slug, customer_slug, repo, generated_at, payload_json
      FROM ${tableRef(config.schema, "repository_profiles")}
      ${whereClause}
      ORDER BY profile_slug ASC
      LIMIT $${dataValues.length - 1}
      OFFSET $${dataValues.length}
    `;
    const [countResult, dataResult] = await Promise.all([
      pool.query(countSql, values),
      pool.query(dataSql, dataValues),
    ]);

    return {
      total_count: Number(countResult.rows[0]?.count ?? 0),
      items: dataResult.rows.map((row) => {
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
    };
  });
}

export async function loadBenchmarkIndexPageFromPostgres({
  workspaceSlugs = [],
  customerSlug,
  accessAll = false,
  repo,
  profileSlug,
  scenario,
  limit = 50,
  offset = 0,
  createBenchmarkIndexEntry,
} = {}) {
  return withPostgresPool(async (pool, config) => {
    const extraFilters = [];
    if (repo) {
      extraFilters.push({ sql: "repo = %VALUE%", value: String(repo) });
    }
    if (profileSlug) {
      extraFilters.push({ sql: "profile_slug = %VALUE%", value: String(profileSlug) });
    }
    if (scenario) {
      extraFilters.push({ sql: "scenario = %VALUE%", value: String(scenario) });
    }

    const { whereClause, values } = buildAccessScopedFilters({
      accessAll,
      workspaceColumn: "workspace_slug",
      workspaceSlugs,
      customerSlug,
      extraFilters,
    });
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM ${tableRef(config.schema, "benchmark_reports")}
      ${whereClause}
    `;
    const dataValues = [...values, Number(limit), Number(offset)];
    const dataSql = `
      SELECT payload_json
      FROM ${tableRef(config.schema, "benchmark_reports")}
      ${whereClause}
      ORDER BY generated_at DESC, report_id ASC
      LIMIT $${dataValues.length - 1}
      OFFSET $${dataValues.length}
    `;
    const [countResult, dataResult] = await Promise.all([
      pool.query(countSql, values),
      pool.query(dataSql, dataValues),
    ]);

    return {
      total_count: Number(countResult.rows[0]?.count ?? 0),
      items: dataResult.rows
        .map((row) => parsePayload(row.payload_json, null))
        .filter(Boolean)
        .map((report) => createBenchmarkIndexEntry(report)),
    };
  });
}

export async function loadWebsiteIntakeRequestsPageFromPostgres({
  intakeKind,
  searchTerm,
  limit = 50,
  offset = 0,
} = {}) {
  return withPostgresPool(async (pool, config) => {
    const clauses = [];
    const values = [];
    if (intakeKind) {
      values.push(String(intakeKind));
      clauses.push(`intake_kind = $${values.length}`);
    }
    if (searchTerm) {
      values.push(`%${String(searchTerm).trim()}%`);
      clauses.push(`payload_json::text ILIKE $${values.length}`);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM ${tableRef(config.schema, "website_intake_requests")}
      ${whereClause}
    `;
    const dataValues = [...values, Number(limit), Number(offset)];
    const dataSql = `
      SELECT payload_json
      FROM ${tableRef(config.schema, "website_intake_requests")}
      ${whereClause}
      ORDER BY created_at DESC, request_id ASC
      LIMIT $${dataValues.length - 1}
      OFFSET $${dataValues.length}
    `;
    const [countResult, dataResult] = await Promise.all([
      pool.query(countSql, values),
      pool.query(dataSql, dataValues),
    ]);

    return {
      total_count: Number(countResult.rows[0]?.count ?? 0),
      items: dataResult.rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean),
    };
  });
}

export async function summarizeWebsiteIntakeRequestsFromPostgres({ intakeKind, searchTerm } = {}) {
  return withPostgresPool(async (pool, config) => {
    const clauses = [];
    const values = [];
    if (intakeKind) {
      values.push(String(intakeKind));
      clauses.push(`intake_kind = $${values.length}`);
    }
    if (searchTerm) {
      values.push(`%${String(searchTerm).trim()}%`);
      clauses.push(`payload_json::text ILIKE $${values.length}`);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await pool.query(
      `
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE intake_kind = 'demo')::int AS demo_count,
          COUNT(*) FILTER (WHERE intake_kind = 'trial')::int AS trial_count,
          COALESCE(ROUND(AVG(team_size)::numeric, 1), 0) AS avg_team_size,
          COALESCE(ROUND(AVG(repo_count)::numeric, 1), 0) AS avg_repo_count
        FROM ${tableRef(config.schema, "website_intake_requests")}
        ${whereClause}
      `,
      values,
    );
    return {
      total_count: Number(result.rows[0]?.total_count ?? 0),
      demo_count: Number(result.rows[0]?.demo_count ?? 0),
      trial_count: Number(result.rows[0]?.trial_count ?? 0),
      avg_team_size: Number(result.rows[0]?.avg_team_size ?? 0),
      avg_repo_count: Number(result.rows[0]?.avg_repo_count ?? 0),
    };
  });
}

export async function upsertWorkspaceIdentityInPostgres({ identity } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "workspace_identities")} (
          workspace_slug,
          customer_id,
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
        ON CONFLICT (workspace_slug) DO UPDATE SET
          customer_id = excluded.customer_id,
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
        identity.customer_id || null,
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
            customer_id,
            customer_slug,
            payload_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          ON CONFLICT (actor_slug, surface) DO UPDATE SET
            role = excluded.role,
            access_mode = excluded.access_mode,
            customer_id = excluded.customer_id,
            customer_slug = excluded.customer_slug,
            payload_json = excluded.payload_json
        `,
        [
          String(actor.actor_slug ?? ""),
          String(actor.surface ?? "portal"),
          String(actor.role ?? "customer"),
          String(actor.access_mode ?? "memberships"),
          actor.customer_id ?? null,
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

export async function upsertSessionInPostgres({ session, lookupKey } = {}) {
  return withPostgresPool(async (pool, config) => {
    await pool.query(
      `
        INSERT INTO ${tableRef(config.schema, "sessions")} (
          session_token,
          session_id,
          session_family_id,
          actor_slug,
          surface,
          workspace_slug,
          customer_slug,
          customer_id,
          issued_at,
          expires_at,
          revoked_at,
          revocation_reason,
          last_seen_at,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
        ON CONFLICT (session_token) DO UPDATE SET
          session_id = excluded.session_id,
          session_family_id = excluded.session_family_id,
          actor_slug = excluded.actor_slug,
          surface = excluded.surface,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          customer_id = excluded.customer_id,
          issued_at = excluded.issued_at,
          expires_at = excluded.expires_at,
          revoked_at = excluded.revoked_at,
          revocation_reason = excluded.revocation_reason,
          last_seen_at = excluded.last_seen_at,
          payload_json = excluded.payload_json
      `,
      [
        String(lookupKey ?? session.session_token ?? ""),
        String(session.session_id ?? ""),
        String(session.session_family_id ?? ""),
        session.actor_slug,
        session.surface,
        session.workspace_slug || null,
        session.customer_slug || null,
        session.customer_id || null,
        session.issued_at,
        session.expires_at,
        session.revoked_at || null,
        session.revocation_reason || null,
        session.last_seen_at || session.issued_at,
        JSON.stringify(session),
      ],
    );
  });
}

export async function loadSessionFromPostgres({ lookupKeys = [] } = {}) {
  const normalizedLookupKeys = Array.isArray(lookupKeys)
    ? lookupKeys.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [String(lookupKeys ?? "").trim()].filter(Boolean);
  if (normalizedLookupKeys.length === 0) {
    return null;
  }

  const rows = await queryPayloadRows(
    "sessions",
    `
      SELECT payload_json
      FROM %TABLE%
      WHERE session_token = ANY($1::text[])
      ORDER BY CASE WHEN session_token = $2 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [normalizedLookupKeys, normalizedLookupKeys[0]],
  );
  return parsePayload(rows[0]?.payload_json, null);
}

export async function deleteSessionFromPostgres({ lookupKeys = [] } = {}) {
  const normalizedLookupKeys = Array.isArray(lookupKeys)
    ? lookupKeys.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [String(lookupKeys ?? "").trim()].filter(Boolean);
  if (normalizedLookupKeys.length === 0) {
    return false;
  }

  return withPostgresPool(async (pool, config) => {
    const result = await pool.query(
      `DELETE FROM ${tableRef(config.schema, "sessions")} WHERE session_token = ANY($1::text[])`,
      [normalizedLookupKeys],
    );
    return Number(result.rowCount ?? 0) > 0;
  });
}

export async function revokeSessionsInPostgres({
  lookupKeys = [],
  sessionId,
  sessionFamilyId,
  actorSlug,
  customerSlug,
  customerId,
  reason,
  revokedAt,
} = {}) {
  const clauses = [];
  const values = [];
  const normalizedLookupKeys = Array.isArray(lookupKeys)
    ? lookupKeys.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [String(lookupKeys ?? "").trim()].filter(Boolean);
  if (normalizedLookupKeys.length > 0) {
    values.push(normalizedLookupKeys);
    clauses.push(`session_token = ANY($${values.length}::text[])`);
  }
  if (sessionId) {
    values.push(String(sessionId));
    clauses.push(`session_id = $${values.length}`);
  }
  if (sessionFamilyId) {
    values.push(String(sessionFamilyId));
    clauses.push(`session_family_id = $${values.length}`);
  }
  if (actorSlug) {
    values.push(String(actorSlug));
    clauses.push(`actor_slug = $${values.length}`);
  }
  if (customerSlug) {
    values.push(String(customerSlug));
    clauses.push(`customer_slug = $${values.length}`);
  }
  if (customerId) {
    values.push(String(customerId));
    clauses.push(`customer_id = $${values.length}`);
  }
  if (clauses.length === 0) {
    return 0;
  }

  return withPostgresPool(async (pool, config) => {
    values.push(String(revokedAt ?? new Date().toISOString()));
    values.push(String(reason ?? "revoked"));
    const result = await pool.query(
      `
        UPDATE ${tableRef(config.schema, "sessions")}
        SET
          revoked_at = $${values.length - 1},
          revocation_reason = $${values.length},
          payload_json = jsonb_set(
            jsonb_set(
              payload_json,
              '{revoked_at}',
              to_jsonb($${values.length - 1}::text),
              true
            ),
            '{revocation_reason}',
            to_jsonb($${values.length}::text),
            true
          )
        WHERE ${clauses.join(" OR ")}
      `,
      values,
    );
    return Number(result.rowCount ?? 0);
  });
}

export async function loadSessionsFromPostgres({
  sessionToken,
  sessionId,
  sessionFamilyId,
  actorSlug,
  surface,
  workspaceSlug,
  customerSlug,
  customerId,
  includeRevoked = false,
  limit = 100,
  offset = 0,
} = {}) {
  const clauses = [];
  const values = [];
  const normalizedSessionToken = String(sessionToken ?? "").trim();
  if (normalizedSessionToken) {
    values.push([
      normalizedSessionToken,
      createHash("sha256").update(normalizedSessionToken, "utf8").digest("hex"),
    ]);
    clauses.push(`session_token = ANY($${values.length}::text[])`);
  }
  if (sessionId) {
    values.push(String(sessionId));
    clauses.push(`session_id = $${values.length}`);
  }
  if (sessionFamilyId) {
    values.push(String(sessionFamilyId));
    clauses.push(`session_family_id = $${values.length}`);
  }
  if (actorSlug) {
    values.push(String(actorSlug));
    clauses.push(`actor_slug = $${values.length}`);
  }
  if (surface) {
    values.push(String(surface));
    clauses.push(`surface = $${values.length}`);
  }
  if (workspaceSlug) {
    values.push(String(workspaceSlug));
    clauses.push(`workspace_slug = $${values.length}`);
  }
  if (customerSlug) {
    values.push(String(customerSlug));
    clauses.push(`customer_slug = $${values.length}`);
  }
  if (customerId) {
    values.push(String(customerId));
    clauses.push(`customer_id = $${values.length}`);
  }
  if (!includeRevoked) {
    clauses.push("(revoked_at IS NULL OR revoked_at = '')");
  }
  values.push(Number(limit));
  const limitRef = `$${values.length}`;
  values.push(Number(offset));
  const offsetRef = `$${values.length}`;

  const rows = await queryPayloadRows(
    "sessions",
    `
      SELECT payload_json
      FROM %TABLE%
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY issued_at DESC, session_id ASC
      LIMIT ${limitRef}
      OFFSET ${offsetRef}
    `,
    values,
  );
  return rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean);
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
            session_id,
            session_family_id,
            actor_slug,
            surface,
            workspace_slug,
            customer_slug,
            customer_id,
            issued_at,
            expires_at,
            revoked_at,
            revocation_reason,
            last_seen_at,
            payload_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
          ON CONFLICT (session_token) DO NOTHING
        `,
        [
          String(session.session_lookup_key ?? session.session_token ?? ""),
          String(session.session_id ?? ""),
          String(session.session_family_id ?? ""),
          session.actor_slug,
          session.surface,
          session.workspace_slug || null,
          session.customer_slug || null,
          session.customer_id || null,
          session.issued_at,
          session.expires_at,
          session.revoked_at || null,
          session.revocation_reason || null,
          session.last_seen_at || session.issued_at,
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
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "customers")} (
        customer_id TEXT PRIMARY KEY,
        customer_slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload_json JSONB NOT NULL
      )
    `);
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
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "agent_runs")} (
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
        token_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        observed_usage_coverage_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "llm_calls")} (
        llm_call_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES ${tableRef(config.schema, "agent_runs")} (run_id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        request_kind TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        latency_ms DOUBLE PRECISION NOT NULL,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        reasoning_tokens INTEGER NOT NULL DEFAULT 0,
        cached_input_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        usage_available INTEGER NOT NULL DEFAULT 0,
        request_hash TEXT NOT NULL,
        response_id TEXT,
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
        customer_id TEXT,
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
        customer_id TEXT,
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
        session_id TEXT,
        session_family_id TEXT,
        actor_slug TEXT NOT NULL,
        surface TEXT NOT NULL,
        workspace_slug TEXT,
        customer_slug TEXT,
        customer_id TEXT,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        revocation_reason TEXT,
        last_seen_at TEXT,
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "rate_limits")} (
        limiter_key TEXT PRIMARY KEY,
        route_kind TEXT NOT NULL,
        surface TEXT NOT NULL,
        window_started_at TEXT NOT NULL,
        reset_at TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "audit_events")} (
        event_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        action TEXT NOT NULL,
        outcome TEXT NOT NULL,
        surface TEXT,
        actor_slug TEXT,
        workspace_slug TEXT,
        customer_slug TEXT,
        customer_id TEXT,
        target_type TEXT,
        target_id TEXT,
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "request_traces")} (
        trace_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        method TEXT NOT NULL,
        route_kind TEXT NOT NULL,
        path TEXT NOT NULL,
        surface TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        duration_ms DOUBLE PRECISION NOT NULL,
        actor_slug TEXT,
        workspace_slug TEXT,
        customer_slug TEXT,
        customer_id TEXT,
        client_key_hash TEXT,
        payload_json JSONB NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableRef(config.schema, "observability_exports")} (
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
        payload_json JSONB NOT NULL
      )
    `);

    await pool.query(`
      ALTER TABLE ${tableRef(config.schema, "workspace_identities")}
      ADD COLUMN IF NOT EXISTS customer_id TEXT
    `);
    await pool.query(`
      ALTER TABLE ${tableRef(config.schema, "actors")}
      ADD COLUMN IF NOT EXISTS customer_id TEXT
    `);
    await pool.query(`
      ALTER TABLE ${tableRef(config.schema, "sessions")}
      ADD COLUMN IF NOT EXISTS session_id TEXT
    `);
    await pool.query(`
      ALTER TABLE ${tableRef(config.schema, "sessions")}
      ADD COLUMN IF NOT EXISTS session_family_id TEXT
    `);
    await pool.query(`
      ALTER TABLE ${tableRef(config.schema, "sessions")}
      ADD COLUMN IF NOT EXISTS customer_id TEXT
    `);
    await pool.query(`
      ALTER TABLE ${tableRef(config.schema, "sessions")}
      ADD COLUMN IF NOT EXISTS revoked_at TEXT
    `);
    await pool.query(`
      ALTER TABLE ${tableRef(config.schema, "sessions")}
      ADD COLUMN IF NOT EXISTS revocation_reason TEXT
    `);
    await pool.query(`
      ALTER TABLE ${tableRef(config.schema, "sessions")}
      ADD COLUMN IF NOT EXISTS last_seen_at TEXT
    `);
    await pool.query(`
      ALTER TABLE ${tableRef(config.schema, "audit_events")}
      ADD COLUMN IF NOT EXISTS customer_id TEXT
    `);
    await pool.query(`
      ALTER TABLE ${tableRef(config.schema, "request_traces")}
      ADD COLUMN IF NOT EXISTS customer_id TEXT
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_id
      ON ${tableRef(config.schema, "sessions")} (session_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_family
      ON ${tableRef(config.schema, "sessions")} (session_family_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_customer_surface
      ON ${tableRef(config.schema, "sessions")} (customer_slug, surface)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_status
      ON ${tableRef(config.schema, "sessions")} (revoked_at, expires_at)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_observability_exports_status_due
      ON ${tableRef(config.schema, "observability_exports")} (status, next_attempt_at)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_created
      ON ${tableRef(config.schema, "agent_runs")} (workspace_slug, created_at DESC)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_runs_scenario_mode_created
      ON ${tableRef(config.schema, "agent_runs")} (scenario_id, mode, created_at DESC)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_llm_calls_run_sequence
      ON ${tableRef(config.schema, "llm_calls")} (run_id, sequence ASC)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_llm_calls_created
      ON ${tableRef(config.schema, "llm_calls")} (created_at DESC)
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

function buildAccessScopedFilters({
  accessAll,
  workspaceColumn,
  workspaceSlugs = [],
  customerSlug,
  extraFilters = [],
} = {}) {
  const clauses = [];
  const values = [];
  const normalizedWorkspaceSlugs = Array.isArray(workspaceSlugs)
    ? workspaceSlugs.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];

  if (!accessAll) {
    const scopeClauses = [];
    if (normalizedWorkspaceSlugs.length > 0) {
      values.push(normalizedWorkspaceSlugs);
      scopeClauses.push(`${workspaceColumn} = ANY($${values.length}::text[])`);
    }
    if (customerSlug) {
      values.push(String(customerSlug));
      scopeClauses.push(`customer_slug = $${values.length}`);
    }
    clauses.push(scopeClauses.length > 0 ? `(${scopeClauses.join(" OR ")})` : "1 = 0");
  }

  for (const filter of extraFilters) {
    values.push(filter.value);
    clauses.push(filter.sql.replace("%VALUE%", `$${values.length}`));
  }

  return {
    whereClause: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

function parsePayload(value, fallback) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value ?? fallback;
  } catch {
    return fallback;
  }
}
