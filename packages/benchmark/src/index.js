import fs from "node:fs/promises";
import path from "node:path";
import {
  publishBenchmarksToSurface,
  publishWorkspacesToSurface,
  resolveServiceStorageRoot,
  writeBenchmarkArtifactRecord,
} from "../../../services/api/src/storage.js";
export { buildBenchmarkTrendDigest } from "./trends.js";

export function compareBenchmarkRuns(baselineInput, assistedInput, metadata = {}) {
  const baseline = normalizeRunMetrics(baselineInput);
  const assisted = normalizeRunMetrics(assistedInput);
  const reportId = sanitizeSlug(
    metadata.report_id ??
      `${metadata.profile_slug ?? metadata.repo ?? "benchmark"}-${metadata.scenario ?? "comparison"}-${Date.now()}`,
  );
  const generatedAt = metadata.generated_at ?? new Date().toISOString();

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
  const composite_roi_score = roundNumber(
    (
      token_savings_pct +
      time_savings_pct +
      duplicate_reduction_pct +
      review_edit_reduction_pct +
      memory_refresh_reduction_pct
    ) / 5,
    1,
  );

  return {
    schema_version: 1,
    report_id: reportId,
    repo: metadata.repo ?? "unknown-repo",
    profile_slug: sanitizeSlug(metadata.profile_slug ?? metadata.repo ?? "benchmark"),
    scenario: metadata.scenario ?? "comparison",
    provider: metadata.provider ?? "",
    model: metadata.model ?? "",
    generated_at: generatedAt,
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
      composite_roi_score,
    },
    summary: `Token usage improved by ${token_savings_pct}% and review edits improved by ${review_edit_reduction_pct}%.`,
    manager_summary: buildManagerSummary({
      token_savings_pct,
      time_savings_pct,
      token_cost_savings_usd,
      review_edit_reduction_pct,
      memory_refresh_reduction_pct,
    }),
    technical_summary: buildTechnicalSummary({
      duplicate_reduction_pct,
      policy_violation_reduction_pct,
      review_edit_reduction_pct,
      memory_refresh_reduction_pct,
    }),
  };
}

export async function runBenchmarkScenario(scenarioRef, options = {}) {
  const scenario = await loadBenchmarkScenario(scenarioRef, options.repoRoot ?? process.cwd());

  return compareBenchmarkRuns(scenario.baseline, scenario.assisted, {
    repo: options.repo ?? scenario.repo ?? path.basename(options.repoRoot ?? process.cwd()),
    profile_slug: options.profile_slug ?? scenario.profile_slug ?? scenario.repo ?? "benchmark",
    scenario: options.scenario ?? scenario.id,
    provider: options.provider ?? scenario.provider ?? "",
    model: options.model ?? scenario.model ?? "",
    report_id: options.report_id,
    generated_at: options.generated_at,
  });
}

export async function writeBenchmarkReport(repoRoot, report) {
  const benchmarkRoot = path.join(repoRoot, ".heart", "benchmarks");
  await fs.mkdir(benchmarkRoot, { recursive: true });

  const reportPath = path.join(benchmarkRoot, `${report.report_id}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    benchmark_root: benchmarkRoot,
    report_path: reportPath,
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
  const scenarioPath = await resolveScenarioPath(scenarioRef, repoRoot);
  const scenario = JSON.parse(await fs.readFile(scenarioPath, "utf8"));

  return {
    ...scenario,
    path: scenarioPath,
  };
}

function percentReduction(before, after) {
  if (before === 0) {
    return 0;
  }

  return Math.round(((before - after) / before) * 100);
}

function normalizeRunMetrics(input = {}) {
  return {
    tokens: numberOrZero(input.tokens),
    minutes: roundNumber(numberOrZero(input.minutes), 1),
    duplicates: numberOrZero(input.duplicates),
    policy_violations: numberOrZero(input.policy_violations),
    review_edits: numberOrZero(input.review_edits),
    memory_refreshes: numberOrZero(input.memory_refreshes),
    token_cost_usd: roundNumber(
      input.token_cost_usd ?? estimateTokenCostUsd(numberOrZero(input.tokens), input.cost_per_1k_tokens_usd),
      4,
    ),
  };
}

function estimateTokenCostUsd(tokens, costPerThousand = 0.01) {
  return (tokens / 1000) * numberOrZero(costPerThousand);
}

function buildManagerSummary(metrics) {
  return `Benchmark shows ${metrics.token_savings_pct}% lower token usage, ${metrics.time_savings_pct}% faster completion, ${metrics.memory_refresh_reduction_pct}% fewer context reloads, and $${metrics.token_cost_savings_usd.toFixed(2)} lower direct token spend per compared run.`;
}

function buildTechnicalSummary(metrics) {
  return `Duplicate work dropped by ${metrics.duplicate_reduction_pct}% while policy violations improved by ${metrics.policy_violation_reduction_pct}%, review edits improved by ${metrics.review_edit_reduction_pct}%, and memory refreshes dropped by ${metrics.memory_refresh_reduction_pct}%.`;
}

function roundNumber(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(numberOrZero(value) * factor) / factor;
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
    schema_version: 1,
    report_id: report.report_id,
    repo: report.repo,
    profile_slug: report.profile_slug,
    workspace_slug: report.workspace_slug ?? report.profile_slug,
    customer_slug: report.customer_slug ?? report.profile_slug,
    scenario: report.scenario,
    provider: report.provider,
    model: report.model,
    generated_at: report.generated_at,
    baseline: report.baseline,
    assisted: report.assisted,
    metrics: report.metrics,
    summary: report.summary,
    manager_summary: report.manager_summary,
    technical_summary: report.technical_summary,
  };
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
