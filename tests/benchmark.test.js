import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  compareBenchmarkRuns,
  publishBenchmarkReport,
  runBenchmarkScenario,
  writeBenchmarkReport,
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
  assert.match(report.manager_summary, /35% lower token usage/);
  assert.match(report.manager_summary, /67% fewer context reloads/);
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

  const persisted = await writeBenchmarkReport(repoRoot, report);
  const destinations = await publishBenchmarkReport({
    report,
    repoRoot,
    portalRoot,
    adminRoot,
  });

  assert.ok(persisted.report_path.endsWith("sample-benchmark-report.json"));
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
  assert.equal(repoHistory.reports.length, 1);
  assert.equal(repoHistory.reports[0].metrics.token_savings_pct, 50);
  assert.equal(repoHistory.reports[0].metrics.memory_refresh_reduction_pct, 80);
  assert.equal(serviceIndex.reports.length, 1);
  assert.equal(workspaceIndex.workspaces.length, 1);
  assert.equal(workspaceIndex.workspaces[0].benchmark_report_count, 1);
  assert.equal(portalWorkspaceIndex.workspaces[0].benchmark_report_count, 1);
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
