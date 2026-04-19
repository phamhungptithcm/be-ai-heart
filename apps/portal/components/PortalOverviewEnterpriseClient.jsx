"use client";

import Link from "next/link";

import { usePortalResource } from "../src/use-portal-resource.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

const KPI_LABELS = Object.freeze([
  ["repos_onboarded", "Repos onboarded"],
  ["memory_ready_repositories", "Memory-ready repos"],
  ["stale_repositories", "Stale repos"],
  ["latest_sync_freshness", "Latest sync freshness"],
  ["benchmark_backed_repositories", "Benchmark-backed repos"],
  ["avg_token_savings_pct", "Avg token savings"],
  ["avg_review_cleanup_reduction_pct", "Avg review cleanup reduction"],
  ["estimated_monthly_savings_usd", "Estimated monthly savings"],
  ["open_critical_alerts", "Open critical alerts"],
  ["plan_entitlement_status", "Plan status"],
]);

export function PortalOverviewEnterpriseClient() {
  const overviewState = usePortalResource("/api/overview");

  if (overviewState.status === "loading" || overviewState.status === "idle") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Overview"
        title="Loading tenant command center"
        description="BeHeart is assembling workspace health, ROI proof, governance pressure, and onboarding posture for this customer."
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
            <h3>Customer operating signals that matter after login</h3>
            <p>These numbers should tell a platform lead whether BeHeart is current, governed, benchmarked, and ready for broader AI rollout.</p>
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
              <h3>What needs attention next</h3>
              <p>Portal users should not guess what to do next. The action center should surface tenant-scoped work that unblocks adoption, trust, and ROI proof.</p>
            </div>
          </div>
          <div className="portal-action-list">
            {actionItems.map((item) => (
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
            ))}
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Benchmark posture</span>
              <h3>Proof that expansion can be defended</h3>
              <p>Rollout should stay grounded in published evidence, not optimism. This block keeps the commercial story close to delivery truth.</p>
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
          <div className="portal-inline-banner">
            <strong>Source</strong>
            <p>Benchmark savings are benchmark-derived. Usage and sync pressure are live operational signals from the hosted portal lane.</p>
          </div>
        </section>
      </div>

      {onboarding.is_first_login ? (
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>First login</span>
              <h3>Guide the customer to a working first deployment slice</h3>
              <p>New tenants should not see an empty dashboard and guess. The onboarding lane should be short, concrete, and directly tied to activation.</p>
            </div>
          </div>
          <div className="portal-onboarding-list">
            {(onboarding.steps ?? []).map((step) => (
              <article key={step.step_id}>
                <strong>{step.label}</strong>
                <p>{step.description}</p>
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
            <h3>Which repositories are current, benchmarked, and safe to expand</h3>
            <p>This table should stay easy to scan for engineering leads and buyers who need to know what is stale, what is blocked, and what is ready.</p>
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
              {highlights.map((highlight) => (
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
              ))}
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
