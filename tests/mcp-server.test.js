import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildProjectGraph } from "../packages/graph/src/index.js";
import { createToolRegistry, handleToolCall } from "../packages/mcp-server/src/index.js";
import { scanSourceTree } from "../packages/parser-ts/src/index.js";
import { evaluatePolicyViolations } from "../packages/policy-engine/src/index.js";

const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

test("MCP tool registry exposes expected tools", () => {
  const registry = createToolRegistry();
  const toolNames = registry.map((tool) => tool.name);

  assert.deepEqual(toolNames, [
    "project_overview",
    "symbol_lookup",
    "context_pack",
    "impact_analysis",
    "document_search",
    "policy_check",
  ]);
});

test("MCP context pack tool returns focused output", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });
  const policyReport = evaluatePolicyViolations(scanResult);
  const documentIndex = {
    documents: [
      {
        path: "docs/system-design.md",
        category: "technical",
        title: "System Design",
        headings: ["Auth Flow"],
        summary: "The audit path should remain in the session module.",
      },
    ],
    totals: {
      document_count: 1,
      category_counts: {
        technical: 1,
      },
    },
  };

  const result = handleToolCall({
    name: "context_pack",
    args: { task: "improve login audit flow" },
    graph,
    documentIndex,
    scanResult,
    policyReport,
  });

  assert.equal(result.task, "improve login audit flow");
  assert.equal(result.relevant_documents[0].path, "docs/system-design.md");
  assert.ok(result.reuse_candidates.length >= 1);
});
