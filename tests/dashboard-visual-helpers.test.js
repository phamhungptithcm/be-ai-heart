import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPortalSavingsMix,
  buildPortalBenchmarkEvidenceSummary,
  buildPortalWorkspaceMix,
  buildPortalRepositoryInventorySummary,
  buildPortalUsageSourceMix,
} from "../apps/portal/src/dashboard-visuals.js";
import {
  buildAdminDemandMix,
  buildAdminBenchmarkEvidenceSummary,
  buildAdminWorkspaceMix,
  buildAdminCustomerHealthMix,
  summarizeAdminRevenueSnapshot,
} from "../apps/admin/src/dashboard-visuals.js";

test("portal dashboard visual helpers derive savings and workspace mix", () => {
  const report = {
    metrics: {
      token_savings_pct: 40,
      time_savings_pct: 28,
      review_edit_reduction_pct: 63,
      memory_refresh_reduction_pct: 80,
    },
  };
  const workspaces = [
    { profile_available: true, document_available: true, queued_submission_count: 0, benchmark_report_count: 1 },
    { profile_available: true, document_available: false, queued_submission_count: 2, benchmark_report_count: 0 },
  ];

  assert.deepEqual(
    buildPortalSavingsMix(report).map((item) => ({ label: item.label, value: item.value })),
    [
      { label: "Token", value: 40 },
      { label: "Time", value: 28 },
      { label: "Cleanup", value: 63 },
      { label: "Memory", value: 80 },
    ],
  );

  assert.deepEqual(buildPortalWorkspaceMix(workspaces), {
    total: 2,
    ready_count: 1,
    partial_count: 1,
    benchmark_backed_count: 1,
    queued_submission_count: 2,
    ready_pct: 50,
    benchmark_backed_pct: 50,
  });
});

test("benchmark detail helpers summarize evidence bundle and assisted context quality", () => {
  const report = {
    evidence_bundle: {
      available: true,
      bundle_id: "sample-report",
      files: {
        baseline: "baseline.json",
        assisted: "assisted.json",
        evaluation: "evaluation.json",
      },
      baseline_summary: {
        prompt_count: 1,
      },
      assisted_summary: {
        prompt_count: 1,
        tool_output_count: 2,
        output_artifact_count: 1,
        context_pack: {
          available: true,
          matched_task_token_pct: 75,
          citation_count: 4,
          graph_citation_count: 1,
          document_citation_count: 2,
          policy_citation_count: 1,
          compactness_score: 0.8,
          overall_evidence_score: 0.77,
        },
      },
    },
  };

  assert.deepEqual(buildPortalBenchmarkEvidenceSummary(report), {
    bundle_available: true,
    bundle_id: "sample-report",
    bundle_file_count: 3,
    prompt_count: 1,
    tool_output_count: 2,
    output_artifact_count: 1,
    context_task_coverage_pct: 75,
    context_evidence_score: 0.8,
  });

  assert.deepEqual(buildAdminBenchmarkEvidenceSummary(report), {
    bundle_available: true,
    bundle_id: "sample-report",
    bundle_file_count: 3,
    prompt_count: 1,
    tool_output_count: 2,
    output_artifact_count: 1,
    context_task_coverage_pct: 75,
    context_compactness_score: 0.8,
    context_evidence_score: 0.8,
    citation_mix: "1 graph / 2 docs / 1 policy",
  });
});

test("admin dashboard visual helpers derive demand and workspace posture", () => {
  const summary = {
    pipeline_count: 6,
    demo_count: 2,
    trial_count: 3,
    benchmark_backed_workspace_count: 4,
    expansion_ready_workspace_count: 2,
  };
  const workspaces = [
    { score: 84 },
    { score: 72 },
    { score: 58 },
    { score: 21 },
  ];

  assert.deepEqual(
    buildAdminDemandMix(summary).map((item) => ({ label: item.label, value: item.value })),
    [
      { label: "Demo", value: 33.3 },
      { label: "Trial", value: 50 },
      { label: "Benchmark-backed", value: 66.7 },
      { label: "Expansion-ready", value: 33.3 },
    ],
  );

  assert.deepEqual(buildAdminWorkspaceMix(workspaces), {
    total: 4,
    expansion_ready_count: 2,
    watch_count: 1,
    intervention_count: 1,
    expansion_ready_pct: 50,
    intervention_pct: 25,
  });
});

test("portal inventory and usage helpers derive operational coverage signals", () => {
  const profiles = [
    {
      documents: { document_count: 3 },
      overview: { policy_warnings: 0 },
      cache: { status: "updated" },
      benchmark_report_count: 2,
      heart: { relationship_count: 12 },
    },
    {
      documents: { document_count: 0 },
      overview: { policy_warnings: 2 },
      cache: { status: "stale" },
      benchmark_report_count: 0,
      heart: { relationship_count: 7 },
    },
  ];

  assert.deepEqual(buildPortalRepositoryInventorySummary(profiles), {
    total: 2,
    memory_ready_count: 1,
    stale_count: 1,
    benchmark_backed_count: 1,
    warning_count: 2,
    document_count: 3,
    relationship_count: 19,
    memory_ready_pct: 50,
    benchmark_backed_pct: 50,
  });

  assert.deepEqual(
    buildPortalUsageSourceMix({
      summary: {
        requests: 120,
        benchmark_coverage_pct: 62,
      },
      breakdowns: {
        clients: [
          { source_type: "hosted_telemetry", run_count: 10 },
          { source_type: "benchmark_artifact", run_count: 4 },
        ],
        repositories: [
          { source_type: "hosted_telemetry", requests: 90 },
          { source_type: "benchmark_artifact", requests: 30 },
        ],
      },
    }),
    {
      total_requests: 120,
      benchmark_coverage_pct: 62,
      live_request_count: 100,
      benchmark_request_count: 34,
      telemetry_share_pct: 74.6,
      benchmark_share_pct: 25.4,
    },
  );
});

test("admin helpers derive customer health mix and revenue snapshot", () => {
  const customers = [
    { status: "active", risk_level: "low", benchmark_backed_repositories: 2 },
    { status: "active", risk_level: "medium", benchmark_backed_repositories: 0 },
    { status: "trial", risk_level: "high", benchmark_backed_repositories: 1 },
  ];

  assert.deepEqual(buildAdminCustomerHealthMix(customers), {
    total: 3,
    active_count: 2,
    trial_count: 1,
    high_risk_count: 1,
    benchmark_backed_count: 2,
    active_pct: 66.7,
    high_risk_pct: 33.3,
  });

  assert.deepEqual(
    summarizeAdminRevenueSnapshot({
      requests: [
        { intake_kind: "demo", repo_count: 3, team_size: 8, primary_goal: "benchmark and governance" },
        { intake_kind: "trial", repo_count: 1, team_size: 2, primary_goal: "self serve" },
      ],
      requestSummary: {
        total_count: 2,
        demo_count: 1,
        trial_count: 1,
        avg_team_size: 5,
        avg_repo_count: 2,
      },
      reports: [
        { metrics: { composite_roi_score: 61, token_savings_pct: 34 } },
        { metrics: { composite_roi_score: 49, token_savings_pct: 26 } },
      ],
      workspaces: [
        {
          profile_available: true,
          document_available: true,
          benchmark_report_count: 1,
          avg_token_savings_pct: 40,
          avg_memory_refresh_reduction_pct: 35,
          queued_submission_count: 0,
        },
        {
          profile_available: true,
          document_available: false,
          benchmark_report_count: 0,
          avg_token_savings_pct: 10,
          avg_memory_refresh_reduction_pct: 0,
          queued_submission_count: 2,
        },
      ],
    }),
    {
      pipeline_count: 2,
      demo_count: 1,
      trial_count: 1,
      avg_team_size: 5,
      avg_repo_count: 2,
      report_count: 2,
      avg_roi_score: 55,
      avg_token_savings_pct: 30,
      benchmark_backed_workspace_count: 1,
      expansion_ready_workspace_count: 1,
      queued_submission_count: 2,
      benchmark_backed_pct: 50,
      expansion_ready_pct: 50,
    },
  );
});
