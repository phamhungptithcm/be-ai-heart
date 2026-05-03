"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchPortalJson } from "../src/api-client.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";
import {
  PortalBenchmarkTrendPanel,
  PortalRunComparisonBars,
  PortalSavingsMixChart,
  PortalWorkspaceMixChart,
} from "./PortalBenchmarkVisuals.jsx";

export function PortalOperationsDashboardClient() {
  const [state, setState] = useState({
    status: "loading",
    profiles: [],
    workspaces: [],
    reports: [],
    lastLoadedAt: "",
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [repositoryPayload, workspacePayload, benchmarkPayload] = await Promise.all([
          fetchPortalJson("/api/repositories"),
          fetchPortalJson("/api/workspaces"),
          fetchPortalJson("/api/benchmarks"),
        ]);

        if (!active) {
          return;
        }

        setState({
          status: "ready",
          profiles: repositoryPayload.profiles ?? [],
          workspaces: workspacePayload.workspaces ?? [],
          reports: benchmarkPayload.reports ?? [],
          lastLoadedAt: new Date().toISOString(),
          error: "",
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          status: "error",
          profiles: [],
          workspaces: [],
          reports: [],
          lastLoadedAt: "",
          error: error.message,
        });
      }
    }

    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (state.status === "loading") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Customer cockpit"
        title="Loading workspace economics"
        description="BeHeart is aggregating repository memory, benchmark ROI, and sync freshness into a tenant-scoped customer view."
      />
    );
  }

  if (state.status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Customer cockpit"
        title="Workspace economics unavailable"
        description={state.error}
        actions={[{ href: "/sign-in", label: "Review access" }, { href: "/documents", label: "Check documents" }]}
      />
    );
  }

  const summary = summarizePortalOperations(state);
  const readinessRows = buildRepositoryReadinessRows(state.profiles);
  const workspaceRows = buildWorkspaceValueRows(state.workspaces);
  const recentReports = [...state.reports]
    .sort((left, right) => String(right.generated_at ?? "").localeCompare(String(left.generated_at ?? "")))
    .slice(0, 6);
  const latestReport = recentReports[0] ?? null;

  return (
    <div className="portal-dashboard-stack">
      <div className="portal-dashboard-livebar">
        <StatusPill label="Live sync cadence" value="30s poll" tone="positive" />
        <StatusPill label="Source of truth" value="Hosted API + CLI sync" />
        <StatusPill label="Last refresh" value={formatTimestamp(state.lastLoadedAt)} />
        <StatusPill label="Published proof" value={`${summary.report_count} reports`} />
      </div>

      <div className="portal-command-metrics">
        <MetricCell
          label="Active repositories"
          value={summary.profile_count}
          detail={`${summary.memory_ready_count} ready for deeper AI context`}
        />
        <MetricCell
          label="Memory coverage"
          value={`${summary.memory_ready_pct}%`}
          detail={`${summary.document_count} docs and ${summary.relationship_count} heart links`}
        />
        <MetricCell
          label="Published token save"
          value={`${summary.avg_token_savings_pct}%`}
          detail={`${summary.report_count} benchmark reports in view`}
        />
        <MetricCell
          label="Published money save"
          value={`$${summary.total_cost_savings_usd}`}
          detail="Aggregated from benchmark artifacts already shared with the customer"
        />
        <MetricCell
          label="Queue pressure"
          value={summary.queued_submission_count}
          detail={`${summary.workspace_count} workspaces under this tenant`}
        />
      </div>

      <div className="portal-command-grid">
        <section className="portal-command-panel portal-command-panel-wide">
          <header className="portal-command-head">
            <div>
              <span>ROI lane</span>
              <h3>Buyer proof</h3>
              <p>Portal should show whether the heart is actually reducing token spend, memory refresh, and review cleanup before the customer expands AI usage.</p>
            </div>
            <div className="portal-command-actions">
              <Link href="/benchmarks" className="portal-button-link portal-button-link-primary">
                Open benchmarks
              </Link>
              <Link href="/documents" className="portal-button-link">
                Update memory
              </Link>
            </div>
          </header>
          {state.reports.length > 0 ? (
            <PortalBenchmarkTrendPanel reports={state.reports} />
          ) : (
            <p className="portal-command-empty">Run and publish a benchmark scenario to unlock the savings timeline here.</p>
          )}
          {latestReport ? (
            <div className="portal-analytics-grid">
              <div className="portal-analytics-panel">
                <div className="portal-analytics-head">
                  <div>
                    <span>Latest benchmark</span>
                    <strong>{formatScenarioLabel(latestReport.scenario)}</strong>
                  </div>
                  <small>
                    {latestReport.provider}/{latestReport.model}
                  </small>
                </div>
                <PortalRunComparisonBars report={latestReport} />
              </div>
              <div className="portal-analytics-panel">
                <div className="portal-analytics-head">
                  <div>
                    <span>Value snapshot</span>
                    <strong>What changed after the heart was applied</strong>
                  </div>
                  <small>{formatTimestamp(latestReport.generated_at)}</small>
                </div>
                <div className="portal-pill-grid">
                  <ValuePill
                    label="Token save"
                    value={`${latestReport.metrics?.token_savings_pct ?? 0}%`}
                    progress={latestReport.metrics?.token_savings_pct ?? 0}
                  />
                  <ValuePill
                    label="Money save"
                    value={`$${latestReport.metrics?.token_cost_savings_usd ?? 0}`}
                    progress={Math.min(100, Number(latestReport.metrics?.token_cost_savings_usd ?? 0) * 100)}
                  />
                  <ValuePill
                    label="Memory save"
                    value={`${latestReport.metrics?.memory_refresh_reduction_pct ?? 0}%`}
                    progress={latestReport.metrics?.memory_refresh_reduction_pct ?? 0}
                  />
                  <ValuePill
                    label="Review cleanup"
                    value={`${latestReport.metrics?.review_edit_reduction_pct ?? 0}%`}
                    progress={latestReport.metrics?.review_edit_reduction_pct ?? 0}
                  />
                </div>
                <PortalSavingsMixChart report={latestReport} />
              </div>
            </div>
          ) : null}
          <div className="portal-compact-table-shell">
            <table className="portal-compact-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Model</th>
                  <th>Token</th>
                  <th>Money</th>
                  <th>Memory</th>
                  <th>ROI</th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((report) => (
                  <tr key={report.report_id}>
                    <td className="portal-table-primary">
                      <strong>{formatScenarioLabel(report.scenario)}</strong>
                      <small>{report.repo}</small>
                    </td>
                    <td>{report.provider}/{report.model}</td>
                    <td>{report.metrics?.token_savings_pct ?? 0}%</td>
                    <td>${report.metrics?.token_cost_savings_usd ?? 0}</td>
                    <td>{report.metrics?.memory_refresh_reduction_pct ?? 0}%</td>
                    <td>{report.metrics?.composite_roi_score ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="portal-command-panel">
          <header className="portal-command-head">
            <div>
              <span>Readiness lane</span>
              <h3>AI-ready repos</h3>
              <p>Coverage is only useful if code, documents, and linked intent show up together without policy drift.</p>
            </div>
          </header>
          <div className="portal-readiness-list">
            {readinessRows.slice(0, 6).map((row) => (
              <article key={row.profile_slug} className="portal-readiness-row">
                <div className="portal-readiness-copy">
                  <strong>{row.repo}</strong>
                  <span>{row.summary}</span>
                </div>
                <div className="portal-readiness-meta">
                  <b>{row.score}%</b>
                  <small>{row.status}</small>
                </div>
                <div className="portal-mini-track" aria-hidden="true">
                  <i className="portal-mini-fill" style={{ width: `${row.score}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="portal-command-panel">
        <header className="portal-command-head">
          <div>
            <span>Workspace lane</span>
            <h3>Workspace posture</h3>
            <p>This is the operating table a customer team should check before relying on BeHeart for larger repo changes or more seats.</p>
          </div>
        </header>
        <div className="portal-data-table-shell">
          <PortalWorkspaceMixChart workspaces={state.workspaces} />
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Coverage</th>
                <th>Queued</th>
                <th>Reports</th>
                <th>Token save</th>
                <th>Memory save</th>
                <th>Last sync</th>
              </tr>
            </thead>
            <tbody>
              {workspaceRows.map((workspace) => (
                <tr key={workspace.workspace_slug}>
                  <td className="portal-table-primary">
                    <strong>{workspace.repo}</strong>
                    <small>{workspace.workspace_slug}</small>
                  </td>
                  <td>
                    <span className="portal-table-badge" data-tone={workspace.coverage_tone}>
                      {workspace.coverage_label}
                    </span>
                  </td>
                  <td>{workspace.queued_submission_count}</td>
                  <td>{workspace.benchmark_report_count}</td>
                  <td>
                    <div className="portal-table-stat">
                      <strong>{workspace.avg_token_savings_pct}%</strong>
                      <div className="portal-mini-track" aria-hidden="true">
                        <i className="portal-mini-fill" style={{ width: `${workspace.avg_token_savings_pct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="portal-table-stat">
                      <strong>{workspace.avg_memory_refresh_reduction_pct}%</strong>
                      <div className="portal-mini-track" aria-hidden="true">
                        <i className="portal-mini-fill" style={{ width: `${workspace.avg_memory_refresh_reduction_pct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>{formatTimestamp(workspace.latest_sync_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCell({ label, value, detail }) {
  return (
    <div className="portal-command-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

function StatusPill({ label, value, tone = "neutral" }) {
  return (
    <div className="portal-status-pill" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ValuePill({ label, value, progress }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress ?? 0)));
  return (
    <article className="portal-value-pill">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="portal-mini-track" aria-hidden="true">
        <i className="portal-mini-fill" style={{ width: `${safeProgress}%` }} />
      </div>
    </article>
  );
}

function summarizePortalOperations({ profiles, workspaces, reports }) {
  const memoryReadyCount = profiles.filter((profile) => computeReadinessScore(profile) >= 70).length;

  return {
    profile_count: profiles.length,
    workspace_count: workspaces.length,
    report_count: reports.length,
    memory_ready_count: memoryReadyCount,
    memory_ready_pct: profiles.length === 0 ? 0 : round((memoryReadyCount / profiles.length) * 100),
    document_count: profiles.reduce((total, profile) => total + Number(profile.documents?.document_count ?? 0), 0),
    relationship_count: profiles.reduce((total, profile) => total + Number(profile.heart?.relationship_count ?? 0), 0),
    queued_submission_count: workspaces.reduce(
      (total, workspace) => total + Number(workspace.queued_submission_count ?? 0),
      0,
    ),
    avg_token_savings_pct: average(reports.map((report) => Number(report.metrics?.token_savings_pct ?? 0))),
    total_cost_savings_usd: round(
      reports.reduce((total, report) => total + Number(report.metrics?.token_cost_savings_usd ?? 0), 0),
    ),
  };
}

function buildRepositoryReadinessRows(profiles) {
  return [...profiles]
    .map((profile) => {
      const docs = Number(profile.documents?.document_count ?? 0);
      const links = Number(profile.heart?.relationship_count ?? 0);
      const warnings = Number(profile.overview?.policy_warnings ?? 0);
      const score = computeReadinessScore(profile);
      return {
        profile_slug: profile.profile_slug,
        repo: profile.repo,
        summary: `${docs} docs · ${links} links · ${warnings} warnings`,
        status: score >= 80 ? "Expansion-ready" : score >= 60 ? "Usable" : "Needs memory work",
        score,
      };
    })
    .sort((left, right) => right.score - left.score);
}

function buildWorkspaceValueRows(workspaces) {
  return [...workspaces]
    .map((workspace) => {
      const coverageTone = workspace.profile_available && workspace.document_available ? "positive" : "neutral";
      const coverageLabel = workspace.profile_available && workspace.document_available ? "Ready" : "Partial";
      return {
        workspace_slug: workspace.workspace_slug,
        repo: workspace.repo,
        coverage_tone: coverageTone,
        coverage_label: coverageLabel,
        queued_submission_count: Number(workspace.queued_submission_count ?? 0),
        benchmark_report_count: Number(workspace.benchmark_report_count ?? 0),
        avg_token_savings_pct: clampPercentage(workspace.avg_token_savings_pct),
        avg_memory_refresh_reduction_pct: clampPercentage(workspace.avg_memory_refresh_reduction_pct),
        latest_sync_at: workspace.latest_sync_at,
      };
    })
    .sort((left, right) => {
      if (right.avg_token_savings_pct !== left.avg_token_savings_pct) {
        return right.avg_token_savings_pct - left.avg_token_savings_pct;
      }

      return left.queued_submission_count - right.queued_submission_count;
    });
}

function computeReadinessScore(profile) {
  const docs = Number(profile.documents?.document_count ?? 0);
  const links = Number(profile.heart?.relationship_count ?? 0);
  const domains = Number(profile.heart?.domain_count ?? 0);
  const warnings = Number(profile.overview?.policy_warnings ?? 0);
  const symbols = Number(profile.overview?.symbol_count ?? 0);

  let score = 10;
  if (symbols > 0) {
    score += 18;
  }
  if (docs > 0) {
    score += 24;
  }
  if (links > 0) {
    score += 26;
  }
  if (domains > 0) {
    score += 14;
  }
  if (warnings === 0) {
    score += 12;
  } else {
    score -= Math.min(12, warnings * 3);
  }

  return Math.max(0, Math.min(100, round(score)));
}

function average(values) {
  const safeValues = values.filter((value) => Number.isFinite(Number(value)));
  if (safeValues.length === 0) {
    return 0;
  }

  return round(
    safeValues.reduce((sum, value) => sum + Number(value), 0) / safeValues.length,
  );
}

function clampPercentage(value) {
  return Math.max(0, Math.min(100, round(Number(value ?? 0))));
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function formatScenarioLabel(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTimestamp(value) {
  if (!value) {
    return "Waiting for sync";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
