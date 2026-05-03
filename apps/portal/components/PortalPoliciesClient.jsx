"use client";

import { usePortalResource } from "../src/use-portal-resource.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalPoliciesClient() {
  const policyState = usePortalResource("/api/policies");

  if (policyState.status === "loading" || policyState.status === "idle") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Policies"
        title="Loading guardrails and violations"
        description="BeHeart is preparing tenant-scoped policy packs, active violations, exceptions, and guardrail health."
      />
    );
  }

  if (policyState.status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Policies"
        title="Policies unavailable"
        description={policyState.error}
      />
    );
  }

  const policies = policyState.data ?? {};

  return (
    <div className="portal-enterprise-stack">
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Guardrail status</span>
            <h3>Guardrail health</h3>
          </div>
        </div>
        <div className="portal-kpi-grid">
          <article className="portal-kpi-card"><span>Healthy packs</span><strong>{policies.guardrail_summary?.healthy_count ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Warning packs</span><strong>{policies.guardrail_summary?.warning_count ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Critical findings</span><strong>{policies.guardrail_summary?.critical_count ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Exceptions</span><strong>{policies.exceptions?.length ?? 0}</strong></article>
        </div>
      </section>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Policy packs</span>
              <h3>Active packs</h3>
            </div>
          </div>
          <div className="portal-action-list">
            {(policies.policy_packs ?? []).map((pack) => (
              <article key={pack.policy_pack_id} className="portal-action-item">
                <div className="portal-action-copy">
                  <span className={`portal-action-severity portal-action-severity-${pack.guardrail_status}`}>{pack.guardrail_status}</span>
                  <strong>{pack.name}</strong>
                  <p>{pack.workspace_count} workspaces · {pack.violation_count} violations · {pack.exception_count} exceptions</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Exceptions</span>
              <h3>Temporary allowances</h3>
            </div>
          </div>
          <div className="portal-action-list">
            {(policies.exceptions ?? []).length === 0 ? (
              <div className="portal-inline-banner">
                <strong>No active exceptions</strong>
                <p>Guardrail exceptions are empty for this tenant right now.</p>
              </div>
            ) : (
              (policies.exceptions ?? []).map((exception) => (
                <article key={exception.exception_id} className="portal-action-item">
                  <div className="portal-action-copy">
                    <strong>{exception.repo}</strong>
                    <p>{exception.reason}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Violations</span>
            <h3>Current policy findings</h3>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Repository</th>
                <th>Severity</th>
                <th>Rule</th>
                <th>Message</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {(policies.violations ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6}>No active policy violations for this tenant.</td>
                </tr>
              ) : (
                (policies.violations ?? []).map((violation) => (
                  <tr key={violation.violation_id}>
                    <td>{violation.workspace_slug}</td>
                    <td>{violation.repo}</td>
                    <td>{violation.severity}</td>
                    <td>{violation.rule}</td>
                    <td>{violation.message}</td>
                    <td>{formatTimestamp(violation.updated_at)}</td>
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
