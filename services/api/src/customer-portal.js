import { withServiceDatabase } from "./database.js";
import {
  listAccessibleRepositoryProfilesPage,
  listAccessibleWorkspacesPage,
  loadAccessibleDocumentsView,
  loadAccessibleBenchmarkIndexPage,
  loadAccessRegistry,
} from "./access.js";
import { loadCustomer } from "./customer-registry.js";
import { listWorkspaceIdentities } from "./identity.js";
import { listAuditEvents, listRequestTraces } from "./storage.js";
import { listWorkspaceSessions } from "./session.js";
import {
  resolveAuthProviderAdapter,
  resolveBillingProviderAdapter,
} from "./provider-adapters.js";
import {
  METRIC_SOURCE_TYPES,
  PORTAL_PERMISSIONS,
  PORTAL_ROLES,
  resolveActorAccess,
} from "../../../packages/shared-schema/src/enterprise.js";

const ROLE_DESCRIPTIONS = Object.freeze({
  org_admin: "Full tenant administration across workspace, governance, security, and billing.",
  engineer: "Owns repository rollout, document memory, benchmark readiness, and day-to-day technical onboarding.",
  finance_viewer: "Can review benchmark ROI, metered usage posture, and billing readiness without changing workspace access.",
  security_viewer: "Can review security events, sessions, and auth posture without editing repository or billing state.",
});

const PLAN_ENTITLEMENTS = Object.freeze({
  pilot: {
    seats_total: 5,
    base_price_usd: 0,
    included_repositories: 2,
    retention_days: 14,
    support_tier: "guided_pilot",
  },
  starter: {
    seats_total: 8,
    base_price_usd: 199,
    included_repositories: 5,
    retention_days: 30,
    support_tier: "standard",
  },
  team: {
    seats_total: 20,
    base_price_usd: 799,
    included_repositories: 20,
    retention_days: 90,
    support_tier: "priority",
  },
  enterprise: {
    seats_total: 100,
    base_price_usd: 2499,
    included_repositories: 250,
    retention_days: 365,
    support_tier: "enterprise",
  },
});

const OVERVIEW_ONBOARDING_STEPS = Object.freeze([
  { step_id: "connect-auth", label: "Open portal workspace", href: "/settings", command: "heart login", description: "Create a tenant-scoped session or one-time CLI key before syncing repository memory." },
  { step_id: "install-cli", label: "Install CLI", href: "/connect", command: "npm install -g beheart", description: "Install the BeHeart CLI on the engineering workstation used for local-first scans." },
  { step_id: "local-setup", label: "Initialize and scan", href: "/connect", command: "heart init && heart scan", description: "Index the first repository and persist the local project-memory snapshot." },
  { step_id: "sync-memory", label: "Sync repo memory", href: "/repositories", command: "heart sync setup", description: "Publish profile, diagrams, docs, and a starter context pack into the hosted portal lane." },
  { step_id: "configure-model", label: "Select model", href: "/models", command: "heart models providers", description: "Add or test a provider key, then select the model used by portal AI actions." },
  { step_id: "start-chat", label: "Open AI workbench", href: "/workbench", command: "portal /workbench", description: "Start streaming chat with repo, docs, graph, and context pack attachments." },
]);

export async function loadPortalAccountView({
  serviceStorageRoot,
  authContext,
  apiBaseUrl,
  localDemoAuth,
} = {}) {
  const dataset = await loadPortalDataset({
    serviceStorageRoot,
    authContext,
    apiBaseUrl,
    localDemoAuth,
  });
  const billing = buildBillingSnapshot(dataset);
  const members = actorHasPortalPermission(dataset.viewer, PORTAL_PERMISSIONS.membersRead)
    ? buildMemberRows(dataset)
    : [];

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    organization: buildOrganizationSummary(dataset),
    members,
    billing,
    auth: buildAuthSettings(dataset),
  };
}

export async function loadPortalOverviewSummary({
  serviceStorageRoot,
  authContext,
  apiBaseUrl,
  localDemoAuth,
} = {}) {
  const dataset = await loadPortalDataset({
    serviceStorageRoot,
    authContext,
    apiBaseUrl,
    localDemoAuth,
  });
  const kpis = buildOverviewKpis(dataset);
  const isFirstLogin =
    dataset.workspaces.length === 0 &&
    dataset.profiles.length === 0 &&
    dataset.documents.repositories.length === 0 &&
    dataset.reports.length === 0;

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    organization: buildOrganizationSummary(dataset),
    kpis,
    action_center: {
      items: buildActionCenterItems(dataset, kpis),
    },
    onboarding: {
      is_first_login: isFirstLogin,
      steps: OVERVIEW_ONBOARDING_STEPS,
    },
    workspace_highlights: buildWorkspaceHighlights(dataset),
    benchmark_overview: {
      report_count: dataset.reports.length,
      avg_token_savings_pct: kpis.avg_token_savings_pct,
      avg_review_cleanup_reduction_pct: round(
        average(dataset.reports.map((report) => report.metrics?.review_edit_reduction_pct)),
      ),
      estimated_monthly_savings_usd: roundCurrency(
        dataset.reports.reduce(
          (sum, report) => sum + Number(report.metrics?.token_cost_savings_usd ?? 0),
          0,
        ),
      ),
      source_type: METRIC_SOURCE_TYPES.benchmarkArtifact,
    },
  };
}

export async function loadPortalUsageSummary({
  serviceStorageRoot,
  authContext,
  apiBaseUrl,
  windowDays = 30,
  localDemoAuth,
} = {}) {
  const dataset = await loadPortalDataset({
    serviceStorageRoot,
    authContext,
    apiBaseUrl,
    windowDays,
    localDemoAuth,
  });
  const kpis = buildOverviewKpis(dataset);
  const usage = buildUsagePayload(dataset, kpis, windowDays);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    organization: buildOrganizationSummary(dataset),
    ...usage,
  };
}

export async function loadPortalMembersView({
  serviceStorageRoot,
  authContext,
  apiBaseUrl,
  localDemoAuth,
} = {}) {
  const dataset = await loadPortalDataset({
    serviceStorageRoot,
    authContext,
    apiBaseUrl,
    localDemoAuth,
  });
  const members = buildMemberRows(dataset);
  const entitlements = resolvePlanEntitlements(dataset.workspaceIdentities);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    sso_status: {
      provider_mode: dataset.auth_adapter.provider_mode,
      enforced: dataset.auth_adapter.provider_mode === "configured",
      provider_count: dataset.providers.length,
    },
    role_catalog: PORTAL_ROLES.map((role) => ({
      role,
      label: role.replace(/_/g, " "),
      description: ROLE_DESCRIPTIONS[role] ?? "",
    })),
    seat_summary: {
      seats_used: members.filter((member) => member.seat_consuming).length,
      seats_total: entitlements.seats_total,
      seats_available: Math.max(
        0,
        entitlements.seats_total -
          members.filter((member) => member.seat_consuming).length,
      ),
    },
    active_sessions: buildPortalSessionRows(dataset).slice(0, 12),
    members,
    invites: [],
  };
}

export async function loadPortalPoliciesView({
  serviceStorageRoot,
  authContext,
  apiBaseUrl,
  localDemoAuth,
} = {}) {
  const dataset = await loadPortalDataset({
    serviceStorageRoot,
    authContext,
    apiBaseUrl,
    localDemoAuth,
  });
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    guardrail_summary: buildGuardrailSummary(dataset),
    policy_packs: buildPolicyPacks(dataset),
    violations: buildPolicyViolations(dataset),
    exceptions: buildPolicyExceptions(dataset),
  };
}

export async function loadPortalSecurityView({
  serviceStorageRoot,
  authContext,
  apiBaseUrl,
  localDemoAuth,
} = {}) {
  const dataset = await loadPortalDataset({
    serviceStorageRoot,
    authContext,
    apiBaseUrl,
    localDemoAuth,
  });
  const events = buildSecurityEvents(dataset);
  const sessions = buildPortalSessionRows(dataset);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    auth: buildAuthSettings(dataset),
    activity_summary: {
      login_events: countEventsByType(events, "login"),
      role_changes: countEventsByType(events, "role_change"),
      session_revocations: countEventsByType(events, "session_revocation"),
      exports: countEventsByType(events, "export"),
      uploads: countEventsByType(events, "upload"),
      policy_edits: countEventsByType(events, "policy_edit"),
    },
    recent_events: events.slice(0, 20),
    sessions,
    retention_status: {
      export_mode: "tenant_scoped",
      retention_days: resolvePlanEntitlements(dataset.workspaceIdentities).retention_days,
      benchmark_artifact_retention: `${resolvePlanEntitlements(dataset.workspaceIdentities).retention_days}d`,
    },
    export_status: {
      status: "ready",
      scope: "tenant",
      latest_export_at: latestTimestamp(
        events
          .filter((event) => event.category === "export")
          .map((event) => event.created_at),
      ),
    },
  };
}

export async function loadPortalBillingSnapshot({
  serviceStorageRoot,
  authContext,
  apiBaseUrl,
  localDemoAuth,
} = {}) {
  const dataset = await loadPortalDataset({
    serviceStorageRoot,
    authContext,
    apiBaseUrl,
    localDemoAuth,
  });
  return buildBillingSnapshot(dataset);
}

export async function loadPortalSettingsView({
  serviceStorageRoot,
  authContext,
  apiBaseUrl,
  localDemoAuth,
} = {}) {
  const dataset = await loadPortalDataset({
    serviceStorageRoot,
    authContext,
    apiBaseUrl,
    localDemoAuth,
  });
  const entitlements = resolvePlanEntitlements(dataset.workspaceIdentities);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    organization: {
      customer_id: dataset.customer.customer_id,
      customer_slug: dataset.customer.customer_slug,
      display_name: dataset.customer.display_name,
      status: dataset.customer.status,
      active_workspaces: dataset.workspaces.length,
      indexed_repositories: dataset.profiles.length,
    },
    auth: buildAuthSettings(dataset),
    data_controls: {
      retention_days: entitlements.retention_days,
      export_mode: "tenant_scoped",
      pii_redaction_enabled: true,
      local_first_sync: true,
      benchmark_artifact_retention: `${entitlements.retention_days}d`,
    },
    repo_policy_settings: {
      require_document_memory: true,
      require_benchmark_before_expansion:
        dataset.workspaces.some(
          (workspace) => Number(workspace.benchmark_report_count ?? 0) === 0,
        ),
      stale_sync_threshold_days: 7,
      tenant_scoped_exports_only: true,
    },
    integrations: {
      cli_sync: {
        status: dataset.workspaces.length > 0 ? "connected" : "pending",
        last_sync_at: latestTimestamp(dataset.workspaces.map((workspace) => workspace.latest_sync_at)),
      },
      mcp: {
        status: dataset.profiles.length > 0 ? "ready" : "pending",
        transport: "local-cli-and-hosted-portal",
      },
      hosted_api: {
        status: "active",
        base_url: dataset.apiBaseUrl,
      },
      benchmark_publish: {
        status: dataset.reports.length > 0 ? "active" : "pending",
        report_count: dataset.reports.length,
      },
    },
    notifications: {
      queue_backlog_alerts: true,
      benchmark_gap_alerts: true,
      budget_pressure_alerts: true,
      session_export_alerts: true,
    },
  };
}

async function loadPortalDataset({
  serviceStorageRoot,
  authContext,
  apiBaseUrl,
  windowDays = 30,
  localDemoAuth,
} = {}) {
  const viewer = resolveActorAccess({
    ...(authContext?.actor ?? {}),
    customer_slug: authContext?.customer_slug ?? authContext?.actor?.customer_slug ?? "",
  });
  const windowStart = toIsoDaysAgo(windowDays);
  const [registry, customer, workspaceIdentities, workspacesPage, profilesPage, documents, benchmarksPage, sessions, rawAuditEvents, rawRequestTraces] =
    await Promise.all([
      loadAccessRegistry({ serviceStorageRoot, localDemoAuth }),
      loadCustomer({
        serviceStorageRoot,
        customerSlug: authContext?.customer_slug ?? authContext?.actor?.customer_slug,
      }),
      listWorkspaceIdentities({
        serviceStorageRoot,
        customerSlug: authContext?.customer_slug ?? authContext?.actor?.customer_slug,
      }),
      listAccessibleWorkspacesPage({
        serviceStorageRoot,
        surface: "portal",
        actorSlug: authContext?.actor_slug,
        localDemoAuth,
        limit: 500,
        offset: 0,
      }),
      listAccessibleRepositoryProfilesPage({
        serviceStorageRoot,
        surface: "portal",
        actorSlug: authContext?.actor_slug,
        localDemoAuth,
        limit: 500,
        offset: 0,
      }),
      loadAccessibleDocumentsView({
        serviceStorageRoot,
        surface: "portal",
        actorSlug: authContext?.actor_slug,
        localDemoAuth,
      }),
      loadAccessibleBenchmarkIndexPage({
        serviceStorageRoot,
        surface: "portal",
        actorSlug: authContext?.actor_slug,
        localDemoAuth,
        limit: 500,
        offset: 0,
      }),
      listWorkspaceSessions({
        serviceStorageRoot,
        surface: "portal",
        customerSlug: authContext?.customer_slug ?? authContext?.actor?.customer_slug,
        includeRevoked: true,
        limit: 500,
        offset: 0,
      }),
      listAuditEvents({
        serviceStorageRoot,
        customerSlug:
          authContext?.customer_slug ?? authContext?.actor?.customer_slug ?? undefined,
        customerId: authContext?.customer_id ?? undefined,
        limit: 500,
        offset: 0,
      }),
      listRequestTraces({
        serviceStorageRoot,
        surface: "portal",
        since: windowStart,
        limit: 1000,
        offset: 0,
      }),
    ]);

  const safeCustomer = customer ?? {
    schema_version: 1,
    customer_id: "",
    customer_slug: authContext?.customer_slug ?? viewer.customer_slug ?? "",
    display_name: authContext?.customer_slug ?? viewer.customer_slug ?? "Customer workspace",
    status: "active",
    metadata: {},
  };
  const workspaces = workspacesPage.items ?? [];
  const profiles = profilesPage.items ?? [];
  const reports = benchmarksPage.reports ?? [];
  const allowedWorkspaceSlugs = new Set(workspaces.map((workspace) => String(workspace.workspace_slug ?? "")));
  const actorCustomerSlug = String(safeCustomer.customer_slug ?? "");
  const auditEvents = (rawAuditEvents ?? []).filter((event) => isPortalTenantRecord(event, {
    customerSlug: actorCustomerSlug,
    allowedWorkspaceSlugs,
  }));
  const requestTraces = (rawRequestTraces ?? []).filter((trace) => isPortalTenantRecord(trace, {
    customerSlug: actorCustomerSlug,
    allowedWorkspaceSlugs,
  }));
  const telemetry = loadPortalTelemetrySnapshot({
    serviceStorageRoot,
    customerSlug: actorCustomerSlug,
    workspaceSlugs: [...allowedWorkspaceSlugs],
    windowStart,
  });
  const authAdapter = resolveAuthProviderAdapter({
    apiBaseUrl,
    surface: "portal",
  });

  return {
    apiBaseUrl,
    authContext,
    viewer,
    customer: safeCustomer,
    registry,
    workspaceIdentities: workspaceIdentities.filter(
      (identity) =>
        !actorCustomerSlug ||
        String(identity.customer_slug ?? "") === actorCustomerSlug ||
        allowedWorkspaceSlugs.has(String(identity.workspace_slug ?? "")),
    ),
    workspaces,
    profiles,
    documents,
    reports,
    sessions: (sessions ?? []).filter((session) =>
      isPortalTenantRecord(session, {
        customerSlug: actorCustomerSlug,
        allowedWorkspaceSlugs,
      }),
    ),
    auditEvents,
    requestTraces,
    telemetry,
    auth_adapter: authAdapter,
    providers: authAdapter.providers,
    windowStart,
  };
}

function buildOrganizationSummary(dataset) {
  const kpis = buildOverviewKpis(dataset);

  return {
    customer_id: dataset.customer.customer_id,
    customer_slug: dataset.customer.customer_slug,
    display_name: dataset.customer.display_name,
    status: dataset.customer.status,
    workspace_count: dataset.workspaces.length,
    repository_count: dataset.profiles.length,
    seat_summary: {
      seats_used: kpis.seats_used,
      seats_total: kpis.seats_total,
    },
  };
}

function buildOverviewKpis(dataset) {
  const totalWorkspaces = dataset.workspaces.length;
  const readyWorkspaceCount = dataset.workspaces.filter(
    (workspace) => workspace.profile_available && workspace.document_available,
  ).length;
  const benchmarkedWorkspaceCount = dataset.workspaces.filter(
    (workspace) => Number(workspace.benchmark_report_count ?? 0) > 0,
  ).length;
  const staleRepositoryCount = dataset.workspaces.filter(isWorkspaceStale).length;
  const policyWarningCount = dataset.profiles.reduce(
    (sum, profile) => sum + Number(profile?.overview?.policy_warnings ?? 0),
    0,
  );
  const failedSyncJobCount = dataset.auditEvents.filter(
    (event) =>
      String(event.action ?? "").startsWith("sync.") ||
      String(event.action ?? "").startsWith("repository.") ||
      String(event.action ?? "").startsWith("document."),
  ).filter((event) => !["success", "noop"].includes(String(event.outcome ?? ""))).length;
  const queuedSubmissionCount = Number(dataset.documents?.submissions?.length ?? 0);
  const members = buildMemberRows(dataset);
  const seatConsumers = members.filter((member) => member.seat_consuming).length;
  const entitlements = resolvePlanEntitlements(dataset.workspaceIdentities);
  const avgTokenSavingsPct = round(
    average(dataset.reports.map((report) => report.metrics?.token_savings_pct)),
  );
  const avgReviewCleanupReductionPct = round(
    average(dataset.reports.map((report) => report.metrics?.review_edit_reduction_pct)),
  );
  const estimatedCostSavingsUsd = roundCurrency(
    dataset.reports.reduce(
      (sum, report) => sum + Number(report.metrics?.token_cost_savings_usd ?? 0),
      0,
    ),
  );
  const latestSyncAt = latestTimestamp(
    dataset.workspaces.map((workspace) => workspace.latest_sync_at),
  );
  const authFailureCount = dataset.auditEvents.filter(
    (event) =>
      String(event.action ?? "").startsWith("auth.") &&
      !["success", "noop"].includes(String(event.outcome ?? "")),
  ).length;
  const serverErrorCount = dataset.requestTraces.filter(
    (trace) => Number(trace.status_code ?? 0) >= 500,
  ).length;
  const openCriticalAlerts =
    failedSyncJobCount + authFailureCount + serverErrorCount;
  const planEntitlementStatus = `${entitlements.plan_code} · ${seatConsumers}/${entitlements.seats_total} seats`;

  return {
    repos_onboarded: totalWorkspaces,
    active_workspaces: totalWorkspaces,
    indexed_repositories: totalWorkspaces,
    memory_ready_repositories: readyWorkspaceCount,
    memory_ready_pct: toPercent(readyWorkspaceCount, totalWorkspaces),
    stale_repositories: staleRepositoryCount,
    stale_repository_count: staleRepositoryCount,
    latest_sync_at: latestSyncAt,
    latest_sync_freshness: describeFreshness(latestSyncAt),
    benchmark_backed_repositories: benchmarkedWorkspaceCount,
    benchmarked_repository_pct: toPercent(benchmarkedWorkspaceCount, totalWorkspaces),
    avg_token_savings_pct: avgTokenSavingsPct,
    avg_review_cleanup_reduction_pct: avgReviewCleanupReductionPct,
    estimated_cost_savings_usd: estimatedCostSavingsUsd,
    estimated_monthly_savings_usd: estimatedCostSavingsUsd,
    open_critical_alerts: openCriticalAlerts,
    plan_code: entitlements.plan_code,
    plan_entitlement_status: planEntitlementStatus,
    queued_submission_count: queuedSubmissionCount,
    policy_warning_count: policyWarningCount,
    failed_sync_job_count: failedSyncJobCount,
    auth_failure_count: authFailureCount,
    server_error_count: serverErrorCount,
    seats_used: seatConsumers,
    seats_total: entitlements.seats_total,
  };
}

function buildActionCenterItems(dataset, kpis) {
  const reposNeedingResync = dataset.workspaces.filter(isWorkspaceStale);
  const missingBenchmarkCoverage = dataset.workspaces.filter(
    (workspace) => Number(workspace.benchmark_report_count ?? 0) === 0,
  );
  const policyViolations = buildPolicyViolations(dataset);
  const seatPressure = kpis.seats_total > 0 ? round((kpis.seats_used / kpis.seats_total) * 100) : 0;

  return [
    buildActionItem({
      key: "resync",
      title: "Repositories need resync",
      count: reposNeedingResync.length,
      severity: reposNeedingResync.length > 0 ? "warning" : "healthy",
      href: "/repositories",
      summary:
        reposNeedingResync.length > 0
          ? "Some repositories are stale or missing memory artifacts."
          : "Repository sync freshness is healthy across the tenant.",
    }),
    buildActionItem({
      key: "benchmark-coverage",
      title: "Missing benchmark coverage",
      count: missingBenchmarkCoverage.length,
      severity: missingBenchmarkCoverage.length > 0 ? "warning" : "healthy",
      href: "/benchmarks",
      summary:
        missingBenchmarkCoverage.length > 0
          ? "Benchmarks are still missing for part of the repository fleet."
          : "Benchmark coverage exists for each indexed workspace.",
    }),
    buildActionItem({
      key: "document-backlog",
      title: "Document sync backlog",
      count: kpis.queued_submission_count,
      severity: kpis.queued_submission_count > 0 ? "warning" : "healthy",
      href: "/documents",
      summary:
        kpis.queued_submission_count > 0
          ? "Queued document submissions still need to be ingested or reviewed."
          : "Document sync backlog is clear.",
    }),
    buildActionItem({
      key: "policy",
      title: "Settings drift",
      count: policyViolations.length,
      severity: policyViolations.length > 0 ? "critical" : "healthy",
      href: "/settings",
      summary:
        policyViolations.length > 0
          ? "Guardrail issues are reducing architecture confidence."
          : "No active policy violations are blocking delivery.",
    }),
    buildActionItem({
      key: "failed-jobs",
      title: "Failed jobs",
      count: kpis.failed_sync_job_count,
      severity: kpis.failed_sync_job_count > 0 ? "critical" : "healthy",
      href: "/security-audit",
      summary:
        kpis.failed_sync_job_count > 0
          ? "Some sync or publish actions failed and should be reviewed."
          : "No failed sync jobs are currently visible.",
    }),
    buildActionItem({
      key: "seat-pressure",
      title: "Seat or budget pressure",
      count: seatPressure,
      unit: "%",
      severity: seatPressure >= 90 ? "critical" : seatPressure >= 75 ? "warning" : "healthy",
      href: "/billing",
      summary:
        seatPressure >= 75
          ? "Seat consumption is close to the current entitlement limit."
          : "Seat usage remains below the current plan threshold.",
    }),
  ];
}

function buildWorkspaceHighlights(dataset) {
  return dataset.workspaces.slice(0, 8).map((workspace) => ({
    workspace_slug: workspace.workspace_slug,
    repo: workspace.repo,
    status:
      !workspace.profile_available || !workspace.document_available
        ? "memory_incomplete"
        : isWorkspaceStale(workspace)
          ? "needs_resync"
          : "ready",
    readiness_status:
      workspace.profile_available && workspace.document_available
        ? "memory_ready"
        : "memory_incomplete",
    sync_truth: isWorkspaceStale(workspace) ? "stale" : "fresh",
    profile_available: Boolean(workspace.profile_available),
    document_available: Boolean(workspace.document_available),
    benchmark_report_count: Number(workspace.benchmark_report_count ?? 0),
    queued_submission_count: Number(workspace.queued_submission_count ?? 0),
    latest_sync_at: workspace.latest_sync_at,
  }));
}

function buildUsagePayload(dataset, kpis, windowDays) {
  const live = dataset.telemetry;
  const byWorkspace = mergeUsageRows({
    liveEntries: live.by_workspace,
    benchmarkEntries: buildWorkspaceBenchmarkEntries(dataset.reports),
    key: "workspace_slug",
  });
  const byRepository = mergeUsageRows({
    liveEntries: live.by_repository,
    benchmarkEntries: buildRepositoryBenchmarkEntries(dataset.reports),
    key: "repo",
  });
  const byModel = mergeUsageRows({
    liveEntries: live.by_model,
    benchmarkEntries: buildModelBenchmarkEntries(dataset.reports),
    key: "key",
  });

  return {
    summary: {
      requests: live.requests,
      input_tokens: live.input_tokens,
      output_tokens: live.output_tokens,
      estimated_token_cost_usd: roundCurrency(live.estimated_token_cost_usd),
      average_context_pack_size: round(live.average_context_pack_size),
      cache_context_reuse_rate: round(live.cache_context_reuse_rate),
      active_users_7d: live.active_users_7d,
      active_users_30d: live.active_users_30d,
      benchmark_coverage_pct: kpis.benchmarked_repository_pct,
      avg_token_savings_pct: kpis.avg_token_savings_pct,
      estimated_cost_savings_usd: kpis.estimated_cost_savings_usd,
      metric_sources: {
        live_operational: METRIC_SOURCE_TYPES.hostedTelemetry,
        benchmark_derived: METRIC_SOURCE_TYPES.benchmarkArtifact,
      },
      source_notes: {
        live_operational:
          live.requests > 0
            ? "Live operational telemetry is aggregated from hosted request traces and LLM usage where available."
            : "No live request or LLM telemetry is visible yet for this tenant window.",
        benchmark_derived:
          dataset.reports.length > 0
            ? "Benchmark-derived savings are calculated from published benchmark artifacts."
            : "No benchmark artifacts are published yet for this tenant.",
      },
    },
    breakdowns: {
      workspaces: byWorkspace,
      repositories: byRepository,
      users: buildUserUsageEntries(dataset),
      models: byModel,
      clients: live.by_client,
    },
    trend: {
      window_days: windowDays,
      points: buildUsageTrendPoints(dataset, live, windowDays),
    },
  };
}

function buildMemberRows(dataset) {
  const customerSlug = String(dataset.customer.customer_slug ?? "");
  const membershipMap = new Map();
  for (const membership of dataset.registry.memberships ?? []) {
    const existing = membershipMap.get(membership.actor_slug) ?? [];
    existing.push(String(membership.workspace_slug ?? ""));
    membershipMap.set(membership.actor_slug, existing);
  }

  const latestSessionByActor = new Map();
  const sessionCountByActor = new Map();
  for (const session of dataset.sessions ?? []) {
    const existing = latestSessionByActor.get(session.actor_slug);
    if (!existing || String(session.last_seen_at ?? "") > String(existing.last_seen_at ?? "")) {
      latestSessionByActor.set(session.actor_slug, session);
    }
    sessionCountByActor.set(
      session.actor_slug,
      Number(sessionCountByActor.get(session.actor_slug) ?? 0) + 1,
    );
  }

  return (dataset.registry.actors ?? [])
    .filter((actor) => actor.surface === "portal")
    .filter((actor) => !customerSlug || String(actor.customer_slug ?? "") === customerSlug)
    .map((actor) => {
      const resolved = resolveActorAccess(actor);
      const scopedWorkspaces =
        actor.access_mode === "all"
          ? dataset.workspaces.map((workspace) => workspace.workspace_slug)
          : [...new Set(membershipMap.get(actor.actor_slug) ?? [])];
      const latestSession = latestSessionByActor.get(actor.actor_slug) ?? null;
      const seatConsuming = !["finance_viewer", "security_viewer"].includes(
        resolved.primary_role,
      );

      return {
        actor_slug: actor.actor_slug,
        display_name: actor.display_name ?? actor.actor_slug,
        roles: resolved.roles,
        primary_role: resolved.primary_role,
        workspace_count: scopedWorkspaces.length,
        workspace_scope: scopedWorkspaces.length > 0 ? scopedWorkspaces : ["tenant-wide"],
        last_seen_at: latestSession?.last_seen_at ?? "",
        active_session_count: Number(sessionCountByActor.get(actor.actor_slug) ?? 0),
        seat_consuming: seatConsuming,
        sso_status: dataset.auth_adapter.provider_mode === "configured" ? "enforced" : "mock",
        session_status: latestSession?.revoked_at ? "revoked" : latestSession ? "active" : "inactive",
        permissions: resolved.permissions,
      };
    })
    .sort((left, right) => left.display_name.localeCompare(right.display_name));
}

function buildPolicyPacks(dataset) {
  const kpis = buildOverviewKpis(dataset);
  const guardrailStatus = kpis.policy_warning_count > 0 ? "warning" : "healthy";
  const benchmarkGapCount = dataset.workspaces.filter(
    (workspace) => Number(workspace.benchmark_report_count ?? 0) === 0,
  ).length;

  return [
    {
      policy_pack_id: "architecture-guardrails",
      name: "Architecture guardrails",
      status: guardrailStatus,
      workspace_count: dataset.workspaces.length,
      violation_count: kpis.policy_warning_count,
      exception_count: 0,
      guardrail_status: guardrailStatus,
      source_type: METRIC_SOURCE_TYPES.repoArtifact,
    },
    {
      policy_pack_id: "benchmark-readiness",
      name: "Benchmark readiness",
      status: benchmarkGapCount > 0 ? "warning" : "healthy",
      workspace_count: dataset.workspaces.length,
      violation_count: benchmarkGapCount,
      exception_count: 0,
      guardrail_status: benchmarkGapCount > 0 ? "warning" : "healthy",
      source_type: METRIC_SOURCE_TYPES.benchmarkArtifact,
    },
  ];
}

function buildPolicyViolations(dataset) {
  const violations = [];
  for (const profile of dataset.profiles) {
    const warningCount = Number(profile?.overview?.policy_warnings ?? 0);
    if (warningCount > 0) {
      violations.push({
        violation_id: `${profile.profile_slug}:policy-warning`,
        workspace_slug: profile.workspace_slug ?? profile.profile_slug,
        repo: profile.repo,
        severity: warningCount >= 3 ? "critical" : "warning",
        rule: "existing_policy_warnings",
        message: `${warningCount} policy warning(s) were detected in the indexed repository profile.`,
        source_type: METRIC_SOURCE_TYPES.repoArtifact,
        updated_at: profile.generated_at ?? "",
      });
    }
  }

  for (const workspace of dataset.workspaces) {
    if (!workspace.document_available) {
      violations.push({
        violation_id: `${workspace.workspace_slug}:missing-document-memory`,
        workspace_slug: workspace.workspace_slug,
        repo: workspace.repo,
        severity: "warning",
        rule: "document_memory_required",
        message: "Business or technical document memory has not been synced for this workspace.",
        source_type: METRIC_SOURCE_TYPES.repoArtifact,
        updated_at: workspace.documents_synced_at ?? workspace.latest_sync_at ?? "",
      });
    }
  }

  return violations.sort((left, right) => {
    const severityDelta = severityScore(right.severity) - severityScore(left.severity);
    return severityDelta !== 0 ? severityDelta : String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
  });
}

function buildPolicyExceptions(dataset) {
  return dataset.workspaces
    .filter((workspace) => Number(workspace.benchmark_report_count ?? 0) === 0)
    .slice(0, 10)
    .map((workspace) => ({
      exception_id: `${workspace.workspace_slug}:benchmark-gap`,
      workspace_slug: workspace.workspace_slug,
      repo: workspace.repo,
      reason: "Benchmark coverage has not been published yet for this workspace.",
      status: "temporary",
      source_type: METRIC_SOURCE_TYPES.benchmarkArtifact,
      updated_at: workspace.latest_sync_at ?? "",
    }));
}

function buildGuardrailSummary(dataset) {
  const violations = buildPolicyViolations(dataset);
  const policyPacks = buildPolicyPacks(dataset);
  return {
    healthy_count: policyPacks.filter((pack) => pack.guardrail_status === "healthy").length,
    warning_count: policyPacks.filter((pack) => pack.guardrail_status === "warning").length,
    critical_count: violations.filter((violation) => violation.severity === "critical").length,
  };
}

function buildSecurityEvents(dataset) {
  return dataset.auditEvents
    .map((event) => ({
      event_id: event.event_id,
      created_at: event.created_at,
      action: event.action,
      outcome: event.outcome,
      category: categorizeAuditEvent(event),
      actor_slug: event.actor_slug,
      workspace_slug: event.workspace_slug,
      customer_slug: event.customer_slug,
      target_type: event.target_type,
      target_id: event.target_id,
      summary: buildAuditEventSummary(event),
    }))
    .sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")));
}

function buildPortalSessionRows(dataset) {
  return (dataset.sessions ?? [])
    .map((session) => ({
      session_id: session.session_id,
      session_family_id: session.session_family_id,
      actor_slug: session.actor_slug,
      workspace_slug: session.workspace_slug,
      customer_slug: session.customer_slug,
      issued_at: session.issued_at,
      expires_at: session.expires_at,
      last_seen_at: session.last_seen_at,
      revoked_at: session.revoked_at ?? "",
      session_token: "",
      csrf_token: "",
      status: session.revoked_at
        ? "revoked"
        : session.expires_at && session.expires_at < new Date().toISOString()
          ? "expired"
          : "active",
    }))
    .sort((left, right) => String(right.last_seen_at ?? right.issued_at ?? "").localeCompare(String(left.last_seen_at ?? left.issued_at ?? "")));
}

function buildBillingSnapshot(dataset) {
  const kpis = buildOverviewKpis(dataset);
  const entitlements = resolvePlanEntitlements(dataset.workspaceIdentities);
  const billingAdapter = resolveBillingProviderAdapter();
  const planCode = entitlements.plan_code;
  const benchmarkedRepositoryCount = dataset.workspaces.filter(
    (workspace) => Number(workspace.benchmark_report_count ?? 0) > 0,
  ).length;
  const reposOnboarded = dataset.workspaces.length;
  const authFailureCount = dataset.auditEvents.filter(
    (event) =>
      String(event.action ?? "").startsWith("auth.") &&
      !["success", "noop"].includes(String(event.outcome ?? "")),
  ).length;
  const serverErrorCount = dataset.requestTraces.filter(
    (trace) => Number(trace.status_code ?? 0) >= 500,
  ).length;
  const openCriticalAlerts = kpis.failed_sync_job_count + authFailureCount + serverErrorCount;
  const estimatedMonthlySavingsUsd = roundCurrency(
    dataset.reports.reduce(
      (sum, report) => sum + Number(report.metrics?.token_cost_savings_usd ?? 0),
      0,
    ),
  );
  const monthlySubtotal = roundCurrency(
    entitlements.base_price_usd +
      Math.max(0, kpis.seats_used - entitlements.seats_total) * 49,
  );

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    adapter_id: billingAdapter.adapter_id,
    provider_mode: billingAdapter.provider_mode,
    source_type: billingAdapter.source_type,
    live_billing_required: billingAdapter.live_billing_required,
    paid_public_release_ready: billingAdapter.paid_public_release_ready,
    release_gate: billingAdapter.release_gate,
    next_required_action: billingAdapter.next_required_action,
    customer_id: dataset.customer.customer_id,
    account: {
      customer_id: dataset.customer.customer_id,
      customer_slug: dataset.customer.customer_slug,
      display_name: dataset.customer.display_name,
      plan_code: planCode,
      billing_status: dataset.customer.status,
      renewal_date: toIsoDaysAhead(30),
    },
    plan: {
      code: planCode,
      status: dataset.customer.status,
      renewal_date: toIsoDaysAhead(30),
      provider: billingAdapter.integration_label,
    },
    license_summary: {
      seats_used: kpis.seats_used,
      seats_total: entitlements.seats_total,
      indexed_repositories: kpis.indexed_repositories,
      benchmarked_repositories: benchmarkedRepositoryCount,
      overage_risk: kpis.seats_total > 0 && kpis.seats_used / kpis.seats_total >= 0.85 ? "watch" : "normal",
    },
    entitlements: [
      { key: "seats", label: "Seats", value: `${entitlements.seats_total} included`, source_type: METRIC_SOURCE_TYPES.externalIntegration },
      { key: "repositories", label: "Repositories", value: `${entitlements.included_repositories} included`, source_type: METRIC_SOURCE_TYPES.externalIntegration },
      { key: "retention", label: "Retention", value: `${entitlements.retention_days} days`, source_type: METRIC_SOURCE_TYPES.externalIntegration },
      { key: "support", label: "Support tier", value: entitlements.support_tier, source_type: METRIC_SOURCE_TYPES.externalIntegration },
    ],
    invoices: buildMockInvoices({
      customerSlug: dataset.customer.customer_slug,
      monthlySubtotal,
    }),
    usage_snapshot: {
      avg_token_savings_pct: kpis.avg_token_savings_pct,
      estimated_cost_savings_usd: kpis.estimated_cost_savings_usd,
      benchmarked_repository_pct: kpis.benchmarked_repository_pct,
      queued_submission_count: kpis.queued_submission_count,
      source_type: METRIC_SOURCE_TYPES.benchmarkArtifact,
    },
    upgrade_readiness: {
      status:
        benchmarkedRepositoryCount >= Math.max(1, reposOnboarded) &&
        openCriticalAlerts === 0
          ? "ready"
          : "watch",
      benchmark_backed_repositories: benchmarkedRepositoryCount,
      repos_onboarded: reposOnboarded,
      open_critical_alerts: openCriticalAlerts,
      estimated_monthly_savings_usd: estimatedMonthlySavingsUsd,
    },
    notices: buildBillingNotices({
      kpis,
      entitlements,
    }),
  };
}

function buildAuthSettings(dataset) {
  const cliApiKeys = buildPortalSessionRows(dataset)
    .filter((session) => {
      const rawSession = (dataset.sessions ?? []).find((entry) => entry.session_id === session.session_id);
      return rawSession?.metadata?.source === "portal-api-key";
    })
    .map((session) => {
      const rawSession = (dataset.sessions ?? []).find((entry) => entry.session_id === session.session_id);
      return {
        key_id: session.session_id,
        label: rawSession?.metadata?.label ?? "CLI API key",
        workspace_slug: session.workspace_slug,
        issued_at: session.issued_at,
        expires_at: session.expires_at,
        last_seen_at: session.last_seen_at,
        status: session.status,
        api_key: "",
      };
    });

  return {
    adapter_id: dataset.auth_adapter.adapter_id,
    provider_mode: dataset.auth_adapter.provider_mode,
    source_type: dataset.auth_adapter.source_type,
    default_provider_id: dataset.providers[0]?.id ?? "",
    providers: dataset.providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      enabled: provider.enabled,
      authorize_url: provider.authorize_url,
      return_to: provider.return_to,
    })),
    session_mode: dataset.authContext?.session_source === "cookie" ? "cookie" : "header",
    session_expires_at: dataset.authContext?.session?.expires_at ?? "",
    cli_api_keys: cliApiKeys,
  };
}

function resolvePlanEntitlements(workspaceIdentities = []) {
  const planPriority = ["enterprise", "team", "starter", "pilot"];
  const planCode =
    workspaceIdentities
      .map((identity) => String(identity.plan ?? "starter"))
      .sort((left, right) => planPriority.indexOf(left) - planPriority.indexOf(right))[0] ?? "starter";

  return {
    plan_code: planCode,
    ...(PLAN_ENTITLEMENTS[planCode] ?? PLAN_ENTITLEMENTS.starter),
  };
}

function buildUsageTrendPoints(dataset, live, windowDays) {
  const dates = [];
  for (let index = windowDays - 1; index >= 0; index -= 1) {
    dates.push(toIsoDateDaysAgo(index));
  }

  const benchmarkByDate = new Map();
  for (const report of dataset.reports) {
    const key = String(report.generated_at ?? "").slice(0, 10);
    if (!key) {
      continue;
    }
    const existing = benchmarkByDate.get(key) ?? {
      benchmark_report_count: 0,
      benchmark_cost_savings_usd: 0,
      benchmark_token_savings_pct: 0,
    };
    existing.benchmark_report_count += 1;
    existing.benchmark_cost_savings_usd += Number(report.metrics?.token_cost_savings_usd ?? 0);
    existing.benchmark_token_savings_pct += Number(report.metrics?.token_savings_pct ?? 0);
    benchmarkByDate.set(key, existing);
  }
  const liveByDate = new Map();
  for (const point of live.daily_points) {
    liveByDate.set(point.date, point);
  }

  return dates.map((date) => {
    const livePoint = liveByDate.get(date) ?? {
      requests: 0,
      estimated_token_cost_usd: 0,
      input_tokens: 0,
      output_tokens: 0,
    };
    const benchmarkPoint = benchmarkByDate.get(date) ?? {
      benchmark_report_count: 0,
      benchmark_cost_savings_usd: 0,
      benchmark_token_savings_pct: 0,
    };

    return {
      date,
      requests: livePoint.requests,
      input_tokens: livePoint.input_tokens,
      output_tokens: livePoint.output_tokens,
      estimated_token_cost_usd: roundCurrency(livePoint.estimated_token_cost_usd),
      benchmark_report_count: benchmarkPoint.benchmark_report_count,
      benchmark_cost_savings_usd: roundCurrency(benchmarkPoint.benchmark_cost_savings_usd),
      benchmark_token_savings_pct:
        benchmarkPoint.benchmark_report_count > 0
          ? round(benchmarkPoint.benchmark_token_savings_pct / benchmarkPoint.benchmark_report_count)
          : 0,
    };
  });
}

function buildWorkspaceBenchmarkEntries(reports = []) {
  return aggregateByKey(reports, (report) => report.profile_slug, (entry, report) => {
    const metrics = report.metrics ?? {};
    entry.workspace_slug = report.profile_slug;
    entry.repo = report.repo;
    entry.benchmark_report_count += 1;
    entry.avg_token_savings_pct += Number(metrics.token_savings_pct ?? 0);
    entry.estimated_cost_savings_usd += Number(metrics.token_cost_savings_usd ?? 0);
  }, (entry) => {
    entry.benchmark_report_count = Number(entry.benchmark_report_count ?? 0);
    entry.avg_token_savings_pct =
      entry.benchmark_report_count > 0 ? round(entry.avg_token_savings_pct / entry.benchmark_report_count) : 0;
    entry.estimated_cost_savings_usd = roundCurrency(entry.estimated_cost_savings_usd);
    entry.source_type = METRIC_SOURCE_TYPES.benchmarkArtifact;
    return entry;
  });
}

function buildRepositoryBenchmarkEntries(reports = []) {
  return aggregateByKey(reports, (report) => report.repo, (entry, report) => {
    const metrics = report.metrics ?? {};
    entry.repo = report.repo;
    entry.benchmark_report_count += 1;
    entry.avg_token_savings_pct += Number(metrics.token_savings_pct ?? 0);
    entry.estimated_cost_savings_usd += Number(metrics.token_cost_savings_usd ?? 0);
  }, (entry) => {
    entry.benchmark_report_count = Number(entry.benchmark_report_count ?? 0);
    entry.avg_token_savings_pct =
      entry.benchmark_report_count > 0 ? round(entry.avg_token_savings_pct / entry.benchmark_report_count) : 0;
    entry.estimated_cost_savings_usd = roundCurrency(entry.estimated_cost_savings_usd);
    entry.source_type = METRIC_SOURCE_TYPES.benchmarkArtifact;
    return entry;
  });
}

function buildModelBenchmarkEntries(reports = []) {
  return aggregateByKey(
    reports,
    (report) => `${report.provider}/${report.model}`,
    (entry, report) => {
      const metrics = report.metrics ?? {};
      entry.key = `${report.provider}/${report.model}`;
      entry.provider = report.provider;
      entry.model = report.model;
      entry.benchmark_report_count += 1;
      entry.avg_token_savings_pct += Number(metrics.token_savings_pct ?? 0);
      entry.estimated_cost_savings_usd += Number(metrics.token_cost_savings_usd ?? 0);
    },
    (entry) => {
      entry.benchmark_report_count = Number(entry.benchmark_report_count ?? 0);
      entry.avg_token_savings_pct =
        entry.benchmark_report_count > 0 ? round(entry.avg_token_savings_pct / entry.benchmark_report_count) : 0;
      entry.estimated_cost_savings_usd = roundCurrency(entry.estimated_cost_savings_usd);
      entry.source_type = METRIC_SOURCE_TYPES.benchmarkArtifact;
      return entry;
    },
  );
}

function buildUserUsageEntries(dataset) {
  const members = buildMemberRows(dataset);
  return members.map((member) => ({
    actor_slug: member.actor_slug,
    display_name: member.display_name,
    roles: member.roles,
    primary_role: member.primary_role,
    workspace_count: member.workspace_count,
    last_seen_at: member.last_seen_at,
    active_7d: member.last_seen_at && member.last_seen_at >= toIsoDaysAgo(7),
    active_30d: member.last_seen_at && member.last_seen_at >= toIsoDaysAgo(30),
    source_type: METRIC_SOURCE_TYPES.hostedTelemetry,
  }));
}

function mergeUsageRows({ liveEntries = [], benchmarkEntries = [], key }) {
  const merged = new Map();
  for (const entry of liveEntries) {
    merged.set(entry[key], { ...entry });
  }
  for (const entry of benchmarkEntries) {
    const existing = merged.get(entry[key]) ?? { [key]: entry[key] };
    merged.set(entry[key], {
      ...existing,
      ...entry,
      source_type:
        existing.source_type && existing.source_type !== entry.source_type
          ? "mixed"
          : entry.source_type ?? existing.source_type,
    });
  }
  return [...merged.values()].sort((left, right) =>
    String(left[key] ?? "").localeCompare(String(right[key] ?? "")),
  );
}

function loadPortalTelemetrySnapshot({
  serviceStorageRoot,
  customerSlug,
  workspaceSlugs,
  windowStart,
} = {}) {
  return withServiceDatabase(serviceStorageRoot, (database) => {
    const scope = buildTenantScopeClause({
      customerSlug,
      workspaceSlugs,
      tableAlias: "agent_runs",
    });
    const callsScope = buildTenantScopeClause({
      customerSlug,
      workspaceSlugs,
      tableAlias: "agent_runs",
    });
    const runRows = database
      .prepare(`
        SELECT
          agent_runs.workspace_slug,
          agent_runs.repo,
          agent_runs.provider,
          agent_runs.model,
          agent_runs.agent_client,
          agent_runs.created_at,
          agent_runs.total_tokens,
          agent_runs.token_cost_usd,
          agent_runs.observed_usage_coverage_pct
        FROM agent_runs
        WHERE agent_runs.created_at >= ?
          ${scope.whereClause ? `AND (${scope.whereClause})` : ""}
        ORDER BY agent_runs.created_at DESC
      `)
      .all(windowStart, ...scope.values);
    const callRows = database
      .prepare(`
        SELECT
          agent_runs.workspace_slug,
          agent_runs.repo,
          COALESCE(NULLIF(llm_calls.provider, ''), agent_runs.provider) AS provider,
          COALESCE(NULLIF(llm_calls.model, ''), agent_runs.model) AS model,
          agent_runs.agent_client,
          llm_calls.created_at,
          llm_calls.prompt_tokens,
          llm_calls.completion_tokens,
          llm_calls.total_tokens,
          llm_calls.cached_input_tokens,
          llm_calls.cost_usd
        FROM llm_calls
        INNER JOIN agent_runs ON agent_runs.run_id = llm_calls.run_id
        WHERE llm_calls.created_at >= ?
          ${callsScope.whereClause ? `AND (${callsScope.whereClause})` : ""}
        ORDER BY llm_calls.created_at DESC
      `)
      .all(windowStart, ...callsScope.values);
    const sessionRows = database
      .prepare(`
        SELECT actor_slug, last_seen_at
        FROM sessions
        WHERE surface = 'portal'
          AND customer_slug = ?
      `)
      .all(String(customerSlug ?? ""));

    const promptTokens = sum(callRows.map((row) => Number(row.prompt_tokens ?? 0)));
    const completionTokens = sum(callRows.map((row) => Number(row.completion_tokens ?? 0)));
    const costUsd = sum(callRows.map((row) => Number(row.cost_usd ?? 0)));
    const cachedInputTokens = sum(callRows.map((row) => Number(row.cached_input_tokens ?? 0)));
    const requests = callRows.length > 0 ? callRows.length : runRows.length;
    const active7d = new Set(
      sessionRows
        .filter((row) => String(row.last_seen_at ?? "") >= toIsoDaysAgo(7))
        .map((row) => row.actor_slug),
    ).size;
    const active30d = new Set(
      sessionRows
        .filter((row) => String(row.last_seen_at ?? "") >= toIsoDaysAgo(30))
        .map((row) => row.actor_slug),
    ).size;

    return {
      requests,
      input_tokens: promptTokens,
      output_tokens: completionTokens,
      estimated_token_cost_usd: costUsd,
      average_context_pack_size: callRows.length > 0 ? promptTokens / callRows.length : 0,
      cache_context_reuse_rate: promptTokens > 0 ? (cachedInputTokens / promptTokens) * 100 : 0,
      active_users_7d: active7d,
      active_users_30d: active30d,
      by_workspace: finalizeAggregates(
        aggregateByKey(
          callRows,
          (row) => row.workspace_slug || "unassigned",
          (entry, row) => {
            entry.workspace_slug = row.workspace_slug || "unassigned";
            entry.repo = row.repo || "unknown-repo";
            entry.requests += 1;
            entry.input_tokens += Number(row.prompt_tokens ?? 0);
            entry.output_tokens += Number(row.completion_tokens ?? 0);
            entry.estimated_token_cost_usd += Number(row.cost_usd ?? 0);
            entry.cached_input_tokens += Number(row.cached_input_tokens ?? 0);
          },
          finalizeLiveUsageAggregate,
        ),
      ),
      by_repository: finalizeAggregates(
        aggregateByKey(
          callRows,
          (row) => row.repo || "unknown-repo",
          (entry, row) => {
            entry.repo = row.repo || "unknown-repo";
            entry.requests += 1;
            entry.input_tokens += Number(row.prompt_tokens ?? 0);
            entry.output_tokens += Number(row.completion_tokens ?? 0);
            entry.estimated_token_cost_usd += Number(row.cost_usd ?? 0);
            entry.cached_input_tokens += Number(row.cached_input_tokens ?? 0);
          },
          finalizeLiveUsageAggregate,
        ),
      ),
      by_model: finalizeAggregates(
        aggregateByKey(
          callRows,
          (row) => `${row.provider || "unknown"}/${row.model || "unknown"}`,
          (entry, row) => {
            entry.key = `${row.provider || "unknown"}/${row.model || "unknown"}`;
            entry.provider = row.provider || "unknown";
            entry.model = row.model || "unknown";
            entry.requests += 1;
            entry.input_tokens += Number(row.prompt_tokens ?? 0);
            entry.output_tokens += Number(row.completion_tokens ?? 0);
            entry.estimated_token_cost_usd += Number(row.cost_usd ?? 0);
            entry.cached_input_tokens += Number(row.cached_input_tokens ?? 0);
          },
          finalizeLiveUsageAggregate,
        ),
      ),
      by_client: finalizeAggregates(
        aggregateByKey(
          runRows,
          (row) => row.agent_client || "unknown",
          (entry, row) => {
            entry.client = row.agent_client || "unknown";
            entry.run_count += 1;
            entry.total_tokens += Number(row.total_tokens ?? 0);
            entry.estimated_token_cost_usd += Number(row.token_cost_usd ?? 0);
            entry.avg_usage_coverage_pct += Number(row.observed_usage_coverage_pct ?? 0);
          },
          (entry) => {
            entry.avg_usage_coverage_pct =
              entry.run_count > 0 ? round(entry.avg_usage_coverage_pct / entry.run_count) : 0;
            entry.estimated_token_cost_usd = roundCurrency(entry.estimated_token_cost_usd);
            entry.source_type = METRIC_SOURCE_TYPES.hostedTelemetry;
            return entry;
          },
        ),
      ),
      daily_points: buildDailyUsagePoints(callRows, windowStart),
    };
  });
}

function buildDailyUsagePoints(callRows, windowStart) {
  const points = aggregateByKey(
    callRows,
    (row) => String(row.created_at ?? "").slice(0, 10),
    (entry, row) => {
      entry.date = String(row.created_at ?? "").slice(0, 10);
      entry.requests += 1;
      entry.input_tokens += Number(row.prompt_tokens ?? 0);
      entry.output_tokens += Number(row.completion_tokens ?? 0);
      entry.estimated_token_cost_usd += Number(row.cost_usd ?? 0);
    },
    (entry) => {
      entry.estimated_token_cost_usd = roundCurrency(entry.estimated_token_cost_usd);
      return entry;
    },
  );
  return points.filter((point) => point.date >= String(windowStart).slice(0, 10));
}

function finalizeLiveUsageAggregate(entry) {
  const requests = Number(entry.requests ?? 0);
  const inputTokens = Number(entry.input_tokens ?? 0);
  entry.average_context_pack_size = requests > 0 ? round(inputTokens / requests) : 0;
  entry.cache_context_reuse_rate =
    inputTokens > 0 ? round((Number(entry.cached_input_tokens ?? 0) / inputTokens) * 100) : 0;
  entry.estimated_token_cost_usd = roundCurrency(entry.estimated_token_cost_usd);
  entry.source_type = METRIC_SOURCE_TYPES.hostedTelemetry;
  return entry;
}

function finalizeAggregates(entries) {
  return entries.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function buildTenantScopeClause({ customerSlug, workspaceSlugs = [], tableAlias = "" } = {}) {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  const clauses = [];
  const values = [];
  if (customerSlug) {
    clauses.push(`${prefix}customer_slug = ?`);
    values.push(String(customerSlug));
  }
  if (workspaceSlugs.length > 0) {
    clauses.push(`${prefix}workspace_slug IN (${workspaceSlugs.map(() => "?").join(", ")})`);
    values.push(...workspaceSlugs.map((value) => String(value)));
  }

  return {
    whereClause: clauses.join(" AND "),
    values,
  };
}

function aggregateByKey(rows, resolveKey, collect, finalize = (entry) => entry) {
  const map = new Map();
  for (const row of rows ?? []) {
    const key = resolveKey(row);
    const entry = map.get(key) ?? {};
    collect(entry, row);
    map.set(key, entry);
  }
  return [...map.values()].map((entry) => finalize(entry));
}

function buildMockInvoices({ customerSlug, monthlySubtotal }) {
  const safeCustomerSlug = String(customerSlug ?? "customer");
  return [0, 1, 2].map((index) => ({
    invoice_id: `${safeCustomerSlug}-invoice-${index + 1}`,
    issued_at: toIsoDaysAgo(index * 30 + 5),
    due_at: toIsoDaysAhead(Math.max(2, 12 - index * 3)),
    amount_usd: roundCurrency(Math.max(0, monthlySubtotal - index * 25)),
    status: index === 0 ? "upcoming" : "paid",
    source_type: "fixture_backed",
  }));
}

function buildBillingNotices({ kpis, entitlements }) {
  const notices = [];
  if (kpis.seats_total > 0 && kpis.seats_used / kpis.seats_total >= 0.85) {
    notices.push({
      level: "warning",
      title: "Seat pressure is rising",
      body: "Seat usage is close to the current entitlement limit. Review member access and benchmark proof before expanding.",
    });
  }
  if (kpis.benchmarked_repository_pct < 100) {
    notices.push({
      level: "info",
      title: "Benchmark coverage is incomplete",
      body: "Pricing conversations land better when benchmark proof covers more of the indexed repositories.",
    });
  }
  notices.push({
    level: "neutral",
    title: "Current plan posture",
    body: `${entitlements.plan_code} includes ${entitlements.seats_total} seats and ${entitlements.included_repositories} repositories before expansion review.`,
  });
  return notices;
}

function actorHasPortalPermission(actor, permission) {
  return resolveActorAccess(actor).permissions.includes(String(permission));
}

function isPortalTenantRecord(record, { customerSlug, allowedWorkspaceSlugs } = {}) {
  const workspaceSlug = String(record?.workspace_slug ?? "");
  const recordCustomerSlug = String(record?.customer_slug ?? "");
  return (
    (customerSlug && recordCustomerSlug === customerSlug) ||
    (workspaceSlug && allowedWorkspaceSlugs.has(workspaceSlug))
  );
}

function isWorkspaceStale(workspace) {
  if (!workspace?.latest_sync_at) {
    return true;
  }
  return workspace.latest_sync_at < toIsoDaysAgo(7);
}

function buildActionItem({ key, title, count, severity, href, summary, unit = "" }) {
  return {
    item_id: key,
    title,
    count: Number(count ?? 0),
    unit,
    severity,
    href,
    summary,
  };
}

function categorizeAuditEvent(event) {
  const action = String(event.action ?? "");
  if (action.startsWith("auth.session") || action.startsWith("auth.provider")) {
    return "login";
  }
  if (action.includes("sessions_revoked")) {
    return "session_revocation";
  }
  if (action.includes("role")) {
    return "role_change";
  }
  if (action.includes("export")) {
    return "export";
  }
  if (action.startsWith("document.") || action.startsWith("repository.")) {
    return "upload";
  }
  if (action.startsWith("policy.")) {
    return "policy_edit";
  }
  return "activity";
}

function buildAuditEventSummary(event) {
  switch (categorizeAuditEvent(event)) {
    case "login":
      return "Session or provider authentication activity was recorded.";
    case "session_revocation":
      return "One or more sessions were revoked.";
    case "role_change":
      return "Member roles changed.";
    case "export":
      return "An export or observability download was queued.";
    case "upload":
      return "Repository or document sync activity was recorded.";
    case "policy_edit":
      return "Policy configuration changed.";
    default:
      return "Portal activity was recorded.";
  }
}

function countEventsByType(events, type) {
  return events.filter((event) => event.category === type).length;
}

function latestTimestamp(values = []) {
  return [...values]
    .filter(Boolean)
    .sort((left, right) => String(right).localeCompare(String(left)))[0] ?? "";
}

function describeFreshness(value) {
  const safeValue = String(value ?? "").trim();
  if (!safeValue) {
    return "No sync visible";
  }

  const deltaMs = Date.now() - new Date(safeValue).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return "Sync timestamp unavailable";
  }

  const totalMinutes = Math.round(deltaMs / (1000 * 60));
  if (totalMinutes < 60) {
    return `${totalMinutes}m ago`;
  }

  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 48) {
    return `${totalHours}h ago`;
  }

  return `${Math.round(totalHours / 24)}d ago`;
}

function severityScore(value) {
  switch (value) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function toPercent(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return round((Number(numerator) / Number(denominator)) * 100);
}

function average(values = []) {
  if ((values ?? []).length === 0) {
    return 0;
  }
  return sum(values) / values.length;
}

function sum(values = []) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function round(value) {
  return Math.round(Number(value ?? 0) * 10) / 10;
}

function roundCurrency(value) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function toIsoDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Number(days ?? 0));
  return date.toISOString();
}

function toIsoDateDaysAgo(days) {
  return toIsoDaysAgo(days).slice(0, 10);
}

function toIsoDaysAhead(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + Number(days ?? 0));
  return date.toISOString();
}
