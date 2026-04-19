"use client";

import { useAdminResource } from "../src/use-admin-resource.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminObservabilityClient() {
  const metricsState = useAdminResource("/api/observability/metrics");
  const alertsState = useAdminResource("/api/observability/alerts");
  const exportsState = useAdminResource("/api/observability/exports");

  if (
    metricsState.status === "loading" ||
    metricsState.status === "idle" ||
    alertsState.status === "loading" ||
    alertsState.status === "idle" ||
    exportsState.status === "loading" ||
    exportsState.status === "idle"
  ) {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Observability"
        title="Loading hosted requests, metrics, alerts, and exports"
        description="The admin plane is pulling observability snapshots from the canonical service host."
      />
    );
  }

  if (
    metricsState.status === "error" ||
    alertsState.status === "error" ||
    exportsState.status === "error"
  ) {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Observability"
        title="Observability data unavailable"
        description={metricsState.error || alertsState.error || exportsState.error}
      />
    );
  }

  const metrics = metricsState.data ?? {};
  const alerts = alertsState.data ?? {};
  const exportsPayload = exportsState.data ?? {};

  return (
    <div className="admin-dashboard-stack">
      <div className="admin-command-metrics">
        <article className="admin-metric-cell"><span>Total requests</span><strong>{metrics.total_requests ?? 0}</strong></article>
        <article className="admin-metric-cell"><span>2xx</span><strong>{metrics.status_2xx ?? 0}</strong></article>
        <article className="admin-metric-cell"><span>4xx</span><strong>{metrics.status_4xx ?? 0}</strong></article>
        <article className="admin-metric-cell"><span>5xx</span><strong>{metrics.status_5xx ?? 0}</strong></article>
        <article className="admin-metric-cell"><span>Rate limited</span><strong>{metrics.rate_limited_requests ?? 0}</strong></article>
        <article className="admin-metric-cell"><span>Avg duration</span><strong>{metrics.avg_duration_ms ?? 0}ms</strong></article>
      </div>

      <section className="admin-command-panel">
        <header className="admin-command-head">
          <div>
            <span>Alerts</span>
            <h3>Current alert posture</h3>
          </div>
        </header>
        <div className="admin-data-table-shell">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Severity</th>
                <th>Count</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {(alerts.alerts ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4}>No current alerts.</td>
                </tr>
              ) : (
                (alerts.alerts ?? []).map((alert) => (
                  <tr key={alert.code}>
                    <td>{alert.code}</td>
                    <td>{alert.severity}</td>
                    <td>{alert.count}</td>
                    <td>{alert.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-command-panel">
        <header className="admin-command-head">
          <div>
            <span>Exports</span>
            <h3>Queued and delivered observability exports</h3>
          </div>
        </header>
        <div className="admin-data-table-shell">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Export</th>
                <th>Category</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(exportsPayload.exports ?? []).slice(0, 12).map((entry) => (
                <tr key={entry.export_id}>
                  <td>{entry.export_id}</td>
                  <td>{entry.category}</td>
                  <td>{entry.status}</td>
                  <td>{formatTimestamp(entry.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatTimestamp(value) {
  const safeValue = String(value ?? "").trim();
  return safeValue ? safeValue.slice(0, 16).replace("T", " ") : "—";
}

