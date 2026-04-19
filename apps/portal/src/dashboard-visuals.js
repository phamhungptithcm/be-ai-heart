function clampPercentage(value) {
  return Math.max(0, Math.min(100, round(Number(value ?? 0))));
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

export function buildPortalSavingsMix(report = {}) {
  const metrics = report.metrics ?? {};

  return [
    { label: "Token", value: clampPercentage(metrics.token_savings_pct), tone: "brand" },
    { label: "Time", value: clampPercentage(metrics.time_savings_pct), tone: "cyan" },
    { label: "Cleanup", value: clampPercentage(metrics.review_edit_reduction_pct), tone: "ink" },
    { label: "Memory", value: clampPercentage(metrics.memory_refresh_reduction_pct), tone: "teal" },
  ];
}

export function buildPortalWorkspaceMix(workspaces = []) {
  const total = Math.max(workspaces.length, 1);
  const readyCount = workspaces.filter(
    (workspace) => workspace.profile_available && workspace.document_available,
  ).length;
  const benchmarkBackedCount = workspaces.filter(
    (workspace) => Number(workspace.benchmark_report_count ?? 0) > 0,
  ).length;
  const queuedSubmissionCount = workspaces.reduce(
    (sum, workspace) => sum + Number(workspace.queued_submission_count ?? 0),
    0,
  );

  return {
    total: workspaces.length,
    ready_count: readyCount,
    partial_count: Math.max(0, workspaces.length - readyCount),
    benchmark_backed_count: benchmarkBackedCount,
    queued_submission_count: queuedSubmissionCount,
    ready_pct: round((readyCount / total) * 100),
    benchmark_backed_pct: round((benchmarkBackedCount / total) * 100),
  };
}
