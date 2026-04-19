"use client";

import { usePortalResource } from "../src/use-portal-resource.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalMembersAccessClient() {
  const membersState = usePortalResource("/api/members");

  if (membersState.status === "loading" || membersState.status === "idle") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Members"
        title="Loading members and access"
        description="BeHeart is preparing the tenant-scoped member roster, seat usage, and role catalog."
      />
    );
  }

  if (membersState.status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Members"
        title="Members and access unavailable"
        description={membersState.error}
      />
    );
  }

  const membersView = membersState.data ?? {};

  return (
    <div className="portal-enterprise-stack">
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Seats and access</span>
            <h3>Role-aware member visibility without leaking tenant boundaries</h3>
            <p>Members and access should tell the customer who can act, who is consuming seats, and where governance responsibilities sit.</p>
          </div>
        </div>
        <div className="portal-kpi-grid">
          <article className="portal-kpi-card"><span>Seats used</span><strong>{membersView.seat_summary?.seats_used ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Seats total</span><strong>{membersView.seat_summary?.seats_total ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Seats available</span><strong>{membersView.seat_summary?.seats_available ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Members</span><strong>{membersView.members?.length ?? 0}</strong></article>
        </div>
      </section>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Role catalog</span>
              <h3>Supported customer roles</h3>
            </div>
          </div>
          <div className="portal-action-list">
            {(membersView.role_catalog ?? []).map((role) => (
              <article key={role.role} className="portal-action-item">
                <div className="portal-action-copy">
                  <strong>{role.label}</strong>
                  <p>{role.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>SSO and invites</span>
              <h3>Identity posture</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            <article>
              <span>SSO mode</span>
              <strong>{membersView.sso_status?.provider_mode ?? "mock"}</strong>
            </article>
            <article>
              <span>SSO enforced</span>
              <strong>{membersView.sso_status?.enforced ? "Yes" : "No"}</strong>
            </article>
            <article>
              <span>Providers</span>
              <strong>{membersView.sso_status?.provider_count ?? 0}</strong>
            </article>
            <article>
              <span>Pending invites</span>
              <strong>{(membersView.invites ?? []).length}</strong>
            </article>
          </div>
        </section>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Members</span>
            <h3>Tenant-scoped member roster</h3>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Primary role</th>
                <th>Roles</th>
                <th>Workspace count</th>
                <th>SSO</th>
                <th>Active sessions</th>
                <th>Last seen</th>
                <th>Seat</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(membersView.members ?? []).map((member) => (
                <tr key={member.actor_slug}>
                  <td className="portal-table-primary">
                    <strong>{member.display_name}</strong>
                    <small>{member.actor_slug}</small>
                  </td>
                  <td>{member.primary_role}</td>
                  <td>{(member.roles ?? []).join(", ")}</td>
                  <td>{member.workspace_count}</td>
                  <td>{member.sso_status}</td>
                  <td>{member.active_session_count ?? 0}</td>
                  <td>{formatTimestamp(member.last_seen_at)}</td>
                  <td>{member.seat_consuming ? "Counts" : "View only"}</td>
                  <td>{member.session_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Sessions</span>
            <h3>Recent active sessions</h3>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Actor</th>
                <th>Workspace</th>
                <th>Status</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {(membersView.active_sessions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4}>No active tenant-scoped sessions are visible yet.</td>
                </tr>
              ) : (
                (membersView.active_sessions ?? []).map((session) => (
                  <tr key={session.session_id}>
                    <td>{session.actor_slug}</td>
                    <td>{session.workspace_slug || "tenant"}</td>
                    <td>{session.status}</td>
                    <td>{formatTimestamp(session.last_seen_at)}</td>
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
  return safeValue ? safeValue.slice(0, 16).replace("T", " ") : "Inactive";
}
