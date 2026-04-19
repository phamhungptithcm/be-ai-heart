"use client";

import { useAdminResource } from "../src/use-admin-resource.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminBillingOpsClient() {
  const billingState = useAdminResource("/api/billing-ops");

  if (billingState.status === "loading" || billingState.status === "idle") {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Billing ops"
        title="Loading billing status and entitlements"
        description="BeHeart is assembling mock-safe billing posture for internal plan and entitlement review."
      />
    );
  }

  if (billingState.status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Billing ops"
        title="Billing ops unavailable"
        description={billingState.error}
      />
    );
  }

  const billing = billingState.data ?? {};

  return (
    <div className="admin-dashboard-stack">
      <div className="admin-command-metrics">
        <article className="admin-metric-cell"><span>Adapter</span><strong>{billing.adapter_id ?? "mock"}</strong></article>
        <article className="admin-metric-cell"><span>Provider mode</span><strong>{billing.provider_mode ?? "mock"}</strong></article>
        <article className="admin-metric-cell"><span>Accounts</span><strong>{(billing.accounts ?? []).length}</strong></article>
      </div>

      <div className="admin-data-table-shell">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Org</th>
              <th>Plan</th>
              <th>Billing status</th>
              <th>Entitlements</th>
              <th>Seats</th>
              <th>Benchmark-backed repos</th>
              <th>Upgrade readiness</th>
              <th>Renewal</th>
            </tr>
          </thead>
          <tbody>
            {(billing.accounts ?? []).map((account) => (
              <tr key={account.customer_id}>
                <td className="admin-table-primary">
                  <strong>{account.display_name}</strong>
                  <small>{account.customer_slug}</small>
                </td>
                <td>{account.plan_code}</td>
                <td>{account.billing_status}</td>
                <td>{account.entitlement_status}</td>
                <td>{account.seats_used}/{account.seats_total}</td>
                <td>{account.benchmark_backed_repositories}</td>
                <td>{account.expansion_readiness}</td>
                <td>{formatDate(account.renewal_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(value) {
  const safeValue = String(value ?? "").trim();
  return safeValue ? safeValue.slice(0, 10) : "—";
}

