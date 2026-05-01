import {
  METRIC_SOURCE_TYPES,
  resolveActorAccess,
} from "../../../packages/shared-schema/src/enterprise.js";
import {
  listAccessibleRepositoryProfilesPage,
  listAccessibleWorkspacesPage,
  loadAccessibleBenchmarkIndexPage,
  loadAccessibleDocumentsView,
} from "./access.js";
import { listCustomers } from "./customer-registry.js";
import { listWorkspaceIdentities } from "./identity.js";
import { listOperationalAlerts, summarizeHostedTrafficMetrics } from "./observability.js";
import { resolveBillingProviderAdapter } from "./provider-adapters.js";
import { listAuditEvents, listRequestTraces } from "./storage.js";

export async function loadAdminOverviewView({
  serviceStorageRoot,
  authContext,
  localDemoAuth,
} = {}) {
  const dataset = await loadAdminDataset({
    serviceStorageRoot,
    authContext,
    localDemoAuth,
  });
  const customerInventory = buildCustomerInventory(dataset);
  const failedSyncs = countFailedSyncs(dataset.auditEvents);
  const authFailures = countAuthFailures(dataset);
  const alertPosture = {
    alert_count: dataset.alerts.alerts.length,
    status_5xx: Number(dataset.trafficSummary.status_5xx ?? 0),
  };

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    kpis: {
      active_orgs: customerInventory.filter((row) => row.status === "active").length,
      active_trials: customerInventory.filter((row) => row.trial_stage === "trial").length,
      benchmark_backed_orgs: customerInventory.filter(
        (row) => row.benchmark_backed_repositories > 0,
      ).length,
      expansion_ready_orgs: customerInventory.filter(
        (row) => row.expansion_readiness === "ready",
      ).length,
      queued_submissions: sum(customerInventory.map((row) => row.queued_submissions)),
      failed_syncs: failedSyncs,
      auth_failures: authFailures,
      alert_posture: `${alertPosture.status_5xx} 5xx · ${alertPosture.alert_count} alerts`,
      at_risk_accounts: customerInventory.filter((row) => row.risk_level === "high").length,
    },
    customers: customerInventory.slice(0, 12),
    alerts: dataset.alerts.alerts,
    traffic_summary: dataset.trafficSummary,
  };
}

export async function loadAdminCustomerInventoryView({
  serviceStorageRoot,
  authContext,
  localDemoAuth,
} = {}) {
  const dataset = await loadAdminDataset({
    serviceStorageRoot,
    authContext,
    localDemoAuth,
  });

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    customers: buildCustomerInventory(dataset),
  };
}

export async function loadAdminBillingOpsView({
  serviceStorageRoot,
  authContext,
  localDemoAuth,
} = {}) {
  const dataset = await loadAdminDataset({
    serviceStorageRoot,
    authContext,
    localDemoAuth,
  });
  const adapter = resolveBillingProviderAdapter();
  const customers = buildCustomerInventory(dataset);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    viewer: dataset.viewer,
    adapter_id: adapter.adapter_id,
    provider_mode: adapter.provider_mode,
    source_type: adapter.source_type,
    accounts: customers.map((customer) => ({
      customer_id: customer.customer_id,
      customer_slug: customer.customer_slug,
      display_name: customer.display_name,
      plan_code: customer.plan_code,
      billing_status: customer.status,
      entitlement_status: customer.entitlement_status,
      seats_used: customer.seats_used,
      seats_total: customer.seats_total,
      benchmark_backed_repositories: customer.benchmark_backed_repositories,
      expansion_readiness: customer.expansion_readiness,
      renewal_date: customer.renewal_date,
      source_type: METRIC_SOURCE_TYPES.externalIntegration,
    })),
  };
}

async function loadAdminDataset({
  serviceStorageRoot,
  authContext,
  localDemoAuth,
} = {}) {
  const viewer = resolveActorAccess(authContext?.actor ?? { surface: "admin" });
  const [customers, workspaceIdentities, workspacesPage, profilesPage, documents, benchmarksPage, auditEvents, requestTraces, alerts, trafficSummary] =
    await Promise.all([
      listCustomers({
        serviceStorageRoot,
        limit: 500,
        offset: 0,
      }),
      listWorkspaceIdentities({
        serviceStorageRoot,
      }),
      listAccessibleWorkspacesPage({
        serviceStorageRoot,
        surface: "admin",
        actorSlug: authContext?.actor_slug,
        localDemoAuth,
        limit: 500,
        offset: 0,
      }),
      listAccessibleRepositoryProfilesPage({
        serviceStorageRoot,
        surface: "admin",
        actorSlug: authContext?.actor_slug,
        localDemoAuth,
        limit: 500,
        offset: 0,
      }),
      loadAccessibleDocumentsView({
        serviceStorageRoot,
        surface: "admin",
        actorSlug: authContext?.actor_slug,
        localDemoAuth,
      }),
      loadAccessibleBenchmarkIndexPage({
        serviceStorageRoot,
        surface: "admin",
        actorSlug: authContext?.actor_slug,
        localDemoAuth,
        limit: 500,
        offset: 0,
      }),
      listAuditEvents({
        serviceStorageRoot,
        limit: 1000,
        offset: 0,
      }),
      listRequestTraces({
        serviceStorageRoot,
        limit: 1000,
        offset: 0,
      }),
      listOperationalAlerts({
        serviceStorageRoot,
        since: toIsoDaysAgo(30),
      }),
      summarizeHostedTrafficMetrics({
        serviceStorageRoot,
        since: toIsoDaysAgo(30),
      }),
    ]);

  return {
    viewer,
    customers,
    workspaceIdentities,
    workspaces: workspacesPage.items ?? [],
    profiles: profilesPage.items ?? [],
    reports: benchmarksPage.reports ?? [],
    submissions: documents.submissions ?? [],
    auditEvents,
    requestTraces,
    alerts,
    trafficSummary,
  };
}

function buildCustomerInventory(dataset) {
  const profilesByCustomer = groupCount(dataset.profiles, (entry) => entry.customer_slug);
  const reportsByCustomer = groupCount(dataset.reports, (entry) => entry.customer_slug);
  const submissionsByCustomer = groupCount(dataset.submissions, (entry) => entry.customer_slug);
  const identitiesByCustomer = groupEntries(dataset.workspaceIdentities, (entry) => entry.customer_slug);
  const workspacesByCustomer = groupEntries(dataset.workspaces, (entry) => entry.customer_slug);
  const failedSyncsByCustomer = groupCount(
    dataset.auditEvents.filter(isSyncFailure),
    (entry) => entry.customer_slug,
  );
  const authFailuresByCustomer = groupCount(
    dataset.auditEvents.filter(
      (entry) =>
        String(entry.action ?? "").startsWith("auth.") &&
        !["success", "noop"].includes(String(entry.outcome ?? "")),
    ),
    (entry) => entry.customer_slug,
  );

  return (dataset.customers ?? [])
    .filter((customer) => customer.customer_slug !== "internal")
    .map((customer) => {
      const customerSlug = String(customer.customer_slug ?? "");
      const identities = identitiesByCustomer.get(customerSlug) ?? [];
      const workspaces = workspacesByCustomer.get(customerSlug) ?? [];
      const planCode = resolvePlanCode(identities);
      const seatsTotal = resolveSeatAllowance(planCode);
      const seatsUsed = Math.min(
        workspaces.length || profilesByCustomer.get(customerSlug) || 0,
        seatsTotal,
      );
      const benchmarkBackedRepositories = reportsByCustomer.get(customerSlug) ?? 0;
      const queuedSubmissions = submissionsByCustomer.get(customerSlug) ?? 0;
      const failedSyncs = failedSyncsByCustomer.get(customerSlug) ?? 0;
      const authFailures = authFailuresByCustomer.get(customerSlug) ?? 0;
      const staleRepos = workspaces.filter((workspace) => isStale(workspace.latest_sync_at)).length;
      const riskLevel =
        failedSyncs > 0 || authFailures > 0 || staleRepos > 0 ? "high" : "normal";

      return {
        customer_id: customer.customer_id,
        customer_slug: customerSlug,
        display_name: customer.display_name,
        status: customer.status,
        trial_stage: planCode === "pilot" ? "trial" : "customer",
        plan_code: planCode,
        repository_count: profilesByCustomer.get(customerSlug) ?? 0,
        memory_ready_repositories: workspaces.filter(
          (workspace) => workspace.profile_available && workspace.document_available,
        ).length,
        benchmark_backed_repositories: benchmarkBackedRepositories,
        queued_submissions: queuedSubmissions,
        failed_syncs: failedSyncs,
        auth_failures: authFailures,
        stale_repositories: staleRepos,
        seats_used: seatsUsed,
        seats_total: seatsTotal,
        entitlement_status: `${planCode} · ${seatsUsed}/${seatsTotal} seats`,
        expansion_readiness:
          benchmarkBackedRepositories > 0 && failedSyncs === 0 && staleRepos === 0
            ? "ready"
            : "watch",
        risk_level: riskLevel,
        renewal_date: toIsoDaysAhead(planCode === "pilot" ? 14 : 30),
        source_types: {
          readiness: METRIC_SOURCE_TYPES.repoArtifact,
          roi: METRIC_SOURCE_TYPES.benchmarkArtifact,
          billing: METRIC_SOURCE_TYPES.externalIntegration,
        },
      };
    })
    .sort((left, right) => left.display_name.localeCompare(right.display_name));
}

function resolvePlanCode(identities = []) {
  const order = ["enterprise", "team", "starter", "pilot"];
  return (
    identities
      .map((identity) => String(identity.plan ?? "starter"))
      .sort((left, right) => order.indexOf(left) - order.indexOf(right))[0] ??
    "starter"
  );
}

function resolveSeatAllowance(planCode) {
  switch (planCode) {
    case "enterprise":
      return 100;
    case "team":
      return 20;
    case "starter":
      return 8;
    default:
      return 5;
  }
}

function groupEntries(entries = [], getKey) {
  const map = new Map();
  for (const entry of entries) {
    const key = String(getKey(entry) ?? "");
    if (!key) {
      continue;
    }
    const group = map.get(key) ?? [];
    group.push(entry);
    map.set(key, group);
  }
  return map;
}

function groupCount(entries = [], getKey) {
  const map = new Map();
  for (const entry of entries) {
    const key = String(getKey(entry) ?? "");
    if (!key) {
      continue;
    }
    map.set(key, Number(map.get(key) ?? 0) + 1);
  }
  return map;
}

function countFailedSyncs(events = []) {
  return events.filter(isSyncFailure).length;
}

function countAuthFailures(dataset) {
  const auditFailures = dataset.auditEvents.filter(
    (entry) =>
      String(entry.action ?? "").startsWith("auth.") &&
      !["success", "noop"].includes(String(entry.outcome ?? "")),
  ).length;
  const traceFailures = dataset.requestTraces.filter(
    (entry) =>
      ["auth-callback", "auth-authorize", "session-provider"].includes(
        String(entry.route_kind ?? ""),
      ) && Number(entry.status_code ?? 0) >= 400,
  ).length;
  return auditFailures + traceFailures;
}

function isSyncFailure(event) {
  return (
    (String(event.action ?? "").startsWith("sync.") ||
      String(event.action ?? "").startsWith("repository.") ||
      String(event.action ?? "").startsWith("document.")) &&
    !["success", "noop"].includes(String(event.outcome ?? ""))
  );
}

function isStale(value) {
  const safeValue = String(value ?? "").trim();
  if (!safeValue) {
    return true;
  }
  return safeValue < toIsoDaysAgo(7);
}

function sum(values = []) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function toIsoDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Number(days ?? 0));
  return date.toISOString();
}

function toIsoDaysAhead(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + Number(days ?? 0));
  return date.toISOString();
}
