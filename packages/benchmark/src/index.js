import fs from "node:fs/promises";
import path from "node:path";

import {
  publishBenchmarksToSurface,
  publishWorkspacesToSurface,
  resolveServiceStorageRoot,
  writeBenchmarkArtifactRecord,
} from "../../../services/api/src/storage.js";
import {
  buildBenchmarkDeltaMetrics,
  buildFrameworkSummary,
  createSuiteReport,
  listBenchmarkScenarioManifests,
  loadBenchmarkDatasetManifest,
  loadBenchmarkScenarioManifest,
  mergeObservedRunIntoBenchmarkInput,
  normalizeBenchmarkRun,
  normalizeEvaluationConfig,
  renderScenarioReportMarkdown,
  renderSuiteReportMarkdown,
} from "./framework.js";

export { buildBenchmarkTrendDigest } from "./trends.js";
export { mergeObservedRunIntoBenchmarkInput } from "./framework.js";

export function compareBenchmarkRuns(baselineInput, assistedInput, metadata = {}) {
  const scenarioManifest = metadata.scenario_manifest ?? metadata.scenarioManifest ?? null;
  const datasetManifest = metadata.dataset_manifest ?? metadata.datasetManifest ?? scenarioManifest?.dataset ?? null;
  const evaluation = normalizeEvaluationConfig(scenarioManifest?.evaluation);
  const baseline = normalizeBenchmarkRun(baselineInput, evaluation);
  const assisted = normalizeBenchmarkRun(assistedInput, evaluation);
  const evidence = buildBenchmarkEvidence({
    baselineInput,
    assistedInput,
    scenarioManifest,
    datasetManifest,
  });
  const reportId = sanitizeSlug(
    metadata.report_id ??
      `${metadata.profile_slug ?? metadata.repo ?? "benchmark"}-${metadata.scenario ?? scenarioManifest?.id ?? "comparison"}-${Date.now()}`,
  );
  const generatedAt = metadata.generated_at ?? new Date().toISOString();
  const extraMetrics = buildBenchmarkDeltaMetrics({ baseline, assisted });
  const token_savings_pct = percentReduction(baseline.tokens, assisted.tokens);
  const time_savings_pct = percentReduction(baseline.minutes, assisted.minutes);
  const duplicate_reduction_pct = percentReduction(baseline.duplicates, assisted.duplicates);
  const policy_violation_reduction_pct = percentReduction(
    baseline.policy_violations,
    assisted.policy_violations,
  );
  const review_edit_reduction_pct = percentReduction(baseline.review_edits, assisted.review_edits);
  const memory_refresh_reduction_pct = percentReduction(
    baseline.memory_refreshes,
    assisted.memory_refreshes,
  );
  const token_cost_savings_pct = percentReduction(baseline.token_cost_usd, assisted.token_cost_usd);
  const token_cost_savings_usd = roundNumber(baseline.token_cost_usd - assisted.token_cost_usd, 2);
  const time_saved_minutes = roundNumber(baseline.minutes - assisted.minutes, 1);
  const review_edits_saved = baseline.review_edits - assisted.review_edits;
  const provenance = buildBenchmarkProvenance({ baseline, assisted });
  const composite_roi_score = roundNumber(
    (
      token_savings_pct +
      time_savings_pct +
      duplicate_reduction_pct +
      review_edit_reduction_pct +
      memory_refresh_reduction_pct +
      Math.max(0, extraMetrics.context_retention_gain_pct) +
      Math.max(0, extraMetrics.code_quality_gain_pct)
    ) / 7,
    1,
  );
  const contextPackSummary = evidence.assisted.context_pack;

  return {
    schema_version: 2,
    report_type: "scenario",
    report_id: reportId,
    repo: metadata.repo ?? "unknown-repo",
    profile_slug: sanitizeSlug(metadata.profile_slug ?? metadata.repo ?? "benchmark"),
    scenario: metadata.scenario ?? scenarioManifest?.id ?? "comparison",
    provider: metadata.provider ?? "",
    model: metadata.model ?? "",
    generated_at: generatedAt,
    framework: buildFrameworkSummary({
      scenarioManifest,
      datasetManifest,
      evaluation,
    }),
    baseline,
    assisted,
    metrics: {
      token_savings_pct,
      time_savings_pct,
      duplicate_reduction_pct,
      policy_violation_reduction_pct,
      review_edit_reduction_pct,
      memory_refresh_reduction_pct,
      token_cost_savings_pct,
      token_cost_savings_usd,
      time_saved_minutes,
      review_edits_saved,
      ...extraMetrics,
      composite_roi_score,
      context_pack_quality_score: contextPackSummary.overall_evidence_score,
      context_pack_compactness_score: contextPackSummary.compactness_score,
      context_pack_task_coverage_pct: contextPackSummary.matched_task_token_pct,
    },
    summary: `Token usage improved by ${token_savings_pct}%, context retention improved by ${extraMetrics.context_retention_gain_pct}%, and code quality improved by ${extraMetrics.code_quality_gain_pct}%.`,
    manager_summary: buildManagerSummary({
      token_savings_pct,
      time_savings_pct,
      token_cost_savings_usd,
      memory_refresh_reduction_pct,
      context_retention_gain_pct: extraMetrics.context_retention_gain_pct,
      code_quality_gain_pct: extraMetrics.code_quality_gain_pct,
    }),
    technical_summary: buildTechnicalSummary({
      duplicate_reduction_pct,
      policy_violation_reduction_pct,
      review_edit_reduction_pct,
      memory_refresh_reduction_pct,
      duplicate_avoidance_gain_pct: extraMetrics.duplicate_avoidance_gain_pct,
      contextPackSummary,
    }),
    provenance,
    automation: {
      commands: {
        run_scenario: `heart benchmark run ${metadata.scenario ?? scenarioManifest?.id ?? "<scenario-id>"}`,
        run_suite: "heart benchmark run --all",
        compare_runs: "heart benchmark compare baseline.json assisted.json",
      },
    },
    evidence,
  };
}

export async function runBenchmarkScenario(scenarioRef, options = {}) {
  const scenario =
    options.scenarioManifest ??
    (await loadBenchmarkScenario(scenarioRef, options.repoRoot ?? process.cwd()));
  const baselineInput = mergeObservedRunIntoBenchmarkInput(
    options.baselineInput ?? scenario.baseline,
    options.baselineObservedRun ?? null,
  );
  const assistedInput = mergeObservedRunIntoBenchmarkInput(
    options.assistedInput ?? scenario.assisted,
    options.assistedObservedRun ?? null,
  );

  return compareBenchmarkRuns(baselineInput, assistedInput, {
    repo: options.repo ?? scenario.repo ?? path.basename(options.repoRoot ?? process.cwd()),
    profile_slug: options.profile_slug ?? scenario.profile_slug ?? scenario.repo ?? "benchmark",
    scenario: options.scenario ?? scenario.id,
    provider: options.provider ?? scenario.provider ?? "",
    model: options.model ?? scenario.model ?? "",
    report_id: options.report_id,
    generated_at: options.generated_at,
    scenario_manifest: scenario,
    dataset_manifest: scenario.dataset ?? null,
  });
}

export async function runBenchmarkSuite(options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const scenarios = options.scenarioRefs?.length
    ? await Promise.all(options.scenarioRefs.map((scenarioRef) => loadBenchmarkScenario(scenarioRef, repoRoot)))
    : await listBenchmarkScenarios(repoRoot);
  const generatedAt = options.generated_at ?? new Date().toISOString();
  const reports = [];
  const scenario_runs = [];

  for (const scenario of scenarios) {
    const report = await runBenchmarkScenario(scenario.path ?? scenario.id, {
      ...options,
      repoRoot,
      scenarioManifest: scenario,
      generated_at: generatedAt,
      report_id: options.report_id ? `${sanitizeSlug(options.report_id)}-${sanitizeSlug(scenario.id)}` : undefined,
    });
    reports.push(report);
    scenario_runs.push({
      scenario,
      dataset: scenario.dataset ?? null,
      report,
    });
  }

  return {
    suite: createSuiteReport({
      reports,
      repo: options.repo ?? path.basename(repoRoot),
      profileSlug: options.profile_slug ?? options.repo ?? path.basename(repoRoot),
      generatedAt,
      suiteId: options.suite_id,
    }),
    scenario_runs,
  };
}

export async function writeBenchmarkReport(repoRoot, report) {
  const benchmarkRoot = path.join(repoRoot, ".heart", "benchmarks");
  await fs.mkdir(benchmarkRoot, { recursive: true });

  const reportPath = path.join(benchmarkRoot, `${report.report_id}.json`);
  const markdownPath = path.join(benchmarkRoot, `${report.report_id}.md`);
  await Promise.all([
    fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    fs.writeFile(markdownPath, renderScenarioReportMarkdown(report), "utf8"),
  ]);

  return {
    benchmark_root: benchmarkRoot,
    report_path: reportPath,
    markdown_path: markdownPath,
  };
}

export async function writeBenchmarkSuiteReport(repoRoot, suiteReport) {
  const suiteRoot = path.join(repoRoot, ".heart", "benchmarks", "suites");
  await fs.mkdir(suiteRoot, { recursive: true });

  const reportPath = path.join(suiteRoot, `${suiteReport.suite_id}.json`);
  const markdownPath = path.join(suiteRoot, `${suiteReport.suite_id}.md`);
  await Promise.all([
    fs.writeFile(reportPath, `${JSON.stringify(suiteReport, null, 2)}\n`, "utf8"),
    fs.writeFile(markdownPath, renderSuiteReportMarkdown(suiteReport), "utf8"),
  ]);

  return {
    suite_root: suiteRoot,
    report_path: reportPath,
    markdown_path: markdownPath,
  };
}

export async function writeBenchmarkEvidenceBundle(
  repoRoot,
  report,
  {
    baselineInput = {},
    assistedInput = {},
    evaluation = {},
    scenario = null,
    dataset = null,
    scanProvenance = null,
    readiness = null,
  } = {},
) {
  const evidenceRoot = path.join(repoRoot, ".heart", "benchmarks", "evidence", report.report_id);
  await fs.mkdir(evidenceRoot, { recursive: true });

  const baselinePath = path.join(evidenceRoot, "baseline.json");
  const assistedPath = path.join(evidenceRoot, "assisted.json");
  const evaluationPath = path.join(evidenceRoot, "evaluation.json");
  const scenarioPath = scenario ? path.join(evidenceRoot, "scenario.json") : null;
  const datasetPath = dataset ? path.join(evidenceRoot, "dataset.json") : null;
  const manifestPath = path.join(evidenceRoot, "manifest.json");

  const safeScanProvenance = sanitizeScanProvenance(scanProvenance);
  const safeReadiness = sanitizeWorkspaceReadiness(readiness);
  const traceMetadata = buildEvidenceTraceMetadata({
    report,
    baselineInput,
    assistedInput,
    scenario,
    dataset,
    scanProvenance: safeScanProvenance,
  });
  const baselinePayload = createEvidenceRunPayload("baseline", report, baselineInput);
  const assistedPayload = createEvidenceRunPayload("assisted", report, assistedInput, {
    scanProvenance: safeScanProvenance,
    readiness: safeReadiness,
  });
  const evaluationPayload = createEvidenceEvaluationPayload(report, evaluation, {
    scanProvenance: safeScanProvenance,
    readiness: safeReadiness,
  });
  const manifest = {
    schema_version: 2,
    bundle_id: report.report_id,
    report_id: report.report_id,
    repo: report.repo,
    profile_slug: report.profile_slug,
    scenario: report.scenario,
    scenario_id: traceMetadata.scenario_id,
    dataset_id: traceMetadata.dataset_id,
    provider: traceMetadata.provider,
    model: traceMetadata.model,
    task: traceMetadata.task,
    measurement_mode: traceMetadata.measurement_mode,
    run_ids: traceMetadata.run_ids,
    repo_snapshot: traceMetadata.repo_snapshot,
    generated_at: report.generated_at,
    files: compactObject({
      baseline: "baseline.json",
      assisted: "assisted.json",
      evaluation: "evaluation.json",
      scenario: scenario ? "scenario.json" : undefined,
      dataset: dataset ? "dataset.json" : undefined,
    }),
    baseline_summary: summarizeRunEvidence(baselineInput),
    assisted_summary: summarizeRunEvidence(assistedInput),
    provenance_summary: (report.provenance ?? buildBenchmarkProvenance(report)).summary,
    scan_provenance: safeScanProvenance,
    readiness: safeReadiness,
    scenario_summary: summarizeScenarioManifest(scenario),
    dataset_summary: summarizeDatasetManifest(dataset),
    automation: report.automation ?? {},
  };
  manifest.artifact_list = buildArtifactList(manifest.files);

  const writes = [
    fs.writeFile(baselinePath, `${JSON.stringify(baselinePayload, null, 2)}\n`, "utf8"),
    fs.writeFile(assistedPath, `${JSON.stringify(assistedPayload, null, 2)}\n`, "utf8"),
    fs.writeFile(evaluationPath, `${JSON.stringify(evaluationPayload, null, 2)}\n`, "utf8"),
    fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  ];
  if (scenarioPath) {
    writes.push(fs.writeFile(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`, "utf8"));
  }
  if (datasetPath) {
    writes.push(fs.writeFile(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8"));
  }

  await Promise.all(writes);

  return {
    available: true,
    bundle_id: report.report_id,
    generated_at: report.generated_at,
    local_root: evidenceRoot,
    local_manifest_path: manifestPath,
    files: manifest.files,
    baseline_summary: manifest.baseline_summary,
    assisted_summary: manifest.assisted_summary,
    provenance_summary: manifest.provenance_summary,
    scan_provenance: manifest.scan_provenance,
    readiness: manifest.readiness,
    provider: manifest.provider,
    model: manifest.model,
    task: manifest.task,
    scenario_id: manifest.scenario_id,
    dataset_id: manifest.dataset_id,
    measurement_mode: manifest.measurement_mode,
    run_ids: manifest.run_ids,
    repo_snapshot: manifest.repo_snapshot,
    artifact_list: manifest.artifact_list,
  };
}

export async function publishBenchmarkReport({
  report,
  repoRoot,
  portalRoot,
  adminRoot,
  serviceStorageRoot,
} = {}) {
  const safeReport = createWebBenchmarkReport(report);
  const storageRoot = resolveServiceStorageRoot({
    serviceStorageRoot,
    repoRoot,
    portalRoot,
    adminRoot,
  });
  const persisted = await writeBenchmarkArtifactRecord({
    serviceStorageRoot: storageRoot,
    report: safeReport,
  });
  const destinations = [];

  for (const destination of await resolveBenchmarkDestinations(repoRoot, { portalRoot, adminRoot })) {
    await publishBenchmarksToSurface({
      serviceStorageRoot: storageRoot,
      surfaceRoot: destination.root,
    });
    await publishWorkspacesToSurface({
      serviceStorageRoot: storageRoot,
      surfaceRoot: destination.root,
    });
    destinations.push({
      ...destination,
      service_storage_root: storageRoot,
      report_path: persisted.report_path,
    });
  }

  return destinations;
}

export function prepareBenchmarkReportArtifact(report) {
  return createWebBenchmarkReport(report);
}

export async function loadBenchmarkReport(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function loadBenchmarkScenario(scenarioRef, repoRoot) {
  return loadBenchmarkScenarioManifest(scenarioRef, repoRoot);
}

export async function loadBenchmarkDataset(datasetRef, repoRoot) {
  return loadBenchmarkDatasetManifest(datasetRef, repoRoot);
}

export async function listBenchmarkScenarios(repoRoot) {
  return listBenchmarkScenarioManifests(repoRoot);
}

function percentReduction(before, after) {
  if (before === 0) {
    return 0;
  }

  return Math.round(((before - after) / before) * 100);
}

function normalizeRunMetrics(input = {}) {
  return normalizeBenchmarkRun(input, normalizeEvaluationConfig());
}

function estimateTokenCostUsd(tokens, costPerThousand = 0.01) {
  return (tokens / 1000) * numberOrZero(costPerThousand);
}

function buildManagerSummary(metrics) {
  const memorySummary = Number.isFinite(Number(metrics.memory_refresh_reduction_pct))
    ? `${metrics.memory_refresh_reduction_pct}% fewer context reloads`
    : `${metrics.context_retention_gain_pct}% better context retention`;
  return `Benchmark shows ${metrics.token_savings_pct}% lower token usage, ${metrics.time_savings_pct}% faster completion, ${memorySummary}, and $${metrics.token_cost_savings_usd.toFixed(2)} lower direct token spend per compared run.`;
}

function buildTechnicalSummary(metrics) {
  const contextPackSentence = metrics.contextPackSummary?.available
    ? ` Assisted context pack carried ${metrics.contextPackSummary.citation_count} citations with ${metrics.contextPackSummary.matched_task_token_pct}% task coverage and an evidence score of ${metrics.contextPackSummary.overall_evidence_score}.`
    : "";
  return `Duplicate work dropped by ${metrics.duplicate_reduction_pct}% while duplicate-avoidance score improved by ${metrics.duplicate_avoidance_gain_pct}%, policy violations improved by ${metrics.policy_violation_reduction_pct}%, review edits improved by ${metrics.review_edit_reduction_pct}%, and memory refreshes dropped by ${metrics.memory_refresh_reduction_pct}%.${contextPackSentence}`;
}

function roundNumber(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(numberOrZero(value) * factor) / factor;
}

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null));
}

function summarizeScenarioManifest(scenario = null) {
  if (!scenario) {
    return {
      id: "",
      title: "",
      category: "",
      dataset_id: "",
      description: "",
    };
  }

  return {
    id: String(scenario.id ?? ""),
    title: String(scenario.title ?? scenario.id ?? ""),
    category: String(scenario.category ?? ""),
    dataset_id: String(scenario.dataset?.id ?? scenario.dataset_id ?? ""),
    description: String(scenario.description ?? ""),
  };
}

function summarizeDatasetManifest(dataset = null) {
  if (!dataset) {
    return {
      id: "",
      title: "",
      repo_strategy: "",
    };
  }

  return {
    id: String(dataset.id ?? ""),
    title: String(dataset.title ?? dataset.id ?? ""),
    repo_strategy: String(dataset.repo_strategy ?? ""),
    summary: String(dataset.summary ?? ""),
  };
}

function sanitizeScanProvenance(provenance = null) {
  if (!provenance?.available && !hasScanProvenanceSignal(provenance)) {
    return {
      available: false,
    };
  }

  const repoRoot = provenance.repo_root;
  return {
    available: true,
    cache_schema_version: numberOrZero(provenance.cache_schema_version),
    config_path: sanitizeProvenancePath(provenance.config_path, repoRoot),
    config_exists: Boolean(provenance.config_exists),
    config_hash: String(provenance.config_hash ?? ""),
    policy_path: sanitizeProvenancePath(provenance.policy_path, repoRoot),
    policy_exists: Boolean(provenance.policy_exists),
    policy_hash: String(provenance.policy_hash ?? ""),
    default_ignore_paths: sanitizePathList(provenance.default_ignore_paths),
    configured_ignore_paths: sanitizePathList(provenance.configured_ignore_paths),
    ignore_paths: sanitizePathList(provenance.ignore_paths),
    document_roots: sanitizePathList(provenance.document_roots),
  };
}

function sanitizeWorkspaceReadiness(readiness = null) {
  if (!readiness || typeof readiness !== "object") {
    return {
      available: false,
    };
  }

  return {
    available: true,
    schema_version: numberOrZero(readiness.schema_version),
    status: String(readiness.status ?? ""),
    blocking_error_count: numberOrZero(readiness.blocking_error_count),
    warning_count: numberOrZero(readiness.warning_count),
    config_status: String(readiness.config_status ?? ""),
    policy_status: String(readiness.policy_status ?? ""),
    generated_noise_exclusion: {
      status: String(readiness.generated_noise_exclusion?.status ?? ""),
      required_ignore_paths: sanitizePathList(readiness.generated_noise_exclusion?.required_ignore_paths),
      default_ignore_count: numberOrZero(readiness.generated_noise_exclusion?.default_ignore_count),
      effective_ignore_count: numberOrZero(readiness.generated_noise_exclusion?.effective_ignore_count),
      missing_ignore_paths: sanitizePathList(readiness.generated_noise_exclusion?.missing_ignore_paths),
    },
    cache: {
      status: String(readiness.cache?.status ?? ""),
      provenance_changed: Boolean(readiness.cache?.provenance_changed),
    },
    parser: {
      engine: String(readiness.parser?.engine ?? ""),
      source_file_count: numberOrZero(readiness.parser?.source_file_count),
      symbol_count: numberOrZero(readiness.parser?.symbol_count),
      warning_count: numberOrZero(readiness.parser?.warning_count),
    },
    documents: {
      count: numberOrZero(readiness.documents?.count),
      roots: sanitizePathList(readiness.documents?.roots),
    },
    blocking_errors: sanitizeMessageList(readiness.blocking_errors),
    warnings: sanitizeMessageList(readiness.warnings),
  };
}

function sanitizeMessageList(values = []) {
  return Array.isArray(values) ? values.map((value) => String(value)).filter(Boolean) : [];
}

function hasScanProvenanceSignal(provenance) {
  return Boolean(provenance) && typeof provenance === "object" && Object.keys(provenance).length > 0;
}

function sanitizePathList(paths = []) {
  return Array.isArray(paths)
    ? paths
        .filter((value) => typeof value === "string")
        .map((value) => sanitizeProvenancePath(value))
        .filter(Boolean)
    : [];
}

function sanitizeProvenancePath(candidatePath, repoRoot = "") {
  if (typeof candidatePath !== "string" || candidatePath.trim() === "") {
    return "";
  }

  const normalizedCandidate = normalizePath(candidatePath.trim());
  if (!path.isAbsolute(candidatePath)) {
    return normalizedCandidate;
  }

  if (typeof repoRoot === "string" && repoRoot.trim() !== "") {
    const resolvedRoot = path.resolve(repoRoot);
    const resolvedCandidate = path.resolve(candidatePath);
    if (resolvedCandidate === resolvedRoot) {
      return ".";
    }
    if (resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)) {
      return normalizePath(path.relative(resolvedRoot, resolvedCandidate));
    }
  }

  return path.basename(candidatePath);
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function resolveBenchmarkDestinations(repoRoot, { portalRoot, adminRoot } = {}) {
  const destinations = [];
  const candidates = [
    {
      kind: "portal",
      root: portalRoot ?? path.join(repoRoot, "apps", "portal"),
      explicit: Boolean(portalRoot),
    },
    {
      kind: "admin",
      root: adminRoot ?? path.join(repoRoot, "apps", "admin"),
      explicit: Boolean(adminRoot),
    },
  ];

  for (const candidate of candidates) {
    if (!candidate.root) {
      continue;
    }

    if (!candidate.explicit && !(await pathExists(candidate.root))) {
      continue;
    }

    destinations.push(candidate);
  }

  return destinations;
}

function createWebBenchmarkReport(report) {
  return {
    schema_version: 2,
    report_type: report.report_type ?? "scenario",
    report_id: report.report_id,
    repo: report.repo,
    profile_slug: report.profile_slug,
    workspace_slug: report.workspace_slug ?? report.profile_slug,
    customer_slug: report.customer_slug ?? report.profile_slug,
    scenario: report.scenario,
    provider: report.provider,
    model: report.model,
    generated_at: report.generated_at,
    framework: report.framework,
    baseline: report.baseline,
    assisted: report.assisted,
    metrics: report.metrics,
    summary: report.summary,
    manager_summary: report.manager_summary,
    technical_summary: report.technical_summary,
    provenance: sanitizePublishedProvenance(report.provenance ?? buildBenchmarkProvenance(report)),
    automation: report.automation,
    evidence: sanitizePublishedEvidence(report.evidence),
    evidence_bundle: sanitizeEvidenceBundle(report.evidence_bundle),
    evidence_manifest: buildPublishedEvidenceManifest(report),
  };
}

function createEvidenceRunPayload(kind, report, input = {}, options = {}) {
  return compactObject({
    schema_version: 2,
    run_kind: kind,
    report_id: report.report_id,
    repo: report.repo,
    profile_slug: report.profile_slug,
    scenario: report.scenario,
    provider: report.provider,
    model: report.model,
    generated_at: report.generated_at,
    metrics: normalizeRunMetrics(input),
    measurement: input.measurement ?? {
      mode: String(input.measurement_mode ?? "estimated"),
    },
    prompt: input.prompt ?? "",
    prompts: Array.isArray(input.prompts) ? input.prompts : [],
    tool_outputs: Array.isArray(input.tool_outputs) ? input.tool_outputs : [],
    output_artifacts: Array.isArray(input.output_artifacts) ? input.output_artifacts : [],
    evaluation_outputs: Array.isArray(input.evaluation_outputs) ? input.evaluation_outputs : [],
    context_pack: resolveContextPackArtifact(input),
    scan_provenance: kind === "assisted" ? options.scanProvenance : undefined,
    readiness: kind === "assisted" ? options.readiness : undefined,
  });
}

function createEvidenceEvaluationPayload(report, evaluation = {}, options = {}) {
  return {
    schema_version: 2,
    report_id: report.report_id,
    generated_at: report.generated_at,
    summary: report.summary,
    metrics: report.metrics,
    baseline: report.baseline,
    assisted: report.assisted,
    provenance: report.provenance ?? buildBenchmarkProvenance(report),
    framework: report.framework,
    evidence: report.evidence,
    evaluation,
    scan_provenance: sanitizeScanProvenance(options.scanProvenance),
    readiness: sanitizeWorkspaceReadiness(options.readiness),
  };
}

function buildEvidenceTraceMetadata({
  report = {},
  baselineInput = {},
  assistedInput = {},
  scenario = null,
  dataset = null,
  scanProvenance = null,
} = {}) {
  const provenance = sanitizePublishedProvenance(report.provenance ?? buildBenchmarkProvenance(report));

  return {
    provider: String(report.provider ?? ""),
    model: String(report.model ?? ""),
    task: String(scenario?.title ?? report.framework?.scenario?.title ?? report.scenario ?? ""),
    scenario_id: String(scenario?.id ?? report.framework?.scenario?.id ?? report.scenario ?? ""),
    dataset_id: String(dataset?.id ?? scenario?.dataset?.id ?? report.framework?.dataset?.id ?? ""),
    measurement_mode: String(provenance.summary.measurement_mode ?? "estimated"),
    run_ids: {
      baseline: String(
        provenance.baseline?.run_id ?? baselineInput.measurement?.run_id ?? baselineInput.run_id ?? "",
      ),
      assisted: String(
        provenance.assisted?.run_id ?? assistedInput.measurement?.run_id ?? assistedInput.run_id ?? "",
      ),
    },
    repo_snapshot: buildRepoSnapshotSummary(scanProvenance),
  };
}

function buildRepoSnapshotSummary(scanProvenance = null) {
  if (!scanProvenance?.available) {
    return {
      available: false,
    };
  }

  return {
    available: true,
    source: "scan_provenance",
    cache_schema_version: numberOrZero(scanProvenance.cache_schema_version),
    config_exists: Boolean(scanProvenance.config_exists),
    config_hash: String(scanProvenance.config_hash ?? ""),
    policy_exists: Boolean(scanProvenance.policy_exists),
    policy_hash: String(scanProvenance.policy_hash ?? ""),
    ignore_path_count: Array.isArray(scanProvenance.ignore_paths) ? scanProvenance.ignore_paths.length : 0,
    document_root_count: Array.isArray(scanProvenance.document_roots) ? scanProvenance.document_roots.length : 0,
  };
}

function buildArtifactList(files = {}) {
  return sanitizeArtifactList(Object.entries(files).map(([role, file]) => ({ role, file })));
}

function sanitizeArtifactList(artifacts = []) {
  if (!Array.isArray(artifacts)) {
    return [];
  }

  return artifacts
    .map((artifact) => ({
      role: String(artifact?.role ?? ""),
      file: sanitizeProvenancePath(String(artifact?.file ?? "")),
    }))
    .filter((artifact) => artifact.role && artifact.file)
    .sort(compareArtifacts);
}

function compareArtifacts(left, right) {
  const roleOrder = ["baseline", "assisted", "evaluation", "scenario", "dataset"];
  const leftRoleIndex = roleOrder.includes(left.role) ? roleOrder.indexOf(left.role) : roleOrder.length;
  const rightRoleIndex = roleOrder.includes(right.role) ? roleOrder.indexOf(right.role) : roleOrder.length;
  if (leftRoleIndex !== rightRoleIndex) {
    return leftRoleIndex - rightRoleIndex;
  }
  return `${left.role}:${left.file}`.localeCompare(`${right.role}:${right.file}`);
}

function sanitizeRunIds(runIds = {}) {
  return {
    baseline: String(runIds?.baseline ?? ""),
    assisted: String(runIds?.assisted ?? ""),
  };
}

function sanitizeRepoSnapshot(snapshot = null) {
  if (!snapshot?.available) {
    return {
      available: false,
    };
  }

  return {
    available: true,
    source: String(snapshot.source ?? "scan_provenance"),
    cache_schema_version: numberOrZero(snapshot.cache_schema_version),
    config_exists: Boolean(snapshot.config_exists),
    config_hash: String(snapshot.config_hash ?? ""),
    policy_exists: Boolean(snapshot.policy_exists),
    policy_hash: String(snapshot.policy_hash ?? ""),
    ignore_path_count: numberOrZero(snapshot.ignore_path_count),
    document_root_count: numberOrZero(snapshot.document_root_count),
  };
}

function sanitizeEvidenceBundle(bundle) {
  if (!bundle?.available) {
    return {
      available: false,
    };
  }

  return {
    available: true,
    bundle_id: bundle.bundle_id,
    generated_at: bundle.generated_at,
    files: bundle.files ?? {},
    baseline_summary: bundle.baseline_summary ?? {},
    assisted_summary: bundle.assisted_summary ?? {},
    provenance_summary: bundle.provenance_summary ?? {},
    scan_provenance: sanitizeScanProvenance(bundle.scan_provenance),
    readiness: sanitizeWorkspaceReadiness(bundle.readiness),
    provider: String(bundle.provider ?? ""),
    model: String(bundle.model ?? ""),
    task: String(bundle.task ?? ""),
    scenario_id: String(bundle.scenario_id ?? ""),
    dataset_id: String(bundle.dataset_id ?? ""),
    measurement_mode: String(bundle.measurement_mode ?? "estimated"),
    run_ids: sanitizeRunIds(bundle.run_ids),
    repo_snapshot: sanitizeRepoSnapshot(bundle.repo_snapshot),
    artifact_list: sanitizeArtifactList(bundle.artifact_list ?? buildArtifactList(bundle.files ?? {})),
  };
}

function buildPublishedEvidenceManifest(report) {
  const bundle = sanitizeEvidenceBundle(report.evidence_bundle);
  const provenance = sanitizePublishedProvenance(report.provenance ?? buildBenchmarkProvenance(report));
  const manifest = {
    schema_version: 2,
    available: bundle.available,
    bundle_id: bundle.bundle_id ?? "",
    report_id: report.report_id,
    repo: report.repo,
    profile_slug: report.profile_slug,
    scenario_id: report.scenario ?? report.framework?.scenario?.id ?? "",
    dataset_id: report.framework?.dataset?.id ?? bundle.dataset_id ?? "",
    provider: bundle.provider ?? String(report.provider ?? ""),
    model: bundle.model ?? String(report.model ?? ""),
    task: bundle.task ?? String(report.framework?.scenario?.title ?? report.scenario ?? ""),
    measurement_mode: bundle.measurement_mode ?? provenance.summary.measurement_mode,
    run_ids: sanitizeRunIds(bundle.run_ids),
    repo_snapshot: sanitizeRepoSnapshot(bundle.repo_snapshot),
    artifact_list: sanitizeArtifactList(bundle.artifact_list ?? buildArtifactList(bundle.files ?? {})),
    generated_at: bundle.generated_at ?? report.generated_at,
    bundle_file_count: Object.keys(bundle.files ?? {}).length,
    files: Object.entries(bundle.files ?? {}).map(([role, file]) => ({ role, file })),
    baseline: sanitizePublishedRunEvidence(bundle.baseline_summary),
    assisted: sanitizePublishedRunEvidence(bundle.assisted_summary),
    provenance_summary: provenance.summary,
    scan_provenance: sanitizeScanProvenance(bundle.scan_provenance),
    readiness: sanitizeWorkspaceReadiness(bundle.readiness),
    scenario: summarizeScenarioManifest(report.framework?.scenario),
    dataset: summarizeDatasetManifest(report.framework?.dataset),
  };

  if (!bundle.available) {
    return manifest;
  }

  return manifest;
}

function buildBenchmarkProvenance(report = {}) {
  const baseline = normalizeProvenanceMeasurement(report.baseline?.measurement, "baseline");
  const assisted = normalizeProvenanceMeasurement(report.assisted?.measurement, "assisted");
  const measurements = [baseline, assisted];
  const observed = measurements.filter((measurement) => measurement.mode === "observed");
  const observedCoveragePct =
    observed.length > 0
      ? roundNumber(
          observed.reduce((sum, measurement) => sum + measurement.observed_usage_coverage_pct, 0) /
            observed.length,
          1,
        )
      : 0;
  const measurementMode = summarizeMeasurementMode(measurements.map((measurement) => measurement.mode));
  const sampleSize = observed.length;

  return {
    summary: {
      measurement_mode: measurementMode,
      total_run_count: measurements.length,
      sample_size: sampleSize,
      observed_run_count: observed.length,
      observed_coverage_pct: observedCoveragePct,
      confidence_label: deriveProvenanceConfidenceLabel({
        measurementMode,
        sampleSize,
        observedCoveragePct,
      }),
    },
    baseline,
    assisted,
  };
}

function normalizeProvenanceMeasurement(measurement = {}, runKind = "") {
  return {
    run_kind: runKind,
    mode: String(measurement.mode ?? "estimated"),
    run_id: String(measurement.run_id ?? ""),
    observed_usage_coverage_pct: roundNumber(measurement.observed_usage_coverage_pct, 1),
    traced_call_count: numberOrZero(measurement.traced_call_count),
    observed_call_count: numberOrZero(measurement.observed_call_count),
    source: String(measurement.source ?? ""),
    note: String(measurement.note ?? ""),
  };
}

function summarizeMeasurementMode(modes = []) {
  const uniqueModes = dedupe(modes.filter(Boolean));
  if (uniqueModes.length === 0) {
    return "estimated";
  }
  if (uniqueModes.length === 1) {
    return uniqueModes[0];
  }
  return "mixed";
}

function deriveProvenanceConfidenceLabel({
  measurementMode = "estimated",
  sampleSize = 0,
  observedCoveragePct = 0,
} = {}) {
  if (measurementMode === "observed" && sampleSize >= 2 && observedCoveragePct >= 80) {
    return "high";
  }
  if (sampleSize >= 1 && observedCoveragePct >= 50) {
    return "medium";
  }
  return "low";
}

function sanitizePublishedProvenance(provenance = {}) {
  return {
    summary: {
      measurement_mode: String(provenance.summary?.measurement_mode ?? "estimated"),
      total_run_count: numberOrZero(provenance.summary?.total_run_count),
      sample_size: numberOrZero(provenance.summary?.sample_size),
      observed_run_count: numberOrZero(provenance.summary?.observed_run_count),
      observed_coverage_pct: roundNumber(provenance.summary?.observed_coverage_pct, 1),
      confidence_label: String(provenance.summary?.confidence_label ?? "low"),
    },
    baseline: normalizeProvenanceMeasurement(provenance.baseline, "baseline"),
    assisted: normalizeProvenanceMeasurement(provenance.assisted, "assisted"),
  };
}

function sanitizePublishedRunEvidence(summary = {}) {
  return {
    prompt_count: numberOrZero(summary.prompt_count),
    tool_output_count: numberOrZero(summary.tool_output_count),
    output_artifact_count: numberOrZero(summary.output_artifact_count),
    context_pack: sanitizePublishedContextPackEvidence(summary.context_pack),
  };
}

function sanitizePublishedEvidence(evidence = {}) {
  return {
    baseline: sanitizePublishedRunEvidence(evidence.baseline),
    assisted: sanitizePublishedRunEvidence(evidence.assisted),
  };
}

function sanitizePublishedContextPackEvidence(summary = {}) {
  if (!summary?.available) {
    return createEmptyContextPackEvidence();
  }

  return {
    available: true,
    token_budget: summary.token_budget ?? null,
    estimated_tokens: numberOrZero(summary.estimated_tokens),
    truncated: Boolean(summary.truncated),
    citation_count: numberOrZero(summary.citation_count),
    graph_citation_count: numberOrZero(summary.graph_citation_count),
    document_citation_count: numberOrZero(summary.document_citation_count),
    policy_citation_count: numberOrZero(summary.policy_citation_count),
    call_path_count: numberOrZero(summary.call_path_count),
    tests_to_run_count: numberOrZero(summary.tests_to_run_count),
    relevant_file_count: numberOrZero(summary.relevant_file_count),
    relevant_symbol_count: numberOrZero(summary.relevant_symbol_count),
    relevant_document_count: numberOrZero(summary.relevant_document_count),
    missing_context_warning_count: numberOrZero(summary.missing_context_warning_count),
    matched_task_token_pct: numberOrZero(summary.matched_task_token_pct),
    coverage_score: roundNumber(summary.coverage_score),
    compactness_score: roundNumber(summary.compactness_score),
    overall_evidence_score: roundNumber(summary.overall_evidence_score),
    top_citations: sanitizePublishedTopCitations(summary.top_citations ?? []),
  };
}

function sanitizePublishedTopCitations(citations = []) {
  return citations.slice(0, 3).map((citation) => ({
    type: citation.type,
    relation: citation.relation,
    title: compactText(citation.title, 64),
    from: citation.from,
    to: citation.to,
    rule_id: citation.rule_id,
    reason: compactText(citation.reason, 72),
  }));
}

function buildBenchmarkEvidence({
  baselineInput = {},
  assistedInput = {},
  scenarioManifest = null,
  datasetManifest = null,
} = {}) {
  return {
    baseline: summarizeRunEvidence(baselineInput),
    assisted: summarizeRunEvidence(assistedInput),
    scenario: summarizeScenarioManifest(scenarioManifest),
    dataset: summarizeDatasetManifest(datasetManifest),
  };
}

function summarizeRunEvidence(input = {}) {
  return {
    prompt_count: Array.isArray(input.prompts) ? input.prompts.length : input.prompt ? 1 : 0,
    tool_output_count: Array.isArray(input.tool_outputs) ? input.tool_outputs.length : 0,
    output_artifact_count: Array.isArray(input.output_artifacts) ? input.output_artifacts.length : 0,
    context_pack: summarizeContextPackEvidence(resolveContextPackArtifact(input)),
  };
}

function resolveContextPackArtifact(input = {}) {
  return input.context_pack ?? input.context_pack_artifact ?? input.artifacts?.context_pack ?? null;
}

function summarizeContextPackEvidence(pack) {
  if (!pack) {
    return createEmptyContextPackEvidence();
  }

  const fallbackSummary = createFallbackContextPackEvidence(pack);
  const summary = pack.evidence_summary ?? fallbackSummary;

  return {
    available: true,
    token_budget: pack.token_budget ?? null,
    estimated_tokens: numberOrZero(pack.estimated_tokens),
    truncated: Boolean(pack.truncated),
    citation_count: numberOrZero(summary.citation_count ?? fallbackSummary.citation_count),
    graph_citation_count: numberOrZero(summary.graph_citation_count ?? fallbackSummary.graph_citation_count),
    document_citation_count: numberOrZero(summary.document_citation_count ?? fallbackSummary.document_citation_count),
    policy_citation_count: numberOrZero(summary.policy_citation_count ?? fallbackSummary.policy_citation_count),
    call_path_count: numberOrZero(summary.call_path_count ?? fallbackSummary.call_path_count),
    tests_to_run_count: numberOrZero(summary.tests_to_run_count ?? fallbackSummary.tests_to_run_count),
    relevant_file_count: numberOrZero(summary.relevant_file_count ?? fallbackSummary.relevant_file_count),
    relevant_symbol_count: numberOrZero(summary.relevant_symbol_count ?? fallbackSummary.relevant_symbol_count),
    relevant_document_count: numberOrZero(summary.relevant_document_count ?? fallbackSummary.relevant_document_count),
    missing_context_warning_count: numberOrZero(
      summary.missing_context_warning_count ?? fallbackSummary.missing_context_warning_count,
    ),
    matched_task_token_pct: numberOrZero(summary.matched_task_token_pct ?? fallbackSummary.matched_task_token_pct),
    coverage_score: roundNumber(summary.coverage_score ?? fallbackSummary.coverage_score),
    compactness_score: roundNumber(summary.compactness_score ?? fallbackSummary.compactness_score),
    overall_evidence_score: roundNumber(
      summary.overall_evidence_score ?? fallbackSummary.overall_evidence_score,
    ),
    top_citations: sanitizeTopCitations(pack.citations ?? []),
  };
}

function createEmptyContextPackEvidence() {
  return {
    available: false,
    token_budget: null,
    estimated_tokens: 0,
    truncated: false,
    citation_count: 0,
    graph_citation_count: 0,
    document_citation_count: 0,
    policy_citation_count: 0,
    call_path_count: 0,
    tests_to_run_count: 0,
    relevant_file_count: 0,
    relevant_symbol_count: 0,
    relevant_document_count: 0,
    missing_context_warning_count: 0,
    matched_task_token_pct: 0,
    coverage_score: 0,
    compactness_score: 0,
    overall_evidence_score: 0,
    top_citations: [],
  };
}

function createFallbackContextPackEvidence(pack = {}) {
  const taskTokens = tokenize(pack.task ?? "");
  const haystack = buildContextPackHaystack(pack);
  const matchedTaskTokenPct =
    taskTokens.length === 0
      ? 100
      : Math.round((taskTokens.filter((token) => haystack.includes(token)).length / taskTokens.length) * 100);
  const citationCounts = countCitationTypes(pack.citations ?? []);
  const estimatedTokens = numberOrZero(pack.estimated_tokens);
  const coverageScore = roundNumber(
    clamp01(
      (matchedTaskTokenPct / 100) * 0.45 +
        Math.min((pack.citations ?? []).length, 4) / 4 * 0.2 +
        Math.min((pack.call_paths ?? []).length, 3) / 3 * 0.15 +
        Math.min((pack.tests_to_run ?? []).length, 2) / 2 * 0.1 +
        Math.min((pack.relevant_documents ?? []).length, 2) / 2 * 0.1,
    ),
  );
  const compactnessScore = roundNumber(
    clamp01(
      pack.token_budget
        ? Math.min(1, numberOrZero(pack.token_budget) / Math.max(estimatedTokens, numberOrZero(pack.token_budget), 1))
        : Math.max(0.35, 1 - Math.max(0, estimatedTokens - 1200) / 1800),
    ),
  );
  const overallEvidenceScore = roundNumber(
    clamp01(
      coverageScore * 0.55 + compactnessScore * 0.2 + clamp01(numberOrZero(pack.confidence?.overall)) * 0.25,
    ),
  );

  return {
    citation_count: (pack.citations ?? []).length,
    graph_citation_count: citationCounts.graph,
    document_citation_count: citationCounts.document,
    policy_citation_count: citationCounts.policy,
    call_path_count: (pack.call_paths ?? []).length,
    tests_to_run_count: (pack.tests_to_run ?? []).length,
    relevant_file_count: (pack.relevant_files ?? []).length,
    relevant_symbol_count: (pack.relevant_symbols ?? []).length,
    relevant_document_count: (pack.relevant_documents ?? []).length,
    missing_context_warning_count: (pack.missing_context_warnings ?? []).length,
    matched_task_token_pct: matchedTaskTokenPct,
    coverage_score: coverageScore,
    compactness_score: compactnessScore,
    overall_evidence_score: overallEvidenceScore,
  };
}

function buildContextPackHaystack(pack = {}) {
  return [
    (pack.relevant_files ?? []).map((file) => file.path ?? "").join(" "),
    (pack.relevant_symbols ?? []).map((symbol) => `${symbol.name ?? ""} ${symbol.file ?? ""}`).join(" "),
    (pack.relevant_documents ?? []).map((document) => `${document.path ?? ""} ${document.title ?? ""}`).join(" "),
    (pack.call_paths ?? []).map((callPath) => `${callPath.from ?? ""} ${callPath.to ?? ""}`).join(" "),
    (pack.tests_to_run ?? []).join(" "),
    (pack.citations ?? [])
      .map((citation) => [citation.path, citation.title, citation.from, citation.to, citation.rule_id].filter(Boolean).join(" "))
      .join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function countCitationTypes(citations = []) {
  return citations.reduce(
    (counts, citation) => {
      counts[citation.type] = (counts[citation.type] ?? 0) + 1;
      return counts;
    },
    {
      document: 0,
      graph: 0,
      policy: 0,
    },
  );
}

function sanitizeTopCitations(citations = []) {
  return citations.slice(0, 3).map((citation) => ({
    type: citation.type,
    relation: citation.relation,
    path: citation.path,
    title: compactText(citation.title, 64),
    from: citation.from,
    to: citation.to,
    rule_id: citation.rule_id,
    reason: compactText(citation.reason, 72),
  }));
}

function dedupe(values = []) {
  return [...new Set(values)];
}

function tokenize(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3);
}

function compactText(value, maxLength) {
  if (typeof value !== "string") {
    return value ?? "";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, numberOrZero(value)));
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeSlug(value) {
  return String(value ?? "benchmark")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "benchmark";
}

async function resolveScenarioPath(scenarioRef, repoRoot) {
  const directPath = path.resolve(repoRoot, scenarioRef);
  if (await pathExists(directPath)) {
    return directPath;
  }

  const namedPath = path.join(repoRoot, "benchmarks", "scenarios", `${sanitizeSlug(scenarioRef)}.json`);
  if (await pathExists(namedPath)) {
    return namedPath;
  }

  throw new Error(`Benchmark scenario not found: ${scenarioRef}`);
}
