function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function percentage(value, total) {
  if (!total) {
    return 0;
  }

  return Math.max(0, Math.min(100, round((Number(value ?? 0) / Number(total)) * 100)));
}

function average(values) {
  const safeValues = values.filter((value) => Number.isFinite(Number(value)));
  if (safeValues.length === 0) {
    return 0;
  }

  return round(
    safeValues.reduce((sum, value) => sum + Number(value), 0) / safeValues.length,
  );
}

function computeWorkspaceScore(workspace = {}) {
  let score = 14;
  if (workspace.profile_available) {
    score += 18;
  }
  if (workspace.document_available) {
    score += 18;
  }
  if (Number(workspace.benchmark_report_count ?? 0) > 0) {
    score += 18;
  }
  score += Math.min(18, Number(workspace.avg_token_savings_pct ?? 0) * 0.45);
  score += Math.min(16, Number(workspace.avg_memory_refresh_reduction_pct ?? 0) * 0.25);
  score -= Math.min(18, Number(workspace.queued_submission_count ?? 0) * 5);

  return Math.max(0, Math.min(100, round(score)));
}

export function buildAdminDemandMix(summary = {}) {
  const total = Math.max(Number(summary.pipeline_count ?? 0), 1);

  return [
    { label: "Demo", value: percentage(summary.demo_count, total), tone: "brand" },
    { label: "Trial", value: percentage(summary.trial_count, total), tone: "ink" },
    {
      label: "Benchmark-backed",
      value: percentage(summary.benchmark_backed_workspace_count, total),
      tone: "cyan",
    },
    {
      label: "Expansion-ready",
      value: percentage(summary.expansion_ready_workspace_count, total),
      tone: "teal",
    },
  ];
}

export function buildAdminWorkspaceMix(workspaces = []) {
  const total = Math.max(workspaces.length, 1);
  const expansionReadyCount = workspaces.filter((workspace) => Number(workspace.score ?? 0) >= 70).length;
  const watchCount = workspaces.filter((workspace) => {
    const score = Number(workspace.score ?? 0);
    return score >= 45 && score < 70;
  }).length;
  const interventionCount = workspaces.filter((workspace) => Number(workspace.score ?? 0) < 45).length;

  return {
    total: workspaces.length,
    expansion_ready_count: expansionReadyCount,
    watch_count: watchCount,
    intervention_count: interventionCount,
    expansion_ready_pct: percentage(expansionReadyCount, total),
    intervention_pct: percentage(interventionCount, total),
  };
}

export function buildAdminCustomerHealthMix(customers = []) {
  const total = Math.max(customers.length, 1);
  const activeCount = customers.filter(
    (customer) => String(customer.status ?? "") === "active",
  ).length;
  const trialCount = customers.filter(
    (customer) => String(customer.status ?? "") === "trial",
  ).length;
  const highRiskCount = customers.filter(
    (customer) => String(customer.risk_level ?? "") === "high",
  ).length;
  const benchmarkBackedCount = customers.filter(
    (customer) => Number(customer.benchmark_backed_repositories ?? 0) > 0,
  ).length;

  return {
    total: customers.length,
    active_count: activeCount,
    trial_count: trialCount,
    high_risk_count: highRiskCount,
    benchmark_backed_count: benchmarkBackedCount,
    active_pct: percentage(activeCount, total),
    high_risk_pct: percentage(highRiskCount, total),
  };
}

export function summarizeAdminRevenueSnapshot({
  requests = [],
  requestSummary = null,
  reports = [],
  workspaces = [],
} = {}) {
  const benchmarkBackedWorkspaceCount = workspaces.filter(
    (workspace) => Number(workspace.benchmark_report_count ?? 0) > 0,
  ).length;
  const expansionReadyWorkspaceCount = workspaces.filter(
    (workspace) => computeWorkspaceScore(workspace) >= 70,
  ).length;
  const pipelineCount = Number(requestSummary?.total_count ?? requests.length);

  return {
    pipeline_count: pipelineCount,
    demo_count: Number(requestSummary?.demo_count ?? 0),
    trial_count: Number(requestSummary?.trial_count ?? 0),
    avg_team_size: Number(requestSummary?.avg_team_size ?? 0),
    avg_repo_count: Number(requestSummary?.avg_repo_count ?? 0),
    report_count: reports.length,
    avg_roi_score: average(
      reports.map((report) => Number(report.metrics?.composite_roi_score ?? 0)),
    ),
    avg_token_savings_pct: average(
      reports.map((report) => Number(report.metrics?.token_savings_pct ?? 0)),
    ),
    benchmark_backed_workspace_count: benchmarkBackedWorkspaceCount,
    expansion_ready_workspace_count: expansionReadyWorkspaceCount,
    queued_submission_count: workspaces.reduce(
      (total, workspace) => total + Number(workspace.queued_submission_count ?? 0),
      0,
    ),
    benchmark_backed_pct: percentage(benchmarkBackedWorkspaceCount, pipelineCount),
    expansion_ready_pct: percentage(expansionReadyWorkspaceCount, pipelineCount),
  };
}

export function buildAdminBenchmarkEvidenceSummary(report = {}) {
  const bundle = report.evidence_bundle ?? {};
  const manifest = report.evidence_manifest ?? {};
  const assistedSummary = bundle.assisted_summary ?? {};
  const contextPack = assistedSummary.context_pack ?? {};

  return {
    bundle_available: Boolean(bundle.available),
    bundle_id: String(bundle.bundle_id ?? ""),
    bundle_file_count: Number(manifest.bundle_file_count ?? Object.keys(bundle.files ?? {}).length),
    prompt_count: Number(assistedSummary.prompt_count ?? 0),
    tool_output_count: Number(assistedSummary.tool_output_count ?? 0),
    output_artifact_count: Number(assistedSummary.output_artifact_count ?? 0),
    context_task_coverage_pct: round(contextPack.matched_task_token_pct ?? 0),
    context_compactness_score: round(contextPack.compactness_score ?? 0),
    context_evidence_score: round(
      contextPack.overall_evidence_score ?? contextPack.compactness_score ?? 0,
    ),
    citation_mix: `${Number(contextPack.graph_citation_count ?? 0)} graph / ${Number(contextPack.document_citation_count ?? 0)} docs / ${Number(contextPack.policy_citation_count ?? 0)} policy`,
  };
}
