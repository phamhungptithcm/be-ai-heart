import { buildBenchmarkTrendDigest } from "../../../packages/benchmark/src/trends.js";
import { buildPortalSavingsMix, buildPortalWorkspaceMix } from "../src/dashboard-visuals.js";

export function PortalBenchmarkTrendPanel({ reports = [] }) {
  if (!reports.length) {
    return null;
  }

  const digest = buildBenchmarkTrendDigest(reports);
  const cards = [
    {
      label: "Token savings",
      latest: `${digest.summary.latest_token_savings_pct}%`,
      average: `${digest.summary.avg_token_savings_pct}% avg`,
      series: digest.series.token_savings_pct,
    },
    {
      label: "Cost savings",
      latest: `$${digest.summary.latest_cost_savings_usd}`,
      average: `$${digest.summary.avg_cost_savings_usd} avg`,
      series: digest.series.token_cost_savings_usd,
    },
    {
      label: "Memory savings",
      latest: `${digest.summary.latest_memory_refresh_reduction_pct}%`,
      average: `${digest.summary.avg_memory_refresh_reduction_pct}% avg`,
      series: digest.series.memory_refresh_reduction_pct,
    },
    {
      label: "ROI score",
      latest: `${digest.summary.latest_composite_roi_score}`,
      average: `${digest.summary.avg_composite_roi_score} avg`,
      series: digest.series.composite_roi_score,
    },
    {
      label: "Evidence quality",
      latest: `${digest.summary.latest_evidence_quality_score}`,
      average: `${digest.summary.avg_evidence_quality_score} avg · ${digest.summary.observed_report_count} observed`,
      series: digest.series.evidence_quality_score,
    },
  ];

  return (
    <div className="portal-trend-grid">
      {cards.map((card) => (
        <div key={card.label} className="portal-trend-card">
          <div>
            <span>{card.label}</span>
            <strong>{card.latest}</strong>
          </div>
          <p>{card.average}</p>
          <Sparkline series={card.series} />
        </div>
      ))}
    </div>
  );
}

export function PortalRunComparisonBars({ report }) {
  if (!report?.baseline || !report?.assisted) {
    return (
      <div className="portal-comparison-empty">
        <strong>Comparison detail available after a full benchmark drill-down.</strong>
        <p>The published report index already proves ROI, but baseline-versus-heart task traces live on the detailed benchmark page.</p>
      </div>
    );
  }

  const metrics = [
    { label: "Tokens", baseline: report.baseline.tokens, assisted: report.assisted.tokens },
    { label: "Minutes", baseline: report.baseline.minutes, assisted: report.assisted.minutes },
    { label: "Review edits", baseline: report.baseline.review_edits, assisted: report.assisted.review_edits },
    {
      label: "Memory refreshes",
      baseline: report.baseline.memory_refreshes,
      assisted: report.assisted.memory_refreshes,
    },
    {
      label: "Token cost",
      baseline: report.baseline.token_cost_usd,
      assisted: report.assisted.token_cost_usd,
      prefix: "$",
    },
  ];

  return (
    <div className="portal-comparison-list">
      {metrics.map((metric) => (
        <ComparisonRow key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

export function PortalSavingsMixChart({ report }) {
  const items = buildPortalSavingsMix(report);

  return (
    <div className="portal-mix-chart">
      <div className="portal-mix-chart-head">
        <strong>Savings mix</strong>
        <span>Which improvements are carrying the ROI</span>
      </div>
      <div className="portal-mix-bars">
        {items.map((item) => (
          <div key={item.label} className="portal-mix-bar">
            <div className="portal-mix-copy">
              <strong>{item.label}</strong>
              <span>{item.value}%</span>
            </div>
            <div className="portal-mix-track" aria-hidden="true">
              <i style={{ width: `${item.value}%` }} data-tone={item.tone} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortalWorkspaceMixChart({ workspaces = [] }) {
  const mix = buildPortalWorkspaceMix(workspaces);

  return (
    <div className="portal-mix-chart">
      <div className="portal-mix-chart-head">
        <strong>Workspace mix</strong>
        <span>How much of this tenant is actually ready to scale</span>
      </div>
      <div className="portal-mix-rail" aria-hidden="true">
        <i style={{ width: `${mix.ready_pct}%` }} data-tone="brand" />
        <i style={{ width: `${Math.max(0, 100 - mix.ready_pct)}%` }} data-tone="ink" />
      </div>
      <div className="portal-mix-legend">
        <article>
          <strong>{mix.ready_count}</strong>
          <span>Ready workspaces</span>
        </article>
        <article>
          <strong>{mix.partial_count}</strong>
          <span>Partial memory</span>
        </article>
        <article>
          <strong>{mix.benchmark_backed_count}</strong>
          <span>Benchmark-backed</span>
        </article>
        <article>
          <strong>{mix.queued_submission_count}</strong>
          <span>Queued updates</span>
        </article>
      </div>
    </div>
  );
}

function ComparisonRow({ metric }) {
  const maxValue = Math.max(metric.baseline, metric.assisted, 1);
  return (
    <article className="portal-comparison-row">
      <div className="portal-comparison-head">
        <strong>{metric.label}</strong>
        <span>
          {metric.prefix ?? ""}
          {metric.baseline} → {metric.prefix ?? ""}
          {metric.assisted}
        </span>
      </div>
      <div className="portal-comparison-bars">
        <div>
          <span>Baseline</span>
          <i style={{ width: `${(metric.baseline / maxValue) * 100}%` }} />
        </div>
        <div data-tone="positive">
          <span>With heart</span>
          <i style={{ width: `${(metric.assisted / maxValue) * 100}%` }} />
        </div>
      </div>
    </article>
  );
}

function Sparkline({ series }) {
  const safeSeries = Array.isArray(series) ? series : [];
  if (safeSeries.length === 0) {
    return null;
  }

  const width = 280;
  const height = 84;
  const padding = 8;
  const values = safeSeries.map((entry) => Number(entry.value ?? 0));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = Math.max(max - min, 1);
  const step = safeSeries.length === 1 ? 0 : (width - padding * 2) / (safeSeries.length - 1);
  const points = safeSeries.map((entry, index) => {
    const x = padding + step * index;
    const y = height - padding - ((Number(entry.value ?? 0) - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="portal-trend-svg" aria-hidden="true">
      <polyline points={points.join(" ")} />
    </svg>
  );
}
