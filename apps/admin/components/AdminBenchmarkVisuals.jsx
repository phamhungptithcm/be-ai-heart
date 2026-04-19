import { buildBenchmarkTrendDigest } from "../../../packages/benchmark/src/trends.js";
import { buildAdminDemandMix, buildAdminWorkspaceMix } from "../src/dashboard-visuals.js";

export function AdminBenchmarkTrendPanel({ reports = [] }) {
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
  ];

  return (
    <div className="admin-trend-grid">
      {cards.map((card) => (
        <div key={card.label} className="admin-trend-card">
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

export function AdminRunComparisonBars({ report }) {
  if (!report?.baseline || !report?.assisted) {
    return (
      <div className="admin-comparison-empty">
        <strong>Comparison detail is available on the benchmark drill-down.</strong>
        <p>The revenue view can read published ROI summaries now; full baseline-versus-heart traces stay on the detailed report surface.</p>
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
    <div className="admin-comparison-list">
      {metrics.map((metric) => (
        <ComparisonRow key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

export function AdminDemandMixChart({ summary }) {
  const items = buildAdminDemandMix(summary);

  return (
    <div className="admin-mix-chart">
      <div className="admin-mix-chart-head">
        <strong>Demand mix</strong>
        <span>What kind of commercial motion is actually entering the funnel</span>
      </div>
      <div className="admin-mix-bars">
        {items.map((item) => (
          <div key={item.label} className="admin-mix-bar">
            <div className="admin-mix-copy">
              <strong>{item.label}</strong>
              <span>{item.value}%</span>
            </div>
            <div className="admin-mix-track" aria-hidden="true">
              <i style={{ width: `${item.value}%` }} data-tone={item.tone} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminWorkspaceMixChart({ workspaces = [] }) {
  const mix = buildAdminWorkspaceMix(workspaces);

  return (
    <div className="admin-mix-chart">
      <div className="admin-mix-chart-head">
        <strong>Workspace posture</strong>
        <span>How much of the installed base is ready, watchable, or drifting</span>
      </div>
      <div className="admin-mix-rail" aria-hidden="true">
        <i style={{ width: `${mix.expansion_ready_pct}%` }} data-tone="brand" />
        <i style={{ width: `${Math.max(0, 100 - mix.expansion_ready_pct - mix.intervention_pct)}%` }} data-tone="ink" />
        <i style={{ width: `${mix.intervention_pct}%` }} data-tone="alert" />
      </div>
      <div className="admin-mix-legend">
        <article>
          <strong>{mix.expansion_ready_count}</strong>
          <span>Expansion-ready</span>
        </article>
        <article>
          <strong>{mix.watch_count}</strong>
          <span>Watch closely</span>
        </article>
        <article>
          <strong>{mix.intervention_count}</strong>
          <span>Intervention needed</span>
        </article>
      </div>
    </div>
  );
}

function ComparisonRow({ metric }) {
  const maxValue = Math.max(metric.baseline, metric.assisted, 1);
  return (
    <article className="admin-comparison-row">
      <div className="admin-comparison-head">
        <strong>{metric.label}</strong>
        <span>
          {metric.prefix ?? ""}
          {metric.baseline} → {metric.prefix ?? ""}
          {metric.assisted}
        </span>
      </div>
      <div className="admin-comparison-bars">
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
    <svg viewBox={`0 0 ${width} ${height}`} className="admin-trend-svg" aria-hidden="true">
      <polyline points={points.join(" ")} />
    </svg>
  );
}
