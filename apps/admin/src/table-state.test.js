import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminCustomerTableRows,
  queryAdminCustomerRows,
  buildAdminSupportTableRows,
  queryAdminSupportRows,
  buildAdminBenchmarkTableRows,
  queryAdminBenchmarkRows,
} from "./table-state.js";

test("admin customer rows support posture filters, expansion filters, and sorting", () => {
  const rows = buildAdminCustomerTableRows([
    {
      customer_id: "cust-1",
      display_name: "Northstar Labs",
      customer_slug: "northstar",
      status: "active",
      plan_code: "enterprise",
      entitlement_status: "licensed",
      expansion_readiness: "ready",
      seats_used: 18,
      seats_total: 20,
      benchmark_backed_repositories: 2,
      memory_ready_repositories: 3,
      failed_syncs: 0,
      stale_repositories: 0,
      queued_submissions: 1,
      renewal_date: "2026-04-30",
      risk_level: "low",
    },
    {
      customer_id: "cust-2",
      display_name: "Beta Works",
      customer_slug: "beta-works",
      status: "trial",
      plan_code: "pilot",
      entitlement_status: "trialing",
      expansion_readiness: "blocked",
      seats_used: 2,
      seats_total: 10,
      benchmark_backed_repositories: 0,
      memory_ready_repositories: 0,
      failed_syncs: 2,
      stale_repositories: 2,
      queued_submissions: 4,
      renewal_date: "2026-05-20",
      risk_level: "high",
    },
  ]);

  assert.equal(rows[0].riskLabel, "Healthy");
  assert.equal(rows[1].riskLabel, "High risk");

  assert.deepEqual(
    queryAdminCustomerRows(rows, {
      query: "",
      posture: "high-risk",
      expansion: "blocked",
      sortKey: "readiness",
      sortDirection: "asc",
    }).map((row) => row.customer_id),
    ["cust-2"],
  );

  assert.deepEqual(
    queryAdminCustomerRows(rows, {
      query: "northstar",
      posture: "all",
      expansion: "all",
      sortKey: "org",
      sortDirection: "asc",
    }).map((row) => row.customer_id),
    ["cust-1"],
  );
});

test("admin support rows support severity, sync, search, and sort states", () => {
  const rows = buildAdminSupportTableRows([
    {
      profile_slug: "alpha-repo",
      repo: "alpha-service",
      customer_slug: "northstar",
      cache: { status: "updated" },
      overview: { policy_warnings: 0 },
      documents: { document_count: 4 },
      benchmark_report_count: 2,
    },
    {
      profile_slug: "beta-repo",
      repo: "beta-sync",
      customer_slug: "beta-works",
      cache: { status: "stale" },
      overview: { policy_warnings: 3 },
      documents: { document_count: 0 },
      benchmark_report_count: 0,
    },
  ]);

  assert.equal(rows[0].severityLabel, "Healthy");
  assert.equal(rows[1].severityLabel, "Critical");

  assert.deepEqual(
    queryAdminSupportRows(rows, {
      query: "",
      severity: "critical",
      sync: "stale",
      sortKey: "support-score",
      sortDirection: "asc",
    }).map((row) => row.profile_slug),
    ["beta-repo"],
  );

  assert.deepEqual(
    queryAdminSupportRows(rows, {
      query: "northstar",
      severity: "all",
      sync: "all",
      sortKey: "repository",
      sortDirection: "asc",
    }).map((row) => row.profile_slug),
    ["alpha-repo"],
  );
});

test("admin benchmark rows support ROI filters, search, and timestamp sorting", () => {
  const rows = buildAdminBenchmarkTableRows([
    {
      report_id: "r-1",
      scenario: "architecture-constrained-change",
      manager_summary: "Expansion-safe proof",
      repo: "alpha-service",
      profile_slug: "alpha-repo",
      model: "gpt-5.4",
      provider: "openai",
      generated_at: "2026-04-18T09:30:00Z",
      metrics: {
        token_savings_pct: 42,
        token_cost_savings_usd: 13.8,
        memory_refresh_reduction_pct: 48,
        composite_roi_score: 71,
      },
    },
    {
      report_id: "r-2",
      scenario: "duplicate-work-avoidance",
      manager_summary: "Needs more evidence",
      repo: "beta-sync",
      profile_slug: "beta-repo",
      model: "gpt-5.4-mini",
      provider: "openai",
      generated_at: "2026-04-16T09:30:00Z",
      metrics: {
        token_savings_pct: 18,
        token_cost_savings_usd: 2.1,
        memory_refresh_reduction_pct: 9,
        composite_roi_score: 33,
      },
    },
  ]);

  assert.equal(rows[0].roiLabel, "Strong");
  assert.equal(rows[1].roiLabel, "Weak");

  assert.deepEqual(
    queryAdminBenchmarkRows(rows, {
      query: "beta",
      roi: "all",
      sortKey: "runtime",
      sortDirection: "asc",
    }).map((row) => row.report_id),
    ["r-2"],
  );

  assert.deepEqual(
    queryAdminBenchmarkRows(rows, {
      query: "",
      roi: "weak",
      sortKey: "roi",
      sortDirection: "asc",
    }).map((row) => row.report_id),
    ["r-2"],
  );
});
