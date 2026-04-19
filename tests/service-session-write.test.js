import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { compareBenchmarkRuns } from "../packages/benchmark/src/index.js";
import { buildWorkspaceState } from "../packages/core/src/index.js";
import {
  generateDiagramBundle,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../packages/diagram-generator/src/index.js";
import {
  issueWorkspaceSession,
  listAuditEvents,
  loadAccessRegistry,
  resolveRequestAuthContext,
  writeBenchmarkReportForActor,
  writeRepositoryProfileForActor,
} from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("session-backed auth context resolves actor and enforces tenant-scoped writes", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const serviceStorageRoot = path.join(workspaceRoot, "services", "api", "data");
  const authRoot = path.join(serviceStorageRoot, "auth");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
    fs.mkdir(authRoot, { recursive: true }),
  ]);

  const workspaceState = await buildWorkspaceState(repoRoot);
  const bundle = generateDiagramBundle({
    workspaceState,
    task: "improve login audit flow",
  });
  const artifacts = await writeDiagramBundle(repoRoot, bundle);

  await syncRepositoryProfile({
    repoRoot,
    workspaceState,
    bundle,
    artifacts,
    slug: "alpha-workspace",
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  });
  await syncRepositoryProfile({
    repoRoot,
    workspaceState,
    bundle,
    artifacts,
    slug: "beta-workspace",
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  });

  await fs.writeFile(
    path.join(authRoot, "actors.json"),
    `${JSON.stringify(
      {
        actors: [
          {
            actor_slug: "owner-admin",
            surface: "admin",
            role: "owner",
            access_mode: "all",
          },
          {
            actor_slug: "customer-alpha",
            surface: "portal",
            role: "customer",
            access_mode: "memberships",
            customer_slug: "customer-alpha",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(authRoot, "memberships.json"),
    `${JSON.stringify(
      {
        memberships: [
          {
            actor_slug: "customer-alpha",
            workspace_slug: "alpha-workspace",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await loadAccessRegistry({ serviceStorageRoot });
  const session = await issueWorkspaceSession({
    serviceStorageRoot,
    actorSlug: "customer-alpha",
    surface: "portal",
    workspaceSlug: "alpha-workspace",
    customerSlug: "customer-alpha",
    sessionToken: "alpha-write-session",
  });
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot,
    surface: "portal",
    request: {
      nextUrl: new URL(`http://localhost/api/portal/session?session=${session.session_token}`),
      headers: new Headers(),
    },
  });

  assert.equal(authContext.actor_slug, "customer-alpha");
  assert.equal(authContext.workspace_slug, "alpha-workspace");
  assert.equal(authContext.workspaces.length, 1);
  assert.equal(authContext.workspace_identity?.workspace_slug, "alpha-workspace");

  const benchmarkResult = await writeBenchmarkReportForActor({
    serviceStorageRoot,
    surface: "portal",
    authContext,
    report: compareBenchmarkRuns(
      {
        tokens: 5000,
        minutes: 30,
        duplicates: 3,
        review_edits: 8,
        memory_refreshes: 4,
        token_cost_usd: 1.2,
      },
      {
        tokens: 3100,
        minutes: 18,
        duplicates: 1,
        review_edits: 2,
        memory_refreshes: 1,
        token_cost_usd: 0.8,
      },
      {
        repo: path.basename(repoRoot),
        profile_slug: "alpha-workspace",
        scenario: "tenant-write-check",
      },
    ),
    portalRoot,
    adminRoot,
  });

  assert.equal(benchmarkResult.report.workspace_slug, "alpha-workspace");
  assert.equal(benchmarkResult.report.customer_slug, "customer-alpha");
  assert.ok(benchmarkResult.synced_destinations.some((entry) => entry.kind === "portal"));
  const auditEvents = await listAuditEvents({
    serviceStorageRoot,
  });
  const benchmarkAuditEvent = auditEvents.find((entry) => entry.action === "benchmark.report_written");

  assert.ok(benchmarkAuditEvent);
  assert.equal(benchmarkAuditEvent.workspace_slug, "alpha-workspace");
  assert.equal(benchmarkAuditEvent.customer_slug, "customer-alpha");
  assert.equal(benchmarkAuditEvent.target_id, benchmarkResult.report.report_id);

  await assert.rejects(
    () =>
      writeRepositoryProfileForActor({
        serviceStorageRoot,
        surface: "portal",
        authContext,
        profile: {
          profile_slug: "beta-workspace",
          workspace_slug: "beta-workspace",
          repo: path.basename(repoRoot),
          generated_at: new Date().toISOString(),
          overview: {},
          heart: {},
          documents: {},
          cache: {},
          diagrams: [],
        },
        portalRoot,
        adminRoot,
      }),
    /cannot write workspace beta-workspace/i,
  );
});
