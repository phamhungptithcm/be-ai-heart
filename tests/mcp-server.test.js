import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
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
    "domain_pack_list",
    "domain_pack_get",
    "domain_pack_layers",
    "domain_pack_build_options",
    "domain_pack_generate",
    "domain_pack_validate",
    "domain_pack_conflicts",
    "domain_pack_context",
    "domain_pack_benchmark_scenarios",
    "stack_preset_list",
    "domain_project_plan",
    "domain_project_generate",
    "impact_analysis",
    "document_search",
    "docs_search",
    "policy_check",
    "benchmark_summary",
  ]);
  assert.equal(registry[3].inputSchema.properties.token_budget.type, "integer");
  assert.equal(registry[8].inputSchema.properties.output.enum.includes("sales-demo-kit"), true);
});

test("MCP tool registry respects enabled tool allowlist", () => {
  const registry = createToolRegistry({
    enabledTools: ["project_overview", "document_search"],
  });

  assert.deepEqual(
    registry.map((tool) => tool.name),
    ["project_overview", "document_search", "docs_search"],
  );
});

test("MCP domain pack tools expose compact tolling contracts", async (t) => {
  const fixtureRepo = await createTempRepoCopy(t);
  const scanResult = await scanSourceTree(fixtureRepo);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });

  const list = await handleToolCall({
    name: "domain_pack_list",
    graph,
    scanResult,
    repoRoot: fixtureRepo,
  });
  assert.ok(list.packs.some((pack) => pack.pack_id === "tolling-management"));

  const generated = await handleToolCall({
    name: "domain_pack_generate",
    args: {
      pack_id: "tolling-management",
      output: "sales-demo-kit",
      regional_layer: "texas",
      agency_overlay: "hctra-example",
      token_budget: 4000,
    },
    graph,
    scanResult,
    repoRoot: fixtureRepo,
  });
  assert.equal(generated.status, "generated");
  assert.equal(generated.manifest.output_type, "sales-demo-kit");
  assert.ok(generated.manifest.source_citations.length >= 1);
  assert.ok(generated.security_warnings.some((warning) => /No real PII/i.test(warning)));
  assert.equal(generated.generated_files.every((file) => !file.includes(process.env.HOME ?? "___")), true);

  const context = await handleToolCall({
    name: "domain_pack_context",
    args: {
      pack_id: "tolling-management",
      regional_layer: "texas",
      agency_overlay: "hctra-example",
      token_budget: 1200,
    },
    graph,
    scanResult,
    repoRoot: fixtureRepo,
  });
  assert.equal(context.pack_id, "tolling-management");
  assert.ok(context.context_items.every((item) => item.layer));
  assert.ok(context.citations.length >= 1);
});

test("MCP benchmark summary reports local ROI evidence without paths", async (t) => {
  const fixtureRepo = await createTempRepoCopy(t);
  const benchmarkRoot = path.join(fixtureRepo, ".heart", "benchmarks");

  await fs.mkdir(benchmarkRoot, { recursive: true });
  await fs.writeFile(
    path.join(benchmarkRoot, "login-audit-report.json"),
    `${JSON.stringify(
      {
        report_id: "login-audit-report",
        scenario: "login-audit-flow",
        provider: "openai",
        model: "gpt-5.4",
        generated_at: "2026-05-03T00:00:00.000Z",
        metrics: {
          token_savings_pct: 40,
          time_savings_pct: 20,
          composite_roi_score: 55,
        },
        evidence_bundle: {
          available: true,
          bundle_id: "login-audit-report",
          artifact_list: [{ role: "baseline" }, { role: "assisted" }],
          provenance_summary: {
            measurement_mode: "estimated",
            confidence_label: "low",
            observed_coverage_pct: 0,
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const scanResult = await scanSourceTree(fixtureRepo);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });
  const result = handleToolCall({
    name: "benchmark_summary",
    graph,
    scanResult,
    repoRoot: fixtureRepo,
  });

  assert.equal(result.status, "ready");
  assert.equal(result.report_count, 1);
  assert.equal(result.latest_report.report_id, "login-audit-report");
  assert.equal(result.latest_report.measurement_mode, "estimated");
  assert.equal(result.aggregate_metrics.avg_token_savings_pct, 40);
  assert.equal(result.latest_report.path, undefined);
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
    args: { task: "improve login audit flow", token_budget: 1400 },
    graph,
    documentIndex,
    heartModel,
    scanResult,
    policyReport,
  });

  assert.equal(result.task, "improve login audit flow");
  assert.equal(result.token_budget, 1400);
  assert.ok(result.estimated_tokens <= 1400);
  assert.equal(result.relevant_documents[0].path, "docs/requirements.md");
  assert.equal(result.linked_context.modules[0].module, "auth");
  assert.ok(result.quality.relevance_score > 0.5);
  assert.ok(result.reuse_candidates.length >= 1);
  assert.ok(result.citations.length >= 1);
  assert.equal(result.evidence_summary.citation_count, result.citations.length);
  assert.deepEqual(
    result.citations.map((citation) => citation.evidence_rank),
    result.citations.map((_, index) => index + 1),
  );
  assert.equal(result.agent_contract.should_scan_repo_wide, false);
  assert.ok(result.agent_contract.primary_evidence_order.includes("call_paths"));
  assert.ok(result.agent_contract.followup_tools.includes("dependency_explain"));
});

test("MCP project overview exposes typed graph readiness and workflow hints", async (t) => {
  const fixtureRepo = await createTempRepoCopy(t);
  await writeTypedGraphFixture(fixtureRepo);
  const scanResult = await scanSourceTree(fixtureRepo);
  const documentIndex = await scanDocumentTree(fixtureRepo, {
    roots: ["docs"],
  });
  const graph = buildProjectGraph(scanResult, {
    repoName: "sample-repo",
    documentIndex,
    policyReport: evaluatePolicyViolations(scanResult),
  });
  const heartModel = buildHeartModel({
    scanResult,
    documentIndex,
  });
  const policyReport = evaluatePolicyViolations(scanResult);

  const result = handleToolCall({
    name: "project_overview",
    graph,
    documentIndex,
    heartModel,
    scanResult,
    policyReport,
  });

  assert.equal(result.memory_profile.typed_graph_ready, true);
  assert.ok(result.memory_profile.edge_counts.CALLS >= 1);
  assert.ok(result.memory_profile.edge_counts.TESTED_BY >= 1);
  assert.equal(result.agent_workflow.start_with, "project_overview");
  assert.ok(result.agent_workflow.next_tools.includes("context_pack"));
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
  assert.ok(result.evidence.some((entry) => entry.type === "IMPORTS"));
  assert.ok(result.evidence.some((entry) => entry.type === "CALLS"));
  assert.ok(Array.isArray(result.policy_violations));
  assert.ok(Array.isArray(result.document_constraints));
});

test("MCP workflow hints and agent contracts honor the effective tool allowlist and fail safe on thin packs", async (t) => {
  const fixtureRepo = await createTempRepoCopy(t);

  await Promise.all([
    fs.mkdir(path.join(fixtureRepo, "packages", "benchmark", "src"), { recursive: true }),
    fs.mkdir(path.join(fixtureRepo, "apps", "admin", "components"), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(
      path.join(fixtureRepo, "packages", "benchmark", "src", "index.js"),
      [
        "export function publishBenchmarkReport(run) {",
        "  return run;",
        "}",
        "",
      ].join("\n"),
      "utf8",
    ),
    fs.writeFile(
      path.join(fixtureRepo, "apps", "admin", "components", "AdminBenchmarkHistoryClient.jsx"),
      [
        "export function AdminBenchmarkHistoryClient() {",
        '  return "benchmark reporting visibility history for follow-up runs";',
        "}",
        "",
      ].join("\n"),
      "utf8",
    ),
  ]);

  const scanResult = await scanSourceTree(fixtureRepo);
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });
  const policyReport = evaluatePolicyViolations(scanResult);
  const enabledTools = ["project_overview", "context_pack", "document_search", "policy_check"];

  const overview = handleToolCall({
    name: "project_overview",
    graph,
    documentIndex: { documents: [], totals: { document_count: 0 } },
    heartModel: { domains: [], links: [], summary: { relationship_count: 0 } },
    scanResult,
    policyReport,
    enabledTools,
  });
  assert.deepEqual(overview.agent_workflow.next_tools, ["context_pack", "policy_check"]);
  assert.doesNotMatch(overview.agent_workflow.guidance, /dependency_explain/);

  const pack = handleToolCall({
    name: "context_pack",
    args: {
      task: "Add benchmark reporting support for login audit visibility and preserve enough context for the same benchmark run.",
      token_budget: 160,
    },
    graph,
    documentIndex: { documents: [], totals: { document_count: 0 } },
    heartModel: { domains: [], links: [], summary: { relationship_count: 0 } },
    scanResult,
    policyReport,
    enabledTools,
  });

  assert.equal(pack.truncated, true);
  assert.equal(pack.agent_contract.should_scan_repo_wide, true);
  assert.equal(pack.agent_contract.followup_tools.includes("dependency_explain"), false);
});

test("MCP document search prefers latest lineage version and redacts restricted summaries", async (t) => {
  const fixtureRepo = await createTempRepoCopy(t);
  const docsRoot = path.join(fixtureRepo, "docs", "governed");

  await fs.mkdir(docsRoot, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(docsRoot, "auth-prd-v1.md"),
      "# Auth PRD\n\nVersion 1 approval flow.\n",
      "utf8",
    ),
    fs.writeFile(
      path.join(docsRoot, "auth-prd-v2.md"),
      "# Auth PRD\n\nVersion 2 approval flow with login audit evidence.\n",
      "utf8",
    ),
    fs.writeFile(
      path.join(docsRoot, "auth-secret.md"),
      "# Auth Secret\n\nToken: sk_test_secret_value\n",
      "utf8",
    ),
  ]);
  const olderTime = new Date("2026-04-18T00:00:00.000Z");
  const newerTime = new Date("2026-04-19T00:00:00.000Z");
  await Promise.all([
    fs.utimes(path.join(docsRoot, "auth-prd-v1.md"), olderTime, olderTime),
    fs.utimes(path.join(docsRoot, "auth-prd-v2.md"), newerTime, newerTime),
  ]);

  const documentIndex = await scanDocumentTree(fixtureRepo, {
    roots: ["docs"],
  });
  const result = handleToolCall({
    name: "document_search",
    args: { query: "auth approval audit secret" },
    graph: { scanResult: { files: [] }, nodes: [], edges: [] },
    documentIndex,
  });
  const aliasResult = handleToolCall({
    name: "docs_search",
    args: { query: "auth approval audit secret" },
    graph: { scanResult: { files: [] }, nodes: [], edges: [] },
    documentIndex,
    enabledTools: ["document_search"],
  });

  assert.equal(result.matches.some((document) => document.path.endsWith("auth-prd-v2.md")), true);
  assert.deepEqual(aliasResult.matches, result.matches);
  assert.equal(result.matches.some((document) => document.path.endsWith("auth-prd-v1.md")), false);
  const secretMatch = result.matches.find((document) => document.path.endsWith("auth-secret.md"));
  assert.ok(secretMatch);
  assert.equal(secretMatch.summary_redacted, true);
  assert.equal(secretMatch.sensitivity.level, "restricted");
  assert.ok(typeof result.matches[0].semantic_score === "number");
  assert.ok(result.matches[0].extraction);
});
