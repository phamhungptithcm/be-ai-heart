import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  resolveServiceDatabasePath as resolveServiceDatabaseFilePath,
  withServiceDatabase,
} from "./database.js";
import { upsertWorkspaceIdentity } from "./identity.js";
import { queueObservabilityExport } from "./observability-export.js";
import { redactSensitiveData } from "./redaction.js";
import {
  consumeRateLimitWindowInPostgres,
  isPostgresStorageEnabled,
  loadAgentRunFromPostgres,
  loadAuditEventsFromPostgres,
  loadBenchmarkHistoryEntriesFromPostgres,
  loadBenchmarkIndexFromPostgres,
  loadDocumentSubmissionsFromPostgres,
  loadLlmCallsFromPostgres,
  loadRequestTracesFromPostgres,
  loadRepositoryDocumentIndexFromPostgres,
  loadRepositoryProfileIndexFromPostgres,
  loadWorkspaceRowsFromPostgres,
  pruneExpiredRateLimitsInPostgres,
  replaceWorkspaceRowsInPostgres,
  upsertAgentRunInPostgres,
  upsertAuditEventInPostgres,
  upsertBenchmarkReportInPostgres,
  upsertDocumentSubmissionInPostgres,
  upsertLlmCallInPostgres,
  writeRequestTraceInPostgres,
  upsertRepositoryDocumentInPostgres,
  upsertRepositoryProfileInPostgres,
} from "./postgres-repository.js";

export function resolveServiceStorageRoot(options = {}) {
  if (options.serviceStorageRoot) {
    return path.resolve(options.serviceStorageRoot);
  }

  if (options.monorepoRoot) {
    return path.join(path.resolve(options.monorepoRoot), "services", "api", "data");
  }

  if (options.portalRoot) {
    return path.join(path.resolve(options.portalRoot, "../.."), "services", "api", "data");
  }

  if (options.adminRoot) {
    return path.join(path.resolve(options.adminRoot, "../.."), "services", "api", "data");
  }

  if (options.repoRoot) {
    const repoRoot = path.resolve(options.repoRoot);
    if (existsSync(path.join(repoRoot, "services", "api"))) {
      return path.join(repoRoot, "services", "api", "data");
    }

    return path.join(path.dirname(repoRoot), "services", "api", "data");
  }

  if (process.env.BE_AI_HEART_SERVICE_STORAGE_ROOT) {
    return path.resolve(process.env.BE_AI_HEART_SERVICE_STORAGE_ROOT);
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), "services", "api", "data");
}

export function getServiceStoragePaths(options = {}) {
  const root = resolveServiceStorageRoot(options);
  return {
    root,
    auditRoot: path.join(root, "audit"),
    auditLogPath: path.join(root, "audit", "events.ndjson"),
    telemetryRoot: path.join(root, "telemetry"),
    requestTraceLogPath: path.join(root, "telemetry", "requests.ndjson"),
    agentRunsRoot: path.join(root, "telemetry", "agent-runs"),
    llmCallsRoot: path.join(root, "telemetry", "llm-calls"),
    profilesRoot: path.join(root, "profiles"),
    profileRepositoryFilesRoot: path.join(root, "profiles", "repositories"),
    profileServiceArtifactsRoot: path.join(root, "profiles", "service-artifacts"),
    contextPacksRoot: path.join(root, "context-packs"),
    contextPackRepositoryFilesRoot: path.join(root, "context-packs", "repositories"),
    chatCommandsRoot: path.join(root, "chat-commands"),
    chatSessionsRoot: path.join(root, "chat-sessions"),
    modelProviderCredentialsRoot: path.join(root, "model-provider-credentials"),
    modelProviderCredentialsPath: path.join(root, "model-provider-credentials", "credentials.json"),
    documentsRoot: path.join(root, "documents"),
    documentRepositoryFilesRoot: path.join(root, "documents", "repositories"),
    documentSubmissionsRoot: path.join(root, "document-submissions"),
    documentSubmissionFilesRoot: path.join(root, "document-submissions", "submissions"),
    benchmarksRoot: path.join(root, "benchmarks"),
    benchmarkReportsRoot: path.join(root, "benchmarks", "reports"),
    benchmarkEvidenceRoot: path.join(root, "benchmarks", "evidence"),
    benchmarkRepositoriesRoot: path.join(root, "benchmarks", "repositories"),
    benchmarkLaunchesRoot: path.join(root, "benchmarks", "launches"),
    workspacesRoot: path.join(root, "workspaces"),
  };
}

export function resolveServiceDatabasePath(options = {}) {
  return resolveServiceDatabaseFilePath(resolveServiceStorageRoot(options));
}

export async function writeRepositoryProfileArtifactRecord({
  serviceStorageRoot,
  profile,
  workspaceMetadata,
} = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.mkdir(paths.profileRepositoryFilesRoot, { recursive: true });

  const filePath = path.join(paths.profileRepositoryFilesRoot, `${profile.profile_slug}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  await upsertRepositoryProfileRecord(paths.root, profile);
  await upsertWorkspaceIdentity({
    serviceStorageRoot: paths.root,
    workspaceSlug: profile.workspace_slug ?? profile.profile_slug,
    customerSlug: profile.customer_slug ?? profile.profile_slug,
    profileSlug: profile.profile_slug,
    repo: profile.repo,
    displayName: profile.display_name ?? profile.profile_slug,
    source: "profile-artifact",
    lastSyncAt: profile.generated_at,
    metadata: workspaceMetadata,
  });
  await updateRepositoryProfileIndex(paths);
  await updateWorkspaceCatalog(paths);

  return {
    service_storage_root: paths.root,
    database_path: resolveServiceDatabasePath({ serviceStorageRoot: paths.root }),
    profile_path: filePath,
  };
}

export async function writeRepositoryServiceArtifactRecord({
  serviceStorageRoot,
  profileSlug,
  serviceKey,
  variant = "default",
  artifact,
} = {}) {
  const safeProfileSlug = sanitizeArtifactToken(profileSlug, "workspace");
  const safeServiceKey = sanitizeArtifactToken(serviceKey, "artifact");
  const safeVariant = sanitizeArtifactToken(variant, "default");
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const artifactDirectory = path.join(paths.profileServiceArtifactsRoot, safeProfileSlug);

  await fs.mkdir(artifactDirectory, { recursive: true });

  const filePath = path.join(artifactDirectory, `${safeServiceKey}.${safeVariant}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  return {
    service_storage_root: paths.root,
    artifact_path: filePath,
  };
}

export async function loadRepositoryServiceArtifactRecord({
  serviceStorageRoot,
  profileSlug,
  serviceKey,
  variant = "default",
} = {}) {
  const safeProfileSlug = sanitizeArtifactToken(profileSlug, "workspace");
  const safeServiceKey = sanitizeArtifactToken(serviceKey, "artifact");
  const safeVariant = sanitizeArtifactToken(variant, "default");
  const paths = getServiceStoragePaths({ serviceStorageRoot });

  return readJsonOrDefault(
    path.join(paths.profileServiceArtifactsRoot, safeProfileSlug, `${safeServiceKey}.${safeVariant}.json`),
    null,
  );
}

export async function publishProfilesToSurface({ serviceStorageRoot, surfaceRoot }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const publicRoot = path.join(surfaceRoot, "public", "profiles");
  await fs.mkdir(publicRoot, { recursive: true });
  await mirrorDirectory(paths.profileRepositoryFilesRoot, publicRoot, {
    indexPath: path.join(paths.profilesRoot, "index.json"),
    emptyIndex: { profiles: [] },
  });

  return {
    surface_root: surfaceRoot,
    public_root: publicRoot,
    index_path: path.join(publicRoot, "index.json"),
  };
}

export async function writeRepositoryDocumentArtifactRecord({ serviceStorageRoot, artifact }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.mkdir(paths.documentRepositoryFilesRoot, { recursive: true });

  const filePath = path.join(paths.documentRepositoryFilesRoot, `${artifact.profile_slug}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await upsertRepositoryDocumentRecord(paths.root, artifact);
  await upsertWorkspaceIdentity({
    serviceStorageRoot: paths.root,
    workspaceSlug: artifact.workspace_slug ?? artifact.profile_slug,
    customerSlug: artifact.customer_slug ?? artifact.profile_slug,
    profileSlug: artifact.profile_slug,
    repo: artifact.repo,
    displayName: artifact.display_name ?? artifact.profile_slug,
    source: "document-artifact",
    lastSyncAt: artifact.generated_at,
  });
  await updateRepositoryDocumentIndex(paths);
  await updateWorkspaceCatalog(paths);

  return {
    service_storage_root: paths.root,
    database_path: resolveServiceDatabasePath({ serviceStorageRoot: paths.root }),
    repository_path: filePath,
  };
}

export async function publishDocumentsToSurface({ serviceStorageRoot, surfaceRoot }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const publicRoot = path.join(surfaceRoot, "public", "documents");
  await fs.mkdir(publicRoot, { recursive: true });
  await mirrorDirectory(paths.documentRepositoryFilesRoot, path.join(publicRoot, "repositories"), {
    indexPath: path.join(paths.documentsRoot, "index.json"),
    targetIndexPath: path.join(publicRoot, "index.json"),
    emptyIndex: { repositories: [] },
  });

  return {
    surface_root: surfaceRoot,
    public_root: publicRoot,
    index_path: path.join(publicRoot, "index.json"),
  };
}

export async function writeDocumentSubmissionRecord({ serviceStorageRoot, submission }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.mkdir(paths.documentSubmissionFilesRoot, { recursive: true });

  const filePath = path.join(paths.documentSubmissionFilesRoot, `${submission.submission_id}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(submission, null, 2)}\n`, "utf8");
  await upsertDocumentSubmissionRecord(paths.root, submission);
  await upsertWorkspaceIdentity({
    serviceStorageRoot: paths.root,
    workspaceSlug: submission.workspace_slug ?? submission.profile_slug,
    customerSlug: submission.customer_slug ?? submission.profile_slug,
    profileSlug: submission.profile_slug,
    repo: submission.repo ?? submission.profile_slug,
    displayName: submission.profile_slug,
    source: "document-submission",
    lastSyncAt: submission.updated_at,
  });
  await updateDocumentSubmissionIndex(paths);
  await updateWorkspaceCatalog(paths);

  return {
    service_storage_root: paths.root,
    database_path: resolveServiceDatabasePath({ serviceStorageRoot: paths.root }),
    submission_path: filePath,
  };
}

export async function listDocumentSubmissionRecords({ serviceStorageRoot } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const databaseSubmissions = await loadDocumentSubmissionsFromDatabase(paths.root);
  if (databaseSubmissions.length > 0) {
    return databaseSubmissions;
  }

  let entries;

  try {
    entries = await fs.readdir(paths.documentSubmissionFilesRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const submissions = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const payload = JSON.parse(
      await fs.readFile(path.join(paths.documentSubmissionFilesRoot, entry.name), "utf8"),
    );
    submissions.push(payload);
  }

  return submissions.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function loadWorkspaceCatalog({ serviceStorageRoot } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const workspaces = await loadWorkspaceRecordsFromDatabase(paths.root);
  if (workspaces.length > 0) {
    return { workspaces };
  }

  return readJsonOrDefault(path.join(paths.workspacesRoot, "index.json"), { workspaces: [] });
}

export async function writeAuditEvent({ serviceStorageRoot, event } = {}) {
  if (!event || typeof event !== "object") {
    throw new Error("audit event payload is required.");
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const normalized = {
    event_id: String(event.event_id ?? randomUUID()),
    created_at: String(event.created_at ?? new Date().toISOString()),
    action: String(event.action ?? "unknown"),
    outcome: String(event.outcome ?? "success"),
    surface: String(event.surface ?? ""),
    actor_slug: String(event.actor_slug ?? ""),
    workspace_slug: String(event.workspace_slug ?? ""),
    customer_slug: String(event.customer_slug ?? ""),
    customer_id: String(event.customer_id ?? ""),
    target_type: String(event.target_type ?? ""),
    target_id: String(event.target_id ?? ""),
    metadata: redactSensitiveData(event.metadata ?? {}),
  };

  if (isPostgresStorageEnabled()) {
    await upsertAuditEventInPostgres({
      event: normalized,
    });
  } else {
    withServiceDatabase(paths.root, (database) => {
      database
        .prepare(`
          INSERT INTO audit_events (
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
          VALUES (
            :event_id,
            :created_at,
            :action,
            :outcome,
            :surface,
            :actor_slug,
            :workspace_slug,
            :customer_slug,
            :customer_id,
            :target_type,
            :target_id,
            :payload_json
          )
          ON CONFLICT(event_id) DO UPDATE SET
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
        `)
        .run({
          event_id: normalized.event_id,
          created_at: normalized.created_at,
          action: normalized.action,
          outcome: normalized.outcome,
          surface: normalized.surface,
          actor_slug: normalized.actor_slug || null,
          workspace_slug: normalized.workspace_slug || null,
          customer_slug: normalized.customer_slug || null,
          customer_id: normalized.customer_id || null,
          target_type: normalized.target_type,
          target_id: normalized.target_id,
          payload_json: JSON.stringify(normalized),
        });
    });
  }

  await fs.mkdir(paths.auditRoot, { recursive: true });
  await fs.appendFile(paths.auditLogPath, `${JSON.stringify(normalized)}\n`, "utf8");
  await queueObservabilityExport({
    serviceStorageRoot: paths.root,
    category: "audit_event",
    payload: normalized,
    createdAt: normalized.created_at,
  }).catch(() => null);

  return {
    audit_log_path: paths.auditLogPath,
    event: normalized,
  };
}

export async function listAuditEvents({
  serviceStorageRoot,
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
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  if (isPostgresStorageEnabled()) {
    const events = await loadAuditEventsFromPostgres({
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
    });
    if (events.length > 0) {
      return events;
    }
  } else {
    const events = withServiceDatabase(paths.root, (database) => {
      const clauses = [];
      const values = [];
      if (action) {
        clauses.push("action = ?");
        values.push(String(action));
      }
      if (actorSlug) {
        clauses.push("actor_slug = ?");
        values.push(String(actorSlug));
      }
      if (workspaceSlug) {
        clauses.push("workspace_slug = ?");
        values.push(String(workspaceSlug));
      }
      if (customerSlug) {
        clauses.push("customer_slug = ?");
        values.push(String(customerSlug));
      }
      if (customerId) {
        clauses.push("customer_id = ?");
        values.push(String(customerId));
      }
      if (surface) {
        clauses.push("surface = ?");
        values.push(String(surface));
      }
      if (outcome) {
        clauses.push("outcome = ?");
        values.push(String(outcome));
      }
      if (searchTerm) {
        clauses.push("payload_json LIKE ?");
        values.push(`%${String(searchTerm).trim()}%`);
      }

      const resolvedLimit = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 100;
      const resolvedOffset = Number.isFinite(Number(offset)) ? Math.max(0, Number(offset)) : 0;
      const statement = database.prepare(`
        SELECT payload_json
        FROM audit_events
        ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
        ORDER BY created_at DESC, event_id ASC
        LIMIT ?
        OFFSET ?
      `);

      return statement
        .all(...values, resolvedLimit, resolvedOffset)
        .map((row) => parsePayload(row.payload_json, null))
        .filter(Boolean);
    });
    if (events.length > 0) {
      return events;
    }
  }

  let raw;
  try {
    raw = await fs.readFile(paths.auditLogPath, "utf8");
  } catch {
    return [];
  }

  const events = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => !action || entry.action === action)
    .filter((entry) => !actorSlug || entry.actor_slug === actorSlug)
    .filter((entry) => !workspaceSlug || entry.workspace_slug === workspaceSlug)
    .filter((entry) => !customerSlug || entry.customer_slug === customerSlug)
    .filter((entry) => !customerId || entry.customer_id === customerId)
    .filter((entry) => !surface || entry.surface === surface)
    .filter((entry) => !outcome || entry.outcome === outcome)
    .filter((entry) => !searchTerm || JSON.stringify(entry).includes(String(searchTerm).trim()))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  const resolvedOffset = Number.isFinite(Number(offset)) ? Math.max(0, Number(offset)) : 0;
  const resolvedLimit = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : undefined;
  return resolvedLimit === undefined
    ? events.slice(resolvedOffset)
    : events.slice(resolvedOffset, resolvedOffset + resolvedLimit);
}

export async function writeRequestTrace({ serviceStorageRoot, trace } = {}) {
  if (!trace || typeof trace !== "object") {
    throw new Error("request trace payload is required.");
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const normalized = {
    trace_id: String(trace.trace_id ?? randomUUID()),
    created_at: String(trace.created_at ?? new Date().toISOString()),
    method: String(trace.method ?? "GET").toUpperCase(),
    route_kind: String(trace.route_kind ?? "unknown"),
    path: String(trace.path ?? "/"),
    surface: String(trace.surface ?? ""),
    status_code: Number(trace.status_code ?? 0),
    duration_ms: Number(trace.duration_ms ?? 0),
    actor_slug: String(trace.actor_slug ?? ""),
    workspace_slug: String(trace.workspace_slug ?? ""),
    customer_slug: String(trace.customer_slug ?? ""),
    customer_id: String(trace.customer_id ?? ""),
    client_key_hash: String(trace.client_key_hash ?? ""),
    metadata: redactSensitiveData(trace.metadata ?? {}),
  };

  if (isPostgresStorageEnabled()) {
    await writeRequestTraceInPostgres({
      trace: normalized,
    });
  } else {
    withServiceDatabase(paths.root, (database) => {
      database
        .prepare(`
          INSERT INTO request_traces (
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
          VALUES (
            :trace_id,
            :created_at,
            :method,
            :route_kind,
            :path,
            :surface,
            :status_code,
            :duration_ms,
            :actor_slug,
            :workspace_slug,
            :customer_slug,
            :customer_id,
            :client_key_hash,
            :payload_json
          )
          ON CONFLICT(trace_id) DO UPDATE SET
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
        `)
        .run({
          trace_id: normalized.trace_id,
          created_at: normalized.created_at,
          method: normalized.method,
          route_kind: normalized.route_kind,
          path: normalized.path,
          surface: normalized.surface,
          status_code: normalized.status_code,
          duration_ms: normalized.duration_ms,
          actor_slug: normalized.actor_slug || null,
          workspace_slug: normalized.workspace_slug || null,
          customer_slug: normalized.customer_slug || null,
          customer_id: normalized.customer_id || null,
          client_key_hash: normalized.client_key_hash || null,
          payload_json: JSON.stringify(normalized),
        });
    });
  }

  await fs.mkdir(paths.telemetryRoot, { recursive: true });
  await fs.appendFile(paths.requestTraceLogPath, `${JSON.stringify(normalized)}\n`, "utf8");
  await queueObservabilityExport({
    serviceStorageRoot: paths.root,
    category: "request_trace",
    payload: normalized,
    createdAt: normalized.created_at,
  }).catch(() => null);

  return normalized;
}

export async function listRequestTraces({
  serviceStorageRoot,
  routeKind,
  method,
  surface,
  minStatusCode,
  maxStatusCode,
  since,
  limit,
  offset,
} = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  if (isPostgresStorageEnabled()) {
    return loadRequestTracesFromPostgres({
      routeKind,
      method,
      surface,
      minStatusCode,
      maxStatusCode,
      since,
      limit,
      offset,
    });
  }

  return withServiceDatabase(paths.root, (database) => {
    const clauses = [];
    const values = [];
    if (routeKind) {
      clauses.push("route_kind = ?");
      values.push(String(routeKind));
    }
    if (method) {
      clauses.push("method = ?");
      values.push(String(method).toUpperCase());
    }
    if (surface) {
      clauses.push("surface = ?");
      values.push(String(surface));
    }
    if (Number.isFinite(Number(minStatusCode))) {
      clauses.push("status_code >= ?");
      values.push(Number(minStatusCode));
    }
    if (Number.isFinite(Number(maxStatusCode))) {
      clauses.push("status_code <= ?");
      values.push(Number(maxStatusCode));
    }
    if (since) {
      clauses.push("created_at >= ?");
      values.push(String(since));
    }

    const resolvedLimit = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 100;
    const resolvedOffset = Number.isFinite(Number(offset)) ? Math.max(0, Number(offset)) : 0;
    const statement = database.prepare(`
      SELECT payload_json
      FROM request_traces
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY created_at DESC, trace_id ASC
      LIMIT ?
      OFFSET ?
    `);

    return statement
      .all(...values, resolvedLimit, resolvedOffset)
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean);
  });
}

export async function writeAgentRunRecord({ serviceStorageRoot, run } = {}) {
  if (!run || typeof run !== "object") {
    throw new Error("agent run payload is required.");
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const normalized = normalizeAgentRunRecord(run);

  if (isPostgresStorageEnabled()) {
    await upsertAgentRunInPostgres({
      run: normalized,
    });
  } else {
    withServiceDatabase(paths.root, (database) => {
      database
        .prepare(`
          INSERT INTO agent_runs (
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
            :run_id,
            :profile_slug,
            :workspace_slug,
            :customer_slug,
            :repo,
            :scenario_id,
            :dataset_id,
            :mode,
            :status,
            :provider,
            :model,
            :agent_client,
            :upstream_base_url,
            :created_at,
            :started_at,
            :ended_at,
            :exit_code,
            :total_tokens,
            :token_cost_usd,
            :observed_usage_coverage_pct,
            :payload_json
          )
          ON CONFLICT(run_id) DO UPDATE SET
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
        `)
        .run({
          run_id: normalized.run_id,
          profile_slug: normalized.profile_slug,
          workspace_slug: normalized.workspace_slug,
          customer_slug: normalized.customer_slug,
          repo: normalized.repo,
          scenario_id: normalized.scenario_id,
          dataset_id: normalized.dataset_id,
          mode: normalized.mode,
          status: normalized.status,
          provider: normalized.provider,
          model: normalized.model,
          agent_client: normalized.agent_client,
          upstream_base_url: normalized.upstream_base_url,
          created_at: normalized.created_at,
          started_at: normalized.started_at,
          ended_at: normalized.ended_at || null,
          exit_code: Number.isFinite(Number(normalized.exit_code)) ? normalized.exit_code : null,
          total_tokens: normalized.total_tokens,
          token_cost_usd: normalized.token_cost_usd,
          observed_usage_coverage_pct: normalized.observed_usage_coverage_pct,
          payload_json: JSON.stringify(normalized),
        });
    });
  }

  await fs.mkdir(paths.agentRunsRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.agentRunsRoot, `${normalized.run_id}.json`),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8",
  );

  return normalized;
}

export async function loadAgentRunRecord({ serviceStorageRoot, runId } = {}) {
  const safeRunId = String(runId ?? "").trim();
  if (!safeRunId) {
    return null;
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  if (isPostgresStorageEnabled()) {
    const run = await loadAgentRunFromPostgres({
      runId: safeRunId,
    });
    if (run) {
      return run;
    }
  } else {
    const run = withServiceDatabase(paths.root, (database) => {
      const row = database
        .prepare(`
          SELECT payload_json
          FROM agent_runs
          WHERE run_id = ?
          LIMIT 1
        `)
        .get(safeRunId);
      return parsePayload(row?.payload_json, null);
    });
    if (run) {
      return run;
    }
  }

  return readJsonOrDefault(path.join(paths.agentRunsRoot, `${safeRunId}.json`), null);
}

export async function writeLlmCallRecord({ serviceStorageRoot, call } = {}) {
  if (!call || typeof call !== "object") {
    throw new Error("llm call payload is required.");
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const normalized = normalizeLlmCallRecord(call);

  if (isPostgresStorageEnabled()) {
    await upsertLlmCallInPostgres({
      call: normalized,
    });
  } else {
    withServiceDatabase(paths.root, (database) => {
      database
        .prepare(`
          INSERT INTO llm_calls (
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
            :llm_call_id,
            :run_id,
            :created_at,
            :sequence,
            :provider,
            :model,
            :request_kind,
            :method,
            :path,
            :status_code,
            :latency_ms,
            :prompt_tokens,
            :completion_tokens,
            :total_tokens,
            :reasoning_tokens,
            :cached_input_tokens,
            :cost_usd,
            :usage_available,
            :request_hash,
            :response_id,
            :payload_json
          )
          ON CONFLICT(llm_call_id) DO UPDATE SET
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
        `)
        .run({
          llm_call_id: normalized.llm_call_id,
          run_id: normalized.run_id,
          created_at: normalized.created_at,
          sequence: normalized.sequence,
          provider: normalized.provider,
          model: normalized.model,
          request_kind: normalized.request_kind,
          method: normalized.method,
          path: normalized.path,
          status_code: normalized.status_code,
          latency_ms: normalized.latency_ms,
          prompt_tokens: normalized.prompt_tokens,
          completion_tokens: normalized.completion_tokens,
          total_tokens: normalized.total_tokens,
          reasoning_tokens: normalized.reasoning_tokens,
          cached_input_tokens: normalized.cached_input_tokens,
          cost_usd: normalized.cost_usd,
          usage_available: normalized.usage_available ? 1 : 0,
          request_hash: normalized.request_hash,
          response_id: normalized.response_id || null,
          payload_json: JSON.stringify(normalized),
        });
    });
  }

  const runRoot = path.join(paths.llmCallsRoot, normalized.run_id);
  await fs.mkdir(runRoot, { recursive: true });
  await fs.writeFile(
    path.join(runRoot, `${normalized.llm_call_id}.json`),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8",
  );

  return normalized;
}

export async function listLlmCallRecords({
  serviceStorageRoot,
  runId,
  limit,
  offset,
} = {}) {
  const safeRunId = String(runId ?? "").trim();
  if (!safeRunId) {
    return [];
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  if (isPostgresStorageEnabled()) {
    const calls = await loadLlmCallsFromPostgres({
      runId: safeRunId,
      limit,
      offset,
    });
    if (calls.length > 0) {
      return calls;
    }
  } else {
    const calls = withServiceDatabase(paths.root, (database) =>
      database
        .prepare(`
          SELECT payload_json
          FROM llm_calls
          WHERE run_id = ?
          ORDER BY sequence ASC, created_at ASC
          LIMIT ?
          OFFSET ?
        `)
        .all(safeRunId, Number(limit ?? 500), Number(offset ?? 0))
        .map((row) => parsePayload(row.payload_json, null))
        .filter(Boolean),
    );
    if (calls.length > 0) {
      return calls;
    }
  }

  let entries;
  try {
    entries = await fs.readdir(path.join(paths.llmCallsRoot, safeRunId), { withFileTypes: true });
  } catch {
    return [];
  }

  const calls = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    calls.push(
      JSON.parse(
        await fs.readFile(path.join(paths.llmCallsRoot, safeRunId, entry.name), "utf8"),
      ),
    );
  }

  return calls.sort((left, right) => {
    const leftSequence = Number(left.sequence ?? 0);
    const rightSequence = Number(right.sequence ?? 0);
    return leftSequence === rightSequence
      ? String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""))
      : leftSequence - rightSequence;
  });
}

export async function loadAgentRunCapture({ serviceStorageRoot, runId } = {}) {
  const run = await loadAgentRunRecord({
    serviceStorageRoot,
    runId,
  });
  if (!run) {
    return null;
  }

  const llm_calls = await listLlmCallRecords({
    serviceStorageRoot,
    runId,
  });
  const summary = summarizeAgentRunCapture(run, llm_calls);

  return {
    run,
    llm_calls,
    summary,
  };
}

export async function writeBenchmarkLaunchRecord({ serviceStorageRoot, launch } = {}) {
  if (!launch || typeof launch !== "object") {
    throw new Error("benchmark launch payload is required.");
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const normalized = normalizeBenchmarkLaunchRecord(launch);
  await fs.mkdir(paths.benchmarkLaunchesRoot, { recursive: true });
  await writeJsonAtomically(
    path.join(paths.benchmarkLaunchesRoot, `${normalized.launch_id}.json`),
    normalized,
  );

  return normalized;
}

export async function loadBenchmarkLaunchRecord({ serviceStorageRoot, launchId } = {}) {
  const safeLaunchId = String(launchId ?? "").trim();
  if (!safeLaunchId) {
    return null;
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  return readJsonOrDefault(path.join(paths.benchmarkLaunchesRoot, `${safeLaunchId}.json`), null);
}

export async function listBenchmarkLaunchRecords({
  serviceStorageRoot,
  workspaceSlug,
  customerSlug,
  profileSlug,
  status,
  limit = 25,
  offset = 0,
} = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  let entries;

  try {
    entries = await fs.readdir(paths.benchmarkLaunchesRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const launches = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const payload = await readJsonOrDefault(
      path.join(paths.benchmarkLaunchesRoot, entry.name),
      null,
    );
    if (!payload) {
      continue;
    }
    launches.push(payload);
  }

  return launches
    .filter((launch) => !workspaceSlug || String(launch.workspace_slug ?? "") === String(workspaceSlug))
    .filter((launch) => !customerSlug || String(launch.customer_slug ?? "") === String(customerSlug))
    .filter((launch) => !profileSlug || String(launch.profile_slug ?? "") === String(profileSlug))
    .filter((launch) => !status || String(launch.status ?? "") === String(status))
    .sort((left, right) =>
      String(right.updated_at ?? right.created_at ?? "").localeCompare(
        String(left.updated_at ?? left.created_at ?? ""),
      ),
    )
    .slice(Number(offset), Number(offset) + Number(limit));
}

export async function consumeRateLimitWindow({
  serviceStorageRoot,
  limiterKey,
  routeKind,
  surface,
  windowStartedAt,
  resetAt,
} = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  if (isPostgresStorageEnabled()) {
    return consumeRateLimitWindowInPostgres({
      limiterKey,
      routeKind,
      surface,
      windowStartedAt,
      resetAt,
    });
  }

  return withServiceDatabase(paths.root, (database) => {
    database
      .prepare(`
        INSERT INTO rate_limits (
          limiter_key,
          route_kind,
          surface,
          window_started_at,
          reset_at,
          count,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(limiter_key) DO UPDATE SET
          route_kind = excluded.route_kind,
          surface = excluded.surface,
          window_started_at = CASE
            WHEN rate_limits.reset_at <= excluded.window_started_at THEN excluded.window_started_at
            ELSE rate_limits.window_started_at
          END,
          reset_at = CASE
            WHEN rate_limits.reset_at <= excluded.window_started_at THEN excluded.reset_at
            ELSE rate_limits.reset_at
          END,
          count = CASE
            WHEN rate_limits.reset_at <= excluded.window_started_at THEN 1
            ELSE rate_limits.count + 1
          END,
          updated_at = excluded.updated_at
      `)
      .run(
        String(limiterKey ?? ""),
        String(routeKind ?? "unknown"),
        String(surface ?? ""),
        String(windowStartedAt ?? ""),
        String(resetAt ?? ""),
        String(windowStartedAt ?? ""),
      );

    const row = database
      .prepare("SELECT count, reset_at FROM rate_limits WHERE limiter_key = ? LIMIT 1")
      .get(String(limiterKey ?? ""));
    return {
      count: Number(row?.count ?? 0),
      reset_at: String(row?.reset_at ?? ""),
    };
  });
}

export async function pruneExpiredRateLimits({ serviceStorageRoot, now } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  if (isPostgresStorageEnabled()) {
    await pruneExpiredRateLimitsInPostgres({
      now,
    });
    return;
  }

  withServiceDatabase(paths.root, (database) => {
    database.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").run(
      String(now ?? new Date().toISOString()),
    );
  });
}

export async function publishDocumentSubmissionsToSurface({ serviceStorageRoot, surfaceRoot }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const publicRoot = path.join(surfaceRoot, "public", "document-submissions");
  await fs.mkdir(publicRoot, { recursive: true });

  const indexPath = path.join(paths.documentSubmissionsRoot, "index.json");
  if (existsSync(indexPath)) {
    await fs.copyFile(indexPath, path.join(publicRoot, "index.json"));
    return {
      surface_root: surfaceRoot,
      public_root: publicRoot,
      index_path: path.join(publicRoot, "index.json"),
    };
  }

  await fs.writeFile(path.join(publicRoot, "index.json"), `${JSON.stringify({ submissions: [] }, null, 2)}\n`, "utf8");
  return {
    surface_root: surfaceRoot,
    public_root: publicRoot,
    index_path: path.join(publicRoot, "index.json"),
  };
}

export async function publishWorkspacesToSurface({ serviceStorageRoot, surfaceRoot }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const publicRoot = path.join(surfaceRoot, "public", "workspaces");
  await fs.mkdir(publicRoot, { recursive: true });

  const indexPath = path.join(paths.workspacesRoot, "index.json");
  if (existsSync(indexPath)) {
    await fs.copyFile(indexPath, path.join(publicRoot, "index.json"));
  } else {
    await fs.writeFile(path.join(publicRoot, "index.json"), `${JSON.stringify({ workspaces: [] }, null, 2)}\n`, "utf8");
  }

  return {
    surface_root: surfaceRoot,
    public_root: publicRoot,
    index_path: path.join(publicRoot, "index.json"),
  };
}

export async function writeBenchmarkArtifactRecord({ serviceStorageRoot, report }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.mkdir(paths.benchmarkReportsRoot, { recursive: true });
  await fs.mkdir(paths.benchmarkEvidenceRoot, { recursive: true });
  await fs.mkdir(paths.benchmarkRepositoriesRoot, { recursive: true });

  const reportPath = path.join(paths.benchmarkReportsRoot, `${report.report_id}.json`);
  const evidenceManifestPath = path.join(paths.benchmarkEvidenceRoot, `${report.report_id}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (report.evidence_manifest?.available) {
    await fs.writeFile(evidenceManifestPath, `${JSON.stringify(report.evidence_manifest, null, 2)}\n`, "utf8");
  } else {
    await fs.rm(evidenceManifestPath, { force: true });
  }
  await upsertBenchmarkReportRecord(paths.root, report);
  await upsertWorkspaceIdentity({
    serviceStorageRoot: paths.root,
    workspaceSlug: report.workspace_slug ?? report.profile_slug,
    customerSlug: report.customer_slug ?? report.profile_slug,
    profileSlug: report.profile_slug,
    repo: report.repo,
    displayName: report.profile_slug,
    source: "benchmark-report",
    lastSyncAt: report.generated_at,
  });
  await updateBenchmarkRepositoryHistory(paths, report);
  await updateBenchmarkIndex(paths);
  await updateWorkspaceCatalog(paths);

  return {
    service_storage_root: paths.root,
    database_path: resolveServiceDatabasePath({ serviceStorageRoot: paths.root }),
    report_path: reportPath,
    evidence_manifest_path: report.evidence_manifest?.available ? evidenceManifestPath : "",
  };
}

export async function publishBenchmarksToSurface({ serviceStorageRoot, surfaceRoot }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const publicRoot = path.join(surfaceRoot, "public", "benchmarks");
  await fs.mkdir(publicRoot, { recursive: true });
  await mirrorDirectory(path.join(paths.benchmarksRoot, "reports"), path.join(publicRoot, "reports"));
  await mirrorDirectory(path.join(paths.benchmarksRoot, "evidence"), path.join(publicRoot, "evidence"));
  await mirrorDirectory(path.join(paths.benchmarksRoot, "repositories"), path.join(publicRoot, "repositories"));

  const indexPath = path.join(paths.benchmarksRoot, "index.json");
  if (existsSync(indexPath)) {
    await fs.copyFile(indexPath, path.join(publicRoot, "index.json"));
  } else {
    await fs.writeFile(path.join(publicRoot, "index.json"), `${JSON.stringify({ reports: [] }, null, 2)}\n`, "utf8");
  }

  return {
    surface_root: surfaceRoot,
    public_root: publicRoot,
    index_path: path.join(publicRoot, "index.json"),
  };
}

async function updateDocumentSubmissionIndex(paths) {
  const databaseSubmissions = await loadDocumentSubmissionsFromDatabase(paths.root);
  const submissions =
    databaseSubmissions.length > 0
      ? databaseSubmissions
      : await listDocumentSubmissionRecords({
          serviceStorageRoot: paths.root,
        });
  const summary = submissions.map((submission) => ({
    submission_id: submission.submission_id,
    profile_slug: submission.profile_slug,
    title: submission.title,
    category: submission.category,
    summary: submission.summary,
    updated_at: submission.updated_at,
    source: submission.source,
  }));

  await fs.mkdir(paths.documentSubmissionsRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.documentSubmissionsRoot, "index.json"),
    `${JSON.stringify({ submissions: summary }, null, 2)}\n`,
    "utf8",
  );
}

async function updateRepositoryProfileIndex(paths) {
  const profiles = await loadRepositoryProfileIndexFromDatabase(paths.root);
  if (profiles.length === 0) {
    let entries;
    try {
      entries = await fs.readdir(paths.profileRepositoryFilesRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const payload = JSON.parse(await fs.readFile(path.join(paths.profileRepositoryFilesRoot, entry.name), "utf8"));
      profiles.push({
        profile_slug: payload.profile_slug,
        workspace_slug: payload.workspace_slug ?? payload.profile_slug,
        customer_slug: payload.customer_slug ?? payload.profile_slug,
        repo: payload.repo,
        generated_at: payload.generated_at,
        overview: payload.overview,
        heart: payload.heart,
        documents: payload.documents,
        cache: payload.cache,
      });
    }
  }

  profiles.sort((left, right) => left.profile_slug.localeCompare(right.profile_slug));
  await fs.mkdir(paths.profilesRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.profilesRoot, "index.json"),
    `${JSON.stringify({ profiles }, null, 2)}\n`,
    "utf8",
  );
}

async function updateRepositoryDocumentIndex(paths) {
  const repositories = await loadRepositoryDocumentIndexFromDatabase(paths.root);
  if (repositories.length === 0) {
    let entries;
    try {
      entries = await fs.readdir(paths.documentRepositoryFilesRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const payload = JSON.parse(await fs.readFile(path.join(paths.documentRepositoryFilesRoot, entry.name), "utf8"));
      repositories.push({
        profile_slug: payload.profile_slug,
        workspace_slug: payload.workspace_slug ?? payload.profile_slug,
        customer_slug: payload.customer_slug ?? payload.profile_slug,
        repo: payload.repo,
        generated_at: payload.generated_at,
        totals: payload.totals,
        documents: payload.documents.map((document) => ({
          path: document.path,
          title: document.title,
          category: document.category,
          summary: document.summary,
        })),
      });
    }
  }

  repositories.sort((left, right) => left.profile_slug.localeCompare(right.profile_slug));
  await fs.mkdir(paths.documentsRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.documentsRoot, "index.json"),
    `${JSON.stringify({ repositories }, null, 2)}\n`,
    "utf8",
  );
}

async function updateBenchmarkRepositoryHistory(paths, report) {
  const filePath = path.join(paths.benchmarkRepositoriesRoot, `${report.profile_slug}.json`);
  const nextReports = await loadBenchmarkHistoryEntriesFromDatabase(paths.root, report.profile_slug);
  const repositoryHistory = {
    profile_slug: report.profile_slug,
    repo: report.repo,
    reports:
      nextReports.length > 0
        ? nextReports
        : [
            ...(await readJsonOrDefault(filePath, {
              profile_slug: report.profile_slug,
              repo: report.repo,
              reports: [],
            })).reports.filter((entry) => entry.report_id !== report.report_id),
            createBenchmarkIndexEntry(report),
          ].sort((left, right) => right.generated_at.localeCompare(left.generated_at)),
  };

  await fs.writeFile(
    filePath,
    `${JSON.stringify(
      repositoryHistory,
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function updateBenchmarkIndex(paths) {
  const reports = await loadBenchmarkIndexFromDatabase(paths.root);
  if (reports.length === 0) {
    let entries;
    try {
      entries = await fs.readdir(paths.benchmarkReportsRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const report = JSON.parse(await fs.readFile(path.join(paths.benchmarkReportsRoot, entry.name), "utf8"));
      reports.push(createBenchmarkIndexEntry(report));
    }
  }

  reports.sort((left, right) => right.generated_at.localeCompare(left.generated_at));
  await fs.mkdir(paths.benchmarksRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.benchmarksRoot, "index.json"),
    `${JSON.stringify({ reports }, null, 2)}\n`,
    "utf8",
  );
}

async function updateWorkspaceCatalog(paths) {
  const [profileIndex, documentIndex, benchmarkIndex, documentSubmissionIndex] = await Promise.all([
    loadServiceProfileIndex(paths),
    loadServiceDocumentIndex(paths),
    loadServiceBenchmarkIndex(paths),
    loadServiceDocumentSubmissionIndex(paths),
  ]);

  const profileBySlug = new Map((profileIndex.profiles ?? []).map((profile) => [profile.profile_slug, profile]));
  const documentsBySlug = new Map(
    (documentIndex.repositories ?? []).map((repository) => [repository.profile_slug, repository]),
  );
  const benchmarkReportsBySlug = new Map();
  for (const report of benchmarkIndex.reports ?? []) {
    const existing = benchmarkReportsBySlug.get(report.profile_slug) ?? [];
    existing.push(report);
    benchmarkReportsBySlug.set(report.profile_slug, existing);
  }
  const submissionsBySlug = new Map();
  for (const submission of documentSubmissionIndex.submissions ?? []) {
    const existing = submissionsBySlug.get(submission.profile_slug) ?? [];
    existing.push(submission);
    submissionsBySlug.set(submission.profile_slug, existing);
  }

  const allSlugs = new Set([
    ...profileBySlug.keys(),
    ...documentsBySlug.keys(),
    ...benchmarkReportsBySlug.keys(),
    ...submissionsBySlug.keys(),
  ]);
  const workspaces = [];

  for (const slug of [...allSlugs].sort((left, right) => left.localeCompare(right))) {
    const profile = profileBySlug.get(slug);
    const documents = documentsBySlug.get(slug);
    const benchmarkReports = benchmarkReportsBySlug.get(slug) ?? [];
    const queuedSubmissions = submissionsBySlug.get(slug) ?? [];

    workspaces.push({
      workspace_slug: profile?.workspace_slug ?? documents?.workspace_slug ?? slug,
      customer_slug: profile?.customer_slug ?? documents?.customer_slug ?? slug,
      profile_slug: slug,
      repo: profile?.repo ?? documents?.repo ?? benchmarkReports[0]?.repo ?? "unknown-repo",
      latest_sync_at: pickLatestTimestamp([
        profile?.generated_at,
        documents?.generated_at,
        benchmarkReports[0]?.generated_at,
      ]),
      profile_synced_at: profile?.generated_at ?? "",
      documents_synced_at: documents?.generated_at ?? "",
      profile_available: Boolean(profile),
      document_available: Boolean(documents),
      benchmark_report_count: benchmarkReports.length,
      latest_benchmark_at: benchmarkReports[0]?.generated_at ?? "",
      queued_submission_count: queuedSubmissions.length,
      document_count: Number(documents?.totals?.document_count ?? 0),
      avg_token_savings_pct: average(
        benchmarkReports.map((report) => report.metrics?.token_savings_pct ?? 0),
      ),
      avg_memory_refresh_reduction_pct: average(
        benchmarkReports.map((report) => report.metrics?.memory_refresh_reduction_pct ?? 0),
      ),
    });

    await upsertWorkspaceIdentity({
      serviceStorageRoot: paths.root,
      workspaceSlug: profile?.workspace_slug ?? documents?.workspace_slug ?? slug,
      customerSlug: profile?.customer_slug ?? documents?.customer_slug ?? slug,
      profileSlug: slug,
      repo: profile?.repo ?? documents?.repo ?? benchmarkReports[0]?.repo ?? "unknown-repo",
      displayName:
        profile?.display_name ??
        documents?.display_name ??
        (profile?.workspace_slug ?? documents?.workspace_slug ?? slug),
      source: "workspace-catalog-refresh",
      lastSyncAt: pickLatestTimestamp([
        profile?.generated_at,
        documents?.generated_at,
        benchmarkReports[0]?.generated_at,
      ]),
    });
  }

  await replaceWorkspaceRecords(paths.root, workspaces);
  await fs.mkdir(paths.workspacesRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.workspacesRoot, "index.json"),
    `${JSON.stringify({ workspaces }, null, 2)}\n`,
    "utf8",
  );
}

function createBenchmarkIndexEntry(report) {
  return {
    report_id: report.report_id,
    repo: report.repo,
    profile_slug: report.profile_slug,
    scenario: report.scenario,
    provider: report.provider,
    model: report.model,
    generated_at: report.generated_at,
    metrics: report.metrics,
    summary: report.summary,
    manager_summary: report.manager_summary,
  };
}

async function mirrorDirectory(sourceRoot, targetRoot, options = {}) {
  await fs.rm(targetRoot, { recursive: true, force: true });
  if (!existsSync(sourceRoot)) {
    await fs.mkdir(targetRoot, { recursive: true });
    if (options.targetIndexPath) {
      await fs.writeFile(options.targetIndexPath, `${JSON.stringify(options.emptyIndex ?? {}, null, 2)}\n`, "utf8");
    }
    return;
  }

  await fs.mkdir(path.dirname(targetRoot), { recursive: true });
  await fs.cp(sourceRoot, targetRoot, { recursive: true });

  if (options.indexPath) {
    await fs.copyFile(options.indexPath, options.targetIndexPath ?? path.join(targetRoot, "index.json"));
  }
}

async function readJsonOrDefault(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonAtomically(filePath, payload) {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await fs.writeFile(tempPath, serialized, "utf8");
  await fs.rename(tempPath, filePath);
}

function pickLatestTimestamp(values) {
  return values
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? "";
}

function average(values) {
  const filtered = values.map((value) => Number(value || 0));
  if (filtered.length === 0) {
    return 0;
  }

  return Math.round((filtered.reduce((sum, value) => sum + value, 0) / filtered.length) * 10) / 10;
}

async function loadServiceProfileIndex(paths) {
  const profiles = await loadRepositoryProfileIndexFromDatabase(paths.root);
  if (profiles.length > 0) {
    return { profiles };
  }

  return readJsonOrDefault(path.join(paths.profilesRoot, "index.json"), { profiles: [] });
}

async function loadServiceDocumentIndex(paths) {
  const repositories = await loadRepositoryDocumentIndexFromDatabase(paths.root);
  if (repositories.length > 0) {
    return { repositories };
  }

  return readJsonOrDefault(path.join(paths.documentsRoot, "index.json"), { repositories: [] });
}

async function loadServiceBenchmarkIndex(paths) {
  const reports = await loadBenchmarkIndexFromDatabase(paths.root);
  if (reports.length > 0) {
    return { reports };
  }

  return readJsonOrDefault(path.join(paths.benchmarksRoot, "index.json"), { reports: [] });
}

async function loadServiceDocumentSubmissionIndex(paths) {
  const submissions = await loadDocumentSubmissionsFromDatabase(paths.root);
  if (submissions.length > 0) {
    return {
      submissions: submissions.map((submission) => ({
        submission_id: submission.submission_id,
        profile_slug: submission.profile_slug,
        title: submission.title,
        category: submission.category,
        summary: submission.summary,
        updated_at: submission.updated_at,
        source: submission.source,
      })),
    };
  }

  return readJsonOrDefault(path.join(paths.documentSubmissionsRoot, "index.json"), { submissions: [] });
}

async function upsertRepositoryProfileRecord(serviceStorageRoot, profile) {
  if (isPostgresStorageEnabled()) {
    await upsertRepositoryProfileInPostgres({ profile });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO repository_profiles (
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          generated_at,
          payload_json
        )
        VALUES (
          :profile_slug,
          :workspace_slug,
          :customer_slug,
          :repo,
          :generated_at,
          :payload_json
        )
        ON CONFLICT(profile_slug) DO UPDATE SET
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          repo = excluded.repo,
          generated_at = excluded.generated_at,
          payload_json = excluded.payload_json
      `)
      .run({
        profile_slug: String(profile.profile_slug ?? ""),
        workspace_slug: String(profile.workspace_slug ?? profile.profile_slug ?? ""),
        customer_slug: String(profile.customer_slug ?? profile.profile_slug ?? ""),
        repo: String(profile.repo ?? ""),
        generated_at: String(profile.generated_at ?? ""),
        payload_json: JSON.stringify(profile),
      });
  });
}

async function upsertRepositoryDocumentRecord(serviceStorageRoot, artifact) {
  if (isPostgresStorageEnabled()) {
    await upsertRepositoryDocumentInPostgres({ artifact });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO repository_documents (
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          generated_at,
          document_count,
          payload_json
        )
        VALUES (
          :profile_slug,
          :workspace_slug,
          :customer_slug,
          :repo,
          :generated_at,
          :document_count,
          :payload_json
        )
        ON CONFLICT(profile_slug) DO UPDATE SET
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          repo = excluded.repo,
          generated_at = excluded.generated_at,
          document_count = excluded.document_count,
          payload_json = excluded.payload_json
      `)
      .run({
        profile_slug: String(artifact.profile_slug ?? ""),
        workspace_slug: String(artifact.workspace_slug ?? artifact.profile_slug ?? ""),
        customer_slug: String(artifact.customer_slug ?? artifact.profile_slug ?? ""),
        repo: String(artifact.repo ?? ""),
        generated_at: String(artifact.generated_at ?? ""),
        document_count: Number(artifact.totals?.document_count ?? artifact.documents?.length ?? 0),
        payload_json: JSON.stringify(artifact),
      });
  });
}

async function upsertDocumentSubmissionRecord(serviceStorageRoot, submission) {
  if (isPostgresStorageEnabled()) {
    await upsertDocumentSubmissionInPostgres({ submission });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO document_submissions (
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
        VALUES (
          :submission_id,
          :profile_slug,
          :workspace_slug,
          :customer_slug,
          :title,
          :category,
          :summary,
          :updated_at,
          :source,
          :payload_json
        )
        ON CONFLICT(submission_id) DO UPDATE SET
          profile_slug = excluded.profile_slug,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          title = excluded.title,
          category = excluded.category,
          summary = excluded.summary,
          updated_at = excluded.updated_at,
          source = excluded.source,
          payload_json = excluded.payload_json
      `)
      .run({
        submission_id: String(submission.submission_id ?? ""),
        profile_slug: String(submission.profile_slug ?? ""),
        workspace_slug: String(submission.workspace_slug ?? submission.profile_slug ?? ""),
        customer_slug: String(submission.customer_slug ?? submission.profile_slug ?? ""),
        title: String(submission.title ?? ""),
        category: String(submission.category ?? ""),
        summary: String(submission.summary ?? ""),
        updated_at: String(submission.updated_at ?? ""),
        source: String(submission.source ?? "unknown"),
        payload_json: JSON.stringify(submission),
      });
  });
}

async function upsertBenchmarkReportRecord(serviceStorageRoot, report) {
  if (isPostgresStorageEnabled()) {
    await upsertBenchmarkReportInPostgres({ report });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO benchmark_reports (
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
        VALUES (
          :report_id,
          :profile_slug,
          :workspace_slug,
          :customer_slug,
          :repo,
          :scenario,
          :provider,
          :model,
          :generated_at,
          :token_savings_pct,
          :memory_refresh_reduction_pct,
          :payload_json
        )
        ON CONFLICT(report_id) DO UPDATE SET
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
      `)
      .run({
        report_id: String(report.report_id ?? ""),
        profile_slug: String(report.profile_slug ?? ""),
        workspace_slug: String(report.workspace_slug ?? report.profile_slug ?? ""),
        customer_slug: String(report.customer_slug ?? report.profile_slug ?? ""),
        repo: String(report.repo ?? ""),
        scenario: String(report.scenario ?? ""),
        provider: String(report.provider ?? ""),
        model: String(report.model ?? ""),
        generated_at: String(report.generated_at ?? ""),
        token_savings_pct: Number(report.metrics?.token_savings_pct ?? 0),
        memory_refresh_reduction_pct: Number(report.metrics?.memory_refresh_reduction_pct ?? 0),
        payload_json: JSON.stringify(report),
      });
  });
}

async function replaceWorkspaceRecords(serviceStorageRoot, workspaces) {
  if (isPostgresStorageEnabled()) {
    await replaceWorkspaceRowsInPostgres({ workspaces });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database.exec("DELETE FROM workspaces");
    const statement = database.prepare(`
      INSERT INTO workspaces (
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
      VALUES (
        :workspace_slug,
        :customer_slug,
        :profile_slug,
        :repo,
        :latest_sync_at,
        :profile_synced_at,
        :documents_synced_at,
        :latest_benchmark_at,
        :payload_json
      )
    `);

    for (const workspace of workspaces) {
      statement.run({
        workspace_slug: String(workspace.workspace_slug ?? ""),
        customer_slug: String(workspace.customer_slug ?? ""),
        profile_slug: String(workspace.profile_slug ?? workspace.workspace_slug ?? ""),
        repo: String(workspace.repo ?? ""),
        latest_sync_at: String(workspace.latest_sync_at ?? ""),
        profile_synced_at: String(workspace.profile_synced_at ?? ""),
        documents_synced_at: String(workspace.documents_synced_at ?? ""),
        latest_benchmark_at: String(workspace.latest_benchmark_at ?? ""),
        payload_json: JSON.stringify(workspace),
      });
    }
  });
}

async function loadRepositoryProfileIndexFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadRepositoryProfileIndexFromPostgres();
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          generated_at,
          payload_json
        FROM repository_profiles
        ORDER BY profile_slug
      `)
      .all()
      .map((row) => {
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

async function loadRepositoryDocumentIndexFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadRepositoryDocumentIndexFromPostgres();
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          generated_at,
          payload_json
        FROM repository_documents
        ORDER BY profile_slug
      `)
      .all()
      .map((row) => {
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

async function loadDocumentSubmissionsFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadDocumentSubmissionsFromPostgres();
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT payload_json
        FROM document_submissions
        ORDER BY updated_at DESC, submission_id ASC
      `)
      .all()
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean),
  );
}

async function loadBenchmarkIndexFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadBenchmarkIndexFromPostgres({
      createBenchmarkIndexEntry,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT payload_json
        FROM benchmark_reports
        ORDER BY generated_at DESC, report_id ASC
      `)
      .all()
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean)
      .map((report) => createBenchmarkIndexEntry(report)),
  );
}

async function loadBenchmarkHistoryEntriesFromDatabase(serviceStorageRoot, profileSlug) {
  if (isPostgresStorageEnabled()) {
    return loadBenchmarkHistoryEntriesFromPostgres({
      profileSlug,
      createBenchmarkIndexEntry,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT payload_json
        FROM benchmark_reports
        WHERE profile_slug = ?
        ORDER BY generated_at DESC, report_id ASC
      `)
      .all(String(profileSlug ?? ""))
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean)
      .map((report) => createBenchmarkIndexEntry(report)),
  );
}

async function loadWorkspaceRecordsFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadWorkspaceRowsFromPostgres();
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT payload_json
        FROM workspaces
        ORDER BY workspace_slug
      `)
      .all()
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean),
  );
}

function normalizeAgentRunRecord(run = {}) {
  const createdAt = String(run.created_at ?? new Date().toISOString());
  const startedAt = String(run.started_at ?? createdAt);

  return {
    run_id: String(run.run_id ?? randomUUID()),
    profile_slug: String(run.profile_slug ?? ""),
    workspace_slug: String(run.workspace_slug ?? run.profile_slug ?? ""),
    customer_slug: String(run.customer_slug ?? run.profile_slug ?? ""),
    repo: String(run.repo ?? ""),
    scenario_id: String(run.scenario_id ?? ""),
    dataset_id: String(run.dataset_id ?? ""),
    mode: String(run.mode ?? "adhoc"),
    status: String(run.status ?? "pending"),
    provider: String(run.provider ?? ""),
    model: String(run.model ?? ""),
    agent_client: String(run.agent_client ?? "shell"),
    upstream_base_url: String(run.upstream_base_url ?? ""),
    created_at: createdAt,
    started_at: startedAt,
    ended_at: run.ended_at ? String(run.ended_at) : "",
    exit_code: Number.isFinite(Number(run.exit_code)) ? Number(run.exit_code) : null,
    total_tokens: Number(run.total_tokens ?? 0),
    token_cost_usd: Number(run.token_cost_usd ?? 0),
    observed_usage_coverage_pct: Number(run.observed_usage_coverage_pct ?? 0),
    task: run.task ? String(run.task) : "",
    pricing: run.pricing ?? {},
    metadata: run.metadata ?? {},
    command: run.command ?? {},
    measurement: run.measurement ?? {},
  };
}

function normalizeBenchmarkLaunchRecord(launch = {}) {
  const createdAt = String(launch.created_at ?? new Date().toISOString());
  const updatedAt = String(launch.updated_at ?? launch.started_at ?? createdAt);

  return {
    schema_version: 1,
    launch_id: String(launch.launch_id ?? randomUUID()),
    workspace_slug: String(launch.workspace_slug ?? launch.profile_slug ?? ""),
    customer_slug: String(launch.customer_slug ?? launch.profile_slug ?? ""),
    profile_slug: String(launch.profile_slug ?? launch.workspace_slug ?? ""),
    repo: String(launch.repo ?? ""),
    actor_slug: String(launch.actor_slug ?? ""),
    scenario_id: String(launch.scenario_id ?? ""),
    scenario_title: String(launch.scenario_title ?? launch.scenario_id ?? ""),
    measurement_mode: String(launch.measurement_mode ?? "observed"),
    status: String(launch.status ?? "queued"),
    phase: String(launch.phase ?? "queued"),
    created_at: createdAt,
    started_at: launch.started_at ? String(launch.started_at) : "",
    updated_at: updatedAt,
    ended_at: launch.ended_at ? String(launch.ended_at) : "",
    capability: launch.capability ?? {},
    inputs: launch.inputs ?? {},
    baseline: launch.baseline ?? {},
    assisted: launch.assisted ?? {},
    report: launch.report ?? {},
    error: launch.error
      ? {
          code: String(launch.error.code ?? ""),
          message: String(launch.error.message ?? ""),
        }
      : null,
    metadata: launch.metadata ?? {},
  };
}

function normalizeLlmCallRecord(call = {}) {
  return {
    llm_call_id: String(call.llm_call_id ?? randomUUID()),
    run_id: String(call.run_id ?? ""),
    created_at: String(call.created_at ?? new Date().toISOString()),
    sequence: Number(call.sequence ?? 0),
    provider: String(call.provider ?? ""),
    model: String(call.model ?? ""),
    request_kind: String(call.request_kind ?? "unknown"),
    method: String(call.method ?? "POST").toUpperCase(),
    path: String(call.path ?? "/"),
    status_code: Number(call.status_code ?? 0),
    latency_ms: Number(call.latency_ms ?? 0),
    prompt_tokens: Number(call.prompt_tokens ?? 0),
    completion_tokens: Number(call.completion_tokens ?? 0),
    total_tokens: Number(call.total_tokens ?? 0),
    reasoning_tokens: Number(call.reasoning_tokens ?? 0),
    cached_input_tokens: Number(call.cached_input_tokens ?? 0),
    cost_usd: Number(call.cost_usd ?? 0),
    usage_available: Boolean(call.usage_available),
    request_hash: String(call.request_hash ?? ""),
    response_id: String(call.response_id ?? ""),
    metadata: call.metadata ?? {},
  };
}

function summarizeAgentRunCapture(run = {}, calls = []) {
  const tracedCalls = calls.filter((call) => isBillableLlmCall(call));
  const observedCalls = tracedCalls.filter((call) => call.usage_available);
  const measuredAllSuccessful =
    tracedCalls.length > 0 && observedCalls.length === tracedCalls.length;
  const promptTokens = observedCalls.reduce((sum, call) => sum + Number(call.prompt_tokens ?? 0), 0);
  const completionTokens = observedCalls.reduce((sum, call) => sum + Number(call.completion_tokens ?? 0), 0);
  const totalTokens = observedCalls.reduce((sum, call) => sum + Number(call.total_tokens ?? 0), 0);
  const reasoningTokens = observedCalls.reduce((sum, call) => sum + Number(call.reasoning_tokens ?? 0), 0);
  const cachedInputTokens = observedCalls.reduce((sum, call) => sum + Number(call.cached_input_tokens ?? 0), 0);
  const tokenCostUsd = observedCalls.reduce((sum, call) => sum + Number(call.cost_usd ?? 0), 0);
  const startedAtMs = Date.parse(run.started_at ?? run.created_at ?? "");
  const endedAtMs = Date.parse(run.ended_at ?? "");
  const durationMs =
    Number.isFinite(startedAtMs) && Number.isFinite(endedAtMs) && endedAtMs >= startedAtMs
      ? endedAtMs - startedAtMs
      : 0;

  return {
    run_id: String(run.run_id ?? ""),
    measurement_mode: measuredAllSuccessful ? "observed" : "estimated",
    observed_usage_coverage_pct:
      tracedCalls.length === 0 ? 0 : Math.round((observedCalls.length / tracedCalls.length) * 1000) / 10,
    traced_call_count: tracedCalls.length,
    observed_call_count: observedCalls.length,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    reasoning_tokens: reasoningTokens,
    cached_input_tokens: cachedInputTokens,
    token_cost_usd: Math.round(tokenCostUsd * 10_000) / 10_000,
    duration_ms: durationMs,
    elapsed_minutes: Math.round((durationMs / 60_000) * 10) / 10,
    provider: String(run.provider ?? calls[0]?.provider ?? ""),
    model: String(run.model ?? calls[0]?.model ?? ""),
    source: "agent_run",
  };
}

function isBillableLlmCall(call = {}) {
  return !["models"].includes(String(call.request_kind ?? ""));
}

function parsePayload(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sanitizeArtifactToken(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}
