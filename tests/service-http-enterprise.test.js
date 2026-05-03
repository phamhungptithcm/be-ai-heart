import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import {
  getServiceStoragePaths,
  issueWorkspaceSession,
  replaceActorMemberships,
  upsertActor,
  upsertWorkspaceIdentity,
  writeBenchmarkArtifactRecord,
  writeAuditEvent,
  writeRepositoryProfileArtifactRecord,
} from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("portal account route exposes tenant-safe roles, members, and mock-safe provider summaries", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });

  await upsertWorkspaceIdentity({
    serviceStorageRoot: config.serviceStorageRoot,
    workspaceSlug: "alpha-workspace",
    customerSlug: "customer-alpha",
    profileSlug: "alpha-workspace",
    repo: "repo-alpha",
    displayName: "Alpha Workspace",
    plan: "team",
    status: "active",
    source: "test-seed",
  });
  await upsertActor({
    serviceStorageRoot: config.serviceStorageRoot,
    actor: {
      actor_slug: "customer-owner",
      surface: "portal",
      role: "org_admin",
      roles: ["org_admin", "finance_viewer"],
      access_mode: "memberships",
      customer_slug: "customer-alpha",
      display_name: "Customer Owner",
    },
  });
  await upsertActor({
    serviceStorageRoot: config.serviceStorageRoot,
    actor: {
      actor_slug: "customer-engineer",
      surface: "portal",
      role: "engineer",
      roles: ["engineer"],
      access_mode: "memberships",
      customer_slug: "customer-alpha",
      display_name: "Customer Engineer",
    },
  });
  await replaceActorMemberships({
    serviceStorageRoot: config.serviceStorageRoot,
    actorSlug: "customer-owner",
    memberships: [{ workspace_slug: "alpha-workspace" }],
  });
  await replaceActorMemberships({
    serviceStorageRoot: config.serviceStorageRoot,
    actorSlug: "customer-engineer",
    memberships: [{ workspace_slug: "alpha-workspace" }],
  });

  const session = await issueWorkspaceSession({
    serviceStorageRoot: config.serviceStorageRoot,
    actorSlug: "customer-owner",
    surface: "portal",
    workspaceSlug: "alpha-workspace",
    customerSlug: "customer-alpha",
    sessionToken: "portal-org-admin-session",
  });

  const response = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/account", {
      headers: {
        "x-be-ai-heart-session": session.session_token,
      },
    }),
    config,
  );

  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.viewer.actor_slug, "customer-owner");
  assert.deepEqual(payload.viewer.roles, ["finance_viewer", "org_admin"]);
  assert.ok(payload.viewer.permissions.includes("portal.billing.read"));
  assert.equal(payload.organization.customer_slug, "customer-alpha");
  assert.equal(payload.members.length, 2);
  assert.equal(payload.billing.provider_mode, "mock");
  assert.equal(payload.billing.customer_id, payload.organization.customer_id);
  assert.equal(payload.auth.client_secret, undefined);
});

test("portal overview, usage, billing, and governance routes expose stable tenant-scoped enterprise contracts", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });

  await upsertWorkspaceIdentity({
    serviceStorageRoot: config.serviceStorageRoot,
    workspaceSlug: "alpha-workspace",
    customerSlug: "customer-alpha",
    profileSlug: "alpha-workspace",
    repo: "repo-alpha",
    displayName: "Alpha Workspace",
    plan: "team",
    status: "active",
    source: "test-seed",
  });
  await upsertActor({
    serviceStorageRoot: config.serviceStorageRoot,
    actor: {
      actor_slug: "alpha-org-admin",
      surface: "portal",
      role: "org_admin",
      roles: ["org_admin"],
      access_mode: "memberships",
      customer_slug: "customer-alpha",
      display_name: "Alpha Org Admin",
    },
  });
  await replaceActorMemberships({
    serviceStorageRoot: config.serviceStorageRoot,
    actorSlug: "alpha-org-admin",
    memberships: [{ workspace_slug: "alpha-workspace" }],
  });

  const session = await issueWorkspaceSession({
    serviceStorageRoot: config.serviceStorageRoot,
    actorSlug: "alpha-org-admin",
    surface: "portal",
    workspaceSlug: "alpha-workspace",
    customerSlug: "customer-alpha",
    sessionToken: "portal-overview-session",
  });

  const headers = {
    "x-be-ai-heart-session": session.session_token,
  };

  const [overviewResponse, usageResponse, billingResponse, membersResponse, policiesResponse, securityResponse, settingsResponse] =
    await Promise.all([
      handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/overview", { headers }), config),
      handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/usage/summary", { headers }), config),
      handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/billing", { headers }), config),
      handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/members", { headers }), config),
      handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/policies", { headers }), config),
      handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/security", { headers }), config),
      handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/settings", { headers }), config),
    ]);

  assert.equal(overviewResponse.status, 200);
  assert.equal(usageResponse.status, 200);
  assert.equal(billingResponse.status, 200);
  assert.equal(membersResponse.status, 200);
  assert.equal(policiesResponse.status, 200);
  assert.equal(securityResponse.status, 200);
  assert.equal(settingsResponse.status, 200);

  const [overviewPayload, usagePayload, billingPayload, membersPayload, policiesPayload, securityPayload, settingsPayload] =
    await Promise.all([
      overviewResponse.json(),
      usageResponse.json(),
      billingResponse.json(),
      membersResponse.json(),
      policiesResponse.json(),
      securityResponse.json(),
      settingsResponse.json(),
    ]);

  assert.equal(overviewPayload.schema_version, 1);
  assert.deepEqual(Object.keys(overviewPayload.kpis).sort(), [
    "active_workspaces",
    "auth_failure_count",
    "avg_review_cleanup_reduction_pct",
    "avg_token_savings_pct",
    "benchmark_backed_repositories",
    "benchmarked_repository_pct",
    "estimated_cost_savings_usd",
    "estimated_monthly_savings_usd",
    "failed_sync_job_count",
    "indexed_repositories",
    "latest_sync_at",
    "latest_sync_freshness",
    "memory_ready_pct",
    "memory_ready_repositories",
    "open_critical_alerts",
    "plan_code",
    "plan_entitlement_status",
    "policy_warning_count",
    "queued_submission_count",
    "repos_onboarded",
    "seats_total",
    "seats_used",
    "server_error_count",
    "stale_repositories",
    "stale_repository_count",
  ]);
  assert.ok(Array.isArray(overviewPayload.action_center.items));
  assert.equal(usagePayload.schema_version, 1);
  assert.equal(usagePayload.summary.metric_sources.live_operational, "hosted_telemetry");
  assert.equal(usagePayload.summary.metric_sources.benchmark_derived, "benchmark_artifact");
  assert.ok(Array.isArray(usagePayload.breakdowns.workspaces));
  assert.equal(billingPayload.schema_version, 1);
  assert.equal(billingPayload.provider_mode, "mock");
  assert.equal(membersPayload.schema_version, 1);
  assert.ok(Array.isArray(membersPayload.members));
  assert.equal(policiesPayload.schema_version, 1);
  assert.ok(Array.isArray(policiesPayload.policy_packs));
  assert.equal(securityPayload.schema_version, 1);
  assert.ok(Array.isArray(securityPayload.recent_events));
  assert.equal(settingsPayload.schema_version, 1);
  assert.equal(settingsPayload.organization.customer_slug, "customer-alpha");
});

test("portal enterprise routes stay tenant-scoped and permission-aware", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });

  await Promise.all([
    upsertWorkspaceIdentity({
      serviceStorageRoot: config.serviceStorageRoot,
      workspaceSlug: "alpha-workspace",
      customerSlug: "customer-alpha",
      profileSlug: "alpha-workspace",
      repo: "repo-alpha",
      displayName: "Alpha Workspace",
      source: "test-seed",
    }),
    upsertWorkspaceIdentity({
      serviceStorageRoot: config.serviceStorageRoot,
      workspaceSlug: "beta-workspace",
      customerSlug: "customer-beta",
      profileSlug: "beta-workspace",
      repo: "repo-beta",
      displayName: "Beta Workspace",
      source: "test-seed",
    }),
  ]);
  await Promise.all([
    upsertActor({
      serviceStorageRoot: config.serviceStorageRoot,
      actor: {
        actor_slug: "alpha-admin",
        surface: "portal",
        role: "org_admin",
        roles: ["org_admin"],
        access_mode: "memberships",
        customer_slug: "customer-alpha",
      },
    }),
    upsertActor({
      serviceStorageRoot: config.serviceStorageRoot,
      actor: {
        actor_slug: "alpha-finance",
        surface: "portal",
        role: "finance_viewer",
        roles: ["finance_viewer"],
        access_mode: "memberships",
        customer_slug: "customer-alpha",
      },
    }),
    upsertActor({
      serviceStorageRoot: config.serviceStorageRoot,
      actor: {
        actor_slug: "beta-admin",
        surface: "portal",
        role: "org_admin",
        roles: ["org_admin"],
        access_mode: "memberships",
        customer_slug: "customer-beta",
      },
    }),
  ]);
  await Promise.all([
    replaceActorMemberships({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "alpha-admin",
      memberships: [{ workspace_slug: "alpha-workspace" }],
    }),
    replaceActorMemberships({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "alpha-finance",
      memberships: [{ workspace_slug: "alpha-workspace" }],
    }),
    replaceActorMemberships({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "beta-admin",
      memberships: [{ workspace_slug: "beta-workspace" }],
    }),
  ]);

  const [alphaSession, financeSession, betaSession] = await Promise.all([
    issueWorkspaceSession({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "alpha-admin",
      surface: "portal",
      workspaceSlug: "alpha-workspace",
      customerSlug: "customer-alpha",
      sessionToken: "portal-alpha-admin-session",
    }),
    issueWorkspaceSession({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "alpha-finance",
      surface: "portal",
      workspaceSlug: "alpha-workspace",
      customerSlug: "customer-alpha",
      sessionToken: "portal-alpha-finance-session",
    }),
    issueWorkspaceSession({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "beta-admin",
      surface: "portal",
      workspaceSlug: "beta-workspace",
      customerSlug: "customer-beta",
      sessionToken: "portal-beta-admin-session",
    }),
  ]);

  await Promise.all([
    writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "repository.profile_written",
        outcome: "success",
        surface: "portal",
        actor_slug: "alpha-admin",
        workspace_slug: "alpha-workspace",
        customer_slug: "customer-alpha",
        customer_id: alphaSession.customer_id,
        target_type: "repository_profile",
        target_id: "alpha-workspace",
      },
    }),
    writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "repository.profile_written",
        outcome: "success",
        surface: "portal",
        actor_slug: "beta-admin",
        workspace_slug: "beta-workspace",
        customer_slug: "customer-beta",
        customer_id: betaSession.customer_id,
        target_type: "repository_profile",
        target_id: "beta-workspace",
      },
    }),
  ]);

  const sessionsResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/sessions", {
      headers: {
        "x-be-ai-heart-session": alphaSession.session_token,
      },
    }),
    config,
  );
  const auditResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/audit/events", {
      headers: {
        "x-be-ai-heart-session": alphaSession.session_token,
      },
    }),
    config,
  );
  const blockedAuditResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/audit/events", {
      headers: {
        "x-be-ai-heart-session": financeSession.session_token,
      },
    }),
    config,
  );

  assert.equal(sessionsResponse.status, 200);
  assert.equal(auditResponse.status, 200);
  assert.equal(blockedAuditResponse.status, 403);

  const sessionsPayload = await sessionsResponse.json();
  const auditPayload = await auditResponse.json();

  assert.equal(sessionsPayload.sessions.some((entry) => entry.customer_slug === "customer-beta"), false);
  assert.equal(sessionsPayload.sessions.every((entry) => entry.session_token === ""), true);
  assert.equal(auditPayload.events.some((entry) => entry.customer_slug === "customer-beta"), false);
  assert.ok(auditPayload.events.some((entry) => entry.customer_slug === "customer-alpha"));
});

test("admin internal RBAC gates observability without breaking sales ops revenue access", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });

  await Promise.all([
    upsertActor({
      serviceStorageRoot: config.serviceStorageRoot,
      actor: {
        actor_slug: "sales-ops-admin",
        surface: "admin",
        role: "sales_ops",
        roles: ["sales_ops"],
        access_mode: "memberships",
        customer_slug: "internal",
      },
    }),
    upsertActor({
      serviceStorageRoot: config.serviceStorageRoot,
      actor: {
        actor_slug: "engineering-admin",
        surface: "admin",
        role: "engineering_admin",
        roles: ["engineering_admin"],
        access_mode: "memberships",
        customer_slug: "internal",
      },
    }),
  ]);

  const [salesSession, engineeringSession] = await Promise.all([
    issueWorkspaceSession({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "sales-ops-admin",
      surface: "admin",
      customerSlug: "internal",
      sessionToken: "admin-sales-ops-session",
    }),
    issueWorkspaceSession({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "engineering-admin",
      surface: "admin",
      customerSlug: "internal",
      sessionToken: "admin-engineering-session",
    }),
  ]);
  const servicePaths = getServiceStoragePaths({ serviceStorageRoot: config.serviceStorageRoot });
  const contextPackRepoRoot = path.join(servicePaths.contextPackRepositoryFilesRoot, "founder-workspace");
  await fs.mkdir(contextPackRepoRoot, { recursive: true });
  await fs.writeFile(
    path.join(contextPackRepoRoot, "pack-founder.json"),
    `${JSON.stringify({
      pack_id: "pack-founder",
      profile_slug: "founder-workspace",
      created_at: new Date().toISOString(),
      status: "ready",
    }, null, 2)}\n`,
    "utf8",
  );
  await writeRepositoryProfileArtifactRecord({
    serviceStorageRoot: config.serviceStorageRoot,
    profile: {
      profile_slug: "founder-workspace",
      workspace_slug: "founder-workspace",
      customer_slug: "customer-founder",
      repo: "founder/repo",
      display_name: "Founder Repo",
      generated_at: new Date().toISOString(),
      overview: {},
      heart: {},
      documents: {},
      cache: {},
      diagrams: [],
    },
  });
  await writeBenchmarkArtifactRecord({
    serviceStorageRoot: config.serviceStorageRoot,
    report: {
      report_id: "founder-report",
      profile_slug: "founder-workspace",
      workspace_slug: "founder-workspace",
      customer_slug: "customer-founder",
      repo: "founder/repo",
      scenario: "founder-dashboard",
      provider: "openai",
      model: "gpt-5.4-mini",
      generated_at: new Date().toISOString(),
      metrics: {
        token_savings_pct: 17.5,
        token_cost_savings_usd: 42,
      },
      summary: "Founder dashboard benchmark report",
    },
  });
  await writeAuditEvent({
    serviceStorageRoot: config.serviceStorageRoot,
    event: {
      action: "mcp.connected",
      outcome: "success",
      surface: "admin",
      actor_slug: "sales-ops-admin",
      workspace_slug: "founder-workspace",
      customer_slug: "customer-founder",
    },
  });
  await writeAuditEvent({
    serviceStorageRoot: config.serviceStorageRoot,
    event: {
      action: "repository.sync_failed",
      outcome: "failure",
      surface: "admin",
      actor_slug: "sales-ops-admin",
      workspace_slug: "founder-workspace",
      customer_slug: "customer-founder",
    },
  });

  const intakeResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/intake", {
      headers: {
        "x-be-ai-heart-session": salesSession.session_token,
      },
    }),
    config,
  );
  const salesOverviewResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/overview", {
      headers: {
        "x-be-ai-heart-session": salesSession.session_token,
      },
    }),
    config,
  );
  const blockedObservabilityResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/observability/metrics", {
      headers: {
        "x-be-ai-heart-session": salesSession.session_token,
      },
    }),
    config,
  );
  const salesBillingOpsResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/billing-ops", {
      headers: {
        "x-be-ai-heart-session": salesSession.session_token,
      },
    }),
    config,
  );
  const engineeringObservabilityResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/observability/metrics", {
      headers: {
        "x-be-ai-heart-session": engineeringSession.session_token,
      },
    }),
    config,
  );
  const blockedEngineeringBillingOpsResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/billing-ops", {
      headers: {
        "x-be-ai-heart-session": engineeringSession.session_token,
      },
    }),
    config,
  );

  assert.equal(intakeResponse.status, 200);
  assert.equal(salesOverviewResponse.status, 200);
  assert.equal(blockedObservabilityResponse.status, 403);
  assert.equal(salesBillingOpsResponse.status, 200);
  assert.equal(engineeringObservabilityResponse.status, 200);
  assert.equal(blockedEngineeringBillingOpsResponse.status, 403);

  const salesOverviewPayload = await salesOverviewResponse.json();
  assert.equal(salesOverviewPayload.founder_metrics.active_workspaces, 1);
  assert.equal(salesOverviewPayload.founder_metrics.active_repos, 1);
  assert.equal(salesOverviewPayload.founder_metrics.context_packs_generated, 1);
  assert.equal(salesOverviewPayload.founder_metrics.benchmark_runs, 1);
  assert.equal(salesOverviewPayload.founder_metrics.token_savings_reported, 17.5);
  assert.equal(salesOverviewPayload.founder_metrics.estimated_cost_savings, 42);
  assert.equal(salesOverviewPayload.founder_metrics.mcp_connections, 1);
  assert.equal(salesOverviewPayload.founder_metrics.failed_sync_jobs, 1);
  assert.match(salesOverviewPayload.founder_metrics.source_note, /Financial values are estimates/);
});
