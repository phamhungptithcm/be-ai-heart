export function buildBenchmarkTrendDigest(reports = []) {
  const normalizedReports = [...reports]
    .filter(Boolean)
    .map(normalizeTrendReport)
    .sort((left, right) => left.generated_at.localeCompare(right.generated_at));

  const latest = normalizedReports[normalizedReports.length - 1] ?? null;
  const measurementCounts = countBy(normalizedReports, (report) => report.provenance.measurement_mode);
  const evidenceAvailableCount = normalizedReports.filter((report) => report.evidence.available).length;
  const repositoryRows = summarizeTrendGroups(normalizedReports, "repo");
  const scenarioRows = summarizeTrendGroups(normalizedReports, "scenario");

  return {
    summary: {
      report_count: normalizedReports.length,
      latest_token_savings_pct: latest?.metrics.token_savings_pct ?? 0,
      latest_cost_savings_usd: latest?.metrics.token_cost_savings_usd ?? 0,
      latest_memory_refresh_reduction_pct: latest?.metrics.memory_refresh_reduction_pct ?? 0,
      latest_composite_roi_score: latest?.metrics.composite_roi_score ?? 0,
      latest_evidence_quality_score: latest?.metrics.evidence_quality_score ?? 0,
      latest_measurement_mode: latest?.provenance.measurement_mode ?? "",
      latest_confidence_label: latest?.provenance.confidence_label ?? "",
      avg_token_savings_pct: average(normalizedReports.map((report) => report.metrics.token_savings_pct)),
      avg_cost_savings_usd: average(normalizedReports.map((report) => report.metrics.token_cost_savings_usd)),
      avg_memory_refresh_reduction_pct: average(
        normalizedReports.map((report) => report.metrics.memory_refresh_reduction_pct),
      ),
      avg_composite_roi_score: average(normalizedReports.map((report) => report.metrics.composite_roi_score)),
      avg_evidence_quality_score: average(
        normalizedReports.map((report) => report.metrics.evidence_quality_score),
      ),
      observed_report_count: measurementCounts.observed ?? 0,
      mixed_report_count: measurementCounts.mixed ?? 0,
      estimated_report_count: measurementCounts.estimated ?? 0,
      evidence_available_count: evidenceAvailableCount,
      evidence_quality_label: createEvidenceQualityLabel(
        average(normalizedReports.map((report) => report.metrics.evidence_quality_score)),
      ),
      top_repository: repositoryRows[0] ?? null,
      top_scenario: scenarioRows[0] ?? null,
    },
    series: {
      token_savings_pct: normalizedReports.map((report) => createSeriesPoint(report, "token_savings_pct")),
      token_cost_savings_usd: normalizedReports.map((report) => createSeriesPoint(report, "token_cost_savings_usd")),
      memory_refresh_reduction_pct: normalizedReports.map((report) =>
        createSeriesPoint(report, "memory_refresh_reduction_pct"),
      ),
      composite_roi_score: normalizedReports.map((report) => createSeriesPoint(report, "composite_roi_score")),
      evidence_quality_score: normalizedReports.map((report) => createSeriesPoint(report, "evidence_quality_score")),
    },
  };
}

function normalizeTrendReport(report = {}) {
  const provenanceSummary = report.provenance?.summary ?? report.evidence_manifest?.provenance_summary ?? {};
  const measurementMode = normalizeMeasurementMode(provenanceSummary.measurement_mode);
  const confidenceLabel = normalizeConfidenceLabel(provenanceSummary.confidence_label);
  const evidenceAvailable = Boolean(
    report.evidence_bundle?.available ||
      report.evidence_manifest?.bundle_id ||
      report.evidence_manifest?.artifact_list?.length,
  );

  return {
    report_id: String(report.report_id ?? ""),
    repo: String(report.repo ?? ""),
    scenario: String(report.scenario ?? ""),
    generated_at: String(report.generated_at ?? ""),
    metrics: {
      token_savings_pct: numberOrZero(report.metrics?.token_savings_pct),
      token_cost_savings_usd: round(numberOrZero(report.metrics?.token_cost_savings_usd)),
      memory_refresh_reduction_pct: numberOrZero(report.metrics?.memory_refresh_reduction_pct),
      composite_roi_score: numberOrZero(report.metrics?.composite_roi_score),
      evidence_quality_score: computeEvidenceQualityScore({
        measurementMode,
        confidenceLabel,
        evidenceAvailable,
        observedCoveragePct: provenanceSummary.observed_coverage_pct,
        sampleSize: provenanceSummary.sample_size,
      }),
    },
    provenance: {
      measurement_mode: measurementMode,
      confidence_label: confidenceLabel,
      observed_coverage_pct: numberOrZero(provenanceSummary.observed_coverage_pct),
      sample_size: numberOrZero(provenanceSummary.sample_size),
    },
    evidence: {
      available: evidenceAvailable,
    },
  };
}

function createSeriesPoint(report, metricKey) {
  return {
    report_id: report.report_id,
    repo: report.repo,
    scenario: report.scenario,
    generated_at: report.generated_at,
    label: report.generated_at.slice(0, 10),
    value: report.metrics[metricKey] ?? 0,
  };
}

function average(values = []) {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + numberOrZero(value), 0) / values.length);
}

function round(value) {
  return Math.round(numberOrZero(value) * 10) / 10;
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = String(keyFn(item) ?? "unknown");
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function summarizeTrendGroups(reports, key) {
  const groups = new Map();
  for (const report of reports) {
    const groupKey = String(report[key] || "unknown");
    const existing = groups.get(groupKey) ?? {
      label: groupKey.replace(/[-_]+/g, " "),
      report_count: 0,
      token_savings: [],
      roi_scores: [],
      evidence_quality_scores: [],
    };
    existing.report_count += 1;
    existing.token_savings.push(report.metrics.token_savings_pct);
    existing.roi_scores.push(report.metrics.composite_roi_score);
    existing.evidence_quality_scores.push(report.metrics.evidence_quality_score);
    groups.set(groupKey, existing);
  }

  return [...groups.values()]
    .map((entry) => ({
      label: entry.label,
      report_count: entry.report_count,
      avg_token_savings_pct: average(entry.token_savings),
      avg_roi_score: average(entry.roi_scores),
      avg_evidence_quality_score: average(entry.evidence_quality_scores),
    }))
    .sort((left, right) => {
      if (right.report_count !== left.report_count) {
        return right.report_count - left.report_count;
      }
      return right.avg_evidence_quality_score - left.avg_evidence_quality_score;
    });
}

function computeEvidenceQualityScore({
  measurementMode,
  confidenceLabel,
  evidenceAvailable,
  observedCoveragePct,
  sampleSize,
}) {
  const modeBase = {
    observed: 72,
    mixed: 52,
    estimated: 28,
    unknown: 18,
  }[measurementMode] ?? 18;
  const confidenceBonus = {
    high: 12,
    medium: 7,
    low: 2,
    unknown: 0,
  }[confidenceLabel] ?? 0;
  const coverageBonus = Math.min(10, numberOrZero(observedCoveragePct) / 10);
  const sampleBonus = Math.min(4, Math.max(0, numberOrZero(sampleSize) - 1) * 2);
  const evidenceBonus = evidenceAvailable ? 6 : 0;

  return Math.max(0, Math.min(100, round(modeBase + confidenceBonus + coverageBonus + sampleBonus + evidenceBonus)));
}

function normalizeMeasurementMode(value) {
  const normalized = String(value ?? "estimated").trim().toLowerCase();
  return ["observed", "mixed", "estimated"].includes(normalized) ? normalized : "unknown";
}

function normalizeConfidenceLabel(value) {
  const normalized = String(value ?? "low").trim().toLowerCase();
  return ["high", "medium", "low"].includes(normalized) ? normalized : "unknown";
}

function createEvidenceQualityLabel(score) {
  const safeScore = numberOrZero(score);
  if (safeScore >= 80) {
    return "strong";
  }
  if (safeScore >= 55) {
    return "usable";
  }
  if (safeScore > 0) {
    return "limited";
  }
  return "missing";
}
