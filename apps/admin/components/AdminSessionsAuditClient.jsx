"use client";

import { useAdminResource } from "../src/use-admin-resource.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminSessionsAuditClient() {
  const sessionsState = useAdminResource("/api/sessions");
  const auditState = useAdminResource("/api/audit/events");

  if (
    sessionsState.status === "loading" ||
    sessionsState.status === "idle" ||
    auditState.status === "loading" ||
    auditState.status === "idle"
  ) {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Sessions & audit"
        title="Loading session registry and audit trail"
        description="The admin plane is pulling the internal session registry and audit-event history."
      />
    );
  }

  if (sessionsState.status === "error" || auditState.status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Sessions & audit"
        title="Session registry unavailable"
        description={sessionsState.error || auditState.error}
      />
    );
  }

  const sessionsPayload = sessionsState.data ?? {};
  const auditPayload = auditState.data ?? {};

  return (
    <div className="admin-dashboard-stack">
      <section className="admin-command-panel">
        <header className="admin-command-head">
          <div>
            <span>Sessions</span>
            <h3>Internal session registry</h3>
          </div>
        </header>
        <div className="admin-data-table-shell">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Actor</th>
                <th>Surface</th>
                <th>Customer</th>
                <th>Issued</th>
                <th>Last seen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(sessionsPayload.sessions ?? []).slice(0, 12).map((session) => (
                <tr key={session.session_id}>
                  <td>{session.actor_slug}</td>
                  <td>{session.surface}</td>
                  <td>{session.customer_slug || "internal"}</td>
                  <td>{formatTimestamp(session.issued_at)}</td>
                  <td>{formatTimestamp(session.last_seen_at)}</td>
                  <td>{session.revoked_at ? "revoked" : "active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-command-panel">
        <header className="admin-command-head">
          <div>
            <span>Audit</span>
            <h3>Internal audit events</h3>
          </div>
        </header>
        <div className="admin-data-table-shell">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Outcome</th>
                <th>Surface</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {(auditPayload.events ?? []).slice(0, 12).map((event) => (
                <tr key={event.event_id}>
                  <td>{formatTimestamp(event.created_at)}</td>
                  <td>{event.action}</td>
                  <td>{event.outcome}</td>
                  <td>{event.surface}</td>
                  <td>{event.actor_slug || "system"}</td>
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

