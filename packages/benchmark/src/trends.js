export function buildBenchmarkTrendDigest(reports = []) {
  const normalizedReports = [...reports]
    .filter(Boolean)
    .map(normalizeTrendReport)
    .sort((left, right) => left.generated_at.localeCompare(right.generated_at));

  const latest = normalizedReports[normalizedReports.length - 1] ?? null;

  return {
    summary: {
      report_count: normalizedReports.length,
      latest_token_savings_pct: latest?.metrics.token_savings_pct ?? 0,
      latest_cost_savings_usd: latest?.metrics.token_cost_savings_usd ?? 0,
      latest_memory_refresh_reduction_pct: latest?.metrics.memory_refresh_reduction_pct ?? 0,
      latest_composite_roi_score: latest?.metrics.composite_roi_score ?? 0,
      avg_token_savings_pct: average(normalizedReports.map((report) => report.metrics.token_savings_pct)),
      avg_cost_savings_usd: average(normalizedReports.map((report) => report.metrics.token_cost_savings_usd)),
      avg_memory_refresh_reduction_pct: average(
        normalizedReports.map((report) => report.metrics.memory_refresh_reduction_pct),
      ),
      avg_composite_roi_score: average(normalizedReports.map((report) => report.metrics.composite_roi_score)),
    },
    series: {
      token_savings_pct: normalizedReports.map((report) => createSeriesPoint(report, "token_savings_pct")),
      token_cost_savings_usd: normalizedReports.map((report) => createSeriesPoint(report, "token_cost_savings_usd")),
      memory_refresh_reduction_pct: normalizedReports.map((report) =>
        createSeriesPoint(report, "memory_refresh_reduction_pct"),
      ),
      composite_roi_score: normalizedReports.map((report) => createSeriesPoint(report, "composite_roi_score")),
    },
  };
}

function normalizeTrendReport(report = {}) {
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
