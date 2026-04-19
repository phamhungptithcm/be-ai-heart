import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import {
  resolveRequestAuthContext,
  writeBenchmarkReportForActor,
  writeRepositoryProfileForActor,
} from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("service host paginates admin workspace, repository, benchmark, and intake listings", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });
  const adminRequest = new Request("http://127.0.0.1:4010/api/admin/session", {
    headers: {
      "x-be-ai-heart-session": "admin-owner-session",
    },
  });
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface: "admin",
    request: adminRequest,
  });
  const seededWorkspaces = [
    {
      workspaceSlug: "alpha-workspace",
      customerSlug: "customer-alpha",
      repo: "repo-alpha",
      generatedAt: "2026-01-01T00:00:00.000Z",
      summary: "Alpha benchmark summary",
    },
    {
      workspaceSlug: "beta-workspace",
      customerSlug: "customer-beta",
      repo: "repo-beta",
      generatedAt: "2026-01-02T00:00:00.000Z",
      summary: "Beta benchmark summary",
    },
    {
      workspaceSlug: "gamma-workspace",
      customerSlug: "customer-gamma",
      repo: "repo-gamma",
      generatedAt: "2026-01-03T00:00:00.000Z",
      summary: "Gamma benchmark summary",
    },
  ];

  for (const [index, workspace] of seededWorkspaces.entries()) {
    await writeRepositoryProfileForActor({
      serviceStorageRoot: config.serviceStorageRoot,
      surface: "admin",
      authContext,
      profile: {
        profile_slug: workspace.workspaceSlug,
        workspace_slug: workspace.workspaceSlug,
        customer_slug: workspace.customerSlug,
        repo: workspace.repo,
        generated_at: workspace.generatedAt,
        overview: {},
        heart: {},
        documents: {},
        cache: {},
        diagrams: [],
      },
      portalRoot: config.portalRoot,
      adminRoot: config.adminRoot,
    });
    await writeBenchmarkReportForActor({
      serviceStorageRoot: config.serviceStorageRoot,
      surface: "admin",
      authContext,
      report: {
        report_id: `report-${workspace.workspaceSlug}`,
        profile_slug: workspace.workspaceSlug,
        workspace_slug: workspace.workspaceSlug,
        customer_slug: workspace.customerSlug,
        repo: workspace.repo,
        scenario: `scenario-${index + 1}`,
        provider: "openai",
        model: "gpt-5.4-mini",
        generated_at: workspace.generatedAt,
        metrics: {
          token_savings_pct: 15 + index,
          memory_refresh_reduction_pct: 10 + index,
        },
        summary: workspace.summary,
        manager_summary: `Manager view for ${workspace.workspaceSlug}`,
      },
      portalRoot: config.portalRoot,
      adminRoot: config.adminRoot,
    });
  }

  for (const [index, kind] of ["demo", "trial", "demo"].entries()) {
    const intakeResponse = await handleServiceHttpRequest(
      new Request("http://127.0.0.1:4010/api/public/intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `203.0.113.${index + 1}`,
        },
        body: JSON.stringify({
          intake_kind: kind,
          full_name: `Buyer ${index + 1}`,
          work_email: `buyer${index + 1}@example.com`,
          company: "Example Labs",
          role: "Engineering Manager",
          team_size: 10 + index,
          repo_count: 2 + index,
          primary_goal: "Reduce AI token spend while keeping architecture clean.",
          message: `Need guided pilot repo ${index + 1}.`,
          source_page: kind === "trial" ? "/start-trial" : "/book-demo",
        }),
      }),
      config,
    );

    assert.equal(intakeResponse.status, 201);
  }

  const workspacesResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/workspaces?page=2&limit=1", {
      headers: {
        "x-be-ai-heart-session": "admin-owner-session",
      },
    }),
    config,
  );
  const repositoriesResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/repositories?page=2&limit=1", {
      headers: {
        "x-be-ai-heart-session": "admin-owner-session",
      },
    }),
    config,
  );
  const benchmarksResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/benchmarks?page=2&limit=1", {
      headers: {
        "x-be-ai-heart-session": "admin-owner-session",
      },
    }),
    config,
  );
  const intakeListResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/intake?page=2&limit=1", {
      headers: {
        "x-be-ai-heart-session": "admin-owner-session",
      },
    }),
    config,
  );

  assert.equal(workspacesResponse.status, 200);
  assert.equal(repositoriesResponse.status, 200);
  assert.equal(benchmarksResponse.status, 200);
  assert.equal(intakeListResponse.status, 200);

  const workspacesPayload = await workspacesResponse.json();
  const repositoriesPayload = await repositoriesResponse.json();
  const benchmarksPayload = await benchmarksResponse.json();
  const intakePayload = await intakeListResponse.json();

  assert.equal(workspacesPayload.workspaces.length, 1);
  assert.equal(workspacesPayload.workspaces[0].workspace_slug, "beta-workspace");
  assert.deepEqual(workspacesPayload.page_info, {
    page: 2,
    limit: 1,
    total_count: 3,
    total_pages: 3,
    returned_count: 1,
    has_previous_page: true,
    has_next_page: true,
  });

  assert.equal(repositoriesPayload.profiles.length, 1);
  assert.equal(repositoriesPayload.profiles[0].profile_slug, "beta-workspace");
  assert.deepEqual(repositoriesPayload.page_info, {
    page: 2,
    limit: 1,
    total_count: 3,
    total_pages: 3,
    returned_count: 1,
    has_previous_page: true,
    has_next_page: true,
  });

  assert.equal(benchmarksPayload.reports.length, 1);
  assert.equal(benchmarksPayload.reports[0].profile_slug, "beta-workspace");
  assert.deepEqual(benchmarksPayload.page_info, {
    page: 2,
    limit: 1,
    total_count: 3,
    total_pages: 3,
    returned_count: 1,
    has_previous_page: true,
    has_next_page: true,
  });

  assert.equal(intakePayload.requests.length, 1);
  assert.equal(intakePayload.summary.total_count, 3);
  assert.deepEqual(intakePayload.page_info, {
    page: 2,
    limit: 1,
    total_count: 3,
    total_pages: 3,
    returned_count: 1,
    has_previous_page: true,
    has_next_page: true,
  });
});
