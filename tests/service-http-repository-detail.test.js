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
import { buildRepositoryServicesView } from "../services/api/src/repository-services.js";
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

  assert.equal(focusedPayload.repository_services.summary.service_count, 7);
  assert.deepEqual(
    focusedPayload.repository_services.tabs.map((tab) => tab.key),
    [
      "code_graph",
      "diagrams",
      "document_memory",
      "context_pack_preview",
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
  assert.equal(
    focusedPayload.repository_services.context_pack_preview.preview.task,
    "add SSO login audit logging",
  );
  assert.ok(focusedPayload.repository_services.context_pack_preview.model_presets.length >= 3);
  assert.ok(
    focusedPayload.repository_services.context_pack_preview.command_examples.includes('/pack "add SSO login audit logging"'),
  );
  assert.ok(
    focusedPayload.repository_services.context_pack_preview.preview.files.length > 0 ||
      focusedPayload.repository_services.context_pack_preview.preview.documents.length > 0,
  );
  assert.equal(
    focusedPayload.repository_services.benchmark_roi.trend_digest.summary.report_count,
    0,
  );
  assert.equal(
    focusedPayload.repository_services.benchmark_roi.trend_digest.summary.evidence_quality_label,
    "missing",
  );
  assert.doesNotMatch(
    JSON.stringify(focusedPayload.repository_services.context_pack_preview.preview),
    new RegExp(repoRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );

  const syncResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/repositories/alpha-workspace/sync", {
      headers,
    }),
    config,
  );
  const graphResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/repositories/alpha-workspace/graph/summary", {
      headers,
    }),
    config,
  );
  const diagramsResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/repositories/alpha-workspace/diagrams", {
      headers,
    }),
    config,
  );
  const contextPackCreateResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/repositories/alpha-workspace/context-packs", {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        task: "add login audit logging",
        token_budget: 1600,
      }),
    }),
    config,
  );
  const contextPacksResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/repositories/alpha-workspace/context-packs", {
      headers,
    }),
    config,
  );
  const chatResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/chat/commands", {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspace_slug: "alpha-workspace",
        repo_slug: "alpha-workspace",
        input: "show graph for auth module",
        mode: "code_context",
      }),
    }),
    config,
  );
  const modelsResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/models", {
      headers,
    }),
    config,
  );

  assert.equal(syncResponse.status, 200);
  assert.equal(graphResponse.status, 200);
  assert.equal(diagramsResponse.status, 200);
  assert.equal(contextPackCreateResponse.status, 201);
  assert.equal(contextPacksResponse.status, 200);
  assert.equal(chatResponse.status, 201);
  assert.equal(modelsResponse.status, 200);

  const syncPayload = await syncResponse.json();
  const graphPayload = await graphResponse.json();
  const diagramsPayload = await diagramsResponse.json();
  const createdPack = await contextPackCreateResponse.json();
  const contextPacksPayload = await contextPacksResponse.json();
  const chatPayload = await chatResponse.json();
  const modelsPayload = await modelsResponse.json();

  assert.equal(syncPayload.profile_slug, "alpha-workspace");
  assert.equal(syncPayload.scan_status.state, "synced");
  assert.ok(syncPayload.artifacts.some((artifact) => artifact.key === "profile"));
  assert.ok(syncPayload.graph_health.node_count > 0);
  assert.equal(graphPayload.state, "ready");
  assert.ok(graphPayload.node_count > 0);
  assert.equal(diagramsPayload.state, "ready");
  assert.ok(diagramsPayload.diagrams.length > 0);
  assert.ok(diagramsPayload.diagrams.some((diagram) => diagram.mermaid.includes("flowchart LR") || diagram.mermaid.includes("sequenceDiagram")));
  assert.equal(createdPack.task, "add login audit logging");
  assert.equal(createdPack.token_budget, 1600);
  assert.ok(contextPacksPayload.packs.some((pack) => pack.pack_id === createdPack.pack_id));
  assert.equal(chatPayload.intent, "show_graph");
  assert.equal(chatPayload.status, "completed");
  assert.ok(chatPayload.citations.some((citation) => citation.type === "graph_artifact"));
  assert.ok(Array.isArray(modelsPayload.providers));
  assert.ok(modelsPayload.security);
  assert.equal(modelsPayload.security.secrets_exposed, false);

  const chatDetailResponse = await handleServiceHttpRequest(
    new Request(`http://127.0.0.1:4010/api/chat/commands/${chatPayload.command_id}`, {
      headers,
    }),
    config,
  );
  assert.equal(chatDetailResponse.status, 200);
  assert.equal((await chatDetailResponse.json()).command_id, chatPayload.command_id);

  const rejectedSecretResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/model-settings", {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providers: {
          openai_compatible: {
            api_key: "do-not-store",
          },
        },
      }),
    }),
    config,
  );
  assert.equal(rejectedSecretResponse.status, 400);
});

test("repository services derive a low-confidence graph from synced diagram artifacts when code graph is missing", () => {
  const services = buildRepositoryServicesView({
    profile: {
      profile_slug: "diagram-only",
      repo: "diagram-only",
      overview: { policy_warnings: 0 },
      heart: { relationship_count: 2 },
      cache: { status: "hit" },
      documents: { document_count: 0 },
      diagrams: [
        {
          type: "symbol-graph",
          title: "Symbol Graph",
          content: [
            "flowchart LR",
            "  repo[\"Repo: diagram-only\"]",
            "  file_src_index_ts[\"File: src/index.ts\"]",
            "  sym_function_boot[\"function: boot\"]",
            "  repo --> file_src_index_ts",
            "  file_src_index_ts --> sym_function_boot",
          ].join("\n"),
        },
      ],
    },
    documents: { totals: { document_count: 0 }, documents: [] },
    benchmarkHistory: { reports: [] },
    codeGraph: {
      requested_mode: "focused",
      available_modes: ["focused", "full"],
      view: null,
    },
  });

  assert.equal(services.code_graph.state, "ready");
  assert.equal(services.code_graph.view.is_diagram_derived, true);
  assert.equal(services.code_graph.view.confidence_label, "low");
  assert.equal(services.code_graph.view.node_count, 3);
  assert.equal(services.code_graph.view.edge_count, 2);
});
