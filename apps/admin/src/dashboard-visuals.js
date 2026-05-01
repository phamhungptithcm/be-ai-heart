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

function toTitleLabel(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function sortByCoverageThenRoi(left, right) {
  if (right.report_count !== left.report_count) {
    return right.report_count - left.report_count;
  }

  return right.avg_roi_score - left.avg_roi_score;
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

export function buildAdminCustomerExpansionSummary(customers = []) {
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const total = Math.max(safeCustomers.length, 1);
  const benchmarkBackedCount = safeCustomers.filter(
    (customer) => Number(customer.benchmark_backed_repositories ?? 0) > 0,
  ).length;
  const renewalSoonCount = safeCustomers.filter(
    (customer) => daysUntil(customer.renewal_date) <= 21,
  ).length;
  const seatPressureCount = safeCustomers.filter((customer) => {
    const seatsTotal = Number(customer.seats_total ?? 0);
    const seatsUsed = Number(customer.seats_used ?? 0);
    return seatsTotal > 0 && seatsUsed / seatsTotal >= 0.8;
  }).length;
  const staleRepositoryCount = safeCustomers.reduce(
    (sum, customer) => sum + Number(customer.stale_repositories ?? 0),
    0,
  );
  const queuedSubmissionCount = safeCustomers.reduce(
    (sum, customer) => sum + Number(customer.queued_submissions ?? 0),
    0,
  );

  return {
    total: safeCustomers.length,
    benchmark_backed_count: benchmarkBackedCount,
    renewal_soon_count: renewalSoonCount,
    seat_pressure_count: seatPressureCount,
    stale_repository_count: staleRepositoryCount,
    queued_submission_count: queuedSubmissionCount,
    benchmark_backed_pct: percentage(benchmarkBackedCount, total),
  };
}

export function buildAdminSupportQueueSummary({ profiles = [], requests = [] } = {}) {
  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const safeRequests = Array.isArray(requests) ? requests : [];
  const staleProfileCount = safeProfiles.filter((profile) => {
    const status = String(profile.cache?.status ?? "").toLowerCase();
    return status === "stale" || status === "rebuild";
  }).length;
  const benchmarkGapCount = safeProfiles.filter(
    (profile) => Number(profile.benchmark_report_count ?? 0) === 0,
  ).length;
  const policyWarningCount = safeProfiles.reduce(
    (sum, profile) => sum + Number(profile.overview?.policy_warnings ?? 0),
    0,
  );
  const lowMemoryCount = safeProfiles.filter(
    (profile) => Number(profile.documents?.document_count ?? 0) === 0,
  ).length;
  const demoRequestCount = safeRequests.filter(
    (request) => String(request.intake_kind ?? "") === "demo",
  ).length;
  const trialRequestCount = safeRequests.filter(
    (request) => String(request.intake_kind ?? "") === "trial",
  ).length;

  return {
    profile_count: safeProfiles.length,
    stale_profile_count: staleProfileCount,
    benchmark_gap_count: benchmarkGapCount,
    policy_warning_count: policyWarningCount,
    low_memory_count: lowMemoryCount,
    demo_request_count: demoRequestCount,
    trial_request_count: trialRequestCount,
    critical_queue_count: Math.max(staleProfileCount, lowMemoryCount, benchmarkGapCount),
  };
}

export function buildAdminBenchmarkArchiveSummary(reports = []) {
  const safeReports = Array.isArray(reports) ? reports : [];
  const repositoryMap = new Map();
  const scenarioMap = new Map();

  for (const report of safeReports) {
    const repoKey = String(report.repo ?? "unknown");
    const scenarioKey = toTitleLabel(report.scenario ?? "unknown");
    const tokenSavings = Number(report.metrics?.token_savings_pct ?? 0);
    const roiScore = Number(report.metrics?.composite_roi_score ?? 0);

    const repoEntry = repositoryMap.get(repoKey) ?? {
      label: repoKey,
      report_count: 0,
      token_savings: [],
      roi_scores: [],
    };
    repoEntry.report_count += 1;
    repoEntry.token_savings.push(tokenSavings);
    repoEntry.roi_scores.push(roiScore);
    repositoryMap.set(repoKey, repoEntry);

    const scenarioEntry = scenarioMap.get(scenarioKey) ?? {
      label: scenarioKey,
      report_count: 0,
      token_savings: [],
      roi_scores: [],
    };
    scenarioEntry.report_count += 1;
    scenarioEntry.token_savings.push(tokenSavings);
    scenarioEntry.roi_scores.push(roiScore);
    scenarioMap.set(scenarioKey, scenarioEntry);
  }

  const repositoryRows = [...repositoryMap.values()].map((entry) => ({
    label: entry.label,
    report_count: entry.report_count,
    avg_token_savings_pct: average(entry.token_savings),
    avg_roi_score: average(entry.roi_scores),
  }));
  const scenarioRows = [...scenarioMap.values()].map((entry) => ({
    label: entry.label,
    report_count: entry.report_count,
    avg_token_savings_pct: average(entry.token_savings),
    avg_roi_score: average(entry.roi_scores),
  }));

  return {
    report_count: safeReports.length,
    repository_count: repositoryMap.size,
    scenario_count: scenarioMap.size,
    avg_token_savings_pct: average(
      safeReports.map((report) => Number(report.metrics?.token_savings_pct ?? 0)),
    ),
    avg_roi_score: average(
      safeReports.map((report) => Number(report.metrics?.composite_roi_score ?? 0)),
    ),
    top_repository: repositoryRows.sort(sortByCoverageThenRoi)[0] ?? null,
    top_scenario: scenarioRows.sort(sortByCoverageThenRoi)[0] ?? null,
  };
}

function daysUntil(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const now = new Date();
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function buildAdminBenchmarkEvidenceSummary(report = {}) {
  const bundle = report.evidence_bundle ?? {};
  const manifest = report.evidence_manifest ?? {};
  const assistedSummary = bundle.assisted_summary ?? {};
  const contextPack = assistedSummary.context_pack ?? {};
  const provenanceSummary = report.provenance?.summary ?? manifest.provenance_summary ?? bundle.provenance_summary ?? {};

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
    measurement_mode: String(provenanceSummary.measurement_mode ?? "estimated"),
    sample_size: Number(provenanceSummary.sample_size ?? 0),
    observed_run_count: Number(provenanceSummary.observed_run_count ?? 0),
    observed_coverage_pct: round(provenanceSummary.observed_coverage_pct ?? 0),
    confidence_label: String(provenanceSummary.confidence_label ?? "low"),
  };
}
