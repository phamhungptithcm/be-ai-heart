"use client";

import { useState } from "react";

import { buildAdminCustomerHealthMix } from "../src/dashboard-visuals.js";
import { buildAdminCustomerExpansionSummary } from "../src/dashboard-visuals.js";
import {
  buildAdminCustomerTableRows,
  queryAdminCustomerRows,
} from "../src/table-state.js";
import { useAdminResource } from "../src/use-admin-resource.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminCustomerInventoryClient() {
  const inventoryState = useAdminResource("/api/customers/inventory");
  const [tableState, setTableState] = useState({
    query: "",
    posture: "all",
    expansion: "all",
    sortKey: "readiness",
    sortDirection: "desc",
  });

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
  const expansionSummary = buildAdminCustomerExpansionSummary(customers);
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
  const allRows = buildAdminCustomerTableRows(customers);
  const rows = queryAdminCustomerRows(allRows, tableState);
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

      <div className="admin-command-grid">
        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Expansion map</span>
              <h3>Commercial pressure and rollout readiness</h3>
              <p>Sales, support, and platform should all see the same expansion pressure signals before any plan change is proposed.</p>
            </div>
          </header>
          <div className="admin-summary-list">
            <article>
              <span>Benchmark-backed accounts</span>
              <strong>{expansionSummary.benchmark_backed_count} organization(s)</strong>
              <p>{expansionSummary.benchmark_backed_pct}% of visible accounts already have at least one benchmark-backed repository.</p>
            </article>
            <article>
              <span>Renewals soon</span>
              <strong>{expansionSummary.renewal_soon_count} organization(s)</strong>
              <p>These accounts are close enough to renewal that support quality and proof coverage directly affect retention.</p>
            </article>
            <article>
              <span>Seat pressure</span>
              <strong>{expansionSummary.seat_pressure_count} organization(s)</strong>
              <p>High seat utilization can signal healthy expansion or poor entitlement hygiene. Review before quoting more seats.</p>
            </article>
          </div>
        </section>

        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Operational backlog</span>
              <h3>Queues that affect customer confidence</h3>
              <p>Queued submissions and stale repositories are product trust problems before they become support tickets.</p>
            </div>
          </header>
          <div className="admin-summary-list">
            <article>
              <span>Queued submissions</span>
              <strong>{expansionSummary.queued_submission_count} pending update(s)</strong>
              <p>Portal or CLI uploads that still need follow-through by support or platform operations.</p>
            </article>
            <article>
              <span>Stale repositories</span>
              <strong>{expansionSummary.stale_repository_count} stale repository surface(s)</strong>
              <p>These repositories need refresh before any benchmark, billing, or policy conversation is treated as current.</p>
            </article>
            <article>
              <span>Commercial mix</span>
              <strong>{mix.active_count} active · {mix.trial_count} trial</strong>
              <p>Use this split to decide whether the customer base is maturing or still over-indexed on short-lived evaluation accounts.</p>
            </article>
          </div>
        </section>
      </div>

      <div className="admin-data-table-shell">
        <div className="admin-table-toolbar">
          <div className="admin-table-controls">
            <label className="admin-field">
              <span>Search accounts</span>
              <input
                className="admin-input"
                type="search"
                value={tableState.query}
                onChange={(event) =>
                  setTableState((current) => ({ ...current, query: event.target.value }))
                }
                placeholder="Org, slug, plan, or status"
              />
            </label>
            <label className="admin-field">
              <span>Posture</span>
              <select
                className="admin-input"
                value={tableState.posture}
                onChange={(event) =>
                  setTableState((current) => ({ ...current, posture: event.target.value }))
                }
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="high-risk">High risk</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Expansion</span>
              <select
                className="admin-input"
                value={tableState.expansion}
                onChange={(event) =>
                  setTableState((current) => ({ ...current, expansion: event.target.value }))
                }
              >
                <option value="all">All</option>
                <option value="ready">Ready</option>
                <option value="watch">Watch</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
          </div>
          <p className="admin-table-summary">
            Showing {rows.length} of {allRows.length} accounts.
          </p>
        </div>
        <table className="admin-data-table">
          <thead>
            <tr>
              <th aria-sort={getSortAria(tableState, "org")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "org"} onClick={() => setTableState((current) => nextSortState(current, "org"))}>Org<span>{getSortLabel(tableState, "org")}</span></button></th>
              <th aria-sort={getSortAria(tableState, "status")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "status"} onClick={() => setTableState((current) => nextSortState(current, "status"))}>Status<span>{getSortLabel(tableState, "status")}</span></button></th>
              <th aria-sort={getSortAria(tableState, "plan")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "plan"} onClick={() => setTableState((current) => nextSortState(current, "plan"))}>Plan<span>{getSortLabel(tableState, "plan")}</span></button></th>
              <th aria-sort={getSortAria(tableState, "readiness")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "readiness"} onClick={() => setTableState((current) => nextSortState(current, "readiness"))}>Readiness<span>{getSortLabel(tableState, "readiness")}</span></button></th>
              <th aria-sort={getSortAria(tableState, "memory-ready")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "memory-ready"} onClick={() => setTableState((current) => nextSortState(current, "memory-ready"))}>Memory-ready repos<span>{getSortLabel(tableState, "memory-ready")}</span></button></th>
              <th aria-sort={getSortAria(tableState, "benchmark-backed")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "benchmark-backed"} onClick={() => setTableState((current) => nextSortState(current, "benchmark-backed"))}>Benchmark-backed repos<span>{getSortLabel(tableState, "benchmark-backed")}</span></button></th>
              <th aria-sort={getSortAria(tableState, "seat-usage")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "seat-usage"} onClick={() => setTableState((current) => nextSortState(current, "seat-usage"))}>Seat usage<span>{getSortLabel(tableState, "seat-usage")}</span></button></th>
              <th aria-sort={getSortAria(tableState, "queued")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "queued"} onClick={() => setTableState((current) => nextSortState(current, "queued"))}>Queued<span>{getSortLabel(tableState, "queued")}</span></button></th>
              <th aria-sort={getSortAria(tableState, "risk")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "risk"} onClick={() => setTableState((current) => nextSortState(current, "risk"))}>Risk<span>{getSortLabel(tableState, "risk")}</span></button></th>
              <th aria-sort={getSortAria(tableState, "motion")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "motion"} onClick={() => setTableState((current) => nextSortState(current, "motion"))}>Motion<span>{getSortLabel(tableState, "motion")}</span></button></th>
              <th aria-sort={getSortAria(tableState, "renewal")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "renewal"} onClick={() => setTableState((current) => nextSortState(current, "renewal"))}>Renewal<span>{getSortLabel(tableState, "renewal")}</span></button></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="admin-table-empty">
                  No customer account matches the current search and filter state.
                </td>
              </tr>
            ) : (
              rows.map((customer) => (
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
                    <span className="admin-table-badge" data-tone={customer.riskLabel === "Healthy" ? "positive" : "neutral"}>
                      {customer.riskLabel}
                    </span>
                  </td>
                  <td>{customer.expansion_readiness}</td>
                  <td>{formatDate(customer.renewal_date)}</td>
                </tr>
              ))
            )}
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

function nextSortState(current, sortKey) {
  if (current.sortKey === sortKey) {
    return {
      ...current,
      sortDirection: current.sortDirection === "desc" ? "asc" : "desc",
    };
  }

  return {
    ...current,
    sortKey,
    sortDirection: ["org", "status", "plan", "risk", "motion"].includes(sortKey) ? "asc" : "desc",
  };
}

function getSortAria(state, sortKey) {
  if (state.sortKey !== sortKey) {
    return "none";
  }

  return state.sortDirection === "asc" ? "ascending" : "descending";
}

function getSortLabel(state, sortKey) {
  if (state.sortKey !== sortKey) {
    return "sort";
  }

  return state.sortDirection;
}
