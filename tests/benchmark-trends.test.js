import test from "node:test";
import assert from "node:assert/strict";

import { buildBenchmarkTrendDigest } from "../packages/benchmark/src/trends.js";

test("benchmark trend digest builds ordered series and summary from report history", () => {
  const digest = buildBenchmarkTrendDigest([
    {
      report_id: "report-2",
      repo: "billing-api",
      scenario: "document-required",
      generated_at: "2026-04-11T10:00:00.000Z",
      evidence_bundle: { available: true },
      provenance: {
        summary: {
          measurement_mode: "mixed",
          confidence_label: "medium",
          observed_coverage_pct: 50,
          sample_size: 1,
        },
      },
      metrics: {
        token_savings_pct: 28,
        token_cost_savings_usd: 3.5,
        memory_refresh_reduction_pct: 41,
        composite_roi_score: 44,
      },
    },
    {
      report_id: "report-1",
      repo: "billing-api",
      scenario: "document-required",
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
      repo: "cache-service",
      scenario: "bug-fix",
      generated_at: "2026-04-18T10:00:00.000Z",
      evidence_bundle: { available: true },
      provenance: {
        summary: {
          measurement_mode: "observed",
          confidence_label: "high",
          observed_coverage_pct: 100,
          sample_size: 2,
        },
      },
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
  assert.equal(digest.summary.latest_measurement_mode, "observed");
  assert.equal(digest.summary.latest_confidence_label, "high");
  assert.equal(digest.summary.observed_report_count, 1);
  assert.equal(digest.summary.mixed_report_count, 1);
  assert.equal(digest.summary.estimated_report_count, 1);
  assert.equal(digest.summary.evidence_available_count, 2);
  assert.equal(digest.summary.latest_evidence_quality_score, 100);
  assert.equal(digest.summary.avg_evidence_quality_score, 66.7);
  assert.equal(digest.summary.evidence_quality_label, "usable");
  assert.deepEqual(digest.summary.top_repository, {
    label: "billing api",
    report_count: 2,
    avg_token_savings_pct: 23,
    avg_roi_score: 37,
    avg_evidence_quality_score: 50,
  });
  assert.deepEqual(digest.summary.top_scenario, {
    label: "document required",
    report_count: 2,
    avg_token_savings_pct: 23,
    avg_roi_score: 37,
    avg_evidence_quality_score: 50,
  });
  assert.deepEqual(
    digest.series.token_savings_pct.map((entry) => entry.report_id),
    ["report-1", "report-2", "report-3"],
  );
  assert.deepEqual(
    digest.series.memory_refresh_reduction_pct.map((entry) => entry.value),
    [25, 41, 58],
  );
  assert.deepEqual(
    digest.series.evidence_quality_score.map((entry) => entry.value),
    [30, 70, 100],
  );
});
