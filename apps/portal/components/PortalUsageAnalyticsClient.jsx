"use client";

import { buildPortalUsageSourceMix } from "../src/dashboard-visuals.js";
import { buildPortalUsageCoverageSummary } from "../src/dashboard-visuals.js";
import { usePortalResource } from "../src/use-portal-resource.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalUsageAnalyticsClient() {
  const usageState = usePortalResource("/api/usage/summary");

  if (usageState.status === "loading" || usageState.status === "idle") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Usage"
        title="Loading tenant usage analytics"
        description="BeHeart is assembling live operational telemetry and benchmark-derived savings into one tenant-scoped usage view."
      />
    );
  }

  if (usageState.status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Usage"
        title="Usage analytics unavailable"
        description={usageState.error}
      />
    );
  }

  const usage = usageState.data ?? {};
  const summary = usage.summary ?? {};
  const trendPoints = usage.trend?.points ?? [];
  const breakdowns = usage.breakdowns ?? {};
  const workspaceRows = Array.isArray(breakdowns.workspaces) ? breakdowns.workspaces : [];
  const repositoryRows = Array.isArray(breakdowns.repositories) ? breakdowns.repositories : [];
  const userRows = Array.isArray(breakdowns.users) ? breakdowns.users : [];
  const modelRows = Array.isArray(breakdowns.models) ? breakdowns.models : [];
  const clientRows = Array.isArray(breakdowns.clients) ? breakdowns.clients : [];
  const sourceMix = buildPortalUsageSourceMix(usage);
  const coverageSummary = buildPortalUsageCoverageSummary(usage);
  const actionRows = [
    {
      label: "Benchmark coverage",
      value:
        sourceMix.benchmark_coverage_pct >= 80
          ? "Healthy"
          : sourceMix.benchmark_coverage_pct >= 45
            ? "Watch"
            : "Needs work",
      note:
        sourceMix.benchmark_coverage_pct >= 80
          ? "Most repositories now have benchmark evidence tied to live usage."
          : "Publish more benchmark artifacts before calling this rollout financially proven.",
      progress: sourceMix.benchmark_coverage_pct,
    },
    {
      label: "Context reuse",
      value:
        Number(summary.cache_context_reuse_rate ?? 0) >= 40
          ? "Compounding"
          : Number(summary.cache_context_reuse_rate ?? 0) >= 22
            ? "Recovering"
            : "Low leverage",
      note:
        Number(summary.cache_context_reuse_rate ?? 0) >= 40
          ? "Teams are reusing existing project memory instead of re-sending the same context."
          : "Low reuse means token spend still depends on repeated context rebuilds.",
      progress: Number(summary.cache_context_reuse_rate ?? 0),
    },
    {
      label: "Adoption",
      value:
        Number(summary.active_users_7d ?? 0) > 0
          ? `${summary.active_users_7d} active in 7d`
          : "No weekly activity",
      note:
        Number(summary.active_users_7d ?? 0) > 0
          ? `${summary.active_users_30d ?? 0} active in 30d. The live trend should stay close to benchmark-backed expansion.`
          : "Telemetry is present, but the tenant is not using the portal or hosted path consistently yet.",
      progress:
        Number(summary.active_users_30d ?? 0) > 0
          ? Math.min(
              100,
              Math.round(
                (Number(summary.active_users_7d ?? 0) / Math.max(Number(summary.active_users_30d ?? 0), 1)) *
                  100,
              ),
            )
          : 0,
    },
  ];

  return (
    <div className="portal-enterprise-stack">
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Usage summary</span>
            <h3>Usage and savings</h3>
          </div>
        </div>
        <div className="portal-kpi-grid">
          <article className="portal-kpi-card"><span>Requests</span><strong>{summary.requests ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Input tokens</span><strong>{summary.input_tokens ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Output tokens</span><strong>{summary.output_tokens ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Estimated token cost</span><strong>${Number(summary.estimated_token_cost_usd ?? 0).toFixed(2)}</strong></article>
          <article className="portal-kpi-card"><span>Avg context pack size</span><strong>{summary.average_context_pack_size ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Context reuse rate</span><strong>{summary.cache_context_reuse_rate ?? 0}%</strong></article>
          <article className="portal-kpi-card"><span>Active users 7d</span><strong>{summary.active_users_7d ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Active users 30d</span><strong>{summary.active_users_30d ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Benchmark coverage</span><strong>{summary.benchmark_coverage_pct ?? 0}%</strong></article>
          <article className="portal-kpi-card"><span>Avg token savings</span><strong>{summary.avg_token_savings_pct ?? 0}%</strong></article>
          <article className="portal-kpi-card"><span>Estimated savings</span><strong>${Number(summary.estimated_cost_savings_usd ?? 0).toFixed(2)}</strong></article>
        </div>
        <div className="portal-inline-banner">
          <strong>Metric sources</strong>
          <p>Usage is hosted telemetry. Savings are benchmark-derived.</p>
        </div>
      </section>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Coverage digest</span>
              <h3>Top lanes</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            <article>
              <span>Workspace footprint</span>
              <strong>
                {coverageSummary.workspace_count} workspace(s) · {coverageSummary.repository_count} repository surface(s)
              </strong>
              <p>
                {coverageSummary.user_count} members, {coverageSummary.model_count} models, and {coverageSummary.client_count} client lanes are currently visible.
              </p>
            </article>
            <article>
              <span>Top spend lane</span>
              <strong>
                {coverageSummary.top_repository?.label ?? "No repository data"} · ${formatCell(coverageSummary.top_repository?.estimated_token_cost_usd ?? 0)}
              </strong>
              <p>
                {coverageSummary.top_model?.label ?? "No model data"} is carrying the largest model-side cost at ${formatCell(coverageSummary.top_model?.estimated_token_cost_usd ?? 0)}.
              </p>
            </article>
            <article>
              <span>Primary client</span>
              <strong>{coverageSummary.top_client?.label ?? "No client data"} is driving the most runs</strong>
              <p>
                Benchmark coverage is {coverageSummary.benchmark_coverage_pct}% and active usage is {coverageSummary.active_users_7d}/{coverageSummary.active_users_30d} users in 7d/30d.
              </p>
            </article>
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Action center</span>
              <h3>Next fixes</h3>
            </div>
          </div>
          <div className="portal-readiness-list">
            {actionRows.map((row) => (
              <article key={row.label} className="portal-readiness-row">
                <div className="portal-readiness-copy">
                  <strong>{row.label}</strong>
                  <span>{row.note}</span>
                </div>
                <div className="portal-readiness-meta">
                  <b>{row.value}</b>
                  <small>{row.progress}%</small>
                </div>
                <div className="portal-mini-track" aria-hidden="true">
                  <i className="portal-mini-fill" style={{ width: `${row.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Trend</span>
            <h3>Activity trend</h3>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Requests</th>
                <th>Input tokens</th>
                <th>Output tokens</th>
                <th>Token cost</th>
                <th>Benchmark reports</th>
                <th>Benchmark savings</th>
              </tr>
            </thead>
            <tbody>
              {trendPoints.slice(-12).map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{point.requests}</td>
                  <td>{point.input_tokens}</td>
                  <td>{point.output_tokens}</td>
                  <td>${point.estimated_token_cost_usd}</td>
                  <td>{point.benchmark_report_count}</td>
                  <td>${point.benchmark_cost_savings_usd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="portal-enterprise-split">
        <BreakdownTable
          eyebrow="By workspace"
          title="Workspace usage and ROI"
          rows={usage.breakdowns?.workspaces ?? []}
          columns={[
            ["workspace_slug", "Workspace"],
            ["repo", "Repository"],
            ["requests", "Requests"],
            ["input_tokens", "Input"],
            ["estimated_token_cost_usd", "Cost"],
            ["avg_token_savings_pct", "Benchmark save"],
            ["source_type", "Source"],
          ]}
        />
        <BreakdownTable
          eyebrow="By repository"
          title="Repository usage and spend hotspots"
          rows={usage.breakdowns?.repositories ?? []}
          columns={[
            ["repo", "Repository"],
            ["requests", "Requests"],
            ["input_tokens", "Input"],
            ["estimated_token_cost_usd", "Cost"],
            ["avg_token_savings_pct", "Benchmark save"],
            ["source_type", "Source"],
          ]}
        />
      </div>

      <div className="portal-enterprise-split">
        <BreakdownTable
          eyebrow="By user"
          title="Member adoption and access activity"
          rows={userRows.map((entry) => ({
            ...entry,
            role_label: Array.isArray(entry.roles) ? entry.roles.join(", ") : entry.primary_role,
            active_label: entry.active_7d ? "7d active" : entry.active_30d ? "30d active" : "Dormant",
          }))}
          columns={[
            ["display_name", "Member"],
            ["primary_role", "Primary role"],
            ["workspace_count", "Workspaces"],
            ["active_label", "Activity"],
            ["last_seen_at", "Last seen"],
            ["source_type", "Source"],
          ]}
        />
        <BreakdownTable
          eyebrow="By model"
          title="Provider and model posture"
          rows={(usage.breakdowns?.models ?? []).map((entry) => ({
            ...entry,
            model_label: entry.key ?? `${entry.provider}/${entry.model}`,
          }))}
          columns={[
            ["model_label", "Model"],
            ["requests", "Requests"],
            ["input_tokens", "Input"],
            ["estimated_token_cost_usd", "Cost"],
            ["avg_token_savings_pct", "Benchmark save"],
            ["source_type", "Source"],
          ]}
        />
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Client footprint</span>
            <h3>Clients and IDEs</h3>
            <p>Platform leads need to know whether usage is concentrated in one workflow or distributed across the actual engineering toolchain.</p>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Runs</th>
                <th>Total tokens</th>
                <th>Estimated token cost</th>
                <th>Usage coverage</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {clientRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>No client or IDE telemetry is visible yet for this tenant.</td>
                </tr>
              ) : (
                clientRows.slice(0, 10).map((entry, index) => (
                  <tr key={`${entry.client ?? "unknown"}-${index}`}>
                    <td className="portal-table-primary">
                      <strong>{entry.client ?? "unknown"}</strong>
                      <small>{entry.source_type === "hosted_telemetry" ? "Hosted telemetry" : "Benchmark artifact"}</small>
                    </td>
                    <td>{formatCell(entry.run_count)}</td>
                    <td>{formatCell(entry.total_tokens)}</td>
                    <td>{formatCurrency(entry.estimated_token_cost_usd)}</td>
                    <td>{formatCell(entry.avg_usage_coverage_pct)}%</td>
                    <td>
                      <span className="portal-table-badge" data-tone={entry.source_type === "hosted_telemetry" ? "positive" : "neutral"}>
                        {formatSourceLabel(entry.source_type)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BreakdownTable({ eyebrow, title, rows, columns }) {
  return (
    <section className="portal-enterprise-panel">
      <div className="portal-enterprise-panel-head">
        <div>
          <span>{eyebrow}</span>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="portal-data-table-shell">
        <table className="portal-data-table">
          <thead>
            <tr>
              {columns.map(([, label]) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>No data visible yet for this dimension.</td>
              </tr>
            ) : (
              rows.slice(0, 8).map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {columns.map(([key]) => (
                    <td key={key}>
                      {key === "source_type" ? (
                        <span
                          className="portal-table-badge"
                          data-tone={row[key] === "hosted_telemetry" ? "positive" : "neutral"}
                        >
                          {formatSourceLabel(row[key])}
                        </span>
                      ) : (
                        formatCell(row[key])
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatCell(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 16).replace("T", " ");
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value ?? "—");
}

function formatCurrency(value) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function formatSourceLabel(value) {
  const safeValue = String(value ?? "unknown");
  if (safeValue === "hosted_telemetry") {
    return "Live";
  }
  if (safeValue === "benchmark_artifact") {
    return "Benchmark";
  }
  if (safeValue === "mixed") {
    return "Mixed";
  }
  return safeValue.replace(/[_-]+/g, " ");
}
