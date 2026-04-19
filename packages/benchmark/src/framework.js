import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SCORE_WEIGHTS = {
  context_efficiency: 0.25,
  context_retention: 0.2,
  duplicate_avoidance: 0.2,
  code_quality: 0.2,
  delivery: 0.15,
};

const DEFAULT_RUBRIC_DIMENSIONS = [
  { id: "correctness", weight: 0.3 },
  { id: "architecture", weight: 0.25 },
  { id: "reuse", weight: 0.2 },
  { id: "testing", weight: 0.15 },
  { id: "intent_alignment", weight: 0.1 },
];

export async function loadBenchmarkScenarioManifest(scenarioRef, repoRoot) {
  const scenarioPath = await resolveNamedArtifactPath({
    ref: scenarioRef,
    repoRoot,
    folder: ["benchmarks", "scenarios"],
    label: "scenario",
  });
  const scenario = JSON.parse(await fs.readFile(scenarioPath, "utf8"));
  const dataset = scenario.dataset_id
    ? await loadBenchmarkDatasetManifest(scenario.dataset_id, repoRoot)
    : scenario.dataset
      ? await loadBenchmarkDatasetManifest(scenario.dataset, repoRoot)
      : null;

  return {
    schema_version: numberOrZero(scenario.schema_version) || 1,
    id: String(scenario.id ?? ""),
    title: String(scenario.title ?? scenario.id ?? ""),
    category: String(scenario.category ?? ""),
    description: String(scenario.description ?? ""),
    repo: String(scenario.repo ?? ""),
    profile_slug: String(scenario.profile_slug ?? ""),
    provider: String(scenario.provider ?? ""),
    model: String(scenario.model ?? ""),
    dataset_id: String(scenario.dataset_id ?? dataset?.id ?? ""),
    dataset,
    task: scenario.task ?? {},
    expected_documents: normalizePathList(scenario.expected_documents ?? []),
    reuse_targets: normalizePathList(scenario.reuse_targets ?? []),
    architecture_rules: Array.isArray(scenario.architecture_rules) ? scenario.architecture_rules : [],
    evaluation: scenario.evaluation ?? {},
    baseline: scenario.baseline ?? {},
    assisted: scenario.assisted ?? {},
    path: scenarioPath,
  };
}

export async function loadBenchmarkDatasetManifest(datasetRef, repoRoot) {
  const datasetPath = await resolveNamedArtifactPath({
    ref: datasetRef,
    repoRoot,
    folder: ["benchmarks", "datasets"],
    label: "dataset",
  });
  const dataset = JSON.parse(await fs.readFile(datasetPath, "utf8"));

  return {
    schema_version: numberOrZero(dataset.schema_version) || 1,
    id: String(dataset.id ?? ""),
    title: String(dataset.title ?? dataset.id ?? ""),
    repo_strategy: String(dataset.repo_strategy ?? ""),
    summary: String(dataset.summary ?? ""),
    source_paths: Array.isArray(dataset.source_paths) ? dataset.source_paths : [],
    documents: normalizePathList(dataset.documents ?? []),
    reuse_targets: normalizePathList(dataset.reuse_targets ?? []),
    policy_targets: Array.isArray(dataset.policy_targets) ? dataset.policy_targets : [],
    path: datasetPath,
  };
}

export async function listBenchmarkScenarioManifests(repoRoot) {
  const scenarioRoot = path.join(repoRoot, "benchmarks", "scenarios");
  let entries;

  try {
    entries = await fs.readdir(scenarioRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const manifests = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    manifests.push(await loadBenchmarkScenarioManifest(path.join(scenarioRoot, entry.name), repoRoot));
  }

  return manifests.sort((left, right) => left.id.localeCompare(right.id));
}

export function normalizeEvaluationConfig(evaluation = {}) {
  const rubricDimensions = normalizeWeights(
    (evaluation.rubric_dimensions ?? DEFAULT_RUBRIC_DIMENSIONS).map((dimension) =>
      typeof dimension === "string"
        ? { id: dimension, weight: 1 }
        : {
            id: sanitizeMetricKey(dimension.id ?? dimension.name ?? "criterion"),
            weight: numberOrZero(dimension.weight) || 1,
          },
    ),
  );

  return {
    weights: Object.fromEntries(
      normalizeWeights(
        Object.entries({ ...DEFAULT_SCORE_WEIGHTS, ...(evaluation.weights ?? evaluation.score_weights ?? {}) }).map(
          ([id, weight]) => ({ id, weight }),
        ),
      ).map((entry) => [entry.id, entry.weight]),
    ),
    rubric_dimensions: rubricDimensions,
    targets: {
      max_tokens: optionalNumber(evaluation.targets?.max_tokens),
      max_minutes: optionalNumber(evaluation.targets?.max_minutes),
      max_memory_refreshes: optionalNumber(evaluation.targets?.max_memory_refreshes),
      max_token_cost_usd: optionalNumber(evaluation.targets?.max_token_cost_usd),
      max_duplicates: optionalNumber(evaluation.targets?.max_duplicates),
      max_policy_violations: optionalNumber(evaluation.targets?.max_policy_violations),
      max_review_edits: optionalNumber(evaluation.targets?.max_review_edits),
    },
  };
}

export function normalizeBenchmarkRun(input = {}, evaluation = normalizeEvaluationConfig()) {
  const tokenBreakdown = normalizeTokenBreakdown(input);
  const tokenCostUsd = roundNumber(
    input.token_cost_usd ??
      estimateTokenCostUsd(tokenBreakdown.total_tokens, input.cost_per_1k_tokens_usd),
    4,
  );
  const contextRetention = normalizeContextRetention(input, evaluation.targets);
  const duplicateWork = normalizeDuplicateWork(input, evaluation.targets);
  const codeQuality = normalizeCodeQuality(input, evaluation);
  const delivery = normalizeDelivery(input, evaluation.targets);
  const contextEfficiencyScore = roundNumber(
    averageAvailable([
      scoreLowerBetter(tokenBreakdown.total_tokens, evaluation.targets.max_tokens),
      scoreLowerBetter(numberOrZero(input.minutes), evaluation.targets.max_minutes),
      scoreLowerBetter(numberOrZero(input.memory_refreshes), evaluation.targets.max_memory_refreshes),
      scoreLowerBetter(tokenCostUsd, evaluation.targets.max_token_cost_usd),
    ]),
    1,
  );
  const overallScore = roundNumber(
    weightedAverage(
      [
        { value: contextEfficiencyScore, weight: evaluation.weights.context_efficiency },
        { value: contextRetention.score_pct, weight: evaluation.weights.context_retention },
        { value: duplicateWork.score_pct, weight: evaluation.weights.duplicate_avoidance },
        { value: codeQuality.score_pct, weight: evaluation.weights.code_quality },
        { value: delivery.score_pct, weight: evaluation.weights.delivery },
      ],
      0,
    ),
    1,
  );

  return {
    tokens: tokenBreakdown.total_tokens,
    minutes: roundNumber(numberOrZero(input.minutes), 1),
    duplicates: numberOrZero(input.duplicates),
    policy_violations: numberOrZero(input.policy_violations),
    review_edits: numberOrZero(input.review_edits),
    memory_refreshes: numberOrZero(input.memory_refreshes),
    token_cost_usd: tokenCostUsd,
    token_breakdown: tokenBreakdown,
    measurement: normalizeMeasurement(input),
    context_retention: contextRetention,
    duplicate_work: duplicateWork,
    code_quality: codeQuality,
    delivery,
    scorecard: {
      context_efficiency: {
        score_pct: contextEfficiencyScore,
        targets: compactObject({
          max_tokens: evaluation.targets.max_tokens,
          max_minutes: evaluation.targets.max_minutes,
          max_memory_refreshes: evaluation.targets.max_memory_refreshes,
          max_token_cost_usd: evaluation.targets.max_token_cost_usd,
        }),
      },
      context_retention: contextRetention,
      duplicate_avoidance: duplicateWork,
      code_quality: codeQuality,
      delivery,
      overall: {
        score_pct: overallScore,
        weights: evaluation.weights,
      },
    },
  };
}

export function mergeObservedRunIntoBenchmarkInput(input = {}, observedRun = null) {
  const measurement = createMeasurementMetadata(input.measurement, observedRun);
  if (!observedRun) {
    return {
      ...input,
      measurement,
    };
  }

  return {
    ...input,
    tokens: numberOrZero(observedRun.total_tokens),
    minutes: roundNumber(
      observedRun.elapsed_minutes ??
        (Number.isFinite(Number(observedRun.duration_ms))
          ? Number(observedRun.duration_ms) / 60_000
          : input.minutes),
      1,
    ),
    token_cost_usd:
      observedRun.token_cost_usd ?? observedRun.cost_usd ?? input.token_cost_usd,
    prompt_tokens: numberOrZero(observedRun.prompt_tokens),
    completion_tokens: numberOrZero(observedRun.completion_tokens),
    token_breakdown: compactObject({
      ...(input.token_breakdown ?? {}),
      prompt_tokens: numberOrZero(observedRun.prompt_tokens),
      completion_tokens: numberOrZero(observedRun.completion_tokens),
      other_tokens: Math.max(
        0,
        numberOrZero(observedRun.total_tokens) -
          numberOrZero(observedRun.prompt_tokens) -
          numberOrZero(observedRun.completion_tokens),
      ),
    }),
    measurement,
  };
}

export function buildFrameworkSummary({ scenarioManifest, datasetManifest, evaluation }) {
  return {
    scenario: {
      id: String(scenarioManifest?.id ?? ""),
      title: String(scenarioManifest?.title ?? scenarioManifest?.id ?? ""),
      category: String(scenarioManifest?.category ?? ""),
      dataset_id: String(datasetManifest?.id ?? scenarioManifest?.dataset_id ?? ""),
      description: String(scenarioManifest?.description ?? ""),
      task_statement: String(scenarioManifest?.task?.statement ?? scenarioManifest?.task?.prompt ?? ""),
      follow_up_prompts: Array.isArray(scenarioManifest?.task?.follow_up_prompts)
        ? scenarioManifest.task.follow_up_prompts
        : [],
      expected_documents: normalizePathList(
        scenarioManifest?.expected_documents ?? datasetManifest?.documents ?? [],
      ),
      reuse_targets: normalizePathList(scenarioManifest?.reuse_targets ?? datasetManifest?.reuse_targets ?? []),
      architecture_rules: Array.isArray(scenarioManifest?.architecture_rules)
        ? scenarioManifest.architecture_rules
        : [],
    },
    dataset: {
      id: String(datasetManifest?.id ?? ""),
      title: String(datasetManifest?.title ?? datasetManifest?.id ?? ""),
      repo_strategy: String(datasetManifest?.repo_strategy ?? ""),
      summary: String(datasetManifest?.summary ?? ""),
      source_paths: Array.isArray(datasetManifest?.source_paths) ? datasetManifest.source_paths : [],
      document_count: Array.isArray(datasetManifest?.documents) ? datasetManifest.documents.length : 0,
      reuse_target_count: Array.isArray(datasetManifest?.reuse_targets)
        ? datasetManifest.reuse_targets.length
        : 0,
    },
    evaluation: {
      weights: evaluation.weights,
      targets: compactObject(evaluation.targets),
      rubric_dimensions: evaluation.rubric_dimensions,
    },
  };
}

export function buildBenchmarkDeltaMetrics({ baseline, assisted }) {
  return {
    context_efficiency_gain_pct: roundNumber(
      assisted.scorecard.context_efficiency.score_pct - baseline.scorecard.context_efficiency.score_pct,
      1,
    ),
    context_retention_gain_pct: roundNumber(
      assisted.scorecard.context_retention.score_pct - baseline.scorecard.context_retention.score_pct,
      1,
    ),
    duplicate_avoidance_gain_pct: roundNumber(
      assisted.scorecard.duplicate_avoidance.score_pct - baseline.scorecard.duplicate_avoidance.score_pct,
      1,
    ),
    code_quality_gain_pct: roundNumber(
      assisted.scorecard.code_quality.score_pct - baseline.scorecard.code_quality.score_pct,
      1,
    ),
    delivery_gain_pct: roundNumber(
      assisted.scorecard.delivery.score_pct - baseline.scorecard.delivery.score_pct,
      1,
    ),
    overall_score_gain_pct: roundNumber(
      assisted.scorecard.overall.score_pct - baseline.scorecard.overall.score_pct,
      1,
    ),
  };
}

export function createSuiteReport({ reports = [], repo, profileSlug, generatedAt, suiteId }) {
  const aggregate = aggregateSuiteMetrics(reports);
  return {
    schema_version: 1,
    report_type: "suite",
    suite_id: sanitizeSlug(suiteId ?? `${profileSlug ?? repo ?? "benchmark"}-suite-${Date.now()}`),
    repo: repo ?? "unknown-repo",
    profile_slug: sanitizeSlug(profileSlug ?? repo ?? "benchmark"),
    generated_at: generatedAt ?? new Date().toISOString(),
    scenario_count: reports.length,
    dataset_count: new Set(reports.map((report) => report.framework?.dataset?.id).filter(Boolean)).size,
    aggregate_metrics: aggregate,
    summary: `Benchmark suite ran ${reports.length} scenarios with ${aggregate.avg_token_savings_pct}% average token savings and ${aggregate.avg_code_quality_gain_pct}% average code-quality improvement.`,
    manager_summary: `Across ${reports.length} scenarios, benchmark evidence shows ${aggregate.avg_token_savings_pct}% average token savings, $${aggregate.avg_token_cost_savings_usd.toFixed(2)} direct token savings per scenario, and ${aggregate.avg_context_retention_gain_pct}% better context retention.`,
    technical_summary: `Average duplicate avoidance improved by ${aggregate.avg_duplicate_avoidance_gain_pct}% and average overall scenario score improved by ${aggregate.avg_overall_score_gain_pct}%.`,
    automation: {
      commands: {
        run_suite: "heart benchmark run --all",
        run_scenario_prefix: "heart benchmark run <scenario-id>",
        compare_runs: "heart benchmark compare baseline.json assisted.json",
      },
    },
    scenarios: reports.map((report) => ({
      report_id: report.report_id,
      scenario: report.scenario,
      title: report.framework?.scenario?.title ?? report.scenario,
      category: report.framework?.scenario?.category ?? "",
      dataset_id: report.framework?.dataset?.id ?? "",
      metrics: report.metrics,
    })),
  };
}

export function renderScenarioReportMarkdown(report) {
  return `# Benchmark Report: ${report.framework?.scenario?.title || report.scenario}

Generated: ${report.generated_at}
Scenario: ${report.scenario}
Dataset: ${report.framework?.dataset?.title || report.framework?.dataset?.id || "n/a"}

## Executive Summary

- ${report.summary}
- ${report.manager_summary}
- ${report.technical_summary}

## Metric Deltas

| Metric | Value |
| --- | ---: |
| Token savings | ${numberOrZero(report.metrics?.token_savings_pct)}% |
| Time savings | ${numberOrZero(report.metrics?.time_savings_pct)}% |
| Cost savings | $${numberOrZero(report.metrics?.token_cost_savings_usd).toFixed(2)} |
| Context retention gain | ${numberOrZero(report.metrics?.context_retention_gain_pct)}% |
| Duplicate avoidance gain | ${numberOrZero(report.metrics?.duplicate_avoidance_gain_pct)}% |
| Code quality gain | ${numberOrZero(report.metrics?.code_quality_gain_pct)}% |
| Overall score gain | ${numberOrZero(report.metrics?.overall_score_gain_pct)}% |
`;
}

export function renderSuiteReportMarkdown(suiteReport) {
  const rows = (suiteReport.scenarios ?? [])
    .map(
      (scenario) =>
        `| ${scenario.scenario} | ${scenario.category || "n/a"} | ${numberOrZero(scenario.metrics?.token_savings_pct)}% | ${numberOrZero(scenario.metrics?.code_quality_gain_pct)}% | ${numberOrZero(scenario.metrics?.overall_score_gain_pct)}% |`,
    )
    .join("\n");

  return `# Benchmark Suite Report

Generated: ${suiteReport.generated_at}
Scenario count: ${suiteReport.scenario_count}

## Aggregate Metrics

| Metric | Value |
| --- | ---: |
| Average token savings | ${numberOrZero(suiteReport.aggregate_metrics?.avg_token_savings_pct)}% |
| Average time savings | ${numberOrZero(suiteReport.aggregate_metrics?.avg_time_savings_pct)}% |
| Average direct token savings | $${numberOrZero(suiteReport.aggregate_metrics?.avg_token_cost_savings_usd).toFixed(2)} |
| Average context retention gain | ${numberOrZero(suiteReport.aggregate_metrics?.avg_context_retention_gain_pct)}% |
| Average duplicate avoidance gain | ${numberOrZero(suiteReport.aggregate_metrics?.avg_duplicate_avoidance_gain_pct)}% |
| Average code quality gain | ${numberOrZero(suiteReport.aggregate_metrics?.avg_code_quality_gain_pct)}% |
| Average overall score gain | ${numberOrZero(suiteReport.aggregate_metrics?.avg_overall_score_gain_pct)}% |

## Scenario Breakdown

| Scenario | Category | Token savings | Code quality gain | Overall score gain |
| --- | --- | ---: | ---: | ---: |
${rows}
`;
}

function normalizeTokenBreakdown(input = {}) {
  const breakdown = input.token_breakdown ?? {};
  const prompt_tokens = numberOrZero(breakdown.prompt_tokens ?? input.prompt_tokens);
  const discovery_tokens = numberOrZero(breakdown.discovery_tokens ?? input.discovery_tokens);
  const tool_tokens = numberOrZero(breakdown.tool_tokens ?? input.tool_tokens);
  const completion_tokens = numberOrZero(breakdown.completion_tokens ?? input.completion_tokens);
  const subtotal = prompt_tokens + discovery_tokens + tool_tokens + completion_tokens;
  const total_tokens = numberOrZero(input.tokens) || subtotal;

  return {
    prompt_tokens,
    discovery_tokens,
    tool_tokens,
    completion_tokens,
    other_tokens: Math.max(0, total_tokens - subtotal),
    total_tokens,
  };
}

function normalizeMeasurement(input = {}) {
  const measurement = input.measurement ?? {};

  return {
    mode: String(measurement.mode ?? input.measurement_mode ?? "estimated"),
    run_id: String(measurement.run_id ?? input.run_id ?? ""),
    observed_usage_coverage_pct: roundNumber(
      measurement.observed_usage_coverage_pct ?? input.observed_usage_coverage_pct,
      1,
    ),
    traced_call_count: numberOrZero(measurement.traced_call_count ?? input.traced_call_count),
    observed_call_count: numberOrZero(measurement.observed_call_count ?? input.observed_call_count),
    source: String(measurement.source ?? input.measurement_source ?? ""),
    note: String(measurement.note ?? input.measurement_note ?? ""),
  };
}

function createMeasurementMetadata(existing = {}, observedRun = null) {
  if (!observedRun) {
    return normalizeMeasurement({
      measurement: existing,
    });
  }

  return normalizeMeasurement({
    measurement: {
      ...existing,
      mode: observedRun.measurement_mode ?? existing.mode ?? "estimated",
      run_id: observedRun.run_id ?? existing.run_id ?? "",
      observed_usage_coverage_pct:
        observedRun.observed_usage_coverage_pct ?? existing.observed_usage_coverage_pct,
      traced_call_count: observedRun.traced_call_count ?? existing.traced_call_count,
      observed_call_count: observedRun.observed_call_count ?? existing.observed_call_count,
      source: observedRun.source ?? existing.source ?? "agent_run",
      note: observedRun.note ?? existing.note ?? "",
    },
  });
}

function normalizeContextRetention(input = {}, targets = {}) {
  const section = input.context_retention ?? {};
  const checkpointPassPct = ratioPercent(section.checkpoints_passed ?? input.context_retention_checks_passed, section.checkpoints_total ?? input.context_retention_checks_total);
  const documentHitPct = ratioPercent(section.document_hits ?? input.document_reference_hits, section.document_targets ?? input.document_reference_targets);
  const handoffPct = ratioPercent(section.handoff_successes ?? input.handoff_successes, section.handoff_attempts ?? input.handoff_attempts);
  const refreshScore = scoreLowerBetter(numberOrZero(input.memory_refreshes), targets.max_memory_refreshes);

  return {
    checkpoints_passed: numberOrZero(section.checkpoints_passed ?? input.context_retention_checks_passed),
    checkpoints_total: numberOrZero(section.checkpoints_total ?? input.context_retention_checks_total),
    checkpoint_pass_pct: checkpointPassPct,
    document_hits: numberOrZero(section.document_hits ?? input.document_reference_hits),
    document_targets: numberOrZero(section.document_targets ?? input.document_reference_targets),
    document_hit_pct: documentHitPct,
    handoff_successes: numberOrZero(section.handoff_successes ?? input.handoff_successes),
    handoff_attempts: numberOrZero(section.handoff_attempts ?? input.handoff_attempts),
    handoff_success_pct: handoffPct,
    score_pct: roundNumber(averageAvailable([checkpointPassPct, documentHitPct, handoffPct, refreshScore]), 1),
  };
}

function normalizeDuplicateWork(input = {}, targets = {}) {
  const section = input.duplicate_work ?? {};
  const reuseHitPct = ratioPercent(section.reuse_hits ?? input.reuse_hits, section.reuse_targets ?? input.reuse_targets);
  const checkPassPct = ratioPercent(section.checks_passed ?? input.duplicate_avoidance_checks_passed, section.checks_total ?? input.duplicate_avoidance_checks_total);
  const duplicateTargetScore = scoreLowerBetter(
    numberOrZero(section.duplicate_introductions ?? input.duplicate_introductions ?? input.duplicates),
    targets.max_duplicates,
  );

  return {
    reuse_hits: numberOrZero(section.reuse_hits ?? input.reuse_hits),
    reuse_targets: numberOrZero(section.reuse_targets ?? input.reuse_targets),
    reuse_hit_pct: reuseHitPct,
    checks_passed: numberOrZero(section.checks_passed ?? input.duplicate_avoidance_checks_passed),
    checks_total: numberOrZero(section.checks_total ?? input.duplicate_avoidance_checks_total),
    checks_pass_pct: checkPassPct,
    duplicate_introductions: numberOrZero(section.duplicate_introductions ?? input.duplicate_introductions ?? input.duplicates),
    score_pct: roundNumber(averageAvailable([reuseHitPct, checkPassPct, duplicateTargetScore]), 1),
  };
}

function normalizeCodeQuality(input = {}, evaluation = {}) {
  const section = input.code_quality ?? {};
  const rubricScores = Object.fromEntries(
    (evaluation.rubric_dimensions ?? DEFAULT_RUBRIC_DIMENSIONS).map((dimension) => [
      dimension.id,
      Math.max(0, Math.min(5, numberOrZero(section.rubric_scores?.[dimension.id] ?? input.rubric_scores?.[dimension.id]))),
    ]),
  );
  const rubricScorePct = roundNumber(
    weightedAverage(
      (evaluation.rubric_dimensions ?? DEFAULT_RUBRIC_DIMENSIONS).map((dimension) => ({
        value: ratioPercent(rubricScores[dimension.id], 5),
        weight: dimension.weight,
      })),
      0,
    ),
    1,
  );
  const testPassPct = ratioPercent(section.tests_passed ?? input.tests_passed, section.tests_total ?? input.tests_total);
  const policyScore = scoreLowerBetter(numberOrZero(input.policy_violations), evaluation.targets?.max_policy_violations);
  const reviewScore = scoreLowerBetter(numberOrZero(input.review_edits), evaluation.targets?.max_review_edits);

  return {
    rubric_scores: rubricScores,
    rubric_score_pct: rubricScorePct,
    tests_passed: numberOrZero(section.tests_passed ?? input.tests_passed),
    tests_total: numberOrZero(section.tests_total ?? input.tests_total),
    test_pass_pct: testPassPct,
    score_pct: roundNumber(averageAvailable([rubricScorePct, testPassPct, policyScore, reviewScore]), 1),
  };
}

function normalizeDelivery(input = {}, targets = {}) {
  const section = input.delivery ?? {};
  const tasks_passed = numberOrZero(section.tasks_passed ?? input.tasks_passed);
  const tasks_total = numberOrZero(section.tasks_total ?? input.tasks_total);
  const task_success = Boolean(section.task_success ?? input.task_success ?? tasks_passed > 0);
  const task_success_pct = tasks_total > 0 ? ratioPercent(tasks_passed, tasks_total) : task_success ? 100 : 0;
  const timeScore = scoreLowerBetter(numberOrZero(input.minutes), targets.max_minutes);

  return {
    tasks_passed,
    tasks_total,
    task_success,
    task_success_pct,
    score_pct: roundNumber(averageAvailable([task_success_pct, timeScore]), 1),
  };
}

function aggregateSuiteMetrics(reports = []) {
  return {
    report_count: reports.length,
    avg_token_savings_pct: averageMetric(reports, "token_savings_pct"),
    avg_time_savings_pct: averageMetric(reports, "time_savings_pct"),
    avg_token_cost_savings_usd: averageMetric(reports, "token_cost_savings_usd"),
    avg_context_retention_gain_pct: averageMetric(reports, "context_retention_gain_pct"),
    avg_duplicate_avoidance_gain_pct: averageMetric(reports, "duplicate_avoidance_gain_pct"),
    avg_code_quality_gain_pct: averageMetric(reports, "code_quality_gain_pct"),
    avg_overall_score_gain_pct: averageMetric(reports, "overall_score_gain_pct"),
  };
}

function averageMetric(reports = [], key) {
  if (reports.length === 0) {
    return 0;
  }
  return roundNumber(reports.reduce((sum, report) => sum + numberOrZero(report.metrics?.[key]), 0) / reports.length, 1);
}

function normalizePathList(entries = []) {
  return (entries ?? []).map((entry) =>
    typeof entry === "string"
      ? { path: entry }
      : { path: entry.path ?? "", title: entry.title ?? "", reason: entry.reason ?? "" },
  );
}

function normalizeWeights(entries = []) {
  const total = entries.reduce((sum, entry) => sum + numberOrZero(entry.weight), 0);
  if (total <= 0) {
    const fallback = entries.length > 0 ? 1 / entries.length : 0;
    return entries.map((entry) => ({ ...entry, weight: fallback }));
  }
  return entries.map((entry) => ({ ...entry, weight: numberOrZero(entry.weight) / total }));
}

function scoreLowerBetter(actual, target) {
  if (target === undefined || target === null) {
    return undefined;
  }
  if (numberOrZero(target) === 0) {
    return numberOrZero(actual) === 0 ? 100 : 0;
  }
  if (numberOrZero(actual) <= numberOrZero(target)) {
    return 100;
  }
  return roundNumber((numberOrZero(target) / Math.max(numberOrZero(actual), numberOrZero(target), 1)) * 100, 1);
}

function ratioPercent(numerator, denominator) {
  if (numberOrZero(denominator) <= 0) {
    return undefined;
  }
  return roundNumber((numberOrZero(numerator) / numberOrZero(denominator)) * 100, 1);
}

function averageAvailable(values = []) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length === 0) {
    return 0;
  }
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function weightedAverage(entries = [], fallback = 0) {
  const usable = entries.filter((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.weight));
  if (usable.length === 0) {
    return fallback;
  }
  const weightTotal = usable.reduce((sum, entry) => sum + entry.weight, 0);
  if (weightTotal <= 0) {
    return fallback;
  }
  return usable.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / weightTotal;
}

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null));
}

function estimateTokenCostUsd(tokens, costPerThousand = 0.01) {
  return (tokens / 1000) * numberOrZero(costPerThousand);
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function optionalNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function roundNumber(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(numberOrZero(value) * factor) / factor;
}

function sanitizeMetricKey(value) {
  return String(value ?? "criterion")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "criterion";
}

function sanitizeSlug(value) {
  return String(value ?? "benchmark")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "benchmark";
}

async function resolveNamedArtifactPath({ ref, repoRoot, folder, label }) {
  const directPath = path.resolve(repoRoot, ref);
  if (await pathExists(directPath)) {
    return directPath;
  }
  const namedPath = path.join(repoRoot, ...folder, `${sanitizeSlug(ref)}.json`);
  if (await pathExists(namedPath)) {
    return namedPath;
  }
  throw new Error(`Benchmark ${label} not found: ${ref}`);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
