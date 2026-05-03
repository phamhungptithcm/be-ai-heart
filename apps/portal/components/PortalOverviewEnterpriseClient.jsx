"use client";

import Link from "next/link";

import { usePortalResource } from "../src/use-portal-resource.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

const KPI_LABELS = Object.freeze([
  ["repos_onboarded", "Repos onboarded"],
  ["memory_ready_repositories", "Memory-ready repos"],
  ["stale_repositories", "Stale repos"],
  ["benchmark_backed_repositories", "Benchmark-backed repos"],
  ["estimated_monthly_savings_usd", "Estimated monthly savings"],
  ["open_critical_alerts", "Open critical alerts"],
]);

export function PortalOverviewEnterpriseClient() {
  const overviewState = usePortalResource("/api/overview");

  if (overviewState.status === "loading" || overviewState.status === "idle") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Overview"
        title="Loading workspace"
        description="Fetching synced repo, benchmark, and governance state."
      />
    );
  }

  if (overviewState.status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Overview"
        title="Customer overview unavailable"
        description={overviewState.error}
        actions={[
          { href: "/sign-in", label: "Review session" },
          { href: "/repositories", label: "Open repositories" },
        ]}
      />
    );
  }

  const overview = overviewState.data ?? {};
  const kpis = KPI_LABELS.map(([key, label]) => ({
    key,
    label,
    value: formatKpiValue(key, overview.kpis?.[key]),
  }));
  const actionItems = overview.action_center?.items ?? [];
  const highlights = overview.workspace_highlights ?? [];
  const onboarding = overview.onboarding ?? {};

  return (
    <div className="portal-enterprise-stack">
      <div className="portal-dashboard-livebar">
        <div className="portal-status-pill" data-tone="positive">
          <span>Tenant</span>
          <strong>{overview.organization?.display_name ?? "Workspace"}</strong>
        </div>
        <div className="portal-status-pill">
          <span>Workspace count</span>
          <strong>{overview.organization?.workspace_count ?? 0}</strong>
        </div>
        <div className="portal-status-pill">
          <span>Repository count</span>
          <strong>{overview.organization?.repository_count ?? 0}</strong>
        </div>
        <div className="portal-status-pill">
          <span>Last refresh</span>
          <strong>{formatTimestamp(overviewState.lastLoadedAt)}</strong>
        </div>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>KPI row</span>
            <h3>Workspace health</h3>
            <p>Current memory, proof, and risk in one scan.</p>
          </div>
          <div className="portal-enterprise-panel-actions">
            <Link href="/usage" className="portal-button-link portal-button-link-primary">
              Open usage
            </Link>
            <Link href="/billing" className="portal-button-link">
              Open billing
            </Link>
          </div>
        </div>

        <div className="portal-kpi-grid">
          {kpis.map((kpi) => (
            <article key={kpi.key} className="portal-kpi-card">
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Action center</span>
              <h3>Next best action</h3>
            </div>
          </div>
          <div className="portal-action-list">
            {actionItems.length > 0 ? (
              actionItems.map((item) => (
                <article key={item.item_id} className="portal-action-item">
                  <div className="portal-action-copy">
                    <span className={`portal-action-severity portal-action-severity-${item.severity}`}>{item.severity}</span>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                  </div>
                  <div className="portal-action-meta">
                    <b>
                      {item.count}
                      {item.unit ?? ""}
                    </b>
                    <Link href={item.href} className="portal-table-link">
                      Open
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="portal-state-block">
                <span className="portal-state-eyebrow">No actions</span>
                <strong>No immediate workspace action is queued.</strong>
                <p>Run `heart doctor`, publish a repository profile, or add benchmark evidence when the next repo changes.</p>
              </div>
            )}
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Benchmark posture</span>
              <h3>ROI proof</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            <article>
              <span>Reports</span>
              <strong>{overview.benchmark_overview?.report_count ?? 0}</strong>
            </article>
            <article>
              <span>Average token savings</span>
              <strong>{overview.benchmark_overview?.avg_token_savings_pct ?? 0}%</strong>
            </article>
            <article>
              <span>Review cleanup reduction</span>
              <strong>{overview.benchmark_overview?.avg_review_cleanup_reduction_pct ?? 0}%</strong>
            </article>
            <article>
              <span>Estimated monthly savings</span>
              <strong>${overview.benchmark_overview?.estimated_monthly_savings_usd ?? 0}</strong>
            </article>
          </div>
          <div className="portal-inline-banner portal-inline-banner-compact">
            <strong>Source</strong>
            <p>Benchmark savings are evidence artifacts. Usage is live telemetry.</p>
          </div>
        </section>
      </div>

      {onboarding.is_first_login ? (
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>First login</span>
              <h3>Start here</h3>
            </div>
          </div>
          <div className="portal-onboarding-list">
            {(onboarding.steps ?? []).map((step) => (
              <article key={step.step_id}>
                <strong>{step.label}</strong>
                <p>{step.description}</p>
                {step.command ? <code>{step.command}</code> : null}
                <Link href={step.href} className="portal-table-link">
                  Open
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Workspace highlights</span>
            <h3>Repo readiness</h3>
          </div>
          <div className="portal-enterprise-panel-actions">
            <Link href="/repositories" className="portal-button-link">
              Repository inventory
            </Link>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
              <th>Workspace</th>
              <th>Status</th>
              <th>Readiness</th>
              <th>Sync truth</th>
              <th>Benchmarks</th>
              <th>Queued submissions</th>
              <th>Last sync</th>
              </tr>
            </thead>
            <tbody>
              {highlights.length > 0 ? (
                highlights.map((highlight) => (
                  <tr key={highlight.workspace_slug}>
                    <td className="portal-table-primary">
                      <strong>{highlight.repo}</strong>
                      <small>{highlight.workspace_slug}</small>
                    </td>
                    <td>
                      <span className="portal-table-badge" data-tone={highlight.status === "ready" ? "positive" : "neutral"}>
                        {highlight.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{highlight.readiness_status?.replace(/_/g, " ") ?? "unknown"}</td>
                    <td>{highlight.sync_truth ?? "unknown"}</td>
                    <td>{highlight.benchmark_report_count}</td>
                    <td>{highlight.queued_submission_count}</td>
                    <td>{formatTimestamp(highlight.latest_sync_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="portal-table-empty">
                    No repositories are synced yet. Start with `heart init`, `heart scan`, and `heart diagram sync`.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatKpiValue(key, value) {
  if (key === "latest_sync_freshness" || key === "plan_entitlement_status") {
    return String(value ?? "—");
  }
  if (key.includes("_pct")) {
    return `${value ?? 0}%`;
  }
  if (key.includes("_usd")) {
    return `$${Number(value ?? 0).toFixed(2)}`;
  }
  return String(value ?? 0);
}

function formatTimestamp(value) {
  const safeValue = String(value ?? "").trim();
  if (!safeValue) {
    return "Not yet";
  }

  return safeValue.slice(0, 16).replace("T", " ");
}
