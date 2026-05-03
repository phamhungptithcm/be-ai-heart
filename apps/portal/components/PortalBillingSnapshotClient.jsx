"use client";

import { usePortalResource } from "../src/use-portal-resource.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalBillingSnapshotClient() {
  const billingState = usePortalResource("/api/billing");

  if (billingState.status === "loading" || billingState.status === "idle") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Billing"
        title="Loading billing snapshot"
        description="BeHeart is assembling license posture, seat usage, invoices, and ROI context for this tenant."
      />
    );
  }

  if (billingState.status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Billing"
        title="Billing snapshot unavailable"
        description={billingState.error}
      />
    );
  }

  const billing = billingState.data ?? {};

  return (
    <div className="portal-enterprise-stack">
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>License snapshot</span>
            <h3>Plan and seats</h3>
            <p>Billing should show why the current plan exists, how much room remains, and whether the rollout is earning the next commercial step.</p>
          </div>
        </div>
        <div className="portal-kpi-grid">
          <article className="portal-kpi-card"><span>Plan</span><strong>{billing.account?.plan_code ?? "starter"}</strong></article>
          <article className="portal-kpi-card"><span>Billing status</span><strong>{billing.account?.billing_status ?? "active"}</strong></article>
          <article className="portal-kpi-card"><span>Seats used</span><strong>{billing.license_summary?.seats_used ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Seats total</span><strong>{billing.license_summary?.seats_total ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Indexed repositories</span><strong>{billing.license_summary?.indexed_repositories ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Benchmarked repos</span><strong>{billing.license_summary?.benchmarked_repositories ?? 0}</strong></article>
        </div>
      </section>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Entitlements</span>
              <h3>What this plan currently unlocks</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            {(billing.entitlements ?? []).map((item) => (
              <article key={item.key}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Usage snapshot</span>
              <h3>Commercial proof</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            <article>
              <span>Average token savings</span>
              <strong>{billing.usage_snapshot?.avg_token_savings_pct ?? 0}%</strong>
            </article>
            <article>
              <span>Estimated savings</span>
              <strong>${billing.usage_snapshot?.estimated_cost_savings_usd ?? 0}</strong>
            </article>
            <article>
              <span>Benchmarked repository pct</span>
              <strong>{billing.usage_snapshot?.benchmarked_repository_pct ?? 0}%</strong>
            </article>
            <article>
              <span>Queued submissions</span>
              <strong>{billing.usage_snapshot?.queued_submission_count ?? 0}</strong>
            </article>
          </div>
        </section>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Invoice history</span>
            <h3>Billing contract</h3>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {(billing.invoices ?? []).map((invoice) => (
                <tr key={invoice.invoice_id}>
                  <td>{invoice.invoice_id}</td>
                  <td>{formatTimestamp(invoice.issued_at)}</td>
                  <td>{formatTimestamp(invoice.due_at)}</td>
                  <td>${invoice.amount_usd}</td>
                  <td>{invoice.status}</td>
                  <td>{invoice.source_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Notices</span>
            <h3>What the buyer should do next</h3>
          </div>
        </div>
        <div className="portal-action-list">
          {(billing.notices ?? []).map((notice, index) => (
            <article key={`${notice.title}-${index}`} className="portal-action-item">
              <div className="portal-action-copy">
                <span className={`portal-action-severity portal-action-severity-${notice.level}`}>{notice.level}</span>
                <strong>{notice.title}</strong>
                <p>{notice.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Upgrade readiness</span>
            <h3>Next plan step</h3>
          </div>
        </div>
        <div className="portal-summary-list">
          <article>
            <span>Status</span>
            <strong>{billing.upgrade_readiness?.status ?? "watch"}</strong>
          </article>
          <article>
            <span>Benchmark-backed repos</span>
            <strong>{billing.upgrade_readiness?.benchmark_backed_repositories ?? 0}</strong>
          </article>
          <article>
            <span>Repos onboarded</span>
            <strong>{billing.upgrade_readiness?.repos_onboarded ?? 0}</strong>
          </article>
          <article>
            <span>Open critical alerts</span>
            <strong>{billing.upgrade_readiness?.open_critical_alerts ?? 0}</strong>
          </article>
        </div>
      </section>
    </div>
  );
}

function formatTimestamp(value) {
  const safeValue = String(value ?? "").trim();
  return safeValue ? safeValue.slice(0, 10) : "—";
}
