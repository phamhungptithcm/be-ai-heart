function clampPercentage(value) {
  return Math.max(0, Math.min(100, round(Number(value ?? 0))));
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function percentage(value, total) {
  if (!total) {
    return 0;
  }

  return clampPercentage((Number(value ?? 0) / Number(total)) * 100);
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

function pickHighest(rows, valueKey, labelBuilder) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) {
    return null;
  }

  const winner = [...safeRows].sort(
    (left, right) => Number(right?.[valueKey] ?? 0) - Number(left?.[valueKey] ?? 0),
  )[0];

  if (!winner) {
    return null;
  }

  return labelBuilder(winner);
}

function sortByCoverageThenRoi(left, right) {
  if (right.report_count !== left.report_count) {
    return right.report_count - left.report_count;
  }

  return right.avg_roi_score - left.avg_roi_score;
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

export function buildPortalRepositoryInventorySummary(profiles = []) {
  const total = Math.max(profiles.length, 1);
  const memoryReadyCount = profiles.filter(
    (profile) => Number(profile.documents?.document_count ?? 0) > 0,
  ).length;
  const staleCount = profiles.filter((profile) => {
    const status = String(profile.cache?.status ?? "").toLowerCase();
    return status === "stale" || status === "rebuild";
  }).length;
  const benchmarkBackedCount = profiles.filter(
    (profile) => Number(profile.benchmark_report_count ?? 0) > 0,
  ).length;
  const warningCount = profiles.reduce(
    (sum, profile) => sum + Number(profile.overview?.policy_warnings ?? 0),
    0,
  );
  const documentCount = profiles.reduce(
    (sum, profile) => sum + Number(profile.documents?.document_count ?? 0),
    0,
  );
  const relationshipCount = profiles.reduce(
    (sum, profile) => sum + Number(profile.heart?.relationship_count ?? 0),
    0,
  );

  return {
    total: profiles.length,
    memory_ready_count: memoryReadyCount,
    stale_count: staleCount,
    benchmark_backed_count: benchmarkBackedCount,
    warning_count: warningCount,
    document_count: documentCount,
    relationship_count: relationshipCount,
    memory_ready_pct: round((memoryReadyCount / total) * 100),
    benchmark_backed_pct: round((benchmarkBackedCount / total) * 100),
  };
}

export function buildPortalUsageSourceMix(usage = {}) {
  const summary = usage.summary ?? {};
  const breakdowns = usage.breakdowns ?? {};
  const repositoryRows = Array.isArray(breakdowns.repositories)
    ? breakdowns.repositories
    : [];
  const clientRows = Array.isArray(breakdowns.clients) ? breakdowns.clients : [];

  const telemetryRequests = repositoryRows
    .filter((entry) => String(entry.source_type ?? "") === "hosted_telemetry")
    .reduce((sum, entry) => sum + Number(entry.requests ?? 0), 0);
  const telemetryRuns = clientRows
    .filter((entry) => String(entry.source_type ?? "") === "hosted_telemetry")
    .reduce((sum, entry) => sum + Number(entry.run_count ?? 0), 0);
  const benchmarkRequestsFromRepos = repositoryRows
    .filter((entry) => String(entry.source_type ?? "") === "benchmark_artifact")
    .reduce((sum, entry) => sum + Number(entry.requests ?? 0), 0);
  const benchmarkRuns = clientRows
    .filter((entry) => String(entry.source_type ?? "") === "benchmark_artifact")
    .reduce((sum, entry) => sum + Number(entry.run_count ?? 0), 0);
  const totalMixed =
    telemetryRequests + telemetryRuns + benchmarkRequestsFromRepos + benchmarkRuns;

  return {
    total_requests: Number(summary.requests ?? 0),
    benchmark_coverage_pct: round(summary.benchmark_coverage_pct ?? 0),
    live_request_count: telemetryRequests + telemetryRuns,
    benchmark_request_count: benchmarkRequestsFromRepos + benchmarkRuns,
    telemetry_share_pct: percentage(telemetryRequests + telemetryRuns, totalMixed),
    benchmark_share_pct: percentage(
      benchmarkRequestsFromRepos + benchmarkRuns,
      totalMixed,
    ),
  };
}

export function buildPortalUsageCoverageSummary(usage = {}) {
  const summary = usage.summary ?? {};
  const breakdowns = usage.breakdowns ?? {};
  const workspaceRows = Array.isArray(breakdowns.workspaces)
    ? breakdowns.workspaces
    : [];
  const repositoryRows = Array.isArray(breakdowns.repositories)
    ? breakdowns.repositories
    : [];
  const userRows = Array.isArray(breakdowns.users) ? breakdowns.users : [];
  const modelRows = Array.isArray(breakdowns.models) ? breakdowns.models : [];
  const clientRows = Array.isArray(breakdowns.clients) ? breakdowns.clients : [];

  return {
    workspace_count: workspaceRows.length,
    repository_count: repositoryRows.length,
    user_count: userRows.length,
    model_count: modelRows.length,
    client_count: clientRows.length,
    active_users_7d: Number(summary.active_users_7d ?? 0),
    active_users_30d: Number(summary.active_users_30d ?? 0),
    benchmark_coverage_pct: round(summary.benchmark_coverage_pct ?? 0),
    top_repository: pickHighest(repositoryRows, "estimated_token_cost_usd", (row) => ({
      label: String(row.repo ?? "unknown"),
      requests: Number(row.requests ?? 0),
      estimated_token_cost_usd: round(row.estimated_token_cost_usd ?? 0),
    })),
    top_model: pickHighest(modelRows, "estimated_token_cost_usd", (row) => ({
      label: `${String(row.provider ?? "unknown")}/${String(row.model ?? "unknown")}`,
      requests: Number(row.requests ?? 0),
      estimated_token_cost_usd: round(row.estimated_token_cost_usd ?? 0),
    })),
    top_client: pickHighest(clientRows, "run_count", (row) => ({
      label: String(row.client ?? "unknown"),
      run_count: Number(row.run_count ?? 0),
    })),
  };
}

export function buildPortalBenchmarkArchiveSummary(reports = []) {
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

export function buildPortalBenchmarkEvidenceSummary(report = {}) {
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
    context_evidence_score: round(
      contextPack.overall_evidence_score ?? contextPack.compactness_score ?? 0,
    ),
    measurement_mode: String(provenanceSummary.measurement_mode ?? "estimated"),
    sample_size: Number(provenanceSummary.sample_size ?? 0),
    observed_run_count: Number(provenanceSummary.observed_run_count ?? 0),
    observed_coverage_pct: round(provenanceSummary.observed_coverage_pct ?? 0),
    confidence_label: String(provenanceSummary.confidence_label ?? "low"),
  };
}
