import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { buildWorkspaceState } from "../packages/core/src/index.js";
import {
  generateDiagramBundle,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../packages/diagram-generator/src/index.js";
import { compareBenchmarkRuns, publishBenchmarkReport } from "../packages/benchmark/src/index.js";
import { writeWebDocumentSubmission } from "../packages/document-sync/src/index.js";
import { loadAccessRegistry, resolveServiceDatabasePath } from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("service storage persists canonical project memory and auth records in sqlite", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const serviceStorageRoot = path.join(workspaceRoot, "services", "api", "data");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
  ]);

  const workspaceState = await buildWorkspaceState(repoRoot, {
    forceRescan: true,
  });
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
    slug: "sample-repo",
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  });

  await writeWebDocumentSubmission({
    portalRoot,
    adminRoot,
    serviceStorageRoot,
    submission: {
      profile_slug: "sample-repo",
      title: "Business Constraints",
      category: "business",
      summary: "Need lower AI spend without losing architecture safety.",
      body: "Guard against duplicate work and preserve architecture intent.",
    },
  });

  const report = compareBenchmarkRuns(
    {
      tokens: 10000,
      minutes: 42,
      duplicates: 4,
      review_edits: 8,
      memory_refreshes: 6,
      token_cost_usd: 2.1,
    },
    {
      tokens: 6200,
      minutes: 24,
      duplicates: 1,
      review_edits: 3,
      memory_refreshes: 2,
      token_cost_usd: 1.1,
    },
    {
      repo: path.basename(repoRoot),
      profile_slug: "sample-repo",
      scenario: "login-audit-flow",
    },
  );

  await publishBenchmarkReport({
    report,
    repoRoot,
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  });

  await loadAccessRegistry({
    serviceStorageRoot,
    surface: "portal",
  });

  const databasePath = resolveServiceDatabasePath({
    serviceStorageRoot,
  });
  const database = new DatabaseSync(databasePath);

  try {
    const counts = {
      profiles: database.prepare("SELECT COUNT(*) AS count FROM repository_profiles").get().count,
      documents: database.prepare("SELECT COUNT(*) AS count FROM repository_documents").get().count,
      submissions: database.prepare("SELECT COUNT(*) AS count FROM document_submissions").get().count,
      benchmarks: database.prepare("SELECT COUNT(*) AS count FROM benchmark_reports").get().count,
      workspaces: database.prepare("SELECT COUNT(*) AS count FROM workspaces").get().count,
      actors: database.prepare("SELECT COUNT(*) AS count FROM actors").get().count,
    };
    const workspaceRow = database
      .prepare("SELECT payload_json FROM workspaces WHERE workspace_slug = ?")
      .get("sample-repo");

    assert.ok(counts.profiles >= 1);
    assert.ok(counts.documents >= 1);
    assert.ok(counts.submissions >= 1);
    assert.ok(counts.benchmarks >= 1);
    assert.ok(counts.workspaces >= 1);
    assert.ok(counts.actors >= 2);
    assert.ok(workspaceRow);

    const workspace = JSON.parse(workspaceRow.payload_json);
    assert.equal(workspace.workspace_slug, "sample-repo");
    assert.equal(workspace.benchmark_report_count, 1);
    assert.equal(workspace.queued_submission_count, 1);
    assert.ok(workspace.avg_token_savings_pct > 0);
  } finally {
    database.close();
  }
});
