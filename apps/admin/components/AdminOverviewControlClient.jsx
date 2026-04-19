"use client";

import { useAdminResource } from "../src/use-admin-resource.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

const KPI_LABELS = Object.freeze([
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

  return (
    <div className="admin-dashboard-stack">
      <div className="admin-command-metrics">
        {KPI_LABELS.map(([key, label]) => (
          <article key={key} className="admin-metric-cell">
            <span>{label}</span>
            <strong>{formatValue(overview.kpis?.[key])}</strong>
          </article>
        ))}
      </div>

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

function formatValue(value) {
  return typeof value === "number" ? String(value) : String(value ?? "—");
}

function formatDate(value) {
  const safeValue = String(value ?? "").trim();
  return safeValue ? safeValue.slice(0, 10) : "—";
}

