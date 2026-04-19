import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildWorkspaceState } from "../packages/core/src/index.js";
import {
  generateDiagramBundle,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../packages/diagram-generator/src/index.js";
import {
  isPostgresStorageEnabled,
  resolvePostgresStorageConfig,
} from "../services/api/src/postgres-repository.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("Postgres hosted storage requires a direct Postgres connection instead of dual-write outbox", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const serviceStorageRoot = path.join(workspaceRoot, "services", "api", "data");
  const previousBackend = process.env.BE_AI_HEART_SERVICE_STORAGE_BACKEND;
  const previousUrl = process.env.BE_AI_HEART_POSTGRES_URL;

  process.env.BE_AI_HEART_SERVICE_STORAGE_BACKEND = "postgres";
  delete process.env.BE_AI_HEART_POSTGRES_URL;
  t.after(() => {
    if (previousBackend === undefined) {
      delete process.env.BE_AI_HEART_SERVICE_STORAGE_BACKEND;
    } else {
      process.env.BE_AI_HEART_SERVICE_STORAGE_BACKEND = previousBackend;
    }

    if (previousUrl === undefined) {
      delete process.env.BE_AI_HEART_POSTGRES_URL;
    } else {
      process.env.BE_AI_HEART_POSTGRES_URL = previousUrl;
    }
  });

  assert.equal(isPostgresStorageEnabled(), true);
  assert.equal(resolvePostgresStorageConfig().databaseUrl, "");

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
    slug: "postgres-hosted-repo",
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  }).then(
    () => {
      throw new Error("Expected hosted Postgres sync to fail without BE_AI_HEART_POSTGRES_URL.");
    },
    (error) => {
      assert.match(error.message, /BE_AI_HEART_POSTGRES_URL is required/i);
    },
  );
});
