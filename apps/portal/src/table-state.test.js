import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPortalRepositoryTableRows,
  queryPortalRepositoryRows,
  buildPortalBenchmarkTableRows,
  queryPortalBenchmarkRows,
} from "./table-state.js";

test("portal repository table rows support search, quick filters, and explicit sorting", () => {
  const rows = buildPortalRepositoryTableRows([
    {
      profile_slug: "alpha-repo",
      repo: "alpha-service",
      generated_at: "2026-04-18T09:30:00Z",
      overview: {
        summary: "Core ingestion workspace",
        policy_warnings: 0,
      },
      documents: {
        document_count: 4,
      },
      heart: {
        relationship_count: 900,
      },
      cache: {
        status: "updated",
      },
      benchmark_report_count: 2,
    },
    {
      profile_slug: "beta-repo",
      repo: "beta-sync",
      generated_at: "2026-04-17T09:30:00Z",
      overview: {
        summary: "Needs support intervention",
        policy_warnings: 3,
      },
      documents: {
        document_count: 0,
      },
      heart: {
        relationship_count: 8,
      },
      cache: {
        status: "stale",
      },
      benchmark_report_count: 0,
    },
  ]);

  assert.equal(rows[0].readinessLabel, "Ready");
  assert.equal(rows[1].readinessLabel, "Needs work");

  assert.deepEqual(
    queryPortalRepositoryRows(rows, {
      query: "",
      readiness: "needs-work",
      sync: "needs-resync",
      benchmark: "missing",
      sortKey: "readiness",
      sortDirection: "asc",
    }).map((row) => row.profile_slug),
    ["beta-repo"],
  );

  assert.deepEqual(
    queryPortalRepositoryRows(rows, {
      query: "ingestion",
      readiness: "all",
      sync: "all",
      benchmark: "all",
      sortKey: "repo",
      sortDirection: "asc",
    }).map((row) => row.profile_slug),
    ["alpha-repo"],
  );

  assert.deepEqual(
    queryPortalRepositoryRows(rows, {
      query: "",
      readiness: "all",
      sync: "all",
      benchmark: "all",
      sortKey: "last-sync",
      sortDirection: "desc",
    }).map((row) => row.profile_slug),
    ["alpha-repo", "beta-repo"],
  );
});

test("portal benchmark rows support ROI filters, search, and sort order", () => {
  const rows = buildPortalBenchmarkTableRows([
    {
      report_id: "r-1",
      scenario: "architecture-constrained-change",
      manager_summary: "High-confidence support savings",
      repo: "alpha-service",
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
      manager_summary: "Needs broader repository proof",
      repo: "beta-sync",
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
    queryPortalBenchmarkRows(rows, {
      query: "broader",
      roi: "all",
      sortKey: "runtime",
      sortDirection: "asc",
    }).map((row) => row.report_id),
    ["r-2"],
  );

  assert.deepEqual(
    queryPortalBenchmarkRows(rows, {
      query: "",
      roi: "strong",
      sortKey: "roi",
      sortDirection: "desc",
    }).map((row) => row.report_id),
    ["r-1"],
  );

  assert.deepEqual(
    queryPortalBenchmarkRows(rows, {
      query: "",
      roi: "all",
      sortKey: "token-save",
      sortDirection: "asc",
    }).map((row) => row.report_id),
    ["r-2", "r-1"],
  );
});
