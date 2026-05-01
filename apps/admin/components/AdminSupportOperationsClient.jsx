"use client";

import { useEffect, useState } from "react";

import { buildAdminSupportQueueSummary } from "../src/dashboard-visuals.js";
import { fetchAdminJson } from "../src/api-client.js";
import {
  buildAdminSupportTableRows,
  queryAdminSupportRows,
} from "../src/table-state.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminSupportOperationsClient() {
  const [state, setState] = useState({
    status: "loading",
    profiles: [],
    requests: [],
    error: "",
  });
  const [tableState, setTableState] = useState({
    query: "",
    severity: "all",
    sync: "all",
    sortKey: "support-score",
    sortDirection: "asc",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [repositoryPayload, intakePayload] = await Promise.all([
          fetchAdminJson("/api/repositories"),
          fetchAdminJson("/api/intake"),
        ]);

        if (!active) {
          return;
        }

        setState({
          status: "ready",
          profiles: repositoryPayload.profiles ?? [],
          requests: intakePayload.requests ?? [],
          error: "",
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          status: "error",
          profiles: [],
          requests: [],
          error: error.message,
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Support"
        title="Loading support cockpit"
        description="The admin plane is assembling mirrored repository issues and inbound demand into one support queue."
      />
    );
  }

  if (state.status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Support"
        title="Support cockpit unavailable"
        description={state.error}
      />
    );
  }

  const summary = buildAdminSupportQueueSummary({
    profiles: state.profiles,
    requests: state.requests,
  });
  const allRows = buildAdminSupportTableRows(state.profiles);
  const rows = queryAdminSupportRows(allRows, tableState);
  const queueRows = [
    {
      label: "Stale mirrors",
      count: summary.stale_profile_count,
      severity: summary.stale_profile_count > 0 ? "High" : "Clear",
      owner: "Support + platform",
      next: "Verify last successful sync, then confirm publish state before escalating.",
    },
    {
      label: "Benchmark gaps",
      count: summary.benchmark_gap_count,
      severity: summary.benchmark_gap_count > 0 ? "Medium" : "Clear",
      owner: "Customer success",
      next: "Schedule a benchmark-ready workflow and confirm the repo owner.",
    },
    {
      label: "Policy warnings",
      count: summary.policy_warning_count,
      severity: summary.policy_warning_count > 0 ? "Medium" : "Clear",
      owner: "Support admin",
      next: "Explain the warning source and whether the customer should pause rollout work.",
    },
    {
      label: "Inbound requests",
      count: summary.demo_request_count + summary.trial_request_count,
      severity: summary.demo_request_count > 0 ? "Medium" : "Low",
      owner: "Revenue + success",
      next: "Triage demo requests before trials when the support queue is saturated.",
    },
  ];

  return (
    <div className="admin-stack-block">
      <div className="admin-command-metrics">
        <div className="admin-command-metric"><span>Profiles</span><strong>{summary.profile_count}</strong><p>Mirrored repositories currently visible to the support team.</p></div>
        <div className="admin-command-metric"><span>Critical queue</span><strong>{summary.critical_queue_count}</strong><p>The largest single blocker lane across stale, benchmark-gap, and low-memory support work.</p></div>
        <div className="admin-command-metric"><span>Demo requests</span><strong>{summary.demo_request_count}</strong><p>High-touch requests that usually need guided evaluation rather than self-serve nurture.</p></div>
        <div className="admin-command-metric"><span>Trial requests</span><strong>{summary.trial_request_count}</strong><p>Lower-touch requests that still need clear first-run instructions and sync follow-through.</p></div>
        <div className="admin-command-metric"><span>Policy warnings</span><strong>{summary.policy_warning_count}</strong><p>Warnings support must understand before calling any repo rollout-ready.</p></div>
      </div>

      <div className="admin-command-grid">
        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Queue board</span>
              <h3>Support lanes that unblock trust fastest</h3>
              <p>Queue ownership and next action should be obvious without reading long runbooks.</p>
            </div>
          </header>
          <div className="admin-data-table-shell">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Queue</th>
                  <th>Count</th>
                  <th>Priority</th>
                  <th>Owner</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {queueRows.map((row) => (
                  <tr key={row.label}>
                    <td className="admin-table-primary">
                      <strong>{row.label}</strong>
                      <small>Support-facing operational lane</small>
                    </td>
                    <td>{row.count}</td>
                    <td>
                      <span className="admin-table-badge" data-tone={row.severity === "High" ? "neutral" : "positive"}>
                        {row.severity}
                      </span>
                    </td>
                    <td>{row.owner}</td>
                    <td>{row.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Repo risk</span>
              <h3>Which mirrored repositories need intervention first</h3>
              <p>The weakest repositories should be obvious so support can fix trust blockers before replying to the customer.</p>
            </div>
          </header>
          <div className="admin-risk-list">
            {rows.slice(0, 6).map((row) => (
              <article key={row.profile_slug} className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>{row.repo}</strong>
                  <span>{row.customer_slug} · {row.sync_status}</span>
                </div>
                <div className="admin-risk-meta">
                  <b>{row.score}%</b>
                  <small>{row.warning_count} warnings · {row.document_count} docs</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${row.score}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-command-panel">
        <header className="admin-command-head">
          <div>
            <span>Escalation table</span>
            <h3>Repository-by-repository supportability review</h3>
            <p>This is the raw view support should use before touching customer-facing guidance, benchmark follow-up, or rollout advice.</p>
          </div>
        </header>
        <div className="admin-data-table-shell">
          <div className="admin-table-toolbar">
            <div className="admin-table-controls">
              <label className="admin-field">
                <span>Search repositories</span>
                <input
                  className="admin-input"
                  type="search"
                  value={tableState.query}
                  onChange={(event) =>
                    setTableState((current) => ({ ...current, query: event.target.value }))
                  }
                  placeholder="Repository or customer"
                />
              </label>
              <label className="admin-field">
                <span>Severity</span>
                <select
                  className="admin-input"
                  value={tableState.severity}
                  onChange={(event) =>
                    setTableState((current) => ({ ...current, severity: event.target.value }))
                  }
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="watch">Watch</option>
                  <option value="healthy">Healthy</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Sync</span>
                <select
                  className="admin-input"
                  value={tableState.sync}
                  onChange={(event) =>
                    setTableState((current) => ({ ...current, sync: event.target.value }))
                  }
                >
                  <option value="all">All</option>
                  <option value="fresh">Fresh</option>
                  <option value="stale">Needs resync</option>
                </select>
              </label>
            </div>
            <p className="admin-table-summary">
              Showing {rows.length} of {allRows.length} repositories.
            </p>
          </div>
          <table className="admin-data-table">
            <thead>
              <tr>
                <th aria-sort={getSortAria(tableState, "repository")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "repository"} onClick={() => setTableState((current) => nextSortState(current, "repository"))}>Repository<span>{getSortLabel(tableState, "repository")}</span></button></th>
                <th aria-sort={getSortAria(tableState, "customer")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "customer"} onClick={() => setTableState((current) => nextSortState(current, "customer"))}>Customer<span>{getSortLabel(tableState, "customer")}</span></button></th>
                <th aria-sort={getSortAria(tableState, "sync")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "sync"} onClick={() => setTableState((current) => nextSortState(current, "sync"))}>Sync<span>{getSortLabel(tableState, "sync")}</span></button></th>
                <th aria-sort={getSortAria(tableState, "docs")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "docs"} onClick={() => setTableState((current) => nextSortState(current, "docs"))}>Docs<span>{getSortLabel(tableState, "docs")}</span></button></th>
                <th aria-sort={getSortAria(tableState, "benchmarks")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "benchmarks"} onClick={() => setTableState((current) => nextSortState(current, "benchmarks"))}>Benchmarks<span>{getSortLabel(tableState, "benchmarks")}</span></button></th>
                <th aria-sort={getSortAria(tableState, "warnings")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "warnings"} onClick={() => setTableState((current) => nextSortState(current, "warnings"))}>Warnings<span>{getSortLabel(tableState, "warnings")}</span></button></th>
                <th aria-sort={getSortAria(tableState, "support-score")}><button type="button" className="admin-table-sort" data-active={tableState.sortKey === "support-score"} onClick={() => setTableState((current) => nextSortState(current, "support-score"))}>Support score<span>{getSortLabel(tableState, "support-score")}</span></button></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    No mirrored repository matches the current search and filter state.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.profile_slug}>
                    <td className="admin-table-primary">
                      <strong>{row.repo}</strong>
                      <small>{row.profile_slug}</small>
                    </td>
                    <td>{row.customer_slug}</td>
                    <td>{row.sync_status}</td>
                    <td>{row.document_count}</td>
                    <td>{row.benchmark_count}</td>
                    <td>{row.warning_count}</td>
                    <td>
                      <div className="admin-table-stat">
                        <strong>{row.score}%</strong>
                        <div className="admin-mini-track" aria-hidden="true">
                          <i className="admin-mini-fill" style={{ width: `${row.score}%` }} />
                        </div>
                      </div>
                    </td>
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
    sortDirection: ["repository", "customer", "sync"].includes(sortKey) ? "asc" : "desc",
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
