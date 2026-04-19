import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { compareBenchmarkRuns, publishBenchmarkReport } from "../packages/benchmark/src/index.js";
import { buildWorkspaceState } from "../packages/core/src/index.js";
import {
  generateDiagramBundle,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../packages/diagram-generator/src/index.js";
import { loadAccessRegistry } from "../services/api/src/index.js";
import { writeCanonicalSnapshot } from "../services/api/src/migration.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("service migration snapshot exports sqlite canonical tables and postgres plan", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const serviceStorageRoot = path.join(workspaceRoot, "services", "api", "data");
  const outputPath = path.join(workspaceRoot, ".heart", "service-export.json");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
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
    slug: "migration-workspace",
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  });
  await publishBenchmarkReport({
    report: compareBenchmarkRuns(
      {
        tokens: 6400,
        minutes: 38,
        duplicates: 4,
        review_edits: 9,
        memory_refreshes: 5,
        token_cost_usd: 1.44,
      },
      {
        tokens: 3900,
        minutes: 20,
        duplicates: 1,
        review_edits: 3,
        memory_refreshes: 2,
        token_cost_usd: 0.88,
      },
      {
        repo: path.basename(repoRoot),
        profile_slug: "migration-workspace",
        scenario: "postgres-migration-check",
      },
    ),
    repoRoot,
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  });
  await loadAccessRegistry({ serviceStorageRoot });

  const exported = await writeCanonicalSnapshot({
    serviceStorageRoot,
    outputPath,
  });
  const raw = JSON.parse(await fs.readFile(outputPath, "utf8"));

  assert.equal(exported.output_path, outputPath);
  assert.equal(raw.source.driver, "sqlite");
  assert.ok(raw.tables.repository_profiles.length >= 1);
  assert.ok(raw.tables.workspace_identities.length >= 1);
  assert.ok(raw.tables.sessions.length >= 2);
  assert.equal(raw.postgres_migration.target_driver, "postgres");
  assert.ok(raw.postgres_migration.rollout_stages.length >= 3);
});
