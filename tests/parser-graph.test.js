import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildProjectGraph, searchSymbols } from "../packages/graph/src/index.js";
import { scanSourceTree } from "../packages/parser-ts/src/index.js";

const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

test("parser scans source files and extracts symbols", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);

  assert.equal(scanResult.totals.file_count, 3);
  assert.equal(scanResult.totals.import_count, 1);
  assert.equal(scanResult.parser_engine, "typescript-ast");

  const symbolNames = scanResult.files.flatMap((file) => file.symbols.map((symbol) => symbol.name));
  assert.deepEqual(symbolNames.sort(), [
    "SessionRecord",
    "buildAuditMessage",
    "createSessionToken",
    "loginUser",
    "normalizeUsername",
    "recordLoginAudit",
  ]);
});

test("graph builder creates searchable symbol graph", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });
  const matches = searchSymbols(graph, "login");

  assert.equal(graph.summary.node_types.Repository, 1);
  assert.ok(graph.summary.node_types.File >= 3);
  assert.ok(graph.summary.node_types.Symbol >= 6);
  assert.equal(matches[0].name, "loginUser");
});
