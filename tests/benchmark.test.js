import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  compareBenchmarkRuns,
  loadBenchmarkDataset,
  publishBenchmarkReport,
  runBenchmarkScenario,
  runBenchmarkSuite,
  writeBenchmarkEvidenceBundle,
  writeBenchmarkReport,
  writeBenchmarkSuiteReport,
} from "../packages/benchmark/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("benchmark comparison calculates reductions", () => {
  const report = compareBenchmarkRuns(
    {
      tokens: 1000,
      minutes: 20,
      duplicates: 2,
      policy_violations: 4,
      review_edits: 5,
      memory_refreshes: 6,
    },
    {
      tokens: 650,
      minutes: 15,
      duplicates: 1,
      policy_violations: 1,
      review_edits: 2,
      memory_refreshes: 2,
    },
    {
      repo: "sample-repo",
      profile_slug: "sample-repo",
      scenario: "login-audit-flow",
    },
  );

  assert.equal(report.metrics.token_savings_pct, 35);
  assert.equal(report.metrics.review_edit_reduction_pct, 60);
  assert.equal(report.metrics.policy_violation_reduction_pct, 75);
  assert.equal(report.metrics.memory_refresh_reduction_pct, 67);
  assert.equal(report.profile_slug, "sample-repo");
  assert.ok(report.metrics.context_retention_gain_pct >= 0);
  assert.ok(report.metrics.code_quality_gain_pct >= 0);
  assert.ok(report.baseline.scorecard.context_efficiency.score_pct >= 0);
  assert.match(report.manager_summary, /35% lower token usage/);
  assert.match(report.manager_summary, /fewer context reloads/);
});

test("benchmark comparison summarizes assisted context-pack evidence", () => {
  const report = compareBenchmarkRuns(
    {
      tokens: 1000,
      minutes: 20,
      duplicates: 2,
      policy_violations: 4,
      review_edits: 5,
      memory_refreshes: 6,
    },
    {
      tokens: 650,
      minutes: 15,
      duplicates: 1,
      policy_violations: 1,
      review_edits: 2,
      memory_refreshes: 2,
      context_pack: {
        task: "add login audit visibility",
        token_budget: 1200,
        estimated_tokens: 640,
        truncated: false,
        relevant_files: [{ path: "src/auth/login-audit-visibility.ts" }],
        relevant_symbols: [{ id: "sym:function:src/auth/login.ts:loginUser", name: "loginUser", file: "src/auth/login.ts" }],
        relevant_documents: [{ path: "docs/login-audit-visibility.md", title: "Login Audit Visibility Requirements" }],
        call_paths: [
          {
            from: "AuthService",
            to: "loginUser",
            from_file: "src/auth/service.ts",
            to_file: "src/auth/login.ts",
          },
        ],
        tests_to_run: ["src/auth/login.test.ts"],
        citations: [
          {
            type: "graph",
            relation: "CALLS",
            from: "AuthService",
            to: "loginUser",
            reason: "Typed call graph evidence near ranked symbols.",
          },
          {
            type: "document",
            path: "docs/requirements.md",
            title: "Requirements",
            reason: "Matched task terms in project documents.",
          },
          {
            type: "policy",
            rule_id: "auth-boundary",
            path: "src/auth/service.ts",
            reason: "Existing policy evidence affects architecture confidence.",
          },
        ],
        quality: {
          relevance_score: 0.8,
          reuse_confidence: 0.6,
          architecture_confidence: 0.9,
          missing_context_warnings: [],
        },
        confidence: {
          overall: 0.77,
        },
        missing_context_warnings: [],
      },
    },
    {
      repo: "sample-repo",
      profile_slug: "sample-repo",
      scenario: "login-audit-flow",
    },
  );

  assert.equal(report.evidence.assisted.context_pack.available, true);
  assert.equal(report.evidence.assisted.context_pack.citation_count, 3);
  assert.equal(report.evidence.assisted.context_pack.graph_citation_count, 1);
  assert.equal(report.evidence.assisted.context_pack.document_citation_count, 1);
  assert.ok(report.metrics.context_pack_quality_score > 0.4);
  assert.ok(report.metrics.context_pack_task_coverage_pct >= 50);
});

test("benchmark report writes locally and publishes sanitized web artifacts", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
  ]);

  const report = compareBenchmarkRuns(
    {
      tokens: 1800,
      minutes: 32,
      duplicates: 3,
      policy_violations: 2,
      review_edits: 7,
      memory_refreshes: 5,
      token_cost_usd: 0.32,
    },
    {
      tokens: 900,
      minutes: 19,
      duplicates: 1,
      policy_violations: 0,
      review_edits: 3,
      memory_refreshes: 1,
      token_cost_usd: 0.16,
    },
    {
      repo: "sample-repo",
      profile_slug: "sample-repo",
      scenario: "cross-module-change",
      report_id: "sample-benchmark-report",
    },
  );

  const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, report, {
    baselineInput: {
      prompt: "Explore login audit flow without heart",
      output_artifacts: [{ type: "patch", path: "patches/baseline.diff" }],
    },
    assistedInput: {
      prompt: "Use heart context pack for login audit flow",
      context_pack: {
        task: "cross-module-change",
        estimated_tokens: 480,
        truncated: false,
        citations: [{ type: "document", path: "docs/requirements.md", reason: "Matched task terms." }],
      },
      tool_outputs: [{ tool: "context_pack", status: "ok" }],
      output_artifacts: [{ type: "patch", path: "patches/assisted.diff" }],
    },
    scenario: {
      id: "cross-module-change",
      title: "Cross Module Change",
      category: "architecture-constrained-change",
    },
    dataset: {
      id: "cross-module-boundaries",
      title: "Cross Module Boundaries",
      repo_strategy: "current-repo",
    },
  });
  const persisted = await writeBenchmarkReport(repoRoot, {
    ...report,
    evidence_bundle: evidenceBundle,
  });
  const destinations = await publishBenchmarkReport({
    report: {
      ...report,
      evidence_bundle: evidenceBundle,
    },
    repoRoot,
    portalRoot,
    adminRoot,
  });

  assert.ok(persisted.report_path.endsWith("sample-benchmark-report.json"));
  assert.ok(persisted.markdown_path.endsWith("sample-benchmark-report.md"));
  assert.equal(destinations.length, 2);

  const portalIndex = JSON.parse(await fs.readFile(path.join(portalRoot, "public", "benchmarks", "index.json"), "utf8"));
  const portalReport = JSON.parse(
    await fs.readFile(path.join(portalRoot, "public", "benchmarks", "reports", "sample-benchmark-report.json"), "utf8"),
  );
  const serviceReport = JSON.parse(
    await fs.readFile(
      path.join(workspaceRoot, "services", "api", "data", "benchmarks", "reports", "sample-benchmark-report.json"),
      "utf8",
    ),
  );
  const repoHistory = JSON.parse(
    await fs.readFile(path.join(portalRoot, "public", "benchmarks", "repositories", "sample-repo.json"), "utf8"),
  );
  const serviceIndex = JSON.parse(
    await fs.readFile(path.join(workspaceRoot, "services", "api", "data", "benchmarks", "index.json"), "utf8"),
  );
  const workspaceIndex = JSON.parse(
    await fs.readFile(path.join(workspaceRoot, "services", "api", "data", "workspaces", "index.json"), "utf8"),
  );
  const portalWorkspaceIndex = JSON.parse(
    await fs.readFile(path.join(portalRoot, "public", "workspaces", "index.json"), "utf8"),
  );

  assert.equal(portalIndex.reports.length, 1);
  assert.equal(portalIndex.reports[0].report_id, "sample-benchmark-report");
  assert.equal(portalReport.profile_slug, "sample-repo");
  assert.equal(serviceReport.profile_slug, "sample-repo");
  assert.equal(portalReport.repo_root, undefined);
  assert.equal(portalReport.evidence_bundle.available, true);
  assert.equal(portalReport.evidence_bundle.bundle_id, "sample-benchmark-report");
  assert.equal(portalReport.evidence_bundle.local_manifest_path, undefined);
  assert.equal(portalReport.framework.scenario.id, "");
  assert.equal(portalReport.evidence_manifest.bundle_id, "sample-benchmark-report");
  assert.equal(portalReport.evidence_manifest.bundle_file_count, 5);
  assert.equal(portalReport.evidence_manifest.assisted.context_pack.top_citations[0].path, undefined);
  assert.equal(portalReport.evidence.assisted.context_pack.available, false);
  assert.equal(repoHistory.reports.length, 1);
  assert.equal(repoHistory.reports[0].metrics.token_savings_pct, 50);
  assert.equal(repoHistory.reports[0].metrics.memory_refresh_reduction_pct, 80);
  assert.equal(serviceIndex.reports.length, 1);
  assert.equal(workspaceIndex.workspaces.length, 1);
  assert.equal(workspaceIndex.workspaces[0].benchmark_report_count, 1);
  assert.equal(portalWorkspaceIndex.workspaces[0].benchmark_report_count, 1);
  await assert.doesNotReject(() =>
    fs.readFile(path.join(repoRoot, ".heart", "benchmarks", "evidence", "sample-benchmark-report", "manifest.json"), "utf8"),
  );
  await assert.doesNotReject(() =>
    fs.readFile(path.join(repoRoot, ".heart", "benchmarks", "evidence", "sample-benchmark-report", "baseline.json"), "utf8"),
  );
  await assert.doesNotReject(() =>
    fs.readFile(path.join(repoRoot, ".heart", "benchmarks", "evidence", "sample-benchmark-report", "assisted.json"), "utf8"),
  );
  const portalEvidenceManifest = JSON.parse(
    await fs.readFile(
      path.join(portalRoot, "public", "benchmarks", "evidence", "sample-benchmark-report.json"),
      "utf8",
    ),
  );
  assert.equal(portalEvidenceManifest.bundle_id, "sample-benchmark-report");
  assert.equal(portalEvidenceManifest.assisted.context_pack.top_citations[0].path, undefined);
});

test("benchmark scenario runner loads named scenario manifests", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const scenarioRoot = path.join(repoRoot, "benchmarks", "scenarios");

  await fs.mkdir(scenarioRoot, { recursive: true });
  await fs.writeFile(
    path.join(scenarioRoot, "login-audit-flow.json"),
    `${JSON.stringify(
      {
        id: "login-audit-flow",
        repo: "sample-repo",
        provider: "openai",
        model: "gpt-5.4",
        baseline: {
          tokens: 2400,
          minutes: 34,
          duplicates: 3,
          policy_violations: 2,
          review_edits: 8,
          memory_refreshes: 5,
          token_cost_usd: 0.48,
        },
        assisted: {
          tokens: 1450,
          minutes: 20,
          duplicates: 1,
          policy_violations: 0,
          review_edits: 3,
          memory_refreshes: 1,
          token_cost_usd: 0.29,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const report = await runBenchmarkScenario("login-audit-flow", {
    repoRoot,
    profile_slug: "sample-repo",
  });

  assert.equal(report.scenario, "login-audit-flow");
  assert.equal(report.provider, "openai");
  assert.equal(report.model, "gpt-5.4");
  assert.equal(report.metrics.token_savings_pct, 40);
  assert.equal(report.metrics.memory_refresh_reduction_pct, 80);
});

test("benchmark scenario runner prefers observed run telemetry when run summaries are provided", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const scenarioRoot = path.join(repoRoot, "benchmarks", "scenarios");

  await fs.mkdir(scenarioRoot, { recursive: true });
  await fs.writeFile(
    path.join(scenarioRoot, "login-audit-flow.json"),
    `${JSON.stringify(
      {
        id: "login-audit-flow",
        repo: "sample-repo",
        baseline: {
          tokens: 2400,
          minutes: 34,
          duplicates: 3,
          review_edits: 8,
          memory_refreshes: 5,
          token_cost_usd: 0.48,
        },
        assisted: {
          tokens: 1450,
          minutes: 20,
          duplicates: 1,
          review_edits: 3,
          memory_refreshes: 1,
          token_cost_usd: 0.29,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const report = await runBenchmarkScenario("login-audit-flow", {
    repoRoot,
    profile_slug: "sample-repo",
    baselineObservedRun: {
      run_id: "baseline-run-1",
      measurement_mode: "observed",
      prompt_tokens: 900,
      completion_tokens: 300,
      total_tokens: 1200,
      token_cost_usd: 0.24,
      elapsed_minutes: 18,
      observed_usage_coverage_pct: 100,
      traced_call_count: 2,
      observed_call_count: 2,
    },
    assistedObservedRun: {
      run_id: "assisted-run-1",
      measurement_mode: "observed",
      prompt_tokens: 500,
      completion_tokens: 180,
      total_tokens: 680,
      token_cost_usd: 0.136,
      elapsed_minutes: 11,
      observed_usage_coverage_pct: 100,
      traced_call_count: 2,
      observed_call_count: 2,
    },
  });

  assert.equal(report.baseline.tokens, 1200);
  assert.equal(report.assisted.tokens, 680);
  assert.equal(report.baseline.minutes, 18);
  assert.equal(report.assisted.minutes, 11);
  assert.equal(report.baseline.measurement.mode, "observed");
  assert.equal(report.assisted.measurement.mode, "observed");
  assert.equal(report.baseline.measurement.run_id, "baseline-run-1");
  assert.equal(report.assisted.measurement.run_id, "assisted-run-1");
  assert.equal(report.metrics.token_savings_pct, 43);
  assert.equal(report.metrics.time_savings_pct, 39);
});

test("benchmark loader resolves linked datasets and suite writer persists aggregate output", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const datasetRoot = path.join(repoRoot, "benchmarks", "datasets");
  const scenarioRoot = path.join(repoRoot, "benchmarks", "scenarios");

  await Promise.all([
    fs.mkdir(datasetRoot, { recursive: true }),
    fs.mkdir(scenarioRoot, { recursive: true }),
  ]);

  await Promise.all([
    fs.writeFile(
      path.join(datasetRoot, "shared.json"),
      `${JSON.stringify(
        {
          id: "shared",
          title: "Shared Dataset",
          repo_strategy: "current-repo",
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    fs.writeFile(
      path.join(scenarioRoot, "a.json"),
      `${JSON.stringify(
        {
          id: "a",
          title: "Scenario A",
          dataset_id: "shared",
          evaluation: {
            targets: {
              max_tokens: 100,
              max_minutes: 10,
              max_memory_refreshes: 1,
              max_duplicates: 0,
              max_policy_violations: 0,
              max_review_edits: 1
            }
          },
          baseline: {
            tokens: 120,
            minutes: 12,
            duplicates: 1,
            policy_violations: 1,
            review_edits: 2,
            memory_refreshes: 2,
            context_retention: { checkpoints_passed: 1, checkpoints_total: 2 },
            duplicate_work: { reuse_hits: 1, reuse_targets: 2, checks_passed: 1, checks_total: 2 },
            code_quality: {
              tests_passed: 1,
              tests_total: 2,
              rubric_scores: { correctness: 3, architecture: 3, reuse: 2, testing: 2, intent_alignment: 2 }
            },
            delivery: { tasks_passed: 1, tasks_total: 2 }
          },
          assisted: {
            tokens: 80,
            minutes: 8,
            duplicates: 0,
            policy_violations: 0,
            review_edits: 1,
            memory_refreshes: 1,
            context_retention: { checkpoints_passed: 2, checkpoints_total: 2 },
            duplicate_work: { reuse_hits: 2, reuse_targets: 2, checks_passed: 2, checks_total: 2 },
            code_quality: {
              tests_passed: 2,
              tests_total: 2,
              rubric_scores: { correctness: 5, architecture: 5, reuse: 5, testing: 4, intent_alignment: 4 }
            },
            delivery: { tasks_passed: 2, tasks_total: 2 }
          }
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    fs.writeFile(
      path.join(scenarioRoot, "b.json"),
      `${JSON.stringify(
        {
          id: "b",
          title: "Scenario B",
          dataset_id: "shared",
          baseline: { tokens: 200, minutes: 20, duplicates: 2, review_edits: 3, memory_refreshes: 2 },
          assisted: { tokens: 100, minutes: 10, duplicates: 1, review_edits: 1, memory_refreshes: 1 }
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  const dataset = await loadBenchmarkDataset("shared", repoRoot);
  const scenarioReport = await runBenchmarkScenario("a", { repoRoot, profile_slug: "sample-repo" });
  const suiteResult = await runBenchmarkSuite({ repoRoot, profile_slug: "sample-repo" });
  const persisted = await writeBenchmarkSuiteReport(repoRoot, suiteResult.suite);

  assert.equal(dataset.id, "shared");
  assert.equal(scenarioReport.framework.dataset.id, "shared");
  assert.equal(suiteResult.suite.scenario_count, 2);
  assert.equal(suiteResult.scenario_runs.length, 2);
  assert.ok(suiteResult.suite.aggregate_metrics.avg_token_savings_pct > 0);
  assert.ok(persisted.report_path.endsWith(".json"));
  assert.ok(persisted.markdown_path.endsWith(".md"));
});
