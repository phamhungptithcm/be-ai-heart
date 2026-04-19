import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildWorkspaceState } from "../packages/core/src/index.js";
import {
  generateDiagramBundle,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../packages/diagram-generator/src/index.js";
import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import {
  issueWorkspaceSession,
  replaceActorMemberships,
  upsertActor,
} from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("repository detail route exposes service tabs and honors focused/full graph mode", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });

  const workspaceState = await buildWorkspaceState(repoRoot);
  const bundle = generateDiagramBundle({
    workspaceState,
    task: "publish repository services",
  });
  const artifacts = await writeDiagramBundle(repoRoot, bundle);

  await syncRepositoryProfile({
    repoRoot,
    workspaceState,
    bundle,
    artifacts,
    slug: "alpha-workspace",
    portalRoot: config.portalRoot,
    adminRoot: config.adminRoot,
    serviceStorageRoot: config.serviceStorageRoot,
  });

  await upsertActor({
    serviceStorageRoot: config.serviceStorageRoot,
    actor: {
      actor_slug: "alpha-org-admin",
      surface: "portal",
      role: "org_admin",
      roles: ["org_admin"],
      access_mode: "memberships",
      customer_slug: "alpha-workspace",
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
    customerSlug: "alpha-workspace",
    sessionToken: "portal-repository-detail-session",
  });

  const headers = {
    "x-be-ai-heart-session": session.session_token,
  };
  const focusedResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/repositories/alpha-workspace?graph_mode=focused", {
      headers,
    }),
    config,
  );
  const fullResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/repositories/alpha-workspace?graph_mode=full", {
      headers,
    }),
    config,
  );

  assert.equal(focusedResponse.status, 200);
  assert.equal(fullResponse.status, 200);

  const focusedPayload = await focusedResponse.json();
  const fullPayload = await fullResponse.json();

  assert.equal(focusedPayload.repository_services.summary.service_count, 6);
  assert.deepEqual(
    focusedPayload.repository_services.tabs.map((tab) => tab.key),
    [
      "code_graph",
      "diagrams",
      "document_memory",
      "policy_rails",
      "benchmark_roi",
      "runtime_signals",
    ],
  );
  assert.equal(focusedPayload.code_graph.view.mode, "focused");
  assert.equal(fullPayload.code_graph.view.mode, "full");
  assert.equal(
    focusedPayload.repository_services.code_graph.view.mode,
    "focused",
  );
  assert.equal(
    fullPayload.repository_services.code_graph.view.mode,
    "full",
  );
  assert.ok(
    fullPayload.repository_services.code_graph.view.node_count >=
      focusedPayload.repository_services.code_graph.view.node_count,
  );
  assert.ok(Array.isArray(focusedPayload.repository_services.diagrams.items));
  assert.ok(Array.isArray(focusedPayload.repository_services.document_memory.items));
});
