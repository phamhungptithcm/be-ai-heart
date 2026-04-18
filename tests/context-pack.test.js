import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { compileContextPack } from "../packages/context-compiler/src/index.js";
import { buildProjectGraph } from "../packages/graph/src/index.js";
import { scanSourceTree } from "../packages/parser-ts/src/index.js";
import { evaluatePolicyViolations } from "../packages/policy-engine/src/index.js";

const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

test("context compiler returns relevant files and reuse candidates", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });
  const policyReport = evaluatePolicyViolations(scanResult);
  const documentIndex = {
    documents: [
      {
        path: "docs/requirements.md",
        category: "requirements",
        title: "Login Audit Requirements",
        headings: ["Requirements", "Audit Events"],
        summary: "Capture login audit visibility and reuse the existing audit path.",
      },
    ],
    totals: {
      document_count: 1,
      category_counts: {
        requirements: 1,
      },
    },
  };
  const pack = compileContextPack({
    task: "improve login audit flow",
    graph,
    documentIndex,
    policyReport,
  });

  assert.equal(pack.task, "improve login audit flow");
  assert.ok(pack.relevant_files.length >= 1);
  assert.ok(pack.relevant_symbols.some((symbol) => symbol.name === "loginUser"));
  assert.ok(pack.relevant_symbols.some((symbol) => symbol.name === "buildAuditMessage"));
  assert.equal(pack.relevant_documents[0].path, "docs/requirements.md");
  assert.ok(pack.reuse_candidates.some((candidate) => candidate.name === "recordLoginAudit"));
});
