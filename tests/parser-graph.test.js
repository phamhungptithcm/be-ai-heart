import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildProjectGraph,
  createCodeGraphView,
  createDependencyExplanation,
  createImpactAnalysis,
  diffProjectGraphSnapshots,
  hydrateProjectGraph,
  searchSymbols,
  snapshotProjectGraph,
} from "../packages/graph/src/index.js";
import {
  EDGE_TYPES,
  GRAPH_SNAPSHOT_SCHEMA_VERSION,
  NODE_TYPES,
  createGraphEdge,
  createGraphNode,
} from "../packages/shared-schema/src/index.js";
import { scanSourceTree } from "../packages/parser-ts/src/index.js";
import { buildHeartModel } from "../packages/entity-linker/src/index.js";
import { scanDocumentTree } from "../packages/document-ingest/src/index.js";
import { writeTypedGraphFixture } from "./helpers/typed-graph-fixture.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

test("shared graph schema exposes v2 node and edge contracts", () => {
  assert.equal(GRAPH_SNAPSHOT_SCHEMA_VERSION, 2);
  assert.deepEqual(
    [
      NODE_TYPES.repository,
      NODE_TYPES.package,
      NODE_TYPES.module,
      NODE_TYPES.file,
      NODE_TYPES.class,
      NODE_TYPES.interface,
      NODE_TYPES.function,
      NODE_TYPES.method,
      NODE_TYPES.test,
      NODE_TYPES.document,
      NODE_TYPES.decision,
      NODE_TYPES.policy,
    ],
    [
      "Repository",
      "Package",
      "Module",
      "File",
      "Class",
      "Interface",
      "Function",
      "Method",
      "Test",
      "Document",
      "Decision",
      "Policy",
    ],
  );
  assert.deepEqual(
    [
      EDGE_TYPES.contains,
      EDGE_TYPES.imports,
      EDGE_TYPES.calls,
      EDGE_TYPES.extends,
      EDGE_TYPES.implements,
      EDGE_TYPES.testedBy,
      EDGE_TYPES.documents,
      EDGE_TYPES.constrains,
      EDGE_TYPES.violatesPolicy,
      EDGE_TYPES.impacts,
      EDGE_TYPES.recommendedReuse,
    ],
    [
      "CONTAINS",
      "IMPORTS",
      "CALLS",
      "EXTENDS",
      "IMPLEMENTS",
      "TESTED_BY",
      "DOCUMENTS",
      "CONSTRAINS",
      "VIOLATES_POLICY",
      "IMPACTS",
      "RECOMMENDED_REUSE",
    ],
  );

  const node = createGraphNode({
    id: "file:src/index.ts",
    type: NODE_TYPES.file,
    name: "index.ts",
  });
  const edge = createGraphEdge({
    id: "edge:contains:repo:src/index.ts",
    from: "repo:sample",
    to: "file:src/index.ts",
    type: EDGE_TYPES.contains,
  });

  assert.equal(node.confidence, 1);
  assert.equal(node.source, "extracted");
  assert.equal(edge.confidence, 1);
  assert.equal(edge.provenance, "EXTRACTED");
});

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
  assert.ok(graph.summary.node_types.Function >= 4);
  assert.ok(graph.summary.node_types.Interface >= 1);
  assert.ok(graph.summary.node_types.Symbol >= 1);
  assert.equal(matches[0].name, "loginUser");
});

test("parser ignores generated build and automation artifacts by default", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  await fs.mkdir(path.join(repoRoot, ".next", "server", "app"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "output", "playwright"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, ".playwright-cli"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, ".heart", "cache"), { recursive: true });
  await fs.writeFile(
    path.join(repoRoot, ".next", "server", "app", "page.js"),
    "export function generatedPage() { return null; }\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(repoRoot, "output", "playwright", "report.js"),
    "export const artifact = true;\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(repoRoot, ".playwright-cli", "session.js"),
    "export const cliArtifact = true;\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(repoRoot, ".heart", "cache", "snapshot.js"),
    "export const cacheArtifact = true;\n",
    "utf8",
  );

  const scanResult = await scanSourceTree(repoRoot);
  const relativePaths = scanResult.files.map((file) => file.relativePath);

  assert.equal(scanResult.totals.file_count, 3);
  assert.equal(relativePaths.some((filePath) => filePath.includes(".next")), false);
  assert.equal(relativePaths.some((filePath) => filePath.includes("output/playwright")), false);
  assert.equal(relativePaths.some((filePath) => filePath.includes(".playwright-cli")), false);
  assert.equal(relativePaths.some((filePath) => filePath.includes(".heart/cache")), false);
});

test("parser extracts route metadata for Next app route handlers", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const routeRoot = path.join(repoRoot, "app", "api", "login");
  await fs.mkdir(routeRoot, { recursive: true });
  await fs.writeFile(
    path.join(routeRoot, "route.ts"),
    [
      'import { loginUser } from "../../../src/auth/login";',
      "",
      "export async function GET() {",
      '  return loginUser("route-user");',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  const scanResult = await scanSourceTree(repoRoot);
  const routeFile = scanResult.files.find((file) => file.relativePath === "app/api/login/route.ts");

  assert.ok(routeFile);
  assert.equal(routeFile.routes.length, 1);
  assert.deepEqual(routeFile.routes[0], {
    method: "GET",
    path: "/api/login",
    handler_name: "GET",
    handler_expression: "GET",
    line: 3,
    route_kind: "next-app-router",
    framework: "next-app-router",
    registrar: "",
    confidence: 0.95,
    source: "parser-ts",
    provenance: "EXTRACTED",
  });
  assert.equal(scanResult.totals.route_count >= 1, true);
});

test("parser relation contract includes explicit calls, routes, relations, and evidence", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  await writeTypedGraphFixture(repoRoot);

  const scanResult = await scanSourceTree(repoRoot);
  const serviceFile = scanResult.files.find((file) => file.relativePath === "src/auth/service.ts");
  const serviceClass = serviceFile.symbols.find((symbol) => symbol.name === "AuthService");
  const authenticateCall = serviceFile.calls.find((call) => call.to_name === "loginUser");

  assert.ok(serviceFile);
  assert.ok(serviceFile.import_details.some((detail) => detail.imported_names.includes("loginUser")));
  assert.ok(serviceFile.imports.includes("./login"));
  assert.ok(serviceFile.calls.length >= 1);
  assert.equal(authenticateCall.from_symbol_name, "authenticate");
  assert.equal(authenticateCall.confidence, 0.95);
  assert.equal(authenticateCall.source, "parser-ts");
  assert.equal(authenticateCall.provenance, "EXTRACTED");
  assert.deepEqual(serviceClass.relations.extends, ["BaseAuthService"]);
  assert.deepEqual(serviceClass.relations.implements, ["AuthWorkflow"]);
  assert.ok(Array.isArray(serviceFile.routes));
  assert.ok(Array.isArray(serviceFile.warnings));
});

test("graph builder promotes typed nodes and collaboration edges", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  await writeTypedGraphFixture(repoRoot);

  const scanResult = await scanSourceTree(repoRoot);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));

  assert.ok(graph.summary.node_types.Class >= 2);
  assert.ok(graph.summary.node_types.Interface >= 1);
  assert.ok(graph.summary.node_types.Function >= 3);
  assert.ok(graph.summary.node_types.Method >= 1);
  assert.equal(graph.summary.node_types.Test, 1);
  assert.ok(graph.summary.edge_types.EXTENDS >= 1);
  assert.ok(graph.summary.edge_types.IMPLEMENTS >= 1);
  assert.ok(graph.summary.edge_types.CALLS >= 2);
  assert.ok(graph.summary.edge_types.TESTED_BY >= 1);
  assert.ok(graph.edges.every((edge) => typeof edge.confidence === "number"));
  assert.ok(graph.edges.every((edge) => typeof edge.source === "string"));
  assert.ok(graph.edges.every((edge) => typeof edge.provenance === "string"));
  assert.equal(edgeIds.has("edge:extends:sym:class:src/auth/service.ts:AuthService:4:sym:class:src/auth/base.ts:BaseAuthService:1"), true);
  assert.equal(edgeIds.has("edge:implements:sym:class:src/auth/service.ts:AuthService:4:sym:interface:src/auth/base.ts:AuthWorkflow:3"), true);
  assert.equal(edgeIds.has("edge:calls:sym:method:src/auth/service.ts:authenticate:5:sym:function:src/auth/login.ts:loginUser:3"), true);
  assert.equal(edgeIds.has("edge:tested_by:sym:function:src/auth/login.ts:loginUser:3:test:src/auth/login.test.ts"), true);
});

test("code graph view exposes focused and full visual snapshots without absolute paths", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  await writeTypedGraphFixture(repoRoot);

  const graph = buildProjectGraph(await scanSourceTree(repoRoot), { repoName: "sample-repo" });
  const focused = createCodeGraphView(graph, { mode: "focused", maxNodes: 6 });
  const full = createCodeGraphView(graph, { mode: "full" });

  assert.equal(focused.mode, "focused");
  assert.equal(full.mode, "full");
  assert.equal(typeof focused.is_truncated, "boolean");
  assert.ok(full.node_count >= focused.node_count);
  assert.ok(full.edge_count >= focused.edge_count);
  assert.ok(Object.keys(focused.node_type_counts).includes("file"));
  assert.ok(Object.keys(full.edge_type_counts).includes("imports"));
  assert.ok(focused.nodes.some((node) => node.type_key === "class"));
  assert.ok(focused.edges.some((edge) => edge.type_key === "defines"));
  assert.equal(focused.nodes.some((node) => String(node.path).includes(repoRoot)), false);
  assert.equal(full.nodes.some((node) => String(node.path).includes(repoRoot)), false);
});

test("impact analysis uses call and test relationships for symbol targets", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  await writeTypedGraphFixture(repoRoot);

  const scanResult = await scanSourceTree(repoRoot);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });
  const analysis = createImpactAnalysis(graph, "loginUser");

  assert.equal(analysis.resolved_file, "src/auth/login.ts");
  assert.ok(analysis.resolved_symbol_ids.includes("sym:function:src/auth/login.ts:loginUser:3"));
  assert.ok(analysis.dependent_files.includes("src/auth/service.ts"));
  assert.ok(analysis.dependent_symbols.includes("authenticate"));
  assert.ok(analysis.related_tests.includes("src/auth/login.test.ts"));
  assert.equal(analysis.risk_level, "medium");
  assert.ok(analysis.evidence.some((entry) => entry.type === "CALLS"));
  assert.ok(analysis.evidence.some((entry) => entry.type === "TESTED_BY"));
  assert.ok(Array.isArray(analysis.policy_violations));
  assert.ok(Array.isArray(analysis.document_constraints));
});

test("graph snapshot diff reports typed additions in deterministic order", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const initialGraph = buildProjectGraph(await scanSourceTree(repoRoot), { repoName: "sample-repo" });
  await writeTypedGraphFixture(repoRoot);

  const updatedGraph = buildProjectGraph(await scanSourceTree(repoRoot), { repoName: "sample-repo" });
  const diff = diffProjectGraphSnapshots(snapshotProjectGraph(initialGraph), snapshotProjectGraph(updatedGraph));

  assert.ok(diff.added_nodes.some((node) => node.id === "sym:class:src/auth/base.ts:BaseAuthService:1"));
  assert.ok(diff.added_nodes.some((node) => node.id === "sym:class:src/auth/service.ts:AuthService:4"));
  assert.ok(diff.added_edges.some((edge) => edge.type === "EXTENDS"));
  assert.ok(diff.added_edges.some((edge) => edge.type === "IMPLEMENTS"));
  assert.deepEqual(
    diff.added_nodes.map((node) => node.id),
    [...diff.added_nodes.map((node) => node.id)].sort(),
  );
  assert.deepEqual(
    diff.added_edges.map((edge) => edge.id),
    [...diff.added_edges.map((edge) => edge.id)].sort(),
  );
});

test("graph snapshot v2 preserves schema metadata and redacts local roots", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  await writeTypedGraphFixture(repoRoot);

  const scanResult = await scanSourceTree(repoRoot);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });
  const snapshot = snapshotProjectGraph(graph, {
    root: ".",
    generatedAt: "2026-05-02T00:00:00.000Z",
    scanProvenance: {
      repo_root: repoRoot,
      cache_schema_version: 5,
      config_path: path.join(repoRoot, "heart.config.yaml"),
      config_hash: "config-hash",
      policy_path: path.join(repoRoot, ".heart", "policies.yaml"),
      policy_hash: "policy-hash",
      ignore_paths: [".heart/cache", "dist"],
      document_roots: ["docs"],
    },
  });
  const hydrated = hydrateProjectGraph(snapshot, scanResult);

  assert.equal(snapshot.schema_version, 2);
  assert.equal(snapshot.repo, "sample-repo");
  assert.equal(snapshot.root, ".");
  assert.equal(snapshot.repoName, "sample-repo");
  assert.equal(snapshot.rootDir, ".");
  assert.equal(snapshot.generated_at, "2026-05-02T00:00:00.000Z");
  assert.equal(snapshot.scan_provenance.repo_root, undefined);
  assert.equal(snapshot.scan_provenance.config_path, "heart.config.yaml");
  assert.equal(snapshot.nodes.some((node) => String(node.path).includes(repoRoot)), false);
  assert.equal(snapshot.nodes.every((node) => typeof node.confidence === "number"), true);
  assert.equal(snapshot.nodes.every((node) => typeof node.source === "string"), true);
  assert.equal(snapshot.edges.every((edge) => typeof edge.confidence === "number"), true);
  assert.equal(snapshot.edges.every((edge) => typeof edge.provenance === "string"), true);
  assert.equal(hydrated.schema_version, 2);
  assert.equal(hydrated.repo, "sample-repo");
  assert.equal(hydrated.root, ".");
  assert.deepEqual(hydrated.scanProvenance, snapshot.scan_provenance);
});

test("graph builder includes document and policy nodes when context is provided", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);
  const graph = buildProjectGraph(scanResult, {
    repoName: "sample-repo",
    documentIndex: {
      documents: [
        {
          path: "docs/requirements.md",
          title: "Login Audit Requirements",
          category: "requirements",
        },
      ],
    },
    policyReport: {
      rules: [
        {
          id: "auth-must-use-session-module",
          description: "Auth work must stay anchored to the session module.",
        },
      ],
      violations: [
        {
          rule_id: "auth-must-use-session-module",
          file: "src/auth/login.ts",
        },
      ],
    },
  });

  assert.equal(graph.summary.node_types.Document, 1);
  assert.equal(graph.summary.node_types.Policy, 1);
  assert.ok(graph.edges.some((edge) => edge.type === "VIOLATES_POLICY"));
});

test("dependency explanation returns imports, calls, inheritance, and tests", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  await writeTypedGraphFixture(repoRoot);

  const graph = buildProjectGraph(await scanSourceTree(repoRoot), { repoName: "sample-repo" });
  const explanation = createDependencyExplanation(graph, "AuthService");

  assert.equal(explanation.resolved_file, "src/auth/service.ts");
  assert.ok(explanation.resolved_symbol_ids.includes("sym:class:src/auth/service.ts:AuthService:4"));
  assert.ok(explanation.outgoing_imports.includes("src/auth/base.ts"));
  assert.ok(explanation.outgoing_imports.includes("src/auth/login.ts"));
  assert.ok(explanation.outgoing_calls.includes("loginUser"));
  assert.ok(explanation.extends.includes("BaseAuthService"));
  assert.ok(explanation.implements.includes("AuthWorkflow"));
  assert.equal(explanation.related_tests.length, 0);
  assert.ok(explanation.contained_symbols.includes("authenticate"));
  assert.ok(explanation.evidence.some((entry) => entry.type === "IMPORTS"));
  assert.ok(explanation.evidence.some((entry) => entry.type === "CALLS"));
  assert.ok(Array.isArray(explanation.policy_violations));
  assert.ok(Array.isArray(explanation.document_constraints));
});

test("dependency explanation includes policy violations and empty document constraints when available", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);
  const graph = buildProjectGraph(scanResult, {
    repoName: "sample-repo",
    documentIndex: {
      documents: [
        {
          path: "docs/requirements.md",
          title: "Login Audit Requirements",
          category: "requirements",
        },
      ],
    },
    policyReport: {
      rules: [
        {
          id: "auth-must-use-session-module",
          description: "Auth work must stay anchored to the session module.",
        },
      ],
      violations: [
        {
          rule_id: "auth-must-use-session-module",
          file: "src/auth/login.ts",
          specifier: "./session",
          resolved_path: "src/auth/session.ts",
        },
      ],
    },
  });
  const explanation = createDependencyExplanation(graph, "src/auth/login.ts");

  assert.deepEqual(explanation.policy_violations, [
    {
      rule_id: "auth-must-use-session-module",
      policy: "auth-must-use-session-module",
      file: "src/auth/login.ts",
      specifier: "./session",
      resolved_path: "src/auth/session.ts",
      confidence: 1,
    },
  ]);
  assert.deepEqual(explanation.document_constraints, []);
});

test("graph builder exposes document-to-module and decision constraints from heart model", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);
  const documentIndex = await scanDocumentTree(fixtureRoot, {
    roots: ["docs"],
  });
  const heartModel = buildHeartModel({
    scanResult,
    documentIndex,
  });
  const graph = buildProjectGraph(scanResult, {
    repoName: "sample-repo",
    documentIndex,
    heartModel,
  });
  const sessionExplanation = createDependencyExplanation(graph, "src/auth/session.ts");

  assert.ok(graph.summary.node_types.Module >= 1);
  assert.ok(graph.summary.node_types.Decision >= 1);
  assert.ok(graph.summary.edge_types.DOCUMENTS >= 1);
  assert.ok(graph.summary.edge_types.CONSTRAINS >= 1);
  assert.ok(graph.edges.some((edge) => edge.type === "DOCUMENTS" && edge.from.startsWith("document:")));
  assert.ok(graph.edges.some((edge) => edge.type === "CONSTRAINS" && edge.from.startsWith("decision:")));
  assert.ok(sessionExplanation.document_constraints.some((constraint) => constraint.document === "docs/system-design.md"));
});
