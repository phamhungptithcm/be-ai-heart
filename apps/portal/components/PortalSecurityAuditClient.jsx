"use client";

import { usePortalResource } from "../src/use-portal-resource.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalSecurityAuditClient() {
  const securityState = usePortalResource("/api/security");

  if (securityState.status === "loading" || securityState.status === "idle") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Security"
        title="Loading tenant security posture"
        description="BeHeart is compiling authentication posture, session registry, audit events, exports, and upload activity."
      />
    );
  }

  if (securityState.status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Security"
        title="Security posture unavailable"
        description={securityState.error}
      />
    );
  }

  const security = securityState.data ?? {};

  return (
    <div className="portal-enterprise-stack">
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Security summary</span>
            <h3>Audit posture</h3>
            <p>Security should show login events, role changes, revocations, uploads, and export activity without leaking internal admin data.</p>
          </div>
        </div>
        <div className="portal-kpi-grid">
          <article className="portal-kpi-card"><span>Login events</span><strong>{security.activity_summary?.login_events ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Role changes</span><strong>{security.activity_summary?.role_changes ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Session revocations</span><strong>{security.activity_summary?.session_revocations ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Exports</span><strong>{security.activity_summary?.exports ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Uploads</span><strong>{security.activity_summary?.uploads ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Policy edits</span><strong>{security.activity_summary?.policy_edits ?? 0}</strong></article>
        </div>
      </section>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Auth providers</span>
              <h3>Configured provider posture</h3>
            </div>
          </div>
          <div className="portal-action-list">
            {(security.auth?.providers ?? []).length === 0 ? (
              <div className="portal-inline-banner">
                <strong>Mock auth mode</strong>
                <p>No hosted identity provider is configured yet for this tenant.</p>
              </div>
            ) : (
              (security.auth?.providers ?? []).map((provider) => (
                <article key={provider.id} className="portal-action-item">
                  <div className="portal-action-copy">
                    <strong>{provider.label}</strong>
                    <p>{provider.kind} · {provider.enabled ? "enabled" : "disabled"}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Sessions and exports</span>
              <h3>Sanitized session registry</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            <article>
              <span>Export scope</span>
              <strong>{security.export_status?.scope ?? "tenant"}</strong>
            </article>
            <article>
              <span>Export status</span>
              <strong>{security.export_status?.status ?? "ready"}</strong>
            </article>
            <article>
              <span>Retention days</span>
              <strong>{security.retention_status?.retention_days ?? 0}</strong>
            </article>
            <article>
              <span>Last export</span>
              <strong>{formatTimestamp(security.export_status?.latest_export_at)}</strong>
            </article>
          </div>
          <div className="portal-data-table-shell">
            <table className="portal-data-table">
              <thead>
                <tr>
                  <th>Actor</th>
                  <th>Workspace</th>
                  <th>Status</th>
                  <th>Last seen</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {(security.sessions ?? []).slice(0, 8).map((session) => (
                  <tr key={session.session_id}>
                    <td>{session.actor_slug}</td>
                    <td>{session.workspace_slug || "tenant"}</td>
                    <td>{session.status}</td>
                    <td>{formatTimestamp(session.last_seen_at)}</td>
                    <td>{formatTimestamp(session.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Recent events</span>
            <h3>Tenant-scoped audit trail</h3>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Category</th>
                <th>Action</th>
                <th>Outcome</th>
                <th>Workspace</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {(security.recent_events ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6}>No tenant-scoped security events are visible yet.</td>
                </tr>
              ) : (
                (security.recent_events ?? []).map((event) => (
                  <tr key={event.event_id}>
                    <td>{formatTimestamp(event.created_at)}</td>
                    <td>{event.category}</td>
                    <td>{event.action}</td>
                    <td>{event.outcome}</td>
                    <td>{event.workspace_slug || "tenant"}</td>
                    <td>{event.summary}</td>
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

function formatTimestamp(value) {
  const safeValue = String(value ?? "").trim();
  return safeValue ? safeValue.slice(0, 16).replace("T", " ") : "—";
}
