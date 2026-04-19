"use client";

import { buildAdminCustomerHealthMix } from "../src/dashboard-visuals.js";
import { useAdminResource } from "../src/use-admin-resource.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminCustomerInventoryClient() {
  const inventoryState = useAdminResource("/api/customers/inventory");

  if (inventoryState.status === "loading" || inventoryState.status === "idle") {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Customers"
        title="Loading account inventory"
        description="BeHeart is assembling health, readiness, billing, and renewal context for each hosted org."
      />
    );
  }

  if (inventoryState.status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Customers"
        title="Account inventory unavailable"
        description={inventoryState.error}
      />
    );
  }

  const payload = inventoryState.data ?? {};
  const customers = payload.customers ?? [];
  const mix = buildAdminCustomerHealthMix(customers);
  const seatsUsed = customers.reduce((total, customer) => total + Number(customer.seats_used ?? 0), 0);
  const seatsTotal = customers.reduce((total, customer) => total + Number(customer.seats_total ?? 0), 0);
  const queuedSubmissionCount = customers.reduce(
    (total, customer) => total + Number(customer.queued_submissions ?? 0),
    0,
  );
  const staleRepositoryCount = customers.reduce(
    (total, customer) => total + Number(customer.stale_repositories ?? 0),
    0,
  );
  const renewalSoonCount = customers.filter((customer) => daysUntil(customer.renewal_date) <= 21).length;
  const rows = [...customers]
    .map((customer) => {
      const readinessScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            20 +
              Math.min(28, Number(customer.memory_ready_repositories ?? 0) * 12) +
              Math.min(24, Number(customer.benchmark_backed_repositories ?? 0) * 14) -
              Math.min(18, Number(customer.failed_syncs ?? 0) * 10) -
              Math.min(12, Number(customer.stale_repositories ?? 0) * 4),
          ),
        ),
      );

      return {
        ...customer,
        readinessScore,
      };
    })
    .sort((left, right) => right.readinessScore - left.readinessScore);
  const actions = [
    {
      label: "High-risk accounts",
      count: mix.high_risk_count,
      note:
        mix.high_risk_count > 0
          ? "These accounts have stale syncs, auth failures, or operational risk signals that can threaten retention."
          : "No customer is currently marked high-risk.",
      progress: mix.high_risk_pct,
    },
    {
      label: "Queued submissions",
      count: queuedSubmissionCount,
      note:
        queuedSubmissionCount > 0
          ? "Customer-uploaded documents or portal changes still need platform follow-through."
          : "No submission backlog is waiting on the admin team.",
      progress: Math.min(100, queuedSubmissionCount * 12),
    },
    {
      label: "Seat pressure",
      count: `${seatsUsed}/${seatsTotal}`,
      note:
        seatsTotal > 0 && seatsUsed / seatsTotal >= 0.8
          ? "Some customers are nearing seat limits and may need expansion or cleanup."
          : "Seat allocation is still comfortably below capacity.",
      progress: seatsTotal > 0 ? Math.round((seatsUsed / seatsTotal) * 100) : 0,
    },
  ];

  return (
    <div className="admin-stack-block">
      <div className="admin-command-metrics">
        <div className="admin-command-metric"><span>Accounts</span><strong>{mix.total}</strong><p>Total customer organizations currently visible to the hosted control plane.</p></div>
        <div className="admin-command-metric"><span>Active</span><strong>{mix.active_count}</strong><p>{mix.active_pct}% of organizations are already on an active contract posture.</p></div>
        <div className="admin-command-metric"><span>Benchmark-backed</span><strong>{mix.benchmark_backed_count}</strong><p>Accounts with at least one benchmark-backed repository.</p></div>
        <div className="admin-command-metric"><span>Stale repos</span><strong>{staleRepositoryCount}</strong><p>Mirrored repositories that need follow-through before support can trust the current state.</p></div>
        <div className="admin-command-metric"><span>Renewals soon</span><strong>{renewalSoonCount}</strong><p>Contracts or pilots renewing within the next 21 days.</p></div>
      </div>

      <div className="admin-command-grid">
        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Customer posture</span>
              <h3>Health and expansion readiness across the hosted customer base</h3>
              <p>The owner should be able to see who is active, who is benchmark-backed, and which accounts are drifting before churn becomes visible in revenue.</p>
            </div>
          </header>
          <div className="admin-pill-grid">
            <ValuePill label="Active accounts" value={`${mix.active_count}`} progress={mix.active_pct} />
            <ValuePill label="Trial accounts" value={`${mix.trial_count}`} progress={percentage(mix.trial_count, mix.total)} />
            <ValuePill label="High-risk accounts" value={`${mix.high_risk_count}`} progress={mix.high_risk_pct} />
            <ValuePill label="Seat usage" value={`${seatsUsed}/${seatsTotal}`} progress={seatsTotal > 0 ? percentage(seatsUsed, seatsTotal) : 0} />
          </div>
          <div className="admin-risk-list">
            {rows.slice(0, 4).map((customer) => (
              <article key={customer.customer_id} className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>{customer.display_name}</strong>
                  <span>{customer.plan_code} · {customer.entitlement_status}</span>
                </div>
                <div className="admin-risk-meta">
                  <b>{customer.readinessScore}%</b>
                  <small>{customer.expansion_readiness}</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${customer.readinessScore}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Action center</span>
              <h3>Where admin attention should go next</h3>
              <p>Escalations should prioritize accounts with backlog, sync drift, or approaching commercial thresholds.</p>
            </div>
          </header>
          <div className="admin-risk-list">
            {actions.map((action) => (
              <article key={action.label} className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>{action.label}</strong>
                  <span>{action.note}</span>
                </div>
                <div className="admin-risk-meta">
                  <b>{action.count}</b>
                  <small>{action.progress}%</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${action.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="admin-data-table-shell">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Org</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Readiness</th>
              <th>Memory-ready repos</th>
              <th>Benchmark-backed repos</th>
              <th>Seat usage</th>
              <th>Queued</th>
              <th>Risk</th>
              <th>Renewal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((customer) => (
              <tr key={customer.customer_id}>
                <td className="admin-table-primary">
                  <strong>{customer.display_name}</strong>
                  <small>{customer.customer_slug}</small>
                </td>
                <td>
                  <span className="admin-table-badge" data-tone={customer.status === "active" ? "positive" : "neutral"}>
                    {customer.status}
                  </span>
                </td>
                <td>{customer.plan_code}</td>
                <td>
                  <div className="admin-table-stat">
                    <strong>{customer.readinessScore}%</strong>
                    <div className="admin-mini-track" aria-hidden="true">
                      <i className="admin-mini-fill" style={{ width: `${customer.readinessScore}%` }} />
                    </div>
                  </div>
                </td>
                <td>{customer.memory_ready_repositories}</td>
                <td>{customer.benchmark_backed_repositories}</td>
                <td>{customer.seats_used}/{customer.seats_total}</td>
                <td>{customer.queued_submissions}</td>
                <td>
                  <span className="admin-table-badge" data-tone={customer.risk_level === "high" ? "neutral" : "positive"}>
                    {customer.risk_level}
                  </span>
                </td>
                <td>{formatDate(customer.renewal_date)}</td>
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

function daysUntil(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const now = new Date();
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function percentage(value, total) {
  if (!total) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((Number(value ?? 0) / Number(total ?? 1)) * 100)));
}

function ValuePill({ label, value, progress }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress ?? 0)));
  return (
    <article className="admin-value-pill">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="admin-mini-track" aria-hidden="true">
        <i className="admin-mini-fill" style={{ width: `${safeProgress}%` }} />
      </div>
    </article>
  );
}
