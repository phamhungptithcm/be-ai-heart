"use client";

import { useAdminResource } from "../src/use-admin-resource.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

const KPI_LABELS = Object.freeze([
  ["total_users", "Total users"],
  ["active_workspaces", "Active workspaces"],
  ["active_repos", "Active repos"],
  ["context_packs_generated", "Context packs"],
  ["mcp_connections", "MCP connections"],
  ["benchmark_runs", "Benchmark runs"],
  ["mrr", "MRR"],
  ["arr", "ARR"],
  ["retention", "Retention"],
  ["activation_rate", "Activation"],
  ["trial_to_active_conversion", "Trial conversion"],
  ["design_partner_pipeline", "Design partners"],
  ["enterprise_leads", "Enterprise leads"],
  ["support_issues", "Support issues"],
  ["failed_sync_jobs", "Failed sync jobs"],
  ["risky_tenants", "Risky tenants"],
  ["api_job_health", "API/job health"],
  ["audit_security_events", "Audit/security"],
  ["active_orgs", "Active orgs"],
  ["active_trials", "Active trials"],
  ["benchmark_backed_orgs", "Benchmark-backed orgs"],
  ["expansion_ready_orgs", "Expansion-ready orgs"],
  ["queued_submissions", "Queued submissions"],
  ["failed_syncs", "Failed syncs"],
  ["auth_failures", "Auth failures"],
  ["alert_posture", "5xx / alert posture"],
  ["at_risk_accounts", "At-risk accounts"],
]);

export function AdminOverviewControlClient() {
  const overviewState = useAdminResource("/api/overview");

  if (overviewState.status === "loading" || overviewState.status === "idle") {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Overview"
        title="Loading internal control plane"
        description="BeHeart is assembling org health, trial posture, sync risk, and alert pressure for internal operators."
      />
    );
  }

  if (overviewState.status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Overview"
        title="Internal overview unavailable"
        description={overviewState.error}
      />
    );
  }

  const overview = overviewState.data ?? {};
  const founderMetrics = overview.founder_metrics ?? {};
  const kpis = {
    ...(overview.kpis ?? {}),
    ...founderMetrics,
  };

  return (
    <div className="admin-dashboard-stack">
      {founderMetrics.source_note ? (
        <div className="admin-dashboard-livebar">
          <StatusPill label="Metric source" value="Artifacts + intake + telemetry" tone="positive" />
          <StatusPill label="Finance posture" value="Estimated until billing integration" />
          <StatusPill label="Scans/week" value={formatValue(founderMetrics.scans_per_week)} />
          <StatusPill label="Token savings reported" value={`${formatValue(founderMetrics.token_savings_reported)}%`} />
          <StatusPill label="Cost savings estimate" value={formatMoney(founderMetrics.estimated_cost_savings)} />
        </div>
      ) : null}
      <div className="admin-command-metrics">
        {KPI_LABELS.map(([key, label]) => (
          <article key={key} className="admin-metric-cell">
            <span>{label}</span>
            <strong>{formatMetricValue(key, kpis[key])}</strong>
          </article>
        ))}
      </div>

      <section className="admin-command-panel">
        <header className="admin-command-head">
          <div>
            <span>Founder dashboard</span>
            <h3>Usage, finance, retention, enterprise demand, and operating risk</h3>
            <p>{founderMetrics.source_note}</p>
          </div>
        </header>
        <div className="admin-summary-list">
          <FounderMetric title="Product usage" metrics={[
            ["Scans/day", founderMetrics.scans_per_day],
            ["Scans/week", founderMetrics.scans_per_week],
            ["Context packs", founderMetrics.context_packs_generated],
            ["MCP connections", founderMetrics.mcp_connections],
          ]} />
          <FounderMetric title="Finance" metrics={[
            ["MRR", formatMoney(founderMetrics.mrr)],
            ["ARR", formatMoney(founderMetrics.arr)],
            ["Churn", `${formatValue(founderMetrics.churn)}%`],
            ["Est. savings", formatMoney(founderMetrics.estimated_cost_savings)],
          ]} />
          <FounderMetric title="Retention" metrics={[
            ["Retention", `${formatValue(founderMetrics.retention)}%`],
            ["Activation", `${formatValue(founderMetrics.activation_rate)}%`],
            ["Trial conversion", `${formatValue(founderMetrics.trial_to_active_conversion)}%`],
            ["Risky tenants", founderMetrics.risky_tenants],
          ]} />
          <FounderMetric title="Enterprise pipeline" metrics={[
            ["Design partners", founderMetrics.design_partner_pipeline],
            ["Enterprise leads", founderMetrics.enterprise_leads],
            ["Support issues", founderMetrics.support_issues],
            ["Audit/security", founderMetrics.audit_security_events],
          ]} />
        </div>
      </section>

      <section className="admin-command-panel">
        <header className="admin-command-head">
          <div>
            <span>Account watchlist</span>
            <h3>Which orgs are ready, risky, or waiting on support?</h3>
          </div>
        </header>
        <div className="admin-data-table-shell">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Org</th>
                <th>Plan</th>
                <th>Readiness</th>
                <th>Risk</th>
                <th>Benchmarks</th>
                <th>Queued submissions</th>
                <th>Renewal</th>
              </tr>
            </thead>
            <tbody>
              {(overview.customers ?? []).map((customer) => (
                <tr key={customer.customer_id}>
                  <td className="admin-table-primary">
                    <strong>{customer.display_name}</strong>
                    <small>{customer.customer_slug}</small>
                  </td>
                  <td>{customer.plan_code}</td>
                  <td>{customer.expansion_readiness}</td>
                  <td>{customer.risk_level}</td>
                  <td>{customer.benchmark_backed_repositories}</td>
                  <td>{customer.queued_submissions}</td>
                  <td>{formatDate(customer.renewal_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FounderMetric({ title, metrics }) {
  return (
    <article>
      <span>{title}</span>
      <strong>{metrics[0]?.[1] ?? "0"}</strong>
      <p>{metrics.map(([label, value]) => `${label}: ${formatValue(value)}`).join(" · ")}</p>
    </article>
  );
}

function StatusPill({ label, value, tone = "neutral" }) {
  return (
    <span className={`admin-status-pill admin-status-${tone}`}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

function formatMetricValue(key, value) {
  if (["mrr", "arr", "estimated_cost_savings"].includes(key)) {
    return formatMoney(value);
  }
  if (["retention", "activation_rate", "trial_to_active_conversion", "churn", "token_savings_reported"].includes(key)) {
    return `${formatValue(value)}%`;
  }
  return formatValue(value);
}

function formatValue(value) {
  return typeof value === "number" ? String(value) : String(value ?? "-");
}

function formatMoney(value) {
  return `$${Number(value ?? 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(value) {
  const safeValue = String(value ?? "").trim();
  return safeValue ? safeValue.slice(0, 10) : "-";
}
