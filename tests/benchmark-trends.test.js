import test from "node:test";
import assert from "node:assert/strict";

import { buildBenchmarkTrendDigest } from "../packages/benchmark/src/trends.js";

test("benchmark trend digest builds ordered series and summary from report history", () => {
  const digest = buildBenchmarkTrendDigest([
    {
      report_id: "report-2",
      generated_at: "2026-04-11T10:00:00.000Z",
      metrics: {
        token_savings_pct: 28,
        token_cost_savings_usd: 3.5,
        memory_refresh_reduction_pct: 41,
        composite_roi_score: 44,
      },
    },
    {
      report_id: "report-1",
      generated_at: "2026-04-04T10:00:00.000Z",
      metrics: {
        token_savings_pct: 18,
        token_cost_savings_usd: 2.2,
        memory_refresh_reduction_pct: 25,
        composite_roi_score: 30,
      },
    },
    {
      report_id: "report-3",
      generated_at: "2026-04-18T10:00:00.000Z",
      metrics: {
        token_savings_pct: 39,
        token_cost_savings_usd: 5.1,
        memory_refresh_reduction_pct: 58,
        composite_roi_score: 61,
      },
    },
  ]);

  assert.equal(digest.summary.report_count, 3);
  assert.equal(digest.summary.latest_token_savings_pct, 39);
  assert.equal(digest.summary.avg_cost_savings_usd, 3.6);
  assert.deepEqual(
    digest.series.token_savings_pct.map((entry) => entry.report_id),
    ["report-1", "report-2", "report-3"],
  );
  assert.deepEqual(
    digest.series.memory_refresh_reduction_pct.map((entry) => entry.value),
    [25, 41, 58],
  );
});
