import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPortalSavingsMix,
  buildPortalWorkspaceMix,
} from "../apps/portal/src/dashboard-visuals.js";
import {
  buildAdminDemandMix,
  buildAdminWorkspaceMix,
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
