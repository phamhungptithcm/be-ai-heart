import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildProjectGraph } from "../packages/graph/src/index.js";
import { createToolRegistry, handleToolCall } from "../packages/mcp-server/src/index.js";
import { buildHeartModel } from "../packages/entity-linker/src/index.js";
import { scanDocumentTree } from "../packages/document-ingest/src/index.js";
import { scanSourceTree } from "../packages/parser-ts/src/index.js";
import { evaluatePolicyViolations } from "../packages/policy-engine/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";
import { writeTypedGraphFixture } from "./helpers/typed-graph-fixture.js";

const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

test("MCP tool registry exposes expected tools", () => {
  const registry = createToolRegistry();
  const toolNames = registry.map((tool) => tool.name);

  assert.deepEqual(toolNames, [
    "project_overview",
    "symbol_lookup",
    "dependency_explain",
    "context_pack",
    "impact_analysis",
    "document_search",
    "policy_check",
  ]);
});

test("MCP tool registry respects enabled tool allowlists", () => {
  const registry = createToolRegistry({
    enabledTools: [
      "project_overview",
      "document_search",
    ],
  });
  const toolNames = registry.map((tool) => tool.name);

  assert.deepEqual(toolNames, [
    "project_overview",
    "document_search",
  ]);
});

test("MCP context pack tool returns focused output", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);
  const documentIndex = await scanDocumentTree(fixtureRoot, {
    roots: ["docs"],
  });
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });
  const heartModel = buildHeartModel({
    scanResult,
    documentIndex,
  });
  const policyReport = evaluatePolicyViolations(scanResult);

  const result = handleToolCall({
    name: "context_pack",
    args: { task: "improve login audit flow" },
    graph,
    documentIndex,
    heartModel,
    scanResult,
    policyReport,
  });

  assert.equal(result.task, "improve login audit flow");
  assert.equal(result.relevant_documents[0].path, "docs/requirements.md");
  assert.equal(result.linked_context.modules[0].module, "auth");
  assert.ok(result.quality.relevance_score > 0.5);
  assert.ok(result.reuse_candidates.length >= 1);
});

test("MCP dependency explain tool returns typed dependency evidence", async (t) => {
  const fixtureRepo = await createTempRepoCopy(t);
  await writeTypedGraphFixture(fixtureRepo);
  const scanResult = await scanSourceTree(fixtureRepo);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });

  const result = handleToolCall({
    name: "dependency_explain",
    args: { target: "AuthService" },
    graph,
    scanResult,
  });

  assert.equal(result.resolved_file, "src/auth/service.ts");
  assert.ok(result.outgoing_imports.includes("src/auth/base.ts"));
  assert.ok(result.outgoing_calls.includes("loginUser"));
  assert.ok(result.extends.includes("BaseAuthService"));
  assert.ok(result.implements.includes("AuthWorkflow"));
});

test("MCP tool calls reject disabled tools", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });

  assert.throws(
    () =>
      handleToolCall({
        name: "policy_check",
        graph,
        scanResult,
        enabledTools: ["project_overview"],
      }),
    /not enabled/i,
  );
});
